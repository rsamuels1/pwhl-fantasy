# Parent League Foundation — Execution Plan

Version: 1.0
Status: Approved
Owner: Engineering
Sprint: Sprint 2 (post-MVP launch)

---

## Context

The product is nearing MVP launch. After Season 1 completes, commissioners need a way to renew their league for Season 2 without rebuilding it from scratch. Without a `parentLeagueId` link, every renewed league is an orphan: no shared history, no champion continuity, no path to keeper/dynasty support. This plan implements the minimum schema and service foundation to make multi-season leagues possible, gated by a renewal UI that only appears when a season is fully complete.

Source documents: `docs/06-architecture/implement-parentleagueid.md` (MS-001), `docs/06-architecture/season-renewal-system.md`.

**Scope of this plan:** Schema plumbing + renewal service + two API routes + admin panel CTA. No keeper leagues, no historical leaderboards, no franchise statistics — those are Phase 2+.

---

## Design Decisions

### Self-referencing FantasyLeague (not a new ParentLeague model)

`implement-parentleagueid.md` proposes a separate `ParentLeague` model; `season-renewal-system.md` uses a self-referencing `parentLeagueId` on `FantasyLeague`. The self-referencing approach is correct for the foundation:

- One nullable field addition — additive, zero data migration risk
- No new model needed until there is UI that benefits from querying parent-level metadata independently
- All existing leagues get `parentLeagueId = null` automatically (they are their own root)

Chain semantics: each renewed league's `parentLeagueId` points to its **immediate predecessor**. `2025 ← 2026 ← 2027`. Traversal walks back; queries for all seasons walk forward via the inverse relation.

### No `seasonYear Int` field

The existing `season String` (e.g. `"2026-27"`) is already the human-readable season identifier. A redundant Int column adds schema noise. The `season` string is copied and bumped during renewal (commissioner can edit it in the confirmation step).

### Double-renewal guard

A league may only be renewed once. Before creating the child league, the service checks `childLeagues.length === 0`. If a child already exists, it returns the existing child's ID rather than creating a duplicate.

---

## Phase 1 — Schema Changes

**File:** `prisma/schema.prisma`

Add two fields and a named self-referencing relation to `FantasyLeague`:

```prisma
model FantasyLeague {
  // ... existing fields ...
  parentLeagueId  String?         // nullable — null means this is a root/first season
  parentLeague    FantasyLeague?  @relation("LeagueLineage", fields: [parentLeagueId], references: [id])
  childLeagues    FantasyLeague[] @relation("LeagueLineage")

  @@index([parentLeagueId])
}
```

**Migration:** `npx prisma db push` — purely additive nullable column. All existing rows get `parentLeagueId = null`. No data migration needed.

For production: use `npx prisma migrate dev --name add-parent-league-id` to generate a proper migration file.

---

## Phase 2 — Renewal Service

**New file:** `lib/services/renewal-service.ts`

Follows the established service pattern: `prisma: PrismaClient` as the last parameter, no default Prisma instance, explicit return type.

```ts
export class RenewalBlockedError extends Error {}

export async function renewLeague(
  leagueId: string,
  overrides: { name?: string; season?: string; draftStartsAt?: Date | null },
  prisma: PrismaClient
): Promise<{ newLeagueId: string }>
```

**Logic (in order):**

1. Load source league with `childLeagues` included
2. Validate preconditions — throw `RenewalBlockedError` if:
   - `league.playoffStatus !== "COMPLETE"`
   - `league.childLeagues.length > 0` (already renewed — return existing child ID instead)
3. Copy settings: `scoringSettings`, `rosterSettings`, `playoffSettings`, `scoringMode`, `draftType`, `maxTeams`
4. Create new `FantasyLeague`:
   - `name` — `overrides.name ?? league.name`
   - `season` — `overrides.season ?? bumpSeason(league.season)` (helper: `"2026-27"` → `"2027-28"`)
   - `parentLeagueId` — `leagueId`
   - `status` — `PRE_DRAFT`
   - `playoffStatus` — `NOT_STARTED`
   - `commissionerId` — same commissioner
   - `draftStartsAt` — `overrides.draftStartsAt ?? null`
   - All other fields default (no draft, no matchups, no roster entries)
5. Return `{ newLeagueId: newLeague.id }`

**Helper:** `bumpSeason(season: string): string` — pure function. `"2026-27"` → `"2027-28"`.

**Note:** Do NOT auto-create FantasyTeam stubs in this sprint. The commissioner adds teams via the existing admin flow after renewal. Team auto-carry-forward is a Phase 2 feature.

---

## Phase 3 — API Routes

### POST `/api/leagues/[leagueId]/renew`

**New file:** `app/api/leagues/[leagueId]/renew/route.ts`

- Auth: `apiRequireCommissioner` (commissioner-only)
- Body: `{ name?: string; season?: string; draftStartsAt?: string | null }`
- Calls `renewLeague(leagueId, overrides, prisma)`
- On `RenewalBlockedError`: returns 409 with descriptive message
- On success: returns `{ newLeagueId, redirectTo: "/league/${newLeagueId}/admin?renewed=1" }`

### GET `/api/leagues/[leagueId]/history`

**New file:** `app/api/leagues/[leagueId]/history/route.ts`

