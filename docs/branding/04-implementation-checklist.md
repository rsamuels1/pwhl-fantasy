# PWHL GM Rebrand: Implementation Checklist

**Timeline:** To be completed after MVP launch  
**Duration:** ~8 hours of development + QA  
**Risk Level:** Zero (all changes are non-breaking)

---

## Phase 1: Core Identity (4 hours)

### Logo & Favicon

- [ ] Create Shield + GM SVG asset (`components/LogoShield.tsx` or inline SVG)
  - Test at sizes: 16px, 32px, 64px, 128px, 256px, 512px
  - Verify on dark navy background
  - Export for favicon, PWA icon, social share image
- [ ] Update `public/favicon.ico`
- [ ] Update `public/manifest.json` icons (192x192, 512x512)
- [ ] Replace "HF" placeholder text with shield SVG in header
- [ ] Verify logo renders correctly on mobile breakpoints

**Files to modify:**
- `components/LogoShield.tsx` (new)
- `public/favicon.ico` (replace)
- `public/manifest.json` (update icon paths)
- Header component (replace text logo with SVG)
- `app/layout.tsx` (if logo is defined there)

### Product Naming

- [ ] Update `app/layout.tsx`:
  ```tsx
  <title>PWHL GM</title>
  <meta name="description" content="The management platform for PWHL fans. Scout players, build a championship roster, and compete for the title." />
  ```
- [ ] Global find-replace: "PWHL Fantasy" → "PWHL GM"
  - Verify in: all `.tsx` files, README, docs
  - Exclude: git history, old comments marked as such
  - Exclude: branding documentation (keep for reference)

**Files affected:** ~15 files across `app/`, `components/`, `public/`

### Home Page Hero

**File:** `app/page.tsx`

- [ ] Update eyebrow:
  ```tsx
  Before: "PWHL Fantasy Hockey"
  After:  "PWHL General Manager"
  ```

- [ ] Update hero headline:
  ```tsx
  Before: "Draft your team. Set your lineup. Win every week."
  After:  "Think Like a GM."
  ```

- [ ] Update hero sub-heading:
  ```tsx
  Before: "The first fantasy platform built for PWHL fans. Draft real stars, compete in 
           head-to-head matchups, and follow every goal with something on the line."
  After:  "The management platform built for PWHL fans. Scout players, build a championship 
           roster, and compete for the title — every week."
  ```

- [ ] Update "How it works" step copy:
  ```
  Step 1: "Create League" → "Form Your League"
  Step 2: "Draft Players" → "Scout & Draft"
  Step 3: "Set Your Lineup" → "Manage Your Roster"
  Step 4: "Win Matchups" → "Lead Your Franchise"
  ```

- [ ] Update hero CTA: "Ready to build your team?" → "Ready to run your franchise?"

- [ ] Optional: Change `.hero-eyebrow` color from `var(--green)` to `var(--accent)` (purple)

### Verification: Phase 1

```bash
# Run locally
npm run dev

# Manual QA checklist
- [ ] Logo displays in header at correct size
- [ ] Browser tab shows updated favicon
- [ ] Home page hero copy is correct
- [ ] No layout shifts or broken styles
- [ ] Mobile nav renders correctly
- [ ] No console errors
```

---

## Phase 2: Voice Consistency (2 hours)

### Welcome Flow

**File:** `components/WelcomeFlow.tsx`

- [ ] Update component title:
  ```tsx
  Before: "Welcome to PWHL Fantasy"
  After:  "Welcome to PWHL GM"
  ```

- [ ] Update eyebrow/subtitle:
  ```tsx
  Before: "Fantasy hockey for the PWHL"
  After:  "Think Like a GM"
  ```

- [ ] Update card descriptions (3 orientation cards):
  - Card 1: Reframe around "managing an organization" not "playing a game"
  - Card 2: Emphasize "strategic decisions" and "championship focus"
  - Card 3: Keep the "two ways to start" framing but use "Franchise" language

- [ ] Optional: Replace card icons with more executive-themed icons (clipboard, strategy, not hockey sticks)

### Dashboard

**File:** `app/dashboard/page.tsx`

- [ ] Update section header (optional but recommended):
  ```tsx
  Before: "Your teams"
  After:  "Your Franchises"
  ```
  
  OR keep as-is if "Your teams" is already clear in context.

### Login Page

**File:** `app/login/page.tsx`

- [ ] Update left-column pitch copy:
  ```tsx
  Before: "Score points from real PWHL game stats every week. Create a league, draft stars, 
           and compete for the championship."
  After:  "Scout players. Build a championship roster. Lead your franchise through a full 
           PWHL season."
  ```

