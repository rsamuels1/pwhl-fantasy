---
name: roadmap-conventions
description: Roadmap file conventions established during June 2026 audit — Sprint labels, file set, non-existent roadmap-gpt.md
metadata:
  type: feedback
---

During the June 2026 roadmap audit, the following conventions were established:

**Files to keep in sync (3 markdown + 1 HTML):**
- `docs/01-roadmap/roadmap-index.md` — current state + what to build next queue
- `docs/01-roadmap/roadmap-features.md` — full feature cards with status + Sprint labels
- `docs/01-roadmap/roadmap-sprints.md` — sprint history + upcoming sprint plans
- `docs/01-roadmap/roadmap-dashboard.html` — visual HTML tracker (same cadence as markdown)

**roadmap-gpt.md does not exist.** CLAUDE.md previously referenced it — the sync note has been corrected to reference the actual file set above.

**Why:** The file set drifted from what CLAUDE.md described. Using the wrong file list would cause future sync updates to miss the HTML dashboard.

**How to apply:** When CLAUDE.md says "keep roadmap files in sync," update all four files above. Never reference `roadmap-gpt.md` as a target.

**Phase → Sprint:** All feature cards now use `Sprint:` instead of `Phase:` labels. New feature cards must include a Sprint assignment, not a Phase assignment.
