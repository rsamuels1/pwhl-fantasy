# Roadmap Diff Summary

**Date:** June 12, 2026

**Source of truth:** `docs/01-roadmap/roadmap.md`

This document records all changes made to the roadmap documents in this update session, based on `roadmap-prioritization-updates.md` and reconciliation between `roadmap.md` and `roadmap-gpt.md`.

---

## Changes to roadmap.md

### Sprint 2 — Expanded with Platform Foundation track

**Before:** Sprint 2 contained only Commissioner (CT-001/002) and Product (IA-005/006) work.

**After:** Sprint 2 now has three explicit tracks:

| Track | Stories |
|---|---|
| Commissioner | CT-001 Control Center, CT-002 Audit Logging |
| Platform Foundation (schema-only) | MS-001 parentLeagueId, MS-002 rulesVersion, MS-003 scoringVersion |
| Product | IA-006 VP education, LC-002 VP standings UI, IA-005 8-team recommendation |

**Rationale (from `roadmap-prioritization-updates.md`):** MS-001/002/003 are schema decisions, not features. They become significantly more expensive after multiple seasons exist. Adding them before the first live league runs is the lowest-risk window.

**Sprint 2 exit criteria updated:** "schema is multi-season-ready before the first live league runs" added alongside the commissioner recovery criterion.

---

### Sprint 3 — Added AN-001 Core Event Tracking

**Before:** Sprint 3 contained Onboarding, Error Handling, Mobile, Notifications, and IA-011.

**After:** AN-001 Core Event Tracking (Registration, Login, League Created, League Joined, Draft Started, Draft Completed, Lineup Saved) added before the beta launch gate.

**Rationale:** A beta without analytics generates opinions, not evidence. Instrumentation must exist before external users touch the product.

---

### Sprint 4+ — Transaction ordering corrected

**Before:** Trade System → Transaction History → Waivers → FAAB

**After:** Transaction History → Trade System → Waivers → FAAB

**Rationale:** Transaction History is infrastructure (it records all moves — adds, drops, waivers, trades). The Trade System is a feature built on top of that infrastructure. Building the Trade System first creates backward-migration work to slot history in later.

---

### "What To Build Next" — Transaction ordering corrected

Same reordering as Sprint 4+. Item #9 is now Transaction History, item #10 is Trade System.

---

### Beyond MVP — Multi-Season Foundation description updated

**Before:** "Off-season 2027: Multi-Season Foundation (parentLeagueId, rules/scoring versioning, season renewal, league history)"

**After:** "Off-season 2027: Multi-Season UX layer — Season Renewal flow, League History views, Hall of Fame, Player Legacy. **The schema foundation was laid in Sprint 2.**"

---

### Phase 5 #33 — Status updated

Clarified that MS-001/002/003 schema is Sprint 2 work; the renewal UX and history views are Phase 5 post-MVP.

---

### Docs path fixed

`docs/backlog/implementation-alignment.md` → `docs/03-validation/implementation-alignment/audit.md` (correct path after documentation reorganization).

`docs/implent-parentleagueid.md` → `docs/06-architecture/implement-parentleagueid.md`

---

## Changes to roadmap-gpt.md

roadmap-gpt.md was significantly out of date. Full rewrite to align with roadmap.md.

| Area | Before | After |
|---|---|---|
| IA-001/002/003 | Shown as open P0 work | Marked ✅ DONE with resolution details |
| LC-001 | Missing | Added as ✅ DONE |
| LC-003 | Missing | Added as ✅ DONE |
| Sprint naming | Sprint A / B / C | Sprint 0 / 1 / 2 / 3 matching roadmap.md |
| Sprint 0 / 1 | No history | Marked COMPLETE with outcomes |
| MS-001/002/003 | Phase 4 (post-MVP) | Promoted to Sprint 2 platform foundation track |
| AN-001 | Missing | Added to Sprint 3 |
| Transaction ordering | Trades before history | History before trades |
| Confidence score | Missing | ~85–90% with per-area scorecard |
| Launch checklist | Conceptual | Updated with ✅ / ☐ per current status |
| High-risk areas | Listed "Rules/Implementation Drift" as open | Removed; replaced with "Commissioner Recovery" and "Multi-Season Schema" (both closing in Sprint 2) |

---

## Items NOT changed

Per `roadmap-prioritization-updates.md` recommendation to leave these in place:

- Sprint 0 and Sprint 1 position and contents (both complete)
- Sprint 3 position (beta readiness — remains a launch gate)
- Notifications, Mobile Optimization, Error Handling in Sprint 3
- Phase 0 ordering (IA-004 still the one remaining P0)

---

## IA-004 sprint assignment (Jun 12, 2026)

**IA-004 — Fantasy Season Ends Before PWHL Playoffs** → **Sprint 2, Commissioner track**

Rationale: IA-004 is P0 (launch-blocking). Schedule generation is a commissioner setup action, so it belongs in the commissioner sprint (Sprint 2) alongside CT-001/002. Leaving a P0 in Sprint 3 risks it being dropped if Sprint 3 compresses. Sprint 2 exit criterion updated to include "schedule generator cannot produce a PWHL-overlapping fantasy season."
