# Database migrations

The files in this directory describe how the archive's **development** Supabase schema evolved. They are versioned SQL, not database backups.

Apply them in timestamp order to a **new** project, using a migration tool or process that tracks completed versions:

1. `20261120003511_initial_archive_schema.sql` — accounts, PIN verifiers, sessions, shortcuts, responses, shared feed, and foundational access controls.
2. `20261120003644_index_shortcut_scope_fk.sql` — index supporting shortcut lookups.
3. `20261120005428_auth_and_attribution.sql` — atomic first-admin registration, rate limiting, shared creator attribution, and admin statistics.
4. `20261120014009_otp_completion_transactions.sql` — transactional OTP verification for signup, email changes, and PIN recovery.
5. `20261120225401_account_avatars.sql` — optional avatar URL field and a public-read image bucket.

**All five have already been applied to the project's development database.** Do not run them there a second time without checking migration history. A new production database should be created, migrated, and tested separately.

The shared-response feed is deliberately readable to anonymous visitors; credentials and private data are protected by server-only access and database permissions. The avatar storage bucket is public-read, so uploaded pictures must not be sensitive.

Before any production migration, take a tested backup, review data-access grants and RLS policies, apply the change in staging, and plan how to recover if deployment fails. Reverting an application commit does not revert database schema or data.

See [architecture](../../docs/architecture.md), [setup](../../docs/setup.md), and [security](../../SECURITY.md).
