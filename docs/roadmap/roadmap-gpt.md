# PWHL Fantasy Roadmap (GPT Version)

**Version:** 2026 MVP Planning

**Status:** Draft

**Purpose:** Prioritized roadmap based on current implementation state, documented product decisions, MVP feature requirements, and launch risk.

---

# Product Vision

Create the easiest fantasy sports experience for PWHL fans.

The platform should feel:

- approachable
- beginner-friendly
- mobile-friendly
- commissioner-friendly

while still providing enough depth for repeat seasonal play.

---

# Roadmap Philosophy

Prioritization is based on:

1. Implementation correctness
2. MVP completion
3. Draft reliability
4. League completion
5. User retention
6. Long-term platform evolution

A feature is only prioritized if it increases the likelihood that a league successfully:

```text
Create League
→ Fill League
→ Draft
→ Set Lineups
→ Complete Season
→ Crown Champion
→ Renew Next Season
```

---

# Current Implementation Assessment

## Strong Areas

- Authentication
- League creation
- Core scoring engine
- Matchup generation
- Playoff framework
- Replay/testing infrastructure
- Draft foundations

## High-Risk Areas

### Draft Experience

README explicitly identifies:

```text
the live draft room (highest-risk feature)
```

as the most complex system.

### Rules / Implementation Drift

Current code differs from approved rules:

- Roster construction
- Playoff defaults
- VP standings usage
- League-size assumptions

### Multi-Season Foundation

No league lineage currently exists.

---

# Phase 0 — Implementation Alignment (Launch Blockers)

## Goal

Ensure the application behaves exactly as documented.

No new features should be prioritized ahead of these items.

---

## IA-001

### Update Roster Defaults

Current:

- 2 F
- 2 D
- 1 G
- 1 UTIL
- 6 Bench

Approved:

- 3 F
- 2 D
- 1 G
- 1 UTIL
- 6 Bench

Affected Areas:

- Auto Draft
- Roster Validation
- Draft Logic
- Lineups

Priority: P0

---

## IA-002

### Make Victory Points the Source of Truth

Implement:

- VP standings
- VP playoff qualification
- VP playoff seeding

Priority: P0

---

## IA-003

### Simplify Playoff Defaults

Current code:

- 6 playoff teams
- 2 byes
- multi-period rounds

Approved MVP:

- 4 playoff teams
- no byes
- single-week rounds

Priority: P0

---

## IA-004

### Fantasy Season Ends Before PWHL Playoffs

Add scheduling constraints.

Priority: P0

---

# Phase 1 — MVP Completion

## Goal

Allow leagues to complete a full season from draft through championship.

---

# Draft Experience

## Why

Highest-risk feature in repository.

Failure here prevents league activation.

---

## DE-001

Draft UX Flow

Deliverables:

- Figma wireframes
- User flows

Includes:

- Create League
- Invite Managers
- Draft Order
- Draft Room
- Snake Draft
- Auto Draft
- Completion

Priority: P0

---

## DE-002

Draft Edge Cases

Document and implement:

- Disconnects
- Auto-pick
- Commissioner pause
- Draft reset
- Duplicate tabs
- Draft order changes

Deliverables:

- Draft state machine
- Engineering requirements

Priority: P0

---

## DE-003

Draft Reliability Audit

Review:

- race conditions
- optimistic updates
- reconnect logic
- timer synchronization

Priority: P0

---

# League Completion Features

## LC-001

Weekly Lineup Lock

Validate:

- lock behavior
- partial week substitutions
- eligibility rules

Priority: P0

---

## LC-002

VP Standings UI

Add:

- VP explanation
- weekly bonus explanation
- standings transparency

Priority: P1

---

## LC-003

Playoff Qualification Experience

Add:

- playoff race indicators
- clinched status
- eliminated status

Priority: P1

---

# Commissioner Basics

## CT-001

Commissioner Control Center

MVP Controls:

