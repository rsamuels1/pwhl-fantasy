---
name: wins-keep
description: Design patterns in PWHL GM that already serve new fans well — do not regress these
metadata:
  type: project
---

Patterns observed that work for the new-PWHL-fan audience. Protect these in future reviews:

- **Lineup save model** (app/league/[leagueId]/lineup/LineupManager.tsx): staged "Save Lineup (N changes)" button + "✓ Lineup saved" confirmation + beforeunload guard + click-to-select/click-to-move with plain-language tip ("Tap a player to select them, then tap where to move them"). This is the gold standard interaction in the app.
- **Zero-games warning banner** on lineup: names the specific players with no games left and says "consider moving them to bench." Concrete and human.
- **Standings tooltips**: every cryptic column (VP, MTCH VP, RNK VP, PF, Gap) has a `title=` plain-English explanation, plus a one-line "Win matchup +2 VP..." legend above the table and an inline VpExplainer "?".
- **Playoff race banner** on standings: "You've clinched a playoff spot (#2)" / "On the bubble — hold your spot." Emotional, plain language, no jargon.
- **Empty states with a next action**: standings/lineup empty states route the user somewhere ("Go to admin panel →", "Draft players first").
- **Draft error copy**: "We couldn't complete that draft action. Please try again." and the connection-error block ("Check your internet connection... contact your commissioner") are human, not raw errors.
- **Wizard inline-expandable explanations** (VP details fold-out) — replicate this pattern elsewhere.

How to apply: when a new feature ships, compare its save/confirm/empty-state/error copy against these. If it's worse than the lineup page, it's below the app's own bar.
