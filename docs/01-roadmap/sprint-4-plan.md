# Sprint 4 — Product Polish: Lineup, Commissioner UX, Rivalries

**Status:** Planned

**Theme:** Close the in-progress feature gaps before beta. Three features have been partially built and have no sprint home. Ship them cleanly.

**Goal:** No feature card enters the closed beta in "partial" state when the remaining work is small. Exit Sprint 4 with all Phase 1 and Phase 5 "in progress" features either shipped or explicitly deferred.

---

## Feature #28 — Lineup Stats Tab Polish

**Phase 1 · in progress · estimated ~25K tokens**

The lineup page stats toggle has four views (Projected / This week / Last week / Season) but the tab labels and default selection are not yet fully polished.

### Work items

- Rename the "Projected" tab label to "Matchup Proj" to clarify it shows projected points for the upcoming matchup period, not just a generic projection
- Default the selected tab to "Matchup Proj" when between weeks (no active period, but an upcoming period exists), instead of falling through to "Season"
- Disable the "This week" tab (not just visually) when no active period exists — currently it may render with empty state rather than being unavailable

### Deliverable

`components/LineupManager.tsx` tab logic updated. No schema changes. Single-component edit.

---

## Feature #01 — Commissioner Dashboard (remaining gaps)

**Phase 1 · partial · estimated ~60K tokens**

The admin panel (`app/league/[leagueId]/admin/page.tsx`) was updated in Sprint 2 to include recovery tools, audit log, and season renewal. Four gaps from the original card remain unaddressed:

### Work items

- **Pause / restart replay** — admin panel should surface a one-click "Pause season" or "Restart season" action for replay leagues (currently only available via the season controls page, which requires navigating away)
- **Force draft start** — button to force-start the draft without waiting for `draftStartsAt`; currently the commissioner must manually navigate to the draft room and click Start. A direct admin-panel CTA reduces friction.
- **Lineup lock override** — commissioner ability to unlock a specific player who was incorrectly locked (e.g., game cancelled, data error). Calls a new `POST /api/leagues/[leagueId]/commissioner/unlock-player` route.
- **Settings editor** — inline form to edit `maxTeams`, `draftType`, `scoringSettings`, and `rosterSettings` before the draft starts. Post-draft changes are blocked. Uses `apiRequireCommissioner`.

### Deliverable

Admin panel has direct controls for all common mid-league commissioner actions. New unlock-player API route. Settings editor gated on `draft.status !== "COMPLETE"`. All actions write to audit log via `logCommissionerAction`.

---

## Feature #17 — Rivalries (remaining gaps)

**Phase 5 · partial · estimated ~45K tokens**

Season-long H2H records are computed and displayed on the matchup hero in 1v1 mode. Two UX layers remain:

### Work items

- **Rival badge** — a `RIVAL` chip shown on a manager's team card (dashboard, league overview) when they have a 2+ game H2H history with another team. Computed from `getHeadToHeadRecord` in `lib/playoffs/seeding.ts`. The badge identifies the most-played opponent with a notable win/loss differential.
- **H2H history view** — a small expandable section on the matchup page (or a `/team/[teamId]/rivalry` sub-route) showing the full H2H record with a specific opponent: each matchup week, final scores, and who won. Backed by a query over `Matchup` rows filtered to the two team IDs.

### Deliverable

Rival badge renders on team cards. H2H history view accessible from the matchup page. No schema changes — built entirely on existing `Matchup` rows and `getHeadToHeadRecord`.

---

## Sprint Exit Criteria

- Lineup tab labels and defaults match the spec above
- Commissioner admin panel has controls for all four previously-missing actions
- Rival badge renders correctly for teams with ≥2 shared matchups
- H2H history view shows correct results against the 2025-26 fixture
- `npm test` passes (130+ tests)
- `npx tsc --noEmit` clean

---

## What Comes After Sprint 4

**Sprint 5 — Validation + Beta Operations:** draft reliability certification, founder ops console, beta feedback infrastructure, commissioner workflow validation. See `docs/04-operations/commissioner-runbook.md`.

**Sprint 6+ (post-beta launch features):**
- Transaction History → Trade System → Waiver priority → FAAB
- Engagement surfaces (team analysis, performance dashboard, playoff UX polish)
- Multi-season UX (league history, hall of fame, player legacy)
- Growth / retention analytics
