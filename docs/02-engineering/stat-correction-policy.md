# Stat Correction Policy

**Roadmap item:** IA-010  
**Status:** Implemented (policy + founder re-score endpoint)

---

## When corrections are accepted

| Phase | Correction window | Who can trigger |
|---|---|---|
| Regular season | Up to 7 days after the scoring period ends | Founder only |
| Playoffs | Before `advance-playoff-round` is called for the round | Founder only |
| Championship | Locked immediately once champion is crowned (`playoffStatus === COMPLETE`) | Not accepted |

All corrections are triggered manually by a founder via the re-score endpoint. There is no commissioner self-serve path in V1.

## What "re-scoring" means

`scoreVtfWeek()` in `lib/scoring/matchups.ts` is idempotent — calling it a second time recomputes all team scores from raw `StatLine` rows and overwrites the cached `Matchup.homeScore` / `awayScore` / `homeVP` / `awayVP`. VP standings and playoff seeding derived from those scores are automatically correct on the next read (they are computed live from matchup rows, never stored independently).

Stat lines themselves (`StatLine` rows) must be corrected directly in the database or via a future ingestion re-run before triggering a re-score. The re-score endpoint does not pull from HockeyTech — it re-scores whatever `StatLine` data is currently in the DB.

## API

```
POST /api/founder/leagues/[leagueId]/rescore-week
Body: { week: number }
Auth: FOUNDER_EMAILS env var (same as all founder routes)
```

Returns: `{ week, message, results: { teamName, score }[] }`

Every call writes a `LeagueEvent` audit row (`type: COMMISSIONER_SETTINGS_CHANGED`, data includes `action: "rescore-week"`, `week`, `triggeredBy`).

## Notifications

V1: no automatic notification to affected teams. The founder should post a league announcement explaining the correction via the admin panel if scores changed materially.

V2 (post-launch): trigger a `COMMISSIONER_ANNOUNCEMENT`-style notification to all team owners when a completed week is re-scored.

## Out of scope (post-launch)

- Commissioner self-serve re-score UI
- Automatic re-import of corrected stats from HockeyTech
- Rollback / undo of a re-score (run again to restore — `StatLine` rows are the source of truth)
- Per-player score correction without a full week re-score
