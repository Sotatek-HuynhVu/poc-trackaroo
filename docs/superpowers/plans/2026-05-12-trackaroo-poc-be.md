# trackaroo® POC Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a demo-walkthrough backend (API + Worker) for the trackaroo® Experience Layer and OCS, enforcing VDP-5026 safety constraints at the DB and middleware level.

**Architecture:** Two Node.js/TypeScript processes (Fastify API + node-cron Worker) sharing a Postgres DB via Prisma, organized as a pnpm monorepo with a `shared` package for cross-cutting concerns.

**Tech Stack:** TypeScript (strict), Fastify, Prisma, Postgres 16, node-cron, zod, pino, p-retry, vitest, supertest, testcontainers, Docker Compose.

---

## File Structure

```
trackaroo-poc/
├── package.json                          # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── docker-compose.yml
├── .env.example
├── fixtures/
│   ├── bom.json
│   ├── afac.json
│   └── ses.json
├── scripts/
│   └── check-prohibited.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       └── 001_audit_log_trigger.sql
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── config.ts
│   │       ├── logger.ts
│   │       ├── errors.ts
│   │       ├── auth/
│   │       │   ├── types.ts
│   │       │   ├── mock-provider.ts
│   │       │   └── index.ts
│   │       └── db.ts
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── app.ts
│   │       ├── plugins/
│   │       │   ├── auth.ts
│   │       │   └── error-handler.ts
│   │       ├── middleware/
│   │       │   ├── rbac.ts
│   │       │   └── survival-data-guard.ts
│   │       └── routes/
│   │           ├── health.ts
│   │           ├── ocs/
│   │           │   ├── pcrs.ts
│   │           │   ├── first-aid.ts
│   │           │   └── audit-log.ts
│   │           ├── sync/
│   │           │   ├── profile.ts
│   │           │   ├── groups.ts
│   │           │   └── pcr-metadata.ts
│   │           ├── haztrack/
│   │           │   └── hazards.ts
│   │           └── trackiq/
│   │               └── score.ts
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── scheduler.ts
│           ├── ingest-service.ts
│           ├── adapters/
│           │   ├── types.ts
│           │   └── fixture-adapter.ts
│           └── health.ts
└── tests/
    ├── setup.ts
    ├── helpers.ts
    ├── integration/
    │   ├── audit-log.test.ts
    │   ├── pcr-supersession.test.ts
    │   ├── first-aid-release.test.ts
    │   ├── rbac.test.ts
    │   ├── survival-data-guard.test.ts
    │   ├── zero-firestore.test.ts
    │   ├── ingest-idempotency.test.ts
    │   └── trackiq-scoring.test.ts
    └── vitest.config.ts
```

---

## Task 1: Monorepo scaffold + Docker Compose

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/api/package.json`, `packages/api/tsconfig.json`
- Create: `packages/worker/package.json`, `packages/worker/tsconfig.json`
- Create: `docker-compose.yml`

- [ ] **Step 1: Initialize pnpm workspace root**

```bash
pnpm init
```

Edit `package.json`:
```json
{
  "name": "trackaroo-poc",
  "private": true,
  "scripts": {
    "dev:api": "pnpm --filter @trackaroo/api dev",
    "dev:worker": "pnpm --filter @trackaroo/worker dev",
    "build": "pnpm -r build",
    "test": "vitest run",
    "db:migrate": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "check:prohibited": "tsx scripts/check-prohibited.ts"
  }
}
```

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 3: Create shared package.json + tsconfig**

`packages/shared/package.json`:
```json
{
  "name": "@trackaroo/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@prisma/client": "^6.6.0",
    "pino": "^9.6.0",
    "zod": "^3.24.0",
    "jsonwebtoken": "^9.0.0",
    "ulid": "^2.3.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.0",
    "typescript": "^5.7.0"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create api package.json + tsconfig**

`packages/api/package.json`:
```json
{
  "name": "@trackaroo/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@trackaroo/shared": "workspace:*",
    "fastify": "^5.3.0",
    "@fastify/multipart": "^9.0.0",
    "fastify-plugin": "^5.0.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

`packages/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create worker package.json + tsconfig**

`packages/worker/package.json`:
```json
{
  "name": "@trackaroo/worker",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@trackaroo/shared": "workspace:*",
    "fastify": "^5.3.0",
    "node-cron": "^3.0.0",
    "p-retry": "^6.2.0"
  },
  "devDependencies": {
    "@types/node-cron": "^3.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

`packages/worker/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create .env.example**

```env
DATABASE_URL=postgresql://trackaroo:trackaroo@localhost:5432/trackaroo
AUTH_PROVIDER=mock
AUTH_JWT_SECRET=dev-secret-change-me
API_PORT=3000
WORKER_HEALTH_PORT=3001
LOG_LEVEL=info
```

- [ ] **Step 7: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: trackaroo
      POSTGRES_PASSWORD: trackaroo
      POSTGRES_DB: trackaroo
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U trackaroo"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://trackaroo:trackaroo@postgres:5432/trackaroo
      AUTH_PROVIDER: mock
      AUTH_JWT_SECRET: dev-secret-change-me
      API_PORT: "3000"
      LOG_LEVEL: info
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 10s
      timeout: 3s
      retries: 3

  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: worker
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://trackaroo:trackaroo@postgres:5432/trackaroo
      WORKER_HEALTH_PORT: "3001"
      LOG_LEVEL: info
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/health"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  pgdata:
```

- [ ] **Step 8: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 9: Verify workspace resolves**

```bash
pnpm ls -r --depth 0
```

Expected: all 3 packages listed with workspace links.

- [ ] **Step 10: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold monorepo with api, worker, shared packages + docker-compose"
```

---

## Task 2: Shared package — config, logger, errors

**Files:**
- Create: `packages/shared/src/config.ts`
- Create: `packages/shared/src/logger.ts`
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create config.ts with zod validation**

```typescript
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_PROVIDER: z.enum(["mock", "firebase"]).default("mock"),
  AUTH_JWT_SECRET: z.string().min(8).default("dev-secret-change-me"),
  API_PORT: z.coerce.number().default(3000),
  WORKER_HEALTH_PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function loadConfig(): Env {
  return envSchema.parse(process.env);
}
```

- [ ] **Step 2: Create logger.ts with pino + redaction**

```typescript
import pino from "pino";
import { loadConfig } from "./config.js";

const REDACT_PATHS = [
  "lat", "lng", "location", "coordinates", "breadcrumb", "sos",
  "*.lat", "*.lng", "*.location", "*.coordinates", "*.breadcrumb", "*.sos",
];

export function createLogger(name: string) {
  const config = loadConfig();
  return pino({
    name,
    level: config.LOG_LEVEL,
    redact: REDACT_PATHS,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
```

- [ ] **Step 3: Create errors.ts**

```typescript
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly details?: unknown) {
    super("VALIDATION_ERROR", 400, message);
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthorized") {
    super("AUTH_ERROR", 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super("NOT_FOUND", 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", 409, message);
  }
}

export class SurvivalDataRejectedError extends AppError {
  constructor() {
    super("RT05_SURVIVAL_DATA_REJECTED", 400, "Survival data rejected per RT-05");
  }
}
```

- [ ] **Step 4: Create index.ts barrel export**

```typescript
export { loadConfig, type Env } from "./config.js";
export { createLogger } from "./logger.js";
export * from "./errors.js";
```

- [ ] **Step 5: Verify compilation**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/
git commit -m "feat(shared): add config, logger with redaction, error classes"
```

---

## Task 3: Prisma schema + audit log trigger migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/001_audit_log_trigger/migration.sql`
- Create: `prisma/seed.ts`
- Create: `packages/shared/src/db.ts`

- [ ] **Step 1: Create prisma/schema.prisma**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["ocs", "sync", "haztrack"]
}

