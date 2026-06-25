# Deployment Environments

Owner: solo engineer. Last updated: 2026-06-22.

Two long-lived environments: **Production** and **Staging**. One Vercel project, one Neon project with two database branches, one Render WebSocket service per environment.

## Topology

```
GitHub
├── main ──────────────► Vercel Production ──► Neon branch: main    ──► Render: pwhl-draft-server
│                         fantasy.dykedb.org        ↑                    (prod WebSocket, :8080)
│                         [locked to /beta —        │ same DB
│                          signup/discovery only]   │
│                         beta.fantasy.dykedb.org ──┘
│                         [full app — beta testers use this]
│
└── dev ───────────────► Vercel Preview ────► Neon branch: preview  ──► Render: pwhl-draft-server-staging
                          fantasydev.dykedb.org                           (staging WebSocket, optional)
                          [full app, anyone with the URL can access]
```

**Beta domain split:** Both `fantasy.dykedb.org` and `beta.fantasy.dykedb.org` point at the same Vercel Production deployment and the same Neon `main` database. The middleware's `BETA_HOST=fantasy.dykedb.org` lock applies only to the public-facing domain. Beta testers who signed up on `fantasy.dykedb.org` can immediately log in at `beta.fantasy.dykedb.org` once you've set up their leagues — same user records, same data.

**Day-to-day workflow:**
```
feature work → push to dev → auto-deploy to fantasydev.dykedb.org → verify → PR dev→main → prod
hotfix → branch off main → PR directly to main (then fast-forward dev from main)
```

---

## Vercel setup

**One project.** Vercel maps `main` → Production and all other branches → Preview automatically.

### Production (main branch)
- Domains: `fantasy.dykedb.org` and `beta.fantasy.dykedb.org` (both on the same Vercel project)
- `fantasy.dykedb.org` — locked to `/beta` via `BETA_HOST` middleware; public signup/discovery only
- `beta.fantasy.dykedb.org` — full app; beta testers use this after you set up their leagues
- All `vercel.json` crons (waiver processing) run here only

### Preview / Staging (dev branch)
- Domain: `fantasydev.dykedb.org` (custom domain assigned to Preview)
- Custom domains bypass Vercel's auth-protection gate — no email invite needed
- Serves the full app

### How to add the staging custom domain

1. Vercel dashboard → Project → **Settings → Domains → Add**
2. Enter `fantasydev.dykedb.org`
3. When prompted to assign to a branch, select **dev** (not Production)
4. At your DNS host (wherever `dykedb.org` is managed), add:
   ```
   Type:  CNAME
   Name:  fantasydev
   Value: cname.vercel-dns.com
   ```
5. Vercel will issue an SSL cert automatically within a few minutes.

---

## Neon database branches

**One Neon project, two branches.**

| Branch | Used by | Notes |
|---|---|---|
| `main` | `fantasy.dykedb.org` and `beta.fantasy.dykedb.org` | Beta users' leagues live here. Treat as sacred. Both prod domains share this branch. |
| `preview` | Staging (`fantasydev.dykedb.org`) | Copy-on-write branch of main. Safe to break. Reset from main anytime. |

**Refreshing the preview branch** (when you want a clean copy of prod data):
- Neon dashboard → Branches → `preview` → Reset from parent (`main`)
- This is a metadata operation — instant, no dump/restore needed.

**Schema on staging:** use `prisma db push` freely against the preview Neon branch while iterating on schema. Once stable, generate a migration (`prisma migrate dev --name <change>`) and commit it — it will ship to prod via `migrate deploy` on the next main deploy.

---

## Render WebSocket services

The draft server cannot run on Vercel (serverless). It lives on Render.

| Service | Branch | DATABASE_URL | NEXT_PUBLIC_DRAFT_WS_URL |
|---|---|---|---|
| `pwhl-draft-server` | — (always on) | Neon `main` | Render prod URL |
| `pwhl-draft-server-staging` (recommended) | — | Neon `preview` | Render staging URL |

To add the staging service: duplicate the `render.yaml` service block (or create manually in the Render dashboard) with a different name and the preview Neon `DATABASE_URL`. Starter plan ($7/mo) required — never sleeps, required for persistent WebSocket connections.

If you skip the staging WebSocket service, live draft testing is prod-only. That's acceptable during early beta; document it in your testing checklist.

---

## Environment variable matrix

Set in Vercel → Project → Settings → Environment Variables. Scope each carefully.

