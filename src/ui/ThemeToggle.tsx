import { Glass } from '@samasante/liquid-glass';
import Icon from './Icon';
import type { Theme } from './theme';

/** One real SVG-displacement glass lens; larger text surfaces stay opaque for readability. */
export default function ThemeToggle({ theme, onToggle, compact = false }: {
  theme: Theme;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <Glass
      className="theme-lens"
      radius={100}
      style={{
        borderRadius: 100,
        background: theme === 'dark' ? 'rgba(185,213,245,0.09)' : 'rgba(255,255,255,0.38)',
      }}
      optics={{ strength: 0.32, depth: 0.48, dispersion: 0.15, sheen: 0.75, frost: 7 }}
    >
      <button style={{ background: 'transparent', boxShadow: 'none', border: 0, backdropFilter: 'none' }} className={'theme-toggle theme-toggle-refracted' + (compact ? ' theme-toggle-compact' : '')}
        type="button" onClick={onToggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
        {!compact && <span>{theme === 'dark' ? 'Light' : 'Dark'} mode</span>}
      </button>
    </Glass>
  );
}
