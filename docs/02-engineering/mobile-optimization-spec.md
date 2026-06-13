# Mobile Optimization Spec

**Sprint:** 3 — Beta Readiness  
**Priority:** P0 (MVP launch gate)  
**Goal:** Every core page is usable on a 390px-wide phone (iPhone 15 baseline) without horizontal scrolling, with touch targets large enough to use reliably mid-draft.

---

## What already works (do not regress)

- `.stat-secondary { display: none }` at ≤480px hides secondary stat columns on lineup, roster, and matchup pages
- `.lineup-grid` collapses to single column at ≤600px
- `.matchup-2col` collapses to single column at ≤600px
- `.overview-grid` collapses to single column at ≤900px
- `.team-nav` has `overflow-x: auto` for horizontal scroll on the tab bar
- `BottomNav` is implemented and wired into both `/league/[leagueId]/layout.tsx` and `/team/[teamId]/layout.tsx` — it already shows at ≤640px

---

## Breakpoints (canonical, use these everywhere)

| Name | Width | Use for |
|---|---|---|
| `sm` | ≤480px | Hide secondary columns, compress nav tabs |
| `md` | ≤640px | Collapse two-column layouts, show BottomNav |
| `lg` | ≤900px | Collapse three-column layouts (overview, draft) |

Do not introduce new breakpoints. Consolidate any inline `@media` queries to these three thresholds.

---

## Touch target rule

Any tappable element must be at least **44×44px** (Apple HIG) or **48×48px** (Material). Apply using `min-height` + `min-width` rather than relying on padding alone, since padding doesn't expand the hit area reliably on iOS Safari.

**Elements that currently fail this rule (confirmed):**
- Pick button in DraftRoom player table: `padding: "4px 10px"` → ~28px tall
- Queue star button: renders as a single character with no explicit size
- Position filter buttons in draft: `padding: "4px 10px"` → ~28px tall
- Drop button in RosterManager: `padding: "4px 8px"` → ~26px tall
- `↑`/`↓` reorder buttons in the draft queue tab: no explicit size

**Fix:** add `minHeight: 44, minWidth: 44` to all interactive buttons. For icon-only buttons (star, ↑, ↓), use `display: flex; alignItems: center; justifyContent: center` with the min size so the tap target is visually consistent.

---

## Page-by-page changes

### 1. Draft Room (`app/draft/[leagueId]/DraftRoom.tsx`)

This is the hardest page and the highest-stakes. The three-column layout has fixed widths that cannot simply stack:

```
leftCol:   width: 320, flexShrink: 0   (PickBoard + RecentPicks)
centerCol: flex: 1                      (PlayerPanel — Available/Queue tabs)
rightCol:  width: 220, flexShrink: 0   (NeedsPanel + MyPicks)
```

The player table inside PlayerPanel has `minWidth: 560`, causing horizontal scroll on any phone.

**Mobile layout decision: tab-based single column**

At ≤900px, collapse the three columns into a **tabbed single-column layout**. Four tabs:

| Tab | Content | Default |
|---|---|---|
| **Pick** | PlayerPanel (Available + Queue sub-tabs) | Active (the primary action) |
| **Board** | PickBoard (snake grid) + RecentPicks | — |
| **Needs** | NeedsPanel + TeamSpreadPanel + MyPicks | — |
| **Clock** | TopBar clock + on-clock team indicator (always visible in TopBar above tabs) | — |

The TopBar (clock, on-clock team name, Start/Pause/Resume) stays pinned at the top — never collapse it into a tab. It's the only persistent UI the manager needs to see at all times.

**Implementation notes for the draft room:**

