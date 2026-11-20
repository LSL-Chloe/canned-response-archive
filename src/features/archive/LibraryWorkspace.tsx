import { Glass } from '@samasante/liquid-glass';
import LiquidButton from '../../ui/LiquidButton';
import LiquidUnderlay from '../../ui/LiquidUnderlay';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { addResponse, deleteResponse, updateResponse } from './api';
import TransferWorkspace from './TransferWorkspace';
import {
  canManageResponse, formatCount, shortcutOptions,
  type Agent, type ArchiveResponse, type LibraryScope, type Visibility,
} from './model';

interface Props {
  agent: Agent | null;
  records: ArchiveResponse[];
  loading: boolean;
  pendingAction: 'private' | 'create' | 'transfer' | null;
  onHandled: () => void;
  onRequireLogin: (reason: 'private' | 'create' | 'transfer') => void;
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
  const [showEditExisting, setShowEditExisting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!agent && scope === 'private') setScope('all');
  }, [agent, scope]);
  useEffect(() => {
    if (!agent || !pendingAction) return;
    if (pendingAction === 'private') setScope('private');
    if (pendingAction === 'create') setCreating(true);
    if (pendingAction === 'transfer') setTransferOpen(true);
    onHandled();
  }, [agent, pendingAction, onHandled]);

  const shown = useMemo(() => {
    const term = search.toLowerCase().trim();
    return records
      .filter(item => scope === 'all' || item.visibility === scope)
      .filter(item => !term || item.shortcut.toLowerCase().includes(term) ||
        item.body.toLowerCase().includes(term) || item.createdBy?.toLowerCase().includes(term))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [records, scope, search]);
  const existing = useMemo(
    () => shortcutOptions(records, visibility, shortcut),
    [records, visibility, shortcut],
  );
  const editExisting = useMemo(
    () => editing ? shortcutOptions(records, editing.visibility, editShortcut) : [],
    [records, editing, editShortcut],
  );

  function chooseScope(next: LibraryScope) {
    if (next === 'private' && !agent) {
      onRequireLogin('private');
      return;
    }
    setScope(next);
  }
  function openTransfer() {
    if (!agent) { onRequireLogin('transfer'); return; }
    setCreating(false);
    setEditing(null);
    setTransferOpen(open => !open);
  }
  function openCreate() {
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
    if (!editing || saving) return;
    setSaving(true);
    try {
      await updateResponse(editing.id, editBody, editShortcut.trim());
      setEditing(null);
      onNotice('Response text and shortcut saved. Other responses under the original shortcut are unchanged.');
      void reload().catch(err => onError(err instanceof Error ? err.message : 'Could not refresh responses'));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not update response');
    } finally { setSaving(false); }
  }
  async function remove(item: ArchiveResponse) {
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
              maxLength={65} pattern="#?[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}"
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
          <p className="archive-hint">Use letters, numbers, underscores or hyphens (1–64 characters). Choosing an existing shortcut adds a new response to it.</p>
          <LiquidButton className="archive-button archive-button-primary" type="submit" disabled={saving || !body.trim() || !shortcut.trim()}>
            {saving ? 'Saving…' : 'Save response'}
          </LiquidButton>
        </form>
      )}
      <div className="archive-library-tools">
        <div className="archive-tabs" role="group" aria-label="Response visibility filters"
          style={{ '--filter-index': scope === 'all' ? 0 : scope === 'shared' ? 1 : 2 } as CSSProperties}>
          <Glass className="archive-tabs-lens" radius={24}
            style={{ borderRadius: 24, background: 'var(--liquid-selection-fill)' }}
            optics={{ depth: .75, curvature: .4, strength: .17, bend: .48,
              bendWidth: .13, dispersion: .21, specular: 1.15, sheen: 1,
              frost: 0, clipToShape: true, softEdge: true }}>
            <span aria-hidden="true"/>
          </Glass>
          {(['all', 'shared', 'private'] as const).map(item => (
            <button type="button" key={item} className={scope === item ? 'active' : ''} aria-pressed={scope === item}
              onClick={() => chooseScope(item)}>{item[0]!.toUpperCase() + item.slice(1)}</button>
          ))}
        </div>
        <label className="archive-library-search">
          <span className="sr-only">Search response library</span>
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Search shortcuts and responses…" />
        </label>
        <LiquidButton className="archive-button archive-button-quiet" tone="neutral" type="button"
          onClick={() => void reload().catch(err => onError(String(err)))}>
          Refresh
        </LiquidButton>
      </div>
      <div className="archive-list-summary" aria-live="polite">
        {loading ? 'Loading responses…' : formatCount(shown.length, 'response')}
        {!agent && <span> · All includes shared responses only. Sign in to see Private.</span>}
      </div>
      {shown.length ? (
        <div className="archive-response-list">
          <LiquidUnderlay radius={18}/>
          {shown.map(item => {
            const permission = canManageResponse(agent, item);
            return (
              <article className="archive-response-row" key={item.id}>
                <div className="archive-response-row-heading">
                  <div className="archive-row-labels">
                    <strong className="archive-shortcut-tag">#{item.shortcut}</strong>
                    <span className="archive-small-tag">{item.visibility === 'private' ? 'Private' : 'Shared'}</span>
                  </div>
                  <div className="archive-row-actions">
                    <button className="archive-button archive-button-quiet" type="button" onClick={() => void copy(item)}>Copy</button>
                    {permission.edit && <button className="archive-button archive-button-quiet" type="button"
                      onClick={() => {
                        setEditing(item);
                        setEditBody(item.body);
                        setEditShortcut(item.shortcut);
                        setShowEditExisting(false);
                      }}>Edit</button>}
                    {permission.delete && <button className="archive-button archive-button-quiet archive-danger" type="button"
                      disabled={processingId === item.id} onClick={() => void remove(item)}>Delete</button>}
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
                        pattern="#?[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}"
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
                    <div>
                      <LiquidButton className="archive-button archive-button-primary" type="submit" disabled={saving || !editBody.trim() || !editShortcut.trim()}>
                        {saving ? 'Saving…' : 'Save changes'}
                      </LiquidButton>
                      <button className="archive-button archive-button-quiet" type="button" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <p className="archive-response-text">{item.body}</p>
                )}
                <div className="archive-response-meta">
                  {item.visibility === 'shared' && <span>Created by {item.createdBy || 'Unknown agent'} · </span>}
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time>
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
