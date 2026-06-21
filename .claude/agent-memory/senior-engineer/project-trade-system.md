---
name: project-trade-system
description: Trade System (#7) shipped Sprint 7 — schema, engine, service, API, UI, tests all complete
metadata:
  type: project
---

Trade System (#7) was implemented and shipped in Sprint 7 (June 2026). All code is unstaged and ready for user review.

**Why:** Core retention feature for the PWHL Fantasy app. Unblocks trade-suggestion CTA in Team Analysis (#25).

**How to apply:** This feature is complete — do not re-implement. Reference the patterns below when building adjacent features.

## Key architectural decisions

- **Engine is pure (`lib/trades/engine.ts`)** — no IO. Same pattern as draft engine. Service layer (`lib/services/trade-service.ts`) owns all Prisma calls.
- **`applyTrade` routing**: derives proposing/receiving team IDs from roster membership (which roster contains the player), NOT from `item.fromTeamId === item.toTeamId`. The bug where all items were routed as "from proposing" was fixed by this approach.
- **`_validate` ordering**: stale check runs FIRST (before both-sides check), so ghost players return "STALE" not a misleading "proposing team must include at least one player" error.
- **Counter-offers**: new Trade row with `counterOfId` linking back; original flips to COUNTERED in same `$transaction`.
- **Commissioner review**: `acceptTrade` branches on `tradeReviewHours > 0 || requireCommissionerTradeApproval` — routes to PENDING_REVIEW or calls `executeTrade` directly.
- **Play-lock parity**: matches lineup play-lock rule — players who have played in current active period cannot be traded.
- **NotificationType**: defined as a local union in `notification-service.ts` (not from Prisma enum directly) — extended it with 6 trade types. This is the established pattern.

## Schema additions (deployed via `npx prisma db push`)

- `TradeStatus` enum (9 values)
- `Trade` + `TradeItem` models
- `tradeReviewHours Int @default(24)` on `FantasyLeague`
- `requireCommissionerTradeApproval Boolean @default(false)` on `FantasyLeague`
- 6 new `NotificationType` values (TRADE_RECEIVED/ACCEPTED/REJECTED/EXECUTED/VETOED/REVIEW_PENDING)

## Files created

- `lib/trades/engine.ts` — pure domain engine
- `lib/services/trade-service.ts` — service layer
- `app/api/leagues/[leagueId]/trades/route.ts` — GET + POST
- `app/api/leagues/[leagueId]/trades/[tradeId]/route.ts` — GET
- `app/api/leagues/[leagueId]/trades/[tradeId]/accept/route.ts`
- `app/api/leagues/[leagueId]/trades/[tradeId]/reject/route.ts`
- `app/api/leagues/[leagueId]/trades/[tradeId]/counter/route.ts`
- `app/api/leagues/[leagueId]/trades/[tradeId]/cancel/route.ts`
- `app/api/leagues/[leagueId]/trades/[tradeId]/review/route.ts` — commissioner only
- `app/api/leagues/[leagueId]/trade-settings/route.ts` — commissioner only
- `app/league/[leagueId]/trades/page.tsx` + `TradeCenter.tsx`
- `app/league/[leagueId]/trades/[tradeId]/page.tsx` + `TradeDetailView.tsx`
- `app/league/[leagueId]/trades/new/page.tsx` + `ProposeTrade.tsx`
- `components/TradeSettingsForm.tsx`
- `components/PendingTradeReviewList.tsx`
- `tests/trade.test.ts` (22 tests)

## Files modified

- `prisma/schema.prisma` — TradeStatus/Trade/TradeItem/NotificationType additions
- `lib/services/notification-service.ts` — extended NotificationType union
- `app/league/[leagueId]/layout.tsx` — added "Trades" nav link
- `app/league/[leagueId]/admin/page.tsx` — TradeSettingsForm + PendingTradeReviewList

## Test count: 202 total (22 new trade tests)
