---
name: rival-feature-findings
description: The Rival badge feature — why "most-played" rival is broken in VTF, and the standings-redesign critique
metadata:
  type: project
---

The 🔥 Rival feature picks a "rival" opponent and shows a badge on the matchup page.

## Why it's broken in VTF (the default mode)
`getRival()` in `lib/playoffs/seeding.ts` defines rival = opponent with the MOST completed matchups, tie-broken by best W/L record. In VTF every team is paired vs every other team every week (storage substrate — see [[vtf-field-model]]), so matchup count is always tied across all opponents. The tie-break then selects the opponent you have the best record against — i.e. your WEAKEST opponent gets crowned your "rival." Backwards and miseducating.

## Proposed redesign (Sprint TBD)
1. Remove rival badge from `/team/[teamId]/matchup` (RivalBadge.tsx, rendered Z4).
2. Redefine VTF rival = smallest average scoring margin (tightest contests regardless of who won).
3. Move to standings: inline 🔥 chip on the rival's row + an explainer module below.

## Critical placement fact (don't miss)
There are TWO standings pages:
- `/league/[leagueId]/standings/page.tsx` — commissioner-only (Sprint 19 redirect).
- `/team/[teamId]/standings/page.tsx` — reached by EVERY manager via the "Standings" tab in `TeamNav.tsx` (line 29). THIS is where a rival chip must live to be seen by managers. The league one is secondary.
The two pages have diverged (different `card`/`th`/`td` styles, league one has race chips/magic number/BubbleWatch, team one is simpler). Any rival chip must be built on the team-scoped page or it won't reach players.

## UX verdict on the proposal
- Moving rival OFF the matchup hero is correct — it relieves the overloaded Z1–Z9 matchup page and removes the "this is your opponent" lie in VTF.
- Standings is a defensible home BUT it's a low-emotion, analytical page. A bare chip there will feel clinical. Needs a narrative module to carry the emotion.
- "Smallest average margin" is the right SIGNAL but the wrong WORD. New fans don't think in margins. Frame it as "your closest races" / "neck-and-neck."
- Minimum-2-scored-weeks gate is essential — a rival declared off one week is arbitrary and erodes trust.
- The standings row chip is color+emoji; ensure a text label "RIVAL" accompanies the 🔥 (a11y — color-only signals already flagged in [[emoji-policy]]).
