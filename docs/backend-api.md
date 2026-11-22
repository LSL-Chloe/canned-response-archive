# API reference

The frontend communicates with the same-origin Cloudflare Worker under `/api`. Protected operations use the session cookie; the browser never sends a Supabase service key.

JSON API responses are marked `no-store`. Write requests require a same-origin `Origin` header and, when they contain a body, `application/json`. Invalid requests return a JSON error with an HTTP status.

## Accounts and recovery

| Method | Route | Access and behavior |
| --- | --- | --- |
| GET | `/api/health` | Public liveness check; does not reveal configured secrets |
| POST | `/api/auth/signup` | Guest signup with agent name, four-digit PIN, and optional email |
| POST | `/api/otp/signup/verify` | Completes a pending email-backed signup |
| POST | `/api/auth/login` | Accepts `{"identifier":"name-or-verified-email","pin":"0042"}` and sets a session cookie. Legacy `agentName` is still supported for backward compatibility. |
| GET | `/api/auth/me` | Current signed-in user, or `null` |
| POST | `/api/auth/logout` | Revokes the current session |
| PATCH | `/api/account/name` | Changes the signed-in user's display name |
| POST | `/api/account/pin` | Changes PIN after verifying the current PIN; revokes other sessions |
| GET | `/api/account/email` | Returns your account's recovery email and verification state |
| POST | `/api/otp/email/start` | Sends a code to a new email address |
| POST | `/api/otp/email/verify` | Confirms the code and updates the verified address |
| POST | `/api/otp/recovery/start` | Sends a recovery code if a verified account exists; response is deliberately generic |
| POST | `/api/otp/recovery/verify` | Validates the code, resets the PIN, and revokes existing sessions |

Email is optional for signup. Without a verified email, forgotten-PIN recovery and email-based sign-in are unavailable; the agent name still works. For email sign-in, the Worker requires `email_verified_at` on the matching account, normalizes email case, verifies the same PIN, and returns the same generic invalid-credentials error for missing/unverified accounts or wrong PIN. The shared per-account rate limit is keyed to the immutable agent ID, preventing bypass by switching from name to email.

OTP codes are six digits, expire after ten minutes, and allow at most five wrong submissions per challenge. The lock-on progress/check animation reflects digit entry and a confirmed server response; it does not verify codes locally. Sending is limited to three requests per target in 15 minutes, with a separate hourly IP limit. Sign-in and other sensitive operations have their own rate limits.

## Saved responses

| Method | Route | Access and behavior |
| --- | --- | --- |
| GET | `/api/responses?scope=shared` | **Public:** returns the shared reply library, including creator display names |
| GET | `/api/responses?scope=private` | Signed-in user, own private replies only |
| GET | `/api/responses?scope=all` | Signed-in user, shared replies plus own private replies |
| POST | `/api/responses` | Signed-in user creates a shared or private reply |
| PATCH | `/api/responses/:id` | Owner edits text, shortcut and Shared/Private visibility; admin can also edit shared replies. A scope change is atomic. |
| DELETE | `/api/responses/:id` | Owner deletes their reply; admin can also delete shared replies |
| POST | `/api/responses/bulk-delete` | Requires sign-in; body `{"ids":["uuid", ...]}` containing 1–100 distinct IDs. Atomically deletes the entire authorized batch or none. Admin may delete others' Shared, never others' Private. |
| GET | `/api/responses/export?scope=private` | Download your own private replies |
| GET | `/api/responses/export?scope=shared` | Administrator only |
| POST | `/api/responses/import` | Signed-in user for private imports; administrator for shared imports |
| GET | `/api/admin/users` | Administrator-only registered-agent list (name, role, join date, shared/private counts), without private text or email addresses |
| DELETE | `/api/admin/users/:id` | Administrator only. Send JSON `{"confirmName":"Exact agent name"}`. Permanently removes the targeted non-admin account, its sessions, and all its replies in a single database transaction; keeps shared shortcuts used by others. Self-deletion and deleting an administrator are forbidden. |

Replies live under `#shortcut` names, with original internal spaces and underscores preserved (1–64 characters, case-insensitive uniqueness). Several independent replies can share one shortcut. Creating another reply doesn't overwrite an existing one.

PATCH accepts `{"body":"...","shortcut":"follow up","visibility":"private"}`; for compatibility, the visibility field may be omitted to keep the current scope. Each change happens in one locked database transaction. When an administrator moves someone else's Shared reply to Private, the original owner does not change: the administrator immediately loses access to that private reply. The database trigger removes it from the anonymous Shared feed. Moving it back to Shared publishes it again.

The library's **By me** filter uses the per-viewer `owned_by_viewer` flag returned by the existing feeds, derived from immutable owner IDs. It does not trust user display names. When using bulk delete, the client groups larger selections into batches of at most 100 and confirms every returned count. Failures can leave earlier confirmed batches deleted; a request whose response was lost might also have committed. Reload before retrying.

Exports use:

```json
{
  "version": 1,
  "visibility": "private",
  "responses": [
    { "shortcut": "follow_up", "body": "Just following up on our conversation." }
  ]
}
```

An import accepts 1–50 rows per request. Each batch is **transactional** and skips exact shortcut/text pairs already present in the selected scope, so it can be safely retried after a connection failure. Different replies under the same shortcut remain separate. Larger JSON archives are previewed and submitted in bounded batches; an interruption between batches may leave confirmed batches saved, but reuploading the original file does not duplicate those rows.

## Profile pictures

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/account/avatar` | Signed-in user's selected image URL |
| PATCH | `/api/account/avatar` | Signed-in user chooses or clears an allowed avatar URL |
| POST | `/api/account/avatar/upload` | Signed-in user uploads a small JPEG prepared in the browser |
| GET | `/api/avatars/search` | Signed-in, character and title search by source |
| GET | `/api/avatars/characters` | Signed-in, characters associated with a title |
| GET | `/api/avatars/popular` | Signed-in, optional popular-character suggestions |
| GET | `/api/avatars/variations` | Signed-in, additional fan-wiki or anime artwork |
| GET | `/api/avatars/booru-looks` | Signed-in, filtered general-rated artwork for one character |
| GET | `/api/avatars/image` | Signed-in, allowlisted public image proxy for hosts that block direct loading |

Most featured icons come from a bundled manifest and don't require a catalog request. External image providers are optional and can fail without preventing use of the rest of the archive.

Uploaded pictures are publicly readable in the designated Supabase Storage bucket. The selected URL is stored on the account, not the image bytes.

## Security notes for API consumers

- Role checks happen in the Worker, not only in the UI.
- Public shared responses must not contain confidential information.
- Changing a reply's shortcut or visibility reassigns only that reply, leaving the other replies under its shortcut intact.
- The `update_archive_response`, `delete_archive_responses_batch`, and `admin_delete_agent` RPCs are server-only (service role). The Worker checks the user session and Postgres checks current permissions again under row locks; the browser cannot invoke them using an anonymous key.
- Bulk deletion and administrator account deletion are intentionally destructive and cannot be undone; verify the targets and confirmation first. Account deletion removes replies even from the Shared feed and revokes sessions, without giving the admin access to the user's Private reply text.
- Rate limits use server-side hashed keys; they do not remove the risks of a four-digit PIN.
- The service is under development. Before a public production rollout, review secrets, authentication strength, permissions, and external image usage.

See [architecture](architecture.md) and [security](../SECURITY.md) for more context.
