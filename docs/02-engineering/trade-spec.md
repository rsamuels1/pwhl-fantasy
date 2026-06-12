# Trade System Specification

**Roadmap item:** #7 Trade System (Phase 2 — Fantasy Essentials). GPT track: TR-003 Trade System, TR-004 Commissioner Trade Review.

**Priority:** P1 (post-MVP / Sprint 4+). The single largest new domain on the roadmap (~130K tokens — plan a dedicated session).

**Status:** Not implemented

**Related documents:**
- `docs/commission-tools-spec.md` (commissioner trade review / approval, undo transaction, audit log)
- `docs/notification-framework-spec.md` (`TRADE_RECEIVED` and related notifications)
- `docs/league-rules-v1.md` (roster construction & lineup-lock rules trades must respect)
- Roadmap #8 Transaction History (logs trades), #25 Team Analysis & Insights (surfaces trade suggestions that pre-fill a proposal)

---

# Overview

The Trade System lets managers exchange players directly, with an optional commissioner-review
gate. It is the missing half of league management: today players move only via draft and
free-agent add/drop, so a manager who mis-drafted or wants to consolidate has no recourse with
other humans.

A trade is a **multi-player, two-team** exchange that must leave **both** rosters legal. It moves
through a small state machine — proposed → accepted/rejected → (optional review) → executed — with
notifications at each step and a full audit trail. Unlike waivers (priority-resolved, batched),
trades are **negotiated and event-driven**: they execute the moment both parties (and, if required,
the commissioner) agree.

This is a new domain. It introduces its own schema, API surface, and UI, but it deliberately
reuses the existing roster-legality checks, the play-lock rule, `LeagueEvent`, and the
notification framework.

---

# Goals

- Managers can propose, review, counter, accept, or reject **multi-player** trades.
- **Both rosters stay legal** at execution — size and position eligibility enforced atomically.
- Optional **commissioner review** with approve/veto, plus a league **review period** to discourage
  collusion.
- Complete **transparency**: every proposal and execution is logged and notified.
- Replay-safe and idempotent execution.

## Non-goals (this spec)

