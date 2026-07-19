/**
 * The agent loop (PLAN.md Phase 3B) — the safety-gated brain seam.
 *
 *   1. Ask the LLM for a plan from the live arm state.
 *   2. If it wants clarification (or produced nothing), speak the question, stop.
 *   3. Dry-run EVERY command through precheck() — the identical validator the
 *      joystick/keyboard hit. If any is rejected, hand the reasons back for ONE
 *      revision, then re-check.
 *   4. If a command is still rejected after the revision → execute NOTHING and
 *      return a spoken refusal (the red-team story).
 *   5. Otherwise run the commands in order through the shared dispatch(), waiting
 *      for each motion to settle before the next, with per-command status.
 *
 * The agent never touches the store or controller directly — only dispatch(),
 * exactly like voice. No privileged path.
 */
import { AgentPlan, toMotionCommand, describeAction, type AgentAction } from './schema';
import { buildSystemPrompt } from './systemPrompt';
import { chatJSON, type ChatMessage } from './groqClient';
import { dispatch, precheck } from '../voice/pipeline';
import { motion } from '../state/controller';
import { pinRunner } from '../state/pinRunner';

export type CommandState = 'pending' | 'running' | 'ok' | 'rejected';
export interface CommandStatus {
  action: AgentAction;
  label: string;
  state: CommandState;
  reason?: string;
}

export interface AgentCallbacks {
  onPlan?: (plan: AgentPlan) => void;
  onStatus?: (statuses: CommandStatus[]) => void;
}

export interface AgentResult {
  ok: boolean;
  speech: string;
  /** Set when we asked a clarifying question or refused — for UI tone. */
  clarify?: boolean;
  refused?: boolean;
}

/** Ask the model for a plan and validate its shape with zod. */
async function requestPlan(messages: ChatMessage[]): Promise<AgentPlan> {
  const raw = await chatJSON(messages);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('The model did not return valid JSON.');
  }
  const parsed = AgentPlan.safeParse(json);
  if (!parsed.success) throw new Error('The model response did not match the plan schema.');
  return parsed.data;
}

/** Dry-run every action; collect the ones the gate rejects (with reasons). */
function precheckAll(actions: AgentAction[]): { action: AgentAction; reason: string }[] {
  const rejected: { action: AgentAction; reason: string }[] = [];
  for (const a of actions) {
    const r = precheck(toMotionCommand(a));
    if (!r.ok) rejected.push({ action: a, reason: r.reason });
  }
  return rejected;
}

/** Resolve once no lane is animating (or after a safety timeout). */
function waitIdle(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const check = () => {
      if ((!motion.busy && !pinRunner.active) || performance.now() - start > timeoutMs) resolve();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

export async function runAgent(utterance: string, cb: AgentCallbacks = {}): Promise<AgentResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: utterance },
  ];

  let plan = await requestPlan(messages);
  cb.onPlan?.(plan);

  if (plan.needs_clarification || plan.commands.length === 0) {
    return { ok: false, clarify: true, speech: plan.speech || 'Could you clarify that?' };
  }

  // Gate the whole plan before anything moves.
  let rejected = precheckAll(plan.commands);
  if (rejected.length > 0) {
    const feedback =
      'The safety validator rejected these commands:\n' +
      rejected.map((r) => `- ${describeAction(r.action)}: ${r.reason}`).join('\n') +
      '\nRevise so every command is within joint limits and reachable, or set ' +
      'needs_clarification=true if the request cannot be done safely.';
    messages.push({ role: 'assistant', content: JSON.stringify(plan) });
    messages.push({ role: 'user', content: feedback });

    plan = await requestPlan(messages);
    cb.onPlan?.(plan);

    if (plan.needs_clarification || plan.commands.length === 0) {
      return { ok: false, refused: true, speech: plan.speech || "I can't do that safely." };
    }
    rejected = precheckAll(plan.commands);
    if (rejected.length > 0) {
      const reason = rejected[0].reason;
      const why = `I won't do that — ${reason}.`;
      return { ok: false, refused: true, speech: plan.speech ? `${plan.speech} ${why}` : why };
    }
  }

  // All clear — execute in order through the shared dispatch.
  const statuses: CommandStatus[] = plan.commands.map((action) => ({
    action,
    label: describeAction(action),
    state: 'pending',
  }));
  cb.onStatus?.(statuses.map((s) => ({ ...s })));

  for (let i = 0; i < plan.commands.length; i++) {
    statuses[i].state = 'running';
    cb.onStatus?.(statuses.map((s) => ({ ...s })));

    const out = dispatch(toMotionCommand(plan.commands[i]));
    if (!out.ok) {
      statuses[i].state = 'rejected';
      statuses[i].reason = out.reason;
      cb.onStatus?.(statuses.map((s) => ({ ...s })));
      return { ok: false, refused: true, speech: `Stopped: ${out.reason}.` };
    }
    await waitIdle();
    statuses[i].state = 'ok';
    cb.onStatus?.(statuses.map((s) => ({ ...s })));
  }

  return { ok: true, speech: plan.speech || 'Done.' };
}
