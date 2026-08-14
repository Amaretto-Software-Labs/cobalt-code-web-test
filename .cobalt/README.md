# Cobalt infrastructure setup

This guide describes the repeatable CobaltCode setup for Papier Notes. Keep real credentials out of this repository; the token shown below is only a local development credential.

## Clean-checkout fast path

From `/workspace/repository`, perform these steps in order on every fresh Cobalt computer:

1. Read this file, the root `AGENTS.md`, and `README.md` before running or changing the repository.
2. Install the locked Node dependencies:

   ```sh
   npm ci
   ```

3. Create the ignored `.env.local` file with the standard Cobalt configuration:

   ```dotenv
   DATABASE_URL=postgresql://papier:papier_local_dev@127.0.0.1:5432/papier
   NEXT_PUBLIC_PAPIER_LOCAL_TOKEN=local-token
   PAPIER_AUTH_TOKENS={"local-token":"local"}
   ```

   Always use exactly `local-token` in an isolated Cobalt environment. Never commit `.env.local`.

4. Start PostgreSQL. Try the repository definition first:

   ```sh
   docker compose up -d postgres
   ```

   If the nested Docker daemon reports a layer registration, ownership, or `lchown` error, stop retrying different images and use the [host PostgreSQL fallback](#host-postgresql-fallback).

5. Wait for PostgreSQL, then apply and verify the schema:

   ```sh
   pg_isready -h 127.0.0.1 -p 5432 -d papier
   npm run db:migrate
   npm run db:check
   ```

6. Run the complete quality gate before publishing the preview:

   ```sh
   npm run lint
   npm run test:all
   npm run build
   ```

7. Start the persistent production preview:

   ```sh
   cobaltcode-service start application 3000 -- npm run preview
   cobaltcode-service status application
   cobaltcode-service logs application
   ```

   If an `application` service already exists, stop it first with `cobaltcode-service stop application`. The installed service wrapper may not support a `restart` subcommand.

8. Verify the local service before registration:

   ```sh
   curl --fail http://127.0.0.1:3000/
   curl --fail http://127.0.0.1:3000/docs
   curl --fail \
     -H 'Authorization: Bearer local-token' \
     http://127.0.0.1:3000/api/notes
   ```

9. Register port 3000 as the primary **Papier Notes** preview with the CobaltCode `register_preview` control-plane tool. After a rebuild or service restart, call `refresh_preview` and force the agent browser to load the registered preview again so it does not retain an older client bundle.

10. Validate in the agent browser: load the notes page, create and edit a temporary note, reload to confirm persistence, delete only that temporary note, open `/docs`, and follow the raw OpenAPI JSON link. Browser note requests must stay under the registered preview's `/content/api/notes` path and should return 200/201/204 responses.

Do not report the preview ready until the service is running, local HTTP checks pass, the preview is registered, and the browser CRUD check succeeds.

## Repository structure

- `src/` contains the Next.js application, API routes, and PostgreSQL repository code.
- `migrations/` contains ordered, forward-only SQL migrations.
- `scripts/` contains the idempotent migration and schema-check commands.
- `tests/` contains unit and PostgreSQL-backed integration tests.
- `docker-compose.yml` defines the standard local PostgreSQL service.
- `.env.example` documents supported environment variables without secrets.

## Prerequisites

- Node.js and npm versions compatible with `package-lock.json` (the Cobalt image provides them).
- PostgreSQL reachable on `127.0.0.1:5432`.
- `cobaltcode-service` for the persistent application process.
- CobaltCode preview registration for browser access.

Docker Compose is the normal database path. Some nested Cobalt Docker daemons cannot unpack PostgreSQL image layers; use the host PostgreSQL fallback below when that happens.

## Repeatable bootstrap

Install exact dependencies and create an ignored local environment file:

```sh
npm ci
cp .env.example .env.local
```

Set these local-only values in `.env.local`:

```dotenv
DATABASE_URL=postgresql://papier:papier_local_dev@127.0.0.1:5432/papier
NEXT_PUBLIC_PAPIER_LOCAL_TOKEN=local-token
PAPIER_AUTH_TOKENS={"local-token":"local"}
```

## Cobalt token setup

Always use `local-token` as the Papier authentication token in Cobalt environments. This is the shared Cobalt development convention for this repository; do not generate a different token for each Cobalt task or restored computer.

Configure both token variables in the ignored `.env.local` file:

```dotenv
NEXT_PUBLIC_PAPIER_LOCAL_TOKEN=local-token
PAPIER_AUTH_TOKENS={"local-token":"local"}
```

The variables serve different purposes:

- `NEXT_PUBLIC_PAPIER_LOCAL_TOKEN` supplies `local-token` to the browser unlock flow. Because it is public and embedded at build time, it must never contain a production credential.
- `PAPIER_AUTH_TOKENS` authorizes `local-token` on the server and maps its notes to the stable owner ID `local`.

Use the same token for direct API requests:

```sh
curl --fail \
  -H 'Authorization: Bearer local-token' \
  http://127.0.0.1:3000/api/notes
```

After adding or changing either variable, rebuild and restart `npm run preview`, then refresh the registered Cobalt preview. Verify that an authenticated request returns HTTP 200 and a request without a token returns HTTP 401.

This fixed token is only for isolated Cobalt development environments. Never use `local-token` in production, staging, shared external deployments, or as a substitute for a deployment-managed secret.

Start the standard database and apply migrations:

```sh
docker compose up -d postgres
npm run db:migrate
npm run db:check
```

Migrations are idempotent and record applied files in `schema_migrations`, so rerunning them after recovery is safe.

### Host PostgreSQL fallback

If nested Docker fails while unpacking the PostgreSQL image, install and start the host package. The role and database checks below are safe to rerun:

```sh
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql
pg_cluster_version="$(pg_lsclusters --no-header | awk 'NR == 1 { print $1 }')"
pg_ctlcluster "$pg_cluster_version" main start
runuser -u postgres -- psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'papier') THEN
    CREATE ROLE papier LOGIN PASSWORD 'papier_local_dev';
  END IF;
END
$$;
SQL
runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'papier'" | grep -q 1 \
  || runuser -u postgres -- createdb -O papier papier
pg_isready -h 127.0.0.1 -p 5432 -d papier
npm run db:migrate
npm run db:check
```

On later starts, detect the installed cluster version again, start it with `pg_ctlcluster`, and rerun the idempotent migration and schema-check commands. Host package data lives outside `/workspace` and may survive repository cleanup, but process state must always be re-checked after recovery.

## Run commands and ports

For a Cobalt preview, use the repository's production preview command on port 3000:

```sh
cobaltcode-service start application 3000 -- npm run preview
cobaltcode-service status application
cobaltcode-service logs application
```

`npm run preview` applies migrations, builds the app, checks the schema, and serves on `0.0.0.0:3000`. Register port 3000 as the primary **Papier Notes** Cobalt preview. Do not use `npm run dev` behind the Cobalt preview proxy.

Papier's browser API URLs are deliberately relative (`api/notes`, without a leading slash) so requests remain inside Cobalt's preview base path. Do not change them back to root-relative `/api/notes` URLs; those bypass the preview route and return 404 from the gateway.

Local routes:

- Application: `http://127.0.0.1:3000/`
- API documentation: `http://127.0.0.1:3000/docs`
- OpenAPI JSON: `http://127.0.0.1:3000/api/openapi`

## Verification

Run the complete quality gate with PostgreSQL available:

```sh
npm run lint
npm run test:all
npm run build
curl --fail http://127.0.0.1:3000/
curl --fail http://127.0.0.1:3000/docs
```

The integration suite creates and removes temporary PostgreSQL schemas. Confirm the persistent service with `cobaltcode-service status application` before reporting the preview ready.

## Environment variables

- `DATABASE_URL` — PostgreSQL connection string; required.
- `PAPIER_AUTH_TOKENS` — JSON object mapping bearer tokens to stable owner IDs; required for authenticated use.
- `NEXT_PUBLIC_PAPIER_LOCAL_TOKEN` — optional local-only token hint for the browser unlock screen; it is embedded in the client build.

Never commit `.env.local`, deployment credentials, preview tickets, or injected Cobalt/Git credentials.

## Persistent state and recovery

The Compose setup stores PostgreSQL data in the `postgres-data` named volume. The host fallback stores it in the PostgreSQL cluster data directory managed by the system package. Do not bind runtime database data into `/workspace`.

After a snapshot restore or computer replacement:

1. Re-check `.cobalt/README.md`, `AGENTS.md`, and `README.md`.
2. Reinstall dependencies with `npm ci` if needed.
3. Start PostgreSQL and verify it with `pg_isready`.
4. Confirm `.env.local` configures `local-token` in both Papier token variables as documented above.
5. Run `npm run db:migrate` and `npm run db:check`.
6. Start or restart the `application` service and refresh the registered preview.
7. Reload the Enclave/agent browser explicitly and repeat the browser CRUD and API-docs checks from the fast path.

## Troubleshooting

- **Database connection refused:** start Compose PostgreSQL or the host cluster, then run `pg_isready -h 127.0.0.1 -p 5432 -d papier`.
- **Schema unavailable:** run `npm run db:migrate`, followed by `npm run db:check`.
- **Docker layer registration errors:** use the host PostgreSQL fallback; changing image families may not fix a nested-daemon storage failure.
- **Token rejected:** confirm the same token exists as a key in `PAPIER_AUTH_TOKENS` and restart the application after environment changes.
- **Notes request returns a gateway 404:** inspect the browser network URL. It must contain the registered preview `/content/api/notes` prefix; a request to the gateway-root `/api/notes` indicates a stale bundle or a root-relative client URL.
- **Browser still shows old configuration:** `NEXT_PUBLIC_` values are build-time values; restart `npm run preview`, then refresh the Cobalt preview.
- **Agent browser shows old behavior after refresh:** navigate it to the registered preview again; a control-plane refresh alone may leave an already-open Enclave page on the previous bundle.
- **Preview unavailable:** inspect `cobaltcode-service status application` and `cobaltcode-service logs application`, confirm port 3000 responds locally, then re-register or refresh the preview.