// === OCS Schema ===

model OcsUser {
  id          String   @id @default(uuid())
  email       String   @unique
  displayName String   @map("display_name")
  role        OcsRole
  createdAt   DateTime @default(now()) @map("created_at")

  pcrsCreated Pcr[]
  auditLogs   AuditLog[]

  @@map("users")
  @@schema("ocs")
}

enum OcsRole {
  project_director
  operations
  contributor

  @@schema("ocs")
}

model Pcr {
  id            String    @id @default(uuid())
  projectId     String    @map("project_id")
  lat           Float
  lng           Float
  category      String
  status        PcrStatus @default(active)
  supersededBy  String?   @map("superseded_by")
  supersededByR Pcr?      @relation("PcrSupersession", fields: [supersededBy], references: [id])
  supersedes    Pcr[]     @relation("PcrSupersession")
  createdBy     String    @map("created_by")
  createdByUser OcsUser   @relation(fields: [createdBy], references: [id])
  createdAt     DateTime  @default(now()) @map("created_at")

  @@map("pcrs")
  @@schema("ocs")
}

enum PcrStatus {
  active
  superseded

  @@schema("ocs")
}

model FirstAidContent {
  id                        String          @id @default(uuid())
  slug                      String          @unique
  body                      String
  version                   Int             @default(1)
  status                    FirstAidStatus  @default(draft)
  clinicalAttestationPdfUrl String?         @map("clinical_attestation_pdf_url")
  releasedBy                String?         @map("released_by")
  releasedAt                DateTime?       @map("released_at")

  @@map("first_aid_content")
  @@schema("ocs")
}

enum FirstAidStatus {
  draft
  released

  @@schema("ocs")
}

model AuditLog {
  id            String   @id @default(uuid())
  actorUserId   String   @map("actor_user_id")
  actorUser     OcsUser  @relation(fields: [actorUserId], references: [id])
  action        String
  entityType    String   @map("entity_type")
  entityId      String   @map("entity_id")
  previousState Json?    @map("previous_state")
  newState      Json?    @map("new_state")
  at            DateTime @default(now())

  @@map("audit_log")
  @@schema("ocs")
}

// === Sync Schema ===

model MobileUser {
  firebaseUid String   @id @map("firebase_uid")
  displayName String   @map("display_name")
  archetype   String?
  preferences Json     @default("{}")
  updatedAt   DateTime @updatedAt @map("updated_at")

  ownedGroups  Group[]
  memberships  GroupMember[]
  pcrMetadata  PcrMetadata[]

  @@map("mobile_users")
  @@schema("sync")
}

model Group {
  id        String   @id @default(uuid())
  name      String
  ownerUid  String   @map("owner_uid")
  owner     MobileUser @relation(fields: [ownerUid], references: [firebaseUid])
  createdAt DateTime @default(now()) @map("created_at")

  members GroupMember[]

  @@map("groups")
  @@schema("sync")
}

model GroupMember {
  groupId  String     @map("group_id")
  group    Group      @relation(fields: [groupId], references: [id])
  userUid  String     @map("user_uid")
  user     MobileUser @relation(fields: [userUid], references: [firebaseUid])
  joinedAt DateTime   @default(now()) @map("joined_at")

  @@id([groupId, userUid])
  @@map("group_members")
  @@schema("sync")
}

model PcrMetadata {
  id      String     @id @default(uuid())
  pcrId   String     @map("pcr_id")
  userUid String     @map("user_uid")
  user    MobileUser @relation(fields: [userUid], references: [firebaseUid])
  notes   String?
  tags    String[]

  @@map("pcr_metadata")
  @@schema("sync")
}

// === HazTrack Schema ===

model HazardCache {
  id         String   @id @default(uuid())
  source     HazardSource
  externalId String   @map("external_id")
  geom       Json
  payload    Json
  fetchedAt  DateTime @map("fetched_at")
  ttlMinutes Int      @map("ttl_minutes")

  @@unique([source, externalId])
  @@map("hazard_cache")
  @@schema("haztrack")
}

enum HazardSource {
  bom
  afac
  ses

  @@schema("haztrack")
}

model IngestRun {
  id           String      @id @default(uuid())
  source       HazardSource
  startedAt    DateTime    @default(now()) @map("started_at")
  finishedAt   DateTime?   @map("finished_at")
  status       IngestStatus @default(ok)
  itemsFetched Int         @default(0) @map("items_fetched")
  error        String?

  @@map("ingest_runs")
  @@schema("haztrack")
}

enum IngestStatus {
  ok
  partial
  failed

  @@schema("haztrack")
}
```

- [ ] **Step 2: Create raw SQL migration for audit_log trigger**

Create `prisma/migrations/001_audit_log_trigger/migration.sql`:
```sql
-- Create schemas
CREATE SCHEMA IF NOT EXISTS ocs;
CREATE SCHEMA IF NOT EXISTS sync;
CREATE SCHEMA IF NOT EXISTS haztrack;

-- Audit log immutability trigger
CREATE OR REPLACE FUNCTION ocs.audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only'
    USING ERRCODE = '2F003';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_modify
  BEFORE UPDATE OR DELETE ON ocs.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION ocs.audit_log_immutable();
