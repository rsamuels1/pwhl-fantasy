# Page & component inventory

Every UI surface in the app, grouped by area. For the color rollout, each one
is covered by: **(A)** the `:root` token swap + **(B)** the inline-hex sweep +
**(C)** emoji removal. The "Notes" column flags screens that need *more than a
recolor* — a layout/redesign pass in the spirit of the reference designs.

Legend: **[recolor]** = tokens + sweep only · **[redesign]** = also restructure.

## Public / auth
| Route | File | Notes |
|---|---|---|
| `/` landing | `app/page.tsx` (20.7KB) | [recolor] hero/features already rebuilt in Sprint 15; verify accent + button-ink flip |
| `/login` | `app/login/page.tsx` | [recolor] |
| `/register` | `app/register/page.tsx` | [recolor] show/hide password toggle uses accent |
| `/home` | `app/home/page.tsx` | [recolor] |
| `/beta` | `app/beta/page.tsx` | [recolor] |
| `/invite/[…]` | `app/invite/**` | [recolor] join page has fantasy explainer |
| `/join-league` | `app/join-league/page.tsx` | [recolor] |

## App core
| Route | File | Notes |
|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` | [recolor] MatchupHero, action cards, VP callouts |
| `/leagues` | `app/leagues/page.tsx` | [recolor] public directory + "What's Happening" showcase |
| `/create-league` | `app/create-league/CreateLeagueWizard.tsx` | **[redesign] — DONE in reference HTML.** Recreate the rule sheet + anchored VP popover + emoji-free steps |
| `/draft` | `app/draft/page.tsx` | [recolor] |

## League — `app/league/[leagueId]/`
| Route | File | Notes |
|---|---|---|
| overview | `page.tsx` (45KB) | **[redesign] — DONE in `references/League Overview.dc.html`.** Recolor + emoji removal; My Matchup widget is the key accent recolor |
| layout / nav | `layout.tsx` | [recolor] league nav tabs use accent underline |
| admin | `admin/page.tsx` (26KB) | [recolor] commissioner tools, audit log table |
| bracket | `bracket/page.tsx` + `loading.tsx` | [recolor] champion glow uses `--accent-glow` |
| draft setup | `draft/page.tsx`, `DraftSetupClient.tsx` | [recolor] |
| lineup | `lineup/LineupManager.tsx` (39KB) | [recolor] slot pills, lock indicators |
| matchups | `matchups/page.tsx` (21KB) | [recolor] |
| power-rankings | `power-rankings/page.tsx` | [recolor] |
| roster | `roster/page.tsx` | [recolor] |
| season | `season/page.tsx` | [recolor] state-aware standings/bracket |
| settings | `settings/SettingsEditor.tsx` (22KB) | [recolor] scoring/roster editors — mirror the wizard rule-sheet styling |
| sim | `sim/page.tsx` | [recolor] |
| standings | `standings/page.tsx` (13KB) | [recolor] chip-clinched/eliminated/in + my-row highlight |
| trades | `trades/page.tsx`, `new/ProposeTrade.tsx` (17KB), `[tradeId]/TradeDetailView.tsx`, `counter/` | [recolor] |
| transactions | `transactions/TransactionFeed.tsx` | [recolor] |
| + `error.tsx` / `loading.tsx` per route | | [recolor] skeletons use surface/border tokens |

## Team — `app/team/[teamId]/`
| Route | File | Notes |
|---|---|---|
| nav / layout | `TeamNav.tsx`, `layout.tsx` | [recolor] tab style + round chips |
| matchup | `matchup/page.tsx` (66KB!) + `InlineLineupEditor.tsx` | **[redesign] — DONE in `references/Team Matchup.dc.html`.** DuelHero shown; apply same treatment to FieldHero + empty states. Keep score-state semantics (green/red/tied) |
| roster | `roster/RosterManager.tsx` (42KB), `roster/page.tsx` | [recolor] stat tables, tooltips |
| lineup | `lineup/page.tsx` | [recolor] |
| analysis | `analysis/page.tsx` + `components/AnalysisTab.tsx` | [recolor] vs-median bars |
| schedule | `schedule/page.tsx` (18KB) | [recolor] |
| standings | `standings/page.tsx` | [recolor] |
| draft-prep | `draft-prep/DraftQueueManager.tsx` (15KB) | [recolor] |
| + `error.tsx` / `loading.tsx` per route | | [recolor] |

## Founder console — `app/founder/`
| Route | File | Notes |
|---|---|---|
| dashboard | `page.tsx`, `layout.tsx` | [recolor] |
| leagues | `leagues/page.tsx` (13.8KB), `[leagueId]/LeagueDetailTabs.tsx` (33KB) | [recolor] |
| backlog | `backlog/BacklogBoard.tsx` | [recolor] |
| feedback | `feedback/FeedbackTable.tsx` (19.5KB) | [recolor] |
| simulate | `simulate/SimulateCenter.tsx` | [recolor] |

## Shared components — `components/`
High-impact (touch first): `BottomNav`, `NotificationBell`, `PlayoffBracket`,
`WaiverWirePanel` (17.6KB), `ScoreDisplay`, `WeekHighlights`, `RivalBadge`,
`EmptyState` / `ErrorState` / `LoadingState`, `CommissionerRecoveryTools`,
`AddAndSlotModal`, `RenewLeagueForm`, `FeedbackWidget`, `WelcomeFlow`,
`BetaWelcomeStep`, `LogoShield`, `sim/*` (GMCommandCenter, WeekRecap,
SeasonComplete, WeekSetup, PlayoffsPanel).

**`components/VpExplainer.tsx`** → its own fix, see `README.md` §"VP popover".
This component is embedded in multiple screens (standings, dashboard, wizard,
rules), so fixing it once propagates everywhere.
