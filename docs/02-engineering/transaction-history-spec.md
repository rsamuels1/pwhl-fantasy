# Transaction History Specification

**Roadmap item:** #8 Transaction History (Sprint 3 — Beta Readiness)

**Priority:** P1

**Status:** Shipped

**Estimated tokens:** ~55K

**Related documents:**
- `docs/01-roadmap/roadmap.md` (#8, Sprint 3, Sprint 6+ sections)
- `docs/01-roadmap/roadmap-gpt.md` (TR-000 section)
- `docs/02-engineering/trade-spec.md` (dependencies)
- `docs/02-engineering/waiver-spec.md` (dependencies)
- `lib/services/activity.ts` (existing event infrastructure)
- `lib/services/audit-service.ts` (commissioner audit logging)

---

# Overview

Transaction History is the league-wide record of every roster-changing action: player adds, drops, trades, waiver claims, draft picks, and commissioner overrides. It is the **infrastructure layer** that unblocks Trade System (#7), Waiver Priority (#5), and FAAB (#6).

The platform already emits `LeagueEvent` rows for all of these actions (via `emitEvent()` in `lib/services/activity.ts` and `logCommissionerAction()` in `lib/services/audit-service.ts`). What's missing is a **dedicated query API and UI surface** for browsing them.

**No schema changes required.** The existing `LeagueEvent` model supports everything this feature needs.

---

# Current State

## Existing event coverage

| Event type | Emitted by | Coverage |
|---|---|---|
| `DRAFT_PICK` | `lib/draft/server.ts` | ✅ Every pick, with round/pick number and player name |
| `PLAYER_ADD` | `app/api/leagues/[leagueId]/waiver/route.ts` (POST) | ✅ Free-agent adds (with description) |
| `PLAYER_DROP` | `app/api/leagues/[leagueId]/waiver/route.ts` (POST + DELETE) | ✅ Player drops (with description) |
| `TRADE` | Not emitted yet (Trade System #7 not built) | ⏳ Future |
| `PLAYOFF_QUALIFICATION` | `lib/services/playoff-service.ts` | ✅ When playoffs are initialized |
| `COMMISSIONER_*` | Various commissioner API routes via `audit-service.ts` | ✅ 7 event types for all commissioner actions |

## What's missing

1. **No paginated, filterable API** — `getLeagueActivity` is limited to a small `take` and has no filtering.
2. **No dedicated transaction history page** — only the last 5-6 events show in the sidebar activity feed.
3. **No team-scoped view** — a manager can't see all transactions for their own team.
4. **No event enrichment** — descriptions exist as strings in `data`, but no relational enrichment (resolved team/player names).

---

# API Design

## `GET /api/leagues/[leagueId]/transactions`

**Auth:** `apiRequireLeagueMember`

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `teamId` | `string?` | `null` | Filter to a specific team's events |
| `type` | `string?` | `null` | Filter by event type (comma-separated for multiple) |
| `before` | `string?` (ISO) | `null` | Cursor pagination: return events before this timestamp |
| `limit` | `number` | `25` | Max events to return (max 100) |

**Response:**

```ts
{
  events: {
    id: string;
    type: string;
    teamId: string | null;
    teamName: string | null;       // resolved from team FK
    playerId: string | null;
    playerName: string | null;     // resolved from player FK
    description: string;           // from data.description or derived
    createdAt: string;             // ISO 8601
  }[];
  hasMore: boolean;
}
```

---

# UI Design

## Route: `/league/[leagueId]/transactions`

**Access:** Any league member (`requireLeagueMember`)

**Nav:** Added to the league layout nav bar after Rosters.

**Page structure:**

- **Type filter tabs:** All | Adds/Drops | Draft | Trades | Commissioner | Playoffs
- **Team filter dropdown:** "All teams" + each team name (pre-selectable via `?team=<id>`)
- **Event list:** icon + description + team name + relative timestamp + optional player link
- **Pagination:** scroll-to-bottom via IntersectionObserver, fallback "Load more" button
- **Empty state:** "No transactions yet. Actions like draft picks, player adds, and drops will appear here."
- **Error state:** "Unable to load transaction history." with retry button

**Client component:** `TransactionFeed.tsx` — handles filter changes, pagination, and client-side navigation via `router.push` to update searchParams.

---

# Implementation Plan

## Phase 1: API Route

| File | Action |
|---|---|
| `app/api/leagues/[leagueId]/transactions/route.ts` | **Create** — GET handler with pagination, filtering, replay guard |
| `lib/services/activity.ts` | **Extend** — add `getTransactions()` with cursor/type/team filtering |

## Phase 2: Transaction History Page

| File | Action |
|---|---|
| `app/league/[leagueId]/transactions/page.tsx` | **Create** — server component, fetches initial data |
| `app/league/[leagueId]/transactions/TransactionFeed.tsx` | **Create** — client component with filters, pagination, rendering |
| `app/league/[leagueId]/layout.tsx` | **Modify** — add "Transactions" to league nav |

---

# Dependencies

| Dependency | Status |
|---|---|
| `LeagueEvent` model | ✅ Exists — no schema changes |
| `EventType` enum | ✅ Exists |
| `emitEvent()` / `getLeagueActivity()` | ✅ Exists — kept for backward compat |
| Auth middleware | ✅ Exists |
| Replay mode (`getReplayNow`) | ✅ Exists |
| Trade System (#7) | ⏳ Sprint 6+ — history ready for `TRADE` events |
| Waiver Processing (#5) | ⏳ Sprint 6+ — history ready for waiver claims |

---

# Acceptance Criteria

1. League transaction page at `/league/[leagueId]/transactions` shows all events, newest first
2. Type filter tabs narrow results correctly
3. Team filter dropdown narrows to a single team
4. Pagination loads more on scroll (or "Load more" button)
5. Rich display shows icon, description, team name, timestamp, player name
6. Replay mode filters out events past the simulated "now"
7. Empty state renders when no events match
8. Auth guard — only league members can view the page
9. No regressions in existing league activity feed
10. `npx tsc --noEmit` passes clean
11. `npm test` passes (149 tests)
