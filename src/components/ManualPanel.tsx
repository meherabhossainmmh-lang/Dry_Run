import { useEffect } from 'react';
import { installKeyboard } from '../input/keyboard';
import { motion } from '../state/controller';
import Panel from './ui/Panel';

const JOINT_ROWS: [string, string][] = [
  ['A / D', 'Base yaw'],
  ['W / S', 'Shoulder'],
  ['Q / E', 'Elbow'],
  ['Z / X', 'Forearm roll'],
  ['R / F', 'Wrist pitch'],
  ['T / G', 'Tool roll'],
  ['Y / H', 'Stylus pitch'],
];

const Row = ({ keys, label, tint }: { keys: string; label: string; tint: string }) => (
  <div className="flex items-center justify-between gap-2">
    <kbd
      className={`well rounded px-1.5 py-0.5 font-mono text-[10px] leading-tight ${tint}`}
    >
      {keys}
    </kbd>
    <span className="truncate text-[11px] text-muted">{label}</span>
  </div>
);

/** Keyboard manual-control legend. Mounting this installs the key listeners. */
export default function ManualPanel() {
  useEffect(() => installKeyboard(), []);

  return (
    <Panel
      title="Manual · keyboard"
      delay={240}
      meta={
        <button
          className="btn btn-alarm px-2.5 py-0.5 text-[10px]"
          onClick={() => motion.dispatch({ type: 'stop', source: 'keyboard' })}
        >
          Stop
        </button>
      }
    >
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {JOINT_ROWS.map(([keys, label]) => (
          <Row key={keys} keys={keys} label={label} tint="text-flare" />
        ))}
      </dl>
    </Panel>
  );
}
