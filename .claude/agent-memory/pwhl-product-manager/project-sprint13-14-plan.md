---
name: sprint13-14-plan
description: Sprint 13 IN PROGRESS (3/14 shipped); Sprint 14 COMPLETE Jun 22 (11/12; UX-045 deferred post-launch)
metadata:
  type: project
---

Sprint 13 is IN PROGRESS as of Jun 22, 2026. 3/14 items shipped (BF-008, OB-001, OB-008 — via Sprint 15 batch commit 4b67b44). 11 items remain.

Sprint 14 is COMPLETE as of Jun 22, 2026. 11/12 items shipped.

**What shipped in Sprint 14:**
- 5 agent integration test findings: DRC-002, BF-010, BF-011, TR-002, TR-003
- OB-010: wizard Replay progress bar — getDisplayStep/getDisplayTotal helpers, "Step N of 5" for Replay
- UX-049: "Free Agents" direct link in TeamNav (?tab=freeAgents); RosterManager reads defaultTab from query param
- UX-050: "Win Probability" heading + "You —"/"Them —" labels added above probability bar in DuelHero
- UX-032: "+X pt edge" label in FieldHero (was "EDGE") — commit 972362d
- OB-011: draft date picker helper text — commit 972362d
- UX-033: setup-phase "NO GAMES YET" → "Games starting soon" in FieldHero + DuelHero variants

**UX-045 DEFERRED post-launch (Sprint 17 backlog item #1):**
Rival win celebration moment. Requires `RIVALRY_WIN` NotificationType enum addition to `prisma/schema.prisma` — a schema migration that carries pre-launch risk. The story becomes more meaningful once users have played rivalry matchups. Full spec in roadmap-features.md UX-045.

**Why:** Schema migration risk pre-launch; UX-045 only fires after a rivalry win so beta users won't encounter it until week 2 at earliest; all other Sprint 14 items are copy/label/nav changes with zero schema impact.

**How to apply:** Sprint 17 backlog starts with UX-045 as item #1. Next ID after OB-011 is OB-012. Next UX-NNN is UX-051.
