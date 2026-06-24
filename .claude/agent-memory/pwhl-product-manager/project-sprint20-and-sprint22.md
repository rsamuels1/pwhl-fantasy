---
name: sprint20-and-sprint22
description: Sprint 20/21/22/23/24 COMPLETE; Sprint 24 5/7 (LL-006/010/011/012/023 DONE; UX-058+BF-020 deferred to Sprint 25); Sprint 25 now current
metadata:
  type: project
---

Sprint 20 (VTF Navigation Rename) is COMPLETE as of Jun 23, 2026. 2 items:
- BF-018 (P1, S): League nav "Schedule" tab renamed to "Results" + VTF explainer subtitle added — commit ad4185a
- UX-049 (P2, S): Team nav "Schedule" renamed to "My Season" + "Your Players This Week" section heading updated

No schema changes.

Sprint 21 (Living League: Weekly Delight) is COMPLETE as of Jun 23, 2026. 5/5 stories, 6 commits, no schema changes:
- LL-001 (P1, M): Weekly Awards Ceremony — `computeWeeklyAwards()` pure function + `emitWeeklyAwards()` IO layer in `lib/services/storyline-service.ts`; 5 awards (ice_cold_closer, heater, heartbreaker, collapse, frozen_stick); called fire-and-forget from `advanceSeason()`; `WeekHighlights.tsx` renders award cards with icon, color-coded borders, recovery CTA links for negative awards
- LL-002 (P1, S): Momentum Strip data layer — `scoreDeltaSinceYesterday`, `playersRemainingTonight`, `opponentFinished` added to `ActiveMatchup` in `lib/services/dashboard.ts`; visual `MomentumStrip.tsx` shipped Sprint 22 RD-008 — COMPLETE
- LL-003 (P2, S): Animated Stat Chips — `StatChip` type + `chips: StatChip[]` on `PlayerMatchupRow`; `computeStatChips()` in `dashboard.ts`; `StatChip.tsx` with `chipPulse` CSS animation; renders in matchup page Z6 RosterTable
- LL-017 (P1, S): Plain-Language Explainers — `lib/copy/living-league-glossary.ts` single source of truth; `InfoTooltip.tsx` client component, 44px touch target, aria-accessible
- LL-018 (P1, S): Negative Award Tone Calibration — recovery CTAs on heartbreaker/collapse/frozen_stick; `showNegativeAwards` toggle in `scoringSettings` JSON (no schema migration); `NegativeAwardsToggle.tsx` in admin panel; `PATCH /api/leagues/[leagueId]/settings`

**Why:** Sprint 21 was the first sprint of the Living League arc (Sprints 21–27). LL-002's visual component was intentionally split — the data layer ships here; `MomentumStrip.tsx` builds in Sprint 22 alongside the Inviting Dark redesign (RD-008) so both use the same design tokens.

Sprint 22 (Inviting Dark Redesign) is IN PROGRESS. 8/23 stories shipped Jun 23, 2026. No schema changes.

