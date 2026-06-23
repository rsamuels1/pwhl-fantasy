---
name: sprint13-14-plan
description: Sprint 13 ABSORBED (3/14 shipped, 11 carried to Sprint 18); Sprint 14 COMPLETE Jun 22 (11/12; UX-045 deferred post-launch)
metadata:
  type: project
---

Sprint 13 is ABSORBED as of Jun 22, 2026. 3/14 items shipped (BF-008, OB-001, OB-008 — via Sprint 15 batch commit 4b67b44). 11 items carried forward to Sprint 18.

Sprint 14 is COMPLETE as of Jun 22, 2026. 11/12 items shipped.

**Sprint 13 — shipped (3):**
- BF-008 (P0): Negative timestamps on transaction history — fixed in Sprint 15 batch
- OB-001 (P0): "Start Your Franchise" CTA routes to /register — fixed in Sprint 15 batch
- OB-008 (P1): Registration form show/hide password toggle; redundant confirm field removed — fixed in Sprint 15 batch

**Sprint 13 — carried to Sprint 18 (11):**
- BF-009 (P0): Analysis page navigation broken mid-season
- OB-002 (P0): Wizard Step 4 VP explanation missing
- OB-003 (P0): Wizard no warning before team-creation step
- OB-004 (P0): Canceling mid-wizard orphans league silently
- UX-046 (P1): Season series block renders twice on matchup page
- UX-047 (P1): Trade proposal has no trading-partner-first step
- UX-048 (P1): Trade form search hint hidden below player list
- OB-005 (P1): QuickDraftJoinForm on public home page
- OB-006 (P1): Replay mode description only appears after clicking option
- OB-007 (P1): Login page says "All 8 teams" (should be 12)
- OB-009 (P1): Wizard rules step shows no FP values

**What shipped in Sprint 14:**
- 5 agent integration test findings: DRC-002, BF-010, BF-011, TR-002, TR-003
- OB-010: wizard Replay progress bar — getDisplayStep/getDisplayTotal helpers, "Step N of 5" for Replay
- UX-049: "Free Agents" direct link in TeamNav (?tab=freeAgents); RosterManager reads defaultTab from query param
- UX-050: "Win Probability" heading + "You —"/"Them —" labels added above probability bar in DuelHero
- UX-032: "+X pt edge" label in FieldHero (was "EDGE") — commit 972362d
- OB-011: draft date picker helper text — commit 972362d
- UX-033: setup-phase "NO GAMES YET" → "Games starting soon" in FieldHero + DuelHero variants

**UX-045 DEFERRED post-launch:**
Rival win celebration moment. Requires `RIVALRY_WIN` NotificationType enum — schema migration risk. Sprint 17 backlog item #1.

**Why:** Sprint 13 had 14 items but the sprint was never formally started as a cohesive unit. 3 items got fixed in the Sprint 15 design pass batch. The other 11 were not yet touched and got absorbed into Sprint 18 (Beta Operations + Onboarding Repair) where they make up Track B.

**How to apply:** Next IDs: OB-012, UX-051, AG-010. Sprint 18 is IN PROGRESS as of Jun 22, 2026. BLR-001 shipped (commits cc77196 + ecc7290). BLR-002 (wizard welcome screen, copy TBD) is next P0 in Track A. See [[sprint18-plan]] for the full plan.
