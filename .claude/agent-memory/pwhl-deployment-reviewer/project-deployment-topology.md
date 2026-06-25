---
name: project-deployment-topology
description: Three-deployment Vercel/Neon topology (prod, beta, dev) and the migration-drift risk that threatens fresh Neon branches
metadata:
  type: project
---

PWHL GM runs (as of 2026-06-22) a **three-deployment** topology, which is NEWER than what the ops docs describe:

- **prod** — Vercel project `pwhl-gm`, branch `main`, domain `fantasy.dykedb.org`, Neon `main` branch.
- **beta** — Vercel project `pwhl-gm-beta`, branch `release/beta-v1`, domain `beta.fantasy.dykedb.org`, Neon `beta` branch (copy-on-write of main). Env: `NEXT_PUBLIC_BETA_MODE=true` enables the wizard beta welcome step (BLR-002). Beta invite date: **2026-07-07**.
- **dev/preview** — branch `dev`, domain `fantasydev.dykedb.org`, Neon `preview` branch.

**Why this matters:** `docs/04-operations/environments.md` + `beta-deployment-architecture.md` + the CLAUDE.md "Deployment environments" table all document only a TWO-environment model (one Vercel project, main+dev). They predate the standalone `pwhl-gm-beta` project. Treat those docs as stale until updated.

**CRITICAL migration-drift risk (verify before any fresh Neon branch):**
The build runs `prisma generate && prisma migrate deploy && next build`, but only TWO migration files exist (`20260602072111_add_playoff_support`, `20260627101300_add_vp_scoring`). Everything since — Notification, Trade, Waiver, FeedbackSubmission, BacklogItem, BetaSignup models and the `betaStatus`/`isPublic`/`isReplay`/`replayCurrentDate`/`onboardingCompletedAt`/`parentLeagueId`/`tradeReviewHours` columns — reached main/preview via `prisma db push`, NOT migrations. The Neon `beta` branch only has those columns because it's a COW clone of main. A truly fresh Neon branch built via `migrate deploy` would be missing ~20 models/columns. **Before standing up any new DB branch, generate a baseline migration capturing current schema state** (`prisma migrate diff` from empty → schema, or `migrate dev` after a reset on preview).

**How to apply:** When reviewing deployment or schema work, always check whether a change needs a migration file (not just `db push`). When a new environment/branch is proposed, flag the drift risk. See [[reference-deployment-docs]] for where the runbooks live.
