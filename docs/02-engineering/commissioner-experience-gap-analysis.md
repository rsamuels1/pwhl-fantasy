# Commissioner Experience Gap Analysis

Date: June 12, 2026
Sources reviewed: `commission-tools-spec.md`, `commissioner-runbook.md`, `founding-commissioner-program.md`, `mvp-readiness-scorecard.md`, `risk-register.md`, `mvp-definition.md`, `league-rules-v1.md`, admin panel, all commissioner-gated API routes, auth helpers, draft server, waiver/roster routes.

---

## Executive Summary

A commissioner can run the **happy path** today: create a league, draft, start the season, advance weeks, start playoffs. The platform is functional for a frictionless season.

It is **not functional** for anything that goes wrong. There are no tools to replace an inactive manager, undo a bad pick, move a player on behalf of a manager, or transfer commissionership. The commissioner tools spec defines 14 actions; 5 are implemented. The runbook describes 6 recovery procedures; 0 are buildable with current tooling.

Beta commissioners will encounter these gaps within the first 2–3 weeks of a live season.

---

## Can a Commissioner Run a League Today?

### Yes — for the happy path

| Task | Status | How |
|---|---|---|
| Create league | ✓ | `POST /api/leagues/create` |
| Generate invite link | ✓ | Admin panel — `InviteLinkButton` |
| Add/remove teams pre-draft | ✓ | Admin panel — `AddTeamForm` |
| Set draft order | ✓ | Admin panel — per-team ordering |
| Set up draft board | ✓ | Admin panel — `SetupDraftButton` |
| Start draft | ✓ | Draft room — commissioner Start button |
| Pause / resume draft | ✓ | Draft room — commissioner controls |
| Start season | ✓ | Admin panel — Season section |
| Advance season (score weeks) | ✓ | `POST /api/leagues/[id]/season` |
| Start playoffs | ✓ | Standings page — commissioner button |
| Post league announcement | ✓ | Admin panel — `AnnouncementForm` |

### No — for anything that goes wrong

| Task | Status | Why |
|---|---|---|
| Move a player for an inactive manager | ✗ | Roster moves are owner-only; no commissioner override |
| Undo a waiver add/drop | ✗ | No undo mechanism exists anywhere |
| Fix a bad draft pick | ✗ | Picks are immutable once persisted |
| Skip a team's turn mid-draft | ✗ | Draft engine has no skip action |
| Replace an inactive manager | ✗ | No ownership transfer endpoint |
| Transfer commissionership | ✗ | `commissionerId` field has no update path |
| View an audit log | ✗ | Audit log not built |
| Edit scoring settings post-creation | ✗ | League settings page is read-only |
| Edit roster settings post-creation | ✗ | No update API for rosterSettings |
| Remove a manager from the league | ✗ | No endpoint |
| Approve or reject a trade | ✗ | Trades not built |

---

## What Tasks Require Manual Intervention Today?

The following scenarios — all described in the commissioner runbook as normal commissioner responsibilities — have **no platform support**. Each requires a workaround or is simply impossible without direct database access:

| Runbook Scenario | Platform Support | Required Workaround |
|---|---|---|
| "Force Roster Move" — fix bug/scoring error for a manager | None | Database edit by platform admin |
| "Undo Transaction" — reverse incorrect waiver move | None | Database edit by platform admin |
| "Replace Manager" — inactive or departing manager | None | Not possible; team stays orphaned |
| Mid-draft recovery if commissioner disconnects and no one can start | Draft room WebSocket only | Reconnect; draft auto-picks but commissioner cannot retake control from a different device cleanly |
| Stat correction dispute resolution | None | No commissioner power defined; corrections are "final" per league rules |
| Manager removes themselves from draft mid-pick | None | Auto-pick fires; commissioner cannot override |
| Scoring dispute escalation | None | No escalation path defined or built |

---

## Findings by Priority

### P0 — Beta Blockers

These will occur in real beta leagues and have no workaround. They will break commissioner trust.

---

**P0-A: No way to handle inactive managers**

The most common real-world problem in fantasy leagues. A manager stops setting lineups, goes silent, and their team degrades the competition for everyone else. The runbook describes "Replace Manager" as a core commissioner tool. The spec defines it as: remove access, invite replacement, preserve roster, preserve standings.

**Current state:** Zero implementation. No endpoint, no ownership transfer, no access revocation. `commissionerId` and `ownerId` fields have no update path in any route. The auth system checks these as binary equality — no way to reassign.

**Risk:** R-008 (Commissioner Abandons League) is rated High/Medium in the risk register. It applies equally to team owners abandoning their teams.

**To fix:** `PUT /api/leagues/[leagueId]/teams/[teamId]/owner` — commissioner-only, transfers `ownerId` to a new User, sets up re-invite flow.

---

**P0-B: No commissioner transfer**

If the commissioner wants to step down, changes email, or becomes inactive themselves, the league cannot survive. There is no path to transfer `commissionerId` to another manager.

