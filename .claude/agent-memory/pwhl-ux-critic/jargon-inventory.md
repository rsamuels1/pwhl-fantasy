---
name: jargon-inventory
description: Recurring un-explained fantasy/hockey jargon across PWHL GM pages, with where each appears
metadata:
  type: project
---

Inventory of jargon that appears repeatedly WITHOUT inline explanation, ranked by how exposed a new PWHL fan is.

**VP (Victory Points)** — explained well in 3 places (WelcomeFlow, wizard step 4, VpExplainer "?" on standings) but appears RAW on: home page mini-standings, dashboard MatchupHero, league overview race table chips. The explanation is opt-in (must click "?"). Reasonable coverage; the gap is surfaces outside standings.

**FP (Fantasy Points)** — used as a bare axis label ("Projected FP", "Points earned", "PF") on matchup hero, lineup, standings. NEVER expanded to "Fantasy Points" anywhere user-facing. New fans won't know FP and VP are different currencies. This is the single most confusing collision — two point systems, two abbreviations, no Rosetta stone on one screen.

**VTF / "vs the field"** — see [[vtf-field-model]]. The matchup hero says "W-L vs field" with no explanation of what "the field" is.

**UTIL** — wizard step 4 says "1 UTIL (any skater)" (good, explained once). But lineup slot label is bare "UTIL" and draft NeedsPanel shows "Util" with no tooltip. Yahoo jargon; explained at creation, forgotten everywhere it's actually used.

**PPP (power-play points)** — draft player table column header "PPP" and lineup stat row. No tooltip. Invisible stat in normal box scores; needs hover explanation.

**SOG / HIT / BLK / SV% / GA / SO** — bare column headers in draft table, roster table, lineup stats. No legend. SOG especially (most fans say "shots").

**MTCH VP / RNK VP** — standings column headers. Have `title=` tooltips (good) but the abbreviations are cryptic at a glance on mobile where hover doesn't exist.

**Waiver priority / "waivers clear"** — WaiverWirePanel: "Claim submitted! You'll be notified when waivers clear." Assumes the user knows what a waiver is and that claims process in priority order. No primer.

**Snake draft** — home page feature card says "Live snake & auction drafts" with no explanation of snake order. Draft room never explains why pick order reverses each round.

How to apply: when reviewing any stats table or score surface, check whether a first-time user could decode every header/label without leaving the page. Push for a one-line legend or tap-to-explain on the FIRST exposure per session, not buried in rules docs.
