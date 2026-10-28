// Field is COLS x ROWS cells of size 1. y grows upward; row 0 is the bottom.
export const COLS = 96;
export const ROWS = 128;

export const BALL_R = 0.28;
export const BALL_SPEED = 36; // cells per second outside the box (serves, returns off the paddle)
export const BALL_SPEED_INSIDE = 72; // inside the steel box a ball flies twice as fast (owner, 2026-10-29)
export const WALL_EVENTS_MAX = 4; // wall knocks reported per step at most (thousands of balls bounce)
export const MAX_BALLS = 4000;
// Until the first ball of a serve gets into the box, each paddle bounce adds a
// ball (up to this many): the opening has more tries instead of dead time.
export const PRE_ENTRY_MAX = 8;
// After the boss's shield drops (finale), each caught fruit fires a beam at it:
// this share of its max health per point of the fruit's ball gain (×7 apple = 10.5%).
export const BEAM_SHARE = 0.015;
// Balls a fruit would add past the cap turn into this much score each.
export const OVERFLOW_SCORE = 5;
export const MAX_SUBSTEP = 0.4; // max distance a ball travels per substep (cells)

export const PADDLE_Y = 6;
export const PADDLE_H = 1;
export const PADDLE_W = 12;
export const PADDLE_MAX_ANGLE = (62 * Math.PI) / 180;

export const START_LIVES = 3;
export const FIRE_TIME = 1.1; // seconds a ball stays on fire (fire cell): ~80 cells of burn at BALL_SPEED_INSIDE
export const METEOR_FIRE = 0.45; // shorter burn for meteor balls (both halved with the doubled ball speed)
export const BOMB_RADIUS = 5.5;
export const BOMB_DELAY = 0.07; // chain reaction delay per hop
export const COMBO_WINDOW = 0.6; // seconds without a break before combo resets
export const METEOR_COUNT = 12;
export const SPLIT_SKILL_MAX = 150; // most balls one split skill can add
export const LAUNCH_BALLS = 3; // every serve is a small fan so openings are lively
export const FINALE_FRACTION = 0.025; // bricks left (of total) that trigger the finale sweep
export const STALL_TIME = 6; // seconds without a break that also trigger the finale...
export const STALL_FRACTION = 0.12; // ...once at most this fraction is left
export const FINALE_GAP = 0.06; // seconds between finale zaps
export const SPLIT_USES = 8; // passes before a multiplier gate wears out

export const CELL = Object.freeze({
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  SPLIT2: 3,
  SPLIT3: 4,
  SPLIT5: 5,
  BOMB: 6,
  LASER_H: 7,
  LASER_V: 8,
  GOLD: 9,
  FIRE: 10,
  ITEM5: 11,
  ITEM10: 12,
  ITEM20: 13,
  ITEM30: 14,
  ITEM50: 15,
  ITEM100: 16,
  UNIT: 17,
  COIN: 18,
});

// Item bricks drop a capsule; catching it with the paddle multiplies the ball count.
export const ITEM_MULT = Object.freeze({
  [CELL.ITEM5]: 5,
  [CELL.ITEM10]: 10,
  [CELL.ITEM20]: 20,
  [CELL.ITEM30]: 30,
  [CELL.ITEM50]: 50,
  [CELL.ITEM100]: 100,
});
// How much each caught fruit multiplies the swarm, keyed by its ITEM_MULT id:
// cherry x2, strawberry x3, orange x5, apple x7, watermelon x9, pineapple x10.
export const FRUIT_GAINS = Object.freeze({ 5: 2, 10: 3, 20: 5, 30: 7, 50: 9, 100: 10 });
export const COIN_VALUE = 1; // gold per coin caught (a coin brick drops one coin)
export const DROP_SPEED = 16; // cells per second an item capsule falls
export const DROP_CATCH = 1.2; // extra reach beyond the paddle edge when catching
// Caught multipliers queue their balls; each second about RELEASE_DRAIN of
// the queue (at least RELEASE_RATE balls) pours out, so every catch visibly
// multiplies the swarm within a few seconds.
export const RELEASE_RATE = 20; // minimum balls per second while any are queued
export const RELEASE_DRAIN = 0.6; // fraction of the queue released per second

export const SPLIT_COUNT = Object.freeze({
  [CELL.SPLIT2]: 2,
  [CELL.SPLIT3]: 3,
  [CELL.SPLIT5]: 5,
});

// Enemy units hide inside the wall and drop bombs on the paddle. Ten tiers,
// each one tougher, faster, more accurate and more punishing than the last.
// aim: 0 = straight down, 1 = leads the paddle. lethal: a hit also costs a life.
export const UNIT_TIERS = Object.freeze([
  { name: '정찰병', hp: 1, interval: 7.0, speed: 10.2, shots: 1, aim: 0, stun: 0.35, lethal: false },
  { name: '보병', hp: 1, interval: 6.3, speed: 11.9, shots: 1, aim: 0.1, stun: 0.4, lethal: false },
  { name: '척탄병', hp: 2, interval: 5.7, speed: 13.6, shots: 1, aim: 0.2, stun: 0.45, lethal: false },
  { name: '포병', hp: 2, interval: 5.1, speed: 15.3, shots: 1, aim: 0.3, stun: 0.5, lethal: false },
  { name: '저격수', hp: 3, interval: 4.6, speed: 17, shots: 2, aim: 0.45, stun: 0.6, lethal: false },
  { name: '폭격수', hp: 3, interval: 4.1, speed: 18.7, shots: 2, aim: 0.5, stun: 0.7, lethal: false },
  { name: '중장갑', hp: 4, interval: 3.7, speed: 20.4, shots: 2, aim: 0.6, stun: 0.8, lethal: false },
  { name: '엘리트', hp: 4, interval: 3.3, speed: 22.1, shots: 3, aim: 0.7, stun: 0.95, lethal: false },
  { name: '지휘관', hp: 5, interval: 2.9, speed: 23.8, shots: 3, aim: 0.8, stun: 1.1, lethal: false },
  { name: '파괴신', hp: 6, interval: 2.6, speed: 25.5, shots: 4, aim: 0.9, stun: 1.3, lethal: true },
]);
export const UNIT_CHARS = Object.freeze(['J', 'K', 'L', 'N', 'O', 'P', 'Q', 'R', 'T', 'U']);
export const UNIT_GRACE = 2.5; // seconds after serving before units open fire
export const STUN_SHRINK = 0.75; // paddle width factor while stunned
export const MAX_SHELLS = 80;
