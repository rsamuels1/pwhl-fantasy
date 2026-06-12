# User Story: Implement parentLeagueId

## Story ID

MS-001

## Epic

Multi-Season League Architecture

## Priority

P1

## Status

Planned

---

# User Story

As a commissioner,

I want my league to persist across multiple seasons,

so that I can renew the league each year without recreating it from scratch.

---

# Background

Today, leagues are treated as single-season entities.

This creates several problems:

- League history is fragmented
- Returning managers must re-create leagues
- Champions are disconnected across seasons
- Season-over-season statistics become difficult
- Future keeper/dynasty support becomes nearly impossible

The platform should distinguish:

```text
League Identity
```

from

```text
League Season
```

---

# Proposed Solution

Introduce:

```ts
parentLeagueId
```

Every seasonal league instance belongs to a parent league.

---

# Example

Current:

```text
League A (2025)
```

After change:

```text
Parent League A
│
├── Season 2025
├── Season 2026
├── Season 2027
└── Season 2028
```

---

# Data Model

## Parent League

Persistent object.

Represents:

- League identity
- Commissioner group
- Historical continuity

Example:

```ts
ParentLeague {
  id
  name
  createdAt
}
```

---

## Seasonal League

Represents a single season.

Example:

```ts
League {
  id
  parentLeagueId
  seasonYear
  rulesVersion
  scoringVersion
}
```

---

# Renewal Flow

At season completion:

Commissioner sees:

```text
Renew League for Next Season
```

Selecting renewal:

1. Create new League record
2. Copy eligible settings
3. Link via parentLeagueId
4. Reset seasonal data
5. Invite returning managers

---

# Data That Should Carry Forward

## League Identity

Carry forward.

```text
League Name
```

---

## Manager Membership

Carry forward.

Optional confirmation.

---

## Commissioner

Carry forward.

---

## Rules Configuration

Carry forward by default.

Commissioner may edit before draft.

---

# Data That Must NOT Carry Forward

## Standings

Reset.

---

## VP Totals

Reset.

---

## Matchup Results

Reset.

---

## Playoff Results

Reset.

---

## Draft Results

Remain historical only.

---

# Historical Views

Parent League should expose:

## Seasons

```text
2025
2026
2027
```

---

## Champions

```text
2025 Champion
2026 Champion
```

---

## League Records

Future support:

```text
Most Points
Best Season
Most Championships
```

---

# API Requirements

## Get Parent League

```http
GET /api/parent-leagues/:id
```

Returns:

- league metadata
- season list

---

## Renew League

```http
POST /api/leagues/:id/renew
```

Creates:

new season

linked via:

```ts
parentLeagueId
```

---

# Acceptance Criteria

### AC-1

New leagues automatically create a parent league.

---

### AC-2

Every league stores:

```ts
parentLeagueId
```

---

### AC-3

Commissioners can renew leagues.

---

### AC-4

Renewed leagues remain connected historically.

---

### AC-5

Historical seasons remain immutable.

---

### AC-6

Season-specific standings do not affect future seasons.

---

# Future Features Enabled

This story unlocks:

## League History

View all prior seasons.

---

## Season Renewal

One-click renewal.

---

## Historical Records

League record books.

---

## Keeper Leagues

Future.

---

## Dynasty Leagues

Future.

---

## League Hall of Fame

Future.

---

# Success Metric

A commissioner can complete:

```text
Season 2025
    ↓
Renew League
    ↓
Season 2026
```

without creating a brand-new league, while preserving all historical seasons.