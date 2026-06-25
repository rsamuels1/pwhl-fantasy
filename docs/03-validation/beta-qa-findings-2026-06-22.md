# Agent Test Run — 2026-06-22

## Run config

- **Agents:** 4 (pre-login critic, my-franchise critic, core-flows critic, playoffs/renewal critic)
- **Method:** Code-reading UX critique (agents read source files and evaluate as naïve users)
- **Personas:** podcast-curious PWHL fan (pre-login), Toronto new-to-fantasy fan (matchup page), Minnesota Yahoo-football veteran (core flows), Ottawa fan who missed playoffs + champion + commissioner (end-of-season)
- **Season:** 2025-26 fixture (replay mode)
- **Completed phases per spec:** 1 (League join), 2 (Draft), 3 (Pre-season lineup), 4 (Week 1 scores), 5–8 (Playoffs through renewal) — all evaluated via code reading
- **Additional scope:** Pre-login pages, LEAGUES page value, My Franchise information density

---

## Critical findings — Blockers

### [Pre-login] [Agent 1] — The LEAGUES page is an internal debug list, not a consumer destination

**What I was doing:** Clicking "Leagues" in the top nav as a curious visitor who just heard about PWHL GM on a podcast.

**What confused me / What's wrong:** This page lists the 50 most-recently-updated leagues on the entire platform — everyone's private leagues — as clickable cards. Each card shows raw database enums: "PRE DRAFT," "IN SEASON," "Playoffs: NOT STARTED," and a timestamp. The page admits in its own subcopy: *"League privacy is minimal for this prototype."* That sentence should never ship to a real user. As a newcomer I have no idea what any of this means, why I'd want to click a stranger's half-set-up league, or what happens if I do — which is a redirect to `/login`, a hard dead end. Clicking the primary nav item on the homepage goes nowhere useful.

**What I expected / What would be better:** Kill this page as it exists. Replace with one of:
- A **"what's happening"** showcase: top-scoring managers this week across public leagues, a sample matchup card with real PWHL player names, biggest blowouts — things that make a fan say "I want in."
- A **demo league** anyone can browse read-only without signing up.
- At minimum, if a directory must exist: gate to *open* leagues actively recruiting, with human-readable status ("Drafting Nov 20 · 3 spots left") and real "Join" buttons. No private leagues, no raw enums, no prototype disclaimers.

**Severity:** Blocker (actively undermines trust for a curious visitor)
**URL or page:** `/leagues`

---

### [My Franchise] [Agent 2] — Nine zones with no scroll budget; cognitive overload for the casual fan

**What I was doing:** Logging in Tuesday morning as a first-season Toronto fan wanting to know if I need to do anything.

**What confused me / What's wrong:** During an active week the page can render, in sequence: alert strip (Z1) → hero with embedded 8-row standings table (Z2) → Playing tonight + Swing players + Roster status (Z3) → Rival badge + 5-game H2H history (Z4) → Recap card (Z5) → my roster + opponent roster (Z6) → Top/Underperforming performers with stat pills (Z7) → League leaders top-5/bottom-5 (Z8) → League activity feed (Z9). That's 8–10 full phone screens. By Z7 the content has stopped being about "my franchise this week" and become league trivia. A casual fan hits Z5 and mentally files the rest as "I'll check later" — which means never. There are also four different "fix your lineup" entry points scattered across Z1, Z2, Z3, and Z6, while five sections are purely informational.

