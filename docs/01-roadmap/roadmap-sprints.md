# PWHL Fantasy Roadmap — Sprint Plan & Timeline

---

## About This Document

This document contains the sprint plan (how features map to sprints), sprint history, and the launch timeline. For detailed feature specifications, see [roadmap-features.md](roadmap-features.md). For the current state and "what to build next" queue, see [roadmap-index.md](roadmap-index.md).

---

# Sprint Plan — Alignment + Validation + Feature Builds

The "What To Build Next" list above sequences feature work by token cost. This section is the
**calendar view**: it interleaves Phase 0 alignment, MVP validation, and feature builds into
sprints. Item IDs reference Phase 0 (IA-*) above and the GPT launch tracks in
`docs/roadmap/roadmap-gpt.md` (DE-*, LC-*, CT-*, TR-*, NT-*, MS-*).

Assumes a solo builder working with Claude (Pro), ~2 weeks per sprint. Tracks: **A**lignment ·
**V**alidation · **F**eature.

## Sprint 0 — "Make it match the rules" · ✅ COMPLETE · Track A (P0)

- IA-001 Roster defaults 3F — validation updated + CLAUDE.md updated ✅
- IA-002 VP authoritative (standings, qualification, seeding) ✅
- IA-003 Playoff defaults → 4 teams / no byes / single-week ✅
- IA-007 Auto-draft rebalance for 3F demand ✅

**Exit:** scorecard Rosters / VP standings / Playoffs flipped FAIL → PASS. ✅

## Sprint 1 — "Prove a season completes" · ✅ COMPLETE · Track V (P0)

- End-to-end season simulation framework (`scripts/simulate-season.ts`) ✅
- VP standings validation suite — 28 tests in `tests/vp.test.ts` ✅
- Playoff qualification & seeding validation suite — 18 tests in `tests/playoffs.test.ts` ✅
- Period-based lineup lock (LC-001) ✅
- MVP readiness scorecard updated — confidence 85–90% ✅

**Exit:** one simulated league completes a full season with zero manual DB edits. ✅

## Sprint 2 — "Commissioner + Platform Foundation" · ✅ COMPLETE

**Draft reliability track:**
- C1 WebSocket reconnect with exponential backoff (`useDraftSocket.ts`) ✅
- C2 Commissioner auth enforcement on START/PAUSE/RESUME — server-side (`server.ts`) ✅
- H1/H3 Position-aware + value-ranked auto-pick — tier (G needed → skater starter → bench) + proxy FP ✅

**Commissioner track:**
- CT-001 Force roster move, undo transaction, replace inactive manager ✅
- CT-002 Audit logging — `lib/services/audit-service.ts`, all routes write `LeagueEvent`; admin panel shows last 50 ✅
- CT-004 Draft pause/resume audit writes + draft-paused banner on admin panel ✅
- IA-004 Season boundary validation — `validateSeasonBoundary()` in `lib/season/lifecycle.ts` ✅

**Platform foundation track:**
- MS-001 `parentLeagueId` schema + self-referencing `"LeagueLineage"` relation ✅
- MS-002 `rulesVersion Int @default(1)` on `FantasyLeague` ✅
- MS-003 `scoringVersion Int @default(1)` on `FantasyLeague` ✅
- MS-004 Season renewal — `lib/services/renewal-service.ts`, `/renew` API, `RenewLeagueForm`, admin "Start Next Season" ✅

**Analytics track:**
- AN-001 All 6 events shipped — `lib/analytics/index.ts` `trackEvent()`; `user_registered`, `league_created`, `league_joined`, `draft_started`, `draft_completed`, `lineup_saved` ✅

**Product track:**
- IA-006 VP education UI — `components/VpExplainer.tsx` on standings page ✅
- IA-005 8-team "Recommended" label on league creation form ✅

**Exit:** ✅ 130/130 tests pass · `tsc --noEmit` clean · commissioner can recover from any stuck state without engineering help · schema is multi-season-ready · schedule generator blocks PWHL playoff overlaps.

## Sprint 3 — "Beta-ready: onboarding, trust, mobile" · ✅ COMPLETE · June 13, 2026 · Track F

