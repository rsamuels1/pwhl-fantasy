---
name: beta-replay-findings
description: Beta replay end-to-end test (run 2) — team-page 500s, trade 422, VTF/head-to-head copy contradiction, 4-week ambiguity
metadata:
  type: project
---

End-to-end beta test on `https://beta.fantasy.dykedb.org` of a `useBetaReplay:true` league ("Beta Agent Test 1", id `beta-agent-t-tuko`), 2026-06-25.

**CRITICAL: all `/team/[teamId]/*` pages return HTTP 500** (matchup, roster, schedule, analysis, trades/new) in a freshly-drafted beta replay league, while every `/league/[leagueId]/*` page returns 200.
**Why:** the shared `app/team/[teamId]/layout.tsx` is the only component common to all failing pages; it queries `prisma.trophy.count` (Sprint 25 model) and `prisma.matchup`. The `matchup-summary` API (the page's data source) returns 200, so the failure is in the page/layout render, not the data layer. Strongly points to **schema drift on the beta Neon DB** — `prisma migrate deploy`/`db push` not run after Sprint 25 (Trophy) on the `pwhl-gm-beta` branch.
**How to apply:** non-commissioners are redirected to `/team/[teamId]/matchup`, so a regular beta user logging in hits a 500 immediately. This is the #1 launch blocker. Fix = run the pending migration on the beta DB, then re-verify all `/team/*` routes. Don't run db push from the agent — it's Ryan's call.

**Trade 422 CONFIRMED still present:** with commissioner review enabled, `proposeTrade` creates the trade already in `ACCEPTED` state (with `reviewEndsAt` set). The receiver's `/accept` then returns 422 "Trade cannot be accepted in its current state (ACCEPTED)." Commissioner `/review {action:"approve"}` works and executes the trade. So receiver-accept is dead under commissioner review; only the commissioner path completes a trade. See [[trade-proposal-findings]].

**VTF vs "head-to-head" copy contradiction CONFIRMED (systemic):** beta welcome screen + create-league copy say "weekly head-to-head VP scoring," but the model is VTF. The `/league/[id]/how-it-works` page and `/matchups` (Scoreboard) page both correctly say "vs the field — not just one opponent." The product KNOWS it's VTF; the onboarding/wizard copy is the outlier and must be fixed. See [[vtf-field-model]].

**"Four weeks" ambiguity:** beta welcome says "four real weeks from 2025-26." Actual setup (create/route.ts lines 50-78): 2 regular-season weeks + 2 playoff weeks. Standings/scoreboard show only 2 regular weeks (`totalWeeks:2`). New users will count 2 weeks and feel misled.

**Beta replay is real-calendar, NOT sim-date:** `create/route.ts` sets `replayCurrentDate=null` for beta replay → `getReplayNow` falls back to real now; periods are created at real-calendar dates (week 1 = today+1 → +8 days) and games are pulled via a `betaWeekMappings` fixture-week table, not by date-range query. So `gamesTotal:0` in the season-state API is misleading but expected; the season genuinely goes live on the real calendar. No manual replay-date set needed.

**Projection sanity bug:** matchup-summary returns `myProjected: 824.4` for a weekly projection — nonsensical to a new fan (real weekly totals ~20-60 FP). Projection likely multiplies rolling avg by too many scheduled fixture games in the mapped window.

**Auth:** beta-subdomain password login worked (`replay-commish@dev.local`/`password`). Cookie is `pwhl_user_email=<email>`, host-scoped to beta. (Note: cookie is unsigned plaintext email — any value can be forged; known dev-auth design.)

**Positives confirmed still holding:** how-it-works page (full FP table, every stat abbr spelled out, VTF explained, FA vs Waiver), scoreboard VTF framing ("No single opponent"), auto-draft produces valid 13-slot lineups for all 6 teams, FA add/drop API works, login page server-rendered with season-timing chip + replay CTA.
