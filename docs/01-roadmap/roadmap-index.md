# PWHL GM Product Roadmap — Index

Last Updated: June 23, 2026 (Sprint 21 COMPLETE — Living League: Weekly Delight; Sprint 22 PLANNED — Inviting Dark Redesign; Sprints 23–27 Living League arc planned)

---

## What Is This?

This document serves as the source of truth for future development priorities. Detailed feature cards live in [roadmap-features.md](roadmap-features.md); sprint plans and history live in [roadmap-sprints.md](roadmap-sprints.md).

**When choosing what to build next:**

1. Prioritize unfinished items in the current phase before moving to later phases.
2. Favor user-facing functionality over technical optimization unless stability is at risk.
3. Build for the live season first. Historical Replay is a testing/QA tool, not the product — don't let replay requirements shape or slow down live-season features.
4. New features should not break replay mode, but they do not need to be designed around it.

---

## Product Vision

PWHL GM is the premier fantasy platform for Professional Women's Hockey League fans.

The flagship experience is the live fantasy season: drafting real players, setting weekly lineups, and competing in matchups scored from real PWHL games.

The platform should support:

- Live fantasy leagues (the core product)
- Commissioner customization
- Deep roster management
- Long-term league retention

Historical Replay is an internal/QA tool that lets us exercise the full season loop against completed seasons before live data exists. It is valuable for user testing and dev iteration, but it is not a user-facing flagship and should not be prioritized as one.

---

## Current State

Implemented systems include:

