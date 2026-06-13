# Draft Load Test Runbook

Manual pre-beta procedure for validating the WebSocket draft server under concurrent load:
multiple leagues drafting simultaneously, multiple clients per league, reconnects, and
commissioner operations.

---

## Prerequisites

- Local DB seeded (`npm run seed`)
- `.env` with `DATABASE_URL` pointing to your dev database
- 8+ terminal windows (or tmux panes)

---

## 1. Seed two concurrent leagues

```bash
npm run seed && npm run seed-draft
# note leagueId-1 and team IDs for league 1

npm run seed-draft
# note leagueId-2 and team IDs for league 2
```

Each `seed-draft` prints the league ID and 4 team IDs. Record them:

```
League 1: <leagueId-1>
  Team 1 (commissioner): <teamId-1a>
  Team 2: <teamId-1b>
  Team 3: <teamId-1c>
  Team 4: <teamId-1d>

League 2: <leagueId-2>
  Team 1 (commissioner): <teamId-2a>
  Team 2: <teamId-2b>
  Team 3: <teamId-2c>
  Team 4: <teamId-2d>
```

---

## 2. Start the draft server

In a dedicated terminal:

```bash
npm run draft-server
```

Expected output: `Draft WS server listening on port 8080`

---

## 3. Connect all 8 clients (two leagues × 4 teams)

Open 8 terminals. Start each CLI client:

**League 1 (4 terminals):**
```bash
npm run draft-cli -- --league <leagueId-1> --team <teamId-1a> --start  # commissioner, starts draft
npm run draft-cli -- --league <leagueId-1> --team <teamId-1b>
npm run draft-cli -- --league <leagueId-1> --team <teamId-1c>
npm run draft-cli -- --league <leagueId-1> --team <teamId-1d>
```

**League 2 (4 terminals):**
```bash
npm run draft-cli -- --league <leagueId-2> --team <teamId-2a> --start  # commissioner, starts draft
npm run draft-cli -- --league <leagueId-2> --team <teamId-2b>
npm run draft-cli -- --league <leagueId-2> --team <teamId-2c>
npm run draft-cli -- --league <leagueId-2> --team <teamId-2d>
```

---

## 4. Assertions to verify during the draft

### Isolation
- [ ] No pick broadcast from league 1 appears in any league 2 client, and vice versa.
- [ ] The clock in league 1 fires independently from league 2 (they may be on different picks simultaneously).

### Correctness
- [ ] Each pick advances `currentOverall` by exactly 1.
- [ ] Snake order is correct: round 1 ascending, round 2 descending, etc.
- [ ] A player drafted in league 1 can also be drafted in league 2 (player pool is per-league).

### Reconnect
- [ ] Kill one non-commissioner client mid-draft (Ctrl-C). Reconnect with the same command.
  The client should receive the current STATE immediately on JOIN and resume normally.
- [ ] Kill the commissioner client mid-draft. Reconnect with `--start` flag (the `--start` flag
  is a no-op when the draft is already `IN_PROGRESS`). The commissioner's START/PAUSE/RESUME
  buttons should reappear after reconnect.

### Auto-pick
- [ ] Let a client's turn expire without picking. The server auto-picks within `autoPickTimerSecs`
  (10s default). The pick should be marked `auto: true` in the broadcast.
- [ ] After 2 consecutive auto-picks, that team's clock drops to 10s (already the default). Verify
  by watching the `expiresAt` in the STATE broadcast.

### Commissioner controls
- [ ] PAUSE: commissioner sends PAUSE → all clients receive STATE with `status: "PAUSED"`. Clock stops.
- [ ] RESUME: commissioner sends RESUME → clock restarts. Non-commissioner PAUSE/RESUME attempts
  should be rejected with `ERROR { code: "NOT_COMMISSIONER" }`.

### Queue persistence (restart test)
1. Set a queue for one team (draft-cli queues via the `q` command or similar).
2. Kill the draft server (`Ctrl-C`).
3. Restart the draft server (`npm run draft-server`).
4. Reconnect all clients. The queue should be preserved — when that team's turn auto-expires,
   the queued player should be picked.

### Completion
- [ ] Both leagues should complete all 13 rounds × 4 teams = 52 picks independently.
- [ ] Final STATE broadcasts `status: "COMPLETE"` to all clients.
- [ ] Server logs both rooms as complete without crossing state.

---

## 5. Post-draft DB verification

```sql
-- Verify picks count per league
SELECT fl.name, COUNT(dp.id) as picks
FROM "FantasyLeague" fl
JOIN "Draft" d ON d."leagueId" = fl.id
JOIN "DraftPick" dp ON dp."draftId" = d.id
WHERE dp."playerId" IS NOT NULL
GROUP BY fl.name;
-- Expected: two rows, each with 52 picks

-- Verify no player appears twice in the same league's draft
SELECT dp."playerId", COUNT(*) as c
FROM "DraftPick" dp
JOIN "Draft" d ON dp."draftId" = d.id
WHERE dp."playerId" IS NOT NULL AND d."leagueId" = '<leagueId-1>'
GROUP BY dp."playerId"
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

---

## 6. Pass criteria

| Check | Status |
|---|---|
| Both leagues complete 52 picks | |
| No cross-league broadcasts | |
| Reconnect restores correct state | |
| Queue survives server restart | |
| Commissioner auth enforced | |
| Auto-pick fires correctly | |
| DB shows 2 × 52 distinct picks | |

All rows must be checked before marking Draft Reliability Certification complete.
