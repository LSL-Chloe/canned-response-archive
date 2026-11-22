# Database migrations

The files in this directory describe how the archive's Supabase schema evolved across live and staging deployments. They are versioned SQL, not database backups.

Apply them in timestamp order to a **new** project, using a migration tool or process that tracks completed versions:

1. `20261120003511_initial_archive_schema.sql` — accounts, PIN verifiers, sessions, shortcuts, responses, shared feed, and foundational access controls.
2. `20261120003644_index_shortcut_scope_fk.sql` — index supporting shortcut lookups.
3. `20261120005428_auth_and_attribution.sql` — atomic first-admin registration, rate limiting, shared creator attribution, and admin statistics.
4. `20261120014009_otp_completion_transactions.sql` — transactional OTP verification for signup, email changes, and PIN recovery.
5. `20261120225401_account_avatars.sql` — optional avatar URL field and a public-read image bucket.
6. `20261122000000_atomic_import_batches.sql` — atomic JSON import function with scoped deduplication.
7. `20261122000001_preserve_original_shortcut_labels.sql` — allow and preserve spaces/leading underscores in shortcut names.
8. `20261122010100_response_management.sql` — atomic reply visibility changes and permission-checked bulk deletion of up to 100 IDs per request.
9. `20261122043000_admin_delete_agent.sql` — service-role-only, transactional administrator account deletion; removes the target's replies and sessions, preserving shared shortcuts used by other agents.

As checked on 22 November 2026, **both staging and the live project have applied all nine migrations**. The live project's ninth migration, `admin_delete_agent`, was installed and its grants/unchanged data counts were verified **before** the corresponding code release. The response-management and agent-deletion RPCs use `SECURITY INVOKER`, are executable by `service_role` only, and are inaccessible to `anon` / `authenticated`. Rollback-only SQL tests verified response visibility transitions, bulk permissions, deletion authorizations, and the preservation of shared content created by other agents. No test data was retained.

File timestamps in Git are a source ordering guide; a Supabase project's applied migration versions can differ. Do not blindly reapply historical schema changes. The live database already contains accounts and responses; do not reinitialize it or overwrite it with staging data. New installations require an independent database and controlled first-admin registration.

The shared-response feed is deliberately readable to anonymous visitors; credentials and private data are protected by server-only access and database permissions. The avatar storage bucket is public-read, so uploaded pictures must not be sensitive.

Before any production migration, take a tested backup, review data-access grants and RLS policies, apply the change in staging, and plan how to recover if deployment fails. Reverting an application commit does not revert database schema or data.

See [architecture](../../docs/architecture.md), [setup](../../docs/setup.md), and [security](../../SECURITY.md).
