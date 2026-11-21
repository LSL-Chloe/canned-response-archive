# API reference

The frontend communicates with the same-origin Cloudflare Worker under `/api`. Protected operations use the session cookie; the browser never sends a Supabase service key.

JSON API responses are marked `no-store`. Write requests require a same-origin `Origin` header and, when they contain a body, `application/json`. Invalid requests return a JSON error with an HTTP status.

## Accounts and recovery

| Method | Route | Access and behavior |
| --- | --- | --- |
| GET | `/api/health` | Public liveness check; does not reveal configured secrets |
| POST | `/api/auth/signup` | Guest signup with agent name, four-digit PIN, and optional email |
| POST | `/api/otp/signup/verify` | Completes a pending email-backed signup |
| POST | `/api/auth/login` | Verifies agent name and PIN, then sets a session cookie |
| GET | `/api/auth/me` | Current signed-in user, or `null` |
| POST | `/api/auth/logout` | Revokes the current session |
| PATCH | `/api/account/name` | Changes the signed-in user's display name |
| POST | `/api/account/pin` | Changes PIN after verifying the current PIN; revokes other sessions |
| GET | `/api/account/email` | Returns your account's recovery email and verification state |
| POST | `/api/otp/email/start` | Sends a code to a new email address |
| POST | `/api/otp/email/verify` | Confirms the code and updates the verified address |
| POST | `/api/otp/recovery/start` | Sends a recovery code if a verified account exists; response is deliberately generic |
| POST | `/api/otp/recovery/verify` | Validates the code, resets the PIN, and revokes existing sessions |

Email is optional for signup. Without a verified email, forgotten-PIN recovery is unavailable.

OTP codes are six digits, expire after ten minutes, and allow at most five wrong submissions per challenge. Sending is limited to three requests per target in 15 minutes, with a separate hourly IP limit. Sign-in and other sensitive operations have their own rate limits.

## Saved responses

| Method | Route | Access and behavior |
| --- | --- | --- |
| GET | `/api/responses?scope=shared` | **Public:** returns the shared reply library, including creator display names |
| GET | `/api/responses?scope=private` | Signed-in user, own private replies only |
| GET | `/api/responses?scope=all` | Signed-in user, shared replies plus own private replies |
| POST | `/api/responses` | Signed-in user creates a shared or private reply |
| PATCH | `/api/responses/:id` | Owner edits their reply; admin can also edit shared replies |
| DELETE | `/api/responses/:id` | Owner deletes their reply; admin can also delete shared replies |
| GET | `/api/responses/export?scope=private` | Download your own private replies |
| GET | `/api/responses/export?scope=shared` | Administrator only |
| POST | `/api/responses/import` | Signed-in user for private imports; administrator for shared imports |
| GET | `/api/admin/users` | Administrator-only account and response counts, without private text |

Replies live under `#shortcut` names, with original internal spaces and underscores preserved (1–64 characters, case-insensitive uniqueness). Several independent replies can share one shortcut. Creating another reply doesn't overwrite an existing one.

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
- Changing a reply's shortcut reassigns that one reply, leaving other replies under the original shortcut alone.
- Rate limits use server-side hashed keys; they do not remove the risks of a four-digit PIN.
- The service is under development. Before a public production rollout, review secrets, authentication strength, permissions, and external image usage.

See [architecture](architecture.md) and [security](../SECURITY.md) for more context.
