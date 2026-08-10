# Papier Notes

Papier is a minimal note-taking application built with Next.js, Tailwind CSS, and PostgreSQL.

## Local development

Copy the example environment configuration, install dependencies, and start PostgreSQL:

```sh
cp .env.example .env.local
npm install
docker compose up -d postgres
npm run db:migrate
npm run dev
```

The configured PostgreSQL database must be available before starting the application. Schema changes are committed as ordered SQL files in `migrations/`; apply them explicitly with `npm run db:migrate`. The command records each applied migration in `schema_migrations`, so it is safe to run again. Application startup runs `npm run db:check` and exits with an actionable error if the required schema is unavailable.

The database data is stored in the `postgres-data` volume. To discard local data deliberately, stop the stack and remove that named volume; migrations do not include automatic rollback. Rollbacks should be handled with a new forward migration that restores the required schema or data.

## Authentication and note ownership

Every notes endpoint requires an `Authorization: Bearer <token>` header. Configure the deployment with the `PAPIER_AUTH_TOKENS` environment variable, a JSON object whose keys are bearer tokens and whose values are stable owner IDs. Keep tokens in the deployment's secret manager; never commit them.

The browser app asks for this token when authentication is required and stores it in that browser's local storage so subsequent API requests include the Bearer header. Use a separate revocable token per user or device.

Notes are always scoped to the owner ID authenticated by that token. Existing rows without an owner are upgraded to the `legacy` owner. To retain access to them, provision a token mapped to `legacy`; otherwise they remain inaccessible rather than being exposed to another user. The database creates an `(owner_id, updated_at DESC, id DESC)` index for owner-scoped lists.

## Hosted preview

For a hosted or reverse-proxied preview, use the production preview command:

```sh
npm run preview
```

This applies pending migrations, creates a production build, verifies the schema, and serves it on `0.0.0.0:3000`. In other hosted deployments, run `npm run db:migrate` as a deployment step before starting the application. Do not use the Next.js development server for a hosted preview: its development-only cross-origin protections can block client JavaScript behind a preview proxy.

## API documentation

With the app running, interactive Swagger documentation is available at [http://localhost:3000/docs](http://localhost:3000/docs). The raw OpenAPI document is served from [http://localhost:3000/api/openapi](http://localhost:3000/api/openapi).

## Quality checks

```sh
npm run lint
npm run test:all
npm run build
```

The integration suite requires the PostgreSQL connection defined by `DATABASE_URL`. It creates temporary schemas, validates idempotent migrations and repository behavior, and exercises the API through a real Next.js server before dropping the test schemas.