```

- [ ] **Step 3: Create packages/shared/src/db.ts**

```typescript
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
```

- [ ] **Step 4: Update shared/src/index.ts to export db**

```typescript
export { loadConfig, type Env } from "./config.js";
export { createLogger } from "./logger.js";
export * from "./errors.js";
export { getDb, disconnectDb } from "./db.js";
```

- [ ] **Step 5: Create prisma/seed.ts**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.ocsUser.createMany({
    data: [
      { id: "pd-001", email: "director@trackaroo.dev", displayName: "Project Director", role: "project_director" },
      { id: "ops-001", email: "ops@trackaroo.dev", displayName: "Operations", role: "operations" },
      { id: "contrib-001", email: "contributor@trackaroo.dev", displayName: "Contributor", role: "contributor" },
    ],
    skipDuplicates: true,
  });

  await prisma.mobileUser.createMany({
    data: [
      { firebaseUid: "mobile-001", displayName: "Demo Hiker", archetype: "hiker", preferences: {} },
      { firebaseUid: "mobile-002", displayName: "Demo Driver", archetype: "4wd", preferences: {} },
    ],
    skipDuplicates: true,
  });

  console.log("Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Run migration + seed against local Postgres**

```bash
docker compose up postgres -d
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
```

Expected: tables created in all 3 schemas, seed data inserted.

- [ ] **Step 7: Commit**

```bash
git add prisma/ packages/shared/src/db.ts packages/shared/src/index.ts
git commit -m "feat(db): prisma schema with 3 schemas + audit_log immutability trigger + seed"
```

---

## Task 4: Auth — IAuthProvider + MockAuthProvider

**Files:**
- Create: `packages/shared/src/auth/types.ts`
- Create: `packages/shared/src/auth/mock-provider.ts`
- Create: `packages/shared/src/auth/index.ts`
- Create: `dev/seed-tokens.ts`

- [ ] **Step 1: Create auth/types.ts**

```typescript
export type UserKind = "ocs" | "mobile";

export type OcsRoleName = "project_director" | "operations" | "contributor";

export interface AuthUser {
  sub: string;
  role: OcsRoleName | null;
  kind: UserKind;
}

export interface IAuthProvider {
  verify(token: string): Promise<AuthUser>;
}
```

- [ ] **Step 2: Create auth/mock-provider.ts**

```typescript
import jwt from "jsonwebtoken";
import { loadConfig } from "../config.js";
import type { AuthUser, IAuthProvider } from "./types.js";

export class MockAuthProvider implements IAuthProvider {
  async verify(token: string): Promise<AuthUser> {
    const config = loadConfig();
    const payload = jwt.verify(token, config.AUTH_JWT_SECRET) as AuthUser;
    return {
      sub: payload.sub,
      role: payload.role ?? null,
      kind: payload.kind,
    };
  }
}
```

- [ ] **Step 3: Create auth/index.ts**

```typescript
import { loadConfig } from "../config.js";
import type { IAuthProvider } from "./types.js";
import { MockAuthProvider } from "./mock-provider.js";

export type { AuthUser, IAuthProvider, UserKind, OcsRoleName } from "./types.js";
export { MockAuthProvider } from "./mock-provider.js";

export function createAuthProvider(): IAuthProvider {
  const config = loadConfig();
  switch (config.AUTH_PROVIDER) {
    case "mock":
      return new MockAuthProvider();
    case "firebase":
      throw new Error("FirebaseAuthProvider not implemented in POC — set AUTH_PROVIDER=mock");
    default:
      throw new Error(`Unknown AUTH_PROVIDER: ${config.AUTH_PROVIDER}`);
  }
}
```

- [ ] **Step 4: Update shared/src/index.ts**

```typescript
export { loadConfig, type Env } from "./config.js";
export { createLogger } from "./logger.js";
export * from "./errors.js";
export { getDb, disconnectDb } from "./db.js";
export { createAuthProvider, MockAuthProvider } from "./auth/index.js";
export type { AuthUser, IAuthProvider, UserKind, OcsRoleName } from "./auth/index.js";
```

- [ ] **Step 5: Create dev/seed-tokens.ts**

```typescript
import jwt from "jsonwebtoken";

const SECRET = "dev-secret-change-me";

const tokens = [
  { sub: "pd-001", role: "project_director", kind: "ocs" },
  { sub: "ops-001", role: "operations", kind: "ocs" },
  { sub: "contrib-001", role: "contributor", kind: "ocs" },
  { sub: "mobile-001", role: null, kind: "mobile" },
  { sub: "mobile-002", role: null, kind: "mobile" },
];

for (const payload of tokens) {
  const token = jwt.sign(payload, SECRET, { expiresIn: "30d" });
  console.log(`${payload.kind}/${payload.sub}: Bearer ${token}\n`);
}
```

- [ ] **Step 6: Generate tokens and verify**

```bash
npx tsx dev/seed-tokens.ts
```

Expected: 5 JWT tokens printed, one per user.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/auth/ dev/seed-tokens.ts
git commit -m "feat(auth): IAuthProvider interface + MockAuthProvider with JWT"
```

---

## Task 5: API — Fastify app shell + plugins (auth, error handler)

**Files:**
- Create: `packages/api/src/app.ts`
- Create: `packages/api/src/plugins/auth.ts`
- Create: `packages/api/src/plugins/error-handler.ts`
- Create: `packages/api/src/middleware/survival-data-guard.ts`
- Create: `packages/api/src/middleware/rbac.ts`
- Create: `packages/api/src/routes/health.ts`
- Create: `packages/api/src/index.ts`

- [ ] **Step 1: Create plugins/auth.ts**

```typescript
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createAuthProvider, AuthError, type AuthUser } from "@trackaroo/shared";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const provider = createAuthProvider();

  app.decorateRequest("user", null);

  app.addHook("onRequest", async (request: FastifyRequest) => {
    if (request.url === "/health") return;

    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AuthError("Missing or invalid Authorization header");
    }
    const token = header.slice(7);
    try {
      request.user = await provider.verify(token);
    } catch {
      throw new AuthError("Invalid token");
    }
  });
});
```

- [ ] **Step 2: Create plugins/error-handler.ts**

```typescript
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@trackaroo/shared";

export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error: Error, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      return reply.status(error.status).send({
        error: { code: error.code, message: error.message },
      });
    }
    request.log.error(error);
    return reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  });
});
```

- [ ] **Step 3: Create middleware/survival-data-guard.ts**

```typescript
import type { FastifyRequest } from "fastify";
import { SurvivalDataRejectedError } from "@trackaroo/shared";

const FORBIDDEN_KEYS = /^(breadcrumbs?|sos|gps_fix|location_history)$/i;

export async function survivalDataGuard(request: FastifyRequest) {
  const body = request.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    for (const key of Object.keys(body)) {
      if (FORBIDDEN_KEYS.test(key)) {
        throw new SurvivalDataRejectedError();
      }
    }
  }
}
```

- [ ] **Step 4: Create middleware/rbac.ts**

