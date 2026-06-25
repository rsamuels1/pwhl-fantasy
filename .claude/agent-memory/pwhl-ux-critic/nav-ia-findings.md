---
name: nav-ia-findings
description: Navigation IA recommendations for league nav slim-down and Morning Skate placement; max-5-tab discipline
metadata:
  type: project
---

Navigation IA review (asked 2026-06-25): league nav had 11 tabs (Overview, Standings, Morning Skate, Scoreboard, Playoffs, Records, Leaders, Transactions, How it works, Sim, Admin). Team nav already slimmed to 5 + More.

**Recommendations given:**

League nav (members) → max 5 primary: **Standings · Scoreboard · Results · Playoffs* · More**
- Playoffs is conditional — only promote when `playoffStatus !== "NOT_STARTED"`; otherwise lives in More. Showing a Playoffs tab in week 2 falsely implies season's almost over.
- More menu holds: How it works (pinned top), Records, Leaders, Transactions.
- **Drop "Overview" as a tab** — the league hub IS the overview; tapping the league name returns there. An Overview tab pointing at the page you land on is the "Home tab on the home page" anti-pattern. Doubly broken post-Sprint-19 since overview is commissioner-only (members get redirected).
- **Admin + Sim are operator tools, NOT fan tabs.** Pull both out of the tab row. Single visually-separated "⚙ Admin" on far right for commissioners; Sim lives inside Admin/Season, not the nav. Sim is dev/operator tooling and should never be a peer of fan-facing tabs.

Morning Skate → **MOVE to My Franchise as a PRIMARY tab** (not More). Rationale: lead story is the manager's own team; it's the "what just happened to me" weekly recap (Madden Weekly Wrap-Up analogy — recap first, then act). Completes the loop the matchup-page Morning Skate preview card already starts; keeps the regular member inside the My Franchise zone (post-Sprint-19, league zone is commissioner-oriented). Counter-args (league-wide storylines, broadcast feature) don't hold: a newspaper is delivered to your house, not read at city hall. Keep a small "latest edition →" LINK (not a tab) in the commissioner overview for broadcast oversight.

**How to apply:** When reviewing any nav, enforce max-5-primary-tab discipline for this phone-first, new-to-fantasy audience. Land-on-it pages should not also be tabs. Operator/commissioner tooling belongs behind a separated affordance, never inline with fan content. Related: [[wins-keep]].