- Add a `mobileTab` state (`"pick" | "board" | "needs"`) rendered only at ≤900px via a CSS class swap on `styles.body`.
- At ≤900px, `styles.body` becomes `flex-direction: column` with the tab bar above and the active panel filling `flex: 1`.
- The player table `minWidth: 560` is the core blocker. On mobile, hide the lower-priority stat columns to reduce it. Skaters: keep **GP, G, A, PTS** — hide PPP, SOG, HIT, BLK. Goalies: keep **GP, W, SV%** — hide SV, GA, SO. Add the `stat-secondary` class to those `<th>` and `<td>` elements — the existing CSS rule already hides them at ≤480px. This alone reduces the table to ~340px wide, fitting a 390px screen.
- The position filter buttons (All / F / D / G) currently have `padding: "4px 10px"`. Change to `minHeight: 44` and let them share a row with the search input below the tab bar.
- "Pick" and "☆" buttons: change to `minHeight: 44, minWidth: 44`. The "Pick" label and star character are already legible at this size.
- `PickBoard` renders a grid of cells. At ≤640px, reduce `fontSize` inside cells from 11px to 9px and reduce cell padding. The board should stay visible without scroll — it is grid-width-bounded, not table-width-bounded, so it already adapts to container width.

**What NOT to do:**
- Do not use a hamburger menu or swipe gesture for navigation — the pick timer creates urgency that makes gesture-based navigation risky.
- Do not hide NeedsPanel entirely — managers need to know what positions to fill.
- Do not collapse the TopBar clock — it's safety-critical during a live draft.

---

### 2. Standings (`app/league/[leagueId]/standings/page.tsx`)

Table has `minWidth: 520`. Already hides some columns via `.standings-hide-mobile` at ≤480px.

**Changes needed:**
- The table `minWidth: 520` must be reduced. On mobile, keep: **rank, team name, W–L, VP** — hide `gamesBack` and race chip columns at ≤480px using `.standings-hide-mobile` (already wired).
- Add `overflowX: auto` wrapper on the table container so it scrolls horizontally rather than breaking the page layout — this is a safer fallback than hiding columns if future columns are added.
- Status chips ("CLINCHED", "BUBBLE", etc.) are `display: inline-flex` with padding — these already wrap gracefully. No change needed.
- `minWidth` on the table should drop to 340px once the secondary columns are hidden.

---

### 3. Roster (`app/team/[teamId]/roster/`)

RosterManager already has `overflowX: auto` on both the roster and FA tables with `-webkit-overflow-scrolling: touch`. This is correct — horizontal scroll on a data table is acceptable for roster/FA which are reference screens, not action screens.

**Changes needed:**
- Drop button (`padding: "4px 8px"`) → add `minHeight: 44`.
- "Add" button in FA table (same size issue) → add `minHeight: 44`.
- Team selector dropdown: `minWidth: 180` is fine; ensure `height` is ≥44px.
- The sort column headers are clickable but have no minimum tap size. They are secondary interactions (not time-critical), so this is acceptable — document as a known gap, not a blocker.

---

### 4. Lineup (`app/team/[teamId]/lineup/`)

Already collapses to single column at ≤600px via `.lineup-grid`. The click-to-swap interaction works on touch — `onClick` fires correctly on iOS Safari and Android Chrome.

**Changes needed:**
- "✕ Cancel selection" button and slot click targets: confirm they are ≥44px tall. Add `minHeight: 44` if not.
- Stats tab toggle buttons (Projected / This week / Last week / Season): currently rendered as small buttons at `fontSize: 12`. Increase to `minHeight: 36` (these are mode switches, not primary actions — 36px is acceptable for repeated-use controls per Material M3).
- The "between-weeks nudge" amber banner: uses `padding: 12px 16px` — confirm it renders without overflow on 390px. No structural changes needed.
- Player cards already use `flexWrap: wrap` for stat chips — these adapt correctly. No change.

---

### 5. Matchup (`app/team/[teamId]/matchup/`)

Already collapses `.matchup-2col` to single column at ≤600px. MatchupHero scores use `clamp` font sizes in the main hero components.

**Changes needed:**
- "Set lineup →" CTA button in hero: confirm ≥44px height.
- "Playing tonight" player chips: `display: inline-flex` with small padding — acceptable on mobile (they are read-only badges, not tap targets).
- `RosterTable` (opponent roster in the hero): the player stat chips use `flexWrap: wrap`, which is correct. No structural changes needed.
- The swing player rows should be checked for overflow — they use `justifyContent: "space-between"` which can cause issues at narrow widths if player names are long. Add `minWidth: 0` and `overflow: hidden; textOverflow: ellipsis` on the name span if not already set.

