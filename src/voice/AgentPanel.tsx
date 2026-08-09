/**
 * Phase 3B — Agentic voice control (optional extension, separately scored).
 *
 * Routes free-form / multi-step natural language through an LLM reasoning layer
 * that emits the SAME structured MotionCommands the deterministic grammar does.
 * Every command it produces is dry-run through the identical `validate()` gate
 * before anything moves (see agentLoop.ts) — an out-of-bounds plan is refused or
 * re-prompted, never executed blindly.
 *
 * Kept deliberately separate from Phase 3: the required deterministic baseline
 * must work on its own, with no key and no network. This panel is additive.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { speak, cancelSpeech } from './tts';
import { useSpeechRecognition } from './useSpeechRecognition';
import { runAgent, type CommandStatus } from '../agent/agentLoop';
import { hasApiKey, setApiKey, clearApiKey, PRIMARY_MODEL } from '../agent/groqClient';
import Panel from '../components/ui/Panel';

type FbKind = 'ok' | 'reject' | 'error' | 'clarify' | 'agent';
type Feedback = { kind: FbKind; text: string } | null;

const BADGE: Record<CommandStatus['state'], string> = {
  pending: 'border-hairline text-dim',
  running: 'border-flare text-flare breathe',
  ok: 'border-ok/50 text-ok',
  rejected: 'border-alarm/60 text-alarm',
};

export default function AgentPanel() {
  const [typed, setTyped] = useState('');
  const [heard, setHeard] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [statuses, setStatuses] = useState<CommandStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const holding = useRef(false);

  const [keyed, setKeyed] = useState(hasApiKey());
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  useEffect(() => () => cancelSpeech(), []);

  const saveKey = () => {
    if (!keyInput.trim()) return;
    setApiKey(keyInput);
    setKeyInput('');
    setKeyed(true);
    setShowKey(false);
  };
  const forgetKey = () => {
    clearApiKey();
    setKeyed(false);
  };

  /** Plan → gate → execute. The agent never touches the arm directly. */
  const run = useCallback(async (utterance: string) => {
    setHeard(utterance);
    setStatuses([]);
    setBusy(true);
    try {
      const res = await runAgent(utterance, {
        onPlan: (p) =>
          setFeedback({ kind: p.needs_clarification ? 'clarify' : 'agent', text: p.speech }),
        onStatus: setStatuses,
      });
      const kind: FbKind = res.ok ? 'ok' : res.clarify ? 'clarify' : 'reject';
      setFeedback({ kind, text: res.speech });
      speak(res.speech);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Agent failed.';
      setFeedback({ kind: 'error', text: msg });
    } finally {
      setBusy(false);
    }
  }, []);

  const rec = useSpeechRecognition((t) => void run(t));

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim() || busy || !keyed) return;
    void run(typed);
    setTyped('');
  };

  const pttDown = () => {
    if (!keyed) return;
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
    feedback?.kind === 'ok'
      ? 'text-ok'
      : feedback?.kind === 'reject' || feedback?.kind === 'error'
        ? 'text-alarm'
        : feedback?.kind === 'clarify'
          ? 'text-signal'
          : 'text-flare';

  return (
    <Panel
      title="Agentic voice control"
      delay={120}
      meta={
        <div className="flex items-center gap-1.5">
          <span
            title="Optional extension — an LLM reasoning layer behind the same safety gate"
            className="chip border-flare-deep uppercase text-flare"
          >
            Phase 3B
          </span>
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            title="Groq API key — required for this panel only"
            className="btn px-1.5 py-0.5 text-[10px]"
          >
            ⚙ {keyed ? 'AI on' : 'AI off'}
          </button>
        </div>
      }
    >
      {showKey && (
        <div className="well mb-2 rounded p-2">
          <p className="mb-1.5 text-[10px] leading-relaxed text-dim">
            Groq API key — powers this panel only. Stored in this browser. Phase 3 voice control
            keeps working without it.
          </p>
          <div className="flex gap-1.5">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="gsk_…"
              className="well min-w-0 flex-1 rounded px-2 py-1.5 text-xs text-ink outline-none placeholder:text-dim"
            />
            <button type="button" onClick={saveKey} className="btn px-3 py-1.5 text-xs">
              Save
            </button>
            {keyed && (
              <button type="button" onClick={forgetKey} className="btn btn-alarm px-2 py-1.5 text-xs">
                Forget
              </button>
            )}
          </div>
          <p className="num mt-1.5 text-[9px] text-dim">Model: {PRIMARY_MODEL}</p>
        </div>
      )}

      {!keyed && (
        <p className="well mb-2 rounded px-2 py-1.5 text-[10px] leading-relaxed text-dim">
          Add a Groq key (⚙) to enable free-form, multi-step commands.
        </p>
      )}

      {rec.supported ? (
        <button
          type="button"
          onPointerDown={pttDown}
          onPointerUp={pttUp}
          onPointerLeave={pttUp}
          onContextMenu={(e) => e.preventDefault()}
          disabled={busy || !keyed}
          className={`btn mb-2 flex w-full select-none items-center justify-center gap-2 py-2 text-xs ${
            rec.listening ? 'btn-flare breathe' : ''
          }`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${rec.listening ? 'bg-flare' : 'bg-dim'}`}
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
          disabled={busy || !keyed}
          placeholder='e.g. "tap key 5 twice then lift 2 cm"'
          className="well min-w-0 flex-1 rounded px-2 py-1.5 text-xs text-ink outline-none placeholder:text-dim disabled:opacity-40"
        />
        <button type="submit" disabled={busy || !keyed} className="btn btn-flare px-3 py-1.5 text-xs">
          {busy ? '…' : 'Send'}
        </button>
      </form>

      {rec.interim && <p className="mb-1 text-[11px] italic text-muted">{rec.interim}…</p>}
      {rec.error && <p className="mb-1 text-[11px] text-alarm">{rec.error}</p>}

      {heard && (
        <p className="mb-1 text-[11px] text-dim">
          heard: <span className="text-muted">"{heard}"</span>
        </p>
      )}

      {feedback && (
        <p className={`text-[11px] leading-relaxed ${fbColor}`}>
          <span className="chip mr-1.5 uppercase">AI</span>
          {feedback.text}
        </p>
      )}

      {statuses.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {statuses.map((s, i) => (
            <li
              key={i}
              className={`well flex items-center justify-between rounded border px-2 py-1 text-[10px] ${BADGE[s.state]}`}
            >
              <span className="truncate">{s.label}</span>
              <span className="num ml-2 shrink-0">
                {s.state === 'ok'
                  ? '✓'
                  : s.state === 'rejected'
                    ? `✗ ${s.reason ?? ''}`
                    : s.state === 'running'
                      ? '…'
                      : '·'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
