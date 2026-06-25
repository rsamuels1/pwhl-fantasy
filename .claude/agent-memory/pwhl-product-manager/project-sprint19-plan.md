---
name: sprint-19-ia-restructure
description: Sprint 19 COMPLETE — IA restructure, franchise-first nav, DnD lineup; 5/5 parts shipped Jun 23, 2026; original Playwright UX items deferred to backlog
metadata:
  type: project
---

Sprint 19 shipped as a larger IA restructure, superseding the originally-planned "Playwright UX Walkthrough Fixes" scope.

**Why:** The Playwright UX walkthrough items (BF-018, UX-051–057) were scoped but the IA restructure was prioritized — all personal/transactional surfaces needed to move into the `/team/[teamId]/` zone before beta widened, and the lineup/roster consolidation unblocked commissioner god-mode access.

**How to apply:** Sprint 19 is COMPLETE. The Playwright UX items (BF-018, UX-051–057) remain in the post-sprint backlog and should be picked up in the next available sprint. BF-018 (/league-rules 404) is still unresolved — next sprint should address it first.

## Sprint 19 Parts (all shipped Jun 23, 2026)

| Part | Title | Commit |
|---|---|---|
| Part 1 | Emoji policy doc + colorblind chip fix (✓/✗/◉ glyphs in standings) | 0d00092 |
| Part 2 | Trades → My Franchise: /team/[teamId]/trades* routes; TeamNav restructure | a2cd617 |
| Part 3 | League overview → commissioner-only; non-commissioners redirect to matchup | 3ceb056 |
| Part 4 | DnD lineup management on roster page (LineupDnD.tsx, @dnd-kit); /lineup redirects to /roster | 01075f9 |
| Part 5 | Commissioner god-mode: view + DnD any team's lineup via forceMove=true | b4986a6 |

## Deferred from Sprint 19 (Playwright UX items — still open)

| ID | Title | Priority |
|---|---|---|
| BF-018 | /league-rules 404 dead link | P1 |
| UX-051 | VP popover overflow on mobile (wizard Step 4) | P1 |
| UX-052 | Invite landing insufficient fantasy primer | P1 |
| UX-057 | Wizard Rules step jargon wall (PPP, UTIL unexplained) | P1 |
| UX-054 | Replay CTA no "why" context copy | P2 |
| UX-055 | Wizard step count hidden on welcome screen | P2 |
| UX-056 | Commissioner draft checklist no primer | P2 |
| UX-053 | Email invite flow — blocked on email infra | P2 |
| BF-019 | Password reset — blocked on email infra | P2 |

## Key IA changes to keep in mind

- `/team/[teamId]/lineup` now REDIRECTS to `/team/[teamId]/roster` — do not create new content at the lineup URL
- `/league/[leagueId]/` redirects non-commissioners to `/team/[teamId]/matchup` — league overview is commissioner-only
- `/league/[leagueId]/roster` is now commissioner-only
- Trade routes: `/league/[leagueId]/trades/*` redirect to `/team/[teamId]/trades/*`
- New deps installed: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

See [[sprint-18-plan]] for Sprint 18 context.
