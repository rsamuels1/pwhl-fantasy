---
name: sprint18-plan
description: Sprint 18 — ✅ COMPLETE Jun 23, 2026; 24 items across 5 tracks all shipped; BF-015/016/017 + BLR-003 ad-hoc Track E added; next BF-NNN: BF-018; beta invites Jul 7, 2026
metadata:
  type: project
---

Sprint 18 is **COMPLETE** as of Jun 23, 2026. All 24 items shipped across 5 tracks. Beta invites Jul 7, 2026.
All P0 stories are complete. 0 remaining P0 items.

## All P0s shipped

**BLR-001 ✅ SHIPPED** (commits cc77196 + ecc7290, Jun 22, 2026)
- `POST /api/founder/beta-leagues` — creates pre-configured 8-team replay league (4 curated weeks, 2-round playoffs)
- `POST /api/founder/beta-signups` and `POST /api/founder/leagues/[leagueId]/beta-users` — invite-link mechanics
- `GET/PUT /api/leagues/[leagueId]/draft/queue` — draft queue API for pre-draft manager prep
- `scoreVtfWeek` beta week mapping in `lib/scoring/matchups.ts`
- Beta season generation in `lib/season/index.ts` via `pickRandomWeeks(20, 4)`
- Founder console: "Create Beta League" form + "Beta" filter; "Beta Users" tab in league detail
- Beta banner in league + team layouts; TeamNav "Draft Queue" tab pre-draft
- `/team/[teamId]/draft-prep` — new route for player rankings + queue manager

**Engineering risks in BLR-001 (not yet mitigated — verify before first beta draft):**
- `pickRandomWeeks(20, 4)` hardcodes `total: 20` — should derive actual period count dynamically
- `computeSeasonState` may show phantom period statuses for beta leagues with only 4 ScoringPeriod rows

**BLR-002 ✅ CONFIRMED SHIPPED**
`CreateLeagueWizard.tsx` line 220: `{isBetaMode && step === 0 && <BetaWelcomeStep onContinue={() => setStep(1)} />}`.
Heading: "You're in. Welcome, Founding GM." 3 cards + "Build my league →" CTA. Progress bar hidden on step 0 (`{step > 0 && ...}`).
`NEXT_PUBLIC_BETA_MODE=true` in `.env.local`. No schema change.

**BF-009 ✅ RESOLVED** — Playwright false-negative; Analysis nav confirmed working

**OB-002 ✅ SHIPPED** — VpExplainer inline in step 4; UTIL relabeled

**OB-003 ✅ SHIPPED** — "Next, you'll name your own team" callout moved up

**OB-004 ✅ SHIPPED** — Cancel dialog copy updated; logic already correct

**Settings API isPublic fix ✅ SHIPPED** (commit 971cd11)

**Deploy config ✅ SHIPPED** (commit e24b508) — `prisma migrate deploy` in build step

**Beta UX polish ✅ SHIPPED** (commit eed7d35)

**OPS-001 ✅ GATE-1 PASS** — Zero P0 findings. 6 P1 findings deferred post-beta.
Report: `docs/04-operations/security-audit-sprint-18.md`

**OPS-002 ✅ GATE-2 PASS** — 20 concurrent leagues × 4 teams = 80 WebSocket connections.
All drafts completed with correct pick counts and no cross-league player duplication.
Report: `docs/04-operations/load-test-sprint-18.md`

**OPS-003 ✅ GATE-3 CONDITIONAL PASS**
- `process-waivers` cron: confirmed at `0 8 * * *` (08:00 UTC = 03:00 ET) in `vercel.json` ✅
- `check-incomplete-lineups`: new route `app/api/cron/check-incomplete-lineups/route.ts` + `vercel.json` entry at 12:00 UTC ✅
- `CRON_SECRET` guard implemented in both routes ✅
- Error monitoring: not configured (P1 post-beta)
- Neon PITR: manual verification required
- **⚠ One manual action pending before Jul 7: set `CRON_SECRET` in Vercel production dashboard**
Report: `docs/04-operations/ops-verification-sprint-18.md`

## Track E — Ad-hoc beta fixes (Jun 22–23, all SHIPPED)

All discovered and shipped after primary tracks completed.

**BF-015 ✅ SHIPPED** (commit f400b90) — UTIL slot false error on valid forward move; stale-closure bug in LineupManager.tsx multi-move batches
**BF-016 ✅ SHIPPED** (commit 70cd536) — Activity feed raw LEAGUE_STORYLINE enum string; TYPE_META label added in lib/services/activity.ts
**BF-017 ✅ SHIPPED** (commit 622ac9a) — Auto-set and bench-upgrade hint suggesting players with 0 games; null-coalescing fix in lib/lineup.ts
**BLR-003 ✅ SHIPPED** (commit dfef7ef) — Expansion team teaser in beta welcome screen + draft room header; gated on isBetaMode

## Story ID state (as of Jun 23, 2026)
- Next OB-NNN: OB-012
- Next UX-NNN: UX-051 (Sprint 19)
- Next AG-NNN: AG-010
- Next BF-NNN: BF-018 (BF-015/016/017 all used in Sprint 18 Track E)
- Next OPS-NNN: OPS-005

**Why:** Sprint 18 COMPLETE Jun 23, 2026. BF-015/016/017 and BLR-003 shipped as unplanned ad-hoc fixes (Track E). Sprint 19 is now current (Playwright UX walkthrough fixes). BF-018 is the first Sprint 19 bug ticket.

**How to apply:** Sprint 18 is done. Sprint 19 is the active sprint. All roadmap docs updated Jun 23: roadmap-features.md has new Sprint 18 Ad-hoc section; roadmap-sprints.md has Track E inside Sprint 18; CLAUDE.md build order has Sprint 18 bullet; shipped.html created with 135-item inventory.
