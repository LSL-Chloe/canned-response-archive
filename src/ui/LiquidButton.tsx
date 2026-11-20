import { Glass } from '@samasante/liquid-glass';
import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'neutral';
};

/** Native button semantics with a real SVG displacement lens around the control. */
export default function LiquidButton({
  children, className = '', tone = 'primary', disabled, ...props
}: Props) {
  return (
    <Glass className={`liquid-action liquid-action-${tone}`}
      radius={30}
      style={{ borderRadius: 30, background: 'var(--liquid-button-tint)' }}
      optics={{
        mapSize: 128, depth: .62, curvature: .42, strength: .16,
        bend: .46, bendWidth: .12, dispersion: .16,
        specular: 1.12, sheen: .9, sheenWidth: 1.5,
        glow: .12, frost: 0, clipToShape: true, softEdge: true,
      }}>
      <button {...props} disabled={disabled} className={`liquid-action-button ${className}`}>
        {children}
      </button>
    </Glass>
  );
}