```typescript
import type { FastifyRequest } from "fastify";
import { ForbiddenError, type OcsRoleName, type UserKind } from "@trackaroo/shared";

interface RbacOptions {
  kind: UserKind;
  roles?: OcsRoleName[];
}

export function rbac(options: RbacOptions) {
  return async (request: FastifyRequest) => {
    const user = request.user;
    if (user.kind !== options.kind) {
      throw new ForbiddenError(`Requires ${options.kind} token`);
    }
    if (options.roles && options.roles.length > 0) {
      if (!user.role || !options.roles.includes(user.role)) {
        throw new ForbiddenError(`Requires role: ${options.roles.join(" | ")}`);
      }
    }
  };
}
```

- [ ] **Step 5: Create routes/health.ts**

```typescript
import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));
}
```

- [ ] **Step 6: Create app.ts**

```typescript
import Fastify from "fastify";
import { createLogger } from "@trackaroo/shared";
import { authPlugin } from "./plugins/auth.js";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { healthRoutes } from "./routes/health.js";

export async function buildApp() {
  const logger = createLogger("api");
  const app = Fastify({ logger });

  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(healthRoutes);

  return app;
}
```

- [ ] **Step 7: Create index.ts entrypoint**

```typescript
import { loadConfig, disconnectDb } from "@trackaroo/shared";
import { buildApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const app = await buildApp();

  const shutdown = async () => {
    await app.close();
    await disconnectDb();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 8: Verify API starts**

```bash
cd packages/api && npx tsx src/index.ts &
sleep 2
curl http://localhost:3000/health
kill %1
```

Expected: `{"status":"ok"}`

- [ ] **Step 9: Commit**

```bash
git add packages/api/src/
git commit -m "feat(api): fastify app shell with auth, error handler, RBAC, survival-data guard"
```

---

## Task 6: OCS routes — PCRs + supersession

**Files:**
- Create: `packages/api/src/routes/ocs/pcrs.ts`

- [ ] **Step 1: Create routes/ocs/pcrs.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb, ValidationError, NotFoundError } from "@trackaroo/shared";
import { rbac } from "../../middleware/rbac.js";

const createPcrSchema = z.object({
  projectId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: z.string().min(1),
});

const supersedePcrSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: z.string().min(1),
});

export async function pcrRoutes(app: FastifyInstance) {
  const db = getDb();

  app.get("/v1/ocs/pcrs", {
    preHandler: [rbac({ kind: "ocs" })],
    handler: async (request) => {
      const { project_id } = request.query as { project_id?: string };
      const where: any = { status: "active" };
      if (project_id) where.projectId = project_id;
      const pcrs = await db.pcr.findMany({ where, orderBy: { createdAt: "desc" } });
      return { data: pcrs };
    },
  });

  app.post("/v1/ocs/pcrs", {
    preHandler: [rbac({ kind: "ocs", roles: ["operations", "contributor"] })],
    handler: async (request) => {
      const parsed = createPcrSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError("Invalid PCR data", parsed.error.flatten());
      const pcr = await db.pcr.create({
        data: { ...parsed.data, createdBy: request.user.sub },
      });
      await db.auditLog.create({
        data: {
          actorUserId: request.user.sub,
          action: "pcr.create",
          entityType: "pcr",
          entityId: pcr.id,
          previousState: null,
          newState: pcr as any,
        },
      });
      return { data: pcr };
    },
  });

  app.post<{ Params: { id: string } }>("/v1/ocs/pcrs/:id/supersede", {
    preHandler: [rbac({ kind: "ocs", roles: ["operations", "project_director"] })],
    handler: async (request) => {
      const { id } = request.params;
      const parsed = supersedePcrSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError("Invalid supersede data", parsed.error.flatten());

      const existing = await db.pcr.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("PCR not found");
      if (existing.status === "superseded") throw new ValidationError("PCR already superseded");

      const [newPcr] = await db.$transaction([
        db.pcr.create({
          data: {
            projectId: existing.projectId,
            lat: parsed.data.lat,
            lng: parsed.data.lng,
            category: parsed.data.category,
            createdBy: request.user.sub,
          },
        }),
        db.pcr.update({
          where: { id },
          data: { status: "superseded", supersededBy: "" },
        }),
      ]);

      await db.$transaction([
        db.pcr.update({ where: { id }, data: { supersededBy: newPcr.id } }),
        db.auditLog.create({
          data: {
            actorUserId: request.user.sub,
            action: "pcr.supersede",
            entityType: "pcr",
            entityId: id,
            previousState: existing as any,
            newState: { supersededBy: newPcr.id, newPcrId: newPcr.id } as any,
          },
        }),
      ]);

      return { data: newPcr };
    },
  });

  app.get("/v1/ocs/pcrs/stale", {
    preHandler: [rbac({ kind: "ocs", roles: ["operations", "project_director"] })],
    handler: async () => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const stale = await db.pcr.findMany({
        where: { status: "active", createdAt: { lt: ninetyDaysAgo } },
        orderBy: { createdAt: "asc" },
      });
      return { data: stale };
    },
  });
}
```

- [ ] **Step 2: Register route in app.ts**

Add to `app.ts` after healthRoutes:
```typescript
import { pcrRoutes } from "./routes/ocs/pcrs.js";
// inside buildApp():
await app.register(pcrRoutes);
```

- [ ] **Step 3: Verify compilation**

```bash
cd packages/api && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/ocs/pcrs.ts packages/api/src/app.ts
git commit -m "feat(ocs): PCR CRUD + supersession with audit log"
```

---

## Task 7: OCS routes — First Aid + clinical release gate

**Files:**
- Create: `packages/api/src/routes/ocs/first-aid.ts`

- [ ] **Step 1: Create routes/ocs/first-aid.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb, ValidationError, NotFoundError, ForbiddenError } from "@trackaroo/shared";
import { rbac } from "../../middleware/rbac.js";
import multipart from "@fastify/multipart";

const createDraftSchema = z.object({
  slug: z.string().min(1).max(100),
  body: z.string().min(1),
});

