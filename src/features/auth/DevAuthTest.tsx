import { useEffect, useState, type FormEvent } from 'react';

type Agent = { id: string; agent_name: string; role: 'admin' | 'agent' };
type Mode = 'signup' | 'login' | 'recover';
type VerifyMode = 'signup' | 'recover' | null;
type ApiResult = {
  message?: string;
  error?: string;
  user?: Agent | null;
  verificationRequired?: boolean;
  challengeId?: string;
  pinReset?: boolean;
};

async function request(endpoint: string, payload?: Record<string, string>): Promise<ApiResult> {
  const response = await fetch(endpoint, {
    method: payload === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    ...(payload === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  });
  const data = (await response.json()) as ApiResult;
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data;
}

/**
 * Temporary development QA page.
 * The final user-facing authentication screens and motion/design system are separate.
 */
export default function DevAuthTest() {
  const [mode, setMode] = useState<Mode>('signup');
  const [user, setUser] = useState<Agent | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [agentName, setAgentName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [verifyMode, setVerifyMode] = useState<VerifyMode>(null);

  useEffect(() => {
    let active = true;
    void request('/api/auth/me')
      .then((data) => { if (active) setUser(data.user ?? null); })
      .catch(() => { if (active) setProblem('Cannot read session. Check the Worker configuration.'); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setNotice('');
    setProblem('');
    try { await task(); }
    catch (error) {
      setProblem(error instanceof Error ? error.message : 'The request failed. Please retry.');
    } finally { setBusy(false); }
  }

  const signup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const data = await request('/api/auth/signup', {
        agentName: agentName.trim(),
        pin,
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setPin('');
      if (data.verificationRequired && data.challengeId) {
        setChallenge(data.challengeId);
        setVerifyMode('signup');
        setNotice('Verification email requested. Open your inbox and enter the six-digit code.');
      } else if (data.user) {
        setUser(data.user);
        setNotice('Account created. No verified recovery email is attached.');
      } else throw new Error('Unexpected signup response');
    });
  };

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const data = await request('/api/auth/login', { agentName: agentName.trim(), pin });
      setPin('');
      if (!data.user) throw new Error('Login returned no account.');
      setUser(data.user);
      setNotice('Signed in successfully.');
    });
  };

  const startRecovery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const data = await request('/api/otp/recovery/start', { email: email.trim() });
      if (!data.challengeId) throw new Error('Recovery did not return a verification request.');
      setChallenge(data.challengeId);
      setVerifyMode('recover');
      setNotice(data.message || 'If a verified account exists, a code has been emailed.');
    });
  };

  const verify = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verifyMode) return;
    void run(async () => {
      if (verifyMode === 'signup') {
        const data = await request('/api/otp/signup/verify', { challengeId: challenge, code });
        if (!data.user) throw new Error('Verification did not return an account.');
        setUser(data.user);
        setNotice('Email verified. Your account is now active.');
      } else {
        const data = await request('/api/otp/recovery/verify', { challengeId: challenge, code, newPin });
        if (!data.pinReset) throw new Error('PIN recovery did not complete.');
        setMode('login');
        setNotice('PIN reset. Sign in with the new PIN.');
      }
      setChallenge('');
      setCode('');
      setNewPin('');
      setVerifyMode(null);
    });
  };

  const logout = () => {
    void run(async () => {
      await request('/api/auth/logout', {});
      setUser(null);
      setMode('login');
      setNotice('Signed out.');
    });
  };

  function chooseMode(next: Mode) {
    setMode(next);
    setVerifyMode(null);
    setChallenge('');
    setCode('');
    setPin('');
    setNewPin('');
    setNotice('');
    setProblem('');
  }

  return (
    <main className="qa-shell">
      <header className="qa-heading">
        <a href="/" className="qa-back">← Response archive</a>
        <p className="eyebrow">CANNED RESPONSE ARCHIVE · DEVELOPMENT ONLY</p>
        <h1>Authentication test</h1>
        <p className="intro">A temporary functional test screen, not the final signup or login design.</p>
      </header>

      <section className="qa-panel" aria-label="Development authentication tools">
        <p className="qa-warning">
          Before creating an account, replace any PIN_PEPPER that appeared in chat with a new
          securely generated value in Cloudflare and deploy it. This test uses the development
          database; becoming its admin does not create a production admin.
        </p>

        {checking ? <p role="status">Checking your current session…</p> : user ? (
          <div className="qa-signed-in">
            <h2>Signed in</h2>
            <p><strong>Agent:</strong> {user.agent_name}</p>
            <p><strong>Role:</strong> {user.role === 'admin' ? 'Administrator' : 'Agent'}</p>
            <button type="button" disabled={busy} onClick={logout}>Sign out</button>
          </div>
        ) : (
          <>
            <nav className="qa-modes" aria-label="Authentication test mode">
              <button type="button" disabled={busy} aria-pressed={mode === 'signup'} onClick={() => chooseMode('signup')}>Sign up</button>
              <button type="button" disabled={busy} aria-pressed={mode === 'login'} onClick={() => chooseMode('login')}>Log in</button>
              <button type="button" disabled={busy} aria-pressed={mode === 'recover'} onClick={() => chooseMode('recover')}>Recover PIN</button>
            </nav>

            {verifyMode ? (
              <form className="qa-form" onSubmit={verify}>
                <h2>{verifyMode === 'signup' ? 'Verify signup email' : 'Verify PIN recovery'}</h2>
                <p className="qa-help">The code expires after 10 minutes. It is never shown on this website.</p>
                <label htmlFor="qa-otp">Six-digit code</label>
                <input id="qa-otp" name="one-time-code" value={code} onChange={e => setCode(e.target.value)}
                  inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code"
                  placeholder="000000" required />
                {verifyMode === 'recover' && (
                  <>
                    <label htmlFor="qa-new-pin">New four-digit PIN</label>
                    <input id="qa-new-pin" type="password" value={newPin} onChange={e => setNewPin(e.target.value)}
                      inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" required />
                  </>
                )}
                <button disabled={busy} type="submit">{busy ? 'Checking…' : 'Verify code'}</button>
                <button type="button" className="qa-secondary" onClick={() => chooseMode(mode)} disabled={busy}>Start over</button>
              </form>
            ) : mode === 'signup' || mode === 'login' ? (
              <form className="qa-form" onSubmit={mode === 'signup' ? signup : login}>
                <h2>{mode === 'signup' ? 'Create development account' : 'Sign in to development'}</h2>
                <label htmlFor="qa-agent">Agent name</label>
                <input id="qa-agent" value={agentName} onChange={e => setAgentName(e.target.value)}
                  autoComplete="username" minLength={2} maxLength={48} required />
                {mode === 'signup' && (
                  <>
                    <label htmlFor="qa-email">Email (optional)</label>
                    <input id="qa-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                      autoComplete="email" placeholder="you@example.com" />
                    <p className="qa-help">Optional, but without a verified email your PIN cannot be recovered.</p>
                  </>
                )}
                <label htmlFor="qa-pin">Four-digit PIN</label>
                <input id="qa-pin" type="password" value={pin} onChange={e => setPin(e.target.value)}
                  inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
                <button type="submit" disabled={busy}>{busy ? 'Submitting…' : mode === 'signup' ? 'Start signup' : 'Log in'}</button>
              </form>
            ) : (
              <form className="qa-form" onSubmit={startRecovery}>
                <h2>Recover forgotten PIN</h2>
                <label htmlFor="qa-recovery-email">Verified account email</label>
                <input id="qa-recovery-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email" required />
                <p className="qa-help">We'll send a code only if this is a verified account email.</p>
                <button type="submit" disabled={busy}>{busy ? 'Requesting…' : 'Request recovery code'}</button>
              </form>
            )}
          </>
        )}
        {problem && <p role="alert" className="qa-error">{problem}</p>}
        {notice && <p role="status" className="qa-notice">{notice}</p>}
      </section>
      <p className="qa-footer">Temporary QA page · Don't share PINs or OTP codes in screenshots or chat.</p>
    </main>
  );
}
