# League History & Multi-Season UX (MS-005) — Engineering Spec

**Sprint:** 7
**Feature key:** MS-005
**Status:** Not implemented (schema foundation laid Sprint 2: parentLeagueId, rulesVersion, scoringVersion, renewLeague)
**Effort:** Backend S · Frontend M · Testing S
**Dependency:** Season renewal (`lib/services/renewal-service.ts`) must have been exercised by at least one real league

---

## What it does

Surfaces the league's history across seasons on a new `/league/[leagueId]/history` page.
Shows prior seasons linked via `parentLeagueId`, their champion, final standings, and key
stats. The schema and renewal service already exist; this is the read-path product surface.

Also adds a "League Hall of Fame" section (feature #18) on the same page — the champion of
each prior season, plus platform-wide single-season records (most FP, most VP).

---

## Data model

No new tables. Reads the existing `parentLeagueId` chain:

```
FantasyLeague (2027-28)
  └── parentLeagueId → FantasyLeague (2026-27)   ← the current league
        └── parentLeagueId → FantasyLeague (2025-26)
```

**What's already there:**
- `FantasyLeague.parentLeagueId` (nullable, self-referencing "LeagueLineage" relation) ✅
- `GET /api/leagues/[leagueId]/history` already implemented in `renewal-service.ts`:
  walks depth-10 chain, returns seasons ordered oldest-first with champion ✅
- `FantasyLeague.season` (string, e.g. "2026-27") ✅

**What's new:** the UI surface only. No schema changes.

---

## API routes

The `/api/leagues/[leagueId]/history` GET route already exists (per CLAUDE.md). Verify it
returns:
```ts
interface LeagueHistorySeason {
  leagueId: string;
  season: string;
  champion: { teamId: string; teamName: string; ownerName: string } | null;
  standings: { rank: number; teamName: string; vp: number; wins: number }[];  // top 4
}
```

If the existing route doesn't include `standings`, extend it to pull the final `Matchup`-derived
VP standings for each season (same `computeVpStandings` call on completed matchups).

No new routes needed.

---

## Key files

- `app/league/[leagueId]/history/page.tsx` — new server page; calls
  `GET /api/leagues/[leagueId]/history`; renders season cards + Hall of Fame section
- `app/league/[leagueId]/layout.tsx` — add "History" to the nav (`NavItem`) when
  `league.parentLeagueId !== null` OR `childLeagues.length > 0`. Hide the tab in season 1
  (no history yet) to avoid a confusing empty page.
- `components/SeasonHistoryCard.tsx` — compact card per past season: season label, champion
  name + team, final standings top-4, link to that season's bracket

**Hall of Fame section (feature #18, same page):**
- "Champions" — list all past champions with season label
- "Records" — two rows: "Most FP in a week (single team)" and "Most VP in a season";
  derive from `Matchup.homeScore`/`awayScore` and cumulative VP from `computeVpStandings`
  across all seasons in the lineage chain

---

## Computation approach

`app/league/[leagueId]/history/page.tsx` (server component):
1. Call `GET /api/leagues/[leagueId]/history` — returns the ordered season list.
2. For each past season: display the champion prominently; show the top-4 final standings.
3. For Hall of Fame: compute across all seasons:
   - Highest single-week team score: max of all `Matchup.homeScore` and `Matchup.awayScore`
     across all league IDs in the chain.
   - Most VP in a single season: max of computed VP totals per team per season.

Since the lineage chain depth is capped at 10 (per `renewal-service.ts`), the full history
query is bounded.

---

## Edge cases / gotchas

- **First-season leagues:** if `parentLeagueId === null` and no child leagues exist, the
  History tab is hidden. Don't render an empty page.
- **Champion not yet decided:** `playoffStatus !== "COMPLETE"` → champion is null for that
  season. Show "(Season in progress)" instead of a champion name.
- **`computeVpStandings` per historical season:** these are all `isPlayoff: false` matchups
  for the season's leagueId, scoped to `status: "COMPLETE"`. Same call as the standings page,
  just for a different `leagueId`.
- **Records spanning seasons:** the "records" section queries all `leagueId`s in the chain.
  Use a `leagueId IN [...]` filter — the chain depth is bounded, so this is safe without
  pagination.
- **Renewal service is idempotent:** if a league has been renewed more than once, walking the
  chain returns all prior seasons. The `depth-10` cap in `renewal-service.ts` prevents infinite
  loops.

---

## Acceptance criteria

- [ ] `/league/[leagueId]/history` page exists and is linked in the league nav (tab hidden in season 1)
- [ ] Past seasons shown as cards: season label, champion, top-4 standings
- [ ] Hall of Fame section shows all past champions listed chronologically
- [ ] Records section: highest single-week team FP and highest single-season VP (across all seasons in chain)
- [ ] Current in-progress season excluded from past champions (shows "Season in progress")
- [ ] No schema changes required
