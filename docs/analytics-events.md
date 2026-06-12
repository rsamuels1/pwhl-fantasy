# Analytics Event Specification

**Version:** MVP v1

**Purpose:** Define all events required to measure product success.

---

# Analytics Philosophy

Measure behaviors, not page views.

The primary objective is understanding:

```text
Visitor
→ User
→ Manager
→ League Member
→ Active Player
→ Returning Player
```

---

# North Star Metric

## League Completion Rate

Definition:

```text
Leagues Completing Season
÷
Leagues Created
```

Target:

> 90%

---

# Activation Funnel

## Step 1

```text
visitor_arrived
```

Properties:

- source
- device

---

## Step 2

```text
user_registered
```

Properties:

- provider
- referral_source

---

## Step 3

```text
league_created
```

Properties:

- league_size
- commissioner_id

---

## Step 4

```text
league_joined
```

Properties:

- league_id
- invite_type

---

## Step 5

```text
draft_started
```

Properties:

- league_id

---

## Step 6

```text
draft_completed
```

Properties:

- duration_minutes
- total_picks

---

## Step 7

```text
lineup_saved
```

Properties:

- week
- roster_completeness

---

## Step 8

```text
week_completed
```

Properties:

- week
- vp_earned

---

## Step 9

```text
playoff_clinched
```

Properties:

- seed

---

## Step 10

```text
season_completed
```

Properties:

- final_rank

---

# Draft Analytics

Track:

```text
draft_room_joined
```

```text
draft_pick_made
```

```text
auto_pick_triggered
```

```text
draft_disconnected
```

```text
draft_reconnected
```

Purpose:

Measure draft reliability.

---

# Lineup Analytics

Track:

```text
lineup_opened
```

```text
lineup_saved
```

```text
lineup_incomplete
```

```text
locked_player_move_attempted
```

Purpose:

Measure weekly engagement.

---

# Commissioner Analytics

Track:

```text
league_created
```

```text
manager_replaced
```

```text
draft_paused
```

```text
transaction_reversed
```

Purpose:

Measure commissioner workload.

---

# Notification Analytics

Track:

```text
notification_sent
```

```text
notification_opened
```

```text
notification_clicked
```

Properties:

- notification_type

Examples:

- draft_starting
- on_the_clock
- lineup_incomplete

---

# Retention Metrics

## Week 2 Retention

Definition:

```text
Users Active Week 2
÷
Users Active Week 1
```

Target:

> 65%

---

## Season Completion Rate

Definition:

```text
Users Active Championship Week
÷
Users Active Week 1
```

Target:

> 75%

---

## League Renewal Rate

Definition:

```text
Renewed Leagues
÷
Completed Leagues
```

Target:

> 40%

---

# Dashboard Requirements

## Acquisition

- Visitors
- Registrations
- Conversion rate

---

## Activation

- League creation rate
- League fill rate
- Draft completion rate

---

## Engagement

- Weekly lineup submissions
- Weekly active managers
- Notification engagement

---

## Retention

- Week 2 retention
- Season completion
- League renewal

---

# MVP Analytics Requirements

Before launch, dashboards must answer:

1. Can leagues fill?
2. Can leagues draft?
3. Are managers setting lineups?
4. Are managers returning weekly?
5. Are leagues completing seasons?
6. Are leagues renewing?

If analytics cannot answer these questions, the product cannot be effectively improved.