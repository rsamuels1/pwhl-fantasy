This is actually the review I think will produce the biggest improvements right now.

Because after looking at everything we’ve discussed, I don’t think the primary problem is:

* Homepage messaging
* Authentication
* Mobile responsiveness
* Commissioner UX

Those all matter.

The deeper issue is:

The application’s structure reflects how fantasy systems are built, not how fantasy players think.

⸻

What Information Architecture Means Here

The question is:

What are the primary objects in the user’s mind?

Right now I believe the app is organized around:

League
 ├ Matchups
 ├ Teams
 ├ Standings
 ├ Draft
 └ Settings

which makes perfect sense from a database perspective.

But users don’t think this way.

⸻

ESPN’s Actual Information Architecture

Most people think ESPN is organized around leagues.

It isn’t.

It’s organized around:

Me
 ↓
My Team
 ↓
My Matchup
 ↓
My League

That’s subtle but important.

When I open ESPN:

I don’t ask:

What league am I in?

I ask:

Am I winning?

⸻

Current PWHL Fantasy IA

I think the current structure is roughly:

Dashboard
Leagues
 └ League
      ├ Matchups
      ├ Roster
      ├ Standings
      ├ Draft
      ├ Settings

This creates a league-centric experience.

⸻

Recommended Future IA

I would move toward:

Fantasy Home
│
├ My Matchups
├ My Teams
├ Alerts
├ Drafts
└ Activity

Then:

Team
│
├ Matchup
├ Lineup
├ Roster
├ Transactions
└ Team History

Then:

League
│
├ Standings
├ Schedule
├ Activity
├ Teams
└ Playoffs

Notice something important.

League becomes a context.

Not the root.

⸻

Current Navigation Audit

Based on the screenshots and routes we’ve discussed:

Current mental flow:

League
 ↓
Roster
 ↓
Matchup

Desired:

Matchup
 ↓
Team
 ↓
League

⸻

Route Structure Audit

Current routes seem approximately:

/league/[leagueId]
/league/[leagueId]/roster
/league/[leagueId]/matchups
/team/[teamId]/roster
/team/[teamId]/lineup

This is already partially transitioning toward team-centric design.

That’s good.

⸻

Missing Root Route

The biggest IA gap:

There is no obvious:

/home

or

/fantasy

concept.

⸻

Currently:

Login
 ↓
League

I would want:

Login
 ↓
Fantasy Home

⸻

Fantasy Home Architecture

This page becomes the center of the product.

⸻

Section 1

Current competition

Commish League
Leading by 4.2
67% win chance

⸻

Section 2

Action items

Lineup lock in 2 hours
Draft tomorrow
Waivers process tonight

⸻

Section 3

Recent player performance

Taylor Heise +15.4
Sarah Fillier +12.1

⸻

Section 4

League activity

Only after the above.

⸻

Team Architecture

I think Team should become the most important object in the product.

Current:

League
 ↓
Team

Desired:

Team
 ↓
League

⸻

A team page should answer:

How is my team doing?

⸻

Matchup Architecture

This is where I think the biggest improvement exists.

Currently matchup is a destination.

It should become the backbone of the product.

⸻

Every important page should surface:

Current matchup status

Examples:

Team Page

You lead by 4.2

⸻

League Page

Current matchup:

⸻

Home Page

Current matchup:

⸻

The matchup should be visible almost everywhere.

⸻

League Page Audit

Right now the league page feels like:

League Administration

plus

League Reporting

⸻

I’d transform it into:

Current Week
Matchups
Playoff Race
League Activity
Standings

⸻

Notice:

Standings move down.

Matchups move up.

⸻

Draft Architecture

Draft is currently treated like:

League Feature

⸻

I would treat draft as:

Major Event

⸻

Meaning:

Fantasy Home should show:

Draft starts tomorrow

not require users to navigate to a league.

⸻

Mobile IA

Current navigation feels like website navigation.

⸻

Future mobile navigation:

🏒 Matchup
👥 Team
🔍 Players
🏆 League
☰ More

⸻

Not:

Home
Leagues
Account

⸻

The Most Important IA Change

If I could only change one thing:

Create:

/home

or

/fantasy

that becomes:

The place users land after login.

Not a league.

Not a roster.

Not standings.

A fantasy home focused on:

My Matchups
My Teams
My Decisions
My Alerts

⸻

Information Architecture Maturity Model

Current

League-centric

⸻

Next Stage

Team-centric

⸻

Long-Term Goal

Competition-centric

Where the primary object becomes:

Current Matchup

and everything else exists to support that.

⸻

If I were writing a Claude Code implementation brief, I’d summarize the entire IA review like this:

Audit every route, page, navigation item, and dashboard component. Determine whether it is organized around League, Team, or Matchup. Redesign the hierarchy so that Matchup becomes the primary experience, Team becomes the primary management object, and League becomes contextual information rather than the root of the application. The goal is to make the product feel closer to ESPN Fantasy and Sleeper, where users open the app to check how they’re doing, not to manage league infrastructure.