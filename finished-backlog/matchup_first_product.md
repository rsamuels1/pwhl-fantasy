Shifting PWHL Fantasy from a League Management App to a Weekly Matchup Competition App

Core Thesis

Most fantasy users do not primarily care about:

* League settings
* Standings
* Team management
* Administrative tools

They care about:

* Am I winning?
* Who is helping me win?
* Who is hurting me?
* What players remain tonight?
* What are my chances?

The product should be optimized around the weekly matchup experience.

⸻

Product Reframing

Current mental model:

Fantasy League Management App

User flow:

Login
→ League Overview
→ Standings
→ Roster
→ Matchup

Recommended mental model:

Weekly Matchup Competition App

User flow:

Login
→ Current Matchup
→ Remaining Players
→ Top Performers
→ League Activity
→ Everything Else

The matchup becomes the center of the experience.

⸻

Dashboard Redesign

Current Goal

Show league information.

New Goal

Answer:

“How am I doing right now?”

within two seconds.

⸻

Recommended Dashboard Hierarchy

Hero Section

Week 7 Matchup

You: 89.2
Opponent: 84.6

Projected:
112.1
109.4

67% chance to win

⸻

Remaining Players

Players still active tonight.

Show:

* Player name
* Current points
* Projected points
* Game status

⸻

Top Performers

Show:

🔥 Best performers

❄ Biggest disappointments

Highlight score impact.

⸻

League Activity

Examples:

* Player adds
* Player drops
* Trades
* Major performances
* Playoff qualification events

This creates engagement and repeat visits.

⸻

Standings

Standings move lower on the page.

Users check standings occasionally.

Users check matchups constantly.

⸻

Dashboard Service Layer

Create:

lib/services/dashboard.ts

Return a complete dashboard view model.

Example:

type DashboardData = {
activeMatchup
projectedOutcome
topPerformers
remainingPlayers
leagueActivity
}

The dashboard should fetch one aggregate object instead of many unrelated datasets.

⸻

Matchup Summary API

Create a dedicated matchup summary endpoint.

Example:

GET /api/leagues/[leagueId]/matchup-summary

Returns:

{
matchup,
myScore,
opponentScore,
myProjected,
opponentProjected,
winProbability,
topPerformers,
remainingPlayers
}

This becomes reusable across:

* Dashboard
* Matchup page
* Notifications
* Future mobile experiences

⸻

Introduce Matchup Projections

Create:

lib/projections/

Example:

type MatchupProjection = {
myProjectedScore: number
opponentProjectedScore: number
winProbability: number
remainingPlayers: PlayerProjection[]
}

Even basic projections based on rolling averages create substantial UX value.

⸻

Score Transparency

One of the highest-value UX improvements.

Current view:

Sarah Fillier
15.5

Recommended view:

Sarah Fillier
15.5

* 2 Goals (+10)
* 1 Assist (+3)
* 5 Shots (+2.5)

Users trust systems that explain themselves.

Implementation suggestion:

scorePlayer()

scorePlayerDetailed()

Where scorePlayerDetailed() returns scoring components.

⸻

Matchup Swing Players

Create:

lib/matchups/swingPlayers.ts

Identify players most likely to determine matchup outcome.

Example:

Matchup Swing Players

Taylor Heise
Projected Impact: +12.4

Sarah Fillier
Projected Impact: +10.1

This helps users understand what matters most.

⸻

League Activity Feed

Create a first-class activity system.

Events:

* Add
* Drop
* Trade
* Draft Pick
* Playoff Qualification
* Major Player Performance

Display directly beneath matchup information.

Fantasy products are social products.

⸻

Routing Changes

Current direction:

/league/[leagueId]

Recommended in-season behavior:

/league/[leagueId]
→ redirect
→ /league/[leagueId]/matchup

Offseason:

/league/[leagueId]/roster

Draft period:

/league/[leagueId]/draft

Users should always land on the most important current activity.

⸻

Dashboard Performance

If matchup becomes the homepage, it becomes the highest-traffic endpoint.

Create a cached dashboard snapshot.

Example:

DashboardSnapshot

Aggregates:

* Matchup
* Standings
* Activity
* Projections

Dashboard loads become a single query rather than many separate queries.

⸻

First Implementation Priority

If only one change is made:

Create:

lib/services/dashboard.ts

Return:

{
activeMatchup,
projectedOutcome,
topPerformers,
remainingPlayers,
leagueActivity
}

Then redesign the dashboard hero section to immediately show:

You lead by 4.6 points

Projected:
112.4 – 108.7

67% chance to win

3 players remaining tonight

This single change shifts the product toward a true matchup-focused fantasy experience.

⸻

Success Metric

A successful dashboard answers:

“Am I winning and why?”

before the user needs to scroll.

Everything else is secondary.