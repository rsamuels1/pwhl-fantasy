# Emoji Policy

**Status:** Active — supersedes DS-002 exit criterion ("no emoji on any surface")  
**Rationale:** Blanket ban contradicts the FEEL brief's warmth directive and made a jargon-heavy app feel colder to the exact audience we're trying to welcome: PWHL fans who are new to fantasy sports.

---

## The Rule: Tiered Use

| Tier | Allowed | Examples |
|------|---------|---------|
| ✅ Celebratory / emotional moments | Yes | 🏆 champion banner, 🎉 draft complete, 🔥 hot streak chip |
| ✅ Onboarding / explainer copy | Yes | 🏒 what this is, ⚡ how you win, 💡 tip callouts |
| ✅ Status indicators — only when paired with a text label | Yes | 🔒 Locked, ⚠ Issue, ✓ Complete |
| ❌ Nav tabs and button labels | Never | No emoji in tab text, CTA text, or link labels |
| ❌ Dense data tables | Never | No emoji in stat rows, standing tables, or score columns |

---

## Why These Rules

**Celebratory moments:** The FEEL brief calls for the app to feel energetic and emotionally resonant after wins. A 🏆 on the champion banner communicates meaning in a way that a styled `<span>` cannot. These are moments where emoji add signal, not noise.

**Onboarding:** First-time fantasy players are intimidated. An emoji reduces cognitive load in a welcome card or explainer by providing visual anchoring before the user reads the label. Use them sparingly — one per card, not one per sentence.

**Status with text:** Accessibility-first rule. An emoji used as the *only* indicator of status fails colorblind and screen-reader users. Always pair: `🔒 Locked`, not just 🔒. The text must carry the full meaning; the emoji is decorative.

**Nav and buttons:** Users tap these constantly. Emoji in interactive controls creates an inconsistent, toy-like feel and can confuse screen readers. The one exception is the lock icon 🔒 on the lineup page — but that appears within a data row, not inside a button label.

**Dense tables:** Standings, stat tables, score columns — these are professional data surfaces. Emoji disrupt scan-reading and add visual weight that slows comprehension.

---

## Current Emoji Inventory (as of June 2026)

These were organically present after the DS-002 sweep and are confirmed compliant:

| Surface | Emoji | Verdict |
|---------|-------|---------|
| WelcomeFlow — "What this is" card | 🏒 | ✅ onboarding |
| WelcomeFlow — "How you win" card | 🏆 ⚡ | ✅ onboarding |
| Draft room — complete banner | 🎉 | ✅ celebratory |
| Draft room — queue star button | ★ | ✅ status with label |
| Matchup page — champion banner | 🏆 | ✅ celebratory |
| Matchup page — recap card (🏁) | 🏁 | ✅ celebratory |
| Lineup page — lock indicator | 🔒 | ✅ status with label |
| Lineup page — zero-games warning | ⚠ | ✅ status with label |
| Commissioner action strip (📣) | 📣 | ✅ status with label |

These were removed by DS-002 and **should be restored**:

| Surface | Emoji | Priority |
|---------|-------|---------|
| Standings — clinched chip | ✓ CLINCHED glyph | P0 — accessibility (not colorblind-safe without glyph) |
| Standings — eliminated chip | ✗ ELIM glyph | P0 — accessibility |
| Standings — bubble chip | ◉ BUBBLE glyph | P1 |
| League overview — activity feed items | 🏒 goal, 📋 waiver | P2 |
| Transaction feed — type badges | 🔄 trade, ➕ add, ➖ drop | P2 |

---

## Do Not

- Use emoji in page `<title>` or `<h1>` headings
- Use emoji in error messages or validation copy
- Use multiple emoji per sentence in body copy ("🏒 Draft your 🏆 team ⚡ now!")
- Use emoji in the nav bar (Overview, Standings, Trades, etc.)
- Use emoji as the *only* differentiator for status (colorblind rule)
