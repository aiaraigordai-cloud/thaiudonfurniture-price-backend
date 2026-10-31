# Cloudflare Workers deployment status

This full-stack Next.js application needs Cloudflare Workers. Cloudflare's current guidance reserves Pages for static Next.js exports, while this application depends on server API routes.

## Runtime blocker

The application imports `node:sqlite` and stores its database in `data/catalog_a.sqlite`. Cloudflare Workers do not provide this local SQLite file as durable shared storage. A deploy could appear successful while requests fail at runtime or data disappears between instances.

The repository contains a PostgreSQL schema at `migrations/001_initial_schema.sql`, but the application database layer and API routes still use synchronous SQLite-specific statements and `node:sqlite`. Some routes depend on multi-statement transactions. Deploying the existing code requires converting those routes and their transaction behavior to a supported remote database such as Supabase PostgreSQL, then configuring the production secrets. The schema has been brought up to date with the fields currently used by the catalog routes.

## GitHub and Cloudflare setup after the runtime migration

1. Authenticate GitHub CLI with an account that can write to `aiaraigordai-cloud/thaiudonfurniture-price-backend`, then push the reviewed source.
2. Connect that GitHub repository to Cloudflare Workers Builds. Configure the build and deploy commands for the chosen Next.js adapter.
3. Add the database binding or URL and a unique `APP_SECRET` as production secrets in Cloudflare. Never commit these values.
4. Apply the PostgreSQL migration, migrate any local catalog data, and verify authentication and CRUD flows against the deployed database.

Do not use static export for this application: its admin pages depend on server API routes.

## Security prerequisites

The original public Git commit included a database file and a documented owner password. Removing these files from later commits does not erase Git history. Rotate the owner password, revoke any exposed GitHub token, and review the original database for sensitive records before making a production deployment.

## Local catalog data

Local database and JSON data files are excluded from future Git changes. They remain on the developer's machine and are not automatically uploaded to Cloudflare. Export and migrate any required records deliberately after the PostgreSQL data layer is implemented.
