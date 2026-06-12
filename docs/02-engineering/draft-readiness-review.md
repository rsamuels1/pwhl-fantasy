# Draft Readiness Review

**Date:** June 12, 2026

**Scope:** `lib/draft/engine.ts`, `lib/draft/server.ts`, `lib/draft/snake.ts`, `lib/draft/messages.ts`, `hooks/useDraftSocket.ts`, `app/draft/[leagueId]/DraftRoom.tsx`, `tests/draft.test.ts`, `docs/02-engineering/draft-exp-spec.md`

**Verdict:** The core engine is production-quality. The IO layer and client have real gaps that need to close before a live beta — particularly reconnection, commissioner auth enforcement, and auto-pick quality.

---

## Architecture Assessment

The pure reducer + IO separation is the right call and it's well-executed:

- `engine.ts` has zero I/O — every rule is a pure function, fully tested
- Server-authoritative clock (`expiresAt` epoch ms) — clients derive countdown, never own it
- `getRoom()` uses a `Map<string, Promise<DraftRoom>>` — concurrent JOINs coalesce on one `buildEngineState` call
- Every pick is persisted immediately inside a `prisma.$transaction` — server restart rebuilds state from DB
- `PERSIST_STATUS` effect keeps draft status durable; `DraftPick.auto` persisted for auto-escalation rebuild
- Auto-escalation state re-derived from pick history in `deriveAutoState()` — no extra schema needed

The engine can be swapped to Pusher/Ably/Supabase Realtime without touching any rules logic.

---

## Reliability

### Critical — will break in beta

**C1. No WebSocket reconnection in `useDraftSocket`**

`useDraftSocket` creates one connection and never retries on `onclose` or `onerror`. If the network blips or the draft server restarts, `connStatus` goes to `"closed"` and stays there. The user sees the "closed" status badge but nothing happens — they must manually reload the page.

The spec lists "Reconnection is supported" as a launch requirement (see "Launch Requirements" section). Drafts in an 8-team league last 45–90 minutes. A single dropped connection is expected at that scale; silent failure is unacceptable.

**Fix:** Add retry loop inside `useEffect` in `useDraftSocket.ts` — reconnect with exponential backoff (e.g., 1s, 2s, 4s, cap at 30s). On successful reconnect, send `JOIN` again; the server's `STATE` response brings the client fully current.

---

**C2. Commissioner actions not guarded server-side**

Any WebSocket client that knows the URL and a `fantasyTeamId` can send `START`, `PAUSE`, or `RESUME`. The server routes all three directly to `room.handle(ws, msg)` with no check that the sending socket belongs to the commissioner (`server.ts:52-125`).

The UI hides these buttons for non-commissioners, but the wire protocol has no enforcement. In a beta with any technically-inclined users this is a trivial exploit.

**Fix:** In `buildEngineState()`, load and store `league.commissionerId`. In `DraftRoom.handle()`, before routing `START`, `PAUSE`, `RESUME` — verify that `this.sockets.get(ws)` maps to the commissioner's team id. Return an `ERROR` otherwise.

---

**C3. Queues lost on server restart**

`EngineState.queues` is initialized to `new Map()` in `buildEngineState()` (line 333) and never loaded from the DB. A server restart or crash during a draft silently wipes all pre-ranked queues. On the next timeout, the engine falls back to `bestAvailable` — the user gets a random player with no indication that their queue was lost.

**Fix:** Persist `SET_QUEUE` payloads to a lightweight table (`DraftQueue { draftId, fantasyTeamId, playerIds Json }`). Reload in `buildEngineState()` and populate `state.queues`.

---

### High — likely to cause user frustration

**H1. Auto-pick ignores roster position needs**

`bestAvailablePlayerIds()` returns the first 50 active players ordered by `position asc, lastName asc` — effectively alphabetical within each position group. The spec requires: "Auto-pick should respect roster requirements" and "Prioritizes unfilled starting positions."

The NeedsPanel runs `simulateSlotFill()` to display position needs — but that logic is never consulted during auto-pick. A team needing 2 Goalies could receive 3 Forwards in the final rounds, ending the draft with an under-rostered goalie slot and an over-stacked bench.

**Fix:** In `onTimeout()`, before building `bestAvailable`, count the team's current picks by position, determine what slots are unfilled, and sort or filter `bestAvailable` to prioritize those positions first. Pass the team's roster counts into the TIMEOUT action or compute it in the server from `this.state.completed`.

---

**H2. No pick confirmation dialog**