### Admin Panel

**File:** `app/league/[leagueId]/layout.tsx` (line ~91)

- [ ] Optional: Change nav label
  ```tsx
  Before: "Settings" or "⚙ Admin Panel"
  After:  "⚙ Front Office"
  ```
  
  This reinforces the executive framing but is cosmetic. Can be skipped if time-constrained.

### Verification: Phase 2

```bash
# Run locally
npm run dev

# Manual QA checklist
- [ ] Welcome flow displays for new users (or simulate by clearing cookie)
- [ ] Dashboard headers show new language
- [ ] Login page pitch is readable
- [ ] Admin nav displays correctly (if updated)
- [ ] No broken links or missing assets
- [ ] Text doesn't overflow on mobile
```

---

## Phase 3: Detail Polish (1 hour)

### Remove "Fantasy" Modifiers

**Files:**
- `app/page.tsx` (if "fantasy pts" appears in player card)
- `app/team/[teamId]/roster/RosterManager.tsx` (if "fantasy pts" label exists)

- [ ] Find and replace "fantasy pts" with "pts" (2–3 locations)

### CLI/Scripts Output

**Files:**
- `scripts/seed.ts`
- `scripts/simulate-season.ts`
- `package.json` scripts
- Any `console.log` output that mentions "PWHL Fantasy"

- [ ] Update any user-facing console output to "PWHL GM"

### Documentation

**Files:**
- `README.md` (top-level)
- `docs/01-roadmap/roadmap-index.md` (if referenced there)
- `CLAUDE.md` (instructions file)

- [ ] Update any references to "PWHL Fantasy" in user-facing docs
- [ ] Add terminology guide link to CLAUDE.md for future developers

### Verification: Phase 3

```bash
# Run full test suite
npm test

# Expected: All tests pass (no logic changes)
- [ ] Unit tests: PASS
- [ ] Integration tests: PASS
- [ ] E2E tests (if applicable): PASS
- [ ] Lint checks: PASS
- [ ] Type checks: npm run type-check (PASS)
```

---

## Phase 4: Full QA & Testing (1 hour)

### Manual Testing Path (30 min)

**Fresh user journey:**

1. Navigate to `http://localhost:3000` (unauthenticated)
   - [ ] Logo displays correctly (shield + GM)
   - [ ] Hero copy is updated
   - [ ] "How it works" steps use new language
   - [ ] No layout shifts

2. Log in or create account
   - [ ] Welcome flow shows "Welcome to PWHL GM"
   - [ ] Dashboard displays "Your Franchises" (if changed)
   - [ ] No console errors

3. Create or join league
   - [ ] League creation copy uses new terminology
   - [ ] "Form Your League" step displays correctly

4. Draft room
   - [ ] Header shows "PWHL GM — Draft Room"
   - [ ] Clock and controls functional
   - [ ] No performance regressions

5. In-season views
   - [ ] Matchup page displays scores (no copy-driven issues)
   - [ ] Lineup page loads and functions
   - [ ] Roster page shows players without errors
   - [ ] Standings table renders

6. Admin panel (if applicable)
   - [ ] "Front Office" nav label displays (if updated)
   - [ ] Admin controls functional

7. Mobile view
   - [ ] Logo responsive (32px or smaller on mobile)
   - [ ] Hero text doesn't overflow
   - [ ] Navigation stack works
   - [ ] Draft room adjusts layout correctly

### Regression Testing (20 min)

- [ ] Draft functionality unchanged (picks save, clock runs, etc.)
- [ ] Scoring logic unchanged (test page still shows correct scores)
- [ ] Matchup generation unchanged
- [ ] Waiver wire unchanged
- [ ] Authentication flows unchanged
- [ ] WebSocket connections for draft room stable
- [ ] No 404 errors or broken links

### Checklist Before Merge

- [ ] All tests passing (`npm test`)
- [ ] Type checking clean (`npm run type-check`)
- [ ] Linting clean (`npm run lint`)
- [ ] No console errors in browser DevTools
- [ ] Home page hero displays correctly
- [ ] Logo renders at all viewport sizes
- [ ] No unintended style changes or layout shifts
- [ ] All user-facing copy reviewed for tone/consistency
- [ ] Logo SVG file is optimized (< 2KB)

---

## Pre-Deploy Verification

### Before pushing to staging/production:

- [ ] Favicon preview in browser tab shows shield logo
- [ ] PWA icon correct in bookmark (iOS/Android)
- [ ] Share preview (Open Graph) uses new title + description
- [ ] Old "PWHL Fantasy" references not visible in UI (check via browser inspection)
- [ ] No broken CSS or animations
- [ ] Database unchanged (no migrations needed)
- [ ] API endpoints unchanged (backward compatible)

### Post-Deploy Monitoring:

- [ ] Monitor error logs for 24 hours (should be zero branding-related errors)
- [ ] Verify analytics still tracking (no interruption)
- [ ] Check user feedback for any confusion with new branding
- [ ] Confirm existing sessions update after browser refresh

---

## Rollback Plan (If Needed)

All changes are **immediately reversible**. To rollback:

```bash
# Revert the rebrand commit(s)
git revert <commit-hash>
git push origin main

# Clear browser cache and CDN if deployed
# Re-deploy with previous commit
```

**Expected time to rollback:** 5 minutes

---

## Files Checklist: Complete List

### Must Modify

- [ ] `app/layout.tsx` — title, meta, logo component
- [ ] `app/page.tsx` — hero headline, eyebrow, sub-copy, "how it works" steps
- [ ] `public/favicon.ico` — replace with shield logo
- [ ] `public/manifest.json` — update icon paths
- [ ] `components/WelcomeFlow.tsx` — welcome copy
- [ ] `components/LogoShield.tsx` (or header logo component) — new SVG
- [ ] `app/dashboard/page.tsx` — optional section headers
- [ ] `app/login/page.tsx` — pitch copy
- [ ] `app/league/[leagueId]/layout.tsx` — optional admin nav label

### Should Modify (If Found)

- [ ] `app/page.tsx` — "fantasy pts" label (if present)
- [ ] `app/team/[teamId]/roster/RosterManager.tsx` — "fantasy pts" label
- [ ] Any `.ts` or `.tsx` file with "PWHL Fantasy" string

### Documentation

- [ ] `README.md` — update references
- [ ] `CLAUDE.md` — add terminology guide link
- [ ] Any roadmap docs — update branding references

### Do Not Modify

- [ ] `prisma/schema.prisma` (no schema changes)
- [ ] `lib/draft/` (WebSocket protocol unchanged)
- [ ] `lib/scoring/` (scoring logic unchanged)
- [ ] API routes in `app/api/` (all functionality intact)
- [ ] Tests (no logic changes, only update assertions if testing text)

---

## Time Estimates

| Phase | Task | Time | Notes |
|-------|------|------|-------|
| 1 | Logo SVG creation | 1.5h | May already exist as mockup |
| 1 | Product naming (find-replace) | 0.5h | Global find-replace + verify |
| 1 | Home page hero copy | 1h | Update headline, eyebrow, sub-copy |
| 1 | Testing & verification | 1h | Manual QA, no errors |
| **Phase 1 Total** | — | **4h** | — |
| 2 | Welcome flow | 0.5h | Update 3–4 text fields |
| 2 | Dashboard & Login copy | 0.75h | Minor updates |
| 2 | Admin nav (optional) | 0.25h | One line if included |
| 2 | Testing & verification | 0.5h | Manual QA |
| **Phase 2 Total** | — | **2h** | — |
| 3 | "Fantasy" modifiers removal | 0.25h | 2–3 find-replace ops |
| 3 | CLI/script updates | 0.25h | User-facing output only |
| 3 | Docs updates | 0.25h | README, CLAUDE.md |
| 3 | Full test suite | 0.25h | npm test + type check |
| **Phase 3 Total** | — | **1h** | — |
| 4 | Manual QA path | 0.5h | 30-min user journey |
| 4 | Regression testing | 0.5h | 20-min checklist |
| **Phase 4 Total** | — | **1h** | — |
| — | **Grand Total** | **8h** | ~1 sprint task |

---

## Sign-Off

- [ ] Assigned to: [Developer Name]
- [ ] Reviewed by: [Product/Design]
- [ ] QA Sign-off: [QA/Testing]
- [ ] Launch Date: [Post-MVP, Week of __]
- [ ] Deployed: [Date/Time]

---

## Notes for Future Reference

- This rebrand introduces no breaking changes to users or data
- Existing leagues, rosters, and scoring are unaffected
- All three mockups (rebrand showcase, draft room, matchup page) are in `docs/branding/mockups/`
- Terminology guide (`03-terminology-guide.md`) should be referenced for any future copy additions
- Full brand assessment and rationale in `02-brand-assessment.md`

---

**Last Updated:** June 2026  
**Status:** Ready to implement (post-MVP)
