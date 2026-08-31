# 🏒 PWHL GM

A fantasy hockey platform built specifically for the Professional Women’s Hockey League.

PWHL GM lets fans create leagues, draft real players, set lineups, and compete in weekly head-to-head matchups scored from real player performance. The product is being built around the 2026–27 PWHL season.

## Why I Built It

The PWHL is still a young league, which means a lot of the fantasy infrastructure that exists around established sports simply doesn’t exist yet.

I wanted to explore what a fantasy product designed specifically for the PWHL could look like — not just a reskinned version of an existing men’s hockey product.

The core question was:

**What would make following the league more engaging over an entire season — and give fans a reason to keep coming back?**

That led me toward persistent leagues, real player data, weekly matchups, playoffs, and season history rather than treating fantasy as a disposable one-season game.

## What I Built

- League creation and management
- Real-player fantasy rosters
- Live draft experience
- Weekly head-to-head matchups
- Configurable scoring
- Lineup management
- Standings
- Playoff brackets and playoff matchups
- Persistent league and season history
- Data ingestion designed to support a future real-world PWHL stats source

## Product Decisions

### Treat the draft as the highest-risk experience

The live draft room is one of the most important — and most failure-prone — moments in a fantasy product.

I treated it as a high-risk feature early rather than leaving it until the end, so I could learn about timing, state management, roster constraints, and user flow before the rest of the product became dependent on it.

### Separate fantasy logic from the stats source

There’s no official PWHL fantasy API, which creates a dependency I don’t control.

Instead of coupling the product to one data source, I created a `StatsSource` interface between the fantasy product and the underlying PWHL data.

That lets the product develop against mock data today while leaving room to swap in a licensed, scraped, or manual data source later.

### Recompute scores instead of treating them as truth

Fantasy points are calculated from raw stat lines rather than stored as the permanent source of truth.

That means a league can change its scoring rules and historical matchups can be recalculated correctly.

Cached scores can make the product faster, but the underlying player performance remains authoritative.

### Add playoffs without breaking the regular season

The playoff system sits on top of the existing league model rather than creating a separate product path.

Regular-season standings continue to operate normally, while playoff matchups, rounds, bracket generation, and playoff state are layered onto the same underlying system.

That keeps the model simpler while still allowing the fantasy experience to evolve.

## My Role

**Everything.**

Product strategy, feature definition, UX decisions, data modeling, architecture, development, testing, and iteration.

I use AI-assisted development heavily, which lets me move quickly from product question → working implementation → learning.

This project is partly about fantasy hockey, but it’s also an experiment in how much closer a product manager can get to the build-and-learn loop when the distance between product thinking and implementation becomes very small.
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
