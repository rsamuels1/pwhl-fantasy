# Draft Experience Specification

**Product:** PWHL Fantasy

**Priority:** P1

**Status:** Draft

**Audience:** Casual PWHL fans and first-time fantasy players

---

# Overview

The draft is the most important moment in the fantasy season.

For many users, it will be their first interaction with the platform after creating a league.

The draft experience should prioritize:

- Simplicity
- Reliability
- Transparency
- Mobile usability
- Recovery from common failures

The system should support live snake drafts with automated drafting safeguards.

---

# Goals

## User Goals

Managers should be able to:

- Join a draft easily
- Understand when they are on the clock
- Draft players quickly
- Recover from connection interruptions
- Complete a full roster without confusion

## Product Goals

The draft system should:

- Successfully complete >95% of drafts
- Require minimal commissioner intervention
- Handle common failures automatically
- Be understandable to first-time fantasy players

---

# Draft UX Flow

## High-Level Flow

```text
Create League
    ↓
Invite Managers
    ↓
League Fills
    ↓
Draft Order Generated
    ↓
Draft Room Opens
    ↓
Snake Draft Begins
    ↓
Managers Select Players
    ↓
Timer Expires OR Pick Submitted
    ↓
Next Pick
    ↓
All Rosters Filled
    ↓
Draft Complete
    ↓
League Dashboard
```

---

# Detailed User Flow

## Step 1: Create League

Commissioner creates a league.

Required information:

- League name
- Team count
- Draft date/time

System defaults:

- 8 teams
- Snake draft
- 90 second timer

### Success Criteria

League created successfully.

---

## Step 2: Invite Managers

Commissioner invites managers.

Supported methods:

- Invite link
- Invite code

### Success Criteria

League reaches required team count.

---

## Step 3: Draft Order Selection

### MVP Behavior

System randomly generates draft order.

Example:

```text
1. Team A
2. Team B
3. Team C
...
8. Team H
```

Commissioner may regenerate order before draft begins.

### Future Enhancements

- Lottery
- Keeper adjustments
- Manual ordering

---

## Step 4: Draft Lobby

Managers enter draft room before draft begins.

Display:

- Team list
- Draft order
- Draft start countdown
- Draft settings

### States

```text
Scheduled
Waiting
Starting
```

### Success Criteria

Managers understand:

- When draft starts
- Draft order
- Who is participating

---

## Step 5: Live Snake Draft

### Layout

#### Left Panel

Available players

Filters:

- Position
- Team
- Search

#### Center Panel

Current pick

Displays:

- Current manager
- Pick number
- Countdown timer

#### Right Panel

Draft board

Displays:

- All completed picks
- Team rosters

---

## Step 6: Draft Timer

Default:

- 90 seconds

Countdown visible to all users.

Visual states:

### >30 Seconds

Normal

### 30–10 Seconds

Warning

### <10 Seconds

Urgent

### Expired

Auto-pick triggered

---

## Step 7: Pick Submission

Manager selects player.

Confirmation:

```text
Draft Sarah Fillier?
[Confirm]
[Cancel]
```

Upon confirmation:

- Player removed from pool
- Pick recorded
- Draft board updated
- Next manager activated

---

## Step 8: Auto-Pick

Triggered when timer expires.

System selects:

1. Highest ranked available player
2. Prioritizes unfilled starting positions

Auto-pick should respect roster requirements.

### User Messaging

```text
Auto-Pick:
Sarah Fillier
```

---

## Step 9: Draft Completion

Draft ends when all roster slots are filled.

System generates:

- Final rosters
- Draft summary
- League dashboard

### Success Criteria

All teams have legal rosters.

---

# Recommended Figma Wireframes

## Screen 1 — Draft Lobby

Components:

- League title
- Draft countdown
- Team list
- Draft settings
- Start button (commissioner)

---

## Screen 2 — Live Draft Room

Components:

- Available players
- Search/filter controls
- Current pick card
- Countdown timer
- Draft board
- Team roster panel
- Activity feed

---

## Screen 3 — Mobile Draft Room

Components:

- Current pick
- Timer
- Player search
- Draft board drawer
- Roster drawer

Mobile-first behavior should be prioritized.

---

## Screen 4 — Draft Complete

Components:

- Team roster
- Draft grades (future)
- League standings link
- Continue to season button

---

# Draft Edge Cases

---

## User Disconnects

### Scenario

Manager loses connection during draft.

### Expected Behavior

System continues timer.

User may reconnect.

If timer expires:

- Auto-pick executes

### Acceptance Criteria

Draft never stalls.

---

## Commissioner Pause

### Scenario

Commissioner pauses draft.

Examples:

- Technical issue
- User disconnect
- Emergency

### Behavior

Draft enters:

```text
PAUSED
```

Timer freezes.

No picks allowed.

Commissioner resumes draft.

### Acceptance Criteria

Draft resumes exactly where paused.

---

## Draft Reset

### Scenario

Draft must restart.

Examples:

- Corrupt draft state
- Wrong draft order
- League-wide issue

### Behavior

Commissioner may reset only before completion.

System:

- Clears picks
- Clears rosters
- Returns to pre-draft state

### Acceptance Criteria

All draft data removed safely.

---

## Missed Pick

### Scenario

Manager timer expires.

### Behavior

Auto-pick executes immediately.

Draft continues.

No manual intervention required.

### Acceptance Criteria

Draft progression never stops.

---

## Duplicate Browser Tabs

### Scenario

User opens multiple tabs.

### Risks

- Duplicate submissions
- Stale draft state

### Behavior

Server remains source of truth.

Only first valid pick accepted.

All tabs synchronize through real-time updates.

### Acceptance Criteria

Duplicate picks impossible.

---

## Draft Order Edits

### Scenario

Commissioner changes draft order.

### Allowed

Before draft start only.

### Forbidden

After first pick is made.

### Acceptance Criteria

Order becomes immutable once draft begins.

---

# Draft State Machine

```text
CREATED
    ↓
SCHEDULED
    ↓
WAITING_FOR_START
    ↓
ACTIVE
    ↓
PAUSED
    ↓
ACTIVE
    ↓
COMPLETED
```

Exceptional states:

```text
ACTIVE
    ↓
AUTO_PICK

ACTIVE
    ↓
DISCONNECTED_USER
    ↓
AUTO_PICK

WAITING_FOR_START
    ↓
RESET
    ↓
SCHEDULED
```

---

# Draft State Definitions

## CREATED

League exists.

Draft not scheduled.

---

## SCHEDULED

Draft time configured.

Waiting for start.

---

## WAITING_FOR_START

Draft room open.

Managers joining.

---

## ACTIVE

Live draft in progress.

Picks may be submitted.

---

## PAUSED

Commissioner intervention.

No picks permitted.

Timer frozen.

---

## AUTO_PICK

Temporary transition state.

System selects player.

Returns to ACTIVE.

---

## COMPLETED

All roster slots filled.

Draft permanently locked.

---

# Launch Requirements

The draft experience is launch-ready when:

- Drafts complete successfully
- Auto-pick works reliably
- Snake order functions correctly
- Draft pauses function correctly
- Reconnection is supported
- Mobile experience is usable
- Duplicate picks are impossible
- Draft completion transitions to season play automatically