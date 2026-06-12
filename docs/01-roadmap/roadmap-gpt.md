# PWHL Fantasy Roadmap (GPT Version)

**Version:** 2026 MVP Planning — Updated June 12, 2026

**Status:** Current

**Authoritative source:** `docs/01-roadmap/roadmap.md` — this file is a condensed companion.
Any conflict between the two: roadmap.md wins.

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

A feature is only prioritized if it increases the likelihood that a league successfully completes:

```
Create League → Fill League → Draft → Set Lineups → Complete Season → Crown Champion → Renew Next Season
```

Prioritization order:

1. Implementation correctness
2. MVP completion
3. Draft reliability
4. League completion
5. User retention
6. Long-term platform evolution

---

# Current Implementation Assessment

## Strong Areas

- Authentication
- League creation
- Core scoring engine (VTF + VP)
- Matchup generation (VTF regular season + 1v1 playoffs)
- Playoff framework (4-team, no-bye, bracket)
- Season lifecycle and sim controls
- Draft room (WebSocket, queue, auto-draft, escalation)
- Standings (VP-authoritative, race indicators)
- Lineup management (period-based lock, play-lock, games-remaining)
- Projections & win probability engine
- Free-agent add/drop
- End-to-end season simulation (`scripts/simulate-season.ts`)

## Remaining Risks

### Draft Experience

The live draft room is the highest-risk feature. Reconnect, duplicate-tab, and timer-sync edge cases have not been validated under load.

### Commissioner Recovery

No tools yet to pause the draft, replace a manager, or force-move a player without DB access. Sprint 2 closes this.

### Multi-Season Foundation

Schema fields for `parentLeagueId`, `rulesVersion`, and `scoringVersion` are not yet present. Adding these after live seasons run creates migration risk. Sprint 2 adds the schema layer.

---

# Phase 0 — Implementation Alignment

## Goal

Ensure the application behaves exactly as documented. No new features should be prioritized ahead of open P0 items.

---

## IA-001 — Update Roster Defaults

**Status: ✅ DONE**

Canonical roster: `{ forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 }` = 13 slots, all drafted.
Updated across all seed scripts, league create API, auto-draft, and CLAUDE.md.

---

## IA-002 — Make Victory Points the Source of Truth

**Status: ✅ DONE**

`computeVpStandings` is the single authoritative source in all standings surfaces.
`scoringMode @default("VP")` in schema. All `isVpMode` branching removed.
28 VP unit tests in `tests/vp.test.ts`.

VP model: Win 2 / Tie 1 / Loss 0 + weekly bonus +2 (highest score) / +1 (second highest) = max 4 VP/week.

---

## IA-003 — Simplify Playoff Defaults

**Status: ✅ DONE**

4 teams qualify, no byes, single-week rounds. Bracket generation bug fixed (was pairing 1v2; now correctly pairs 1v4, 2v3).
18 playoff tests in `tests/playoffs.test.ts`. `scripts/simulate-season.ts` confirms full flow.

---

## IA-004 — Fantasy Season Ends Before PWHL Playoffs

**Status: ⚠️ Not built** · Priority: P0 · Assigned: Sprint 2

Schedule generation must reserve playoff weeks, conclude the championship before the PWHL postseason, and reject overlapping schedules with clear messaging.

---

## LC-001 — Period-Based Lineup Lock

**Status: ✅ DONE**

`lockTime(playerTeamId, games, nowMs?, periodStartMs?)` — player is locked for the full week once their team has played any game in the current scoring period. Both the lineup page and lineup API pass `activePeriod.startsAt.getTime()` as `periodStartMs`.

---

## LC-003 — Playoff Race Indicators

**Status: ✅ DONE**

`computeRace` from `lib/playoffs/seeding.ts` surfaces clinch / eliminated / bubble / games-back chips on the standings page and league overview.

---

# Phase 1 — MVP Completion

## Sprint 2 (Current) — Commissioner + Platform Foundation

### Commissioner Track

#### CT-001 — Commissioner Control Center

MVP controls:

