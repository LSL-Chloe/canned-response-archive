# Backend API — development-only

The backend implements secure agent-name/PIN signup and login and optional-email OTP.
The mailer cannot send real messages until the owner configures Google Apps Script and
Cloudflare Worker secrets. There is **no live deployment** yet.

## Authentication and profile API

| Method | Endpoint | Who | Function |
|---|---|---|---|
| POST | `/api/auth/signup` | Guest | Signup with agent name, 4-digit PIN, optional email. No email = immediate account; email = pending verification. |
| POST | `/api/otp/signup/verify` | Pending signup | `{challengeId,code}` completes signup, issues session. |
| POST | `/api/auth/login` | Guest | Agent name and PIN. |
| POST | `/api/auth/logout` | Signed in | Revoke session. |
| GET | `/api/auth/me` | Everyone | Current user or null. |
| PATCH | `/api/account/name` | Signed in | Rename own account. |
| POST | `/api/account/pin` | Signed in | Current PIN and new PIN. |
| GET | `/api/account/email` | Signed in | Own email and verification status. |
| POST | `/api/otp/email/start` | Signed in | `{email}` sends verification to new email; does not change existing email yet. |
| POST | `/api/otp/email/verify` | Signed in | `{challengeId,code}` atomically updates verified email. |
| POST | `/api/otp/recovery/start` | Guest | `{email}` requests OTP; always returns same generic message and a challengeId, even for unknown accounts. |
| POST | `/api/otp/recovery/verify` | Guest | `{challengeId,code,newPin}` resets PIN and revokes all sessions. |

Challenge responses return `{verificationRequired:true,challengeId,expiresInSeconds:600}`.
OTP codes are six digits, expire after ten minutes and allow five incorrect attempts.
Code hashes are HMAC-bound to challenge IDs and stored in Supabase without plaintext OTPs.
Signup with email creates an account **only** after verified email confirmation.
No-email signup still works but cannot self-recover a forgotten PIN.

The very first *completed* signup receives admin. Email verification for a pending
signup must be completed before it can claim admin.

All modifying API routes require a same-origin `Origin` header and JSON bodies.
Session cookies are HttpOnly, SameSite=Strict and Secure on HTTPS. The worker uses a
server-side Supabase secret key, never exposed in frontend code.

## Responses and admin API

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/responses?scope=shared` | Everyone |
| GET | `/api/responses?scope=private` | Signed-in owner |
| GET | `/api/responses?scope=all` | Signed-in: shared + own private |
| POST | `/api/responses` | Any agent, shared or private |
| PATCH | `/api/responses/:id` | Admin if shared, owner if private |
| DELETE | `/api/responses/:id` | Admin or creator if shared, owner if private |
| GET | `/api/responses/export?scope=shared` | Admin only |
| GET | `/api/responses/export?scope=private` | Owner only |
| POST | `/api/responses/import` | Admin for shared, owner for private |
| GET | `/api/admin/users` | Admin only; user counts but no private text |

The shared library shows `Created by` names; the central shortcut search UI should not.

## Setup and limitations

See [Gmail OTP setup](gmail-otp-setup.md). Do not put `OTP_MAILER_SECRET`,
`PIN_PEPPER`, or `SUPABASE_SECRET_KEY` in public GitHub files.

Schema migrations in `supabase/migrations` have already been applied to the development
database; they must not be rerun there. A production database has not been created.

Still outstanding: real Gmail authorization and send test, deployment and live Worker
integration tests, frontend/animations, robust backup and restore procedures, import
transactionality and more thorough security tests.
