# Documentation Audit

Date: June 12, 2026
Audited by: Documentation Reorganization Sprint

---

## Summary

| Metric | Count |
|---|---|
| Total files audited | 49 |
| Files moved (straight) | 35 |
| Files renamed on move | 5 |
| Files consolidated | 4 → 1 subfolder (4 files) |
| Files archived | 8 |
| New files created | 4 (README.md, documentation-audit.md, documentation-standards.md, implementation-alignment/README.md) |
| Empty stubs kept | 1 (`06-architecture/parent-league-id.md`) |
| Files listed in sprint but not found on disk | 1 (`multi-season-strategy.md`) |
| **Total files after reorganization** | **53** |

---

## Complete File Inventory

### 00-product (6 files)

| Original Path | New Path | Action |
|---|---|---|
| `docs/mvp-definition.md` | `docs/00-product/mvp-definition.md` | Moved |
| `docs/feature-matrix.md` | `docs/00-product/feature-matrix.md` | Moved |
| `docs/league-rules-v1.md` | `docs/00-product/league-rules-v1.md` | Moved |
| `docs/user-education-content.md` | `docs/00-product/user-education-content.md` | Moved |
| `docs/league-homepage-v1.md` | `docs/00-product/league-homepage-v1.md` | Moved |
| `docs/v1-launch-criteria.md` | `docs/00-product/v1-launch-criteria.md` | Moved |

### 01-roadmap (6 files)

| Original Path | New Path | Action |
|---|---|---|
| `docs/roadmap/roadmap.md` | `docs/01-roadmap/roadmap.md` | Moved |
| `docs/roadmap/roadmap.html` | `docs/01-roadmap/roadmap.html` | Moved |
| `docs/roadmap/roadmap-gpt.md` | `docs/01-roadmap/roadmap-gpt.md` | Moved (kept active — 668 lines of substantive content) |
| `docs/roadmap-prioritization-updates.md` | `docs/01-roadmap/roadmap-prioritization-updates.md` | Moved |
| `docs/recommended-next-sprint.md` | `docs/01-roadmap/recommended-next-sprint.md` | Moved |
| `docs/post-mvp-validation-sprint-plan.md` | `docs/01-roadmap/post-mvp-validation-sprint-plan.md` | Moved |

### 02-engineering (9 files)

| Original Path | New Path | Action |
|---|---|---|
| `docs/engineering-foundation-spec.md` | `docs/02-engineering/engineering-foundation-spec.md` | Moved |
| `docs/draft-exp-spec.md` | `docs/02-engineering/draft-exp-spec.md` | Moved (kept original filename to preserve references) |
| `docs/commission-tools-spec.md` | `docs/02-engineering/commission-tools-spec.md` | Moved (kept original filename) |
| `docs/trade-spec.md` | `docs/02-engineering/trade-spec.md` | Moved |
| `docs/waiver-spec.md` | `docs/02-engineering/waiver-spec.md` | Moved |
| `docs/notification-framework-spec.md` | `docs/02-engineering/notification-framework-spec.md` | Moved |
| `docs/onboarding-spec.md` | `docs/02-engineering/onboarding-spec.md` | Moved |
| `docs/founder-dashboard-spec.md` | `docs/02-engineering/founder-dashboard-spec.md` | Moved (not in sprint list — classified as engineering spec) |
| `docs/founder-ops-console.md` | `docs/02-engineering/founder-ops-console.md` | Moved (not in sprint list — classified as engineering spec) |

### 03-validation (6 direct files + 1 subfolder)

| Original Path | New Path | Action |
|---|---|---|
| `docs/mvp-audit-report.md` | `docs/03-validation/mvp-audit-report.md` | Moved |
| `docs/mvp-readiness-scorecard.md` | `docs/03-validation/mvp-readiness-scorecard.md` | Moved |
| `docs/mvp-validation-checklist.md` | `docs/03-validation/mvp-validation-checklist.md` | Moved |
| `docs/season-simulation-plan.md` | `docs/03-validation/season-simulation-plan.md` | Moved |
| `docs/season-simulation-scenarios.md` | `docs/03-validation/season-simulation-scenarios.md` | Moved |
| `docs/risk-register.md` | `docs/03-validation/risk-register.md` | Moved (not in sprint list — classified as validation) |
| `docs/implementation-alignment-sprint.md` | `docs/03-validation/implementation-alignment/README.md` | Consolidated — repurposed as subfolder entry point |
| `docs/backlog/implementation-alignment.md` | `docs/03-validation/implementation-alignment/audit.md` | Consolidated |
| `docs/p0-fix-plan.md` | `docs/03-validation/implementation-alignment/fix-plan.md` | Consolidated |
| `docs/current-sprint-audit.md` | `docs/03-validation/implementation-alignment/status.md` | Consolidated |

### 04-operations (4 files)

| Original Path | New Path | Action |
|---|---|---|
| `docs/commish-runbook.md` | `docs/04-operations/commissioner-runbook.md` | Moved + renamed (typo fix) |
| `docs/support-playbook.md` | `docs/04-operations/support-playbook.md` | Moved |
| `docs/founding-commish-program.md` | `docs/04-operations/founding-commissioner-program.md` | Moved + renamed (typo fix) |
| `docs/beta-success-metrics.md` | `docs/04-operations/beta-success-metrics.md` | Moved |

