import type { Board } from "./types";

export function createEmptyBoard(rows: number, cols = rows): Board {
  if (rows <= 0 || cols <= 0) {
    throw new Error("Board dimensions must be positive");
  }

  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}