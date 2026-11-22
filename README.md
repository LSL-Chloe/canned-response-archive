# Canned Response Archive

Save the replies you write again and again, find them when you need them, and get back to the conversation.

**Canned Response Archive** is a small, browser-based library for reusable messages. You can organize replies under memorable shortcuts, draft a message, and type `#` to find the right response without hunting through notes or old chats.

The project began as a personal tool for handling repetitive support and workplace messages. It now includes a shared response library, personal responses, import/export, account settings, and optional character profile pictures.

## How it works

Suppose you regularly explain how to reset an account password. Save that explanation under `#password_reset`. The next time you need it, start the draft with `password` or `#password`, open the shortcut, choose the saved reply, and copy your finished message. You can still type `#password` inside an existing message.

A shortcut can contain **several different replies**, so you can keep variations without overwriting anything. Changing one reply from Shared to Private (or back) moves only that reply; its original creator remains its owner.

- **Search and draft:** Start typing a known shortcut with or without `#`, or use `#` anywhere to browse shortcuts. The library search also accepts both forms. Filter by name, press Enter or the right arrow to open one, then select a reply. Undo insertion with Ctrl/Cmd+Z. Press Escape once to clear the entire draft and close shortcut suggestions. With the draft editor focused and no text selected, Ctrl/Cmd+C copies the entire draft; highlighting specific text still copies only the selection.
- **Your library:** Save, search, edit, and delete responses. Each saved response shows the original creator's name, current profile picture (or initial), and creation date; private responses show their signed-in owner. Use **All**, **Shared**, **Private**, or **By me** to see just the replies you personally created, across both scopes. Change a reply's visibility while editing without moving its neighbors, or use **Select → Select all → Delete selected** for bulk cleanup. Agents can manage their own responses; admins can also manage anyone's shared replies.
- **Move your data:** Export responses to JSON or import an existing archive. Imports append new entries rather than replace them.
- **Account and appearance:** Sign in with your agent name **or verified email address** and the same four-digit PIN. Email is optional at signup; a verified email also supports PIN recovery, while an account without email can continue signing in by agent name. Settings also offers light/dark themes and a character avatar picker (including a 470-image Crunchyroll collection, plus TV and movie characters). Thumbnails load on demand, with a CDN and source fallback.
- **Team overview:** Everyone, including guests, can see registered agents, their selected profile pictures, account roles, join dates and response counts (not private response text or email addresses). **Admin dashboard** sits above the regular navigation for administrators, with **Manage agents** to search registered accounts and delete an agent after confirming their exact name. Account deletion also removes that agent’s shared and private replies and revokes their sessions, while keeping shared shortcuts still used by other accounts. An administrator cannot view another person's private text or delete their own administrator account.

**Please know what “Shared” means:** shared response text and creator display names are deliberately available to people visiting the site **without signing in**. Never place passwords, personal data, customer secrets, or confidential internal material in Shared responses. Private responses are returned only to their owner.

## See it in action

The **live site** (from `main`) is available at [archiveresp.dpdns.org](https://archiveresp.dpdns.org/) (the original [Cloudflare workers.dev address](https://canned-response-archive.mohid-limesoftlogics.workers.dev/) also works). Both hostnames route to the live `main` Worker. The live Supabase database happens to have a historical `-dev` name, but it is **production data**, separate from the `develop` Preview and its staging Supabase project. Only use approved content until backup/restore readiness and end-to-end security checks have been confirmed.

## Run it locally

You'll need Node.js 22+, npm, a Supabase project, and the Cloudflare Worker development tooling.

```bash
git clone https://github.com/LSL-Chloe/canned-response-archive.git
cd canned-response-archive
npm ci
cp .dev.vars.example .dev.vars
# Fill in the local-only credentials described in docs/setup.md
npm run dev
```

The site uses a responsive liquid-glass interface with a synchronized light/dark toggle and reduced-motion support. It attempts the **original complete glass presentation** first (WebGL2/WebGL1); only when that fails does it use **one matched backup appearance** (animated Canvas 2D with CSS safety net). Buttons, selection pills, the theme toggle and spring transitions stay shared. Entry HTML and the unbundled visual script are kept fresh to avoid stale versions. Email verification shows a six-digit lock-on progress animation; an account is marked verified only after the server confirms the code.

The website is built with **React, TypeScript, and Vite**. The API runs in a **Cloudflare Worker** and stores responses, account records, and session data in **Supabase PostgreSQL**. Email verification can be sent through a signed Google Apps Script relay.

Useful checks:

```bash
npm run typecheck
npm run test
npm run build
npm run check
```

The command `npm run check` runs all three checks. GitHub Actions uses `npm ci` with the committed lockfile for repeatable installs and runs the checks for incoming changes. Passing these checks does not replace a security audit or device testing.

## Project guide

| Document | What you'll find |
| --- | --- |
| [Setup](docs/setup.md) | Environment variables, local development, and deployment |
| [Staging and safe releases](docs/staging-and-releases.md) | Develop branch, isolated Preview, test database, release gates, and rollback |
| [How it fits together](docs/architecture.md) | Frontend, Worker, database, and data boundaries |
| [API reference](docs/backend-api.md) | Endpoints, permissions, and rate limits |
| [Features and permissions](docs/requirements.md) | What each role can do |
| [Design](DESIGN.md) | Liquid-glass principles, motion, and accessibility |
| [Archive QA](docs/archive-qa.md) | Manual checks for saving, searching, and importing responses |
| [Authentication QA](docs/auth-qa.md) | Signup, login, and PIN recovery checks |
| [Email setup](docs/gmail-otp-setup.md) | Optional Gmail verification relay |
| [Security](SECURITY.md) | Sensitive data, known limitations, and reporting concerns |
| [Code review](docs/security-performance-review.md) | Audit findings, changes, and work left before production |
| [November 2026 release review](docs/release-review-2026-11-22.md) | Staging-to-live release scope, database prerequisite, checks, and remaining risks |
| [Visual recovery audit](docs/visual-recovery-audit-2026-11-22.md) | Restored violet/blue background fallback, WebGL behavior, feature preservation, and device QA |
| [Contributing](CONTRIBUTING.md) | Making and reviewing changes |

## Redesigns without changing the live site

New interface designs and other experiments should start from the permanent [`develop` branch](https://github.com/LSL-Chloe/canned-response-archive/tree/develop). The live site deploys from `main`. The Cloudflare Preview for `develop` needs its **own staging Supabase project and secrets** for login/data testing; it must never reuse the database serving the live site. See [Staging and safe releases](docs/staging-and-releases.md).

## A note about development

This repository is **already public**, so never commit real secrets, personal email messages, PINs, OTPs, database exports, or customer responses. The example environment file contains placeholders only. Historical commits should be checked separately before announcing a public launch.

Character profile pictures are optional and use third-party artwork. Those images may belong to other rights holders; public image links do not grant redistribution rights.

A code license has not yet been chosen. Public availability on GitHub does not automatically authorize reuse of this code or third-party image collections.

The aim is straightforward: a useful, quick response archive that stays comfortable to use, whether you're working from a laptop or a phone.
