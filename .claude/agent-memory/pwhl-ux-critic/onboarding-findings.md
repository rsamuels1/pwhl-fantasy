---
name: onboarding-findings
description: Strengths and gaps in the welcome flow and 7-step create-league wizard for new PWHL fans
metadata:
  type: project
---

**WelcomeFlow** (components/WelcomeFlow.tsx): 3 orientation cards (franchise / Victory Points / two ways to start) + CTAs. Good: explains VP up front, offers "Just exploring? Try a replay league." Gap: "Skip intro" and dismiss fire on EVERY CTA click too, so onboarding can never be seen again after one click — a user who clicks "Start a league" then bails has permanently lost the intro.

**Create-league wizard** (app/create-league/CreateLeagueWizard.tsx): TOTAL_STEPS=7 but progress bar/labels show "Step X of 6" and 6 segments (Name/Size/Season/Rules/Team/Invite). Step 7 is the "done" screen. The off-by-one (7 internal vs 6 shown) is intentional but the labels and the `Math.min(step, TOTAL_STEPS-1)` math are fragile.

Wizard strengths to preserve:
- Step 2 size selector has plain-language notes ("Classic size — easy to fill") and a green "Recommended" chip on 8.
- Step 3 replay vs live has clear icon + description cards and a mode-specific callout.
- Step 4 rules screen has an expandable "How does VP work?" inline (not just a link) AND a full scoring table.
- Replay path short-circuits steps 4-5 correctly and creates the league immediately.

Wizard gaps:
- Step 4 scoring table dumps every multiplier (Goal=2, Assist=1.5, PP=+0.5, SOG=0.5, Hit=0.25, Block=0.5, Win=5, SO=3, Save=0.25, GA=-1) on a NEW fan with zero scaffolding — pure overwhelm. "UTIL (any skater)", "SOG", "PP" used without expansion in the same table that's supposed to onboard.
- Default league name "My PWHL League" and team name "{name}'s Team" are fine defaults but the placeholder examples ("Poulin Power Play") are good and underused elsewhere.
- No "what is a draft / what happens next" primer before the user is dropped at the admin panel. Step 7 prep checklist helps but assumes the user knows what "set up the draft board" means.

How to apply: the wizard is the best-onboarded surface in the app; the DRAFT and the MATCHUP hero are where the onboarding investment falls off a cliff. Recommend carrying the wizard's "explain inline, expandable detail" pattern into the draft room and matchup hero.
