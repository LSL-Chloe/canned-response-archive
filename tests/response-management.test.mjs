import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ApiError, bulkDeleteIds, canEditResponse, canDeleteResponse } from '../worker/api/shared.ts';
import { canManageResponse } from '../src/features/archive/model.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const alice = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', agent_name: 'Alice', role: 'agent' };
const admin = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', agent_name: 'Admin', role: 'admin' };
const response = (visibility, ownedByMe) => ({
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  shortcut: 'follow up', body: 'Thanks for reaching out.',
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
  visibility, ownedByMe,
});

test('By me is an owner-filtered view; creator IDs control permissions, not display names', () => {
  const ownShared = response('shared', true);
  const otherShared = response('shared', false);
  const ownPrivate = response('private', true);
  const rows = [ownShared, otherShared, ownPrivate];
  assert.deepEqual(rows.filter(r => r.ownedByMe === true), [ownShared, ownPrivate]);
  assert.deepEqual(canManageResponse(alice, ownShared), { edit: true, delete: true });
  assert.deepEqual(canManageResponse(alice, ownPrivate), { edit: true, delete: true });
  assert.deepEqual(canManageResponse(alice, otherShared), { edit: false, delete: false });
  assert.deepEqual(canManageResponse(admin, otherShared), { edit: true, delete: true });
  assert.deepEqual(canManageResponse(null, ownShared), { edit: false, delete: false });
  const lib = read('src/features/archive/LibraryWorkspace.tsx');
  assert.match(lib, /scope === 'mine' \? item\.ownedByMe === true/);
  assert.match(lib, /By me/);
  assert.match(lib, /canManageResponse\(agent, item\)\.delete/);
});

test('server permissions allow admins to edit another person shared, never their private', () => {
  const owned = { owner_id: alice.id, visibility: 'private' };
  const shared = { owner_id: alice.id, visibility: 'shared' };
  assert.equal(canEditResponse(admin.role, admin.id, owned), false);
  assert.equal(canDeleteResponse(admin.role, admin.id, owned), false);
  assert.equal(canEditResponse(admin.role, admin.id, shared), true);
  assert.equal(canDeleteResponse(admin.role, admin.id, shared), true);
  assert.equal(canEditResponse(alice.role, alice.id, owned), true);
  assert.equal(canEditResponse(alice.role, admin.id, shared), false);
});

test('bulk API rejects malformed, duplicate or oversize batches before the DB RPC', () => {
  const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  assert.deepEqual(bulkDeleteIds([id.toUpperCase()]), [id]);
  for (const value of [null, [], [id,id], ['not-a-uuid'], [''], [3], Array.from({length:101},()=>id)]) {
    assert.throws(() => bulkDeleteIds(value), error =>
      error instanceof ApiError && error.status === 400);
  }
  const server = read('worker/api/responses.ts');
  assert.match(server, /bulkDeleteIds\(data\.ids\)/);
  assert.match(server, /requireRateLimit\(env, `bulk-delete:/);
  assert.match(server, /delete_archive_responses_batch/);
});

test('visibility transitions and 100-item deletes run in locked SQL transactions', () => {
  const sql = read('supabase/migrations/20261122010100_response_management.sql');
  assert.match(sql, /create function public\.update_archive_response/);
  assert.match(sql, /create function public\.delete_archive_responses_batch/);
  assert.match(sql, /language plpgsql security invoker set search_path = ''/);
  assert.match(sql, /where r\.id = p_response_id for update/);
  assert.match(sql, /not \(v_role = 'admin' and v_row\.visibility = 'shared'\)/);
  assert.match(sql, /p_visibility, v_row\.owner_id/);
  assert.match(sql, /set body = p_body, shortcut_id = v_shortcut_id, visibility = p_visibility/);
  assert.match(sql, /where r\.id = any\(p_ids\) order by r\.id for update/);
  assert.match(sql, /where r\.owner_id <> p_actor_id/);
  assert.match(sql, /v_requested not between 1 and 100/);
  assert.match(sql, /revoke all on function public\.update_archive_response\(uuid,uuid,text,text,text\)[\s\S]*?from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.update_archive_response\(uuid,uuid,text,text,text\)[\s\S]*?to service_role/);
  assert.match(sql, /revoke all on function public\.delete_archive_responses_batch\(uuid,uuid\[\]\)[\s\S]*?from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.delete_archive_responses_batch\(uuid,uuid\[\]\)[\s\S]*?to service_role/);
});

test('edit UI changes destination, select all works only for manageable visible rows', () => {
  const lib = read('src/features/archive/LibraryWorkspace.tsx');
  const css = read('src/styles/premium.css');
  const client = read('src/features/archive/api.ts');
  assert.match(lib, /setEditVisibility\(item\.visibility\)/);
  assert.match(lib, /updateResponse\(editing\.id, editBody, editShortcut\.trim\(\), editVisibility\)/);
  assert.match(lib, /scope === 'private' \? 2 : 3/);
  assert.match(lib, /'all', 'shared', 'private', 'mine'/);
  assert.match(lib, /Select all/);
  assert.match(lib, /Delete selected/);
  assert.match(lib, /<input type="checkbox" checked=\{selectedIds\.has\(item\.id\)\}/);
  assert.match(lib, /if \(ids\.some\(id => !eligible\.has\(id\)\)\)/);
  assert.match(lib, /for \(let start = 0; start < ids\.length; start \+= 100\)/);
  assert.match(client, /JSON\.stringify\(\{ body, shortcut, visibility \}\)/);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /archive-selection-toolbar/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('response ownership remains immutable through admin Shared-to-Private moves', () => {
  const sql = read('supabase/migrations/20261122010100_response_management.sql');
  assert.match(sql, /v_row\.owner_id/);
  assert.doesNotMatch(sql, /set[\s\S]{0,120}owner_id\s*=/);
  const api = read('worker/api/responses.ts');
  assert.match(api, /p_actor_id: signed\.agent\.id/);
  assert.match(api, /p_visibility: visibility/);
  assert.match(api, /visibilityInput\(data\.visibility \?\? item\.visibility\)/);
  assert.match(sql, /sync_shared_response_feed/);
  assert.match(sql, /jsonb_build_object\('id',v_result\.id,'visibility',v_result\.visibility\)/);
  assert.doesNotMatch(sql, /to_jsonb\(v_result\)/);
  const api = read('worker/api/responses.ts');
  assert.doesNotMatch(api, /id: `in\.\(\$\{shared\.map/);
});
