# Phase 2 development backend (not deployed)

These endpoints are implemented in `worker/` and need a configured Cloudflare Worker to operate.
They are **not** a finished production login system until OTP recovery, end-to-end integration
with Supabase and a live Worker deployment have been verified.

## Current endpoints

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/api/health` | Everyone | Health/configured status; no secrets |
| POST | `/api/auth/signup` | Guest | Register agent name + 4-digit PIN **without email**; first registered account is admin |
| POST | `/api/auth/login` | Guest | Login with agent name + 4-digit PIN |
| POST | `/api/auth/logout` | Signed in | Revoke current session, clear cookie |
| GET | `/api/auth/me` | Everyone | Current user or null |
| PATCH | `/api/account/name` | Signed in | Rename own account (unique) |
| POST | `/api/account/pin` | Signed in | Current PIN + new PIN; revokes other sessions |
| GET | `/api/responses?scope=shared` | Everyone | Shared-only list and library creator labels |
| GET | `/api/responses?scope=private` | Signed in | Own private response list |
| GET | `/api/responses?scope=all` | Signed in | Shared + own private list |
| POST | `/api/responses` | Signed in | Create shared or private response |
| PATCH | `/api/responses/:id` | Admin for shared; owner for private | Edit body, never owner/visibility |
| DELETE | `/api/responses/:id` | Admin/creator for shared; owner for private | Delete response |
| GET | `/api/responses/export?scope=private` | Signed in | Export own private responses (JSON v1) |
| GET | `/api/responses/export?scope=shared` | Admin | Export shared library (JSON v1) |
| POST | `/api/responses/import` | Admin for shared; signed-in user for private | Import JSON, max 50 entries/request |
| GET | `/api/admin/users` | Admin | Name, role, join date, shared/private counts; no private text |

All write requests require `Content-Type: application/json` and a same-origin `Origin` header.
Sessions are opaque, random, hashed server-side and sent using HttpOnly SameSite=Strict cookies.
HTTPS gets a Secure `__Host-` cookie. The Worker enforces authorization independently of the UI.

### Example payloads

```json
{"agentName":"Agent Alice","pin":"1234"}
```

For `POST /api/responses`:

```json
{"shortcut":"#followup","body":"We will follow up shortly.","visibility":"shared"}
```

For `POST /api/responses/import`:

```json
{"visibility":"private","responses":[{"shortcut":"followup","body":"Thanks!"}]}
```

**Important:** Imported rows are added one at a time. This first version does not roll back an
already-added item if a later item fails; the import UI must show a preview and explain this.
JSON exports do not include private response content belonging to other users. The shared
export writes `shortcut` and `body`; imported shared responses are attributed to the importing admin.

## Requirements not yet implemented

- Signup with an optional email is deliberately rejected with HTTP 501 until the email OTP
  flow is complete. **Do not direct real team members to sign up until this is finished.**
- Email verification, add/change email, forgotten-PIN recovery via email.
- Automatic PIN-guessing/abuse monitoring beyond initial server-side limits and audit logging.
- Frontend pages, realtime browser subscription, full browser end-to-end tests.
- Backup/restore drill, deployment, and final production security review.
- Import transactionality, archive pagination, and CSV import/export (JSON v1 only).

## Development setup

1. Populate a **local-only** `.dev.vars` from `.dev.vars.example` with your DEV project URL,
   DEV server-only Supabase secret API key, and 32+-character `PIN_PEPPER` (never Git-commit secrets).
2. Run `npm install`, `npm run check`, then `npm run dev`.
3. Test locally first. The Worker uses the **dev** project only; no production configuration exists.
4. For the deployed dev Worker, set the same values using Cloudflare encrypted Worker secrets.
5. Login and database integration are not verified remotely until you configure these secrets.

The first signup becomes admin. In a public site, anyone who reaches signup first could claim
this role. The owner has chosen open signup; enable signup only when ready for real deployment.
No credentials or sensitive user data should ever be committed to the public GitHub repository.