- Auth: `apiRequireLeagueMember` (any member)
- Walks the league chain (back via `parentLeagueId` to find root, forward via `childLeagues`)
- Returns `{ seasons: [{ id, name, season, status, playoffStatus, champion?: { teamName, ownerName } }] }` ordered oldest-first
- Champion derived from the winning team in the final playoff matchup
- Depth limit: 10 leagues max

---

## Phase 4 — Admin Panel UI

**Modified file:** `app/league/[leagueId]/admin/page.tsx`

Add a "Start Next Season" section gated on `league.playoffStatus === "COMPLETE"`:

```tsx
{league.playoffStatus === "COMPLETE" && (
  <section>
    <h2>Start Next Season</h2>
    <p>The season is complete. Renew this league to create next season's instance.</p>
    <RenewLeagueForm leagueId={league.id} currentSeason={league.season} />
  </section>
)}
```

**New client component:** `components/RenewLeagueForm.tsx`

- Pre-fills: bumped season string, current league name
- Editable: league name, season string, draft date
- POSTs to `/api/leagues/[leagueId]/renew`
- On success: `router.push(data.redirectTo)`

**Welcome banner:** When `?renewed=1` is in query params, show amber banner: `"New season created. Invite managers and set a draft date to get started."`

---

## Phase 5 — League Overview History Strip (optional)

**Modified file:** `app/league/[leagueId]/page.tsx`

When `league.parentLeagueId` is non-null, show a small franchise breadcrumb chip at the top. No full history view yet — just: `"↩ Franchise: Season 2 of 2"` linking to root league overview.

Implement if time permits; does not block the renewal flow.

---

## Migration Strategy

| Step | Action | Risk |
|---|---|---|
| 1 | `prisma db push` with `parentLeagueId String?` added | Zero — additive nullable |
| 2 | `prisma generate` to update the Prisma client | Zero |
| 3 | All existing leagues: `parentLeagueId = null` automatically | Zero |
| 4 | No backfill needed for existing leagues | — |

**No existing code breaks.** The new field is optional everywhere.

---

## Rollout Order

1. Schema + `prisma db push`
2. `bumpSeason` helper + `renewLeague` service + unit tests
3. `POST /renew` API route
4. `GET /history` API route (can be done in parallel with step 3)
5. `RenewLeagueForm` component + admin panel section
6. Overview history strip (optional polish)

---

## Testing Plan

### Unit Tests — `tests/renewal.test.ts` (new file)

| Test | What it verifies |
|---|---|
| Happy path | Creates child league with correct `parentLeagueId`, settings copied, status = PRE_DRAFT |
| Settings copy | `scoringSettings`, `rosterSettings`, `playoffSettings` match parent |
| Season bump | `bumpSeason("2026-27")` returns `"2027-28"` |
| Season bump boundary | `bumpSeason("2029-30")` handles year rollover |
| Override name | `overrides.name` takes precedence over parent name |
| Override season | `overrides.season` takes precedence over bumped season |
| Blocked: not complete | Throws `RenewalBlockedError` when `playoffStatus !== COMPLETE` |
| Blocked: already renewed | Returns existing child ID when `childLeagues.length > 0` |
| Seasonal data not copied | New league has no matchups, no draft, no roster entries |
| Commissioner preserved | `commissionerId` is the same on the new league |

### Integration — `scripts/simulate-season.ts --with-renewal`

Extend the existing simulate-season script to:
1. After champion is determined, call `renewLeague`
2. Assert new league has `parentLeagueId = original league ID`, status `PRE_DRAFT`
3. Assert `GET /history` returns both seasons

### Manual Verification Checklist

- [ ] Admin panel shows "Start Next Season" after playoffs complete
- [ ] `RenewLeagueForm` pre-fills with bumped season string
- [ ] POST `/renew` redirects to new league admin with `?renewed=1` banner
- [ ] New league has `PRE_DRAFT` status, correct settings copied
- [ ] Old league is unmodified (immutable)
- [ ] `GET /history` returns both leagues ordered oldest-first
- [ ] Double-renewal returns 409
- [ ] Renewal blocked (409) when `playoffStatus !== COMPLETE`
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` passes

---

## Files Changed Summary

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `parentLeagueId`, self-ref relation, `@@index([parentLeagueId])` |
| `lib/services/renewal-service.ts` | New — `renewLeague`, `bumpSeason`, `RenewalBlockedError` |
| `app/api/leagues/[leagueId]/renew/route.ts` | New — POST, commissioner-only |
| `app/api/leagues/[leagueId]/history/route.ts` | New — GET, member-accessible |
| `components/RenewLeagueForm.tsx` | New — client form component |
| `app/league/[leagueId]/admin/page.tsx` | Add renewal section (gated on `playoffStatus === COMPLETE`) |
| `app/league/[leagueId]/page.tsx` | Add season chip when `parentLeagueId` is set (optional) |
| `tests/renewal.test.ts` | New — 10 unit tests |
| `scripts/simulate-season.ts` | Extend with `--with-renewal` flag |

---

## Out of Scope (This Plan)

- Auto-inviting returning managers after renewal (Phase 2)
- `invitedFromPreviousSeason` analytics field on `FantasyTeam`
- Historical leaderboards / franchise statistics UI
- Commissioner succession / "take over league" flow
- Keeper leagues, dynasty leagues
- `renewalStatus` field (`childLeagues.length > 0` serves the same purpose)
- Full league history page at `/league/[leagueId]/history`