**Shipped (Jun 23, 2026):**
- BF-018 (P1, S): /league-rules 404 fix — `app/league-rules/page.tsx` created; public static page, no auth, 5 sections (scoring, roster, draft, standings, playoffs); fixes WelcomeFlow and BetaWelcomeStep dead links
- RD-001 (P1, S): Token swap — :root in globals.css replaced with Inviting Dark / Northern Ice tokens; sky-blue accent #8fc1e8
- RD-002 (P1, M): Hex sweep — old violet/green/gold/red hex values replaced with CSS var() tokens across app/** + components/**; app/founder/ intentionally preserved
- RD-003 (P1, S): Emoji policy — tiered policy applied to activity feed labels and WeekHighlights award colors
- RD-004 (P1, L): VP popover + wizard rebuild — VpExplainer rebuilt with solid anchored popover + arrow caret; wizard Rules step replaced with rule-sheet card (roster pills, two-column scoring table); covers UX-051 + UX-057
- RD-007 (P1, L): Remaining recolor sweep — all remaining hardcoded hex values swept from dashboard, league layout, matchup, trades, draft, auth pages, shared components
- RD-008 (P1, M): MomentumStrip — `components/MomentumStrip.tsx` created; delta chip + players-tonight chip + opponent-done chip; wired above Z3 in active-period matchup page; completes LL-002
- UX-051 (P1, S): VP popover mobile fix — fixed via RD-004 (position:relative wrapper)
- UX-052 (P1, M): Invite landing primer — `app/invite/[leagueId]/page.tsx` "New to fantasy sports?" section; 4 plain-language steps
- UX-057 (P1, M): Wizard jargon wall — fixed via RD-004; PPP + UTIL get inline definitions in scoring table

**Still open (remaining Sprint 22):**
- RD-005 (P1, L): League overview flagship redesign per references/League Overview.dc.html
- RD-006 (P1, L): Team matchup flagship redesign per references/Team Matchup.dc.html
- RD-009 (P2, S): Prestige gradient token (--prestige-gradient)
- RD-010 (P2, M): Gold prestige moments (--gold on 5 surfaces only)
- RD-011 (P2, S): Empty state personality copy
- RD-012 (P2, M): Wizard "Your league at a glance" summary panel
- RD-014 (P2, M): Live Matchup Excitement Indicators (trend arrows + upset chip)
- RD-015 (P2, M): Settings editor rule-sheet restructure
- RD-016 (P2, S): Brand theme naming decision ("Northern Ice")
- RD-017 (P2, S): Emotional Design North-Star Principles doc
- UX-054 (P2, S): Replay CTA landing page context subtitle
- UX-055 (P2, S): Wizard step count shown before step 1
- UX-056 (P2, S): Commissioner draft checklist plain-language primer

Spec authority: `docs/branding/pwhl_redesign_bundle_v3_1.zip`

**How to apply:** P1 items within Sprint 22 are now complete. RD-005 and RD-006 flagship redesigns are the highest-value remaining P1 stories. Next RD-NNN is RD-018 (nothing assigned yet). The BF-018 ID was reused in Sprint 20 for a different item (nav rename); the /league-rules 404 fix is the original Playwright-walkthrough BF-018 and is now shipped in Sprint 22.

Sprint 23 (Living League: The Race) is COMPLETE. 7/7 stories shipped:
- LL-004: Magic Number — `computeRace()` + `magicNumber: number | null` + standings chip
- LL-005: Playoff Clinch Celebration — `emitClinchEvents()` + `ClinchBanner.tsx` (localStorage-gated)
- LL-007: Bubble Watch — `BubbleWatch.tsx` server component on standings page, 3 groupings
- LL-008: Upset Tracker — `lib/services/upset-service.ts` + `UpsetCard.tsx` on league overview sidebar
- LL-019: First-Result Explainer — `FirstResultContext` in `DashboardData` + `FirstResultCard.tsx` (localStorage-gated)
- LL-021: Small-Win Encouragement — `MilestoneToast.tsx`; lineup-complete + first-add toasts; localStorage-gated
- RD-013: Team Identity Colors — `FantasyTeam.accentColor String?` schema field + migration; `TeamColorPicker.tsx`; `PATCH /api/leagues/[leagueId]/teams/[teamId]/color`; avatar ring + name tint in DuelHero and standings

Schema migration: `FantasyTeam.accentColor String?` (RD-013). Commit: 6a959d9 (roadmap docs).

Sprint 24 (Living League: Season Story) is COMPLETE (5/7). No schema changes.
- LL-006: Season Timeline — `lib/services/timeline-service.ts` + `SeasonTimeline.tsx`; `/team/[teamId]/schedule` extended with W-L-T header; page title "My Season"
- LL-010: League Record Book — `/league/[leagueId]/records` page; `lib/services/superlatives.ts`; `components/SuperlativesCard.tsx`; "Records" in league nav
- LL-011 (partial): Team Name Editing only — `PATCH /api/leagues/[leagueId]/teams/[teamId]/name`; `components/TeamNameEditor.tsx`; archetype system (Boom or Bust etc.) deferred to Sprint 25 as LL-011b
- LL-012: Manager Superlatives — `lib/services/superlatives.ts`; 5 awards (Top Scorer, Feast or Famine, Steady Eddie, Hot Start, Strong Finish); `SuperlativesCard.tsx` in league overview sidebar + Analysis page gold callout
- LL-023: Empty States — personality copy across Trades (all 3 tabs), Transactions feed, Analysis page

Deferred to Sprint 25: UX-058 (Trade Proposal 4-Step), BF-020 (auto-draft position balance)

**Sprint 25 is now the current sprint.** It includes LL-009 (Trophy Cabinet, schema migration required), LL-011b (franchise archetypes), LL-014 (Opening Day Card), LL-015 (Championship Banner), UX-058 (Trade Proposal 4-Step), BF-020 (auto-draft balance).
