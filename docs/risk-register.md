Risk Register

Version: 1.0

Owner: Product

Status: Active

Purpose: Identify, track, and mitigate risks that could prevent successful MVP launch, beta execution, or long-term platform growth.

⸻

Risk Rating System

Impact

High

Could prevent launch or season completion.

Medium

Creates significant user frustration.

Low

Minor inconvenience.

⸻

Likelihood

High

Expected to occur without mitigation.

Medium

Plausible occurrence.

Low

Unlikely but possible.

⸻

Product Risks

⸻

R-001 VP Scoring Confusion

Category: Product

Impact: High

Likelihood: High

Description:

Many users will be unfamiliar with VP standings and may not understand why standings differ from traditional win/loss records.

Mitigation:

* VP Education UX
* Standings explanation page
* League Rules documentation
* Example scenarios

Owner:

Product

Status:

Open

⸻

R-002 Playoff Qualification Confusion

Category: Product

Impact: Medium

Likelihood: Medium

Description:

Managers may not understand playoff qualification and tiebreakers.

Mitigation:

* Playoff qualification indicators
* Standings explanations
* League Rules documentation

Owner:

Product

Status:

Open

⸻

R-003 Weekly Lineup Lock Confusion

Category: Product

Impact: Medium

Likelihood: High

Description:

Managers expect daily roster moves and become confused by weekly lineup lock behavior.

Mitigation:

* Lineup education
* Lock messaging
* Help documentation

Owner:

Product

Status:

Open

⸻

Draft Risks

⸻

R-004 Draft Failure

Category: Technical

Impact: High

Likelihood: Medium

Description:

Draft cannot complete.

Mitigation:

* Draft validation suite
* Auto-pick system
* Simulation testing

Owner:

Engineering

Status:

Mitigated

⸻

R-005 Draft Disconnect

Category: Technical

Impact: Medium

Likelihood: High

Description:

Managers disconnect during draft.

Mitigation:

* Reconnect flow
* Auto-pick
* Draft pause functionality

Owner:

Engineering

Status:

Partial

⸻

R-006 Draft Timer Issues

Category: Technical

Impact: Medium

Likelihood: Medium

Description:

Timer behaves incorrectly.

Mitigation:

* Automated tests
* Draft readiness review

Owner:

Engineering

Status:

Partial

⸻

Commissioner Risks

⸻

R-007 Commissioner Cannot Resolve Issues

Category: Operations

Impact: High

Likelihood: Medium

Description:

Commissioner lacks tools to resolve league issues.

Mitigation:

* Commissioner Control Center
* Audit logging
* Force roster moves

Owner:

Product

Status:

Open

⸻

R-008 Commissioner Abandons League

Category: Operations

Impact: High

Likelihood: Medium

Description:

League becomes unmanaged.

Mitigation:

* Commissioner replacement workflow
* Admin override process

Owner:

Product

Status:

Open

⸻

League Participation Risks

⸻

R-009 Inactive Managers

Category: Engagement

Impact: High

Likelihood: High

Description:

Managers stop participating.

Mitigation:

* Notifications
* Commissioner replacement tools
* Weekly reminders

Owner:

Product

Status:

Open

⸻

R-010 Low Week 2 Retention

Category: Engagement

Impact: High

Likelihood: Medium

Description:

Managers participate after draft but do not return.

Mitigation:

* Improved onboarding
* Email reminders
* Better league homepage

Owner:

Product

Status:

Open

⸻

Technical Risks

⸻

R-011 Scoring Errors

Category: Technical

Impact: High

Likelihood: Low

Description:

Fantasy scoring calculations are incorrect.

Mitigation:

* Simulation suite
* Scoring tests
* Validation framework

Owner:

Engineering

Status:

Mitigated

⸻

R-012 Playoff Logic Errors

Category: Technical

Impact: High

Likelihood: Low

Description:

Incorrect playoff qualification or seeding.

Mitigation:

* Playoff validation tests
* Season simulations

Owner:

Engineering

Status:

Mitigated

⸻

R-013 PWHL API/Data Issues

Category: External Dependency

Impact: High

Likelihood: Medium

Description:

Missing or delayed player statistics.

Mitigation:

* Monitoring
* Data validation
* Manual override procedures

Owner:

Engineering

Status:

Open

⸻

Architecture Risks

⸻

R-014 Missing parentLeagueId

Category: Architecture

Impact: High

Likelihood: Medium

Description:

Future season renewal becomes difficult or impossible.

Mitigation:

* Sprint 2 implementation
* Multi-season foundation

Owner:

Engineering

Status:

Open

⸻

R-015 Missing Versioned Rules

Category: Architecture

Impact: Medium

Likelihood: Medium

Description:

Rule changes break historical season accuracy.

Mitigation:

* rulesVersion
* scoringVersion

Owner:

Engineering

Status:

Open

⸻

Beta Risks

⸻

R-016 Insufficient Commissioners

Category: Program

Impact: High

Likelihood: Medium

Description:

Not enough leagues to validate MVP.

Mitigation:

* Founding Commissioner Program
* Early recruitment

Owner:

Product

Status:

Open

⸻

R-017 Insufficient Feedback

Category: Program

Impact: Medium

Likelihood: Medium

Description:

Beta users do not provide actionable feedback.

Mitigation:

* Structured surveys
* Scheduled check-ins

Owner:

Product

Status:

Open

⸻

Business Risks

⸻

R-018 No Product-Market Fit

Category: Business

Impact: High

Likelihood: Unknown

Description:

PWHL fans may not want fantasy hockey.

Mitigation:

* Early beta
* Community interviews
* Feedback loops

Owner:

Founder

Status:

Open

⸻

R-019 Competitive Pressure

Category: Business

Impact: Medium

Likelihood: Low

Description:

Larger fantasy platforms enter the PWHL space.

Mitigation:

* Community focus
* Faster iteration
* Better commissioner experience

Owner:

Founder

Status:

Open

⸻

Operational Risks

⸻

R-020 Support Overload

Category: Operations

Impact: Medium

Likelihood: Medium

Description:

Beta users generate more support volume than expected.

Mitigation:

* Support playbook
* Education content
* Better onboarding

Owner:

Product

Status:

Open

⸻

Quarterly Review Process

Review:

* Risk status
* Mitigation effectiveness
* Newly identified risks

Frequency:

Monthly during MVP development

Bi-weekly during beta

Weekly during launch period