# Handoff: "Inviting Dark" color system + screen redesigns

## Overview
A repo-wide visual refresh for **PWHL GM**. Goals:
1. **Replace the color scheme** — the current vivid-violet-on-cool-navy palette
   reads as "team colors" (the user's words: *"giving Minnesota Frost"*). Move
   to **Inviting Dark**: lifted neutral graphite surfaces, a calm desaturated
   sky-blue accent, a warm gold for celebratory moments, and brighter text that
   meets WCAG AA.
2. **Make it feel inviting, not "Bloomberg terminal."** The cold, dense feel
   came from mono type, ALL-CAPS labels, and a near-black void. The fix:
   sentence-case headings, drop JetBrains Mono, lift cards with soft shadows +
   more breathing room, and a **tiered emoji policy** (warmth where it helps).
3. **Redesign the create-league wizard** — especially the scoring/options step
   — and **fix the broken VP "?" tooltip** (floats as an unanchored
   translucent box).

Apply the system across **every page** (see `page-inventory.md`).

## About the design files
The files in `references/` are **design references created in HTML** — Design
Component prototypes showing the intended look and behavior. They are **not
production code to paste in.** The target repo is a **Next.js + React + TypeScript**
app (`rsamuels1/pwhl-fantasy`) that styles with **CSS variables in
`app/globals.css` plus inline `style={{…}}` objects**. Recreate the intended
look using *that* environment's patterns — i.e. update the CSS variables, sweep
the inline hexes, and rebuild the wizard component in `.tsx`.

## Fidelity
**High-fidelity.** Exact hex values, spacing, and typography are specified. The
color tokens and the component patterns should be matched precisely.
- Wizard + VP popover: `references/Create League Wizard.dc.html`
- League overview (in-season state): `references/League Overview.dc.html`
- Team matchup (active playoff DuelHero state): `references/Team Matchup.dc.html`
- Color schemes (chosen base + alternatives considered): `references/Color Scheme Options.dc.html`
  — the app uses the sky-accent base, evolved into **"Inviting Dark"** (warmer
  surfaces + gold) as shown in the matchup/overview references.

Flat PNG previews of every reference are in `screenshots/` (tall screens are
split into top/lower frames).

---

## Part 1 — Color system rollout

### Step A — token swap (re-skins most of the app)
Replace the `:root` block in `app/globals.css` with `globals.tokens.css` from
this bundle. Then make the three follow-up edits noted at the bottom of that
file. **The single most important one:** primary buttons currently use *white*
text on the accent. The new accent is **light** sky-blue, so button text must
flip to dark (`--accent-ink`). Anywhere text/icons sit on a solid accent fill,
they go dark.

### Step B — inline-hex sweep
The app hardcodes hundreds of hexes in inline styles. Run the find/replace pass
in `color-replacement-map.md` across `app/**` and `components/**`, then grep for
leftover `#` hexes and reconcile. Verify contrast on buttons/badges afterward.

### Step C — emoji (tiered policy)
The earlier blanket ban is **superseded** — it made the app feel cold. Apply the
**tiered policy** in `emoji-policy.md` (authoritative source:
`emoji-policy-source.md`): emoji are welcome in celebratory moments, onboarding
copy, and status indicators *paired with a text label* — but never in nav, button
labels, or score columns, and never as the only status signal. Restore the
glyph chips (`✓ Clinched`, `✗ Out`, `◉ Bubble`), activity-feed icons, the 📣
commissioner strip, 🏁/🏆 recap, and the 🔒 lock. Do **not** hand-draw SVGs.

### The palette (quick reference)
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0f1117` | app background (+ radial wash to `#16202b`) |
| `--bg-raised` | `#14171e` | inputs / wells |
| `--card` | `#191d25` | panels (lifted, soft shadow) |
| `--card-hover` | `#20242c` | hover + **popovers** |
| `--text` | `#f4f6fa` | primary text |
| `--muted` | `#cdd3df` | secondary (AA) |
| `--dim` | `#9aa1b0` | labels (AA) |
| `--faint` | `#7e8593` | counters/hints |
| `--accent` | `#8fc1e8` | accent (sky) |
| `--accent-ink` | `#0a0a0c` | text ON accent fills |
| `--border` | `rgba(255,255,255,0.07)` | soft borders |
| `--green` | `#51d88a` | win/done/clinched |
| `--red` | `#f6837f` | loss/error/out |
| `--gold` | `#f5c97b` | celebratory + warning |

**Type & feel (the de-"terminal" levers):** **Archivo** everywhere; **Saira
Condensed** for LARGE hero scores only (40px+); **drop JetBrains Mono** — small
numbers use Archivo + `tabular-nums`. Section headings are **sentence case**,
15-16px/700 — delete the old ALL-CAPS letter-spaced eyebrow labels. Lift cards
with `--shadow-card`, radii 18px (hero 22-26px), padding 20-24px.

---

## Part 2 — Create-league wizard redesign
File: `app/create-league/CreateLeagueWizard.tsx`. Reference:
`references/Create League Wizard.dc.html` (open it; the step labels in the
progress bar jump between steps).

Internal step flow is unchanged (Name → Size → Season → Rules → Team → Invite →
Done; beta mode collapses to 4 displayed steps). Recreate each step in the
Inviting Dark palette. Onboarding-tier emoji are welcome here (per the policy):
a 💡 tip on the rules step, 🏒/⏪ on the season options, 🎉 on the success +
done steps — one per card, never in buttons. The **Rules/scoring step is the
centerpiece**:

### Rules step — "rule sheet"
Replace the emoji-prefixed `RuleRow` list with a single bordered card divided
into labeled sections (each section header is a **sentence-case** 13-14px label
in `--dim` — not a mono ALL-CAPS eyebrow):
- **Roster** — slot **pills** (`3 F`, `2 D`, `1 UTIL`, `1 G`, `6 Bench`): the
  count in mono accent, the position in `--text`; `--bg-raised` pill with a
  `--border`. Sub-line: "UTIL takes any skater (F or D)."
- **Scoring** — a real **two-column table** (Skaters / Goalies), not wrapping
  chips. Stat in `--text` on the left, value in **`--green` (tabular-nums)** right-aligned
  (`+2.0` Goal, `+1.5` Assist, `+0.5` Power-play pt · `+5.0` Win, `+3.0` Shutout).
  Rows separated by hairline `--border-soft` top borders.
- **Standings** — "Ranked by **Victory Points (VP)**" followed by the redesigned
  "?" popover (below).
- **Playoffs** — right-aligned value "Top 4 teams · single elimination · no byes".
- **Season** — dynamic "2026-27 live PWHL · N teams" or "2025-26 replay · N teams".

Below the sheet: an accent-tinted info callout ("Scoring, roster slots, and
playoff format can all be changed from the admin panel before the draft.").

### VP popover — the "?" tooltip fix  ⚠
**Current bug** (`components/VpExplainer.tsx`): the panel is `position:absolute`
with **no positioned ancestor** and a translucent `var(--surface)` background,
so it renders as a see-through box in a random spot. Rebuild it as a proper
anchored popover:
- Wrap the `?` button in a `span` with **`position:relative; display:inline-flex`**.
- The panel is the button's child, `position:absolute; top:calc(100% + 11px);
  left:50%; transform:translateX(-50%)`, `width:296px`, `z-index:50`.
- **Solid** background `var(--card-hover)` (#1c1f24) — never translucent — with
  `border:1px solid var(--border)`, `border-radius:12px`,
  `box-shadow:0 14px 40px rgba(0,0,0,.55)`, a small 11px rotated-square **arrow**
  at the top, and a `popIn` fade (0.14s).
- Content: title "How Victory Points work", then the four VP rules as
  label/value rows (value in mono accent: `+2 VP` win, `+1 VP` tie, `+2 VP`
  highest score, `+1 VP` second-highest), then a footnote tying FP → matchup
  result → VP. (Keep the existing copy.)
- The `?` button itself: 19px circle; default = transparent w/ `--dim` border;
  **when open** = filled `--accent` with `--accent-ink` glyph.
- Optional polish: close on outside-click / `Esc`.

This component is reused on several screens, so fixing it once propagates.

---

---

## Part 3 — flagship screen redesigns
The two highest-traffic, highest-complexity screens, recreated at full fidelity
in **Inviting Dark** with the **tiered emoji policy** applied. These are the
canonical "after" for the whole app: lifted cards + soft shadows, sentence-case
headings (no mono, no ALL-CAPS eyebrows), warmer copy, and tasteful emoji.
The same surface/accent/semantic/type decisions apply everywhere.

### League overview — `app/league/[leagueId]/page.tsx`
Reference: `references/League Overview.dc.html`. In-season state shown.
- **Two-column grid** (`.overview-grid`, 1fr / 360px, collapses < 880px). Left =
  primary modules, right = personal widgets.
- **Commissioner action strip** — gold (`--gold`) bar with a **📣** icon + label.
- **Playoff race** card — ranked rows; the playoff cut is a labeled "PLAYOFF
  CUT" divider; my row gets `--accent-dim` fill + 3px `--accent` left border.
  **Accessible glyph chips** (policy P0): `✓ Clinched` / `✓ In` = `--green`,
  `◉ Bubble` = `--gold`, `✗ Out` = `--red`, `N GB` = neutral. (Old code used
  `#5fa98c`/`#e3c989`/`#c2776c` and color-only chips — map to tokens AND add the
  glyph.)
- **League leaders** — two sentence-case columns ("Top scorers" `--green`,
  "Cold streak" `--red`), rank-1 marker in `--gold`.
- **My matchup widget** (right rail) — the ONE elevated card: warm gradient
  `linear-gradient(150deg,#1e2735,#191d25)` + `--accent-border` + soft glow, big
  Saira score, win-rate bar in accent, solid-accent CTA with `--accent-ink`
  text. (Old code used a violet gradient + `#7c3aed` button — key recolor.)
- **Lineup status** (`✓ Set` / `⚠ 1 issue` chips) + **Around the league** feed —
  each item leads with an emoji-in-a-tinted-tile (🏒 goal, ➕ add, 🔄 trade,
  🏆 clinch, 📋 waiver). (Restored per policy P2.)
- **Commissioner note** — `--accent-dim` banner, full width at the bottom.

### Team matchup — `app/team/[teamId]/matchup/page.tsx` (the 66KB centerpiece)
Reference: `references/Team Matchup.dc.html`. Active **DuelHero** (1v1 playoff)
state shown — the richest of the hero's variants (the file also has `FieldHero`
for regular-season VTF and several empty/championship states; recolor them the
same way).
- **All-set banner** — `--green` tint, friendly copy + `✓` check badge (status
  tier; warm "Good luck tonight!" microcopy).