---

### 6. BottomNav (already implemented — needs polish)

The BottomNav component exists and is wired. The icon-only rendering (emoji + label) is correct. The tab links have `flex: 1` with centered content.

**Changes needed:**
- Each tab link currently has no explicit `minHeight`. Add `minHeight: 60` (the nav height already is 60) — this ensures the full height is the hit target, not just the text.
- The `height: 60` nav leaves ~54px of bottom safe-area uncovered on iPhone 15 (home indicator zone). Add `paddingBottom: "env(safe-area-inset-bottom, 0px)"` to the nav and increase `bottom-nav-pad` to `padding-bottom: calc(68px + env(safe-area-inset-bottom, 0px))`.
- Emoji icons (⚡✏👕🏆) render inconsistently across Android Chrome vs iOS Safari. Replace with inline SVG or plain-text alternatives (e.g., "~" for lineup, "•" for roster) OR keep emoji but add `aria-hidden="true"` and a visually hidden text alternative — emoji alone are not screen-reader-safe.

---

## Error state: connection warning in DraftRoom

`app/draft/[leagueId]/DraftRoom.tsx:871`:

```tsx
Could not connect to the draft server. Make sure it is running on{" "}
<code>{process.env.NEXT_PUBLIC_DRAFT_WS_URL ?? "ws://localhost:8080"}</code>.
```

This leaks the internal WebSocket URL to end users. Replace with a user-friendly message regardless of mobile optimization:

```tsx
<div style={{ padding: "2rem", textAlign: "center", color: "var(--red)" }}>
  <p style={{ fontSize: 16, fontWeight: 600 }}>Could not connect to draft</p>
  <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8 }}>
    Check your internet connection and refresh. If the problem continues, contact your commissioner.
  </p>
</div>
```

This is a one-line fix included in this spec because it is blocking on mobile (the raw WS URL can wrap awkwardly at 390px).

---

## Acceptance criteria

All criteria tested on a physical or simulated iPhone 15 (390px viewport) and Pixel 7 (412px viewport) in portrait orientation.

| Criterion | Test |
|---|---|
| No horizontal scroll on any core page | Scroll indicator never appears on `/team/*/matchup`, `/team/*/lineup`, `/team/*/roster`, `/league/*/standings` |
| Draft room usable on phone | Can search for a player, view stats, and tap "Pick" or "☆" without scrolling horizontally |
| All buttons ≥44px tall | DevTools element inspector shows computed height ≥44px on Pick, Drop, Add, Cancel, queue reorder buttons |
| Draft room shows mobile tab bar at ≤900px | Tabs "Pick / Board / Needs" appear; three-column layout is hidden |
| Draft room TopBar always visible | Clock and on-clock team name visible above the tab bar at all times |
| BottomNav safe area | Bottom nav does not overlap content on iPhone 15 home-indicator zone |
| `npm test` passes | All 149+ tests pass with no regressions |
| `npx tsc --noEmit` clean | Zero TypeScript errors |

---

## Implementation sequence

1. **BottomNav safe-area fix** — 5 min, zero risk
2. **Touch target fixes across all pages** — add `minHeight: 44` to Drop, Add, Pick, star, reorder buttons
3. **Draft room connection error message** — 2-min copy change
4. **Standings table** — reduce minWidth, add overflow wrapper
5. **Draft room stat column hiding** — add `stat-secondary` class to PPP, SOG, HIT, BLK (skater) and SV, GA, SO (goalie) in DraftRoom table `<th>` and `<td>`; this reduces minWidth from 560 to ~340
6. **Draft room mobile tab layout** — add `mobileTab` state, render tab bar at ≤900px using CSS class on `styles.body`, show/hide columns based on active tab
7. **Matchup swing player overflow** — add `minWidth: 0` + `textOverflow: ellipsis` to name spans
8. **Lineup stat toggle button heights**

Steps 1–5 are independent and can be done in any order. Step 6 (draft room tabs) depends on step 5 (column hiding). Steps 7–8 are independent cleanup.
