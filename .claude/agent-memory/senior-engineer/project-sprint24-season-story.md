---
name: project-sprint24-season-story
description: Sprint 24 Living League Season Story — 5 stories implemented (LL-006, LL-010, LL-011, LL-012, LL-023)
metadata:
  type: project
---

Sprint 24 "Living League: Season Story" — all 5 stories shipped, no schema changes.

**LL-006: Season Timeline** — Schedule page (`/team/[teamId]/schedule`) already had `getWeeklyPerformance` table. Added a summary header (Record W-L-T, Total FP, Weeks Played) above the weekly table. Page title updated to "My Season".

**LL-010: League Record Book** — New page at `/league/[leagueId]/records/page.tsx`. Uses `requireAuth` + `requireLeagueMember` (member-accessible, not commissioner-only). "Records" nav link added to `app/league/[leagueId]/layout.tsx` navItems (between Playoffs and Rosters). Records: highest weekly team score, best season record (VTF wins), biggest blowout, best individual player weeks (StatLine aggregation per player per week). Empty state when no results yet.

**LL-011: Team Name Editing** — New API route `PATCH /api/leagues/[leagueId]/teams/[teamId]/name/route.ts`. New `TeamNameEditor.tsx` client component (inline edit, Save/Cancel, 50-char limit, keyboard shortcuts). Wired into `app/team/[teamId]/settings/page.tsx` replacing static name display.

**LL-012: Manager Superlatives** — Pure `computeSuperlatives()` function in `lib/services/superlatives.ts`. Awards: Top Scorer, Feast or Famine (highest variance), Steady Eddie (lowest variance, non-overlap), Hot Start (first half), Strong Finish (second half). `SuperlativesCard.tsx` server component. Added to both league overview (`/league/[leagueId]/page.tsx` sidebar) and analysis page (`/team/[teamId]/analysis/page.tsx` top callout for this team's own awards).

**LL-023: Empty States** — Updated `TradeCenter.tsx` (incoming/sent/history tabs with personality copy + icons), `TransactionFeed.tsx` (empty state with icon), `analysis/page.tsx` (two empty states updated with fan-first copy, "Set Lineup →" now links to `/team/[teamId]/roster`).

**Why:** No schema changes needed. All work with existing Matchup/FantasyTeam/StatLine data.

**How to apply:** When building future season-summary features, `getWeeklyPerformance` in `lib/services/performance-service.ts` is the authority for weekly FP/rank/record data. `computeSuperlatives` is pure and reusable — feed it teams + matchups arrays from any context.
