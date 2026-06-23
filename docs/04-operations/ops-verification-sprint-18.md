# Vercel Ops Verification — Sprint 18

**Date:** 2026-06-22  
**Gate:** GATE-3

---

## Checklist

| Item | Status | Notes |
|---|---|---|
| `CRON_SECRET` env var in Vercel prod | ⚠️ MANUAL | Verify in Vercel dashboard → Settings → Environment Variables. Must be set on `main` branch, production scope. |
| `process-waivers` cron at 03:00 ET | ✅ | `vercel.json`: `"schedule": "0 8 * * *"` = 08:00 UTC = 03:00 ET |
| `check-incomplete-lineups` in `vercel.json` | ✅ | Added Sprint 18: `"schedule": "0 12 * * *"` (12:00 UTC / 08:00 ET). Route created at `app/api/cron/check-incomplete-lineups/route.ts`. |
| Error monitoring (Sentry or equivalent) | ❌ OPEN | Not configured. See action item below. |
| Neon point-in-time recovery | ⚠️ MANUAL | Verify in Neon dashboard → Project → Backups. PITR should show ≥7 days retention. |

---

## Cron Auth Guard

Both cron routes require `Authorization: Bearer <CRON_SECRET>` in production:

```ts
const isAllowed =
  (expected !== null && secret === expected) ||   // prod: requires secret
  process.env.NODE_ENV !== "production" ||         // dev: open
  process.env.ALLOW_SEASON_ADVANCE === "true";     // staging: opt-in open
```

If `CRON_SECRET` is unset in production, `expected === null`, making `(null !== null && ...)` false — the cron will be **unauthorized in prod** until the secret is set. **Set it before beta.**

---

## Open Action Items

### A1 — Set `CRON_SECRET` in Vercel (P0, before Jul 7)
1. Generate: `openssl rand -hex 32`
2. Add to Vercel → Production → Environment Variables as `CRON_SECRET`
3. Redeploy or trigger an environment variable refresh

### A2 — Error Monitoring (P1, post-beta acceptable)
No Sentry or equivalent is configured. Next.js errors surface in Vercel's built-in function logs, which have a 1-hour retention window. For beta, this is marginally acceptable since the founder can tail logs in the Vercel dashboard. For GA, integrate Sentry:
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```
Set `SENTRY_DSN` in Vercel environment variables. Target: sprint before GA launch.

### A3 — Neon PITR (P1, verify manually)
Log into Neon dashboard → select `main` branch → Backups tab. Confirm "Point-in-time restore" is enabled with ≥7 days retention. If not enabled, upgrade the Neon plan or enable PITR in settings.

---

## GATE-3 Verdict

**⚠️ CONDITIONAL PASS** — Two items require manual action (A1 and A3) before beta invites:
- **A1 (P0): `CRON_SECRET` must be set in Vercel production.** Crons will return 401 without it.
- **A2 (P1):** Error monitoring deferred to post-beta sprint.
- **A3 (P1):** Neon PITR requires manual dashboard verification.

GATE-3 clears to ✅ PASS once A1 is confirmed in the Vercel dashboard.
