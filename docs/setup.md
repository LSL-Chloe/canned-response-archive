# Local setup and account connection

## Prerequisites
- Node.js 22 or newer (LTS recommended)
- npm
- A GitHub account, a Cloudflare account, and a Supabase account

## Local run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The page should report that `/api/health` is online.

To verify the build and source structure:

```bash
npm run check
npm run preview
```

**Phase 1 intentionally has no real database integration or email sender.** Do not add API keys
until Phase 2 implements a secure backend integration.

## GitHub setup

1. Create a **private**, empty GitHub repository named `canned-response-archive`.
2. Extract this starter folder locally and run:

```bash
git init
git branch -M main
git add .
git commit -m "chore: initialize canned response archive foundation"
git remote add origin https://github.com/YOUR_USERNAME/canned-response-archive.git
git push -u origin main
```

3. Keep `main` for reviewed stable work; use branches/PRs for features.
4. `.dev.vars`, `.env`, and secrets are ignored. Do not commit service keys.

## Cloudflare

The project uses the official Workers Vite integration, NOT legacy InfinityFree hosting.
After `npm run check` succeeds, use Cloudflare's Git integration or `npm run deploy` with an
authorized Cloudflare login when ready. The default Worker name ends in `-dev` to discourage
accidental production deployment. Configure a separate production environment after staging tests.

## Supabase

Create two **distinct** Supabase projects when ready: `canned-response-archive-dev` and
`canned-response-archive-prod`. No SQL migration is included yet. Do not create the production
schema or add secrets before review of authentication and access rules.
