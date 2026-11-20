import { database, queryTable, callRpc, type Env, DatabaseError } from '../services/db.ts';
import { getSession, requireRateLimit } from '../auth/session.ts';
import { json, fail, shortcutInput, bodyInput, visibilityInput, readJson, canDeleteResponse, canEditResponse } from './shared.ts';

interface CanonicalResponse {
  id: string;
  shortcut_id: string;
  visibility: 'shared' | 'private';
  owner_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}
interface Shortcut { id: string; name: string }
interface SharedResponse { response_id: string; shortcut_name: string; body: string; created_by_name: string; created_at: string; updated_at: string }

async function getAllForExport<T>(env: Env, table: string, base: Record<string, string>): Promise<T[]> {
  const pageSize = 500;
  const maximum = 10_000;
  const all: T[] = [];
  for (let offset = 0; offset <= maximum; offset += pageSize) {
    const page = await queryTable<T>(env, table, {
      ...base, limit: String(pageSize), offset: String(offset),
    });
    all.push(...page);
    if (all.length > maximum) return fail(413, 'export_too_large', 'Export in smaller batches');
    if (page.length < pageSize) break;
  }
  return all;
}

async function shortcutFor(env: Env, name: string, visibility: 'shared' | 'private', agentId: string): Promise<string> {
  const key = name.toLowerCase();
  const selection = () => queryTable<Shortcut>(env, 'shortcuts', {
    select: 'id,name', visibility: `eq.${visibility}`, name_key: `eq.${key}`,
    ...(visibility === 'private' ? { owner_id: `eq.${agentId}` } : {}), limit: '1',
  });
  const existing = (await selection())[0];
  if (existing) return existing.id;
  try {
    const created = await database<Shortcut[]>(env, 'shortcuts', {
      method: 'POST', body: { name, visibility, owner_id: agentId },
    });
    if (created[0]) return created[0].id;
  } catch (error) {
    // Another agent might have created this shared shortcut just now.
    if (!(error instanceof DatabaseError && error.code === '23505')) throw error;
  }
  const result = (await selection())[0];
  if (!result) throw new Error('Shortcut creation race was not resolved');
  return result.id;
}

async function addResponse(env: Env, agentId: string, rawShortcut: unknown, rawBody: unknown, rawVisibility: unknown): Promise<CanonicalResponse> {
  const shortcut = shortcutInput(rawShortcut);
  const body = bodyInput(rawBody);
  const visibility = visibilityInput(rawVisibility);
  const shortcutId = await shortcutFor(env, shortcut, visibility, agentId);
  const saved = await database<CanonicalResponse[]>(env, 'canned_responses', {
    method: 'POST', body: { shortcut_id: shortcutId, visibility, owner_id: agentId, body },
  });
  if (!saved[0]) throw new Error('Save returned no response');
  return saved[0];
}

