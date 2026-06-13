# Commissioner Workflow Validation Plan

**Type:** End-to-end manual validation pass — not a feature build.

**Sprint:** Sprint 5 (Priority 4)

**Audience:** Senior engineer executing the validation. All test steps reference real files and routes so you do not need to ask questions before starting.

**Done signal:** All items in the "Done criteria" section are checked. Update `docs/04-operations/commissioner-runbook.md` with any findings, then mark this item complete in `docs/01-roadmap/roadmap-sprints.md`.

---

## Scope

Validate every commissioner action end-to-end: the admin UI surfaces the control, the API route executes correctly, the audit log records the action, and the runbook describes it accurately. The validation is manual (no new automated tests) — the goal is finding gaps between what the code does and what the runbook says, not writing unit tests.

### Commissioner actions to validate

1. **League settings edit** (pre-draft only) — `LeagueSettingsEditor` → `PUT /api/leagues/[leagueId]/settings`
2. **Draft setup** — "Set up draft board" → `POST /api/leagues/[leagueId]/draft/setup`
3. **Force-start auto-draft** — `AutoDraftButton` → `POST /api/leagues/[leagueId]/auto-draft` (dev/replay only)
4. **Draft pause** — Pause button in draft room → `lib/draft/server.ts` PAUSE handler → `COMMISSIONER_DRAFT_PAUSED` event
5. **Draft resume** — Resume button → `COMMISSIONER_DRAFT_RESUMED` event
6. **Undo draft pick** — Admin panel → `POST /api/leagues/[leagueId]/commissioner/undo-transaction` with `{ type: "draft-pick" }` — requires draft PAUSED
7. **Force roster move** — Admin panel → `POST /api/leagues/[leagueId]/commissioner/force-move`
8. **Unlock locked player** — Admin panel → `POST /api/leagues/[leagueId]/commissioner/unlock-player`
9. **Undo waiver transaction** — Admin panel → `POST /api/leagues/[leagueId]/commissioner/undo-transaction` with `{ type: "waiver", teamId }`
10. **Replace manager** — Admin panel → `PUT /api/leagues/[leagueId]/teams/[teamId]/owner`
11. **League announcement** — Admin panel → `AnnouncementForm` → `PUT /api/leagues/[leagueId]/announcement`
12. **Season start** — Admin panel → `SeasonView` → `POST /api/leagues/[leagueId]/season` `{ action: "start" }`
13. **Season advance** (dev/replay) — SeasonControls → `POST /api/leagues/[leagueId]/season/advance`
14. **Playoff initialization** — "Start Playoffs" → `POST /api/leagues/[leagueId]/start-playoffs`
15. **Playoff round advancement** — SeasonControls → `POST /api/leagues/[leagueId]/advance-playoff-round`
16. **League renewal** — Admin panel → `RenewLeagueForm` → `POST /api/leagues/[leagueId]/renew` (requires `playoffStatus === COMPLETE`)

---

## Setup

Use the seed stack to create a controlled test environment:

```bash
npm run seed && npm run seed-draft
# record the printed leagueId and team IDs

npm run draft-server   # terminal 1
```

For in-season tests, run the simulate script to get to a usable state quickly:

```bash
npx tsx scripts/simulate-season.ts --dry-run   # preview what will happen
npx tsx scripts/simulate-season.ts             # creates league, drafts, scores all weeks, starts playoffs, crowns champion
```

Commissioner credentials from seed: `commish@dev.local` (no password — email-only auth).

---

## Test Matrix

For each action: set up state, execute, verify outcome, verify audit log entry.

### 1. League Settings Edit

**Setup:** League in PRE_DRAFT state (before draft setup). Log in as commissioner.

**Steps:**
1. Navigate to `/league/[leagueId]/admin`.
2. Locate "League settings (editor)" section. Confirm it is visible and editable (not the locked view).
3. Change `maxTeams` to a different value and submit.

