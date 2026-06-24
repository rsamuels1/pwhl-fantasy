---
name: trade-proposal-findings
description: Trade proposal flow UX — flat all-at-once layout is the core new-fan problem; recommended stepped Pick-GM→Want→Give→Review flow
metadata:
  type: project
---

Trade Proposal flow (`app/league/[leagueId]/trades/new/ProposeTrade.tsx`, shared by the team-scoped page) — designed a stepped redesign spec on 2026-06-23.

**Core finding:** The existing build already has a partner picker + team-locking (better than assumed), but it renders the entire machine at once — partner chips, both player pickers, the ⇄, message box, summary all stacked. Before a partner is picked, the "Want from league" list dumps all ~80 rostered players. New fantasy fans don't know which decision comes first.

**Why:** This audience can't eyeball player value or hold a multi-part form in working memory. One-decision-per-screen is the fix, not more UI.

**How to apply:** Recommended a 4-step single-page state machine (no new routes): 1) Pick a GM (opponent team cards w/ accentColor bar), 2) Who do you want (partner roster ONLY, FP-sorted), 3) What you offer (own roster ONLY), 4) Review give/get with FP subtotals + send. Counter-offer mode skips step 1 and lands on step 4 pre-filled. Refactor-in-place of ProposeTrade.tsx — same props, same handleSubmit/API.

**Recurring issues this flow shares with the rest of the app:**
- Raw API error strings shown to users (also flagged in [[draft-room-findings]]). Trade errors (roster-legality, play-lock, STALE) need human rewrites.
- FP subtotals on the review card are the cheapest trust signal for newcomers who can't value players.
- Server page passes `myRoster`/`leaguePlayers` but NOT `accentColor` — add to `fantasyTeam` select for Step 1 team-identity bars (first reuse of [[redesign-bundle-provenance]] RD-013 team colors outside standings/DuelHero).