**Progress report:** `docs/01-roadmap/sprint-3-progress.md` (closed June 13, 2026)

- #2 League Onboarding ✅ (welcome flow, setup wizard, draft prep guide, replay explanation; `User.onboardingCompletedAt`; `components/WelcomeFlow.tsx`; `app/create-league/CreateLeagueWizard.tsx`; manager checklist on league overview)
- #4 Error Handling ✅ (empty / loading / retry across all core pages — draft room, matchup, lineup, standings, roster)
- #3 Mobile Optimization ✅ (draft room tabbed layout at ≤900px, 44px touch targets everywhere, BottomNav safe-area, standings minWidth, matchup score clamp())
- NT-001 in-app notification infrastructure ✅ (`lib/services/notification-service.ts`, bell UI, draft server call sites for DRAFT_STARTING + ON_THE_CLOCK)
- NT-001 schema delta ✅ (`title`, `body`, `actionUrl`, `teamId`, `dedupeKey` on `Notification`; `@@unique([userId,type,dedupeKey])` live; bell renders stored fields)
- NT-002 draft notifications ✅ (DRAFT_STARTING + ON_THE_CLOCK wired from `lib/draft/server.ts`)
- NT-003 Scheduled trigger decision ✅ resolved June 13, 2026: check-on-dashboard-load + DB-level dedupeKey — see `docs/02-engineering/notification-framework-spec.md`
- #8 Transaction History ✅ (paginated API + page with type/team filters, replay guard, infinite scroll)
- #28 Lineup Stats Tab Polish ✅ (unplanned positive addition — renamed "Matchup Proj", between-weeks default, "This week" hidden when no active period)
- #32 Draft Room Team Distribution Panel ✅ (unplanned positive addition — `TeamSpreadPanel` in `DraftRoom.tsx`, concentration color-coding)

**Carry-forwards to Sprint 4:**
- NT-002 LINEUP_INCOMPLETE — shipped early Sprint 4 (June 13, 2026); see Sprint 4 shipped items
- IA-011 Hide advanced non-v1 settings — shipped during Sprint 3 (`ae9246d`)

**Exit:** a brand-new user creates and drafts a league on a phone with no docs. ✅ ACHIEVED

## Sprint 4 — "Product polish: lineup, commissioner UX, rivalries" · ~1–2 wks · Track F ← CURRENT

Close the in-progress feature gaps and carry-forwards before beta.

**Shipped early Sprint 4 (June 13, 2026):**
- **NT-002 LINEUP_INCOMPLETE notification** ✅ — `checkAndEmitScheduledNotifications(userId, nowMs, prisma)` in `lib/services/notification-service.ts`; wired into `app/dashboard/page.tsx` on load; `dedupeKey = "{periodStartsAt}-{teamId}"`; fires when any active starter's PWHL team has no games remaining in the active period; idempotent via DB unique constraint (commits `cb3a5d1`, `1a63871`)

**Remaining sprint 4 items:**
- **#28 Lineup Stats Tab Polish** ✅ — shipped during Sprint 3; no further work needed
- **#01 Commissioner Dashboard (remaining gaps)** ✅ — pause/restart replay shortcut; force-draft-start CTA; lineup lock override (`POST .../commissioner/unlock-player`); settings editor (gated on pre-draft); all actions write to audit log (shipped June 13, 2026; commit eb65449)
- **#17 Rivalries (remaining gaps)** ✅ — rival badge + H2H history view on matchup page (shipped June 13, 2026; commit cbe8374); rival = most-played opponent (tie-break W/L); H2H shows last 5 matchups with dates, scores, outcomes

