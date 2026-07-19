import { useState } from 'react';
import { useArmStore } from '../state/store';
import { pinRunner } from '../state/pinRunner';
import { isValidPin, parsePin } from '../core/pin';
import Panel from './ui/Panel';

const PHASE_LABEL: Record<string, string> = {
  transit: 'moving to key',
  settle: 'aligning',
  descend: 'descending',
  dwell: 'touching',
  retract: 'lifting',
  done: 'complete',
  idle: 'idle',
};

/** Autonomous PIN entry pad: build a PIN with the keypad (or type it), run it,
 *  watch the arm tap each key with a live per-key ±5 mm badge. */
export default function PinPad() {
  const [pin, setPin] = useState(''); // always normalised to 1–6 digits only
  const pp = useArmStore((s) => s.pinProgress);
  const running = pp.running;

  const typed = parsePin(pin);
  const matchesRun = pp.pin.length === typed.length && pp.pin.every((d, i) => d === typed[i]);
  const committed = running || (pp.results.length > 0 && matchesRun);
  const shown = committed ? pp.pin : typed;

  const append = (d: number) => setPin((p) => (p.length >= 10 ? p : p + d));
  const normalize = (s: string) => setPin(parsePin(s).slice(0, 10).join(''));

  return (
    <Panel
      title="Autonomous PIN"
      accent
      meta={
        <span className={`num text-[10px] ${running ? 'text-flare' : 'text-dim'}`}>
          {running
            ? `${PHASE_LABEL[pp.phase] ?? pp.phase} · key ${pp.pin[pp.index]}`
            : 'tip ≤ 5 mm = pass'}
        </span>
      }
    >
      <input
        aria-label="PIN"
        inputMode="numeric"
        className="well mb-2 w-full rounded px-2 py-2 text-center font-mono text-xl tracking-[0.5em] text-flare outline-none placeholder:text-[11px] placeholder:tracking-normal placeholder:text-dim disabled:opacity-60"
        value={pin}
        disabled={running}
        onChange={(e) => normalize(e.target.value)}
        placeholder="tap keys or type a PIN (1–6)"
      />

      <div className="mb-2 grid grid-cols-6 gap-1">
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <button
            key={d}
            disabled={running}
            className="btn py-2 font-mono text-sm hover:border-flare hover:text-flare"
            onClick={() => append(d)}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="mb-2 flex gap-1.5">
        {running ? (
          <button className="btn btn-alarm flex-1 py-1.5 text-xs" onClick={() => pinRunner.abort()}>
            Abort (Esc)
          </button>
        ) : (
          <button
            className="btn btn-flare flex-1 py-1.5 text-xs"
            disabled={!isValidPin(pin)}
            onClick={() => pinRunner.start(pin)}
          >
            {isValidPin(pin) ? `Run PIN · ${typed.length} keys` : 'Run PIN'}
          </button>
        )}
        <button
          className="btn px-2.5 py-1.5 text-xs"
          disabled={running || pin.length === 0}
          onClick={() => setPin((p) => p.slice(0, -1))}
          title="Backspace"
        >
          ⌫
        </button>
        <button
          className="btn px-2.5 py-1.5 text-xs"
          disabled={running || pin.length === 0}
          onClick={() => setPin('')}
        >
          Clear
        </button>
      </div>

      {shown.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {shown.map((d, i) => {
            const res = committed && i < pp.results.length ? pp.results[i] : undefined;
            const active = running && committed && i === pp.index;
            const cls = res
              ? res.ok
                ? 'border-ok/60 text-ok'
                : 'border-alarm/60 text-alarm'
              : active
                ? 'border-flare text-flare'
                : 'border-hairline text-dim';
            return (
              <div
                key={i}
                className={`well flex min-w-[2.7rem] flex-col items-center rounded border px-1.5 py-1 ${cls}`}
              >
                <span className="num text-sm leading-none">{d}</span>
                <span className="num mt-0.5 text-[9px] leading-none opacity-80">
                  {res ? `${res.mm === Infinity ? '∞' : res.mm.toFixed(1)}mm` : active ? '…' : '·'}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] leading-relaxed text-dim">
          Build a PIN with the keypad, then Run — the arm plans, descends onto each key in order,
          and grades itself within ±5 mm.
        </p>
      )}
    </Panel>
  );
}
