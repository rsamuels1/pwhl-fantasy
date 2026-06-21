---
name: sprint13-14-plan
description: Sprint 13 IN PROGRESS (14 items); Sprint 14 PLANNED (7 items incl. UX-045 rivalry celebration); emotional engagement story location confirmed
metadata:
  type: project
---

Sprint 13 is IN PROGRESS as of Jun 21, 2026. 14 items: 6 P0 (BF-008, BF-009, OB-001–004) and 8 P1 (UX-046–048, OB-005–009). Sprint 14 is PLANNED with 7 items.

**Why:** Roadmap audit Jun 21 found Sprint 13 still marked PLANNED; OB-001–009 were incorrectly assigned Sprint 12; ~20 features in backlog table were marked TODO when actually COMPLETE.

**How to apply:** When reviewing Sprint 13 status, check BF-008/009 (P0 bugs) and OB-001–004 (P0 wizard fixes) first — these are the ship-blockers. Sprint 14 carries the emotional engagement work (UX-045).

**Emotional engagement story location:** `docs/01-roadmap/roadmap-features.md`, UX-045 "No Celebration Moment When a Rivalry Matchup Is Won" (Sprint 14, P2). Requires `RIVALRY_WIN` NotificationType enum extension + `npx prisma db push`. The structural fix (UX-031, surfacing rival callout in hero) shipped in Sprint 11a; the celebration notification is the unshipped follow-through.

Sprint 14 items: OB-010 (wizard progress bar for replay, P1), UX-049 (free agents nav, P2), UX-050 (win prob labels, P2), OB-011 (draft date guidance, P2), UX-045 (rivalry win celebration, P2), UX-032 (EDGE jargon fix, P2), UX-033 (NO GAMES YET context, P2).

**Reclassification count from audit:** ~22 features marked DONE across all four roadmap files (previously TODO/Not Implemented/OPEN/PARTIAL): #1, #2, #3, #4, #5, #7, #8, #9, #10, #11, #13, #17, #24, #25, #26, #27, #28, #29, #30, #32, #34, #35, #36, #37 plus BF-003/004/005/006/007 and UX-024–031.
