# Set up Canned Response Archive

This guide is for working on the project locally or deploying your own copy. You don't need an account on the existing development site to run the source code.

## 1. Get the project running

Install Node.js 22 or newer, then:

```bash
git clone https://github.com/LSL-Chloe/canned-response-archive.git
cd canned-response-archive
npm ci
cp .dev.vars.example .dev.vars
npm run dev
```

The terminal prints a local URL. Vite's Cloudflare plugin runs the frontend and Worker together.

You will need to fill in the secrets in `.dev.vars` before account and database features will work. Never commit this file.

## 2. Prepare Supabase

Create a **separate development Supabase project**. Apply the versioned SQL migrations from `supabase/migrations/` in chronological order, or use a migration tool that can reconcile their history. The repository's existing development project has already been migrated; **do not reapply its migrations blindly**.

The database holds:
- Accounts, PIN verifiers, and sessions
- Shared and private shortcuts and response text
- OTP requests and rate-limit counters
- A public-read bucket for uploaded profile pictures

The `shared_response_feed` table is intentionally readable without signing in. Other account and response tables use restricted grants and row-level security.

Copy the Supabase project URL and a **server-side secret API key** into your local `.dev.vars`:

```dotenv
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_YOUR_SERVER_ONLY_KEY
PIN_PEPPER=REPLACE_WITH_A_LONG_RANDOM_SECRET
```

Generate a strong pepper privately, for example with `openssl rand -hex 32`. Do not rotate it casually: changing it invalidates existing PIN verification and OTP digests.

## 3. Optional email verification

Email-backed signup, changing a recovery email, and recovering a forgotten PIN use a Google Apps Script relay. If you want those features, follow [the Gmail OTP guide](gmail-otp-setup.md) and add the encrypted `OTP_MAILER_URL` and `OTP_MAILER_SECRET` variables.

Without the mailer, signup without an email still works, but that account cannot recover a forgotten PIN through email.

## 4. Optional movie character discovery

The bundled TV and movie PFP collections work without an API token. Additional movie metadata and character discovery use TMDB. To enable those searches, set `TMDB_READ_ACCESS_TOKEN` as a server-only secret using the token provided in your TMDB account settings.

Anime uses its curated icon collection and optional external character-artwork sources. External catalogs may be incomplete, rate-limited, or unavailable.

Third-party artwork remains owned by its creators and publishers. The repository uses remote image links; it does not transfer rights to redistribute those images.

## 5. Check the project

```bash
npm run typecheck
npm run test
npm run build
# Or run everything together:
npm run check
```

The repository includes `package-lock.json`. Use `npm ci` for a clean, reproducible install. If you intentionally change dependencies, update the lockfile using npm and commit it with the related `package.json` change.

The automated tests cover input handling, shortcut behavior, permissions, OTP logic, migrations/configuration assumptions, and avatar selection. They do not replace real browser or live integration tests.

For a browser-based authentication smoke test, `/dev/auth-test` is available **in local development only**. The real sign-in and signup screens are at `/auth`.

## 6. Deploy your own Worker

The existing repository is connected to Cloudflare and can deploy changes from GitHub. If you're deploying a separate copy, create a Cloudflare Worker, configure the account and environment, and set its runtime secrets using Cloudflare's **Variables and Secrets** panel or `wrangler secret put`.

Once configured:

```bash
npm run deploy
```

Do not use a live production database for local testing or preview environments. Protect an empty deployment until the intended first account has claimed the administrator role. Keep a separate production database and a tested backup/restore plan before storing any meaningful content.

**Caution:** The GitHub repository is already public. Never place keys, personal email content, PINs, OTPs, or real archived customer messages in commits, screenshots, or bug reports.

## Environment variable reference

| Variable | Needed | Where it belongs |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Worker environment |
| `SUPABASE_SECRET_KEY` | Yes | Worker secret, never browser |
| `PIN_PEPPER` | Yes | Worker secret, 32+ characters |
| `OTP_MAILER_URL` | Only for email verification | Worker secret |
| `OTP_MAILER_SECRET` | Only for email verification | Worker secret |
| `TMDB_READ_ACCESS_TOKEN` | Only for extended movie discovery | Worker secret |

Do not prefix these variables with `VITE_`: that prefix is for frontend-exposed configuration.

## Working on the interface

The normal workflow begins at Search. Saved responses live in Canned responses, while the profile menu opens Settings. The page supports dark and light liquid-glass themes, and its visual effects respect reduced-motion preferences.

The current development Worker also serves the custom domain [archiveresp.dpdns.org](https://archiveresp.dpdns.org/). Domain registration and DNS changes are administered outside this repository; deploying this code alone does not register or attach that hostname. The site uses a CDN-first preview for static curated avatar images and falls back to the original pinned GitHub image if the CDN is unavailable. Chrome's network/proxy restrictions may still affect third-party images independently of the Worker.

For a complete manual test, use [archive QA](archive-qa.md) and [authentication QA](auth-qa.md). For the trust boundaries, see [architecture](architecture.md) and [SECURITY.md](../SECURITY.md).

## Cloudflare preview builds and dependency updates

Cloudflare Workers Builds deploys `main` to the development Worker and attempts a
separate **preview build** for non-production branches and pull requests. The
`previews: {}` entry in `wrangler.jsonc` is required by `wrangler preview`;
without it, GitHub may report **Workers Builds: canned-response-archive** as
failed even when `npm run check` and the production deployment succeed.

The Preview config is deliberately empty. **Previews do not inherit production
secrets or database bindings**, so a preview can show the interface but will
not have functional sign-in or saved responses until separate, test-only preview
secrets are configured in Cloudflare. Never copy production credentials into
the Previews Base environment just to make an automated check green.

In the Cloudflare dashboard, the setting is under
**Workers & Pages → canned-response-archive → Settings → Build → Branch control**.
If branch preview deployments aren't needed, disable **Enable Preview Builds**
there instead of enabling production data access. The production branch should
remain `main`.

Dependabot proposes patch/minor updates in groups. Major upgrades (for example
a new Vite, TypeScript, or GitHub Actions major version) require manual,
coordinated review to avoid incompatible dependency combinations. GitHub CI
checks pull requests and `main` pushes, without duplicate checks for every
feature-branch push.
