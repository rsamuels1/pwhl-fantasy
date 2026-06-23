---
name: sprint18-plan
description: Sprint 18 IN PROGRESS — BLR-001 shipped; BLR-002 spec written (copy approved, ready for eng); beta invites Jul 7, 2026; 20 stories total
metadata:
  type: project
---

Sprint 18 is IN PROGRESS as of Jun 22, 2026. Target: beta invites go out **Jul 7, 2026**.

## Shipped in Sprint 18 so far

**BLR-001 ✅ SHIPPED** (commits cc77196 + ecc7290, Jun 22, 2026)
- `POST /api/founder/beta-leagues` — creates pre-configured 8-team replay league (4 curated weeks, 2-round playoffs)
- `POST /api/founder/beta-signups` and `POST /api/founder/leagues/[leagueId]/beta-users` — invite-link mechanics
- `GET/PUT /api/leagues/[leagueId]/draft/queue` — draft queue API for pre-draft manager prep
- `scoreVtfWeek` beta week mapping in `lib/scoring/matchups.ts`
- Beta season generation in `lib/season/index.ts` via `pickRandomWeeks(20, 4)`
- Founder console: "Create Beta League" form + "Beta" filter; "Beta Users" tab in league detail
- Beta banner in league + team layouts; TeamNav "Draft Queue" tab pre-draft
- `/team/[teamId]/draft-prep` — new route for player rankings + queue manager

**Engineering risks in BLR-001 (not yet mitigated):**
- `pickRandomWeeks(20, 4)` hardcodes `total: 20` — should derive actual period count dynamically
- `computeSeasonState` may show phantom period statuses for beta leagues with only 4 ScoringPeriod rows — verify before first beta draft

**Settings API isPublic fix ✅ SHIPPED** (commit 971cd11) — unblocks AG-001 public/private toggle

**Deploy config ✅ SHIPPED** (commit e24b508) — `prisma migrate deploy` in build step; migrations now auto-apply on Vercel deploys; advances GATE-3

**Beta UX polish ✅ SHIPPED** (commit eed7d35) — nav hidden on /beta page; completed admin checklist auto-hides

## BLR-002 (P0) — SPEC WRITTEN, ready for engineering

BLR-002 is the **wizard step-0 beta welcome screen**. Spec finalized Jun 22, 2026.

**Display condition:** `NEXT_PUBLIC_BETA_MODE=true` env var (Option A — no schema change). Removes itself at public launch by dropping the env var.

**Placement:** Step 0, inside the existing `dashboard-panel` wizard card. Progress bar and Cancel are hidden on step 0. No full-screen overlay.

**Approved copy:**
- Eyebrow: `Beta · Replay Season` (purple pulse badge matching `/beta/page.tsx`)
- Heading: `You're in. Welcome, Founding GM.`
- Intro: 3 sentences explaining the beta (small cohort), the league format (4 real 2025-26 weeks), and the purpose (shape what we build next)
- Card 1 (⏪): "Real PWHL stats. Condensed timeline." — 4 weeks, full snake draft, VP scoring
- Card 2 (💬): "Send us feedback. All of it." — feedback button, bottom-right, we read every one
- Card 3 (🏒): "Founding GMs get first access in November." — early invite at live launch
- CTA: `Build my league →`
- Secondary link: `What's a replay league?` → tooltip or `/league-rules` anchor

**Key behavioral decisions:**
- CTA calls `setStep(1)` directly — no async, no flag
- No Skip, no Cancel on step 0
- Progress bar hidden (`step > 0 &&` guard)
- `useState(isBetaMode ? 0 : 1)` initializer
- `onboardingCompletedAt` writes on mount as today (no conflict)

Full spec: `docs/01-roadmap/roadmap-features.md` § BLR-002

## 4 Tracks

**Track A — BLR (1 remaining)**
- BLR-001 ✅ SHIPPED
- BLR-002 (M, P0): wizard beta welcome screen — copy TBD

**Track B — Sprint 13 carry-forwards (11 items)**
- BF-009 (S, P0): Analysis page navigation broken mid-season
- OB-002 (S, P0): Wizard Step 4 VP explanation missing
- OB-003 (S, P0): Wizard no warning before team-creation step
- OB-004 (M, P0): Canceling mid-wizard orphans league silently
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

**Track D — Ops gates (advance GATE-1/2/3 toward GREEN)**
- OPS-001 (M, P0): Internal OWASP Top 10 security review
- OPS-002 (M, P0): Load test — 20–30 concurrent live drafts, 80–240 WebSocket connections
- OPS-003 (S, P0): Vercel ops verification — CRON_SECRET, waiver cron, check-incomplete-lineups
- OPS-004 (M, P1): Accessibility audit

## Min-ship (must land by Jul 7)
BLR-001 ✅ SHIPPED · BLR-002, BF-009, OB-002, OB-003, OB-004, OPS-001, OPS-002, OPS-003 = 8 remaining P0 stories

## Story ID state
- Next OB-NNN: OB-012
- Next UX-NNN: UX-051
- Next AG-NNN: AG-010
- Next BF-NNN: BF-015
- Next OPS-NNN: OPS-005

**Why:** BLR-001 shipped 5 commits post-Sprint 17 (eed7d35, 971cd11, cc77196, ecc7290, e24b508). BLR-002 was not in any of those commits — the wizard welcome screen copy was TBD. Beta date is Jul 7, 2026 (firm). Track B/C/D items all remain.

**How to apply:** BLR-002 needs copy approval before implementation can start — flag this immediately. The BLR-001 engineering risks (`pickRandomWeeks` hardcoded 20, `computeSeasonState` with 4 periods) should be verified manually by the founder before the first beta draft invites go out.
