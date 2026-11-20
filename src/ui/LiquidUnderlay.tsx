import { memo } from 'react';
import { Glass } from '@samasante/liquid-glass';

/** Refraction lives behind content, so no displaced text or inaccessible controls. */
function LiquidUnderlay({ radius = 18 }: { radius?: number }) {
  return (
    <Glass className="liquid-underlay" radius={radius}
      style={{ borderRadius: radius, background: 'var(--liquid-panel-tint)' }}
      optics={{ mapSize: 96, depth: .62, curvature: .4, strength: .16,
        bend: .42, bendWidth: .12, dispersion: .12, sheen: .78,
        sheenWidth: 1.1, specular: .88, frost: 0, glow: .06,
        clipToShape: true, softEdge: true }}>
      <span className="liquid-underlay-fill" />
    </Glass>
  );
}

export default memo(LiquidUnderlay);
