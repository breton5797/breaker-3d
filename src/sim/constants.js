// Field is COLS x ROWS cells of size 1. y grows upward; row 0 is the bottom.
export const COLS = 48;
export const ROWS = 64;

export const BALL_R = 0.28;
export const BALL_SPEED = 30;
export const MAX_BALLS = 3000;
export const MAX_SUBSTEP = 0.4; // max distance a ball travels per substep (cells)

export const PADDLE_Y = 3;
export const PADDLE_H = 0.7;
export const PADDLE_W = 7;
export const PADDLE_MAX_ANGLE = (62 * Math.PI) / 180;

export const START_LIVES = 3;
export const FIRE_TIME = 2.2; // seconds a ball stays on fire (fire cell)
export const METEOR_FIRE = 0.9; // shorter burn for meteor balls
export const BOMB_RADIUS = 3.2;
export const BOMB_DELAY = 0.07; // chain reaction delay per hop
export const COMBO_WINDOW = 0.6; // seconds without a break before combo resets
export const METEOR_COUNT = 12;
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
});

export const SPLIT_COUNT = Object.freeze({
  [CELL.SPLIT2]: 2,
  [CELL.SPLIT3]: 3,
  [CELL.SPLIT5]: 5,
});
