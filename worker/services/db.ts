/** All access to protected tables occurs inside the Worker with a server-only key. */
export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  PIN_PEPPER?: string;
}

export class DatabaseError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message = 'Database request failed') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function configured(env: Env): boolean {
  return !!(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.PIN_PEPPER && env.PIN_PEPPER.length >= 32);
}

export async function database<T>(
  env: Env,
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; query?: Record<string, string>; single?: boolean } = {},
): Promise<T> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new Error('Database not configured');
  const url = new URL(`/rest/v1/${path}`, env.SUPABASE_URL);
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  const headers = new Headers({
    apikey: env.SUPABASE_SECRET_KEY,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  // Legacy JWT service keys need Authorization. New sb_secret keys must be sent as apikey.
  if (env.SUPABASE_SECRET_KEY.startsWith('eyJ')) {
    headers.set('Authorization', `Bearer ${env.SUPABASE_SECRET_KEY}`);
  }
  if (options.single) headers.set('Accept', 'application/vnd.pgrst.object+json');
  if (options.method === 'POST' || options.method === 'PATCH') {
    headers.set('Prefer', 'return=representation');
  }
  const reply = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });
  if (!reply.ok) {
    let code = 'unknown';
    try {
      const error = (await reply.json()) as { code?: string };
      code = error.code ?? code;
    } catch { /* keep public errors generic */ }
    throw new DatabaseError(reply.status, code);
  }
  if (reply.status === 204) return null as T;
  return (await reply.json()) as T;
}

export function queryTable<T>(env: Env, table: string, query: Record<string, string>): Promise<T[]> {
  return database<T[]>(env, table, { query });
}

export function callRpc<T>(env: Env, fn: string, input: Record<string, unknown> = {}): Promise<T> {
  return database<T>(env, `rpc/${fn}`, { method: 'POST', body: input });
}
