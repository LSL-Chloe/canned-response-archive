# Repository review — November 2026

This record explains the source-level hardening and performance work completed before a wider public launch. It is not a penetration-test certificate.

## Scope

The review covered the tracked source tree, application routing, API handlers, account/session and OTP logic, database migrations and grants, avatar image handling, frontend state and rendering, build configuration, tests, and contributor-facing documentation.

The project was already **public on GitHub** at the time of review. Source availability does not imply a production-ready service.

## Confirmed design boundaries

- **Guest-readable Shared responses are intentional.** The database publishes a shared-only feed; private rows are kept behind authenticated, owner-scoped API requests. The README and API docs now explain this explicitly.
- **The PIN is only four digits.** It is protected using salted, peppered verifiers and rate limits, but remains unsuitable as a sole factor for high-value content. This requires a deliberate authentication decision before production.
- **The first registered account becomes administrator.** An empty public deployment must be controlled until admin bootstrap is complete.
- **Profile uploads are public-read.** Avoid sensitive pictures.
- **Character images come from external owners.** CDN access is not an artwork license.
- **Development and production are not isolated automatically.** Use separate database projects and secrets before storing real business data.

## Changes made in this review

1. The health endpoint now returns minimal liveness information rather than advertising whether backend credentials exist.
2. The legacy authentication QA component is imported only in local development, keeping it out of normal production routing.
3. API JSON includes a no-referrer policy and continues to avoid cacheable sensitive responses. Both incoming JSON and remote avatar streams now enforce byte limits *while streaming*, rather than after unbounded body buffering.
4. Five-second feed polling now reuses unchanged response arrays and memoizes the merged feed, avoiding needless React reconciliation and repeated shortcut grouping.
5. Eager avatar warm-up is bounded and skips lower-capability or data-saving devices. Large Library, Team, and Settings workspaces are lazy-loaded, with preloading on navigation hover/focus; the full avatar catalog no longer blocks the initial search page.
6. Curated public icons load directly from their pinned image sources in the picker, with the existing allowlisted Worker proxy as fallback. This avoids a database-backed authentication lookup for every gallery icon.
7. Long response rows and avatar grids use rendering containment where the browser supports it; the same liquid-glass controls and animations remain.
8. Automated tests cover the response-list comparison, streamed request limits, image URL choice and fallback, the development-only route, and the performance safeguards.
9. Public-facing documentation has been rewritten to describe the actual application, its permissions, and deployment steps rather than earlier design phases.

## Remaining work before calling it production-ready

- Inspect Git history and secret-scanning results; a source review of the current branch cannot prove secrets were never committed.
- Audit dependency advisories, add a generated and committed npm lockfile, and make production builds reproducible. Dependabot configuration is included to surface update proposals.
- Test the live Worker and Supabase grants with guest, regular-agent, and admin accounts. Include explicit forbidden API requests.
- Run real-device performance profiling (slow Android, iPhone Safari, low-memory laptops) and check both themes, reduced motion, image failures, and long lists.
- Validate restore procedures and retention of stale OTP, session, and rate-limit rows.
- Review copyright and reuse permissions for third-party avatar packs. Decide on an explicit code license separately: publishing source does not automatically grant reuse rights.
- Evaluate whether four-digit PINs and open signup meet the risk level of a public service; consider stronger authentication.
- Set up monitoring, abuse protection, and regular credential rotation policies for a separate production environment.

The goal is to keep the archive fast and easy to use **without mistaking green unit tests for complete security verification**.
