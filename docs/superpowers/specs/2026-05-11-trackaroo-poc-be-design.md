# trackaroo® POC — Backend Design

**Date:** 2026-05-11
**Scope:** Demo-walkthrough POC covering OCS, Experience Layer Sync, HazTrack ingestion, TrackIQ scoring.
**Non-goals:** Mobile app, Survival Core, BLE mesh, SOS, real satellite, production hardening.

## 1. Goals & constraints

- Show end-to-end shape of the Experience Layer and OCS backend described in VDP-5026.
- Enforce the spec's hard rules at the POC level so the design is promotable to Phase 1:
  - **Zero Firestore / Zero Survival-data** in cloud (RT-05): no breadcrumbs, SOS logs, or raw GPS in DB.
  - **Write-once audit log** for OCS governance actions (engine-level enforcement).
  - **HazTrack independence**: age badges (`gold/grey/muted`), never shield iconography.
  - **Clinical review gate** on First Aid release.
  - **PCR supersession model** (never delete, always supersede).
- Local demo via `docker compose up`. No cloud deploy in POC.

## 2. Architecture

Two Node.js processes, one Postgres, shared monorepo:

```
trackaroo-poc/
├── packages/
│   ├── api/           # Fastify HTTP server (port 3000)
│   ├── worker/        # node-cron ingestion + mini health HTTP (port 3001)
│   └── shared/        # prisma client, auth, logger, config, errors, types
├── prisma/            # schema.prisma + migrations (incl. raw-SQL trigger migration)
├── fixtures/          # bom.json, afac.json, ses.json
├── scripts/
│   └── check-prohibited.ts   # SCA grep for RT-01..RT-22 keywords
└── docker-compose.yml
```

- `api` is stateless; restartable at will.
- `worker` runs `node-cron` jobs per source and owns no HTTP routes beyond `/health`.
- Both processes share `shared` via workspace package (pnpm/npm workspaces).
- Postgres schemas: `ocs`, `sync`, `haztrack` — logical isolation matching module boundaries.
- Graceful shutdown (SIGTERM) on both: drain in-flight work, close Prisma pool, exit.

**Runtime stack**

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| HTTP | Fastify |
| ORM | Prisma (schema per module via `@@schema`) |
| DB | Postgres 16 |
| Scheduler | `node-cron` |
| Validation | `zod` |
| Logging | `pino` (JSON, redaction serializer) |
| Retry | `p-retry` |
| Tests | `vitest` + `supertest` + `testcontainers-node` |
| Auth | `IAuthProvider` — `MockAuthProvider` (default) or `FirebaseAuthProvider` |

## 3. Data model

### Schema `ocs`

- `users(id, email, display_name, role, created_at)`
  - `role IN ('project_director', 'operations', 'contributor')`
- `pcrs(id, project_id, lat, lng, category, status, superseded_by, created_by, created_at)`
  - `status IN ('active', 'superseded')`
  - `superseded_by` FK self; a "resolved" PCR = new row at same coordinates + old row's `status='superseded'` and `superseded_by` set, all in a single transaction.
  - Display layer reads `status='active'` only.
- `first_aid_content(id, slug, body, version, status, clinical_attestation_pdf_url, released_by, released_at)`
  - `status IN ('draft', 'released')`
  - Release requires non-null `clinical_attestation_pdf_url`.
- `audit_log(id, actor_user_id, action, entity_type, entity_id, previous_state jsonb, new_state jsonb, at)`
  - Append-only. Raw-SQL migration adds `BEFORE UPDATE OR DELETE` trigger that raises `SQLSTATE 2F003` with message "audit_log is append-only".
  - Every governance action writes a row in the same transaction as the action.

### Schema `sync`

- `mobile_users(firebase_uid PK, display_name, archetype, preferences jsonb, updated_at)`
- `groups(id, name, owner_uid, created_at)`
- `group_members(group_id, user_uid, joined_at)`
- `pcr_metadata(pcr_id FK ocs.pcrs, user_uid, notes, tags)` — non-safety only

No `breadcrumbs`, `sos_events`, `gps_fixes`, `location_history`. Enforced by test (see §7).

### Schema `haztrack`

