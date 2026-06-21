# PR: Extend matchup-hero redesign to regular-season view (`FieldHero`)

**Branch suggestion:** `redesign/matchup-field-hero`
**File touched:** `app/team/[teamId]/matchup/page.tsx` (presentation only)

## Context
The matchup page renders one of two heroes:
- **`DuelHero`** (1v1 / playoffs) — already carries the full redesign (crest avatars, YOU/OPP badges, records + series, 72px scores, leading-scorer chip, win-prob bar, footer CTA). **Unchanged.**
- **`FieldHero`** (regular-season, vs-the-field — the common case) — was still the older, plainer layout. **This PR brings it up to parity.**

## What changed (`FieldHero` only)
- **Identity header** matching DuelHero: 52px crest avatar + team name + `YOU` badge, with the weekly field record (colored) and `#rank of N this week` as the subtitle — replaces the small "You" eyebrow.
- **Leading-scorer chip** (active state): position badge + last name + points, same component as DuelHero.
- **Score states aligned with DuelHero:** setup → "—", upcoming → projected FP, active → points earned (upcoming now shows a real projection instead of a dash).
- **Kept the field standings list** (the VTF-specific value) under a "Weekly standings" microlabel.
- **Footer CTA** matching DuelHero: starters-active / set-lineup line + "View schedule", plus a primary "Set lineup →" when the week hasn't started. Removed the old inline amber "Set lineup →" button.
- Threaded **`leagueId`** into `FieldHero` (was only on `DuelHero`) so the footer can link to the schedule. Updated the one call site in `MatchupHero`.

The wrapper (gradient card, ambient glow, top bar, `LiveScoreRefresh`) was already shared and is untouched.

## Not changed / no logic touched
- No data fetching, services, or types changed — same `ActiveMatchup`, `weeklyStandings`, `myRecord`, `myPlayers`.
- `DuelHero`, `RosterTable`, and the rest of the page are untouched.

## Follow-ups (out of scope, optional)
- A few emoji remain elsewhere on this page (champion card 🏆, weekly-recap ⭐/⚡/🏆). Easy to swap for SVG/clean styling in a separate pass to match the dashboard PR.

## Testing
- Server component, no client JS added. Verify the three `FieldHero` states: active (scores + standings + leading scorer + footer count), upcoming (projected FP + "Set lineup" CTA), setup ("No games yet").
