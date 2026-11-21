# Canned Response Archive

Save the replies you write again and again, find them when you need them, and get back to the conversation.

**Canned Response Archive** is a small, browser-based library for reusable messages. You can organize replies under memorable shortcuts, draft a message, and type `#` to find the right response without hunting through notes or old chats.

The project began as a personal tool for handling repetitive support and workplace messages. It now includes a shared response library, personal responses, import/export, account settings, and optional character profile pictures.

## How it works

Suppose you regularly explain how to reset an account password. Save that explanation under `#password_reset`. The next time you need it, type `#password` in the draft field, open the shortcut, choose the saved reply, and copy your finished message.

A shortcut can contain **several different replies**, so you can keep variations without overwriting anything.

- **Search and draft:** Type `#` to browse shortcuts. Filter by name, press Enter or the right arrow to open one, then select a reply. Undo insertion with Ctrl/Cmd+Z.
- **Your library:** Save, search, edit, and delete responses. Choose **Shared** for the team library or **Private** for your own.
- **Move your data:** Export responses to JSON or import an existing archive. Imports append new entries rather than replace them.
- **Account and appearance:** Sign in with an agent name and four-digit PIN. An optional verified email supports PIN recovery; Settings also offers light/dark themes and profile pictures.
- **Team overview:** Administrators can see user and response counts, and manage shared responses. They cannot read another person's private response text.

**Please know what “Shared” means:** shared response text and creator display names are deliberately available to people visiting the site **without signing in**. Never place passwords, personal data, customer secrets, or confidential internal material in Shared responses. Private responses are returned only to their owner.

## See it in action

The current development deployment is at [canned-response-archive.mohid-limesoftlogics.workers.dev](https://canned-response-archive.mohid-limesoftlogics.workers.dev/). It uses development infrastructure and is **not a production-ready workplace service**. Please use test content until a separate production environment, backups, and end-to-end security checks are complete.

## Run it locally

You'll need Node.js 22+, npm, a Supabase project, and the Cloudflare Worker development tooling.

```bash
git clone https://github.com/LSL-Chloe/canned-response-archive.git
cd canned-response-archive
npm install
cp .dev.vars.example .dev.vars
# Fill in the local-only credentials described in docs/setup.md
npm run dev
```

The website is built with **React, TypeScript, and Vite**. The API runs in a **Cloudflare Worker** and stores responses, account records, and session data in **Supabase PostgreSQL**. Email verification can be sent through a signed Google Apps Script relay.

Useful checks:

```bash
npm run typecheck
npm run test
npm run build
npm run check
```

The command `npm run check` runs all three checks. GitHub Actions runs it for incoming changes. Passing these checks does not replace a security audit or device testing.

## Project guide

| Document | What you'll find |
| --- | --- |
| [Setup](docs/setup.md) | Environment variables, local development, and deployment |
| [How it fits together](docs/architecture.md) | Frontend, Worker, database, and data boundaries |
| [API reference](docs/backend-api.md) | Endpoints, permissions, and rate limits |
| [Features and permissions](docs/requirements.md) | What each role can do |
| [Design](DESIGN.md) | Liquid-glass principles, motion, and accessibility |
| [Archive QA](docs/archive-qa.md) | Manual checks for saving, searching, and importing responses |
| [Authentication QA](docs/auth-qa.md) | Signup, login, and PIN recovery checks |
| [Email setup](docs/gmail-otp-setup.md) | Optional Gmail verification relay |
| [Security](SECURITY.md) | Sensitive data, known limitations, and reporting concerns |
| [Code review](docs/security-performance-review.md) | Audit findings, changes, and work left before production |
| [Contributing](CONTRIBUTING.md) | Making and reviewing changes |

## A note about development

This repository is **already public**, so never commit real secrets, personal email messages, PINs, OTPs, database exports, or customer responses. The example environment file contains placeholders only. Historical commits should be checked separately before announcing a public launch.

Character profile pictures are optional and use third-party artwork. Those images may belong to other rights holders; public image links do not grant redistribution rights.

A code license has not yet been chosen. Public availability on GitHub does not automatically authorize reuse of this code or third-party image collections.

The aim is straightforward: a useful, quick response archive that stays comfortable to use, whether you're working from a laptop or a phone.
