# PWHL Fantasy Documentation

Documentation for the PWHL Fantasy web app — a fantasy sports platform for the Professional Women's Hockey League, targeting the 2026-27 season.

## How to Navigate

| If you want to know... | Go to... |
|---|---|
| What the product is | [`00-product/`](00-product/) |
| What gets built next | [`01-roadmap/`](01-roadmap/) |
| How a feature is implemented | [`02-engineering/`](02-engineering/) |
| Whether the product works | [`03-validation/`](03-validation/) |
| How to operate leagues | [`04-operations/`](04-operations/) |
| Growth and analytics | [`05-growth/`](05-growth/) |
| Long-term platform design | [`06-architecture/`](06-architecture/) |
| Historical artifacts | [`99-archive/`](99-archive/) |

---

## 00 — Product

Defines WHAT the product is. Product requirements, feature definitions, league rules.

- [MVP Definition](00-product/mvp-definition.md) — Minimum feature set required for public launch
- [Feature Matrix](00-product/feature-matrix.md) — Product vision, guiding principles, and feature overview
- [League Rules v1](00-product/league-rules-v1.md) — Comprehensive rules: draft, lineups, VP scoring, playoffs
- [v1 Launch Criteria](00-product/v1-launch-criteria.md) — Scope gate for public launch
- [User Education Content](00-product/user-education-content.md) — Explains PWHL Fantasy to casual fans new to fantasy sports
- [League Homepage v1](00-product/league-homepage-v1.md) — League landing page experience spec

---

## 01 — Roadmap

Defines WHAT gets built and WHEN. Priorities and sprint sequencing.

- [Roadmap](01-roadmap/roadmap.md) — Source of truth for future development priorities (last updated June 12, 2026)
- [Roadmap (GPT Draft)](01-roadmap/roadmap-gpt.md) — Alternative prioritization view with rationale
- [Roadmap Prioritization Updates](01-roadmap/roadmap-prioritization-updates.md) — Recommendations for reordering priorities
- [Recommended Next Sprint](01-roadmap/recommended-next-sprint.md) — MVP Season Validation Sprint brief
- [Post-MVP Validation Sprint Plan](01-roadmap/post-mvp-validation-sprint-plan.md) — Current sprint plan

---

## 02 — Engineering

Defines HOW features should be implemented. Implementation contracts and feature specs.

- [Engineering Foundation Spec](02-engineering/engineering-foundation-spec.md) — VP standings, roster construction, playoff formats
- [Parent League Foundation — Execution Plan](02-engineering/parent-league-foundation-execution-plan.md) — Sprint 2 implementation contract for `parentLeagueId`, renewal service, and multi-season architecture
- [Draft Experience Spec](02-engineering/draft-exp-spec.md) — Draft room design and behavior
- [Commissioner Tools Spec](02-engineering/commission-tools-spec.md) — Commissioner platform features
- [Trade Spec](02-engineering/trade-spec.md) — Trade system (post-MVP Sprint 4+)
- [Waiver Spec](02-engineering/waiver-spec.md) — Waiver system (partially implemented)
- [Notification Framework Spec](02-engineering/notification-framework-spec.md) — Notification system (planned)
- [Onboarding Spec](02-engineering/onboarding-spec.md) — League creation onboarding flow
- [Founder Dashboard Spec](02-engineering/founder-dashboard-spec.md) — Platform health dashboards (proposed)
- [Founder Operations Console](02-engineering/founder-ops-console.md) — Operational management interface (proposed)

---

## 03 — Validation

Proves the product works. Audits, scorecards, checklists, simulation plans.

- [MVP Audit Report](03-validation/mvp-audit-report.md) — Audit of implementation vs product documentation
- [MVP Readiness Scorecard](03-validation/mvp-readiness-scorecard.md) — Post-sprint readiness assessment (updated June 12, 2026)
- [MVP Validation Checklist](03-validation/mvp-validation-checklist.md) — Feature-by-feature verification checklist
- [Season Simulation Plan](03-validation/season-simulation-plan.md) — Complete lifecycle simulation plan (P0 launch gate)
- [Season Simulation Scenarios](03-validation/season-simulation-scenarios.md) — Specific test scenarios for simulation
- [Risk Register](03-validation/risk-register.md) — Launch and operational risk tracking
- [Implementation Alignment](03-validation/implementation-alignment/) — P0 fix history: audit, fix plan, and resolution status (all resolved June 12, 2026)

---

## 04 — Operations

Documentation for humans running the product.

- [Commissioner Runbook](04-operations/commissioner-runbook.md) — Step-by-step guide for running a PWHL Fantasy league
- [Support Playbook](04-operations/support-playbook.md) — Support procedures and severity levels
- [Founding Commissioner Program](04-operations/founding-commissioner-program.md) — Program for beta commissioners
- [Beta Success Metrics](04-operations/beta-success-metrics.md) — Objective criteria for beta readiness

---

## 05 — Growth

Retention, analytics, and user acquisition planning.

- [Growth & Retention Spec](05-growth/growth-retention-spec.md) — Long-term activation and retention strategy
- [Analytics Events](05-growth/analytics-events.md) — Analytics event specification for MVP v1

---

## 06 — Architecture

Long-term platform architecture and system evolution.

- [Season Renewal System](06-architecture/season-renewal-system.md) — Commissioner league renewal for next season (post-launch P1)
- [Implement Parent League ID](06-architecture/implement-parentleagueid.md) — Multi-season league architecture epic (MS-001)
- [Parent League ID](06-architecture/parent-league-id.md) — Planning stub for parentLeagueId work
- [AI Development Workflow](06-architecture/ai-development-workflow.md) — How this project uses AI-assisted development
- [Dependency Map](06-architecture/dependency-map.md) — Feature and architectural dependency tracking
- `multi-season-strategy.md` — **PLANNED** (not yet created)

---

## Meta

- [Validation Status Dashboard](validation-status-dashboard.md) — Current MVP readiness, document hierarchy, remaining blockers
- [Documentation Audit](documentation-audit.md) — Inventory of all files moved during this reorganization
- [Documentation Standards](documentation-standards.md) — Naming conventions, routing guide, governance

## Archive

Historical artifacts in [`99-archive/`](99-archive/) — superseded HTML exports, completed sprint prompts, and request documents.