- Authentication & user accounts
- League creation & management (commissioner admin panel: team management, draft setup, season controls, announcements)
- Draft room (live WebSocket draft, queue, auto-draft, auto-escalation)
- Rosters & lineups (locking, play-lock rule, games-remaining badges, projected FPTS)
- Matchups (VTF regular season + 1v1 playoffs) & Matchup Center / Fantasy Home (hero scores, top performers, swing players, storyline chip, playing-tonight, roster breakdown)
- Projections & Win Probability engine
- Standings (with playoff race clinch/eliminate indicators)
- Playoffs (seeding, bracket, single-elimination, full playoff experience UX — bracket-as-primary-landing, elimination/clinch/champion activity events, champion banner, between-round lineup nudge)
- Historical Replay & Season advancement / lifecycle (gap-week handling fixed; "⏩ Sim to playoffs" button scores all remaining regular-season weeks in one click; replay league matchup generation & simulator scoring fixed commit 52ea547)
- Schedule management & scoring engine (VTF point scoring)
- Victory Point (VP) scoring model (win/placement bonuses, `homeVP`/`awayVP`)
- Free-agent add/drop (immediate)
- Live score polling (client-side refresh during active matchups)
- Season-long head-to-head (rivalry) records
- Commissioner Recovery Tools (force roster move, undo transaction, replace inactive manager)
- Commissioner Admin Center (audit log visibility, draft pause visibility, season renewal entry point)
- Draft Analytics (6 events instrumented)
- League Creation UX (8-team recommendation)
- In-app notifications (all three MVP-critical types)
- Founder Operations Console (`/founder/`) — cross-league monitoring, simulation launcher, end-to-end validator; `FOUNDER_EMAILS` env-var auth gate; no schema change
- Auto-Set Lineup (`#34`) — `computeOptimalLineup()` in `lib/lineup.ts`; staged save model; "Auto-set" button in lineup manager; FA suggestions API (`GET /api/leagues/[leagueId]/fa-suggestions`); playoff period fallback for games-remaining badges
- FA Schedule Awareness + Add & Slot (`#35`) — games-remaining "Wk" badge on every FA row (roster page); `AddAndSlotModal` lets managers immediately slot a new pickup into an active position after adding; locked FAs skip the modal
- Beta Feedback Infrastructure (`#36`) — in-app feedback widget (`components/FeedbackWidget.tsx`) mounted on all authenticated layouts; `POST /api/feedback` persists submissions; `GET /api/founder/feedback` + Founder Console feed table; `PATCH /api/founder/leagues/[leagueId]/beta-status`; `FeedbackSubmission` model + `FeedbackType` / `BetaStatus` enums + `betaStatus` on `FantasyLeague`
- Pre-Beta Code Audit + P0/P1 Fixes (`#37`) — staff-engineer-level audit complete (`docs/04-operations/pre-beta-audit.md`); all P0 + P1 findings resolved: renewal atomicity (`$transaction`), draft pick P2002 handling, `onTimeout()` re-entrancy guard, force-move play-lock enforcement (both paths), playoff scoring documented, undo-waiver P2002 → 409. Go/No-Go: ✅ GREEN
- Waiver Wire System (`#5`) — full waiver layer on top of instant add/drop: rolling priority order (reverse VP-standings), 48h waiver window for dropped players, daily batch processing. Schema: `WaiverEntry` / `WaiverClaim` / `WaiverPriority` models + `WaiverStatus` enum + 4 new `EventType` values + `waiverWindowHours` on `FantasyLeague`. Service: `lib/services/waiver-service.ts` (`initializeWaiverPriority`, `enterWaiverWire`, `submitClaim`, `processWaivers`). UI: `WaiverWirePanel.tsx` in roster page "Waiver Wire" tab; "On Waivers" badge in FA table. Ops: `scripts/process-waivers.ts` cron script + founder console trigger. 13 new tests (174 total). FAAB deferred to Sprint 7.
- League-Wide Matchup Storylines (`#11`) — auto-generated weekly highlight cards on the league overview after each week scores. `lib/services/storyline-service.ts`: `computeWeeklyStorylines()` (pure, tested) + `emitWeeklyStorylines()` (IO, fire-and-forget from `advanceSeason()`). Three storyline types: `closest_match`, `high_score`, `player_standout`. `LEAGUE_STORYLINE` EventType in schema. `components/WeekHighlights.tsx` renders cards server-side on `/league/[leagueId]/`. 173-line test suite in `tests/storyline.test.ts`.
- Emotional Design System (Sprint 16) — matchup page emotional energy: score colors by win state (#34d399 green / #f87171 red), animated count-up (0→value over 1.2s), section heading hierarchy (14px normal vs 12px uppercase), Saira Condensed font loading from Google Fonts, RecapCard elevation (colored borders, contextual copy), card entrance animations (fadeSlideUp + stagger), win probability bar spring easing. Transforms "Bloomberg terminal" flatness into engaging sports product. Files: `app/globals.css` (font import + animations), `app/team/[teamId]/matchup/page.tsx` (score colors + RecapCard redesign + section headings), `components/ScoreDisplay.tsx` (count-up animation client component). No schema changes. 149 tests pass.

These systems should be considered core platform functionality.

---

## MVP Readiness Scorecard

Snapshot of launch-blocking areas. **Confidence to launch: ~99%.**

| Area | Status | Blocker |
|---|---|---|
| League creation | ✅ PASS | — |
| Draft | ✅ PASS | reconnect ✅ · commissioner auth ✅ · auto-pick position-aware ✅ · duplicate-tab ✅ |
| Rosters | ✅ PASS | — |
| Weekly matchups | ✅ PASS | — |
| VP standings | ✅ PASS | — |
| Weekly lineup lock | ✅ PASS | — |
| Playoffs | ✅ PASS | PLAYOFF-BUG-001 fixed (commit b465423: `?? 6` → `?? 4` in bracket page); playoff period anchoring fixed for replay leagues |
| Commissioner tools | ✅ PASS | force move, undo transaction, replace manager, audit log all shipped |
| Notifications | ✅ PASS | all 3 MVP-critical types shipped (draft starting, on the clock, lineup incomplete) |
| Analytics | ✅ PASS | 6 events instrumented |
| End-to-end season sim | ✅ PASS | PLAYOFF-AUDIT-001 complete Jun 20 — script runs clean, 180/180 tests, tsc clean |

**All MVP gates clear.** Sprint 17 complete (Jun 22, 2026) — all P0 bugs fixed, UX polish shipped, DATA-002 script ready. Tests pass. Beta invites target: **Jul 7, 2026** (moved up from Jul 14).

---

## MVP Definition & Launch Gates

MVP proves a league can go **Create → Invite → Draft → Set Lineups → Compete → Make Playoffs → Crown Champion** with no commissioner intervention or database surgery. Full scope in `docs/mvp-definition.md`.

**In scope:** league create / config / invite · snake draft with timer + auto-pick + reconnect (8- and 10-team) · roster validation · weekly lineup lock + partial-week subs · hybrid H2H + VP standings · 4-team playoffs ending before PWHL playoffs · commissioner recovery tools (pause/resume draft, replace manager, force move, undo, audit log) · critical notifications (draft starting, on the clock, lineup incomplete).

**Out of scope for MVP:** trades, waivers, FAAB (may add pre-launch only if implementation risk is low) · keeper / dynasty · referral / growth loops · AI features · native apps.

**Launch gates — all must pass:** rules match implementation · draft reliability validated · VP standings validated · playoff qualification validated · end-to-end season simulation completed · commissioner recovery tools available.

---

## What To Build Next

Sprint 6 is complete (7/7). Sprint 7 is complete (3/4 items done — #11 Storylines ✅; #39 Replay Sim V2 UX ✅; PLAYOFF-AUDIT-001 ✅; #7 Trade System deferred; #38 Replay V2 deferred). Sprint 8 (Beta Hardening) is complete — all 14 items done. Sprint 9 (PWHL GM Rebrand) is COMPLETE — all 8 stories shipped: REBRAND-001/002/003/004/005/006/007/008 all done. The product is now fully rebranded as PWHL GM with 202/202 tests passing and zero "PWHL Fantasy" strings in the live UI.

**Sprint 10 (Beta Bug Sweep + Launch Polish) is COMPLETE (Jun 21, 2026).** 4 bugs from founding commissioner feedback plus 5 high-priority UX fixes: BF-003 activity feed raw type ✅; BF-004 UTIL slot error ✅; BF-005 draft false eviction ✅; BF-006 zero-games bench hint ✅; UX-001 landing trust copy ✅; UX-010 admin CTA gate ✅; UX-011 standings table headers ✅; UX-018 lineup instruction pre-draft ✅; UX-023 Trade Center no propose CTA ✅. BF-007 and UX-008 bumped to Sprint 11. Full plan in `roadmap-sprints.md`.

**Sprint 11a & 11b (UX Polish: Vocabulary + Navigation + Wizard + Empty States) is COMPLETE (Jun 21, 2026).** 24 total items: 11a shipped 8 P0/P1 items (UX-024–031); 11b shipped 16 P1/P2 items (UX-002–021, BF-007). League nav alignment, wizard layout, empty state copy, register copy, FA context banners, auth hydration nav — all done. Full plan in `roadmap-sprints.md`.

**Sprint 12 (Pre-Beta Polish) is COMPLETE (Jun 21, 2026).** Shipped: BF-004 lineup UTIL slot fix ✅; UX-043 landing page jargon reduction ✅; UX-039 Claim vs Add tooltips ✅; UX-038/040/042/044 UI polish ✅; DATA-002 roster update script ✅. **MVP readiness: ~99%.** All critical bugs cleared. DATA-002 script ready (waits on HockeyTech rosters). Beta invites target: Jul 7, 2026. Full plan in `roadmap-sprints.md`.

**Sprint 13 (UX Audit + Onboarding First-Run) is ABSORBED into Sprint 18.** Of the original 14 items, 3 shipped (BF-008 ✅, OB-001 ✅, OB-008 ✅ — via Sprint 15 batch commit 4b67b44). The remaining 11 items (BF-009, OB-002–007, OB-009, UX-046–048) are carried into Sprint 18 as the P0/P1 foundation. Sprint 13 is formally closed.

**Sprint 15 (Visual Design System Deep Pass) is COMPLETE (Jun 22, 2026).** 3 stories shipped: DS-001 homepage rewrite + sticky header ✅, DS-002 token sweep + emoji removal ✅, DS-003 league overview + WeekHighlights redesign ✅. Full plan in `roadmap-sprints.md`.

**Sprint 16 (Emotional Design Polish) is COMPLETE (Jun 22, 2026).** Matchup page emotional energy pass — score colors respond to win state (green if winning, red if losing), scores count-up animate on load (1.2s), section headings elevated from 12px uppercase to 14px normal for hierarchy, Saira Condensed font loads and applies to all scores, RecapCard styled with colored borders and contextual copy, card entrance animations with staggered delays, win probability bar animates with spring easing. Transforms the app from "Bloomberg terminal" to energetic sports product. Commits: 5ecc116 (main pass) + f1d576c (section headings + count-up). Full details in memory and `roadmap-features.md`.

**Sprint 17 (UX Polish — Agent Test Run Fixes) is COMPLETE (Jun 22, 2026).** All 9 items shipped: AG-001 LEAGUES page overhaul + `isPublic` schema field; AG-002 matchup page restructure (Z7 performers to Analysis tab, Z8/Z9 to league overview, FieldHero standings removed, "all set" lineup state); AG-003 FP/VP comprehension copy (VP bridge sentence, "vs the field" visible text, setup-phase "—" fix); AG-004 terminology standardization (FPts → FP, VpExplainer FP/VP sentence, slot legend, glossary open by default); AG-005 non-qualifying playoff empty state (eliminated teams see regular-season rank + bracket link); AG-006 renewal two-step confirmation + invite step; AG-007 pre-login UX improvements (plain-language features copy, Replay CTA, invite page draft date + explainer); AG-008 VP education reinforcement on FieldHero + dashboard card; AG-009 lineup lock contextual tooltip. Full plan in `roadmap-sprints.md`.

**Shipped (Sprint 6 — all complete):**
- **League Onboarding (#2)** · ✅ Welcome flow, 6-step wizard, manager draft prep guide; `User.onboardingCompletedAt` schema field. (Sprint 3)
- **Transaction History (#8)** · ✅ Paginated API + page with type/team filters, replay guard, infinite scroll. (Sprint 3)
- **Auto-Set Lineup (#34)** · ✅ `computeOptimalLineup()`, staged save model, FA suggestions API, playoff period fallback. (Sprint 6)
- **FA Schedule Awareness + Add & Slot (#35)** · ✅ Games-remaining badge on FA panel; `AddAndSlotModal` for immediate active-slot pickup; locked FAs skip modal; bonus lineup nudge + alert fixes. (Sprint 6, commit 6a6b40f)
- **Beta Feedback Infrastructure (#36)** · ✅ `components/FeedbackWidget.tsx` on all authenticated layouts; `POST /api/feedback`; Founder Console feed + per-league beta status management; `FeedbackSubmission` / `FeedbackType` / `BetaStatus` schema additions. (Sprint 6)
- **Replay League Bug Fix** · ✅ Auto-start season after draft completes, fix simulator endpoint routing, update test mocks. Replay feature now works end-to-end. (Sprint 6, commit 52ea547)
- **Team Analysis & Insights (#25)** · ✅ `lib/services/analysis-service.ts` (`getTeamAnalysis()`); `components/MatchupTabs.tsx` + `AnalysisTab.tsx`; `app/api/leagues/[leagueId]/analysis/route.ts`; player hot/cold trends, position-group vs league median, FA upgrade cards for weakest group. Trade suggestions scoped out (deferred to Trade System #7). (Sprint 6)
- **Waiver Wire System (#5)** · ✅ Rolling priority order, 48h waiver window, batch processing. `WaiverEntry` / `WaiverClaim` / `WaiverPriority` schema; `lib/services/waiver-service.ts`; `WaiverWirePanel.tsx` in roster page; cron script + founder console trigger; 13 new tests (174 total). FAAB deferred to Sprint 7. (Sprint 6)
- **Replay Season Simulator v2 — UX Overhaul (#39)** · ✅ Week-by-week progression with lineup pause points; persistent controls on league overview (sticky footer) + commissioner matchup page (inline panel); smart button set based on season state; no schema changes. (Sprint 7, commit 5f501c8)

**Immediate — P0 + P1 fixes: RESOLVED ✅ (shipped Jun 20, ahead of Sprint 8 schedule)**

The staff-level code audit (Sprint 6, #37) returned a GO TO BETA verdict with ~8h of P0/P1 fixes
required before real users are invited. All items were applied immediately after Sprint 6 completion:

- **P0-1 Waiver cron** ✅ — `app/api/cron/process-waivers/route.ts` + `vercel.json` cron at 03:00 ET daily. Auth-gated by `CRON_SECRET` header. Ops: env var must be confirmed set in Vercel before launch.
- **P0-2 Auto-set projection safety** ✅ — projection fetch error-handled in `lineup/page.tsx`; `projectionsAvailable` prop disables button when unavailable.
- **P0-3** ✅ — verified: `startSeason()` calls `initializeWaiverPriority()` for all leagues. No change.
- **P1-A** ✅ — `AnalysisTab` shows "Analysis data unavailable. Try refreshing." on null.
- **P1-B** ✅ — `computeOptimalLineup()` falls back to `gamesThisPeriod` when `projectedFp` all null.
- **P1-C** ✅ — `AddAndSlotModal` shows "roster is full, drop a player first" at capacity.
- **P1-E** ✅ — `WaiverWirePanel` two-step inline confirm before cancel.
- **P1-F** ✅ — verified: `getTeamAnalysis()` already fetches fresh `scoringSettings`. No change.
- **174/174 tests pass.** Zero new TypeScript errors.

---

## Launch Gates (Beta → Public Launch)

These six gate categories must all be GREEN before public launch (~early Nov 2026). Sprint 18 includes tasks that advance GATE-1 through GATE-6. Detailed gate tasks in `roadmap-sprints.md`.

| Gate | Category | Status | Notes |
|---|---|---|---|
| GATE-1 | Security Review (internal) | TODO | OWASP Top 10 audit, auth/authz guard coverage, input validation, cookie settings |
| GATE-2 | Load Test — Draft Room | TODO | 20–30 concurrent drafts, 80–240 WebSocket connections, cold-start validation |
| GATE-3 | Ops Readiness | TODO | `CRON_SECRET` in Vercel prod, waiver cron confirmed, error monitoring, DB backup |
| GATE-4 | Data Readiness | TODO | 2026-27 regular season schedule ingested, 12-team rosters synced, periods generated |
| GATE-5 | Beta Quality Bar | TODO | ≥3 weeks beta, all P0 bugs resolved, onboarding flow ≥3 new users unassisted |
| GATE-6 | End-to-End Integration | TODO | simulate-season.ts re-run, waivers E2E, trades E2E, playoff flow E2E |

Beta invite date: **Jul 7, 2026.** Public launch: **quality-driven** (target early Nov 2026 with PWHL opener). Scale target: 50–200 leagues, 20–30 concurrent drafts.

---

## Completed Sprints (7–20)

All sprints from 7–20 are complete and shipped. Sprint 13 is formally absorbed into Sprint 18 (3/14 shipped via Sprint 15 batch; 11 carry-forwards). Detailed plans in `roadmap-sprints.md`.

- **Sprint 7** ✅ — Retention Layer (Trade System, Storylines, Replay Sim v2 UX)
- **Sprint 8** ✅ — Beta Hardening (14/14 audit fixes + beta bugs)
- **Sprint 9** ✅ — PWHL GM Rebrand (8/8 stories, fully rebranded)
- **Sprint 10** ✅ — Beta Bug Sweep + Launch Polish (5 P0/P1 bugs, founding beta ready)
- **Sprint 11a & 11b** ✅ — UX Polish (24 items: vocab, nav, wizard, empty states)
- **Sprint 12** ✅ — Pre-Beta Polish (5 items: BF-004, UX-043/039/038/040/042/044, DATA-002)
- **Sprint 13** ✅ ABSORBED — 3/14 shipped (BF-008, OB-001, OB-008); 11 items carried to Sprint 18
- **Sprint 14** ✅ — Post-Launch Polish + Emotional Engagement (11/12; OB-010, UX-049, UX-050, UX-033 shipped; UX-045 deferred; Jun 22, 2026)
- **Sprint 15** ✅ — Visual Design System Deep Pass (3 stories: DS-001/002/003; Jun 22, 2026)
- **Sprint 16** ✅ — Emotional Design Polish (score colors, count-up animation, Saira Condensed font, RecapCard elevation; Jun 22, 2026)
- **Sprint 17** ✅ — UX Polish: Agent Test Run Fixes (9/9 items: LEAGUES overhaul, matchup restructure, FP/VP copy, terminology, playoff eliminated empty state, renewal confirmation, pre-login UX, VP education, lock tooltip; Jun 22, 2026)
- **Sprint 18** ✅ — Beta Operations + Onboarding Repair (24/24 items: BLR-001/002, Sprint 13 carry-forwards, ops gates GATE-1/2/3 PASS; Jun 23, 2026)
- **Sprint 19** ✅ — IA Restructure: Franchise-First Nav + DnD Lineup (5/5 parts: emoji policy, Trades→My Franchise, league overview commissioner-only, DnD lineup on roster, commissioner god-mode; Jun 23, 2026)
- **Sprint 20** ✅ — VTF Navigation Rename (2/2 items: BF-018 league nav "Schedule"→"Results", UX-049 team nav "Schedule"→"My Season"; Jun 23, 2026)
- **Sprint 21** ✅ — Living League: Weekly Delight (5/5 stories: LL-001 Weekly Awards Ceremony, LL-002 Momentum Strip data layer, LL-003 Animated Stat Chips, LL-017 Plain-Language Explainers, LL-018 Negative Award Tone Calibration; Jun 23, 2026)

**Current Status:** Sprint 21 COMPLETE (Jun 23, 2026) · **Sprint 22 PLANNED** — "Inviting Dark" Redesign · Sprints 23–27 Living League arc planned · MVP readiness ~99%

**Sprint 14 (Post-Launch Polish + Emotional Engagement) is COMPLETE (Jun 22, 2026).** 11/12 items shipped: all 5 agent integration test findings (DRC-002, BF-010, BF-011, TR-002, TR-003) ✅; OB-010 wizard Replay progress bar ✅; UX-049 "Free Agents" direct TeamNav link ✅; UX-050 "Win Probability" label in DuelHero ✅; UX-033 setup-phase copy "Games starting soon" ✅; UX-032 edge label ✅; OB-011 draft date picker text ✅. UX-045 (rival win celebration) deferred post-launch — requires schema migration (`RIVALRY_WIN` enum) which carries pre-launch risk. First item in Sprint 17 backlog.

**Sprint 18 (Beta Operations + Onboarding Repair) is COMPLETE (Jun 23, 2026).** All 24 items shipped across 5 tracks: BLR-001/002, Sprint 13 carry-forwards, new live feedback bugs, ops gates, and ad-hoc beta fixes. GATE-1 ✅ GATE-2 ✅ GATE-3 ✅ all pass. Beta invites target: Jul 7, 2026. Full plan in `roadmap-sprints.md`.

**Sprint 19 (IA Restructure: Franchise-First Nav + DnD Lineup) is COMPLETE (Jun 23, 2026).** All 5 parts shipped: Part 1 emoji policy + colorblind chip fix; Part 2 Trades→My Franchise routes + TeamNav restructure; Part 3 league overview redirect to commissioner-only; Part 4 DnD lineup management consolidated onto the roster page; Part 5 commissioner god-mode access to any team's lineup. No schema changes. Full plan in `roadmap-sprints.md`.

**Sprint 20 (VTF Navigation Rename) is COMPLETE (Jun 23, 2026).** 2 items shipped: BF-018 renamed the league nav "Schedule" tab to "Results" and added a VTF explainer subtitle (commit ad4185a); UX-049 renamed the team nav "Schedule" tab to "My Season" and updated the "Your Players This Week" section heading. No schema changes.

**Sprint 21 (Living League: Weekly Delight) is COMPLETE (Jun 23, 2026).** 5/5 stories shipped: LL-001 Weekly Awards Ceremony (`computeWeeklyAwards()` + `emitWeeklyAwards()` in `lib/services/storyline-service.ts`, `WeekHighlights.tsx` award cards with icon + color-coded borders + recovery CTA links); LL-002 Momentum Strip data layer (`scoreDeltaSinceYesterday`, `playersRemainingTonight`, `opponentFinished` added to `ActiveMatchup` in `getDashboardData` — visual component `MomentumStrip.tsx` ships Sprint 22 RD-008); LL-003 Animated Stat Chips (`StatChip.tsx` with `chipPulse` CSS animation, `computeStatChips()` in `dashboard.ts`, rendered in matchup page Z6); LL-017 Plain-Language Explainers (`lib/copy/living-league-glossary.ts` single source of truth, `InfoTooltip.tsx` with ≥44px touch target + aria-accessible); LL-018 Negative Award Tone Calibration (`showNegativeAwards` toggle in `scoringSettings` JSON, `NegativeAwardsToggle.tsx` in admin panel, `PATCH /api/leagues/[leagueId]/settings`). No schema changes. 6 commits.

**Sprint 22 (Inviting Dark Redesign) is PLANNED.** 12 stories (RD-001–RD-012) covering the "Inviting Dark" color system, inline hex sweep, emoji policy restoration, VP popover fix, Create League Wizard rebuild, league overview and team matchup flagship redesigns, remaining page recolor sweep, Momentum Strip visual (completing LL-002), prestige gradient, gold prestige moments, empty state personality copy, and wizard summary panel. No schema changes. Spec authority: `docs/branding/pwhl_redesign_bundle_v3_1.zip`. Full plan in `roadmap-sprints.md`.

**Living League Arc (Sprints 23–27) is PLANNED.** Source: `docs/01-roadmap/living-league-product-strategy.md` + `docs/01-roadmap/living-league-roadmap.md`. Evolves PWHL GM from "fantasy hockey software" into a living league that remembers, celebrates, and tells stories. 7 total sprints (21–27):
- Sprint 21 — Weekly Delight (awards, momentum, stat chips) ✅ COMPLETE
- Sprint 22 — Inviting Dark Redesign (design system)
- Sprint 23 — The Race (magic number, clinch moments, bubble watch, upset tracker)
- Sprint 24 — Season Story (timeline, record book, franchise identity, manager superlatives)
- Sprint 25 — Legacy (trophy cabinet, opening day card, championship banner)
- Sprint 26 — The Morning Skate (weekly league newsletter, own nav entry, archive page)
- Sprint 27 — League Hub (assemble all systems into franchise home page)

Full feature cards: `roadmap-features.md` Phase 9 (LL-001 through LL-016).

**Post-Launch Backlog:** FAAB (#6 — defer to 2027-28 when commissioners request), Growth analytics (GR-001/002/003/004), push notifications, multi-season library (#12), player trends (#23), keeper/dynasty (#19/#20), native apps, AI features, IA reorg (League vs Franchise nav split suggestions from beta feedback). See `roadmap-sprints.md` for details.

---

## See Also

- [roadmap-features.md](roadmap-features.md) — all feature cards (Phases 0–7), full specifications
- [roadmap-sprints.md](roadmap-sprints.md) — sprint plans, sprint history, launch timeline
- [CLAUDE.md](../../CLAUDE.md) — codebase reference and engineering guidelines
