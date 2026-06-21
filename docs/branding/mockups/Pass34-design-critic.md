 # Pass 3 — Design Critic (Active Season, Franchise Manager)

  ## Dashboard

  "0-7" record on the team card is the most prominent number a struggling manager sees. The VTF weekly record appears in bold red at the same visual weight as the score itself. A manager who scored 5th out of 8 this week didn't "go 0-7" in any intuitive sense — but that's what the card says. It looks like an 0-7 season record to anyone unfamiliar with Victory Points. There's no label differentiating "this week vs the field" from a cumulative win-loss.

  "vs field" has no explanation. It appears as a secondary label beneath the score with no tooltip, no first-time callout, no link to learn more. It's the fundamental mechanic of the entire scoring system and it's treated like ambient data.

  ## Matchup Hero

  "3–2" next to the team name reads as a hockey score. homoveralls 3–2 floating left in the hero card — no "W-L" label, no "record" caption. A PWHL fan sees this and thinks it's a period score. It's actually the season fantasy record (3 wins, 2 losses in VP terms), but nothing signals that.

  "PROJECTED: +8.3 EDGE" is jargon. "Edge" is not a standard fantasy sports term. The projected FP lead is clear from the win probability bar, but the label adds nothing while raising the question "edge over what? by whose calculation?" Replace with "+8.3 FP lead" or "Leading by 8.3 projected points."

  "NO GAMES YET" badge is a dead end with no explanation. It floats top-right in the hero card with no context for what "games" means — PWHL games scheduled this week? It could just as easily mean "your players have no games scheduled" (a different and actionable problem) vs. "games haven't started yet today" (a timing issue). The
  distinction matters and neither is explained.

  Playing Tonight: "G · G" and "F · UTIL" are visual stutters. The slot position badge and the player position tag appear side by side with the same size and similar formatting. Aerin Frankel G · G BOS — two G's next to each other with only a dot separator. At a glance it reads as a typo. The player position and the roster slot should be visually differentiated (e.g., slot in badge, position in plain text).

  Game times are not localized. "12:00 PM EST," "2:00 PM EST," "3:00 PM EST" — hardcoded to Eastern time. A user in Vancouver or London has to do mental math. This is a small failure but a daily friction point.

  ## Lineup Page

  "PROJ / PPG / GP" stats on player cards are unlabeled in the UI. Every player card shows three numbers in a row — no header, no tooltip, no expansion. A first-time user sees 10.8 / 5.4 / x2 and can guess "Projected" from context and maybe "Games Played" but "PPG" (points per game) and "x2" (games this week, rendered as a multiplier) are opaque. The "x" multiplier notation is actually clever design but it's not self-documenting.

  "Starters projected: 43.3 pts" appears at the very bottom of the active column. This summary number is the most actionable output of the projection system — does my lineup look competitive this week? — but it's below the fold after scrolling past 7 player cards. It should anchor the top of the section.

  Auto-set and Save Lineup button hierarchy is inverted. "Auto-set" is the large purple primary button. "Save Lineup" is the smaller dark secondary. But "Save Lineup" is the action that actually commits changes — Auto-set just populates a suggestion. Primary visual weight should be on the action that moves data, not the suggestion.

  ## Roster / Free Agents

  Stat column headers (GP, G, A, PTS, PPP, SOG, HIT, BLK, FPTS) have no tooltips. The roster table is the densest data surface in the app. Eight stat columns, none labeled on hover. A hockey newcomer sees "PPP" and has no mental model for what power play points are or why they matter for fantasy scoring.

  FPTS is the rightmost column but the most important one. The natural reading direction (left to right) leads through six hockey stats before reaching the fantasy point total — the actual reason this player is on or off the roster. A first-time player will scan left-to-right and stop at PTS (points) thinking that's the relevant column,
  not FPTS. Column order should prioritize fantasy-relevant data.

  The "WK" column in the Free Agents list has no column header. Purple numbered circles (1, 2, 3) appear to show games remaining this week but there's no "WK" header or tooltip. The circles are visually distinctive but unlabeled — a user has to infer their meaning from context.

  "On Waivers" / "Claim" vs "Add" distinction is unexplained. Some players show "On Waivers" with a "Claim" button; others show "Add." There's no inline explanation of what waivers are, what claiming means, or why one mechanic exists alongside the other. This is the most confusing interaction in the entire app.

  ## Standings

  Eight-column standings table is a wall of abbreviated jargon. VP / W-L-T / MTCH VP / RNK VP / PF / STREAK / GAP. The micro-label "Win matchup +2 VP · 1st place weekly score +2 VP · 2nd place score +1 VP" is correct but it's a single compressed line in tiny gray text. It doesn't connect "MTCH VP" and "RNK VP" to those specific scoring events. A new user can't map the columns to the rules without external explanation.

  "2.0 games clear of the bubble" uses basketball idiom. "Games back" terminology is from baseball and basketball standings. "The bubble" is March Madness vocabulary. Combined they mean nothing to someone who hasn't consumed sports media heavily. The personalized banner is great — the phrasing is insider jargon. Better: "You're 3rd —
  2 VP ahead of the cutoff. Top 4 make playoffs."

  ## Season Tab

  "0-0-7" for the current live week is the strangest display in the app. At the start of a week before any games are played, every team has 0 FP, so all VTF match-ups are "tied." The W-L-T display renders this as 0–0–7 — zero wins, zero losses, seven ties. It looks like a nonsensical standoff. First-time users will stare at this and assume it's a bug.

  ## Analysis Tab

  "vs Median" numbers have no unit label. The Position Groups table shows "+6.3" for Goalie vs median and "-2.7" for Forwards. Six-point-three what? FP this week? FP per game? Season total relative to average? The number is actionable information stripped of context.

  Negative FP values in the Player Trends table get no explanation. Jocelyne Larocque shows -3.5 in Week 2. Can you score negative fantasy points? (Yes — some categories score negative, and VTF weekly records can show differential.) But nothing in the UI flags this as intentional or explains it.

  ## Systemic: Personality vs. Premium

  The app is styled like a Bloomberg terminal, not a sports fan experience. Dark navy, condensed stats fonts, abbreviation-heavy tables, no illustrations or photography, no celebration of good plays. The "Think Like a GM" positioning promises a premium decision-making experience — and the data is there — but the execution is cold. There's no joy when you win, no commiseration when you lose, no personality in the empty states. The design signals expertise as the default, leaving new users feeling like they walked into the wrong room.

  The "Rival" feature is the app's most emotionally resonant moment — and it's buried in a collapsed accordion. A personal rival you're 1-0 against this season is exciting! It should be teased in the matchup hero ("🔥 You're 1-0 vs your rival this week") not hidden behind a collapsed panel at the bottom of the page that looks like
  an optional footnote.

  ---
  # Pass 4 — End-User Click-Through (Fantasy Newcomer / Hockey Curious)

  Persona: I watch PWHL games sometimes. I know who Marie-Philip Poulin is. I've never played fantasy sports. My friend told me to join this league.

  1. "Work the wire" on the landing page means nothing to me.
  "Build rosters, set lineups, work the wire" — I don't know what "the wire" is. I figure out from context that "roster" and "lineup" are similar things, but wire? I'll assume it's a sports phrase and move on. I later discover it's the waiver wire, a player pickup mechanism — but I had no preparation for it.

  2. The dashboard shows me "0-7" and I think I'm 0-and-7 for the season.
  I see my team card. Big red "0-7." I feel immediate discouragement. Did I lose seven games? I only expected one opponent this week. I click through to figure out what this means and eventually learn it means I scored lower than all 7 other teams that week. It's a VTF record. But the card never explains this — I just feel bad and
  confused simultaneously.

  3. "3-2" next to my team name looks like a period score.
  On the matchup page, homoveralls 3-2 floats at the left of the hero. As a PWHL fan I immediately parse this as a hockey score. It takes me a moment to realize it's my fantasy record — and even then I'm not sure what the "2" represents. Two losses? Two something else?

  4. "0-0 season series" suggests we've never played — but we're playing RIGHT NOW.
  "Season series" sounds like a playoff term to me. We're playing each other this week but the series says 0-0. Does that mean this week doesn't count toward the series? Or we just haven't played yet? It resolves into "we've played each other 0 times before this week" but the display order (shown before the match happens) creates a false "nothing has happened" signal.

  5. I don't know what PROJ, PPG, or x2 mean on player cards.
  On the lineup page I see numbers below each player's name: 10.8 / 5.4 / x2. I know 10.8 is probably their projected score. But "5.4"? Per game average? And "x2" — times two? Times two of what? I eventually piece it together (PPG = points per game average, x2 = two games this week) but I'm working backward from the numbers rather than forward from a label.

  6. I have no idea what "VP" means or why my team has 8 of them. On the standings page I see a VP column. It's the primary ranking metric. The subheader explains it but I've already started reading the table and the subheader is above it in small gray text I skipped. I see "Test Team aszc · 9 VP" and "homoveralls · 8 VP" and know I'm behind, but the system of how VP accumulates is completely opaque. I earned 8 VP over 5 weeks — how? Which weeks were good? The standings table doesn't tell me that.

  7. "MTCH VP" and "RNK VP" are two columns that look almost the same.
  Both labeled in all-caps abbreviations, both showing numbers in a similar range. I can see MTCH VP for homoveralls is "6" and RNK VP is "2" — but I don't understand that one comes from winning my weekly matchup and the other from where I ranked in total FP across the league. They're both named "VP" with a different prefix and I can't distinguish them without reading the scoring rules buried in the header.

  8. The "Playoffs" page says "Regular Season" and I think I clicked the wrong thing.
  I click "Playoffs" in the nav and the page loads with "Playoffs" as the H1 — and then "Regular Season" right next to it as a badge. For a solid 3-4 seconds I re-read both words trying to figure out if I'm on a playoffs page or a regular season page. It's a regular season seeding table leading to playoffs, but nothing in that first moment communicates that distinction.

  9. Waiver Wire vs Free Agents — I have no idea what the difference is.
  I go to my roster. I see the "Waiver Wire" tab next to "Free Agents." I click Free Agents first and see "Kateřina Mrázová · On Waivers · Claim." She's in the Free Agents
  tab but she's also "On Waivers"? I click Add on a different player and get "Roster full — select a player to drop." Fine, but for the waiver-wire player it says "Claim"
  not "Add." Are these different? Does "Claim" mean something will happen later vs immediately? I genuinely cannot figure this out from the UI.

  10. I can't tell what any of the stats in the roster table mean.
  GP. G. A. PTS. PPP. SOG. HIT. BLK. FPTS. I know G is goals and PTS is points. But PPP? SOG? HIT? BLK? These are standard hockey abbreviations a real fan knows
  immediately — Power Play Points, Shots on Goal, Hits, Blocks. But I'm a casual PWHL watcher, not a stats reader. And FPTS is not a hockey abbreviation at all — it's the
  app's own abbreviation for Fantasy Points. None of these have tooltips.

  11. The week that hasn't started yet shows me "0-0-7" and I think it's broken.
  On the Season page, Week 6 (current) shows 0–0–7. Zero wins, zero losses, seven ties. I stare at this. Did I tie all seven opponents? Is there a bug? It eventually
  clicks that no games have been played yet so everyone's at 0 points and technically "tied" — but this is a deeply unintuitive display for a state that should just say
  "In progress" or "No games yet."

  12. I can't find where to start a trade.
  I go to "Trades" from the team nav — it takes me to the Trade Center. I see "Incoming" tab, "Sent" tab, "League History" tab. "No incoming trade offers." But I want to
  SEND a trade. I don't see a button. (Note: there IS a "+ Propose Trade" button visible in the top-right of the Trade Center when accessed from the league nav — but from
  the team nav the Trades tab took me there and I may have missed it. The button placement varies by which nav path you took.)

  14. I won last week's rival matchup but nothing celebrated it.
  The activity feed says "Aerin Frankel dropped 13.6 pts for homoveralls this week" (a player underperformed). It also notes the rival match was won. But I never saw a
  moment of celebration. No notification, no card, no badge. My rival game result was buried in a collapsed accordion that I had to specifically click to expand. Winning
  your rivalry matchup is a high-emotion moment and the app renders it as a footnote.

  ---
  The "Too Buttoned Up" Verdict

  Yes — and in two distinct ways.

  The first is vocabulary: the app speaks fluent fantasy sports and fluent hockey stats simultaneously, and never translates either. VP, FPTS, PPP, SOG, VTF, waivers,
  claims, the wire — each of these is a vocabulary item a new user has to acquire on their own. Combined they create a steep first-hour cliff.

  The second is emotional register: the app is designed for the decision, not the feeling. It tells you your win probability (60%) but not that you should be excited about
  it. It shows you your rival matchup result buried in an accordion. It displays a "0-7" week record prominently with no context or comfort. The landing page tells me to
  "Think Like a GM" — a GM is a serious, analytical figure. But the people who'll enjoy PWHL GM the most are fans who want to feel connected to the sport they love, not
  executives running a spreadsheet. The design needs more warmth, more celebration of good moments, and at least one first-time experience layer that holds a new user's
  hand through the vocabulary.  