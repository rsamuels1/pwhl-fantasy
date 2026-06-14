# Beta Feedback Infrastructure — Engineering Spec

**Sprint:** 6
**Feature key:** BF-001
**Status:** Not implemented
**Effort:** Backend S · Frontend S · Testing S

---

## What it does

Two lightweight surfaces for the closed beta phase:

1. **In-app feedback widget** — a persistent button on every page (except the draft room)
   that opens a modal where a manager can submit a bug report or suggestion. Submissions
   stored in a new `FeedbackSubmission` table; viewable in the Founder Operations Console.

2. **Founding commissioner tracking** — a simple lifecycle flag on `FantasyLeague`
   (`betaStatus`) that the founder dashboard uses to track which invited leagues have
   progressed: `invited → accepted → active → renewed`.

The beta cohort is small (< 20 leagues). This is intentionally minimal infrastructure —
not a full support ticketing system.

---

## Data model

```prisma
model FeedbackSubmission {
  id          String   @id @default(cuid())
  userId      String
  leagueId    String?
  type        FeedbackType
  body        String   @db.Text
  url         String?          // page the user was on
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}

enum FeedbackType { BUG SUGGESTION OTHER }
```

**`FantasyLeague` addition:**
```prisma
betaStatus  BetaStatus @default(NONE)
enum BetaStatus { NONE INVITED ACCEPTED ACTIVE RENEWED }
```

Two new columns + two new enums. Run `npx prisma db push` after adding.

---

## API routes

**`POST /api/feedback`**
- Auth: `apiRequireAuth` (any logged-in user)
- Body: `{ type: FeedbackType, body: string, url?: string, leagueId?: string }`
- Validates: `body` non-empty, max 2000 chars; `type` in enum
- Writes a `FeedbackSubmission` row
- Returns 201

**`GET /api/founder/feedback`** (founder-only)
- Auth: `FOUNDER_EMAILS` env var check (same pattern as `/api/founder/*` routes)
- Returns last 100 submissions ordered `createdAt desc`, with `user.email` and `leagueId`
- No pagination needed for beta scale

**`PATCH /api/founder/leagues/[leagueId]/beta-status`** (founder-only)
- Body: `{ betaStatus: BetaStatus }`
- Updates `FantasyLeague.betaStatus`
- Used by the founder to manually advance a league's beta lifecycle stage

---

## Key files

- `prisma/schema.prisma` — add `FeedbackSubmission` model + `FeedbackType` enum;
  add `betaStatus BetaStatus @default(NONE)` to `FantasyLeague`
- `app/api/feedback/route.ts` — new POST handler
- `app/api/founder/feedback/route.ts` — new GET handler
- `app/api/founder/leagues/[leagueId]/beta-status/route.ts` — new PATCH handler
- `components/FeedbackWidget.tsx` — new client component; persistent "?" or "Feedback"
  button fixed to bottom-right of viewport (z-50); click opens a modal with type selector
  (Bug / Suggestion / Other) and textarea; submit POSTs to `/api/feedback`; auto-captures
  `window.location.pathname` as `url`; success shows "Thanks!" toast and closes modal
- `app/league/[leagueId]/layout.tsx` — mount `<FeedbackWidget leagueId={league.id} />`
  at the bottom; not shown in draft room (add a `nofeedback` layout param or check pathname)
- `app/team/[teamId]/layout.tsx` — same; mount `<FeedbackWidget />`
- `app/founder/feedback/page.tsx` — new founder page listing submissions with type chip,
  user email, league, body, and timestamp; link from founder dashboard nav
- `app/founder/leagues/[leagueId]/page.tsx` — add beta status selector (dropdown) to the
  league detail Config tab

---

## Edge cases / gotchas

- **Draft room exclusion:** do not mount the widget on `app/draft/[leagueId]/` — the draft
  room is full-screen and the widget would interfere with picks. Check in layout or use a
  CSS pointer-events approach.
- **No leagueId for dashboard:** `FeedbackSubmission.leagueId` is nullable — feedback from
  `/dashboard` or `/login` has no league context.
- **`betaStatus` auto-advance:** do NOT auto-advance `betaStatus` in application code (e.g.,
  don't auto-set ACTIVE when a draft completes). The founder manually controls this so the
  taxonomy stays meaningful for a small cohort.
- **Spam guard:** `body` max 2000 chars enforced server-side; no rate limiting needed for
  closed beta scale.
- **No email alerts:** V1 is view-only in the founder console. A cron email summary is
  post-beta scope.

---

## Acceptance criteria

- [ ] Feedback button visible on all league and team pages (not in draft room)
- [ ] Modal has Bug / Suggestion / Other type selector and a textarea (≥ 10 chars required)
- [ ] Submission writes to `FeedbackSubmission`; user sees success toast
- [ ] Founder console `/founder/feedback` lists all submissions with type, user, league, body
- [ ] `betaStatus` field on `FantasyLeague` is settable from founder league detail page
- [ ] `npx prisma db push` adds schema without errors
