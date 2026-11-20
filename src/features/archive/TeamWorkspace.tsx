import { useEffect, useState } from 'react';
import { getTeam, type TeamAgent } from './api';
import LiquidUnderlay from '../../ui/LiquidUnderlay';
import LiquidButton from '../../ui/LiquidButton';

export default function TeamWorkspace({ onError }: { onError: (message: string) => void }) {
  const [users, setUsers] = useState<TeamAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void getTeam().then(items => { if (active) setUsers(items); })
      .catch(error => { if (active) onError(error instanceof Error ? error.message : 'Unable to load agent statistics'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, onError]);
  return (
    <section className="archive-content-page" aria-label="Admin team overview">
      <div className="archive-page-heading">
        <div>
          <h1>Team overview</h1>
        </div>
        <LiquidButton tone="neutral" type="button" className="archive-button archive-button-quiet" onClick={() => setRefresh(value => value + 1)}>Refresh</LiquidButton>
      </div>
      <div className="archive-card archive-team-table-wrap">
        <LiquidUnderlay radius={18}/>
        {loading ? <p>Loading agents…</p> : (
          <table className="archive-team-table">
            <thead><tr><th>Agent</th><th>Role</th><th>Joined</th><th>Shared</th><th>Private</th></tr></thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.agent_name}</td>
                  <td>{user.role === 'admin' ? 'Administrator' : 'Agent'}</td>
                  <td>{new Date(user.joined_at).toLocaleDateString()}</td>
                  <td>{user.shared_count}</td>
                  <td>{user.private_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !users.length && <p>No registered agents to display.</p>}
      </div>
    </section>
  );
}
