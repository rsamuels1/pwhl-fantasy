# PWHL GM Product Roadmap — Index

Last Updated: June 20, 2026

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

Snapshot of launch-blocking areas. **Confidence to launch: ~98%.**

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

**All MVP gates clear.** PLAYOFF-BUG-001 resolved in commit b465423. No remaining soft blockers.

---

## MVP Definition & Launch Gates

MVP proves a league can go **Create → Invite → Draft → Set Lineups → Compete → Make Playoffs → Crown Champion** with no commissioner intervention or database surgery. Full scope in `docs/mvp-definition.md`.

**In scope:** league create / config / invite · snake draft with timer + auto-pick + reconnect (8- and 10-team) · roster validation · weekly lineup lock + partial-week subs · hybrid H2H + VP standings · 4-team playoffs ending before PWHL playoffs · commissioner recovery tools (pause/resume draft, replace manager, force move, undo, audit log) · critical notifications (draft starting, on the clock, lineup incomplete).

**Out of scope for MVP:** trades, waivers, FAAB (may add pre-launch only if implementation risk is low) · keeper / dynasty · referral / growth loops · AI features · native apps.

**Launch gates — all must pass:** rules match implementation · draft reliability validated · VP standings validated · playoff qualification validated · end-to-end season simulation completed · commissioner recovery tools available.

---

## What To Build Next

Sprint 6 is complete (7/7). Sprint 7 is complete (3/4 items done — #11 Storylines ✅; #39 Replay Sim V2 UX ✅; PLAYOFF-AUDIT-001 ✅; #7 Trade System deferred; #38 Replay V2 deferred). Sprint 8 (Beta Hardening) is complete — all 14 items done. Sprint 9 (PWHL GM Rebrand) is COMPLETE — all 8 stories shipped: REBRAND-001/002/003/004/005/006/007/008 all done. The product is now fully rebranded as PWHL GM with 202/202 tests passing and zero "PWHL Fantasy" strings in the live UI.

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

Remaining Sprint 8 scope (Jul 7–13): P1-D schedule badge timezone, Vercel cron wiring (`CRON_SECRET`
confirmed), load test, integration test, P2 notification gaps, UX polish. Full details in feature
card #40 (`roadmap-features.md`) and sprint plan (`roadmap-sprints.md`).

**Sprint 7 — Retention Layer (current):**

1. **Trade System (#7)** · ~130K · Sprint 7 · Priority 1
   Spec: `docs/02-engineering/trade-spec.md`. Pulled up from backlog June 2026 — higher priority than League History/HoF for the launch period. Trade proposal/review/approval flow, commissioner review gate, trade history, 3 new notification types. Schema: `Trade`/`TradeOffer` tables. Unblocks trade-suggestion CTA in Team Analysis (#25).

2. **League-Wide Matchup Storylines (#11)** · ✅ DONE · Sprint 7
   `lib/services/storyline-service.ts` (`computeWeeklyStorylines`, `emitWeeklyStorylines`); `LEAGUE_STORYLINE` EventType; `components/WeekHighlights.tsx` on league overview; emitted fire-and-forget from `advanceSeason()`; tested in `tests/storyline.test.ts`.

3. **Replay Simulation Accelerated Playback (#38)** · DEFERRED — superseded by #39 (UX Overhaul, shipped Sprint 7).

_(#31 Player Legacy & #6 FAAB deferred to post-launch backlog — see below.)_

**Sprint 8 — Beta Hardening — COMPLETE (14/14 done):**

All audit fixes and beta bugs resolved. Commit b465423 ships the final 7 items.

1. ~~P0 waiver cron~~ ✅ done Jun 20
2. ~~P1 UX fixes (A/B/C/D/E/F)~~ ✅ all done
3. ~~BUG-1/PLAYOFF-1~~ ✅ Anchor playoff periods to last game in replay leagues (commit b465423)
4. ~~BUG-2/PLAYOFF-2~~ ✅ Auto-resolved by BUG-1 (commit b465423)
5. ~~BUG-3A/PLAYOFF-3~~ ✅ Enable auto-set during playoffs (commit b465423)
6. ~~BUG-4/ROSTER-1~~ ✅ Fix roster refresh after adding FA (commit b465423)
7. ~~BUG-5A/LINEUP-1~~ ✅ Demote zero-games players in lineup sort (commit b465423)
8. ~~BUG-5B/FA-SUGG-1~~ ✅ Fix fa-suggestions with sim-date + games filter (commit b465423)
9. ~~PLAYOFF-BUG-001/BRACKET-1~~ ✅ Fix bracket default 6 → 4 teams (commit b465423)

Deferred to operations phase (pre-launch): Vercel cron wiring (`CRON_SECRET` confirmed in staging), load test (10+ concurrent leagues), integration test. P2 notification gaps (lineup-incomplete cron, waiver claim awarded/denied) can slip to first post-beta fix.

**Exit from Sprint 8:** founding commissioner beta invites go out (target Jul 14, 2026).

**Sprint 9 — PWHL GM Rebrand — COMPLETE ✅:**

All 8 rebrand stories shipped. The product is now fully rebranded as PWHL GM across all user-facing surfaces. 202/202 tests pass; `tsc --noEmit` clean; zero "PWHL Fantasy" strings in the live UI.

- **REBRAND-001 ✅** — `components/LogoShield.tsx`; global "PWHL Fantasy" → "PWHL GM" rename; home page hero rewrite ("Think Like a GM."); favicon/manifest update
- **REBRAND-002 ✅** — Voice consistency: "Your Franchises" dashboard, "Front Office" nav, login/welcome copy
- **REBRAND-003 ✅** — Detail polish: "PWHL GM — Draft Room" header, "pts" terminology, README/CLAUDE.md product name
- **REBRAND-004 ✅** — Design token system: Archivo + Saira Condensed fonts, deep violet (#7c3aed), solid dark cards (#121829), radial gradient bg, `.section-accent` pill, `.font-stats` utility
- **REBRAND-005 ✅** — Matchup page IA restructure (Z1–Z9 render order, `RosterStatusWidget`, BUG-MATCHUP-001 fix)
- **REBRAND-006 ✅** — Draft room visual upgrade: pick cell glow, player row hover, card border-radius, `TeamSpreadPanel` concentration bar
- **REBRAND-007 ✅** — Secondary pages token pass: `LineupManager`, `RosterManager`, bracket page, `PlayoffBracket`, league overview all use new CSS vars
- **REBRAND-008 ✅** — QA pass: zero "PWHL Fantasy" strings, `tsc` clean, 202/202 tests pass

**Deferred to post-launch backlog:** FAAB (#6, deferred from Sprint 7 Priority 3 — not needed before public launch; revisit for 2027-28 off-season once waiver cron is stable and commissioners request it) · Growth analytics (GR-001/002/003/004) · real-time push scoring · push notifications · multi-season historical library (#12) · player trends (#23) · keeper/dynasty (#19/#20) · native apps / AI features. See `docs/01-roadmap/roadmap-sprints.md` for full backlog list.

---

## See Also

- [roadmap-features.md](roadmap-features.md) — all feature cards (Phases 0–7), full specifications
- [roadmap-sprints.md](roadmap-sprints.md) — sprint plans, sprint history, launch timeline
- [CLAUDE.md](../../CLAUDE.md) — codebase reference and engineering guidelines