**Verify:**
- `FantasyLeague.maxTeams` updated in DB (check via Prisma Studio or `npx prisma studio`).
- Audit log section at bottom of admin page shows a `COMMISSIONER_SETTINGS_CHANGED` entry.

**Verify runbook:** `docs/04-operations/commissioner-runbook.md` § "League Setup Checklist" — confirm it mentions the settings are locked after the draft. If it does not, add a note.

---

### 2. Draft Setup

**Setup:** League with 2+ teams, no draft board yet.

**Steps:**
1. Navigate to `/league/[leagueId]/admin`.
2. Click "Set up draft board" (via `SetupDraftButton`).

**Verify:**
- Admin page refreshes and now shows the Draft section with status `PENDING`.
- Each team has a draft order number.
- Draft room links appear for each team.
- No error in the browser console.

**Runbook check:** § "Draft Preparation" — confirm it says to set up the draft board before inviting managers to the draft room.

---

### 3. Draft Pause / Resume

**Setup:** Active draft (`IN_PROGRESS`). Open the draft room as commissioner at `/draft/[leagueId]?team=[commTeamId]`.

**Steps:**
1. Start the draft (click "Start Draft" as commissioner).
2. Confirm the clock is running and pick order is displayed.
3. Click "Pause" (commissioner-only button in TopBar).
4. Confirm the clock stops and draft status shows PAUSED.
5. Click "Resume".
6. Confirm the clock resumes from the correct remaining time.

**Verify:**
- `Draft.status` in DB flips PAUSED → IN_PROGRESS.
- Audit log shows `COMMISSIONER_DRAFT_PAUSED` followed by `COMMISSIONER_DRAFT_RESUMED`.
- The admin page shows "⏸ Draft is currently PAUSED" banner while paused.

**Edge case:** Attempt to pause/resume as a non-commissioner team. Confirm the buttons are not visible. Confirm the server rejects the message (check `server.ts` `isCommissioner()` guard — the check uses `ws.teamId === league.commissionerTeamId`).

**Runbook check:** § "Draft Day Operations / During Draft" describes pause/resume. Verify the steps match the UI as it actually exists (button labels, location in TopBar).

---

### 4. Undo Draft Pick

**Setup:** Draft must be PAUSED with at least one pick made.

**Steps:**
1. Start and pause a draft mid-way (after pick 1 is made).
2. Navigate to `/league/[leagueId]/admin` → Commissioner Tools.
3. Use the Undo Transaction control to undo a draft pick (`type: draft-pick`).

**Verify:**
- The last `DraftPick` row has `playerId = null`, `pickedAt = null`, `auto = false`.
- `Draft.currentPick` is decremented back by 1.
- The player no longer appears on the team's roster (`RosterEntry` row deleted).
- Audit log shows `COMMISSIONER_UNDO_TRANSACTION` with `undoneType: DRAFT_PICK`.

**Edge case:** Attempt the same request while the draft is IN_PROGRESS (not paused). Confirm the API returns 409 with "Draft must be PAUSED to undo a pick."

**Code review:** Confirm `undoDraftPick()` in `app/api/leagues/[leagueId]/commissioner/undo-transaction/route.ts` wraps all three DB writes (`draftPick.update`, `rosterEntry.deleteMany`, `draft.update`) in a `prisma.$transaction`. They are — confirm the existing code is correct.

**Runbook check:** § "Commissioner Escalation Checklist" step "Last resort: Undo Transaction tool" — verify the description says the draft must be PAUSED and describes what gets reversed. Update to specify "three DB writes are atomic."

---

### 5. Force Roster Move

**Setup:** An in-season league with a player on a team's BENCH that is eligible for FORWARD.

**Steps:**
1. Navigate to admin → Commissioner Tools → Force Roster Move.
2. Select the team, select the player, select slot FORWARD, submit.

**Verify:**
- `RosterEntry.slot` updated in DB.
- Audit log shows `COMMISSIONER_FORCE_MOVE` with `fromSlot` and `toSlot`.
- The player appears in the FORWARD slot on the team's lineup page.

