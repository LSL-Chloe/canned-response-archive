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
