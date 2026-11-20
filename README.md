# Canned Response Archive

A browser-based canned-response archive for a workplace team. This repository currently
contains the **Phase 2 development backend prototype**, not the finished application.

## Stack

- React 19 + TypeScript + Vite
- Cloudflare Workers with the Cloudflare Vite plugin (frontend assets + API Worker)
- Supabase development PostgreSQL schema (shared-only Realtime feed provisioned)
- Gmail + Google Apps Script planned for low-volume OTP email

## Quickstart

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Visit the URL shown in the terminal. The temporary scaffold checks `GET /api/health`.

```bash
npm run test       # dependency-free source/config tests
npm run typecheck  # after npm install
npm run build      # after npm install
npm run check      # all checks
```

## Project status

**Implemented:** React entrypoint, placeholder interface, Cloudflare Worker API, secured
agent-name/PIN no-email signup and login, sessions, account name/PIN changes, shared/private
response CRUD, import/export permissions, admin counts and three tested development SQL migrations.
See [backend API](docs/backend-api.md) for current routes and limitations.

**Not implemented:** Email OTP signup/recovery/change email, full deployed Supabase integration,
realtime browser subscriptions, visual design, staging/production deployments.
The development Supabase database is provisioned, but no Worker credentials have been added.

Design and animation decisions remain intentionally open until the user supplies references.
See [requirements](docs/requirements.md), [architecture](docs/architecture.md) and
[setup](docs/setup.md).

## Security

Never commit `.dev.vars`, `.env`, credentials, API secrets, agent PINs, or OTP codes.
Do not use this Phase 2 prototype as a production workplace archive.
