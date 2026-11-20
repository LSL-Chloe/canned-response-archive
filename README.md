# Canned Response Archive

A browser-based canned-response archive for a workplace team. This repository currently
contains the **Phase 1 development foundation**, not the finished application.

## Stack

- React 19 + TypeScript + Vite
- Cloudflare Workers with the Cloudflare Vite plugin (frontend assets + API Worker)
- Supabase planned for Postgres and live shared-response updates
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

**Implemented:** React entrypoint, minimal accessible placeholder, Cloudflare Worker
health API, TypeScript configuration, local setup, GitHub CI, architecture/requirements notes.

**Not implemented:** Supabase connection, accounts, PIN/OTP security, response CRUD, realtime,
shortcut search, visual design, staging/production deployment.

Design and animation decisions remain intentionally open until the user supplies references.
See [requirements](docs/requirements.md), [architecture](docs/architecture.md) and
[setup](docs/setup.md).

## Security

Never commit `.dev.vars`, `.env`, credentials, API secrets, agent PINs, or OTP codes.
Do not use this phase-1 placeholder as a production workplace archive.
