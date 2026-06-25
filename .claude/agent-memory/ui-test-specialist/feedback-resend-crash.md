---
name: feedback-resend-crash
description: Resend API key crash blocks local dev login and trade notifications — module-level instantiation is the root cause
metadata:
  type: feedback
---

`lib/services/email-service.ts` instantiates `new Resend(process.env.RESEND_API_KEY)` at module load time (line 15). Any route handler that imports from this module (login, trade notifications) will throw before any request logic runs when `RESEND_API_KEY` is not set in the local environment. The `@dev.local` bypass in the login route is unreachable because the crash happens at import.

**Why:** RESEND_API_KEY is not set in local dev. The module-level constructor throws immediately on import.

**How to apply:** When testing login or trade flows locally, expect HTTP 500 from `/api/auth/login` unless the fix (lazy instantiation inside function body) has been applied. Use direct session token injection via `context.addCookies()` as a workaround for Playwright tests. File the root cause for devs: move `const resend = new Resend(...)` inside `sendMagicLink()` body.

[[auth-bypass-pattern]]
