import type { CSSProperties, RefObject } from 'react';
import { Glass } from '@samasante/liquid-glass';
import '../../styles/otp-v5.css';

/**
 * OTP v5: a lock-on animation.
 * - Typing: the outer ring fills per digit, the four "+" markers close in on the
 *   core, the squircle frame tightens, and each digit sends out one soft ping.
 * - Verified: markers burst outward, the frame locks, a shockwave leaves the core,
 *   and the dot resolves into a drawn check.
 * Success is still driven only by the `verified` prop (server confirmation).
 */

const TICKS = ['0deg', '90deg', '180deg', '270deg'];
const PIPS = ['45deg', '135deg', '225deg', '315deg'];
const angle = (a: string) => ({ '--a': a }) as CSSProperties;

export function OtpRing({ progress, verified = false }: {
  progress: number;
  verified?: boolean;
}) {
  const p = verified ? 1 : Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const digits = Math.round(p * 6);

  return (
    <div className={'otp-orbit otp5' + (verified ? ' otp-orbit-success' : '')}
      style={{ '--otp-progress': p } as CSSProperties} aria-hidden="true">
      <svg className="otp-progress" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="67" className="otp-progress-orbit" />
        <circle cx="70" cy="70" r="60" className="otp-progress-track" />
        <circle cx="70" cy="70" r="60" className="otp-progress-value" />
      </svg>

      <span className="otp5-frame" />
      {TICKS.map(a => <span key={a} className="otp5-tick" style={angle(a)} />)}
      {PIPS.map(a => <span key={a} className="otp5-pip" style={angle(a)} />)}

      {digits > 0 && !verified && <span key={digits} className="otp5-ping" />}
      {verified && <span className="otp5-wave" />}

      <Glass className="otp-core-lens" radius={24}
        style={{ borderRadius: 24, background: 'var(--liquid-selection-fill)' }}
        optics={{ depth: .62, curvature: .43, strength: .20, bend: .45, bendWidth: .12,
          dispersion: .17, sheen: .90, specular: 1.12, frost: 0, clipToShape: true }}>
        <span className="otp-core">
          <span className="otp5-dot" />
          <svg className="otp5-check" viewBox="0 0 24 24">
            <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
          </svg>
        </span>
      </Glass>
    </div>
  );
}

export function OtpCells({ id, value, onChange, disabled = false, inputRef }: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="auth-code-row" onClick={() => inputRef?.current?.focus()}>
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index}
          className={'auth-code-cell' + (value.length === index ? ' is-next' : '') + (value[index] ? ' is-filled' : '')}>
          {value[index] ?? ''}
        </span>
      ))}
      <input ref={inputRef} id={id} className="auth-code-input"
        type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
        maxLength={6} required aria-label="Six digit verification code"
        value={value} onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        disabled={disabled} />
    </div>
  );
}
