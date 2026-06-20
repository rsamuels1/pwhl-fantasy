---
name: sprint6-sprint7-plan
description: Sprint 6 (complete) and Sprint 7 (Retention Layer) planning decisions — updated June 20, 2026 to pull Trade System into Sprint 7 and push League History/HoF to Sprint 9
metadata:
  type: project
---

Sprint 6 complete (7/7). Sprint 7 is the current active sprint.

**Sprint 6 — "Engagement + Transactions" — COMPLETE ✅**
All 7 items shipped. See project-sprint6-shipped.md.

**Sprint 7 — "Retention Layer" (4 items, P2) — CURRENT:**
1. Trade System (#7) — NEW Priority 1 (pulled from backlog June 20, 2026). Spec: `docs/02-engineering/trade-spec.md`. Rationale: higher priority than League History/HoF for the launch period. Trade proposal / review / approval flow; commissioner review gate; trade history; 3 new notification types; schema: `Trade`/`TradeOffer` tables. Unblocks trade-suggestion CTA in Team Analysis (#25).
2. League-Wide Matchup Storylines (#11) — spec at `docs/02-engineering/matchup-storylines-spec.md`; no schema changes
3. FAAB (#6) — depends on Sprint 6 Waiver (#5) + waiver cron (Sprint 8 P0-1) being live
4. Player Legacy (#31) — ship skeleton; meaningful only after first renewed season
Stretch: Email Notifications — add only if beta feedback surfaces as P1

**League History & Hall of Fame (#33/#18) — MOVED to Sprint 9 tail (P3):**
Moved from Sprint 7 Priority 1 → Sprint 9 tail on June 20, 2026 to make room for Trade System.
Spec at `docs/02-engineering/league-history-spec.md`. Ship skeleton in Sprint 9; fills in after first season renewal.

**Key decisions (June 20, 2026):**
- Trade System pulled from "Someday Maybe" backlog into Sprint 7 Priority 1 — launch period priority over multi-season history.
- League History/HoF pushed to Sprint 9 tail — still planned, just later than originally scoped.
- Team Analysis trade-suggestion CTA (#25) is now unblocked once Trade System ships in Sprint 7.

**Why:** Trade system serves active beta users immediately; League History is only meaningful after a full season completes and renews — Sprint 9 timing lines up better with the first off-season window anyway.

**How to apply:** Trade System IS in Sprint 7 — acknowledge it as an active sprint item. League History/HoF is Sprint 9 P3. Do NOT suggest Trade System as deferred/backlogged.
