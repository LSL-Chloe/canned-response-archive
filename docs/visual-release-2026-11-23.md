# Approved UI and fallback — production release review (23 November 2026)

This release promotes **only the verified visual behavior** from `develop` to the protected `main` branch. It does not move staging data, reset branches, rewrite authentication/response logic, add a database migration, or replace the React application.

## Behavior

1. **Original by default.** The existing `public/liquid-glass.js` attempts its approved WebGL2 shader, then the same scene in WebGL1 when necessary. The renderer is treated as ready only after the first successful frame; rendering resolution/frame cadence may be adjusted to reduce load, not the React control design.
2. **One fallback.** If the original renderer is unavailable or fails, only the decorative scene changes to the earlier lined dark/light CSS background. The existing buttons, keyboard controls, options, selection lenses, and theme toggle remain mounted. The lined mode adds the toggle-matched convex highlight and spring behavior without per-row SVG filters or a Canvas2D main-thread animation.
3. **No blank startup.** A temporary ambient-colored field appears while the original shader initializes; it is not an alternate mode. WebGL context loss has a bounded retry, after which the CSS fallback remains available. Reduced-motion and reduced-transparency settings are respected.
4. **Consistent delivery.** `index.html` references a versioned visual script; the narrowly scoped Cloudflare `public/_headers` rules require revalidation of the HTML and script without modifying API/cache semantics for other assets.

## Code scope and isolation

The release was assembled **from the existing production `main` tree**, rather than blindly merging all staging commits. On 23 November, side-by-side content comparison confirmed the production and staging implementations of the existing React workspaces, API handlers, authentication visuals, administrator controls, and database migration SQL were identical. The release changes the visual boot script, visual stylesheet, the HTML reference and cache headers, corresponding regression tests, and design/release documentation.

Both environments retain separate Supabase projects. `wrangler.jsonc` and all secret bindings are untouched. Existing account, response, team, admin, and import/export behavior is outside the release scope.

## Verification gates

- `npm run check` (TypeScript, Node regression tests, Vite/Worker build), dependency/security checks, and Cloudflare's build must pass on the final release PR **before** merging into protected `main`.
- Verify original WebGL2 and WebGL1 paths; verify lined CSS when both GPU APIs fail; inspect context-loss retry, the loaded script version, and the unchanged controls.
- Exercise dark and light themes, the compact toggle, option lenses, buttons, the sidebar, search, response editor, signup/OTP, and keyboard focus in both visual modes. Check mobile widths, low-end devices, reduced motion, and disabled WebGL.
- After production deployment, confirm the shared feed and sign-in without touching real account data. Avoid destructive admin tests on live accounts.

Automated checks cannot prove identical real-device optical appearance or network delivery. A successful build verifies deployability, not browser-by-browser pixel matching. If the release must be rolled back, revert the visual release via the protected PR workflow or restore the previous Cloudflare deployment; no database rollback is involved.

See [Design](../DESIGN.md), [Staging and releases](staging-and-releases.md), and [Archive QA](archive-qa.md).