**Edge case — locked player:** Attempt to move a player whose PWHL team has played in the current scoring period. Confirm the API returns 409 "is locked for this scoring period." Confirm the runbook documents this constraint.

**Edge case — ineligible slot:** Attempt to move a goalie to FORWARD. Confirm the API returns 422 with an eligibility error.

**Edge case — swap path:** Provide `swapWithPlayerId` to swap two players. Confirm both slots update atomically and audit log records the swap.

**Code review:** `force-move/route.ts` — confirm `apiRequireCommissioner` guard is the first auth check after `apiRequireAuth`. Confirm `logCommissionerAction` is called on all three exit paths (single move, swap, and early-return same-slot no-op). Note: the same-slot no-op path (`slotA === slotB`) returns `{ success: true }` without logging — this is correct behavior, but confirm it is not reachable with a locked player.

**Runbook check:** § "Commissioner Tools / Force Roster Move" is currently very brief. Add the constraint that the player cannot be locked (played in the current scoring period) and that the slot must be eligible for the player's position.

---

### 6. Unlock Locked Player

**Setup:** In-season league. Advance the sim date so a player's PWHL team has played a game this period (the player becomes locked with `lockTime()` returning true).

**Steps:**
1. Navigate to admin → Commissioner Tools.
2. Use the Unlock Player control: select team, player (locked), target slot.
3. Submit.

**Verify:**
- `RosterEntry.slot` updated.
- Audit log shows `COMMISSIONER_FORCE_MOVE` with `bypassLock: true`.

**Edge case — play-lock:** Player has `statLine.count > 0` for games in the current period AND the target slot is BENCH or IR. Confirm the API returns 409 "Player has already scored this period — cannot move to bench." This is the play-lock rule — it cannot be bypassed even by the commissioner.

**Code review:** `unlock-player/route.ts` — confirm `params` destructuring uses the awaited pattern. Note: this route uses `{ params }: { params: { leagueId: string } }` (not `Promise<{...}>`). This works in Next.js 14 but confirm it does not cause build errors with the async params pattern used elsewhere. Flag for the engineer to verify.

**Runbook check:** § "Commissioner Tools" does not currently describe unlock-player as a separate action from force-move. Add a brief note: "Use Unlock Player to move a period-locked player. Cannot override play-lock (player has already scored this period)."

---

### 7. Undo Waiver Transaction

**Setup:** A team has a PLAYER_ADD `LeagueEvent` — the player was added via the waiver/free-agent route. Confirm a `LeagueEvent` row exists with `type: PLAYER_ADD` for the team.

**Steps:**
1. Navigate to admin → Commissioner Tools → Undo Transaction.
2. Select `type: waiver`, select the team, submit.

**Verify:**
- `RosterEntry` for the player on the target team is deleted.
- The `LeagueEvent` row for the add is deleted (not just marked undone).
- Audit log shows `COMMISSIONER_UNDO_TRANSACTION` with `undoneType: PLAYER_ADD`.

**Edge case — player since dropped:** Player was added then dropped by the manager. The `RosterEntry` no longer exists. Confirm the API returns 409 "Player is no longer on this team."

**Edge case — no events:** Team has no `PLAYER_ADD` or `PLAYER_DROP` events. Confirm the API returns 404 "No waiver transaction found to undo."

**Code review:** `undo-transaction/route.ts` `undoWaiverTransaction()` — confirm `(db as any).leagueEvent` guard is present (the `leagueEvent` model requires `prisma db push` in the target env). If the guard is missing and `LeagueEvent` isn't in the schema, this will throw at runtime — not return a clean error. Verify the `prisma db push` step has been run in the dev environment before testing.

---

### 8. Replace Manager

**Setup:** An in-season league with a manager you want to replace.

**Steps:**
1. Navigate to admin → Commissioner Tools → Replace Manager.
2. Enter a new owner email (e.g., `newowner@test.local`), select the team, submit.

