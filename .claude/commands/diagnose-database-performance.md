# Command: Diagnose Database Performance

## Purpose

Diagnose database latency, connection-management problems and application-level performance issues in InnoCore Carpentry Suite.

This command is diagnostic-only.

Do not implement fixes unless explicitly requested in a separate task after the diagnosis is reviewed.

## Input

Optional argument:

`$ARGUMENTS`

Use it for:

- a specific slow page;
- a failing query;
- a production or local environment;
- additional measurements;
- an error message.

## Mandatory context

Read:

- `CLAUDE.md`
- `docs/AI_CONTEXT.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/PERFORMANCE_BASELINE.md`
- `package.json`
- `prisma/schema.prisma`
- Prisma client initialization files
- environment variable example files
- Vercel configuration
- Supabase configuration
- database scripts
- performance scripts
- existing latency documentation
- files mentioning prepared statements or pooling

Inspect actual implementation before reaching conclusions.

Never expose secret values.

## Known historical symptoms

Treat these as observations requiring current confirmation:

- cold `SELECT 1`: approximately 1000–1765 ms;
- warm measurements: approximately 108–548 ms;
- organization and client operations: approximately 210–582 ms;
- tenant-filtered queries: occasionally approximately 431–1095 ms;
- PostgreSQL or Prisma error:
  `prepared statement "s2" already exists`;
- suspicion of direct connections without correctly configured pooling.

## Diagnostic questions

Determine:

1. Is the application using a direct database URL or pooled URL?
2. Is `DIRECT_URL` configured?
3. Which connection is used at runtime?
4. Which connection is used for migrations?
5. Is the Supabase pooler in transaction or session mode?
6. Is the current configuration compatible with Prisma?
7. Is Prisma Client created once or repeatedly?
8. Is the code running in Node.js or Edge runtime?
9. Are Vercel and Supabase deployed in aligned regions?
10. Is latency caused by networking, connection setup, queries or rendering?
11. Is authentication adding repeated database calls?
12. Are there N+1 queries?
13. Are collections unbounded?
14. Are required indexes missing?
15. Are queries running sequentially when they can run concurrently?
16. Are prepared statements incompatible with the pooler mode?

## 1. Connection topology

Document:

- runtime;
- Prisma version;
- PostgreSQL configuration;
- current `DATABASE_URL` usage;
- current `DIRECT_URL` usage;
- pooler type;
- migration connection;
- production connection;
- local connection;
- Prisma Accelerate or adapter usage;
- serverless connection behavior.

Do not print credentials, hosts containing secrets or passwords.

Redact sensitive values.

## 2. Region alignment

Identify available evidence for:

- Supabase region;
- Vercel function region;
- local development location.

If repository evidence is insufficient, classify it as:

`MANUAL VERIFICATION REQUIRED`

Do not guess.

## 3. Prisma client lifecycle

Review:

- singleton pattern;
- global caching in development;
- production initialization;
- Server Actions;
- route handlers;
- server components;
- test setup;
- accidental multiple client instances;
- transactions;
- client disconnection behavior.

## 4. Prepared statement analysis

Investigate:

`prepared statement "s2" already exists`

Evaluate possible relation to:

- PgBouncer transaction mode;
- prepared statement support;
- connection string flags;
- Prisma version;
- test concurrency;
- reused pooled sessions;
- multiple Prisma clients;
- connection adapter behavior.

Rank possible causes by confidence.

Do not apply speculative fixes.

## 5. Query analysis

Inspect the operations needed by the demo:

- dashboard;
- client list;
- project list;
- material list;
- hardware list;
- quotation detail;
- costing;
- payment balance;
- commercial history.

Look for:

- N+1 queries;
- repeated `organizationId` or user lookups;
- unnecessary relation loading;
- large `include` graphs;
- unbounded `findMany`;
- sequential independent queries;
- duplicate aggregate queries;
- repeated counts;
- missing indexes;
- client-side waterfalls;
- repeated Server Actions;
- unnecessary cache invalidation.

## 6. Latency separation

Separate measurements into:

### Database-only latency

- raw connection;
- `SELECT 1`;
- simple tenant-scoped query;
- complex quotation query.

### Application latency

- authentication;
- authorization;
- data transformation;
- React rendering;
- Server Action execution;
- network transfer;
- full page response.

### Environment

- local cold;
- local warm;
- deployed cold;
- deployed warm.

## 7. Measurement procedure

Use existing repository commands when available.

Only claim execution when a command was actually run.

If no scripts exist, propose scripts such as:

- `db:benchmark`
- `db:benchmark:queries`
- `perf:demo-flow`

Mark them as proposed.

Do not add them in this diagnostic task.

## Required output

Create or update:

`docs/DATABASE_PERFORMANCE_DIAGNOSIS.md`

Use this structure:

# Database Performance Diagnosis

## 1. Executive Summary

## 2. Diagnosis Status

Use one:

- CONFIRMED
- PARTIALLY CONFIRMED
- INCONCLUSIVE

## 3. Current Connection Architecture

## 4. Evidence Found

## 5. Suspected Causes Ranked

| Rank | Suspected Cause | Confidence | Evidence | Verification Method |

## 6. Prepared Statement Analysis

## 7. Prisma Client Lifecycle Findings

## 8. Region Alignment Findings

## 9. Query-Level Findings

| Operation | Finding | Risk | Expected Impact | Evidence |

## 10. Database vs Application Latency

## 11. Recommended Configuration

Use placeholders only.

Example:

```env
DATABASE_URL="<pooled-runtime-url>"
DIRECT_URL="<direct-migration-url>"