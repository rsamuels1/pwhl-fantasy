# Beta Deployment Architecture

Status: active — beta is live. Owner: solo engineer.  
Last updated: 2026-06-22.

> **See [`environments.md`](environments.md) for the full two-environment runbook** (domain wiring, Neon branches, Render services, env var matrix, go-live gate). This document covers the rationale and risk model; `environments.md` covers the how-to.

## TL;DR

Run **two branches** (`main` = production, `dev` = preview) against **two Neon database branches**
(prod + a `preview` branch), all under **one Vercel project**. The league-type flags
(`betaStatus`, `isReplay`, `isPublic`) are excellent for *product* isolation — keeping beta leagues
out of public listings and letting replay testers run on their own clock — but they do **not**
replace environment isolation for schema and migration safety. The one change that must happen
before beta: stop deploying schema with `prisma db push` and switch the build to
`prisma migrate deploy`.

## Does the league-type system eliminate the need for separate environments?

**Partially — it eliminates the need for a separate beta DB for runtime data, but not the need
for a separate preview environment for code and schema.**

Here's the honest breakdown of what the flags actually buy you:

| Concern | Handled by league flags? | Why |
|---|---|---|
| Beta leagues hidden from public directory | ✅ Yes | `isPublic=false` keeps them out of the LEAGUES showcase / open-league directory |
| Beta cohort tracking & lifecycle | ✅ Yes | `betaStatus` (NONE→INVITED→ACCEPTED→ACTIVE→RENEWED), managed in the Founder Console |
| Replay testers on their own clock | ✅ Yes | `isReplay` + `replayCurrentDate` per-league; `getReplayNow()` reads the row, not a global cookie. No time bleed between leagues. |
| Beta users can't see live-season users' data | ✅ Yes | Auth guards are league-scoped; a beta user only sees leagues they're a member of |
| **A bad migration corrupting beta users' data** | ❌ **No** | Schema is global. `db push`/`migrate deploy` hits every row of every league regardless of flags. |
| **A buggy hotfix taking down active beta** | ❌ **No** | Code is global to the deployment. There is no row-level "run old code for this league." |
| **Testing a risky change before beta sees it** | ❌ **No** | You need a separate deployment + DB to test against. Flags can't sandbox code. |

**Conclusion:** Use the flags for what they're great at — product-level isolation inside one
production database. But you still need a preview environment (branch + DB) so you can validate
schema migrations and risky code *before* they touch the DB that active beta users are sitting on.
The flags isolate *leagues from each other*; they do nothing to isolate *a deploy from itself*.

## Recommended branch + Vercel setup

Keep it to two long-lived branches. A solo engineer does not need GitFlow.

```
GitHub
├── main ───────────────► Vercel "Production" deploy ──► Neon "main" branch (prod DB)
│                          fantasy.dykedb.org (full app, after go-live gate)
│                                             (currently: /beta only, host-gated)
│                          BETA USERS LIVE HERE
│
└── dev ────────────────► Vercel "Preview" deploy ────► Neon "preview" branch (preview DB)
                           fantasydev.dykedb.org (full app, no invite needed)
                           YOU TEST HERE. Safe to break.

   feature work ─► push to dev ─► auto-deploy to fantasydev.dykedb.org ─► verify ─► PR dev→main ─► prod
   hotfix ──────► branch off main ─► PR straight to main (see "Hotfix" below)
```

- **`main`** is sacred. It is what beta users hit. Only merge to it via PR after the change has
  run on `dev`/preview.
- **`dev`** is your daily driver. Push freely. Every push gets a Vercel preview URL wired to the
  *preview* Neon branch, so you can run `db push` there with zero risk to beta. The custom domain
  `fantasydev.dykedb.org` bypasses Vercel's email-invite gate — anyone with the URL can test.
- **Feature branches** are optional for a solo dev — `dev` can be your integration branch. Use
  them only when you want an isolated preview URL for one change.
- **Do not** create a third `beta` branch. Beta is not a code variant; it's the production
  deployment with `betaStatus` rows. A `beta` branch would immediately drift from `main` and
  become a second prod you have to babysit.

### Vercel project config

- **One project.** Vercel already maps `main` → Production and every other branch → Preview
  automatically. Don't make a second project.
- Set the **Production Branch** = `main` (Settings → Git).
- `fantasy.dykedb.org` is attached to Production and is host-gated in `middleware.ts` via the
  `BETA_HOST` env var (defaults to `"fantasy.dykedb.org"`). It currently exposes `/beta` only.
- `fantasydev.dykedb.org` is a custom domain assigned to the `dev` branch Preview — it bypasses
  Vercel's auth protection and serves the full app. See `environments.md` for setup steps.
