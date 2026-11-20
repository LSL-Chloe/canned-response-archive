# Canned Response Archive

A browser-based canned-response archive for a workplace team. This repository currently
contains the **Phase 4 Frosted Instrument UI** on top of the working development API. It is not a production release.

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

Visit the URL shown in the terminal. The homepage provides shortcut search, a response
library and creation forms. Sign in, sign up and PIN recovery live at `/auth`;
legacy authentication QA remains at `/dev/auth-test`.

```bash
npm run test       # dependency-free source/config tests
npm run typecheck  # after npm install
npm run build      # after npm install
npm run check      # all checks
```

## Project status

**Implemented in development:** React archive interface with hashtag suggestions, shared/private
library, response creation, basic editing and deletion, agent settings, admin counts,
Cloudflare Worker API,
agent-name/PIN signup with optional verified email, login, email changes, PIN recovery,
sessions, shared/private response CRUD, import/export permissions, admin counts and four
tested development SQL migrations.
See [backend API](docs/backend-api.md) and [Gmail OTP setup](docs/gmail-otp-setup.md)
for current routes, security model, setup and limitations.

For a temporary browser-based authentication smoke test, see
[Development authentication QA](docs/auth-qa.md) at `/dev/auth-test`.
This is **not** the final login or signup interface.

**Verified during development:** Gmail OTP signup, admin account, login and PIN recovery, backend and
Supabase connectivity. **Still needed:** true push-based realtime subscription (the browser
currently polls approximately every 5 seconds), authenticated UI browser testing in both themes,
permission regression testing, security review and a separate production deployment.

Design decisions are documented in [DESIGN.md](DESIGN.md). The first implemented visual
pass includes responsive light/dark themes, layered glass navigation and OTP verification motion.
See [requirements](docs/requirements.md), [architecture](docs/architecture.md) and
[setup](docs/setup.md).

## Security

Never commit `.dev.vars`, `.env`, credentials, API secrets, agent PINs, or OTP codes.
Do not use this development prototype as a production workplace archive.
