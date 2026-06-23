---
name: onboarding-findings
description: Strengths and gaps in the welcome flow and 7-step create-league wizard for new PWHL fans
metadata:
  type: project
---

**WelcomeFlow** (components/WelcomeFlow.tsx): 3 orientation cards (franchise / Victory Points / two ways to start) + CTAs. Good: explains VP up front, offers "Just exploring? Try a replay league." Gap: "Skip intro" and dismiss fire on EVERY CTA click too, so onboarding can never be seen again after one click — a user who clicks "Start a league" then bails has permanently lost the intro.

**Create-league wizard** (app/create-league/CreateLeagueWizard.tsx): TOTAL_STEPS=8 (increased in Sprint 17 to accommodate beta welcome step 0). Internal step count vs displayed step count is managed via getDisplayStep() and getDisplayTotal(). In beta mode, step 0 is a BetaWelcomeStep hidden from the progress bar; TOTAL_STEPS is 8 with the "done" screen being step 7.

Wizard strengths to preserve:
- Step 2 size selector has plain-language notes ("Classic size — easy to fill") and a green "Recommended" chip on 8.
- Step 3 replay vs live has clear icon + description cards and a mode-specific callout.
- Step 4 rules screen has an expandable "How does VP work?" inline (not just a link) AND a full scoring table.
- handleCancel() correctly warns when createdLeagueId exists but createdTeamId is null — prevents orphaned leagues without silently discarding user work.

**CRITICAL BUG — Replay mode back-button navigation (identified June 2026):**
In replay mode, the user jumps from step 3 directly to step 5 (team creation) via handleReplayCreate() which hard-codes `setStep(5)`. The goBack() function is a dumb decrement: `setStep(s => Math.max(s - 1, minStep))`. So from step 5 in replay mode, Back goes to step 4 (Rules confirmation) — a step that should not exist in the replay flow. The progress bar labels correctly show ["Name","Size","Season","Team","Invite"] for replay but the internal step state doesn't skip step 4 on the way back. The user sees a "Standard rules / Create league" screen that has no business appearing in a replay flow.

**CRITICAL BUG — Duplicate league creation on retry:**
In live mode, handleCreate() runs at step 4 and sets createdLeagueId. If the user then hits Back from step 5 (which drops them into step 4 in live mode, also wrong — see below), re-clicking "Create league" calls the API again and creates a second league. No idempotency guard exists at step 4.

**CRITICAL BUG — Live mode back-button from step 5 also broken:**
In live mode, goBack() from step 5 (team creation) goes to step 4 (Rules) — which is correct structurally. But at step 4, the user sees "Create league →" again even though createdLeagueId is already set. Clicking it fires handleCreate() again, creating a second league. There's no state guard on the button that says "league already exists, don't re-call the API."

**500 error root cause — team creation:**
handleCreateTeam() sends `ownerEmail: ""` explicitly. The join route falls back to the session cookie: `ownerEmail = sessionEmail || ""`. If the session cookie is missing or the cookie value is empty string, the validation check `!ownerEmail` triggers a 400 ("owner email are required"), but the actual error seen is 500, suggesting either: (a) the session cookie is present and email resolves, but a DB constraint is hit (e.g. generateShortId collision on duplicate teamName), or (b) an unhandled Prisma error is thrown. The catch block returns 500 with no detail exposed to the client. The wizard surfaces this as "Unable to create team. Please try again." — a generic dead end with no recovery path and no context about what went wrong.

**Step 5 renders on condition `createdLeagueId && !createdTeamId`.** If the user hits Back from step 5, they land on step 4. At step 4, createdLeagueId is already set but the step 4 JSX renders unconditionally (no check for createdLeagueId). So the user sees "Create league →" even though the league exists. This is the back-button trap.

Wizard gaps (carry forward from prior review):
- Step 4 scoring table dumps every multiplier on a new fan with zero scaffolding. "UTIL (any skater)", "SOG", "PP" used without expansion.
- No "what is a draft / what happens next" primer before the user is dropped at the admin panel.
- Step 7 prep checklist is good but assumes the user knows what "set up the draft board" means.

**Fix approach (implementation plan):**
See the June 2026 UX analysis for the full plan. Short version:
1. Replace dumb goBack() with a mode-aware previousStep() function that knows the replay path (1→2→3→5→6→7) vs live path (1→2→3→4→5→6→7).
2. Guard step 4's "Create league" button: if createdLeagueId is already set, skip the API call and advance to step 5 instead.
3. In step 5, if createdLeagueId is set but team creation fails, the Back button should go to step 3 (replay) or step 4 (live) — not silently expose step 4 in replay mode.
4. Expose the specific error from the join API to help diagnose the 500.

