# Waiver System Specification

**Roadmap items:** #5 Waiver Wire System (Phase 2), IA-008 Finalize Waiver Spec (Phase 0 — rules finalization)

**Priority:** P1 (post-MVP / Sprint 4+). Finalizing the *rules* (IA-008) is P2 and is resolved by this document.

**Status:** Partially implemented (immediate add/drop ships) — waiver layer planned

**Related documents:**
- `docs/backlog/implementation-alignment.md` (IA-008 — the open rules decisions this spec closes)
- `docs/league-rules-v1.md` (roster construction, lineup lock)
- `docs/notification-framework-spec.md` (`WAIVER_RESULT` notification)
- `docs/commission-tools-spec.md` (undo transaction, force roster move, audit log)
- Roadmap #6 FAAB (builds on this), #8 Transaction History (logs these)

---

# Overview

Today the platform supports **immediate free-agent add/drop** via
`POST /api/leagues/[leagueId]/waiver` and the roster-page free-agent panel: a manager adds an
available player and the move applies instantly, roster-size enforced. That is the right behavior
for true free agents, but it has no fairness layer — the fastest click always wins, and a player
just dropped by one manager can be re-added by another before anyone else reacts.

The **waiver system** adds that fairness layer: recently-dropped and (optionally) all unowned
players pass through a **waiver period** during which managers submit **claims** that are resolved
in **priority order** by a scheduled job, rather than first-come-first-served.

This spec also **closes IA-008** by making the previously-undefined rules concrete: waiver
duration, priority ordering, priority reset behavior, free-agent eligibility timing, and the
claim-processing schedule.

---

# Goals

- Make player acquisition **fair and predictable**, not a reflex race.
- Keep the **common case simple**: true free agents remain instant add/drop; only waiver players
  require a claim.
- Opinionated v1 defaults (consistent with the product direction) with minimal commissioner config.
- Replay-safe: all waiver timing reads the same simulated/real clock the rest of the app uses.

## Non-goals (this spec)

