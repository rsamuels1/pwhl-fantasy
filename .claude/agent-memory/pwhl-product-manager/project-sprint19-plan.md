---
name: sprint-19-playwright-ux-findings
description: Sprint 19 planned from Playwright UX walkthrough Jun 23, 2026 — 8 net-new items; 7 in Sprint 19, 2 email-blocked
metadata:
  type: project
---

Sprint 19 (PLANNED) sources from a Playwright UX walkthrough of the PWHL GM beta site on Jun 23, 2026.

**Why:** Beta invites go out Jul 7. Before the beta widens to a broader audience, the P1 onboarding and invite-flow gaps need to close. These are the highest-friction first-contact surfaces.

**How to apply:** Sprint 19 begins after Sprint 18 formally closes. All 7 items are layout/copy — no schema changes, no new API routes.

## Sprint 19 Items (7)

| ID | Title | Priority | Effort |
|---|---|---|---|
| BF-015 | /league-rules 404 dead link | P1 | S |
| UX-051 | VP popover overflow on mobile (wizard Step 4) | P1 | S |
| UX-052 | Invite landing insufficient fantasy primer | P1 | M |
| UX-057 | Wizard Rules step jargon wall (PPP, UTIL unexplained) | P1 | M |
| UX-054 | Replay CTA no "why" context copy | P2 | S |
| UX-055 | Wizard step count hidden on welcome screen | P2 | S |
| UX-056 | Commissioner draft checklist no primer | P2 | S |

## Email-Blocked (post-email-infra backlog)

| ID | Title | Blocker |
|---|---|---|
| UX-053 | Email invite flow (type-in friends' emails) | Email infrastructure deferred post-beta |
| BF-016 | Password reset / forgot password on login page | Email infrastructure deferred post-beta |

## Deduplication notes

- AG-007 (Sprint 17) shipped a two-sentence invite-page explainer — the Jun 23 walkthrough found it still insufficient. UX-052 is NOT a regression; it's a scope gap.
- OB-009 (Sprint 18) added FP scoring chip row to wizard Step 4 — UX-057 addresses the remaining PPP/UTIL jargon that OB-009 didn't fix.
- AG-007 also added the Replay CTA button (AC-002) — UX-054 addresses the missing "why" subtitle copy, not the button itself.

## Next IDs after Sprint 19

- Next UX-NNN: UX-058
- Next BF-NNN: BF-017 (BF-015 and BF-016 assigned in this sprint)

See [[sprint-18-plan]] for Sprint 18 context.
