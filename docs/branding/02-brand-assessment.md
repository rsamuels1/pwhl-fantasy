# PWHL GM Brand Assessment & Recommendations

**Date:** June 2026  
**Status:** Ready for implementation (post-launch)

## Executive Summary

The PWHL GM rebrand repositions the product from "fantasy sports" framing to "professional sports management." This document captures the strategic gap analysis, implementation priorities, and detailed recommendations from the product management review of the branding brief.

---

## 1. Current State vs. Target State: Gap Analysis

The current product has the right visual foundation (dark navy/purple palette, clean typography, professional layout) but uses language and branding that read "fantasy sports app" rather than "professional sports management platform."

### Key Gaps

| Dimension | Current | Target | Priority |
|-----------|---------|--------|----------|
| Product name (everywhere) | "PWHL Fantasy" | "PWHL GM" | **HIGH** |
| Global header wordmark | "PWHL Fantasy" text | Shield + "PWHL GM" | **HIGH** |
| Home page hero | "Draft your team. Win every week." | "Think Like a GM" | **HIGH** |
| Logo/favicon | "HF" text placeholder | Shield + GM monogram | **HIGH** |
| Welcome flow | "Fantasy hockey for the PWHL" | "Think Like a GM" positioning | **HIGH** |
| Dashboard headers | "My Leagues" | "My Franchises" (optional) | **MEDIUM** |
| Language overall | "fantasy team", "fantasy pts" | "franchise", "pts" | **MEDIUM** |
| Admin panel nav | "Settings" / "Admin Panel" | "Front Office" | **LOW** |

### Color System Assessment