The spec is explicit: `Draft Sarah Fillier? [Confirm] [Cancel]`. The current UI has a single "Pick" button — one click immediately sends `MAKE_PICK` over the WebSocket. There is no undo (CT-001 is not yet built). An accidental click on the wrong player is permanent.

This is one of the most likely sources of user complaints in a live draft. The window between click and network round-trip is fast enough that even a 500ms confirmation step prevents the worst cases.

**Fix:** Wrap `onPick` in DraftRoom to set a `pendingPick` state. Render a confirmation overlay with player name, position, and team. Confirm sends the pick; cancel clears state.

---

**H3. Auto-pick ranking is non-functional**

`bestAvailablePlayerIds()` returns players ordered alphabetically within position — the first "best available" defenseman is whoever has the earliest last name, not the highest fantasy value. In a real draft, this actively embarrasses the platform: a disconnected manager could receive a roster of alphabetically-first players.

**Fix:** Order by aggregated `StatLine` FP descending (`GROUP BY playerId` join) for the most recent season. This same query already runs for the draft room's initial stats panel — reuse it.

---

### Medium — degrades experience but doesn't break drafts

**M1. Only one clock visual state instead of three**

The spec defines three states: >30s (normal), 30–10s (warning), <10s (urgent). The `Clock` component in DraftRoom.tsx only changes appearance at ≤10s (`warn = secs <= 10`). The 30s threshold is missing.

---

**M2. No draft lobby / pre-draft waiting room**

The spec's Step 4 defines a lobby showing: team list, draft order, who is connected, and a start countdown. Currently the full 3-column draft room renders immediately, with an empty pick board and the commissioner's "Start Draft" button buried in the top bar. Managers joining a draft have no way to see who else has arrived or confirm the draft order before it starts.

---

**M3. Draft completion does not auto-navigate to season**

The spec launch requirement: "Draft completion transitions to season play automatically." On `COMPLETE`, DraftRoom shows a green banner with a "View league" link. The navigation is manual. Auto-redirect to `/league/${leagueId}` (or `/team/${teamId}/lineup`) after a short delay would satisfy this.

---

**M4. Search matches last name only**

`LIST_AVAILABLE` in server.ts line 62 filters by `lastName: { contains: msg.search }`. Searching "Sarah" returns no results. The placeholder "Search by last name…" telegraphs the limitation but first-time users won't read it.

---

## Edge Cases

### Handled correctly

| Scenario | How handled |
|---|---|
| Stale pick (client sends old `overall`) | Engine rejects with `STALE_PICK` |
| Wrong team picks | Engine rejects with `NOT_YOUR_TURN` |
| Player already drafted | Engine rejects with `PLAYER_TAKEN` |
| Timer fires while paused | `TIMEOUT` action returns `{ state, effects: [] }` — no-op |
| Server restart mid-draft | `buildEngineState()` replays persisted picks; auto-escalation re-derived from `DraftPick.auto` |
| Concurrent JOINs for same league | `roomPromises` Map ensures one `buildEngineState` call per league |
| Duplicate tab from same team | Second tab's pick gets `STALE_PICK` (first pick wins); both tabs sync via broadcast |
| Auto-escalation rebuild after restart | `deriveAutoState()` re-derives flag state from pick history |
| Flagged team resumes after pause | RESUME reads `autoFlaggedTeams` — correct `autoSecs` assigned |

### Not handled / spec-required gaps

| Scenario | Spec requirement | Current status |
|---|---|---|
| Manager disconnects and reconnects | "User may reconnect" | No retry — manual reload required |
| Server restart loses queues | Queue survives implicit in spec | Queue is in-memory only |
| Commissioner resets draft | "Commissioner may reset only before completion" | No RESET action in engine |
| Draft order regenerated pre-start | "Commissioner may regenerate order" | Requires admin panel, not draft room |
| TIMEOUT with empty bestAvailable | Draft stalls | Engine no-ops silently — draft can stall at the last few rounds if all 50 `bestAvailable` players are already drafted. This won't happen with ~220 players and 104 picks, but the 50-player cap is fragile |

---

## Missing Functionality vs Spec

