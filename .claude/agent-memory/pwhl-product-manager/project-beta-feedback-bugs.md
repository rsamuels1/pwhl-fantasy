---
name: beta-feedback-bugs
description: Beta bug tracker — full triage Jun 24 2026; BF-001–020 resolved/known; BF-021–028 new items from Jun 24 batch; next ID: BF-029
metadata:
  type: project
---

Last full triage: Jun 24, 2026. `FeedbackSubmission` table has 24 rows (1 DISMISSED test).

## Status key
- ✅ SHIPPED — fix in codebase; DB row may still say OPEN (stale)
- OPEN — confirmed unresolved
- DEFERRED — known, not yet scheduled
- BLOCKED — external dependency

---

## BF-001 — Draft Room False Eviction
- DB: `cmqn6ppib0037ayqco2pgk62g` (Jun 21) — status OPEN (stale)
- ✅ SHIPPED Sprint 9 — one silent reconnect attempt on 4001 before eviction screen; `shouldReconnectRef` corrected
- DB row stale; update via founder console

## BF-002 — Performance Tab Shows "Week 1" Mid-Season
- DB: `cmqmn2ffl0001rdpgj8tt1c2z` (Jun 20) — status OPEN (stale)
- ✅ SHIPPED Sprint 9 — week badge in `GMCommandCenter.tsx` derives from last completed week
- DB row stale; update via founder console

## BF-003 — Activity Feed Raw "LEAGUE_STORYLINE"
- ✅ SHIPPED Sprint 10 — `emitWeeklyStorylines()` now always includes a `description` field
- Note: BF-027 (Jun 24) is a regression report — same symptom in a new league. Investigate separately.

## BF-004 — Lineup Move "UTIL Slot Is Full" False Error
- ✅ SHIPPED Sprint 12 — seatedActive calculation refactored to explicit Record-based grouping

## BF-005 — Draft Room Eviction Overlay Bug
- ✅ SHIPPED Sprint 10

## BF-006 — Bench Upgrade Hint Recommends Zero-Games Player
- DB: `cmqn9p23u0012di9m8y4709pt` (Jun 21) — status OPEN (stale)
- ✅ SHIPPED Sprint 10 — bench upgrade hint filters to `gamesThisPeriod > 0`
- DB row stale; update via founder console

## BF-007 — "Performance" Tab Name Unclear
- ✅ SHIPPED Sprint 11b — renamed to "Record"

## BF-008 — Activity Feed Negative Timestamps in Replay
- ✅ SHIPPED Sprint 15

## BF-009 — Analysis Page Navigation Broken
- ✅ SHIPPED Sprint 18 (investigation confirmed no code change needed)

## BF-010 — Goalie Locked Into BENCH Before Manager Can Move Her
- Status: OPEN
- Sprint: Backlog
- Spec in `roadmap-features.md`

## BF-011 — FA Suggestions Return Empty in Replay/Historical Leagues
- Status: OPEN
- Sprint: Backlog
- Spec in `roadmap-features.md`

## BF-012 — FA Add Confirms Success But Shows Error Modal
- DB: `cmqnc5umh000eu5tmsanmob6z` (Jun 21), `cmqrf2ib2000anqbgfeidhctw` (Jun 24) — two separate reports
- Status: OPEN (carried from Sprint 18; second report Jun 24 confirms not fixed)
- Likely: `AddAndSlotModal.tsx` capacity check fires after a successful add; slot-assignment API call may return error code that the UI misreads as roster-full
- Sprint: Sprint 26 carry-forward
- Spec in `roadmap-features.md`

## BF-013 — Trades Cannot Be Proposed Between Draft Completion and Season Start
- DB: `cmqniggbz000kb5xpiks9tfim` (Jun 21) — status OPEN
- Status: OPEN (carried from Sprint 18)
- `proposeTrade()` blocks when `league.status !== "IN_SEASON"` + pre-season window not considered
- Sprint: Sprint 26 carry-forward
- Spec in `roadmap-features.md`

