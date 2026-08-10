# Repository runtime

- For hosted or CobaltCode previews, run `npm run preview` with `cobaltcode-service`; do not run `npm run dev` behind the preview proxy.
- `npm run preview` builds the application and serves it in production mode on `0.0.0.0:3000`, avoiding Next.js development-origin blocking.
- PostgreSQL must be running with the connection configured by `DATABASE_URL` before starting the application.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