export async function firstAidRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  const db = getDb();

  app.get("/v1/ocs/first-aid", {
    preHandler: [rbac({ kind: "ocs" })],
    handler: async () => {
      const content = await db.firstAidContent.findMany({ orderBy: { slug: "asc" } });
      return { data: content };
    },
  });

  app.post("/v1/ocs/first-aid", {
    preHandler: [rbac({ kind: "ocs", roles: ["contributor", "operations", "project_director"] })],
    handler: async (request) => {
      const parsed = createDraftSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError("Invalid first aid data", parsed.error.flatten());
      const content = await db.firstAidContent.create({ data: parsed.data });
      await db.auditLog.create({
        data: {
          actorUserId: request.user.sub,
          action: "first_aid.create_draft",
          entityType: "first_aid_content",
          entityId: content.id,
          previousState: null,
          newState: content as any,
        },
      });
      return { data: content };
    },
  });

  app.post<{ Params: { id: string } }>("/v1/ocs/first-aid/:id/release", {
    preHandler: [rbac({ kind: "ocs", roles: ["project_director"] })],
    handler: async (request) => {
      const { id } = request.params;
      const existing = await db.firstAidContent.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("First aid content not found");
      if (existing.status === "released") throw new ValidationError("Already released");

      const file = await request.file();
      if (!file || file.fieldname !== "attestation") {
        throw new ValidationError("Clinical attestation PDF required (field: attestation)");
      }

      const pdfUrl = `uploads/attestations/${id}-${Date.now()}.pdf`;
      // POC: just store the path reference, don't persist file to disk
      await file.toBuffer();

      const [updated] = await db.$transaction([
        db.firstAidContent.update({
          where: { id },
          data: {
            status: "released",
            clinicalAttestationPdfUrl: pdfUrl,
            releasedBy: request.user.sub,
            releasedAt: new Date(),
          },
        }),
        db.auditLog.create({
          data: {
            actorUserId: request.user.sub,
            action: "first_aid.release",
            entityType: "first_aid_content",
            entityId: id,
            previousState: existing as any,
            newState: { status: "released", clinicalAttestationPdfUrl: pdfUrl } as any,
          },
        }),
      ]);

      return { data: updated };
    },
  });
}
```

- [ ] **Step 2: Register in app.ts**

```typescript
import { firstAidRoutes } from "./routes/ocs/first-aid.js";
// inside buildApp():
await app.register(firstAidRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/ocs/first-aid.ts packages/api/src/app.ts
git commit -m "feat(ocs): first aid content CRUD + clinical release gate"
```

---

## Task 8: OCS routes — Audit log query

**Files:**
- Create: `packages/api/src/routes/ocs/audit-log.ts`

- [ ] **Step 1: Create routes/ocs/audit-log.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { getDb } from "@trackaroo/shared";
import { rbac } from "../../middleware/rbac.js";

export async function auditLogRoutes(app: FastifyInstance) {
  const db = getDb();

  app.get("/v1/ocs/audit-log", {
    preHandler: [rbac({ kind: "ocs", roles: ["project_director"] })],
    handler: async (request) => {
      const { entity_type, entity_id, actor_user_id, from, to } = request.query as Record<string, string | undefined>;
      const where: any = {};
      if (entity_type) where.entityType = entity_type;
      if (entity_id) where.entityId = entity_id;
      if (actor_user_id) where.actorUserId = actor_user_id;
      if (from || to) {
        where.at = {};
        if (from) where.at.gte = new Date(from);
        if (to) where.at.lte = new Date(to);
      }
      const logs = await db.auditLog.findMany({ where, orderBy: { at: "desc" }, take: 100 });
      return { data: logs, meta: { count: logs.length } };
    },
  });
}
```

- [ ] **Step 2: Register in app.ts**

```typescript
import { auditLogRoutes } from "./routes/ocs/audit-log.js";
await app.register(auditLogRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/ocs/audit-log.ts packages/api/src/app.ts
git commit -m "feat(ocs): audit log query endpoint (PD only)"
```

---

## Task 9: Sync routes — profile, groups, pcr-metadata

**Files:**
- Create: `packages/api/src/routes/sync/profile.ts`
- Create: `packages/api/src/routes/sync/groups.ts`
- Create: `packages/api/src/routes/sync/pcr-metadata.ts`

- [ ] **Step 1: Create routes/sync/profile.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb, ValidationError, NotFoundError } from "@trackaroo/shared";
import { rbac } from "../../middleware/rbac.js";
import { survivalDataGuard } from "../../middleware/survival-data-guard.js";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  archetype: z.string().optional(),
  preferences: z.record(z.unknown()).optional(),
});

export async function profileRoutes(app: FastifyInstance) {
  const db = getDb();

  app.get("/v1/sync/profile", {
    preHandler: [rbac({ kind: "mobile" })],
    handler: async (request) => {
      const user = await db.mobileUser.findUnique({ where: { firebaseUid: request.user.sub } });
      if (!user) throw new NotFoundError("Profile not found");
      return { data: user };
    },
  });

  app.put("/v1/sync/profile", {
    preHandler: [rbac({ kind: "mobile" }), survivalDataGuard],
    handler: async (request) => {
      const parsed = updateProfileSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError("Invalid profile data", parsed.error.flatten());
      const user = await db.mobileUser.upsert({
        where: { firebaseUid: request.user.sub },
        update: parsed.data,
        create: { firebaseUid: request.user.sub, displayName: parsed.data.displayName ?? "User", ...parsed.data },
      });
      return { data: user };
    },
  });
}
```

- [ ] **Step 2: Create routes/sync/groups.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb, ValidationError, NotFoundError } from "@trackaroo/shared";
import { rbac } from "../../middleware/rbac.js";

const createGroupSchema = z.object({ name: z.string().min(1).max(100) });
const addMemberSchema = z.object({ userUid: z.string().min(1) });

export async function groupRoutes(app: FastifyInstance) {
  const db = getDb();

  app.get("/v1/sync/groups", {
    preHandler: [rbac({ kind: "mobile" })],
    handler: async (request) => {
      const groups = await db.group.findMany({
        where: { OR: [{ ownerUid: request.user.sub }, { members: { some: { userUid: request.user.sub } } }] },
        include: { members: true },
      });
      return { data: groups };
    },
  });

  app.post("/v1/sync/groups", {
    preHandler: [rbac({ kind: "mobile" })],
    handler: async (request) => {
      const parsed = createGroupSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError("Invalid group data", parsed.error.flatten());
      const group = await db.group.create({ data: { name: parsed.data.name, ownerUid: request.user.sub } });
      return { data: group };
    },
  });

  app.post<{ Params: { id: string } }>("/v1/sync/groups/:id/members", {
    preHandler: [rbac({ kind: "mobile" })],
    handler: async (request) => {
      const { id } = request.params;
      const parsed = addMemberSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError("Invalid member data", parsed.error.flatten());
      const group = await db.group.findUnique({ where: { id } });
      if (!group) throw new NotFoundError("Group not found");
      const member = await db.groupMember.create({ data: { groupId: id, userUid: parsed.data.userUid } });
      return { data: member };
    },
  });
}
```

- [ ] **Step 3: Create routes/sync/pcr-metadata.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb, ValidationError } from "@trackaroo/shared";
import { rbac } from "../../middleware/rbac.js";
import { survivalDataGuard } from "../../middleware/survival-data-guard.js";

