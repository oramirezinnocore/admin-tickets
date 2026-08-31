# InnoCore Carpentry Suite

**Vertical SaaS ERP for carpentry workshops and custom furniture manufacturers.**

Multi-tenant, project-centered system for managing quotations, costing, production, and payments.

---

## Stack

- **Framework:** Next.js 15+ (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Testing:** Vitest (unit + integration with real PostgreSQL)
- **UI:** Tailwind CSS + shadcn/ui
- **Validation:** Zod

---

## Documentation Structure

This project's AI context is split across several documents:

- **`@docs/AI_CONTEXT.md`** — Core principles, architectural patterns, domain rules, and agent workflow guidance
- **`@docs/PRODUCT_UX_MASTER_PLAN.md`** — Product vision, UX rules, navigation, roles, and evolution principles
- **`@docs/BUSINESS_RULES.md`** — Formal business rules (versioning, costing, payments, folios, audit, etc.)
- **`@docs/ARCHITECTURE_DECISIONS.md`** — ADRs documenting key technical decisions
- **`@docs/PERMISSION_MATRIX.md`** — Role-based capabilities matrix
- **`@docs/TESTING_STANDARDS.md`** — Unit and integration test requirements
- **`@docs/PERFORMANCE_BASELINE.md`** — Performance benchmarks and regression thresholds

Historical context:
- **`@docs/history/BETA_INITIAL_PLAN.md`** — Original beta scope (non-normative)

---

## Mandatory Rules

### 1. Inspect Before Assuming

**Before making claims about the codebase:**

- Check `package.json` for available commands
- Read Prisma schema for current data model
- Verify test configuration (Vitest setup, not Jest)
- Inspect service layer structure in `lib/services/`
- Review existing documentation

**Do not assume:**
- Commands not listed in `package.json`
- Database strategies not reflected in current schema
- Testing patterns not implemented in `tests/`

---

### 2. Multi-Tenancy (CRITICAL)

**Every business table MUST include `organizationId`.**

**NEVER allow users to access data from another organization.**

All queries must filter by `organizationId` from authenticated user context.

```typescript
// ✅ CORRECT
const clients = await prisma.client.findMany({
  where: { organizationId: user.organizationId }
})

// ❌ NEVER DO THIS
const clients = await prisma.client.findMany()
```

---

### 3. Decimal Handling for Money

**NEVER use `float` or `number` for monetary amounts.**

**ALWAYS use Prisma `Decimal` with `@db.Decimal(10, 2)`.**

Use `decimal.js` for client-side calculations.

```typescript
// ✅ CORRECT
import { Decimal } from 'decimal.js'

const total = new Decimal(subtotal).plus(tax)

// ❌ INCORRECT
const total = subtotal + tax
```

---

### 4. Quotation Versioning

- A quotation can have multiple versions
- A version with status `SENT` or `ACCEPTED` **cannot be modified**
- To make changes, **create a new version**
- Only the latest version can be `DRAFT`

See `@docs/BUSINESS_RULES.md` for detailed state transitions.

---

### 5. Security

- **All sensitive operations MUST execute on the server** (Server Actions or API Routes)
- Validate authentication and authorization on every request
- Validate inputs with Zod on both client and server
- Sanitize user input before database writes
- Never expose internal IDs in public URLs (use UUIDs)

---

### 6. Testing Requirements

- **Unit tests:** Services (pure logic)
- **Integration tests:** Services with real PostgreSQL database
- **Test organization checks** (multi-tenancy isolation)
- **Test financial calculations** (Decimal precision, costing formulas)

See `@docs/TESTING_STANDARDS.md` for full requirements.

---

### 7. Code Conventions

**TypeScript:**
- Strict mode enabled
- Avoid `any`, use `unknown` when necessary
- Type all component props
- Use Prisma-generated types

**Components:**
- Server Components by default
- Mark with `'use client'` only when necessary (forms, state hooks)
- Props in English, UI in Spanish
- Extract complex logic to custom hooks

**Server Actions:**
- Keep them thin (auth + validation only)
- Delegate business logic to services
- Return structured results
- Revalidate paths as needed

---

## Quality Gates

Before committing:

1. **Type-check:** `npm run typecheck`
2. **Lint:** `npm run lint`
3. **Unit tests:** `npm test`
4. **Integration tests:** `npm run test:integration` (requires PostgreSQL test database)
5. **Build:** `npm run build`

---

## Verified Commands (from package.json)

```bash
# Development
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Testing
npm test                    # Unit tests (Vitest)
npm run test:watch          # Watch mode
npm run test:integration    # Integration tests (real PostgreSQL)

# Test database (Docker Compose)
npm run test:db:start       # Start test PostgreSQL (port 5433)
npm run test:db:stop        # Stop test PostgreSQL
npm run test:db:reset       # Reset test database
npm run test:db:migrate     # Run migrations on test DB

# Prisma
npm run db:generate         # Generate Prisma Client
npm run db:migrate          # Run migrations (dev)
npm run db:push             # Push schema changes
npm run db:seed             # Seed data
npm run db:studio           # Open Prisma Studio
npm run db:ping             # Test DB connection

# Build
npm run build
npm run start
```

---

## Agent Workflow

When working on this codebase:

1. **Read** `@docs/AI_CONTEXT.md` for architectural context
2. **Consult** `@docs/PRODUCT_UX_MASTER_PLAN.md` for product decisions
3. **Validate** against `@docs/BUSINESS_RULES.md` before implementing features
4. **Check** `@docs/ARCHITECTURE_DECISIONS.md` for established patterns
5. **Follow** `@docs/TESTING_STANDARDS.md` when writing tests

For specialized tasks:
- **Product design:** Use `product-architect` agent
- **Product validation:** Use `product-reviewer` agent
- **Backend implementation:** Use `backend-developer` agent
- **Frontend implementation:** Use `frontend-developer` agent
- **SaaS concerns:** Use `saas-architect` agent

---

## Documentation Maintenance

- **CLAUDE.md** (this file): Concise entry point, permanent rules only
- **Detailed docs** (`docs/*.md`): Source of truth for domain, architecture, and standards
- **PRODUCT_UX_MASTER_PLAN.md**: Living document, product owner maintains
- **Open decisions**: Tracked in `@docs/BUSINESS_RULES.md` and `@docs/PERMISSION_MATRIX.md`

When adding features or changing patterns:
- Update relevant documentation
- Document decisions in ADRs
- Keep cross-references consistent

---

## Project Principles

1. **Project-centered:** Everything revolves around the Project entity, not Client or Quotation
2. **Service-layer architecture:** Business logic in services, not in Server Actions
3. **Multi-tenant by design:** Every query filters by `organizationId`
4. **Immutable versioning:** Sent/accepted quotations cannot be edited
5. **Real-database testing:** Integration tests use PostgreSQL, not in-memory mocks
6. **Decimal precision:** All money uses Prisma Decimal and decimal.js

See `@docs/AI_CONTEXT.md` for extended principles and `@docs/ARCHITECTURE_DECISIONS.md` for rationale.

---

## Role Selection

Before starting any task, determine the engineering role that best matches the request.

Use the following guidance:

| Task | Primary Role |
|-------|--------------|
| Product specification | product-architect |
| UX review | product-reviewer |
| Domain modeling | domain-architect |
| Backend implementation | backend-developer |
| Frontend implementation | frontend-developer |
| SaaS architecture | saas-architect |
| Implementation verification | implementation-auditor |
| Sprint planning | delivery-manager |

When a prompt explicitly starts with:

Role: <role-name>

Adopt that engineering role for the entire response.

Do not mix responsibilities between roles.

If the requested task spans multiple roles, complete the work from the primary role first and explicitly identify any follow-up reviews that should be performed by other roles.

---

_For historical context on initial beta goals, see `@docs/history/BETA_INITIAL_PLAN.md` (non-normative)._
