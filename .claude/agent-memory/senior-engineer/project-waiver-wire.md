---
name: project-waiver-wire
description: Waiver wire system architecture — WaiverEntry/WaiverClaim/WaiverPriority models, service functions, API routes, UI integration
metadata:
  type: project
---

Waiver wire shipped as of the session ending ~June 2026. Key facts:

- Dropped players go on 48h waivers (configurable via `FantasyLeague.waiverWindowHours`).
- Never-rostered free agents remain immediately addable (no waivers).
- Priority order: reverse VP standings (worst team = priority 1). Pre-season: reverse draft order.
- Rolling waiver: after winning a claim, the team moves to last priority.
- `processWaivers()` is idempotent — safe to run multiple times.

**Models added to schema:**
- `WaiverEntry` — one row per player-on-waivers, `@@unique([leagueId, playerId])`
- `WaiverClaim` — pending/awarded/denied/cancelled, `@@unique([leagueId, fantasyTeamId, addPlayerId])`
- `WaiverPriority` — `@@id([leagueId, fantasyTeamId])`, `@@unique([leagueId, priority])`
- `WaiverStatus` enum: PENDING | AWARDED | DENIED | CANCELLED
- `EventType` enum extended: WAIVER_CLAIM_SUBMITTED | WAIVER_CLAIM_AWARDED | WAIVER_CLAIM_DENIED | WAIVER_CLAIM_CANCELLED
- `FantasyLeague.waiverWindowHours Int @default(48)`

**Key service: `lib/services/waiver-service.ts`**
- `initializeWaiverPriority()` — called by `startSeason()` after matchup generation
- `enterWaiverWire()` — called by DELETE /api/leagues/[leagueId]/waiver after a drop
- `getPlayerWaiverStatus()` — checked by POST /waiver before allowing immediate adds
- `submitClaim()` — creates WaiverClaim row
- `processWaivers()` — processes expired entries, awards/denies claims, rotates priority

**API routes:**
- `POST /api/leagues/[leagueId]/waiver` — checks waivers first; 409 with `onWaivers: true` if on waivers
- `DELETE /api/leagues/[leagueId]/waiver` — calls `enterWaiverWire()` after drop
- `GET/POST/DELETE /api/leagues/[leagueId]/waivers` — wire state, submit claim, cancel claim
- `POST /api/leagues/[leagueId]/waivers/process` — commissioner-only; founder console button calls this
- `npx tsx scripts/process-waivers.ts` — cron-runnable script for all IN_SEASON leagues

**UI:**
- `components/WaiverWirePanel.tsx` — 3-section client component (wire table, my claims, priority order)
- `RosterManager.tsx` — "Waiver Wire" tab added; FA rows show "On Waivers" badge; Claim button redirects to tab
- `TransactionFeed.tsx` — "Waivers" filter tab maps to 4 new event types

**Why:** The immediate-add path stays unchanged for non-waiver players. The `@@unique` constraint on `WaiverClaim` prevents double-claim attempts at the DB level.
