---
name: beta-feedback-bugs
description: First two real beta feedback submissions — BF-001 false draft eviction, BF-002 Performance tab week mismatch — added to Sprint 9 as P1 items on Jun 21, 2026
metadata:
  type: project
---

As of Jun 21, 2026, two real open bug reports exist in `FeedbackSubmission` (third is DISMISSED test submission). Both assigned to Sprint 9 as P1.

**BF-001 — Draft Room False Eviction**
- Feedback ID: `cmqn6ppib0037ayqco2pgk62g` (Jun 21, 2026)
- User: `cmqeai9qj0000s2qdwgexxrp5`, league `my-pwhl-leag-ryq6`
- Symptom: "You opened the draft in another tab" shown on first load, no other tabs open
- Root cause: stale WebSocket in server `sockets` map from prior navigation evicts the fresh connection via close code 4001; `shouldReconnectRef.current = false` + `setEvicted(true)` makes this permanent
- Fix: on code 4001, wait 500ms and attempt one silent reconnect before showing the eviction screen; or add "Rejoin draft" actionable button as minimum viable fix
- Files: `hooks/useDraftSocket.ts` (line 100-103), `app/draft/[leagueId]/DraftRoom.tsx` (lines 40-56)

**BF-002 — Performance Tab Shows "Week 1" Mid-Season**
- Feedback ID: `cmqmn2ffl0001rdpgj8tt1c2z` (Jun 20, 2026)
- User: same user as BF-001, league `my-pwhl-leag-xcqj`
- Symptom A: "Week N of M" badge says "Week 1" even when season is at Week 11
- Root cause A: `GMCommandCenter.tsx` line 55 — `activePeriod?.week || nextPeriod?.week || 1` — the `|| 1` fallback fires during SETUP/between-weeks even mid-season; need to fall back to last completed week number instead
- Symptom B: User says tab name "Performance" is unclear ("not really about performance")
- Fix A: derive weekNumber from last completed period when active is null
- Fix B (P2): rename tab in `TeamNav.tsx` to "My Season" or "Season Stats"
- Files: `components/sim/GMCommandCenter.tsx` (line 55), `app/team/[teamId]/schedule/page.tsx`, `components/TeamNav.tsx`

**How to apply:** When looking at Sprint 9 scope, these two P1 bug fixes are already in the sprint plan alongside REBRAND stories. They are small (S effort each) and should be prioritized before or alongside the P1 rebrand items. The feedback system is live and collecting real user input — check `FeedbackSubmission` table via Prisma before each sprint planning.

**Why:** Both bugs came from the same founding commissioner (same userId) using a replay league, likely the first real user exercising the product end-to-end.