- **DuelHero** — the signature element. Warm graphite gradient
  `linear-gradient(150deg,#1d2533,#191f2a,#151922)` + `--accent-border` + sky
  glow **and a faint warm-gold radial** bottom-right (replaces the violet
  `#1b1346` gradient). 3-column you / VS / opponent grid. **Score colors stay
  semantic**: winning `--green`, losing `--red`, tied white — keep the
  `getScoreColor` logic, swap hexes (`#34d399`→`--green`, `#f87171`→`--red`).
  My avatar = accent gradient w/ dark letter; opponent = neutral graphite.
  **Win-probability bar** in accent, sentence-case "Win probability" label.
  Gold **"Live now"** status pill. Warm footer microcopy.
- **Live situation grid** (`.matchup-2col`) — left: *Playing tonight* (games
  grouped, players with 3px `--accent-deep` left rule + projected pts) and *Swing
  players* (mine `--green` tint, opp `--red` tint); right: *Roster status* widget
  (big projected FP in accent, `✓ set` / `🔒 locked` status line, accent CTA).
- **Friendly explainer** — a 💡 onboarding callout welcomes new fantasy players
  (FP→VP in plain language). One per page (onboarding tier).
- **Recap card** — celebratory: gradient green→gold tint, **🏁** result badge,
  Saira score, top-performer line, **🏆 League-high score** in `--gold`.
