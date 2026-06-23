# Plan: Accessibility Color Schemes + Dark/Light Mode

## Context

The current palette ("Minnesota Frost-ish") combines cool blue-navy backgrounds (`#121829`, `#090b12`) with saturated violet (`#7c3aed`). This reads as team colors — a liability for a product that covers all 12 PWHL teams, not just Minnesota. The `Color Scheme Options.dc.html` doc's accessibility-focused section proposes two paired schemes with verified WCAG contrast ratios. This plan adopts them as the dark/light mode pair and adds an OS-aware theme toggle.

**Why change:** The High-Contrast Dark scheme completely escapes the frost read — near-black neutral surfaces + desaturated sky-blue accent (`#8fc1e8`) reads as "sports tech," not any team's palette. The Daylight scheme makes the app usable outdoors and in bright environments for the first time. One note: `#8fc1e8` has a faint Seattle-sky connotation, but it's desaturated enough as an accent that it's safe.

---

## Target Palette

### Dark mode — High-Contrast Dark
| Purpose | Token | Value |
|---------|-------|-------|
| Page base | `--bg` | `#0a0a0c` |
| Card surface | `--card` | `#16181c` |
| Accent | `--accent` | `#8fc1e8` |
| Primary text | `--text` | `#fafbfc` |
| Secondary text | `--muted` | `#c9cfd9` |
| Tertiary text | `--dim` | `#a4abb7` |
| Dividers | `--border` | `rgba(180,188,202,0.16)` |
| Accent fill bg | `--accent-dim` | `rgba(143,193,232,0.22)` |
| Accent outline | `--accent-border` | `rgba(143,193,232,0.40)` |
| Button text on accent | `--accent-btn-text` | `#0a0a0c` |
| WCAG: body text on card | — | **15.1:1 AAA** |
| WCAG: button text on accent | — | **9.2:1 AAA** |

### Light mode — Daylight
| Purpose | Token | Value |
|---------|-------|-------|
| Page base | `--bg` | `#f6f7f9` |
| Card surface | `--card` | `#ffffff` |
| Accent | `--accent` | `#2b5f99` |
| Primary text | `--text` | `#161a21` |
| Secondary text | `--muted` | `#444b58` |
| Tertiary text | `--dim` | `#5a616e` |
| Dividers | `--border` | `rgba(20,30,50,0.12)` |
| Accent fill bg | `--accent-dim` | `rgba(43,95,153,0.12)` |
| Accent outline | `--accent-border` | `rgba(43,95,153,0.30)` |
| Button text on accent | `--accent-btn-text` | `#ffffff` |
| WCAG: body text on card | — | **15.8:1 AAA** |
| WCAG: button text on accent | — | **5.3:1 AA** |

---

## Files to Change

### 1. `app/globals.css` — Token restructure

**Structure:** Replace single `:root` block with two themed blocks + a `@media` CSS-only fallback.

```css
/* Dark is the default (SSR-safe) */
:root { --bg: #0a0a0c; --card: #16181c; --accent: #8fc1e8; ... }

/* User or OS chose light */
[data-theme="light"] { --bg: #f6f7f9; --card: #ffffff; --accent: #2b5f99; ... }

/* No-JS fallback: OS preference drives theme before script runs */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { /* same values as [data-theme="light"] */ }
}
```

**New vars to replace hardcoded inline values in existing CSS rules:**

