import { describe, it, expect } from 'vitest';
import { parse } from '../src/voice/grammar';
import type { MotionCommand } from '../src/voice/pipeline';

const DEG = Math.PI / 180;

/** Assert a successful parse deep-equals the expected command. */
function ok(utterance: string, expected: MotionCommand) {
  expect(parse(utterance)).toEqual(expected);
}
/** Assert the utterance fails to parse. */
function err(utterance: string) {
  expect(parse(utterance)).toHaveProperty('error');
}

describe('voice grammar — control words', () => {
  it('stop / halt / abort', () => {
    ok('stop', { type: 'stop', source: 'voice' });
    ok('halt now', { type: 'stop', source: 'voice' });
    ok('abort!', { type: 'stop', source: 'voice' });
  });

  it('home / go home / reset', () => {
    ok('home', { type: 'home', source: 'voice' });
    ok('go home', { type: 'home', source: 'voice' });
    ok('reset the arm', { type: 'home', source: 'voice' });
  });
});

describe('voice grammar — rotate (joint space, no IK)', () => {
  it('rotate base with digits', () => {
    ok('rotate base 30 degrees', { type: 'rotateJoint', joint: 1, deltaRad: 30 * DEG, source: 'voice' });
  });
  it('rotate base with a spoken number word', () => {
    ok('rotate base thirty degrees', { type: 'rotateJoint', joint: 1, deltaRad: 30 * DEG, source: 'voice' });
  });
  it('rotate base right = negative', () => {
    ok('rotate base right 30', { type: 'rotateJoint', joint: 1, deltaRad: -30 * DEG, source: 'voice' });
  });
  it('rotate base with no angle uses the default', () => {
    ok('rotate base', { type: 'rotateJoint', joint: 1, deltaRad: 15 * DEG, source: 'voice' });
  });
  it('rotate a specific joint — joint digit is not read as the angle', () => {
    ok('rotate joint 2 by 15 degrees', { type: 'rotateJoint', joint: 2, deltaRad: 15 * DEG, source: 'voice' });
  });
  it('two-word angle: forty five', () => {
    ok('rotate joint 3 forty five degrees', { type: 'rotateJoint', joint: 3, deltaRad: 45 * DEG, source: 'voice' });
  });
  it('absolute "to" target', () => {
    ok('rotate base to 90 degrees', { type: 'rotateJoint', joint: 1, toRad: 90 * DEG, source: 'voice' });
  });

  it('every joint is addressable by name', () => {
    ok('rotate base 10 degrees', { type: 'rotateJoint', joint: 1, deltaRad: 10 * DEG, source: 'voice' });
    ok('rotate shoulder 10 degrees', { type: 'rotateJoint', joint: 2, deltaRad: 10 * DEG, source: 'voice' });
    ok('rotate elbow 10 degrees', { type: 'rotateJoint', joint: 3, deltaRad: 10 * DEG, source: 'voice' });
    ok('rotate forearm 10 degrees', { type: 'rotateJoint', joint: 4, deltaRad: 10 * DEG, source: 'voice' });
    ok('rotate wrist 10 degrees', { type: 'rotateJoint', joint: 5, deltaRad: 10 * DEG, source: 'voice' });
    ok('rotate tool 10 degrees', { type: 'rotateJoint', joint: 6, deltaRad: 10 * DEG, source: 'voice' });
    ok('rotate stylus 10 degrees', { type: 'rotateJoint', joint: 7, deltaRad: 10 * DEG, source: 'voice' });
  });
  it('turn / spin are synonyms for rotate', () => {
    ok('turn elbow to 45 degrees', { type: 'rotateJoint', joint: 3, toRad: 45 * DEG, source: 'voice' });
    ok('spin wrist right 20', { type: 'rotateJoint', joint: 5, deltaRad: -20 * DEG, source: 'voice' });
  });
});

describe('voice grammar — jog (cartesian, base frame Z-up)', () => {
  it('move up default 2 cm = +z', () => {
    ok('move up', { type: 'jog', delta: [0, 0, 0.02], source: 'voice' });
  });
  it('move up 5 cm', () => {
    ok('move up 5 cm', { type: 'jog', delta: [0, 0, 0.05], source: 'voice' });
  });
  it('move down 10 centimeters = -z', () => {
    ok('move down 10 centimeters', { type: 'jog', delta: [0, 0, -0.1], source: 'voice' });
  });
  it('left = +y, right = -y', () => {
    ok('move left', { type: 'jog', delta: [0, 0.02, 0], source: 'voice' });
    ok('move right 3 cm', { type: 'jog', delta: [0, -0.03, 0], source: 'voice' });
  });
  it('forward = +x (toward panel), back = -x', () => {
    ok('move forward 4 cm', { type: 'jog', delta: [0.04, 0, 0], source: 'voice' });
    ok('move back', { type: 'jog', delta: [-0.02, 0, 0], source: 'voice' });
  });
  it('nudge up a couple centimeters = 2 cm', () => {
    ok('nudge up a couple centimeters', { type: 'jog', delta: [0, 0, 0.02], source: 'voice' });
  });
  it('move up a few cm = 3 cm', () => {
    ok('move up a few cm', { type: 'jog', delta: [0, 0, 0.03], source: 'voice' });
  });
  it('out-of-reach jog still parses (validate() rejects it, not the grammar)', () => {
    ok('move down 200 cm', { type: 'jog', delta: [0, 0, -2], source: 'voice' });
  });
});

describe('voice grammar — key touch & PIN (need IK, parse now)', () => {
  it('touch / press / tap key K', () => {
    ok('touch key 5', { type: 'touchKey', key: 5, source: 'voice' });
    ok('press key 3', { type: 'touchKey', key: 3, source: 'voice' });
    ok('tap key 6', { type: 'touchKey', key: 6, source: 'voice' });
  });
  it('type pin — 6 digits', () => {
    ok('type pin 483921', { type: 'typePin', pin: '483921', source: 'voice' });
    ok('enter pin 000000', { type: 'typePin', pin: '000000', source: 'voice' });
  });
  it('pin with the wrong length is rejected', () => {
    err('type pin 12345');
  });
});

describe('voice grammar — moveTo', () => {
  it('move to X Y Z', () => {
    ok('move to 0.5 0.05 0.05', { type: 'moveTo', xyz: [0.5, 0.05, 0.05], source: 'voice' });
  });
});

describe('voice grammar — rejections', () => {
  it('gibberish → error', () => err('make me a sandwich'));
  it('empty → error', () => err('   '));
  it('unknown verb → error', () => err('dance around'));
});
