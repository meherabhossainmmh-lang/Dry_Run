import { useArmStore } from '../state/store';
import PipelineStrip from './PipelineStrip';

const LEVEL_TINT = {
  info: 'text-ink/80',
  warn: 'text-alarm',
  error: 'text-alarm',
} as const;

const SOURCE_TINT: Record<string, string> = {
  dashboard: 'text-ink',
  joystick: 'text-signal',
  keyboard: 'text-signal',
  voice: 'text-flare',
  agent: 'text-flare',
  auto: 'text-flare',
  system: 'text-dim',
};

/**
 * Pipeline event feed. Every command, validation verdict and touch result lands
 * here with the source that raised it — the running proof that the dashboard,
 * the joystick, the mic and the LLM all take the same road through validate().
 */
export default function EventLog() {
  const events = useArmStore((s) => s.events);
  const refused = events.filter((e) => e.level !== 'info').length;

  return (
    <section className="flex h-full min-h-0 flex-col border-t border-hairline bg-carbon px-4 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="panel-title shrink-0">Event log</h2>
        <div className="min-w-0 flex-1">
          <PipelineStrip />
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 md:flex">
          <span className="chip">{events.length} events</span>
          <span className={`chip ${refused ? 'border-alarm-deep text-alarm' : ''}`}>
            {refused} refused
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {events.length === 0 && (
          <div className="num py-2 text-[11px] text-dim">
            No events yet — every command will be logged here with its source.
          </div>
        )}
        {events.map((e) => (
          <div key={e.id} className="flex items-baseline gap-2 text-[11px] leading-relaxed">
            <span className="num shrink-0 text-dim">{e.time}</span>
            <span className={`num w-[68px] shrink-0 uppercase ${SOURCE_TINT[e.source] ?? 'text-muted'}`}>
              {e.source}
            </span>
            <span className={`min-w-0 ${LEVEL_TINT[e.level]}`}>{e.msg}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
