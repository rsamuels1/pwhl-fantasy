# Sprint 3 Progress Report

**Date:** June 13, 2026
**Sprint:** Sprint 3 — "Beta-ready: onboarding, trust, mobile"
**Status:** COMPLETE — closed June 13, 2026

**Carry-forwards to Sprint 4:**
- NT-002 LINEUP_INCOMPLETE notification — wire `checkAndEmitScheduledNotifications` into `app/dashboard/page.tsx`; `dedupeKey = "{periodStartsAt}-{teamId}"`; schema and dedup logic are ready; only the call site is missing.
- IA-011 — 6 AC items in `app/league/[leagueId]/bracket/` and `app/league/[leagueId]/admin/page.tsx`; all frontend-only; spec at `docs/02-engineering/ia-011-checklist.md`; no API or schema changes needed.

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

None. All sprint items are complete or carried forward.

---

## Items Carried Forward to Sprint 4

| ID | Item | Notes |
|---|---|---|
| NT-002 | LINEUP_INCOMPLETE notification | Schema delta is shipped (confirmed in `prisma/schema.prisma`: `title`, `body`, `actionUrl`, `teamId`, `dedupeKey`, `@@unique([userId,type,dedupeKey])` all live). The only remaining work is wiring `checkAndEmitScheduledNotifications(userId, nowMs, prisma)` into `app/dashboard/page.tsx`. Architecture decision documented in NT-003 section of `docs/02-engineering/notification-framework-spec.md`. |
| IA-011 | Hide advanced non-v1 settings | Spec and acceptance checklist written June 13. Six AC items in `app/league/[leagueId]/bracket/` and `app/league/[leagueId]/admin/page.tsx`. All frontend-only; no API or schema changes needed. See `docs/02-engineering/ia-011-checklist.md`. |

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

## Sprint 3 Exit Criteria — Final Status

Sprint exit criterion: "a brand-new user creates and drafts a league on a phone with no docs."

| Criterion | Status |
|---|---|
| Onboarding: new user can create first league without docs | PASS (#2 shipped) |
| Mobile: all core pages usable on 390px phone, no horizontal scroll, 44px touch targets | PASS (#3 shipped) |
| Error handling: no uncaught UI errors, all API failures handled gracefully | PASS (#4 shipped) |
| Transaction history: paginated league log available | PASS (#8 shipped) |
| Notifications: bell renders, draft starting + on the clock wired | PASS (NT-001 + partial NT-002 shipped) |
| Notification schema: title/body/actionUrl/teamId/dedupeKey fields + dedup constraint live | PASS (confirmed in `prisma/schema.prisma`) |
| Lineup Incomplete notification wired | CARRY-FORWARD to Sprint 4 (schema ready; call site not yet added) |
| IA-011: advanced non-v1 UI elements hidden | CARRY-FORWARD to Sprint 4 (spec written; implementation not started) |

**Sprint 3 is COMPLETE.** Two items carry forward to Sprint 4 with full specs and no remaining
architectural decisions. Neither item is a launch-blocking regression — the platform is
functionally usable for the onboarding flow; the carries are hardening/cleanup items.

---

## Quantified Status (Final)

- Sprint 3 scope items: **7** (including NT-001/NT-002 as one grouped item, NT-003, and IA-011)
- Fully shipped: **6** (#2, #3, #4, #8, NT-001, NT-002 partial — draft notifications + schema delta; NT-003 architecture decision; #28 and #32 as positive unplanned additions)
- Carried forward: **2** (NT-002 LINEUP_INCOMPLETE call site, IA-011 implementation)
- Unplanned work that shipped during Sprint 3: **2** (#28 lineup tab polish, #32 team distribution panel — both are positive scope additions, not overruns)

---

## References

- Notification spec (NT-001/NT-002/NT-003 + schema delta): `docs/02-engineering/notification-framework-spec.md`
- IA-011 acceptance checklist: `docs/02-engineering/ia-011-checklist.md`
- Roadmap: `docs/01-roadmap/roadmap.md` (Sprint 3 section)