- Draft-pick trading (future / keeper-dynasty era — there are no tradeable picks in single-season v1).
- FAAB-budget trading (depends on FAAB #6).
- Multi-team (3+) trades — v1 is strictly two-team.

---

# Trade Rules (v1 defaults)

League settings with these defaults; only the review toggle + period are commissioner-surfaced in v1.

| Decision | v1 Default | Notes |
|---|---|---|
| **Teams per trade** | **2** | Two-team only in v1. |
| **Players per side** | **1–N** | Any count, as long as both rosters end legal. |
| **Roster legality** | **Enforced at execution** | Both teams must satisfy roster size + position rules after the swap. |
| **Locked/played players** | **Cannot be traded mid-period** | A player who has played in the active scoring period is untradeable until the period ends (play-lock parity). |
| **Commissioner approval** | **Off by default** | Commissioner can require approval for all trades (TR-004). |
| **League review period** | **24h** | Executed trades enter a review window during which the commissioner may veto (anti-collusion). Set to 0 to execute immediately. |
| **Trade deadline** | **End of regular season** | No trades once playoffs begin. |

---

# Trade Lifecycle (state machine)

```text
            propose                 accept                review window /        veto
  (none) ──────────► PROPOSED ───────────────► ACCEPTED ──── commissioner ────► EXECUTED
                       │  │                        │            approve            │
              reject   │  │ counter                │ (auto after period            │ (commissioner
                       ▼  ▼                         ▼  or approval)                 ▼  in window)
                  REJECTED  COUNTERED          PENDING_REVIEW                    REVERSED
                       │
              proposer cancels ─► CANCELLED      (expires after N days) ─► EXPIRED
```

States:
- **PROPOSED** — sent to the other team; awaiting their response.
- **COUNTERED** — recipient proposed different terms (a new linked proposal; original becomes COUNTERED).
- **ACCEPTED** — both teams agree on terms.
- **PENDING_REVIEW** — accepted but inside the commissioner-review window (or awaiting required approval).
- **EXECUTED** — rosters swapped atomically.
- **REVERSED** — vetoed/undone by commissioner during review (restores rosters).
- **REJECTED / CANCELLED / EXPIRED** — terminal non-execution states.

Validation runs at **propose**, **accept**, and again at **execute** (state can drift — a player in
the deal could have been dropped or have played in between).

---

# Data Model

```prisma
model Trade {
  id            String       @id @default(cuid())
  leagueId      String
  proposingTeamId String
  receivingTeamId String
  status        TradeStatus  @default(PROPOSED)
  message       String?
  counterOfId   String?      // links a counter to the trade it replaces
  reviewEndsAt  DateTime?    // set when entering PENDING_REVIEW
  executedAt    DateTime?
  resolvedReason String?     // REJECTED_BY, CANCELLED, EXPIRED, VETOED, etc.
  createdAt     DateTime     @default(now())
  league        FantasyLeague @relation(fields: [leagueId], references: [id])
  items         TradeItem[]
  @@index([leagueId, status])
}

enum TradeStatus { PROPOSED COUNTERED ACCEPTED PENDING_REVIEW EXECUTED REVERSED REJECTED CANCELLED EXPIRED }

model TradeItem {
  id         String @id @default(cuid())
  tradeId    String
  fromTeamId String
  toTeamId   String
  playerId   String
  trade      Trade  @relation(fields: [tradeId], references: [id])
  @@index([tradeId])
}
```

- A trade is a set of `TradeItem` rows (each: a player moving from one team to the other), so any
  N-for-M shape is representable.
- Counters are modeled as a new `Trade` with `counterOfId` set, keeping a readable negotiation
  thread.
- No fantasy-point or standings data is touched — trades only reassign roster ownership.

---

# API

```http
POST  /api/leagues/:leagueId/trades                  { receivingTeamId, items[], message? }
GET   /api/leagues/:leagueId/trades?team=:teamId      // my proposals + offers
GET   /api/leagues/:leagueId/trades/:id
POST  /api/leagues/:leagueId/trades/:id/accept
POST  /api/leagues/:leagueId/trades/:id/reject
POST  /api/leagues/:leagueId/trades/:id/counter       { items[], message? }
POST  /api/leagues/:leagueId/trades/:id/cancel        // proposer only, while PROPOSED
POST  /api/leagues/:leagueId/trades/:id/review        { action: "approve" | "veto" }  // commissioner only
```

- All routes use the existing auth guards (`apiRequireLeagueMember`); `/review` uses
  `apiRequireCommissioner`. Accept/reject/counter require the caller to own the **receiving** team;
  cancel requires the **proposing** team.
- **Execution** is performed in a `prisma.$transaction`: re-validate both rosters, move all
  `TradeItem` players (update `Roster` ownership, default incoming players to BENCH), set
  `EXECUTED`, emit events + notifications. Idempotent — re-running on an already-EXECUTED trade is a
  no-op.

---

# Roster Legality & Edge Cases

At accept and execute, validate for **both** teams using the existing helpers
(`lib/lineup.ts` roster settings + position eligibility):

- Final roster size ≤ league max for each team (uneven trades allowed only if the receiving side has
  room; otherwise the proposal must include a counter-drop or be rejected).
- Position eligibility preserved (e.g. a team can't trade away its only goalie below the minimum if
  that would make a legal lineup impossible — warn, and block at execute).
- **Play-lock:** no player in the deal may have played in the active scoring period.
- **Stale deal:** if a player in the trade is no longer on the expected team at execute time
  (dropped, traded elsewhere), the trade auto-fails with `STALE` and notifies both parties.

---

# Commissioner Review (TR-004)

Per `docs/commission-tools-spec.md`:

- **Approval mode** (optional): when enabled, every accepted trade enters `PENDING_REVIEW` and
  requires explicit commissioner **approve** before executing.
- **Veto window**: even without approval mode, executed trades sit in a `reviewEndsAt` window during
  which the commissioner may **veto** → `REVERSED` (rosters restored atomically).
- **Undo**: a committed trade can be reversed via the commissioner's **undo transaction** tool.
- All trade actions — propose, accept, execute, veto, undo — are written to the **audit log**.

---

# Notifications

Via `docs/notification-framework-spec.md` (extend `NotificationType`):

| Type | To | When |
|---|---|---|
| `TRADE_RECEIVED` | receiving manager | New proposal or counter |
| `TRADE_ACCEPTED` | proposing manager | Recipient accepts |
| `TRADE_REJECTED` | proposing manager | Recipient rejects / lets expire |
| `TRADE_EXECUTED` | both managers | Trade processes |
| `TRADE_VETOED` | both managers | Commissioner reverses in review |
| `TRADE_REVIEW_PENDING` | commissioner | Accepted trade needs approval/awaits veto window |

Each deep-links to the trade detail (`/league/:id/trades/:tradeId` or a team-scoped trade view).

---

# UI Surfaces

- **Trade center** (`/league/:leagueId/trades` or team-scoped) — incoming offers, sent proposals,
  and league trade history, grouped by status.
- **Propose-trade flow** — pick the other team, select players from each roster, optional message;
  a live legality indicator shows whether both rosters end valid.
- **Trade block** (nice-to-have, v1.1) — managers flag players they're open to moving.
- **Pre-filled proposals** — the Team Analysis & Insights tab (#25) can hand a suggested trade into
  this flow.
- **Activity feed** — executed/vetoed trades appear via `LeagueEvent` (`TRADE` event type already in
  the schema enum).

---

# Analytics

| Event | When |
|---|---|
| `trade_proposed` | Proposal created (with item counts) |
| `trade_responded` | Accept / reject / counter |
| `trade_executed` | Trade processes |
| `trade_vetoed` | Commissioner reverses |

---

# Acceptance Criteria

- A manager can propose a multi-player, two-team trade; the recipient can accept, reject, or counter.
- Execution is atomic and leaves both rosters legal; incoming players land on the bench.
- Players who have played in the active period cannot be traded; stale deals auto-fail.
- Optional commissioner approval and a configurable veto window both work; veto restores rosters.
- Both managers are notified at every state change; every step is in the audit log and activity feed.
- No trades after the regular-season trade deadline.
- Execution is idempotent and replay-safe.

---

# Dependencies & Sequencing

- **Reuses:** roster legality + play-lock (`lib/lineup.ts`), `LeagueEvent` (`TRADE`), notification
  framework, commissioner tools (review/undo/audit).
- **Feeds:** Transaction History (#8) — much cheaper to build once this schema exists, as it's
  largely a log view over trades + waivers + adds/drops. Team Analysis (#25) trade suggestions
  pre-fill the propose flow.
- **Roadmap order:** #7 Trade System → #8 Transaction History → #5 Waiver priority → #6 FAAB.
  Build trades first because it establishes the transaction-domain schema the others read.

---

# Out of Scope (this spec)

- Draft-pick and FAAB-budget trading.
- 3+ team trades.
- Automated trade-fairness/veto scoring (managers + commissioner decide in v1).
