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
  assert.throws(() => parseTransferFile(archive('private', [row('bad space', 'Hi')]), 'private'), /invalid shortcut/);
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
  assert.match(transfer, /not atomic/);
  assert.match(api, /\/api\/responses\/export\?scope=/);
  assert.match(api, /\/api\/responses\/import/);
  assert.match(server, /scope === 'shared' && signed.agent.role !== 'admin'/);
  assert.match(server, /if \(!signed\) return fail\(401, 'login_required', 'Sign in to import'\)/);
  assert.match(server, /owner_id: `eq\.\$\{signed\.agent\.id\}`/);
});