**Verify:**
- `FantasyTeam.ownerId` updated in DB.
- A new `User` row is created for `newowner@test.local` if it did not exist (upsert).
- Roster, `RosterEntry`, `Matchup` rows for the team are unchanged.
- Audit log shows `COMMISSIONER_REPLACE_MANAGER` with `previousOwnerId`, `newOwnerId`, `teamName`.

**Edge case — email already in the league:** Enter the email of a manager who already owns a different team in the same league. Confirm the API returns 409 "already owns another team in this league."

**Edge case — commissioner replacing themselves:** Attempt to assign the commissioner's own email to another team. Confirm the API does not block this (it is allowed), but note the commissioner's team-1 would now have a different owner, which means the "isCommissioner" check in the admin panel might degrade. Flag as a known edge case.

**Runbook check:** § "Handling Inactive Managers" and § "Replace Manager" — update to say that the replacement owner does not need a pre-existing account (it is created automatically via email upsert), and that the replaced manager loses access to the team immediately.

---

### 9. League Announcement

**Setup:** Any league state.

**Steps:**
1. Navigate to admin → "League announcement."
2. Enter text (up to 500 chars), save.
3. Navigate to `/league/[leagueId]/` (the overview page).

**Verify:**
- `📣` announcement banner appears at the top of the overview with the exact text.
- Clear the announcement (submit empty string). Banner disappears.

**Edge case — 500 char limit:** Paste 501 characters. Confirm the API trims or rejects (check `announcement/route.ts` — it trims + caps at 500 chars server-side). Confirm the UI does not allow more than 500 chars in the input (or that server enforcement is the backstop).

**Runbook check:** § "League Welcome Message" — add a note that the commissioner can pin an announcement via the admin panel that appears on the league overview for all managers.

---

### 10. Season Start

**Setup:** Draft is COMPLETE, league is PRE_SEASON or PRE_DRAFT (draft done but season not started).

**Steps:**
1. Navigate to admin → Season Management.
2. Click "Start Season."

**Verify:**
- `FantasyLeague.status` flips to `IN_SEASON`.
- `Matchup` rows are generated for the first scoring period.
- The lineup page becomes accessible for all managers.

**Edge case — already in season:** Attempt to call `POST /api/leagues/[leagueId]/season` `{ action: "start" }` again. Confirm it is idempotent or returns a 409.

**Runbook check:** § "Season Management / Weekly Checklist" — add a setup step: "Before Week 1 begins, use Season Management in the admin panel to start the season."

---

### 11. Playoff Initialization

**Setup:** All regular-season scoring periods are COMPLETE. `playoffStatus === NOT_STARTED`.

**Steps:**
1. Navigate to admin → Season Management → click "▶ Start Playoffs."

**Verify:**
- `FantasyLeague.playoffStatus` flips to `IN_PROGRESS`.
- `Matchup` rows for playoff round 1 (1v4, 2v3) are created with `isPlayoff: true`, `round: 1`.
- Bracket page at `/league/[leagueId]/bracket` shows the correct seedings.

**Edge case — fewer than 4 teams in the league:** Confirm `start-playoffs` route handles the edge case gracefully (the service validates team count against `playoffSettings.teamsInPlayoff`).

**Runbook check:** § "Playoffs" — update with the actual admin UI path to start playoffs. Currently it says "4 teams qualify. Bracket: 1 vs 4, 2 vs 3. No byes." — this is correct but does not tell the commissioner how to initialize them. Add: "To start playoffs: go to Admin → Season Management and click 'Start Playoffs' after the final regular-season week is scored."

---

### 12. Playoff Round Advancement

**Setup:** Playoffs are IN_PROGRESS. Round 1 matchups are scored.

**Steps:**
1. Navigate to admin → Season Management.
2. Click "Advance Playoff Round" (or equivalent button in SeasonControls).

**Verify:**
- Round 2 (Championship) matchup row is created with the correct winners from Round 1.
- `Matchup.round` is set to 2.
- Bracket page updates to show Round 2 with correct participants.

