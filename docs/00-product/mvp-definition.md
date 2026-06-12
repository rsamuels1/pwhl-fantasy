# MVP Definition

**Product:** PWHL Fantasy

**Version:** MVP v1

**Status:** Approved Draft

---

# Purpose

This document defines the minimum feature set required for public launch.

Any feature not listed in the MVP scope should be considered out of scope unless explicitly approved.

The goal of MVP is not to build the most complete fantasy platform.

The goal is to prove that leagues can successfully:

```text
Create League
→ Invite Managers
→ Draft
→ Set Lineups
→ Compete Weekly
→ Make Playoffs
→ Crown Champion
```

---

# Product Goal

Deliver the simplest fantasy hockey experience for PWHL fans.

Target users:

- Existing PWHL fans
- Fantasy beginners
- Friend groups
- Small commissioner-led leagues

---

# MVP Success Criteria

A league can:

1. Create a league
2. Fill league membership
3. Complete a draft
4. Set legal lineups
5. Score weekly matchups
6. Track standings
7. Qualify for playoffs
8. Complete playoffs
9. Crown a champion

Without commissioner intervention or platform support.

---

# MVP In Scope

## League Creation

Required:

- Create league
- Configure league name
- Invite managers
- Join league

---

## League Configuration

Required:

- League size
- Draft date
- Roster configuration
- Scoring system

Approved defaults:

```text
3 F
2 D
1 UTIL
1 G
6 Bench
```

---

## Draft

Required:

- Snake draft
- Draft order generation
- Draft timer
- Auto-pick
- Draft completion
- Draft reconnect handling

Must support:

- 8-team leagues
- 10-team leagues

---

## Rosters

Required:

- Roster validation
- Position eligibility
- Bench management

---

## Lineups

Required:

- Weekly lineup lock
- Partial-week substitutions

Rule:

Managers may only move players who have not yet played during the matchup week.

---

## Scoring

Required:

- Hybrid H2H points model
- Matchup wins
- Weekly performance points
- Victory Point standings

VP standings become the authoritative standings system.

---

## Standings

Required:

- W/L record
- VP standings
- Playoff qualification indicators

---

## Playoffs

Required:

- 4-team playoff bracket
- Single-week rounds
- Championship matchup

Fantasy playoffs must conclude before PWHL playoffs begin.

---

## Commissioner Tools

Required:

- Pause draft
- Resume draft
- Replace manager
- Force roster move
- Undo transaction
- Audit log

---

## Notifications

Required:

- Draft starting
- On the clock
- Lineup incomplete

---

# MVP Explicitly Out of Scope

## Transactions

Launch without:

- Trades
- Waivers
- FAAB

May be added before launch if implementation risk is low.

---

## Advanced League Types

Out of scope:

- Keeper leagues
- Dynasty leagues

---

## Growth Features

Out of scope:

- Referral program
- Viral loops
- Activity feed

---

## AI Features

Out of scope:

- Draft assistant
- Trade evaluator
- Weekly recaps

---

## Native Apps

Out of scope:

- iOS
- Android

---

# MVP Launch Gates

Launch cannot occur until:

- Rules match implementation
- Draft reliability validated
- VP standings validated
- Playoff qualification validated
- End-to-end season simulation completed
- Commissioner recovery tools available

---

# Definition of MVP Complete

The product is MVP complete when a test league can:

```text
Create League
→ Fill League
→ Draft
→ Set Lineups
→ Earn VP
→ Make Playoffs
→ Crown Champion
```

without encountering a blocking issue.