| Spec item | Priority | Status |
|---|---|---|
| Reconnection supported | Launch requirement | ❌ Not built |
| Auto-pick respects roster requirements | Launch requirement | ❌ Not built (alphabetical only) |
| Confirmation before pick submission | Launch requirement | ❌ Not built |
| Draft reset (commissioner) | Edge case requirement | ❌ Not built (CT-001 scope) |
| Draft lobby with connected-manager list | Step 4 of UX flow | ❌ Not built |
| Auto-navigate to league on completion | Launch requirement | ⚠️ Manual link only |
| >30s / 30–10s / <10s visual timer states | Step 6 of UX flow | ⚠️ Only <10s implemented |
| Draft order regeneration in draft room | Step 3 of UX flow | ⚠️ Admin panel only |
| Mobile responsive draft room | Launch requirement | ⚠️ 3-column layout breaks below ~768px |
| Commissioner auth enforcement on WebSocket | Implicit security requirement | ❌ Not enforced server-side |
| Queue persistence across restarts | Implicit from reconnect spec | ❌ In-memory only |
| First-name player search | Usability | ⚠️ Last name only |
| Auto-pick quality (value-ranked) | Step 8 of UX flow | ⚠️ Alphabetical within position |

---

## Test Coverage

### Engine (strong)

28 test cases in `tests/draft.test.ts` cover:

- Snake order generation and numbering
- `rostersToRounds` slot summation
- START / PAUSE / RESUME state transitions
- MAKE_PICK validation (wrong turn, stale overall, taken player, nonexistent player)
- TIMEOUT fallback chain (queue → bestAvailable)
- Draft completion on final pick and final timeout
- Auto-escalation: flag at 2 consecutive autos, clear on manual pick, resume clock with correct duration
- `deriveAutoState` rebuilds flag state from pick history

### Server / integration (none)

No tests for:

- WebSocket message flow end-to-end
- DB persistence (PERSIST_PICK, PERSIST_STATUS, COMPLETE effects)
- Server restart and state rebuild from DB
- `buildEngineState` with partial picks
- Concurrent JOIN coalescing
- `bestAvailablePlayerIds()` ordering and behavior
- Commissioner auth on START/PAUSE/RESUME
- Multiple tabs from one team
- 8-client simultaneous draft

### What to add before beta

The engine tests are sufficient and don't need expansion. Server-layer tests are the gap. Recommended additions in order of value:

1. **Integration test: full 4-team, 13-round draft** — seed a test DB league, run `buildEngineState`, simulate all 52 picks via `reduce`, assert final DB state. This validates persistence and completion.
2. **Restart recovery test** — run 10 picks, serialize state, call `buildEngineState` again, assert `currentOverall`, `completed`, and auto-escalation state all match.
3. **Commissioner auth test** — verify that `START` from a non-commissioner socket is rejected (once the fix is in).

---

## Beta Risk Summary

| # | Risk | Severity | Likelihood in beta | Fix sprint |
|---|---|---|---|---|
| 1 | Disconnected manager sees frozen UI — must reload | High | Certain (90-min draft, any network) | Sprint 2 |
| 2 | Auto-picks produce positionally-incorrect or value-blind rosters | High | Likely (any unattended team) | Sprint 2 |
| 3 | Any client can send START/PAUSE/RESUME | High | Low (requires knowing the WS URL) | Sprint 2 |
| 4 | Server crash loses all queues — silent fallback | Medium | Low (single stable node) | Sprint 2 |
| 5 | Accidental wrong-player pick with no undo | Medium | Certain (fat-finger in live draft) | Sprint 2 |
| 6 | Mobile: 3-column layout is unusable below 768px | Medium | High (many casual users on phones) | Sprint 3 |
| 7 | Draft stalls if `bestAvailable` returns 0 players | Low | Very unlikely at current scale | Sprint 2 |
| 8 | Search by first name fails silently | Low | Certain | Sprint 2 |
| 9 | No load testing done for concurrent leagues | Medium | Unknown | Pre-beta |

---

## Recommended Pre-Beta Fixes (Sprint 2)

These are the minimum changes to make the draft reliable for a closed beta. Ordered by risk reduction:

1. **WebSocket reconnect with backoff** (`useDraftSocket.ts`) — highest user-visible impact
2. **Commissioner auth enforcement** (`server.ts`, PAUSE/RESUME/START handlers)
3. **Position-aware auto-pick** (`server.ts:bestAvailablePlayerIds()` + TIMEOUT handler)
4. **Pick confirmation dialog** (`DraftRoom.tsx`) — no undo exists; one-click picks are risky
5. **Auto-pick best-available ranking** (order by FP descending, not alphabetical)
6. **Queue persistence** (`server.ts:SET_QUEUE` → DB; load in `buildEngineState`)
7. **Increase `bestAvailable` cap or remove it** (50-player cap is fragile for edge cases)
8. **First-name search** (`server.ts:LIST_AVAILABLE`, add `OR firstName contains`)
9. **Auto-navigate after draft completes** (brief delay then `router.push`)

Items 1–3 are blockers for a live beta. Items 4–9 are strongly recommended before any external user touches the draft.
