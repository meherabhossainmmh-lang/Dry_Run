import { useArmStore } from '../state/store';
import { motion } from '../state/controller';
import Panel from './ui/Panel';

const rad2deg = (r: number) => (r * 180) / Math.PI;

/** Live joint dashboard: 7 rows of angle readout + travel bar + slider.
 *  The sliders are the "dashboard" motion trigger. They go through the shared
 *  motion controller like every other source — never straight into the store —
 *  so joint limits and the solid surface bound them too. */
export default function JointPanel() {
  const jointMeta = useArmStore((s) => s.jointMeta);
  const q = useArmStore((s) => s.q);
  const log = useArmStore((s) => s.log);

  if (jointMeta.length === 0) {
    return (
      <Panel title="Joint states" delay={40}>
        <div className="num text-[11px] text-dim">Loading URDF…</div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Joint states"
      delay={40}
      meta={
        <button
          className="btn px-2 py-0.5 text-[10px]"
          onClick={() => {
            motion.dispatch({ type: 'home', source: 'dashboard' });
            log('dashboard', 'All joints → 0 (FK anchor pose: TCP must read 0, 0, 1497 mm)');
          }}
        >
          Zero all
        </button>
      }
      bodyClassName="space-y-2.5"
    >
      {jointMeta.map((j, i) => {
        const frac = (q[i] - j.lower) / (j.upper - j.lower);
        const zeroFrac = (0 - j.lower) / (j.upper - j.lower);
        const near = frac < 0.03 || frac > 0.97; // riding a joint limit
        return (
          <div key={j.name}>
            <div className="flex items-baseline justify-between">
              <span className="font-display text-[11px] font-medium tracking-wide text-muted">
                {j.label}
              </span>
              <span className={`num text-[11px] ${near ? 'text-flare' : 'text-ink'}`}>
                {rad2deg(q[i]).toFixed(1)}°
              </span>
            </div>

            {/* One instrument: the slider thumb rides the travel bar it reads from,
                which is filled from the zero tick toward the current angle. */}
            <div className="relative mt-1.5 h-3.5">
              <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-hairline">
                <div
                  className={`absolute inset-y-0 rounded-full ${near ? 'bg-flare' : 'bg-signal'}`}
                  style={{
                    left: `${Math.min(zeroFrac, frac) * 100}%`,
                    width: `${Math.abs(frac - zeroFrac) * 100}%`,
                  }}
                />
              </div>
              <div
                className="absolute top-1/2 h-[9px] w-px -translate-y-1/2 bg-dim"
                style={{ left: `${zeroFrac * 100}%` }}
                title="0°"
              />
              <input
                type="range"
                aria-label={j.label}
                className="bare absolute inset-0 w-full"
                min={j.lower}
                max={j.upper}
                step={0.002}
                value={q[i]}
                title={`${rad2deg(j.lower).toFixed(0)}° … ${rad2deg(j.upper).toFixed(0)}°`}
                onChange={(e) => motion.setJoint(i, Number(e.target.value), 'dashboard')}
              />
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
