import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  findHashQuery, findSuggestions, insertSuggestion, shortcutOptions, canManageResponse,
} from '../src/features/archive/model.ts';

const shared = (id, shortcut, body, createdBy = 'Chloe') => ({
  id, shortcut, body, visibility: 'shared', createdAt: '2026-11-21T03:00:00Z',
  updatedAt: '2026-11-21T03:00:00Z', createdBy, ownedByMe: createdBy === 'Chloe',
});
const priv = (id, shortcut, body) => ({
  ...shared(id, shortcut, body), visibility: 'private', createdBy: undefined, ownedByMe: true,
});
const records = [
  shared('a', 'appointment', 'Your appointment has been scheduled.'),
  shared('b', 'appointment', 'We can reschedule your appointment.'),
  shared('c', 'followup', 'May we follow up with you?'),
  priv('d', 'appointment', 'My private appointment reply.'),
];
const file = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('hashtags are detected at the caret without matching embedded words', () => {
  assert.deepEqual(findHashQuery('#app', 4), { start: 0, end: 4, query: 'app' });
  assert.deepEqual(findHashQuery('Hello #follow', 13), { start: 6, end: 13, query: 'follow' });
  assert.deepEqual(findHashQuery('hello #', 7), { start: 6, end: 7, query: '' });
  assert.equal(findHashQuery('email@example.com', 17), null);
  assert.equal(findHashQuery('text#app', 8), null);
  assert.equal(findHashQuery('#app more words', 15), null);
  assert.equal(findHashQuery('#app', -1), null);
});

test('search returns each matching response, including duplicates under one shortcut', () => {
  const matches = findSuggestions(records, 'app');
  assert.deepEqual(matches.map(x => x.id), ['a','b','d']);
  assert.deepEqual(findSuggestions(records, '#followup').map(x => x.id), ['c']);
  assert.deepEqual(findSuggestions(records, 'scheduled'), []);
  assert.deepEqual(findSuggestions(records, 'in'), []);
  assert.deepEqual(findSuggestions([...records, shared('e', 'inactive', 'Are you there?')], 'in')
    .map(x => x.id), ['e']);
  assert.deepEqual(findSuggestions(records, 'unknown').map(x => x.id), []);
  assert.equal(findSuggestions(records, '').length, 4);
  const many = Array.from({ length: 60 }, (_, i) => shared(String(i), 'bulk', 'Text ' + i));
  assert.equal(findSuggestions(many, '').length, 60, 'A bare # must show all responses, not first nine');
  assert.equal(findSuggestions(many, 'bul').length, 60);
});

test('inserting a selected response replaces only the current hash token', () => {
  const original = 'Hi #app, please reply.';
  const match = findHashQuery(original, 7);
  assert.ok(match);
  const updated = insertSuggestion(original, match, 'We can reschedule.');
  assert.equal(updated.value, 'Hi We can reschedule., please reply.');
  assert.equal(updated.caret, 'Hi We can reschedule.'.length);
  assert.deepEqual(insertSuggestion('#followup', { start: 0, end: 9, query: 'followup' }, 'Thanks'),
    { value: 'Thanks ', caret: 7 });
});

test('shortcut creation offers existing names with counts scoped to visibility', () => {
  assert.deepEqual(shortcutOptions(records, 'shared', 'app'), [{ name: 'appointment', count: 2 }]);
  assert.deepEqual(shortcutOptions(records, 'private', '#app'), [{ name: 'appointment', count: 1 }]);
});

test('permission display respects agreed shared/private rules', () => {
  const owner = { id: 'u1', agent_name: 'Chloe', role: 'agent' };
  const outsider = { id: 'u2', agent_name: 'Alex', role: 'agent' };
  const admin = { id: 'u3', agent_name: 'Admin', role: 'admin' };
  assert.deepEqual(canManageResponse(owner, records[0]), { edit: true, delete: true });
  assert.deepEqual(canManageResponse(outsider, records[0]), { edit: false, delete: false });
  assert.deepEqual(canManageResponse(admin, records[0]), { edit: true, delete: true });
  assert.deepEqual(canManageResponse(owner, records[3]), { edit: true, delete: true });
  assert.deepEqual(canManageResponse(admin, records[3]), { edit: true, delete: true }); // Own-private feed only.
  assert.deepEqual(canManageResponse(null, records[0]), { edit: false, delete: false });
});

test('archive wires UI to same-origin APIs and separates private from public feed', () => {
  const api = file('src/features/archive/api.ts');
  const app = file('src/features/archive/ArchiveApp.tsx');
  const search = file('src/features/archive/SearchWorkspace.tsx');
  const library = file('src/features/archive/LibraryWorkspace.tsx');
  assert.match(api, /credentials: 'same-origin'/);
  assert.match(api, /\/api\/responses\?scope=/);
  assert.match(api, /\/api\/auth\/me/);
  assert.match(app, /fetchFeed\('shared'\)/);
  assert.match(app, /fetchFeed\('private'\)/);
  assert.match(search, /ArrowDown/);
  assert.match(search, /ArrowUp/);
  assert.match(search, /Escape/);
  assert.match(search, /Ctrl/);
  assert.match(search, /caret: found\.end/);
  assert.match(search, /setHighlight\(previous\.highlight\)/);
  assert.match(app, /sidebarCollapsed/);
  assert.match(app, /Collapse sidebar/);
  assert.match(library, /archive-edit-shortcut/);
  assert.match(library, /updateResponse\(editing\.id, editBody, editShortcut\.trim\(\)\)/);
  assert.match(library, /Created by/);
  assert.doesNotMatch(search, /createdBy/);
  assert.match(library, /onRequireLogin\('private'\)/);
  assert.match(library, /onRequireLogin\('create'\)/);
  assert.doesNotMatch(app + api + library + search, /SUPABASE_SECRET_KEY|PIN_PEPPER|OTP_MAILER_SECRET/);
});