| New var | Dark | Light | Used by |
|---------|------|-------|---------|
| `--accent-btn-text` | `#0a0a0c` | `#ffffff` | `.button-primary { color }` |
| `--body-bg` | `radial-gradient(…), linear-gradient(#0a0a0c…)` | `#f6f7f9` | `body { background }` |
| `--header-bg` | `rgba(10,10,12,0.82)` | `rgba(246,247,249,0.88)` | `.site-header { background }` |
| `--input-bg` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.03)` | `.input`, `.form-input` |
| `--input-border-color` | `rgba(255,255,255,0.10)` | `rgba(20,30,50,0.14)` | `.input`, `.form-input` |
| `--focus-ring` | `rgba(143,193,232,0.45)` | `rgba(43,95,153,0.40)` | `:focus { border-color }` |
| `--focus-shadow` | `rgba(143,193,232,0.16)` | `rgba(43,95,153,0.16)` | `:focus { box-shadow }` |
| `--pos-badge-bg` | `rgba(143,193,232,0.35)` | `rgba(43,95,153,0.60)` | `.pos-badge` |
| `--scrollbar-thumb` | `rgba(143,193,232,0.30)` | `rgba(43,95,153,0.25)` | `.draft-scroll` |
| `--matchup-chip-bg` | `rgba(143,193,232,0.12)` | `rgba(43,95,153,0.10)` | `.matchup-chip` |
| `--btn-secondary-bg` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.04)` | `.button-secondary` |
| `--btn-secondary-border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.10)` | `.button-secondary` |
| `--section-accent-start` | `#8fc1e8` | `#5b8fc8` | `.section-accent` gradient |
| `--section-accent-end` | `#6aa8d4` | `#2b5f99` | `.section-accent` gradient |
| `--champion-gradient-start` | `#0d1a2a` | `#dce8f5` | `.bracket-champion` |
| `--chip-in-text` | `#bcd9f1` | `#234f80` | `.chip-in { color }` |
| `--score-win` | `#34d399` | `#059669` | future: ScoreDisplay |
| `--score-lose` | `#f87171` | `#dc2626` | future: ScoreDisplay |

Every hardcoded hex/rgba in `globals.css` tied to the old violet/navy palette gets replaced with the matching var.

### 2. `components/ThemeToggle.tsx` — New file

Client component. On mount: reads `localStorage('theme')` → OS preference → defaults to `'dark'`. Clicking toggles dark↔light, writes to localStorage, sets `document.documentElement.dataset.theme`.

Renders a single `<button>` with sun/moon icon in the nav bar.

### 3. `app/layout.tsx` — Three changes

1. **No-flash script** in `<head>` (inline `dangerouslySetInnerHTML`): reads localStorage → OS preference → sets `document.documentElement.dataset.theme` synchronously before CSS paints. Eliminates wrong-theme flash on load.
2. **`suppressHydrationWarning`** on `<html>` tag: required because the script changes `data-theme` before React hydrates.
3. **`<ThemeToggle />`** added to `<nav className="nav-links">` between existing nav items.
4. **`SVG_FAVICON`** purple stop-colors updated to `#8fc1e8` / `#6aa8d4` (new dark accent).

### 4. `components/LogoShield.tsx` — Theme-aware gradient

SVG inline styles support CSS custom properties. Change:
- Gradient stops: `#7c3aed` → `var(--accent)`, `#4c1d95` → `var(--accent-deep)`
- Stroke: `rgba(167,139,250,0.55)` → `var(--accent-border)`
- `LogoWordmark` text: hardcoded `#f3f5fb` → `var(--text)`

---

## Known Gap (Second Pass)

Several component files use hardcoded inline `style={{ color: '#34d399' }}` / `'#f87171'` for score colors (primarily `components/ScoreDisplay.tsx` and matchup page sections). These won't respond to theming from this change alone. The `--score-win` / `--score-lose` vars added in step 1 prepare the ground; a follow-up component audit would wire them up. Light mode will still be fully functional — the colors just won't be the AAA-contrast versions.

---

## Verification

1. `npm run dev` — open browser
2. Toggle the sun/moon button in the nav — all cards, nav, buttons, draft room should flip
3. Reload after toggling — verify no flash (localStorage persisted correctly)
4. DevTools → Rendering → Emulate `prefers-color-scheme: light` — verify it triggers light mode even without JS running the toggle
5. Check `LogoShield` gradient renders in both modes (not solid black or missing)
6. `npx tsc --noEmit` — no type errors
