import { database, queryTable, callRpc, type Env, DatabaseError } from '../services/db.ts';
import { getSession, requireRateLimit } from '../auth/session.ts';
import { json, fail, shortcutInput, bodyInput, visibilityInput, readJson, canDeleteResponse, canEditResponse, bulkDeleteIds } from './shared.ts';

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

interface TeamDirectoryRow {
  id: string;
  agent_name: string;
  role: 'agent' | 'admin';
  joined_at: string;
  shared_count: number;
  private_count: number;
  avatar_url: string | null;
}

/** Only public-facing profile metadata and counts. Never return credentials,
 * email addresses, PIN hashes, sessions, or the text of private responses. */
async function teamDirectory(env: Env): Promise<TeamDirectoryRow[]> {
  const stats = await callRpc<Omit<TeamDirectoryRow, 'avatar_url'>[]>(env, 'admin_agent_stats');
  // Batch the profile image lookup: no per-agent queries, and an avatar that
  // has just changed always comes from the live agents table on refresh.
  const pictures = await queryTable<{ id: string; avatar_url: string | null }>(env, 'agents', {
    select: 'id,avatar_url', limit: '1000',
  });
  const byId = new Map(pictures.map(profile => [profile.id, profile.avatar_url]));
  return stats.map(agent => ({
    ...agent,
    avatar_url: byId.get(agent.id) ?? null,
  }));
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
      // Query the viewer's own shared IDs directly. Sending hundreds of
      // response IDs in one GET query string exceeds proxy URL limits on
      // larger libraries and makes the By me tab disappear unexpectedly.
      const mine = await queryTable<{ id: string }>(env, 'canned_responses', {
        select: 'id', visibility: 'eq.shared', owner_id: `eq.${signed.agent.id}`,
        order: 'created_at.desc', limit: '1000',
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

  if (path === '/api/responses/bulk-delete' && request.method === 'POST') {
    if (!signed) return fail(401, 'login_required', 'Sign in to delete responses');
    const data = await readJson(request);
    const ids = bulkDeleteIds(data.ids);
    if (!await requireRateLimit(env, `bulk-delete:${signed.agent.id}`, 15, 900)) {
      return fail(429, 'rate_limited', 'Too many deletion batches. Try again later.');
    }
    try {
      const result = await callRpc<{ deleted: number }>(env, 'delete_archive_responses_batch', {
        p_actor_id: signed.agent.id,
        p_ids: ids,
      });
      return json(result);
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '42501') {
        return fail(403, 'forbidden', 'You can delete only your responses, except admins can manage shared ones');
      }
      if (error instanceof DatabaseError && error.code === 'P0002') {
        return fail(409, 'selection_changed', 'One of the selected responses changed or was removed. Refresh and try again.');
      }
      throw error;
    }
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
    // One transaction updates text, shortcut and visibility. The SQL RPC locks
    // the canonical row and checks ownership again, including the original
    // owner's private shortcut when admins move somebody's shared reply.
    const body = bodyInput(data.body);
    const shortcut = shortcutInput(data.shortcut);
    const visibility = visibilityInput(data.visibility ?? item.visibility);
    try {
      const updated = await callRpc<{ id: string; visibility: 'shared' | 'private' }>(env, 'update_archive_response', {
        p_actor_id: signed.agent.id,
        p_response_id: id,
        p_body: body,
        p_shortcut: shortcut,
        p_visibility: visibility,
      });
      return json({ response: updated });
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '42501') {
        return fail(403, 'forbidden', 'You cannot change another user private reply');
      }
      if (error instanceof DatabaseError && error.code === 'P0002') {
        return fail(409, 'response_changed', 'Response or shortcut changed. Refresh the library and try again.');
      }
      throw error;
    }
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
    // One Postgres transaction per batch. Retries skip exact shortcut/body pairs
    // already present, including responses saved by older partial imports.
    const result = await callRpc<{ imported: number; skipped: number }>(env, 'import_responses_batch', {
      p_agent_id: signed.agent.id,
      p_visibility: scope,
      p_responses: validated,
    });
    return json({ imported: result.imported, skipped: result.skipped, visibility: scope }, 201);
  }

  if (path.startsWith('/api/admin/users/') && request.method === 'DELETE') {
    if (!signed) return fail(401, 'login_required', 'Sign in to manage agents');
    if (signed.agent.role !== 'admin') return fail(403, 'forbidden', 'Administrator access required');
    const id = path.slice('/api/admin/users/'.length);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return fail(400, 'invalid_agent', 'Choose a valid agent');
    }
    if (id.toLowerCase() === signed.agent.id.toLowerCase()) {
      return fail(403, 'self_delete_forbidden', 'You cannot delete your own administrator account');
    }
    const body = await readJson(request);
    if (typeof body.confirmName !== 'string' || body.confirmName.length < 2 || body.confirmName.length > 48) {
      return fail(400, 'confirmation_required', 'Type the agent name to confirm deletion');
    }
    if (!await requireRateLimit(env, `admin:delete:${signed.agent.id}`, 10, 3600)) {
      return fail(429, 'rate_limited', 'Too many account deletions. Try again later.');
    }
    try {
      // This is a single SQL transaction, including all owned responses,
      // related shortcuts, and revocation of the deleted account's sessions.
      const result = await callRpc<{ deleted: true; deleted_responses: number; preserved_shared_shortcuts: number }>(
        env, 'admin_delete_agent', {
          p_actor_id: signed.agent.id, p_target_id: id, p_confirm_agent_name: body.confirmName,
        },
      );
      let avatarCleanupFailed = false;
      // Avatar uploads use a predictable per-agent Storage path. Try clearing it
      // after account deletion even when the agent later chose a catalog avatar
      // or reset their picture: otherwise the old JPEG would be orphaned.
      // Missing objects are harmless. Never delete Storage metadata through SQL.
      try {
        const avatarEndpoint = new URL('/storage/v1/object/archive-avatars', env.SUPABASE_URL);
        const headers = new Headers({
          apikey: env.SUPABASE_SECRET_KEY!, 'Content-Type': 'application/json',
        });
        if (env.SUPABASE_SECRET_KEY!.startsWith('eyJ')) {
          headers.set('Authorization', 'Bearer ' + env.SUPABASE_SECRET_KEY);
        }
        const removed = await fetch(avatarEndpoint, {
          method: 'DELETE', headers, body: JSON.stringify({ prefixes: [id + '/avatar.jpg'] }),
        });
        avatarCleanupFailed = !removed.ok && removed.status !== 404;
      } catch {
        avatarCleanupFailed = true;
      }
      if (avatarCleanupFailed) console.warn('Deleted account avatar cleanup was unsuccessful');
      return json({ ...result, avatarCleanupFailed });
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '42501') {
        return fail(403, 'forbidden', 'This administrator cannot delete that account');
      }
      if (error instanceof DatabaseError && error.code === 'P0002') {
        return fail(404, 'not_found', 'Agent no longer exists');
      }
      if (error instanceof DatabaseError && error.code === '22023') {
        return fail(409, 'confirmation_mismatch', 'Agent name has changed. Refresh and confirm again.');
      }
      throw error;
    }
  }

  if (path === '/api/team' && request.method === 'GET') {
    // Team overview is a read-only directory, including for guests.
    // The separate admin route below remains restricted.
    const client = request.headers.get('CF-Connecting-IP') || signed?.agent.id || 'guest';
    if (!await requireRateLimit(env, `team:view:${client.slice(0, 72)}`, 120, 3600)) {
      return fail(429, 'rate_limited', 'Too many directory requests');
    }
    return json({ users: await teamDirectory(env) });
  }

  if (path === '/api/admin/users' && request.method === 'GET') {
    if (!signed) return fail(401, 'login_required', 'Sign in to view user statistics');
    if (signed.agent.role !== 'admin') return fail(403, 'forbidden', 'Administrator access required');
    return json({ users: await teamDirectory(env) });
  }
  return fail(404, 'not_found', 'Route not found');
}