- When the go-live gate is cleared, set `BETA_HOST=""` in Production env vars to open
  `fantasy.dykedb.org` to the full app without a code deploy.

## Database strategy: single DB with Neon branching (NOT a separate beta DB)

**Recommendation: one Neon project, two Neon branches.**

- **`main` Neon branch** = production data. Beta users' leagues live here. Replay, live, and beta
  leagues coexist in the same tables, isolated by row flags. This is fine and intended — there is
  no data-integrity reason to split beta runtime data into its own DB, because:
  - Fantasy points are never stored as source of truth (recomputed from `StatLine`).
  - Replay time is per-league (`replayCurrentDate`), so no global-clock contamination.
  - All access is league-scoped by auth guards.
- **`preview` Neon branch** = a copy-on-write branch of prod for your `dev` environment. Neon
  branches are cheap and instant. Point the Preview env's `DATABASE_URL` at this branch. Now you
  can `prisma db push` experimental schema against real-shaped data without touching beta.

Do **not** stand up a wholly separate beta database. It would double your migration surface (every
schema change applied twice, kept in sync by hand) for no isolation benefit the row flags don't
already provide.

```
Neon project: pwhl-fantasy
├── branch: main      ← Production DATABASE_URL   ← beta users + (later) public
└── branch: preview   ← Preview DATABASE_URL      ← your throwaway testing
```

Refresh the `preview` branch from `main` whenever you want realistic data: reset/recreate the
Neon `preview` branch from `main` (Neon dashboard or CLI). It's a metadata operation, not a
dump/restore.

## Migration safety protocol during beta

This is the part that will actually bite you. **The current build runs
`prisma generate && next build` and schema is applied by hand with `prisma db push`.** `db push`
is destructive-by-inference: it makes the DB match the schema with no migration history and no
review step. That is acceptable in dev, dangerous with live beta users.

### Required change before beta — ✅ SHIPPED

The build now runs `prisma generate && prisma migrate deploy && next build`. `migrate deploy`
only applies committed migration files — never invents destructive changes, never prompts, and
records what ran. Two migrations are committed and applied to the prod Neon branch.

Keep using `prisma db push` **only** against the `preview` Neon branch while iterating. Once
the shape is right, generate a migration:
`prisma migrate dev --name <change>` (against preview), commit it, then it ships to prod via
`migrate deploy` on the next `main` deploy.

### The protocol for any schema change during beta

1. Branch/work on `dev`. `prisma db push` against the **preview** DB. Iterate.
2. When stable: `prisma migrate dev --name <change>` to create the migration file.
3. Review the generated SQL by hand. Specifically look for:
   - `DROP COLUMN` / `DROP TABLE` — never ship without an explicit backfill/rename plan.
   - `ALTER COLUMN ... SET NOT NULL` on a populated table — will fail or lock if existing rows are
     null. Add the column nullable first, backfill, then tighten in a later migration.
   - Type changes (`ALTER COLUMN ... TYPE`) — can rewrite the whole table; on Neon this can lock
     the table. Prefer add-new-column + backfill + drop-old over in-place type change.
   - New `@default` values — Prisma defaults are applied to *new* rows only. Existing rows are
     **not** backfilled. If you need existing rows to get the value, write a data migration.
   - Missing indexes on new FKs / hot query columns.
4. Apply to preview via `migrate deploy`, smoke-test the `dev` deployment.
5. PR `dev` → `main`. The prod deploy runs `migrate deploy`. Done.

### Expand/contract for anything risky

For column drops, renames, or NOT NULL tightening on populated tables, use two deploys:

- **Expand:** add the new nullable column / new table. Deploy. Backfill data. Code reads both old
  and new.
- **Contract:** once backfilled and verified, drop the old column in a second migration. Deploy.

This is the only safe way to evolve schema while beta users have live data in it.

## What to do when a hotfix is needed mid-beta

A hotfix is **code-only** the vast majority of the time. Keep it that way.

1. **Code-only hotfix (preferred):**
   - Branch off `main`: `git checkout -b hotfix/<thing> main`.
   - Make the fix. Run `npx tsc --noEmit` and `npm test` locally.
   - Open a PR; Vercel gives you a preview URL on the **preview DB**. Verify there.
   - Merge to `main`. Vercel ships it. Beta is fixed with no schema risk.
   - Fast-forward `dev` from `main` afterward so the branches don't diverge.
2. **Hotfix that needs schema:** do not `db push` to prod under pressure. Follow the migration
   protocol — generate a reviewed migration, even for a hotfix. A rushed `db push` is exactly how
   you lose beta data.
