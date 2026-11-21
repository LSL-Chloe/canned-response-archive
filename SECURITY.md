# Security and privacy

Canned Response Archive is a personal/development project, not a certified secure workplace service. Please treat its current deployment as a test environment.

## Understand the visibility model

**Shared replies are public.** Visitors can read shared response text and the creator's display name without signing in. Share only text you would be comfortable publishing on the internet.

**Private replies are account-scoped.** The Cloudflare Worker validates the session and filters queries by the authenticated account. Administrators can view private response counts, but not another person's private text.

**Custom profile pictures are publicly readable.** The uploaded image's Supabase Storage URL can be accessed by anyone who knows it. Do not use private or sensitive images.

**Avatar thumbnails are fetched from third parties.** The static public collections use pin-locked jsDelivr thumbnail URLs with the corresponding GitHub file as a fallback. Browsers visiting the avatar picker connect to those services and may expose the visitor's IP address and normal HTTP metadata to them. Do not treat artwork found on public CDNs as licensed for redistribution.

## Authentication boundaries

Accounts use a four-digit PIN. Sign-in accepts the original agent name or the account's **verified** email, and both aliases share the same per-account attempt limit, along with an IP limit. Invalid credentials do not reveal whether an email is registered. Although PIN verifiers are salted and protected with a server-side pepper and login attempts are rate-limited, four digits are still a low-entropy secret. We do **not** recommend using this authentication scheme to protect valuable or sensitive data in a public production deployment.

Only the Worker should receive `SUPABASE_SECRET_KEY`, `PIN_PEPPER`, `OTP_MAILER_SECRET`, or `TMDB_READ_ACCESS_TOKEN`. The browser uses HttpOnly, SameSite=Strict session cookies; state-changing API requests require a matching Origin. Supabase tables containing credentials, sessions, and private content deny direct anonymous access.

**Important bootstrap limitation:** the first completed signup becomes the administrator. If you set up an empty public deployment, restrict access until the intended administrator has registered.

## Running a deployment safely

- Use separate Supabase projects and independent credentials for development and production.
- Keep credentials in local ignored `.dev.vars` files or Cloudflare encrypted secrets. Never place them in `VITE_*` variables, frontend files, GitHub Issues, build logs, or screenshots.
- Rotate any secret that might have been exposed, including through repository history. Deleting a committed secret from the latest file does not remove it from Git history.
- Test role permissions, account recovery, login throttling, cookie settings, and database grants before inviting others.
- Keep verified backups and a tested restore procedure before importing meaningful data.
- Review Cloudflare rate limiting, monitoring, dependency alerts, and abuse protections before opening signups to the public.
- Inspect the image-provider terms before using third-party artwork in a public or commercial offering.

The response library polls for updates rather than subscribing to raw private database tables. Images from external sources can expire or be replaced.

## Reporting a security issue

Please do not put tokens, working exploits, private data, or other sensitive details into a public GitHub issue. Contact the repository maintainer privately or use GitHub's private vulnerability reporting feature if it is enabled.

Include the affected endpoint or file, expected behavior, observed behavior, and a minimal reproduction using **test data only**. No sensitive real-world records are needed.

## What is not yet guaranteed

Automated checks cover logic and source-level protections, but do not prove the deployed environment is fully secure. Production readiness still requires dependency review, secret and history scanning, real-browser permission tests, operational monitoring, and backup drills.

## Preview deployments

Non-production Cloudflare Worker previews are isolated from production settings.
The checked-in `previews: {}` entry only allows Wrangler to create previews;
it does not grant them access to the production Supabase project. If preview
features need database access, use a separate disposable test project with
independent credentials and only test data. Do not promote preview secrets or
public preview URLs as equivalent to production protections.

## Dependency and history review

The GitHub security-audit workflow checks reachable Git history and performs npm advisory checks on each PR and main. Its results supplement, but do not replace, GitHub's provider-backed secret-scanning alerts. Vite 7.3.8 is the minimum approved Vite 7 release; do not expose a development server publicly.

The dependency lockfile is committed and checked in CI. A separate production security review and rights clearance for third-party avatar artwork are still needed before a broad launch.

## Changing visibility and managing several responses

A signed-in user may move their own responses between Shared (publicly readable) and Private. The administrator may also move an **existing Shared** reply created by another agent to Private. That reply remains owned by its original author; after the move, even the administrator cannot view its private text. No one can use the UI or Worker API to reveal another account's Private reply by moving it to Shared.

Bulk selection restricts regular agents to their own replies. Administrators may additionally delete others' Shared replies, but never another account's Private replies. Deletes are permanent. The Worker checks the signed-in session and enforces rate limits, and a service-role-only database function rechecks every selected row under locks before deleting it atomically per batch. Larger selections are multiple batches, so an interrupted request may have already committed a prior batch. Confirm the filter and selection before deleting.

A successful source build is not a substitute for testing actual account boundaries and backup restoration in a staging environment.
