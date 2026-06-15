---
name: project-replay-sim-v2
description: Replay Simulator v2 spec — week-boundary pause, controls on league overview + matchup page, commissioner-only visibility
metadata:
  type: project
---

Spec written 2026-06-14. Location: `docs/02-engineering/replay-simulator-v2-spec.md`.

**Core change:** The `advance-day` route currently auto-advances `replayCurrentDate` past a week boundary when scoring a week. The spec adds a boundary pause: when a matchup week is scored, `replayCurrentDate` is set to `period.endsAt` (not the next game day's midnight), and the UI enters a "Week N complete — set your lineups" state. "Next day →" is hidden. Commissioner must click "Start Week N+1 →" (calls new `action: "start-week"` on the advance endpoint) to resume.

**New component:** `components/ReplayControlsCard.tsx` — card-format wrapper for `ReplayDayBar` controls, embedded in league overview (above playoff race table) and commissioner matchup page (above MatchupHero).

**Visibility rule:** `league.isReplay && user.id === league.commissionerId` — server-side gate only. Regular team owners never see controls. Founders who are not commissioners use the `/founder/leagues/[id]` console instead.

**Playoff handling:** No week-boundary pause during `playoffStatus === "IN_PROGRESS"`. Advance-playoff-round is already commissioner-driven.

**Schema changes:** None. Week-boundary state is represented by `replayCurrentDate === period.endsAt` in the existing `FantasyLeague` model.

**Effort:** S backend (two small route changes), M frontend (new component + 2 page integrations).

**Why:** Day-by-day replay jumps straight from Week N's final game into Week N+1 with no chance to set lineups — breaks the core replay fantasy loop.

**How to apply:** When the engineer asks "what does week-boundary pause mean?", point to the spec. When sequencing sprint work, this is P1 unblocked — all dependencies are shipped.