**Code review:** `POST /api/leagues/[leagueId]/advance-playoff-round` — confirm `apiRequireCommissioner` guard is present (it is a commissioner-only route). Confirm the winning team is determined by `homeScore > awayScore` (or higher seed wins ties per `higherSeedWinsTies` setting).

**Runbook check:** § "Playoffs" — add: "To advance to the next playoff round: go to Admin → Season Management and click 'Advance Playoff Round' after all current-round matchups are scored."

---

### 13. Season Renewal

**Setup:** `playoffStatus === COMPLETE`. Champion has been crowned.

**Steps:**
1. Navigate to admin → "Start next season."
2. Confirm the section is visible (gated on `playoffStatus === COMPLETE`).
3. Click "Start Next Season."

**Verify:**
- A new `FantasyLeague` is created with `parentLeagueId` pointing to the current league.
- `season` is bumped (e.g., `"2026-27"` → `"2027-28"`).
- `scoringSettings`, `rosterSettings`, `playoffSettings`, `draftType`, `maxTeams` are copied.
- Redirect lands on `/league/[newLeagueId]/admin?renewed=1`.
- The renewed banner appears on the new admin page.
- Calling renewal again on the same league returns the existing child league ID (idempotent — `RenewalBlockedError` with "already renewed").

**Edge case — playoff not complete:** Confirm the "Start next season" section does not appear when `playoffStatus !== COMPLETE`. Confirm the API returns 409 if called directly.

**Runbook check:** § "Season Renewal" steps are generic ("Renew league → Retain managers → Update rules → Schedule next draft"). Update with the actual UI path and confirm managers must re-join the new league (they are not automatically carried over).

---

## Code Review Checklist

Run through these before marking validation complete. You are reading, not writing code — flag issues as notes in this document.

### Auth guards

For each of the following routes, confirm the pattern `apiRequireAuth` → `apiRequireCommissioner` appears before any DB write:

- [ ] `app/api/leagues/[leagueId]/commissioner/force-move/route.ts` — POST
- [ ] `app/api/leagues/[leagueId]/commissioner/undo-transaction/route.ts` — POST
- [ ] `app/api/leagues/[leagueId]/commissioner/unlock-player/route.ts` — POST
- [ ] `app/api/leagues/[leagueId]/teams/[teamId]/owner/route.ts` — PUT
- [ ] `app/api/leagues/[leagueId]/announcement/route.ts` — PUT
- [ ] `app/api/leagues/[leagueId]/start-playoffs/route.ts` — POST
- [ ] `app/api/leagues/[leagueId]/advance-playoff-round/route.ts` — POST
- [ ] `app/api/leagues/[leagueId]/renew/route.ts` — POST
- [ ] `app/api/leagues/[leagueId]/settings/route.ts` — PUT

### Audit log coverage

Confirm `logCommissionerAction` is called (not just imported) in these files:

- [ ] `force-move/route.ts` — single-move path AND swap path (two separate calls — both must log)
- [ ] `undo-transaction/route.ts` — `undoWaiverTransaction` AND `undoDraftPick` (both call `logCommissionerAction`)
- [ ] `unlock-player/route.ts` — after `rosterEntry.updateMany`
- [ ] `teams/[teamId]/owner/route.ts` — after `fantasyTeam.update`
- [ ] `lib/draft/server.ts` — PAUSE effect and RESUME effect (via private `logDraftAction()` helper)

### UI guard conditions

Confirm these UI sections are correctly gated:

- [ ] "Commissioner tools" section in `admin/page.tsx` — only shown when `draftDone === true` (line `{draftDone && (<section ...>`)
- [ ] "League settings (editor)" — only shown when `!draftDone`; locked view shown when `draftDone`
- [ ] "Start next season" section — only shown when `league.playoffStatus === "COMPLETE"`
- [ ] "Draft paused" banner — only shown when `league.draft?.status === "PAUSED"`
- [ ] `AutoDraftButton` — only shown when `isDev === true` (dev mode or replay league)
- [ ] Start/Pause/Resume buttons in draft room `TopBar` — only shown when `isCommissioner === true` (client-side prop from server page)

