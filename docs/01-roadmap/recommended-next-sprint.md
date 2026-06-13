# Recommended Next Sprint

## Sprint 3 — Beta Readiness

**Status:** Current

**Theme:** Make the platform usable by real commissioners and managers without engineering support.

**Goal:** A brand-new user can create a league, run a draft, and set a lineup on a phone without consulting any documentation. MVP launch gate.

---

## Epic 1 — Onboarding

Priority: P0

Spec: `docs/02-engineering/onboarding-spec.md`

No user should need documentation to create their first league or understand what to do after the draft. This epic covers:

- League creation wizard — step-by-step (name → teams → settings → invite link)
- Draft preparation walkthrough — what to expect, how the clock works, how auto-pick behaves
- Post-draft "what now?" screen — link to lineup, schedule, when the season starts
- Contextual help tooltips at friction points (draft order, scoring settings, roster slots)

---

## Epic 2 — Error Handling

Priority: P0

Every core page needs empty states, loading states, retry actions, and plain-language error messages. Beta users have no engineering support — they will hit errors.

Pages that need this treatment:
- Draft room (connection failure, timeout, unexpected server error)
- Matchup page (no active period, data load failure)
- Lineup page (lock error, eligibility error, swap failure)
- Standings page (no games yet, no matchups)
- Roster / free-agent page (add/drop failure, player unavailable)

---

## Epic 3 — Mobile Optimization

Priority: P0

Most beta managers will access the platform on their phones.

- **Draft room** — hardest and highest stakes; pick timer, player list, and queue must be touch-friendly with no horizontal scrolling
- **Matchup page** — hero scores, roster breakdown, playing-tonight all need to collapse cleanly
- **Standings page** — VP table must not overflow on small screens
- **Lineup page** — click-to-swap interaction must work reliably on touch devices
- **Roster / FA page** — add/drop buttons must be tap-sized

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

## Epic 5 — IA-011: Hide Non-v1 Settings

Priority: P2

Hide or disable features that are not part of the Year 1 product to reduce commissioner confusion:

- Multi-round playoff configuration options
- Experimental scoring modes
- Any UI element referencing unbuilt features (trades, FAAB, keeper leagues)

---

## Sprint Exit Criteria

- Brand-new user creates and drafts a league on a phone without reading any documentation
- All 5 core pages have empty states and error states
- Draft room is usable on iOS Safari and Android Chrome without horizontal scrolling
- Draft Starting Soon, On The Clock, and Lineup Incomplete notifications fire correctly
- `npm test` passes (130+ tests)
- `npx tsc --noEmit` clean

**This sprint is the MVP launch gate.** When it exits, run a closed beta.
