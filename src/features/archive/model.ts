export type Visibility = 'shared' | 'private';
export type LibraryScope = 'all' | Visibility | 'mine';
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
  ownedByMe?: boolean;
}
/** Resolve the byline without ever inferring ownership from display names.
 * Only an authenticated viewer receives Private rows; those rows belong to
 * that viewer, while Shared feed rows provide their recorded creator name.
 */
export function responseCreatorName(
  record: ArchiveResponse,
  viewer: Pick<Agent, 'agent_name'> | null,
): string {
  if (record.visibility === 'private') return viewer?.agent_name || 'Unknown agent';
  return record.createdBy?.trim() || (record.ownedByMe ? viewer?.agent_name : '') || 'Unknown agent';
}

/**
 * Polling may return the same feed every five seconds. Reuse the previous
 * array when nothing relevant changed so long lists and glass controls
 * aren't needlessly reconciled on each background refresh.
 */
export function sameResponseList(left: ArchiveResponse[], right: ArchiveResponse[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i]!;
    const b = right[i]!;
    if (a.id !== b.id || a.body !== b.body || a.shortcut !== b.shortcut ||
        a.visibility !== b.visibility || a.updatedAt !== b.updatedAt ||
        a.createdAt !== b.createdAt || a.createdBy !== b.createdBy ||
        a.ownedByMe !== b.ownedByMe) return false;
  }
  return true;
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

/** Hash queries can contain spaces and leading underscores, matching saved shortcut names. */
export function findHashQuery(value: string, caret: number): HashQuery | null {
  if (!Number.isInteger(caret) || caret < 0 || caret > value.length) return null;
  const before = value.slice(0, caret);
  const matched = /(?:^|[\s([{])#([A-Za-z0-9_ -]{0,64})$/.exec(before);
  if (!matched) return null;
  const markerOffset = matched[0].lastIndexOf('#');
  return {
    start: before.length - matched[0].length + markerOffset,
    end: caret,
    query: matched[1] ?? '',
  };
}

/** The draft may begin with a shortcut without '#'. Do not show
 * suggestions for unrelated prose, multi-line messages, or partial words
 * in the middle of a draft. A real matching shortcut is required. */
export function findPlainShortcutQuery(
  value: string, caret: number, records: ArchiveResponse[],
): HashQuery | null {
  if (!Number.isInteger(caret) || caret !== value.length || value.includes('\n')) return null;
  const start = value.search(/\S/);
  if (start < 0) return null;
  const query = value.slice(start, caret);
  if (!query.length || query.length > 64 ||
      !/^[A-Za-z0-9_][A-Za-z0-9_ -]*$/.test(query) || query.endsWith(' ')) return null;
  const normalized = query.toLowerCase();
  // A one-character prefix is ambiguous for ordinary typing; still allow it
  // when an actual single-character shortcut exists.
  if (!records.some(record => query.length === 1
    ? record.shortcut.toLowerCase() === normalized
    : record.shortcut.toLowerCase().startsWith(normalized))) return null;
  return { start, end: caret, query };
}

/** A bare # shows EVERY response, not just nine. Typing matches shortcut prefixes only. */
export function findSuggestions(records: ArchiveResponse[], rawQuery: string): ArchiveResponse[] {
  const query = rawQuery.toLowerCase().trim().replace(/^#/, '');
  return records
    .filter(record => record.shortcut.toLowerCase().startsWith(query))
    .sort((a, b) => {
      // Preserve separate options when multiple responses share one shortcut.
      const aKey = a.shortcut.toLowerCase();
      const bKey = b.shortcut.toLowerCase();
      return aKey.localeCompare(bKey) || a.createdAt.localeCompare(b.createdAt);
    });
}


export interface ShortcutGroup {
  name: string;
  responses: ArchiveResponse[];
}

/** One menu row per shortcut; the next level contains all matching saved responses. */
export function findShortcutGroups(records: ArchiveResponse[], query: string): ShortcutGroup[] {
  const matches = findSuggestions(records, query);
  const groups = new Map<string, ShortcutGroup>();
  for (const response of matches) {
    const key = response.shortcut.toLowerCase();
    const group = groups.get(key);
    if (group) group.responses.push(response);
    else groups.set(key, { name: response.shortcut, responses: [response] });
  }
  return [...groups.values()];
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
  // These flags are hints only; every write is re-authorized by the Worker.
  // Private feed is owner-filtered; shared ownership comes from an immutable ID lookup.
  if (record.visibility === 'private') {
    return { edit: record.ownedByMe === true, delete: record.ownedByMe === true };
  }
  const allowed = agent.role === 'admin' || record.ownedByMe === true;
  return { edit: allowed, delete: allowed };
}

export function formatCount(count: number, singular: string, plural = singular + 's'): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