### 05-growth (2 files)

| Original Path | New Path | Action |
|---|---|---|
| `docs/growth-retention.md` | `docs/05-growth/growth-retention-spec.md` | Moved + renamed (added `-spec` suffix) |
| `docs/analytics-events.md` | `docs/05-growth/analytics-events.md` | Moved |

### 06-architecture (5 files)

| Original Path | New Path | Action |
|---|---|---|
| `docs/season-renewal-system.md` | `docs/06-architecture/season-renewal-system.md` | Moved |
| `docs/implent-parentleagueid.md` | `docs/06-architecture/implement-parentleagueid.md` | Moved + renamed (typo fix: `implent` → `implement`) |
| `docs/backlog/parent-league-id.md` | `docs/06-architecture/parent-league-id.md` | Moved (empty stub — kept as planning signal) |
| `docs/ai-development-workflow.md` | `docs/06-architecture/ai-development-workflow.md` | Moved |
| `docs/dependency-map.md` | `docs/06-architecture/dependency-map.md` | Moved (not in sprint list — classified as architecture) |

### 99-archive (8 files)

| Original Path | New Path | Reason archived |
|---|---|---|
| `docs/roadmap/roadmap-gpt.html` | `docs/99-archive/roadmap-gpt.html` | Superseded HTML export |
| `docs/roadmap/roadmap-gpt-v2.html` | `docs/99-archive/roadmap-gpt-v2.html` | Historical iteration |
| `docs/roadmap/roadmap-gpt-v3.html` | `docs/99-archive/roadmap-gpt-v3.html` | Historical iteration |
| `docs/roadmap/roadmap-gpt-v4.html` | `docs/99-archive/roadmap-gpt-v4.html` | Historical iteration |
| `docs/roadmap/roadmap-gpt-v5.html` | `docs/99-archive/roadmap-gpt-v5.html` | Historical iteration |
| `docs/roadmap-refresh-request.md` | `docs/99-archive/roadmap-refresh-request.md` | Request artifact; findings incorporated |
| `docs/mvp-launch-exec-sprint.md` | `docs/99-archive/mvp-launch-exec-sprint.md` | One-shot Claude prompt; historical |
| `docs/documentation-reorganization-sprint.md` | `docs/99-archive/documentation-reorganization-sprint.md` | Sprint prompt; complete |

---

## Filename Corrections

Five filenames had typos or inconsistencies corrected on move:

| Original Filename | Corrected Filename | Issue |
|---|---|---|
| `commish-runbook.md` | `commissioner-runbook.md` | Abbreviation `commish` → full word |
| `founding-commish-program.md` | `founding-commissioner-program.md` | Abbreviation `commish` → full word |
| `implent-parentleagueid.md` | `implement-parentleagueid.md` | Typo `implent` → `implement` |
| `growth-retention.md` | `growth-retention-spec.md` | Added `-spec` suffix for consistency with other spec files |

Note: `draft-exp-spec.md`, `commission-tools-spec.md`, and `roadmap-prioritization-updates.md` were listed in the sprint prompt with slightly different target names but kept with their original filenames to avoid breaking existing references in code or other documents.

---

## Overlap Analysis — Implementation Alignment Consolidation

Four documents were consolidated into `docs/03-validation/implementation-alignment/`:

| File | Role | Overlap |
|---|---|---|
| `implementation-alignment-sprint.md` | Sprint prompt that initiated the audit work | Describes what to fix; context for the others |
| `backlog/implementation-alignment.md` | Detailed backlog of alignment issues | Similar content to sprint prompt but more structured |
| `p0-fix-plan.md` | Resolution specs for P0 blockers | Overlapped with audit; both tracked the same 4 issues |
| `current-sprint-audit.md` | Status table for the same sprint | Tracked progress on the same 4 issues as fix-plan |

All four track the same four P0 issues. Consolidating into a subfolder preserves all content while signaling they form a single narrative.

---

## Directories Removed

- `docs/roadmap/` — all 8 files moved to `docs/01-roadmap/` or `docs/99-archive/`
- `docs/backlog/` — both files moved to `docs/03-validation/implementation-alignment/` and `docs/06-architecture/`

---

## Edge Cases

| Issue | Decision |
|---|---|
| `multi-season-strategy.md` — listed in sprint, does not exist on disk | Noted as PLANNED in `docs/README.md`; not created |
| `backlog/parent-league-id.md` — 0 bytes (empty stub) | Moved to `06-architecture/` as a planning signal; presence marks intended future work |
| `roadmap/roadmap-gpt.md` — borderline archive candidate | Kept active in `01-roadmap/` — 668 lines of substantive prioritization content |
| `founder-dashboard-spec.md` and `founder-ops-console.md` — not in sprint move lists | Routed to `02-engineering/` (both are implementation-oriented feature specs) |
| `risk-register.md` — not in sprint move lists | Routed to `03-validation/` (tracks launch risks, fits validation category) |
| `dependency-map.md` — not in sprint move lists | Routed to `06-architecture/` (tracks feature/architecture dependencies) |
