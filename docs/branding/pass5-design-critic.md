---
  Design Critique: First-Time League Creation Flow

  Perspective: I'm a casual PWHL fan who saw this linked somewhere. I know fantasy sports but have never used this app.

  ---
  Where I got confused

  1. The CTA immediately hits a login wall with no preview

  I click "Start your franchise →" from the homepage and land on /login?returnTo=/create-league. I haven't seen anything about the product beyond the marketing page.
  There's no "here's what you're signing up for" moment — just an auth form. For a new user, this is a commitment gate before any value has been delivered.

  Compound problem: the login page is where first-timers land, but it says "Sign in" and has "Don't have an account? Create one →" in small text. Most people clicking
  "Start your franchise" for the first time don't have an account, so they should land on /register directly, not /login.

  2. Password confirmation in 2026

  The register form has four fields: Email, Display name, Password, Confirm password. Confirm-password is an old UX pattern that adds friction without safety benefit. A
  show/hide toggle on one password field is now the standard.

  3. "Display name" says optional in the placeholder but nothing in the label

  placeholder="Your public name in the league (optional)" — the label just says "Display name" with no visual indication it's optional. Per CLAUDE.md, UX-002 addressed
  this inline on the auth pages, but looking at the code, the label text still just says "Display name" with no "(optional)" next to it. A user filling out the form
  top-to-bottom might stop and wonder if they must fill this in.

  4. Step 3 has a surprise fast-forward

  On the "Season & draft date" step, selecting "Replay (2025-26)" and clicking "Create replay league →" immediately creates the league and skips step 4 (rules). The rules
  confirmation is the only place users learn what "3 F · 2 D · 1 UTIL" and "Victory Points" mean. Replay users bypass this entirely.

  Also: the replay explanation amber box only appears after you click the Replay option. A first-time user might click it to explore what it does, but the description
  should be visible upfront so they can make an informed choice.

  5. Step 5 (team creation) is a surprise step

  The wizard says "Step 4 of 6: Create league →". I click the button expecting to be done. Instead, I'm on a new screen: "Create your team." The microcopy explains it
  ("you also need a team to draft and play"), but the fact that there's a separate team creation step was never telegraphed. The progress bar doesn't help — it's already
  maxed at segment 3 of 6 before this happens. The wizard gives no indication earlier that "creating a league" and "creating your team" are two separate actions.

  6. Fantasy jargon is unexplained in the rules step

  Step 4 shows:
  - "3 F · 2 D · 1 UTIL · 1 G · 6 Bench = 13 slots"
  - "Victory Points — win your matchup AND be a top scorer each week"

  UTIL is fantasy sports shorthand. Victory Points is a non-standard scoring system invented for this app. For a first-time fantasy user (or even an experienced one who's
  used standard head-to-head systems), neither of these is self-evident. There's no tooltip, no "what's this?" link, nothing. The VpExplainer component exists but it lives
  on the standings page, not here where it's introduced for the first time.

  7. No scoring details anywhere in the wizard

  The rules confirmation shows roster format and standings format but never explains how fantasy points are calculated. What does a goal score? An assist? A win for a
  goalie? This is a core purchase decision — "should I start this player or that one?" — and the user has zero visibility into the scoring engine before committing.

  8. Two competing CTAs at step 6 (invite)

  After the league is created, step 6 has:
  - "Continue to draft prep →"
  - "Go to admin panel"

  A first-time commissioner doesn't know what the admin panel does or whether they need it now. The two buttons have roughly equal visual weight and point to different
  places for unclear reasons. The "draft prep" path leads to step 7, which is a checklist. The admin panel is the real power tool. Neither CTA explains what the other
  does.

  9. Canceling mid-wizard after step 4 silently orphans a league

  The "Cancel" link at the top-right goes to /dashboard. But if the user has already completed step 4 (which calls POST /api/leagues/create), they've created a real league
  in the DB. Canceling after that point leaves an orphaned, unsettled league in their account. There's no "are you sure?" prompt and no cleanup.

  10. The landing page QuickDraftJoinForm is bewildering

  The "Running a league?" section has a form asking for League ID and Team ID directly on the homepage. A first-time visitor would have no idea what these IDs are or where
  to find them. This is an advanced power-user tool sitting in the main marketing flow. It belongs in the admin panel or behind auth, not on the public home page.

  11. Step counter is off-by-one for Replay users

  For a Live league: 6 steps visible (name, size, season, rules, team, invite) + step 7 (done). The bar shows 6 segments, counter says "Step N of 6." Coherent. For a
  Replay league: the user goes name → size → season → (jump to step 5) → team → (jump to step 6) → invite → done. They see steps 1, 2, 3, 5, 6, 7 in the code — the
  progress bar isn't meaningful because step 4 (rules) is skipped and the bar skips from segment 2 to segment 4.

  12. "All 8 teams" on the login page pitch is out of date

  The login page says: "Real PWHL players — Every skater and goalie from all 8 teams." But the 2026-27 season has 12 teams (4 expansion teams were added). This is a small
  but trust-eroding inconsistency for anyone who follows the PWHL.

  13. Draft date picker has no useful anchor

  Step 3 shows a date picker with the helper text: "Most leagues draft the week before the season opener." But the season opener is "November 2026" and the draft date is
  "TBD." A user picking a date in June 2026 has no idea what date to aim for. The picker might be better replaced with a simple note: "You can set the exact date from the
  admin panel once the PWHL confirms the schedule."

  ---
  What works well

  - The wizard structure itself is sound. Breaking league setup into discrete steps with a progress bar is the right call.
  - The Replay mode as a low-friction entry point for solo exploration is a smart idea, even if the execution has some gaps noted above.
  - The rules confirmation step (step 4) as a "here's what you're agreeing to" checkpoint is good commissioner UX.
  - The invite link pattern (copy one URL, share anywhere) is the right call for getting managers in fast. It's better than email-based invite flows.
  - The "You're all set!" checklist on step 7 is a solid off-ramp with clear next actions.
  - "Season starts November 2026 · Draft week TBD" setting appropriate expectations on auth pages is appreciated.

  ---
  Priority fixes

  ┌─────┬───────────────────────────────────────────────────────────────────────────────────────┬──────────┐
  │  #  │                                         Issue                                         │ Severity │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 1   │ "Start your franchise →" should go to /register, not /login                           │ High     │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 2   │ Explain VP scoring before the user commits in step 4                                  │ High     │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 3   │ Telegraph that step 5 (team creation) is part of the flow — add it to the step labels │ High     │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 4   │ Add a confirm dialog when Cancel is clicked after step 4                              │ High     │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 5   │ Remove QuickDraftJoinForm from the public home page                                   │ Medium   │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 6   │ Show replay mode description upfront, not after clicking                              │ Medium   │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 7   │ Update "8 teams" → "12 teams" on login page pitch                                     │ Medium   │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 8   │ Drop password confirm field; add show/hide toggle instead                             │ Medium   │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 9   │ Add even one-line scoring examples to the rules step ("Goal = 2 pts")                 │ Medium   │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 10  │ Add label "(optional)" next to Display name field                                     │ Low      │
  └─────┴───────────────────────────────────────────────────────────────────────────────────────┴──────────┘