# Season Renewal System - Technical Specification

**Feature:** Season Renewal

**Priority:** Post-Launch P1

**Status:** Proposed

**Owner:** Product

**Audience:** Commissioners

---

# Overview

The Season Renewal System allows commissioners to create a new fantasy season using a previous league as a template.

The goal is to reduce league setup friction and maximize year-over-year retention.

Instead of creating a league from scratch, commissioners can:

- Renew an existing league
- Reinvite previous managers
- Preserve league history
- Generate a fresh draft and season schedule

The renewal process should take less than 2 minutes.

---

# Goals

## Business Goals

- Increase season-to-season retention
- Reduce league creation friction
- Increase league renewal rate
- Establish recurring leagues as the primary growth channel

## User Goals

Commissioners should be able to:

- Start next season quickly
- Keep league membership intact
- Preserve league history
- Avoid manually rebuilding settings

---

# Non-Goals

Version 1 renewal does NOT support:

- Keeper leagues
- Dynasty leagues
- Retaining rosters
- Retaining draft picks
- Retaining waiver priorities
- Retaining standings

Every renewed league starts as a fresh season.

---

# User Experience

## Renewal Entry Point

Available after:

- Fantasy championship concludes
- Season status = COMPLETE

Displayed to commissioner:

```text
🏆 Season Complete

Renew This League For Next Season
```

Primary CTA:

```text
Renew League
```

---

# Renewal Flow

## Step 1

Commissioner selects:

```text
Renew League
```

---

## Step 2

System displays renewal summary.

Example:

```text
2026 PWHL Fantasy League

Teams: 8
Managers Returning: 8
Roster Format: Standard
Scoring: VP Hybrid
```

---

## Step 3

Commissioner confirms.

Options:

```text
✓ Keep League Name
✓ Invite Previous Managers
✓ Keep League Settings
```

Editable:

- League name
- Season year
- Draft date

---

## Step 4

System creates:

New League

Example:

```text
Original:
PWHL Fantasy 2026

Renewed:
PWHL Fantasy 2027
```

---

## Step 5

Invitations sent automatically.

Managers receive:

```text
Your league is returning!

Join PWHL Fantasy 2027
```

---

# Data Model

---

## League Lineage

Add self-referencing relationship.

```ts
League
{
  id

  parentLeagueId?

  seasonYear

  renewalStatus
}
```

---

## Relationship

```text
League 2026
     │
     ▼
League 2027
     │
     ▼
League 2028
```

---

## Benefits

Allows:

- League history
- Multi-season records
- Franchise tracking
- Future dynasty support

---

# New Database Fields

## League

```ts
parentLeagueId String?
```

References previous season.

---

```ts
seasonYear Int
```

Example:

```text
2026
2027
2028
```

---

```ts
renewedFromLeagueId String?
```

Alternative explicit reference.

---

## LeagueMember

```ts
invitedFromPreviousSeason Boolean
```

Used for analytics.

---

# Renewal Logic

---

## Copy Settings

Copied:

- Scoring settings
- Roster settings
- League size
- Playoff settings
- Draft timer
- Waiver settings

---

## Do Not Copy

Not copied:

- Rosters
- Draft board
- Matchups
- Standings
- Transactions
- Waivers
- Trades

---

## Reset State

New league starts with:

```text
PRE_DRAFT
```

status.

---

# League Membership

---

## Returning Managers

System gathers:

```text
All managers
from previous season
```

and generates invitations.

---

## Invitation States

```text
Pending
Accepted
Declined
Expired
```

---

## Replacement Managers

If a manager declines:

Commissioner may:

- Invite replacement
- Share invite link

---

# League History

---

## League Profile

New section:

```text
League History
```

Example:

```text
2026 Champion
Jane

2027 Champion
TBD
```

---

## Franchise Statistics

Future enhancement.

Track:

- Championships
- Playoff appearances
- Win percentage
- Career VP

Across seasons.

---

# Notifications

---

## Commissioner

Trigger:

Season complete.

Send:

```text
Ready for another season?

Renew your league today.
```

Timing:

- Immediately after championship
- 30 days later
- Before next season starts

---

## Managers

Trigger:

Renewed league created.

Send:

```text
Your commissioner renewed the league.

Join now.
```

---

# API Requirements

---

## Create Renewal

```http
POST /api/leagues/:id/renew
```

Creates new league.

---

### Response

```json
{
  "newLeagueId": "abc123"
}
```

---

## View Renewal History

```http
GET /api/leagues/:id/history
```

Returns:

- Previous seasons
- Champions
- League lineage

---

# Analytics

Track:

## Renewal Rate

```text
Renewed Leagues
/
Completed Leagues
```

Target:

> 40%

---

## Manager Return Rate

```text
Returning Managers
/
Previous Season Managers
```

Target:

> 70%
```

---

## Season Continuity

```text
Leagues Active 2+ Seasons
```

Track annually.

---

# Edge Cases

---

## Commissioner Inactive

If commissioner does not renew:

Allow future feature:

```text
Take Over League
```

for another manager.

Not included in v1.

---

## Duplicate Renewals

Prevent:

```text
League 2026
    ↓
League 2027A

League 2026
    ↓
League 2027B
```

Only one active renewal allowed.

---

## Partial Returns

League should still renew if only some managers return.

Commissioner fills remaining spots manually.

---

# Success Criteria

The Season Renewal System is successful when:

- Commissioners can renew a league in under 2 minutes.
- League settings transfer correctly.
- Historical records remain intact.
- Returning managers can rejoin with a single click.
- Season renewal becomes the primary source of league creation.
- More than 40% of completed leagues return for another season.

---

# Future Enhancements

## Phase 2

- One-click league renewal
- Commissioner succession
- Historical leaderboards
- Franchise records

## Phase 3

- Keeper leagues
- Dynasty leagues
- Draft pick carryover
- Multi-season trophies
- Hall of Fame system