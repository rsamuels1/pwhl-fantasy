# Multi-Agent End-to-End Test Run Spec

**Version:** 1.0  
**Date:** 2026-06-22  
**Owner:** Validation  
**Status:** Active — invoke when running a full-lifecycle agent test

---

## Purpose

Validate the entire PWHL GM lifecycle — league creation through season renewal — using
autonomous agents playing as real (naïve) users. The test is designed to surface confusion,
dead ends, and UX friction that technical testing misses, because the agents don't know
how the app is built.

This is not a correctness test. It is a usability and integration test run by people who
don't know the codebase.

---

## When to use this

Run a multi-agent test after any sprint that touches:
- Onboarding or league creation flow
- Draft room UI or draft server
- Lineup management
- Standings or scoring display
- Playoff bracket or advancement
- Season renewal

Also run before any public beta milestone.

---

## Setup

Before spawning agents, seed the environment:

```bash
npm run dev              # terminal A — keep running throughout
npm run draft-server     # terminal B — keep running throughout
npm run seed             # load teams/players/games (2025-26 fixture)
npm run seed-fixture -- --season 2025-26   # load stat lines
npm run seed-draft       # creates a 4-team replay league; prints leagueId + team ids
```

`seed-draft` prints output like:
```
League ID: clxxxxx
Commissioner (Team 1): commish@dev.local  teamId: clyyy
Team 2: owner2@dev.local  teamId: clzzz
Team 3: owner3@dev.local  teamId: clwww
Team 4: owner4@dev.local  teamId: clvvv
```

Record these IDs. You'll paste them into each agent's prompt.

The app runs at `http://localhost:3000`. Auth is email-only (no passwords) — agents log in
by entering an email at `/login`.

---

## Agent count and roles

| Agent | Email | Role | Persona |
|---|---|---|---|
| Commissioner | `commish@dev.local` | Runs the league. Owns Team 1. | Montréal fan who ran a paper hockey pool in college |
| Owner 2 | `owner2@dev.local` | Team manager | Toronto fan, new to fantasy sports entirely |
| Owner 3 | `owner3@dev.local` | Team manager | Minnesota fan, plays fantasy football, new to hockey fantasy |
| Owner 4 | `owner4@dev.local` | Team manager | Ottawa fan, casual viewer, doesn't know player stats well |

You can spawn fewer agents for a faster run (minimum: commissioner + 1 owner). Four agents
exercises the full playoff bracket.

---

## Personas in detail

Give each agent this context in their prompt so they behave like real users, not testers.

### Commissioner agent prompt context

```
You are a hockey fan who's excited about PWHL GM but has never run a fantasy sports
league before. You've organized a hockey pool (everyone picks a team) but this is more
complicated. You're a Montréal fan. You know the PWHL exists and you want to manage a
league for your friend group. You are NOT a developer and have no idea how this app works
internally.

Your job: create and run this fantasy league from start to finish. Log everything that
confuses you, any moment where you weren't sure what to do, any label or button that was
unclear, or any result that didn't make sense. Be honest — if something felt like a dead
end, say so.
```

### Team owner agent prompt context (customize city per owner)

```
You are a [CITY] PWHL fan who got invited to a fantasy league by your friend. You have
[none / some football fantasy] experience but you've never done hockey fantasy before.
You know some PWHL players — [Brianne Jenner / Marie-Philip Poulin / etc.] — but you
don't know advanced stats or what "FP" means.

Your job: join the league, participate in the draft, set your lineup each week, check
your scores, and follow the season through to the playoffs. Log anything that confused
you: unclear terms, surprising behavior, things that were hard to find, or moments where
you weren't sure what to do next.
```

---

## Phase scripts

Each agent should work through these phases in order. Spawn agents in parallel where
phases are concurrent (draft, weekly lineup decisions). Use sequential hand-off for
league-level phase transitions (the commissioner must start the draft before team owners
can join; the commissioner must advance the week before owners can see new scores).

---

### Phase 1 — League join (concurrent, all agents)

**Commissioner:**
1. Log in at `http://localhost:3000/login` with `commish@dev.local`
2. Navigate to the league using the leagueId you were given
3. Confirm the league exists and all 4 teams are listed
4. Find the draft setup area. Confirm the draft is ready to start.
5. Do NOT start the draft yet — wait for team owners to join.

