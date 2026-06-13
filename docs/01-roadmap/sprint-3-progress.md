# Sprint 3 Progress Report

**Date:** June 13, 2026
**Sprint:** Sprint 3 — "Beta-ready: onboarding, trust, mobile"
**Status:** In Progress

---

## Sprint Goal

Ship the three beta prerequisites — onboarding, mobile, and notifications — so a brand-new
user can create and draft a league on a phone with no documentation.

---

## Items Completed ✅

| ID | Item | Notes |
|---|---|---|
| #2 | League Onboarding | Welcome flow (`WelcomeFlow.tsx`), 6-step setup wizard (`CreateLeagueWizard.tsx`), manager draft prep guide on league overview, replay explanation inline. `User.onboardingCompletedAt` schema field + `POST /api/user/onboarding`. |
| #3 | Mobile Optimization | Draft room tabbed layout at ≤900px via `useIsMobile(900)`, 44px touch targets on all interactive elements, `BottomNav` safe-area for iPhone 15, standings `minWidth` fix, matchup score `clamp()`, swing player truncation. |
| #8 | Transaction History | Paginated API + `/league/[leagueId]/transactions` page with type/team filters, replay guard, infinite scroll. No schema changes needed. |
| #28 | Lineup Stats Tab Polish | "Projected" tab renamed "Matchup Proj"; "This week" tab hidden between weeks; subtitle added. (Listed in Sprint 4 in the sprint plan, but shipped during Sprint 3 work.) |
| #32 | Draft Room: Team Distribution Panel | Inline `TeamSpreadPanel` in `DraftRoom.tsx`, color-coded by concentration. Client-only, no server changes. (Listed in Phase 1, shipped during Sprint 3.) |
| NT-001 | Notification Framework (in-app infrastructure) | `lib/services/notification-service.ts`, `Notification` + `NotificationPreference` schema models, `NotificationBell.tsx` in league layout, `GET/POST /api/leagues/[leagueId]/notifications`. Draft server call sites for `DRAFT_STARTING` and `ON_THE_CLOCK`. |
| NT-002 (partial) | Critical Notifications — draft starting + on the clock | Wired from `lib/draft/server.ts` on `PERSIST_STATUS IN_PROGRESS` and `BROADCAST_PICK`. |

---

## Items In Progress 🔄

| ID | Item | Notes |
|---|---|---|
| #4 | Error Handling | Empty states, loading states, retry actions, user-friendly error messages across draft room, matchup, lineup, standings, and roster pages. Currently being built. Do not mark complete. |
| NT-001 / NT-002 | Schema delta and full NT-002 completion | The live `Notification` model is missing five fields required by the spec (`title`, `body`, `actionUrl`, `teamId`, `dedupeKey`) and the `@@unique([userId, type, dedupeKey])` deduplication constraint. The `LINEUP_INCOMPLETE` notification is not yet wired. `createNotification` function signature needs extending. See schema delta section in `docs/02-engineering/notification-framework-spec.md`. |

---

## Items Not Started / Blocked ❌

| ID | Item | Notes |
|---|---|---|
| IA-011 | Hide advanced non-v1 settings | Spec resolved today. Checklist at `docs/02-engineering/ia-011-checklist.md`. Six AC items: bracket no-bye text suppression (AC-IA011-001/002), admin playoff config inputs (AC-IA011-003), human-readable scoring settings (AC-IA011-004), human-readable roster settings (AC-IA011-005), regression guard (AC-IA011-006). All are frontend-only; no API or schema changes needed. Work not yet started. |
| NT-003 | Scheduled trigger for LINEUP_INCOMPLETE | Architecture decision documented June 13 in `docs/02-engineering/notification-framework-spec.md`. Chosen approach: `checkAndEmitScheduledNotifications(userId, nowMs, prisma)` called from `app/dashboard/page.tsx` server render, deduplicated via DB-level `@@unique([userId, type, dedupeKey])`. Implementation not yet started; blocked on schema delta (see NT-001/NT-002 above). |

---

## Spec Gaps: Resolved vs Open

### Resolved today (June 13, 2026)

