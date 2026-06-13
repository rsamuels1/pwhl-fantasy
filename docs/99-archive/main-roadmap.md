ROADMAP.md
PWHL Fantasy Product Roadmap
Last Updated: June 13, 2026 (Revised for Sprint 4: August 2026)
Version: 2026 MVP Unified Blueprint
Status: Active Single Source of Truth (SSOT)

1. Product Vision & Philosophy
PWHL Fantasy is the premier fantasy platform for Professional Women's Hockey League fans.

Our goal is to build an approachable, beginner-friendly, and mobile-first experience that remains deep enough for repeat seasonal play. We prioritize a frictionless manager experience and robust commissioner recovery tools to ensure leagues successfully complete their lifecycle.

Core Roadmap Priority Order
When choosing what to build next, we filter priorities through this sequence:

Implementation Correctness: Running code must strictly match the approved v1 rules.
MVP Completion: Focus on features required to complete a full season loop.
Draft Reliability: Eliminate draft-room risks (the highest-exposure area of the platform).
League Completion & Commissioner Success: Build the tools needed to prevent dead/stuck leagues.
User Retention: Establish cross-season history and engagement drivers.
Long-Term Platform Evolution: Dynamic live data, advanced formats, and future integrations.
Guiding Engineering & PM Rules
The "Completion Loop" Rule: A feature is only prioritized if it increases the likelihood that a league successfully completes:
Create League→Fill League→Draft→Set Lineups→Complete Season→Crown Champion→Renew
Live Season First: Build for the live season. Historical Replay is an internal QA/testing tool, not a flagship consumer product. Replay mode requirements must never slow down, shape, or block live-season features.
Replay Compatibility Policy: Do not break replay mode with new features, but do not over-engineer around it. If replay compatibility is cheap (e.g., reading "now" from a date helper instead of the system clock), do it. If it adds real cost or complexity, prefer the live-season implementation.
User-Facing Over Optimization: Favor user-facing functionality over deep technical optimization unless platform stability or draft performance is at risk.
2. MVP Definition & Launch Gates
The MVP must prove a league can run from creation to champion crowning without manual database edits or engineer intervention.

In Scope for MVP:
League Setup: 8/10 team recommendations, onboarding flows, wizard setup, invite links.
Draft: Snake draft with timer, auto-pick, reconnect resilience, position-aware auto-draft logic.
Roster & Lineups: 13-player rosters, weekly lock rules (play-lock / period-lock), mobile-optimized tables.
Scoring & Standings: Victory Point (VP) model, point scoring, regular season head-to-head, 4-team single-elimination playoffs.
Commissioner Tools: Force moves, undo transactions, replace managers, audit logs, draft controls.
Notifications: Critical context alerts (Draft Starting, On the Clock, Lineup Incomplete).
Out of Scope for MVP:
Trades, Waivers, FAAB (to be added post-MVP/pre-launch if implementation risks are low).
Keeper/Dynasty options.
Native mobile apps (iOS/Android) and AI-generated content features.
Launch Gates (Must-Pass Criteria)
Implementation rules match code exactly.
Draft room reliability validated under concurrent load tests.
VP standings and tiebreaker scoring validated via robust tests.
Playoff bracket qualification and seeding logic verified.
Automated end-to-end season simulation successfully executes.
In-app onboarding, error handling, and mobile layout validation complete.
3. MVP Readiness Scorecard
Current confidence to launch today: ~95%

Functional Area	Status	Blocker / Risk	Technical Detail & Mitigation
League Creation	✅ PASS	—	Wizard-driven, 8-team recommendation, clean state generation.
Draft Room	⚠️ PASS WITH RISKS	Duplicate-tab handling	Reconnect ✅ · Commissioner controls ✅ · Position-aware auto-pick ✅. Needs multi-tab validation.
Rosters	✅ PASS	—	Canonical 13-slot setup with active benching validated.
Weekly Matchups	✅ PASS	—	VP-based head-to-head matching, auto-advances.
VP Standings	✅ PASS	—	Single source of truth via computeVpStandings with 28 unit tests.
Weekly Lineup Lock	✅ PASS	—	lockTime period-lock rules functional.
Playoffs	✅ PASS	—	4-team, single-week rounds, no byes. Seeding bugs resolved.
Commissioner Tools	✅ PASS	—	Force moves, transaction undos, manager swaps, and audit logs.
Analytics	✅ PASS	—	6 events instrumented (registrations, creation, draft state, lineups).
E2E Season Sim	✅ PASS	—	Executable through scripts/simulate-season.ts.
Notifications	⚠️ PARTIAL	NT-002 Lineup Incomplete	Framework, bells, and draft alerts live. Lineup nudge is a current blocker.
4. Current Implementation State
The following systems are considered core, implemented platform functionality:

