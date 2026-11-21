# How Canned Response Archive fits together

The app has three main parts: a React interface, an API that runs on Cloudflare Workers, and a Supabase PostgreSQL database. The browser does not connect directly to private database tables.

## A request's journey

1. **React** displays the library, draft editor, Settings, and account screens. Its data requests use same-origin `/api/*` endpoints.
2. **Cloudflare Worker** checks input, sessions, permissions, and rate limits. It performs the database operation and returns a limited response.
3. **Supabase PostgreSQL** stores accounts, sessions, shortcuts, saved replies, OTP challenges, and the public shared-response feed.
4. **Optional mail service** sends verification codes through a signed Google Apps Script request.

The Worker owns the Supabase secret key. It must never be compiled into the React application.

## Shared and private are different on purpose

A Shared response becomes part of `shared_response_feed`, which is designed for **anonymous reading**. The feed includes the shortcut, response body, and creator display name. This lets visitors find and copy public shared replies without creating an account.

Private responses remain in the canonical `canned_responses` table and are served through owner-filtered Worker queries. The administrator cannot use the API to read another user's private text. Database row-level security and grants prevent clients from querying protected tables with anonymous credentials.

Saved responses may share a shortcut. Editing a reply's shortcut or Shared/Private visibility reassigns only that reply, not the entire shortcut collection. The By me filter is assembled from the session-specific ownership flags, combining own Shared and Private records without requesting anybody else's private text.

## Accounts, recovery, and sessions

An agent name and four-digit PIN identify an account. PIN verifiers use a random salt and an HMAC keyed with a Worker-only `PIN_PEPPER`. The PIN's short length is still a real security limitation; rate limits are essential and high-value data is out of scope for this development deployment.

Session tokens are random and only their SHA-256 hashes are stored. HTTPS cookies are HttpOnly, Secure, SameSite=Strict, and host-only, with a seven-day expiry. State-changing API routes check the Origin header. Logout revokes the session; PIN recovery revokes existing sessions.

Adding a verified recovery email is optional. Signup, recovery, and email changes use six-digit, short-lived codes. The code digest and completion state are kept server-side, with transactional consumption through the database.

The first completed signup claims the sole administrator role. Be sure to register the intended administrator before exposing an empty installation.

## Editing visibility and deleting multiple replies

A PATCH to one response performs an atomic Postgres RPC: validate the request, lock the current canonical row, recheck the actor's role/ownership, find or create the target shortcut in the correct visibility scope, and update text/shortcut/visibility together. Existing database triggers maintain the public Shared feed. If an admin moves another agent's Shared reply to Private, the reply and its private shortcut retain the original creator's owner ID, preventing the administrator from gaining access to their private content.

Bulk delete accepts a bounded list of UUIDs. The Worker validates distinct IDs and a rate limit; a separate service-role-only, security-invoker Postgres RPC locks all selected response rows and verifies that every row is owned by the actor or is Shared and the actor is admin. It then deletes all rows in that batch in one transaction. A selection larger than 100 is split across transactions in the UI; a partial network failure requires reloading before choosing again. No anonymous database policy or client secret was added.

## Keeping the interface current

The client refreshes the response feed every five seconds while visible, and on returning focus. This is near-live polling, not a direct Supabase Realtime subscription. Silent refreshes skip while a previous request is still in flight, so slow networks do not produce overlapping, perpetually superseded polling requests. Response arrays are reused when their contents have not changed so polling doesn't force unnecessary UI work.

The compact composer groups replies by shortcut. The draft itself is held in React state and is not automatically uploaded as a saved response.

## Profile pictures

Default character icons are indexed in frontend source files. The Anime catalog contains the complete set of 470 images from a pinned revision of the Crunchyroll folder in `kalibrado/jf-avatars-images`, alongside the original Fusion icons; TV and Movies also include icons from a separate streaming-service index. Search filters by both franchise and character name. The picker paginates its larger gallery in 64-icon increments without querying the Worker for these static records.

Additional character artwork comes from external APIs. Images are subject to per-image quality checks and strict URL host/path restrictions. Static curated icon thumbnails prefer jsDelivr's CDN at exact pinned source revisions, with the original GitHub file as fallback; the selected avatar URL persisted to the database remains the original pinned GitHub URL. Other supported portraits may use a restricted Worker image route. The first eight gallery images receive higher loading priority, while lower rows remain lazy. Custom user uploads are cropped/compressed in the browser, sent to the authenticated Worker, and stored as public-read JPEG objects in Supabase Storage.

Third-party icons may be removed or changed by their owners. Their presence on a public CDN is not permission to redistribute them.

## Deployment boundaries

The repository currently has a live Cloudflare Worker deployment using development infrastructure. That isn't the same as production readiness. A separate production Supabase project, independently managed secrets, backups, abuse protection, and end-to-end permission testing are still needed.

The versioned SQL files under `supabase/migrations/` document the development schema. Applying a migration to a new environment should be a reviewed change. Rolling back a frontend commit does not reverse a database migration.

See [the API reference](backend-api.md), [setup instructions](setup.md), and [security notes](../SECURITY.md).
