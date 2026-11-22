import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { responseCreatorName } from '../src/features/archive/model.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const viewer = { id: 'owner', agent_name: 'Michelle', role: 'agent' };
const item = visibility => ({
  id: 'one', shortcut: 'appointment', body: 'Hello there.',
  visibility, createdAt: '2026-01-20T00:00:00.000Z',
  updatedAt: '2026-01-20T00:00:00.000Z',
  ownedByMe: visibility === 'private',
  createdBy: visibility === 'shared' ? 'MeGan' : undefined,
});

test('creator bylines use shared authors and private owners without leaking private text', () => {
  assert.equal(responseCreatorName(item('shared'), viewer), 'MeGan');
  assert.equal(responseCreatorName(item('shared'), null), 'MeGan');
  assert.equal(responseCreatorName(item('private'), viewer), 'Michelle');
  assert.equal(responseCreatorName(item('private'), null), 'Unknown agent');
  assert.equal(responseCreatorName({ ...item('shared'), createdBy: ' ' }, null), 'Unknown agent');
  assert.equal(responseCreatorName({ ...item('shared'), createdBy: '', ownedByMe: true }, viewer), 'Michelle');
});

test('response cards show selected creator picture, byline and the original creation date', () => {
  const lib = read('src/features/archive/LibraryWorkspace.tsx');
  const styles = read('src/styles/premium.css');
  const avatar = read('src/features/archive/AgentAvatar.tsx');
  const api = read('src/features/archive/api.ts');
  assert.match(lib, /getTeam\(\)/, 'Reuse existing public Team directory');
  assert.match(api, /'\/api\/team'/);
  assert.match(lib, /setDirectory\(users\)/);
  assert.match(lib, /creatorByName = useMemo/);
  assert.match(lib, /new Map\(directory.map\(user => \[user.agent_name.toLocaleLowerCase\(\), user\]\)\)/);
  assert.match(lib, /const creatorName = responseCreatorName\(item, agent\)/);
  assert.match(lib, /creatorByName.get\(creatorName.toLocaleLowerCase\(\)\)/);
  assert.match(lib, /<AgentAvatar name=\{creatorName\} url=\{profile\?\.avatar_url \?\? null\}\/\>/);
  assert.match(lib, /Added by <strong>\{creatorName\}<\/strong>/);
  assert.match(lib, /<time dateTime=\{item.createdAt\}>/);
  assert.match(lib, /day: 'numeric', month: 'long', year: 'numeric'/);
  assert.match(lib, /setDirectoryRefresh\(version => version \+ 1\)/);
  assert.match(styles, /\.archive-response-meta \.archive-directory-avatar\{/);
  assert.match(styles, /\.archive-response-attribution-text strong\{/);
  assert.match(avatar, /loading="lazy" decoding="async"/);
});

test('author metadata is optional and does not change response edit/delete permissions', () => {
  const model = read('src/features/archive/model.ts');
  const lib = read('src/features/archive/LibraryWorkspace.tsx');
  assert.match(model, /ownedByMe\?: boolean/);
  assert.match(lib, /canManageResponse\(agent, item\)/);
  assert.match(model, /if \(record.visibility === 'private'\)/);
  assert.match(model, /return record.createdBy\?\.trim\(\)/);
  assert.doesNotMatch(lib, /admin_agent_stats|SUPABASE_SECRET_KEY|PIN_PEPPER/);
});
