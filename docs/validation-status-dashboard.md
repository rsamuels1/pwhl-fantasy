# Validation Status Dashboard

Last updated: June 12, 2026
Source documents reviewed: all files in `docs/03-validation/`

---

## Document Classification

### Active Sources of Truth

Documents that reflect the current state of the product and should be consulted for decisions.

| Document | Purpose | Last Updated |
|---|---|---|
| [MVP Readiness Scorecard](03-validation/mvp-readiness-scorecard.md) | Post-sprint area-by-area readiness ratings with evidence | June 12, 2026 |
| [Risk Register](03-validation/risk-register.md) | Open risk tracking across product, technical, and operational dimensions | Active |
| [Season Simulation Scenarios](03-validation/season-simulation-scenarios.md) | 12 scenarios that must pass before beta | Active |
| [MVP Validation Checklist](03-validation/mvp-validation-checklist.md) | Feature-by-feature checklist; **currently unchecked** — needs a formal pass |

### Historical Snapshots

Documents that capture a point-in-time state that has since changed. Preserve for audit trail but do not use for current decisions.

| Document | What it captured | Superseded by |
|---|---|---|
| [MVP Audit Report](03-validation/mvp-audit-report.md) | Pre-fix list of IA-001 through IA-007 discrepancies | Fix Plan + Scorecard |
| [Implementation Alignment: Fix Plan](03-validation/implementation-alignment/fix-plan.md) | P0-001–P0-004 specs and resolution record | Scorecard (all 4 resolved) |
| [Implementation Alignment: Status](03-validation/implementation-alignment/status.md) | Pre-sprint delivery status (all FAIL/PARTIAL) | Scorecard |

### Archived References

Documents used to direct work that has already been completed. Correct but no longer active.

| Document | Role |
|---|---|
| [Implementation Alignment: Audit](03-validation/implementation-alignment/audit.md) | Original alignment backlog that generated the P0 list |
| [Season Simulation Plan](03-validation/season-simulation-plan.md) | Defined simulation methodology; fulfilled by `scripts/simulate-season.ts` |

---

## Validation Hierarchy

```
01  MVP Readiness Scorecard        ← current top-level assessment
        │
        ├── 02  Risk Register      ← open risks that could degrade readiness
        │
        ├── 03  Simulation Scenarios  ← 12 scenarios that must pass
        │         (Scenario 1-2, 4-8 verified; 3, 9-11 partial or unclear)
        │
        └── 04  Validation Checklist  ← formal sign-off; all boxes still unchecked
```

The scorecard is the gating document. Risks and scenarios feed into it. The checklist is the formal sign-off that has not yet been executed as a structured manual pass.

---

## Current MVP Readiness Assessment

*Source: [MVP Readiness Scorecard](03-validation/mvp-readiness-scorecard.md) — June 12, 2026*

| Area | Status | Notes |
|---|---|---|
| League Creation | **PASS** | Correct defaults, invitations, team creation |
| Rosters | **PASS** | Canonical 13-slot config consistent everywhere; 19 lineup tests pass |
| Weekly Matchups | **PASS** | VP scoring + standings verified by 28 unit tests |
| VP Standings | **PASS** | `computeVpStandings` is single authority; branching removed |
| Weekly Lineup Lock | **PASS** | Period-based locking; 6 lock tests pass |
| Playoffs | **PASS** | 4-team/no-bye bracket correct; bracket bug fixed; 18 playoff tests pass |
| End-to-End Simulation | **PASS** | `scripts/simulate-season.ts` completes full Create→Draft→Score→Playoffs→Champion |
| Draft | **PASS WITH RISKS** | Logic and UI complete; disconnect/reconnect not load-tested |
| Commissioner Tools | **PARTIAL** | Admin panel and controls exist; audit logging and incident runbook absent |
| Analytics | **FAIL** | Spec exists; no instrumentation. **Explicitly post-launch — not a launch blocker.** |

**Overall confidence: 85–90%** (114/114 tests pass, `tsc --noEmit` clean)

---

## Open Issues from MVP Audit Report

The audit report identified 7 issues (IA-001 to IA-007). Status as of June 12, 2026:

| ID | Description | Severity | Status |
|---|---|---|---|
| IA-001 | Roster construction mismatch | P0 | **RESOLVED** |
| IA-002 | VP not fully authoritative | P0 | **RESOLVED** |
| IA-003 | Playoff format mismatch | P0 | **RESOLVED** |
| IA-004 | Weekly lineup lock mismatch | P0 | **RESOLVED** |
| IA-005 | League size default (`maxTeams` 10 vs recommended 8) | P1 | **UNRESOLVED** |
| IA-006 | Fantasy season boundary validation missing (fantasy playoffs could overlap PWHL playoffs) | P1 | **UNRESOLVED** |
| IA-007 | VP education UX missing | P2 | **UNRESOLVED** |

---

## Remaining Launch Blockers

### Hard Blockers

None. All four P0 items from the alignment audit are resolved.

---

### Pre-Launch Required (Before Beta)

