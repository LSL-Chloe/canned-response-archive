import { useEffect, useMemo, useState } from 'react';
import { deleteAgent, getAdminAgents, type TeamAgent } from './api';
import AgentAvatar from './AgentAvatar';
import type { Agent } from './model';
import LiquidButton from '../../ui/LiquidButton';
import LiquidUnderlay from '../../ui/LiquidUnderlay';
import Icon from '../../ui/Icon';

export default function ManageAgentsWorkspace({
  agent, onNotice, onError,
}: {
  agent: Agent;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [users, setUsers] = useState<TeamAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<TeamAgent | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void getAdminAgents().then(items => { if (live) setUsers(items); })
      .catch(error => { if (live) onError(error instanceof Error ? error.message : 'Unable to load agents'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [refresh, onError]);

  useEffect(() => {
    if (!target || deleting) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setTarget(null);
        setConfirmation('');
      }
    }
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [target, deleting]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter(user =>
      !query || user.agent_name.toLowerCase().includes(query) || user.role.includes(query),
    ).sort((a, b) => b.joined_at.localeCompare(a.joined_at));
  }, [search, users]);

  function closeDialog() {
    if (deleting) return;
    setTarget(null);
    setConfirmation('');
  }
  async function removeAccount() {
    if (!target || deleting || target.id === agent.id || target.role === 'admin' ||
        confirmation !== target.agent_name) return;
    setDeleting(true);
    try {
      const result = await deleteAgent(target.id, confirmation);
      setUsers(previous => previous.filter(user => user.id !== target.id));
      setTarget(null);
      setConfirmation('');
      onNotice(result.avatarCleanupFailed
        ? `Deleted ${target.agent_name} and ${result.deleted_responses} responses. Their uploaded avatar could not be cleared; check Storage.`
        : `Deleted ${target.agent_name} and ${result.deleted_responses} responses. Their sessions were revoked.`);
      setRefresh(value => value + 1);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not delete the agent');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="archive-content-page archive-manage-agents" aria-label="Manage registered agents">
      <div className="archive-page-heading">
        <div>
          <h1>Manage agents</h1>
          <p>View registered accounts and remove agents who no longer need access.</p>
        </div>
        <LiquidButton type="button" tone="neutral" className="archive-button archive-button-quiet"
          onClick={() => setRefresh(value => value + 1)}>Refresh</LiquidButton>
      </div>
      <div className="archive-admin-agents-tools">
        <label className="archive-library-search">
          <span className="sr-only">Search registered agents</span>
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Search agents…" />
        </label>
        <span className="archive-faint" aria-live="polite">
          {loading ? 'Loading agents…' : `${filtered.length} of ${users.length} registered accounts`}
        </span>
      </div>
      <div className="archive-card archive-team-table-wrap archive-admin-agents-table">
        {loading ? <p role="status">Loading registered agents…</p> : filtered.length ? (
          <table className="archive-team-table">
            <thead><tr><th>Agent</th><th>Role</th><th>Joined</th><th>Shared</th><th>Private</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id}>
                  <td className="archive-admin-agent-name">
                    <span className="archive-directory-identity">
                      <AgentAvatar name={user.agent_name} url={user.avatar_url}/>
                      <span>{user.agent_name}{user.id === agent.id && <span className="archive-faint"> (you)</span>}</span>
                    </span>
                  </td>
                  <td>{user.role === 'admin' ? 'Administrator' : 'Agent'}</td>
                  <td>{new Date(user.joined_at).toLocaleDateString()}</td>
                  <td>{user.shared_count}</td>
                  <td>{user.private_count}</td>
                  <td>
                    {user.id === agent.id || user.role === 'admin'
                      ? <span className="archive-faint">Protected</span>
                      : <button type="button" className="archive-button archive-button-quiet archive-danger"
                          aria-label={`Delete agent ${user.agent_name}`}
                          onClick={() => { setConfirmation(''); setTarget(user); }}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>{search.trim() ? 'No agents match your search.' : 'No registered agents to display.'}</p>}
      </div>
      <p className="archive-hint">Your administrator account is protected from deletion. Removing an agent permanently deletes their shared and private responses. Shared shortcuts used by other agents remain available.</p>
      {target && (
        <div className="archive-dialog-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closeDialog();
        }}>
          <section className="archive-dialog archive-card archive-admin-delete-dialog"
            role="dialog" aria-modal="true" aria-labelledby="archive-delete-agent-title">
            <LiquidUnderlay radius={22}/>
            <div className="archive-dialog-heading">
              <div>
                <p className="archive-kicker">ACCOUNT MANAGEMENT</p>
                <h2 id="archive-delete-agent-title">Delete {target.agent_name}?</h2>
              </div>
              <button className="archive-button archive-button-quiet" type="button"
                onClick={closeDialog} disabled={deleting} aria-label="Cancel account deletion">
                <Icon name="close" size={16}/>
              </button>
            </div>
            <p>This permanently removes the agent's account, their {target.shared_count} shared and {target.private_count} private responses, and revokes their active sessions. This cannot be undone.</p>
            <p>Shared shortcuts used by other agents will be preserved.</p>
            <label htmlFor="archive-admin-confirm-agent">Type <strong>{target.agent_name}</strong> to confirm</label>
            <input id="archive-admin-confirm-agent" type="text" autoFocus autoComplete="off" spellCheck={false}
              value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={deleting}/>
            <div className="archive-admin-delete-actions">
              <button type="button" className="archive-button archive-button-quiet"
                disabled={deleting} onClick={closeDialog}>Cancel</button>
              <LiquidButton type="button" tone="neutral" className="archive-button archive-danger"
                disabled={deleting || confirmation !== target.agent_name}
                onClick={() => { void removeAccount(); }}>{deleting ? 'Deleting…' : 'Permanently delete agent'}</LiquidButton>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
