# Release review — 22 November 2026

This is the review record for bringing the 12 staged commits since `main@6001e6a` into the live site. It documents what was checked, what this release changes, and what remains a conscious operational limitation. A green check is not a penetration test or a guaranteed absence of bugs.

## Scope

- **Visuals:** updated liquid-glass surface, synchronized dark/light palette, stable sidebar/header join, one selected-state pill per choice, reduced-motion handling, low-end-friendly fallback, and Claude's OTP v5 lock-on animation.
- **Draft and library:** Ctrl/Cmd+C copies the complete unselected focused draft without overriding normal selected-text copy. Existing shortcut-with/without-`#` matching, insertion undo, four library filters, response editing, and bulk actions remain.
- **Administrator:** the admin entry now expands into Team overview and Manage agents. The registry shows names/roles/dates/counts, not email addresses or private reply bodies. Account deletion requires an active administrator session, rate limit and exact-name confirmation, and forbids deleting the administrator. It permanently removes the chosen agent's replies, credentials and sessions; shared shortcuts still referenced by other agents are retained.
- **Email:** signup, recovery, and settings still rely on an optional signed Gmail Apps Script relay. OTP success animation is cosmetic and starts only after a server-confirmed response.

## What was checked

1. Inspected the `develop` → `main` compare and all changed-file paths, relevant front-end/Worker handlers, SQL migrations, permissions and CI workflows.
2. Latest `develop` verification, dependency checks, credential-pattern scan and Cloudflare Preview build passed before this release review.
3. The live database originally held **3 agents, 227 replies, 119 shortcuts and 202 Shared-feed entries**. The live project is historically named `canned-response-archive-dev`; do not confuse it with staging. It had eight applied migrations before the additive admin-deletion function, and now has nine.
4. The staging project had nine applied migrations and its own Worker credentials. Anonymous and regular authenticated database roles cannot execute the account-deletion RPC.
5. A **rollback-only** staging SQL test verified that an ordinary agent cannot delete a different agent, the administrator cannot delete themselves, and a successful test deletion preserves another agent's Shared reply and reassigns a still-used shared shortcut. Test rows were not persisted; staging counts were unchanged afterward.
6. Reviewed the repository's public documentation and replaced stale information describing an unprotected `main` branch or an unconfigured staging Preview.

## Database deployment

`supabase/migrations/20261122043000_admin_delete_agent.sql` is the only migration absent from the original live project. It **creates** a service-role-only, `SECURITY INVOKER` database function and makes no modifications to existing accounts or replies at installation. Apply it before deploying the corresponding Worker endpoint, then check:

- The function exists and only `service_role` can execute it; `anon` and `authenticated` cannot.
- Existing account/reply/shortcut/feed row totals are unchanged after migration.
- RLS settings and security advisories remain as expected.

The migration version recorded by Supabase may differ from the Git filename timestamp. Don't reapply existing migrations. **Applied on 22 November 2026 before code promotion:** production now has all nine migrations. After installation the same **3 agents, 227 responses, 119 shortcuts and 202 Shared-feed entries** remained, and only `service_role` could invoke the new RPC. The migration is additive, but reverting the Worker does **not** reverse the SQL function; use a separate reviewed migration if schema removal is ever required.

## Release and rollback

- Merge a protected `develop` → `main` PR only with all required checks green.
- Record the previous `main` SHA and Cloudflare Production deployment, and keep a verified database backup/restore plan. A database backup status cannot be inferred from source-code checks alone.
- Confirm the live Worker build and basic guest Shared read, signed-in Private read, name/email sign-in (where email is configured), theme and navigation after merging. Do not run destructive operations on real user accounts for QA.
- If production code fails, roll back to the known-good Worker deployment or revert the PR through another protected merge. Reverting code does not recover deleted replies.

## Known limitations and follow-ups

- **Authentication:** a four-digit PIN remains low entropy even with rate limits. Do not store high-value secrets in the archive. The first completed account on a *new* database becomes administrator.
- **Email:** the staging Gmail relay was configured and the operator reported successful verification, but production's `OTP_MAILER_URL`/`OTP_MAILER_SECRET` bindings and live email delivery must be verified separately; they are **not** copied with the Git merge.
- **Browser QA:** automated tests and isolated visual smoke tests do not prove that every mobile GPU or browser renders the optical effects perfectly; test dark/light, reduced-motion, OTP, text selection and responsive layouts.
- **Operations:** backup restoration, monitoring, abuse-protection settings, third-party avatar rights, and provider-backed credential-scanning alerts require operational follow-up beyond repository CI.

See [Staging and releases](staging-and-releases.md), [API reference](backend-api.md), [Security](../SECURITY.md), and [Authentication QA](auth-qa.md).
