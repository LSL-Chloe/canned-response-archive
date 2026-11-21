import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ApiProblem, fetchFeed, login, logout, session } from './api';
import type { Agent, ArchiveResponse } from './model';
import SearchWorkspace from './SearchWorkspace';
import LibraryWorkspace from './LibraryWorkspace';
import SettingsWorkspace from './SettingsWorkspace';
import TeamWorkspace from './TeamWorkspace';
import Icon from '../../ui/Icon';
import ThemeToggle from '../../ui/ThemeToggle';
import OpticalBackdrop from '../../ui/OpticalBackdrop';
import LiquidUnderlay from '../../ui/LiquidUnderlay';
import { avatarImageSrc } from './avatarImages';
import { featuredAvatars } from './curatedAvatarCatalog';
import type { Theme } from '../../ui/theme';
import { Glass } from '@samasante/liquid-glass';

type Page = 'search' | 'library' | 'team' | 'settings';
type LoginIntent = 'private' | 'create' | 'transfer' | null;

function LoginDialog({
  intent, onClose, onSuccess,
}: {
  intent: LoginIntent;
  onClose: () => void;
  onSuccess: (agent: Agent) => void;
}) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setProblem('');
    void login(name.trim(), pin).then(onSuccess)
      .catch(error => { setProblem(error instanceof Error ? error.message : 'Sign in failed.'); })
      .finally(() => { setBusy(false); setPin(''); });
  }
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [onClose]);

  return (
    <div className="archive-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="archive-dialog archive-card" role="dialog" aria-modal="true" aria-labelledby="archive-login-title">
        <LiquidUnderlay radius={22}/>
        <div className="archive-dialog-heading">
          <div>
            <p className="archive-kicker">ACCOUNT ACCESS</p>
            <h2 id="archive-login-title">Sign in to continue</h2>
          </div>
          <button className="archive-button archive-button-quiet" type="button" onClick={onClose} aria-label="Close sign in">✕</button>
        </div>
        <p>{intent === 'private' ? 'Your private responses are only available after signing in.' :
          intent === 'create' ? 'Sign in to save a new shared or private response.' :
          intent === 'transfer' ? 'Sign in to import or export your private responses. Shared imports and exports are admin-only.' :
            'Sign in to access your own responses and account tools.'}</p>
        <form className="archive-login-form" onSubmit={submit}>
          <label htmlFor="archive-login-name">Agent name</label>
          <input id="archive-login-name" autoFocus autoComplete="username" required value={name}
            onChange={event => setName(event.target.value)} minLength={2} maxLength={48}/>
          <label htmlFor="archive-login-pin">Four-digit PIN</label>
          <input id="archive-login-pin" type="password" inputMode="numeric" autoComplete="current-password"
            pattern="[0-9]{4}" maxLength={4} required value={pin}
            onChange={event => setPin(event.target.value)} />
          {problem && <p className="archive-message archive-message-error" role="alert">{problem}</p>}
          <button className="archive-button archive-button-primary" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="archive-dialog-links">
          <a href="/auth?mode=signup">Create an account</a>
          <a href="/auth?mode=recover">Forgot PIN?</a>
        </div>
        <p className="archive-hint">Your agent session is kept securely in a browser cookie.</p>
      </section>
    </div>
  );
}

