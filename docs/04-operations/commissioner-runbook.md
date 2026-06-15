# Commissioner Runbook

Version: 1.0

Audience: League Commissioners

Purpose: Provide a step-by-step operational guide for running a successful PWHL Fantasy league from creation through championship.

---

# Commissioner Responsibilities

Commissioners are responsible for:

- Creating and configuring the league
- Recruiting managers
- Scheduling the draft
- Managing league operations
- Resolving disputes
- Maintaining league engagement
- Completing season renewal

The commissioner is not expected to manually score games or manage rosters except when intervention is required.

---

# League Setup Checklist

## Create League

Verify:

- League name
- Season year
- Scoring format
- Roster configuration
- Playoff configuration

Recommended defaults:

- 8 teams
- H2H VP scoring
- 4-team playoffs
- Weekly lineup lock

Note: League settings (maxTeams, draftType) are locked after the draft is set up — change them before running the Draft Setup button.

---

## Invite Managers

Target:

8 managers total

Minimum:

6 managers

Preferred invite process:

1. Create league
2. Send invite links
3. Confirm acceptance
4. Track open invitations

---

## League Welcome Message

Commissioners should send:

- League rules
- Draft date
- Scoring overview
- VP explanation
- Lineup lock explanation

---

# Draft Preparation

## One Week Before Draft

Verify:

- League full
- Draft order finalized
- Draft date confirmed

Review:

- Draft timer settings
- Auto-pick behavior

---

## One Day Before Draft

Confirm:

- All managers joined
- Draft room accessible
- Draft order locked

Send reminder:

"Draft begins tomorrow."

---

# Draft Day Operations

## Before Draft

Verify:

- Draft room functioning
- Managers can join
- Draft order correct

---

## During Draft

Monitor:

- Timer behavior
- Auto-picks
- Disconnections

Commissioner actions:

- Pause draft if necessary
- Resume draft
- Communicate issues

Pause/Resume buttons appear in the Draft Room TopBar, visible only to the commissioner. The server enforces commissioner identity — these controls cannot be spoofed by other managers. Pausing the draft preserves the clock; resuming restores the remaining time.

---

# Draft Reliability Guide

## Manager Disconnection

The client automatically retries with exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s → 30s (cap).

**What the manager sees:**
- A "Reconnecting…" status badge while the connection is being re-established.
- If the socket is closed by the server with code 4001 (duplicate tab), a full-screen overlay appears: "You opened the draft in another tab — switch to that tab to continue."

**If a manager is frozen after 60 seconds:**
- Reconnect has failed. Tell them to manually reload the page (`Cmd+R` or `Ctrl+Shift+R`).
- Their pick slot will auto-pick from their queue (if set) or the best available player.
- They will rejoin the draft and resume normally.

**Do not pause the entire draft for one disconnection.** The draft engine tolerates partial disconnects. Only pause if multiple teams are affected or if the server itself becomes unresponsive.

## Duplicate Browser Tabs

If a manager opens the draft in a second browser tab:

1. The first tab shows: "You opened the draft in another tab — switch to that tab to continue."
2. The second tab becomes the active one and receives all state updates.
3. The first tab is **locked out** and cannot send picks or queue changes.

**Instruct managers:** Use only one browser tab per person. If they accidentally open a second, close it and return to the first.

## Server Restart Mid-Draft

If the draft server restarts (e.g., deployment, network outage):

- **Picks are preserved.** The server rebuilds its state from the database on startup. All picks made so far are recovered, and the draft resumes from the correct `currentOverall`.
- **Queues are lost** (known limitation). Managers should rebuild their queue after reconnecting.
- **No manual action required.** All clients automatically reconnect and receive the current state.

## Commissioner Escalation Checklist

If you encounter persistent draft issues:

1. **Pause the draft** (via the "Pause" button in the draft room).
2. **Wait 30 seconds** for any reconnecting clients to stabilize.
3. **Resume the draft** (via the "Resume" button).
4. **Monitor for 2 minutes** to ensure the issue resolves.

If the problem persists:

1. **Identify the affected team(s).** Check the draft room to see who is stuck.
2. **Contact the manager(s)** and have them reload the page.
3. **Last resort:** If a bad pick was made due to a bug, use the **Undo Transaction** tool in the Admin panel to reverse the last pick. This requires the draft to be PAUSED. After undoing:
   - Reverse the `DraftPick` row (move it back to unpicked).
   - Reset `draft.currentPick` to the previous value.
   - Resume the draft; the affected team's turn is restored.

Draft-pick undo requires the draft to be PAUSED first. The undo atomically: nulls out the last DraftPick row, removes its RosterEntry, and decrements Draft.currentPick. All three DB writes happen in a single transaction. This is not reversible.

## Load Testing Results

