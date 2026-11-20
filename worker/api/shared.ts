export function json(value: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(headers ?? {}) },
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
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) {
    fail(415, 'json_required', 'Send JSON data');
  }
  if (Number(request.headers.get('Content-Length') ?? '0') > 250_000) fail(413, 'too_large', 'Request is too large');
  const text = await request.text();
  if (text.length > 250_000) fail(413, 'too_large', 'Request is too large');
  try {
    const data: unknown = JSON.parse(text);
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
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(normalized)) {
    return fail(400, 'invalid_shortcut', 'Use 1–64 letters, numbers, underscores or hyphens');
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
