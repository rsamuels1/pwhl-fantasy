# League Onboarding Specification

**Roadmap item:** #2 League Onboarding (Phase 1 — Beta Completion)

**Priority:** P0 for public beta (MVP launch gate — "user can create a first league without documentation")

**Status:** Planned — not built

**Related documents:**
- `docs/mvp-definition.md` (in-scope: league create / config / invite)
- `docs/league-rules-v1.md` (rules surfaced during setup)
- `docs/backlog/implementation-alignment.md` (IA-005 recommend 8-team, IA-006 VP education, IA-011 hide non-v1)
- `docs/analytics-events.md` (activation funnel this flow must instrument)
- `docs/growth-retention.md` (activation definition, league-fill messaging)

---

# Overview

Onboarding is the guided path from **first arrival** to **a drafted, ready-to-play league**.
Today a new user lands on `/dashboard` (or `/login`) with create/join buttons but no guidance,
no explanation of Victory Points or replay mode, and no scaffolding to get a league filled and
drafted. For casual PWHL fans — the target audience — this is the single biggest drop-off risk
before the season even starts.

This spec defines four surfaces:

1. **Welcome flow** — first-run orientation for a brand-new account.
2. **League setup wizard** — a stepped flow that replaces the bare "create league" form.
3. **Draft preparation guide** — what a commissioner and managers do between league-full and draft.
4. **Replay explanation** — a short, honest description of replay mode as a try-it-now sandbox.

It is deliberately **opinionated and beginner-first**, consistent with the v1 product direction:
strong defaults, minimal configuration, ESPN/Yahoo-style familiarity.

---

# Goals

## User goals

- I understand what this app is within 15 seconds of arriving.
- I can create a league without reading documentation.
- I know what to do after creating a league (invite, draft).
- I understand how scoring and standings work before my first matchup.

## Product goals

- Maximize the **activation funnel** (`docs/analytics-events.md`): Visitor → Registration →
  League Creation → Draft Participation → Week 1 Lineup.
- Reduce commissioner support burden to near zero for setup.
- Reinforce the approved defaults (8 teams, 3F/2D/1UTIL/1G/6 bench, VP standings, 4-team playoffs).

## Non-goals

- Not a tutorial for every feature. Onboarding ends when the league is drafted; in-season
  education happens contextually (lineup nudges, VP tooltips per IA-006).
- Not a marketing site. This is post-auth product onboarding.

---

# Entry Points & Audiences

| Audience | Entry | Onboarding path |
|---|---|---|
| Brand-new user (0 leagues) | First load of `/dashboard` after registration | Welcome flow → choose Create or Join |
| Commissioner creating a league | "New League" button | Setup wizard → draft prep guide |
| Invited manager (join link) | Join URL → register/login | Compressed welcome → Join → draft prep guide |
| Curious user (no friends yet) | "Try a replay league" CTA | Replay explanation → one-click replay league |

The flow is **resumable**: a user who abandons mid-setup returns to the same step. State lives on
the league record (draft not yet started) plus a per-user `onboardingState` flag for the welcome
flow; nothing blocks navigating away.

---

# Surface 1 — Welcome Flow

Shown once, on the first authenticated load for a user with **zero teams**. Dismissible; never
shown again after completion (tracked by `User.onboardingCompletedAt`).

## Content (3 lightweight cards, not a modal wall)

1. **What this is** — "Draft real PWHL players. Set a weekly lineup. Compete with friends."
2. **How you win** — one-sentence VP explanation: "You earn Victory Points for winning your
   matchup *and* for being one of the top scorers each week." Links to the full rules.
3. **Two ways to start:**
   - **Start a league** → setup wizard (primary CTA)
   - **Have an invite?** → Join with a code/link
   - Secondary, muted: **"Just exploring? Try a replay league"** → Surface 4

## Acceptance criteria

- Appears exactly once per new user; never re-appears after dismissal or completion.
- Does not block users who arrived via a join link (they continue to Join).
- Skippable in one click to the dashboard.

---

# Surface 2 — League Setup Wizard

Replaces the single create-league form with a short stepped flow. Every step has a sensible
default so a user can click "Next" through the whole thing and get a valid, recommended league.

## Step 1 — Name your league

- League name (required, ≤ 50 chars).
- Helper text: "You can change this later."

## Step 2 — League size

