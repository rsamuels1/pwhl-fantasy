---
name: sprint6-shipped
description: Sprint 6 status — Auto-Set Lineup (#34) + FA Schedule Awareness (#35) + Beta Feedback Infrastructure (#36) shipped; Code Review (#37), Team Analysis (#25), Waivers (#5) remaining
metadata:
  type: project
---

Sprint 6 is IN PROGRESS as of 2026-06-14.

**Shipped (Sprint 6):**
- Auto-Set Lineup (#34) ✅ — `computeOptimalLineup()` in `lib/lineup.ts`; staged save model; "Auto-set" purple button in `LineupManager.tsx`; `beforeunload` guard; playoff period fallback for games-remaining badges; `GET /api/leagues/[leagueId]/fa-suggestions` (top 10 unrostered by projected FP). Commits: 3e6bbd0, f83468f, 1f06c9a. Spec: `docs/02-engineering/auto-set-lineup-spec.md`.
- FA Schedule Awareness + Add & Slot (#35) ✅ — games-remaining "Wk" badge on FA panel in `app/team/[teamId]/roster/`; `components/AddAndSlotModal.tsx` (eligible active slots after add; locked FAs skip modal); bonus fixes: lineup nudge respects roster settings slot count, dashboard alert checks `gamesPlayedPerTeam`. Commit: 6a6b40f. No schema changes.
- Beta Feedback Infrastructure (#36) ✅ — `components/FeedbackWidget.tsx` (fixed bottom-right button → modal with Bug/Suggestion/Other selector, textarea, submit; `ReactDOM.createPortal` into `document.body`; mounted in league, team, and founder layouts); schema: `FeedbackSubmission` model, `FeedbackType` enum (BUG/SUGGESTION/OTHER), `BetaStatus` enum (NONE/INVITED/ACCEPTED/ACTIVE/RENEWED), `betaStatus` field on `FantasyLeague`; API routes: `POST /api/feedback`, `GET /api/founder/feedback`, `PATCH /api/founder/leagues/[leagueId]/beta-status`; Founder Console: `app/founder/feedback/page.tsx` + Beta tab in `LeagueDetailTabs.tsx`.

**Remaining Sprint 6 (in priority order):**
1. Code Review & Pre-Beta Audit (#37) — staff-engineer audit before beta opens; output: prioritized findings doc (P0/P1/P2) in `docs/04-operations/` or `docs/02-engineering/`; P0 findings resolved before beta invites
2. Team Analysis & Insights (#25) — spec at `docs/02-engineering/team-analysis-spec.md`; trade suggestion CTA removed (was gated on Trade System, now deferred)
3. Waiver Priority + Processing (#5) — spec at `docs/02-engineering/waiver-spec.md`

**New Sprint 7 item — Replay Simulation V2 (#38):**
Added 2026-06-14. Accelerated & scheduled playback: configurable N-days-per-click speed, jump-to-week dropdown, replay progress summary card on league overview, and notification trigger per scored week (new `REPLAY_WEEK_COMPLETE` NotificationType with dedupeKey). Builds on existing `isReplay`/`replayCurrentDate`/`getReplayNow()`/`ReplayDayBar`. No schema changes except new enum value.

**Trade System (#7) — DEPRIORITIZED:**
Moved to bottom of backlog as of June 2026. Marked "someday maybe." Beta cohort is small enough for out-of-band trades. Spec exists at `docs/02-engineering/trade-spec.md`. Do NOT plan it into any sprint without explicit user confirmation.

**Why:** Sprint 6 started overlapping with Sprint 5 because auto-set was low-risk and pulled forward from early Sprint 6 work. Trade System deprioritized because beta cohort is small and the 130K token cost is hard to justify without confirmed demand. Code Review (#37) added as a Sprint 6 priority item (2026-06-14) because it needs to happen before the beta cohort is invited.

**How to apply:** Beta Feedback is done. Next Sprint 6 items are Code Review (#37), Team Analysis (#25, ~85K), and Waiver Priority (#5, ~110K). Trade System should not appear in any sprint plan. Sprint 7 now has 5 items (History/HoF, Storylines, FAAB, Player Legacy, Replay Sim V2).
