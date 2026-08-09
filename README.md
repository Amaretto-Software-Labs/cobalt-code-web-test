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

The integration suite requires the PostgreSQL connection defined by `DATABASE_URL`; it creates an isolated temporary schema and validates that the committed migrations initialize and upgrade it safely.
