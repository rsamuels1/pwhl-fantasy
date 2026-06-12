# Commissioner Tools Specification

**Feature Area:** Commissioner Tools

**Priority:** P2

**Status:** Draft

**Audience:** League Commissioners

---

# Overview

Commissioners are the operators of fantasy leagues.

A successful commissioner experience reduces support burden, improves league retention, and increases the likelihood that leagues return for future seasons.

PWHL Fantasy will follow an opinionated model similar to ESPN and Yahoo:

- Commissioners have enough power to resolve league issues.
- Commissioners cannot fundamentally alter league integrity mid-season.
- All commissioner actions are logged.

---

# Commissioner Philosophy

## Principles

### Empower Recovery

Commissioners should be able to fix mistakes.

### Prevent Abuse

Commissioners should not be able to manipulate outcomes.

### Maintain Transparency

All commissioner actions should be visible and auditable.

### Minimize Complexity

Only expose tools required to run healthy leagues.

---

# Commissioner Control Center

## Purpose

Central location for all commissioner actions.

Accessible only to:

- League commissioner
- Future: Co-commissioners

---

# Permissions Matrix

| Action | Commissioner | League Member |
|----------|----------|----------|
| Pause Draft | ✅ | ❌ |
| Resume Draft | ✅ | ❌ |
| Edit Draft Order (Pre-Draft) | ✅ | ❌ |
| Force Roster Move | ✅ | ❌ |
| Undo Transaction | ✅ | ❌ |
| Approve Trade | ✅ | ❌ |
| Reject Trade | ✅ | ❌ |
| Replace Manager | ✅ | ❌ |
| Remove Manager | ✅ | ❌ |
| Send League Announcement | ✅ | ❌ |
| View Audit Log | ✅ | ❌ |
| Edit League Settings (Preseason) | ✅ | ❌ |
| Edit Scoring (Preseason) | ✅ | ❌ |
| Reset Draft | ✅ | ❌ |
| Renew League | ✅ | ❌ |

---

# Feature Specifications

---

## Force Roster Move

### Purpose

Resolve edge cases involving:

- Injuries
- Abandoned teams
- Platform bugs
- Commissioner corrections

### Examples

Move player:

```text
Bench → Active
```

or

```text
Active → Bench
```

### Restrictions

Cannot:

- Add players not on roster
- Circumvent roster validation

### Logging

Audit entry required.

Example:

```text
Commissioner moved Sarah Fillier
Bench → Forward
```

---

## Undo Transaction

### Purpose

Reverse accidental transactions.

Examples:

- Wrong waiver claim
- Incorrect free-agent pickup
- Platform error

### Supported Actions

- Waiver claim reversal
- Free-agent pickup reversal
- Trade reversal

### Restrictions

Cannot undo if:

- Subsequent transactions create conflicts

### Logging

Required.

---

## Edit Scoring

### Philosophy

Scoring should not change during an active season.

### Allowed

Before season begins:

```text
PRE_DRAFT
```

or

```text
PRESEASON
```

### Forbidden

During:

- Regular season
- Playoffs

### Acceptance Criteria

Historical scoring remains consistent.

---

## Pause Draft

### Purpose

Handle disruptions.

Examples:

- User disconnect
- Technical outage
- Emergency

### Behavior

Draft state:

```text
PAUSED
```

Timer frozen.

No picks accepted.

### Resume

Returns to prior state.

---

## Replace Inactive Manager

### Purpose

Maintain league competitiveness.

### Examples

- User abandons league
- User leaves platform
- User becomes unreachable

### Workflow

Commissioner:

```text
Replace Manager
```

System:

1. Removes manager access.
2. Invites replacement manager.
3. Preserves roster.
4. Preserves standings.

### Acceptance Criteria

League continuity maintained.

---

# Commissioner Audit Log

## Requirement

All commissioner actions are recorded.

---

## Audit Event Structure

```json
{
  "timestamp": "...",
  "commissionerId": "...",
  "action": "...",
  "target": "...",
  "details": {}
}
```

---

## Logged Actions

- Draft pauses
- Draft resumes
- Roster edits
- Transaction reversals
- Manager replacements
- Scoring edits
- League setting changes

---

# Notifications

League members should receive notifications when:

- Manager replaced
- Draft paused
- Draft resumed
- Trade reversed
- Major commissioner action taken

---

# Future Enhancements

## Co-Commissioners

Multiple league administrators.

## Commissioner Voting

League-wide approval workflow.

## Automated Integrity Alerts

Flag suspicious trades and inactivity.

---

# Success Criteria

- Commissioners can resolve common issues without support intervention.
- All actions are transparent.
- Audit history is complete.
- League integrity is preserved.
- Commissioner satisfaction remains high.