---
name: sprint20-and-sprint22
description: Sprints 20–27 COMPLETE; Sprint 27 shipped Jun 24 (11/11 items: BF-022/023/025/026/028 + LL-024 + LL-022 Phase 1+2 + VTF subtitle + LL-016 partial); Sprint 28 (Morning Skate) is next
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

Sprint 25 (Living League: Legacy + Carry-Forwards) is COMPLETE (commit ab44083). 6/6 stories:
- LL-009: Trophy Cabinet — `Trophy` model + `TrophyType` enum in schema; `lib/services/trophy-service.ts`; `TrophyCard.tsx` + `TrophyShelf.tsx`; `/team/[teamId]/trophies/page.tsx`; trophy icons in matchup page Z2
- LL-011b: Franchise Archetypes — `lib/services/franchise-identity.ts`; `FranchiseIdentityChip.tsx` in matchup page Z2
- LL-014: Opening Day Card — `OpeningDayCard.tsx`; Week 1 only; localStorage dismiss
- LL-015: Championship Banner — `ChampionshipBanner.tsx`; triggered by `CHAMPIONSHIP_WON` notification
- UX-058: Trade Proposal 4-Step — `ProposeTrade.tsx` 4-step state machine in `app/league/[leagueId]/trades/new/`
- BF-020: Auto-draft position balance — Tier 1b in `bestAvailablePlayerIds()` in `lib/draft/server.ts`

Schema note: model is `Trophy` (not `Achievement`); `TrophyType` enum with values including CHAMPION.

Sprint 26 (Beta Defect Sweep) is COMPLETE. BF-024 and BF-027 handled by parallel agents. BF-022/023/025/026/028 resolved in Sprint 27. BF-012, BF-013, BF-021 remain open.

Sprint 27 (Polish & The Arena Concourse) is COMPLETE — Jun 24, 2026. 11/11 items:
- Track A — Bug Fixes: BF-022 (BottomNav desktop hidden), BF-023 (FA adds in transaction history), BF-025 (trade position filter — no code change), BF-026 (standings contrast), BF-028 (commissioner pending trade dashboard visibility)
- Track B — Hub Assembly: LL-024 (new `/league/[leagueId]/how-it-works` page; 6 sections; nav link), LL-022 Phase 1 (stat tooltips via `components/StatTooltip.tsx`; `SortTh` title props in `RosterManager.tsx`; `tooltip` field in `DraftRoom.tsx`), LL-022 Phase 2 ("How it works →" link on standings page), VTF subtitle update, LL-016 partial (records teaser + trophy leaderboard in commissioner overview)
- No schema changes in Sprint 27

**Sprint 28 (The Morning Skate — LL-013) is next.** Requires schema migration (`MorningSkateEdition` model). Open bugs still in backlog: BF-012, BF-013, BF-021. Next new BF ID: BF-029.
