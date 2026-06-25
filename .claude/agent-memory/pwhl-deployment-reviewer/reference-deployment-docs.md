---
name: reference-deployment-docs
description: Where deployment runbooks, env-var matrices, and beta architecture rationale live in the repo
metadata:
  type: reference
---

Deployment/ops documentation lives in `docs/04-operations/`:

- `environments.md` — the how-to runbook: domain wiring, Neon branch table, Render WebSocket services, full env-var matrix, go-live gate, migration workflow, one-time setup checklist.
- `beta-deployment-architecture.md` — the rationale + risk model: why league-type flags don't replace env isolation, migration safety protocol during beta, expand/contract pattern, hotfix flow, risk-assessment table for bad migrations on Neon.
- `beta-domain-setup.md`, `beta-success-metrics.md`, `founding-commissioner-program.md`, `support-playbook.md`, `pre-beta-audit.md`, `commissioner-runbook.md` — supporting beta docs.

CLAUDE.md also has a short "Deployment environments" section (~line 66) that mirrors `environments.md`.

**As of 2026-06-22 all three of these (the two ops docs + CLAUDE.md section) describe only a two-environment model and are stale relative to the actual three-deployment topology.** See [[project-deployment-topology]].

Env-var facts: schema datasource requires both `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, no `-pooler` host — needed for `migrate deploy` advisory lock). `.env.example` documents NEITHER `DIRECT_URL` nor `CRON_SECRET` nor `NEXT_PUBLIC_BETA_MODE` — gap to close. The draft WebSocket server is hosted on Render at `https://pwhl-draft-server.onrender.com` (set via `NEXT_PUBLIC_DRAFT_WS_URL`).
