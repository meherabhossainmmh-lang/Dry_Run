/**
 * Phase 3 — Voice control (required, deterministic).
 *
 * Maps spoken/typed keyword commands onto the same motion pipeline every other
 * input uses. Deliberately self-contained: no LLM, no API key, no network. The
 * rulebook is explicit that "the optional agentic extension (Phase 3B) does not
 * replace the required deterministic voice control (Phase 3) — baselines must
 * still work independently and will be judged as such", so this panel never
 * defers to the agent. Phase 3B lives beside it in AgentPanel.
 */
import { useEffect, useRef, useState } from 'react';
import { parse, isError, JOINT_LABELS } from './grammar';
import { dispatch, type MotionCommand } from './pipeline';
import { speak, cancelSpeech } from './tts';
import { useSpeechRecognition } from './useSpeechRecognition';
import Panel from '../components/ui/Panel';

/** Short spoken/visible confirmation for a command the deterministic grammar ran. */
function confirm(cmd: MotionCommand): string {
  switch (cmd.type) {
    case 'stop': return 'Stopping.';
    case 'home': return 'Going home.';
    case 'rotateJoint': {
      const label = JOINT_LABELS[cmd.joint] ?? `joint ${cmd.joint}`;
      const deg = Math.round(((cmd.toRad ?? cmd.deltaRad ?? 0) * 180) / Math.PI);
      return cmd.toRad !== undefined
        ? `Rotating ${label} to ${deg} degrees.`
        : `Rotating ${label} by ${deg} degrees.`;
    }
    case 'jog': {
      const [x, y, z] = cmd.delta;
      const parts: string[] = [];
      if (z) parts.push(z > 0 ? 'up' : 'down');
      if (y) parts.push(y > 0 ? 'left' : 'right');
      if (x) parts.push(x > 0 ? 'forward' : 'back');
      const cm = Math.round(Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) * 100);
      return `Moving ${parts.join(' and ') || 'tip'} ${cm} centimeters.`;
    }
    case 'moveTo': return `Moving to ${cmd.xyz.map((v) => v.toFixed(2)).join(', ')}.`;
    case 'touchKey': return `Touching key ${cmd.key}.`;
    case 'typePin': return `Entering the PIN.`;
    default: return 'Done.';
  }
}

type Feedback = { kind: 'ok' | 'reject' | 'error'; text: string } | null;

const EXAMPLES = ['home', 'rotate base 30 degrees', 'move up 2 cm', 'touch key 5', 'stop'];

export default function VoicePanel() {
  const [typed, setTyped] = useState('');
  const [heard, setHeard] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const holding = useRef(false);

  useEffect(() => () => cancelSpeech(), []);

  /** The one path both the mic and the typed box run through. Grammar only. */
  const run = (utterance: string) => {
    setHeard(utterance);
    const result = parse(utterance);

    if (isError(result)) {
      setFeedback({ kind: 'error', text: result.error });
      speak(result.error);
      return;
    }
    const outcome = dispatch(result);
    if (outcome.ok) {
      const msg = confirm(result);
      setFeedback({ kind: 'ok', text: msg });
      speak(msg);
    } else {
      const msg = `Can't do that: ${outcome.reason}.`;
      setFeedback({ kind: 'reject', text: msg });
      speak(msg);
    }
  };

  const rec = useSpeechRecognition(run);

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim()) return;
    run(typed);
    setTyped('');
  };

  // Hold-to-talk (pointer works for mouse + touch).
  const pttDown = () => {
    holding.current = true;
    cancelSpeech();
    rec.start();
  };
  const pttUp = () => {
    if (!holding.current) return;
    holding.current = false;
    rec.stop();
  };

  const fbColor =
    feedback?.kind === 'ok' ? 'text-ok' : feedback?.kind === 'reject' ? 'text-alarm' : 'text-alarm';

  return (
    <Panel
      title="Voice control"
      delay={80}
      meta={
        <span
          title="Deterministic keyword grammar — runs offline, no API key"
          className="chip border-signal-deep uppercase text-signal"
        >
          Phase 3 · offline
        </span>
      }
    >
      {rec.supported ? (
        <button
          type="button"
          onPointerDown={pttDown}
          onPointerUp={pttUp}
          onPointerLeave={pttUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`btn mb-2 flex w-full select-none items-center justify-center gap-2 py-2 text-xs ${
            rec.listening ? 'btn-flare breathe' : ''
          }`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              rec.listening ? 'bg-flare' : 'bg-dim'
            }`}
          />
          {rec.listening ? 'Listening — release to send' : 'Hold to talk'}
        </button>
      ) : (
        <p className="mb-2 text-[10px] text-dim">
          Speech recognition unavailable in this browser — use the box below.
        </p>
      )}

      <form onSubmit={submitTyped} className="mb-2 flex gap-1.5">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder='e.g. "rotate base 30 degrees"'
          className="well min-w-0 flex-1 rounded px-2 py-1.5 text-xs text-ink outline-none placeholder:text-dim"
        />
        <button type="submit" className="btn px-3 py-1.5 text-xs">
          Send
        </button>
      </form>

      {rec.interim && <p className="mb-1 text-[11px] italic text-muted">{rec.interim}…</p>}
      {rec.error && <p className="mb-1 text-[11px] text-alarm">{rec.error}</p>}

      {heard && (
        <p className="mb-1 text-[11px] text-dim">
          heard: <span className="text-muted">"{heard}"</span>
        </p>
      )}

      {feedback ? (
        <p className={`text-[11px] leading-relaxed ${fbColor}`}>
          <span className="chip mr-1.5 uppercase">grammar</span>
          {feedback.text}
          {feedback.kind === 'error' && (
            <span className="mt-1 block text-dim">
              Multi-step or free-form phrasing? Use the agentic panel below.
            </span>
          )}
        </p>
      ) : (
        <p className="text-[10px] leading-relaxed text-dim">
          Try: {EXAMPLES.map((e) => `"${e}"`).join(' · ')}
        </p>
      )}
    </Panel>
  );
}
