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
- Playoffs (seeding, bracket, single-elimination, full playoff experience UX — bracket-as-primary-landing, elimination/clinch/champion activity events, champion banner, between-round lineup nudge)
- Historical Replay & Season advancement / lifecycle (gap-week handling fixed; "⏩ Sim to playoffs" button scores all remaining regular-season weeks in one click)
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
- Founder Operations Console (`/founder/`) — cross-league monitoring, simulation launcher, end-to-end validator; `FOUNDER_EMAILS` env-var auth gate; no schema change

These systems should be considered core platform functionality.

---

## MVP Readiness Scorecard

Snapshot of launch-blocking areas. **Confidence to launch: ~95%.**

| Area | Status | Blocker |
|---|---|---|
| League creation | ✅ PASS | — |
| Draft | ✅ PASS | reconnect ✅ · commissioner auth ✅ · auto-pick position-aware ✅ · duplicate-tab ✅ |
| Rosters | ✅ PASS | — |
| Weekly matchups | ✅ PASS | — |
| VP standings | ✅ PASS | — |
| Weekly lineup lock | ✅ PASS | — |
| Playoffs | ✅ PASS | — |
| Commissioner tools | ✅ PASS | force move, undo transaction, replace manager, audit log all shipped |
| Notifications | ✅ PASS | all 3 MVP-critical types shipped (draft starting, on the clock, lineup incomplete) |
| Analytics | ✅ PASS | 6 events instrumented |
| End-to-end season sim | ✅ PASS | — |

**Remaining soft blockers:** none — all MVP gates green. Ready to invite founding commissioners.

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

1. **Commissioner Workflow Validation** · ~15K · Sprint 5
   End-to-end manual test of all commissioner actions; runbook accuracy review; screenshots. See `docs/02-engineering/commissioner-workflow-validation-plan.md`.

### Standard sessions (60–90K tokens — one feature per session)

2. **Weekly Performance Dashboard (#29)** · ~65K · Sprint 5
   Spec: `docs/02-engineering/weekly-performance-dashboard-spec.md`. New page replacing the Schedule tab. Aggregates existing `Matchup` + `StatLine` rows; no schema changes. Pulled up from Sprint 6 — no schema changes, all reads on existing data, directly serves manager experience during beta.

3. **Auto-Set Lineup** · ~60K · Sprint 6 — P1
   Spec: `docs/02-engineering/auto-set-lineup-spec.md`. One-click optimal lineup fill (staged save, auto-set algorithm, FA suggestions, playoff period fallback). No schema changes.

4. **Beta Feedback Infrastructure** · ~40K · Sprint 6
   Spec: `docs/02-engineering/beta-feedback-spec.md`. In-app feedback widget + `FeedbackSubmission` table + Founder Console feed. `betaStatus` field on `FantasyLeague`.

5. **Team Analysis & Insights (#25)** · ~85K · Sprint 6
   Spec: `docs/02-engineering/team-analysis-spec.md`. New Analysis tab on the matchup page. Player trends + position-group vs league median + FA suggestions. Trade suggestion CTA deferred until #7.

6. **Trade System (#7)** · ~130K · Sprint 6
   Spec: `docs/02-engineering/trade-spec.md`. Dedicated session. `Trade`/`TradeOffer` schema, proposal/accept/reject flow, commissioner review gate.

7. **Waiver Priority + Processing (#5)** · ~110K · Sprint 6
   Spec: `docs/02-engineering/waiver-spec.md`. Rolling priority, 48h window, daily batch processing. `WaiverClaim` + `WaiverPriority` tables.

**Shipped:**
- **League Onboarding (#2)** · ✅ Welcome flow, 6-step wizard, manager draft prep guide; `User.onboardingCompletedAt` schema field.
- **Transaction History (#8)** · ✅ Paginated API + page with type/team filters, replay guard, infinite scroll.

**Sprint 7 (retention layer):**

8. **League History & Hall of Fame (#33/#18)** · ~50K · Sprint 7
   Spec: `docs/02-engineering/league-history-spec.md`. `/league/[leagueId]/history` page walking `parentLeagueId` chain. Past season cards + Hall of Fame. No schema changes.

9. **League-Wide Matchup Storylines (#11)** · ~50K · Sprint 7
   Spec: `docs/02-engineering/matchup-storylines-spec.md`. `getLeagueStorylines()` service + league overview sidebar card. Closest matchup, point leader, biggest climber. No schema changes.

10. **FAAB (#6)** · ~80K · Sprint 7
    Blind-bid acquisition on top of Sprint 6 waiver system. Depends on #5.

11. **Player Legacy (#31)** · ~95K · Sprint 7
    `/profile` page with career history and global leaderboard. Meaningful only after first completed+renewed season; ship skeleton now.

**Deferred to post-Sprint-7 backlog:** Growth analytics (GR-001/002/003/004) · real-time push scoring · push notifications · multi-season historical library (#12) · player trends (#23) · keeper/dynasty (#19/#20) · native apps / AI features. See `docs/01-roadmap/roadmap-sprints.md` for full backlog list.

---

## See Also

- [roadmap-features.md](roadmap-features.md) — all feature cards (Phases 0–7), full specifications
- [roadmap-sprints.md](roadmap-sprints.md) — sprint plans, sprint history, launch timeline
- [CLAUDE.md](../../CLAUDE.md) — codebase reference and engineering guidelines
