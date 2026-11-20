# Database migrations

No migrations have been applied or finalized in Phase 1.

Phase 2 will add reviewed SQL migrations with row-level security (RLS), explicit grants,
unique constraints, and tests for shared vs. private response visibility.

Use a separate development Supabase project for testing. NEVER point test scripts or
preview deployments to production credentials. Before applying production migrations,
export and verify a backup and test the migration against development data.