**Current state:** `commissionerId` is set at league creation. No API route, no UI, no auth function (`lib/auth.ts` has no `transferCommissioner` helper) allows changing it.

**Risk:** R-008 directly. A dead commissioner is worse than a dead manager — the entire admin panel and all season controls require `commissionerId === userId`.

**To fix:** `PUT /api/leagues/[leagueId]/commissioner` — commissioner-only, transfers commissionership to an existing team owner.

---

**P0-C: No draft recovery mechanism**

Picks are persisted atomically and immediately (`persistPick()` writes to DB at the moment of pick). There is no undo. There is no skip. The draft engine has no `OVERRIDE_PICK` or `UNDO_PICK` action.

**Real scenarios:**
- Manager accidentally picks wrong player (misclick)
- Pick timer fires on a disconnected team and auto-picks a goalie over a needed forward
- Commissioner makes a setup error (wrong draft order, wrong timer) and draft has already started

**Current state:** Once a pick is persisted, it is permanent. The draft can be paused, but not reversed. There is no `reset draft` capability (listed in the spec, not implemented).

**Workaround:** Database edit by platform admin. Not viable for beta commissioners.

**To fix (minimum viable):** Add a `POST /api/leagues/[leagueId]/draft/undo-last-pick` commissioner-only route that reverts the most recent pick if the draft is PAUSED. Does not need to support arbitrary pick reversal — just the last one.

---

### P1 — Significant Friction, Workarounds Exist but Break Trust

---

**P1-A: No roster override for commissioners**

The runbook's "Force Roster Move" procedure is the documented tool for correcting scoring errors and bug-related roster issues. The waiver and lineup APIs check `team.ownerId === auth.id` — commissioners cannot act on behalf of another team.

**Workaround:** Commission can instruct the manager to make the move. Breaks down when manager is inactive (see P0-A) or when manager disputes the need for the change.

**To fix:** Add an optional `?actingAs=<teamId>` param to `PUT /api/leagues/[leagueId]/lineup` and `POST /api/leagues/[leagueId]/waiver`, accepted only when `apiRequireCommissioner` passes. Log to audit trail.

---

**P1-B: League settings are immutable after creation**

The league settings page (`/league/[leagueId]/settings`) is read-only. There is no `PUT /api/leagues/[leagueId]/settings` route. The `commission-tools-spec.md` defines "Edit League Settings" and "Edit Scoring" as commissioner actions, both labeled "Preseason only" — but neither exists.

**Immediate problem:** If a commissioner makes a mistake in league setup (wrong team count, wrong scoring settings, wrong draft type), there is no correction path short of deleting the league and starting over.

**Workaround:** Delete league and recreate. Loses any teams already joined.

**To fix:** `PUT /api/leagues/[leagueId]/settings` — commissioner-only, allows editing `name`, `maxTeams`, `scoringSettings`, `rosterSettings`, `draftType`, `draftStartsAt`. Blocked once `status !== PRE_DRAFT`.

---

**P1-C: No audit log**

The `commission-tools-spec.md` defines a full JSON audit log structure. `mvp-definition.md` lists "Audit log" as an MVP requirement. `league-rules-v1.md` states "All commissioner actions are logged by the platform." The `LeagueEvent` model exists for activity events, but no commissioner actions are written to it.

**Impact:** No paper trail for disputes. No way for a manager to verify a commissioner acted correctly. Breaks trust in contested decisions.

**Workaround:** Manual changelog (commissioner keeps notes outside the platform). Not viable at scale.

**To fix:** Write to `LeagueEvent` on every commissioner action (draft pause/resume, roster move, manager replacement, announcement, settings edit). Display log on admin panel.

---

**P1-D: No way to remove a team or manager pre-draft**

If a manager joins by mistake, uses a wrong email, or needs to be swapped out before the draft, there is no removal mechanism. `AddTeamForm` can add teams; nothing removes them.

**Workaround:** Create a new league. Not acceptable for a commissioner who has already distributed the invite link.

**To fix:** `DELETE /api/leagues/[leagueId]/teams/[teamId]` — commissioner-only, pre-draft only (`status === PRE_DRAFT`).

---

### P2 — Missing but Has a Reasonable Workaround for Beta

---

**P2-A: Cannot adjust pick timer mid-draft**

`Draft.pickTimerSecs` is set when the draft is created. There is no mechanism to change it during a live draft. If a timer is too short and managers are struggling, the commissioner cannot slow it down.

**Workaround:** Pause draft, communicate the issue in a side channel, resume. The pause is indefinite — it functions as a manual infinite timer.

---

**P2-B: Draft can only be started from inside the draft room**

The start message is sent via WebSocket from the draft room client. The commissioner must be physically in the draft room to start the draft. There is no "start draft now" button from the admin panel.

**Workaround:** Commissioner opens the draft room URL. No real problem for coordinated drafts. Could be an issue if commissioner is trying to manage setup from a separate device.

---

