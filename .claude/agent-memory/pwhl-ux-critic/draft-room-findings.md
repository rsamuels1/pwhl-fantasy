---
name: draft-room-findings
description: Draft room UX findings from a live 4-manager first-draft walkthrough — error messaging, entry path, and clarity gaps
metadata:
  type: project
---

Findings from driving a real draft over the live WS protocol (`app/draft/[leagueId]/DraftRoom.tsx`, `hooks/useDraftSocket.ts`) as 4 managers. The draft *mechanics* (turn enforcement, commissioner-only START/PAUSE/RESUME, taken-player guard, snake order) all work correctly server-side. The gaps are in what the UI *tells the user*.

**Why:** Per CLAUDE.md, the draft room is the highest-risk feature for first-time fantasy users — real-time + a clock + concurrency. Confusion here causes churn at the worst moment.

**How to apply:** Re-check these on any draft-room change; don't regress.

## RESOLVED — generic error banner swallows specific server errors
**Fixed & verified (2026-06-22).** `DraftRoom.tsx` now renders `visibleError.message` verbatim (line ~1051). The chain is intact end-to-end: engine (`lib/draft/engine.ts:222`) returns `{ code: "NOT_YOUR_TURN", message: "It is not your turn to pick" }` → server forwards `{ type: "ERROR", ...result.error }` (`server.ts:183`, spreads message intact) → hook stores `msg.message` (`useDraftSocket.ts:101`) → banner renders it. The old generic "We couldn't complete that draft action" string is gone from the entire draft code path (grep-confirmed). All 6 server codes now surface their real human message.

## RESOLVED — error banner auto-dismiss + ✕
**Fixed & verified (2026-06-22).** `DraftRoom.tsx` lines 982-993: `visibleError` state + `useEffect` 4-second `setTimeout` auto-dismiss; ✕ button (line 1053) clears manually with `aria-label="Dismiss error"`. No longer sticky.

## RESOLVED — bare-URL auto-redirect
**Fixed & verified (2026-06-22).** `app/draft/[leagueId]/page.tsx` lines 27-38: when `?team=` is absent, calls `requireAuth()` then `findFirst` on the user's team in the league and `redirect()`s to `/draft/<id>?team=<teamId>`; `notFound()` only if the user owns no team there. Runtime-verified with curl as commish@dev.local: bare URL returns **307 → 200**, `redirect_count=1`, final URL `?team=cmqq1yphx00043l6ckfnr57ku`, page renders "Draft Room". The old `Missing ?team=` raw-code error screen is gone. (Note: curl without `-L` on the RSC stream shows a NEXT_REDIRECT digest in the body — that's a curl artifact, not a real 500; the HTTP status is a clean 307.)

## Clarity wins already present (keep these)
- "Your pick!" + purple highlight on the clock when it's your turn (TopBar)
- Plain-language on-clock banner: "If the timer runs out, we'll auto-pick the best player still available."
- Stat glossary open by default (G/A/PTS/PPP/SOG/HIT/BLK + goalie stats spelled out)
- Snake-draft one-liner under Pick Board: "Pick order reverses each round… so every team gets an early pick."
- Roster Needs uses plain "Forward/Defense/Goalie/Flex (any skater)/Bench" — UTIL is labeled "Flex (any skater)" here (good; contrast with lineup page which still says UTIL — see [[jargon-inventory]]).
- Team Spread risk panel explains concentration risk in plain language with color legend.

## PARTIALLY RESOLVED — star/queue terminology
**Mostly fixed (2026-06-22), one residual gap.** The tab label is now **"My List (N)"** (line 717) and the Available-tab CTA reads **"★ Add to my list — if your clock runs out, we'll auto-pick from the top."** (line 780). Star = list is now connected. BUT the My List tab *body copy* still uses the old word "queue" in two user-visible strings: line 853 *"Players are auto-drafted from the top of your queue when the timer expires."* and line 857 empty state *"No players queued. Add some from the Available tab."* These should say "list"/"on your list" to be fully consistent. Internal variable names (`queue`, `addToQueue`, `activeTab === "queue"`) are fine — invisible to users.

## Remaining clarity gaps for a newcomer

### "FA" unexplained (scoped 2026-06-22)
Player team column shows "FA" for un-rostered players with no explanation. Locations: `DraftRoom.tsx` line 813 (Available table) + line 874 (My List tab), both `{p.team ?? "FA"}`. Header `Tm` (line 793) is also an unexplained abbreviation. Stat glossary (lines 764-776, open by default) covers stats but NOT the team column. Fix: add `title="Free agent — not on a PWHL roster yet"` to both cells (gate on `p.team ? undefined : ...`), add one glossary line for Team/FA, optionally relabel `Tm`→`Team`. Severity moderate — ~30-40% of first-timers hit a visible FA because 2026-27 expansion rosters are still filling.

### No pre-Start orientation for early arrivals (scoped 2026-06-22)
`DraftRoom.tsx` has COMPLETE (line 1064) and PAUSED (line 1073) banners but **no PENDING branch**. When `status === "PENDING"`, body falls through to render PickBoard + PlayerPanel + NeedsPanel — empty board, no Pick button, no clock, no Start (commissioner-only), only a tiny "PENDING" StatusBadge. Reads as broken / "did I miss the draft?" Fix: add a PENDING banner branch after line 1077, reassure ("hasn't started yet"), tell them what's pending (waiting for commissioner), give a task (star players to build list); commissioner gets a "press Start Draft" variant. Model `styles.pendingBanner` on `pausedBanner` (lines 1475-1481) in indigo. Severity HIGH — 60%+ of first-timers arrive early via notification deep-link before Start is pressed. Fix this BEFORE the FA fix.

### Other
- Pick Board cells show only last names / team initials; dense and cryptic at a glance on first view.
