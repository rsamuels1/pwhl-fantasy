# Beta Domain Setup: fantasy.dykedb.org

The beta signup page lives at `/beta` on the main Vercel deployment. The domain
`fantasy.dykedb.org` is locked to that page only — visitors cannot access any other
part of the app from that domain.

## How it works

- `middleware.ts` checks the `host` header on every request. If it's `fantasy.dykedb.org`,
  only `/beta` and `/api/beta-signup` are allowed through; everything else redirects to `/beta`.
- `next.config.js` redirects the bare root (`fantasy.dykedb.org/`) to `/beta`.
- Signups are stored in the `beta_users` table (`BetaSignup` Prisma model) with `email` and
  `wantsToCommission` fields.

## DNS setup (Namecheap)

In Namecheap → Advanced DNS, add one record under the `pwhl-fantasy` domain:

| Type | Host | Value |
|------|------|-------|
| `A` | `fantasy` | `76.76.21.21` |

Or if Namecheap supports CNAME on that subdomain:

| Type | Host | Value |
|------|------|-------|
| `CNAME` | `fantasy` | `cname.vercel-dns.com` |

Vercel's domain settings page will tell you which it expects — use whatever it shows.

## Vercel setup

1. Go to your Vercel project → **Settings → Domains**
2. Add `fantasy.dykedb.org`
3. Vercel will confirm the DNS record and issue a TLS certificate automatically

## Verifying it works

```bash
# Check DNS has propagated
dig fantasy.dykedb.org

# Confirm the root redirects to /beta
curl -I https://fantasy.dykedb.org

# Confirm a non-beta path redirects back to /beta
curl -I https://fantasy.dykedb.org/dashboard
```

## Viewing signups

```bash
npx prisma studio
# → open BetaSignup table
```

Or query directly:

```sql
SELECT email, wants_to_commission, created_at
FROM beta_users
ORDER BY created_at DESC;
```
