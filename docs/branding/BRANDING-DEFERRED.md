# Branding Rebrand: Deferred to Post-MVP

**Date Created:** June 2026  
**Decision:** DEFER all branding work until after MVP launch  
**Rationale:** Protect development velocity; ensure no functionality is compromised

---

## What This Means

The **PWHL Fantasy → PWHL GM rebrand** is strategically deferred until after the MVP is live and stable.

### Current State
- Product is branded as **"PWHL Fantasy"**
- All copy, UI, and assets use fantasy-sports framing
- Internally validated to work correctly

### Why Defer?
1. **Zero functionality impact** — This is 100% cosmetic/copy work
2. **Protect velocity** — MVP development stays uninterrupted
3. **Validate product first** — Launch the app, gather real user feedback, then polish the brand
4. **Risk-free execution** — All changes can be done in parallel or as final polish sprint
5. **Easy to time-box** — Rebrand is ~8 hours of isolated work (one sprint)

### What We're NOT Doing (Until Post-MVP)
- Changing product name from "PWHL Fantasy" to "PWHL GM"
- Implementing the shield + GM logo
- Rewriting home page hero copy
- Updating admin panel labels
- Changing terminology across the UI

### What We ARE Doing Now (During MVP)
- Building features that work correctly
- Shipping draft room, scoring, matchups, playoffs
- Validating the product with real users
- Iterating on functionality based on feedback

---

## When to Execute

### Trigger: Post-MVP Launch

Execute the rebrand when:
- ✅ MVP is live and stable
- ✅ Initial user cohort has completed at least one draft
- ✅ Core features (draft, scoring, matchups) are validated
- ✅ No critical bugs in active development
- ✅ Team has capacity (not mid-sprint)

**Estimated timeline:** 1–2 weeks after MVP launch (one focused sprint)

---

## What's Ready to Go

Everything needed to execute the rebrand is **already documented and designed**:

- **Brand strategy** (`01-branding-brief.md`) — what the rebrand is and why
- **Implementation guide** (`02-brand-assessment.md`) — detailed gap analysis and recommendations
- **Terminology reference** (`03-terminology-guide.md`) — copy before/after for every surface
- **Execution checklist** (`04-implementation-checklist.md`) — task-by-task with time estimates
- **Visual mockups** (`mockups/`) — three interactive HTML mockups showing the rebrand
- **README** (`README.md`) — high-level overview and quick-start guide

**All in:** `docs/branding/`

---

## Key Commitments

When we execute the rebrand, we commit to:

1. **No functionality changes** — Users see a new brand, features work identically
2. **Zero schema/API changes** — No database migrations, no backend rework
3. **Backward compatible** — Old bookmarks, existing teams, all data persist
4. **Fast execution** — 8 hours of focused development + QA
5. **No user impact** — Existing leagues/seasons continue unaffected

---

## For the Development Team

### Between Now and Rebrand

- ✅ Do NOT use "PWHL GM" in code or copy yet (stay with "PWHL Fantasy")
- ✅ Do NOT design a new logo or favicon (use placeholder "HF")
- ✅ Do NOT rewrite home page hero copy
- ✅ DO keep new copy/UX consistent in tone with brand assessment (`03-terminology-guide.md`) for whenever this lands
- ✅ DO focus on shipping features that work

### When Rebrand Sprint Starts

1. Assign to one developer (~8 hours)
2. Work through `04-implementation-checklist.md` phase by phase
3. Full QA with the testing checklist
4. Merge and deploy
5. Monitor for 24h
6. Done! Polished product ready for scale

---

## FAQ: Rebrand Deferral

### Q: Won't users be confused by "PWHL Fantasy"?
**A:** No. The product name is secondary to product quality. Ship a great MVP, then polish the brand. Early users care about functionality, not wordmark design.

### Q: What if we launch and hate the branding?
**A:** Perfect timing — execute the rebrand immediately after MVP launch while momentum is high. We'll have real user feedback to inform the messaging.

### Q: Can we change our mind about the rebrand?
**A:** Yes. The deferral gives us runway to gather user feedback on the current brand. If the market validates "PWHL Fantasy" positioning, we can skip the rebrand entirely.

### Q: What if we need to rebrand mid-season?
**A:** No problem. All changes are cosmetic. Active users would see the new brand on next login with zero disruption.

### Q: Do we need to tell users about this deferral?
**A:** No. This is an internal decision. Ship MVP with current branding, rebrand later as a polish update.

---

## Approval & Sign-Off

**Decision Made By:** Product Management  
**Approved By:** [Engineering Lead, Product Lead]  
**Date:** June 2026  
**Status:** DEFERRED (not canceled)

---

## Checklist: When Ready to Execute

When the MVP is stable and the rebrand sprint is greenlit:

- [ ] Open `docs/branding/04-implementation-checklist.md`
- [ ] Assign to one developer
- [ ] Allocate 8 hours (one day or split across 2–3 days)
- [ ] Follow each phase sequentially
- [ ] Execute QA checklist
- [ ] Merge and deploy
- [ ] Monitor for 24h
- [ ] ✅ Ship polished PWHL GM brand

---

## Quick Navigation

**For the rebrand work:**
- [Start here](./README.md) — High-level overview
- [Brand strategy](./01-branding-brief.md) — Why we're rebranding
- [What to change](./02-brand-assessment.md) — Detailed recommendations
- [Copy reference](./03-terminology-guide.md) — Before/after terminology
- [Execution plan](./04-implementation-checklist.md) — Step-by-step tasks
- [Visual examples](./mockups/) — Interactive HTML mockups

**For current development:**
- DO NOT use rebranded copy yet
- DO reference `03-terminology-guide.md` if writing new copy (match the professional tone)
- DO keep the "HF" placeholder logo
- DO focus on shipping working features

---

**Rebrand Status:** ✅ Planned, Documented, Ready to Execute  
**Rebrand Timeline:** Post-MVP (deferred 1–2 weeks)  
**Rebrand Risk:** Zero (cosmetic/copy only)  
**Rebrand Effort:** 8 hours  

**Current Focus:** MVP features (draft, scoring, matchups, playoffs)  
**Current Branding:** PWHL Fantasy (unchanged until rebrand sprint)

---

*This document serves as a reminder that the rebrand work is intentionally deferred, fully planned, and ready to execute when the MVP is stable and the team has capacity.*
