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
