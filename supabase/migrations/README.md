# Versioned Supabase schema

The following migrations correspond to migrations already successfully applied to the
**development** Supabase project `bjcfoitzfiunikkemdry`:

1. `20261120003511_initial_archive_schema.sql` – nine protected application tables and shared-only Realtime feed.
2. `20261120003644_index_shortcut_scope_fk.sql` – a covering index for response-to-shortcut scope.
3. `20261120005428_auth_and_attribution.sql` – atomic admin signup, rate limit RPC, shared creator attribution and admin counts.

All four were tested in the dev project. Do not run them again on this project; do not
apply them to a future production project until the full stack passes review. Project
setup tooling may use the recorded Supabase migration history when comparing versions.

A migration's SQL text is a reproducible schema representation, but it does not
include real data; backing up the database requires a separate, tested export process.
