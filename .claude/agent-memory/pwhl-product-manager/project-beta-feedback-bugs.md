---
name: beta-feedback-bugs
description: Beta bug tracker — BF-001/002 RESOLVED (Sprint 9); BF-012–017 SHIPPED Sprint 18; BF-018 (/league-rules 404) SHIPPED Sprint 22; BF-019 blocked (email); BF-020 DEFERRED to Sprint 25 (auto-draft position balance); next new ID: BF-021
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

**OPS-004** — Accessibility audit requested via feedback `cmqpryac7000n11ngc9j136a4`. Shipped Sprint 18 (focus-visible CSS globally; aria-labels on draft pick buttons + lineup slot divs).

## Sprint 18 Track E bugs (all SHIPPED Jun 22–23)

**BF-015 ✅ SHIPPED** (commit f400b90) — UTIL slot false error on valid forward move; stale-closure bug in LineupManager multi-move batches. Files: `app/team/[teamId]/lineup/LineupManager.tsx`

**BF-016 ✅ SHIPPED** (commit 70cd536) — Activity feed raw LEAGUE_STORYLINE enum string. Files: `lib/services/activity.ts`

**BF-017 ✅ SHIPPED** (commit 622ac9a) — Auto-set/bench-upgrade hint suggesting players with 0 games; null-coalescing fix. Files: `lib/lineup.ts`, `LineupManager.tsx`

## Sprint 22 bugs

**BF-018 (Sprint 22, P1) ✅ SHIPPED (Jun 23, 2026)** — `/league-rules` 404 dead link fixed. `app/league-rules/page.tsx` created: public static page, no auth required, five sections (scoring, roster, draft, standings, playoffs). Fixes dead links from WelcomeFlow and BetaWelcomeStep.

**IMPORTANT — BF-018 ID collision:** Sprint 20 reused the BF-018 ID for the league nav "Schedule"→"Results" rename (commit ad4185a). The `/league-rules` 404 bug was the ORIGINAL BF-018 from the Sprint 19 Playwright walkthrough — now SHIPPED in Sprint 22.

**BF-019 (email-blocked)** — Password reset / forgot password. Blocked on email infra.

## BF-020 — Auto-Draft Position Balance (OPEN, Sprint 25)

**BF-020 (Sprint 25, P2, S)** — Auto-draft position balance: minimum defenders/goalies not enforced. When the pick clock expires, `bestAvailablePlayerIds()` in `lib/draft/server.ts` sorts forwards and defenders together by proxy FP, causing all-forward auto-drafted teams. Fix: split Tier 2 into Tier 2a (defender filling D slot) and Tier 2b (forward/skater filling F/UTIL slot). Spec in `roadmap-features.md` § BF-020. Was Sprint 24; deferred when Sprint 24 shipped 5/7 stories.

**Next BF-NNN: BF-021**

**How to apply:** BF-001/002 stale OPEN in DB is cosmetic. BF-012/013/014/015/016/017 all confirmed shipped Sprint 18. BF-018 (/league-rules 404) shipped Sprint 22. BF-019 blocked on email infra. BF-020 deferred to Sprint 25. Next new bug ID is BF-021.