### Async params consistency

- [ ] `unlock-player/route.ts` uses `{ params }: { params: { leagueId: string } }` (non-async). All other commissioner routes use `Promise<{ leagueId: string }>`. Flag if this causes a Next.js 15 warning in dev. It should still work but is inconsistent with the rest of the codebase.

### `leagueEvent` Prisma guard

- [ ] `undo-transaction/route.ts` uses `(db as any).leagueEvent` on lines 43 and 96. Confirm `npx prisma db push` has been run in the dev environment and `LeagueEvent` is accessible. If the table doesn't exist, the undo-waiver flow will throw a runtime error rather than returning a clean 404/422.

---

## Runbook Review Checklist

Work through `docs/04-operations/commissioner-runbook.md` section by section. For each section, verify it accurately describes current behavior. Apply fixes directly to the runbook file.

| Section | What to verify | Status |
|---|---|---|
| "League Setup Checklist" | Settings are locked after draft — add this note | [ ] |
| "Invite Managers" | Invite link flow matches `InviteLinkButton` component behavior | [ ] |
| "Draft Preparation" | Steps match what the admin panel actually shows | [ ] |
| "Draft Day Operations / During Draft" | Pause/Resume button labels and location are correct | [ ] |
| "Draft Reliability Guide" | All content is accurate (this section was added during Sprint 5 draft cert) | [ ] |
| "Commissioner Escalation Checklist" | Undo Transaction steps are accurate; draft must be PAUSED | [ ] |
| "Commissioner Tools / Force Roster Move" | Add: player cannot be locked; slot must match position eligibility | [ ] |
| "Commissioner Tools / Undo Transaction" | Add: waiver undo reverses last PLAYER_ADD or PLAYER_DROP for a team | [ ] |
| "Commissioner Tools / Replace Manager" | Add: new owner account is created automatically if email is unknown | [ ] |
| "VP Standings Overview" | Verify the Model A VP values match `league-rules-v1.md` (win=2VP, 1st=+2VP, 2nd=+1VP) | [ ] |
| "Playoffs" | Add how to initialize playoffs and advance rounds from the admin panel | [ ] |
| "End of Season" | Add that the champion banner appears on the franchise page | [ ] |
| "Season Renewal" | Add the actual UI path and clarify managers must re-join the new league | [ ] |
| "Common Issues / Draft Disconnect" | Verify the runbook matches the reconnect backoff behavior (1s→2s→4s→8s→16s→30s cap) | [ ] |

---

## Done Criteria

All of the following must be true before marking this item complete:

- [ ] Every commissioner action in the scope list (16 total) has been manually exercised end-to-end at least once in a dev environment.
- [ ] Each action produced the expected audit log entry (visible in the admin panel's Audit Log section or via Prisma Studio).
- [ ] Every item in the Code Review Checklist has been checked. Any gaps found are either fixed (if trivial) or documented as issues in `docs/01-roadmap/roadmap-sprints.md` as Sprint 6 carry-forwards.
- [ ] Every item in the Runbook Review Checklist has been verified. Runbook sections that were inaccurate or missing content have been updated in `docs/04-operations/commissioner-runbook.md`.
- [ ] The `unlock-player/route.ts` async-params inconsistency has been documented (fix or flag for the next code pass).
- [ ] The `leagueEvent` Prisma guard behavior for `undo-transaction` has been verified as working in the dev environment.
- [ ] This file has been updated with any findings discovered during the validation (add a "Findings" section at the bottom).

---

## Findings

*Fill in during validation. Each finding should note: action tested, what was expected, what happened, and how it was resolved.*

| # | Action | Finding | Resolution | Status |
|---|---|---|---|---|
| — | — | No findings yet | — | — |
