---
name: sprint20-and-sprint22
description: Sprint 20 VTF nav rename (COMPLETE), Sprint 21 Living League Weekly Delight (COMPLETE), Sprint 22 Inviting Dark redesign (PLANNED)
metadata:
  type: project
---

Sprint 20 (VTF Navigation Rename) is COMPLETE as of Jun 23, 2026. 2 items:
- BF-018 (P1, S): League nav "Schedule" tab renamed to "Results" + VTF explainer subtitle added — commit ad4185a
- UX-049 (P2, S): Team nav "Schedule" renamed to "My Season" + "Your Players This Week" section heading updated

No schema changes.

Sprint 21 (Living League: Weekly Delight) is COMPLETE as of Jun 23, 2026. 5/5 stories, 6 commits, no schema changes:
- LL-001 (P1, M): Weekly Awards Ceremony — `computeWeeklyAwards()` pure function + `emitWeeklyAwards()` IO layer in `lib/services/storyline-service.ts`; 5 awards (ice_cold_closer, heater, heartbreaker, collapse, frozen_stick); called fire-and-forget from `advanceSeason()`; `WeekHighlights.tsx` renders award cards with icon, color-coded borders, recovery CTA links for negative awards
- LL-002 (P1, S): Momentum Strip data layer — `scoreDeltaSinceYesterday`, `playersRemainingTonight`, `opponentFinished` added to `ActiveMatchup` in `lib/services/dashboard.ts`; visual `MomentumStrip.tsx` deferred to Sprint 22 RD-008
- LL-003 (P2, S): Animated Stat Chips — `StatChip` type + `chips: StatChip[]` on `PlayerMatchupRow`; `computeStatChips()` in `dashboard.ts`; `StatChip.tsx` with `chipPulse` CSS animation; renders in matchup page Z6 RosterTable
- LL-017 (P1, S): Plain-Language Explainers — `lib/copy/living-league-glossary.ts` single source of truth; `InfoTooltip.tsx` client component, 44px touch target, aria-accessible
- LL-018 (P1, S): Negative Award Tone Calibration — recovery CTAs on heartbreaker/collapse/frozen_stick; `showNegativeAwards` toggle in `scoringSettings` JSON (no schema migration); `NegativeAwardsToggle.tsx` in admin panel; `PATCH /api/leagues/[leagueId]/settings`

**Why:** Sprint 21 was the first sprint of the Living League arc (Sprints 21–27). LL-002's visual component was intentionally split — the data layer ships here; `MomentumStrip.tsx` builds in Sprint 22 alongside the Inviting Dark redesign (RD-008) so both use the same design tokens.

Sprint 22 (Inviting Dark Redesign) is PLANNED. 19 stories: RD-001–RD-012 (original) + 7 carry-ins from Sprint 19 Playwright walkthrough:
- RD-001 (P1, S): Token swap — replace :root with Inviting Dark tokens
- RD-002 (P1, M): Inline hex sweep across app/** + components/**
- RD-003 (P1, S): Emoji policy restoration (tiered — Tier 1 yes, Tier 2 no)
- RD-004 (P1, L): VP popover fix + Create League Wizard rebuild
- RD-005 (P1, L): League overview flagship redesign
- RD-006 (P1, L): Team matchup flagship redesign
- RD-007 (P1, L): Remaining page recolor sweep (page-inventory.md)
- RD-008 (P1, M): Momentum Strip component (MomentumStrip.tsx) — completes LL-002
- RD-009 (P2, S): Prestige gradient token (--prestige-gradient)
- RD-010 (P2, M): Gold prestige moments (--gold on 5 surfaces only)
- RD-011 (P2, S): Empty state personality copy
- RD-012 (P2, M): Wizard "Your league at a glance" summary panel
- BF-018 (P1, S): /league-rules 404 fix (carry-in; separate from the Sprint 20 nav-rename that also used BF-018)
- UX-051 (P1, S): VP popover overflow on mobile wizard Rules step (handled alongside RD-004)
- UX-052 (P1, M): Invite landing plain-language fantasy primer for cold users
- UX-057 (P1, M): Wizard Rules step jargon wall — inline PPP + UTIL definitions (alongside RD-004)
- UX-054 (P2, S): Replay CTA landing page context subtitle
- UX-055 (P2, S): Wizard step count shown before step 1
- UX-056 (P2, S): Commissioner draft checklist plain-language primer

No schema changes. Pure UI/CSS + copy sprint.

Spec authority: `docs/branding/pwhl_redesign_bundle_v3_1.zip`

**How to apply:** Next RD-NNN is RD-013. Sprint 22 supersedes any prior design work on these surfaces — check zip for reference files before speccing any UX changes to league overview, matchup, or wizard. The BF-018 ID was reused in Sprint 20 for a different item (nav rename); the open /league-rules 404 is the original Playwright-walkthrough BF-018 and is still open in Sprint 22.
