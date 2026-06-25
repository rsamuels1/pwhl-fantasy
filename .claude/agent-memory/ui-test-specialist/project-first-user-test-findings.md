---
name: project-first-user-test-findings
description: First-time user UI test results (2026-06-24) — key gaps for newcomers to fantasy or hockey
metadata:
  type: project
---

Comprehensive first-time user test run 2026-06-24 across all 11 major flows. 51 findings: 37 pass, 14 warn, 0 fail (auth crash bypassed via session injection).

Overall first-impression score: 6.5/10. Strong visual design, weak terminology onboarding.

**Critical issues found:**
- Resend module-level crash blocks login and trades in local dev (see [[feedback-resend-crash]])
- Trades page renders raw Next.js error overlay (same root cause)

**Highest-impact newcomer gaps:**
1. "VP" appears on landing page before being defined anywhere
2. Wizard has no visible step progress indicator (UX-014/015 bar may not render for beta entry path)
3. "UTIL" slot label has no tooltip or legend on roster page
4. Draft room shows infinite connecting skeletons with no timeout/error fallback when WebSocket server is offline
5. Login page has no "no password needed" explanation
6. Mobile landing page overflows horizontally at 375px (scrollWidth 572px)
7. BottomNav has both "Lineup" and "Roster" tabs — Lineup redirects to Roster, causing confusion

**What works well for newcomers:**
- "Your first scored week" card (personalized, explains VTF in plain language)
- Beta welcome screen sets tone and expectations
- How It Works page is comprehensive (6 sections, VP/FP relationship explained)
- Product preview on landing (live scores before sign-up)
- "(optional)" label on display name field
- "Try a Replay" CTA on landing
- Standings VP legend is present and well-written
- Touch targets all ≥44px on mobile

**Why:** This was a pre-launch audit targeting the PWHL fan audience — people who may love women's hockey but have never played fantasy sports. The findings show the app is production-quality in design but uses insider fantasy/hockey abbreviations (VP, FP, UTIL, PPP, VTF) before defining them.

**How to apply:** Prioritize terminology fixes (VP on landing, UTIL tooltip, login magic-link explanation) alongside the Resend crash fix for beta launch. These are all small, targeted changes with outsized impact on new user retention.