export default function ArchiveApp({ theme, onThemeToggle }: {
  theme: Theme;
  onThemeToggle: () => void;
}) {
  const [page, setPage] = useState<Page>('search');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(max-width: 780px)').matches);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [shared, setShared] = useState<ArchiveResponse[]>([]);
  const [privateRows, setPrivateRows] = useState<ArchiveResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginIntent, setLoginIntent] = useState<LoginIntent>(null);
  const [pendingAction, setPendingAction] = useState<LoginIntent>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const requestSerial = useRef(0);
  // Warm the fixed, lightweight avatar shelves after sign-in. Settings does not
  // wait on this prefetch; thumbnails still have normal browser-cache semantics.
  useEffect(() => {
    if (!agent) return;
    const saveData=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData;
    if(saveData)return;
    const warm=(urls:string[])=>{for(const url of urls){const image=new Image();image.decoding='async';image.src=url;}};
    warm(featuredAvatars.anime.map(item=>item.imageUrl));
    const later=window.setTimeout(()=>{
      warm([...featuredAvatars.tv,...featuredAvatars.movie].map(item=>item.imageUrl));
    },1000);
    return ()=>window.clearTimeout(later);
  },[agent?.id]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 5500);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const onNotice = useCallback((message: string) => { setNotice(message); setProblem(''); }, []);
  const onError = useCallback((message: string) => { setProblem(message); setNotice(''); }, []);

  const refresh = useCallback(async (silent = false) => {
    const serial = ++requestSerial.current;
    if (!silent) setLoading(true);
    try {
      const data = await Promise.all([
        fetchFeed('shared'),
        agent ? fetchFeed('private') : Promise.resolve([] as ArchiveResponse[]),
      ]);
      if (serial !== requestSerial.current) return;
      setShared(data[0]);
      setPrivateRows(agent ? data[1] : []);
    } catch (error) {
      if (serial !== requestSerial.current) return;
      if (error instanceof ApiProblem && error.status === 401 && agent) {
        setAgent(null);
        setPrivateRows([]);
        onError('Your session expired. Sign in again to see private responses.');
      } else if (!silent) {
        onError(error instanceof Error ? error.message : 'Could not load responses.');
      }
    } finally {
      if (serial === requestSerial.current) setLoading(false);
    }
  }, [agent, onError]);

  useEffect(() => {
    let live = true;
    void session().then(user => { if (live) setAgent(user); })
      .catch(() => { if (live) onError('Could not check sign-in status. Shared responses may still be available.'); })
      .finally(() => { if (live) setSessionLoading(false); });
    return () => { live = false; };
  }, [onError]);

  useEffect(() => {
    if (!agent) { setAvatarUrl(null); return; }
    let live = true;
    void import('./api').then(({ api }) => api<{ avatarUrl: string | null }>('/api/account/avatar'))
      .then(result => { if (live) setAvatarUrl(result.avatarUrl); })
      .catch(() => { if (live) setAvatarUrl(null); });
    return () => { live = false; };
  }, [agent?.id]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    function update() { if (!document.hidden) void refresh(true); }
    const interval = window.setInterval(update, 5000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);

  const responses = [...shared, ...privateRows];
  const selectedTab = page === 'search' ? 0 : page === 'library' ? 1 : page === 'team' ? 2 : -1;

  function requireLogin(reason: 'private' | 'create' | 'transfer') {
    setLoginIntent(reason);
    setPendingAction(reason);
    setLoginOpen(true);
  }
  const closeLogin = useCallback(() => {
    setLoginOpen(false);
    setLoginIntent(null);
    setPendingAction(null);
  }, []);
  function signedIn(user: Agent) {
    setAgent(user);
    setLoginOpen(false);
    setLoginIntent(null);
    setPage(pendingAction ? 'library' : 'search');
    onNotice(`Signed in as ${user.agent_name}.`);
  }
  async function signOut() {
    setAccountMenuOpen(false);
    try {
      await logout();
      setAgent(null);
      setPrivateRows([]);
      setPage('search');
      onNotice('Signed out. Shared responses remain available.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Sign out failed.');
    }
  }
  function navigate(target: Page) {
    setAccountMenuOpen(false);
    if (target === 'team' && agent?.role !== 'admin') return;
    if (target === 'settings' && !agent) { setLoginOpen(true); return; }
    setPage(target);
  }

  return (
    <div className={`archive-app ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`} data-theme={theme}>
      <OpticalBackdrop/>
      <button type="button" className="archive-sidebar-scrim" aria-label="Close navigation"
        onClick={() => setSidebarCollapsed(true)} />
      <aside className="archive-sidebar">
        <div className="archive-sidebar-header">
          <div className="archive-brand"><span className="archive-brand-mark"><Icon name="library" size={19}/></span><span className="archive-brand-text">Archive</span></div>
          <button type="button" className="archive-collapse-toggle"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed(value => !value)}>
            <Icon name="panel" size={17}/>
          </button>
        </div>
        <nav aria-label="Main navigation" className={`archive-nav${selectedTab < 0 ? ' no-selection' : ''}`}
          style={{ '--active-tab': selectedTab } as CSSProperties}>
          <Glass className="archive-nav-selection" radius={30} style={{
            borderRadius: 30, background: 'var(--liquid-selection-fill)',
          }} optics={{
            mapSize: 256, depth: .78, curvature: .48, strength: .19,
            bend: .49, bendWidth: .12, dispersion: .24,
            sheen: 1.08, sheenWidth: 1.55, specular: 1.25,
            glow: .16, frost: 0, clipToShape: true, softEdge: true,
          }}>
            <span className="archive-nav-selection-center" aria-hidden="true"/>
          </Glass>
          <button type="button" className={page === 'search' ? 'active' : ''} aria-current={page === 'search' ? 'page' : undefined}
            onClick={() => navigate('search')} title="Search workspace">
            <span className="archive-nav-icon"><Icon name="search" size={20}/></span>
            <span className="archive-nav-label">Search workspace</span>
          </button>
          <button type="button" className={page === 'library' ? 'active' : ''} aria-current={page === 'library' ? 'page' : undefined}
            onClick={() => navigate('library')} title="Canned responses">
            <span className="archive-nav-icon"><Icon name="library" size={20}/></span>
            <span className="archive-nav-label">Canned responses</span>
          </button>
          {agent?.role === 'admin' && (
            <button type="button" className={page === 'team' ? 'active' : ''} aria-current={page === 'team' ? 'page' : undefined}
              onClick={() => navigate('team')} title="Team overview">
              <span className="archive-nav-icon"><Icon name="team" size={20}/></span>
              <span className="archive-nav-label">Team overview</span>
            </button>
          )}
        </nav>
      </aside>
      <div className="archive-main">
        <header className="archive-topbar">
          <div className="archive-topbar-title">
            <strong>{page === 'search' ? 'Search' : page === 'library' ? 'Canned responses' : page === 'team' ? 'Team' : 'Settings'}</strong>
          </div>
          <div className="archive-topbar-right">
            <ThemeToggle theme={theme} onToggle={onThemeToggle} compact/>
            {sessionLoading ? (
              <span className="archive-faint">Checking session…</span>
            ) : agent ? (
              <div className="archive-account-wrap">
                <button className="archive-account-button" type="button" aria-haspopup="menu"
                  aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(open => !open)}>
                  <span className="archive-avatar">{avatarUrl ? <img src={avatarImageSrc(avatarUrl)} alt=""/> : agent.agent_name.charAt(0).toUpperCase()}</span>
                  <span>{agent.agent_name}</span>
                  <Icon name="chevron" size={14}/>
                </button>
                {accountMenuOpen && (
                  <div className="archive-account-menu" role="menu">
                    <button role="menuitem" type="button" onClick={() => navigate('settings')}><Icon name="settings" size={15}/> Settings</button>
                    <button role="menuitem" type="button" onClick={() => void signOut()}><Icon name="logout" size={15}/> Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <a href="/auth?mode=login" className="archive-button archive-button-primary archive-sign-in-link">Sign in</a>
            )}
          </div>
        </header>
        <main className="archive-stage">
          {(notice || problem) && (
            <div className={`archive-message ${problem ? 'archive-message-error' : 'archive-message-ok'}`} role={problem ? 'alert' : 'status'}>
              <span className="archive-message-symbol"><Icon name={problem ? 'shield' : 'check'} size={17}/></span>
              <span className="archive-message-copy">{problem || notice}</span>
              <button type="button" aria-label="Dismiss notification" onClick={() => { setProblem(''); setNotice(''); }}><Icon name="close" size={15}/></button>
            </div>
          )}
          {page === 'search' && <SearchWorkspace responses={responses} loading={loading} onNotice={onNotice} onError={onError}/>}
          {page === 'library' && <LibraryWorkspace agent={agent} records={responses} loading={loading}
            pendingAction={pendingAction} onHandled={() => setPendingAction(null)} onRequireLogin={requireLogin}
            reload={() => refresh()} onNotice={onNotice} onError={onError}/>}
          {page === 'settings' && agent && <SettingsWorkspace agent={agent} onAgentChange={setAgent} avatarUrl={avatarUrl} onAvatarChange={setAvatarUrl}
            onNotice={onNotice} onError={onError}/>}
          {page === 'team' && agent?.role === 'admin' && <TeamWorkspace onError={onError}/>}
        </main>
      </div>
      {loginOpen && <LoginDialog intent={loginIntent} onClose={closeLogin} onSuccess={signedIn}/>}
    </div>
  );
}
