# IA-011: Hide Advanced Non-v1 Settings — Acceptance Checklist

**Roadmap item:** IA-011 (Phase 0 / P2)
**Sprint:** Sprint 3 (beta readiness)
**Status:** Not yet implemented

The v1 product is a fixed 4-team single-elimination bracket with no byes, a fixed 13-slot
roster, and VP scoring. Several places in the UI expose controls or explanatory text that
imply configurable alternatives (multi-round byes, raw JSON settings). These must be hidden
before beta so users are not confused by options that have no effect.

Relevant files from CLAUDE.md:
- Bracket page: `app/league/[leagueId]/bracket/page.tsx` (or route dir)
- Admin panel: `app/league/[leagueId]/admin/page.tsx`
- Playoff settings schema default: `FantasyLeague.playoffSettings` JSON with `topSeedsWithBye: 0`

---

## Acceptance criteria

**AC-IA011-001 — Bracket: no-bye text is hidden when byes are zero**
Given `FantasyLeague.playoffSettings.topSeedsWithBye === 0`,
when a user opens `/league/[leagueId]/bracket`,
then no text mentioning "top N seeds receive a bye" or "bye" is visible on the page.

**AC-IA011-002 — Bracket: correct bracket text is shown when byes are configured**
Given `topSeedsWithBye > 0` (a non-default configuration),
when a user opens the bracket page,
then the bye text renders correctly (this verifies the conditional, not just suppression).

**AC-IA011-003 — Admin panel: playoff format controls are collapsed or absent for single-elimination**
Given the league uses the default playoff format (`teamsInPlayoff: 4, topSeedsWithBye: 0`),
when the commissioner opens `/league/[leagueId]/admin`,
then no multi-round bracket configuration inputs (round count, bye count) are visible in the
playoff settings section.

**AC-IA011-004 — Admin panel: scoring settings shown as human-readable text, not raw JSON**
Given any league,
when the commissioner opens the admin panel settings section,
then scoring settings (goal weight, assist weight, etc.) are displayed as a labeled list
or table — not as a raw JSON string or a `<pre>` dump of the `scoringSettings` JSON column.

**AC-IA011-005 — Admin panel: roster settings shown as human-readable text, not raw JSON**
Given any league,
when the commissioner opens the admin panel settings section,
then roster settings (e.g. "3 Forwards, 2 Defense, 1 Goalie, 1 UTIL, 6 Bench") are
displayed in plain English — not as a raw JSON string.

**AC-IA011-006 — No regression: commissioner can still view playoff format**
Given the commissioner opens the admin panel,
when the playoff section is rendered,
then the active format (e.g. "4-team single-elimination, no byes") is stated explicitly
in readable text, even if the configuration inputs are hidden.

---

## Notes

- AC-IA011-001 through AC-IA011-003 are pure conditional-render changes: add a guard on
  `topSeedsWithBye === 0` and hide the relevant JSX. No new data fetching required.
- AC-IA011-004 and AC-IA011-005 require reading and interpreting the `scoringSettings` and
  `rosterSettings` JSON columns. Use `parseScoringSettings` from `lib/scoring/settings.ts`
  and the existing `rosterSettings as Record<string, number>` pattern from CLAUDE.md. The
  admin panel already receives the league object which includes both JSON columns.
- These are all frontend-only changes; no API routes or schema changes are needed.
