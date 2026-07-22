# Repository runtime

- For hosted or CobaltCode previews, run `npm run preview` with `cobaltcode-service`; do not run `npm run dev` behind the preview proxy.
- `npm run preview` builds the application and serves it in production mode on `0.0.0.0:3000`, avoiding Next.js development-origin blocking.
- PostgreSQL must be running with the connection configured by `DATABASE_URL` before starting the application.
