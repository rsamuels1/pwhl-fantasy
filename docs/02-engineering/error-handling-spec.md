# error-handling-spec.md

Version: 1.0

Date: 2026-06-12

Owner: Product / Engineering

Roadmap Reference:

- Feature #4 — Error Handling
- Sprint 3 — Beta Readiness

Priority: P1

Status: Not Started

---

# Executive Summary

PWHL Fantasy has reached a point where most core functionality exists:

- League creation
- Drafts
- Lineups
- Matchups
- Standings
- Playoffs
- Renewal
- Commissioner tools

The next phase is improving reliability and user trust.

This feature standardizes:

- Empty states
- Loading states
- Error states
- Retry behavior
- Recovery guidance

across all MVP workflows.

The goal is that no user encounters:

- Unhandled exceptions
- Blank screens
- Infinite loading states
- Technical error messages

---

# Product Goals

Users should always know:

1. What happened
2. Why it happened
3. What they can do next

Every screen should have a defined behavior for:

- Loading
- Empty
- Error
- Success

---

# Design Principles

## Use Plain Language

Bad:

```text
PrismaClientKnownRequestError
```

Bad:

```text
500 Internal Server Error
```

Good:

```text
We couldn't load this league right now.
```

---

## Always Provide Next Action

Good:

```text
Retry
Go Back
Return to Dashboard
```

---

## Never Show Raw Stack Traces

Users should never see:

```text
SQL errors
Prisma errors
TypeScript errors
Unhandled exception text
```

All exceptions should be logged server-side.

---

# Error Categories

## Category 1 — Loading States

Every page that performs data fetching should have an explicit loading state.

Required Screens:

- Dashboard
- League Overview
- Matchup
- Roster
- Standings
- Draft Room
- Commissioner Admin
- Renewal Flow

Preferred Pattern:

```text
Loading league...
```

with skeleton content where appropriate.

---

## Category 2 — Empty States

Every page should define behavior when valid data does not exist.

---

### Dashboard

Scenario:

User has no leagues.

Display:

```text
You haven't joined a league yet.

Create a league or join one using an invite link.
```

Actions:

- Create League
- Join League

---

### League Overview

Scenario:

No announcements.

Display:

```text
No league announcements yet.
```

---

### Standings

Scenario:

Season has not started.

Display:

```text
Standings will appear once games begin.
```

---

### Matchups

Scenario:

No matchup generated.

Display:

```text
Your next matchup has not been created yet.
```

---

### Activity Feed

Scenario:

No activity.

Display:

```text
League activity will appear here.
```

---

### Notifications

Scenario:

No notifications.

Display:

```text
You're all caught up.
```

---

# Category 3 — Recoverable Errors

Recoverable errors should present a retry action.

---

## League Load Failure

Display:

```text
We couldn't load this league.
```

Actions:

- Retry
- Return to Dashboard

---

## Standings Load Failure

Display:

```text
We couldn't load standings right now.
```

Actions:

- Retry

---

## Matchup Load Failure

Display:

```text
We couldn't load matchup data.
```

Actions:

- Retry

---

## Draft Room Load Failure

Display:

```text
We couldn't connect to the draft.
```

Actions:

- Reconnect
- Return to League

---

# Category 4 — Form Submission Errors

All forms must display actionable validation.

---

## Create League

Examples:

```text
League name is required.
```

```text
League size must be between 4 and 12 teams.
```

---

## Join League

Examples:

```text
Invite code not found.
```

```text
This league is already full.
```

---

## Lineup Submission

Examples:

```text
Your lineup is incomplete.
```

```text
This player has already played and cannot be moved.
```

---

## Draft Actions

Examples:

```text
This player has already been drafted.
```

```text
Your draft session expired.
```

---

# Category 5 — Commissioner Errors

Commissioner workflows require enhanced guidance.

---

## Undo Transaction Failure

Display:

```text
This transaction can no longer be reversed.
```

---

## Force Move Failure

Display:

```text
This roster move violates league rules.
```

---

## Replace Manager Failure

Display:

```text
Unable to replace manager.
Please verify the new user exists.
```

---

## Renewal Failure

Display:

```text
We couldn't create the next season.
No changes were made.
```

Action:

- Retry

---

# Category 6 — Simulation Errors

Important for validation workflows.

---

## Historical Replay Failure

Display:

```text
Replay could not advance.
```

Actions:

- Retry
- View Details (commissioner only)

---

## Season Simulation Failure

Display:

```text
Season simulation stopped unexpectedly.
```

Actions:

- Retry
- Contact Administrator

---

# Draft-Specific Error Handling

Draft is the highest-risk feature.

---

## Connection Lost

Display:

```text
Connection lost.

Attempting to reconnect...
```

Auto Retry:

Yes

---

## Duplicate Browser Tabs

Display:

```text
Draft is already open in another tab.
```

Action:

```text
Return To Active Draft
```

---

## Missed Pick

Display:

```text
Time expired.

Auto-pick selected the highest ranked player.
```

---

## Draft Paused

Display:

```text
The commissioner has paused the draft.
```

Action:

```text
Waiting for draft to resume...
```

---

# API Error Standard

All API routes should return a consistent structure.

Preferred:

```json
{
  "success": false,
  "error": {
    "code": "LEAGUE_NOT_FOUND",
    "message": "League could not be found."
  }
}
```

Avoid:

```json
{
  "error": "Something went wrong"
}
```

or raw exception output.

---

# Error Logging Requirements

Every server-side exception should be logged.

Minimum Metadata:

- User ID
- League ID
- Route
- Action
- Timestamp

Examples:

- Draft actions
- Commissioner actions
- Renewal actions
- Simulation actions

Leverage existing audit infrastructure where possible.

---

# Reusable Components

Create shared UI components:

```text
components/ErrorState.tsx
components/EmptyState.tsx
components/LoadingState.tsx
```

Goals:

- Consistent UX
- Reduced duplication
- Easier maintenance

---

# Acceptance Criteria

A review of all MVP screens confirms:

- Loading state exists
- Empty state exists
- Error state exists
- Retry path exists where appropriate

Users never see:

- Raw exceptions
- Stack traces
- Blank screens

All API failures return structured error responses.

All critical workflows recover gracefully.

---

# Validation Plan

Test:

- League not found
- Invalid invite
- Draft disconnect
- Failed lineup save
- Failed commissioner action
- Failed renewal
- Failed simulation

Expected Result:

User receives clear guidance and can continue using the application without confusion.

---

# Claude Code Implementation Request

Audit all:

- app/
- app/api/
- components/

Identify screens missing:

- loading states
- empty states
- retry actions
- user-friendly error messages

Produce:

1. Gap analysis.
2. Prioritized implementation list.
3. Shared component proposal.
4. Incremental rollout plan.

Implement reusable patterns first, then migrate screens.