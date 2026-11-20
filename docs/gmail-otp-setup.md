# Free Gmail OTP sender — setup guide

Email OTP code is implemented in the Worker and in
[`scripts/apps-script/Code.gs`](../scripts/apps-script/Code.gs).
This setup **requires your Google account authorization**. The GitHub connection
cannot access your Gmail or authorize a Google Apps Script web app.

## What it does

- Agent enters any valid email address.
- The Worker creates a one-time six-digit code valid for 10 minutes.
- It stores only a keyed code digest in Supabase, never the plaintext code.
- It signs a request to the Google Apps Script mail relay using a separate secret.
- The Apps Script checks the signature, timestamp and nonce before sending via Gmail.
- Code verification and any account change occur atomically in Supabase.
- Incorrect attempts are capped at five per challenge, with additional server-side limits.

Never send the mailbox password to ChatGPT, GitHub, Cloudflare, or Supabase.
Google Apps Script authorizes through your own signed-in Google session.

## One-time Google setup

1. Visit [script.google.com](https://script.google.com/) using the Gmail account that will **send** OTPs.
2. Create a standalone Apps Script project named **Canned Archive OTP Sender**.
3. Replace `Code.gs` with the contents of [`scripts/apps-script/Code.gs`](../scripts/apps-script/Code.gs).
4. Under **Project Settings → Script Properties**, add:
   `OTP_MAILER_SECRET` with a generated, random 32+ character string.
5. In Apps Script, run `authorizeMailService` once from the editor and grant Google's requested permissions.
6. Use **Deploy → New deployment → Web app**. Choose **Execute as: Me** and **Who has access: Anyone**.
7. Copy the generated `https://script.google.com/macros/s/.../exec` URL **privately**.
8. Set `OTP_MAILER_URL` to that URL and `OTP_MAILER_SECRET` to the **same secret**
   as Cloudflare Worker encrypted secrets (for development, use a local-only `.dev.vars`).
9. Do **not** commit those values or paste them in chat.
10. Run a staged end-to-end test to your own email before sharing signup with teammates.

### Security

The Apps Script Web App endpoint is publicly reachable, **but requests without the
matching HMAC signature are rejected**. The Worker keeps the secret server-side. The
script rejects stale and replayed requests. Rate limits and PIN/OTP validation
are enforced on the Worker and in Supabase.

Gmail sending is quota-limited. Apps Script personal accounts currently have
a published quota of 100 email recipients/day, but Google can revise limits.
Use `MailApp.getRemainingDailyQuota()` to inspect the remainder.

### Recovery behavior

- No email supplied at signup: account created immediately; no self-service PIN recovery.
- Email supplied at signup: a pending signup is created, and the account is created
  **only after successful verification**.
- Email updated in settings: the new email becomes active only after verifying its OTP.
- Forgotten PIN: request OTP to existing verified email, enter OTP + new PIN;
  all existing sessions are revoked, and the agent signs in again.
- The first completed signup (email or no email) is admin. This is atomic in the database.

### Official documentation

- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/reference/mail/mail-app
- https://developers.google.com/apps-script/guides/properties
- https://developers.google.com/apps-script/guides/services/quotas
