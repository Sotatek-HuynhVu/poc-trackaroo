# Trackaroo POC Backend

> trackaroo® Phase 1 Experience Layer + OCS — NestJS backend POC.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL
docker compose up postgres -d

# 3. Copy env and configure
cp .env.example .env

# 4. Run migrations
pnpm db:migrate

# 5. Seed demo data
pnpm db:seed

# 6. Start dev server
pnpm start:dev
```

- API: http://localhost:3000
- Swagger docs: http://localhost:3000/api-docs

## Tech Stack

- **Framework:** NestJS 11 (Express platform)
- **Database:** PostgreSQL 16 + Prisma ORM
- **Auth:** JWT (mock mode) or Firebase Admin SDK
- **Docs:** Swagger/OpenAPI (auto-generated)
- **Scheduler:** @nestjs/schedule (cron ingestion)
- **Testing:** Jest + Supertest

## Project Structure

```
src/
├── common/          — Auth, Prisma, Guards, Decorators, Filters, Errors
├── health/          — Health check endpoint
├── ocs/             — PCRs, First Aid, Audit Log
├── sync/            — Mobile profile, Groups, PCR metadata
├── haztrack/        — Hazard ingestion & hazard cache
└── trackiq/         — Deterministic scoring engine
```

## Auth

### Mock Mode (default)

Any password works for demo purposes. Login with seeded accounts:

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ops@trackaroo.dev","password":"demo"}'
```

Seeded OCS users: `director@trackaroo.dev`, `ops@trackaroo.dev`, `contributor@trackaroo.dev`
Seeded mobile users: `mobile-001`, `mobile-002`, `mobile-003`

### Firebase Mode

Set `AUTH_PROVIDER=firebase` and provide Firebase Admin credentials. Clients authenticate directly with Firebase and send ID tokens as `Authorization: Bearer <token>`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run compiled app |
| `pnpm start:dev` | Run with watch mode |
| `pnpm test` | Run Jest tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm db:migrate` | Deploy Prisma migrations |
| `pnpm db:seed` | Seed database |
| `pnpm check:prohibited` | Run VDP-5026 compliance check |

## Docker

```bash
# Full stack (PostgreSQL + API)
docker compose up --build
```

## Environment Variables

See `.env.example` for all available options.

## License

Proprietary — trackaroo® internal POC.