- Default **8 teams**, labeled **"Recommended"** (satisfies **IA-005**).
- Options: 6, 8, 10, 12. Each shows a one-line implication ("8 is the classic size — easy to fill,
  competitive matchups").
- Advanced sizes do not expose playoff/bye configuration (satisfies **IA-011**).

## Step 3 — Schedule (draft date & season)

- **Season / mode:** Live season (default) or Replay (links to Surface 4 explanation).
- **Draft date:** date+time picker. Helper: "Most leagues draft the week before the season opener."
- Validation reserves playoff weeks and prevents schedules overlapping the PWHL postseason
  (depends on **IA-004**); show the computed regular-season length and championship week read-only.

## Step 4 — Rules (confirm defaults)

- Read-only summary of the **approved v1 defaults**, presented as "Standard rules":
  - Roster: **3 F · 2 D · 1 UTIL · 1 G · 6 Bench** (13) — depends on **IA-001**
  - Scoring: standard skater/goalie points (link to `league-rules-v1.md`)
  - Standings: **Victory Points** with a one-line explainer (depends on **IA-002**, ties to **IA-006**)
  - Playoffs: **top 4, single-week rounds, no byes** (depends on **IA-003**)
- A single "Customize" affordance for the few editable values; advanced/non-v1 settings hidden.

## Step 5 — Invite managers

- Generates a shareable join link + per-team invite slots.
- **League-fill progress** widget: `"3 / 8 teams joined"` (from `docs/growth-retention.md` GR-004).
- Copy-link and "invite by email" (email optional for MVP; in-app/link is the MVP path).
- "I'll do this later" continues to the draft prep guide.

## Step 6 — Done → Draft prep

- Confirmation screen with the league summary and a primary CTA into the **draft preparation guide**.

## Acceptance criteria

- A user can complete the wizard with all defaults in ≤ 6 clicks and get a valid 8-team,
  standard-rules league.
- Every approved default (size, roster, scoring, VP, playoffs) is shown before completion.
- No non-v1 configuration is exposed.
- Created league is correctly linked to a `ParentLeague` once **#33 / MS-001** lands (until then,
  single-season as today). The wizard must not hardcode assumptions that block that wiring.

---

# Surface 3 — Draft Preparation Guide

A persistent checklist on the league overview / dashboard between **league created** and
**draft complete**. Reuses the existing dashboard **action-items** pattern and the admin
**setup checklist** rather than inventing a new system.

## Commissioner checklist

1. ✅ League created
2. ⬜ Invite managers — `N / size` joined (links to invite step)
3. ⬜ Set the draft order (or confirm random)
4. ⬜ Confirm draft date — countdown shown when within 7 days
5. ⬜ Review rules
6. ▶ Start draft (enabled when ≥ 2 teams and at draft time)

## Manager checklist (non-commissioners)

1. ✅ Joined league
2. ⬜ Read how scoring works (VP explainer + rules link)
3. ⬜ Build a draft queue (links to the draft room's queue tab)
4. ⬜ Draft starts in: countdown

## Pre-draft education

- "How the draft works" — snake order, the pick clock, auto-pick if you miss a pick, and the
  queue. One screen, drawn from `docs/draft-exp-spec.md`.
- Surfaced contextually, not as a blocking gate.

## Acceptance criteria

- Checklist reflects real league state (joined count, draft order set, draft time).
- Commissioner sees commissioner items; managers see manager items.
- Disappears once `draft.status === COMPLETE`; replaced by the lineup nudge (existing behavior).

---

# Surface 4 — Replay Explanation

Replay is a QA/testing tool, but it doubles as a **try-it-now sandbox** for a curious user with
no friends yet. The explanation must be honest and short.

## Content

- "Replay mode plays a past PWHL season so you can try the full experience right now —
  draft, lineups, matchups, playoffs — without waiting for the live season or filling a league."
- "Your replay league is a sandbox. Live leagues are the real thing."
- CTA: **"Create a replay league"** → one-click creation of a pre-filled replay league
  (auto-named, auto-filled with auto-drafting bot teams) so the user lands directly in a usable
  state.

## Acceptance criteria

- A user can go from this screen to an active replay league in one click.
- Copy never implies replay is the primary product.
- Replay leagues are visually flagged (existing `⏪ Replay` treatment) so they're never confused
  with live leagues.

---

# Analytics Instrumentation

This flow is the activation funnel from `docs/analytics-events.md`. Emit:

| Event | When |
|---|---|
| `onboarding_welcome_viewed` | Welcome flow shown |
| `onboarding_welcome_dismissed` | Skipped or completed |
| `league_setup_started` | Wizard step 1 |
| `league_setup_step_completed` | Each step (with `step` property) |
| `league_setup_abandoned` | Navigated away mid-wizard (with `lastStep`) |
| `league_created` | Wizard completion |
| `invite_link_copied` / `manager_joined` | Invite + join |
| `draft_prep_item_completed` | Each checklist item |
| `replay_league_created` | Surface 4 one-click |

Funnel KPI: **% of registrations that reach league_created**, and **% of leagues that reach
draft_complete** (north-star input: League Completion Rate).

---

# Dependencies

- **Hard:** IA-001 (roster default 3F), IA-002 (VP), IA-003 (playoffs), IA-004 (schedule
  constraints) — the wizard's "confirm defaults" step must show *correct* defaults, so Phase 0
  alignment lands first. IA-005 (8-team recommended) and IA-011 (hide non-v1) are implemented
  *as part of* this flow.
- **Soft:** IA-006 VP education (shared explainer copy/components), #33/MS-001 parentLeagueId
  (wizard should be renewal-aware once available).
- **Reuses:** existing dashboard action-items, admin setup checklist, draft queue, replay mode.

---

# Out of Scope (this spec)

- Email delivery infrastructure (covered by `docs/notification-framework-spec.md`).
- Public/discoverable leagues and matchmaking for users with no friends (future).
- In-season feature tutorials beyond the VP explainer and draft basics.

---

# Definition of Done

A brand-new user, on a phone, with no documentation and no help from a commissioner, can:

```text
Register
→ Understand what the app is
→ Create a standard 8-team league (or join one)
→ Invite managers / see fill progress
→ Reach the draft fully prepared
```

and a curious user with no friends can spin up a replay sandbox in one click.