- Pause / Resume Draft
- Replace Manager
- Force Roster Move
- Undo Transaction

Priority: P1

---

#### CT-002 — Audit Logging

All commissioner actions tracked via `LeagueEvent`. This is also the foundation for Transaction History.

Priority: P1

---

#### IA-004 — Fantasy Season Ends Before PWHL Playoffs

Schedule generation must:
- Reserve playoff weeks so the fantasy championship concludes before the PWHL postseason begins
- Refuse to create a schedule that overlaps the PWHL playoffs
- Show a clear validation error to the commissioner at setup time

Priority: P0 · Assigned: Sprint 2

---

### Platform Foundation Track (schema-only, no UI)

These are architectural decisions that become expensive after multiple seasons exist.

#### MS-001 — parentLeagueId

Add `ParentLeague` model + `League.parentLeagueId` field. Every new league auto-creates a parent record. Schema now, renewal UX later (Phase 5).

Unlocks: league history, season renewal, keeper leagues, dynasty leagues.

Priority: P1

---

#### MS-002 — rulesVersion

Add `rulesVersion` field to `FantasyLeague`. Populated at league creation, frozen after draft.

Priority: P1

---

#### MS-003 — scoringVersion

Add `scoringVersion` field to `FantasyLeague`. Same lifecycle as rulesVersion.

Priority: P1

---

### Product Track

#### LC-002 — VP Standings UI

Add VP explanation, weekly bonus explanation, and standings transparency to the standings page.

Priority: P1

---

#### IA-006 — VP Education UI

Tooltip / help modal / rules link on the standings page.

Priority: P1

---

#### IA-005 — Recommend 8-Team Leagues

League creation defaults to 8 teams with "Recommended" label and explanatory help text.

Priority: P1

---

## Sprint 3 — Beta Readiness

### Onboarding

Welcome flow, league setup wizard, and draft preparation guide. No user should need documentation to create their first league.

Spec: `docs/02-engineering/onboarding-spec.md` · Priority: P1

---

### Error Handling

Empty states, loading states, retry actions, and plain-language error messages across every screen.

Priority: P1

---

### Mobile Optimization

Responsive layout across draft room, matchup screens, standings, and roster management. No horizontal scrolling on core pages.

Priority: P1

---

### Notifications

#### NT-001 — Notification Framework

In-app and email channels.

#### NT-002 — Critical Notifications

- Draft Starting Soon
- On The Clock
- Incomplete Lineup
- Trade Received
- Waiver Result
- Playoff Clinched

Spec: `docs/02-engineering/notification-framework-spec.md` · Priority: P1

---

### Analytics Instrumentation

#### AN-001 — Core Event Tracking

Instrumentation only. Dashboards in a later sprint.

Required events:
- Registration
- Login
- League Created
- League Joined
- Draft Started
- Draft Completed
- Lineup Saved

Spec: `docs/05-growth/analytics-events.md` · Priority: P1

Rationale: A beta without analytics generates opinions, not evidence.

---

### IA-011 — Hide Advanced Non-v1 Features

Hide advanced playoff structures, multi-round configuration, and experimental scoring from the standard UI.

Priority: P2

---

## Sprint 3 Exit

A brand-new user creates and drafts a league on a phone with no docs; analytics are collecting before any external user touches the product. **MVP launch gate.**

---

# Phase 2 — Launch Features

## Transactions (infrastructure-first ordering)

### Sequence

```
CT-002 Audit Log (Sprint 2)
    ↓
Transaction History (#8)
    ↓
Trade System (#7)
    ↓
Waivers (#5)
    ↓
FAAB (#6)
```

Transaction history is infrastructure. Trades are a feature. Infrastructure precedes features.

---

### TR-001 — Waiver System

Waiver period, priority ordering, claim processing.

Priority: P1

---

### TR-002 — Free Agent Acquisition / FAAB

Blind-bid FAAB with budget tracking and tie-breaking.

Priority: P1

---

### TR-003 — Trade System

Manager-to-manager player exchange — proposals, review, optional commissioner approval.

Priority: P1

---

