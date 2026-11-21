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
- Keep the committed npm lockfile current and review dependency advisories when making upgrades. Dependabot proposes compatible updates for review.
- Test the live Worker and Supabase grants with guest, regular-agent, and admin accounts. Include explicit forbidden API requests.
- Run real-device performance profiling (slow Android, iPhone Safari, low-memory laptops) and check both themes, reduced motion, image failures, and long lists.
- Validate restore procedures and retention of stale OTP, session, and rate-limit rows.
- Review copyright and reuse permissions for third-party avatar packs. Decide on an explicit code license separately: publishing source does not automatically grant reuse rights.
- Evaluate whether four-digit PINs and open signup meet the risk level of a public service; consider stronger authentication.
- Set up monitoring, abuse protection, and regular credential rotation policies for a separate production environment.

The goal is to keep the archive fast and easy to use **without mistaking green unit tests for complete security verification**.

## Follow-up audit: 21 November 2026

- **Credential history:** A read-only scan checked 58 recorded main-branch and pull-request-head commits through GitHub's commit patches. No real high-confidence tokens were identified; two Supabase-looking strings were documented example placeholders. This is limited to accessible commit patches, not all dangling Git objects, binary files, GitHub secret scanning alerts, or connected deployment settings.
- **Reproducibility:** A lockfile was generated using npm's resolver and verified through `npm ci` and the full project checks. CI now uses `npm ci` instead of unconstrained dependency installation. Review lockfile changes alongside dependency updates.
- **Vite:** The minimum supported release has been raised to 7.3.8, which includes the November 2026 development-server security fix (GHSA-p4f5-76q4-ffq7). Do not expose a local Vite dev server publicly.
- **Automated review:** A new read-only GitHub Action checks reachable Git history for high-confidence credential patterns and runs npm audit separately on production and full dependency trees. The production audit fails on high/critical findings; development advisories are reported for review.
- **Authentication:** The four-digit PIN, first-signup administrator bootstrap, and public Shared responses remain intentionally unchanged. A strong identity system and production operations require a separate product decision.
- **Images and API rights:** The bundled Netflix character icons and anime artwork are not automatically licensed by being publicly reachable. TMDB's free noncommercial API requires visible in-app attribution in an About/Credits area, and public publication needs a rights review. Do not mistake a source repository's code license for a license to its images.
- **Low-end performance:** Lazy loading and the reduced initial JS bundle are verified by CI build artifacts, but real-device FPS, interaction latency, battery use and authenticated browser journeys have not been measured. They need physical or reproducible device testing.

## UI and avatar follow-up: 22 November 2026

- **Refractive scroll artifacts:** A single SVG-backed liquid-glass layer previously stretched over the entire response list, which can grow to hundreds of rows. The large rendering/filter surface could create dramatic chromatic distortion or resource pressure on GPU-limited browsers. The long library and potentially unbounded Team table now use stable translucent glass fills and borders; optical filters remain on bounded forms and controls.
- **Import/export controls:** Removed the duplicate native Choose File button from the visual layout while retaining a real keyboard-accessible file input and one styled label. The filename and focus indication remain visible. Scope selectors now use equal-width options.
- **Third-party avatar loading:** The static curated catalogs still store immutable GitHub image URLs for account selection, but thumbnail previews prefer a CDN URL pinned to those revisions. If the CDN request fails, the gallery retries the original source. The picker only preconnects when Settings mounts and prioritizes the first eight visible thumbnails. The Crunchyroll folder contains 470 source images; additional fetching is lazy rather than an eager full-catalog download.
- **Polling on slow connections:** A silent feed poll is skipped when a previous refresh is in progress. This reduces redundant network activity and prevents a series of slower-than-five-second polls from continually overriding their own results.
- **Regression coverage:** Added static and unit checks for the bounded long-list rendering, keyboard-friendly import selector, pinned CDN fallback and non-overlapping silent polling. Existing auth, import, avatar, design, and security tests continue to run.
- **Documentation:** Updated the long-library, import transaction, and image-fallback QA instructions and architecture descriptions.
- **Limitations:** This is a source-level review and automated build/test validation, not an interactive browser/GPU benchmark or proof that all future bugs have been eliminated. Real-device scroll profiling, third-party image availability, public content rights, and stronger authentication remain to be addressed deliberately.

## Response management follow-up: 22 November 2026

- Added a **By me** library filter, using existing viewer-specific ownership flags rather than matching editable display names. No extra private feed is exposed.
- Editing can switch Shared ↔ Private alongside a reply's text and shortcut. A service-role-only SQL function locks the row and preserves the **original owner ID**, even when an administrator moves somebody else's Shared reply to Private. Trigger-maintained Shared feed rows are added or removed in the same database transaction.
- Added confirmed bulk deletion, with a maximum of 100 unique IDs per atomic transaction. The Worker validates the signed-in actor and rate limit; Postgres rechecks both ownership and live visibility while holding row locks. Unprivileged agents cannot delete another agent's shared or private replies; admins can delete shared replies but not others' private replies.
- Library selection is restricted to the current filter's manageable rows. Four-way tabs and select controls reuse compositor-friendly transforms and native checkbox controls rather than many new glass surfaces; reduced-motion and low-data preferences remain supported.
- The new migration must be deployed **before** publishing the Worker features. Code review and automated tests do not replace real-account API permission tests, physical device animation profiling, and backup/restore validation.

Official sources: https://github.com/vitejs/vite/security/advisories/GHSA-p4f5-76q4-ffq7 ; https://developer.themoviedb.org/docs/faq ; https://help.netflix.com/en/node/24852
