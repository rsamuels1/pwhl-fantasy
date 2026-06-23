---
name: beta-feedback-bugs
description: Live FeedbackSubmission DB state as of Jun 22, 2026 — 16 rows total; BF-001/BF-002 CONFIRMED RESOLVED in code (Sprint 9) and in the codebase; DB rows stale OPEN (cosmetic only); new bugs BF-012/013/014 in Sprint 18
metadata:
  type: project
---

As of Jun 22, 2026, the `FeedbackSubmission` table has 16 rows. Key reconciliation findings:

## BF-001 and BF-002 — Status: CONFIRMED RESOLVED in code; DB rows stale (still OPEN)

**BF-001 — Draft Room False Eviction** (feedback ID: `cmqn6ppib0037ayqco2pgk62g`, Jun 21)
- DB status: OPEN (stale — was never marked RESOLVED)
- Code fix: shipped in Sprint 9 (REBRAND sprint, Jun 22, 2026)
- Fix: one silent reconnect attempt on code 4001 before showing eviction screen; shouldReconnectRef behavior corrected
- The DB row status is stale and should be marked RESOLVED by the founder console

**BF-002 — Performance Tab Shows "Week 1" Mid-Season** (feedback ID: `cmqmn2ffl0001rdpgj8tt1c2z`, Jun 20)
- DB status: OPEN (stale — was never marked RESOLVED)
- Code fix: shipped in Sprint 9 (REBRAND sprint, Jun 22, 2026)
- Fix: GMCommandCenter.tsx week badge now derives from last completed week when no active period exists
- The DB row status is stale and should be marked RESOLVED by the founder console

**Why stale:** The founder console's feedback page (app/founder/feedback/page.tsx) shows status but updating it requires a PATCH call. These were fixed in code but the DB row was never manually updated to RESOLVED. The fix is in the codebase; the stale status is cosmetic in the founder console only.

## New bugs from live feedback (Sprint 18 Track C)

**BF-012 — FA Add Confirms Success But Shows Error Modal**
- Feedback ID: `cmqnc5umh000eu5tmsanmob6z` (Jun 21)
- Status: OPEN
- Symptom: Free agent add succeeds (player appears on roster) but an error modal is also shown
- Likely cause: API returns non-2xx status on edge case or the client error handler fires on a redirect/timing issue post-add
- Sprint 18 Track C, P1, M effort

**BF-013 — Trades Cannot Be Proposed Between Draft Completion and Season Start**
- Feedback ID: `cmqniggbz000kb5xpiks9tfim` (Jun 21)
- Status: OPEN
- Symptom: After draft completes but before season starts, the trade system blocks proposals (likely trade deadline check `playoffStatus !== NOT_STARTED` failing or a pre-season guard)
- Sprint 18 Track C, P1, S effort

**BF-014 — VTF Matchup Schedule Page Confusing in Vs-The-Field Mode**
- Feedback ID: `cmqpqywet000911ngv1887pij` (Jun 22)
- Status: OPEN
- Symptom: The matchup schedule page reads as 1v1 (shows "vs Opponent") in VTF mode; scoring concept unclear
- Spec needed before implementation; Sprint 18 Track C, P2, S effort

## Other notable Jun 22 feedback (deferred as structural suggestions)

Three structural IA suggestions received Jun 22 — deferred to post-launch backlog:
- `cmqpr25jk000b11ngfl786j4n`: Trades should live in "My Franchise" nav, not league nav
- `cmqpr5t8f000j11ng4wfwccsi`: Non-commissioners get league-wide dashboard with no personal-team context
- `cmqprbfpg000l11ng7naubyov`: Rosters tab should be commissioner-only in commissioner view; players should see their own roster only

These are a coherent set suggesting a deeper "League vs Franchise" nav split — P2/P3 post-beta scope.

**OPS-004** — Accessibility audit requested via feedback `cmqpryac7000n11ngc9j136a4`. Added to Sprint 18 Track D as P1.

**How to apply:** When checking FeedbackSubmission in the founder console, BF-001 and BF-002 showing OPEN is expected and stale — both are confirmed fixed in the codebase (Sprint 9 commits in the rebrand batch). This was verified in the PM second pass on Jun 22, 2026. New actionable bugs are BF-012/013/014. Next BF-NNN is BF-015.
