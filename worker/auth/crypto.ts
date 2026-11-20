const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function unhex(value: string): Uint8Array {
  if (!/^(?:[a-f0-9]{2})+$/i.test(value)) throw new Error('Invalid hex');
  return new Uint8Array((value.match(/.{2}/g) ?? []).map((segment) => parseInt(segment, 16)));
}
export function randomToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}
export async function sha256(input: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input))));
}
export async function hmac(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(input))));
}
/**
 * A four-digit PIN has only 10,000 combinations. The verifier is intentionally
 * keyed with the Worker-only PIN_PEPPER and a random per-account salt.
 *
 * Do not use PBKDF2 here: workerd rejects >100,000 iterations, whereas Node
 * accepts them. Keeping the pepper secret and enforcing rate limits are
 * essential safeguards for this low-entropy authentication mechanism.
 */
export async function hashPin(pin: string, pepper: string): Promise<string> {
  if (!/^\d{4}$/.test(pin) || pepper.length < 32) throw new Error('Invalid PIN or server secret');
  const saltHex = hex(crypto.getRandomValues(new Uint8Array(16)));
  const macHex = await hmac(`archive:pin:v2:${saltHex}:${pin}`, pepper);
  return `hmac-sha256$${saltHex}$${macHex}`;
}
export async function verifyPin(pin: string, stored: string, pepper: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin) || pepper.length < 32 || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const [scheme, saltHex, macHex] = parts;
  if (scheme !== 'hmac-sha256' || !saltHex || !/^[a-f0-9]{32}$/.test(saltHex)
    || !macHex || !/^[a-f0-9]{64}$/.test(macHex)) return false;
  const actual = unhex(await hmac(`archive:pin:v2:${saltHex}:${pin}`, pepper));
  const expected = unhex(macHex);
  let differences = 0;
  for (let i = 0; i < expected.length; i += 1) differences |= actual[i]! ^ expected[i]!;
  return differences === 0;
}

/** Unbiased, cryptographically secure six-digit OTP, retaining leading zeros. */
export function newOtp(): string {
  const max = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  let n: number;
  do { n = crypto.getRandomValues(new Uint32Array(1))[0]!; } while (n >= max);
  return String(n % 1_000_000).padStart(6, '0');
}
export async function otpDigest(id: string, code: string, pepper: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{6}$/.test(code)) throw new Error('Invalid OTP input');
  return hmac(`archive:otp:v1:${id.toLowerCase()}:${code}`, pepper);
}
