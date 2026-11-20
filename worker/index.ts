import { configured, DatabaseError, type Env } from './services/db.ts';
import { ApiError, json } from './api/shared.ts';
import { handleAuth } from './api/auth.ts';
import { handleResponses } from './api/responses.ts';

/** Cloudflare API Worker. Secrets never leave this module and its server-side dependencies. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'GET' && path === '/api/health') {
      return json({ status: 'ok', service: 'canned-response-archive', phase: 'backend-auth', databaseConfigured: configured(env) });
    }
    if (!path.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    if (!configured(env)) return json({ error: 'Backend configuration is missing' }, 503);
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
      return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST, PATCH, DELETE' });
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      const origin = request.headers.get('Origin');
      if (!origin || origin !== url.origin) return json({ error: 'Invalid request origin' }, 403);
    }
    try {
      if (path.startsWith('/api/auth/') || path.startsWith('/api/account/')) {
        return await handleAuth(request, env, path);
      }
      if (path.startsWith('/api/responses') || path === '/api/admin/users') {
        return await handleResponses(request, env, path);
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.code, message: error.message }, error.status);
      if (error instanceof DatabaseError) {
        if (error.code === '23505') return json({ error: 'already_exists', message: 'An account or shortcut with this name already exists' }, 409);
        if (error.code === '23514' || error.code === '23503' || error.code === '22023') {
          return json({ error: 'invalid_request', message: 'Request violates a data rule' }, 400);
        }
      }
      console.error('Backend request failed', error instanceof DatabaseError ? { status: error.status, code: error.code } : 'Unexpected failure');
      return json({ error: 'server_error', message: 'Request could not be completed' }, 500);
    }
  },
} satisfies { fetch: (request: Request, env: Env) => Promise<Response> };
