import { Glass } from '@samasante/liquid-glass';
import Icon from './Icon';
import type { Theme } from './theme';

/** A real refractive thumb sliding over an opaque track, rather than a blur-only icon button. */
export default function ThemeToggle({ theme, onToggle }: {
  theme: Theme;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button type="button" className="liquid-theme-switch" role="switch"
      data-appearance={theme} aria-checked={theme === 'light'}
      aria-label="Light appearance" title={`Appearance: ${theme}. Switch to ${theme === 'dark' ? 'light' : 'dark'}`}
      onClick={onToggle}>
      <span className="liquid-switch-track" aria-hidden="true">
        <span className="liquid-switch-label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
      </span>
      <Glass className="liquid-switch-thumb" radius={36}
        style={{ borderRadius: 36, background: theme === 'dark' ? 'rgba(24,33,41,.23)' : 'rgba(255,255,255,.36)' }}
        optics={{
          mapSize: 256, strength: .23, depth: .72, curvature: .48,
          bend: .44, bendWidth: .12, dispersion: .34, splay: .3,
          sheen: .94, sheenWidth: 1.6, specular: 1.35,
          glow: .22, glowSpread: .45, frost: 0, brightness: 0.02,
          clipToShape: true, softEdge: true,
        }}>
        <span className="liquid-switch-puck" aria-hidden="true">
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18}/>
        </span>
      </Glass>
    </button>
  );
}
