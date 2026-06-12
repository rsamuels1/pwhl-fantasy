# founder-dashboard.md

Version: 1.0

Status: Proposed

Owner: Product

Audience:

- Founder
- Product Manager
- Program Manager
- Future Operations Team

Purpose:

Provide a single daily view of the health of the PWHL Fantasy platform.

The Founder Dashboard should answer:

1. Is the product working?
2. Are users engaging?
3. Are leagues succeeding?
4. Are commissioners succeeding?
5. Are we ready for launch?
6. What should we prioritize next?

---

# Dashboard Philosophy

This dashboard is not intended to be a business intelligence warehouse.

It is intended to answer:

> "If I have five minutes this morning, what should I know?"

The dashboard should surface:

- Product health
- User engagement
- League health
- Technical reliability
- Launch readiness

---

# Dashboard Sections

1. Executive Summary
2. Product Adoption
3. League Health
4. Draft Health
5. Gameplay Health
6. Commissioner Health
7. Retention
8. Reliability
9. MVP Readiness
10. Growth Signals

---

# Section 1 — Executive Summary

Displayed at the top of the dashboard.

---

## Active Users

Definition:

Users active within the last 7 days.

Formula:

```text
Unique Active Users (7d)
```

Goal:

Track growth and engagement.

---

## Active Leagues

Definition:

Leagues with activity in the last 7 days.

Formula:

```text
Leagues with lineup changes, drafts,
or matchup activity.
```

---

## Draft Completion Rate

Formula:

```text
Completed Drafts
/
Started Drafts
```

Target:

≥ 90%

---

## Week 1 Participation

Formula:

```text
Managers With Valid Lineups
/
Total Managers
```

Target:

≥ 80%

---

## MVP Readiness Score

Formula:

Derived from validation suite.

Scale:

0–100%

Target:

≥ 90%

---

# Section 2 — Product Adoption

Purpose:

Measure platform growth.

---

## Registered Users

Display:

- Total
- Last 30 Days
- Week-over-Week Growth

---

## New Users

Display:

- Today
- Last 7 Days
- Last 30 Days

---

## League Creations

Display:

- Total
- Last 30 Days

---

## League Join Rate

Formula:

```text
League Joins
/
League Invitations Sent
```

Target:

≥ 80%

---

# Section 3 — League Health

Purpose:

Measure overall league success.

---

## Active Leagues

Definition:

League activity in the past 7 days.

---

## Average League Size

Formula:

```text
Managers
/
Leagues
```

Target:

8

---

## League Completion Rate

Formula:

```text
Completed Seasons
/
Started Seasons
```

Target:

≥ 75%

---

## Inactive League Rate

Formula:

```text
Leagues with no activity
for 14+ days
```

Target:

< 10%

---

# Section 4 — Draft Health

Purpose:

Track the highest-risk feature.

---

## Draft Start Rate

Formula:

```text
Drafts Started
/
Scheduled Drafts
```

Target:

≥ 95%

---

## Draft Completion Rate

Formula:

```text
Drafts Completed
/
Drafts Started
```

Target:

≥ 90%

---

## Auto-Pick Rate

Formula:

```text
Auto Picks
/
Total Picks
```

Target:

< 20%

---

## Draft Failure Count

Definition:

Drafts requiring manual intervention.

Target:

0

---

## Draft Pauses

Track:

- Count
- Reason

---

# Section 5 — Gameplay Health

Purpose:

Validate league operations.

---

## Lineup Submission Rate

Formula:

```text
Managers Submitting Lineups
/
Managers Eligible
```

Target:

≥ 80%

---

## Average Weekly Participation

Definition:

Managers making lineup decisions.

---

## VP Distribution

Display:

- Average VP
- Highest VP
- Lowest VP

Purpose:

Identify scoring anomalies.

---

## Matchup Completion Rate

Formula:

```text
Completed Matchups
/
Scheduled Matchups
```

Target:

100%

---

# Section 6 — Commissioner Health

Purpose:

Measure commissioner success.

---

## Active Commissioners

Definition:

Commissioners active within 7 days.

---

## Commissioner Satisfaction

Source:

Survey results.

Target:

≥ 8/10

---

## Commissioner Actions

Track:

- Draft pauses
- Manager replacements
- Force roster moves
- Transaction reversals

Purpose:

Identify operational pain points.

---

## League Survival Rate

Formula:

```text
Leagues Reaching Week 4
/
Leagues Created
```

Target:

≥ 80%

---

# Section 7 — Retention

Purpose:

Measure long-term engagement.

---

## Day 1 Retention

Formula:

```text
Users Returning Day 1
/
New Users
```

---

## Week 2 Retention

Formula:

```text
Users Active Week 2
/
Users Active Week 1
```

Target:

≥ 70%

---

## Week 4 Retention

Target:

≥ 60%

---

## Season Completion Rate

Target:

≥ 75%

---

# Section 8 — Reliability

Purpose:

Monitor technical stability.

---

## Open P0 Bugs

Target:

0

---

## Open P1 Bugs

Target:

≤ 3

---

## Scoring Errors

Definition:

Confirmed scoring discrepancies.

Target:

0

---

## Draft Incidents

Target:

0

---

## Playoff Errors

Target:

0

---

# Section 9 — MVP Readiness

Purpose:

Provide launch confidence.

---

## Validation Suite Status

Display:

PASS / FAIL

For:

- VP Validation
- Playoff Validation
- Season Lifecycle
- Draft Reliability
- Lineup Validation

---

## MVP Checklist

Display:

- Complete
- Remaining

---

## Launch Readiness Score

Scale:

0–100%

Target:

≥ 90%

---

# Section 10 — Growth Signals

Purpose:

Detect organic growth.

---

## Invitation Acceptance Rate

Formula:

```text
Accepted Invites
/
Sent Invites
```

---

## Referral Rate

Future Metric

Formula:

```text
New Users From Existing Users
```

---

## Returning League Rate

Future Metric

Formula:

```text
Renewed Leagues
/
Completed Leagues
```

---

# Dashboard Views

## Founder View

Default.

Shows all sections.

---

## Product View

Focus:

- Adoption
- Retention
- League Health

---

## Engineering View

Focus:

- Reliability
- Validation
- Bugs

---

## Commissioner View

Future.

Focus:

- League-specific health

---

# MVP Dashboard Implementation (Phase 1)

Implement first:

1. Registered Users
2. Active Users
3. Leagues Created
4. Draft Completion Rate
5. Lineup Submission Rate
6. Active Leagues
7. Open P0 Bugs
8. MVP Readiness Score

These provide the highest signal-to-noise ratio.

---

# Analytics Events Required

Dashboard depends on:

- user_registered
- user_logged_in
- league_created
- league_joined
- draft_started
- draft_completed
- lineup_saved
- commissioner_action
- season_completed

See:

analytics-events.md

---

# Daily Founder Questions

The dashboard should answer:

### Product

Are people using the platform?

### Leagues

Are leagues surviving?

### Draft

Are drafts succeeding?

### Engagement

Are managers returning?

### Reliability

Is anything broken?

### Launch

Are we getting closer to launch readiness?

If the dashboard cannot answer those questions, additional metrics should not be added.