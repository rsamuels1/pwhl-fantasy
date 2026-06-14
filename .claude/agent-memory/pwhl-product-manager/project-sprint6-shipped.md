---
name: sprint6-shipped
description: Sprint 6 status — Auto-Set Lineup (#34) shipped; Trade System (#7) deprioritized to bottom of backlog
metadata:
  type: project
---

Sprint 6 is IN PROGRESS as of 2026-06-14.

**Shipped (Sprint 6):**
- Auto-Set Lineup (#34) ✅ — `computeOptimalLineup()` in `lib/lineup.ts`; staged save model; "Auto-set" purple button in `LineupManager.tsx`; `beforeunload` guard; playoff period fallback for games-remaining badges; `GET /api/leagues/[leagueId]/fa-suggestions` (top 10 unrostered by projected FP). Commits: 3e6bbd0, f83468f, 1f06c9a. Spec: `docs/02-engineering/auto-set-lineup-spec.md`.

**Remaining Sprint 6 (in priority order):**
2. Beta Feedback Infrastructure — spec at `docs/02-engineering/beta-feedback-spec.md`; adds `FeedbackSubmission` table + `betaStatus` on `FantasyLeague`
3. Team Analysis & Insights (#25) — spec at `docs/02-engineering/team-analysis-spec.md`; trade suggestion CTA removed (was gated on Trade System, now deferred)
4. Waiver Priority + Processing (#5) — spec at `docs/02-engineering/waiver-spec.md`

**Trade System (#7) — DEPRIORITIZED:**
Moved to bottom of backlog as of June 2026. Marked "someday maybe." Beta cohort is small enough for out-of-band trades. Spec exists at `docs/02-engineering/trade-spec.md`. Do NOT plan it into any sprint without explicit user confirmation.

**Sprint 5 still has 2 open items:**
- Commissioner Workflow Validation (can run in parallel)
- Weekly Performance Dashboard (#29) — pulled up from Sprint 6; low risk, reads existing data

**Why:** Sprint 6 started overlapping with Sprint 5 because auto-set was low-risk and pulled forward from early Sprint 6 work. Trade System deprioritized because beta cohort is small and the 130K token cost is hard to justify without confirmed demand.

**How to apply:** When sequencing next work, auto-set is done. Next highest-value Sprint 6 item is Beta Feedback (P2, ~40K tokens, small scope) or Team Analysis (P1, ~85K tokens, higher user value). Trade System should not appear in any sprint plan.