- `hazard_cache(id, source, external_id, geom jsonb, payload jsonb, fetched_at, ttl_minutes)`
  - Unique `(source, external_id)` for idempotent upsert.
  - `age_bucket` computed on read: `gold` if age < TTL/2, `grey` if age < TTL, else `muted`.
- `ingest_runs(id, source, started_at, finished_at, status, items_fetched, error)`
  - `status IN ('ok', 'partial', 'failed')`

## 4. API surface (api process)

All routes under `/v1`. `Authorization: Bearer <token>` required except `/health`. Token kind (`ocs` vs `mobile`) gates route access.

### OCS (token kind = `ocs`)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/v1/ocs/pcrs` | all OCS | `?project_id=`; active only |
| POST | `/v1/ocs/pcrs` | ops, contributor | Create |
| POST | `/v1/ocs/pcrs/:id/supersede` | ops, PD | Body = new PCR; single transaction |
| GET | `/v1/ocs/pcrs/stale` | ops, PD | created_at older than 90 days |
| GET | `/v1/ocs/first-aid` | all OCS | List |
| POST | `/v1/ocs/first-aid` | contributor, ops, PD | Create draft |
| POST | `/v1/ocs/first-aid/:id/release` | PD only | Multipart: `attestation` PDF required |
| GET | `/v1/ocs/audit-log` | PD only | Filters: `entity_type`, `entity_id`, `actor_user_id`, `from`, `to` |

### Sync (token kind = `mobile`)

| Method | Path | Notes |
|---|---|---|
| GET / PUT | `/v1/sync/profile` | profile + preferences |
| GET / POST | `/v1/sync/groups` | list / create |
| POST | `/v1/sync/groups/:id/members` | add member |
| GET / POST | `/v1/sync/pcr-metadata/:pcrId` | non-safety notes/tags |

Global guard middleware: any request body JSON containing keys matching `/^(breadcrumbs?|sos|gps_fix|location_history)$/i` is rejected with `400` + code `RT05_SURVIVAL_DATA_REJECTED`.

### HazTrack (any authed)

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/haztrack/hazards` | `?bbox=minLng,minLat,maxLng,maxLat`; returns hazards + `age_bucket` |
| GET | `/v1/haztrack/sources/status` | last run per source |

Response convention: never include `shield_*` / `verified_*` flags in payload. Field set is limited to `{ id, source, geom, payload, age_bucket, fetched_at }`.

### TrackIQ (any authed)

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/trackiq/score` | Body `{ mode, gradient_percent?, awtgs_grade? }`; deterministic band |

Bands (from spec §7):
- `vehicle`: easy ≤10, moderate 10–20, difficult 20–30, extreme >30
- `trail`: easy ≤5, moderate 5–15, difficult 15–25, extreme >25
- `foot`: pass-through AWTGS grade 1–5

### Common

- Response: `{ data, meta? }` for success; `{ error: { code, message, details? } }` for failure.
- Standard HTTP statuses.

## 5. Worker process & ingestion

- `node-cron` registers three jobs at module load:
  - BOM: every 15 min
  - AFAC: every 30 min
  - SES: every 60 min
- Each tick: `HazardIngestService.run(source)`
  1. Open `ingest_runs` row (status=`ok` tentatively).
  2. `IHazardFeedAdapter.fetch()` wrapped in `p-retry` (3 attempts, exp backoff).
  3. `normalize()` to `Hazard[]`.
  4. Upsert by `(source, external_id)`.
  5. Close `ingest_runs` row with `status`, `items_fetched`, optional `error`.
- Hazards not returned in a given fetch are **not deleted** — they age out via TTL and show as `muted`. Prevents flicker.
- Default adapter: `FixtureFeedAdapter` reads `fixtures/<source>.json`, stamps `fetched_at=now()`, randomly selects a subset each tick to simulate churn.
- Swapping to a real adapter later is a one-file change; interface stable.
- Worker health: `GET /health` on port 3001 returns `{ ok, last_runs: { bom, afac, ses } }`. Used by docker-compose healthcheck.
- Graceful shutdown: stop cron, await in-flight with 10s timeout, close pool, exit.

## 6. Auth

