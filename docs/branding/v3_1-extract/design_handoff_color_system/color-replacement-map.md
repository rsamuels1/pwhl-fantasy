# Inline-hex replacement map

The `:root` swap in `globals.tokens.css` re-skins everything that reads a CSS
variable. But this codebase also has **hundreds of hardcoded hex / rgba values
in inline `style={{…}}` objects** across `app/**` and `components/**`. This is
the repo-wide sweep that finishes the rollout.

## How to run it
1. Apply `globals.tokens.css` first.
2. Do a **repo-wide search** for each "Old value" below (search hex strings
   literally; they appear inside `style={{ color: "#…" }}` and template-string
   styles).
3. Replace with the **token** (preferred — `var(--…)`) or the **fallback hex**
   if the value sits somewhere a CSS var is awkward.
4. After the sweep, grep for any remaining `#` hex in `app/` + `components/`
   and reconcile leftovers by eye.
5. **Verify button/badge contrast** (see the ⚠ note at the end).

> Search hint: the old palette is essentially Tailwind **slate + indigo +
> emerald + amber**. If you match those families you'll catch ~95% of cases.

## Accent — indigo/violet → sky
| Old value | Replace with |
|---|---|
| `#6366f1` `#4f46e5` `#7c3aed` `#8b4bf5` | `var(--accent)` → `#8fc1e8` |
| `#6d28d9` `#5b21b6` `#4338ca` | `var(--accent-deep)` → `#6fa8d4` |
| `#a5b4fc` `#a78bfa` `#c9b6ff` `#c4b5fd` | `var(--accent-strong)` → `#a6d0f0` |
| `rgba(99,102,241,X)` `rgba(124,58,237,X)` `rgba(79,70,229,X)` `rgba(91,33,182,X)` | `rgba(143,193,232,X)` |

## Text — slate → neutral
| Old value | Replace with |
|---|---|
| `#f3f5fb` `#f6f7fb` `#e2e8f0` `#f1f5f9` | `var(--text)` → `#f4f6fa` |
| `#cbd5e1` `#aab2c8` `#d1d5db` | `var(--muted)` → `#cdd3df` |
| `#94a3b8` `#64748b` `#9ca3af` `#8b93a7` | `var(--dim)` → `#9aa1b0` |
| `#475569` `#6f788e` `#6b7280` `#52525b` | `var(--faint)` → `#7e8593` |

## Surfaces
| Old value | Replace with |
|---|---|
| `#121829` `#1e1e2e` `#16181c` | `var(--card)` → `#191d25` |
| `#0b1020` `#090b12` `#0b111f` `#111` `#0a0a0a` `#0a0a0c` | `var(--bg)` → `#0f1117` |
| `rgba(255,255,255,0.04)` `rgba(255,255,255,0.05)` `rgba(255,255,255,0.06)` | `var(--surface)` |
| `rgba(255,255,255,0.02)` | `var(--bg-raised)` (#14171e) for wells |

## Borders
| Old value | Replace with |
|---|---|
| `rgba(148,163,184,0.18)` `rgba(148,163,184,0.12)` `rgba(148,163,184,0.1)` `rgba(148,163,184,0.08)` | `var(--border)` / `var(--border-soft)` |
| `rgba(150,160,200,0.10)` `rgba(180,188,202,0.16)` `rgba(255,255,255,0.08)` `rgba(255,255,255,0.1)` | `var(--border)` → `rgba(255,255,255,0.07)` |

## Semantic — unify hue, keep meaning
| Old value | Replace with | Meaning |
|---|---|---|
| `#22c55e` `#34d399` `#5fa98c` `#7fc2a6` `#4ade80` | `var(--green)` → `#51d88a` | done / win / pass / clinched |
| `#ef4444` `#f87171` `#d18b7f` `#c2776c` | `var(--red)` → `#f6837f` | error / loss / risk / out |
| `#f59e0b` `#fbbf24` `#eab308` `#f97316` `#d6a94e` `#e3c989` | `var(--amber)` / `var(--gold)` → `#f5c97b` | warning · **celebratory** (champion, league-high, bubble) |

These were intentionally semantic (e.g. Sprint 16 win/loss score color). **Keep
the semantics** — you're only unifying each family to a single AA-safe hue. Use
`--gold` for celebratory moments (champion banner, league-high, hot streak) and
`--amber` (same hex) for warnings.

## Also during the sweep — type & labels
- **Remove `font-family: 'JetBrains Mono'`** (and the `--font-stats` mono usage
  on small numbers). Small numbers → Archivo + `fontVariantNumeric:'tabular-nums'`.
  Keep Saira Condensed only on LARGE hero scores.
- **Sentence-case section headings** (15-16px/700). Delete the 10-12px ALL-CAPS
  `letterSpacing` eyebrow labels — biggest "terminal" offender.
- Bump card radius to ~18px, add `--shadow-card`, and lean on whitespace instead
  of 1px internal dividers.

## ⚠ Contrast verification after the sweep
The accent flipped from a **dark** violet to a **light** sky. Anywhere text or
an icon sits on a **solid `--accent` fill**, the text must be **dark**
(`var(--accent-ink)` / `#0a0a0c`), not white:
- `.button-primary` and any inline primary buttons
- active/selected pills and tabs that fill with accent
- the "?" popover trigger when active (see VpExplainer fix in README)

Tinted accent backgrounds (`--accent-dim`, the 0.1–0.13 alpha fills) keep
**light** accent-colored text — those are fine as-is.