**Bug fixes & UX improvements (Sprint 4):**
- **VP Standings Zeroing Fix** ✅ — root cause: `homeVP`/`awayVP` columns defined in schema but missing from Prisma migration; DB returned `undefined` → unsafe casts degraded to `null` → `computeVpStandings` skipped all rows. Solution: created migration `20260627101300_add_vp_scoring` to add missing columns; removed 7 unsafe type casts across standings-service, 4 page components, and season/index (commit da9a027)
- **League Matchup Slate Removal** ✅ — user feedback: slate card showing all league matchups was not the right UX. Removed MatchupSlateRow type, leagueMatchupSlate field, VP-mode slate computation, and MatchupSlateItem component. Remaining sections on matchup page unchanged: hero card, rival badge, playing tonight, swing players, rosters, activity feed (commit b41161b)
- **Playoff Mode + Replay Support** ✅ — fixed critical bug in `derivePlayoffPeriods` (removed broken array-index heuristic); implemented `getPlayoffDashboardData()` showing live playoff 1v1 matchups on franchise page with DuelHero component; added "Start Playoffs →" button and "+1 Week" advancement to ReplayDayBar; added "Playoffs" tab to TeamNav when in playoffs; added playoff R1/R2 round chips to team layout; fixed `getLastResult` to include playoff results in recap card; added playoff action item to dashboard; removed placeholder matchup row creation (foreign key constraint violation); all TypeScript checks pass (commit b41161b)

**Exit:**
- NT-002: ✅ ACHIEVED — manager with a starter whose PWHL team has no games remaining this period receives a LINEUP_INCOMPLETE in-app notification on dashboard load; second load in the same period does not duplicate it.
- IA-011: ✅ ACHIEVED (Sprint 3) — bracket shows no "bye" text on default 4-team format; admin settings render as readable tables.
- #01: ✅ ACHIEVED — all four commissioner recovery actions are reachable from the admin panel, write a `LeagueEvent`, and are reflected in the audit log table. Specifically: pause/restart replay, force draft start, unlock player (period-lock only, respects play-lock), and pre-draft settings editor.
- #17: ✅ ACHIEVED — rival badge shows most-played opponent with season series W-L-T record; H2H history on matchup page displays last 5 matchups with dates, scores, and outcomes. Rival = opponent with highest number of completed matchups (tie-break by W-L record). Data computed from existing `Matchup` rows; no schema changes.
- **Playoff Mode (Replay + Live):** ✅ ACHIEVED — replay commissioners can advance through game days until regular season ends, then click "Start Playoffs →" to initialize playoffs. ReplayDayBar shows "+1 Week" to advance through playoff rounds. Franchise page shows live 1v1 playoff matchup with DuelHero, opponent rosters, and win probability. TeamNav shows "Playoffs" tab linking to bracket. Team layout shows "R1"/"R2" etc. playoff round chips. Dashboard surfaces "🏆 Playoffs are live" action item. All controls work in both replay and dev-sim modes.
- No Phase 1 or Phase 5 feature card enters beta in "partial" state when the remaining work is small and well-specified. Any item not shipped must be explicitly deferred with a documented reason.

## Sprint 5 — "Validation + Beta Operations" · ~2 wks · Track V

- Draft reliability certification — duplicate-tab handling, load test concurrent leagues, reconnect stress test; findings documented in `commissioner-runbook.md`
- Founder Operations Console — league explorer (search by league/commissioner/user, view config + draft state + standings), simulation launcher, validation dashboard — spec `docs/02-engineering/founder-ops-console.md`
- Beta Feedback Infrastructure — in-app feedback widget (bug reports, suggestions), founding commissioner tracking (invited → accepted → active → renewed)
- Commissioner workflow validation — end-to-end manual test of all commissioner actions; runbook accuracy review; screenshots added

**Exit:** commissioner can run a league start-to-finish with no engineering help; founder can monitor platform health without DB access; founding commissioner cohort can be invited.

## Sprint 6+ — Post-MVP / Launch features · P1 → P2

Sequenced from "What To Build Next" and the GPT launch phases:

