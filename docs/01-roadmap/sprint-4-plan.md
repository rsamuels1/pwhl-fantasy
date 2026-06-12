Sprint 4 — User & Operations Readiness

Status: Planned

Theme:

Prepare the platform for real commissioners and managers.

Goal:

Transition from internal validation to beta readiness by ensuring:

* Commissioners can independently run leagues.
* Founders can operate and monitor the platform.
* Managers understand core gameplay concepts.
* Feedback loops exist.
* Critical notifications are operational.

This sprint intentionally prioritizes operational readiness over new fantasy gameplay features.

⸻

Epic 1 — Commissioner Experience Hardening

Priority: P0

Purpose:

Validate that commissioners can successfully operate leagues without developer intervention.

⸻

CT-VALIDATION-001

Commissioner Workflow Validation

Test:

* League creation
* League configuration
* Manager invitations
* Draft execution
* Draft pause/resume
* Force roster moves
* Undo transactions
* Replace manager
* Season renewal

Deliverable:

commissioner-experience-review.md

⸻

CT-VALIDATION-002

Commissioner Runbook Validation

Review:

docs/operations/commissioner-runbook.md

Verify:

* Accuracy
* Missing workflows
* Screenshots
* Recovery procedures

Deliverable:

Updated commissioner-runbook.md

⸻

Epic 2 — Founder Operations Console

Priority: P0

Purpose:

Provide operational visibility without requiring direct database access.

⸻

FOC-001

Simulation Launcher

Capabilities:

* Run draft simulation
* Run season simulation
* Run playoff simulation

Reference:

season-simulation-plan.md

⸻

FOC-002

League Explorer

Search:

* League
* Commissioner
* User

Display:

* League configuration
* Draft state
* Standings
* Playoff state

⸻

FOC-003

Validation Dashboard

Display:

* MVP readiness score
* Draft health
* League health
* Validation suite status
* Open blockers

Reference:

founder-dashboard.md

⸻

Epic 3 — Beta Feedback Infrastructure

Priority: P1

Purpose:

Capture structured feedback from early users.

⸻

BETA-001

In-App Feedback Widget

Allow submission of:

* Bug reports
* Suggestions
* Confusing behavior

Store:

* User
* League
* Context
* Timestamp

⸻

BETA-002

Survey Framework

Support:

* Commissioner survey
* Manager survey

Reference:

beta-program-plan.md

⸻

BETA-003

Founding Commissioner Tracking

Track:

* Invited
* Accepted
* Active
* Renewed

Purpose:

Measure beta health and retention.

⸻

Epic 4 — Notification Framework

Priority: P1

Purpose:

Deliver critical MVP notifications.

⸻

NOTIF-001

Draft Starting Soon

Trigger:

* 24 hours before draft
* 1 hour before draft

⸻

NOTIF-002

You’re On The Clock

Trigger:

* Active draft pick timer

⸻

NOTIF-003

Lineup Incomplete

Trigger:

* Missing required starters before lineup lock

⸻

NOTIF-004

Week Starts Tomorrow

Trigger:

* Weekly matchup reminder

⸻

Deferred:

* Trade notifications
* Referral notifications
* Advanced lifecycle notifications

⸻

Epic 5 — League Homepage

Priority: P1

Purpose:

Create a central destination for managers.

Reference:

league-homepage-spec.md

⸻

LEAGUE-001

League Dashboard

Display:

* Standings
* Upcoming matchup
* League activity
* Draft status

⸻

LEAGUE-002

League Activity Feed

Sources:

* Transactions
* Draft actions
* Commissioner actions

⸻

LEAGUE-003

Commissioner Announcements

Support:

* League-wide messages
* Important updates
* Draft reminders

⸻

Epic 6 — User Education

Priority: P1

Purpose:

Reduce onboarding friction and gameplay confusion.

⸻

EDU-001

VP Education

Explain:

* Weekly matchup points
* Weekly ranking points
* Total VP calculation
* Standings logic

Reference:

league-rules-v1.md

⸻

EDU-002

Lineup Lock Education

Explain:

* Weekly lineup lock
* Future-game swaps
* Bench behavior

⸻

EDU-003

Rules Integration

Add contextual access to:

league-rules-v1.md

Locations:

* League settings
* Standings page
* Matchups page

⸻

Sprint Success Criteria

Commissioners can:

* Run leagues independently
* Resolve common issues
* Renew leagues

Managers can:

* Understand VP standings
* Set lineups correctly
* Participate without confusion

Founders can:

* Monitor platform health
* Run simulations
* Investigate league state

Platform can:

* Collect structured feedback
* Send critical notifications
* Support beta operations

⸻

Sprint Exit Criteria

Before Sprint 4 is considered complete:

* Commissioner workflow validation completed
* Draft reliability certification completed
* Season simulation suite passing
* Founder dashboard operational
* MVP notifications live
* VP education shipped
* Feedback collection operational

Result:

Platform is ready for Founding Commissioner Alpha and Private Beta testing.