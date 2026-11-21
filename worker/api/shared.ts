export function json(value: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...(headers ?? {}) },
  });
}
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}
/**
 * Enforce byte limits while reading streams, not after a potentially unbounded
 * request or upstream image has already consumed Worker memory.
 */
export async function readLimitedBytes(stream: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel().catch(() => {});
        return fail(413, 'too_large', 'Request or image is too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) {
    fail(415, 'json_required', 'Send JSON data');
  }
  const maxBytes = 250_000;
  if (Number(request.headers.get('Content-Length') ?? '0') > maxBytes) fail(413, 'too_large', 'Request is too large');
  const bytes = await readLimitedBytes(request.body, maxBytes);
  try {
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid JSON object');
    return data as Record<string, unknown>;
  } catch { return fail(400, 'bad_json', 'Invalid JSON object'); }
}

export function nameInput(input: unknown): string {
  if (typeof input !== 'string' || input.trim() !== input || input.length < 2 || input.length > 48) {
    return fail(400, 'invalid_agent_name', 'Agent name must be between 2 and 48 characters');
  }
  return input;
}
export function pinInput(input: unknown): string {
  if (typeof input !== 'string' || !/^\d{4}$/.test(input)) {
    return fail(400, 'invalid_pin', 'PIN must be exactly four digits');
  }
  return input;
}
export function shortcutInput(input: unknown): string {
  if (typeof input !== 'string') return fail(400, 'invalid_shortcut', 'Invalid shortcut');
  const normalized = input.trim().replace(/^#/, '');
  if (!/^[A-Za-z0-9_][A-Za-z0-9_ -]{0,63}$/.test(normalized)) {
    return fail(400, 'invalid_shortcut', 'Use 1–64 letters, numbers, underscores, hyphens or spaces');
  }
  return normalized;
}
export function bodyInput(input: unknown): string {
  if (typeof input !== 'string' || !input.trim() || input.length > 10_000) {
    return fail(400, 'invalid_response', 'Response must be 1–10,000 characters');
  }
  return input;
}
export function visibilityInput(input: unknown): 'shared' | 'private' {
  if (input !== 'shared' && input !== 'private') fail(400, 'invalid_visibility', 'Choose Shared or Private');
  return input;
}
export function canDeleteResponse(role: 'agent' | 'admin', actorId: string, response: { visibility: string; owner_id: string }): boolean {
  return (response.visibility === 'shared' && role === 'admin') || response.owner_id === actorId;
}
export function canEditResponse(role: 'agent' | 'admin', actorId: string, response: { visibility: string; owner_id: string }): boolean {
  return response.visibility === 'shared'
    ? role === 'admin' || response.owner_id === actorId
    : response.owner_id === actorId;
}
