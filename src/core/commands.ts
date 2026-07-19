// The MotionCommand contract — the one vocabulary every input source (dashboard,
// joystick, keyboard, voice, agent, auto PIN) speaks. Everything funnels through
// validate() then the controller; no source gets a privileged path.

export type Source = 'dashboard' | 'joystick' | 'keyboard' | 'voice' | 'agent' | 'auto';
export type Digit = 1 | 2 | 3 | 4 | 5 | 6;

export type MotionCommand =
  | { type: 'jog'; delta: [number, number, number]; source: Source } // base-frame meters
  | { type: 'jogJoint'; joint: number; deltaRad: number; source: Source }
  | { type: 'moveTo'; xyz: [number, number, number]; tipDown?: boolean; source: Source }
  | { type: 'rotateJoint'; joint: number; toRad?: number; deltaRad?: number; source: Source }
  | { type: 'home'; source: Source }
  | { type: 'touchKey'; key: Digit; source: Source }
  | { type: 'typePin'; pin: string; source: Source }
  | { type: 'stop'; source: Source };
