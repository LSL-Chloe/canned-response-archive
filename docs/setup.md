# Local development and environment setup

## Requirements

- Node.js 22+ and npm
- GitHub repository: [LSL-Chloe/canned-response-archive](https://github.com/LSL-Chloe/canned-response-archive)
- Supabase dev project: `bjcfoitzfiunikkemdry` (already provisioned and migrated)
- Cloudflare account (deployment is NOT configured)

## Running the local scaffold

```bash
npm install
npm run check
npm run dev
```

Open the URL printed by Vite. `GET /api/health` reports whether environment secrets
are present. The page is deliberately a placeholder awaiting approved design references.

## Connecting the development Worker

The backend source implements agent-name/PIN login, response operations, and optional-email OTP flows. It has **not**
yet been tested end to end against the live development database because no credentials
have been supplied to the Worker.

1. Copy `.dev.vars.example` to `.dev.vars` locally.
2. Set `SUPABASE_URL` to the development project's Supabase URL, not a production URL.
3. Set `SUPABASE_SECRET_KEY` to a **server-only** dev project secret API key (`sb_secret_…`).
4. Generate a 32+-character random `PIN_PEPPER` (e.g. `openssl rand -hex 32`).
5. Run locally; never commit `.dev.vars` or expose these values in client-side code.

For an eventual development deployment, use **Cloudflare Worker Secrets**. Do not paste
real keys into GitHub or ChatGPT messages. The published Worker is not yet configured.

**Email-backed signup uses the optional Gmail OTP relay only once it is configured.**
Read [Gmail OTP setup](gmail-otp-setup.md), authorize the Gmail Apps Script,
and set \`OTP_MAILER_URL\` and \`OTP_MAILER_SECRET\` in local/dev Worker secrets.
Do not launch signup to teammates before a real delivery/recovery test passes.

## GitHub workflow

The repository is public, so review every commit carefully for secrets. Use feature
branches and pull requests for subsequent work. Avoid initializing Git
a second time inside an existing checkout. To clone the existing repository:

```bash
git clone https://github.com/LSL-Chloe/canned-response-archive.git
cd canned-response-archive
```

Keep `main` for reviewed work. The GitHub connection now has `LSL-Chloe` write access.
The Phase 2 backend source is development-only; avoid deploying production until security
and end-to-end verification are complete.

## Production planning

The development migrations have been applied in Supabase and mirrored as versioned SQL
files in `supabase/migrations`. **Do not rerun them on development.** Create a second
Supabase project for production only after the whole stack passes an end-to-end security
and functionality review. Stage and test every future migration first.

## Profile pictures

Profile pictures require the avatar migration in `supabase/migrations/20261120225401_account_avatars.sql`.
It adds an avatar URL field and creates the `archive-avatars` public-read storage bucket.
Uploads go through the authenticated Worker, which resizes them to square JPEGs in the browser
(256×256, under 150 KB) and writes to a per-account object. Never expose the Supabase secret key
to the client. Public-read avatar URLs can be viewed by anyone who has the URL; do not upload
sensitive images. The first gallery tile is always a custom-upload circle with a plus.

Anime and TV search use AniList and TVmaze. To enable movie and actor portraits, create a TMDB
API Read Access Token and add `TMDB_READ_ACCESS_TOKEN` as a Cloudflare Worker secret.
Do not commit the token. The movie tab displays a configuration message until it is set.
Catalog images belong to their respective providers and may be subject to attribution or reuse terms.

## Character avatar discovery

The avatar picker loads fifteen featured or popularity-ranked character portraits on each tab.
Search results show character portraits directly, without requiring a movie/series click.
Anime searches are enriched with matching series characters via Kitsu; anime featured
characters prefer AniList favourites, then Jikan top characters, then Kitsu popular anime.
TV searches use TVmaze's actual character photos plus selected fan-wiki character portraits,
never actor headshots. Movie searches use the TMDB movie/cast names to find in-character
photos on mapped franchise fan wikis, never actor headshots or posters.
Character coverage depends on the underlying public catalog; titles without character
artwork are not backfilled with actor publicity images. Fan-wiki profile pages are cached
by the browser's HTTP cache, and more looks are fetched only when requested.
The third-party sites own their images, and contributors' credits/rights should be
respected if the project becomes public or commercial.

## Instant, fixed two-row avatar shelves (2026-11-21)

The PFP picker now uses `src/features/archive/curatedAvatarCatalog.ts` for its
featured 15 icons in each tab. The first gallery tile is always **Custom PFP +**.
These default choices are built into the frontend; opening Settings **does not**
call the `/api/avatars/popular` endpoint or wait for AniList/Jikan/Fandom to respond.
The selected icons are prewarmed in the browser after sign-in, except when the
browser advertises data-saving mode. A first visit still requires fetching the image
bytes; subsequent visits generally use the browser/CDN cache.

The curated index merges named character packs from
`eueueue292/Fusion-Profile-Avatars` and lightweight icons from
`kalibrado/jf-avatars-images`, pinned at known GitHub commits. It does not
embed third-party copyrighted images into our repository. Searching instantly
filters by character **and** franchise, with live anime/TV/movie character API
results loaded afterward as an optional supplement. Curated results take priority
over plain-background database portraits. If enough curated results match, the
user can choose to reveal additional database portraits instead.
Characters with multiple curated artworks offer **More looks**.

These repositories do not explicitly license all the underlying artwork. Their
availability online is not a transfer of redistribution rights. This is for a
personal prototype; obtain permissions and consider licensed alternatives
before offering a public avatar library. If maintaining a reliable long-term
catalog, use a rights-cleared, optimized asset store, for example Cloudflare R2.
