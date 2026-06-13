# Recommended Next Sprint

## Sprint 3 — Beta Readiness

**Status:** Current

**Theme:** Make the platform usable by real commissioners and managers without engineering support.

**Goal:** A brand-new user can create a league, run a draft, and set a lineup on a phone without consulting any documentation. MVP launch gate.

---

## Epic 1 — Onboarding ✅ Shipped

Priority: P0 · Status: Complete

Spec: `docs/02-engineering/onboarding-spec.md`

No user should need documentation to create their first league or understand what to do after the draft. All four surfaces shipped:

- **Welcome flow** (`components/WelcomeFlow.tsx`) — 3-card orientation on dashboard for 0-team users; dismissed via `POST /api/user/onboarding` which sets `User.onboardingCompletedAt`
- **League setup wizard** (`app/create-league/CreateLeagueWizard.tsx`) — 6-step client wizard (name → size → schedule+mode → rules → invite → done); creates league at step 4→5 transition; live and replay paths
- **Manager draft prep guide** — checklist shown on league overview (`app/league/[leagueId]/page.tsx`) for non-commissioner members during `PRE_DRAFT`; inline VP explainer, queue link, draft countdown
- **Replay inline explanation** — shown in wizard step 3 when user selects Replay mode; one-click replay league creation path

---

## Epic 2 — Error Handling ✅ Shipped

Priority: P0 · Status: Complete

Spec: `docs/02-engineering/error-handling-spec.md`

Shared components (`ErrorState`, `EmptyState`, `LoadingState`) + `loading.tsx`/`error.tsx` for all 11 core routes. Draft room raw-error display replaced with friendly copy. Empty-state copy standardised across notifications, activity feed, announcements, and standings.

---

## Epic 3 — Mobile Optimization ✅ Shipped

Priority: P0 · Status: Complete

Spec: `docs/02-engineering/mobile-optimization-spec.md`

**Shipped:**
- **Draft room** — `useIsMobile(900)` hook; tabbed Pick/Board/Needs layout at ≤900px; secondary stat columns hidden at ≤480px; user-friendly connection error
- **Touch targets** — `minHeight: 44px` on all Drop/Add (RosterManager), Pick/star/queue/pos-filter (DraftRoom), slot cards + Cancel (LineupManager); stats toggles `minHeight: 36px`
- **BottomNav** — `env(safe-area-inset-bottom)` for iPhone 15 home indicator; `calc()` in `.bottom-nav-pad`
- **Standings** — `minWidth: 520` → `380`
- **Matchup** — swing player ellipsis truncation; hero score `clamp()` font sizes

---

## Epic 4 — Notifications (NT-001/002)

Priority: P1

Spec: `docs/02-engineering/notification-framework-spec.md`

Build the notification framework and ship the three MVP-critical notifications:

1. **Draft Starting Soon** — 24h and 1h before `draftStartsAt`
2. **You're On The Clock** — when the pick timer activates for a manager's turn
3. **Lineup Incomplete** — before the weekly lineup lock with starters missing games

Deferred (post-beta): trade received, waiver result, playoff clinched, weekly recap.

---

## Epic 5 — IA-011: Hide Non-v1 Settings ✅ Shipped

Priority: P2 · Status: Complete

Checklist: `docs/02-engineering/ia-011-checklist.md`

Bracket page hides bye text when `topSeedsWithBye === 0` (fixed default 2→0). Settings page replaces all raw JSON `<pre>` blocks with human-readable labeled rows for scoring, roster slots, and playoff format.

---

## Sprint Exit Criteria

- ✅ Brand-new user creates and drafts a league on a phone without reading any documentation (onboarding shipped)
- ✅ Draft room is usable on iOS Safari and Android Chrome without horizontal scrolling (mobile optimization shipped)
- ✅ All 5 core pages have empty states and error states
- ✅ Draft room is usable on iOS Safari and Android Chrome without horizontal scrolling
- ✅ Draft Starting Soon and On The Clock notifications fire correctly
- ✅ `npm test` passes (149 tests)
- ✅ `npx tsc --noEmit` clean

**This sprint is the MVP launch gate.** When it exits, run a closed beta.
