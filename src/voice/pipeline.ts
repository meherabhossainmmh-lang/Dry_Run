/**
 * Voice → shared-pipeline seam.
 *
 * This is the ONE place src/voice/ couples to the motion pipeline. Per PLAN.md
 * the real pipeline lives in `src/core/` (commands · validate) + the shared
 * `motion` controller, and every input (dashboard, joystick, keyboard, voice,
 * agent, auto) funnels through the same `validate()` gate — "the agent has no
 * privileged path".
 *
 * Now that core has landed, `dispatch()` runs the parsed command through the
 * real `validate()` gate (for a spoken reason on rejection) and then the shared
 * `motion` controller — the exact surface the keyboard uses. The only
 * translation needed is joint numbering: the voice grammar speaks 1-based joint
 * numbers ("base" = joint 1) while the core contract is 0-based.
 */
import { useArmStore } from '../state/store';
import { motion } from '../state/controller';
import { pinRunner } from '../state/pinRunner';
import { validate } from '../core/validate';
import type { MotionCommand as CoreCommand } from '../core/commands';

// --- MotionCommand contract (copied verbatim from PLAN.md, not redefined) ---
export type Source =
  | 'dashboard'
  | 'joystick'
  | 'keyboard'
  | 'voice'
  | 'agent'
  | 'auto';

export type MotionCommand =
  | { type: 'jog'; delta: [number, number, number]; source: Source } // base-frame meters
  | { type: 'jogJoint'; joint: number; deltaRad: number; source: Source }
  | { type: 'moveTo'; xyz: [number, number, number]; tipDown?: boolean; source: Source }
  | { type: 'rotateJoint'; joint: number; toRad?: number; deltaRad?: number; source: Source }
  | { type: 'home'; source: Source }
  | { type: 'touchKey'; key: 1 | 2 | 3 | 4 | 5 | 6; source: Source }
  | { type: 'typePin'; pin: string; source: Source }
  | { type: 'stop'; source: Source };

export type DispatchResult = { ok: true } | { ok: false; reason: string };

/**
 * Translate a voice command to the core contract. The only difference is joint
 * numbering: the grammar emits 1-based joints ("base" = 1), the core is 0-based.
 */
function toCore(cmd: MotionCommand): CoreCommand {
  if (cmd.type === 'rotateJoint' || cmd.type === 'jogJoint') {
    return { ...cmd, joint: cmd.joint - 1 } as CoreCommand;
  }
  return cmd as CoreCommand;
}

/**
 * Validate-only dry run through the SAME gate execution uses — no motion. The
 * agent loop calls this to decide whether a plan needs a revision before any
 * command runs (PLAN.md "every command through the same validate()").
 */
export function precheck(cmd: MotionCommand): DispatchResult {
  const res = validate(toCore(cmd), useArmStore.getState().q);
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}

/**
 * Run a parsed command through the same gate + executors every other input
 * source uses. `validate()` gives us a human reason to speak on rejection, then:
 *   • touchKey / typePin → the autonomous PIN runner (reachability-safe poses)
 *   • everything else     → the shared motion controller (IK, eased motion)
 * Same surface for voice and agent — no source gets a privileged path.
 */
export function dispatch(cmd: MotionCommand): DispatchResult {
  const core = toCore(cmd);
  const res = validate(core, useArmStore.getState().q);
  if (!res.ok) return { ok: false, reason: res.reason };

  if (core.type === 'touchKey') {
    return pinRunner.start(String(core.key))
      ? { ok: true }
      : { ok: false, reason: `key ${core.key} is not reachable` };
  }
  if (core.type === 'typePin') {
    return pinRunner.start(core.pin)
      ? { ok: true }
      : { ok: false, reason: 'could not start the PIN sequence' };
  }
  // motion.dispatch returns a {ok, reason} record — always truthy. Read the flag,
  // or a rejected command (no IK solution, surface contact) reports success.
  const out = motion.dispatch(core);
  return out.ok ? { ok: true } : { ok: false, reason: out.reason };
}
