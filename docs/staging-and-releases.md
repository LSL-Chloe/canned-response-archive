# Staging, production, and safe releases

Canned Response Archive has a live website and a separate, working staging Preview. **Treat them as two different environments even though both deployments come from the same GitHub repository.**

| Environment | Git branch | URL | Database |
| --- | --- | --- | --- |
| Live | `main` | https://archiveresp.dpdns.org/ | Existing Supabase project `bjcfoitzfiunikkemdry` |
| Staging | `develop` | https://develop-canned-response-archive.mohid-limesoftlogics.workers.dev/ | `canned-response-archive-staging`, project `vfxjiecelhlqryxlymsv` |

**Naming caveat:** the existing live database is called `canned-response-archive-dev` in Supabase. Despite that historical name, it holds real accounts and replies; it **must not** be used as a staging database or copied into the Preview.

## Working safely

- Keep `main` for approved releases. It is the default branch and, as verified 22 November 2026, has an **active** GitHub ruleset requiring a PR, successful verification/security checks, and blocking force pushes and deletions.
- Use `develop` for QA and integration. Start focused `feat/` or `fix/` branches from `develop`, open PRs against `develop`, review and merge only after checks pass.
- The staging Preview uses its own account data, PIN pepper, Supabase URL and secret. Do not reuse staging secrets in Production or vice versa. A Preview's bindings are **not** the Production Worker's bindings.
- Do not merge a new feature to `main` until the relevant staging database migrations are applied and the production migration/deployment order has been reviewed.
- Cloudflare Preview URLs may be public. Test only with non-sensitive sample data, and enable Cloudflare Access when staging needs restricted access.

## Cloudflare Preview configuration

Cloudflare: **Workers & Pages → canned-response-archive → select `develop` → Settings → Variables and Secrets**. The following bindings were confirmed on the `develop` Preview during staging setup:

| Name | Type | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Variable | `https://vfxjiecelhlqryxlymsv.supabase.co` — staging project only |
| `SUPABASE_SECRET_KEY` | Encrypted secret | Staging database's server-only key |
| `PIN_PEPPER` | Encrypted secret | Independent staging pepper |
| `OTP_MAILER_URL` | Encrypted secret | Staging Google Apps Script web-app `/exec` URL |
| `OTP_MAILER_SECRET` | Encrypted secret | Shared only between staging Worker and its Apps Script relay |

The OTP relay was authorized and deployed on 22 November 2026; the operator reported that staging email verification worked. Production mail delivery must be **checked separately** in Production's Cloudflare bindings. A successful staging email test does not mean the production Worker has email configured.

The checked-in `wrangler.jsonc` deliberately puts only the **public staging Supabase URL** under `previews.vars`. All keys and mailer credentials stay in encrypted Cloudflare runtime secrets. The branch-specific Preview keeps staging data isolated from the live website. An existing Preview may need to be redeployed after its secrets change.

For an independent local build, copy `.dev.vars.example` to the gitignored `.dev.vars` and point to a disposable project. Never commit credentials or OTPs to GitHub.

Official Cloudflare documentation:
- https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- https://developers.cloudflare.com/workers/previews/get-started/
- https://developers.cloudflare.com/workers/previews/configuration/

## Database migration history

The two Supabase projects track their SQL changes independently. Migration **names and applied version IDs** can differ from the filename timestamps in Git; check `supabase/migrations/README.md` and the actual migration history before applying anything.

As of 22 November 2026, staging has all **nine** schema migrations, including `admin_delete_agent` (the ninth). The live database originally had eight and must receive that **additive, service-role-only function** *before* the corresponding Admin Dashboard release is deployed. The function changes no existing account or reply until an explicitly authorized deletion is requested.

The latest staging security audit reported row-level security enabled on all ten application tables. Nine informational `rls_enabled_no_policy` findings describe intentionally server-only tables, not public grants. The only directly guest-readable response source is the shared feed.

A rollback-only SQL integration test checked that a non-admin cannot delete an agent, an administrator cannot delete themselves, and a shared shortcut and another user's reply survive an authorized deletion of the original shortcut owner. None of the test accounts or replies were retained. Tests cannot replace a verified production backup.

## Release checklist

1. Check the `develop` commit, recent PRs, dependency/security scans, and `npm run check` output; all required GitHub checks must pass.
2. Exercise staging in both themes, mobile and desktop widths, keyboard/reduced-motion modes, and low-end devices. Cover signup with and without verified email, PIN recovery, private permissions, Shared feed, search with/without `#`, Ctrl/Cmd+C, import/export, and the Admin Dashboard.
3. Review all pending SQL changes and apply compatible **additive migrations to production first**; verify `EXECUTE` is limited to `service_role`. Confirm row counts, grants, and security advisories. Arrange a backup/restore plan for any change that could alter existing data.
4. Record the `main` commit SHA and previous Cloudflare deployment. Open a `develop` → `main` release PR. Let required checks pass before merging. Never force-push `main`.
5. After the Production Worker deployment reports success, smoke-test the live shared feed, sign-in, own Private responses, import/export, theme toggle, and administrator pages **without deleting real accounts**.
6. If code must be rolled back, restore the previous Worker deployment or revert the release via a new protected PR. **Code rollback does not revert a SQL migration or recover a deleted account's replies.**

Account deletion is deliberately irreversible; do not use real users for destructive smoke tests. The four-digit PIN is a known limitation: do not store sensitive workplace/customer secrets without a stronger authentication and backup/security plan.

For endpoint-level access boundaries, see [API reference](backend-api.md), [security guidance](../SECURITY.md), and [authentication QA](auth-qa.md).