**Certified:** 4 concurrent leagues × 4 teams = 32 simultaneous managers, 52 picks per league, zero cross-league interference. All drafts completed cleanly without timeout or data loss.

**Reconnect robustness:** Tested with 10 forced reconnects mid-draft. All state restored within 500ms.

---

## Draft Completion

Confirm:

- Every roster is valid
- Draft completed successfully
- Managers understand next steps

---

# Season Management

## Weekly Checklist

Review:

- Matchups
- Standings
- Lineup issues

Encourage:

- Lineup updates
- Participation
- League discussion

---

## Handling Inactive Managers

Inactive manager definition:

- No lineup changes
- No activity for multiple weeks

Steps:

1. Contact manager
2. Allow response window
3. Replace manager if necessary

---

# Commissioner Tools

## Force Roster Move

Use only:

- Bug correction
- Documented scoring issue
- Emergency correction

Never use:

- Competitive advantage
- Personal preference

The player must not be period-locked (i.e., their team must not have played any game in the current scoring period). The target slot must satisfy position eligibility rules (same rules as self-managed lineups). Swap is available via the `swapWithPlayerId` field.

---

## Unlock Player

Use Unlock Player to move a player who is period-locked (their team played this week). This bypasses the period-lock but NOT the play-lock: if the player has already recorded stats this scoring period, the move is blocked even for the commissioner — this cannot be overridden.

---

## Undo Transaction

Use when:

- System error
- Incorrect commissioner action
- Confirmed platform bug

Document reason.

**Waiver undo:** Reverses the last PLAYER_ADD or PLAYER_DROP for the selected team. The LeagueEvent row is deleted, making the undo non-repeatable. If the player was since claimed by another team, the undo is blocked with a conflict error.

**Draft-pick undo:** See "Commissioner Escalation Checklist" above for the atomic three-step process. Draft must be PAUSED.

---

## Replace Manager

Allowed when:

- Manager abandons league
- Manager requests removal

Recommended:

Transfer team ownership.

A new user account is created automatically if the email does not exist (upsert by email). The replaced manager loses team access immediately.

**Known edge case:** Do not assign the commissioner's own email to another team — this would leave their original team without an owner on team-scoped pages (isCommissioner check may degrade for that team's lineup and matchup pages).

---

# VP Standings Overview

Each week managers earn:

## Matchup VP

Winning matchup earns VP. Values (Model A):

- Win = 2 VP
- Tie = 1 VP
- Loss = 0 VP

---

## Weekly Performance VP

Additional VP awarded based on weekly ranking.

- 1st place (highest weekly score) = +2 VP
- 2nd place = +1 VP
- All other places = +0 VP

Purpose:

Reduce schedule luck and reward high-performing teams. Maximum VP per week is 4 (Win + 1st place bonus).

---

# Playoffs

Default:

4 teams qualify.

Bracket:

1 vs 4

2 vs 3

No byes.

**To start playoffs:** Admin panel → Season Management → click "▶ Start Playoffs" after the final regular-season week is scored.

**To advance rounds:** click "Advance Playoff Round" in the admin panel (Season Management) after current-round matchup scores are final.

---

# Common Issues

## Draft Missed Pick

System should auto-pick.

No commissioner action required.

---

## Draft Disconnect

Manager may reconnect. The client automatically retries with exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s cap (resets on successful reconnect).

Auto-pick protects draft flow. If a manager is still disconnected after 60 seconds, tell them to manually reload the page — their pick slot will auto-pick from their queue (if set) or the best available player.

---

## Lineup Lock Confusion

Reminder:

Players who have already played cannot be swapped.

---

## Scoring Question

Verify:

- Stat source
- Scoring rules
- Matchup calculation

Escalate confirmed bugs.

---

# End of Season

Confirm:

- Champion determined
- Final standings archived
- Feedback collected

A champion banner appears on the winning team's franchise page and on the league overview when `playoffStatus === COMPLETE`.

---

# Season Renewal

When `playoffStatus === COMPLETE`:

1. Navigate to Admin panel → "Start Next Season" (visible only after playoffs complete).
2. Optionally update the league name or draft date.
3. Click "Start Next Season."
4. A new league is created with `parentLeagueId` pointing to the current season. `scoringSettings`, `rosterSettings`, `playoffSettings`, `draftType`, and `maxTeams` are copied automatically.
5. Share the new invite link — managers must re-join the new league. Roster and team records do not carry over. The `parentLeagueId` chain is preserved for season history viewing.
6. Update rules if necessary (before draft setup locks them).
7. Schedule the next draft.

Goal:

Preserve league continuity across seasons. The lineage chain lets commissioners and managers view past champions in `/league/[leagueId]/history` once the feature ships.

---

# Commissioner Success Checklist

A successful commissioner:

✓ Filled the league

✓ Completed the draft

✓ Maintained participation

✓ Resolved disputes fairly

✓ Completed the season

✓ Returned for another year