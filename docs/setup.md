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

## Anime character-artwork supplement (SFW)

The two default avatar rows and our curated square icons are unchanged. Anime searches now
optionally supplement Kitsu/AniList with `safebooru.donmai.us` character-tagged artwork.
Queries use only a verified character tag + `solo`, respecting the public API's two-tag
limit. Every post is checked locally for **general rating**, exactly one matching
character, still-image media, a useful minimum size, non-sketch/non-white backgrounds,
and a square-gallery-compatible aspect ratio. Small 360px still-image thumbnails are
preferred to downloading original, potentially huge files. Source thumbnails still
pass the browser's per-image brightness classifier. Providers are optional and
fail gracefully: if the imageboard denies a request or lacks a character, the curated
icons and existing character sources stay available.

Search resolves character names with the public character-tag index, using a matched
series as a disambiguation hint (for example, Asta from Black Clover rather than
Asta from a game). Up to three named characters are queried per search; results are
ranked for actual portraits/close-ups before inclusion. The source has a brief
in-worker cache and per-account request limits. Use "More looks" to browse additional
general-rated solo art for the same tag.

Anime artwork posted to an imageboard is copyrighted by its individual creators;
the API is not an image license. The site links thumbnails, without bundling those
files into our GitHub repo. This remains a personal prototype; obtain permission
before making a public redistribution or commercial avatar service.

## Expanded profile-icon packs (2026-11-21)

The icon picker now indexes **857 named TV and movie character profile icons** from
`Angel2mp3/Bring-Back-Netflix-Icons` (GitHub source script blob
`f5649af92b6b090a505ca712254821f2d4c73ea7`). Each record includes
the specific character name, its film or series, and a publicly reachable
Netflix CDN profile-icon URL. The index is partitioned into 741 TV-series
and 116 movie icons; celebrity, generic, non-character and all 71
Netflix-sourced *anime* icons were excluded. The anime Netflix set was removed
after user testing because its icons did not fit the anime library's style.
Sample images were checked against Netflix's image CDN (KPop Demon Hunters,
Rebel Moon, The Sea Beast, Vivo, Stranger Things, Arcane, The Witcher).

The existing custom-upload (+) and first 15 default curated icons remain
unchanged. The TV and Movies tabs offer sixteen extra streaming character icons
immediately, followed by a **Browse more character icons** control that reveals
their full indexed catalog in batches of 64. **Anime shows its original 15
featured icons first, without any new Netflix anime additions.** Its own
**Browse more character icons** button reveals the rest of the original curated
anime collection in batches of 64, not the unrelated streaming pack.
Search locally merges curated + streaming packs only for TV and Movies. Anime
search and anime title browsing use their original curated entries plus
previously supported live character-artwork sources; the image-quality checks
remain active. Clicking a known TV/movie title shows its indexed character icons
without requiring a cast/headshot API. No movie posters, unrelated actor
headshots or site-wide disclaimer have been introduced.

Netflix/CDN icons are owned by their original rights holders and can disappear
or change as remote assets. Their availability from a public CDN is **not**
a grant of reuse rights; users of a public or commercial site need permission
and reliable alternative asset hosting. This personal prototype hotlinks them
without vendoring binary artwork into GitHub or Supabase. Their urls are
restricted by image-host + image-path allowlists, and the original avatar
values remain valid. There is no new API key or migration.

### Sidebar height

Desktop sidebars must remain `position:sticky` with viewport height.
An earlier rule used `position:relative` and caused the sidebar background
to stop after scrolling into long Settings pages. The high-specificity
desktop-only override restores the expected behavior without changing the
mobile fixed rail.
