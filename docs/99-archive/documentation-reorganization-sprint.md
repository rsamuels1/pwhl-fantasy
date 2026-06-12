# Documentation Reorganization Sprint

You are working in the PWHL Fantasy repository.

Your task is NOT to change product behavior or implementation.

Your task is to reorganize and rationalize the documentation system so that the repository becomes easier for both humans and AI agents to navigate.

The goal is to establish clear ownership boundaries between:

- Product documentation
- Roadmap documentation
- Engineering specifications
- Validation artifacts
- Operations documentation
- Platform architecture
- Historical/archive artifacts

---

# Objectives

## Objective 1

Audit the entire `/docs` directory.

Create an inventory of:

- Existing documents
- Current locations
- Duplicate topics
- Outdated artifacts
- Orphaned documents
- Overlapping documents

Create:

```text
docs/documentation-audit.md
```

---

## Objective 2

Implement a standardized documentation architecture.

Create the following folder structure:

```text
docs/

README.md

00-product/
01-roadmap/
02-engineering/
03-validation/
04-operations/
05-growth/
06-architecture/

99-archive/
```

---

# Folder Definitions

## 00-product

Purpose:

Defines WHAT the product is.

Move documents such as:

```text
mvp-definition.md
feature-matrix.md
league-rules-v1.md
user-education-content.md
league-homepage-v1.md
v1-launch-criteria.md
```

Any future product requirements should live here.

---

## 01-roadmap

Purpose:

Defines WHAT gets built and WHEN.

Move:

```text
roadmap.md
roadmap-gpt.md

roadmap.html

roadmap-prioritization-recommendations.md

recommended-next-sprint.md

post-mvp-validation-sprint-plan.md
```

Place all roadmap artifacts here.

---

## 02-engineering

Purpose:

Defines HOW features should be implemented.

Move engineering specifications such as:

```text
engineering-foundation-spec.md

draft-experience.md

commissioner-tools-spec.md

trade-spec.md

waiver-spec.md

notification-spec.md

onboarding-spec.md
```

Any implementation contract Claude would use before coding belongs here.

---

## 03-validation

Purpose:

Prove the product works.

Move:

```text
mvp-audit-report.md

mvp-readiness-scorecard.md

validation-checklist.md

season-simulation-plan.md

season-simulation-scenarios.md

current-sprint-audit.md
```

This folder becomes the source of truth for launch readiness.

---

## 04-operations

Purpose:

Documentation used by real humans operating the product.

Move:

```text
commissioner-runbook.md

support-playbook.md

founding-commissioner-program.md

beta-success-metrics.md
```

Future onboarding and support procedures belong here.

---

## 05-growth

Purpose:

Retention, analytics, growth, and acquisition planning.

Move:

```text
growth-retention-spec.md

analytics-events.md
```

Future docs:

```text
referral-loop.md
marketing-plan.md
community-strategy.md
```

---

## 06-architecture

Purpose:

Long-term platform architecture and system evolution.

Move:

```text
season-renewal-system.md

parent-league-id.md

implement-parentleagueid.md

multi-season-strategy.md

ai-development-workflow.md
```

Future platform-level architecture belongs here.

---

## 99-archive

Purpose:

Historical artifacts that should not be treated as active documentation.

Move:

```text
roadmap-gpt-v2.html
roadmap-gpt-v3.html
roadmap-gpt-v4.html
roadmap-gpt-v5.html
```

Also move:

```text
roadmap-refresh-request.md
```

and any superseded planning artifacts.

Archive items should remain accessible but clearly separated from active documentation.

---

# Objective 3

Create a Documentation Index

Create:

```text
docs/README.md
```

The README should provide:

## Product

Links to:

- MVP Definition
- Feature Matrix
- League Rules

---

## Roadmap

Links to:

- Roadmap
- Active Sprint Plan

---

## Engineering

Links to:

- Draft Experience
- Commissioner Tools
- Trades
- Waivers

---

## Validation

Links to:

- MVP Audit
- Readiness Scorecard
- Simulation Plan

---

## Operations

Links to:

- Commissioner Runbook
- Support Playbook
- Founding Commissioner Program

---

## Architecture

Links to:

- Parent League ID
- Season Renewal
- Multi-Season Strategy
- AI Development Workflow

---

# Objective 4

Consolidate Overlapping Validation Documents

Review:

```text
implementation-alignment.md
implementation-alignment-sprint.md
p0-fix-plan.md
current-sprint-audit.md
```

Determine whether these should become:

```text
03-validation/

implementation-alignment/

README.md
audit.md
fix-plan.md
status.md
```

If consolidation improves clarity:

- Perform consolidation
- Preserve historical content
- Avoid losing information

---

# Objective 5

Create Documentation Governance

Create:

```text
docs/documentation-standards.md
```

Define:

## Product Docs

Purpose:

Product requirements and behavior.

---

## Roadmap Docs

Purpose:

Prioritization and sequencing.

---

## Engineering Specs

Purpose:

Implementation guidance.

---

## Validation Docs

Purpose:

Verification and launch readiness.

---

## Operations Docs

Purpose:

Human processes and procedures.

---

## Architecture Docs

Purpose:

Long-term platform design.

---

## Archive Docs

Purpose:

Historical reference only.

---

# Constraints

Do NOT:

- Delete useful information.
- Rewrite product requirements.
- Change roadmap priorities.
- Change implementation behavior.

Focus only on:

- Organization
- Navigation
- Categorization
- Documentation maintainability

---

# Deliverables

1. New documentation folder structure.
2. Updated document locations.
3. docs/README.md
4. docs/documentation-audit.md
5. docs/documentation-standards.md
6. Consolidation recommendations (or implementation) for overlapping validation artifacts.
7. A migration summary documenting:
   - Files moved
   - Files archived
   - Files consolidated
   - New structure rationale

---

# Success Criteria

A new contributor, product manager, engineer, or AI coding agent should be able to answer:

- What is the product?
- What is the roadmap?
- How should a feature be implemented?
- How do we know the product works?
- How do commissioners operate leagues?
- How does the platform evolve over multiple seasons?

within five minutes of browsing the documentation.

The resulting documentation structure should be scalable for multiple future seasons and significantly reduce ambiguity when assigning work to Claude Code.