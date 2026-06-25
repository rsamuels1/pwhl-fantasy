---
name: auth-bypass-pattern
description: How to authenticate in Playwright tests when the login API is broken in local dev
metadata:
  type: feedback
---

The login form and `/api/auth/login` are broken in local dev when `RESEND_API_KEY` is not set (see [[feedback-resend-crash]]). The workaround for Playwright-based UI tests is:

1. Write a session token directly to the DB with `npx tsx -e "..."` using `prisma.user.update({ where: { email }, data: { sessionToken: token } })`
2. Inject the cookie via `context.addCookies([{ name: 'pwhl_session', value: token, domain: 'localhost', path: '/', httpOnly: false, secure: false }])`
3. Navigate to the target page — the session is now active

Cookie name: `pwhl_session` (NOT `pwhl_user_email` — the docs are wrong about this, the real name is in `lib/auth.ts` as `USER_SESSION_COOKIE = "pwhl_session"`)

Known dev accounts and IDs (as of 2026-06-24):
- `replay-commish@dev.local` — commissioner of an IN_SEASON replay league
- `commish@dev.local` — commissioner of a PRE_DRAFT league
- Replay league ID: `cmqnik2az0002enlcw3deu9ov`
- Replay team ID: `cmqnik2dq0004enlc05cwbfdf`

App port: may be 3000 or 3001+ depending on how many dev server instances are running. Probe with curl on 3000-3005.
