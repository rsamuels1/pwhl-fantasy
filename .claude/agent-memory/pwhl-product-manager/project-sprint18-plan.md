---
name: sprint18-plan
description: Sprint 18 — all P0s complete (BLR-002 confirmed shipped, OPS-001/002/003 passed gates); one manual action pending (CRON_SECRET in Vercel before Jul 7); beta invites Jul 7, 2026
metadata:
  type: project
---

Sprint 18 is IN PROGRESS as of Jun 22, 2026. Target: beta invites go out **Jul 7, 2026**.
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

## Remaining (P1 and below)

**Track B — Sprint 13 carry-forwards (P1)**
- UX-046 (S, P1): Season series block renders twice on matchup page
- UX-047 (M, P1): Trade proposal has no trading-partner-first step
- UX-048 (S, P1): Trade form search hint hidden below player list
- OB-005 (S, P1): QuickDraftJoinForm on public home page
- OB-006 (S, P1): Replay mode description only appears after clicking option
- OB-007 (S, P1): Login page says "All 8 teams" (should be 12)
- OB-009 (S, P1): Wizard rules step shows no FP values

**Track C — New bugs from live FeedbackSubmission**
- BF-012 (M, P1): FA add confirms success but shows error modal (phantom error)
- BF-013 (S, P1): Trades cannot be proposed between draft completion and season start
- BF-014 (S, P2): VTF matchup schedule page confusing (SPEC NEEDED)

**Track D**
- OPS-004 (M, P1): Accessibility audit

## Story ID state
- Next OB-NNN: OB-012
- Next UX-NNN: UX-051
- Next AG-NNN: AG-010
- Next BF-NNN: BF-015
- Next OPS-NNN: OPS-005

**Why:** All 4 remaining P0 items (BLR-002, OPS-001, OPS-002, OPS-003) confirmed complete Jun 22, 2026.
BLR-002 was already in the codebase — `BetaWelcomeStep` on line 220 was confirmed present.
GATE-3 is CONDITIONAL because error monitoring and Neon PITR are not confirmed, and `CRON_SECRET`
must be set manually in Vercel. This is non-blocking for beta invites.

**How to apply:** The one remaining action before beta is the CRON_SECRET manual set in Vercel production.
The BLR-001 engineering risks (pickRandomWeeks hardcoded 20, computeSeasonState with 4 periods) should
still be verified by the founder before the first beta draft.
