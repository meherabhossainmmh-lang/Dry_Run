/**
 * Deterministic voice grammar — the wifi-proof core of Phase 3.
 *
 * `parse()` is PURE: text in, a MotionCommand (source:'voice') or {error} out.
 * No network, no store, no three.js. Both the mic transcript and the typed
 * command box call this exact function, so the typed box is a perfect stand-in
 * when speech recognition is unavailable (PLAN.md risk #3).
 *
 * Base frame is Z-up (the app's single zUpRoot conversion), so in the arm's
 * base frame:  forward = +x (toward the key panel) · left = +y · up = +z.
 */
import type { MotionCommand } from './pipeline';

const DEG = Math.PI / 180;
const DEFAULT_JOG_CM = 2; // "move up" with no distance → 2 cm
const DEFAULT_ROTATE_DEG = 15; // "rotate base" with no angle → 15°

/**
 * Spoken joint names → 1-based joint number (grammar convention; the pipeline
 * subtracts 1 for the 0-based core contract). Order matters — first match wins.
 * Names track the CHAIN labels in core/chain.ts:
 *   1 base yaw · 2 shoulder · 3 elbow · 4 forearm roll · 5 wrist pitch ·
 *   6 tool roll · 7 stylus pitch.
 */
const JOINT_ALIASES: Array<[RegExp, number]> = [
  [/\b(base|waist|yaw)\b/, 1],
  [/\bshoulder\b/, 2],
  [/\belbow\b/, 3],
  [/\bforearm\b/, 4],
  [/\bwrist\b/, 5],
  [/\b(tool|gripper)\b/, 6],
  [/\b(stylus|pen)\b/, 7],
];

/** Friendly joint names for spoken confirmations, indexed by 1-based number. */
export const JOINT_LABELS = ['', 'base', 'shoulder', 'elbow', 'forearm', 'wrist', 'tool', 'stylus'];

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

/** Convert spoken number words to digits: "thirty" → 30, "forty five" → 45. */
function normalizeNumbers(text: string): string {
  let t = text
    .replace(/\ba couple of\b/g, '2')
    .replace(/\ba couple\b/g, '2')
    .replace(/\bcouple\b/g, '2')
    .replace(/\ba few\b/g, '3')
    .replace(/\bfew\b/g, '3');

  const tokens = t.split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (w in TENS) {
      const next = tokens[i + 1];
      if (next && next in ONES && ONES[next] < 10) {
        out.push(String(TENS[w] + ONES[next]));
        i++;
        continue;
      }
      out.push(String(TENS[w]));
      continue;
    }
    if (w in ONES) {
      out.push(String(ONES[w]));
      continue;
    }
    out.push(w);
  }
  t = out.join(' ');
  return t;
}

function normalize(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .replace(/\bplease\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizeNumbers(cleaned);
}

/** First number in the string, or null. */
function firstNumber(text: string): number | null {
  const m = text.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

type Parsed = MotionCommand | { error: string };

export function parse(raw: string): Parsed {
  const text = normalize(raw);
  if (!text) return { error: 'I heard nothing.' };

  // stop / halt
  if (/\b(stop|halt|freeze|abort)\b/.test(text)) {
    return { type: 'stop', source: 'voice' };
  }

  // home / go home / reset
  if (/\b(go )?home\b/.test(text) || /\breset\b/.test(text)) {
    return { type: 'home', source: 'voice' };
  }

  // type / enter pin NNNNNN
  const pinM = text.match(/\b(?:type|enter|input)\b.*?\bpin\b\s*([0-9\s]+)/);
  if (pinM) {
    const pin = pinM[1].replace(/\s/g, '');
    if (pin.length !== 6) return { error: 'A PIN must be 6 digits.' };
    return { type: 'typePin', pin, source: 'voice' };
  }

  // touch / press / tap key K
  const keyM = text.match(/\b(?:touch|press|tap|hit)\b.*?\bkey\b\s*([1-6])/);
  if (keyM) {
    const key = Number(keyM[1]) as 1 | 2 | 3 | 4 | 5 | 6;
    return { type: 'touchKey', key, source: 'voice' };
  }

  // move to X Y Z (absolute cartesian target, meters)
  const moveToM = text.match(
    /\bmove to\b\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/,
  );
  if (moveToM) {
    return {
      type: 'moveTo',
      xyz: [Number(moveToM[1]), Number(moveToM[2]), Number(moveToM[3])],
      source: 'voice',
    };
  }

  // rotate <joint N | name> [left|right|to] [N] degrees  (any of the 7 joints)
  if (/\b(rotate|turn|spin)\b/.test(text)) {
    let joint = 1; // "base" default when no joint is named
    const jM = text.match(/joint\s*([1-7])/);
    if (jM) joint = Number(jM[1]);
    else {
      for (const [re, n] of JOINT_ALIASES) {
        if (re.test(text)) { joint = n; break; }
      }
    }

    // Strip the joint token so its digit isn't mistaken for the angle.
    const stripped = text.replace(/joint\s*[1-7]/, ' ');
    const absolute = /\bto\b/.test(stripped);
    const dirNeg = /\b(right|clockwise|cw|negative)\b/.test(text);
    const amount = firstNumber(stripped) ?? DEFAULT_ROTATE_DEG;

    return absolute
      ? { type: 'rotateJoint', joint, toRad: amount * DEG, source: 'voice' }
      : { type: 'rotateJoint', joint, deltaRad: (dirNeg ? -amount : amount) * DEG, source: 'voice' };
  }

  // move up|down|left|right|forward|back [N cm]
  const dirM = text.match(/\b(up|down|left|right|forward|forwards|back|backward|backwards)\b/);
  if (/\b(move|jog|nudge|go|shift|slide)\b/.test(text) && dirM) {
    const dir = dirM[1];
    const cm = firstNumber(text) ?? DEFAULT_JOG_CM;
    const m = cm / 100;
    const delta: [number, number, number] = [0, 0, 0];
    switch (dir) {
      case 'up': delta[2] = m; break;
      case 'down': delta[2] = -m; break;
      case 'left': delta[1] = m; break;
      case 'right': delta[1] = -m; break;
      case 'forward':
      case 'forwards': delta[0] = m; break;
      case 'back':
      case 'backward':
      case 'backwards': delta[0] = -m; break;
    }
    return { type: 'jog', delta, source: 'voice' };
  }

  return { error: `Sorry, I didn't understand "${raw.trim()}".` };
}

/** True when parse() failed. Convenience for callers. */
export function isError(r: Parsed): r is { error: string } {
  return 'error' in r;
}
