---
name: vtf-field-model
description: The regular-season "vs the field" (VTF) scoring model and why it disorients new fantasy players
metadata:
  type: project
---

Regular-season matchups are VTF (vs-the-field): there is NO single head-to-head opponent. The matchup hero (`FieldHero` in app/team/[teamId]/matchup/page.tsx) shows ONE score and a "W-L vs field" record, plus a weekly standings list. Playoffs switch to 1v1 (`DuelHero`) with a real opponent and win-probability bar.

Why it confuses new fans:
- Every mainstream fantasy product (and the app's own home-page mockup and login pitch — "Weekly matchups / Head-to-head scoring every week") trains the user to expect ONE opponent. Then the real product shows them a leaderboard. The mental model breaks.
- "W-L vs field" is never defined inline. A new fan sees e.g. "3–4" and cannot tell whether they played 7 opponents, 7 weeks, or something else. (It's: this week you beat 3 teams' scores, lost to 4.)
- The home/login marketing PROMISES head-to-head, the product delivers field-ranking most weeks, then playoffs deliver true head-to-head. Three different mental models in one season with no transition explainer.

How to apply: any VTF surface needs a one-line "you're not playing one team — you're racing everyone's score this week" explainer on first exposure. Flag any copy that says "head-to-head" for the regular season as actively misleading. The playoff transition from field to single-opponent also needs a heads-up moment.
