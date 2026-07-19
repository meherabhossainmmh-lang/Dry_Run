import { useMemo, useState } from 'react';
import { motion } from '../state/controller';
import type { DispatchResult } from '../state/controller';
import { precomputeKeyPoses } from '../core/ik';
import type { Digit } from '../core/commands';
import Panel from './ui/Panel';

/** IK dashboard: type a base-frame target (mm), solve + move there; plus a
 *  live per-key reachability strip driven by the precomputed IK poses. */
export default function GotoPanel() {
  const [x, setX] = useState('550');
  const [y, setY] = useState('0');
  const [z, setZ] = useState('150');
  const [tipDown, setTipDown] = useState(true);
  const [status, setStatus] = useState<DispatchResult | null>(null);

  const reach = useMemo(() => precomputeKeyPoses(), []);

  const go = () => {
    const xyz: [number, number, number] = [Number(x) / 1000, Number(y) / 1000, Number(z) / 1000];
    if (xyz.some((v) => Number.isNaN(v))) {
      setStatus({ ok: false, reason: 'enter numbers for X, Y, Z' });
      return;
    }
    setStatus(motion.dispatch({ type: 'moveTo', xyz, tipDown, source: 'dashboard' }));
  };

  const field = (label: string, val: string, set: (s: string) => void) => (
    <label className="flex flex-col gap-1">
      <span className="font-display text-[10px] uppercase tracking-[0.14em] text-dim">
        {label} mm
      </span>
      <input
        type="number"
        className="well w-full rounded px-1.5 py-1.5 font-mono text-xs text-ink outline-none"
        value={val}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()}
      />
    </label>
  );

  return (
    <Panel title="IK · go to point" delay={160}>
      <div className="grid grid-cols-3 gap-2">
        {field('X', x, setX)}
        {field('Y', y, setY)}
        {field('Z', z, setZ)}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
          <input
            type="checkbox"
            className="accent-[var(--color-flare)]"
            checked={tipDown}
            onChange={(e) => setTipDown(e.target.checked)}
          />
          Stylus down
        </label>
        <button className="btn btn-flare px-4 py-1 text-xs" onClick={go}>
          Go
        </button>
      </div>

      {status && (
        <div
          className={`mt-2.5 rounded border px-2 py-1.5 font-mono text-[10px] leading-relaxed ${
            status.ok ? 'border-ok/40 text-ok' : 'border-alarm/50 text-alarm'
          }`}
        >
          {status.ok ? '✓ ' : '✗ rejected — '}
          {status.reason}
        </div>
      )}

      <div className="mt-3 mb-1.5 font-display text-[10px] uppercase tracking-[0.14em] text-dim">
        Key reachability (IK)
      </div>
      <div className="flex gap-1">
        {([1, 2, 3, 4, 5, 6] as Digit[]).map((d) => (
          <div
            key={d}
            title={`key ${d}: ${
              reach[d].reachable ? `reach ${(reach[d].touchErr * 1000).toFixed(2)} mm` : 'unreachable'
            }`}
            className={`well flex h-6 flex-1 items-center justify-center rounded border font-mono text-[11px] ${
              reach[d].reachable ? 'border-ok/40 text-ok' : 'border-alarm/50 text-alarm'
            }`}
          >
            {d}
          </div>
        ))}
      </div>
    </Panel>
  );
}
