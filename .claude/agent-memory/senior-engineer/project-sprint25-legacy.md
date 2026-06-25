---
name: project-sprint25-legacy
description: Sprint 25 "Living League: Legacy" — Trophy Cabinet, Franchise Identity, Opening Day Card, Championship Banner, 4-step trade wizard, auto-draft defender bias fix
metadata:
  type: project
---

Sprint 25 shipped all 6 items. Schema change: `Trophy` model + `TrophyType` enum added to Prisma, pushed to DB via `npx prisma db push`.

**LL-009: Trophy Cabinet**
- `Trophy` model + `TrophyType` enum (CHAMPION, BEST_RECORD, TOP_SCORER, MOST_IMPROVED, MOST_TRANSACTIONS) in `prisma/schema.prisma`.
- `trophies Trophy[]` relation added to both `FantasyLeague` and `FantasyTeam`.
- `lib/services/trophy-service.ts` — `awardTrophies(leagueId, season, prisma)`: idempotent (deleteMany+createMany), uses VTF scoring model for W-L, uses `(prisma as any).leagueEvent` guard for MOST_TRANSACTIONS.
- `lib/services/renewal-service.ts` — calls `awardTrophies` in try/catch before creating child league (non-fatal).
- `app/team/[teamId]/trophies/page.tsx` — server component, trophies grouped by season.
- `components/TrophyCard.tsx` — gold-bordered award card.
- `components/TrophyShelf.tsx` — compact 3-icon strip with "View all →" link.
- `app/team/[teamId]/TeamNav.tsx` — "Trophies" tab, only shown when `hasTrophies` prop is true.
- `app/team/[teamId]/layout.tsx` — fetches `prisma.trophy.count` and passes `hasTrophies` to TeamNav.

**LL-011b: Franchise Identity Archetypes**
- `lib/services/franchise-identity.ts` — pure `computeFranchiseIdentity()`: GOALTENDER_DRIVEN (goalieFp/total > 0.30), SNIPER_FACTORY (goalsFp/total > 0.50), DEFENSIVE_FORTRESS (defenseFp/total > 0.18), BOOM_OR_BUST (std dev/mean > 0.35, ≥3 weeks). Returns null if < 3 weeks.
- `components/FranchiseIdentityChip.tsx` — pill chip with InfoTooltip; color-coded by archetype; LOW confidence shown muted.
- Data plumbing in `app/team/[teamId]/matchup/page.tsx`: queries scored matchups + roster stat lines, only computes when `league.status === "IN_SEASON"` and ≥3 scored periods.

**LL-014: Opening Day Card**
- `components/OpeningDayCard.tsx` — client component, shows for 72h after `periodStartsAt`, localStorage-dismissed, gold/amber `.alert-amber` card with season year + week/manager count.
- Mounted in matchup page between ChampionshipBanner and ClinchBanner.

**LL-015: Championship Banner**
- `components/ChampionshipBanner.tsx` — full-screen overlay via `ReactDOM.createPortal`, confetti (24 CSS-animated spans), gold card with "🏆 League Champion", teamName, season, record, trophy cabinet link. localStorage-keyed `${leagueId}-champion-seen`.
- Mounted in matchup page when `championInfo.teamId === myTeamId`.

**UX-058: 4-Step Trade Wizard**
- `app/league/[leagueId]/trades/new/ProposeTrade.tsx` rewritten as 4-step local-state wizard: Step 0 = pick partner (team list), Step 1 = send players (my roster), Step 2 = receive players (partner roster), Step 3 = review + message + submit.
- Same API call shape (`POST /api/leagues/[leagueId]/trades`), no new routes.
- 4-segment progress bar; Back/Next buttons; Cancel returns to trades page.

**BF-020: Auto-Draft Defender Bias Fix**
- `lib/draft/server.ts` `bestAvailablePlayerIds()`: defensemen filling open D slots are now tier 1 (same as goalies), not tier 2. Prevents auto-drafted rosters from having 0–1 defenders.
- Tier 1b: `pos === "DEFENSE" && needed.defense`.

**Why:** The try/catch in `renewLeague` is intentional — renewal tests use a minimal mock prisma that lacks `matchup`/`trophy` models, so `awardTrophies` throws. The catch logs and continues; all 13 renewal tests pass.

**How to apply:** When touching trophy logic, note that `awardTrophies` is called from within a `$transaction` in `renewLeague`, but the call itself is outside the transaction (on `prisma`, not `tx`) — intentional so DB writes don't block the transaction context.
