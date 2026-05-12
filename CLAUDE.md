# Trackaroo POC — AI Assistant Context

## Project Overview

This is the **trackaroo® Phase 1 Experience Layer + OCS** backend POC. It is a single NestJS monolith replacing a prior Fastify monorepo. The stack is NestJS 11 + Express, Prisma ORM with PostgreSQL (multi-schema), Swagger/OpenAPI docs, and configurable auth (mock JWT or Firebase Admin SDK).

## Architecture

### Module Map

```
src/
├── main.ts                    — bootstrap: ValidationPipe, Swagger, port binding
├── app.module.ts              — root module: ConfigModule, ScheduleModule, all feature modules, global guards/filter
├── common/
│   ├── config/env.schema.ts   — zod validation for env vars
│   ├── prisma/                — PrismaModule + PrismaService (OnModuleInit/Destroy)
│   ├── auth/                  — JwtStrategy, JwtAuthGuard, FirebaseAuthService, AuthService, AuthController
│   ├── guards/                — RolesGuard, SurvivalDataGuard
│   ├── decorators/            — @Public(), @Roles(), @RequireKind()
│   ├── filters/               — AppExceptionFilter (consistent { error: { code, message } })
│   └── errors/errors.ts       — AppError base class
├── health/                    — HealthController (GET /health)
├── ocs/                       — OCS module: PCRs, First Aid, Audit Log
├── sync/                      — Sync module: Profile, Groups, PCR Metadata
├── haztrack/                  — HazTrack module: Hazards, Ingestion service with @Cron
└── trackiq/                   — TrackIQ module: Score controller/service
```

### Database Schema (Prisma)

PostgreSQL with 3 schemas:
- `ocs` — `OcsUser`, `Pcr`, `FirstAidContent`, `AuditLog`
- `sync` — `MobileUser`, `Group`, `GroupMember`, `PcrMetadata`
- `haztrack` — `HazardCache`, `IngestRun`

Key rules enforced:
- `audit_log` is append-only (database trigger RAISE EXCEPTION on UPDATE/DELETE)
- PCR supersession chain via self-relation
- First Aid content has `draft` → `released` gate requiring clinical attestation PDF

## Auth & Authorization

### Dual Provider Auth

Controlled by `AUTH_PROVIDER` env var (`mock` | `firebase`).

**Mock mode (default for POC/demo):**
- `POST /v1/auth/login` accepts any password.
- Looks up OCS user by email, then mobile user by `firebaseUid` or `displayName`.
- Returns JWT signed with `AUTH_JWT_SECRET` (30-day expiry).
- Token payload: `{ sub, role, kind: 'ocs' | 'mobile' }`.

**Firebase mode:**
- `POST /v1/auth/login` does not exist (Firebase handles auth client-side).
- `JwtStrategy` verifies Bearer tokens via `FirebaseAuthService` using Firebase Admin SDK.
- Requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

### Guards (applied globally in `app.module.ts`)

1. **JwtAuthGuard** — validates JWT. Skip with `@Public()` decorator.
2. **RolesGuard** — checks `@Roles()` and `@RequireKind()` metadata against token payload.
3. **SurvivalDataGuard** — rejects request bodies containing keys matching `breadcrumb`, `sos`, `gps_fix`, `location_history` (VDP-5026 RT-05).

### Decorators

- `@Public()` — exempt endpoint from JWT auth.
- `@Roles(...OcsRole[])` — require specific OCS role.
- `@RequireKind('ocs' | 'mobile')` — require specific user kind.
- `@CurrentUser()` — inject `AuthUser` into controller parameter.

## API Conventions

- All controllers prefix with `v1/`. Example: `v1/ocs/pcrs`, `v1/sync/profile`.
- Swagger docs auto-generated at `/api-docs`.
- DTOs use `class-validator` + `@nestjs/swagger` `@ApiProperty` decorators.
- Controllers wrap successful responses as `{ data: ... }`.
- Errors are standardized by `AppExceptionFilter` to `{ error: { code, message } }`.

## Key Services

### AuditLogService

Centralized append-only audit logging. Methods:
- `append(opts)` — creates `AuditLog` record.
- `query(opts)` — paginated, filterable query.

### HazTrack IngestionService

Scheduled ingestion via `@nestjs/schedule`:
- BOM: every 15 minutes
- AFAC: every 30 minutes
- SES: every 60 minutes

Uses `FixtureFeedAdapter` for POC (reads from `fixtures/bom.json`, `fixtures/afac.json`, `fixtures/ses.json`).

### TrackIQ ScoreService

Deterministic scoring based on mode:
- `vehicle`: gradient ≤10 (low), ≤20 (moderate), >20 (high)
- `trail`: gradient ≤5 (low), ≤15 (moderate), >15 (high)
- `foot`: AWTGS grade 1-5 mapped directly

## Environment Variables

```bash
DATABASE_URL=postgresql://trackaroo:trackaroo@localhost:5432/trackaroo
AUTH_PROVIDER=mock                    # or 'firebase'
AUTH_JWT_SECRET=dev-secret-change-me  # min 8 chars
API_PORT=3000
LOG_LEVEL=info

# Required when AUTH_PROVIDER=firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Run database
docker compose up postgres -d

# Run migrations
pnpm db:migrate

# Seed data
pnpm db:seed

# Start dev server (watch mode)
pnpm start:dev

# Build
pnpm build

# Tests
pnpm test
pnpm test:e2e

# Swagger docs
open http://localhost:3000/api-docs

# Check prohibited patterns (VDP-5026)
pnpm check:prohibited
```

## VDP-5026 Compliance Checklist

When modifying code, verify:
- [ ] No Firestore imports or usage (RT-05)
- [ ] No UPDATE/DELETE on `audit_log` (immutable)
- [ ] PCR supersession updates `status` to `superseded`
- [ ] First Aid release requires `clinicalAttestationPdfUrl`
- [ ] HazTrack ingestion is independent of OCS/Sync tables
- [ ] TrackIQ scoring is deterministic (no randomness)
- [ ] Survival data keys blocked by `SurvivalDataGuard`

## Testing

Jest is configured in `package.json`. E2E tests use `test/jest-e2e.json`. A `test/setup.ts` file exists for global test setup.

## Important Notes for AI Assistants

- **Never add Firestore** — PostgreSQL/Prisma is the only database.
- **Never mock database in integration tests** — hit real PostgreSQL.
- **Prefer editing existing files over creating new ones**.
- **Use `@Public()` for auth-free endpoints** (login, health).
- **Add `@ApiProperty()` to all DTO fields** for Swagger completeness.
- **Run `pnpm check:prohibited` before committing**.
- **When adding new env vars, update `env.schema.ts` and `.env.example`**.
- **Docker Compose** includes postgres + api, but Docker daemon may not be available on the host for local dev.
