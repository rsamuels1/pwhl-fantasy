---
name: emoji-policy
description: The "no emoji" DS-002 ban is dead in practice and contradicts the FEEL brief; recommended tiered policy
metadata:
  type: project
---

Sprint 15 DS-002 set an exit criterion "No emoji on any UI surface" (aesthetic-only, no
technical reason). As of 2026-06-23 this is FALSE — emoji organically returned to the right
places and the policy is effectively dead.

**Why:** `docs/branding/branding-brief-v2.md` (dated 6/21/26, self-declared "source-of-truth
for how we make people FEEL") *prescribes* emoji in emotional copy (🔥 rivalry, 🎉 big week,
💙 tough stretch, 👋 welcome). DS-002 stripped them the next day. The two briefs contradict;
v2 wins by date and by audience intent (casual PWHL fan who finds fantasy intimidating).
Brutal expert critic in `pass6-design-critic.md` praised emoji touches, never complained.

**Current de-facto state (close to correct, but undocumented/accidental):**
- KEEP emoji: WelcomeFlow (🏒🏆⚡ card icons), wizard RuleRows, draft room (🎉 complete, ★ queue),
  matchup page (🏆 champion, 🏁 recap, League-high celebration), lineup (🔒 locked, ⚠ alert).
- NO emoji: standings page, league overview (use → arrows only).

**Recommended tiered policy (not blanket ban, not blanket permission):**
1. Celebratory/emotional moments → YES (🏆 🎉 🏁 🔥 💙)
2. Onboarding / empty / explainer → YES (🏒 ⚡ 💡)
3. Status WITH meaning → YES, always paired with text (🔒 ⚠ ✓)
4. Nav / tabs / buttons → NO (arrows are fine, not emoji)
5. Dense data tables → NO

**Accessibility flag (fix regardless of emoji decision):** standings playoff chips
(`app/league/[leagueId]/standings/page.tsx` ~line 188) differ by color only (green IN /
red ELIM / amber BUBBLE) — fails colorblind users. Add a glyph or non-color cue.

**How to apply:** When reviewing any new UI, judge emoji against the table above, not the
dead "no emoji" rule. Flag color-only signals everywhere (see [[jargon-inventory]] for the
parallel comprehension issues on these same dense surfaces).
