import { Glass } from '@samasante/liquid-glass';
import LiquidButton from '../../ui/LiquidButton';
import LiquidUnderlay from '../../ui/LiquidUnderlay';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { addResponse, bulkDeleteResponses, deleteResponse, getTeam, updateResponse, type TeamAgent } from './api';
import AgentAvatar from './AgentAvatar';
import TransferWorkspace from './TransferWorkspace';
import {
  canManageResponse, formatCount, responseCreatorName, shortcutOptions,
  type Agent, type ArchiveResponse, type LibraryScope, type Visibility,
} from './model';

interface Props {
  agent: Agent | null;
  records: ArchiveResponse[];
  loading: boolean;
  pendingAction: 'private' | 'mine' | 'create' | 'transfer' | null;
  onHandled: () => void;
  onRequireLogin: (reason: 'private' | 'mine' | 'create' | 'transfer') => void;
  reload: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}

export default function LibraryWorkspace({
  agent, records, loading, pendingAction, onHandled, onRequireLogin, reload, onNotice, onError,
}: Props) {
  const [scope, setScope] = useState<LibraryScope>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('shared');
  const [shortcut, setShortcut] = useState('');
  const [body, setBody] = useState('');
  const [showExisting, setShowExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ArchiveResponse | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editShortcut, setEditShortcut] = useState('');
  const [editVisibility, setEditVisibility] = useState<Visibility>('shared');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [showEditExisting, setShowEditExisting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [directory, setDirectory] = useState<TeamAgent[]>([]);
  const [directoryRefresh, setDirectoryRefresh] = useState(0);

  // The public Team directory already exposes each creator's current profile
  // picture. Fetch it once per library visit, not once for every response.
  // If the directory is temporarily unavailable, labels and initials remain.
  useEffect(() => {
    let active = true;
    void getTeam()
      .then(users => { if (active) setDirectory(users); })
      .catch(() => { /* Never block the response library on avatar metadata. */ });
    return () => { active = false; };
  }, [directoryRefresh]);

  const creatorByName = useMemo(() =>
    new Map(directory.map(user => [user.agent_name.toLocaleLowerCase(), user])),
  [directory]);

  useEffect(() => {
    if (!agent && (scope === 'private' || scope === 'mine')) setScope('all');
  }, [agent, scope]);
  useEffect(() => {
    if (!agent || !pendingAction) return;
    if (pendingAction === 'private') setScope('private');
    if (pendingAction === 'mine') setScope('mine');
    if (pendingAction === 'create') setCreating(true);
    if (pendingAction === 'transfer') setTransferOpen(true);
    onHandled();
  }, [agent, pendingAction, onHandled]);

  const shown = useMemo(() => {
    // The leading hashtag is optional in saved-shortcut searches.
    const term = search.toLowerCase().trim().replace(/^#/, '');
    return records
      .filter(item => scope === 'all' || (scope === 'mine' ? item.ownedByMe === true : item.visibility === scope))
      .filter(item => !term || item.shortcut.toLowerCase().includes(term) ||
        item.body.toLowerCase().includes(term) || item.createdBy?.toLowerCase().includes(term))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [records, scope, search]);
  // Bulk selection always refers to the currently visible, authorized rows.
  // Do not render individual SVG lenses for each checkbox in a long list.
  const selectableIds = useMemo(
    () => shown.filter(item => canManageResponse(agent, item).delete).map(item => item.id),
    [shown, agent],
  );
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

  const existing = useMemo(
    () => shortcutOptions(records, visibility, shortcut),
    [records, visibility, shortcut],
  );
  const editExisting = useMemo(
    () => editing ? shortcutOptions(records, editVisibility, editShortcut) : [],
    [records, editing, editShortcut, editVisibility],
  );

  function clearSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkProgress(0);
  }
  function chooseScope(next: LibraryScope) {
    if ((next === 'private' || next === 'mine') && !agent) {
      onRequireLogin(next === 'mine' ? 'mine' : 'private');
      return;
    }
    setScope(next);
    setEditing(null);
    clearSelection();
  }
  function toggleSelection(id: string) {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function removeSelected() {
    if (!agent || bulkBusy || !selectedIds.size) return;
    const eligible = new Set(selectableIds);
    const ids = [...selectedIds];
    if (ids.some(id => !eligible.has(id))) {
      clearSelection();
      onError('The selection changed. Select the responses again.');
      return;
    }
    if (!window.confirm(
      `Permanently delete ${ids.length} selected ${ids.length === 1 ? 'response' : 'responses'}?\n\n` +
      'This cannot be undone. Only the currently selected responses will be deleted.',
    )) return;
    setBulkBusy(true);
    setBulkProgress(0);
    let confirmed = 0;
    try {
      // The database verifies every ID and either deletes the entire batch
      // or deletes none. Large selections use bounded batches to avoid timeouts.
      for (let start = 0; start < ids.length; start += 100) {
        const batch = ids.slice(start, start + 100);
        const result = await bulkDeleteResponses(batch);
        if (result.deleted !== batch.length) throw new Error('Unexpected deletion count. Refresh before trying again.');
        confirmed += result.deleted;
        setBulkProgress(confirmed);
      }
      onNotice(`Deleted ${confirmed} selected ${confirmed === 1 ? 'response' : 'responses'}.`);
    } catch (error) {
      onError(
        `Deletion stopped after ${confirmed} confirmed entries. ` +
        'The current batch is atomic, but a disconnected request may have committed. Refresh before selecting again. ' +
        (error instanceof Error ? error.message : 'The request failed.'),
      );
    } finally {
      clearSelection();
      setBulkBusy(false);
      try { await reload(); }
      catch (error) { onError(error instanceof Error ? error.message : 'Could not refresh after deletion.'); }
    }
  }
  function openTransfer() {
    if (bulkBusy) return;
    clearSelection();
    if (!agent) { onRequireLogin('transfer'); return; }
    setCreating(false);
    setEditing(null);
    setTransferOpen(open => !open);
  }
  function openCreate() {
    if (bulkBusy) return;
    clearSelection();
    if (!agent) { onRequireLogin('create'); return; }
    setTransferOpen(false);
    setEditing(null);
    setShortcut('');
    setBody('');
    setShowExisting(false);
    setVisibility(scope === 'private' ? 'private' : 'shared');
    setCreating(true);
  }
  function cancelCreate() {
    setCreating(false);
    setShortcut('');
    setBody('');
    setShowExisting(false);
  }
  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agent || saving) return;
    setSaving(true);
    try {
      await addResponse(visibility, shortcut.trim(), body);
      cancelCreate();
      setScope(visibility);
      onNotice(`Response saved to ${visibility === 'shared' ? 'Shared' : 'Private'} under #${shortcut.trim().replace(/^#/, '')}.`);
      void reload().catch(err => onError(err instanceof Error ? err.message : 'Could not refresh responses'));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save response');
    } finally { setSaving(false); }
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving || bulkBusy) return;
    setSaving(true);
    try {
      await updateResponse(editing.id, editBody, editShortcut.trim(), editVisibility);
      const movedForAnotherOwner = !editing.ownedByMe && editVisibility === 'private';
      setEditing(null);
      onNotice(movedForAnotherOwner
        ? 'Saved as Private for its original creator. This response is no longer visible to other agents or admins.'
        : `Response saved as ${editVisibility === 'shared' ? 'Shared' : 'Private'}. Other replies under the shortcut are unchanged.`);
      void reload().catch(err => onError(err instanceof Error ? err.message : 'Could not refresh responses'));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not update response');
    } finally { setSaving(false); }
  }
  async function remove(item: ArchiveResponse) {
    if (bulkBusy || saving) return;
    if (!window.confirm(`Delete this response under #${item.shortcut}? This cannot be undone.`)) return;
    setProcessingId(item.id);
    try {
      await deleteResponse(item.id);
      onNotice('Response deleted.');
      await reload();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not delete response');
    } finally { setProcessingId(null); }
  }
  async function copy(item: ArchiveResponse) {
    try {
      await navigator.clipboard.writeText(item.body);
      onNotice(`Copied #${item.shortcut} response.`);
    } catch { onError('Clipboard access was blocked. Select the response text and copy it manually.'); }
  }

  return (
    <section className="archive-library" aria-label="Canned responses library">
      <div className="archive-page-heading">
        <div>
          <h1>Canned responses</h1>
        </div>
        <div className="archive-library-header-actions">
          <LiquidButton type="button" tone="neutral" className="archive-button" aria-expanded={transferOpen}
            onClick={openTransfer}>Import / Export</LiquidButton>
          <LiquidButton type="button" className="archive-button archive-button-primary" onClick={openCreate}>
            + New response
          </LiquidButton>
        </div>
      </div>
      {transferOpen && agent && <TransferWorkspace agent={agent} onClose={() => setTransferOpen(false)}
        reload={reload} onNotice={onNotice} onError={onError} />}
      {creating && (
        <form className="archive-card archive-create-form" onSubmit={event => void submitCreate(event)}>
          <LiquidUnderlay radius={18}/>
          <div className="archive-form-heading">
            <div>
              <h2>Add a canned response</h2>
              <p>Each shortcut can have multiple responses. Nothing will be overwritten.</p>
            </div>
            <LiquidButton type="button" tone="neutral" className="archive-button archive-button-quiet" onClick={cancelCreate}>Cancel</LiquidButton>
          </div>
          <div className="archive-visibility-options" role="group" aria-label="Response visibility" data-visibility={visibility}>
            <Glass className="archive-visibility-lens" radius={18} style={{ borderRadius:18, background:'var(--liquid-selection-fill)' }}
              optics={{ mapSize:96, depth:.56, curvature:.40, strength:.15, bend:.42, bendWidth:.13,
                dispersion:.12, sheen:.9, specular:.9, frost:0, clipToShape:true }}>
              <span/>
            </Glass>
            <button type="button" className={visibility === 'shared' ? 'active' : ''} aria-pressed={visibility === 'shared'}
              onClick={() => { setVisibility('shared'); setShowExisting(false); }}>Shared</button>
            <button type="button" className={visibility === 'private' ? 'active' : ''} aria-pressed={visibility === 'private'}
              onClick={() => { setVisibility('private'); setShowExisting(false); }}>Private</button>
          </div>
          <div className="archive-form-between">
            <label htmlFor="archive-response-body">Response text</label>
            <span className="archive-faint">{body.length}/10000 characters</span>
          </div>
          <textarea id="archive-response-body" rows={5} placeholder="Frequently used response…" value={body}
            onChange={event => setBody(event.target.value)} maxLength={10000} required />
          <label htmlFor="archive-shortcut-name">Shortcut</label>
          <div className="archive-shortcut-pick">
            <span aria-hidden="true" className="archive-hash-symbol">#</span>
            <input id="archive-shortcut-name" value={shortcut} autoComplete="off" required
              maxLength={65} pattern="#?[a-zA-Z0-9_][a-zA-Z0-9_ -]{0,63}"
              placeholder="Choose an existing shortcut or type a new one"
              onFocus={() => setShowExisting(true)}
              onChange={event => { setShortcut(event.target.value); setShowExisting(true); }} />
            {showExisting && existing.length > 0 && (
              <div className="archive-shortcut-menu" role="listbox" aria-label="Existing shortcuts">
                {existing.map(option => (
                  <button type="button" key={option.name.toLowerCase()} role="option" aria-selected={false}
                    onClick={() => { setShortcut(option.name); setShowExisting(false); }}>
                    <span>#{option.name}</span>
                    <span className="archive-faint">{formatCount(option.count, 'response')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="archive-hint">Use letters, numbers, spaces, underscores or hyphens (1–64 characters). Choosing an existing shortcut adds a new response to it.</p>
          <LiquidButton className="archive-button archive-button-primary" type="submit" disabled={saving || !body.trim() || !shortcut.trim()}>
            {saving ? 'Saving…' : 'Save response'}
          </LiquidButton>
        </form>
      )}
      <div className="archive-library-tools">
        <div className="archive-tabs" role="group" aria-label="Response visibility filters"
          style={{ '--filter-index': scope === 'all' ? 0 : scope === 'shared' ? 1 : scope === 'private' ? 2 : 3 } as CSSProperties}>
          <Glass className="archive-tabs-lens" radius={24}
            style={{ borderRadius: 24, background: 'var(--liquid-selection-fill)' }}
            optics={{ depth: .75, curvature: .4, strength: .17, bend: .48,
              bendWidth: .13, dispersion: .21, specular: 1.15, sheen: 1,
              frost: 0, clipToShape: true, softEdge: true }}>
            <span aria-hidden="true"/>
          </Glass>
          {(['all', 'shared', 'private', 'mine'] as const).map(item => (
            <button type="button" key={item} className={scope === item ? 'active' : ''} aria-pressed={scope === item}
              onClick={() => chooseScope(item)}>{item === 'mine' ? 'By me' : item[0]!.toUpperCase() + item.slice(1)}</button>
          ))}
        </div>
        <label className="archive-library-search">
          <span className="sr-only">Search response library</span>
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setSelectedIds(new Set()); }}
            placeholder="Search shortcuts and responses…" />
        </label>
        <LiquidButton className="archive-button archive-button-quiet" tone="neutral" type="button"
          onClick={() => {
            setDirectoryRefresh(version => version + 1);
            void reload().catch(err => onError(String(err)));
          }}>
          Refresh
        </LiquidButton>
        {agent && <LiquidButton className="archive-button archive-button-quiet" tone="neutral"
          type="button" disabled={bulkBusy || (!selectionMode && !selectableIds.length)}
          aria-pressed={selectionMode}
          onClick={() => {
            if (selectionMode) clearSelection();
            else { setCreating(false); setEditing(null); setTransferOpen(false); setSelectionMode(true); }
          }}>{selectionMode ? 'Done' : 'Select'}</LiquidButton>}
      </div>
      <div className="archive-list-summary" aria-live="polite">
        {loading ? 'Loading responses…' : formatCount(shown.length, 'response')}
        {!agent && <span> · All includes shared responses only. Sign in to see Private.</span>}
      </div>
      {selectionMode && (
        <div className="archive-selection-toolbar" role="group" aria-label="Bulk response actions">
          <span className="archive-selection-count" aria-live="polite">
            {bulkBusy ? `Deleting… ${bulkProgress}/${selectedIds.size}` :
              `${selectedIds.size} selected · ${selectableIds.length} available in this view`}
          </span>
          <button type="button" className="archive-button archive-button-quiet" disabled={bulkBusy || !selectableIds.length}
            onClick={() => setSelectedIds(previous => {
              const next = new Set(previous);
              if (allVisibleSelected) selectableIds.forEach(id => next.delete(id));
              else selectableIds.forEach(id => next.add(id));
              return next;
            })}>{allVisibleSelected ? 'Deselect all' : 'Select all'}</button>
          <button type="button" className="archive-button archive-button-quiet"
            disabled={bulkBusy || !selectedIds.size}
            onClick={() => setSelectedIds(new Set())}>Clear</button>
          <button type="button" className="archive-button archive-danger"
            disabled={bulkBusy || !selectedIds.size}
            onClick={() => void removeSelected()}>Delete selected ({selectedIds.size})</button>
          <span className="archive-selection-hint">Only responses you can manage are selectable.</span>
        </div>
      )}
      {shown.length ? (
        <div className="archive-response-list">
          {shown.map(item => {
            const permission = canManageResponse(agent, item);
            const creatorName = responseCreatorName(item, agent);
            const profile = creatorByName.get(creatorName.toLocaleLowerCase());
            return (
              <article className={`archive-response-row${selectedIds.has(item.id) ? ' is-selected' : ''}`} key={item.id}>
                <div className="archive-response-row-heading">
                  <div className="archive-row-labels">
                    {selectionMode && permission.delete && (
                      <label className="archive-row-select">
                        <input type="checkbox" checked={selectedIds.has(item.id)} disabled={bulkBusy}
                          onChange={() => toggleSelection(item.id)}
                          aria-label={`Select response under #${item.shortcut}`}/>
                      </label>
                    )}
                    <strong className="archive-shortcut-tag">#{item.shortcut}</strong>
                    <span className="archive-small-tag">{item.visibility === 'private' ? 'Private' : 'Shared'}</span>
                  </div>
                  <div className="archive-row-actions">
                    <button className="archive-button archive-button-quiet" type="button"
                      disabled={bulkBusy} onClick={() => void copy(item)}>Copy</button>
                    {!selectionMode && permission.edit && <button className="archive-button archive-button-quiet" type="button"
                      disabled={bulkBusy} onClick={() => {
                        setEditing(item);
                        setEditBody(item.body);
                        setEditShortcut(item.shortcut);
                        setEditVisibility(item.visibility);
                        setShowEditExisting(false);
                      }}>Edit</button>}
                    {!selectionMode && permission.delete && <button className="archive-button archive-button-quiet archive-danger" type="button"
                      disabled={bulkBusy || processingId === item.id} onClick={() => void remove(item)}>Delete</button>}
                  </div>
                </div>
                {editing?.id === item.id ? (
                  <form onSubmit={event => void saveEdit(event)} className="archive-edit-form">
                    <label htmlFor="archive-edit-body">Edit response text</label>
                    <textarea id="archive-edit-body" rows={4} value={editBody} onChange={event => setEditBody(event.target.value)}
                      maxLength={10000} required />
                    <label htmlFor="archive-edit-shortcut">Edit shortcut</label>
                    <div className="archive-shortcut-pick">
                      <span aria-hidden="true" className="archive-hash-symbol">#</span>
                      <input id="archive-edit-shortcut" autoComplete="off"
                        value={editShortcut} maxLength={65} required
                        pattern="#?[a-zA-Z0-9_][a-zA-Z0-9_ -]{0,63}"
                        onFocus={() => setShowEditExisting(true)}
                        onChange={event => { setEditShortcut(event.target.value); setShowEditExisting(true); }}
                        placeholder="New or existing shortcut" />
                      {showEditExisting && editExisting.length > 0 && (
                        <div className="archive-shortcut-menu" role="listbox" aria-label="Existing shortcuts for editing">
                          {editExisting.map(option => (
                            <button key={option.name.toLowerCase()} type="button" role="option" aria-selected={false}
                              onClick={() => { setEditShortcut(option.name); setShowEditExisting(false); }}>
                              <span>#{option.name}</span>
                              <span className="archive-faint">{formatCount(option.count, 'response')}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="archive-hint">Changing this shortcut moves only this response, not other responses sharing the old shortcut.</p>
                    <span className="archive-edit-label">Visibility</span>
                    <div className="archive-visibility-options archive-edit-visibility" role="group"
                      aria-label="Edit response visibility" data-visibility={editVisibility}>
                      <Glass className="archive-visibility-lens" radius={18}
                        style={{ borderRadius:18, background:'var(--liquid-selection-fill)' }}
                        optics={{ mapSize:96, depth:.56, curvature:.40, strength:.15, bend:.42, bendWidth:.13,
                          dispersion:.12, sheen:.9, specular:.9, frost:0, clipToShape:true }}>
                        <span/>
                      </Glass>
                      <button type="button" className={editVisibility === 'shared' ? 'active' : ''} aria-pressed={editVisibility === 'shared'}
                        onClick={() => { setEditVisibility('shared'); setShowEditExisting(false); }}>Shared</button>
                      <button type="button" className={editVisibility === 'private' ? 'active' : ''} aria-pressed={editVisibility === 'private'}
                        onClick={() => { setEditVisibility('private'); setShowEditExisting(false); }}>Private</button>
                    </div>
                    {editVisibility !== editing.visibility && <p className="archive-hint">
                      {editVisibility === 'shared'
                        ? 'This reply will become visible to everyone, including visitors without an account.'
                        : editing.ownedByMe
                          ? 'Only you will be able to view this reply after saving.'
                          : 'This reply will become private to its original creator. You will no longer be able to see it.'}
                    </p>}
                    <div className="archive-edit-actions">
                      <LiquidButton className="archive-button archive-button-primary" type="submit" disabled={saving || bulkBusy || !editBody.trim() || !editShortcut.trim()}>
                        {saving ? 'Saving…' : 'Save changes'}
                      </LiquidButton>
                      <button className="archive-button archive-button-quiet" type="button" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <p className="archive-response-text">{item.body}</p>
                )}
                <div className="archive-response-meta">
                  <span className="archive-response-attribution">
                    <AgentAvatar name={creatorName} url={profile?.avatar_url ?? null}/>
                    <span className="archive-response-attribution-text">
                      Added by <strong>{creatorName}</strong>,{' '}
                      <time dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </time>
                    </span>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="archive-empty-library">
          <h2>{loading ? 'Loading…' : 'No responses found'}</h2>
          <p>{search ? 'Try another search term.' : 'No saved responses in this view yet.'}</p>
          {!search && <LiquidButton className="archive-button archive-button-primary" type="button" onClick={openCreate}>Add a response</LiquidButton>}
        </div>
      )}
    </section>
  );
}
