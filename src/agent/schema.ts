/**
 * The agent's output contract (PLAN.md Phase 3B).
 *
 * The LLM returns a plan in intuitive units — joints by 1-based number, angles
 * in degrees, jogs by direction + centimetres — which `toMotionCommand()` lowers
 * into the exact same `MotionCommand` the voice grammar emits (source:'agent').
 * From there it flows through the identical validate() → dispatch surface as
 * every other input: the agent has no privileged path.
 *
 * We validate the raw model output with zod so a malformed / hallucinated plan
 * is rejected before a single joint moves.
 */
import { z } from 'zod';
import type { MotionCommand } from '../voice/pipeline';

const DEG = Math.PI / 180;

export const JOG_DIRECTIONS = ['up', 'down', 'left', 'right', 'forward', 'back'] as const;

/** One planned action, in the human-friendly units the LLM reasons in. */
export const AgentAction = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('rotateJoint'),
    joint: z.number().int().min(1).max(7),
    degrees: z.number(),
    absolute: z.boolean().optional(), // true → rotate TO this angle, else BY it
  }),
  z.object({ action: z.literal('jog'), direction: z.enum(JOG_DIRECTIONS), cm: z.number() }),
  z.object({ action: z.literal('moveTo'), x: z.number(), y: z.number(), z: z.number() }),
  z.object({ action: z.literal('touchKey'), key: z.number().int().min(1).max(6) }),
  z.object({ action: z.literal('typePin'), pin: z.string() }),
  z.object({ action: z.literal('home') }),
  z.object({ action: z.literal('stop') }),
]);
export type AgentAction = z.infer<typeof AgentAction>;

/** The full LLM response envelope. */
export const AgentPlan = z.object({
  speech: z.string(),
  needs_clarification: z.boolean(),
  commands: z.array(AgentAction),
});
export type AgentPlan = z.infer<typeof AgentPlan>;

/** Lower one planned action into the shared MotionCommand contract. */
export function toMotionCommand(a: AgentAction): MotionCommand {
  switch (a.action) {
    case 'rotateJoint':
      return a.absolute
        ? { type: 'rotateJoint', joint: a.joint, toRad: a.degrees * DEG, source: 'agent' }
        : { type: 'rotateJoint', joint: a.joint, deltaRad: a.degrees * DEG, source: 'agent' };
    case 'jog': {
      const m = a.cm / 100;
      const d: [number, number, number] = [0, 0, 0];
      switch (a.direction) {
        case 'up': d[2] = m; break;
        case 'down': d[2] = -m; break;
        case 'left': d[1] = m; break;
        case 'right': d[1] = -m; break;
        case 'forward': d[0] = m; break;
        case 'back': d[0] = -m; break;
      }
      return { type: 'jog', delta: d, source: 'agent' };
    }
    case 'moveTo':
      return { type: 'moveTo', xyz: [a.x, a.y, a.z], source: 'agent' };
    case 'touchKey':
      return { type: 'touchKey', key: a.key as 1 | 2 | 3 | 4 | 5 | 6, source: 'agent' };
    case 'typePin':
      return { type: 'typePin', pin: a.pin, source: 'agent' };
    case 'home':
      return { type: 'home', source: 'agent' };
    case 'stop':
      return { type: 'stop', source: 'agent' };
  }
}

/** One-line human summary of an action — used for the per-command badges. */
export function describeAction(a: AgentAction): string {
  switch (a.action) {
    case 'rotateJoint':
      return `rotate joint ${a.joint} ${a.absolute ? 'to' : 'by'} ${a.degrees}°`;
    case 'jog':
      return `move ${a.direction} ${a.cm} cm`;
    case 'moveTo':
      return `move to (${a.x}, ${a.y}, ${a.z}) m`;
    case 'touchKey':
      return `touch key ${a.key}`;
    case 'typePin':
      return `type PIN ${a.pin}`;
    case 'home':
      return 'home';
    case 'stop':
      return 'stop';
  }
}
