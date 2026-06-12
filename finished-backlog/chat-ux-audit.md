After reviewing the screenshots, I think you’ve made good progress on the homepage positioning, but I also think I’ve identified the deeper UX issue that’s still making the product feel different from ESPN/Sleeper.

The biggest finding

You don’t currently have a “game in progress.”

You have:

Dashboard
↓
League
↓
Team
↓
Roster
↓
Standings

What ESPN has is:

Dashboard
↓
My matchup
↓
Winning / losing
↓
Players scoring points

When I looked at the screenshots, the thing that jumped out wasn’t the styling.

It was the absence of urgency.

⸻

The current homepage after login

Current dashboard:

Welcome back
Create League
Join League
Browse Leagues

This is actually a commissioner/admin dashboard.

Not a fantasy player dashboard.

For a user who already belongs to a league, I would remove almost all focus from league creation.

Instead:

Your Teams
Commish Team
No matchup this week
Dev Draft League
Draft starts in 2 days
League Activity

Even that would be better.

⸻

The league overview is trying to be everything

The league overview currently contains:

* standings
* recent results
* summary
* teams
* commissioner controls

This is very ESPN-web circa 2014.

It is not ESPN mobile.

What I’d change

The league overview should become:

League Header
Current Week
Matchups

Then:

Playoff race

Then:

League activity

Then:

Teams

Right now it feels like a reporting dashboard.

⸻

The matchup page is the biggest opportunity

This is where I would spend the next month.

Current:

No matchup scheduled

plus activity feed.

The page is structurally empty.

The page should eventually become:

You
112.4
Opponent
108.7
67% chance to win

Then:

Remaining tonight

Then:

Top performers

Then:

Scoring breakdown

Then:

League activity

Everything else is secondary.

⸻

Team page vs roster page

The roster page currently looks like a database table.

That’s understandable because you’re still building.

But it doesn’t feel like a fantasy team.

⸻

ESPN Mental Model

User opens team page.

Immediately sees:

Starters
Bench
IR

Not:

Table

The table is useful for power users.

The fantasy experience should be:

Sarah Fillier
15.5 pts
Taylor Heise
12.0 pts
Natalie Spooner
8.5 pts

Cards first.

Data table second.

⸻

Mobile audit

This is where I think the biggest improvements are available.

⸻

Good

Single-column layout

Most screens collapse reasonably well.

Dark theme

Looks modern.

Touch targets

Buttons generally appear large enough.

⸻

Needs improvement

Navigation is desktop navigation compressed

Current mobile nav feels like:

Home
Leagues
Username
Logout

This is a website.

Not a fantasy app.

⸻

ESPN-style mobile nav

I would eventually move to:

Matchup
Team
Players
League
More

fixed bottom navigation.

That one change would make the app feel dramatically more native.

⸻

League activity is overused

Almost every screen contains:

League activity

The problem is:

Activity is not the primary thing users care about.

It’s supporting information.

Currently it feels like activity is filling empty space.

⸻

I’d rather see:

My Matchup

or

My Team

occupying that space.

⸻

Commissioner controls

You fixed some of the messaging.

Now I’d hide commissioner functionality more aggressively.

Current:

Admin

appears pretty prominently.

I would move toward:

League
  Settings
  Admin

nested.

Most commissioners spend:

* 95% of time as a player
* 5% of time as a commissioner

The UI should reflect that.

⸻

The missing page: Fantasy Home

This is the biggest feature gap.

You currently have:

Dashboard

but not:

Fantasy Home

Fantasy Home should answer:

How am I doing?

across all leagues.

Example:

Good evening
Commish Team
Leading by 4.2
Dev League
Draft starts tomorrow
1 lineup change recommended
2 waiver claims process tonight

This is the page users open multiple times per day.

⸻

If you want to feel like ESPN

ESPN’s secret is not design.

It’s information hierarchy.

When I open ESPN Fantasy, I immediately know:

Am I winning?

Everything else comes later.

When I open PWHL Fantasy right now, I mostly learn:

What league am I in?

That’s the core difference.

⸻

My recommended roadmap

P0 (next sprint)

1. Convert dashboard into Fantasy Home.
2. Remove create/join league prominence for existing users.
3. Promote active matchup everywhere.
4. Reduce league activity prominence.
5. Hide commissioner functions deeper.

P1

1. Build a true matchup experience.
2. Add projected scores.
3. Add win probability.
4. Add remaining players.
5. Add top performers.

P2

1. Replace roster tables with player cards.
2. Bottom navigation on mobile.
3. Add player-centric views.
4. Add lineup recommendations.

P3

1. Live scoring.
2. Push notifications.
3. Matchup alerts.
4. Waiver alerts.

⸻

If I were giving Claude Code one assignment after this review, it would be:

Audit every page and rank all UI elements by how directly they answer the question “How am I doing right now?” Remove, demote, or relocate elements that do not support that question. Redesign the dashboard, league overview, and matchup pages around the user’s active competition rather than league administration.

That’s the single change that would make the product feel much closer to ESPN Fantasy and much less like a league management application.