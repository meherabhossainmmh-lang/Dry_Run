import { useArmStore } from '../state/store';

/** Every command source, colour-coded — the point being that they all end up here. */
const SOURCE_TINT: Record<string, string> = {
  dashboard: 'text-ink border-hairline-lit',
  joystick: 'text-signal border-signal-deep',
  keyboard: 'text-signal border-signal-deep',
  voice: 'text-flare border-flare-deep',
  agent: 'text-flare border-flare-deep',
  auto: 'text-flare border-flare-deep',
  system: 'text-dim border-hairline',
};

/**
 * The safety gate, made visible.
 *
 * The architecture claim is that no input — not the joystick, not the LLM —
 * can move a joint the validator wouldn't allow. That claim is invisible in a
 * screenshot, so this strip renders it live: the source of the last command,
 * the gate it had to pass, and the verdict. A refusal flashes crimson, the one
 * colour reserved for the gate.
 */
export default function PipelineStrip() {
  // Boot/system notices never crossed the gate, so they must never be shown as
  // if they had. Only real command sources appear here.
  const last = useArmStore((s) => s.events.find((e) => e.source !== 'system'));
  const refused = !!last && last.level !== 'info';

  const source = last?.source ?? '—';
  const tint = SOURCE_TINT[source] ?? 'text-muted border-hairline';

  return (
    <div
      // Re-keying on the event id restarts the flash for each new refusal.
      key={last?.id}
      className={`flex items-center gap-2.5 rounded border border-hairline bg-void/60 px-2.5 py-1.5 ${
        refused ? 'reject-flash' : ''
      }`}
    >
      <span className={`chip shrink-0 uppercase ${tint}`}>{source}</span>

      <Arrow />

      <span
        className={`num shrink-0 text-[11px] ${
          refused ? 'text-alarm' : 'text-muted'
        }`}
        title="The single gate every source passes through"
      >
        validate()
      </span>

      <Arrow />

      <span
        className={`num shrink-0 text-[11px] font-semibold tracking-wide ${
          !last ? 'text-dim' : refused ? 'text-alarm' : 'text-ok'
        }`}
      >
        {!last ? 'IDLE' : refused ? 'REFUSED' : 'EXECUTED'}
      </span>

      <span className="min-w-0 flex-1 truncate text-[11px] text-muted" title={last?.msg}>
        {last?.msg ?? 'awaiting a command — every source passes through the same gate'}
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden className="shrink-0 text-dim">
      <path d="M0 4h13M10 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
