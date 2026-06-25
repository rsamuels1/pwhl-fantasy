---
name: project-beta-bug-fixes-jun24
description: Beta bug fixes shipped Jun 24 — TransactionFeed basePath, enum label fallback, AddAndSlotModal soft failure, VTF schedule clarity
metadata:
  type: project
---

5 beta bugs triaged on 2026-06-24. 4 fixed, 1 confirmed already resolved.

**BF-024 (P0) — FIXED:** `TransactionFeed.updateFilter()` hardcoded `/league/${leagueId}/transactions` so clicking any filter pill on the team-scoped `/team/[teamId]/transactions` page redirected to the league layout. Fixed by adding optional `basePath` prop to `TransactionFeed`; the team page passes `basePath="/team/${teamId}/transactions"` and the league page omits it (defaults to league route).

**Why:** The component was originally written for the league layout, then reused in the team layout without updating the navigation logic.

**How to apply:** Any future reuse of `TransactionFeed` outside the league layout must pass `basePath`.

---

**BF-027 (P0) — FIXED:** Raw enum strings (e.g., `LEAGUE_STORYLINE`, `PLAYOFF_CLINCH`, `PLAYOFF_ELIMINATION`, `CHAMPIONSHIP_WON`) appeared in the activity feed when events had no `description` field in their data JSON. Two-part fix:
1. `lib/services/activity.ts` `getTransactions()` now has a `TYPE_FALLBACK` map that provides human-readable strings before falling back to `e.type`.
2. `TransactionFeed.TYPE_META` now covers `PLAYOFF_CLINCH`, `PLAYOFF_ELIMINATION`, `CHAMPIONSHIP_WON` with proper labels and colors. `TYPE_GROUPS` Playoffs filter updated to include all four playoff event types.

**Why:** Sprint 21 added new `EventType` values (`PLAYOFF_CLINCH`, `PLAYOFF_ELIMINATION`, `CHAMPIONSHIP_WON`) but the display maps were not updated.

---

**BF-012 — FIXED:** `AddAndSlotModal` showed a blocking error modal when the slot-assignment API call failed (e.g., play-lock rule, slot full). The player was already successfully added to the bench, but the modal stayed open with a technical error message. Fixed: `handleSlot()` now calls `onComplete()` on API failure instead of `setError()`, treating slot failure as a soft "player is benched" outcome. The success message from `RosterManager` ("Player added to your roster") is already visible at this point.

**Why:** The add (waiver) and slot (lineup) are two separate API calls. The add succeeds; only the slot can fail. Blocking the user with an error modal for a secondary optional action is wrong UX.

---

**BF-013 — CONFIRMED ALREADY FIXED:** The `canPropose` condition in `app/team/[teamId]/trades/page.tsx` already correctly allows trades when `draft.status === "COMPLETE"` OR `league.status === "IN_SEASON"`. The `proposeTrade` service function only gates on `playoffStatus`. No regression found in current code — this was fixed in Sprint 18 and has not regressed.

---

**BF-014 — FIXED (copy/label):** The "My Season" schedule page (`/team/[teamId]/schedule`) showed a "W-L-T" column header with no explanation. In VTF mode users may interpret this as 1v1 opponent record. Fixed: subtitle text now explains "W-L-T = how many teams you outscored, underscored, or tied that week — not a single opponent." Column header renamed from "W-L-T" to "vs Field" with a title tooltip.

**Why:** VTF scoring means each week is a race vs all teams, not a head-to-head. "W-L-T" is standard sports notation that implies a 1v1 opponent record.

---

**Files changed:**
- `app/league/[leagueId]/transactions/TransactionFeed.tsx` — basePath prop, TYPE_META expansion, TYPE_GROUPS Playoffs update
- `app/team/[teamId]/transactions/page.tsx` — pass basePath prop
- `lib/services/activity.ts` — TYPE_FALLBACK map in getTransactions
- `components/AddAndSlotModal.tsx` — soft failure on slot API error
- `app/team/[teamId]/schedule/page.tsx` — VTF copy clarification, column header rename
