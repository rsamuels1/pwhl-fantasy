---
name: project-beta-league
description: Beta league system — 4-week replay format for July 2026 beta testing, draft queue pre-ranking, prior-season stats in draft room
metadata:
  type: project
---

Beta league system shipped as part of the pre-launch beta program (June 2026).

**What was built:**
- `getPriorSeason(season)` helper in `lib/season/index.ts` — "2025-26" → "2024-25"
- `generateVtfMatchups` now accepts `options.weekIndices` to pick a subset of periods
- `generateBetaMatchups()` in `lib/scoring/matchups.ts` — picks 4 random fixture weeks, remaps them to real July 2026 dates for period lifecycle detection, stores fixture→remapped mapping in `scoringSettings.betaWeekMappings`
- `startSeason()` branches on `league.betaStatus === "ACTIVE"` to call `generateBetaMatchups` instead of the normal VTF flow
- Draft room (`app/draft/[leagueId]/page.tsx`) uses `getPriorSeason(league.season)` for `statSeason` when `league.isReplay === true`
- `POST /api/founder/beta-leagues` — creates an 8-team beta league with random week selection; teams 2–8 get bot placeholder users (`isBot=true`) that are replaced when real users are assigned
- `GET /api/founder/beta-signups` — returns all BetaSignup rows
- `POST /api/founder/leagues/[leagueId]/beta-users` — assigns a beta signup as commissioner or manager; finds open slots by `isBot === true`
- Draft queue REST API: `GET/PUT /api/leagues/[leagueId]/draft/queue` — reads/writes `Draft.queueData[teamId]`
- `app/team/[teamId]/draft-prep/page.tsx` + `DraftQueueManager.tsx` — pre-draft player rankings with star/queue UI; only accessible when `league.status === "PRE_DRAFT"`
- "Draft Queue" tab in `TeamNav.tsx` — only shown when `leagueStatus === "PRE_DRAFT"`; requires new `leagueStatus` prop passed from team layout
- Beta banner in both league and team layouts when `league.betaStatus === "ACTIVE"`
- "Beta Users" 6th tab in `LeagueDetailTabs.tsx` — cross-references BetaSignup rows against league teams; Make Commissioner / Add as Manager action buttons
- League Explorer page updated with "Create Beta League" inline form + "Beta" filter option

**Key decisions:**
- Bot placeholder users have emails like `bot-2-{leagueId}@beta.pwhlgm.internal` — allows schema non-nullable `ownerId` constraint; marked `isBot: true`
- Open slot detection uses `isBot === true` not `ownerId === null`
- `betaWeekMappings` stored in scoringSettings (already Json) — no schema change needed
- Draft date constrained to July 6–12, 2026 via API validation

**Why:** period status/lock detection uses Matchup.startsAt/endsAt (remapped to July); stat line scoring still uses original fixture dates via betaWeekMappings lookup. This separation is critical for scoring correctness.

**How to apply:** When working with beta league season advancement, remember that `scoringSettings.betaWeekMappings` holds the fixture→real-date mapping. The `advanceSeason` and `scoreVtfWeek` flows use the Matchup dates (remapped); beta scoring works because the score is computed from stat lines filtered by the Matchup period window — which for beta leagues covers the real July dates, not the fixture Nov/Apr dates. This means beta leagues need a scoring job that knows to use fixture dates for stat lookups. See plan §4 for full context.
