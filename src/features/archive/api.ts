import type { Agent, ArchiveResponse, Visibility } from './model';

interface SharedRow {
  response_id: string;
  shortcut_name: string;
  body: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}
interface PrivateRow {
  response_id: string;
  shortcut_name: string;
  body: string;
  visibility: 'private';
  created_at: string;
  updated_at: string;
}
export interface TeamAgent {
  id: string;
  agent_name: string;
  role: 'admin' | 'agent';
  joined_at: string;
  shared_count: number;
  private_count: number;
}
export class ApiProblem extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const reply = await fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await reply.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new ApiProblem(reply.status, 'The server returned an unreadable response.'); }
  if (!reply.ok) {
    const problem = data as { message?: string; error?: string };
    throw new ApiProblem(reply.status, problem.message || problem.error || `Request failed (${reply.status})`);
  }
  return data as T;
}
export async function session(): Promise<Agent | null> {
  const result = await api<{ user: Agent | null }>('/api/auth/me');
  return result.user;
}
export async function fetchFeed(visibility: Visibility, signal?: AbortSignal): Promise<ArchiveResponse[]> {
  const data = await api<{ responses: (SharedRow | PrivateRow)[] }>(
    `/api/responses?scope=${visibility}`, { signal },
  );
  return data.responses.map(row => ({
    id: row.response_id,
    shortcut: row.shortcut_name,
    body: row.body,
    visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(visibility === 'shared'
      ? { createdBy: (row as SharedRow).created_by_name }
      : {}),
  }));
}
export function addResponse(visibility: Visibility, shortcut: string, body: string): Promise<{ response: unknown }> {
  return api('/api/responses', {
    method: 'POST', body: JSON.stringify({ visibility, shortcut, body }),
  });
}
export function updateResponse(id: string, body: string): Promise<{ response: unknown }> {
  return api(`/api/responses/${id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
}
export function deleteResponse(id: string): Promise<{ deleted: true }> {
  return api(`/api/responses/${id}`, { method: 'DELETE' });
}
export async function login(agentName: string, pin: string): Promise<Agent> {
  const data = await api<{ user: Agent }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ agentName, pin }),
  });
  return data.user;
}
export function logout(): Promise<{ signedOut: boolean }> {
  return api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
}
export async function getTeam(): Promise<TeamAgent[]> {
  const data = await api<{ users: TeamAgent[] }>('/api/admin/users');
  return data.users;
}