const createMetadataSchema = z.object({
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function pcrMetadataRoutes(app: FastifyInstance) {
  const db = getDb();

  app.get<{ Params: { pcrId: string } }>("/v1/sync/pcr-metadata/:pcrId", {
    preHandler: [rbac({ kind: "mobile" })],
    handler: async (request) => {
      const metadata = await db.pcrMetadata.findMany({
        where: { pcrId: request.params.pcrId, userUid: request.user.sub },
      });
      return { data: metadata };
    },
  });

  app.post<{ Params: { pcrId: string } }>("/v1/sync/pcr-metadata/:pcrId", {
    preHandler: [rbac({ kind: "mobile" }), survivalDataGuard],
    handler: async (request) => {
      const parsed = createMetadataSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError("Invalid metadata", parsed.error.flatten());
      const metadata = await db.pcrMetadata.create({
        data: { pcrId: request.params.pcrId, userUid: request.user.sub, ...parsed.data },
      });
      return { data: metadata };
    },
  });
}
```

- [ ] **Step 4: Register all sync routes in app.ts**

```typescript
import { profileRoutes } from "./routes/sync/profile.js";
import { groupRoutes } from "./routes/sync/groups.js";
import { pcrMetadataRoutes } from "./routes/sync/pcr-metadata.js";
// inside buildApp():
await app.register(profileRoutes);
await app.register(groupRoutes);
await app.register(pcrMetadataRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/sync/ packages/api/src/app.ts
git commit -m "feat(sync): profile, groups, pcr-metadata routes with survival-data guard"
```

---

## Task 10: HazTrack + TrackIQ routes

**Files:**
- Create: `packages/api/src/routes/haztrack/hazards.ts`
- Create: `packages/api/src/routes/trackiq/score.ts`

- [ ] **Step 1: Create routes/haztrack/hazards.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb, ValidationError } from "@trackaroo/shared";
import { rbac } from "../../middleware/rbac.js";

const bboxSchema = z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/);

function computeAgeBucket(fetchedAt: Date, ttlMinutes: number): "gold" | "grey" | "muted" {
  const ageMs = Date.now() - fetchedAt.getTime();
  const ttlMs = ttlMinutes * 60 * 1000;
  if (ageMs < ttlMs / 2) return "gold";
  if (ageMs < ttlMs) return "grey";
  return "muted";
}

export async function haztrackRoutes(app: FastifyInstance) {
  const db = getDb();

  app.get("/v1/haztrack/hazards", {
    preHandler: [rbac({ kind: "ocs" }), rbac({ kind: "mobile" })].slice(0, 0),
    handler: async (request) => {
      const { bbox } = request.query as { bbox?: string };
      const hazards = await db.hazardCache.findMany({ orderBy: { fetchedAt: "desc" }, take: 200 });
      const data = hazards.map((h) => ({
        id: h.id,
        source: h.source,
        geom: h.geom,
        payload: h.payload,
        ageBucket: computeAgeBucket(h.fetchedAt, h.ttlMinutes),
        fetchedAt: h.fetchedAt,
      }));
      return { data };
    },
  });

  app.get("/v1/haztrack/sources/status", {
    handler: async () => {
      const runs = await db.ingestRun.findMany({
        orderBy: { startedAt: "desc" },
        distinct: ["source"],
        take: 3,
      });
      const status = Object.fromEntries(runs.map((r) => [r.source, { status: r.status, startedAt: r.startedAt, itemsFetched: r.itemsFetched }]));
      return { data: status };
    },
  });
}
```

- [ ] **Step 2: Create routes/trackiq/score.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ValidationError } from "@trackaroo/shared";

const scoreSchema = z.object({
  mode: z.enum(["vehicle", "trail", "foot"]),
  gradientPercent: z.number().optional(),
  awtgsGrade: z.number().min(1).max(5).optional(),
});

type Band = "easy" | "moderate" | "difficult" | "extreme";

function scoreVehicle(gradient: number): Band {
  if (gradient <= 10) return "easy";
  if (gradient <= 20) return "moderate";
  if (gradient <= 30) return "difficult";
  return "extreme";
}

function scoreTrail(gradient: number): Band {
  if (gradient <= 5) return "easy";
  if (gradient <= 15) return "moderate";
  if (gradient <= 25) return "difficult";
  return "extreme";
}

export async function trackiqRoutes(app: FastifyInstance) {
  app.post("/v1/trackiq/score", {
    handler: async (request) => {
      const parsed = scoreSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError("Invalid score input", parsed.error.flatten());
      const { mode, gradientPercent, awtgsGrade } = parsed.data;

      if (mode === "foot") {
        if (awtgsGrade == null) throw new ValidationError("awtgsGrade required for foot mode");
        return { data: { mode, grade: awtgsGrade, band: `grade_${awtgsGrade}` } };
      }

      if (gradientPercent == null) throw new ValidationError("gradientPercent required for vehicle/trail mode");
      const band = mode === "vehicle" ? scoreVehicle(gradientPercent) : scoreTrail(gradientPercent);
      return { data: { mode, gradientPercent, band } };
    },
  });
}
```

- [ ] **Step 3: Register in app.ts**

```typescript
import { haztrackRoutes } from "./routes/haztrack/hazards.js";
import { trackiqRoutes } from "./routes/trackiq/score.js";
await app.register(haztrackRoutes);
await app.register(trackiqRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/haztrack/ packages/api/src/routes/trackiq/ packages/api/src/app.ts
git commit -m "feat: haztrack hazards endpoint + trackiq deterministic scoring"
```

---

## Task 11: Worker — ingestion service + fixture adapter

**Files:**
- Create: `packages/worker/src/adapters/types.ts`
- Create: `packages/worker/src/adapters/fixture-adapter.ts`
- Create: `packages/worker/src/ingest-service.ts`
- Create: `packages/worker/src/scheduler.ts`
- Create: `packages/worker/src/health.ts`
- Create: `packages/worker/src/index.ts`
- Create: `fixtures/bom.json`, `fixtures/afac.json`, `fixtures/ses.json`

- [ ] **Step 1: Create adapters/types.ts**

```typescript
export interface RawHazard {
  externalId: string;
  geom: { type: string; coordinates: number[] };
  payload: Record<string, unknown>;
}

export interface IHazardFeedAdapter {
  source: "bom" | "afac" | "ses";
  fetch(): Promise<RawHazard[]>;
}
```

- [ ] **Step 2: Create fixture files**

`fixtures/bom.json`:
```json
[
  { "externalId": "bom-fire-001", "geom": { "type": "Point", "coordinates": [151.2, -33.8] }, "payload": { "type": "bushfire", "severity": "high", "title": "Blue Mountains Fire" } },
  { "externalId": "bom-flood-001", "geom": { "type": "Point", "coordinates": [153.0, -27.4] }, "payload": { "type": "flood", "severity": "moderate", "title": "Brisbane River Flood Warning" } },
  { "externalId": "bom-storm-001", "geom": { "type": "Point", "coordinates": [144.9, -37.8] }, "payload": { "type": "storm", "severity": "low", "title": "Melbourne Storm Cell" } }
]
```

`fixtures/afac.json`:
```json
[
  { "externalId": "afac-fire-001", "geom": { "type": "Point", "coordinates": [149.1, -35.3] }, "payload": { "type": "bushfire", "severity": "extreme", "title": "ACT Bushfire Emergency" } },
  { "externalId": "afac-fire-002", "geom": { "type": "Point", "coordinates": [138.6, -34.9] }, "payload": { "type": "bushfire", "severity": "high", "title": "Adelaide Hills Fire" } }
]
```

`fixtures/ses.json`:
```json
[
  { "externalId": "ses-flood-001", "geom": { "type": "Point", "coordinates": [151.7, -32.9] }, "payload": { "type": "flood", "severity": "high", "title": "Hunter Valley Flood" } },
  { "externalId": "ses-rescue-001", "geom": { "type": "Point", "coordinates": [150.5, -33.7] }, "payload": { "type": "rescue", "severity": "moderate", "title": "Blue Mountains Rescue Op" } }
]
```

- [ ] **Step 3: Create adapters/fixture-adapter.ts**

```typescript
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { IHazardFeedAdapter, RawHazard } from "./types.js";

export class FixtureFeedAdapter implements IHazardFeedAdapter {
  constructor(public readonly source: "bom" | "afac" | "ses") {}

  async fetch(): Promise<RawHazard[]> {
    const filePath = resolve(process.cwd(), `fixtures/${this.source}.json`);
    const raw = await readFile(filePath, "utf-8");
    const all: RawHazard[] = JSON.parse(raw);
    const count = Math.max(1, Math.floor(Math.random() * all.length) + 1);
    return all.slice(0, count);
  }
}
```

- [ ] **Step 4: Create ingest-service.ts**

```typescript
import pRetry from "p-retry";
import { getDb, createLogger } from "@trackaroo/shared";
import type { IHazardFeedAdapter } from "./adapters/types.js";

const logger = createLogger("ingest-service");

const TTL_MAP = { bom: 15, afac: 30, ses: 60 } as const;

export async function runIngest(adapter: IHazardFeedAdapter): Promise<void> {
  const db = getDb();
  const source = adapter.source;
  const ttlMinutes = TTL_MAP[source];

  const run = await db.ingestRun.create({ data: { source } });

  try {
    const hazards = await pRetry(() => adapter.fetch(), { retries: 3 });

    for (const h of hazards) {
      await db.hazardCache.upsert({
        where: { source_externalId: { source, externalId: h.externalId } },
        update: { geom: h.geom as any, payload: h.payload as any, fetchedAt: new Date(), ttlMinutes },
        create: { source, externalId: h.externalId, geom: h.geom as any, payload: h.payload as any, fetchedAt: new Date(), ttlMinutes },
      });
    }

    await db.ingestRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), status: "ok", itemsFetched: hazards.length } });
    logger.info({ source, items: hazards.length }, "Ingest complete");
  } catch (err: any) {
    await db.ingestRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), status: "failed", error: err.message } });
    logger.error({ source, error: err.message }, "Ingest failed");
  }
}
```

- [ ] **Step 5: Create scheduler.ts**

```typescript
import cron from "node-cron";
import { runIngest } from "./ingest-service.js";
import { FixtureFeedAdapter } from "./adapters/fixture-adapter.js";
import { createLogger } from "@trackaroo/shared";

