 ---
  PWHL GM UX Audit — homoveralls, Week 7 replay

  ---
  PASS 1: BRUTAL DESIGN CRITIC

  Persona: Obsessed with fantasy sports. Follows PWHL religiously. Has used ESPN, Yahoo, Sleeper, Underdog. Wants women's hockey to win.

  ---
  The brand betrays the sport

  The PWHL is vivid, loud, and distinctly Canadian-American women's hockey. The app is a generic dark-mode SaaS dashboard. Every design decision screams "fantasy football
  lite" in a midnight-blue void. The purple shield logo looks like a Discord knockoff. The color palette is almost entirely near-black (#0a0b14 range) with a single purple
  accent. There are no traces of ice, no warmth, no team identity, no PWHL visual language.

  This is a fantasy app built about PWHL players but not for PWHL fans.

  The matchup hero is doing five jobs and failing all of them

  The DuelHero renders: team initials in circles (H vs T), two "NO GAMES YET" chips, two "—" score dashes, a win probability bar, a "+10.2 EDGE" projection chip, a "66% /
  34%" split — all inside a card that's maybe 120px tall. At thumbnail scale (which is how most people first perceive a page before reading) it reads as noise. A Fantasy
  Football playoff score header in ESPN takes 40% of viewport height. This one takes maybe 8%.

  The "34%" sits in the corner with no label. Is that my win probability? My opponent's? A stat I'm supposed to care about? The "PROJECTED · +10.2 EDGE" chip is a design
  afterthought — tiny muted text — when that information is the most valuable thing on this page right now.

  "NO GAMES YET" appears twice in the hero

  The left card says it. The right card says it. If both teams are in the same week with no games played yet, one instance is sufficient. The repetition makes it feel like
  a placeholder bug, not intentional design.

  The Season Series section renders twice

  Below the hero, there's "Your rival this week — Test Team aszc — SEASON SERIES — 1–0" immediately followed by "SEASON SERIES VS TEST TEAM ASZC — 1–0 — W Dec 5 24.7 –
  16.75". The same heading structure and data appear twice in sequence with no differentiation. Looks broken.

  Scoreboard rows have unlabeled columns

  The active roster table on the matchup page shows "SLOT / PLAYER / LEFT / FPTS" headers — fine in isolation, but "LEFT" is cryptic (games remaining) and at the default
  matchup view with "—" everywhere it communicates nothing. There's no tooltip, no inline explainer.

  The activity feed timestamps are broken in replay mode

  The activity section shows "-243731m ago" — a negative number. In real time those events happened in the past; in replay mode, they happened in the "future" relative to
  the simulated date, so the relative timestamp flips. Users see "-243731m ago" and either think the app is broken or ignore the feed entirely. The feed is a prime
  engagement surface — this is a credibility killer.

  The section label treatment is generic and inconsistent

  "PLAYING TONIGHT", "ROSTER STATUS", "LEAGUE LEADERS · WEEK 7", "UNDERPERFORMING" — all-caps micro-labels in muted gray. They look identical in visual weight to each
  other. There's no hierarchy signal between a primary section ("My Lineup") and an informational sidebar ("League Leaders"). Everything competes with everything.

  The page is way too long

  The matchup page at full desktop is comfortably 3,000px+ of content. On mobile it's probably 5,000px. The information architecture treats this as a single infinite
  scroll rather than a set of decisions the user needs to make. Highest priority on this page: Am I winning? Do I need to change my lineup? Both answers are buried below
  the fold. The "Adjust lineup →" CTA appears deep in a "Roster Status" widget that itself requires scrolling to reach.

  The "Feedback" button is fixed and floating — but why is it the only thing with a color?

  The orange "Feedback" tab fixed on the right edge is the most visually prominent interactive element on the entire page. It's louder than any action button, louder than
  the score. This is a dev/beta artifact that should be invisible or collapsed in the corner.

  The trade propose page is an unsorted brick wall of 80 names

  The "WANT FROM LEAGUE" panel dumps every rostered player across all teams in a vertical list, sorted by FP descending, with no team grouping, no position filter, no
  pagination. "Search by player name or team name" appears as a hint... at the bottom of the wall, after all the buttons. The primary affordance (search) is below the fold
  of the primary content (player list). A first-time user will scroll through 80 player buttons before discovering they can filter.

  More critically: there's no "Select a team to trade with" step. Every other fantasy platform makes you pick your trading partner first, then see their roster and yours.
  This UI shows you all players from all teams simultaneously, which makes it impossible to reason about what a single opponent would accept. It's transactionally correct
  but experientially nonsensical.

  PASS 2: END-USER CONFUSION LOG

  Persona: Played Yahoo fantasy football for 5 seasons. Loves PWHL, watched the championship game. This is her first time using PWHL GM.

  ---
  Opening the matchup page

  "Where am I?"
  I land on a page called "homoveralls" with a tab that says "Matchup." There's a card at the top that says "NO GAMES YET" twice. I don't know if that means my players
  haven't played yet or if something went wrong.

  "What does '66%' mean?"
  There's a bar that says "66%" on the left and "34%" on the right. I assume the bigger number is better for me, but I'm not sure. I look for a label. There isn't one near
  the number. I find "PROJECTED · +10.2 EDGE" in small text. So I'm projected to win by 10.2 points... but what does that EDGE mean? 10.2 FP? Points lead? No explainer.

  "'7 starters active this period' — so I'm good?"
  There's a line below the probability bar that says "7 starters active this period." Does that mean 7 out of how many? I thought I had 13 players? Am I supposed to have
  more starters? I don't know my roster size. I click "View schedule" to find out what games are being played — that takes me somewhere else.

  "What's the Rival badge doing here?"
  Scrolling down, I see a flame emoji and "Your rival this week" showing Test Team aszc. But I thought I was playing Test Team d3dg this week (I saw that in the hero). So
  who am I actually playing? Now I see two different opponents referenced on one page. (The rival is the closest match in the season; the current opponent is a different
  team — but there's zero explanation of this distinction.)

  "What happened last week?"
  There's a "LOST · WK 6" recap card that says "29.3 pts — #8 of 8 this week." So I was last place? That's demoralizing, but at least I understand it. The "⭐ Marie-Philip
  Poulin led with 10.0 pts" is a nice touch. The "⚡ Closest:" and "🏆 League high:" lines are useful context.

  "The activity feed says '-243731m ago' — is the app broken?"
  I look at the activity feed and see timestamps like "-243731m ago." I don't know what that means. My assumption: the app has a bug. I lose trust in the data quality of
  everything else on the page.

  ---
  Attempting to propose a trade

  I click the "Trades" tab in the nav bar. It takes me from /team/homoveralls-iyhl/ to /league/my-pwhl-leag-ryq6/trades. The header of the page changes from team-scoped to
  league-scoped. I notice "My Franchise →" appears as a button I'd need to click to get back. I didn't realize I left my team's context.

  On the league trades page, I look for a "Propose Trade" button. I can find it and click through to the Propose Trade page.

  "Wait — who am I trading with?"
  The page shows "HOMOVERALLS GIVES" on the left and "WANT FROM LEAGUE" on the right. There's no step that says "pick a team." I scroll the right column and see players
  from every team mixed together. I want to trade with the team in first place — but I can't filter by team to see just their players without typing a search term. The
  instruction that says "Search by player name or team name" is hidden below the fold of the player list.

  I click on a player on the right (let's say Taylor Heise from Test Team gfek). Nothing visually confirms the selection — no highlight, no confirmation banner, no "You've
  selected: Taylor Heise." I now have no idea if my click did anything. (In the screenshot, clicking a button makes it "selected" but the Playwright capture didn't show
  post-click state, and from the text output no visual selection feedback was evident in the DOM inspection.)

  "Who does this trade go to?"
  I add a player from my side and a player from "the league" side. Who receives this proposal? If the receiving team is determined by who owns the player, a user trading
  one player from Team A and one from Team B is proposing two separate trades — or is it rejected? There's no explainer. I press "Send Trade Proposal" nervously.

  ---
  Attempting to add a free agent from Analysis

  I click "Analysis" in the team nav.

  Nothing happens. The URL stays at /team/homoveralls-iyhl/matchup. The page doesn't change. I click it again. Still nothing. I assume "Analysis" is broken or maybe it's a
  premium feature that's disabled. I never reach the Analysis page. (Confirmed bug: the Playwright script showed [URL] http://localhost:3000/team/homoveralls-iyhl/matchup
  after clicking the Analysis link.)

  I go to "Rosters" in the nav instead, hoping to find free agents. The page loads but shows "Loading roster…" briefly and then renders (too slowly for a test capture).
  When it loads, I look for free agents and an Add button — but the initial view shows my current roster, sorted by FP. I need to scroll down to find the FA panel.

  Key confusion: there's no "Free Agents" or "Waiver Wire" nav item. I find it hidden in the Roster page after scrolling. In every other fantasy platform I've used (Yahoo,
  ESPN), "Free Agents" or "Add/Drop" is a top-level nav item, not buried inside "Rosters."

  ---
  Summary: Top 8 issues to fix

  ┌──────────┬─────────────────────────────────────────────────────────────────────────────────────────┬──────────────┐
  │ Priority │                                          Issue                                          │    Where     │
  ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
  │ P0       │ Negative timestamps in activity feed (-243731m ago)                                     │ All pages    │
  ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
  │ P0       │ Analysis tab broken — click doesn't navigate                                            │ Team nav     │
  ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
  │ P1       │ Trade propose: no team-first selection — search hint is below 80 player buttons         │ /trades/new  │
  ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
  │ P1       │ "SEASON SERIES" renders twice in rivalry section                                        │ Matchup page │
  ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
  │ P1       │ "WANT FROM LEAGUE" has no trading partner context — ambiguous who receives the proposal │ /trades/new  │
  ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
  │ P2       │ "NO GAMES YET" duplicated in both hero panels                                           │ MatchupHero  │
  ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
  │ P2       │ "Free Agents" has no top-level nav entry — buried in Rosters                            │ Team nav     │
  ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
  │ P2       │ Win probability number has no label — "34%" floats unlabeled                            │ DuelHero     │
  └──────────┴─────────────────────────────────────────────────────────────────────────────────────────┴──────────────┘