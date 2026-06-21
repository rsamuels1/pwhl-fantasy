# PWHL GM

A fantasy sports web app for the Professional Women's Hockey League, targeting the
2026-27 season (12 teams). Create leagues, draft real players the week before the
opener, set lineups, and compete in weekly head-to-head matchups scored from real stats.

## Quick start

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL
npx prisma migrate dev        # create the database schema
npm run seed                  # load mock teams/players for development
npm run dev                   # http://localhost:3000
npm test                      # run the scoring engine tests
```

To seed a playoff test league and sample playoff matchups:

```bash
npx tsx scripts/seed-playoff.ts [--init-playoffs]
```

You need a local PostgreSQL database (or a hosted one). Point `DATABASE_URL` at it.

## Project structure

```
.
├── CLAUDE.md                 # READ FIRST — project context, constraints, build order
├── prisma/
│   ├── schema.prisma         # database schema (league data + fantasy data)
│   └── seed/seed.ts          # mock StatsSource + DB seeding
├── lib/
│   ├── scoring/index.ts      # scoring engine (pure; the core logic)
│   ├── ingestion/source.ts   # StatsSource interface — the seam to PWHL data
│   └── db/                    # Prisma client singleton, query helpers
├── app/                       # Next.js App Router
│   ├── api/                   # route handlers
│   ├── draft/                 # the live draft room (highest-risk feature)
│   └── league/                # league management, rosters, matchups
├── components/                # shared UI
└── tests/                     # scoring.test.ts and others
```

## The two things outside your control

1. **Stats source.** There's no official PWHL fantasy API. Everything real-world flows
   through `lib/ingestion/source.ts`. Pick a concrete source (scrape / license / manual)
   early — it can block live scoring. Until then, develop against the mock in `seed.ts`.
2. **Official season start date** isn't announced yet. Nothing hardcodes dates; the
   draft and matchup schedule are driven by data. Re-anchor when the league publishes.

## Why scoring is computed, not stored

Fantasy points are always recomputed from raw `StatLine` rows via `lib/scoring`. This
means a league can change its scoring rules and every past matchup recomputes correctly.
Cached scores on `Matchup` are an optimization, never the source of truth.

## Playoff integration

A new playoff system now sits on top of the existing fantasy workflow without replacing
regular-season scoring or standings. Playoff matchups are stored in `Matchup` rows with
`isPlayoff=true` and `round`, while regular-season standings continue to be computed
from `!isPlayoff` matchups.

The new playoff flow includes:
- league playoff settings in `FantasyLeague.playoffSettings`
- playoff status tracking in `FantasyLeague.playoffStatus`
- bracket generation in `lib/playoffs/`
- playoff matchup creation in `lib/scoring/matchups.ts`
- new endpoints under `app/api/leagues/[leagueId]`
- bracket UI at `app/league/[leagueId]/bracket`

## Note on entry fees

If you plan to take entry fees, fantasy contests intersect with gambling and data
regulations that vary by state/province. Confirm the rules for your launch markets
before going live — this isn't legal advice.