## BF-014 — VTF Matchup Schedule Page Confusing in Vs-The-Field Mode
- DB: `cmqpqywet000911ngv1887pij` (Jun 22) — status OPEN
- Status: OPEN (carried from Sprint 18; spec needed before implementation)
- Sprint: Backlog
- Spec in `roadmap-features.md`

## BF-015 — UTIL Slot False Error on Valid Forward Move
- ✅ SHIPPED Sprint 18 ad-hoc

## BF-016 — Activity Feed Shows Raw LEAGUE_STORYLINE Enum
- ✅ SHIPPED Sprint 18 ad-hoc
- Note: BF-027 is a Jun 24 regression report — investigate whether fix was partial

## BF-017 — Auto-Set Suggests Players with 0 Games
- ✅ SHIPPED Sprint 18 ad-hoc

## BF-018 — /league-rules 404
- ✅ SHIPPED Sprint 22

## BF-019 — Password Reset / Forgot Password (Blocked on Email Infra)
- Status: BLOCKED — requires transactional email provider
- Spec in `roadmap-features.md`

## BF-020 — Auto-Draft Position Balance
- DB: Internal identification
- ✅ SHIPPED Sprint 25 — Tier 1b added in `bestAvailablePlayerIds()`: defensemen filling open D slots now ranked at same priority as goalies filling G slots (BF-020 comment confirmed in `lib/draft/server.ts` line 469/525)

---

## NEW — Jun 24, 2026 batch (7 new items)

### BF-021 — DnD Lineup Mobile UX Friction
- DB: `cmqre68q6` (Jun 24) — OPEN
- **Type:** Suggestion
- **Original feedback:** "I love the look of the two tabbed My Roster page, but I'm not sure I love the mechanism to change my lineup. Which is better for mobile? This drag and drop situation or the two panel? It just feels like a lot of scrolling as a user to get a full view of my options."
- **User need:** DnD roster/lineup page requires too much scrolling on mobile to compare bench vs. active slots.
- **Acceptance criteria:**
  - On viewports ≤768px, active and bench slots visible without excessive scrolling
  - Drag handle targets ≥44px (verify not regressed)
  - No desktop DnD regression
- **Effort:** M
- **Sprint:** Sprint 26 backlog

### BF-022 — BottomNav Visible on Laptop/Desktop
- DB: `cmqrlxl7n` (Jun 24) — OPEN
- **Type:** Bug
- **Original feedback:** "the bottom navigation is showing on my laptop, i think they should just be for mobile?"
- **User need:** BottomNav should be suppressed at non-mobile viewports (≥768px or ≥900px matching the existing `useIsMobile` breakpoint).
- **Acceptance criteria:**
  - BottomNav hidden at ≥768px (or ≥900px)
  - Existing TeamNav tab bar serves desktop
  - `tsc --noEmit` clean
- **Effort:** S
- **Sprint:** Sprint 26 P1

### BF-023 — Transaction History Missing FA Adds
- DB: `cmqrm14o1` (Jun 24) — OPEN
- **Type:** Bug
- **Original feedback:** "I don't think transaction history is working for free agents. I picked up multiple Free Agents but it's not showing there."
- **User need:** PLAYER_ADD LeagueEvents from direct FA adds (not waiver claims) should appear in the transaction feed.
- **Acceptance criteria:**
  - After a successful FA add, a PLAYER_ADD event appears in `/team/[teamId]/transactions`
  - Filter by "Adds" type surfaces the event
  - `tsc --noEmit` clean
- **Effort:** M (investigate whether PLAYER_ADD events are emitted from direct FA add path)
- **Sprint:** Sprint 26 P1

### BF-024 — Transactions from Team Nav Bounces to League Dashboard
- DB: `cmqrm1rwe` (Jun 24) — OPEN
- **Type:** Bug
- **Original feedback:** "I dont like how TRANSACTIONS from the My Franchise menu bounces you back to the league dashboard"
- **User need:** The Transactions tab in TeamNav should render in the team layout, not redirect to the league layout.
- **Acceptance criteria:**
  - `/team/[teamId]/transactions` renders the TransactionFeed in the team layout (not a redirect to `/league/[leagueId]/transactions`)
  - TeamNav "Transactions" link targets the team-scoped route
  - `tsc --noEmit` clean
