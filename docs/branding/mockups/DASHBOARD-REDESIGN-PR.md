# PR: Redesign `/dashboard` (My Leagues) — proof of concept

**Branch suggestion:** `redesign/dashboard-my-leagues`
**File touched:** `app/dashboard/page.tsx` (presentation only)

## What changed
A visual redesign of the My Leagues / Your Franchises hub. **All server logic is untouched** — same Prisma queries, `getMatchupQuickSummary` / `getTeamTopPerformers` calls, the full `actions` derivation, auth, replay-time, and notification checks are byte-for-byte the same. Only the rendered JSX (and two presentational helpers + the status chip) changed.

### Franchise cards
- **Uniform structure** across every card: crest avatar + name + status pill → score block → top-performers row → actions. Cards are flex columns with **actions pinned to the bottom** (`margin-top:auto`), so they line up regardless of content. Fixes the ragged, half-empty cards.
- New **crest avatar** (2-letter monogram from the team name), gradient-tinted purple for in-season teams, neutral for the rest.
- Richer **score block**: large Saira-Condensed score, `vs field` record colored by result (win green / loss soft-red / neutral), and a win-rate bar. Reuses the same `summary` fields as before.
- Status pill moved to the top-right of the card head.

### On-brand cleanup
- Dropped all **emoji** (🏆 🎯 ⚡ 🔥) from action labels and the performers row — replaced with SVG icon + design-system styling.
- Eyebrow recolored from the legacy neon **green** (`--green`) to brand **violet** (`#a78bfa`).
- Records now use the brand's softer green/red (`#5fa98c` / `#d18b7f`) instead of `#34d399` / `#f87171`.
- Status chip greens aligned to the brand palette (`#7fc2a6`).
- Uses existing design tokens (`--card`, `--border`, `--accent-dim`, `--faint`, `--dim`) and utility classes (`.alert-amber`, `.section-accent`, `.font-stats`, `.team-card`, `.button-primary/secondary`) already in `globals.css` — no new CSS required.

### Header
- Added a summary line under the greeting (`N franchises · X in season · Y complete`).
- Action-needed panel restyled with the shared `.alert-amber` class, dot markers, per-item league tag, and an "Open →" affordance; each row is a single `Link`.

## Not in this PR (suggested follow-ups)
- The global top-nav (`app/layout.tsx`) still renders the plain text links. The mockup shows a user avatar pill next to the name — small change, left out to keep this PR scoped to the page.
- Same card treatment could roll into `/leagues`.
- No data-layer or API changes; no migrations.

## Risk / testing
- Server component, no client JS added. TypeScript types unchanged (`MatchupQuickSummary` etc.).
- Verify the three states render: in-season team with scores, completed team, and a team with no summary ("No matchup scheduled yet").
- Verify commissioner (non-owned) cards show the "Commish" badge + View League / Admin Panel actions.

The matching design artifact lives in `My Leagues.dc.html` in the design project for visual reference.
