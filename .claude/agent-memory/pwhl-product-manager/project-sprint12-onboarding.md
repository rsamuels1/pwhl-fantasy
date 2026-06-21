---
name: sprint12-onboarding
description: Sprint 12 planned — Onboarding & First-Run UX from Pass 5 design critique; 9 stories OB-001–009; 4 P0 items are launch blockers
metadata:
  type: project
---

Sprint 12 is PLANNED — "Onboarding & First-Run UX" — sourced from Pass 5 design critique at `docs/branding/pass5-design-critic.md`.

13 friction points in the first-time league-creation flow identified. Converted to 11 new stories (OB-001–011). 2 deferred to Sprint 13 (OB-010, OB-011).

**Why:** First-time user walkthrough showed the wizard CTA goes to /login not /register, VP scoring is introduced in step 4 with no explanation, team creation at step 5 is unannounced, and canceling after step 4 silently orphans the league.

**P0 items (High severity — must ship before public launch):**
- OB-001: "Start your franchise" → /register (not /login); `app/page.tsx`
- OB-002: VpExplainer inline in wizard step 4; UTIL tooltip
- OB-003: Note at step 4 warning team creation (step 5) is coming; update step counter to 7
- OB-004: Confirm dialog when Cancel clicked after step 4 (league already exists in DB)

**P1 items (Medium severity):**
- OB-005: Remove QuickDraftJoinForm from public home page
- OB-006: Show Replay mode description upfront (not after clicking)
- OB-007: Login pitch "8 teams" → "12 teams"
- OB-008: Drop confirm-password field; add show/hide toggle
- OB-009: Add scoring chip row to wizard step 4 ("Goal 2 pts · Assist 1.5 pts…")

**Deferred to Sprint 13:**
- OB-010 (P1, M): Wizard progress bar wrong for Replay (6 segments, but skips step 4)
- OB-011 (P2, S): Draft date picker has no anchor — replace with note when schedule TBD

**How to apply:** Sprint 12 exit criteria is that a first-time visitor can click "Start your franchise →", create an account, and complete the wizard without hitting confusing jargon or unexpected screens. These are all copy/layout changes — no schema changes.

**Critique items already covered (not new stories):**
- Critique #10 (Display name "(optional)" in label) → covered by UX-003 ✅ DONE

**Highest OB-NNN used:** OB-011. Next new story should be OB-012.
**Highest UX-NNN in features:** UX-045. Next new UX story should be UX-046.

Related: [[sprint6-shipped]], [[feedback-roadmap-conventions]]
