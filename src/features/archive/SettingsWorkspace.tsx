import LiquidButton from '../../ui/LiquidButton';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { OtpCells, OtpRing } from '../auth/OtpVisual';
import LiquidUnderlay from '../../ui/LiquidUnderlay';
import AvatarPicker from './AvatarPicker';
import type { Agent } from './model';

interface Props {
  agent: Agent;
  onAgentChange: (agent: Agent) => void;
  avatarUrl: string | null;
  onAvatarChange: (value: string | null) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}
export default function SettingsWorkspace({ agent, onAgentChange, avatarUrl, onAvatarChange, onNotice, onError }: Props) {
  const [name, setName] = useState(agent.agent_name);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void api<{ email: string | null }>('/api/account/email')
      .then(data => { if (active) setEmail(data.email); })
      .catch(() => { if (active) onError('Could not load your account email.'); });
    return () => { active = false; };
  }, [agent.id, onError]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try { await task(); }
    catch (error) { onError(error instanceof Error ? error.message : 'Could not update settings'); }
    finally { setBusy(false); }
  }
  function changeName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const data = await api<{ user: Agent }>('/api/account/name', {
        method: 'PATCH', body: JSON.stringify({ agentName: name.trim() }),
      });
      if (!data.user) throw new Error('Name update could not be confirmed.');
      onAgentChange(data.user);
      onNotice('Agent name updated.');
    });
  }
  function changePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      await api('/api/account/pin', {
        method: 'POST', body: JSON.stringify({ currentPin, newPin }),
      });
      setCurrentPin('');
      setNewPin('');
      onNotice('Your PIN has been updated.');
    });
  }
  function startEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const data = await api<{ challengeId: string }>('/api/otp/email/start', {
        method: 'POST', body: JSON.stringify({ email: newEmail.trim() }),
      });
      if (!data.challengeId) throw new Error('Verification request was not created.');
      setChallenge(data.challengeId);
      setCode('');
      onNotice('Verification code requested. Check your new email inbox.');
    });
  }
  function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const data = await api<{ email: string | null; verified: boolean }>('/api/otp/email/verify', {
        method: 'POST', body: JSON.stringify({ challengeId: challenge, code }),
      });
      if (!data.verified) throw new Error('Email verification was not confirmed.');
      setEmail(data.email);
      setChallenge('');
      setCode('');
      setNewEmail('');
      onNotice('New email verified and saved.');
    });
  }
  return (
    <section className="archive-settings archive-content-page" aria-label="Account settings">
      <div className="archive-page-heading">
        <div><p className="archive-kicker">ACCOUNT</p><h1>Settings</h1><p>Update your personal account details.</p></div>
      </div>
      <AvatarPicker avatarUrl={avatarUrl} onAvatarChange={onAvatarChange} onNotice={onNotice} onError={onError}/>
      <div className="archive-settings-grid">
        <form className="archive-card archive-settings-form" onSubmit={changeName}>
          <LiquidUnderlay radius={18}/>
          <h2>Agent name</h2>
          <label htmlFor="archive-setting-name">Display name</label>
          <input id="archive-setting-name" value={name} onChange={event => setName(event.target.value)}
            minLength={2} maxLength={48} required />
          <LiquidButton type="submit" className="archive-button archive-button-primary" disabled={busy || name === agent.agent_name}>Save name</LiquidButton>
        </form>
        <form className="archive-card archive-settings-form" onSubmit={changePin}>
          <LiquidUnderlay radius={18}/>
          <h2>Change PIN</h2>
          <label htmlFor="archive-setting-current-pin">Current PIN</label>
          <input id="archive-setting-current-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
            autoComplete="current-password" value={currentPin} onChange={event => setCurrentPin(event.target.value)} required />
          <label htmlFor="archive-setting-new-pin">New four-digit PIN</label>
          <input id="archive-setting-new-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
            autoComplete="new-password" value={newPin} onChange={event => setNewPin(event.target.value)} required />
          <LiquidButton type="submit" className="archive-button archive-button-primary" disabled={busy}>Change PIN</LiquidButton>
          <p className="archive-hint">Forgot your current PIN? Sign out and choose Recover PIN on the sign-in page.</p>
        </form>
        <div className="archive-card archive-settings-form">
          <LiquidUnderlay radius={18}/>
          <h2>Recovery email</h2>
          <p className="archive-hint">Current verified email: <strong>{email || 'None'}</strong></p>
          {challenge ? (
            <form className="archive-settings-form-inner" onSubmit={verifyEmail}>
              <p className="archive-hint">Enter the code sent to {newEmail}. Your existing email remains active until verification.</p>
              <OtpRing progress={code.length / 6} />
              <label htmlFor="archive-setting-otp">Six-digit email code</label>
              <OtpCells id="archive-setting-otp" value={code} onChange={setCode} disabled={busy}/>
              <LiquidButton type="submit" className="archive-button archive-button-primary" disabled={busy}>Verify email</LiquidButton>
              <button type="button" className="archive-button archive-button-quiet" onClick={() => { setChallenge(''); setCode(''); }}>Cancel</button>
            </form>
          ) : (
            <form className="archive-settings-form-inner" onSubmit={startEmail}>
              <label htmlFor="archive-setting-email">New email address</label>
              <input id="archive-setting-email" type="email" autoComplete="email" value={newEmail}
                onChange={event => setNewEmail(event.target.value)} required />
              <LiquidButton type="submit" className="archive-button archive-button-primary" disabled={busy}>Send verification code</LiquidButton>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
