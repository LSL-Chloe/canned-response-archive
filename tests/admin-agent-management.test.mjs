import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { handleResponses } from '../worker/api/responses.ts';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MEMBER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const env = { SUPABASE_URL: 'https://testing.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_mock', PIN_PEPPER: '12345678901234567890123456789012' };
const authCookie = '__Host-archive_session=' + 'f'.repeat(64);
const reply = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});
function request(id, name, signed = true) {
  return new Request('https://test.example/api/admin/users/' + id, {
    method: 'DELETE',
    headers: {
      Origin: 'https://test.example',
      'Content-Type': 'application/json',
      ...(signed ? { Cookie: authCookie } : {}),
    },
    body: JSON.stringify({ confirmName: name }),
  });
}
async function mockedBackend(role, work) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const key = url.pathname.split('/').pop();
    if (key === 'agent_sessions') return reply([{
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      agent_id: ADMIN, expires_at: '2099-01-01T00:00:00Z', revoked_at: null,
    }]);
    if (key === 'agents') {
      if (url.searchParams.get('id') === 'eq.' + ADMIN) {
        return reply([{ id: ADMIN, role, agent_name: 'Admin', disabled_at: null }]);
      }
      return reply([{ avatar_url: null }]);
    }
    if (key === 'use_rate_limit') return reply(true);
    if (key === 'admin_delete_agent') {
      const body = JSON.parse(init.body);
      calls.push(body);
      if (body.p_confirm_agent_name === 'Wrong name') {
        return reply({ code: '22023' }, 400);
      }
      return reply({ deleted: true, deleted_responses: 3, preserved_shared_shortcuts: 1 });
    }
    throw new Error('Unexpected mock DB request ' + url.pathname);
  };
  try { return await work(calls); }
  finally { globalThis.fetch = original; }
}

test('admin-only deletion rejects anonymous agents and self deletion', async () => {
  await mockedBackend('admin', async calls => {
    assert.equal((await handleResponses(request(MEMBER, 'Member', false), env,
      '/api/admin/users/' + MEMBER)).status, 401);
    assert.equal((await handleResponses(request(ADMIN, 'Admin'), env,
      '/api/admin/users/' + ADMIN)).status, 403);
    assert.deepEqual(calls, []);
  });
  await mockedBackend('agent', async calls => {
    assert.equal((await handleResponses(request(MEMBER, 'Member'), env,
      '/api/admin/users/' + MEMBER)).status, 403);
    assert.deepEqual(calls, []);
  });
});

test('a verified admin can delete another agent; the SQL RPC rechecks role and confirmation', async () => {
  await mockedBackend('admin', async calls => {
    const res = await handleResponses(request(MEMBER, 'Member'), env, '/api/admin/users/' + MEMBER);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      deleted: true, deleted_responses: 3, preserved_shared_shortcuts: 1,
      avatarCleanupFailed: false,
    });
    assert.deepEqual(calls, [{
      p_actor_id: ADMIN, p_target_id: MEMBER, p_confirm_agent_name: 'Member',
    }]);
  });
});

test('stale or wrong name confirmation cannot delete an agent', async () => {
  await mockedBackend('admin', async calls => {
    const res = await handleResponses(request(MEMBER, 'Wrong name'), env, '/api/admin/users/' + MEMBER);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'confirmation_mismatch');
    assert.equal(calls.length, 1);
  });
});

test('agent deletion stays server-only, transactional, and guarded by a name prompt', () => {
  const sql = source('supabase/migrations/20261122043000_admin_delete_agent.sql');
  const server = source('worker/api/responses.ts');
  const app = source('src/features/archive/ArchiveApp.tsx');
  const view = source('src/features/archive/ManageAgentsWorkspace.tsx');
  const styles = source('src/styles/premium.css');
  assert.match(sql, /language plpgsql security invoker set search_path = ''/);
  assert.match(sql, /v_actor_role is distinct from 'admin'/);
  assert.match(sql, /v_target\.role = 'admin'/);
  assert.match(sql, /p_confirm_agent_name is distinct from v_target\.agent_name/);
  assert.match(sql, /delete from public\.canned_responses/);
  assert.match(sql, /not exists \(select 1 from public\.canned_responses/);
  assert.match(sql, /update public\.shortcuts s set owner_id = p_actor_id/);
  assert.match(sql, /delete from public\.agents/);
  assert.match(sql, /revoke all on function public\.admin_delete_agent\(uuid,uuid,text\)[\s\S]*?from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.admin_delete_agent\(uuid,uuid,text\)[\s\S]*?to service_role/);
  assert.match(server, /requireRateLimit\(env, `admin:delete:/);
  assert.match(server, /p_actor_id: signed\.agent\.id/);
  assert.match(server, /api\/admin\/users/);
  assert.match(view, /confirmation !== target\.agent_name/);
  assert.match(view, /target\.id === agent\.id \|\| target\.role === 'admin'/);
  assert.match(view, /onClick=\{\(\) => \{ void removeAccount\(\); \}\}/);
  assert.match(app, /Admin dashboard/);
  assert.match(app, /Manage agents/);
  assert.match(app, /<TeamWorkspace onError=\{onError\}\/>/);
  assert.match(styles, /archive-admin-subnav/);
  assert.doesNotMatch(styles, /archive-admin-subnav::before/);
});