Core Platform Systems
Authentication & User Management: Complete user onboarding tracking flag (User.onboardingCompletedAt DateTime?) and idempotent endpoint /api/user/onboarding.
League Creation & Onboarding: CreateLeagueWizard.tsx (6 steps: name → size → rules/schedule → confirm → invite → done). Supports a dedicated replay generation path.
Draft Room: Real-time WebSocket draft, draft queueing, auto-draft (position-aware and value-ranked), and commissioner controls (pause/resume/auto-escalate).
Roster Management: Sortable tables (FP desc), player profile tabs, full skater/goalie metrics (GP, G, A, PTS, PPP, SOG, HIT, BLK, SV%, GA, SO, FP). Supports read-only views of opponent rosters.
Lineup Management: lockTime(playerTeamId, games, nowMs?, periodStartMs?) locking engine. Play-lock rules prevent editing players after their real game begins. Nudge banners appear when lineups are incomplete.
Matchup Center: 1v1 matchup boards, projections & win probability engine, storyline tracking chips, "playing tonight" flags, swing players, and top-performer highlights.
Standings: Unified Victory Point (VP) model (Win = 2 VP, Tie = 1 VP, Loss = 0 VP, top weekly score = +2 VP, second-highest weekly score = +1 VP). Tiebreaker hierarchy: VP → matchup wins → H2H → total FP → random draw.
Playoff Engine: Bracket generation (1v4, 2v3), single-elimination, runs prior to PWHL postseason boundaries using validateSeasonBoundary.
Commissioner Admin Center: /app/league/[leagueId]/admin/ console. Audit log outputs last 50 actions from LeagueEvent. Recovery controls: Force Roster Move (POST /commissioner/force-move), Undo Transaction (POST /commissioner/undo-transaction), Replace Manager (PUT /teams/[teamId]/owner).
Multi-Season Architecture Foundation: Relational parentLeagueId fields, rulesVersion, scoringVersion, and immutable season boundaries on FantasyLeague.
Historical Replay: Dev-facing speed controls (advance day/week, sim-date stepping) to run full season loops against past stats.
Phase 0: Implementation Alignment (Launch Blockers)
This track ensures that the codebase matches the approved v1 rules. All items here are hard launch blockers and must be complete before public beta.

