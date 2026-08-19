# Zimaxx QR

Zimaxx QR is Zimmax's shared team workspace for dynamic QR codes. A printed short
URL stays permanent while its destination, colors, and active state can
change. The app records privacy-minimal daily scan counts and exports branded
PNG or SVG artwork suitable for production printing.

## Architecture

- Astro 5 server rendering on Cloudflare Workers
- HTMX for status mutations and Alpine.js for local form/search interactions
- Cloudflare D1 for users, roles, sessions, codes, redirect history, scans, and audit
- Integrated Zimaxx logo artwork with no external object storage
- PBKDF2 password hashes, opaque hashed sessions, CSRF tokens, and server-side roles
- Structured request logs and `/health` database readiness checks

The public redirect hot path is `GET /r/:slug`. It reads the current redirect
rule, queues a minimal scan event, then returns a non-cacheable `302`. Disabled
codes return a helpful `410` page and never redirect.

## Local setup

Requirements: Node.js 22+, pnpm, and Wrangler.

```bash
pnpm install
pnpm run build
pnpm run db:migrate
pnpm run db:seed
pnpm run preview -- --port 8787
```

Open `http://localhost:8787/login` and use either seeded team account:

- `demo@zimmax.test` / `demo1234`
- `qa@zimmax.test` / `demo1234`

The first account is an administrator and the second is an editor. Both work
with the same Zimaxx QR workspace. Replace or remove these demo accounts before
any public production launch.

## Configuration

Copy `.env.example` to `.dev.vars` for local overrides. In production, set
`PUBLIC_APP_ORIGIN` to the canonical HTTPS origin before printing any code.
The `DB` D1 and `SESSION` KV bindings are declared in `wrangler.jsonc`. The
official Zimaxx symbol is generated directly into each SVG and PNG, so no R2
bucket or file upload is required. Before printing a final code, set
`PUBLIC_APP_ORIGIN` to the canonical HTTPS origin.

## Production provisioning

Do not run `db/seed.sql` against production. After creating the Cloudflare
resources, apply only the migrations and create real users through the private
terminal prompt:

```bash
pnpm exec wrangler d1 migrations apply zimaxx-qr --remote
pnpm owner:create -- --remote
pnpm user:create -- --remote --role editor --email editor@zimaxx.com --name "Editor name"
```

The user command requires a password of at least 12 characters, hashes it
locally with PBKDF2-SHA256 using Cloudflare's supported 100,000 iterations, and
sends only the resulting SQL values to D1. Running it again for the same email
updates that user's name, password, role, and active status without creating a duplicate. The
plain-text password is neither written to the repository nor displayed in the
terminal.

## Database lifecycle

Forward migrations live in `db/migrations` and are append-only. Apply them with
`wrangler d1 migrations apply zimaxx-qr --remote` after taking a backup.
The matching emergency rollback reference is in `db/rollback`; it is destructive
and should only be used against a confirmed target after exporting D1.

Operational cleanup is in `db/maintenance/retention.sql`. Schedule it daily or
run it manually to remove expired/revoked sessions and scan events older than
the stated 13-month retention window. Redirect history and audit records are
kept because they explain what a permanent printed code did over time.

Before a release:

```bash
wrangler d1 export zimaxx-qr --remote --output backup.sql
```

Restore D1 to a fresh database with
`wrangler d1 execute <database> --remote --file backup.sql`, verify `/health`,
then switch the binding. The integrated logo ships with the application and
requires no separate backup.

## Validation

```bash
pnpm run test:unit
pnpm run test:e2e
pnpm run build
```

The tests cover URL/slug/contrast policy, password verification, migration
integrity, real QR decoding, team roles, creation/edit/export/scan/disable, analytics,
and responsive desktop/mobile journeys.

## Security and privacy decisions

- Only `http` and `https` destinations are accepted; same-origin redirect loops
  are rejected.
- Logo uploads are PNG-only, validated by decoding, capped at 1 MB and 2048 px.
- All mutations require an authenticated team user, same-origin request, CSRF token,
  and idempotency key; edits also use optimistic version checks.
- Session cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS.
- Scan events store time, code, calendar date, and coarse device category only.
  IP addresses, exact location, cookies, fingerprinting, and user agents are not
  persisted.
- Keep the demo deployment private. For a public launch, provision real owners,
  remove seed credentials, add rate limiting at the edge, and complete a threat
  model and restore drill.

## Scope boundaries

The first release intentionally omits self-service user management, billing, bulk import, custom
domains, scheduled destination changes, precise geolocation, webhooks, and
third-party analytics or custom logo uploads. SVG and PNG exports always use
the integrated Zimaxx symbol. These constraints keep the permanent-link
workflow reliable and easy to operate.
