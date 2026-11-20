import { callRpc, database, queryTable, type Env } from '../services/db.ts';
import { hmac, randomToken, sha256 } from './crypto.ts';

export interface Agent {
  id: string;
  agent_name: string;
  role: 'admin' | 'agent';
}
interface SessionRow { id: string; agent_id: string; expires_at: string; revoked_at: string | null; }
export interface SignedIn { agent: Agent; session: SessionRow }

export const COOKIE = '__Host-archive_session';
const SESSION_DURATION_DAYS = 7;

function cookieName(url: URL): string {
  return url.protocol === 'https:' ? COOKIE : 'archive_session_dev';
}
export function cookieHeader(request: Request, token: string, maxAge = SESSION_DURATION_DAYS * 86400): string {
  const url = new URL(request.url);
  return `${cookieName(url)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${url.protocol === 'https:' ? '; Secure' : ''}`;
}
function cookieValue(request: Request): string | null {
  const name = cookieName(new URL(request.url));
  const part = (request.headers.get('Cookie') ?? '').split(';').map((x) => x.trim()).find((x) => x.startsWith(`${name}=`));
  const value = part?.slice(name.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function createSession(env: Env, agentId: string, request: Request): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 86400_000).toISOString();
  await database(env, 'agent_sessions', {
    method: 'POST',
    body: { agent_id: agentId, token_hash: await sha256(token), expires_at: expiresAt },
  });
  return cookieHeader(request, token);
}
export async function getSession(env: Env, request: Request): Promise<SignedIn | null> {
  const token = cookieValue(request);
  if (!token) return null;
  const rows = await queryTable<SessionRow>(env, 'agent_sessions', {
    select: 'id,agent_id,expires_at,revoked_at', token_hash: `eq.${await sha256(token)}`,
    expires_at: `gt.${new Date().toISOString()}`, revoked_at: 'is.null', limit: '1',
  });
  const session = rows[0];
  if (!session) return null;
  const users = await queryTable<Agent & { disabled_at: string | null }>(env, 'agents', {
    select: 'id,agent_name,role,disabled_at', id: `eq.${session.agent_id}`, limit: '1',
  });
  const agent = users[0];
  if (!agent || agent.disabled_at) return null;
  return { session, agent };
}
export async function revokeSession(env: Env, sessionId: string): Promise<void> {
  await database(env, 'agent_sessions', {
    method: 'PATCH', query: { id: `eq.${sessionId}` }, body: { revoked_at: new Date().toISOString() },
  });
}
export async function requireRateLimit(env: Env, name: string, limit: number, seconds: number): Promise<boolean> {
  const key = await hmac(name, env.PIN_PEPPER!);
  return callRpc<boolean>(env, 'use_rate_limit', { p_key_hash: key, p_limit: limit, p_window_seconds: seconds });
}
export function ipOf(request: Request): string {
  // Cloudflare overwrites this header on deployed Workers; local fallback is intentionally global.
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}