These are not hard-blocking code failures but must be addressed before inviting real commissioners:

**1. Validation checklist has never been formally executed**
All boxes in `03-validation/mvp-validation-checklist.md` are unchecked. The scorecard provides evidence-based confidence but does not substitute for a structured manual pass through the checklist. Recommend: run the checklist against a seeded league before inviting the first beta commissioner.

**2. Draft load testing incomplete**
Risk R-005 (disconnect/reconnect) and R-006 (timer behavior) are PARTIAL. Auto-escalation is unit-tested but not end-to-end tested. The draft is the highest-risk feature (concurrent, pick-clock, all leagues drafting the same week). Recommend: multi-client stress test before draft day.

**3. IA-005 — League size default not fixed**
`maxTeams` still defaults to 10 in league creation. Product direction is 8. Low-effort fix but should be confirmed before real leagues are created.

---

### Pre-Launch Recommended (Risk Reduction)

Addressing these would move confidence from 85–90% toward 95%+:

**4. Commissioner incident runbook**
Risk R-007 (commissioner cannot resolve issues). The admin panel exists but there is no documented procedure for mid-season incidents (stuck draft, scoring correction, player dispute). The `04-operations/commissioner-runbook.md` covers normal operations but not incident response.

**5. IA-006 — Season boundary validation**
No guardrail prevents the fantasy playoff schedule from overlapping with the PWHL playoff window. Low risk for season 1 (dates are known), but should be validated against the 2026-27 PWHL calendar when it is announced.

**6. Simulation scenarios 3, 9, 10, 11 not verified**
| Scenario | Description | Gap |
|---|---|---|
| S-003 | Draft disconnect + reconnect | Reconnect flow not explicitly tested end-to-end |
| S-009 | Inactive manager never sets lineup | Behavior in production untested |
| S-010 | Commissioner replacement mid-season | Not implemented (R-008) |
| S-011 | Late stat correction triggers standing recalculation | Not verified |

**7. VP education UX (IA-007)**
Risk R-001 (VP scoring confusion) is rated High impact / High likelihood. First-time fantasy managers will see standings that do not match traditional win/loss records with no explanation. Currently no standings explainer or VP education tooltip exists in the UI.

---

### Post-Launch (Not Blocking)

These are known gaps that are explicitly deferred:

| Item | Decision |
|---|---|
| Analytics instrumentation | FAIL in scorecard; post-launch per sprint decision |
| `parentLeagueId` / multi-season architecture (R-014) | Post-launch P1; first season can run without it |
| Versioned rules / scoring (R-015) | Post-launch; no rule changes planned for season 1 |
| Notification framework | Spec exists in `02-engineering/`; not built |
| Trade system | Post-MVP Sprint 4+ |
| Waiver layer | Add/drop works; waiver queue post-MVP |

---

## Risk Register Summary

*Source: [Risk Register](03-validation/risk-register.md)*

| ID | Risk | Impact | Likelihood | Status |
|---|---|---|---|---|
| R-001 | VP scoring confusion | High | High | Open |
| R-002 | Playoff qualification confusion | Medium | Medium | Open |
| R-003 | Lineup lock confusion | Medium | High | Open |
| R-004 | Draft failure | High | Medium | Mitigated |
| R-005 | Draft disconnect | Medium | High | Partial |
| R-006 | Draft timer issues | Medium | Medium | Partial |
| R-007 | Commissioner cannot resolve issues | High | Medium | Open |
| R-008 | Commissioner abandons league | High | Medium | Open |
| R-009 | Inactive managers | High | High | Open |
| R-010 | Low Week 2 retention | High | Medium | Open |
| R-011 | Scoring errors | High | Low | Mitigated |
| R-012 | Playoff logic errors | High | Low | Mitigated |
| R-013 | PWHL API/data issues | High | Medium | Open |
| R-014 | Missing `parentLeagueId` | High | Medium | Open (post-launch) |
| R-015 | Missing versioned rules | Medium | Medium | Open (post-launch) |
| R-016 | Insufficient beta commissioners | High | Medium | Open |
| R-017 | Insufficient feedback | Medium | Medium | Open |
| R-018 | No product-market fit | High | Unknown | Open |
| R-019 | Competitive pressure | Medium | Low | Open |
| R-020 | Support overload | Medium | Medium | Open |

Mitigated: 3 of 20. Open/Partial: 17 of 20 — most are operational or product-experience risks, not technical failures.

---

## What to Do Next

In priority order:

1. **Run the validation checklist** against a freshly seeded league to convert the scorecard's evidence-based confidence into a formal signed-off checklist.
2. **Fix IA-005** — flip `maxTeams` default to 8 before any real leagues are created.
3. **Multi-client draft stress test** — at minimum, test 4 simultaneous clients with deliberate disconnects.
4. **Write commissioner incident runbook** — add a "mid-season incidents" section to `04-operations/commissioner-runbook.md`.
5. **Add VP standings explainer** to the standings page (R-001, IA-007) — highest-likelihood UX confusion risk.
