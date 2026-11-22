# Visual recovery and feature-preservation audit — 22 November 2026

This is a **staging-only** recovery of the previously approved violet/blue liquid-glass experience. It is not a database restore or a release to the live website.

## What was wrong

The original Claude-supplied, synchronized WebGL2 background is still present in `public/liquid-glass.js` and loaded from `index.html`. The gradient shader retains the violet/blue colors and mouse-driven motion. The problem was the **fallback** in `src/styles/premium.css`: if a device or browser cannot create a WebGL2 context, uses reduced motion, or blocks that script, a highly visible black-and-grey repeating-line **grid** fills the entire screen. The nearby theme tokens also shifted panels and selection buttons toward monochrome.

That makes an otherwise current deployment *look like* an older design; it does not show that the Worker served a stale Git commit.

## Restored, without replacing the React UI

- Restore subtle purple/violet and navy-blue ambient lighting in both light and dark modes, including panels, field borders and glass selection tints.
- Replace the grid with composited soft radial gradients that remain attractive **without GPU acceleration** and need no image assets or new network requests.
- Keep the original `public/liquid-glass.js` WebGL2 shader where it works. It still handles reactive highlights, background ripples, theme toggling and refraction.
- Type the three ambient CSS color variables and transition them over the existing **580ms** theme-thumb motion, retaining the original toggle.
- Avoid repeated WebGL initialization on every React DOM update when hardware acceleration is unavailable. After a lost WebGL context, fall back to gradients and allow one retry, then stop retrying.
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

## Release safeguards

Only `src/styles/premium.css`, `public/liquid-glass.js`, documentation, and additive visual-preservation tests should change for this recovery. No Supabase migrations, response records, account records, Cloudflare secrets, Worker API endpoints, or GitHub `main` changes are needed.

Run the full test/TypeScript build and security scans on a focused feature PR; inspect the Cloudflare `develop` Preview and compare dark/light modes, mobile widths, reduced-motion mode and a WebGL-disabled browser before any release PR to `main`. The old production website must remain available until staging visuals are approved.