const logger = createLogger("scheduler");

const jobs: cron.ScheduledTask[] = [];

export function startScheduler() {
  const bomAdapter = new FixtureFeedAdapter("bom");
  const afacAdapter = new FixtureFeedAdapter("afac");
  const sesAdapter = new FixtureFeedAdapter("ses");

  jobs.push(cron.schedule("*/15 * * * *", () => runIngest(bomAdapter)));
  jobs.push(cron.schedule("*/30 * * * *", () => runIngest(afacAdapter)));
  jobs.push(cron.schedule("0 * * * *", () => runIngest(sesAdapter)));

  logger.info("Scheduler started: BOM/15m, AFAC/30m, SES/60m");

  // Run once immediately on startup
  void runIngest(bomAdapter);
  void runIngest(afacAdapter);
  void runIngest(sesAdapter);
}

export function stopScheduler() {
  for (const job of jobs) job.stop();
  jobs.length = 0;
}
```

- [ ] **Step 6: Create health.ts**

```typescript
import Fastify from "fastify";
import { getDb, loadConfig } from "@trackaroo/shared";

export async function startHealthServer() {
  const config = loadConfig();
  const app = Fastify();
  const db = getDb();

  app.get("/health", async () => {
    const runs = await db.ingestRun.findMany({ orderBy: { startedAt: "desc" }, distinct: ["source"], take: 3 });
    const lastRuns = Object.fromEntries(runs.map((r) => [r.source, { status: r.status, at: r.startedAt }]));
    return { ok: true, lastRuns };
  });

  await app.listen({ port: config.WORKER_HEALTH_PORT, host: "0.0.0.0" });
}
```

- [ ] **Step 7: Create worker index.ts**

```typescript
import { disconnectDb, createLogger } from "@trackaroo/shared";
import { startScheduler, stopScheduler } from "./scheduler.js";
import { startHealthServer } from "./health.js";

const logger = createLogger("worker");

async function main() {
  await startHealthServer();
  startScheduler();
  logger.info("Worker running");

  const shutdown = async () => {
    logger.info("Shutting down...");
    stopScheduler();
    await new Promise((r) => setTimeout(r, 2000));
    await disconnectDb();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 8: Commit**

```bash
git add packages/worker/src/ fixtures/
git commit -m "feat(worker): haztrack ingestion scheduler with fixture adapters"
```

---

## Task 12: Tests + CI gate script

**Files:**
- Create: `tests/vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/helpers.ts`
- Create: `tests/integration/audit-log.test.ts`
- Create: `tests/integration/trackiq-scoring.test.ts`
- Create: `tests/integration/survival-data-guard.test.ts`
- Create: `tests/integration/zero-firestore.test.ts`
- Create: `scripts/check-prohibited.ts`

- [ ] **Step 1: Create tests/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
  },
});
```

- [ ] **Step 2: Create tests/setup.ts**

```typescript
import { beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://trackaroo:trackaroo@localhost:5432/trackaroo_test";
  process.env.AUTH_PROVIDER = "mock";
  process.env.AUTH_JWT_SECRET = "test-secret";
  execSync("npx prisma migrate deploy", { stdio: "pipe" });
});
```

- [ ] **Step 3: Create tests/helpers.ts**

```typescript
import jwt from "jsonwebtoken";
import { buildApp } from "../packages/api/src/app.js";

