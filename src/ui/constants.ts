import type { MoveDirection } from "../core";

export const ElPsyCongroo = (xs: number[]) => xs.map((c) => String.fromCharCode(c)).join("");
export const BOARD_ROWS = 4;
export const BOARD_COLS = 4;

export const DIRECTIONS: MoveDirection[] = ["Left", "Right", "Up", "Down"];

export const STATUS_TEXT = {
  ready: "Use arrow keys or buttons to move.",
  noMove: "No tiles moved.",
  moveApplied: "Move applied.",
  gameOver: ElPsyCongroo([25105, 23459, 24067, 20320, 24050, 32147, 19981, 26159, 25105, 30340, 23416, 29983, 20102, 33])
} as const;

export const GAME_OVER_TEXT = STATUS_TEXT.gameOver;
export const RETRY_TEXT = ElPsyCongroo([30003, 35831, 20854, 20182, 23548, 24072]);

/**
 * shouldUseStrategic := n * q >= N * p
 */
export const StrategicRatio = { p: 7, q: 8 };

export const BEST_SCORE_STORAGE_KEY = "sequence-grid.best-score.v1";