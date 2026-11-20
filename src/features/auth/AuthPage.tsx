import LiquidButton from '../../ui/LiquidButton';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../archive/api';
import type { Agent } from '../archive/model';
import Icon from '../../ui/Icon';
import ThemeToggle from '../../ui/ThemeToggle';
import OpticalBackdrop from '../../ui/OpticalBackdrop';
import LiquidUnderlay from '../../ui/LiquidUnderlay';
import { Glass } from '@samasante/liquid-glass';
import { OtpCells, OtpRing } from './OtpVisual';
import type { Theme } from '../../ui/theme';

type Mode = 'login' | 'signup' | 'recover';
type Stage = 'form' | 'otp' | 'success' | 'reset';
type AuthReply = {
  user?: Agent | null;
  verificationRequired?: boolean;
  challengeId?: string;
  pinReset?: boolean;
  message?: string;
};
const OTP_SECONDS = 10 * 60;

export default function AuthPage({ theme, onThemeToggle }: { theme: Theme; onThemeToggle: () => void }) {
  const params = new URLSearchParams(window.location.search);
  const initial = params.get('mode');
  const [mode, setMode] = useState<Mode>(
    initial === 'signup' || initial === 'recover' ? initial : 'login',
  );
  const [stage, setStage] = useState<Stage>('form');
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<Agent | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(OTP_SECONDS);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void api<{ user: Agent | null }>('/api/auth/me').then(data => {
      if (active && data.user) { setUser(data.user); setStage('success'); }
    }).catch(() => {
      if (active) setProblem('Unable to check your session. Try refreshing the page.');
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (stage !== 'otp') return;
    codeInput.current?.focus();
    const end = Date.now() + OTP_SECONDS * 1000;
    const timer = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [stage, challenge]);

  function selectMode(next: Mode) {
    if (busy) return;
    setMode(next); setStage('form'); setProblem(''); setNotice('');
    setChallenge(''); setCode(''); setPin(''); setNewPin('');
    window.history.replaceState(null, '', `/auth?mode=${next}`);
  }

  async function run(task: () => Promise<void>) {
    setBusy(true); setProblem(''); setNotice('');
    try { await task(); }
    catch (error) { setProblem(error instanceof Error ? error.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      if (mode === 'login') {
        const data = await api<AuthReply>('/api/auth/login', {
          method: 'POST', body: JSON.stringify({ agentName: name.trim(), pin }),
        });
        setPin('');
        if (!data.user) throw new Error('Sign in did not return an account.');
        setUser(data.user); setStage('success');
        return;
      }
      if (mode === 'signup') {
        const data = await api<AuthReply>('/api/auth/signup', {
          method: 'POST', body: JSON.stringify({
            agentName: name.trim(), pin,
            ...(email.trim() ? { email: email.trim() } : {}),
          }),
        });
        setPin('');
        if (data.verificationRequired && data.challengeId) {
          setChallenge(data.challengeId); setCode(''); setSecondsLeft(OTP_SECONDS); setStage('otp');
          setNotice('Verification code sent. Check your email inbox.');
        } else if (data.user) {
          setUser(data.user); setStage('success');
          setNotice('Account created. Without a verified email, a forgotten PIN cannot be recovered.');
        } else throw new Error('Unexpected account creation response.');
        return;
      }
      const data = await api<AuthReply>('/api/otp/recovery/start', {
        method: 'POST', body: JSON.stringify({ email: email.trim() }),
      });
      if (!data.challengeId) throw new Error('Unable to start PIN recovery.');
      setChallenge(data.challengeId); setCode(''); setSecondsLeft(OTP_SECONDS); setStage('otp');
      setNotice(data.message || 'If this address belongs to a verified account, a code has been sent.');
    });
  }

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (secondsLeft <= 0 || code.length !== 6) return;
    void run(async () => {
      if (mode === 'signup') {
        const data = await api<AuthReply>('/api/otp/signup/verify', {
          method: 'POST', body: JSON.stringify({ challengeId: challenge, code }),
        });
        if (!data.user) throw new Error('Verification did not return an account.');
        setUser(data.user); setStage('success');
      } else {
        const data = await api<AuthReply>('/api/otp/recovery/verify', {
          method: 'POST', body: JSON.stringify({ challengeId: challenge, code, newPin }),
        });
        if (!data.pinReset) throw new Error('PIN recovery was not confirmed.');
        setStage('reset');
      }
      setCode(''); setChallenge(''); setNewPin('');
    });
  }

  async function signOut() {
    await run(async () => {
      await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
      setUser(null);setMode('login');setStage('form');setProblem('');
      setChallenge('');setCode('');setPin('');setNewPin('');
      window.history.replaceState(null, '', '/auth?mode=login');
      setNotice('You have signed out.');
    });
  }

  const otpProgress = code.length / 6;
  return (
    <main className="auth-experience" data-theme={theme}>
      <OpticalBackdrop/>
      <header className="auth-nav">
        <a href="/" className="auth-brand">Response Archive</a>
        <div className="auth-nav-actions">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} compact/>
        </div>
      </header>

      <section className="auth-layout">
        <section className="auth-card glass-panel" aria-label="Account access">
          <LiquidUnderlay radius={22}/>
          <div className="auth-card-inner">
            {checking ? (
              <div className="auth-loading" role="status">Checking your session…</div>
            ) : stage === 'success' && user ? (
              <div className="auth-result auth-result-success">
                <OtpRing progress={1} verified/>
                <span className="auth-eyebrow">ACCESS GRANTED</span>
                <h2>{mode === 'signup' ? 'You’re verified.' : 'Welcome back.'}</h2>
                <p>Signed in as <strong>{user.agent_name}</strong>. Your response workspace is ready.</p>
                <a href="/" className="auth-primary auth-link-button">Enter workspace <Icon name="arrow" size={17}/></a>
                <button className="auth-text-action" type="button" disabled={busy} onClick={() => void signOut()}>
                  Sign out
                </button>
              </div>
            ) : stage === 'reset' ? (
              <div className="auth-result auth-result-success">
                <OtpRing progress={1} verified/>
                <span className="auth-eyebrow">PIN UPDATED</span>
                <h2>Back in control.</h2>
                <p>Your PIN has been reset. Sign in using your new four-digit PIN.</p>
                <LiquidButton className="auth-primary" type="button" onClick={() => selectMode('login')}>Back to sign in <Icon name="arrow" size={17}/></LiquidButton>
              </div>
            ) : stage === 'otp' ? (
              <form className="auth-otp-form" onSubmit={verify}>
                <OtpRing progress={otpProgress}/>
                <div className="auth-otp-title">
                  <span className="auth-eyebrow">VERIFY YOUR EMAIL</span>
                  <h2>Enter your code.</h2>
                  <p>We sent a six-digit security code to your email. It expires in ten minutes.</p>
                </div>
                <label htmlFor="auth-code" className="auth-field-label">Verification code</label>
                <OtpCells id="auth-code" value={code} onChange={setCode} inputRef={codeInput}
                  disabled={busy || secondsLeft === 0}/>
                {mode === 'recover' && (
                  <div className="auth-field">
                    <label htmlFor="auth-reset-pin">Choose a new four-digit PIN</label>
                    <input id="auth-reset-pin" type="password" inputMode="numeric" pattern="[0-9]{4}"
                      maxLength={4} autoComplete="new-password" required value={newPin}
                      onChange={event => setNewPin(event.target.value.replace(/\D/g, '').slice(0,4))}/>
                  </div>
                )}
                <div className="auth-countdown">
                  <span>{secondsLeft > 0 ? 'Code valid for' : 'Code expired'}</span>
                  <span className="auth-timer">{String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}</span>
                </div>
                <LiquidButton className="auth-primary" type="submit" disabled={busy || secondsLeft === 0 || code.length !== 6}>
                  {busy ? 'Verifying…' : 'Verify & continue'} <Icon name="arrow" size={17}/>
                </LiquidButton>
                <button type="button" className="auth-text-action" disabled={busy} onClick={() => selectMode(mode)}>
                  Start over
                </button>
              </form>
            ) : (
              <>
                <div className="auth-form-header">
                  <h2>{mode === 'login' ? 'Welcome back.' : mode === 'signup' ? 'Create your account.' : 'Recover your PIN.'}</h2>
                  <p>{mode === 'login' ? 'Sign in to pick up where you left off.' :
                    mode === 'signup' ? 'A few details, and you’re in.' :
                      'We’ll send a code to your verified email.'}</p>
                </div>
                <div className="auth-mode-tabs" role="group" aria-label="Account actions" data-mode={mode}>
                  <Glass className="auth-tabs-lens" radius={24}
                    style={{ borderRadius: 24, background: 'var(--liquid-selection-fill)' }}
                    optics={{ depth:.65,curvature:.38,strength:.17,bend:.44,bendWidth:.12,
                      dispersion:.15,sheen:.92,specular:1.1,frost:0,clipToShape:true }}>
                    <span/>
                  </Glass>
                  <button type="button" className={mode === 'login' ? 'active' : ''} aria-pressed={mode === 'login'} onClick={() => selectMode('login')}>Sign in</button>
                  <button type="button" className={mode === 'signup' ? 'active' : ''} aria-pressed={mode === 'signup'} onClick={() => selectMode('signup')}>Sign up</button>
                </div>
                <form className="auth-fields" onSubmit={start}>
                  {mode !== 'recover' && (
                    <div className="auth-field">
                      <label htmlFor="auth-name">Agent name</label>
                      <div className="auth-input-wrap"><Icon name="team" size={17}/>
                        <input id="auth-name" value={name} onChange={event => setName(event.target.value)}
                          autoComplete="username" minLength={2} maxLength={48} placeholder="Your agent name" required/>
                      </div>
                    </div>
                  )}
                  {(mode === 'signup' || mode === 'recover') && (
                    <div className="auth-field">
                      <label htmlFor="auth-email">Email address {mode === 'signup' && <span>(optional)</span>}</label>
                      <div className="auth-input-wrap"><Icon name="mail" size={17}/>
                        <input id="auth-email" type="email" value={email} onChange={event => setEmail(event.target.value)}
                          autoComplete="email" placeholder="you@company.com" required={mode === 'recover'}/>
                      </div>
                      {mode === 'signup' && <p className="auth-field-helper">Without a verified email, a forgotten PIN cannot be recovered.</p>}
                    </div>
                  )}
                  {mode !== 'recover' && (
                    <div className="auth-field">
                      <label htmlFor="auth-pin">Four-digit PIN</label>
                      <div className="auth-input-wrap"><Icon name="key" size={17}/>
                        <input id="auth-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
                          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="••••"
                          value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0,4))} required/>
                      </div>
                    </div>
                  )}
                  <LiquidButton className="auth-primary" type="submit" disabled={busy}>
                    {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'recover' ? 'Send recovery code' : 'Sign in'}
                    <Icon name="arrow" size={17}/>
                  </LiquidButton>
                </form>
                {mode === 'login' && <button className="auth-text-action" type="button" onClick={() => selectMode('recover')}>Forgot your PIN?</button>}
                {mode === 'recover' && <button className="auth-text-action" type="button" onClick={() => selectMode('login')}>Back to sign in</button>}
              </>
            )}
            {problem && <div className="auth-feedback is-error" role="alert">{problem}</div>}
            {notice && <div className="auth-feedback is-note" role="status">{notice}</div>}
          </div>
        </section>
      </section>
      <footer className="auth-footer">
        <a href="/">Continue as guest <Icon name="arrow" size={13}/></a>
      </footer>
    </main>
  );
}
