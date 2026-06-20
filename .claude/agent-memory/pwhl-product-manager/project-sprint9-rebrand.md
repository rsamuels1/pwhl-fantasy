---
name: project-sprint9-rebrand
description: Sprint 9 PWHL GM rebrand plan — 8 stories, 43 pts, P1/P2/P3 breakdown, dependency order, trigger criteria
metadata:
  type: project
---

Sprint 9 is the "PWHL GM Rebrand" sprint, planned after Sprint 8 Beta Hardening is complete. All brand strategy, mockups, and checklists are in `docs/branding/`.

**Why:** Rebrand was explicitly deferred from MVP to protect development velocity (per `docs/branding/BRANDING-DEFERRED.md`). Trigger is Sprint 8 complete + founding commissioners have completed at least one draft.

**Stories (in dependency order):**

| Story | Points | Priority | Depends On |
|---|---|---|---|
| REBRAND-001: Core Identity (name, logo, hero) | 5 | P1 | — |
| REBRAND-002: Voice Consistency (welcome, dashboard, login, admin nav) | 3 | P1 | 001 global pass |
| REBRAND-003: Detail Polish (fantasy modifiers, docs) | 3 | P2 | 001 |
| REBRAND-008: QA Sprint (manual testing path) | 3 | P1 | All P1s merged |
| REBRAND-004: Design Token System Upgrade | 5 | P2 | — (parallel with 001-003) |
| REBRAND-005: Matchup Page Visual Redesign | 8 | P2 | 004 |
| REBRAND-006: Draft Room Visual Redesign | 8 | P2 | 004, 001 |
| REBRAND-007: Secondary Pages (lineup, roster, standings, bracket, overview) | 8 | P3 | 004 |
| **Total** | **43** | — | — |

**Minimum shippable (P1 only):** REBRAND-001 + REBRAND-002 + REBRAND-008 = 11 pts (~8 hours), matching the original `BRANDING-DEFERRED.md` estimate.

**Key source files:**
- `docs/branding/01-branding-brief.md` — brand strategy
- `docs/branding/02-brand-assessment.md` — gap analysis + surface-by-surface recs
- `docs/branding/03-terminology-guide.md` — copy before/after reference
- `docs/branding/04-implementation-checklist.md` — task-by-task execution (Phases 1-4)
- `docs/branding/mockups/01-rebrand-showcase.html` — landing page showcase
- `docs/branding/mockups/02-draft-room.html` — draft room mockup
- `docs/branding/mockups/03-my-matchup.html` — matchup page mockup
- `docs/branding/pwhl-gm-matchup-mockup-v2.html` — v2 matchup mockup (richer token system)

**REBRAND-004 token source:** The `<style>` block in `docs/branding/pwhl-gm-matchup-mockup-v2.html` defines the full v2 CSS token vocabulary to copy into `app/globals.css`. Key additions: `--navy-card`, `--indigo-dim/border/glow/text`, `--pos-fwd/def/goal/util`, `--font-display (Syne)`, `--font-mono (DM Mono)`.

**How to apply:** When Sprint 9 starts, confirm trigger criteria are met, then execute in parallel waves: (Wave 1) REBRAND-001/002/003/004 simultaneously; (Wave 2) REBRAND-005/006/007 in parallel after 004 merges; (Final) REBRAND-008 QA after all others merge.

**Note:** Sprint 8 is "Beta Hardening" (already planned in `roadmap-sprints.md`). This rebrand is Sprint 9, not Sprint 8.
