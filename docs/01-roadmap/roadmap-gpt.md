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
- Commissioner Admin Center
- Commissioner Recovery Tools (force move, undo transaction, replace manager)
- League Renewal Flow (renewLeague, parentLeagueId, admin UI)
- Audit Event Surfacing
- Multi-Season Schema Foundation (parentLeagueId, rulesVersion, scoringVersion, pwhlPlayoffStartsAt)
- Season Boundary Enforcement (validateSeasonBoundary in lib/season/lifecycle.ts)
- Analytics Instrumentation (6 events: user_registered, league_created, league_joined, draft_started, draft_completed, lineup_saved)
- VP Education UX (VpExplainer on standings, 8-team recommendation at creation)
- Notification Framework (in-app bell, draft notifications; email deferred)

## Remaining Risks

### Draft Experience

The live draft room is the highest-risk feature. Three of the top pre-beta risks have been closed: WebSocket reconnection with exponential backoff (C1), server-side commissioner auth enforcement on START/PAUSE/RESUME (C2), and position-aware + value-ranked auto-pick (H1/H3). Remaining: duplicate-tab handling and load testing under concurrent leagues.

### Commissioner Recovery

Core recovery tools are implemented.

Remaining work focuses on:

- auditability
- permissions validation
- transaction history

### Multi-Season Foundation

Renewal infrastructure exists and references:

- parentLeagueId
- rulesVersion
- scoringVersion

All multi-season schema fields shipped in Sprint 2: parentLeagueId, rulesVersion, scoringVersion, pwhlPlayoffStartsAt. renewLeague service, renewal API routes, and RenewLeagueForm component are complete. Season boundary enforcement via validateSeasonBoundary() is live.

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

**Status: ✅ DONE**

`validateSeasonBoundary(periods, pwhlPlayoffStartMs)` in `lib/season/lifecycle.ts`. Called in `startSeason()` when `pwhlPlayoffStartsAt` is set on the league. Throws a descriptive error if the last scoring period overlaps the PWHL postseason. Null `pwhlPlayoffStartsAt` (date unknown) logs a warning but does not block — the 2026-27 start date is not yet official.

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

## Sprint 2 (Complete) — Commissioner + Platform Foundation

### Draft Reliability Track ✅

- **C1** WebSocket reconnect with exponential backoff — `useDraftSocket.ts` ✅
- **C2** Commissioner auth enforcement on START/PAUSE/RESUME — server-side `DraftRoom.isCommissioner()` ✅
- **H1/H3** Position-aware + value-ranked auto-pick — tier (G needed → skater starter/UTIL → bench) + proxy FP (goals×2 + assists×1.5 + win×5 + shutout×3); 50-player cap removed ✅

### Commissioner Track ✅

#### CT-001 — Commissioner Control Center ✅

- Force Roster Move — `POST .../commissioner/force-move` ✅
- Undo Transaction — `POST .../commissioner/undo-transaction` ✅
- Replace Manager — `PUT .../teams/[teamId]/owner` ✅
- Admin panel UI: force-move, undo, replace-manager sections, draft-paused banner ✅

#### CT-002 — Audit Logging ✅

All commissioner actions tracked via `LeagueEvent` using `logCommissionerAction()` in `lib/services/audit-service.ts`. Draft server writes PAUSE/RESUME audit events. Audit log table in admin panel shows last 50 commissioner actions.

#### IA-004 — Fantasy Season Ends Before PWHL Playoffs ✅

`validateSeasonBoundary()` in `lib/season/lifecycle.ts`. See Phase 0 section above.

### Platform Foundation Track ✅

#### MS-001 — parentLeagueId ✅

`parentLeagueId String?` self-referencing relation on `FantasyLeague`. `renewLeague()` service in `lib/services/renewal-service.ts`. `RenewLeagueForm` in admin panel (gated on `playoffStatus === COMPLETE`). `POST /api/leagues/[leagueId]/renew` and `GET .../history` routes live.

#### MS-002 — rulesVersion ✅

`rulesVersion Int @default(1)` on `FantasyLeague`.

#### MS-003 — scoringVersion ✅

`scoringVersion Int @default(1)` on `FantasyLeague`.

#### MS-004 — Season Renewal ✅

`renewLeague(leagueId, overrides, prisma)` in `lib/services/renewal-service.ts`. `bumpSeason("2026-27") → "2027-28"`. `RenewalBlockedError` when `playoffStatus !== COMPLETE` or already renewed.

### Analytics Track ✅

#### AN-001 — Core Event Tracking ✅

`trackEvent()` in `lib/analytics/index.ts`. V1: structured console.log, designed to swap to PostHog/Plausible by replacing the function body. 6 events instrumented: `user_registered`, `league_created`, `league_joined`, `draft_started`, `draft_completed`, `lineup_saved`.

### Product Track ✅

#### IA-006 — VP Education UI ✅

`VpExplainer` component on the standings page.

#### IA-005 — Recommend 8-Team Leagues ✅

"Recommended" label shown next to 8-team option on league creation form.

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

#### NT-001 — Notification Framework 🔄 (In Progress)

In-app channel complete. Email deferred post-beta.

- `Notification` + `NotificationPreference` schema models ✅
- `lib/services/notification-service.ts` — `createNotification`, `markAllRead` ✅
- `GET/POST /api/leagues/[leagueId]/notifications` ✅
- `components/NotificationBell.tsx` — bell + unread badge in league layout ✅
- Email delivery — deferred

#### NT-002 — Critical Notifications 🔄 (Partial)

