# PWHL Fantasy
# System Architecture & Product Operations Guide

Version 1.0

Audience:
- Product Managers
- Designers
- Investors
- QA Testers
- New Developers
- AI Coding Agents

---

# Purpose

This document explains how PWHL Fantasy is structured at a systems level.

It is intentionally more technical than the user-facing product guide but avoids implementation details that require software engineering knowledge.

The goal is to explain:

- Major platform components
- How information flows through the system
- How fantasy leagues operate
- How Historical Replay works
- Which systems depend on each other

---

# High-Level Architecture

The platform is organized around six primary domains:

1. User Management
2. League Management
3. Draft System
4. Roster & Lineup Management
5. Scoring Engine
6. Season Engine

These systems work together to create a complete fantasy season experience.

---

# System Overview

```text
Users
  ↓
Leagues
  ↓
Draft
  ↓
Rosters
  ↓
Lineups
  ↓
Scoring
  ↓
Matchups
  ↓
Standings
  ↓
Playoffs
```

Everything ultimately revolves around the league.

The league acts as the container for all fantasy activity.

---

# Core Domain: Users

Purpose:

Represents people using the platform.

Responsibilities:

- Authentication
- Account management
- Team ownership
- League membership

Key Concept:

A user may belong to multiple leagues.

Example:

Sarah can participate in:

- Friends League
- Office League
- Historical Replay League

with different teams in each league.

---

# Core Domain: Leagues

Purpose:

Leagues are the organizational layer of the platform.

Responsibilities:

- League settings
- Team registration
- Draft configuration
- Schedule generation
- Playoff configuration

The league determines:

- How scoring works
- How many teams exist
- Roster rules
- Playoff rules

Think of a league as the operating system for a fantasy season.

---

# Core Domain: Teams

Purpose:

Represents a manager's fantasy franchise.

Responsibilities:

- Own players
- Accumulate points
- Participate in matchups

A team exists only within a league.

Example:

A manager may own:

Team A in League 1

and

Team B in League 2

These are completely independent.

---

# Core Domain: Players

Purpose:

Represents real PWHL athletes.

Responsibilities:

- Statistical tracking
- Position eligibility
- Fantasy scoring input

Players are shared resources.

The same player may exist across hundreds of fantasy leagues simultaneously.

Example:

Sarah Fillier can be drafted in:

- League A
- League B
- League C

Each league tracks ownership separately.

---

# Draft System

Purpose:

Distribute players to fantasy teams.

The draft is effectively the league initialization process.

Before draft:

```text
Players
↓
Available Pool
```

After draft:

```text
Players
↓
Fantasy Teams
```

Responsibilities:

- Draft order
- Draft timer
- Draft queue
- Auto draft
- Pick validation

The draft creates the first roster state.

---

# Roster Management System

Purpose:

Manage player ownership.

Responsibilities:

- Track roster composition
- Enforce position limits
- Validate eligibility

Roster data answers:

"Who belongs to this team?"

Not:

"Who is currently active?"

That responsibility belongs to lineups.

---

# Lineup Management System

Purpose:

Determine which rostered players contribute fantasy points.

Responsibilities:

- Active players
- Bench players
- Position assignments
- Lock rules

Example:

Roster:

15 players

Lineup:

9 active players

Only lineup players generate fantasy points.

---

# Matchup Engine

Purpose:

Create weekly competition.

Responsibilities:

- Pair opponents
- Calculate results
- Determine wins and losses

Inputs:

```text
Lineups
+
Player Statistics
```

Outputs:

```text
Fantasy Scores
+
Matchup Results
```

The matchup engine is the primary competitive layer.

---

# Scoring Engine

Purpose:

Convert hockey statistics into fantasy points.

This is the most important business logic in the platform.

Inputs:

```text
Goals
Assists
Shots
Saves
Wins
Shutouts
```

Outputs:

```text
Fantasy Points
```

Example:

Player Stats:

Goal = 1
Assist = 2

Fantasy Result:

8.5 fantasy points

The scoring engine never cares who owns the player.

It only converts statistics into points.

---

# Statistics Layer

Purpose:

Store and process real PWHL game data.

Responsibilities:

- Game results
- Player performance
- Team schedules

The scoring engine consumes statistics from this layer.

This creates a separation between:

Real Hockey Data

and

Fantasy Logic

which makes the platform easier to maintain.

---

# Standings Engine

Purpose:

Rank fantasy teams.

Inputs:

- Wins
- Losses
- Ties
- Points For
- Points Against

Outputs:

League rankings.

Standings determine playoff qualification.

---

# Playoff Engine

Purpose:

Determine league champion.

Responsibilities:

- Bracket generation
- Advancement
- Seeding

Inputs:

Final standings.

Outputs:

Playoff matchups.

---

# Historical Replay Architecture

Historical Replay is one of the most important architectural decisions in the platform.

Most fantasy platforms depend on future games occurring.

PWHL Fantasy separates:

Game Data

from

Fantasy Operations

allowing historical seasons to function exactly like live seasons.

---

# Replay Workflow

Step 1

Create replay league.

```text
Historical Season
↓
League
```

Step 2

Draft players.

```text
Historical Players
↓
Fantasy Teams
```

Step 3

Advance season.

```text
Historical Games
↓
Scoring Engine
↓
Matchups
```

Step 4

Generate standings.

```text
Scores
↓
Standings
```

Step 5

Run playoffs.

---

# Why Replay Works

Because the platform does not require live events.

The scoring engine only needs:

```text
Player Statistics
```

It does not care whether those statistics come from:

- Yesterday
- Last week
- Last year

This abstraction makes replay possible.

---

# Season Engine

Purpose:

Coordinate all systems.

The Season Engine acts as the conductor.

Responsibilities:

- Move time forward
- Open lineup periods
- Lock lineups
- Trigger scoring
- Advance standings
- Trigger playoffs

Without the Season Engine, all other systems are disconnected.

---

# Data Flow

Normal Live Season

```text
PWHL Games
↓
Statistics
↓
Scoring Engine
↓
Matchups
↓
Standings
↓
Playoffs
```

Replay Season

```text
Historical Database
↓
Statistics
↓
Scoring Engine
↓
Matchups
↓
Standings
↓
Playoffs
```

Notice that everything after Statistics is identical.

This is a major architectural strength.

---

# Most Critical Systems

Ranked by business importance.

1. Scoring Engine
2. Season Engine
3. Draft System
4. Matchup Engine
5. Standings Engine

If any of these fail, the fantasy experience breaks.

---

# Future Architectural Additions

Planned major domains:

### Transaction Engine

Supports:

- Waivers
- Free agents
- Trades

---

### Notification Engine

Supports:

- Goal alerts
- Lineup reminders
- Trade proposals

---

### Analytics Engine

Supports:

- Draft grades
- Player trends
- Matchup projections

---

### Community Engine

Supports:

- League chat
- Commissioner announcements
- Rivalries

---

# Architectural Principle

Every new feature must support both:

1. Live leagues
2. Historical replay leagues

Before building any feature ask:

"How does this behave in Replay Mode?"

If the answer is unclear, the feature design is incomplete.

This principle keeps Historical Replay a first-class experience and prevents the platform from becoming dependent on real-time events.