- **Transactions:** #7 Trade System → #5 Waiver priority/processing → #6 FAAB (Transaction History #8 now in Sprint 3)
- **Engagement:** #25 Team Analysis & Insights · #29 Weekly Performance Dashboard · #11 league-wide storylines · #30 Playoff Experience UX polish
- **Multi-season UX layer** (schema laid in Sprint 2 via MS-001/002/003/004): MS-005 League History views · League Hall of Fame (#18) · Player Legacy (#31)
- **Growth / retention:** GR-001/002 activation + retention analytics (AN-002/003 dashboards) · GR-003 referral loop · GR-004 league-fill progress
- **Phases 5–7:** rivalries H2H history · Hall of Fame · player legacy · keeper → dynasty · real-time push scoring · push notifications · player trends

---

# Sprint History

| Sprint | Status | Outcome |
|---|---|---|
| Sprint 0 — Implementation Alignment | ✅ COMPLETE (Jun 12, 2026) | Rosters / VP / Playoffs flipped FAIL → PASS |
| Sprint 1 — Season Validation | ✅ COMPLETE (Jun 12, 2026) | Full season simulates, 114 tests pass, confidence 85–90% |
| Sprint 2 — Commissioner + Platform Foundation | ✅ COMPLETE (Jun 2026) | Commissioner recovery tools, multi-season schema, analytics (6 events), VP education; 130 tests pass |
| Sprint 3 — Beta Readiness | ✅ COMPLETE (Jun 13, 2026) | Onboarding ✅, error handling ✅, mobile ✅, NT-001 ✅, draft notifications ✅, transaction history ✅, IA-011 ✅ |
| Sprint 4 — Product Polish | ✅ COMPLETE (Jun 13, 2026) | NT-002 LINEUP_INCOMPLETE ✅, #01 commissioner dashboard ✅, #17 rivalries ✅ |
| Sprint 5 — Validation + Beta Operations | ⏳ PLANNED | Draft cert, founder dashboard, beta feedback infra |
| Sprint 6+ — Launch Features | ⏳ PLANNED | Transactions, trade, waivers, growth |

---

# MVP Launch Timeline & Beyond

**Anchor:** today is June 12, 2026. The PWHL 2026-27 opener is ~Nov 2026, with fantasy drafts
~1 week prior (~late Oct 2026). That real date is the natural public-launch target — MVP must
be drafting-ready before it. Dates below assume ~2-week sprints, solo + Claude. They are
estimates, not commitments.

| Window | Milestone |
|---|---|
| **Jun 12, 2026** | Sprint 0 — alignment P0s closed (roster / VP / playoffs match rules) ✅ |
| **Jun 12, 2026** | Sprint 1 — season simulation + validation suites green ✅ |
| **Jun–Jul 2026** | Sprint 2 — commissioner recovery + platform foundation + analytics ✅ |
| **Jun–Jul 2026** | Sprint 3 — onboarding ✅, error handling ✅, mobile ✅, notifications (draft ✅), IA-011 ✅ COMPLETE |
| **Jun 13, 2026** | NT-002 LINEUP_INCOMPLETE notification shipped (`checkAndEmitScheduledNotifications` on dashboard load) ✅ |
| **Jun 13, 2026** | Sprint 4 — commissioner dashboard gaps ✅, rivalries ✅ **COMPLETE** |
| **Late Aug 2026** | Sprint 5 — draft cert, founder dashboard, beta feedback infra ← next |
| **Early Sep 2026** | **MVP code-complete — all launch gates pass** |
| **Sep – mid Oct 2026** | Closed beta: founding commissioners run replay + small live test leagues; fix findings |
| **Late Oct 2026** | **PUBLIC LAUNCH** — real leagues draft ~1 week before the opener |
| **Nov 2026** | First live regular season on the platform |

**Risk buffer:** if a sprint slips, the Sep–Oct beta window absorbs ~3–4 weeks before the hard
late-Oct draft date. Earliest *credible* MVP code-complete is early Sep 2026; the latest safe
code-complete before public drafts is early Oct 2026.

## Beyond MVP

- **Q4 2026 (in-season):** Transaction History → Trade System → Waivers → FAAB; engagement surfaces (#25 analysis, #29 performance dashboard, #30 playoff UX) while the first live season runs.
- **Off-season — winter/spring 2027:** Multi-Season UX layer — League History views, Hall of Fame, Player Legacy. The schema foundation (parentLeagueId, rulesVersion, scoringVersion) was laid in Sprint 2, so this is purely the product surface. Growth/retention analytics dashboards (AN-002/003) and referral loop. Target: 2027-28 leagues renew in-place and keep their history.
- **2027-28 season:** Advanced formats (keeper, then dynasty), real-time push scoring + push notifications, and player trends. Native apps and AI features (draft assistant, weekly recaps, trade evaluator) remain Phase 5 "future expansion" — revisit once retention metrics justify them.