**P2-C: No VP standings education UI**

Risk R-001 (VP Scoring Confusion) is rated High/High in the risk register. Managers will see standings ranked by VP and not understand why their W-L record doesn't match their rank. There is no tooltip, explainer, or modal.

**Workaround:** Commissioner explains VP in the league announcement. Runbook has a VP overview section commissioners can reference.

---

**P2-D: No co-commissioner support**

The spec lists co-commissioners as a future feature. For beta leagues, all commissioner power is binary (one user). A commissioner cannot delegate draft management to a trusted co-manager.

**Workaround:** Share the commissioner's login. Not acceptable long-term but tolerable for beta if the commissioner is committed.

---

**P2-E: No conflict-of-interest guardrails**

The commissioner is a manager in their own league. There are no rules or technical guardrails preventing a commissioner from using privileged tools to benefit their own team. `league-rules-v1.md` notes commissioners "may take action when league integrity is threatened" but says nothing about self-dealing.

**Workaround:** Social norms within the beta commissioner cohort. The founding commissioner program selects for trustworthy people.

---

### P3 — Polish, Clearly Post-Beta

---

**P3-A: Trade approval workflow**

League rules authorize commissioners to approve/reject trades. Trades are not built. When trades are built (post-MVP Sprint 4+), a commissioner review flow will be needed.

---

**P3-B: Inactive manager definition and timeline**

The runbook describes handling inactive managers but never defines "inactive" (zero lineup changes? zero logins? how many weeks?). No automated alert fires when a manager goes dark.

---

**P3-C: Stat correction handling**

League rules say stat corrections are "final" and automatic. No commissioner override is defined. No notification fires when a correction changes a matchup result or standings position.

---

**P3-D: Season renewal UI**

Planned for Sprint 2 (`docs/02-engineering/parent-league-foundation-execution-plan.md`). Not a beta blocker — the first season doesn't need renewal until it ends.

---

**P3-E: Commissioner succession for abandoned leagues**

R-008 mitigation mentions "commissioner replacement workflow" and "admin override process." No spec or implementation. Post-beta, the platform needs a way to hand off a league when the commissioner disappears.

---

## Commissioner Tools Implementation Status

The `commission-tools-spec.md` defines 14 commissioner actions. Current implementation:

| Action | Spec Priority | Implemented | Notes |
|---|---|---|---|
| Pause Draft | P0 | ✓ | WebSocket, draft room only |
| Resume Draft | P0 | ✓ | WebSocket, draft room only |
| Edit Draft Order | P1 | ✓ | Admin panel, pre-setup only |
| Send League Announcement | P1 | ✓ | Admin panel + API |
| Start Season | — | ✓ | Admin panel + API |
| Start Playoffs | — | ✓ | Standings page + API |
| Force Roster Move | P0 | ✗ | No roster override for commissioners |
| Undo Transaction | P0 | ✗ | No undo mechanism |
| Approve/Reject Trade | P1 | ✗ | Trades not built |
| Replace Manager | P0 | ✗ | No ownership transfer |
| Remove Manager | P1 | ✗ | No removal endpoint |
| View Audit Log | P0 | ✗ | Audit log not built |
| Edit League Settings | P1 | ✗ | Settings are read-only post-creation |
| Reset Draft | P1 | ✗ | Picks are immutable |
| Renew League | P1 | ✗ | Planned Sprint 2 |

**5 of 15 actions implemented.**

---

## Risk Register Cross-Reference

| Risk | Rating | Gap Analysis Finding |
|---|---|---|
| R-007: Commissioner cannot resolve issues | High/Medium | P0-A, P0-C, P1-A, P1-B — all confirm this risk is real and unmitigated |
| R-008: Commissioner abandons league | High/Medium | P0-B — no commissioner transfer path exists |
| R-001: VP scoring confusion | High/High | P2-C — no education UI |
| R-003: Lineup lock confusion | Medium/High | Not a commissioner tool gap — manager experience issue |
| R-009: Inactive managers | High/High | P0-A — the single most likely beta failure mode |

---

## Recommended Pre-Beta Minimum

To safely run a beta with real commissioners, the following P0 and P1 items must be addressed before inviting the founding cohort. Not all of them require full polish — thin implementations that prevent data loss are sufficient.

**Must-have before beta (P0):**

1. **Manager replacement / ownership transfer** — even a minimal version (commissioner selects new owner from a list) prevents leagues from dying when managers go dark
2. **Last-pick undo while paused** — prevents draft corruption from accidental picks
3. **Commissioner transfer** — prevents league death if commissioner steps down

**Should-have before beta (P1):**

4. **League settings edit pre-draft** — prevents the need to recreate leagues for setup errors
5. **Audit log** — basic write-only trail is sufficient; display can come later
6. **Team removal pre-draft** — allows cleanup when wrong users join

**These six changes would raise MVP Readiness from PARTIAL to PASS on Commissioner Tools and close R-007 and R-008 from the risk register.**
