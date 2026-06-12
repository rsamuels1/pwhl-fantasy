# Dependency Map

Version: 1.0

Owner: Product

Status: Active

Purpose: Document feature and architectural dependencies to improve roadmap prioritization and prevent implementation rework.

---

# Guiding Principle

Build foundational systems before dependent features.

Dependencies should influence roadmap ordering.

---

# MVP Core Flow

League Creation
↓
League Join
↓
Draft
↓
Roster Management
↓
Weekly Matchups
↓
VP Standings
↓
Playoffs
↓
Champion

Status:

Implemented / Validated

---

# Commissioner Systems

Audit Logging
↓
Commissioner Actions
↓
Commissioner Control Center

Features:

- Force Roster Move
- Undo Transaction
- Replace Manager
- Draft Pause

Priority:

Sprint 2

Reason:

Audit logging should exist before commissioner intervention tools.

---

# Transaction Systems

Audit Logging
↓
Transaction History
↓
Trade System
↓
Trade Review
↓
Waivers
↓
FAAB

Priority:

Sprint 2–4

Reason:

Transactions require historical records.

---

# Multi-Season Foundation

parentLeagueId
↓
Season Renewal
↓
League History
↓
Historical Records
↓
Champion Archive
↓
Hall of Fame

Priority:

Sprint 2–5

Reason:

All long-term league continuity depends on parentLeagueId.

---

# Rule Evolution

rulesVersion
↓
Historical Rule Preservation
↓
League Renewal
↓
Multi-Year Accuracy

Priority:

Sprint 2

Reason:

Historical seasons must remain reproducible.

---

# Scoring Evolution

scoringVersion
↓
Historical Standings
↓
Season Archives
↓
Cross-Season Comparison

Priority:

Sprint 2

Reason:

Future scoring changes should not alter past seasons.

---

# Beta Readiness

Season Simulation
↓
Validation Framework
↓
MVP Readiness Scorecard
↓
Founding Commissioner Program
↓
Private Beta

Status:

Mostly Complete

---

# User Education

League Rules
↓
VP Education
↓
Standings Education
↓
Onboarding

Priority:

Sprint 2–3

Reason:

VP is the most unique aspect of the platform.

---

# Analytics

Event Tracking
↓
Founder Dashboard
↓
Beta Success Metrics
↓
Launch Evaluation

Priority:

Sprint 3

---

# Notification Systems

Event Tracking
↓
Notification Framework
↓
Email Notifications
↓
Push Notifications

Priority:

Sprint 3+

---

# Growth Systems

Analytics
↓
Referral Loop
↓
Community Growth
↓
Public Launch

Priority:

Post-MVP

---

# Mobile Experience

Core League Experience
↓
Responsive Layout
↓
Mobile Optimization
↓
Native Apps (Future)

Priority:

Sprint 3+

---

# Long-Term Platform Evolution

PWHL Fantasy MVP
↓
League Renewal
↓
Keeper Leagues
↓
Dynasty Leagues
↓
Public Leagues
↓
Expanded Fantasy Platform

Priority:

Post-MVP

---

# Critical Path To Launch

Implementation Alignment
↓
Season Validation
↓
Commissioner Tools
↓
Audit Logging
↓
Transaction History
↓
Parent League Foundation
↓
Analytics Instrumentation
↓
Founding Commissioner Beta
↓
Launch Readiness Review
↓
Public Launch

This path should receive prioritization over all optional feature development.

---

# Features That Should NOT Block Launch

- Dynasty Leagues
- Keeper Leagues
- Public Leagues
- AI Features
- Referral Systems
- Push Notifications
- Hall of Fame
- Historical Records UI

These are growth and retention features, not MVP requirements.

---

# Highest-Leverage Sprint 2 Work

1. Audit Logging
2. Transaction History
3. parentLeagueId
4. rulesVersion
5. scoringVersion
6. Commissioner Control Center
7. VP Education UX

These unlock the largest number of future roadmap items.