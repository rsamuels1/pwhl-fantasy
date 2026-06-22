# PWHL GM Product Roadmap — Index

Last Updated: June 22, 2026

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

**All MVP gates clear.** Sprint 12 complete (Jun 21, 2026) — all P0 bugs fixed, UX polish shipped, DATA-002 script ready. 202 tests pass. Ready for beta launch Jul 14, 2026.

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

**Sprint 12 (Pre-Beta Polish) is COMPLETE (Jun 21, 2026).** Shipped: BF-004 lineup UTIL slot fix ✅; UX-043 landing page jargon reduction ✅; UX-039 Claim vs Add tooltips ✅; UX-038/040/042/044 UI polish ✅; DATA-002 roster update script ✅. **MVP readiness: ~99%.** All critical bugs cleared. DATA-002 script ready (waits on HockeyTech rosters). Ready for Jul 14 beta invites. Full plan in `roadmap-sprints.md`.

**Sprint 13 (UX Audit + Onboarding First-Run) is IN PROGRESS.** 14 items from two sources: Pass 1/2 end-user walkthrough (in-season UX bugs — BF-008 negative timestamps, BF-009 analysis nav, UX-046/047/048 matchup and trade friction) plus Pass 5 wizard/auth critique (OB-001–009). 6 P0 items ship first, 8 P1 items follow. Full plan in `roadmap-sprints.md`.

**Sprint 14 (Post-Launch Polish + Emotional Engagement) is PLANNED.** Items deferred from Sprint 13 (OB-010, UX-049, UX-050) plus emotional-engagement follow-through: UX-045 rivalry celebration moment (`RIVALRY_WIN` notification), UX-033 "NO GAMES YET" context. Early shipments from commit 972362d: UX-032 ✅ ("+X pt edge" label), OB-011 ✅ (draft date picker guidance), UX-022 ✅ (TeamNav "Schedule" label). Full plan in `roadmap-sprints.md`.

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

## Completed Sprints (7–15)

All sprints from 7–15 are complete and shipped (Sprint 13 is in progress with 3 items also shipped via Sprint 15 batch). Detailed plans in `roadmap-sprints.md`.

- **Sprint 7** ✅ — Retention Layer (Trade System, Storylines, Replay Sim v2 UX)
- **Sprint 8** ✅ — Beta Hardening (14/14 audit fixes + beta bugs)
- **Sprint 9** ✅ — PWHL GM Rebrand (8/8 stories, fully rebranded)
- **Sprint 10** ✅ — Beta Bug Sweep + Launch Polish (5 P0/P1 bugs, founding beta ready)
- **Sprint 11a & 11b** ✅ — UX Polish (24 items: vocab, nav, wizard, empty states)
- **Sprint 12** ✅ — Pre-Beta Polish (5 items: BF-004, UX-043/039/038/040/042/044, DATA-002)
- **Sprint 15** ✅ — Visual Design System Deep Pass (3 stories: DS-001/002/003; Jun 22, 2026)

**Current Status:** Sprint 13 IN PROGRESS (2/14 shipped: BF-008, OB-001, OB-008) · Sprint 15 COMPLETE (visual design system) · MVP readiness ~99%

**Sprint 14 (Backlog):** 5 stories from two-agent integration test (Jun 22, 2026) — BF-010 (goalie locked in BENCH warning), BF-011 (FA suggestions empty in replay), TR-002 (silent trade rejection notification), TR-003 (trade skips PROPOSED state when commissioner review is on), DRC-002 (draft timer freeze after server restart). Full specs in `roadmap-features.md` under "Agent Integration Test Findings."

**Post-Launch Backlog:** FAAB (#6 — defer to 2027-28 when commissioners request), Growth analytics (GR-001/002/003/004), push notifications, multi-season library (#12), player trends (#23), keeper/dynasty (#19/#20), native apps, AI features. See `roadmap-sprints.md` for details.

---

## See Also

- [roadmap-features.md](roadmap-features.md) — all feature cards (Phases 0–7), full specifications
- [roadmap-sprints.md](roadmap-sprints.md) — sprint plans, sprint history, launch timeline
- [CLAUDE.md](../../CLAUDE.md) — codebase reference and engineering guidelines
