# Authentication testing checklist

Use a development database and test inbox. Never share real PINs, verification codes, or Worker secrets in a bug report.

The normal account experience lives at **`/auth`**. A temporary diagnostic screen at **`/dev/auth-test`** is available in local development builds only; it is not part of the public production interface.

## First account and signup

1. On an empty development database, sign up with a test agent name and four-digit PIN.
2. If using an email, complete the six-digit verification within ten minutes. In staging, first ensure the `develop` Preview has its own `OTP_MAILER_URL` and `OTP_MAILER_SECRET`, and verify the message arrives in a controlled test inbox. The on-screen progress ring should follow typed digits; success animation should begin **only** after the Worker verifies the challenge.
3. Check that the first completed account receives the administrator role and later accounts receive the regular agent role.
4. If you sign up without email, confirm that the UI explains PIN recovery is unavailable.
5. Sign out, then sign in with the new account using its agent name. If it has a verified email, sign out again and use that email (including uppercase letters) with the **same PIN**. The session should persist through a normal page refresh.
6. Verify the form's single name/email field stays readable and accepts long email addresses on narrow screens. An account without a verified email must still sign in by name but not by email. A wrong PIN must fail for both forms, with a generic error and without exposing which identifier is registered.

**Do not expose an empty production database before the intended administrator has registered.** OTP mail delivery configured in staging does not imply that it is configured in Production. Never paste the signing secret or a real OTP into a bug report.

## Recovery and account settings

1. Add or change a recovery email, and verify the change only takes effect after entering its OTP.
2. Request PIN recovery using a verified email. Complete the challenge and sign back in with the new PIN.
3. Confirm the old PIN is rejected and previously active sessions have been revoked.
4. Change your PIN while signed in. The current session should stay active; other sessions should end.
5. Try incorrect codes. An OTP should stop working after five failed attempts or expiry.
6. Check login and send-code throttling. Alternate incorrect PIN guesses between name and verified email for the same account: both must count against **one** per-account limit. Repeated attempts must return rate-limit errors rather than allow unlimited guessing.

## Browser and security checks

- HTTPS session cookies must be HttpOnly, Secure, and SameSite=Strict.
- Mutating API routes should reject a mismatched Origin header.
- Failed login messages should not reveal whether a name or email address is registered, verified, or disabled.
- Private responses must not be exposed to guests or another user.
- Shared response text and creator names are intentionally public and should contain test-safe text only.
- The recovery-start response must not reveal whether an email is registered.

## What this cannot establish

A successful smoke test is not a penetration test. The four-digit PIN remains low-entropy, and real production use also needs independent infrastructure, logs, dependency checks, secret history review, backups, abuse protection, and ongoing monitoring.

For the OTP sender itself, see [Gmail setup](gmail-otp-setup.md).
