# IntusPath Engineering Playbook

## Purpose

This document defines how software is developed in this repository.

It is independent of any specific module.

All engineers and AI agents must follow this workflow.

---

# Engineering Principles

## 1. Architecture First

No implementation starts without an approved Specification.

Specifications are authoritative.

Implementation adapts to the Specification.

Never the opposite.

---

## 2. Single Responsibility

Each Sprint has one responsibility.

Each Capability contains multiple Sprints.

Never mix unrelated objectives.

---

## 3. Immutable Architecture

These decisions are permanent.

- Project is the Aggregate Root.
- Lead → Prospect → Client → Project.
- Quotations belong to Projects.
- Workspace is the operational center.

Changes require an approved ADR.

---

## 4. Documents Hierarchy

Highest authority:

1. INNOCORE_DOMAIN_CONSTITUTION.md
2. PROJECT_WORKSPACE_SPECIFICATION.md
3. PROJECT_WORKSPACE_BLUEPRINT.md
4. DEFINITION_OF_DONE.md
5. CLAUDE.md

If two documents conflict, the highest authority wins.

---

## 5. Sprint Workflow

Specification

↓

Implementation

↓

Implementation Audit

↓

QA

↓

Merge

Never skip a phase.

---

## 6. Coding Rules

- Prefer Server Components.
- Never duplicate business logic.
- Never bypass services.
- DTOs are mandatory.
- Multi-tenancy is never optional.

---

## 7. Quality Gates

Every Sprint requires:

- Build passes.
- Tests pass.
- Auditor approves.
- Manual QA completed.

Otherwise Sprint remains open.

---

## 8. AI Collaboration

Claude is treated as a Senior Engineer.

Claude must not redesign architecture.

Claude must not invent requirements.

Claude must ask when Specification is ambiguous.

---

## 9. Future Modules

Every new module must integrate into Project Workspace.

No operational module may exist outside Project.

---

## 10. Golden Rule

Build platforms.

Not screens.