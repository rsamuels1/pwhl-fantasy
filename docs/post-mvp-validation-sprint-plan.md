# Post-MVP Validation Roadmap

## Sprint 1 (Current)

# MVP Season Validation Sprint

Goal:

Prove a complete fantasy season can run successfully.

Stories:

- End-to-End Season Simulation Framework
- VP Standings Validation Suite
- Playoff Qualification Validation Suite
- Draft Reliability Test Suite
- MVP Readiness Dashboard

Exit Criteria:

✅ Documentation matches implementation

✅ Full season simulation completes

✅ Champion crowned without intervention

✅ MVP launch blockers resolved

---

## Sprint 2

# League Operations Sprint

Goal:

Give commissioners enough tools to safely run leagues.

Why?

Once the game works, the next biggest risk is commissioner frustration.

Fantasy leagues fail when commissioners cannot recover from mistakes.

---

### Epic: Commissioner Tools

Stories:

#### CT-001 Force Roster Moves

Commissioner can:

- Add player
- Remove player
- Correct roster issues

---

#### CT-002 Undo Transactions

Commissioner can reverse:

- Add/drop
- Waiver claims
- Future transaction types

---

#### CT-003 Replace Manager

Commissioner can:

- Remove inactive manager
- Invite replacement
- Preserve roster ownership

---

#### CT-004 Draft Pause / Resume

Commissioner controls:

- Pause draft
- Resume draft
- Extend timer

---

### Epic: Audit Logging

Stories:

#### AL-001 Transaction Audit Log

Track:

- Who
- What
- When

---

#### AL-002 Commissioner Action Log

Track:

- Force roster moves
- Draft interventions
- Manager replacement

---

### Epic: League Administration

Stories:

#### LA-001 League Settings Editor

Allow:

- Name changes
- Schedule changes
- Playoff settings

---

### Exit Criteria

✅ Commissioner can recover common league problems

✅ All commissioner actions logged

✅ No manual DB intervention required

---

## Sprint 3

# Launch Readiness Sprint

Goal:

Complete all required launch systems.

This sprint focuses on player-facing polish.

---

### Epic: Notifications

Stories:

#### NT-001 Draft Starting Soon

Send:

- 24 hours
- 1 hour
- 15 minutes

---

#### NT-002 On The Clock

Notify:

- Current drafter

---

#### NT-003 Incomplete Lineup

Notify:

- Before lineup lock

---

### Epic: Analytics

Stories:

#### AN-001 Event Tracking Framework

Implement:

- analytics-events.md

---

#### AN-002 Activation Funnel Dashboard

Track:

Visitor
→ Registration
→ League Creation
→ Draft
→ Week 1 Lineup

---

#### AN-003 Retention Dashboard

Track:

- Week 2 retention
- Season completion
- League renewal

---

### Epic: Help & Education

Stories:

#### UX-001 VP Standings Explainer

Explain:

- Matchup VP
- Weekly Rank VP
- Total VP

---

#### UX-002 Commissioner Guide

Create:

- First league walkthrough

---

### Exit Criteria

✅ Notifications functioning

✅ Analytics collecting data

✅ Users understand VP standings

✅ Commissioner onboarding complete

---

## Sprint 4

# Public Beta Sprint

Goal:

Run real leagues.

This sprint should contain very little new feature work.

Focus:

- Bug fixes
- Performance
- Real-user feedback

---

### Epic: Beta Operations

Stories:

#### PB-001 Founding Commissioner Program

Recruit:

- 10–20 commissioners

---

#### PB-002 Beta Feedback Collection

Capture:

- Draft issues
- Rules confusion
- Standings confusion

---

#### PB-003 Launch Dashboard

Monitor:

- Draft completion rate
- Week 2 retention
- League completion rate

---

### Optional Stories

Only if stable:

#### TR-001 Trade System

#### TR-002 Trade Review

#### TR-003 Free Agency

---

### Explicitly Out of Scope

Do NOT build:

- Dynasty
- Keeper
- AI assistant
- Referral loops
- Public leagues

until beta data validates demand.

---

# Visual Timeline

Q1

Implementation Alignment
↓
Season Validation

Q2

Commissioner Tools
↓
Audit Logging
↓
League Operations

Q3

Notifications
↓
Analytics
↓
Launch Readiness

Q4

Public Beta
↓
Real League Validation
↓
v1 Launch