IA-001. Roster Defaults → 3F / 2D / 1UTIL / 1G / 6 Bench (13 Slots)
Status: ✅ DONE
Description: Configured the canonical 13-slot roster with no IR defaults. Updated across all seed files, create APIs, auto-draft engines, test configurations, and CLAUDE.md files.
IA-002. Victory Points = Authoritative Standings
Status: ✅ DONE
Description: Unified the standings engine to use computeVpStandings as the sole source of truth across all dashboards, standings cards, and playoff services. Removed legacy isVpMode routing branches. Covered by 28 unit tests in tests/vp.test.ts.
IA-003. Simplify Playoff Defaults → 4 Teams, No Byes, Single-Week Rounds
Status: ✅ DONE
Description: Set default configurations in lib/playoffs/lifecycle.ts to 4 teams and 0 byes. Fixed a legacy bracket generation bug to guarantee 1v4 and 2v3 seed matching. Verified via 18 playoff tests and scripts/simulate-season.ts.
IA-004. Season Ends Before PWHL Playoffs
Status: ✅ DONE
Description: Implemented validateSeasonBoundary inside lib/season/lifecycle.ts to block leagues from saving schedules that overlap with the PWHL postseason boundary.
IA-005. Recommended League Sizes
Status: ✅ DONE
Description: Updated creation interfaces to visually promote and highlight the 8-team league default configuration.
IA-006. Victory Point Explanation UI
Status: ✅ DONE
Description: Implemented the VpExplainer component on standings pages, featuring an inline tooltip trigger to educate beginner managers.
IA-007. Rebalance Auto-Draft for 3F Demand
Status: ✅ DONE
Description: Modified auto-draft heuristics to prioritize draft value based on the relative scarcity of forwards in a 3F active lineup. Passed simulation validation tests.
IA-008. Finalize Waiver Spec
Status: ✅ DONE
Description: Documented and locked down transactional parameters (waiver period, prioritizations, claim queues) for post-MVP implementation.
IA-009. Finalize VP Tiebreakers
Status: ✅ DONE
Description: Codified the strict standings tiebreaker chain: VP → matchup wins → H2H → total FP → random draw.
IA-010. Stat-Correction Policies
Status: ✅ DONE
Description: Finalized policies regarding standard daily cutoffs, retroactive weekly locks, and postseason scoring overrides.
IA-011. Hide Advanced Non-v1 Features
Status: ✅ DONE
Description: Hides bye text on brackets when topSeedsWithBye === 0. Extracted all raw configuration JSON objects from the commissioner screens, replacing them with formatted, human-readable settings tables. Covered via docs/02-engineering/ia-011-checklist.md.
Phase 1: Beta Completion
The focus of Phase 1 is on stabilization, responsive optimization, and user onboarding to prepare the platform for external testers.

1. Commissioner Dashboard Gaps
Status: 🔄 IN PROGRESS
Priority: HIGH
Gaps: Add pausing/restarting shortcuts for replay leagues, a explicit "Force Draft Start" override CTA, a temporary lineup unlock route (POST .../commissioner/unlock-player), and a pre-draft settings rules editor.
Technical Spec Gap: The /unlock-player endpoint requires a defined scope on which slot locks it resets (period-lock vs play-lock), and how it writes to the audit log CommissionerEventType schema.
Acceptance Criteria:
All admin panel overrides are active, restricted via requireCommissioner, and generate a traceable LeagueEvent in the audit log.
2. League Onboarding (WelcomeFlow.tsx / CreateLeagueWizard.tsx)
Status: ✅ DONE
Description: Designed a 4-surface onboarding sequence guiding managers from registration to drafting. Includes 3 welcome cards for new players, a 6-step creation wizard with automated default configs, and pre-draft guides detailing rosters and drafting rules.
3. Mobile Optimization
Status: ✅ DONE
Description: Fully responsive overhaul down to a 390px minimum screen width. Implemented a tabbed panel interface in the draft room (useIsMobile(900)), adjusted touch targets to ≥ 44px, added iOS safe-area BottomNav offsets, and formatted wide stat columns with truncation and overflow-scroll guards.
4. Comprehensive Error Handling
Status: ⏳ PLANNED
Estimated Tokens: ~65K (localized UI sweeps)
Goal: Improve user trust through gracefully rendered state boundaries.
Acceptance Criteria:
Replace default unhandled runtime browser crashes with custom empty states, loading indicators, localized retries, and plain-language error screens on API failures.
26. League Overview Redesign
Status: ✅ DONE
Description: Implemented a clean two-column dashboard layout (.overview-grid). Surfaced real-time playoff races, active weekly matchup grids, and an inline league announcement bulletin.
27. Roster Page UX Overhaul
Status: ✅ DONE
Description: Converted card-based rosters into sortable tables. Enabled read-only navigation of rival teams via a dropdown selector, keeping the manager's roster accessible through a direct toggle.
28. Lineup Stats Tab Polish ("Matchup Proj")
Status: ✅ DONE
Description: Renamed "Projected" tabs to "Matchup Proj". Configured the dashboard to automatically display rolling 5-game projection trends between active matchup periods and hide outdated tabs.
32. Draft Room: Team Distribution Panel
Status: ✅ DONE
Description: Designed a client-side TeamSpreadPanel component next to the draft board. This panel tracks and color-codes player concentrations by PWHL team to help managers balance their rosters during live drafts.
Phase 2: Fantasy Essentials (Transactions & Parity)
These features build on core matchup systems to achieve parity with major legacy fantasy sports platforms.

