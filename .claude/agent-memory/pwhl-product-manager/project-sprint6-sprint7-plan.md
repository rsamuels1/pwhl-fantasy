---
name: sprint6-sprint7-plan
description: Sprint 6 (Engagement + Transactions) and Sprint 7 (Retention Layer) planning decisions, item sequencing, and deferred backlog — established June 13, 2026
metadata:
  type: project
---

Sprint 6 and Sprint 7 were planned June 13, 2026 as part of a full backlog audit.

**Sprint 6 — "Engagement + Transactions" (5 items, P1):**
1. Auto-Set Lineup — spec exists at `docs/02-engineering/auto-set-lineup-spec.md`
2. Beta Feedback Infrastructure — spec at `docs/02-engineering/beta-feedback-spec.md`; adds `FeedbackSubmission` table + `betaStatus` on `FantasyLeague`
3. Team Analysis & Insights (#25) — spec at `docs/02-engineering/team-analysis-spec.md`; trade suggestion CTA deferred until #7
4. Trade System (#7) — spec at `docs/02-engineering/trade-spec.md`
5. Waiver Priority + Processing (#5) — spec at `docs/02-engineering/waiver-spec.md`

**Sprint 7 — "Retention Layer" (4 items + stretch, P2):**
1. League History & Hall of Fame (#33/#18) — spec at `docs/02-engineering/league-history-spec.md`; no schema changes (uses existing parentLeagueId chain)
2. League-Wide Matchup Storylines (#11) — spec at `docs/02-engineering/matchup-storylines-spec.md`; no schema changes
3. FAAB (#6) — depends on Sprint 6 Waiver (#5) being complete
4. Player Legacy (#31) — ship skeleton; meaningful only after first renewed season
Stretch: Email Notifications — add only if beta feedback surfaces as P1

**Key decisions:**
- Sprint 6 starts with engagement/UX (auto-set, analysis) before transactions (trade, waiver) — user value first
- Beta Feedback Infrastructure moved UP from "revisit later" to Sprint 6 P2 — founding commissioners will be live during Sprint 6
- League History deferred to Sprint 7 (not Sprint 6) because it requires at least a partial season to be meaningful
- Post-Sprint-7 backlog: growth analytics, real-time push scoring, push notifications, multi-season historical library (#12), player trends (#23), keeper/dynasty, native apps

**Why:** targeting ~80 days to public launch (early Nov 2026); each sprint is ~2 days (solo + Claude Pro); Sprint 7 is the last planned sprint — anything beyond goes to backlog.

**How to apply:** When the user asks about sequencing, reference this ordering. Auto-set lineup is the highest-value Sprint 6 item. Trade system is the highest-risk (largest new domain, ~130K tokens — plan a dedicated session).
