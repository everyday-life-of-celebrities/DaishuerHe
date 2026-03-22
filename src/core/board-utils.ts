import type { Board, MoveDirection, Position } from "./types";

export function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function getLinePositions(
  rowCount: number,
  colCount: number,
  dir: MoveDirection,
  line: number
): Position[] {
  const positions: Position[] = [];

  if (dir === "Left") {
    for (let col = 0; col < colCount; col += 1) {
      positions.push([line, col]);
    }
    return positions;
  }

  if (dir === "Right") {
    for (let col = colCount - 1; col >= 0; col -= 1) {
      positions.push([line, col]);
    }
    return positions;
  }

  if (dir === "Up") {
    for (let row = 0; row < rowCount; row += 1) {
      positions.push([row, line]);
    }
    return positions;
  }

  for (let row = rowCount - 1; row >= 0; row -= 1) {
    positions.push([row, line]);
  }

  return positions;
}

export function assertRectangularBoard(board: Board): { rowCount: number; colCount: number } {
  const rowCount = board.length;
  if (rowCount <= 0) {
    throw new Error("Board must have at least one row");
  }

  const colCount = board[0]?.length ?? 0;
  if (colCount <= 0) {
    throw new Error("Board must have at least one column");
  }

  for (const row of board) {
    if (row.length !== colCount) {
      throw new Error("Board rows must have equal length");
    }
  }

  return { rowCount, colCount };
}

export function isInsideBoard(board: Board, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= board.length) {
    return false;
  }

  const colCount = board[0]?.length ?? 0;
  return col < colCount;
}