export function makeToken(payload: { sub: string; role: string | null; kind: string }) {
  return jwt.sign(payload, "test-secret", { expiresIn: "1h" });
}

export async function createTestApp() {
  return buildApp();
}
```

- [ ] **Step 4: Create tests/integration/audit-log.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { getDb } from "@trackaroo/shared";

describe("Audit log immutability", () => {
  it("allows INSERT", async () => {
    const db = getDb();
    const log = await db.auditLog.create({
      data: { actorUserId: "pd-001", action: "test.insert", entityType: "test", entityId: "t-1", previousState: null, newState: { test: true } },
    });
    expect(log.id).toBeDefined();
  });

  it("rejects UPDATE via raw SQL", async () => {
    const db = getDb();
    await expect(
      db.$executeRawUnsafe(`UPDATE ocs.audit_log SET action = 'hacked' WHERE entity_id = 't-1'`)
    ).rejects.toThrow(/append-only/);
  });

  it("rejects DELETE via raw SQL", async () => {
    const db = getDb();
    await expect(
      db.$executeRawUnsafe(`DELETE FROM ocs.audit_log WHERE entity_id = 't-1'`)
    ).rejects.toThrow(/append-only/);
  });
});
```

- [ ] **Step 5: Create tests/integration/trackiq-scoring.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { createTestApp, makeToken } from "../helpers.js";

describe("TrackIQ deterministic scoring", () => {
  const token = makeToken({ sub: "mobile-001", role: null, kind: "mobile" });

  it.each([
    { mode: "vehicle", gradientPercent: 5, expected: "easy" },
    { mode: "vehicle", gradientPercent: 10, expected: "easy" },
    { mode: "vehicle", gradientPercent: 15, expected: "moderate" },
    { mode: "vehicle", gradientPercent: 20, expected: "moderate" },
    { mode: "vehicle", gradientPercent: 25, expected: "difficult" },
    { mode: "vehicle", gradientPercent: 30, expected: "difficult" },
    { mode: "vehicle", gradientPercent: 35, expected: "extreme" },
    { mode: "trail", gradientPercent: 3, expected: "easy" },
    { mode: "trail", gradientPercent: 5, expected: "easy" },
    { mode: "trail", gradientPercent: 10, expected: "moderate" },
    { mode: "trail", gradientPercent: 15, expected: "moderate" },
    { mode: "trail", gradientPercent: 20, expected: "difficult" },
    { mode: "trail", gradientPercent: 25, expected: "difficult" },
    { mode: "trail", gradientPercent: 30, expected: "extreme" },
  ])("$mode at $gradientPercent% → $expected", async ({ mode, gradientPercent, expected }) => {
    const app = await createTestApp();
    const res = await app.inject({ method: "POST", url: "/v1/trackiq/score", headers: { authorization: `Bearer ${token}` }, payload: { mode, gradientPercent } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.band).toBe(expected);
  });

  it("foot mode returns awtgs grade", async () => {
    const app = await createTestApp();
    const res = await app.inject({ method: "POST", url: "/v1/trackiq/score", headers: { authorization: `Bearer ${token}` }, payload: { mode: "foot", awtgsGrade: 3 } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.grade).toBe(3);
  });
});
```

- [ ] **Step 6: Create tests/integration/survival-data-guard.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { createTestApp, makeToken } from "../helpers.js";

describe("Survival data guard (RT-05)", () => {
  const token = makeToken({ sub: "mobile-001", role: null, kind: "mobile" });

  it.each(["breadcrumbs", "breadcrumb", "sos", "gps_fix", "location_history"])(
    "rejects body with key '%s'",
    async (key) => {
      const app = await createTestApp();
      const res = await app.inject({ method: "PUT", url: "/v1/sync/profile", headers: { authorization: `Bearer ${token}` }, payload: { [key]: [1, 2, 3] } });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("RT05_SURVIVAL_DATA_REJECTED");
    }
  );
});
```

- [ ] **Step 7: Create tests/integration/zero-firestore.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { getDb } from "@trackaroo/shared";

describe("Zero-Firestore DB assertion", () => {
  it("no table name matches safety data patterns", async () => {
    const db = getDb();
    const tables: { table_name: string }[] = await db.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema IN ('ocs', 'sync', 'haztrack')
    `;
    const forbidden = /breadcrumb|sos|gps_fix|location_history/i;
    for (const t of tables) {
      expect(t.table_name).not.toMatch(forbidden);
    }
  });
});
```

- [ ] **Step 8: Create scripts/check-prohibited.ts**

```typescript
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const PROHIBITED = [
  "dispatch_emergency", "auto_dispatch", "automated_distress",
  "predict_safe", "safe_area_inference",
  "smooth_breadcrumb", "modify_breadcrumb", "delete_breadcrumb",
  "cloud_nav", "cloud_navigation", "online_navigation",
  "consolidate_hazard", "merge_hazard",
];

const SCAN_EXTENSIONS = [".ts", ".js", ".tsx", ".jsx"];
const IGNORE_DIRS = ["node_modules", "dist", ".git", "docs"];

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (SCAN_EXTENSIONS.includes(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

let violations = 0;
for (const file of walk(process.cwd())) {
  const content = readFileSync(file, "utf-8");
  for (const term of PROHIBITED) {
    if (content.includes(term)) {
      console.error(`PROHIBITED [${term}] found in ${file}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} prohibited trigger(s) found. Build rejected.`);
  process.exit(1);
} else {
  console.log("No prohibited triggers found. OK.");
}
```

- [ ] **Step 9: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 10: Run prohibited check**

```bash
npx tsx scripts/check-prohibited.ts
```

Expected: "No prohibited triggers found. OK."

- [ ] **Step 11: Commit**

```bash
git add tests/ scripts/
git commit -m "test: integration tests (audit, trackiq, survival guard, zero-firestore) + CI gate"
```

---

## Task 13: Dockerfile + final docker-compose verification

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create multi-stage Dockerfile**

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/worker/package.json packages/worker/
RUN pnpm install --frozen-lockfile

COPY . .
RUN npx prisma generate

FROM base AS api
CMD ["pnpm", "run", "dev:api"]

FROM base AS worker
CMD ["pnpm", "run", "dev:worker"]
```

- [ ] **Step 2: Full docker compose up test**

```bash
docker compose up --build -d
sleep 10
curl http://localhost:3000/health
curl http://localhost:3001/health
docker compose down
```

Expected: both health endpoints return `{"status":"ok"}` / `{"ok":true,...}`.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "chore: Dockerfile multi-stage + docker-compose verified"
```
