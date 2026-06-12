# User Story: Add `parentLeagueId` Support for League Lineage

**Epic:** Season Renewal System

**Feature:** League Lineage

**Priority:** P1 (Foundational)

**Type:** Technical Infrastructure

---

# Summary

As a platform,

I want leagues to maintain a relationship with previous seasons,

so that future features such as season renewal, league history, franchise statistics, keeper leagues, and dynasty leagues can be implemented without requiring a major database migration.

---

# Problem Statement

Today, leagues are standalone entities.

Once a season is completed, there is no relationship between:

```text
PWHL Fantasy 2026
```

and

```text
PWHL Fantasy 2027
```

Even if they contain the same commissioner and managers.

This prevents the platform from:

- Tracking league history
- Showing past champions
- Calculating multi-season records
- Supporting season renewal workflows
- Building keeper or dynasty league functionality

A league lineage model is needed before these features can be implemented.

---

# User Value

## Commissioner

Can renew leagues in future seasons without rebuilding everything from scratch.

## Returning Managers

Can maintain league continuity across seasons.

## Product Team

Can support long-term retention features without future schema migrations.

---

# Proposed Solution

Add an optional self-referencing relationship to the League model.

```ts id="parentLeagueExample"
League
{
  id: string

  parentLeagueId?: string
}
```

A newly created league will normally have:

```text id="rootLeague"
parentLeagueId = null
```

A renewed league will have:

```text id="renewedLeague"
parentLeagueId = previousLeague.id
```

Example:

```text id="lineageTree"
League 2026
     │
     ▼
League 2027
     │
     ▼
League 2028
```

---

# Acceptance Criteria

## AC-1: Database Schema

League table includes:

```ts id="schemaField"
parentLeagueId String?
```

Requirements:

- Nullable
- Foreign key reference to League.id
- Indexed

### Success

Existing leagues continue functioning unchanged.

---

## AC-2: Backward Compatibility

All existing leagues must remain valid.

For existing records:

```text id="legacyLeague"
parentLeagueId = null
```

### Success

No existing functionality breaks.

---

## AC-3: League Creation

Standard league creation continues to create root leagues.

Example:

```text id="newLeague"
POST /api/leagues
```

Results in:

```text id="newLeagueResult"
parentLeagueId = null
```

### Success

Current creation flows require no changes.

---

## AC-4: League Retrieval

League queries return:

```ts id="responseShape"
{
  id,
  name,
  parentLeagueId
}
```

### Success

Clients can access lineage information.

---

## AC-5: Referential Integrity

If a parent league exists:

```text id="validParent"
parentLeagueId
```

must reference a valid league.

### Success

Orphaned references are impossible.

---

## AC-6: Future Renewal Compatibility

The schema must support:

```text id="futureRenewal"
League A
  →
League B
  →
League C
```

without additional migrations.

### Success

Multiple generations of leagues are supported.

---

# Technical Requirements

## Database

### League Table

Add:

```sql id="sqlExample"
parent_league_id UUID NULL
```

Foreign key:

```sql id="fkExample"
REFERENCES leagues(id)
```

Index:

```sql id="indexExample"
INDEX parent_league_id
```

---

## ORM Model

Example:

```ts id="ormExample"
parentLeagueId?: string
```

Optional self-reference.

---

# API Requirements

No new endpoints required.

Existing league endpoints should expose:

```json id="apiResponse"
{
  "id": "league_123",
  "parentLeagueId": null
}
```

---

# Out of Scope

This story does NOT include:

- Season renewal
- League history UI
- Franchise records
- Keeper leagues
- Dynasty leagues
- Commissioner succession

Only the foundational data model changes.

---

# Risks

## Low Risk

Schema addition is additive.

No existing behavior changes.

## Mitigation

- Nullable field
- Backward compatible migration
- No required client changes

---

# Dependencies

None.

This story can be completed independently.

---

# Definition of Done

- Database migration created.
- ORM schema updated.
- Existing leagues remain functional.
- API responses include parentLeagueId.
- Tests added for self-referencing relationships.
- Documentation updated.

---

# Future Features Unlocked

Completing this story enables:

- Season Renewal System
- League History Pages
- Franchise Statistics
- Multi-Season Records
- Keeper Leagues
- Dynasty Leagues
- Commissioner Succession
- Historical Championship Tracking

---

# Estimated Effort

**Engineering:** Small

**Risk:** Low

**Business Impact:** High

This is a foundational infrastructure story that creates long-term flexibility with minimal implementation cost.