Shipped (in-app):
- Draft Starting — fired at `PERSIST_STATUS IN_PROGRESS` in `lib/draft/server.ts` ✅
- On The Clock — fired after each `BROADCAST_PICK` in `lib/draft/server.ts` ✅

Deferred (post-beta):
- Lineup Incomplete (requires a scheduled sweep job)
- Trade Received, Waiver Result, Playoff Clinched (features not yet built)

Spec: `docs/02-engineering/notification-framework-spec.md` · Priority: P1

---

### IA-011 — Hide Advanced Non-v1 Features

Hide advanced playoff structures, multi-round configuration, and experimental scoring from the standard UI.

Priority: P2

---

## Sprint 3 Exit

A brand-new user creates and drafts a league on a phone with no docs. **MVP launch gate.**

---

## Sprint 4 — Product Polish

### #28 — Lineup Stats Tab Polish

Rename "Projected" → "Matchup Proj". Default to it between weeks. Disable "This week" when no active period. Single-component edit.

Priority: P1

---

### #01 — Commissioner Dashboard (remaining gaps)

Pause/restart replay shortcut · Force-draft-start CTA · Lineup lock override (`POST .../commissioner/unlock-player`) · Settings editor (pre-draft only). All actions write to audit log.

Priority: P1

---

### #17 — Rivalries (remaining gaps)

Rival badge on team cards (most-played opponent with notable W/L diff). H2H history view on matchup page (per-week scores, built on existing `Matchup` rows + `getHeadToHeadRecord`). No schema changes.

Priority: P2

---

## Sprint 4 Exit

No Phase 1 or Phase 5 feature card enters beta in "partial" state when remaining work is small.

---

## Sprint 5 — Validation + Beta Operations

Draft reliability certification (duplicate-tab, load test, reconnect stress) · Founder Operations Console (league explorer, simulation launcher, validation dashboard) · Beta Feedback Infrastructure (in-app widget, founding commissioner tracking) · Commissioner workflow validation (end-to-end manual test, runbook screenshots).

**Exit:** commissioner runs a league start-to-finish with no engineering help; founding cohort can be invited.

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
| Draft | ⚠️ PASS WITH RISKS | reconnect ✅ · commissioner auth ✅ · auto-pick position-aware ✅ · duplicate-tab unvalidated |
| Rosters | ✅ PASS | 3F / 2D / 1G / 1UTIL / 6B confirmed |
| Weekly matchups | ✅ PASS | — |
| VP standings | ✅ PASS | 28 unit tests |
| Weekly lineup lock | ✅ PASS | period-based |
| Playoffs | ✅ PASS | 4-team, no-bye, bracket fixed |
| Commissioner tools | ✅ PASS | force-move, undo, replace-manager, audit log |
| Analytics | ✅ PASS | 6 events instrumented (V1 console log; swap to PostHog pre-beta) |
| End-to-end season sim | ✅ PASS | `scripts/simulate-season.ts` |

**Confidence to launch: ~95%**

---

# Launch Readiness Checklist

A public beta should not launch until:

- [x] Roster rules match implementation
- [x] VP standings are authoritative
- [x] Draft flow implemented
- [x] Playoffs function correctly (4-team, no-bye)
- [x] Weekly lineup lock is period-based
- [x] End-to-end season simulation completed
- [x] Draft reconnect + commissioner auth + auto-pick position-aware (C1/C2/H1/H3)
- [ ] Draft duplicate-tab handling validated (load test)
- [x] Commissioner recovery tools exist (CT-001/002)
- [ ] League onboarding exists
- [ ] Mobile optimization complete
- [ ] Error handling complete
- [ ] Analytics wired to external provider (PostHog/Plausible) before beta users

---

# Sprint History

| Sprint | Status | Outcome |
|---|---|---|
| Sprint 0 — Implementation Alignment | ✅ COMPLETE (Jun 12, 2026) | Rosters / VP / Playoffs flipped FAIL → PASS |
| Sprint 1 — Season Validation | ✅ COMPLETE (Jun 12, 2026) | Full season simulates, 114 tests pass, confidence 85-90% |
| Sprint 2 — Commissioner + Platform Foundation | ✅ COMPLETE (Jun 2026) | CT-001/002, MS-001/002/003/004, AN-001, VP education — 130 tests |
| Sprint 3 — Beta Readiness | 🔄 CURRENT | Onboarding, error handling, mobile, notifications, IA-011 |
| Sprint 4 — Product Polish | ⏳ PLANNED | #28 lineup tab polish, #01 commissioner dashboard gaps, #17 rivalries |
| Sprint 5 — Validation + Beta Operations | ⏳ PLANNED | Draft cert, founder dashboard, beta feedback infra |

---

# MVP Launch Timeline

| Window | Milestone |
|---|---|
| **Jun 12, 2026** ✅ | Sprint 0 — alignment P0s closed |
| **Jun 12, 2026** ✅ | Sprint 1 — season simulation + validation green |
| **Jun 2026** ✅ | Sprint 2 — commissioner tools, multi-season schema, analytics, VP education |
| **Jul–Aug 2026** ← current | Sprint 3 — beta readiness (MVP launch gate) |
| **Aug 2026** | Sprint 4 — lineup tab polish, commissioner dashboard gaps, rivalries |
| **Late Aug 2026** | Sprint 5 — validation + beta operations |
| **Late Aug / early Sep 2026** | MVP code-complete — all launch gates pass |
| **Sep – mid Oct 2026** | Closed beta |
| **Late Oct 2026** | **PUBLIC LAUNCH** |
| **Nov 2026** | First live regular season |
