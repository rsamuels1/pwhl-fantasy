Authentication, Authorization, and User Flow Audit

Purpose

The current application allows access to league management and commissioner functionality without requiring authentication. This is both a security issue and a UX issue.

The goal of this effort is to:

1. Establish clear user roles.
2. Enforce authorization consistently across the application.
3. Create a user flow centered around the user’s active matchup.
4. Separate commissioner workflows from normal member workflows.
5. Ensure all sensitive actions are protected at multiple layers.

⸻

Phase 1: Audit Existing Access Controls

Objective

Perform a complete audit of all routes, pages, API endpoints, server actions, and any other mutation paths.

Create a matrix documenting:

Resource	Public	Authenticated	League Member	Commissioner
Route/Page	Yes/No	Yes/No	Yes/No	Yes/No
API Endpoint	Yes/No	Yes/No	Yes/No	Yes/No
Server Action	Yes/No	Yes/No	Yes/No	Yes/No

For every resource, identify:

* Current access level
* Intended access level
* Whether authorization exists
* Whether authorization is missing
* Whether authorization is only implemented in the UI

⸻

Deliverable

Produce an audit report that includes:

Critical Issues

Examples:

* Commissioner pages accessible anonymously
* League settings editable without authentication
* League membership not verified
* API endpoints lacking permission checks

Medium Issues

Examples:

* Commissioner navigation visible to all users
* League pages accessible to non-members

Low Issues

Examples:

* Public pages exposing unnecessary metadata

⸻

Phase 2: Define User Roles

The application should support four primary user states.

⸻

Visitor

Not authenticated.

Can:

* View landing page
* Read rules
* Create account
* Log in

Cannot:

* Access leagues
* Access rosters
* Access drafts
* Access commissioner tools
* Access league management

⸻

Authenticated User

Authenticated but not necessarily a member of a league.

Can:

* Create leagues
* Join leagues
* Manage account

Cannot:

* Access leagues they do not belong to
* Access commissioner functionality

⸻

League Member

Member of a league.

Can:

* View league
* View standings
* View matchups
* Set lineups
* Add/drop players
* Participate in drafts

Cannot:

* Modify league settings
* Change scoring rules
* Manage season configuration

⸻

Commissioner

League administrator.

Can:

* Perform all member actions
* Modify league settings
* Manage drafts
* Run commissioner overrides
* Manage season lifecycle

⸻

Phase 3: Authorization Architecture

Authorization should never rely solely on UI visibility.

Every protected action should be enforced at:

1. Page level
2. API level
3. Service/business logic level

⸻

Example

Bad:

if (isCommissioner) {
  renderButton()
}

Good:

Page
→ Verify Commissioner
API
→ Verify Commissioner
Service
→ Verify Commissioner

Even if a user manually invokes an endpoint, authorization must still prevent access.

Expected response:

403 Forbidden

⸻

Phase 4: Route Protection

Public Routes

Examples:

/
/login
/signup
/about
/rules

Accessible to everyone.

⸻

Authenticated Routes

Examples:

/dashboard
/account
/create-league

Require login.

Unauthenticated users should be redirected to:

/login?returnTo=<requested-page>

⸻

League Member Routes

Examples:

/league/[leagueId]
/league/[leagueId]/matchup
/league/[leagueId]/roster
/league/[leagueId]/players
/league/[leagueId]/standings

Requirements:

* User must be authenticated.
* User must belong to the league.

Non-members should receive:

403 Forbidden

or a dedicated access denied page.

⸻

Commissioner Routes

Examples:

/league/[leagueId]/admin
/league/[leagueId]/admin/settings
/league/[leagueId]/admin/draft
/league/[leagueId]/admin/scoring

Requirements:

* Authenticated
* League member
* Commissioner

⸻

Phase 5: Commissioner UX Separation

Commissioner functionality should not be mixed into normal user navigation.

Current anti-pattern:

Matchup
Roster
Standings
Commissioner Tools

Visible to everyone.

⸻

Member Navigation

Matchup
Roster
Players
Standings

⸻

Commissioner Navigation

Matchup
Roster
Players
Standings
Admin

The admin area should contain all commissioner functionality.

⸻

Phase 6: Create a Dedicated Admin Area

Introduce:

/league/[leagueId]/admin

This becomes the home for:

* League settings
* Draft controls
* Commissioner overrides
* Scoring configuration
* Season management

Benefits:

* Cleaner navigation
* Simpler authorization
* Better mental model

⸻

Phase 7: Improve Login Flow

Visitor

Current Goal:

Landing page.

Expected Flow:

Landing Page
→ Login
→ Dashboard

⸻

User with One League

After login:

Dashboard
→ Redirect
→ Active League Matchup

Example:

/league/123/matchup

No league picker required.

⸻

User with Multiple Leagues

After login:

Show league selector:

Your Leagues
PWHL Friends League
Leading by 5.4
Work League
Trailing by 12.8

Selecting a league enters the matchup view.

⸻

Phase 8: Make Matchups the Default Experience

The application should be optimized around the question:

“Am I winning right now?”

⸻

In-Season Routing

Visiting:

/league/[leagueId]

should redirect to:

/league/[leagueId]/matchup

⸻

Offseason Routing

May redirect to:

/league/[leagueId]/roster

or

/league/[leagueId]/overview

⸻

Draft Period Routing

May redirect to:

/league/[leagueId]/draft

⸻

Phase 9: Dashboard Redesign

The dashboard should prioritize:

1. Current matchup
2. Remaining players
3. Top performers
4. League activity
5. Standings

Not the reverse.

⸻

Dashboard Hero

Example:

You lead by 4.6 points
Projected:
112.4 – 108.7
67% chance to win
3 players remaining tonight

This should be the first thing a user sees after login.

⸻

Success Criteria

The implementation is successful when:

* Anonymous users cannot access any league management functionality.
* Commissioner functionality is isolated and protected.
* League membership is validated everywhere.
* Every mutation endpoint performs authorization checks.
* Login flows users directly into their most relevant matchup.
* The product experience centers on active competition rather than league administration.

The guiding principle:

The application should feel like a weekly matchup competition platform first, and a league management platform second.