---
name: beta-e2e-findings
description: Full end-to-end beta walkthrough (Jun 2026) — host-split auth bug, client-render Loading shells, VTF/1v1 copy conflict, trade auto-accept friction, "G left" ambiguity
metadata:
  type: project
---

End-to-end first-time-fan run on the live beta, league `beta-agent-t-i4or` ("Beta Agent Test 1"), 8 teams, replay 2025-26.

**Environment split (operational, not pure UX):** `fantasy.dykedb.org` and `beta.fantasy.dykedb.org` share the same prod Neon DB but behave differently for auth.
- `fantasy.dykedb.org/` redirects to `/beta` (a waitlist signup page — NOT the app). All authenticated API routes + `/team/*` + `/draft/*` pages work here with the `pwhl_user_email` cookie.
- `beta.fantasy.dykedb.org/` serves the real app at root, but every authenticated API route returns `{"error":"Forbidden"}` and every `/team/[teamId]/*` + `/draft/*` page returns **404** (owner-gated `notFound()` fires because the session cookie isn't honored). `/league/*` pages return 200 (membership not enforced the same way).
- **Why:** likely cookie `Domain=.dykedb.org` + host/middleware mismatch on the beta subdomain. A real beta user who logs in on `beta.fantasy.dykedb.org` and clicks "My Roster"/"Set Lineup" would hit a 404 — a hard blocker. Worth a dedicated repro.

**Auth ignores password entirely.** POST `/api/auth/login` with any password (or the documented one) succeeds and sets the cookie purely from email. Email-only auth is by design (CLAUDE.md), but the login form *shows* a password field that does nothing — misleading.

**Client-rendered "Loading…" shells with empty SSR:** `/league/*` pages (overview, standings, how-it-works) ship only "Loading league…" / "Loading standings…" in server HTML and hydrate client-side. `/team/*` pages render full content server-side. On a slow phone or with JS disabled, league pages show a perpetual spinner. Inconsistent and bad for the mobile-first audience.

**VTF vs 1v1 inconsistency (recurring, see [[vtf-field-model]]):** dashboard cards say "This week vs field 7–0 · 7 of 7 opponents outscored" (VTF), but the matchup page (`/team/.../matchup`) renders a single named opponent ("VS Agent Team 8 OPP", "Win Probability 76%", "+17.0 pt edge"). Same week, two different mental models. New fan can't tell if they play everyone or one team. The create-league beta welcome copy also says "weekly head-to-head VP scoring" — reinforces the wrong (1v1) model.

**Trade auto-accept friction (Sprint 29 TR-003 side effect):** with `requireCommissionerTradeApproval`/review window on, a freshly proposed trade returns status `ACCEPTED` immediately (not `PROPOSED`). The receiver's `/accept` then 422s ("Trade cannot be accepted in its current state (ACCEPTED)"). Only the commissioner `/review {action:approve}` executes it. A receiver who was told "accept the trade" hits a dead-end error. The state name "ACCEPTED" for a not-yet-agreed, awaiting-commissioner trade is itself confusing.

**"G left" games-remaining ambiguity:** lineup/matchup show "1 G left", "2 G left" for games-remaining this period. Everywhere else G = Goals (and the glossary says so). "1 G left" reads as "1 goal left." Use "1 game left" / "1 gm".

**UTIL vs Flex inconsistency:** roster page labels the util slot "UTIL"; matchup roster table labels the same slot "Flex". Pick one.

**What's genuinely good (keep — see [[wins-keep]]):**
- Roster page has an inline stat glossary spelled out ("GP = Games Played · G = Goals...").
- Free Agents vs Waiver Wire tabs with plain-language distinction ("add immediately, no claim period" vs "subject to priority and review").
- "Roster full — select a player to drop when adding" inline guidance.
- Matchup page inline explainer: "Fantasy points (FP) decide who wins the week. Winning earns Victory Points (VP) in the standings." Best VP/FP bridge sentence in the product.
- Trade-new is the 4-step guided flow (Select partner → gives → want → review) with FP shown per player — the stepped redesign from [[trade-proposal-findings]] is live and good.
- Auto-draft produces fully valid 3F/2D/1G/1UTIL/6BENCH lineups for all teams — no empty starting slots out of the box.

**API mechanics learned (for future runs):**
- `/api/leagues/[id]/draft/setup` then `/api/leagues/[id]/auto-draft` (commissioner) fills the whole draft without the WS server. WS URL (`NEXT_PUBLIC_DRAFT_WS_URL`) is not exposed in client bundles.
- `/api/leagues/[id]/waiver` requires `teamId` in the body (not just add/drop ids).
- `/api/leagues/[id]/fa-suggestions?team=` returns top free agents by projected FP.
- `/api/leagues/[id]/season/advance` with `{simulatedDate, action:"start"}` is reachable on the prod beta league and sets the active week — `ALLOW_SIM_DATE` appears effectively enabled for this league. Flag for ops: CLAUDE.md says it must NOT be set in prod.
