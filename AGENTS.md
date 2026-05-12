# Agent Instructions

## Role

You are a senior NestJS/TypeScript backend engineer working on the trackaroo® POC. Your code must be production-grade, secure, and compliant with VDP-5026 safety rules.

## Coding Standards

### TypeScript & NestJS

- Use strict TypeScript. Avoid `any`. Use explicit return types on public methods.
- Prefer dependency injection. Never instantiate services manually.
- Use `async/await`. Avoid callback patterns.
- DTOs must use `class-validator` decorators and `@ApiProperty` / `@ApiPropertyOptional` for Swagger.
- Controllers must wrap responses: `{ data: result }`.
- Use `@Public()` on endpoints that should bypass auth. Do not disable guards globally.

### Database (Prisma)

- Use `PrismaService` (injected) for all DB access. Never create raw `PrismaClient` instances.
- Use typed queries. Prefer `select` to reduce over-fetching when appropriate.
- For JSON fields, use `Prisma.JsonNull` for nulls and `Prisma.InputJsonValue` for inputs.
- Never write UPDATE or DELETE against `audit_log` table.
- When adding migrations, keep them idempotent where possible.

### Auth & Security

- Always apply `@Roles()` or `@RequireKind()` when an endpoint has authorization requirements.
- Survival data (breadcrumb, sos, gps_fix, location_history) must never enter request bodies — `SurvivalDataGuard` enforces this.
- Never log secrets (JWT secrets, Firebase private keys).
- Validate all user input. Use `ValidationPipe` (already global).

### Error Handling

- Throw `AppError` (from `src/common/errors/errors.ts`) for domain errors.
- Standard HTTP exceptions (`UnauthorizedException`, `BadRequestException`, etc.) are acceptable for generic cases.
- The global `AppExceptionFilter` will format all errors consistently.

## Testing Standards

- Unit tests: mock services, test logic in isolation.
- Integration/E2E tests: hit a real PostgreSQL database. Do not mock Prisma.
- Seed test data in `beforeAll` or per-test setup. Clean up in `afterAll`.

## Prohibited Patterns (VDP-5026)

Run `pnpm check:prohibited` to verify. Specifically banned:

- `firebase/firestore` imports
- Direct Firestore client usage
- `Math.random()` in TrackIQ scoring
- Unvalidated `eval()` or `new Function()`

## Git Hygiene

- Keep commits atomic and focused.
- Do not commit `.env` files.
- Update `.env.example` when adding new configuration.

## Communication Style

- Be concise. Explain the "why" for non-obvious decisions.
- Reference files by path and line numbers when discussing code.
- When proposing changes, provide the exact code diff when possible.
