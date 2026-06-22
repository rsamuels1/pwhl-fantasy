---
name: sprint17-agent-test-fixes
description: Sprint 17 COMPLETE — UX Polish from 4-agent parallel test run; all 9/9 items AG-001–AG-009 shipped Jun 22, 2026; schema: isPublic on FantasyLeague
metadata:
  type: project
---

Sprint 17 is COMPLETE as of Jun 22, 2026. Source: `docs/03-validation/agent-run-findings-2026-06-22.md` — 4-agent parallel UX test run found 6 Blockers, 13 Friction, 5 Minor items. All 9 items shipped.

**P0 items shipped:**
- AG-001: LEAGUES page overhaul + `FantasyLeague.isPublic Boolean @default(false)` schema field; public/private toggle in wizard + admin panel
- AG-002: Matchup page restructure — Z7 (performers) to Analysis tab; Z8 (league leaders) + Z9 (activity feed) to league overview; FieldHero standings removed; "all set" lineup state added
- AG-003: FP/VP comprehension copy — VP bridge sentence in dashboard MatchupHero; FieldHero "vs the field" as visible text; setup-phase "0.0" → "—" on dashboard card
- AG-004: Terminology — FPts → FP in all stat tables; VP/FP bridge sentence in VpExplainer; slot legend on lineup page; draft glossary open by default
- AG-005: Playoff eliminated empty state — detect `playoffStatus===IN_PROGRESS` + team not in playoff matchup; show "You finished Nth" + bracket link (not "Season hasn't started")
- AG-006: Renewal two-step confirmation in `RenewLeagueForm.tsx` + post-renewal invite link display

**P1 items shipped:**
- AG-007: Pre-login UX — plain-language features subcopy; "Try a Replay" CTA on landing + login/register; invite page shows draft date + fantasy explainer
- AG-008: VP education reinforcement — compact "How VP works" callout in FieldHero + dashboard action card
- AG-009: Lineup lock tooltip — contextual explanation of why player is locked, hover/tap accessible

**Schema change shipped:** `FantasyLeague.isPublic Boolean @default(false)` — for AG-001 open-league directory.

**Why:** UX test run exposed new users can't connect FP to VP, eliminated teams saw a misleading pre-draft empty state, and leagues discovery had no hook. All 6 Blockers closed before beta invites.

**How to apply:** All AG-NNN items are done. Next story ID after this sprint is AG-010. The `isPublic` schema field is the only new DB migration in this sprint.

[[sprint13-14-plan]]