| Gap | Resolution | Location |
|---|---|---|
| NT-003 scheduled trigger — no architectural decision existed for how `LINEUP_INCOMPLETE` (a time-driven notification) would fire on a stack with no persistent background worker | Decision recorded: check-on-dashboard-load + DB-level `dedupeKey` uniqueness. Trade-off (user who never visits dashboard before lock misses notification) explicitly accepted for MVP; Vercel Cron option noted for post-beta. | `docs/02-engineering/notification-framework-spec.md` — "NT-003: Scheduled Trigger Decision" section |
| IA-011 acceptance checklist was missing — item was in the roadmap with no verifiable completion criteria | Six AC items written covering bracket no-bye suppression, admin panel playoff config, and human-readable settings display. | `docs/02-engineering/ia-011-checklist.md` |
| Notification schema delta was undocumented — the `Notification` model shipped with fewer fields than the spec requires, and there was no record of the gap | Five missing fields documented (`title`, `body`, `actionUrl`, `teamId`, `dedupeKey`), rationale per field, Prisma migration snippet, migration notes (NULL semantics for `@@unique`, `title` required-column risk), and `createNotification` caller impact. | `docs/02-engineering/notification-framework-spec.md` — "Schema Delta: Notification Model" section |

### Still Open

No additional spec gaps were identified beyond the three above. The items remaining in the
exit criteria below are implementation gaps, not documentation gaps.

---

## Exit Criteria Gap List

The following must be done before Sprint 3 can be called complete. The sprint exit criterion
is: "a brand-new user creates and drafts a league on a phone with no docs."

### 1. Error Handling (#4) — In Progress
- Empty states, loading states, and retry paths across all core pages (draft room, matchup, lineup, standings, roster) are not yet complete.
- This is explicitly marked "Needed" in the roadmap and is an in-progress beta prerequisite.

### 2. Notification Schema Delta
- Run `npx prisma db push` after adding `title`, `body`, `actionUrl`, `teamId`, `dedupeKey` to the `Notification` model and adding the `@@unique([userId, type, dedupeKey])` constraint.
- Extend `createNotification` in `lib/services/notification-service.ts` to accept the new fields.
- Update existing callers in `lib/draft/server.ts` (two call sites: `notifyDraftStarting`, `notifyOnClock`) to pass `title`, `body`, and `actionUrl`.
- Migration risk: `title` is a required (non-nullable) field. Any existing `Notification` rows in dev must be cleared before pushing (`DELETE FROM "Notification";`).

### 3. LINEUP_INCOMPLETE Notification (NT-002, third critical notification)
- Wire `checkAndEmitScheduledNotifications(userId, nowMs, prisma)` into `app/dashboard/page.tsx`.
- Logic: for each team the user owns, check if any active roster player has `gamesThisPeriod === 0` in the upcoming/active period. Emit `LINEUP_INCOMPLETE` with `dedupeKey = "{periodStartsAt}-{teamId}"`.
- This is one of three MVP-critical notifications and cannot ship without it.

### 4. IA-011: Hide Advanced Non-v1 Settings
- Six acceptance criteria to implement (all frontend-only, no API/schema changes):
  - AC-IA011-001: suppress "bye" text on bracket page when `topSeedsWithBye === 0`
  - AC-IA011-002: verify bye text still renders correctly when `topSeedsWithBye > 0`
  - AC-IA011-003: hide multi-round bracket config inputs in admin panel for default format
  - AC-IA011-004: render `scoringSettings` as labeled list/table (not raw JSON) in admin panel
  - AC-IA011-005: render `rosterSettings` as plain English in admin panel
  - AC-IA011-006: confirm active playoff format stated in readable text even when config inputs are hidden
- Files: `app/league/[leagueId]/bracket/` and `app/league/[leagueId]/admin/page.tsx`.
- Use `parseScoringSettings` from `lib/scoring/settings.ts` for AC-IA011-004.

---

## Quantified Status

- Sprint 3 scope items: **7** (including NT-001/NT-002 as one grouped item, NT-003, and IA-011)
- Fully complete: **5** (#2, #3, #8, NT-001 in-app infrastructure, NT-002 partial — draft notifications only)
- In progress: **2** (#4 error handling, NT-001/NT-002 schema + LINEUP_INCOMPLETE wiring)
- Not started: **2** (IA-011, NT-003 implementation)
- Unplanned work that shipped during Sprint 3: **2** (#28 lineup tab polish, #32 team distribution panel — both are positive scope additions, not overruns)

**Confidence Sprint 3 closes on schedule (late Jul 2026):** Moderate. Error handling (#4) is the largest remaining item (~65K tokens by roadmap estimate) and is currently in-progress. The notification schema work is well-specified; IA-011 is frontend-only with clear ACs. If error handling runs long, IA-011 and the notification cleanup are safe to parallelize or batch.

---

## References

- Notification spec (NT-001/NT-002/NT-003 + schema delta): `docs/02-engineering/notification-framework-spec.md`
- IA-011 acceptance checklist: `docs/02-engineering/ia-011-checklist.md`
- Roadmap: `docs/01-roadmap/roadmap.md` (Sprint 3 section)
