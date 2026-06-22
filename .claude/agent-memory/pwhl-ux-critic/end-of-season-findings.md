---
name: end-of-season-findings
description: Late-season UX gaps — eliminated/non-qualifying team dead states, champion discoverability, renewal-creates-new-league confusion, commissioner playoff dead ends
metadata:
  type: project
---

End-of-season experience (playoffs, championship, renewal) reviewed 2026-06-22 from eliminated-owner, champion, and commissioner personas.

**Why:** These are the lowest-traffic-but-highest-emotion surfaces; casual PWHL fans churn if their season ends in a broken-looking dead state or if they silently lose track of a renewed league.

**How to apply:** When reviewing playoff/renewal flows, check these known gaps first before re-discovering them.

## Blockers
- **Non-qualifying team sees "Season hasn't started yet" during playoffs.** In `lib/services/dashboard.ts` (~line 598), a team that never made the playoffs has no playoff `Matchup` row, so `myMatchup` AND `lastPlayoffMatchup` are both null → returns bare `empty`. On `/team/[teamId]/matchup` this falls through every branch (no activeMatchup/eliminationInfo/championInfo because playoffStatus is still IN_PROGRESS/playoffPending) to the final fallback copy "Season hasn't started yet." Flatly wrong; reads as broken. `eliminationInfo` ONLY fires for teams eliminated *inside* the bracket, not teams that missed the cut. Needs a dedicated missed-playoffs spectator state.
- **Renewal silently creates a BRAND-NEW league at a new URL with zero notifications.** `renewLeague` (`lib/services/renewal-service.ts` line 44) creates a new FantasyLeague row + new ID. The renew route only redirects; no `createNotification` to returning managers (confirmed absent in notification-service). `RenewLeagueForm` copy under-warns ("Managers will need to re-join" is skimmable). A `CHAMPIONSHIP_WON` event type exists per CLAUDE.md but no notification call site found.

## Friction
- **Champion moment is good on the champion's own matchup page** (gold gradient card, 🏆, score line — matchup lines 107–159) **but invisible elsewhere.** No notification on win; dashboard/league-overview champion banners are generic (same tone for winner and last-place). Casual user can miss their own title.
- **Eliminated card is a dead end** — small "You were eliminated... great run" card with no nudge to spectate the live final.
- **Bracket page loses the great regular-season scaffolding.** Regular-season race banner ("X teams qualify · N weeks remaining · Playoff line") is excellent; the moment playoffs start it becomes a bare grid with no stakes framing, no "this week for the title," no eliminated-viewer highlight.
- **Admin setup checklist stops at "Season started."** No guidance for Season complete→Start playoffs, or Playoffs→Advance round. Admin page has a comment admitting playoff controls "live on" bracket/sim pages, not admin. Commissioner dead end mid-lifecycle.
- **playoffPending is one-directional.** Players between rounds are told "waiting on the commissioner to advance," but the commissioner gets no "round complete — advance now" prompt in admin. Stall risk.

See related: [[onboarding-findings]] (the front-half checklist is good; the back half abandons the commissioner), [[wins-keep]] (race banner is a pattern to preserve).