- Blind-bid budgets — that is **FAAB (#6)**, a separate acquisition *type* layered on top of this.
- Trades — see `docs/trade-spec.md`.

---

# Rules Decisions (closes IA-008)

These are the approved v1 defaults. All are league settings with these defaults; only a subset is
surfaced to commissioners in v1 (the rest are hidden per IA-011).

| Decision | v1 Default | Notes |
|---|---|---|
| **Waiver duration** | **2 days** | A dropped player is on waivers for 48h before becoming a free agent. |
| **Priority ordering** | **Rolling (reverse-standings to start)** | Initial order = reverse VP standings (worst team first). |
| **Priority reset behavior** | **Move-to-last on successful claim** | A team that wins a claim drops to the back of the order. |
| **Free-agent eligibility timing** | **Players clear waivers at the daily processing run** | Until then a dropped player is claimable only via waivers, not instant add. |
| **Claim processing schedule** | **Daily, 03:00 ET** | One batch run resolves all pending claims league-wide. |
| **Are all unowned players on waivers?** | **No — only recently-dropped** | Players never rostered this season are instant-add free agents. Dropped players enter a 48h waiver window. |
| **Lineup-lock interaction** | A claim cannot drop a player already locked/played this period | Same play-lock rule as lineups (`lib/lineup.ts`). |

**Rolling priority, precisely:** every team starts with a priority number (1 = highest =
worst-standing team). When a team's claim succeeds, that team moves to the **last** priority slot
and everyone below it shifts up by one. Unsuccessful claims do not change priority. This is the
"move-to-last" model (vs. continual reverse-standings) — simpler and well understood from Yahoo.

---

# Player States

```text
            drop player
ROSTERED ───────────────► ON_WAIVERS ──(48h, cleared at daily run)──► FREE_AGENT
   ▲                          │                                            │
   │       winning claim      │            instant add                     │
   └──────────────────────────┴────────────────────────────────────────────┘
```

- **ROSTERED** — on a team.
- **ON_WAIVERS** — dropped within the waiver window; acquirable only by submitting a claim.
- **FREE_AGENT** — never rostered this season, or cleared waivers; instant add (existing behavior).

A player is "on waivers" for a league if they have a `WaiverClaim`-eligible drop event within the
last `waiverDurationHours`. No new column on `Player` is required — waiver status is derived from
recent transaction history per league (same derive-don't-store pattern used elsewhere).

---

# Data Model

```prisma
model WaiverClaim {
  id            String   @id @default(cuid())
  leagueId      String
  teamId        String
  addPlayerId   String
  dropPlayerId  String?            // optional corresponding drop to stay roster-legal
  priorityAtSubmit Int             // snapshot for auditability
  status        WaiverClaimStatus  @default(PENDING)
  failureReason String?            // e.g. ROSTER_FULL, OUTBID, PLAYER_NO_LONGER_ON_WAIVERS
  processedAt   DateTime?
  createdAt     DateTime @default(now())
  league        FantasyLeague @relation(fields: [leagueId], references: [id])
  @@index([leagueId, status])
}

enum WaiverClaimStatus { PENDING SUCCESSFUL FAILED CANCELLED }

model WaiverPriority {
  id        String @id @default(cuid())
  leagueId  String
  teamId    String
  priority  Int                    // 1 = highest
  @@unique([leagueId, teamId])
}
```

- A team may have **multiple pending claims**; they are ranked by the team (claim order) so a
  failed higher claim falls through to the next.
- `priorityAtSubmit` is a snapshot for the transaction log / audit; the live order lives in
  `WaiverPriority`.
- Drops that initiate a waiver window are recorded via the existing `LeagueEvent`
  (`PLAYER_DROP`), so "on waivers" is derivable without a new field.

---

# Claim Submission (manager flow)

- On the roster / free-agent panel, players on waivers show a **"Claim"** action instead of
  **"Add"** (free agents keep instant "Add").
- Submitting a claim opens: choose the **drop** player (if roster would exceed max) and confirm.
- A manager sees their **pending claims** with their current priority and can **reorder or cancel**
  them any time before the next processing run.
- Validation at submit time (and re-validated at processing):
  - Add player is genuinely on waivers in this league.
  - Resulting roster is size-legal and position-legal.
  - Drop player is not lineup-locked / has not played this period (play-lock rule).

API:

```http
POST   /api/leagues/:leagueId/waiver/claims      { teamId, addPlayerId, dropPlayerId? }
GET    /api/leagues/:leagueId/waiver/claims?team=:teamId
PATCH  /api/leagues/:leagueId/waiver/claims/:id   { order? , cancelled? }
```

The existing instant `POST /api/leagues/:leagueId/waiver` path remains for **free agents only**;
it must now reject players that are currently on waivers (returns 409 with `ON_WAIVERS`).

---

# Claim Processing (scheduled job)

A daily batch (`processWaivers(leagueId, nowMs, prisma)`), idempotent, runs at the configured time:

1. Load `WaiverPriority` order and all `PENDING` claims for the league.
2. Walk teams in priority order. For each team, take its highest-ranked still-valid claim:
   - Re-validate roster legality and that the add player is still on waivers and unclaimed-this-run.
   - If valid → execute the add (+ optional drop) atomically, mark claim `SUCCESSFUL`, **move the
     team to last priority**, and mark that player as taken for this run.
   - If invalid → mark `FAILED` with `failureReason`, continue to that team's next claim.
3. Players that clear their waiver window with no successful claim become **FREE_AGENT**.
4. Emit a `WAIVER_RESULT` notification (per `docs/notification-framework-spec.md`) to each claiming
   manager — success or failure — and a `LeagueEvent` for successful adds/drops.

Properties:
- **Atomic** per executed claim (`prisma.$transaction`).
- **Idempotent** — a re-run with the same `nowMs` produces no duplicate moves (claims already
  `SUCCESSFUL`/`FAILED` are skipped).
- **Replay-safe** — `nowMs` is passed in; in dev/replay it comes from the sim clock, so QA leagues
  process waivers at simulated time. In production a scheduler (cron / background job) invokes it.

---

# Commissioner Controls

Per `docs/commission-tools-spec.md`:

- **Force a roster move** — bypass waivers when correcting a problem.
- **Undo transaction** — reverse a processed claim (restores rosters + priority).
- **Cancel/edit pending claims** — for inactive-manager cleanup.
- All waiver actions appear in the **commissioner audit log**.

MVP commissioner-facing settings: enable/disable waivers, waiver duration, processing time.
Everything else uses defaults and stays hidden (IA-011).

---

# Analytics

| Event | When |
|---|---|
| `waiver_claim_submitted` | Manager submits a claim |
| `waiver_claim_cancelled` | Claim cancelled before run |
| `waiver_run_processed` | Batch completes (counts of success/fail) |
| `waiver_claim_result` | Per claim resolution (with reason) |

---

# Acceptance Criteria

- Dropped players enter a 48h waiver window and are claim-only during it; never-rostered players
  remain instant-add free agents.
- Claims resolve in rolling priority order on the daily run; a winning team moves to last priority.
- A team's lower-ranked claim is tried when its higher one fails (e.g. roster full from a prior win).
- Processing is atomic, idempotent, and replay-safe.
- Every claimant receives a `WAIVER_RESULT` notification; every executed move is logged.
- The instant free-agent path rejects players currently on waivers.
- Commissioners can force moves, undo a processed claim, and see all of it in the audit log.

---

# Dependencies & Sequencing

- **Builds on:** existing free-agent add/drop, `LeagueEvent`, play-lock rule (`lib/lineup.ts`),
  notification framework (`WAIVER_RESULT`), and a background-job runner (roadmap Background Jobs).
- **Feeds:** Transaction History (#8) reads waiver claims; FAAB (#6) replaces priority ordering
  with blind-bid budgets on top of this same claim/processing machinery.
- **Sequencing:** ships in Sprint 4+ after the Trade System per the roadmap order
  (#7 → #8 → #5 → #6), but the rules decisions above (IA-008) are final now.

---

# Out of Scope (this spec)

- FAAB blind bidding and budgets (#6).
- Trade-driven roster changes (`docs/trade-spec.md`).
- Continuous (non-batched) waiver clearing.
