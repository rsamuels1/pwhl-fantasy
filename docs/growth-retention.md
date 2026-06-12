# Growth & Retention Specification

**Product:** PWHL Fantasy

**Priority:** P2

**Status:** Draft

**Audience:** Casual PWHL Fans

---

# Overview

The long-term success of PWHL Fantasy depends on three outcomes:

1. Users successfully start leagues.
2. Users remain engaged throughout the season.
3. Users invite additional managers.

This document defines:

- Activation Metrics
- Notification Strategy
- Referral Loop Design

---

# Goals

## Business Goals

- Increase league creation
- Increase league completion rate
- Increase season retention
- Increase invite conversion rate
- Encourage year-over-year league renewal

## User Goals

- Easily start a league
- Stay informed about important events
- Avoid missing draft picks or lineup deadlines
- Play with friends

---

# Activation Metrics

## Definition

Activation occurs when a user experiences the core value of the product:

> Joining a fantasy league and actively participating in competition.

---

# Activation Funnel

```text
Visitor
    ↓
Registered User
    ↓
Created League OR Joined League
    ↓
League Filled
    ↓
Joined Draft
    ↓
Completed Draft
    ↓
Set Week 1 Lineup
    ↓
Viewed Week 1 Results
    ↓
Returned Week 2
```

---

# KPI Dashboard

## Acquisition Metrics

### Visitors

Definition:

Unique users visiting marketing or application pages.

Metrics:

- Daily Visitors
- Weekly Visitors
- Monthly Visitors

---

### Registration Rate

Formula:

```text
Registered Users / Visitors
```

Target:

> 30%

---

## League Formation Metrics

### League Creation Rate

Formula:

```text
League Creators / Registered Users
```

Target:

> 20%

---

### Invite Conversion Rate

Formula:

```text
Accepted Invites / Sent Invites
```

Target:

> 40%

---

### League Fill Rate

Formula:

```text
Filled Leagues / Created Leagues
```

Target:

> 80%

---

## Draft Metrics

### Draft Participation Rate

Formula:

```text
Draft Participants / Registered League Members
```

Target:

> 90%

---

### Draft Completion Rate

Formula:

```text
Completed Drafts / Started Drafts
```

Target:

> 95%

---

### Auto-Pick Rate

Formula:

```text
Auto Picks / Total Picks
```

Target:

< 25%

---

## Activation Metrics

### Week 1 Lineup Rate

Formula:

```text
Managers Setting Lineups / Drafted Managers
```

Target:

> 80%

---

### Week 1 Engagement

Formula:

```text
Managers Viewing Results / Active Managers
```

Target:

> 75%

---

### Activation Rate

Formula:

```text
Returned Week 2 Managers / Drafted Managers
```

Target:

> 65%
```

---

## Retention Metrics

### Week 4 Retention

Formula:

```text
Active Week 4 Managers / Activated Managers
```

Target:

> 50%

---

### Season Completion Rate

Formula:

```text
Managers Active During Playoffs / Activated Managers
```

Target:

> 60%

---

### League Completion Rate

Formula:

```text
Completed Leagues / Created Leagues
```

Target:

> 90%

---

## Referral Metrics

### Referral Rate

Formula:

```text
Invites Sent / Active Users
```

Target:

> 2 invites per active user

---

### Viral Coefficient

Formula:

```text
Invites Sent × Invite Conversion Rate
```

Target:

> 1.0

Long-term objective:

Each active manager creates at least one additional manager.

---

# KPI Dashboard Layout

## Executive Dashboard

### Acquisition

- Visitors
- Registrations
- Conversion Rate

### League Growth

- Leagues Created
- Leagues Filled
- Invite Conversion

### Draft Health

- Draft Completion
- Auto-Pick Rate

### Activation

- Week 1 Lineups
- Week 2 Return Rate

### Retention

- Week 4 Retention
- Season Completion

### Referral

- Invites Sent
- Viral Coefficient

---

# Notification Strategy

## Principles

Notifications should:

- Drive action
- Prevent missed deadlines
- Encourage engagement
- Avoid spam

Users should never receive notifications that do not require awareness or action.

---

# Notification Channels

## MVP

- Email
- In-App

## Future

- Push Notifications
- SMS (Optional)

---

# Notification Matrix

| Event | In-App | Email | Push (Future) |
|---------|---------|---------|---------|
| League Invite | ✅ | ✅ | ✅ |
| League Filled | ✅ | ✅ | ✅ |
| Draft Starts in 24 Hours | ✅ | ✅ | ✅ |
| Draft Starts in 1 Hour | ✅ | ❌ | ✅ |
| Draft Starts in 15 Minutes | ✅ | ❌ | ✅ |
| You're On The Clock | ✅ | ❌ | ✅ |
| Auto-Pick Executed | ✅ | ✅ | ✅ |
| Draft Complete | ✅ | ✅ | ✅ |
| Lineup Incomplete | ✅ | ✅ | ✅ |
| Matchup Started | ✅ | ❌ | ✅ |
| Matchup Won | ✅ | ❌ | ✅ |
| Matchup Lost | ✅ | ❌ | ✅ |
| Weekly VP Bonus Earned | ✅ | ❌ | ✅ |
| Waiver Claim Submitted | ✅ | ❌ | ❌ |
| Waiver Claim Successful | ✅ | ✅ | ✅ |
| Waiver Claim Rejected | ✅ | ❌ | ✅ |
| Trade Received | ✅ | ✅ | ✅ |
| Trade Accepted | ✅ | ✅ | ✅ |
| Trade Rejected | ✅ | ❌ | ✅ |
| Playoff Clinched | ✅ | ✅ | ✅ |
| Eliminated From Playoffs | ✅ | ❌ | ✅ |
| Championship Won | ✅ | ✅ | ✅ |

---

# Critical Notification Timing

## Lineup Reminder

Trigger:

- User has empty starting slot

Send:

- 24 hours before matchup lock
- 2 hours before matchup lock

---

## Draft Reminder

Send:

- 24 hours before draft
- 1 hour before draft
- 15 minutes before draft

---

## Trade Reminder

Send immediately.

Trade notifications should be considered high priority.

---

# Referral Loop

## Objective

Make league creation naturally drive user acquisition.

The product grows when managers invite friends.

---

# Core Referral Mechanic

## Create a League

Commissioner creates league.

System immediately presents:

```text
Invite 7 Friends To Fill Your League
```

Primary CTA:

```text
Copy Invite Link
```

---

## League Progress Tracker

Display:

```text
League Filled: 4 / 8 Teams
```

Progress bar:

```text
████░░░░ 50%
```

Goal:

Create momentum.

---

# Invite 5 Friends Campaign

## Trigger

After league creation.

Display:

```text
Invite 5 Friends and Start Your Season
```

Options:

- Copy Link
- Share via Text
- Share via Email

---

# Referral Funnel

```text
Create League
    ↓
Send Invite
    ↓
Friend Joins
    ↓
League Fills
    ↓
Draft Completes
    ↓
Friend Creates League Next Season
```

---

# Future Referral Enhancements

## Referral Badges

Examples:

- League Founder
- Commissioner
- Community Builder

---

## Season Renewal Flow

At season end:

```text
Bring Back Your League For Next Season
```

One-click league renewal.

---

## League Recruitment Board

Future feature.

Users seeking leagues can join public openings.

---

# Success Criteria

The Growth & Retention initiative is successful when:

- 80%+ of leagues fill successfully.
- 65%+ of drafted managers return for Week 2.
- 50%+ of activated managers remain active through Week 4.
- 90%+ of leagues complete the season.
- Active users consistently invite additional managers.
- League renewals become the primary source of growth.