**What I expected / What would be better:** Hard-cap the matchup page at what serves the Tuesday job: Z1 (alert — plus an explicit "all set" state so absence isn't the only signal) + Z2 (slimmed hero) + Z3 (roster status + playing tonight) + Z6 (my roster). Move Z7–Z9 out entirely. See full zone triage table below.

**Severity:** Blocker (cognitive overload is the #1 churn risk for this audience)
**URL or page:** `/team/[teamId]/matchup`

---

### [Core Flows] [Agent 3] — FP and VP collide with no Rosetta stone; a Yahoo player reads "0.0" as losing

**What I was doing:** Coming from Yahoo Fantasy Football, scanning the matchup hero on my first logged-in visit.

**What confused me / What's wrong:** The app runs on two point currencies that are never reconciled on a single screen. My players' stats show "fantasy points (FP)." My standings rank by "Victory Points (VP)." The hero shows a big "42.0" score AND a "2–3 vs field" record, side-by-side with no hierarchy telling me which one *matters for winning*. As a Yahoo player I have a hardwired model: one number, one opponent, high score wins. Here the big number (FP) doesn't determine standings at all — VP does — and nowhere does a single screen say how they relate. Additionally, in the SETUP phase the hero can show "0.0" instead of "—," which a Yahoo player reads as "my lineup is busted and I'm being blown out," not "games haven't started."

**What I expected / What would be better:** On the first score surface (dashboard matchup hero), add one plain-language line: *"This is your fantasy points total this week. Outscore other teams to earn Victory Points (VP) — VP is what the standings rank by."* Guarantee pre-game states show "—" or "Not started," never a literal "0.0."

**Severity:** Blocker (core comprehension failure for the target Yahoo-migrant persona)
**URL or page:** `/dashboard`, `/team/[teamId]/matchup`

---

### [Core Flows] [Agent 3] — "vs the field" matchup model is never explained; violates every Yahoo player's expectation

**What I was doing:** Looking at my matchup expecting one head-to-head opponent, like every Yahoo week.

**What confused me / What's wrong:** The dashboard and league overview say "2–3 vs field" and "5 of 9 opponents outscored." In Yahoo I play *one* opponent per week. The app apparently plays "the field" — all teams at once — but there's no tooltip, no "?", nothing explaining what "the field" means or why I have a multi-game record in a single week. A Yahoo fantasy *veteran* is MORE confused than a total newbie here, because it violates a strong expectation.

**What I expected / What would be better:** First time "vs field" appears in a session, attach a one-tap explanation: *"In the regular season you don't face one rival — your score is compared to every other team. Beat more than half to win your matchup."* The `title=` attribute on the Record label is invisible on mobile and is not enough.

**Severity:** Blocker
**URL or page:** `/dashboard`, `/team/[teamId]/matchup`, `/league/[leagueId]` (matchup widget)

---

### [Playoffs/Renewal] [Agent 4] — Non-qualifying teams are told "Season hasn't started yet" during playoffs

**What I was doing:** Logging in as an Ottawa fan who finished 5th and missed the playoffs. Playoffs are now underway.

**What confused me / What's wrong:** The dashboard data assembly for teams that didn't qualify for the playoffs falls through to an early-season empty state and displays a "Season hasn't started yet" message (or equivalent) — code path identified in `lib/services/dashboard.ts` around line 598. A real user who played all regular season, cares about the outcome, and logs in during playoffs sees a message that makes the app look broken. There's no "you finished 5th — here's the playoff bracket you're watching from the sidelines" experience.

**What I expected / What would be better:** For non-qualifying teams during `playoffStatus === IN_PROGRESS`, show: (1) clear "You didn't make the playoffs" acknowledgment with their final regular-season rank, (2) the live bracket they can watch, and (3) final-season stats for their roster. Don't silently fall through to a broken state.

**Severity:** Blocker (makes the product look broken to the most common end-of-season persona)
**URL or page:** `/team/[teamId]/matchup` (non-qualifying team, playoffs in progress), `lib/services/dashboard.ts`

---

### [Playoffs/Renewal] [Agent 4] — Season renewal silently creates a new league with zero notification to returning managers

**What I was doing:** Trying to understand what "Start Next Season" actually does, as a commissioner after the championship.

**What confused me / What's wrong:** Clicking "Start Next Season" creates a brand new league with a new URL and new invite links — but nothing in the UI explains this distinction. After the button is clicked, returning managers get no notification that a new league exists or that they need a new invite. The commissioner is redirected to the new league admin page, but the old league's members have no way to know the new league exists unless the commissioner manually re-invites everyone. There's also no in-app language distinguishing "new league (new URL, new invites)" from "same league, new season."

**What I expected / What would be better:** Before confirming, show: *"This creates a brand-new league. Your current league stays as-is. You'll need to share new invite links — your managers won't be added automatically."* After completing, surface a "Share new invites" step as the immediate next action. Optionally, generate a renewal notification to all current league members: "Your commissioner started next season — get your invite."

**Severity:** Blocker (silent data loss of community for a returning cohort)
**URL or page:** `/league/[leagueId]/admin` (Start Next Season), `lib/services/renewal-service.ts`

---

## Friction findings

### [Pre-login] [Agent 1] — Landing hero leads with GM/front-office framing, not a fan hook

**What I was doing:** Landing on the home page as a PWHL fan who's never played fantasy.

**What confused me / What's wrong:** The hero is "Think Like a GM." The trust strip reads "A real front office, not a points game" — a sentence that only lands if you already know what "a points game" is. Five of the seven subcopy verbs ("draft a team," "work the wire," "set lineups," "make trades," "chase a championship") are fantasy-sports concepts. "Work the wire" is waiver-wire jargon with "waiver" stripped out, making it more opaque. The page assumes I aspire to be a GM. I'm a fan who loves watching Marie-Philip Poulin; someone told me this was fun.

**What I expected / What would be better:** Lead with the fan hook before the GM fantasy: *"Pick your favorite PWHL players. Compete with friends all season. No hockey-stats degree required."* "Think Like a GM" is a great tagline — it's wrong as the only value proposition for a first-time fantasy player.

**Severity:** Friction
**URL or page:** `/`

---

### [Pre-login] [Agent 1] — VP shown unexplained in the hero mockup on the very first screen

**What I was doing:** Scanning the landing page hero product preview.

**What confused me / What's wrong:** The hero card shows a standings table with a column of numbers (16, 15, 13, 12) with no label. The feature card says "Climb the table on **Victory Points**." A new fan has no idea what VP is, why it's not just "points," or why the standings number (16) differs so wildly from the matchup score (48.2) shown right above it in the same card. VP is the single most confusing concept in the product (non-standard even for fantasy veterans), and it leads the marketing page unexplained.

**What I expected / What would be better:** On the marketing page, don't surface "VP" by name — say "Climb the standings and chase a championship." Save VP for the in-app VpExplainer. If the mock standings table stays, label the column ("PTS").

**Severity:** Friction
**URL or page:** `/`

---

### [Pre-login] [Agent 1] — Both primary CTAs are dead ends for a solo visitor with no existing league

**What I was doing:** Deciding what to click from the hero as a solo curious visitor.

**What confused me / What's wrong:** "Start your franchise" → routes to `/register` then the full 7-step league creation wizard. That's a heavy first ask: create an account AND run an entire league setup. "Join a league" → routes to "Paste the league ID from your commissioner" — something a newcomer definitely doesn't have. Both top-level CTAs wall off the solo visitor. The genuinely low-commitment path (replay mode, no friends needed) is buried in wizard step 3 and invisible from the marketing page.

**What I expected / What would be better:** Primary CTA should be "Get started" — just an account, then route to the dashboard welcome flow (Create / Join / **Try a replay — no friends needed**). Promote replay mode to the marketing page as the "try before you commit" path.

**Severity:** Friction
**URL or page:** `/`

---

### [Pre-login] [Agent 1] — Login/register pages say "Season starts November 2026" with no mention of replay

**What I was doing:** Reading the registration page side panel before signing up.

**What confused me / What's wrong:** Both login and register pages say "Season starts November 2026." A newcomer in June reads this as "nothing to do yet — come back in 5 months" and bounces. The replay season, which lets someone play right now, is entirely invisible.

**What I expected / What would be better:** Pair the November date with the immediate option: *"Season starts Nov 2026 — or jump into a replay season and play today."*

**Severity:** Friction
**URL or page:** `/login`, `/register`

---

### [My Franchise] [Agent 2] — Hero does three mental models simultaneously (FP, W-L, league rank)

**What I was doing:** Reading my matchup hero on a Tuesday, as a brand-new fan.

**What confused me / What's wrong:** Before I've scrolled once, the FieldHero presents: my team name, a "W-L vs field" record, a "#3 of 8 this week" rank, a "Points earned" number, a paragraph explaining FP vs VP, a second paragraph explaining "you beat 2 teams' scores and lost to 5," a leading-scorer chip, and a full 8-row "Weekly standings" mini-table — all inside one card. That's three distinct mental models (fantasy points, win-loss record, league ranking) stacked before I've oriented at all. A new fan does not know which number is "their score that matters."

**What I expected / What would be better:** The hero should answer exactly three questions in order: (1) Am I winning? (2) What's my score? (3) Do I need to do anything? The two FP/VP explanatory paragraphs are good instincts but should collapse to one dismissible "How scoring works" line. The 8-row weekly standings table belongs on the standings page, not inside the hero.

**Severity:** Friction
**URL or page:** `/team/[teamId]/matchup`

---

### [My Franchise] [Agent 2] — FP / FPts / "Points earned" — three renderings of the same concept on one page

**What I was doing:** Reading player stat rows, the hero score, and the RosterStatusWidget.

**What confused me / What's wrong:** "Fantasy points" appears as "FP" in the hero, "FPts" in the roster table header, "Points earned" as the hero label, and "Projected FP" in the RosterStatusWidget. Four renderings. It signals inconsistency to a new user before they've had a chance to learn the system.

**What I expected / What would be better:** Pick one: "FP." Standardize every instance. Spell it out "fantasy points" once on first appearance per session, then abbreviate consistently.

**Severity:** Friction (systemic)
**URL or page:** `/team/[teamId]/matchup`

---

### [My Franchise] [Agent 2] — Z8 and Z9 (League leaders, Activity feed) are league-scoped content living on a franchise page

**What I was doing:** Scrolling into the bottom third of the matchup page.

**What confused me / What's wrong:** Z8 ("League leaders · Week N") and Z9 ("League activity" feed) are explicitly about the whole league, not my franchise. The page even shows "See all →" links to `/league/[leagueId]`, admitting the content belongs there. Placing league-wide leaderboards on the personal franchise page blurs the `/team/` vs `/league/` design split that the rest of the app carefully maintains.

**What I expected / What would be better:** Move Z8 and Z9 to the league overview. On the franchise page, keep only a "your players' league rank this week" one-liner if anything — franchise-relevant without duplicating league-scoped content.

**Severity:** Friction
**URL or page:** `/team/[teamId]/matchup`

---

### [My Franchise] [Agent 2] — Z7 (Top/Underperforming performers) duplicates the existing Analysis tab

**What I was doing:** Scrolling past my roster into per-player stat-pill territory.

**What confused me / What's wrong:** Z7 renders "Top performers" and "Underperforming" with stat breakdown pills (PPP, SOG, BLK). The Analysis tab already exists in the team nav for exactly this. The stat pills also expose raw hockey abbreviations with zero explanation — "PPP ×1" means nothing to a casual fan. These same abbreviations already appear in the roster table (Z6), so the jargon repeats twice.

**What I expected / What would be better:** Move deep performer analysis to the Analysis tab. The matchup page's Z6 roster table's points column is enough for in-week context. If stat pills stay anywhere, they need tooltips.

**Severity:** Friction
**URL or page:** `/team/[teamId]/matchup`

---

### [My Franchise] [Agent 2] — No "what should I do right now?" signal when lineup is fine

**What I was doing:** Logging in on a Tuesday when my lineup was already set.

**What confused me / What's wrong:** When there's no lineup alert (the common case), the top of the page is just a score and a standings table. A new fan's real question is "is everything OK, or do I need to act?" — and the answer is implied by the *absence* of a banner, which a newcomer won't infer. There's also no mid-week nudge toward the things a GM would actually do (bench-upgrade hints, available free agents) even though the lineup page already computes bench-upgrade logic.

**What I expected / What would be better:** A single "This week" status line at the top resolving to: "✅ You're all set — N starters playing this week" / "⚠️ Fix your lineup" / "💡 You could improve: [bench player] projects higher than [starter]." One line does the Tuesday job better than nine zones.

**Severity:** Friction
**URL or page:** `/team/[teamId]/matchup`

---

### [Core Flows] [Agent 3] — VP is discoverable pre-draft but the VpExplainer never mentions that FP is a separate concept

**What I was doing:** Reading the VpExplainer before the draft to understand how scoring works.

**What confused me / What's wrong:** The VP explainer correctly explains "+2 VP win, +2 VP top score, +1 VP second" but explains VP in isolation — it never mentions that the per-week *score* is a separate fantasy-points number, or how FP and VP relate. The most complete decode (VP vs FP vs PF distinction) only appears on the standings page, which a pre-draft user may never visit.

**What I expected / What would be better:** Add one line to the VpExplainer: *"Your weekly score (fantasy points) decides who wins each week — VP is the season currency you bank from those wins."*

**Severity:** Friction
**URL or page:** `components/VpExplainer.tsx`

---

### [Core Flows] [Agent 3] — Lineup page never explains position slots; a hockey newbie has to guess

**What I was doing:** Setting my first lineup after the draft.

**What confused me / What's wrong:** Active slots render as bare badges: "F", "D", "G", "UTIL", "BN". Nothing on the page says what these mean: that F = forward, D = defense, G = goalie, or crucially that UTIL accepts any skater but NOT a goalie. A first-timer with a UTIL slot open won't know a forward is allowed there. Eligibility highlighting helps once you've picked up a player, but you have to poke blindly to discover the rules.

**What I expected / What would be better:** A one-line slot legend above the active panel: *"Start 3 forwards (F), 2 defense (D), 1 goalie (G), and 1 UTIL (any skater). Everyone else sits on bench."* Add a "UTIL" tooltip: "Any skater — forward or defense, not a goalie."

**Severity:** Friction (borderline Blocker for a true hockey newbie)
**URL or page:** `/team/[teamId]/lineup`

---

### [Core Flows] [Agent 3] — Draft stat columns assume hockey fluency; queue concept under-explained

**What I was doing:** Entering the draft room for the first time, on the clock with 30 seconds.

**What confused me / What's wrong:** Two simultaneous problems:
1. The stat table headers (PPP, SOG, HIT, BLK for skaters; GA, SV%, SO for goalies) are bare with no legend. PPP (power-play points) is invisible in typical game broadcasts; casual fans have never encountered it. SOG vs "shots" trips people. No tooltip, no legend, a ticking clock.
2. The queue concept — the star button that saves "if I miss the clock, auto-pick from here" — is buried. The star's tooltip ("Add to queue") doesn't explain what the queue *does*. The payoff ("we'll draft from the top of your queue if you miss the clock") only appears inside the Queue tab, which a first-timer might never open until they're already surprised by an auto-pick.

**What I expected / What would be better:** (a) Per-header tooltips: "PPP = points scored on the power play." (b) One-line queue hint near the star: "★ Queue players you want — if your clock runs out, we draft from the top." The "You're on the clock!" banner is great — it lowers stakes exactly right. Keep it.

**Severity:** Friction
**URL or page:** `/draft/[leagueId]`

---

### [Core Flows] [Agent 3] — Two nav bars with overlapping labels (Standings, Trades, Rosters appear in both)

**What I was doing:** Bouncing between lineup management and league standings.

**What confused me / What's wrong:** The league nav and the team nav both list "Standings," "Rosters," and "Trades." Clicking "Standings" from the team nav routes to the league-scoped standings page, quietly crossing the `/team/` → `/league/` boundary with no signal. A first-timer loses their sense of "where am I" after one click.

**What I expected / What would be better:** Either remove duplicates from one bar (the team nav's "Standings" is really a league link — own that) or show a persistent breadcrumb when a team-nav click lands in league territory.

**Severity:** Friction
**URL or page:** `app/team/[teamId]/layout.tsx` (`TeamNav`)

---

### [Core Flows] [Agent 3] — Dashboard franchise card: stats-first, actions-last hierarchy wrong for newcomers

**What I was doing:** Looking at my franchise card on the dashboard, first week of the season.

**What confused me / What's wrong:** The card leads with the FP score and "vs field" record (concepts the first-week user hasn't learned yet), then "Top performers," and pins the actual action buttons ("My Matchup," "Set Lineup") to the bottom. For a newcomer who can't yet interpret the score, the card front-loads numbers they can't read and back-loads the actions they need.

**What I expected / What would be better:** When a team has no comprehension context (pre-season or first week of scoring), lead the card with the action ("Set your lineup →") and demote the score block. After a user has lived through one scored week, the stats-forward layout is appropriate.

**Severity:** Friction
**URL or page:** `/dashboard`

---

## Minor findings

### [Pre-login] [Agent 1] — Raw status enums shown to visitors ("PRE DRAFT", "NOT STARTED")

**What I was doing:** Reading league cards on the Leagues page.
**What confused me / What's wrong:** Statuses are rendered via `.replace("_", " ")` on raw DB enums: "PRE DRAFT," "IN SEASON," "Playoffs: NOT STARTED." A fan doesn't know if "PRE DRAFT" means "you can still join" or "too late."
**What I expected / What would be better:** Human, action-oriented labels: "Drafting soon — open to join," "Season in progress — closed."
**Severity:** Minor
**URL or page:** `/leagues`

---

### [Pre-login] [Agent 1] — Invite landing page is the template the rest of the funnel should aspire to

**What I was doing:** Arriving via a friend's invite link.
**What confused me / What's wrong:** This page works. "You've been invited," league name as headline, "3 Joined · 5 Spots left," "Claim your spot." It handles full-league and post-draft states with plain language. Two small gaps: it never explains what fantasy hockey is for a true first-timer, and it doesn't show when the draft is (invitee's most pressing question).
**What I expected / What would be better:** Add one line: *"New to fantasy? You'll draft real PWHL players and compete each week — we'll walk you through it."* Show the draft date if set.
**Severity:** Minor (mostly positive; flag for documentation)
**URL or page:** `/invite/[leagueId]`

---

### [My Franchise] [Agent 2] — Z4 Rivalry shows to users who have no history yet

**What I was doing:** Checking my matchup page as a first-week user.
**What confused me / What's wrong:** The 5-row H2H table and rival badge appear above my own roster, but for a first-week user "rival" is meaningless — there's no history. New users read relationship drama with a team they don't recognize before they see their own players.
**What I expected / What would be better:** Only render rivalry once at least 2 H2H games exist. First-timers should never see an empty or one-game "rivalry."
**Severity:** Minor
**URL or page:** `/team/[teamId]/matchup`

---

### [Core Flows] [Agent 3] — Pre-draft checklist items never get checked off after you take the action

**What I was doing:** Building a draft queue after reading the pre-draft checklist.
**What confused me / What's wrong:** "Build a draft queue" stays unchecked even after I've queued players in the draft room. The checklist reads as static decoration rather than a live progress tracker.
**What I expected / What would be better:** Wire checklist items to real state — e.g., "Build draft queue" → checked once any player has been queued.
**Severity:** Minor
**URL or page:** `/league/[leagueId]` (PRE_DRAFT non-commissioner view)

---

### [Core Flows] [Agent 3] — Stat column abbreviations (PPP, SOG, SV%) appear bare everywhere without tooltips

**What I was doing:** Reading player stats across lineup, roster, and draft pages.
**What confused me / What's wrong:** PPP, SOG, BLK, HIT, SV%, SO appear in headers with no legend, no tooltip, and no expansion. They appear in at least three distinct surfaces (draft room, lineup page, matchup roster table). A PWHL fan who watches games knows "goals" and "assists" — they have never heard "PPP" from a broadcast.
**What I expected / What would be better:** Universal stat-abbreviation tooltip system, applied once across all table headers. Minimum: "PPP = power-play points," "SOG = shots on goal," "SV% = save percentage," "GA = goals against." One consistent implementation in a shared table header component.
**Severity:** Minor (but systemic — touches every stat surface)
**URL or page:** `/draft`, `/team/[teamId]/lineup`, `/team/[teamId]/matchup`

---

### [Core Flows] [Agent 3] — Lineup interaction model is the app's best UX — protect it

**What I was doing:** Moving players between active and bench.
**What confused me / What's wrong:** Nothing. The staged "Save Lineup (N changes)" button with confirmation, the `beforeunload` guard, the 🔒 lock icon, and the zero-games warning banner are all concrete and human. A first-timer will not lose work and will get told in plain English when their lineup is broken.
**What I expected / What would be better:** Keep all of it. This is the bar the rest of the app should meet.
**Severity:** Minor (positive finding — note for documentation)
**URL or page:** `/team/[teamId]/lineup`

---

## Zone-by-zone triage: My Franchise matchup page

| Zone | Content | Verdict | Destination |
|---|---|---|---|
| Z1 | Lineup alerts | **Keep — add "all set" positive state** | Matchup page top |
| Z2 | Matchup hero (score, win prob) | **Keep — slim down** | Strip embedded 8-row standings; collapse FP/VP paragraphs to one dismissible line |
| Z3 | Playing tonight + Roster status | **Keep** | Hide "Swing players" in regular season (1v1 only) |
| Z4 | Rival badge + H2H history | **Collapse** | Only render with 2+ H2H games; Analysis tab or future rivalry page |
| Z5 | Recap card (last result) | **Keep, compact** | One card is fine |
| Z6 | Both roster tables | **Keep** | Standardize FPts→FP; add stat-pill tooltips |
| Z7 | Top/Underperforming performers | **Move** | Analysis tab (already exists) |
| Z8 | League leaders this week | **Move** | League overview (`/league/[leagueId]`) |
| Z9 | League activity feed | **Move** | League overview (its own "See all →" link already points there) |

---

## Summary

The app has a strong skeleton and genuinely excellent interaction mechanics in a few places — the lineup manager (staged save, zero-games warning, lock countdowns), the pre-draft checklist with inline VP explainer, and the on-the-clock draft banner are best-in-class for this audience and should be protected. The gaps are concentrated in three areas:

**1. Conceptual onboarding never happens.** The product runs on two point currencies (FP for weekly scores, VP for season standings) plus a "vs the field" format where you play every team at once — three departures from Yahoo and from common sense that are never reconciled on any single screen the user is actually looking at. A Yahoo Fantasy Football player, the most likely early adopter, will be actively misled by their existing knowledge. The single highest-leverage fix is one bridging sentence on the dashboard matchup hero, visible the moment a user logs in.

**2. The My Franchise matchup page is doing nine jobs at once.** The Tuesday-morning casual fan's job is: know my score, know if my lineup needs fixing, and see my roster. That's three zones. The remaining six (rivalry history, performer analysis, league leaders, league activity, and the embedded league standings inside the hero) belong on other pages that already exist (the Analysis tab, the league overview) and should be moved there. The matchup page should be the fastest, cleanest answer to "how's my franchise doing right now?" — not the app's information hub.

**3. The pre-login public presence has two structural problems.** The LEAGUES page in its current form should not ship — it is a private-league database dump that actively undermines trust and leads to dead ends. And the landing page's CTA pair (Start your franchise → forced full league setup; Join a league → paste-an-ID wall) over-asks or blocks the solo curious visitor, while the ideal entry point for that person (replay mode, no friends required) is buried in step 3 of the wizard and invisible from marketing.

---

*Report compiled from 4 parallel pwhl-ux-critic agent reviews on 2026-06-22. Source files reviewed span `app/page.tsx`, `app/leagues/`, `app/team/[teamId]/matchup/`, `app/team/[teamId]/lineup/`, `app/league/[leagueId]/`, `components/VpExplainer.tsx`, `components/LineupManager.tsx`, `components/DraftRoom.tsx`, `app/league/[leagueId]/bracket/`, `app/league/[leagueId]/admin/`, `lib/services/dashboard.ts`, `lib/services/renewal-service.ts`, and related layout/nav files.*