| Variable | Production | Staging | Notes |
|---|---|---|---|
| `DATABASE_URL` | Neon **main** branch (pooled URL) | Neon **preview** branch (pooled URL) | **This is the isolation boundary.** If staging points at prod, you're testing against live user data. |
| `DIRECT_URL` | Neon **main** branch (direct URL — no `-pooler` in hostname) | Neon **preview** branch (direct URL) | Required for `prisma migrate deploy`. Pooled connections don't support the advisory lock Prisma needs during migrations. |
| `AUTH_SECRET` | set | set | Can differ — sessions won't carry across envs (fine). |
| `FOUNDER_EMAILS` | your email(s) | your email(s) | Gates `/founder`. Keep tight in prod — founder tools have sim/override controls over live leagues. |
| `NEXT_PUBLIC_DRAFT_WS_URL` | Render prod URL | Render staging URL | |
| `BETA_HOST` | `fantasy.dykedb.org` (or unset — same effect) | **unset** | Controls which single host is locked to `/beta`. The code default is `"fantasy.dykedb.org"`, so deleting the var has the same effect as setting it to that value. `beta.fantasy.dykedb.org` is intentionally NOT listed here — it shares the same deployment but passes through as a normal app host. Set to `""` to open `fantasy.dykedb.org` to the full app at go-live. |
| `ALLOW_SIM_DATE` | **do not set** | optional `true` | Enables the dev-sim cookie to rewind the clock. Never in production — a user could time-warp all live leagues. |
| `NODE_ENV` | `production` | `production` | Vercel sets this automatically. Sim controls (`/season/advance`) are gated by `ALLOW_SEASON_ADVANCE=true` env var, not `NODE_ENV`, in practice. |
| `STATS_SOURCE_API_KEY` | set if ingest runs | optional | HockeyTech creds. Ingestion is script-only, not app code. |
| `RESEND_API_KEY` | set | optional | Resend API key from resend.com dashboard. Required for magic-link auth and transactional emails in production. |
| `EMAIL_FROM` | `PWHL GM <noreply@dykedb.org>` | same | "From" address for all outgoing emails. Requires DNS domain verification in Resend (DKIM TXT + SPF records for `dykedb.org`). One-time setup. |
| `EMAIL_RESEND_ENABLED` | `true` | **unset** | Master switch — prevents staging from sending real emails to beta users. Always leave unset on staging. |
| `NEXT_PUBLIC_APP_URL` | `https://beta.fantasy.dykedb.org` | `https://fantasydev.dykedb.org` | Base URL used when constructing magic link and notification URLs in emails. |

**Email domain setup:** `noreply@dykedb.org` requires DNS verification in the Resend dashboard (DKIM TXT + SPF records). One-time setup. The draft WebSocket server on Render also needs `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_RESEND_ENABLED` set in its Render environment (so on-the-clock emails work from the draft server process).

---

## Migration workflow

Never `prisma db push` on the prod Neon branch while beta users are active.

1. Work on `dev` branch. Use `prisma db push` against the **preview** Neon branch freely.
2. When the schema shape is stable: `prisma migrate dev --name <change>` (still against preview) to generate a migration file.
3. Review the generated SQL — specifically check for `DROP COLUMN`, `ALTER ... SET NOT NULL` on populated tables, and in-place type changes. See `beta-deployment-architecture.md` for the expand/contract pattern.
4. Commit the migration file. PR `dev`→`main`.
5. The prod deploy runs `prisma generate && prisma migrate deploy && next build` — migration lands safely.

---

## Cron jobs

`vercel.json` defines a daily waiver-processing cron at `0 8 * * *`. Vercel runs crons on **Production only** — the staging environment will never double-process waivers. No action needed.

---

## Go-live gate (opening fantasy.dykedb.org to the full app)

`fantasy.dykedb.org` currently redirects everything except `/beta` to the beta signup page. To open it to the full app:

**Checklist — clear all before flipping:**
- [ ] All pending schema migrations reviewed, tested on staging, and committed
- [ ] Draft room load-tested on staging (concurrent leagues, reconnect)
- [ ] Prod WebSocket server healthy on Render (`pwhl-draft-server`)
- [ ] `ALLOW_SIM_DATE` confirmed NOT set in Production env vars
- [ ] `FOUNDER_EMAILS` confirmed set correctly in Production
- [ ] Error/loading/empty states verified for all key routes on staging
- [ ] Neon PITR (Point-in-Time Recovery) enabled on the `main` branch — or a recent Neon branch snapshot exists as a backup
- [ ] Beta testers notified of the cutover

**The flip itself:**
1. In Vercel Production env vars: set `BETA_HOST` to `""` (empty string)
2. Redeploy (or trigger a fresh deploy) — the middleware `if (BETA_HOST)` guard will skip the lockdown for an empty string
3. Verify `fantasy.dykedb.org` serves the login page, not the `/beta` redirect

> Note: `middleware.ts` reads `BETA_HOST` from `process.env.BETA_HOST ?? "fantasy.dykedb.org"`. To open the domain, set the env var to an empty string. To re-lock (e.g., for maintenance), set it back to `fantasy.dykedb.org`.

---

## One-time setup checklist (new engineer or fresh environment)

- [ ] Create Neon `preview` branch from `main`; copy its connection string
- [ ] Vercel: confirm Production Branch = `main`
- [ ] Vercel: add `fantasydev.dykedb.org` as a custom domain assigned to the `dev` branch
- [ ] DNS: add CNAME `fantasydev` → `cname.vercel-dns.com`
- [ ] Vercel: set `DATABASE_URL` = main Neon branch (Production), preview Neon branch (Preview/Staging)
- [ ] Vercel: confirm `ALLOW_SIM_DATE` is NOT set in Production
- [ ] Vercel: set `NEXT_PUBLIC_DRAFT_WS_URL` per environment
- [ ] Render: deploy staging WebSocket service (optional but recommended for draft testing)
- [ ] Push code to `dev` branch; confirm preview deploy at `fantasydev.dykedb.org` shows the full app
