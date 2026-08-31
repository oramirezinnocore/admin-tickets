# Command: Prepare Demo Release

## Purpose

Audit the current state of InnoCore Carpentry Suite and create an executable release plan for a stable, robust and commercially presentable demo.

This command is planning-only.

Do not modify application code.

## Input

Optional argument:

`$ARGUMENTS`

Use it for additional context, release constraints or a target demo date.

## Mandatory context

Read:

- `CLAUDE.md`
- `docs/AI_CONTEXT.md`
- `docs/PRODUCT_UX_MASTER_PLAN.md`
- `docs/DOMAIN_MODEL.md`
- `docs/BUSINESS_RULES.md`
- `docs/PERMISSION_MATRIX.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/TESTING_STANDARDS.md`
- `docs/PERFORMANCE_BASELINE.md`
- existing roadmap and backlog documents
- all relevant feature documents under `.claude/doc/`

Inspect the actual repository before assigning implementation status.

Documentation is not proof that a capability is implemented.

## Demo objective

Prepare a stable demo that proves this workflow:

Client
→ Project
→ Quotation
→ Line Items
→ Costing
→ PDF
→ Sent or Accepted Version
→ Advance Payment
→ Remaining Balance
→ Commercial History

## Capabilities to evaluate

Review the current status of:

- Authentication
- Organization context
- Clients
- Projects
- Materials
- Hardware
- Line-item library
- Quotations
- Quotation versioning
- Costing engine
- PDF generation
- Payments
- Files
- Search
- Dashboard
- Audit logging
- Authorization
- Tenant isolation
- Responsive UX
- Loading states
- Empty states
- Error states
- Permission states
- Demo seed data

## Status classification

Use only:

- COMPLETE
- PARTIAL
- NOT STARTED
- BLOCKED
- UNKNOWN

Every status must include repository evidence.

## Demo scope

### In scope

- Authentication
- Clients
- Projects
- Materials
- Hardware
- Line-item library
- Quotations
- Quotation versions
- Costing
- PDF
- Payments
- Files
- Search
- Basic dashboard
- Audit trail
- Basic authorization
- Tenant isolation
- Demo seed data

### Out of scope

- Full production planning
- Procurement
- Real-time inventory
- Installation management
- Warranty management
- Advanced reporting
- Notifications
- AI functionality
- External integrations
- Electronic invoicing
- Complete subscription billing

## Required output

Create or update:

`docs/DEMO_RELEASE_PLAN.md`

Use this structure:

# Demo Release Plan

## 1. Release Objective

## 2. Demo Persona

## 3. Primary Demo Story

## 4. Scope

### In Scope

### Out of Scope

## 5. Current Implementation Status

| Capability | Status | Evidence | Missing Work | Demo Blocking |

## 6. Technical Blockers

Include:

- database latency;
- connection pooling;
- region alignment;
- prepared statement errors;
- tenant isolation;
- authorization;
- financial correctness;
- incomplete UI;
- missing loading, empty, error or permission states;
- failing tests or build issues.

## 7. Demo Backlog

Use:

- P0: blocks the demo
- P1: required for complete demo
- P2: polish or convenience
- P3: post-demo

| ID | Priority | Work Item | Current State | Dependencies | Acceptance Criteria | Risk |

Do not invent time estimates.

## 8. Release Gates

Define mandatory gates for:

- complete demo workflow;
- financial correctness;
- quotation immutability;
- tenant isolation;
- authorization;
- unit tests;
- integration tests;
- typecheck;
- lint;
- production build;
- performance;
- responsive behavior;
- loading, empty, error and permission states;
- demo script completion.

## 9. Performance Targets

Define provisional targets for:

- simple warm database operation;
- tenant-scoped module query;
- complete screen response;
- cold request;
- PDF generation.

Do not report compliance without evidence.

## 10. Demo Data Set

Define:

- organization;
- users and roles;
- clients;
- projects;
- materials;
- hardware;
- quotations;
- versions;
- payments;
- files.

## 11. Demo Script

Provide the exact presentation sequence.

The script must run without:

- manual SQL;
- database corrections;
- environment changes;
- code modifications.

## 12. Freeze Policy

Define when new development stops and only release-blocking fixes are accepted.

## 13. Delivery Sequence

Order the work according to:

1. risk;
2. technical dependency;
3. demo criticality.

Database performance investigation must be first.

## 14. Open Decisions

Include only decisions not already resolved in authoritative documentation.

## Restrictions

- Do not modify application code.
- Do not install dependencies.
- Do not change environment variables.
- Do not run migrations.
- Do not create implementation branches.
- Do not assume a capability exists because documentation describes it.
- Do not invent evidence.

## Final response

Report:

- output file;
- estimated demo readiness percentage;
- P0 blocker count;
- P1 work-item count;
- first recommended action;
- unresolved decisions requiring human confirmation.