# Documentation Standards

## Folder Ownership

| Folder | Purpose | What belongs here | What does NOT belong |
|---|---|---|---|
| `00-product/` | WHAT the product is | Product requirements, feature definitions, league rules, launch criteria, user-facing content | Implementation details, technical specs, timelines |
| `01-roadmap/` | WHAT gets built and WHEN | Prioritized feature roadmap, sprint plans, prioritization analysis | Product rules, implementation specs |
| `02-engineering/` | HOW features are implemented | Feature specs, implementation contracts, API designs, system behavior docs | Product requirements, deployment procedures |
| `03-validation/` | Prove the product works | Audit reports, readiness scorecards, checklists, simulation plans, risk registers | Feature specs, operational guides |
| `04-operations/` | Running the product day-to-day | Runbooks, support playbooks, program guides, beta metrics | Architecture plans, product requirements |
| `05-growth/` | User acquisition and retention | Analytics event specs, retention strategy, growth plans | Product rules, engineering specs |
| `06-architecture/` | Long-term platform evolution | Multi-season strategy, platform architecture, foundational tech decisions | Sprint plans, feature specs for near-term work |
| `99-archive/` | Historical reference only | Superseded docs, one-shot Claude prompts, versioned HTML exports, old sprint artifacts | Anything actively used |

---

## Naming Conventions

- **Folders:** `##-name/` — two-digit prefix + kebab-case (e.g., `02-engineering/`)
- **Files:** `kebab-case.md` — no abbreviations that obscure meaning
- **Spell out full words:** `commissioner` not `commish`, `implement` not `implent`
- **Spec files:** `[feature]-spec.md` (e.g., `trade-spec.md`, `onboarding-spec.md`)
- **Runbooks:** `[role]-runbook.md` (e.g., `commissioner-runbook.md`)
- **No version suffixes in active filenames** — versioned iterations belong in `99-archive/`

---

## Document Status Header

Every new document should include at the top:

```
Version: x.x
Status: Draft | Active | Superseded | Archived
Owner: [role or team]
Last Updated: YYYY-MM-DD
```

---

## Routing New Documents

Use this decision tree when deciding where a new document lives:

1. Does it define product behavior or rules? → `00-product/`
2. Does it set priorities or timelines? → `01-roadmap/`
3. Does it specify how to implement a feature? → `02-engineering/`
4. Does it verify the product works? → `03-validation/`
5. Does it guide a human operating the product? → `04-operations/`
6. Does it address user growth or analytics? → `05-growth/`
7. Does it define multi-season or platform-level architecture? → `06-architecture/`
8. Is it historical / superseded / a one-shot Claude prompt? → `99-archive/`

---

## Archive Criteria

Move a document to `99-archive/` when any of the following are true:

- It is a one-shot Claude Code prompt (sprint execution prompts, implementation prompts)
- It is a versioned HTML export superseded by a newer version
- Its `Status` field is `Superseded`
- It has not been updated in 2+ sprints and is no longer referenced
- It is a "request" document whose findings have been incorporated elsewhere

---

## Maintenance

- Review the documentation index (`docs/README.md`) at the start of each sprint
- When a spec is superseded by a new version, move the old version to `99-archive/` and update `docs/README.md`
- When a sprint plan is complete, move it to `99-archive/`
- The `docs/README.md` index should always reflect the current active document set

---

## What Goes in CLAUDE.md vs docs/

- **CLAUDE.md** — Concise engineering reference for Claude Code: stack, commands, gotchas, naming conventions, file paths. Updated when behavior changes. Not for product strategy.
- **docs/02-engineering/** — Full feature specifications and implementation contracts that are too long for CLAUDE.md.
- **docs/00-product/** — Product rules and requirements. CLAUDE.md can cite these but should not duplicate them.
