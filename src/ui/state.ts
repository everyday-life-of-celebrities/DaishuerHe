import { createEmptyBoard, type Board, type SequenceConfig } from "../core";
import { BOARD_COLS, BOARD_ROWS, STATUS_TEXT } from "./constants";

export type GameState = {
  board: Board;
  score: number;
  moves: number;
  status: string;
  eventLines: string[];
  completedCounts: Record<string, number>;
  gameOver: boolean;
};

export function createInitialCompletedCounts(configs: SequenceConfig[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const config of configs) {
    counts[config.id] = 0;
  }
  return counts;
}

export function createInitialState(configs: SequenceConfig[]): GameState {
  return {
    board: createEmptyBoard(BOARD_ROWS, BOARD_COLS),
    score: 0,
    moves: 0,
    status: STATUS_TEXT.ready,
    eventLines: [],
    completedCounts: createInitialCompletedCounts(configs),
    gameOver: false
  };
}