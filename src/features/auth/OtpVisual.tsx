import type { CSSProperties, RefObject } from 'react';
import Icon from '../../ui/Icon';
import { Glass } from '@samasante/liquid-glass';

/** Visual OTP progress is driven by typed digits; success is driven only by server confirmation. */
export function OtpRing({ progress, verified = false }: {
  progress: number;
  verified?: boolean;
}) {
  return (
    <div className={'otp-orbit' + (verified ? ' otp-orbit-success' : '')}
      style={{ '--otp-progress': Math.max(0, Math.min(1, progress)) } as CSSProperties} aria-hidden="true">
      {verified ? <div className="otp-orbit-light" /> : (
        <svg className="otp-progress" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r="60" className="otp-progress-track" />
          <circle cx="70" cy="70" r="60" className="otp-progress-value" />
        </svg>
      )}
      <Glass className="otp-core-lens" radius={24}
        style={{ borderRadius:24,background:'var(--liquid-selection-fill)' }}
        optics={{depth:.62,curvature:.43,strength:.20,bend:.45,bendWidth:.12,
          dispersion:.17,sheen:.90,specular:1.12,frost:0,clipToShape:true}}>
        <span className="otp-core"><Icon name={verified ? 'check' : 'shield'} size={verified ? 36 : 30}/></span>
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
