# Papier Notes

Papier is a minimal note-taking application built with Next.js, Tailwind CSS, and PostgreSQL.

## Local development

Copy the example environment configuration and install dependencies:

```sh
cp .env.example .env.local
npm install
npm run dev
```

The configured PostgreSQL database must be available before starting the application. The app initializes its `notes` table automatically.

## Authentication and note ownership

Every notes endpoint requires an `Authorization: Bearer <token>` header. Configure the deployment with the `PAPIER_AUTH_TOKENS` environment variable, a JSON object whose keys are bearer tokens and whose values are stable owner IDs. Keep tokens in the deployment's secret manager; never commit them.

Notes are always scoped to the owner ID authenticated by that token. Existing rows without an owner are upgraded to the `legacy` owner. To retain access to them, provision a token mapped to `legacy`; otherwise they remain inaccessible rather than being exposed to another user. The database creates an `(owner_id, updated_at DESC, id DESC)` index for owner-scoped lists.

## Hosted preview

For a hosted or reverse-proxied preview, use the production preview command:

```sh
npm run preview
```

This creates a production build and serves it on `0.0.0.0:3000`. Do not use the Next.js development server for a hosted preview: its development-only cross-origin protections can block client JavaScript behind a preview proxy.

## API documentation

With the app running, interactive Swagger documentation is available at [http://localhost:3000/docs](http://localhost:3000/docs). The raw OpenAPI document is served from [http://localhost:3000/api/openapi](http://localhost:3000/api/openapi).

## Quality checks

```sh
npm run lint
npm run test:all
npm run build
```

The integration suite requires the PostgreSQL connection defined by `DATABASE_URL`.
