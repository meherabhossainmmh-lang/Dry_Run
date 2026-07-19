import { useEffect, useRef, useState } from 'react';
import { motion, JOG_GEARS } from '../state/controller';
import { useArmStore } from '../state/store';
import { fk } from '../core/fk';
import { SHOULDER, MAX_REACH, FLOOR_Z } from '../core/chain';
import { dist } from '../core/math';
import type { Vec3 } from '../core/math';
import Panel from './ui/Panel';

const R = 52; // pad radius (px)
const STALL_MM = 0.03; // per-frame tip travel below which a held jog counts as stalled (singular)

/** GUI joystick — the same manual lane as the keyboard, aimed at a mouse/touch.
 *  The XY pad jogs the tip in the base plane (proportional to deflection), the
 *  Z buttons raise/lower it. Everything rides the shared Cartesian jog lane, so
 *  the controller's velocity smoothing gives it soft starts and sub-100 ms stops.
 *  Jogging is blocked while an autonomous PIN runs — only Stop stays live. */
export default function Joystick() {
  const running = useArmStore((s) => s.pinProgress.running);
  const q = useArmStore((s) => s.q);
  const gear = useArmStore((s) => s.gear);
  const setGear = useArmStore((s) => s.setGear);
  const padRef = useRef<HTMLDivElement>(null);
  const active = useRef<Set<string>>(new Set()); // ids currently jogging via this pad
  const prevTip = useRef<Vec3>([0, 0, 0]);
  const [knob, setKnob] = useState<[number, number]>([0, 0]); // px offset, for the visual
  const [stalled, setStalled] = useState(false); // jog commanded but tip can't move (singularity)

  const releaseAllJogs = () => {
    for (const id of active.current) motion.endCartJog(id);
    active.current.clear();
    setKnob([0, 0]);
    setStalled(false);
  };

  // A PIN run must never leave a jog latched — drop everything the moment it starts.
  useEffect(() => {
    if (running) releaseAllJogs();
  }, [running]);

  // Safety net: a pointer released off the element (or focus loss) must not latch a jog.
  useEffect(() => {
    const off = () => releaseAllJogs();
    window.addEventListener('pointerup', off);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('pointerup', off);
      window.removeEventListener('blur', off);
    };
  }, []);

  // Workspace telemetry from the live pose. Re-runs each frame the pose changes.
  const tip = fk(q);
  const reach = dist(tip, SHOULDER) / MAX_REACH;
  const nearReach = reach > 0.92;
  const nearFloor = tip[2] < FLOOR_Z + 0.03;
  const limit = nearReach || nearFloor;

  // Singularity/limit stall: a jog is held but the tip isn't actually moving.
  // Keyed to `q` — setQ hands out a fresh array each frame, so this samples one
  // true per-frame delta and never self-triggers off its own setStalled render.
  useEffect(() => {
    const moved = dist(tip, prevTip.current) * 1000;
    prevTip.current = tip;
    setStalled(active.current.size > 0 && moved < STALL_MM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const drive = (px: number, py: number) => {
    let ux = px / R;
    let uy = py / R;
    const n = Math.hypot(ux, uy);
    if (n > 1) { ux /= n; uy /= n; } // clamp to the unit disc
    // Screen up → tip +X (forward); screen right → tip −Y — matches the arrow keys.
    motion.beginCartJog('pad', [-uy, -ux, 0], 'joystick');
    active.current.add('pad');
    setKnob([ux * R, uy * R]);
  };

  const capture = (e: React.PointerEvent) => {
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic / unsupported */ }
  };

  const onPadDown = (e: React.PointerEvent) => {
    if (running) return;
    capture(e);
    const r = padRef.current!.getBoundingClientRect();
    drive(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  };
  const onPadMove = (e: React.PointerEvent) => {
    if (running || e.buttons === 0) return;
    const r = padRef.current!.getBoundingClientRect();
    drive(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  };
  const releasePad = () => {
    motion.endCartJog('pad'); // controller eases the tip to rest
    active.current.delete('pad');
    setKnob([0, 0]);
    setStalled(false);
  };

  const zHold = (id: string, dz: number) => (e: React.PointerEvent) => {
    if (running) return;
    capture(e);
    motion.beginCartJog(id, [0, 0, dz], 'joystick');
    active.current.add(id);
  };
  const zRelease = (id: string) => () => {
    motion.endCartJog(id);
    active.current.delete(id);
    setStalled(false);
  };

  const zBtn = 'btn flex-1 py-2 font-mono text-xs text-signal select-none hover:border-signal';
  const tick = 'pointer-events-none absolute font-mono text-[8px] text-dim';

  return (
    <Panel
      title="Manual · joystick"
      delay={200}
      meta={
        <button
          className="btn btn-alarm px-2.5 py-0.5 text-[10px]"
          onClick={() => motion.dispatch({ type: 'stop', source: 'joystick' })}
        >
          Stop
        </button>
      }
    >
      {/* Speed gear — scales joystick + keyboard jog rate ([ / ] to shift) */}
      <div className="mb-2.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-display text-[10px] uppercase tracking-[0.14em] text-dim">Gear</span>
          <span className="num text-[10px] text-dim">{JOG_GEARS[gear].mult}× · [ ]</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {JOG_GEARS.map((g, i) => (
            <button
              key={g.label}
              onClick={() => setGear(i)}
              className={`btn py-1 text-[10px] ${i === gear ? 'btn-flare' : ''}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* XY pad — base-plane tip jog */}
        <div
          ref={padRef}
          onPointerDown={onPadDown}
          onPointerMove={onPadMove}
          onPointerUp={releasePad}
          onPointerCancel={releasePad}
          className={`relative shrink-0 touch-none rounded-full border ${
            running ? 'cursor-not-allowed border-hairline opacity-50' : 'cursor-grab border-hairline-lit'
          }`}
          style={{
            width: R * 2,
            height: R * 2,
            background: 'radial-gradient(circle at 50% 42%, #131a24 0%, #05070a 78%)',
            boxShadow: 'inset 0 2px 14px -4px #000',
          }}
        >
          {/* reticle */}
          <div className="pointer-events-none absolute inset-[14px] rounded-full border border-hairline" />
          <div className="pointer-events-none absolute inset-[30px] rounded-full border border-hairline/60" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 -translate-y-1/2 bg-hairline" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 bg-hairline" />

          <div
            className={`pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 rounded-full transition-colors ${
              running ? 'bg-dim' : 'bg-flare'
            }`}
            style={{
              transform: `translate(calc(-50% + ${knob[0]}px), calc(-50% + ${knob[1]}px))`,
              boxShadow: running ? 'none' : '0 0 14px -1px color-mix(in srgb, var(--color-flare) 70%, transparent)',
            }}
          />

          <span className={`${tick} -top-0.5 left-1/2 -translate-x-1/2`}>+X</span>
          <span className={`${tick} -bottom-0.5 left-1/2 -translate-x-1/2`}>−X</span>
          <span className={`${tick} left-1 top-1/2 -translate-y-1/2`}>+Y</span>
          <span className={`${tick} right-1 top-1/2 -translate-y-1/2`}>−Y</span>
        </div>

        {/* Z column + workspace-limit badge */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <button
            className={zBtn}
            disabled={running}
            onPointerDown={zHold('z+', 1)}
            onPointerUp={zRelease('z+')}
            onPointerCancel={zRelease('z+')}
            onPointerLeave={zRelease('z+')}
          >
            ▲ Z up
          </button>
          <button
            className={zBtn}
            disabled={running}
            onPointerDown={zHold('z-', -1)}
            onPointerUp={zRelease('z-')}
            onPointerCancel={zRelease('z-')}
            onPointerLeave={zRelease('z-')}
          >
            ▼ Z down
          </button>
          <div
            // Workspace limits warn in amber; crimson is the gate's colour alone.
            className={`well rounded border px-2 py-1 text-center font-mono text-[10px] ${
              running
                ? 'border-hairline text-dim'
                : stalled || limit
                  ? 'border-flare/50 text-flare'
                  : 'border-ok/40 text-ok'
            }`}
            title={`reach ${(reach * 100).toFixed(0)} % · tip z ${(tip[2] * 1000).toFixed(0)} mm`}
          >
            {running
              ? 'PIN running'
              : stalled
                ? 'blocked · nudge X/Y'
                : limit
                  ? nearReach
                    ? 'near reach limit'
                    : 'near surface'
                  : `in range · ${(reach * 100).toFixed(0)} %`}
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-[10px] text-dim">
        Drag the pad to jog the tip; hold Z to raise/lower. Proportional speed, smooth stop.
      </p>
    </Panel>
  );
}