3. **Rollback:** Vercel keeps every deploy. Use "Promote to Production" on the last good deploy
   for instant code rollback. **Schema does not roll back with code** — if a migration already ran
   on prod, rolling back code can leave code expecting the old schema. This is the reason
   expand/contract exists: during the expand phase, old code still works against the new schema,
   so a code rollback is safe.

### Build-failure first aid

If a local `next build` dies with `PageNotFoundError: /_error` or `/_document`, it's a stale
`.next` cache: `rm -rf .next && npm run build`. Vercel does a clean build every time, so this only
bites locally — never "fix" it by force-deploying.

## Environment variables to configure

Set these per-environment in Vercel (Settings → Environment Variables). Scope each to Production,
Preview, or both as noted.

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `DATABASE_URL` | Neon **main** branch | Neon **preview** branch | The whole isolation story lives here. Different value per env. |
| `AUTH_SECRET` | set | set | Can differ; sessions won't carry across envs (fine). |
| `FOUNDER_EMAILS` | your email(s) | your email(s) | Gates `/founder`. Keep tight in prod — it has sim/override controls over real beta leagues. |
| `NEXT_PUBLIC_DRAFT_WS_URL` | prod ws host | preview/staging ws host | The WebSocket draft server cannot run on Vercel serverless — host it separately (Render/Railway/Fly). Point each env at the right ws URL. |
| `ALLOW_SIM_DATE` | **unset / not "true"** | optional `true` | If `true`, the dev-sim cookie can rewind the clock. NEVER enable in Production — a beta user could time-warp everyone. Replay leagues don't need it (they use `replayCurrentDate`). |
| `STATS_SOURCE_API_KEY` | set if used | set if used | HockeyTech creds. Ingestion runs from scripts, not app code. |

Critical rules:
- **`ALLOW_SIM_DATE` must not be `true` in Production.** This is the one env var that can corrupt
  the shared clock for live leagues.
- **`DATABASE_URL` is the isolation boundary.** If Preview ever points at the prod Neon branch,
  your "safe" testing is hitting beta users' data. Double-check it.
- Secrets come from env vars only — never hardcoded.

## Risk assessment: bad migration pushed while beta users are active

Ordered worst → recoverable.

| Scenario | Blast radius | Mitigation |
|---|---|---|
| `prisma db push` run against prod with a column drop | **Data loss across every league** (schema is global; flags don't shield it). Irreversible without a backup. | Stop using `db push` on prod. Use `migrate deploy`. Enable Neon PITR / keep a recent branch snapshot. |
| `ALTER ... SET NOT NULL` on a populated table | Migration fails mid-deploy or locks the table; app may 500 for all beta users until resolved. | Expand/contract: add nullable → backfill → tighten later. |
| In-place column type change | Table rewrite; on Neon can lock the table, requests time out / cold-start failures pile up. | Add-new-column + backfill + drop-old instead of in-place `TYPE` change. |
| New `@default` assumed to backfill existing rows | Silent logic bugs — existing beta leagues read the wrong value. | Defaults apply to new rows only. Write a data migration to backfill existing rows. |
| Migration adds a FK with no index | Slow queries → serverless function timeouts under beta load. | Add `@@index` on every FK and hot query column; review generated SQL for indexes. |
| Code expecting new schema rolled back after migration applied | App and DB out of sync; partial outage. | Expand/contract keeps old code compatible with new schema, making code rollback safe. |
| `LeagueEvent`-style model used before `migrate deploy` ran | Runtime errors querying a model that isn't in the DB yet. | Keep the `(prisma as any).leagueEvent` null-guard pattern; ensure migrations land before code that depends on them. |

**The single highest-impact action:** move prod off `db push` and onto `prisma migrate deploy`,
and never run an unreviewed `db push` against the prod Neon branch while beta is live.

## One-time setup checklist

See `environments.md` for the detailed version. Summary:

- [x] Build command uses `prisma generate && prisma migrate deploy && next build` — shipped
- [x] WebSocket draft server hosted on Render (`pwhl-draft-server`) — shipped
- [ ] Create Neon `preview` branch from `main`; grab its connection string
- [ ] Vercel: set Production Branch = `main`; confirm `fantasy.dykedb.org` attached to Production
- [ ] Vercel: add `fantasydev.dykedb.org` as a custom domain assigned to the `dev` branch
- [ ] DNS: add CNAME `fantasydev` → `cname.vercel-dns.com`
- [ ] Vercel: set `DATABASE_URL` = main Neon branch (Production), preview Neon branch (Staging)
- [ ] Vercel: confirm `ALLOW_SIM_DATE` is NOT set in Production
- [ ] Vercel: set `NEXT_PUBLIC_DRAFT_WS_URL` per environment
- [ ] Render: optionally deploy staging WebSocket service for draft testing on staging