- **Rosters** (`.matchup-2col`) — two `RosterTable`s. Columns Slot / Player /
  Left / FP. Slot pill `--accent-dim` + accent text (was `rgba(91,33,182,0.6)`).
  Stat-breakdown chips `--green` tint. "Left" cell shows **🔒** for locked
  players (the one allowed table emoji, paired with the games value). Bench rows
  dimmed (opacity ~0.6).

> Both screens depend on `VpExplainer` and `LogoShield`; fixing those once (see
> §VP popover) propagates here.

## State management (wizard)
Unchanged from current implementation. Reference DC mirrors it: `step` (1–7),
`name`, `teamName`, `maxTeams` (6/8/10/12), `isReplay`, `draftDate`, `isPublic`,
plus a `vpOpen` boolean for the popover. The real component also keeps
`loading`, `error`, `createdLeagueId`, `createdTeamId` and the beta-mode step
remapping (`getDisplayStep`/`getDisplayTotal`) — preserve all of that.

## Interactions & behavior
- Progress bar: 6 filled segments; segment `i` fills with `--accent` when
  `i < displayStep`. Step labels are clickable nav in the reference (optional in
  prod).
- Inputs: focus ring `border-color:var(--accent)` + `box-shadow:0 0 0 3px
  var(--accent-dim)`.
