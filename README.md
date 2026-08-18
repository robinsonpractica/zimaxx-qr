# Zimaxx QR

Zimaxx QR is Zimmax's focused owner workspace for dynamic QR codes. A printed short
URL stays permanent while its destination, colors, logo, and active state can
change. The app records privacy-minimal daily scan counts and exports branded
PNG or SVG artwork suitable for production printing.

## Architecture

- Astro 5 server rendering on Cloudflare Workers
- HTMX for status mutations and Alpine.js for local form/search interactions
- Cloudflare D1 for owners, sessions, codes, redirect history, scans, and audit
- Cloudflare R2 for uploaded PNG logos
- PBKDF2 password hashes, opaque hashed sessions, CSRF tokens, owner-scoped SQL
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

Open `http://localhost:8787/login` and use either seeded owner:

- `demo@zimmax.test` / `demo1234`
- `qa@zimmax.test` / `demo1234`

The second owner exists specifically to verify tenant isolation. Replace or
remove these demo accounts before any public production launch.

## Configuration

Copy `.env.example` to `.dev.vars` for local overrides. In production, set
`PUBLIC_APP_ORIGIN` to the canonical HTTPS origin before printing any code.
The `DB` D1 and `LOGOS` R2 bindings are declared in `wrangler.jsonc`; replace
the placeholder resource IDs with real Cloudflare resources for direct
Wrangler deployments.

## Database lifecycle

Forward migrations live in `db/migrations` and are append-only. Apply them with
`wrangler d1 migrations apply zimaxx-qr --remote` after taking a backup.
The matching emergency rollback reference is in `db/rollback`; it is destructive
and should only be used against a confirmed target after exporting D1 and R2.

Operational cleanup is in `db/maintenance/retention.sql`. Schedule it daily or
run it manually to remove expired/revoked sessions and scan events older than
the stated 13-month retention window. Redirect history and audit records are
kept because they explain what a permanent printed code did over time.

Before a release:

```bash
wrangler d1 export zimaxx-qr --remote --output backup.sql
```

Back up the `zimaxx-qr-logos` bucket with an R2-compatible tool. Restore D1 to
a fresh database with `wrangler d1 execute <database> --remote --file backup.sql`,
verify `/health`, then switch the binding. Restore R2 objects using the same
keys stored in `codes.logo_key`.

## Validation

```bash
pnpm run test:unit
pnpm run test:e2e
pnpm run build
```

The tests cover URL/slug/contrast policy, password verification, migration
integrity, real QR decoding, owner creation/edit/export/scan/disable, analytics,
and responsive desktop/mobile journeys.

## Security and privacy decisions

- Only `http` and `https` destinations are accepted; same-origin redirect loops
  are rejected.
- Logo uploads are PNG-only, validated by decoding, capped at 1 MB and 2048 px.
- All mutations require an authenticated owner, same-origin request, CSRF token,
  and idempotency key; edits also use optimistic version checks.
- Session cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS.
- Scan events store time, code, calendar date, and coarse device category only.
  IP addresses, exact location, cookies, fingerprinting, and user agents are not
  persisted.
- Keep the demo deployment private. For a public launch, provision real owners,
  remove seed credentials, add rate limiting at the edge, and complete a threat
  model and restore drill.

## Scope boundaries

The first release intentionally omits teams, billing, bulk import, custom
domains, scheduled destination changes, precise geolocation, webhooks, and
third-party analytics. SVG and PNG are supported; logo uploads are PNG in this
slice. These constraints keep the permanent-link workflow reliable and easy to
operate.
