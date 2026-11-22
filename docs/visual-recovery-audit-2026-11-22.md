# Visual recovery and feature-preservation audit — 22 November 2026

This is a **staging-only** recovery of the previously approved violet/blue liquid-glass experience. It is not a database restore or a release to the live website.

## What was wrong

The original Claude-supplied, synchronized WebGL2 background is still present in `public/liquid-glass.js` and loaded from `index.html`. The gradient shader retains the violet/blue colors and mouse-driven motion. A follow-up also attempts an equivalent WebGL1 shader before using a visually matched, low-resolution Canvas 2D animation or the CSS-only backup. The problem was the **fallback** in `src/styles/premium.css`: if a device or browser cannot create a WebGL2 context, uses reduced motion, or blocks that script, a highly visible black-and-grey repeating-line **grid** fills the entire screen. The nearby theme tokens also shifted panels and selection buttons toward monochrome.

That makes an otherwise current deployment *look like* an older design; it does not show that the Worker served a stale Git commit.

## Restored, without replacing the React UI

- Restore subtle purple/violet and navy-blue ambient lighting in both light and dark modes, including panels, field borders and glass selection tints.
- Replace the grid with composited soft radial gradients that remain attractive **without GPU acceleration** and need no image assets or new network requests.
- Always attempt the original `public/liquid-glass.js` WebGL2 shader first when motion is allowed. Compile/link/draw errors automatically try the equivalent WebGL1 shader next, then an animated Canvas 2D approximation, and finally the CSS ambiance. These renderers never modify the React control DOM or permission logic, and the SVG glass-control transitions are independent from the background renderer.
- Type the ambient, base-background and caustic CSS color variables and transition them over the existing **580ms** theme-thumb motion, retaining the original toggle. The CSS itself provides a reduced-motion-aware fallback transition even if the optional visual JavaScript cannot run.
- Avoid repeated WebGL initialization on every React DOM update when hardware acceleration is unavailable. Verify a successful frame before hiding the CSS background; on WebGL context loss clean up pointer/resize listeners, switch to Canvas 2D, retry the original shader once after a short cooldown, then keep a stable fallback. Respect reduced motion by showing stationary CSS gradients.
- Preserve reduced-motion/reduced-transparency behavior. The fallback contains no flashing or line patterns and animates only through slow transforms and opacity.

## Checked against approved change history

GitHub PRs **#40 through #54** were inspected for their scope and merge status. The approved feature work was merged; the source for the following remains in the repository:

| Approved behavior | Source/verification |
| --- | --- |
| Original liquid-glass layer and synchronized dark/light toggle | `index.html`, `public/liquid-glass.js`, `src/ui/ThemeToggle.tsx`, `tests/liquid-glass-integration.test.mjs` |
| Text selection, background ripple and existing single selected pill | `public/liquid-glass.js`, `src/styles/premium.css`, existing liquid-glass tests |
| Full-draft Ctrl/Cmd+C and preserved selected-text copy | `SearchWorkspace.tsx`, existing clipboard tests |
| Search with/without #, insertion undo, and Escape clearing | `SearchWorkspace.tsx`, `model.ts`, `tests/public-team-and-escape.test.mjs` |
| Six-digit OTP, server-only verification success, recovery email flows | `OtpVisual.tsx`, `AuthPage.tsx`, `tests/otp-v5-admin-pills.test.mjs` |
| Public Team overview and current profile pictures | `TeamWorkspace.tsx`, `AgentAvatar.tsx`, `worker/api/responses.ts` |
| Admin Dashboard, Manage agents, protected account deletion | `ManageAgentsWorkspace.tsx`, `worker/api/responses.ts`, `tests/admin-agent-management.test.mjs` |
| Shared and Private responses, editable visibility, permission-safe bulk actions | `LibraryWorkspace.tsx`, `worker/api/responses.ts`, `tests/response-management.test.mjs` |
| Saved response creator names, profile pictures and creation dates | `LibraryWorkspace.tsx`, `tests/library-attribution.test.mjs` |
| PFP uploads, curated anime catalog, movies and TV character portraits | `AvatarPicker.tsx`, `curatedAvatarCatalog.ts`, curated/avatar tests |
| Import/export and copied response functionality | `TransferWorkspace.tsx`, `tests/transfer.test.mjs` |

**Scope and limits:** This audit confirms repository contents and regression coverage. It cannot independently confirm the historical Claude HTML source in full because that standalone design file is not stored in the current Git repository, and it cannot guarantee every browser/device renders identically. The original visual-layer JS itself is present and retained. Visual review of the staging Preview on devices with and without WebGL is still needed.

## Original-first / same-controls follow-up

A screenshot of the dense black-and-white grid cannot be generated by the current develop backdrop styles: all relevant background layers use soft radial gradients and the GLSL source contains no grid. Stale HTML/JavaScript, another deployed version, or browser-injected effects are therefore possible. The entry HTML now references a versioned visual-script URL, and Cloudflare static asset headers prevent caching HTML and the visual-script asset. This does not claim to bypass extensions.

The runtime exposes exactly two visual states: original and fallback. WebGL2/WebGL1 are variants of the original shader. Canvas 2D and CSS are technical implementations of the same backup. Button style and animations are shared. Original optical lenses are attempted independently of device-memory tier; if an SVG texture cannot be created, only the displacement effect degrades without breaking controls.

## Release safeguards

The latest two-mode pass is limited to public/liquid-glass.js, the versioned visual-script reference in index.html, targeted public/_headers cache rules, tests, and documentation. No React components, Worker routes, data, account permissions, or production main changes are required. No Supabase migrations, response records, account records, Cloudflare secrets, Worker API endpoints, or GitHub `main` changes are needed.

Run the full test/TypeScript build and security scans on a focused feature PR; inspect the Cloudflare `develop` Preview and compare dark/light modes, mobile widths, reduced-motion mode and a WebGL-disabled browser before any release PR to `main`. The old production website must remain available until staging visuals are approved.
