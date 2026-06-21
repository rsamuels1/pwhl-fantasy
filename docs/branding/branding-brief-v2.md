As of 6/21/26, this document is the source-of-truth for how we should be making people FEEL about playing PWHL Fantasy Hockey

PWHL GM – Design Feedback Implementation Plan

Overview

The critique is not suggesting that the mechanics are wrong.

It is suggesting that the emotional framing is wrong.

Current framing

You are operating a fantasy hockey management simulator.

Desired framing

You are following your team through a season, celebrating wins, surviving rough stretches, and building rivalries.

This should be approached as an experience layer project, not a redesign of the game systems.

⸻

Existing Opportunities in the Codebase

The repository already contains several pieces that can support this work.

Existing Components

* app/page.tsx
    * Contains the “Think Like a GM.” messaging.
* components/WelcomeFlow.tsx
    * Existing onboarding flow.
    * Primarily feature orientation.
    * Could evolve into emotional onboarding.
* app/team/[teamId]/matchup/page.tsx
    * Rival badge support
    * Rivalry logic
    * Dedicated playoff matchup experience
    * Win probability calculations

Existing Infrastructure

Roadmap documents already reference onboarding and future sprint planning.

Minimal backend changes should be required.

⸻

Sprint 1 — Emotional Copy Pass

Estimated effort: 1–2 days

This sprint delivers the highest impact for the least engineering effort.

⸻

Landing Page Messaging

Current

Think Like a GM.

Suggested

Follow your team. Build rivalries. Chase the Cup.

Alternative options:

Every week tells a story.
Your PWHL season starts here.

Files:

app/page.tsx
components/WelcomeFlow.tsx

⸻

Win Probability Language

Current

60% win probability

Suggested

🔥 You're favored this week
60% chance to win
Your lineup is projected to outscore Toronto by 9 points.

Probability Messaging

Probability	Messaging
>70%	You’re in a strong position
55–70%	You have the edge
45–55%	Too close to call
30–45%	You’ll need a big performance
<30%	Time for an upset

⸻

Reframing Poor Records

Current

0–7

Suggested

0–7 this season
Still 15 weeks left to climb.
Last week: season-high 126 points

Alternative:

0–7
Every rivalry starts somewhere.

⸻

Rival Results Visibility

Current feedback suggests rivalry outcomes are hidden inside accordions.

Recommendation:

Move rivalry outcomes into a visible summary card near the top of the matchup page.

Example:

🔥 Rivalry Won
You defeated Montreal again.
Series Record: 4–1

⸻

Sprint 2 — Celebrate Moments

Estimated effort: 3–4 days

Goal:

Increase warmth and emotional payoff.

⸻

StoryCard Component

Create:

components/StoryCard.tsx

Purpose:

Surface notable moments from the season.

⸻

Example

━━━━━━━━━━━━━━━━━━━━━━━
🎉 Big Week
You beat Northern Stars by 18 points.
That's your largest margin of victory
this season.
━━━━━━━━━━━━━━━━━━━━━━━

⸻

Possible Story Types

Victory

🏆 Huge Win
You moved into 4th place.

⸻

Rivalry Victory

🔥 Rivalry Won
You defeated Montreal again.
Series record: 4–1

⸻

Underdog Story

⭐ Upset Alert
You had only a 34% chance to win.

⸻

Losing Streak

💙 Tough Stretch
Three losses in a row.
You are only 12 points from a playoff spot.

⸻

Implementation Notes

Leverage existing matchup calculations.

Most work should be presentation logic.

Potential insertion point:

app/team/[teamId]/matchup/page.tsx

⸻

Sprint 3 — First-Time Experience Layer

Estimated effort: 4–5 days

This directly addresses the critique:

Holds a new user’s hand through the vocabulary.

Current onboarding explains features.

New onboarding should explain concepts.

⸻

Step 1 — Welcome

👋 Welcome to PWHL GM
You don't need to know fantasy hockey.
We'll explain things as you go.

Button:

Show me around

⸻

Step 2 — Victory Points

Victory Points decide the standings.
Win your matchup
+
Finish among the week's highest scorers
=
Earn more VP

⸻

Step 3 — Rivals

Every team has a rival.
Beat them often enough and the rivalry
becomes part of your season story.

⸻

Step 4 — Win Probability

This isn't a prediction.
It's a snapshot based on projected points.
Underdogs win all the time.

⸻

Persistence

Suggested flags:

user.onboardingVersion

or

user.hasSeenSeasonGuide

There already appears to be support through:

/ api / user / onboarding

This experience should fit naturally into existing infrastructure.

⸻

Prioritization

P0 — Must Ship

* Replace “Think Like a GM”
* Rewrite probability language
* Add contextual messaging for poor records
* Surface rivalry outcomes outside accordions

⸻

P1 — Should Ship

* StoryCard component
* Celebration states
* Rival win banners
* Upset banners

⸻

P2 — Nice to Have

* Guided vocabulary tour
* First-week coach persona
* Season recap cards

⸻

Recommended Positioning

The GM identity should not disappear entirely.

The mechanics genuinely support a GM fantasy.

The issue is positioning.

Current

Think Like a GM

Proposed

Be a fan first. Make decisions like a GM.

This preserves the strategic depth while making the experience feel connected to following a favorite team rather than operating a spreadsheet.

⸻

Estimated Scope

Approximately one week of engineering work.

Expected changes are primarily:

* Copy updates
* UI presentation improvements
* Additional onboarding content

Backend changes should be minimal or unnecessary.