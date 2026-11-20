# Architecture and boundaries

## Layers

1. React browser SPA. No database service credentials, email secrets, PIN hashes or privileged JWTs are embedded here.
2. Cloudflare Worker `/api/*` for validation, authentication, permission checks and write endpoints.
3. Supabase Postgres for users, sessions, shortcuts, and responses. Separate project for development.
4. Realtime read model for shared response changes only; private content is never published to a guest-readable channel.
5. Gmail/Google Apps Script as a potential OTP sender. Integration must be authenticated, rate-limited and tested.

## Database model (deployed to development; not to production)

- `agents`: immutable UUID, unique normalized agent name, optional verified email, role, timestamps.
- `agent_credentials`: UUID to agent, cryptographically protected PIN verifier, lockout fields. No plaintext PIN.
- `agent_sessions`: opaque hashed session token, agent ID, expiry, revocation.
- `shortcuts`: UUID, normalized shortcut text, created_at. Needs careful definition for private shortcut collisions.
- `responses`: UUID, shortcut_id, body, visibility (`shared`/`private`), owner_id, timestamps.
- `otp_challenges`: purpose, salted code verifier, target email, expiry, attempts and send limit.
- `shared_response_feed`: safely filtered shared data plus creator display name for guest read/realtime. Does not contain private rows or email/PIN data.

## Authentication security

The design uses a custom agent-name + PIN experience because email is optional. Supabase's
out-of-the-box email auth should NOT be treated as implementing this custom flow automatically.
All agent-specific authorization must be enforced on the server and in database grants/RLS,
not by hiding navigation. Only server-side code may access privileged DB keys. No secrets in Git.

A four-digit PIN is a low-entropy secret. Before production, implement per-account and per-IP
rate limits, backoff/temporary lockouts, uniform error messages, secure PIN hashing with
an appropriate server-side secret, protected HttpOnly/Secure/SameSite sessions, CSRF defenses
on state-changing operations, expiry/revocation, and no enumeration of registered emails.
PIN verifiers use per-account 128-bit random salts and a Worker-secret-keyed HMAC-SHA256;
the four-digit PIN is intrinsically low entropy, so preserving PIN_PEPPER secrecy and
login throttling is critical. Workerd rejects PBKDF2 iterations above 100,000, and its
Free plan has limited CPU time; never silently use a high-iteration PBKDF2 in the Worker.
This scheme trades offline KDF work for dependence on an undisclosed high-entropy server
secret. If both database content and PIN_PEPPER are compromised, four-digit PINs are
brute-forceable; additional authentication controls are necessary before production.
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

## API (Phase 2 development)

Backend routes are implemented but are not deployed and have not been tested with server credentials.
See [backend API](backend-api.md) for the full route matrix, security assumptions and remaining work.
