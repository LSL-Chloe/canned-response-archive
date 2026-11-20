# Development authentication smoke test

**Not the final login design.** This temporary form exists at
`/dev/auth-test` on the Cloudflare development Worker. The homepage and
planned search/library interface remain independent.

## Before first signup

- Confirm the development Supabase project is empty and use it only for test data.
- Rotate the `PIN_PEPPER` if it was previously shared in any chat or screenshot;
  generate a fresh cryptographically secure 32+ character secret **privately**.
- Set all five Cloudflare **runtime** secrets on the deployed Worker and make
  sure the deployment version that contains them is serving traffic.
- The deployed Worker is named `canned-response-archive` (it is still our
  development site; the Supabase development project is separate from production).
- Do not paste your PIN, OTP or credentials into a chat, screenshot or repository.

## Manual test

1. Open `https://<development-worker>.workers.dev/dev/auth-test`.
2. Select **Sign up**. Enter your intended development admin agent name,
   your own inbox, and a four-digit PIN. Submitting begins pending signup.
3. Open your email. Enter the six-digit OTP within 10 minutes.
4. After verifying, confirm the page shows your agent name with **Administrator** role.
5. Sign out; choose **Log in**, enter the same agent name and PIN.
6. Sign out; choose **Recover PIN**, enter your verified email, confirm the
   OTP, and choose a new PIN. Previous sessions should be revoked.
7. Log in with the new PIN. Verify old PIN no longer works.

If no email is specified at signup, the account is created immediately
but cannot recover a forgotten PIN using email.

Only a *completed* signup receives a role. The first account created in this
development database receives the **development admin role**, not a future
production admin role.

## What these tests do not prove

- They do not validate the final interface, real-time subscriptions,
  response management screens, backup/restore, or production isolation.
- The API health endpoint only confirms presence of three configuration
  values; actual database access is separately tested using shared read.
- Gmail delivery must be tested from your own inbox; automated tests mock
  the sender and do not use your Gmail account.

The app is not yet appropriate for workplace use.
