# Sprint Template

## Context

Read before implementing:

- CLAUDE.md
- docs/AI_CONTEXT.md
- docs/INNOCORE_DOMAIN_CONSTITUTION.md
- docs/PROJECT_WORKSPACE_SPECIFICATION.md
- docs/DEFINITION_OF_DONE.md

These documents are authoritative.

Never redesign the architecture.

Never contradict the Constitution.

Implementation must conform to the Specification.

---

## Sprint

Name:

{{SPRINT_NAME}}

Capability:

{{CAPABILITY}}

---

## Objective

{{OBJECTIVE}}

---

## Scope

{{SCOPE}}

---

## Out of Scope

{{OUT_OF_SCOPE}}

Everything not listed above is explicitly excluded.

---

## Constraints

- Prefer Server Components.
- Use existing services.
- Never duplicate business logic.
- Never access Prisma from Client Components.
- Preserve multi-tenancy.
- Use DTOs.
- Reuse Design System components.
- Reuse existing patterns.

---

## Deliverables

{{DELIVERABLES}}

---

## Acceptance Criteria

{{ACCEPTANCE}}

---

## Validation

Run:

npm run db:generate

npm run typecheck

npm run lint

npm test

npm run test:integration

npm run build

---

## Required Audit

Invoke implementation-auditor.

Return:

- files modified
- tests
- validation
- audit verdict

Required result:

SPRINT ACCEPTED

Do not continue with another sprint.