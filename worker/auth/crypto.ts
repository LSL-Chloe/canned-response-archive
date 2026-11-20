const encoder = new TextEncoder();
const ITERATIONS = 310_000;

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
export async function hashPin(pin: string, pepper: string): Promise<string> {
  if (!/^\d{4}$/.test(pin) || pepper.length < 32) throw new Error('Invalid PIN or server secret');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const input = await crypto.subtle.importKey('raw', encoder.encode(await hmac(pin, pepper)), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, input, 256);
  return `pbkdf2-sha256$${ITERATIONS}$${hex(salt)}$${hex(new Uint8Array(derived))}`;
}
export async function verifyPin(pin: string, stored: string, pepper: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false;
  const [algo, rawRounds, saltHex, hashHex] = stored.split('$');
  if (algo !== 'pbkdf2-sha256' || !rawRounds || !saltHex || !hashHex) return false;
  const rounds = Number(rawRounds);
  if (!Number.isInteger(rounds) || rounds < 100_000 || rounds > 1_000_000) return false;
  try {
    const input = await crypto.subtle.importKey('raw', encoder.encode(await hmac(pin, pepper)), 'PBKDF2', false, ['deriveBits']);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unhex(saltHex), iterations: rounds, hash: 'SHA-256' }, input, 256));
    const expected = unhex(hashHex);
    if (derived.length !== expected.length) return false;
    let differences = 0;
    for (let i = 0; i < derived.length; i += 1) differences |= derived[i]! ^ expected[i]!;
    return differences === 0;
  } catch { return false; }
}