✅ **85% aligned** with brief:
- Background: Dark navy (#0b111f) ✓
- Accent: Indigo/purple (#6366f1) ✓
- Text: White (#f8fafc) ✓

⚠️ **Minor flag:**
- Hero eyebrow currently uses green (#22c55e) — recommend shifting to purple accent to avoid DFS/betting aesthetic

---

## 2. Surface-by-Surface Implementation Recommendations

### Tier 1: Identity Establishment (Highest Impact)

These changes are **text substitutions with zero product risk** and establish the core brand identity.

#### 2.1 Global Wordmark Replacement

**Files affected:** 10–12 surfaces across the entire app  
**Effort:** Text substitutions only  
**Risk:** Zero  

Changes:
- `app/layout.tsx` — `<title>PWHL Fantasy</title>` → `<title>PWHL GM</title>`
- `app/layout.tsx` — meta description updated
- `app/layout.tsx` — header wordmark "PWHL Fantasy" → "PWHL GM"
- All page headers and nav
- Login/register pages eyebrow
- Welcome flow component
- Draft room header

**Implementation:** Bulk find-replace "PWHL Fantasy" → "PWHL GM" across the codebase.

#### 2.2 Logo Asset (Shield + GM)

**Files affected:** `components/LogoShield.tsx` (new), favicon, app icon  
**Effort:** Design + implementation  
**Risk:** Zero  

The current `HF` placeholder in `.site-brand span` should be replaced with an SVG shield containing "GM":

```tsx
// Expected structure
<svg viewBox="0 0 40 40" className="shield-logo">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#6366f1" />
      <stop offset="100%" stopColor="#4f46e5" />
    </linearGradient>
  </defs>
  <path d="M20 2L8 8V18C8 28 20 36 20 36C20 36 32 28 32 18V8L20 2Z" 
        fill="url(#shieldGrad)" stroke="rgba(99,102,241,0.3)" strokeWidth="1"/>
  <text x="20" y="24" fontSize="14" fontWeight="bold" fill="white" 
        textAnchor="middle" dominantBaseline="middle">GM</text>
</svg>
```

Update favicon and PWA icon to use the shield logo.

#### 2.3 Home Page Hero Rewrite

**File:** `app/page.tsx`  
**Effort:** Copy changes + one CSS variable update  
**Risk:** Zero  

Current:
```
Hero headline: "Draft your team. Set your lineup. Win every week."
Eyebrow: "PWHL Fantasy Hockey"
Hero sub-copy: "The first fantasy platform built for PWHL fans. Draft real stars, compete in head-to-head matchups, and follow every goal with something on the line."
```

Target:
```
Hero headline: "Think Like a GM."
Eyebrow: "PWHL General Manager"
Hero sub-copy: "The management platform built for PWHL fans. Scout players, build a championship roster, and compete for the title — every week."
```

Optional: Change hero eyebrow text color from `var(--green)` to `var(--accent)` (purple) to remove DFS/betting visual cues.

---

### Tier 2: Voice Consistency (Medium Impact)

These changes reinforce the management/executive positioning on key user-facing surfaces.

#### 2.4 Welcome Flow Rewrite

**File:** `components/WelcomeFlow.tsx`  
**Current state:**
- Title: "Welcome to PWHL Fantasy"
- Eyebrow: "Fantasy hockey for the PWHL"
- Card descriptions: Frame the experience as gaming

**Target state:**
- Title: "Welcome to PWHL GM"
- Eyebrow: "Think Like a GM."
- Card descriptions: Frame experience as managing a hockey organization

**Effort:** Copy rewrite + optional icon swap  
**Risk:** Zero (UI structure unchanged)

#### 2.5 Dashboard Section Headers

**File:** `app/dashboard/page.tsx`  
**Changes:**
- "My Leagues" remains (acceptable, unambiguous)
- "Your teams" section label → "Your Franchises" (optional, high visibility)
- Action item copy review (most is already well-positioned)

**Effort:** 2–3 text substitutions  
**Risk:** Zero

#### 2.6 Login Page Pitch

**File:** `app/login/page.tsx` (left column marketing copy)  
**Current:** "Score points from real PWHL game stats every week. Create a league, draft stars, and compete for the championship."  
**Target:** "Scout players. Build a championship roster. Lead your franchise through a full PWHL season."

**Effort:** Copy rewrite  
**Risk:** Zero

---

### Tier 3: Detail Polish (Low Impact, Higher Effort)

These changes are correctness/polish tweaks with lower brand impact.

#### 2.7 Remove "fantasy" Modifiers

**Files:** `app/page.tsx`, `app/team/[teamId]/roster/RosterManager.tsx`  
**Changes:**
- "fantasy pts" → "pts" or remove modifier entirely
- "fantasy team roster" → "franchise roster" (in descriptions only)

**Effort:** 2–3 replacements  
**Risk:** Zero

#### 2.8 Admin Panel Navigation

**File:** `app/league/[leagueId]/layout.tsx` (line ~91)  
**Change:** Nav item "Settings" or "Admin Panel" → "Front Office" (optional)  
**Why:** Reinforces GM/executive framing; commissioner is running the "front office"

**Effort:** Single-line change  
**Risk:** Zero (UI structure unchanged)

#### 2.9 "How It Works" Steps on Home Page

**File:** `app/page.tsx`  
**Reframe:** Change action verbs from gaming to management posture

```
Before                 →    After
Create League         →    Form Your League
Draft Players         →    Scout & Draft
Set Your Lineup       →    Manage Your Roster
Win Matchups          →    Lead Your Franchise
```

**Effort:** Copy rewrite  
**Risk:** Zero

#### 2.10 Terminal/CLI Branding (if applicable)

**Files:** `README.md`, command output in scripts  
**Change:** "PWHL Fantasy" → "PWHL GM" where visible

**Effort:** Minimal  
**Risk:** Zero

---

## 3. Terminology Reference Guide

### Required Changes (High Visibility)

| Current | Target | Context | Priority |
|---------|--------|---------|----------|
| PWHL Fantasy | PWHL GM | Product name (everywhere) | **HIGH** |
| PWHL Fantasy Hockey | PWHL General Manager | Tagline/descriptor | **HIGH** |
| fantasy pts | pts | UI labels | **MEDIUM** |
| HF | Shield+GM | Logo/favicon | **HIGH** |

### Recommended (Lower Visibility)

| Current | Target | Context | Priority |
|---------|--------|---------|----------|
| Fantasy Hockey | Professional Management | Prose descriptions | **MEDIUM** |
| Your teams | Your Franchises | Dashboard section (optional) | **LOW** |
| My Team | My Franchise | Team dropdown labels | **LOW** |
| Admin Panel | Front Office | Nav label (optional) | **LOW** |

### Keep As-Is (Brief-Approved)

These terms are explicitly in the branding brief as acceptable or preferred:

- Commissioner
- Draft Room / Draft
- Matchup
- Roster
- Playoffs / Bracket / Championship
- Waiver Wire / Free Agents
- League
- Front Office (new approved term for admin)

---

## 4. Phased Implementation Plan

### Phase 1: Pre-Launch Foundation (Week before launch)

**Goal:** Establish core identity with zero risk.

- [ ] Implement Shield + GM logo SVG
- [ ] Update browser `<title>` and meta description
- [ ] Global wordmark: "PWHL Fantasy" → "PWHL GM" (find-replace)
- [ ] Rewrite home page hero copy
- [ ] Update favicon + PWA icon
- [ ] Test all pages load correctly with new branding

**Time estimate:** 4–6 hours  
**Risk level:** Zero (all changes are cosmetic/reversible)

### Phase 2: Voice Consistency (Week 1 Post-Launch)

**Goal:** Reinforce executive positioning without impacting functionality.

- [ ] Welcome flow headline + copy updates
- [ ] Dashboard "Your Franchises" label (if desired)
- [ ] Login page pitch rewrite
- [ ] "How It Works" step copy refresh
- [ ] QA: Ensure no copy cuts off, no UI breaks

**Time estimate:** 2–3 hours  
**Risk level:** Zero

### Phase 3: Polish & Edge Cases (Week 2 Post-Launch)

**Goal:** Consistency in secondary surfaces.

- [ ] Remove "fantasy pts" modifiers (2–3 places)
- [ ] Admin nav: "Settings" → "Front Office" (optional)
- [ ] CLI/script output branding
- [ ] Documentation updates (README, CLAUDE.md)
- [ ] Verify analytics event names don't reference "fantasy"

**Time estimate:** 1–2 hours  
**Risk level:** Zero

### Phase 4: Verification & Iteration (Week 3 Post-Launch)

**Goal:** Catch any missed surfaces and user feedback.

- [ ] Manual QA: Full user journey (login → draft → matchup → standings)
- [ ] Check all email templates if applicable
- [ ] Verify mobile nav displays correctly with new branding
- [ ] Collect user feedback on terminology
- [ ] Iterate on any confusing language

**Time estimate:** 1–2 hours  
**Risk level:** Zero

---

## 5. No-Risk Verification Checklist

Before finalizing each phase, verify:

- ✅ All pages load without errors
- ✅ Links still work (no broken href to old brand assets)
- ✅ Mobile breakpoints still function
- ✅ No console errors
- ✅ Search/filter still work (especially Available Players in draft room)
- ✅ API routes unchanged (no backend touches)
- ✅ All tests pass (no logic changes, only copy)
- ✅ Draft room still functions (real-time WebSocket unaffected)
- ✅ Matchup scoring unchanged (pure copy changes)

---

## 6. Files Requiring Changes: Complete List

### Must Change (Tier 1)

1. **app/layout.tsx** — `<title>`, meta description, header wordmark
2. **app/page.tsx** — hero headline, eyebrow, sub-copy, "How it works" steps
3. **Logo asset** — SVG shield in new `components/LogoShield.tsx` or in-line
4. **Favicon + PWA icon** — replace with shield logo

### Should Change (Tier 2)

5. **components/WelcomeFlow.tsx** — headline, eyebrow, card copy
6. **app/dashboard/page.tsx** — section headers (optional: "Your Franchises")
7. **app/login/page.tsx** — left column pitch copy
8. **app/league/[leagueId]/layout.tsx** — admin nav label (optional)

### Nice to Change (Tier 3)

9. **app/page.tsx** — "fantasy pts" label (if present)
10. **app/team/[teamId]/roster/RosterManager.tsx** — "fantasy pts" references
11. **README.md** — references to "PWHL Fantasy"
12. **Various scripts** — CLI output branding

### No Changes Needed

- Schema or database (no breaking changes)
- API routes or logic
- Draft server WebSocket protocol
- Scoring engine
- Matchup generation
- All tests (no logic changes)

---

## 7. Color System: Minor Adjustment

**Current:** Hero eyebrow uses `var(--green: #22c55e)`  
**Recommendation:** Change to `var(--accent: #6366f1)` or `var(--white)` at reduced opacity

**Why:** Green is not mentioned in the branding brief and reads closer to a sports-betting UI pattern. Purple is the primary brand accent.

**Where:** `.hero-eyebrow` CSS class or inline style on the eyebrow text node.

**Risk:** Zero (purely visual, no logic)

---

## 8. Testing Strategy

### Manual Testing Path (30 minutes)

1. Navigate to home page as unauthenticated user → verify hero, "How it works", CTA copy
2. Log in → verify welcome flow (first-time users)
3. Dashboard → verify section headers, team cards
4. Create league → verify copy in wizard steps
5. Join a league → verify no "fantasy" language in UI
6. View draft room → verify header wordmark
7. View matchup page → verify hero scores, alerts, all copy
8. View standings → verify no "fantasy" terminology in labels
9. Admin panel → verify "Front Office" nav label (if implemented)
10. Verify logo appears correctly in header, favicon in browser tab, PWA icon

### Automated Testing

- Existing test suite should pass without modification (no logic changes)
- If tests reference old branding strings, update assertions to expect new strings

---

## 9. Rollback Plan (Emergency Only)

If issues arise:

1. Revert `app/layout.tsx` (header and title)
2. Revert `app/page.tsx` (home hero)
3. Revert logo/favicon to placeholder
4. Clear browser cache and CDN if deployed

All changes are **non-breaking** and **immediately reversible** via git revert.

---

## 10. Go-Live Readiness Checklist

- [ ] Shield logo SVG finalized and tested at all sizes (32px, 64px, 128px, 256px)
- [ ] All Tier 1 changes complete and QA'd
- [ ] No 404 errors or broken links
- [ ] Mobile layout verified
- [ ] Existing users (if any) see updated branding on next login
- [ ] Analytics still tracking (no breaking changes)
- [ ] All team members aware of new branding (consistency in future copy)
- [ ] CLAUDE.md updated with new terminology standards
- [ ] README and docs updated

---

## 11. Post-Launch Communication

Once the rebrand goes live:

1. **External:** Update PWHL partnership proposals to reference PWHL GM as official positioning
2. **Internal:** Brief the team on terminology to use in future feature specs
3. **Community:** Optional: Announce the rebrand in admin panel announcement or email
4. **Analytics:** Tag all post-launch sessions with "rebrand=true" for cohort tracking

---

## 12. Long-Term Vision

The PWHL GM brand should evolve to support:

- Official PWHL partnerships and licensing
- Premium/paid tiers branded as "Executive" or "Commissioner" editions
- Commissioner tools positioned as "Front Office Suite"
- Mobile app store listings with "GM" branding
- Fantasy sports media coverage (position as "management simulator" not "fantasy gaming")

All future feature language should reinforce this executive/management framing.

---

## Appendix: Terminology Style Guide for Future Development

### Prefer:

- **General Manager** (full form) / **GM** (short form)
- **Franchise** (for team)
- **Front Office** (for admin/commissioner tools)
- **Roster** (for player selection)
- **Matchup** (for weekly competition)
- **Championship** (for final outcome)
- **Draft Room** (for draft interface)
- **League** (for multi-team competition)

### Avoid:

- "Fantasy team", "fantasy sports", "fantasy app"
- "Points" without context (use "Championship points" or "VP" when disambiguating)
- "Gambling", "betting", "odds" (use "prediction", "probability", "forecast" instead)
- Marketing language that sounds like DFS ("win big", "score more", "instant payouts")

### Neutral (Context-Dependent):

- **League** ✓ (explicit in branding brief)
- **Waiver Wire** ✓ (operational term, clear meaning)
- **Playoff** ✓ (sports-standard term)
- **Commissioner** ✓ (role-specific, neutral)

---

**Status:** Ready to implement post-launch  
**Owner:** Product Management  
**Last Updated:** June 2026