- `IAuthProvider`:
  - `verify(token): Promise<{ sub, role, kind }>`
  - `MockAuthProvider`: JWT signed with `AUTH_JWT_SECRET`. `dev/seed-tokens.ts` emits tokens for each role for demo convenience.
  - `FirebaseAuthProvider`: uses `firebase-admin.auth().verifyIdToken`, reads `role` custom claim for OCS users; mobile users have `kind='mobile'` implicit.
- Selected by env `AUTH_PROVIDER=mock|firebase`. Default `mock`.
- Fastify plugin `authenticate` reads `Authorization` header, calls provider, decorates `request.user`.
- RBAC: per-route `allowedRoles` config; middleware enforces `kind` + `role`.

## 7. Error handling, logging, testing

### Errors

- `shared/errors.ts`: `AppError` base with `code`, `status`, `message`. Specializations: `ValidationError` (400), `AuthError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `SurvivalDataRejectedError` (400, `RT05_SURVIVAL_DATA_REJECTED`).
- Fastify `setErrorHandler` maps `AppError` → response. Unknown error → 500, logged with stack, response has `code='INTERNAL_ERROR'` only.
- Zod validation in `preHandler` hook per route.

### Logging

- `pino` JSON, `request_id` (ULID) via `@fastify/request-context`.
- Serializer redacts fields matching `/lat|lng|location|coordinates|breadcrumb|sos/i` across all log records. Guard against accidental location leakage.

### Tests (vitest)

Mandatory for POC:

1. **Audit log immutability** — INSERT allowed; UPDATE/DELETE raise SQLSTATE 2F003.
2. **PCR supersession atomicity** — new row + old `superseded_by` set in one transaction; induced failure rolls back both.
3. **First Aid release gate** — release w/o PDF → 400; with PDF → `released` + audit row in same tx.
4. **RBAC matrix** — parameterized across every route × every role.
5. **Survival-data rejection** — sync endpoints with `{breadcrumbs:[...]}` → 400 `RT05_SURVIVAL_DATA_REJECTED`.
6. **Zero-Firestore DB assertion** — query `information_schema.tables`, assert no table name matches `/breadcrumb|sos|gps_fix|location_history/i`.
7. **Ingest idempotency** — running fixture ingest twice → row count unchanged, `fetched_at` advanced.
8. **TrackIQ determinism + boundaries** — golden tests across mode × gradient including 10/20/30 and 5/15/25 edges.

### CI gate

- `scripts/check-prohibited.ts` greps code & comments for triggers tied to RT-01..RT-22 (examples: `dispatch_emergency`, `predict_safe`, `smooth_breadcrumb`, `cloud_nav`). Exits non-zero on match. Keeps the codebase free of prohibited capability surfaces.

## 8. Deployment

- `docker-compose.yml` services: `postgres`, `api`, `worker`.
- Healthchecks: api `GET /health`, worker `GET :3001/health`, postgres `pg_isready`.
- Seed step runs migrations + seed OCS users + loads fixture hazards.
- Single command: `docker compose up --build`.

## 9. Out of scope (explicit)

- Any ingestion or storage of survival-core data (breadcrumbs, SOS logs, raw GPS).
- Real Firebase project setup (supported via adapter; not required to run demo).
- Real BOM/AFAC/SES HTTP calls (fixtures only; adapter interface ready).
- Subscription/IAP validation, billing.
- Satellite (`satReady=false` scaffold — not in POC scope).
- LoRa bridges, BLE mesh, WiFi Direct.
- Phase 2 escrow path logic.

## 10. Traceability to VDP-5026

| Spec section | Design section |
|---|---|
| §2 Zero Firestore, RT-05 | §3 (no safety tables), §4 (survival-data guard), §7 (tests 5, 6) |
| §4 WAL / Write-once | §3 `audit_log` trigger, §7 test 1 |
| §7 HazTrack independence & TTLs | §3 `hazard_cache`, §4 HazTrack endpoints, §5 ingestion |
| §7 TrackIQ deterministic scoring | §4 TrackIQ endpoint, §7 test 8 |
| §8 RBAC, PCR supersession, clinical gate, audit log | §3, §4 OCS routes, §7 tests 2, 3, 4 |
| §9 Prohibited triggers RT-01..RT-22 | §7 CI gate |
