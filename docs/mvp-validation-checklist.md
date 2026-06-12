# MVP Validation Checklist

## Purpose

Validate that implementation aligns with approved MVP rules and supports a complete fantasy season.

---

# League Creation

- [ ] Create league
- [ ] Join league via invite
- [ ] Verify commissioner assignment
- [ ] Verify league settings persistence

---

# Roster Validation

Verify roster:

```text
3 F
2 D
1 UTIL
1 G
6 Bench
```

Checks:

- [ ] Forward slots validate correctly
- [ ] Defense slots validate correctly
- [ ] Utility slot validates correctly
- [ ] Goalie slot validates correctly
- [ ] Bench size validates correctly

---

# Draft Validation

## Manual Draft

- [ ] Draft starts successfully
- [ ] Picks save correctly
- [ ] Draft completes successfully

---

## Auto Draft

- [ ] Entire draft auto-completes
- [ ] Roster construction remains valid

---

## Draft Edge Cases

- [ ] User disconnect
- [ ] User reconnect
- [ ] Commissioner pause
- [ ] Commissioner resume
- [ ] Duplicate browser tabs
- [ ] Draft timer expiration

---

# Weekly Lineup Validation

- [ ] Lineup saves successfully
- [ ] Lineup validates correctly

Matchup lock behavior:

- [ ] Player who already played cannot be moved
- [ ] Player who has not played can be moved
- [ ] Bench swaps respect lock rules

---

# Scoring Validation

Verify VP model:

- [ ] Matchup VP awarded correctly
- [ ] Weekly rank VP awarded correctly
- [ ] Tie scenarios handled correctly

Expected:

```text
Win = 2 VP
Tie = 1 VP

Highest Weekly Score = +2 VP
Second Highest Weekly Score = +1 VP
```

---

# Standings Validation

- [ ] Standings sorted by VP
- [ ] VP totals correct
- [ ] Rankings update after scoring

---

# Playoff Validation

## Qualification

- [ ] Top 4 teams qualify
- [ ] Qualification uses VP standings

---

## Seeding

- [ ] Seed 1 vs Seed 4
- [ ] Seed 2 vs Seed 3

---

## Championship

- [ ] Winners advance
- [ ] Championship generated
- [ ] Champion recorded

---

# Season Completion Validation

Run complete season simulation.

Verify:

- [ ] League creation
- [ ] Draft
- [ ] Weekly matchups
- [ ] VP standings
- [ ] Playoffs
- [ ] Champion

---

# Launch Approval

Launch cannot proceed until:

- [ ] Roster alignment complete
- [ ] VP authority complete
- [ ] Playoff alignment complete
- [ ] Weekly lock validation complete
- [ ] Season simulation complete

Status:

```text
PASS / FAIL
```