export async function handleResponses(request: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(request.url);
  const signed = await getSession(env, request);

  if (path === '/api/responses' && request.method === 'GET') {
    const scope = url.searchParams.get('scope') ?? 'shared';
    if (!['shared', 'private', 'all'].includes(scope)) return fail(400, 'invalid_scope', 'Unknown response scope');
    const shared = (scope === 'shared' || scope === 'all')
      ? await queryTable<SharedResponse>(env, 'shared_response_feed', {
        select: 'response_id,shortcut_name,body,created_by_name,created_at,updated_at',
        order: 'created_at.desc', limit: '1000',
      }) : [];
    // Return a viewer-specific ownership flag for action buttons. Never expose private rows.
    // Use immutable agent IDs, not creator display names (which users may later change).
    const ownedShared = new Set<string>();
    if (signed && shared.length) {
      const mine = await queryTable<{ id: string }>(env, 'canned_responses', {
        select: 'id', id: `in.(${shared.map(row => row.response_id).join(',')})`,
        visibility: 'eq.shared', owner_id: `eq.${signed.agent.id}`, limit: '1000',
      });
      mine.forEach(row => ownedShared.add(row.id));
    }
    const withOwnership = shared.map(row => ({
      ...row, owned_by_viewer: ownedShared.has(row.response_id),
    }));
    if (scope === 'shared') return json({ responses: withOwnership });
    if (!signed) return fail(401, 'login_required', 'Sign in to view private responses');
    const privateRows = await queryTable<CanonicalResponse>(env, 'canned_responses', {
      select: 'id,shortcut_id,visibility,owner_id,body,created_at,updated_at',
      visibility: 'eq.private', owner_id: `eq.${signed.agent.id}`,
      order: 'created_at.desc', limit: '1000',
    });
    const ids = [...new Set(privateRows.map((r) => r.shortcut_id))];
    const shortcutRows = ids.length ? await queryTable<Shortcut>(env, 'shortcuts', {
      select: 'id,name', id: `in.(${ids.join(',')})`, visibility: 'eq.private', owner_id: `eq.${signed.agent.id}`,
    }) : [];
    const names = new Map(shortcutRows.map((item) => [item.id, item.name]));
    const ownPrivate = privateRows.map((r) => ({
      response_id: r.id, shortcut_name: names.get(r.shortcut_id) ?? '', body: r.body,
      created_at: r.created_at, updated_at: r.updated_at, visibility: 'private',
      owned_by_viewer: true,
    }));
    return json({ responses: scope === 'private' ? ownPrivate : [...withOwnership, ...ownPrivate] });
  }

  if (path === '/api/responses' && request.method === 'POST') {
    if (!signed) return fail(401, 'login_required', 'Sign in to add a response');
    if (!await requireRateLimit(env, `create:${signed.agent.id}`, 100, 3600)) {
      return fail(429, 'rate_limited', 'Too many responses added. Try again later.');
    }
    const data = await readJson(request);
    const response = await addResponse(env, signed.agent.id, data.shortcut, data.body, data.visibility);
    return json({ response }, 201);
  }

  const match = /^\/api\/responses\/([0-9a-f-]{36})$/.exec(path);
  if (match && (request.method === 'PATCH' || request.method === 'DELETE')) {
    if (!signed) return fail(401, 'login_required', 'Sign in to manage responses');
    const id = match[1]!;
    const found = await queryTable<CanonicalResponse>(env, 'canned_responses', {
      select: 'id,shortcut_id,visibility,owner_id,body,created_at,updated_at', id: `eq.${id}`, limit: '1',
    });
    const item = found[0];
    if (!item) return fail(404, 'not_found', 'Response not found');
    if (request.method === 'DELETE') {
      if (!canDeleteResponse(signed.agent.role, signed.agent.id, item)) {
        return fail(403, 'forbidden', 'You cannot delete this response');
      }
      await database(env, 'canned_responses', { method: 'DELETE', query: { id: `eq.${id}` } });
      return json({ deleted: true });
    }
    if (!canEditResponse(signed.agent.role, signed.agent.id, item)) {
      return fail(403, 'forbidden', 'You can only edit your own responses, except that admins can edit shared ones.');
    }
    const data = await readJson(request);
    // Validate all fields before any DB modifications. Renaming only this response's
    // shortcut means reassignment, NEVER updating the shortcut row (which is shared
    // by any number of other responses).
    const body = bodyInput(data.body);
    const requestedShortcut = data.shortcut === undefined ? undefined : shortcutInput(data.shortcut);
    let nextShortcutId = item.shortcut_id;
    if (requestedShortcut !== undefined) {
      const previous = (await queryTable<Shortcut>(env, 'shortcuts', {
        select: 'id,name', id: `eq.${item.shortcut_id}`, limit: '1',
      }))[0];
      if (!previous) return fail(409, 'shortcut_missing', 'The original shortcut was removed. Refresh the library.');
      if (previous.name.toLowerCase() !== requestedShortcut.toLowerCase()) {
        nextShortcutId = await shortcutFor(env, requestedShortcut, item.visibility, signed.agent.id);
      }
    }
    // Re-check scope and ownership in the update filter as defense in depth.
    const guardedQuery: Record<string, string> = {
      id: `eq.${id}`, visibility: `eq.${item.visibility}`,
    };
    if (!(signed.agent.role === 'admin' && item.visibility === 'shared')) {
      guardedQuery.owner_id = `eq.${signed.agent.id}`;
    }
    const updated = await database<CanonicalResponse[]>(env, 'canned_responses', {
      method: 'PATCH', query: guardedQuery,
      body: { body, shortcut_id: nextShortcutId },
    });
    if (!updated[0]) return fail(409, 'response_changed', 'The response changed before saving. Refresh and try again.');
    return json({ response: updated[0] });
  }

  if (path === '/api/responses/export' && request.method === 'GET') {
    if (!signed) return fail(401, 'login_required', 'Sign in to export');
    const scope = url.searchParams.get('scope') ?? 'private';
    if (scope !== 'shared' && scope !== 'private') return fail(400, 'invalid_scope', 'Invalid export scope');
    if (scope === 'shared' && signed.agent.role !== 'admin') {
      return fail(403, 'forbidden', 'Only the administrator may export shared responses');
    }
    let exportRows: Array<Record<string, string>>;
    if (scope === 'shared') {
      const result = await getAllForExport<SharedResponse>(env, 'shared_response_feed', {
        select: 'response_id,shortcut_name,body,created_by_name,created_at,updated_at', order: 'response_id.asc',
      });
      exportRows = result.map((r) => ({ shortcut: r.shortcut_name, body: r.body }));
    } else {
      const privateRows = await getAllForExport<CanonicalResponse>(env, 'canned_responses', {
        select: 'id,shortcut_id,visibility,owner_id,body,created_at,updated_at',
        visibility: 'eq.private', owner_id: `eq.${signed.agent.id}`, order: 'id.asc',
      });
      const shortcuts = await getAllForExport<Shortcut>(env, 'shortcuts', {
        select: 'id,name', owner_id: `eq.${signed.agent.id}`, visibility: 'eq.private', order: 'id.asc',
      });
      const names = new Map(shortcuts.map((item) => [item.id, item.name]));
      exportRows = privateRows.map((r) => ({ shortcut: names.get(r.shortcut_id) ?? '', body: r.body }));
    }
    const jsonText = JSON.stringify({ version: 1, visibility: scope, responses: exportRows }, null, 2);
    return new Response(jsonText, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="canned-responses-${scope}.json"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (path === '/api/responses/import' && request.method === 'POST') {
    if (!signed) return fail(401, 'login_required', 'Sign in to import');
    const data = await readJson(request);
    const scope = visibilityInput(data.visibility);
    if (scope === 'shared' && signed.agent.role !== 'admin') {
      return fail(403, 'forbidden', 'Only the administrator may import shared responses');
    }
    if (!Array.isArray(data.responses) || data.responses.length > 50 || data.responses.length === 0) {
      return fail(400, 'invalid_import', 'Provide between 1 and 50 responses per import');
    }
    const validated = data.responses.map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(400, 'invalid_import', 'Invalid response entry');
      const entry = value as Record<string, unknown>;
      return { shortcut: shortcutInput(entry.shortcut), body: bodyInput(entry.body) };
    });
    if (!await requireRateLimit(env, `import:${signed.agent.id}`, 10, 3600)) {
      return fail(429, 'rate_limited', 'Too many imports. Try again later.');
    }
    // V1 import is sequential and is NOT atomic. UI must preview and disclose this.
    let imported = 0;
    for (const entry of validated) {
      await addResponse(env, signed.agent.id, entry.shortcut, entry.body, scope);
      imported += 1;
    }
    return json({ imported, visibility: scope }, 201);
  }

  if (path === '/api/admin/users' && request.method === 'GET') {
    if (!signed) return fail(401, 'login_required', 'Sign in to view user statistics');
    if (signed.agent.role !== 'admin') return fail(403, 'forbidden', 'Administrator access required');
    const data = await callRpc<Array<{
      id: string; agent_name: string; role: string; joined_at: string; shared_count: number; private_count: number;
    }>>(env, 'admin_agent_stats');
    return json({ users: data });
  }
  return fail(404, 'not_found', 'Route not found');
}