### TR-004 — Commissioner Trade Review

Priority: P1

---

# Phase 3 — Growth & Retention

## Analytics Dashboards

### GR-001 — Activation Dashboard

Track: Visitor → Registration → League Creation → Draft → Week 1 Lineup → Week 2 Return

Priority: P2

---

### GR-002 — Retention Dashboard

Track: Week 4 Retention · Season Completion · League Renewal

Priority: P2

---

## Referral Loop

### GR-003 — Invite Friends Flow

Core message: "Invite 5 friends to start your league"

Priority: P2

---

### GR-004 — League Fill Progress

Display: `4 / 8 Teams Joined`

Priority: P2

---

# Phase 4 — Multi-Season UX

Schema foundation is laid in Sprint 2 (MS-001/002/003). This phase builds the product surface.

---

## MS-004 — Season Renewal System

Commissioner renews league; new season linked via `parentLeagueId`. Carries: league name, managers, commissioner, rules config. Resets: standings, VP, results.

Priority: P2

Spec: `docs/06-architecture/season-renewal-system.md`

---

## MS-005 — League History

Historical seasons list, champions by year, record books.

Priority: P2

---

# Phase 5 — Future Expansion

Not required for MVP or launch.

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

# MVP Readiness Scorecard

| Area | Status | Notes |
|---|---|---|
| League creation | ✅ PASS | — |
| Draft | ⚠️ PASS WITH RISKS | reconnect / duplicate-tab unvalidated |
| Rosters | ✅ PASS | 3F / 2D / 1G / 1UTIL / 6B confirmed |
| Weekly matchups | ✅ PASS | — |
| VP standings | ✅ PASS | 28 unit tests |
| Weekly lineup lock | ✅ PASS | period-based |
| Playoffs | ✅ PASS | 4-team, no-bye, bracket fixed |
| Commissioner tools | ⚠️ PARTIAL | CT-001/002 in Sprint 2 |
| Analytics | ⛔ FAIL | AN-001 in Sprint 3 |
| End-to-end season sim | ✅ PASS | `scripts/simulate-season.ts` |

**Confidence to launch: ~85–90%**

---

# Launch Readiness Checklist

A public beta should not launch until:

- [x] Roster rules match implementation
- [x] VP standings are authoritative
- [x] Draft flow implemented
- [x] Playoffs function correctly (4-team, no-bye)
- [x] Weekly lineup lock is period-based
- [x] End-to-end season simulation completed
- [ ] Draft edge cases validated (reconnect, duplicate tab, auto-pick)
- [ ] Commissioner recovery tools exist (CT-001/002)
- [ ] League onboarding exists
- [ ] Mobile optimization complete
- [ ] Error handling complete
- [ ] Analytics collecting before beta users

---

# Sprint History

| Sprint | Status | Outcome |
|---|---|---|
| Sprint 0 — Implementation Alignment | ✅ COMPLETE (Jun 12, 2026) | Rosters / VP / Playoffs flipped FAIL → PASS |
| Sprint 1 — Season Validation | ✅ COMPLETE (Jun 12, 2026) | Full season simulates, 114 tests pass, confidence 85-90% |
| Sprint 2 — Commissioner + Platform Foundation | 🔄 CURRENT | CT-001/002, MS-001/002/003, VP education |
| Sprint 3 — Beta Readiness | ⏳ UPCOMING | Onboarding, error handling, mobile, notifications, AN-001 |

---

# MVP Launch Timeline

| Window | Milestone |
|---|---|
| **Jun 12, 2026** ✅ | Sprint 0 — alignment P0s closed |
| **Jun 12, 2026** ✅ | Sprint 1 — season simulation + validation green |
| **Late Jul 2026** | Sprint 2 — commissioner tools + platform schema |
| **Aug 2026** | Sprint 3 — beta readiness |
| **Late Aug / early Sep 2026** | MVP code-complete — all launch gates pass |
| **Sep – mid Oct 2026** | Closed beta |
| **Late Oct 2026** | **PUBLIC LAUNCH** |
| **Nov 2026** | First live regular season |
