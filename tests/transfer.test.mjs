import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseTransferFile, batchTransferRows, MAX_IMPORT_ROWS } from '../src/features/archive/transfer.ts';

const archive = (visibility, responses) => JSON.stringify({ version: 1, visibility, responses });
const row = (shortcut, body) => ({ shortcut, body });
const example = [row('greeting', 'Hi'), row('#greeting', 'Hello again!')];

test('imports use versioned archive JSON and appendable shortcut/body records', () => {
  const parsed = parseTransferFile(archive('private', example), 'private');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.visibility, 'private');
  assert.deepEqual(parsed.responses, [row('greeting', 'Hi'), row('greeting', 'Hello again!')]);
  assert.equal(parsed.responses.length, 2, 'Duplicate shortcut must preserve both responses');
  assert.deepEqual(parseTransferFile(archive('shared', [row('greet', 'Hi')]), 'shared').responses,
    [row('greet', 'Hi')]);
});

test('import rejects cross-scope, wrong version, malformed JSON and invalid responses', () => {
  assert.throws(() => parseTransferFile(archive('shared', example), 'private'), /exported as shared/i);
  assert.throws(() => parseTransferFile('not json', 'shared'), /not valid JSON/);
  assert.throws(() => parseTransferFile(JSON.stringify({ version: 3, visibility: 'private', responses: example }), 'private'), /version 1/i);
  assert.throws(() => parseTransferFile(JSON.stringify(example), 'private'), /JSON archive object/);
  assert.throws(() => parseTransferFile(archive('private', []), 'private'), /no responses/i);
  assert.deepEqual(parseTransferFile(archive('private', [row('auto pricing', 'Hi'), row('_OnIdle_', 'Still here?')]), 'private').responses,
    [row('auto pricing', 'Hi'), row('_OnIdle_', 'Still here?')]);
  assert.throws(() => parseTransferFile(archive('private', [row('bad/shortcut', 'Hi')]), 'private'), /invalid shortcut/);
  assert.throws(() => parseTransferFile(archive('private', [row('ok', '')]), 'private'), /1–10,000/);
  assert.throws(() => parseTransferFile(archive('private', [row('ok', 'x'.repeat(10001))]), 'private'), /1–10,000/);
  assert.throws(() => parseTransferFile(archive('private', Array.from({length:MAX_IMPORT_ROWS+1}, () => row('hi','x'))), 'private'), /up to 500/i);
});

test('import separates batches by both row count and encoded request payload size', () => {
  const small = Array.from({length: 121}, (_, i) => row('response'+i, 'Text '+i));
  const groups = batchTransferRows(small, 'private');
  assert.deepEqual(groups.map(g => g.length), [50, 50, 21]);
  assert.deepEqual(groups.flat(), small);
  const large = Array.from({length: 30}, () => row('big', '🚀'.repeat(9000 / 2)));
  const bigBatches = batchTransferRows(large, 'shared');
  assert.deepEqual(bigBatches.flat(), large);
  for (const group of bigBatches) {
    assert.ok(group.length >= 1 && group.length <= 50);
    assert.ok(new TextEncoder().encode(JSON.stringify({ visibility:'shared', responses:group })).length <= 220000);
  }
});

test('archive controls reserve Shared transfer for administrators and require login from guest UI', () => {
  const lib = readFileSync(new URL('../src/features/archive/LibraryWorkspace.tsx', import.meta.url), 'utf8');
  const transfer = readFileSync(new URL('../src/features/archive/TransferWorkspace.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/features/archive/api.ts', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../worker/api/responses.ts', import.meta.url), 'utf8');
  assert.match(lib, /onRequireLogin\('transfer'\)/);
  assert.match(transfer, /agent.role === 'admin'/);
  assert.match(transfer, /canShared &&/);
  assert.match(transfer, /Review before importing/);
  assert.match(transfer, /window.confirm/);
  assert.match(transfer, /<strong>atomic<\/strong>/);
  assert.match(transfer, /result\.imported \+ result\.skipped/);
  assert.match(server, /import_responses_batch/);
  assert.doesNotMatch(server, /for \(const entry of validated\)/);
  assert.match(api, /\/api\/responses\/export\?scope=/);
  assert.match(api, /\/api\/responses\/import/);
  assert.match(server, /scope === 'shared' && signed.agent.role !== 'admin'/);
  assert.match(server, /if \(!signed\) return fail\(401, 'login_required', 'Sign in to import'\)/);
  assert.match(server, /owner_id: `eq\.\$\{signed\.agent\.id\}`/);
});

test('import RPC batches are transactional, permissions-bound, and safe to retry', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261122000000_atomic_import_batches.sql', import.meta.url), 'utf8');
  assert.match(sql, /language plpgsql security invoker set search_path = ''/);
  assert.match(sql, /revoke all on function public\.import_responses_batch\(uuid, text, jsonb\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.import_responses_batch\(uuid, text, jsonb\) to service_role/);
  assert.match(sql, /p_visibility = 'shared' and v_role <> 'admin'/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /r\.body = v_body/);
  assert.match(sql, /v_skipped := v_skipped \+ 1/);
  assert.match(sql, /insert into public\.canned_responses/);
  assert.match(sql, /jsonb_array_length\(p_responses\) not between 1 and 50/);
});


test('shortcut label migration keeps spaces and underscore-prefixed names through SQL import validation', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261122000001_preserve_original_shortcut_labels.sql', import.meta.url), 'utf8');
  assert.match(sql, /alter table public\.shortcuts add constraint shortcut_name_valid/);
  assert.match(sql, /name = btrim\(name\)/);
  assert.match(sql, /or v_name <> pg_catalog\.btrim\(v_name\)/);
  assert.match(sql, /security invoker set search_path = ''/);
});
