---
name: playoff-gaps
description: Playoff UX audit — all P0/P1/P2 gaps resolved in Sprint 5; feature #30 COMPLETE
metadata:
  type: project
---

Playoff UX audit was completed 2026-06-13 and identified 9 issues. All were resolved in Sprint 5 (commits bd9b22a, 5df2b0c).

**All gaps RESOLVED:**
- P0-A: `POST /api/leagues/[leagueId]/advance-playoff-round` route created with SeasonControls UI
- P0-B: Eliminated-team detection fixed in `getPlayoffDashboardData`
- P0-C: Playoff matchup week numbers assigned correctly
- P1-A: Champion announcement card + `ChampionInfo` on `DashboardData` + league overview banner
- P1-B: Commissioner action strip playoff awareness
- P1-C: "View bracket →" link in DuelHero
- P1-D: `playoffPending` between-rounds state on matchup page
- P2-A: Rich mini bracket summary in league overview
- P2-B: Async params in bracket/matchups pages

Final pieces (commit 5df2b0c): `/league/[leagueId]/` redirects to `/bracket` when `playoffStatus === IN_PROGRESS`; `PLAYOFF_CLINCH`, `PLAYOFF_ELIMINATION`, `CHAMPIONSHIP_WON` added to `EventType` enum and `LeagueEventType` union in `lib/services/activity.ts`.

**Why remembered:** Future playoff specs should know the round-advancement flow is now a proper production commissioner route, and the activity system emits playoff events.

**How to apply:** Feature #30 is COMPLETE. Any new playoff work builds on the existing `advance-playoff-round` route and activity event system — do not treat these as missing.
