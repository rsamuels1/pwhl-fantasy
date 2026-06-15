---
name: sprint6-sprint7-plan
description: Sprint 6 (Engagement + Transactions) and Sprint 7 (Retention Layer) planning decisions, item sequencing, and deferred backlog — established June 13, 2026; updated June 14, 2026
metadata:
  type: project
---

Sprint 6 and Sprint 7 were planned June 13, 2026 as part of a full backlog audit. Updated June 14, 2026 to add Code Review (#37) to Sprint 6 and Replay Sim V2 (#38) to Sprint 7.

**Sprint 6 — "Engagement + Transactions" (6 items, P1):**
1. Auto-Set Lineup (#34) — DONE ✅
2. FA Schedule Awareness + Add & Slot (#35) — DONE ✅
3. Beta Feedback Infrastructure (#36) — DONE ✅
4. Code Review & Pre-Beta Audit (#37) — NEW (added 2026-06-14); must complete before beta invites; output: prioritized findings doc in `docs/04-operations/` or `docs/02-engineering/`
5. Team Analysis & Insights (#25) — spec at `docs/02-engineering/team-analysis-spec.md`; trade suggestion CTA removed (Trade System now deferred)
6. Waiver Priority + Processing (#5) — spec at `docs/02-engineering/waiver-spec.md`

**Trade System (#7) — REMOVED from Sprint 6. Moved to bottom of backlog as "someday maybe." Do NOT re-add without explicit user instruction.**

**Sprint 7 — "Retention Layer" (5 items + stretch, P2):**
1. League History & Hall of Fame (#33/#18) — spec at `docs/02-engineering/league-history-spec.md`; no schema changes (uses existing parentLeagueId chain)
2. League-Wide Matchup Storylines (#11) — spec at `docs/02-engineering/matchup-storylines-spec.md`; no schema changes
3. FAAB (#6) — depends on Sprint 6 Waiver (#5) being complete
4. Player Legacy (#31) — ship skeleton; meaningful only after first renewed season
5. Replay Simulation V2 (#38) — NEW (added 2026-06-14); configurable playback speed, jump-to-week, progress summary card, notification trigger points; builds on `isReplay`/`replayCurrentDate`/`getReplayNow()`/`ReplayDayBar`; no schema changes except new `REPLAY_WEEK_COMPLETE` NotificationType enum value
Stretch: Email Notifications — add only if beta feedback surfaces as P1

**Key decisions:**
- Code Review (#37) added to Sprint 6 as a gate before beta invites (2026-06-14) — must happen while the codebase is still clean, before real user data arrives
- Replay Sim V2 (#38) added to Sprint 7 as Priority 5 (2026-06-14) — replay is a QA/engagement tool; V2 features (speed controls, jump-to-week, progress card, notifications) directly serve the founding commissioner beta experience
- Sprint 6 starts with engagement/UX (auto-set, analysis) before transactions (trade, waiver) — user value first
- Beta Feedback Infrastructure moved UP from "revisit later" to Sprint 6 P2 — founding commissioners will be live during Sprint 6
- League History deferred to Sprint 7 (not Sprint 6) because it requires at least a partial season to be meaningful
- Post-Sprint-7 backlog: growth analytics, real-time push scoring, push notifications, multi-season historical library (#12), player trends (#23), keeper/dynasty, native apps

**Why:** targeting ~80 days to public launch (early Nov 2026); each sprint is ~2 weeks (solo + Claude Pro); Sprint 7 is the last planned sprint — anything beyond goes to backlog.

**How to apply:** When the user asks about sequencing, reference this ordering. Auto-set, FA awareness, and beta feedback are done. Next Sprint 6 items are Code Review (#37), Team Analysis (#25), and Waivers (#5). Trade System is NOT in the plan — never suggest it as a next step unless the user brings it up.
