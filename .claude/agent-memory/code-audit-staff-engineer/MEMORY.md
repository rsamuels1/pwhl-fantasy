# Agent Memory Index

- [Audit 2026-06-19](AUDIT_2026_06_19.md) — Post-replay-fix comprehensive audit: 5 medium-severity bugs found (all fixable <2hrs), 0 blockers, GO TO BETA
- [Replay Matchup Bug](project-replay-matchup-bug.md) — "No matchups scheduled" root cause: wrong endpoint routing in ReplaySimulatorControls + startSeason never called in replay creation
- [Season Simulation Audit](SEASON_SIM_AUDIT.md) — Week N+1 SCORING_PENDING + N+2 ACTIVE ordering: valid when schedule has gaps; UX issue is "End week" doesn't auto-jump to next week morning like "start season" does
