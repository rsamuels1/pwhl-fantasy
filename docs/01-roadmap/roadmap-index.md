# PWHL Fantasy Product Roadmap — Index

Last Updated: June 13, 2026

---

## What Is This?

This document serves as the source of truth for future development priorities. Detailed feature cards live in [roadmap-features.md](roadmap-features.md); sprint plans and history live in [roadmap-sprints.md](roadmap-sprints.md).

**When choosing what to build next:**

1. Prioritize unfinished items in the current phase before moving to later phases.
2. Favor user-facing functionality over technical optimization unless stability is at risk.
3. Build for the live season first. Historical Replay is a testing/QA tool, not the product — don't let replay requirements shape or slow down live-season features.
4. New features should not break replay mode, but they do not need to be designed around it.

---

## Product Vision

PWHL Fantasy is the premier fantasy platform for Professional Women's Hockey League fans.

The flagship experience is the live fantasy season: drafting real players, setting weekly lineups, and competing in matchups scored from real PWHL games.

The platform should support:

- Live fantasy leagues (the core product)
- Commissioner customization
- Deep roster management
- Long-term league retention

Historical Replay is an internal/QA tool that lets us exercise the full season loop against completed seasons before live data exists. It is valuable for user testing and dev iteration, but it is not a user-facing flagship and should not be prioritized as one.

---

## Current State

Implemented systems include:

- Authentication & user accounts
- League creation & management (commissioner admin panel: team management, draft setup, season controls, announcements)
- Draft room (live WebSocket draft, queue, auto-draft, auto-escalation)
- Rosters & lineups (locking, play-lock rule, games-remaining badges, projected FPTS)
- Matchups (VTF regular season + 1v1 playoffs) & Matchup Center / Fantasy Home (hero scores, top performers, swing players, storyline chip, playing-tonight, roster breakdown)
- Projections & Win Probability engine
- Standings (with playoff race clinch/eliminate indicators)
- Playoffs (seeding, bracket, single-elimination)
- Historical Replay & Season advancement / lifecycle
- Schedule management & scoring engine (VTF point scoring)
- Victory Point (VP) scoring model (win/placement bonuses, `homeVP`/`awayVP`)
- Free-agent add/drop (immediate)
- Live score polling (client-side refresh during active matchups)
- Season-long head-to-head (rivalry) records
- Commissioner Recovery Tools (force roster move, undo transaction, replace inactive manager)
- Commissioner Admin Center (audit log visibility, draft pause visibility, season renewal entry point)
- Draft Analytics (6 events instrumented)
- League Creation UX (8-team recommendation)
- In-app notifications (all three MVP-critical types)

These systems should be considered core platform functionality.

---

## MVP Readiness Scorecard

Snapshot of launch-blocking areas. **Confidence to launch: ~95%.**

| Area | Status | Blocker |
|---|---|---|
| League creation | ✅ PASS | — |
| Draft | ⚠️ PASS WITH RISKS | reconnect ✅ · commissioner auth ✅ · auto-pick position-aware ✅ · duplicate-tab unvalidated |
| Rosters | ✅ PASS | — |
| Weekly matchups | ✅ PASS | — |
| VP standings | ✅ PASS | — |
| Weekly lineup lock | ✅ PASS | — |
| Playoffs | ✅ PASS | — |
| Commissioner tools | ✅ PASS | force move, undo transaction, replace manager, audit log all shipped |
| Notifications | ✅ PASS | all 3 MVP-critical types shipped (draft starting, on the clock, lineup incomplete) |
| Analytics | ✅ PASS | 6 events instrumented |
| End-to-end season sim | ✅ PASS | — |

**Remaining soft blockers:** draft duplicate-tab handling (unvalidated).

---

## MVP Definition & Launch Gates

MVP proves a league can go **Create → Invite → Draft → Set Lineups → Compete → Make Playoffs → Crown Champion** with no commissioner intervention or database surgery. Full scope in `docs/mvp-definition.md`.

**In scope:** league create / config / invite · snake draft with timer + auto-pick + reconnect (8- and 10-team) · roster validation · weekly lineup lock + partial-week subs · hybrid H2H + VP standings · 4-team playoffs ending before PWHL playoffs · commissioner recovery tools (pause/resume draft, replace manager, force move, undo, audit log) · critical notifications (draft starting, on the clock, lineup incomplete).

**Out of scope for MVP:** trades, waivers, FAAB (may add pre-launch only if implementation risk is low) · keeper / dynasty · referral / growth loops · AI features · native apps.

**Launch gates — all must pass:** rules match implementation · draft reliability validated · VP standings validated · playoff qualification validated · end-to-end season simulation completed · commissioner recovery tools available.

---

## What To Build Next

The list below is sequenced by **token efficiency** — each feature's estimated Claude Pro context cost is shown so sessions can be batched optimally.

**Token sizing:** CLAUDE.md + system overhead uses ~15K tokens of fixed cost per session. Claude Pro's 200K context window fits 2–3 quick-win features or one heavy lift per session comfortably.

### Quick wins (< 45K tokens — batch 2–3 per session)

1. **Playoff Experience UX (#30)** · ~40K
   Bracket prominence, champion banner, between-round nudge. Polish on existing pages; no schema changes.

### Standard sessions (60–90K tokens — one feature per session)

2. **Error Handling (#4)** · ~65K
   Empty + loading states across all core pages. Many files but each change is small and localized.

3. **Weekly Performance Dashboard (#29)** · ~65K
   New page replacing the Schedule tab. Aggregates existing `Matchup` + `StatLine` rows; no schema changes.

4. **Team Analysis & Insights (#25)** · ~85K
   New Analysis tab on the matchup page. Complex aggregation but all reads on existing data; trade suggestions deferred until Trade System exists.

5. **League Onboarding (#2)** · ~100K ✅ (SHIPPED)
   Welcome flow, 6-step wizard, manager draft prep guide, replay explanation; `User.onboardingCompletedAt` schema field.

6. **Transaction History (#8)** · ~55K ✅ (SHIPPED)
   Paginated API + transaction page with type/team filters, replay guard, infinite scroll. No schema changes.

### Heavy lifts (100K+ tokens — plan a fresh session)

7. **Trade System (#7)** · ~130K
   New domain: schema tables, API routes, proposal/review/approval UI. Plan a dedicated session. Built on top of Transaction History.

8. **Waiver Priority + Processing (#5)** · ~110K
   Waiver priority ordering, batched claim-resolution jobs, commissioner settings.

**Stretch (differentiators, not beta blockers):** league-wide matchup storylines (#11 · ~50K) and the rivalry/Hall-of-Fame retention layer (#17–#18). Player Legacy (#31 · ~95K) deferred until at least one live season completes. Replay work (Phase 4) stays out of this list.

---

## See Also

- [roadmap-features.md](roadmap-features.md) — all feature cards (Phases 0–7), full specifications
- [roadmap-sprints.md](roadmap-sprints.md) — sprint plans, sprint history, launch timeline
- [CLAUDE.md](../../CLAUDE.md) — codebase reference and engineering guidelines
