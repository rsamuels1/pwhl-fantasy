---
name: playoff-gaps
description: Playoff UX audit findings — known gaps, broken flows, and P0/P1/P2 fix list as of 2026-06-13
metadata:
  type: project
---

Playoff UX audit completed 2026-06-13. Full details in the playoff UX audit report (delivered as assistant message). Key findings:

**P0 — Broken/blocking:**
- No production path to advance playoff rounds. Only `startPlayoffs` exists in prod routes; `scorePlayoffRound` and `populateNextRound` only live in the Founder simulate route. Commissioner has no way to score Round 1 and create Round 2 matchups in a real league.
- `getPlayoffDashboardData` in dashboard.ts finds "my current playoff matchup" with `orderBy: { round: 'desc' }` — this means an eliminated team in round 1 will see their round 1 matchup (already scored) forever, not get the `eliminationInfo` path (which requires `myMatchup` to be null).
- `week: 0` on all playoff matchups breaks the matchup hero's "Week N" label and any logic reading the week field (e.g., league overview's currentWeek derivation uses `Math.max(...matchups.map(m => m.week))`).

**P1 — Confusing:**
- No "champion crowned" moment. The bracket page shows the final scored, but there's no banner, trophy, or explicit champion announcement on the overview or matchup pages.
- No between-rounds dead zone handling. When round 1 is scored but round 2 matchups not yet created, eliminated teams see a blank matchup page (falls through to "No scoring period is active" card).
- Commissioner action strip never shows a "Score playoff round" or "Advance to round 2" CTA — only shows for regular season. Commissioner has no contextual guidance.
- Bracket page's `params` type uses `{ params: { leagueId: string } }` (non-Promise) — will break with Next.js 15 async params if not already fixed.

**P2 — Polish:**
- No "View bracket" link on the matchup page hero during playoffs.
- League overview "playoffs underway" section is a generic stub with no score summary or current matchup state.
- `MatchupHero` league leaders card (`leagueTopPerformers`) returns empty during playoffs (dashboard.ts returns `leagueTopPerformers: []` in `getPlayoffDashboardData`).

**Why:** Playoff round advancement is only wired for scripts/simulation (simulate-season.ts, founder simulate route). The production season advance route (`POST /api/leagues/[leagueId]/season`) only handles regular-season periods — playoff periods don't appear in `getSeasonState` because `derivePeriods` only uses non-playoff matchups.

**How to apply:** Any spec or feature touching playoffs must account for the missing round-advancement flow. P0 fix is a new API route or extending the season advance route to handle playoff period scoring and round 2 matchup creation.
