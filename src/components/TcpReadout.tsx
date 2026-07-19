import { useArmStore } from '../state/store';
import { fk } from '../core/fk';
import { dist } from '../core/math';
import { SHOULDER, MAX_REACH, REACH_SAFETY } from '../core/chain';

const AXIS_TINT = ['text-flare', 'text-signal', 'text-ink'] as const;

/**
 * Stylus-tip telemetry, floated over the 3D scene as a heads-up display rather
 * than buried in the rail — the tip position is the number you watch while the
 * arm moves. Non-interactive, so the orbit controls stay reachable through it.
 */
export default function TcpReadout() {
  const tcp = useArmStore((s) => s.tcp);
  const q = useArmStore((s) => s.q);

  const reach = Math.min(1, dist(fk(q), SHOULDER) / MAX_REACH);
  // Past the planner's envelope the arm is at full stretch — a state, not a
  // refusal, so it warns in amber. Crimson stays reserved for the gate.
  const hot = reach > REACH_SAFETY;

  return (
    <section className="pointer-events-none w-56 rounded-lg border border-hairline bg-carbon/80 p-3 backdrop-blur-md">
      <h2 className="panel-title mb-2.5">Stylus tip — base frame</h2>

      <div className="grid grid-cols-3 gap-1.5">
        {(['x', 'y', 'z'] as const).map((axis, i) => (
          <div key={axis} className="well rounded px-1 py-1.5 text-center">
            <div className={`font-display text-[10px] font-semibold uppercase ${AXIS_TINT[i]}`}>
              {axis}
            </div>
            <div className="num text-[13px] leading-tight text-ink">{(tcp[i] * 1000).toFixed(1)}</div>
            <div className="num text-[9px] text-dim">mm</div>
          </div>
        ))}
      </div>

      <div className="mt-2.5">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-display text-[10px] uppercase tracking-[0.14em] text-dim">Reach</span>
          <span className={`num text-[10px] ${hot ? 'text-flare' : 'text-muted'}`}>
            {(reach * 100).toFixed(0)}%{hot && <span className="ml-1 text-dim">full stretch</span>}
          </span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-full bg-hairline">
          <div
            className={`h-full rounded-full transition-[width] duration-150 ${hot ? 'bg-flare' : 'bg-signal'}`}
            style={{ width: `${reach * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}
