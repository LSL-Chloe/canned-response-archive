import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { handleResponses } from '../worker/api/responses.ts';
import { handleAvatars } from '../worker/api/avatars.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  PIN_PEPPER: '0123456789abcdef0123456789abcdef',
};
const DIRECTORY = [
  {
    id: '11111111-1111-4111-8111-111111111111', agent_name: 'Chloe', role: 'admin',
    joined_at: '2026-11-21T00:00:00Z', shared_count: 2, private_count: 1,
  },
  {
    id: '22222222-2222-4222-8222-222222222222', agent_name: 'Atlas', role: 'agent',
    joined_at: '2026-11-22T00:00:00Z', shared_count: 1, private_count: 4,
  },
];
const PHOTOS = [
  { id: DIRECTORY[0].id, avatar_url: 'https://test.supabase.co/storage/v1/object/public/archive-avatars/portrait.jpg' },
  { id: DIRECTORY[1].id, avatar_url: null },
];
const reply = value => new Response(JSON.stringify(value), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});

test('Team overview directory is readable without signing in and exposes only permitted metadata', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ path: url.pathname, method: init.method ?? 'GET' });
    if (url.pathname.endsWith('/rpc/use_rate_limit')) return reply(true);
    if (url.pathname.endsWith('/rpc/admin_agent_stats')) return reply(DIRECTORY);
    if (url.pathname.endsWith('/agents')) {
      assert.equal(url.searchParams.get('select'), 'id,avatar_url');
      return reply(PHOTOS);
    }
    throw new Error('Unexpected database request ' + url.pathname);
  };
  try {
    const request = new Request('https://archive.example/api/team', {
      headers: { 'CF-Connecting-IP': '192.0.2.1' },
    });
    const res = await handleResponses(request, env, '/api/team');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.users, DIRECTORY.map(agent => ({
      ...agent,
      avatar_url: PHOTOS.find(profile => profile.id === agent.id)?.avatar_url ?? null,
    })));
    assert.equal(JSON.stringify(body).includes('email'), false);
    assert.equal(JSON.stringify(body).includes('pin_hash'), false);
    assert.equal(JSON.stringify(body).includes('body'), false);
    assert.ok(calls.some(call => call.path.endsWith('/rpc/use_rate_limit')));
    assert.ok(calls.some(call => call.path.endsWith('/rpc/admin_agent_stats')));
    assert.ok(calls.some(call => call.path.endsWith('/agents')));
  } finally {
    globalThis.fetch = original;
  }
});

test('administrative account listing and deletion remain restricted', async () => {
  const anon = new Request('https://archive.example/api/admin/users');
  await assert.rejects(
    handleResponses(anon, env, '/api/admin/users'),
    error => error.status === 401 && error.code === 'login_required',
  );
  const server = read('worker/api/responses.ts');
  assert.match(server, /path === '\/api\/team' && request.method === 'GET'/);
  assert.match(server, /requireRateLimit\(env, `team:view:/);
  assert.match(server, /path === '\/api\/admin\/users' && request.method === 'GET'/);
  assert.match(server, /signed.agent.role !== 'admin'/);
  assert.match(server, /path.startsWith\('\/api\/admin\/users\/'\) && request.method === 'DELETE'/);
});

test('new team page is third in the regular navigation for every visitor, not an admin subpage', () => {
  const app = read('src/features/archive/ArchiveApp.tsx');
  const team = read('src/features/archive/TeamWorkspace.tsx');
  const manage = read('src/features/archive/ManageAgentsWorkspace.tsx');
  const client = read('src/features/archive/api.ts');
  const avatar = read('src/features/archive/AgentAvatar.tsx');
  assert.ok(app.indexOf('aria-label="Admin dashboard"') < app.indexOf('aria-label="Main navigation"'));
  assert.match(app, /page === 'team' \? 2 : -1/);
  assert.match(app, /\{page === 'team' && <TeamWorkspace onError=\{onError\}\/>}/);
  assert.match(app, /page === 'agents' && agent\?\.role === 'admin'/);
  assert.doesNotMatch(app, /target === 'team' && agent\?\.role !== 'admin'/);
  assert.match(client, /'\/api\/team'/);
  assert.match(client, /'\/api\/admin\/users'/);
  assert.match(client, /avatar_url: string \| null/);
  assert.match(team, /<AgentAvatar name=\{user.agent_name\} url=\{user.avatar_url\}\/>/);
  assert.match(manage, /getAdminAgents\(\)/);
  assert.match(manage, /<AgentAvatar name=\{user.agent_name\} url=\{user.avatar_url\}\/>/);
  assert.match(avatar, /avatarImageSrc\(url\)/);
  assert.match(avatar, /onError=/);
});

test('Escape clears the entire composer, dropdown, highlight and insertion undo state in one press', () => {
  const search = read('src/features/archive/SearchWorkspace.tsx');
  const escape = search.indexOf("if (event.key === 'Escape' && !event.nativeEvent.isComposing)");
  const guard = search.indexOf('if (!open) return;', search.indexOf('function onKeyDown('));
  assert.ok(escape >= 0 && escape < guard, 'Escape must work even with no suggestion menu open');
  const section = search.slice(escape, guard);
  for (const action of [
    'event.preventDefault()', "setDraft('')", 'setCaret(0)',
    'setDismissed(true)', 'setHighlight(0)', 'setSelectedShortcut(null)',
    'lastInsert.current = null', 'setSelection(0)',
  ]) assert.ok(section.includes(action), 'Escape must reset ' + action);
  assert.match(search, /aria-keyshortcuts="Escape"/);
  assert.match(search, /<kbd>Esc<\/kbd> clear/);
  assert.match(search, /selectionStart !== event.currentTarget.selectionEnd/, 'Selection-specific copy must remain');
});


test('guest avatar proxy serves only a current selected profile picture', async () => {
  const original = globalThis.fetch;
  const chosen = 'https://static.tvmaze.com/uploads/images/medium_portrait/5/14.jpg';
  const query = url => new URL('https://archive.example/api/avatars/image?url=' + encodeURIComponent(url));
  let selected = true;
  let upstreamCalls = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/agents')) {
      assert.equal(url.searchParams.get('avatar_url'), 'eq.' + chosen);
      return reply(selected ? [{ id: DIRECTORY[1].id }] : []);
    }
    if (url.pathname.endsWith('/rpc/use_rate_limit')) return reply(true);
    if (url.toString() === chosen) {
      upstreamCalls++;
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200, headers: { 'Content-Type': 'image/png' },
      });
    }
    throw new Error('Unexpected avatar URL ' + url);
  };
  try {
    const url = query(chosen);
    const request = new Request(url, { headers: { 'CF-Connecting-IP': '192.0.2.1' } });
    const allowed = await handleAvatars(request, env, '/api/avatars/image', url);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('Content-Type'), 'image/png');
    assert.equal(upstreamCalls, 1);
    selected = false;
    await assert.rejects(handleAvatars(request, env, '/api/avatars/image', url),
      error => error.status === 403 && error.code === 'not_public_avatar');
    assert.equal(upstreamCalls, 1, 'Unselected images must not trigger remote fetches');
  } finally {
    globalThis.fetch = original;
  }
});
