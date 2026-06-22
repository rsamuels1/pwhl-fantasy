---
name: project-sprint15-design-system
description: Sprint 15 Visual Design System Deep Pass — COMPLETE Jun 22, 2026; 3 DS stories + 3 Sprint 13 items shipped in same batch
metadata:
  type: project
---

Sprint 15 "Visual Design System Deep Pass" shipped Jun 22, 2026. Pure visual layer — zero logic, API, or schema changes.

**Why:** The REBRAND-004 token system (Sprint 9) established design tokens but left several pages still using old inline colors and emoji. Sprint 15 applied those tokens site-wide.

3 stories shipped:
- DS-001: Homepage complete rewrite + sticky full-width header (two-column hero, 6-card feature grid, SVG icons, radial-glow CTA band). `app/page.tsx`, `app/layout.tsx`, `app/globals.css`.
- DS-002: Token sweep across 7 files — old win color `#34d399` → `#5fa98c`, old loss color `#f87171` → `#d18b7f`; all emoji on UI surfaces replaced with colored text chips or inline SVG. `TransactionFeed` TYPE_ICONS map → TYPE_META chips.
- DS-003: League overview + WeekHighlights full redesign — `var(--card)`/`var(--border)` tokens, `cardLabel()`/`sideLabel()` helpers replacing `sectionTitle` constant, gradient My Matchup widget with `font-stats` score + win-rate bar, `ACT_META` colored chips in activity feed, storyline cards get left-border color accent by kind.

**Sprint 13 partial items also shipped in the same commit batch (4b67b44):**
- BF-008 ✅ — negative timestamps fixed (`Math.max(0,...)` in TransactionFeed)
- OB-001 ✅ — "Start Your Franchise" CTA routes to `/register`
- OB-008 ✅ — registration form show/hide password toggle (`app/register/page.tsx`)

Sprint 13 is now 3/14 items complete (BF-008, OB-001, OB-008). Remaining 11 items are still in progress.

**How to apply:** When referencing Sprint 13 status, note it is 3/14 shipped — not 0/14. Sprint 15 is a complete separate sprint in the history table alongside Sprint 13 being still in progress.

[[project-sprint13-14-plan]]