- Size/season options: selected = `--accent` border + `--accent-dim` fill +
  accent label; radio dot fills accent.
- Public toggle: 38×22 track, `--accent` when on, white knob translates 16px.
- Buttons: primary = `--accent` fill + `--accent-ink` text; secondary =
  transparent + `--border` + `--muted` text.

## Design tokens
See `globals.tokens.css` (full set) and the quick-reference table above.
Radii: inputs/pills 8–12px, cards 14–16px, popover 12px. Shadows: popover
`0 14px 40px rgba(0,0,0,.55)`.

## Assets
None new. Keep `components/LogoShield.tsx`. For any icons introduced during
emoji removal, adopt a standard React icon set (lucide/heroicons) — not emoji,
not hand-drawn SVG.

## Files in this bundle
- `globals.tokens.css` — drop-in `:root` + follow-up edits
- `color-replacement-map.md` — inline-hex find/replace sweep
- `emoji-policy.md` — tiered emoji cheat-sheet (+ `emoji-policy-source.md`, the source)
- `page-inventory.md` — every route/component + per-screen notes
- `references/Create League Wizard.dc.html` — hi-fi wizard + VP popover
- `references/League Overview.dc.html` — hi-fi league overview (in-season)
- `references/Team Matchup.dc.html` — hi-fi team matchup (active playoff)
- `references/Color Scheme Options.dc.html` — chosen base + alternatives
- `screenshots/` — flat PNG previews of the references

## Suggested order of work
1. `globals.tokens.css` swap + 3 follow-up edits → most of the app reskins.
2. Inline-hex sweep (`color-replacement-map.md`); verify button/badge contrast.
3. Apply the tiered emoji policy (`emoji-policy.md`) — restore the glyph chips,
   activity icons, recap/celebration emoji, and the lock.
4. Rebuild `CreateLeagueWizard.tsx` + fix `VpExplainer.tsx`.
5. Rebuild the two flagship screens from their references (league overview,
   team matchup) + the wizard/popover, then walk `page-inventory.md` top to
   bottom recoloring the remaining [recolor] screens.


---

# Part 5 — Emotional design principles

## PWHL GM should feel

- Competitive
- Welcoming
- Premium
- Seasonal
- Social

## Avoid feeling

- Enterprise SaaS
- Hockey analytics software
- Generic admin dashboard
- Mobile banking app

## Signature moments

Gold (`--gold`) is intentionally reserved for prestige moments:

- 🏆 League Champion
- 🔥 Hot streaks
- ⭐ Weekly High Score
- ✅ Clinched Playoffs
- 👑 First Place

Do not use gold for routine actions or navigation.

## Empty states

### No trades this week

📭 Quiet week.

Nobody's shopping players right now.

### Draft queue empty

📝 Build your wishlist before draft night.

### Lineup locked

✅ You're all set.

Sit back and let your stars cook.

## Matchup excitement layer

Add lightweight competitive indicators:

- ▲ +4.3 projected
- 🔥 3 players still skating
- ⚡ 18% chance to steal the win

## Wizard summary card

Your league at a glance

🏒 8 Teams

📅 20 Weeks

🎯 Head‑to‑Head Points

💰 Weekly Waivers

This should take about 2 minutes.


---

# Part 6 — Brand Naming

Current theme name: Inviting Dark

Recommended theme name: **Northern Ice**

Rationale:
Conveys hockey atmosphere, premium quality, and year‑round usability.

Alternative names:
- Arena Lights
- Championship Night
- Frozen Gold

# Part 7 — Competitive Moments

## Momentum Strip

Placement:
- Under matchup score header
- Hidden before games begin
- Collapses when matchup is complete

Example:

🔥 Momentum

+12.4 pts since yesterday

3 players remaining

Opponent finished

# Part 8 — Prestige Gradient

```css
--prestige-gradient:
linear-gradient(
135deg,
rgba(212,175,55,.16),
rgba(255,255,255,0)
);
```

Allowed uses:
- Champion cards
- Clinched playoff banners
- Weekly recap hero
- Commissioner announcements

Never use on:
- Buttons
- Navigation
- Standard roster rows
- Settings screens
