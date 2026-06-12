# Notification Framework Specification

**Roadmap items:** NT-001 Notification Framework, NT-002 Critical Notifications (Phase 2 / Sprint 3)

**Priority:** P0 for the three MVP-critical notifications; P1 for the broader framework

**Status:** Planned — not built

**Related documents:**
- `docs/mvp-definition.md` (MVP-required: draft starting, on the clock, lineup incomplete)
- `docs/growth-retention.md` (notification strategy & channels — MVP in-app, email future)
- `docs/analytics-events.md` (notification analytics events)
- `docs/commission-tools-spec.md` (commissioner-action notifications)
- `docs/draft-exp-spec.md` (draft timing triggers)

---

# Overview

The platform has rich *in-context* signals today (dashboard action items, lineup nudges,
the league activity feed backed by `LeagueEvent`) but **no notification framework**: no unified
way to define a notifiable event, fan it out to a user across channels, respect preferences, and
record delivery. As a result, time-sensitive moments — your draft is starting, you're on the
clock, your lineup is empty for the week — depend on the user happening to be on the right page.

This spec defines a single framework with:

- A **notification model** (typed events → per-user notifications).
- A **trigger layer** that emits notifications from existing lifecycle code.
- A **channel layer** (MVP: in-app; Phase 2: email; future: web push / native push).
- **User preferences** (per-type, per-channel opt-out).
- The **MVP-critical notification set** (NT-002).

It deliberately builds on the existing `LeagueEvent` pattern rather than replacing it:
`LeagueEvent` is the **league-wide activity log** (what happened in the league); notifications are
**per-user, actionable deliveries** (what *you* need to do). Some events produce both.

---

# Goals

- Deliver the three MVP-critical alerts reliably regardless of what page the user is on.
- One place to define a new notification type; channels and preferences handled by the framework.
- Never spam: dedupe, respect quiet preferences, and collapse repeats.
- Be replay-safe: notification timing reads simulated time the same way the rest of the app does
  (`getDevNow` / replay clock), so dev/QA leagues behave correctly.

## Non-goals (MVP)