- Pause Draft
- Resume Draft
- Replace Manager
- Force Roster Move
- Undo Transaction

Priority: P1

---

## CT-002

Audit Logging

All commissioner actions tracked.

Priority: P1

---

# Phase 2 — Launch Features

## Goal

Deliver a complete fantasy sports experience.

---

# Transactions

## TR-001

Waiver System

Implement:

- waiver period
- priority ordering
- claim processing

Priority: P1

---

## TR-002

Free Agent Acquisition

Priority: P1

---

## TR-003

Trade System

Priority: P1

---

## TR-004

Commissioner Trade Review

Priority: P1

---

# Notifications

## NT-001

Notification Framework

Channels:

- In-App
- Email

Priority: P1

---

## NT-002

Critical Notifications

- Draft Starting
- On The Clock
- Incomplete Lineup
- Trade Received
- Waiver Result
- Playoff Clinched

Priority: P1

---

# Engagement

## EN-001

League Activity Feed

Priority: P2

---

## EN-002

Player Profile Pages

Priority: P2

---

## EN-003

Rules & Help Center

Priority: P2

---

# Phase 3 — Growth & Retention

## Goal

Increase league renewal and reduce acquisition costs.

---

# Analytics

## GR-001

Activation Dashboard

Track:

- Visitor
- Registration
- League Creation
- Draft Participation
- Week 1 Lineup
- Week 2 Return

Priority: P2

---

## GR-002

Retention Dashboard

Track:

- Week 4 Retention
- Season Completion
- League Renewal

Priority: P2

---

# Referral Loop

## GR-003

Invite Friends Flow

Core Message:

```text
Invite 5 Friends To Start Your League
```

Priority: P2

---

## GR-004

League Fill Progress

Display:

```text
4 / 8 Teams Joined
```

Priority: P2

---

# Phase 4 — Multi-Season Foundation

## Goal

Prepare platform for long-term retention.

---

## MS-001

Add parentLeagueId

Priority: P1

Reason:

Unlocks:

- league history
- season renewal
- keeper leagues
- dynasty leagues

---

## MS-002

Rules Versioning

Add:

```text
rulesVersion
```

Priority: P1

---

## MS-003

Scoring Versioning

Add:

```text
scoringVersion
```

Priority: P1

---

## MS-004

Season Renewal System

Priority: P2

Features:

- Renew league
- Reinvite managers
- Preserve history

---

## MS-005

League History

Priority: P2

---

# Phase 5 — Future Expansion

Not required for MVP or Launch.

---

## Competitive Features

- FAAB
- Draft Pick Trading
- Public Leagues

---

## Advanced League Formats

- Keeper Leagues
- Dynasty Leagues

---

## AI Features

- Draft Assistant
- Weekly Recaps
- Trade Evaluator
- Lineup Suggestions

---

## Native Mobile Apps

- iOS
- Android

---

# Immediate Sprint Recommendation

## Sprint A

1. IA-001 Roster Alignment
2. IA-002 VP Standings
3. IA-003 Playoff Simplification
4. DE-001 Draft UX Flow
5. DE-002 Draft Edge Cases

---

## Sprint B

1. Draft Reliability Audit
2. Weekly Lineup Lock Validation
3. VP Standings UI
4. Commissioner Control Center
5. Audit Logging

---

## Sprint C

1. Waivers
2. Free Agency
3. Trades
4. Notifications
5. Activity Feed

---

# Launch Readiness Checklist

A public beta should not launch until:

- Roster rules match implementation
- VP standings are authoritative
- Draft flow is documented
- Draft edge cases are handled
- Playoffs function correctly
- Weekly lineup lock is verified
- Commissioner recovery tools exist
- League completion can be demonstrated end-to-end

At that point, the platform supports the full fantasy lifecycle:

```text
Create League
→ Invite Friends
→ Draft
→ Set Lineups
→ Earn VP
→ Make Playoffs
→ Crown Champion
```

which is the minimum viable fantasy product.