- **Effort:** S (Sprint 19 created route stubs; check if the page redirects instead of rendering inline)
- **Sprint:** Sprint 26 P0 (navigation regression)

### BF-025 — Trade UI Forces Same-Position Matching
- DB: `cmqrm3n0d` (Jun 24) — OPEN
- **Type:** Bug
- **Original feedback:** "When trading, it's forcing me to only trade for people in the same position. A user should be able to trade any position for any other position."
- **User need:** The trade proposal UI should allow cross-position trades — the engine supports this; the UI is artificially filtering.
- **Acceptance criteria:**
  - ProposeTrade (UX-058 4-step flow) does not filter partner roster by position
  - Any player can be offered or requested regardless of position
  - Engine's `checkRosterLegal` still validates legality at execution time, not proposal time
  - `tsc --noEmit` clean; existing trade tests pass
- **Effort:** S (likely a position filter in ProposeTrade.tsx Step 2/3 player lists)
- **Sprint:** Sprint 26 P1

### BF-026 — Standings Playoff Cutoff Text Hard to Read
- DB: `cmqrm4gwb` (Jun 24) — OPEN
- **Type:** Bug
- **Original feedback:** "I think this text on the standings page is really hard to read: 'Top 4 teams advance to the playoffs — dashed line marks the cutoff'"
- **User need:** Playoff cutoff explainer text needs WCAG AA contrast (4.5:1 minimum).
- **Acceptance criteria:**
  - Cutoff subtitle meets WCAG AA contrast ratio
  - Legible on mobile and desktop
  - No other standings changes
- **Effort:** S
- **Sprint:** Sprint 26 P1

### BF-027 — Activity Feed LEAGUE_STORYLINE Regression
- DB: `cmqrm9a1d` (Jun 24) — OPEN
- **Type:** Bug (regression — BF-016 was marked shipped but issue reappears in newer leagues)
- **Original feedback:** "We're still getting some 'LEAGUE_STORYLINE' text in the League Activity page on the league dashboard."
- **User need:** The raw enum string "LEAGUE_STORYLINE" must never appear in any activity feed.
- **Acceptance criteria:**
  - All LEAGUE_STORYLINE events render their `headline` field, not the enum string
  - Fix verified in both league overview activity feed and standalone transactions feed
  - Investigate whether BF-016 fix was partial (only one call site) or a new regression path
- **Effort:** S
- **Sprint:** Sprint 26 P0

### BF-028 — Commissioner Has No Pending Trade Visibility
- DB: `cmqrmcoei` (Jun 24) — OPEN
- **Type:** Suggestion
- **Original feedback:** "There's currently a trade proposed in my league but it doesn't tell the commish that anywhere on the league dashboard. Maybe there could be a notification dot on transactions that shows the pending trade offers?"
- **User need:** When trades are in PENDING_REVIEW status, the commissioner needs an indicator on the league dashboard without checking the admin panel.
- **Acceptance criteria:**
  - A numeric badge or dot appears on the "Admin" nav link when trades are in PENDING_REVIEW, OR a pending-review callout renders in the commissioner overview action strip
  - Count reflects actual PENDING_REVIEW trades (disappears at 0)
  - Clicking navigates to Trade Review section in admin panel
  - No schema change (query existing `Trade` table)
- **Effort:** S
- **Sprint:** Sprint 26 P1

---

## Summary by status (as of Jun 24, 2026)

| Status | Count | IDs |
|---|---|---|
| ✅ SHIPPED | 16 | BF-001–009, BF-015–018, BF-020 |
| OPEN (backlog) | 5 | BF-010, BF-011, BF-012, BF-013, BF-014 |
| BLOCKED | 2 | BF-019 (email), UX-053 (email) |
| NEW Jun 24 | 8 | BF-021–028 |

**Next BF-NNN: BF-029**

**How to apply:** BF-001/002/006 stale OPEN in DB — cosmetic only, fix via founder console. BF-012 confirmed OPEN with second report Jun 24. BF-024/027 are navigation regressions — treat as P0 for Sprint 26. BF-020 SHIPPED Sprint 25 (confirmed in lib/draft/server.ts). Next new bug ID is BF-029.
