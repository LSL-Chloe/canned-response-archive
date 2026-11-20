import { hmac, randomToken } from '../auth/crypto.ts';
import { ApiError } from '../api/shared.ts';
import type { Env } from './db.ts';

export type OtpPurpose = 'signup' | 'recover_pin' | 'add_email' | 'change_email';

export function mailConfigured(env: Env): boolean {
  return !!(env.OTP_MAILER_URL?.startsWith('https://script.google.com/macros/s/')
    && env.OTP_MAILER_SECRET && env.OTP_MAILER_SECRET.length >= 32);
}

/**
 * Google Apps Script receives a signed JSON-string payload.
 * The shared secret is used exclusively server-side; the browser never calls the script.
 */
export async function sendVerificationEmail(env: Env, to: string, code: string, purpose: OtpPurpose): Promise<void> {
  if (!mailConfigured(env)) {
    throw new ApiError(503, 'email_unavailable', 'Email verification is not configured yet');
  }
  const payload = JSON.stringify({ to, code, purpose, issuedAt: Date.now(), nonce: randomToken() });
  const signature = await hmac(payload, env.OTP_MAILER_SECRET!);
  let response: Response;
  try {
    response = await fetch(env.OTP_MAILER_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: JSON.stringify({ payload, signature }),
      redirect: 'follow',
    });
  } catch {
    throw new ApiError(503, 'email_unavailable', 'Unable to send verification email');
  }
  if (!response.ok) throw new ApiError(503, 'email_unavailable', 'Unable to send verification email');
  let result: unknown;
  try { result = await response.json(); }
  catch { throw new ApiError(503, 'email_unavailable', 'Email sender returned an invalid response'); }
  if (!result || typeof result !== 'object' || (result as { ok?: boolean }).ok !== true) {
    throw new ApiError(503, 'email_unavailable', 'Email sender could not deliver verification email');
  }
}
