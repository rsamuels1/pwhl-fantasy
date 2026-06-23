# PWHL GM Rebrand Documentation

**Status:** Ready to implement (post-MVP launch)  
**Timeline:** ~8 hours of development + QA  
**Risk Level:** Zero (all changes are non-breaking)

---

## Overview

This folder contains the complete brand strategy, assessment, and implementation plan for rebranding **PWHL Fantasy** → **PWHL GM** (Professional Women's Hockey League General Manager).

The rebrand repositions the product from "fantasy sports" framing to "professional sports management," emphasizing that users are **General Managers** running **franchises**, not casual fantasy players.

**Key principle:** This rebrand is **intentionally deferred to post-MVP** to ensure no development time is diverted from core functionality. All changes are **cosmetic/copy-only** with **zero product risk** and can be implemented as a final polish sprint.

---

## Contents

### 📋 Documents

1. **`01-branding-brief.md`** — The strategic brief from leadership
   - Brand positioning and long-term vision
   - Visual identity (shield logo, color system)
   - Target audience and tone
   - Preferred terminology and messaging

2. **`02-brand-assessment.md`** — Detailed product review & recommendations
   - Current state vs. target state gap analysis
   - Surface-by-surface implementation guide
   - Phased rollout plan (Tier 1–3 by priority)
   - No-risk verification checklist
   - Complete file list of what needs to change

3. **`emoji-policy.md`** — Tiered emoji usage rules (supersedes DS-002 "no emoji on any surface")
   - When emoji add signal vs. noise
   - Compliant / non-compliant inventory
   - Accessibility rule: always pair with text label

4. **`03-terminology-guide.md`** — Quick copy reference
   - Before/after terminology table
   - Writing tone examples
   - UI-specific copy updates
   - Dos and don'ts for future copy

4. **`04-implementation-checklist.md`** — Task-by-task execution guide
   - Phase 1–4 breakdown with time estimates
   - Specific files to modify
   - QA checklist and testing path
   - Rollback plan (if needed)

### 🎨 Mockups (in `mockups/` folder)

- **`01-rebrand-showcase.html`** — Home page, dashboard, standings, comparison view
- **`02-draft-room.html`** — Live draft room interface with new branding
- **`03-my-matchup.html`** — Weekly matchup/franchise home page

**How to view:** Open any `.html` file directly in your browser. No server needed.

---

## Quick Start: When Ready to Implement

### 1. Review the Brand Direction (15 min)

Read through:
1. `01-branding-brief.md` (executive summary + logo/color system sections)
2. `03-terminology-guide.md` (quick reference table)

### 2. Assign the Work (5 min)

Open `04-implementation-checklist.md` and assign to a developer. Budget: **8 hours total** across 4 phases.

### 3. Execute Phase by Phase (6–8 hours)

```
Phase 1: Core Identity (4h) — Logo, product name, home page
Phase 2: Voice Consistency (2h) — Welcome flow, dashboard, login
Phase 3: Detail Polish (1h) — Modifiers, docs, cleanup
Phase 4: QA & Testing (1h) — Full manual testing
```

### 4. Merge & Deploy (1h)

Run full test suite, QA, and deploy. All changes are backward-compatible.

---

## Key Changes at a Glance

### What Changes

| Item | Before | After |
|------|--------|-------|
| Product name | PWHL Fantasy | PWHL GM |
| Logo | "HF" text | Shield + "GM" SVG |
| Hero headline | "Draft your team. Win every week." | "Think Like a GM." |
| Terminology | Fantasy team, fantasy pts | Franchise, pts |
| Admin label | Settings / Admin Panel | Front Office |

### What Stays the Same

- All database schema (zero migrations)
- All API routes and logic
- Draft server and WebSocket protocol
- Scoring engine and calculations
- Waiver wire mechanics
- Matchup generation and scoring
- User authentication
- All tests (no logic changes)

**Bottom line:** Users see a rebranded surface; nothing under the hood changes.

---

## Why This Timing?

### Why Post-MVP?

1. **Zero functionality risk** — We don't modify code that runs features, only UI copy/assets
2. **Development velocity** — Rebrand work doesn't block feature work
3. **Stability** — Ship MVP with proven functionality, then polish the brand
4. **Focus** — Team stays focused on draft room, scoring, playoffs, notifications
5. **Validation** — Live with current branding first, validate product/market fit before investing in brand polish

### Why Now (Plan It)?

- Clear strategy reduces scope creep later
- Mockups provide visual validation before coding
- Terminology guide prevents brand confusion in future copies
- Implementation checklist makes execution fast and reversible

---

## The Brand Story

### Current Positioning (PWHL Fantasy)
"Fantasy sports app for PWHL fans. Draft players, accumulate points, compete."

**Impression:** Casual gaming, DFS-adjacent, luck-based.

### New Positioning (PWHL GM)
"Professional sports management platform. Scout talent, build a championship franchise, lead your team through a full season as a General Manager."

**Impression:** Executive/strategic, professional league-aligned, skill-based decision making.

### Why It Matters

- **Partnerships:** Official PWHL positioning becomes credible for sponsorship/media deals
- **User mental model:** "I'm running a hockey organization" beats "I'm playing a fantasy game"
- **Premium tier potential:** "Executive" features positioned as professional tools, not game add-ons
- **Long-term vision:** Positions the product as a league affiliate, not a gaming side project

---

## Design Highlights in Mockups

### 1. Rebrand Showcase (`01-rebrand-showcase.html`)
Shows the transformation across key surfaces:
- New hero with "Think Like a GM" positioning
- Dashboard with franchise cards
- Standings with playoff race
- Before/after terminology comparison

### 2. Draft Room (`02-draft-room.html`)
Live draft interface showcasing:
- Shield + GM logo in header
- Professional draft clock
- Pick board and available players
- Roster needs tracker
- Recent picks timeline

### 3. My Matchup (`03-my-matchup.html`)
In-season franchise home showing:
- Matchup hero with win probability
- Playing tonight section
- Swing players analysis
- Roster comparison
- League activity feed

**All mockups feature:**
- Smooth animations and transitions
- Professional sports league aesthetic
- Responsive design (mobile-friendly)
- Interactive elements (hover states, live updates)

---

## Terminology Philosophy

### Frame Users As Executives, Not Players

| Don't | Do | Why |
|------|----|----|
| "Fantasy player" | "General Manager" | Positions authority and strategy |
| "Draft players" | "Scout & Draft" | Emphasizes evaluation, not luck |
| "Accumulate points" | "Build a championship roster" | Goal-oriented vs. score-chasing |
| "Win the league" | "Win the championship" | Professional/prestigious positioning |

### Avoid Fantasy/Gaming Language

✅ Use: Scout, Draft, Manage, Lead, Build, Championship, Franchise, Front Office, Strategic  
❌ Avoid: Fantasy, Gamble, Pick (without context), Arcade, Gaming, Casual

### Maintain Professional Tone

Every user-facing string should sound like a sports league executive tool, not a video game or betting app.

---

## Implementation Phases

### Phase 1: Core Identity (4 hours)
- Create and integrate shield + GM logo
- Update product name globally
- Rewrite home page hero
- Update favicon and PWA icons

**Result:** Recognizable rebrand (users immediately see it's "PWHL GM")

### Phase 2: Voice Consistency (2 hours)
- Welcome flow rewrite
- Dashboard section headers
- Login page pitch
- Admin panel nav label (optional)

**Result:** Consistent executive positioning across all surfaces

### Phase 3: Detail Polish (1 hour)
- Remove "fantasy" modifiers from UI
- Update CLI/script output
- Update documentation
- Full test suite pass

**Result:** Zero technical debt, all tests green

### Phase 4: QA & Testing (1 hour)
- Full user journey testing
- Regression testing
- Mobile breakpoint verification
- Pre-deploy checklist

**Result:** Ship with confidence

---

## Key Metrics for Success

After rebrand deployment, monitor:

1. **No errors** — 0 branding-related exceptions/logs for 24h
2. **User feedback** — Positive sentiment on brand positioning (survey if applicable)
3. **Functionality** — All features work identically to pre-rebrand
4. **Performance** — No performance regression from logo SVG/CSS changes
5. **Analytics** — Sessions tracked correctly, no interruption

---

## Risk Mitigation

### Why This Is Zero Risk

1. **Text-only changes** — No database schema modifications
2. **CSS/SVG only** — No logic changes, purely presentational
3. **Immediately reversible** — `git revert` rolls back instantly
4. **Comprehensive QA** — Checklist covers all high-use paths
5. **No customer impact** — Existing teams/leagues unaffected

### Rollback Plan

If critical issue found:

```bash
git revert <rebrand-commit>
git push origin main
# Redeploy previous version
# Time to rollback: 5 minutes
```

---

## FAQ

### Q: Why not rebrand before MVP launch?
**A:** MVP is about validating the product works. Rebrand is about validating the market positioning. Do one thing well before adding cosmetics.

### Q: Will this break existing leagues/rosters?
**A:** No. Zero schema changes, zero API changes. Old data is unaffected.

### Q: Can we do this mid-season if needed?
**A:** Yes. All changes are cosmetic. Active leagues would see the new branding on next login but experience no functional change.

### Q: What if we want to adjust the brand after launch?
**A:** That's the point of deferring. Launch MVP, gather feedback, iterate on brand positioning before making these changes permanent.

### Q: Do we need to notify users about the rebrand?
**A:** Optional. A simple announcement ("We're now PWHL GM — same great management platform, new name") is sufficient. No migration steps needed.

### Q: What about old bookmarks/links?
**A:** URLs remain the same (no route changes). Old bookmarks continue to work. Search engines update naturally.

---

## Success Criteria

### Pre-Rebrand
- [ ] MVP launched and stable
- [ ] Core features validated (draft, scoring, matchups)
- [ ] User feedback collected
- [ ] Team ready for polish sprint

### Post-Rebrand
- [ ] Product name globally updated
- [ ] Logo visible and professional
- [ ] Copy tone consistent across surfaces
- [ ] All tests passing
- [ ] Zero functional regressions
- [ ] User feedback on brand positioning positive

---

## Next Steps (When Ready)

1. **Review mockups** with team/stakeholders → validate direction
2. **Assign implementation** to developer → start Phase 1
3. **Execute checklist** phase by phase → 8 hours of focused work
4. **QA & deploy** → ship with confidence
5. **Monitor** for 24h → ensure zero issues
6. **Celebrate** → ship a polished product

---

## Contact & Questions

For questions on:
- **Brand strategy:** See `01-branding-brief.md`
- **What to implement:** See `02-brand-assessment.md`
- **Copy/tone:** See `03-terminology-guide.md`
- **Step-by-step execution:** See `04-implementation-checklist.md`
- **Visual examples:** Open `mockups/*.html` in browser

---

## File Structure

```
docs/branding/
├── README.md                          (this file)
├── 01-branding-brief.md              (brand strategy & visual identity)
├── 02-brand-assessment.md            (gap analysis & detailed recommendations)
├── 03-terminology-guide.md           (quick copy reference)
├── 04-implementation-checklist.md    (task-by-task execution)
└── mockups/
    ├── 01-rebrand-showcase.html      (landing page showcase)
    ├── 02-draft-room.html            (draft room interface)
    └── 03-my-matchup.html            (matchup/franchise page)
```

---

**Last Updated:** June 2026  
**Status:** Ready for post-MVP implementation  
**Owner:** Product Management  
**Stakeholders:** Engineering, Design, Marketing

---

## Version History

| Date | Change |
|------|--------|
| June 2026 | Initial brand assessment and mockups created; documentation compiled |

---

*This rebrand is scheduled for **post-MVP launch** to protect development velocity. All materials are complete and ready to execute on a single sprint.*
