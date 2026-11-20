# Architecture and boundaries

## Layers

1. React browser SPA. No database service credentials, email secrets, PIN hashes or privileged JWTs are embedded here.
2. Cloudflare Worker `/api/*` for validation, authentication, permission checks and write endpoints.
3. Supabase Postgres for users, sessions, shortcuts, and responses. Separate project for development.
4. Realtime read model for shared response changes only; private content is never published to a guest-readable channel.
5. Gmail/Google Apps Script as a potential OTP sender. Integration must be authenticated, rate-limited and tested.

## Proposed data model (for Phase 2 review; not deployed)

- `agents`: immutable UUID, unique normalized agent name, optional verified email, role, timestamps.
- `agent_credentials`: UUID to agent, cryptographically protected PIN verifier, lockout fields. No plaintext PIN.
- `agent_sessions`: opaque hashed session token, agent ID, expiry, revocation.
- `shortcuts`: UUID, normalized shortcut text, created_at. Needs careful definition for private shortcut collisions.
- `responses`: UUID, shortcut_id, body, visibility (`shared`/`private`), owner_id, timestamps.
- `otp_challenges`: purpose, salted code verifier, target email, expiry, attempts and send limit.
- `shared_response_feed` (possible): safely filtered shared data for anon read + realtime. Does not contain private rows or user email/PIN data.

## Authentication security

The design uses a custom agent-name + PIN experience because email is optional. Supabase's
out-of-the-box email auth should NOT be treated as implementing this custom flow automatically.
All agent-specific authorization must be enforced on the server and in database grants/RLS,
not by hiding navigation. Only server-side code may access privileged DB keys. No secrets in Git.

A four-digit PIN is a low-entropy secret. Before production, implement per-account and per-IP
rate limits, backoff/temporary lockouts, uniform error messages, secure PIN hashing with
an appropriate server-side secret, protected HttpOnly/Secure/SameSite sessions, CSRF defenses
on state-changing operations, expiry/revocation, and no enumeration of registered emails.
Hash OTPs, expire them quickly, set strict attempt counts, and verify emails before recovery.
Account creation/admin bootstrap must be atomic and idempotent.

## Realtime authorization

The simplest safe Phase 2 direction is a public shared-only read model + realtime feed,
with private records accessible solely through authenticated API requests. We must not simply
subscribe unauthenticated browsers to `responses` with access to all rows. Review Supabase RLS,
publication choices and trigger permissions before enabling any database change subscriptions.

## Development and production

Use two independent Supabase projects (dev/test and live). Treat Cloudflare preview URLs as
untrusted staging surfaces; never share production secrets with preview deployments. Keep schema
changes in migrations, validate on staging, export backups before production changes, and deploy
only after green checks. Code rollbacks do not automatically roll back database migrations.

## API (Phase 1)

- `GET /api/health` -> `{ status: "ok", service: ..., phase: "foundation" }`
- Other API routes -> HTTP 404. No accounts, writes or database connections exist yet.
