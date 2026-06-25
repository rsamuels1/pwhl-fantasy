# Emoji policy (tiered)

**Supersedes the earlier "remove all emoji" guidance.** The blanket ban made a
jargon-heavy app feel cold to the exact audience we're courting — PWHL fans new
to fantasy. Emoji now follow a **tiered** rule. The authoritative source is
`emoji-policy-source.md` (copied into this bundle); this file is the
implementation cheat-sheet.

## The tiers
| Use | Allowed? | Examples |
|---|---|---|
| Celebratory / emotional moments | ✅ Yes | 🏆 champion banner, 🎉 draft complete, 🏁 recap, 🔥 hot streak |
| Onboarding / explainer copy | ✅ Yes (1 per card) | 💡 tip callout, 🏒 "what this is", ⚡ "how you win" |
| Status indicators **paired with a text label** | ✅ Yes | 🔒 Locked, ⚠ Issue, ✓ Complete, ✓ Clinched, ✗ Out, ◉ Bubble |
| Nav tabs & button/CTA labels | ❌ Never | no emoji in tab text or button text |
| Dense data tables (stat/score columns) | ❌ Never | exception: the 🔒 lock **inside a data row** |

## Hard rules
- **Never** in `<h1>`/page titles, error/validation copy, or nav.
- **Never** as the *only* status signal — always pair with text (colorblind +
  screen-reader rule). `✓ Clinched`, not a bare green dot.
- **One** emoji per card/sentence in body copy — never "🏒 Draft your 🏆 team ⚡".

## What this means for the recolored app
Restore these (they were wrongly stripped):
- **Standings chips** → glyph + label: `✓ Clinched`, `✓ In`, `◉ Bubble`,
  `✗ Out`. (P0 — accessibility; shown in `references/League Overview.dc.html`.)
- **Activity feed** → leading emoji-in-a-tinted-tile: 🏒 goal, ➕ add, ➖ drop,
  🔄 trade, 🏆 playoff/clinch, 📋 waiver. (Shown in the overview reference.)
- **Commissioner action strip** → 📣 + label.
- **Matchup recap** → 🏁 result badge, 🏆 "League-high score".
- **Roster row lock** → 🔒 next to the games-left value (the one table exception).
- **A friendly 💡 explainer** on the matchup page welcomes new fantasy players.

Keep clean (no emoji): nav tabs, the FP/score columns themselves, primary CTAs.

## Reference
`references/Team Matchup.dc.html` and `references/League Overview.dc.html` apply
this policy end-to-end — match their placement and restraint.