CT-002 Audit Log (Complete)
    ↓
Transaction History (#8 - Complete)
    ↓
Trade System (#7 - Planned)
    ↓
Waivers (#5 - Planned)
    ↓
FAAB (#6 - Planned)
8. Transaction History (TR-000)
Status: ✅ DONE
Description: Implemented a clean, paginated /league/[leagueId]/transactions view. Users can filter transactions by type and team. Includes infinite scroll and strict replay guards, pulling directly from standard LeagueEvent database rows.
5. Waiver Wire System (TR-001)
Status: ⚠️ PARTIAL (Immediate Add/Drop is Live)
Priority: HIGH
Remaining Work: Build the scheduled waiver claim processing queue. Implement waiver priority order resets and configurable claim clearing windows (e.g., 1-3 days).
Acceptance Criteria:
Claims are processed automatically by a background worker using priority and tiebreaker rules.
Replay leagues correctly simulate waiver processing steps.
6. Free Agent Acquisition Budget / FAAB (TR-002)
Status: ⏳ PLANNED
Priority: MEDIUM
Dependencies: Waiver Wire System (#5)
Acceptance Criteria:
Commissioners can enable FAAB with custom starting budgets.
Managers can submit secret bids on waivers. The system resolves claims automatically and updates remaining team balances.
7. Trade System (TR-003)
Status: ⏳ PLANNED
Priority: HIGH
Estimated Tokens: ~130K (Complex multi-user proposal state engine)
Remaining Work: Schema architecture, transaction state tables, manager trade negotiation interfaces, and commissioner review flows.
Acceptance Criteria:
Managers can propose, counter, and cancel multi-player trades.
Automated roster validation checks are run prior to executing approved trades.
Phase 3: Matchup & Season Experience
This phase focuses on in-season engagement, live game days, and playoff tracking.

9. Live Matchup Center
Status: ✅ DONE
Description: Created the DuelHero and FieldHero roster-breakdown views. Includes player comparison modules, live stat polling, storyline highlights, and remaining player tracking.
10. Win Probability Engine
Status: ✅ DONE
Description: Added a matchup projection engine utilizing rolling statistical projections and a logistic-regression matchup win probability model.
11. Matchup Storylines
Status: ⚠️ PARTIAL
Priority: LOW
Description: Basic per-team storyline indicators ("🔥 Forward is hot...") are live. League-wide storylines (e.g., closest matchup previews, projected upsets) remain planned.
25. Team Analysis & Insights Tab
Status: ⏳ PLANNED
Priority: MEDIUM
Estimated Tokens: ~85K
Description: Add an "Analysis" tab to the matchup dashboard. This tab will track position-group performance trends over time, compare stats against league averages, and highlight replacement-level free agents.
Acceptance Criteria:
Displays week-over-week performance graphs by position group.
Recommends free agents based on roster-weakness metrics.
29. Weekly Performance Dashboard
Status: ⏳ PLANNED
Priority: MEDIUM
Estimated Tokens: ~65K (Read-only database aggregation)
Description: Replace the static Schedule tab with a week-by-week leaderboard. Features include rank fluctuation charts, highest/lowest scorer highlights, and weekly position-group point totals.
30. Playoff Experience UX Polish
Status: ⏳ PLANNED
Priority: HIGH (Critical once playoffs start)
Estimated Tokens: ~40K
Goal: Elevate playoff matchups above normal regular-season weeks.
Acceptance Criteria:
Automatically sets the Bracket view as the default league landing page when playoffStatus === "IN_PROGRESS".
Integrates multi-week series aggregation, elimination indicators, and championship celebration displays.
Phase 4: Historical Replay Expansion
Historical Replay is an internal QA tool. Do not prioritize these features unless they directly benefit developer testing or manual validation of the core loop.

Replay Advancement Controls (Complete)
    ↓
Multi-Season Library (#12 - Planned)
    ↓
Speed & Stepping Controls (#13 - Planned)
    ↓
Alternate Redrafts (#14 - Deferred)
    ↓
Replay Performance Analytics (#15 - Deferred)
12. Multi-Season Historical Library
Status: ⏳ PLANNED
Description: Expand the replay creator menu to support selection of different archived PWHL seasons (e.g., 2024, 2024-25, 2025-26) to test varying schedule scales.
13. Replay Simulation Speed Controls
Status: ⏳ PLANNED
Description: Build a simplified developer console on replay league pages to step through games day-by-day, jump weeks, or simulate an entire season in a single execution.
14. Alternate History Drafts
Status: 🛑 DEFERRED (Speculative)
Description: Draft sandboxes to test "what-if" player variations.
15. Replay Analytics
Status: 🛑 DEFERRED (Speculative)
Description: Generate historical draft value, ROI, and league statistics on replay datasets.
Phase 5: Retention & Community
These features keep managers engaged year-over-year and foster in-league discussion.

33. Multi-Season League Architecture (parentLeagueId)
Status: ⚠️ PARTIAL (Database Schema and renewal services are live; UI is planned)
Priority: HIGH (Unlocks the retention layer)
Specs: docs/06-architecture/implement-parentleagueid.md (Story MS-001)
Description: Decouples core league identity from the active season. Links recurring seasonal leagues to a master ParentLeague profile.
Acceptance Criteria:
The renewal service creates a linked successor season while preserving historical records on the parent league.
Surfaces historical standings, draft logs, and championship boards across multiple seasons.
16. In-App League Chat
Status: ⏳ PLANNED
Priority: MEDIUM
Description: Embed real-time chat modules inside leagues to support commissioner announcements, waiver discussions, and trade negotiations.
17. Rivalries (H2H History)
Status: ⚠️ PARTIAL
Priority: MEDIUM
Description: H2H record aggregation is calculated under-the-hood. Dedicated rivalry history layouts, rival badges, and matchup recaps remain planned.
Spec Gap: Requires visual placement designs and a codified "rivalry" calculation ruleset (e.g., based on matchup volume or historical win margins).
18. League Hall of Fame
Status: ⏳ PLANNED
Priority: LOW
Description: Dedicated historical archive displaying champions, high scores, worst losses, and manager records across all linked seasons.
31. Player Legacy & Profile Tracking
Status: ⏳ PLANNED
Priority: MEDIUM
Estimated Tokens: ~95K
Description: Persists user identities and achievements across different teams and leagues. Surfaces personal stats, career FP totals, and platforms rankings on user profiles.
Phase 6: Advanced League Formats
Designed to attract experienced players looking for deep, long-term league configurations.

19. Keeper Leagues
Status: ⏳ PLANNED
Priority: LOW
Description: Support carrying over selected players year-over-year. Includes draft-round pick penalties and custom keeper lock deadlines.
20. Dynasty Leagues
Status: ⏳ PLANNED
Priority: LOW
Description: Multi-year roster support, persistent benches, and dedicated rookie draft configurations.
Phase 7: Live Season Enhancements
Polishes game-day presentation and introduces push capabilities.

21. Live Scoring Integration
Status: ⚠️ PARTIAL
Priority: HIGH
Description: Current scoring updates use 60-second polling. True push messaging (WebSocket-based) requires direct integration with real-time sports feed providers.
22. Push Notifications
Status: ⏳ PLANNED
Priority: MEDIUM
Description: WebPush alerts for real-time play events (e.g., goals), immediate lineup lock alerts, trade proposals, and waiver notifications.
23. Player Trends
Status: ⏳ PLANNED
Priority: LOW
Description: Highlight hot/cold player streaks and breakout candidates on player profile pages.
5. Technical & Architectural Rules
To maintain high developer velocity and codebase integrity, keep these standards aligned:

                  +--------------------------------+
                  |  PWHL Season Boundary Check   |
                  +---------------+----------------+
                                  |
                                  v
+------------------+     +--------+--------+     +------------------+
|   Live Leagues   | <---+   Validation    |---> |  Replay Leagues  |
|  (Core Product)  |     |   Engine (QA)   |     | (QA Test-Bed Only) |
+------------------+     +-----------------+     +------------------+
Architectural Priorities
Live Leagues are Dominant: Replay mode serves as a QA environment, not a consumer feature. Live league stability takes absolute precedence.
Audit Logging Coverage: Every transaction, draft pick, trade state change, and commissioner action must pass through the audit-service via standard LeagueEvent records.
Target Test Coverage: Core business logic (draft loops, lineup locks, standings, playoff seeding) must maintain ≥ 80% coverage.
Background Worker Offloading: Move heavy data aggregations (weekly stats, standings rebuilds, waiver clearing processing) into isolated, background jobs.
6. Priority Backlog & Developer Session Sizing
The following tasks are prioritized and sized by estimated Claude context token weight to optimize developer iteration cycles:

  Quick Wins (< 45K)            Standard (60-90K)            Heavy Lifts (100K+)
┌────────────────────────┐    ┌────────────────────────┐    ┌────────────────────────┐
│ - Playoff UX (#30)     │    │ - Error Handling (#4)  │    │ - Trades (#7)          │
│ - Lineup Stats (#28)   │    │ - Weekly Perf. (#29)   │    │ - Waivers (#5)         │
│ - Draft Spread (#32)   │    │ - Analysis Tab (#25)   │    │ - Onboarding (#2)      │
└────────────────────────┘    └────────────────────────┘    └────────────────────────┘
Quick Wins (< 45K tokens — batch 2–3 per session)
Playoff Experience UX (#30): ~40K tokens. Add bracket navigation redirects and champion banners. No schema updates required.
Lineup Stats Tab Polish (#28): ~25K tokens. ✅ DONE.
Draft Room: Team Distribution Panel (#32): ~30K tokens. ✅ DONE.
Standard Sessions (60–90K tokens — one feature per session)
Comprehensive Error Handling (#4): ~65K tokens. Sweeping addition of loading, empty, and localized API retry screens across primary pages.
Weekly Performance Dashboard (#29): ~65K tokens. Build the performance history layout using current Matchup and StatLine datasets.
Team Analysis & Insights (#25): ~85K tokens. Develop the matchup Analysis tab; postpone trade modules until Trade System (#7) is live.
Heavy Lifts (100K+ tokens — plan fresh, dedicated sessions)
Waiver Wire Priority & Processing (#5): ~110K tokens. Implement processing jobs and prioritized queueing.
Trade System (#7): ~130K tokens. Set up transaction tables, API endpoints, proposal menus, and commissioner trade evaluation dashboards.
League Onboarding (#2): ~100K tokens. ✅ DONE.
Transaction History (#8): ~55K tokens. ✅ DONE.
7. Sprint Plan & Calendar History
Our sprints interleave core correctness alignments, automated validations, and feature development.

Sprint History
Sprint	Status	Key Deliverables & Outcomes
Sprint 0	✅ COMPLETE	Implementation Alignment: Closed rosters, Victory Point, and playoff default rules. Switched standings tests to green.
Sprint 1	✅ COMPLETE	Season Validation: Built the automated scripts/simulate-season.ts flow. Standings and playoff seeding verified.
Sprint 2	✅ COMPLETE	Platform Foundation: Added draft room reconnect resilience, commissioner auth checks, recovery tools, and multi-season schema structures.
Sprint 3	✅ COMPLETE	Beta Readiness: Completed onboarding wizard, error states, mobile overrides, notification framework, and transactions history.
Sprint 4	🔄 CURRENT	Product Polish: Address carry-forwards, build critical lineup alerts, and add remaining commissioner overrides.
Sprint 5	⏳ PLANNED	Validation & Ops: Multi-tab draft testing, launch of the Founder Operations Console, and feedback collection workflows.
Sprint 6+	⏳ PLANNED	Post-MVP Launch Features: Deploy trades, waivers, FAAB, analysis dashboards, and parent league profiles.
Sprint 4 — "Product Polish: Lineup, Commissioner UX, Rivalries" (CURRENT)
Goal: Close final pre-beta UX gaps and complete carry-over items from Sprint 3.
Items:
NT-002 LINEUP_INCOMPLETE Notification (Carry-forward — High Priority): Link checkAndEmitScheduledNotifications(userId, nowMs, prisma) directly inside /app/dashboard/page.tsx. Use a structured dedupeKey = "{periodStartsAt}-{teamId}" to prevent duplicate alerts.
IA-011 Settings Displays (Carry-forward): Render formatted tables for scoringSettings and rosterSettings instead of raw JSON dumps in the commissioner console. Ensure bracket layouts suppress "bye" text when defaults are active.
#01 Commissioner Panel Override Gaps: Add explicit "Force Draft Start" buttons, lineup unlock overrides, and write all actions to the audit log.
#17 Rivalry Interface Gaps: Place rival profile cards on dashboard pages and build historical H2H matchup summaries.
Dependencies:
NT-002 and settings displays can be developed immediately.
Overrides and H2H widgets are blocked on resolving spec definition gaps.
Exit Criteria:
Users with incomplete active rosters receive an in-app LINEUP_INCOMPLETE alert on dashboard load.
JSON configuration blocks are completely removed from user-facing league panels.
All active commissioner overrides generate a correct LeagueEvent write.
Sprint 5 — "Validation & Beta Operations" (PLANNED)
Goal: Certify draft room performance and establish founder monitoring tools before opening the platform to testers.
Items:
Draft Performance & Tab Stress Test: Validate duplicate active draft tab behaviors. Document recovery procedures inside commissioner-runbook.md.
Founder Operations Console: Build isolated search consoles, league creation audits, and simulator controllers via docs/02-engineering/founder-ops-console.md.
In-App Beta Feedback Tools: Add localized bug reporting overlays and track user retention analytics.
Exit Criteria:
Founders can monitor system stability without direct database access.
Verified runbook details a manual recovery path for any unexpected draft-room disconnects.
8. MVP Launch Timeline & Beyond
Our launch calendar targets the start of the real-world PWHL 2026-27 season.

          [MVP Complete]
              Sep 2026
                 │
  Jun - Aug 2026 │  Sep - Oct 2026  Late Oct 2026   Nov 2026
───┬─────────────┼───┬──────────────┬───────────────┬─────────────────►
   │             │   │              │               │
   ▼             ▼   ▼              ▼               ▼
Sprints 2-4    Sprint 5  Closed Beta   Public Launch   First Live Matches
(Foundation &  (Beta Ops (Founding      (Drafts Active  (In-Season
 Polish)        & Cert)   Leagues)       for Opener)     Upgrades)
Target Window	Milestone	Scope / Deliverables
June 12, 2026	Phase 0 Rules Alignment ✅	All core logic matches rules. Playoff, VP, and roster defaults active.
June 12, 2026	Loop Validation ✅	Automated season simulator runs green. Seeding validations complete.
June - July 2026	Platform Infrastructure ✅	Added commissioner recovery overrides, analytics, and renewal pipelines.
June - July 2026	Beta Experience Polish ✅	Onboarding, responsive layouts, transactions log, and mobile overlays live.
August 2026	Sprint 4: Product Polish 🔄	CURRENT SPRINT. Complete critical alerts, override pathways, and H2H modules.
Late August 2026	Sprint 5: Operations ⏳	Run draft stress tests, launch founder consoles, and deploy feedback widgets.
Early Sept 2026	MVP Code Freeze ⏳	Secure all launch gates. Freeze core codebase upgrades.
Sept - Oct 2026	Closed Beta Cycle ⏳	Open invitation cohort of commissioners run trial leagues. Address bug reports.
Late October 2026	Public Platform Launch ⏳	Open general registration. Draft rooms go live one week prior to season opener.
November 2026	First Live Regular Season ⏳	Launch live scoring, performance updates, and regular season game loops.
Post-MVP & Off-Season Strategy
Q4 2026 (In-Season Upgrades): Deploy trades, waivers, FAAB, and weekly matchups analysis dashboards while the active season runs.
Q1/Q2 2027 (Off-Season Analytics & Retention): Expand multi-season features. Ship league history views, Hall of Fame archives, profile portfolios, and referral codes in preparation for summer renewals.
2027-28 Season Launch: Introduce advanced formats (keepers and dynasty leagues), real-time push data networks, mobile push alerts, and player trend graphs. Keep native apps and AI features deferred until retention metrics justify development.