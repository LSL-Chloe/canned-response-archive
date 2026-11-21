# Email verification with Gmail

Canned Response Archive can send one-time verification codes using a small Google Apps Script web app. This is optional for development, but required if you want email-backed signup, recovery emails, and forgotten-PIN recovery.

You authorize the mail sender from **your own Google account**. The Worker never needs your Gmail password.

## How a verification email is sent

The Worker creates a six-digit code, stores only a keyed digest with a ten-minute expiry, and sends a signed request to the Apps Script relay. The relay verifies the HMAC signature, timestamp, and request nonce before asking Gmail to send the message.

The Worker and Supabase handle code verification and any account update. The relay only delivers mail.

## Set up the sender

1. Open [Google Apps Script](https://script.google.com/) using the Google account you want to send emails from.
2. Create a standalone Apps Script project, for example **Archive OTP Sender**.
3. Replace its `Code.gs` contents with [the relay script in this repository](../scripts/apps-script/Code.gs).
4. In **Project settings → Script properties**, create `OTP_MAILER_SECRET` with a random value of at least 32 characters.
5. From the editor, run `authorizeMailService` and approve the Google permission prompt.
6. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. The public endpoint is safe only because unsigned or invalid requests are rejected.
7. Copy the `https://script.google.com/macros/s/.../exec` URL privately.
8. In Cloudflare Worker Secrets (or your ignored local `.dev.vars`), set:
   - `OTP_MAILER_URL` to that deployment URL
   - `OTP_MAILER_SECRET` to the *same* random secret used by Apps Script
9. Test a signup with your own inbox. Verify code delivery, expiry, incorrect-code behavior, and PIN recovery.

Do not put the relay URL and secret together in a public screenshot, issue, or commit. Don't share the Gmail account password or any OTP code.

## Limits and recovery

The Worker limits verification requests per target and IP address. Each challenge expires after ten minutes, and incorrect codes are capped at five attempts. The relay also rejects stale signatures and already-seen nonces, and Gmail applies its own sending quotas.

If signup has no email, an account is created immediately and **cannot use email PIN recovery**. If an email is supplied during signup, the account is only created after verification. Changing an email in Settings also requires verifying the new address. Successful PIN recovery invalidates previous sessions.

A Gmail relay is appropriate for a small personal project, not a high-volume transactional email service. Check Google's current sending quotas and review the sender's operating logs without logging message bodies or secrets.

## Useful references

- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)
- [Script properties](https://developers.google.com/apps-script/guides/properties)
- [Google services quotas](https://developers.google.com/apps-script/guides/services/quotas)

See [authentication QA](auth-qa.md) to test the full user flow.