- Real-time goal alerts and live-scoring push (depends on Live Scoring #21 — Phase 7).
- SMS.
- Marketing/lifecycle email campaigns (this is transactional/product notifications only).

---

# Data Model

```prisma
enum NotificationType {
  DRAFT_STARTING
  ON_THE_CLOCK
  LINEUP_INCOMPLETE
  TRADE_RECEIVED          // when Trade System (#7) lands
  WAIVER_RESULT           // when Waivers (#5) land
  PLAYOFF_CLINCHED
  PLAYOFF_ELIMINATED
  COMMISSIONER_ACTION     // e.g. you were replaced / a roster move was forced
  WEEK_SCORED
}

enum NotificationChannel { IN_APP EMAIL PUSH }

model Notification {
  id         String   @id @default(cuid())
  userId     String
  leagueId   String?
  teamId     String?
  type       NotificationType
  title      String
  body       String
  actionUrl  String?            // deep link, e.g. /draft/<id>?team=<id>
  data       Json     @default("{}")
  dedupeKey  String?            // unique per logical event to prevent duplicates
  readAt     DateTime?
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])
  @@index([userId, createdAt])
  @@unique([userId, type, dedupeKey])
}

model NotificationPreference {
  id      String              @id @default(cuid())
  userId  String
  type    NotificationType
  channel NotificationChannel
  enabled Boolean             @default(true)
  user    User                @relation(fields: [userId], references: [id])
  @@unique([userId, type, channel])
}
```

Notes:
- `@@unique([userId, type, dedupeKey])` is the dedupe guarantee — emitting the same logical
  notification twice (e.g. two cron ticks) is a no-op.
- Defaults are **opt-out**: a missing preference row means enabled. Critical types (below) cannot
  be disabled in MVP.
- `Notification` is per-user and additive; it never stores fantasy point truth (consistent with
  the project rule that scores are recomputable).

---

# Architecture

```text
lifecycle code / cron / API handler
        │  emitNotification(type, recipients, payload)
        ▼
  Notification service  ──► resolve preferences ──► per enabled channel:
        │                                              ├─ IN_APP: write Notification row
        │                                              ├─ EMAIL: enqueue email job (Phase 2)
        │                                              └─ PUSH:  enqueue push job (future)
        ▼
  dedupe via (userId, type, dedupeKey)
```

- **`lib/services/notifications.ts`** — `emitNotification({ type, recipients, leagueId, teamId,
  title, body, actionUrl, dedupeKey, data })`. Pure orchestration: resolve recipients, check
  preferences, write/enqueue per channel. Mirrors the existing `lib/services/activity.ts`
  `emitEvent` pattern (and may co-emit a `LeagueEvent` where the moment is also league-wide).
- **In-app delivery (MVP):** writes `Notification` rows. A bell/inbox UI in the top nav shows
  unread count + a dropdown list; clicking an item marks it read and follows `actionUrl`.
- **Email delivery (Phase 2):** a queued job (see Background Jobs in the roadmap) renders a
  template and sends via a provider (e.g. Resend/Postmark). Email is additive — never required for
  MVP, which is in-app only per `docs/growth-retention.md`.
- **Push (future):** web push first, then native — gated on Push Notifications (#22).

## Time & triggers

Two kinds of trigger:

1. **Event-driven** — emitted inline from existing code paths (draft engine, season lifecycle,
   playoff lifecycle, commissioner actions). Preferred; exact and replay-safe.
2. **Time-driven** — a scheduled sweep for "approaching deadline" notifications (draft starting
   soon, lineup still empty before lock). The sweep reads the same simulated/real clock the app
   uses, so it works under replay. Each run is idempotent via `dedupeKey`.

---

# MVP-Critical Notifications (NT-002)

These three are launch-blocking and **cannot be disabled** in MVP.

## 1. Draft Starting

- **Trigger:** draft transitions toward live — (a) a scheduled reminder when `draftStartsAt`
  is within a lead window (e.g. 1 hour and 10 minutes before), and (b) immediately when the
  commissioner starts the draft (`draft.status → IN_PROGRESS`).
- **Recipients:** all team owners in the league.
- **Action URL:** `/draft/<leagueId>?team=<teamId>`.
- **Dedupe:** one per `(user, DRAFT_STARTING, draftId+window)`.

## 2. On The Clock

- **Trigger:** draft engine advances to a team's pick (`onClockTeamId` changes).
- **Recipients:** the owner of the on-clock team only.
- **Action URL:** the draft room.
- **Dedupe:** `(user, ON_THE_CLOCK, draftId+pickNumber)` — exactly one per pick.
- **Note:** must fire even if the user's draft socket is disconnected — this is the safety net the
  in-room clock can't provide. Emitted server-side from the draft engine's pick-advance effect.

## 3. Lineup Incomplete

- **Trigger:** scheduled sweep before a scoring period's first lock — a starter has
  `gamesThisPeriod === 0` with no scheduled games, or an active slot is empty, for the upcoming/
  active week. Same logic already used by the matchup-page lineup alert strip; this lifts it into
  a delivered notification.
- **Recipients:** the affected team owner.
- **Action URL:** `/team/<teamId>/lineup`.
- **Dedupe:** `(user, LINEUP_INCOMPLETE, leaguePeriodId)` — once per period, not per page load.
- **Timing:** fire on a reminder cadence before first lock (e.g. evening before), not repeatedly.

---

# Post-MVP Notification Types (framework-ready)

Defined now so the framework is complete; wired as their features land:

- `TRADE_RECEIVED`, `WAIVER_RESULT` — with Trade (#7) / Waivers (#5).
- `PLAYOFF_CLINCHED` / `PLAYOFF_ELIMINATED` — ties to Playoff Experience UX (#30); reuses
  `computeRace` from `lib/playoffs/seeding.ts`.
- `COMMISSIONER_ACTION` — emitted by commissioner recovery tools (`docs/commission-tools-spec.md`:
  replace manager, force roster move, undo) so affected users are told.
- `WEEK_SCORED` — when a scoring period completes (recap deep link).

---

# User Preferences

- **Settings page:** a matrix of `NotificationType × NotificationChannel` toggles.
- **MVP:** in-app channel only; critical types locked on. The page can still render email rows as
  "coming soon" so the surface is ready.
- **Defaults:** all enabled (opt-out model).
- **Unsubscribe:** every email (Phase 2) carries a one-click unsubscribe that writes a
  `NotificationPreference{ enabled:false }` row for that type+channel (never for locked critical
  types).

---

# Analytics

Per `docs/analytics-events.md` notification analytics, emit:

| Event | When |
|---|---|
| `notification_sent` | Framework delivers (channel + type properties) |
| `notification_viewed` | In-app inbox opened / item rendered |
| `notification_clicked` | `actionUrl` followed |
| `notification_pref_changed` | Preference toggled |

Key health metrics: critical-notification delivery rate (should be ~100%), on-the-clock
click-through, and lineup-incomplete → lineup-set conversion.

---

# Acceptance Criteria

- A team owner receives **Draft Starting**, **On The Clock**, and **Lineup Incomplete** reliably
  via in-app delivery, independent of which page they're on, and each links to the right action.
- **On The Clock** fires even when the recipient's draft socket is disconnected.
- Emitting the same logical notification twice produces exactly one delivery (dedupe holds).
- A bell/inbox in the nav shows unread count; opening marks items read and deep-links work.
- Notification timing is correct under replay/sim-date (no real-clock leakage).
- New notification types can be added by calling `emitNotification` from one place, without
  touching channel or preference code.
- Critical types cannot be disabled in MVP; all others respect `NotificationPreference`.

---

# Dependencies & Sequencing

- **Reuses:** `LeagueEvent` / `lib/services/activity.ts` pattern, draft engine effects, season &
  playoff lifecycle, `computeRace`, existing lineup-alert logic, replay/sim clock helpers.
- **MVP (Sprint 3):** model + in-app channel + the three critical notifications + the nav inbox.
  No email required.
- **Phase 2:** email channel + queued delivery job (pairs with the roadmap's Background Jobs).
- **Later:** web/native push (#22), live-scoring goal alerts (#21), trade/waiver/playoff types as
  those features ship.

---

# Out of Scope (this spec)

- Email template design system and provider selection (decide at Phase 2; framework is
  provider-agnostic behind the channel layer).
- Real-time push transport (#21 / #22).
- Digest/batched notifications (future optimization once volume justifies it).
