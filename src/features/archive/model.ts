export type Visibility = 'shared' | 'private';
export type LibraryScope = 'all' | Visibility;
export type View = 'search' | 'library' | 'team';
export interface Agent {
  id: string;
  agent_name: string;
  role: 'admin' | 'agent';
}
export interface ArchiveResponse {
  id: string;
  shortcut: string;
  body: string;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}
export interface HashQuery {
  start: number;
  end: number;
  query: string;
}
export interface InsertResult {
  value: string;
  caret: number;
}
export interface ShortcutOption {
  name: string;
  count: number;
}

/** The token immediately before the caret can begin at start-of-text or after whitespace/brackets. */
export function findHashQuery(value: string, caret: number): HashQuery | null {
  if (!Number.isInteger(caret) || caret < 0 || caret > value.length) return null;
  const before = value.slice(0, caret);
  const matched = /(?:^|[\s([{])#([A-Za-z0-9_-]*)$/.exec(before);
  if (!matched) return null;
  const markerOffset = matched[0].lastIndexOf('#');
  return {
    start: before.length - matched[0].length + markerOffset,
    end: caret,
    query: matched[1] ?? '',
  };
}

/** Keep each response independent even when it shares a shortcut with other responses. */
export function findSuggestions(records: ArchiveResponse[], rawQuery: string, max = 9): ArchiveResponse[] {
  const query = rawQuery.toLowerCase().replace(/^#/, '');
  return records.map((record, index) => {
    const shortcut = record.shortcut.toLowerCase();
    const body = record.body.toLowerCase();
    const score = !query ? 0 :
      shortcut === query ? 0 :
      shortcut.startsWith(query) ? 1 :
      shortcut.includes(query) ? 2 :
      body.includes(query) ? 3 : -1;
    return { record, index, score };
  }).filter(item => item.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, max)
    .map(item => item.record);
}

export function insertSuggestion(value: string, match: HashQuery, body: string): InsertResult {
  if (match.start < 0 || match.end > value.length || match.end < match.start) {
    return { value, caret: value.length };
  }
  const suffix = value.slice(match.end);
  const spacer = !suffix || !/^[\s.,!?;:)\]}]/.test(suffix) ? ' ' : '';
  const prefix = value.slice(0, match.start);
  const inserted = body + spacer;
  return { value: prefix + inserted + suffix, caret: prefix.length + inserted.length };
}

export function shortcutOptions(records: ArchiveResponse[], visibility: Visibility, input: string): ShortcutOption[] {
  const term = input.toLowerCase().trim().replace(/^#/, '');
  const byName = new Map<string, ShortcutOption>();
  for (const record of records) {
    if (record.visibility !== visibility) continue;
    const key = record.shortcut.toLowerCase();
    if (term && !key.includes(term)) continue;
    const current = byName.get(key);
    if (current) current.count += 1;
    else byName.set(key, { name: record.shortcut, count: 1 });
  }
  return [...byName.values()].sort((a, b) => {
    const aScore = a.name.toLowerCase().startsWith(term) ? 0 : 1;
    const bScore = b.name.toLowerCase().startsWith(term) ? 0 : 1;
    return aScore - bScore || a.name.localeCompare(b.name);
  }).slice(0, 10);
}

export function canManageResponse(agent: Agent | null, record: ArchiveResponse): { edit: boolean; delete: boolean } {
  if (!agent) return { edit: false, delete: false };
  if (record.visibility === 'private') return { edit: true, delete: true }; // Private API fetches only the owner.
  return {
    edit: agent.role === 'admin',
    delete: agent.role === 'admin' ||
      record.createdBy?.toLocaleLowerCase() === agent.agent_name.toLocaleLowerCase(),
  };
}

export function formatCount(count: number, singular: string, plural = singular + 's'): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