How to apply: the wizard is the best-onboarded surface in the app; the DRAFT and the MATCHUP hero are where the onboarding investment falls off a cliff. Recommend carrying the wizard's "explain inline, expandable detail" pattern into the draft room and matchup hero.

**Public pre-login surfaces (beta, observed June 2026 via WebFetch on beta.fantasy.dykedb.org):**
- Landing `/`: "Think Like a GM." hero; "Strategy beats luck every time"; Draft/Manage/Compete/Win 4-up; CTAs "Start your franchise" / "Join a league" / "Replay a past PWHL season"; footer disclaimer "Not affiliated with the PWHL. Fan-built fantasy product." Strong, jargon-free, fan-first. No VP/FP/VTF acronyms on landing — good.
- `/login`: "Draft real players. Win your league."; season-timing line "Season starts November 2026 · Draft week TBD · or play a replay season right now →"; four plain-language bullets (Real PWHL players / Weekly matchups — "races the whole league's scores each week" = VTF in plain words, good / Live scoring / Playoffs).
- `/register`: "Build your franchise. Win the championship." 3 fields (Email, Display name, Password).
- `/leagues`: empty-state "None open right now / Be the first to create one." CTAs "Start a league →" and "Try a solo replay →". Acceptable but flat — no hook for a curious fan with no league yet.
- `/dashboard` unauthenticated: renders nav shell then client-side "Loading your leagues …" with no redirect to /login. P1 trust issue — a logged-out visitor hitting a shared dashboard link sees a permanent spinner, not a sign-in prompt. Server should redirect unauth users to /login like the /league and /team routes do.

**Tooling note:** WebFetch CANNOT drive authenticated walkthroughs (no cookies/session/form POST). A real end-to-end beta walkthrough needs a headless browser (Playwright, already installed in the repo + chromium cached) driven from Bash. Run the .mjs from inside the project dir so bare `import 'playwright'` resolves; use Locator.pressSequentially (not ElementHandle.type) on PW 1.60.

**Playwright live walkthrough (beta, June 2026) — verified facts:**
- Auth IS a real bcrypt password check (`app/api/auth/login`); login works with the test account, logs in as display name "zaddy".
- **Beta wizard is REPLAY-ONLY and 4 steps** (Name → Rules → Team → Invite), preceded by a step-0 "BETA · REPLAY SEASON / You're in. Welcome, Founding GM." welcome with "Build my league →" + "What's a replay league?". No live-vs-replay choice in beta. Progress reads "STEP N OF 4". Step-1 name input is `input.form-input` (no type attr) pre-filled "My PWHL League".
- Step-2 Rules screen: GOOD content, DENSE layout. 6 cards (ROSTER, STANDINGS, SCORING, PLAYOFFS, LEAGUE SIZE up-to-6, DATA SOURCE) with raw jargon — "VP", "PPP = +0.5 pts", "UTIL (any skater)", "all vs. all VP scoring", "Win (G) = 5 pts". The "?" by STANDINGS opens a strong VP explainer (+2 win/+1 tie/+2 highest/+1 second/max 4 VP + FP→VP bridge sentence). VISUAL BUG: that popover overflows the card vertically and runs off-screen (screenshot 50-s2-vp.png) — broken on small viewports.
- **REAL INVITE LINK FORMAT: `https://beta.fantasy.dykedb.org/invite/<leagueId>`** (NOT `/join/<id>` — that 404s). Surfaced via a "Copy link" button in admin "Invite managers"; copy-to-clipboard works.
- Invite landing (logged-out, mobile 390px) is GOOD: "YOU'VE BEEN INVITED / <league> / N JOINED / Full|spots / Draft: <date>" card + graceful full-league empty state. Gap: zero "what is fantasy hockey" primer for a brand-new fan before asking them to join.
- Admin "Quick add team (testing)" lets the commissioner populate teams directly without invites — reliable path to multi-team PRE_DRAFT. Setup checklist: League created → Teams joined → Draft set up → Draft complete → Season started.
- **404 on `/league-rules`** fires on dashboard/wizard load (RSC prefetch) — a dead internal link, repeatable.

**INTERMITTENT P0 — wizard create returns 401 "Unauthorized":**
Clicking "Create my beta league →" reproducibly returned HTTP 401 from `POST /api/leagues/create`, rendering a bare unstyled "Unauthorized" string at the bottom of the card with NO recovery path — in a clean, human-paced logged-in run. BUT a raw `fetch('/api/leagues/create',{useBetaReplay:true})` from the same authenticated page returned 200 and created the league (proven repeatedly, incl. with `credentials:'include'`). So the create API works; the wizard's button path intermittently fails auth. The 401 originates in middleware (the route never returns 401). Root cause NOT isolated — suspect a session/cookie race (wizard also fires `POST /api/user/onboarding` on mount). The user-facing failure (raw "Unauthorized", dead-end, no retry) is the finding regardless. Worth a senior-engineer repro.