**Team owners (2, 3, 4):**
1. Log in at `http://localhost:3000/login` with your email
2. You should land on `/dashboard`. Find your team and your league.
3. Explore the league overview. What information is available before the draft?
4. Signal ready (just note in your log that you've joined and looked around).

---

### Phase 2 — Draft (commissioner starts; all agents participate)

**Commissioner:**
1. Start the draft from the admin panel or draft room.
2. Make your picks when it's your turn.
3. If you see auto-pick happen for another team, note whether that was expected.
4. After all 13 rounds complete, confirm the draft is marked complete.

**Team owners:**
1. Navigate to the draft room at `http://localhost:3000/draft/[leagueId]?team=[yourTeamId]`
2. You have 30 seconds per pick. Build a queue if you can figure out how.
3. Make your picks. If you auto-pick, note why (missed the clock, couldn't figure out the UI).
4. After the draft: check your roster. Does it make sense? Do you know who you drafted?

---

### Phase 3 — Pre-season lineup review (concurrent, all agents)

Before the season starts, each manager should:
1. Navigate to your team's lineup page.
2. Set your starting lineup (make sure your best players are active, not benched).
3. Note: do you understand which positions go where? Is the VP scoring explanation findable?
4. Try to find the VP Explainer / standings explanation. Does it answer your questions?

---

### Phase 4 — Week 1 (commissioner advances; all agents check scores)

**Commissioner:**
1. Go to the season page (`/league/[leagueId]/season`).
2. Use the "End week 1 now" dev control to score week 1.
3. Confirm standings updated. Check the league overview.

**Team owners:**
1. After the commissioner signals week 1 is scored:
2. Check your matchup page. Do you understand your score?
3. Check the standings. Do you understand VP / how the standings work?
4. Do you know what you need to do for week 2?
5. Adjust your lineup for next week if needed.

---

### Phase 5 — Weeks 2–N (repeat week 1 pattern)

Repeat the week 1 cycle for as many weeks as the replay league has. Use "⏩ Sim to
playoffs" to fast-forward if you want to skip ahead to playoffs quickly.

Each owner should check in at least once per "week":
- Did scores update as expected?
- Is the matchup page clear about who you're competing against?
- Any alerts or action items you noticed (or missed)?

---

### Phase 6 — Playoff qualification

**Commissioner:**
1. After the regular season ends, check if "Start Playoffs" is available.
2. Start the playoffs. Confirm the bracket generates.
3. Note whether the seeding makes sense given the standings.

**Team owners:**
1. Check the bracket. Do you understand who you're playing?
2. Is it clear whether you made the playoffs?
3. Adjust your lineup for the playoff matchup.

---

### Phase 7 — Playoffs through championship

**Commissioner:**
1. Advance each playoff round using the season controls.
2. Confirm matchup results look right.
3. Once both semifinal winners are determined, start the championship round.
4. Advance the championship. Confirm the champion is crowned.

**Team owners:**
1. Each round: check your matchup. Are the scores visible?
2. Did eliminated teams have a clear "you're out" experience?
3. Winner: does the champion page/banner appear clearly?

---

### Phase 8 — Season renewal (commissioner only)

1. After the championship, go to the admin panel.
2. Find "Start Next Season" (should be visible when `playoffStatus === COMPLETE`).
3. Attempt to renew the league.
4. Confirm the new league was created. Does the invite flow work?
5. Note: was it clear that this creates a new league vs. resetting the old one?

---

## Confusion log

After completing all phases (or as you go), each agent compiles a confusion log. This is
the primary output of the test run.

**Format — one entry per confusion moment:**

```markdown
## [Phase N] [Agent role] — [Short title]

**What I was doing:** [one sentence]
**What confused me:** [what label, behavior, or blank page stopped you]
**What I expected:** [what you thought would happen]
**Severity:** [ ] Blocker  [ ] Friction  [ ] Minor
**URL or page:** [where this happened]
```

---

## Output artifact

After the test run, compile all confusion logs into a single file:

```
docs/03-validation/agent-run-findings-[YYYY-MM-DD].md
```

Structure:

```markdown
# Agent Test Run — [date]

## Run config
- Agents: [N]
- League ID: [id]
- Season: replay / 2025-26
- Completed phases: [list]

## Critical findings (Blockers)
[Any confusion log entries marked Blocker]

## Friction findings
[Any confusion log entries marked Friction]

## Minor findings
[Everything else]

## Summary
[2–3 sentences: overall impression, biggest gap, biggest surprise]
```

---

## How to invoke this test

To run with Claude Code agents, copy the following scaffold and fill in the IDs printed
by `seed-draft`:

```
Spawn 4 agents in parallel using the multi-agent test run spec at
docs/03-validation/multi-agent-test-run-spec.md.

League ID: [paste]
Commissioner email: commish@dev.local, Team ID: [paste]
Owner 2 email: owner2@dev.local, Team ID: [paste]
Owner 3 email: owner3@dev.local, Team ID: [paste]
Owner 4 email: owner4@dev.local, Team ID: [paste]

The app is running at http://localhost:3000 and the draft server at ws://localhost:8080.

Each agent should follow their phase scripts, maintain a confusion log, and compile
findings into docs/03-validation/agent-run-findings-[today's date].md at the end.
```

For a lighter run (commissioner + 1 owner only), drop owners 3 and 4. The season will
still complete but the playoff bracket won't fill.

---

## Notes on agent behavior

- Agents should NOT read CLAUDE.md or any internal docs. They are users, not engineers.
- Agents should NOT look at the source code to understand behavior.
- If an agent gets stuck for more than 2 attempts at a task, they should log it as a
  Blocker and move on rather than debugging.
- Agents are allowed to use browser devtools to check for error messages (a real user
  might do this), but they should not fix anything themselves.
- The confusion log is the product. A test run that surfaces 10 real friction points is
  more valuable than one that "passes" silently.
