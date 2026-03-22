import {
  canMergeTiles,
  getLinePositions,
  samePosition,
  type Board,
  type MoveDirection,
  type Position,
  type SequenceConfig
} from "../core";

function hasSlideSpace(board: Board, dir: MoveDirection): boolean {
  const rowCount = board.length;
  if (rowCount === 0) {
    return false;
  }

  const colCount = board[0]?.length ?? 0;
  if (colCount === 0) {
    return false;
  }

  const lineCount = dir === "Left" || dir === "Right" ? rowCount : colCount;

  for (let line = 0; line < lineCount; line += 1) {
    const positions = getLinePositions(rowCount, colCount, dir, line);
    const occupied: Position[] = [];

    for (const pos of positions) {
      if (board[pos[0]][pos[1]] !== null) {
        occupied.push(pos);
      }
    }

    for (let i = 0; i < occupied.length; i += 1) {
      if (!samePosition(occupied[i], positions[i])) {
        return true;
      }
    }
  }

  return false;
}

function hasMergeOpportunity(
  board: Board,
  dir: MoveDirection,
  configMap: Map<string, SequenceConfig>
): boolean {
  const rowCount = board.length;
  if (rowCount === 0) {
    return false;
  }

  const colCount = board[0]?.length ?? 0;
  if (colCount === 0) {
    return false;
  }

  if (dir === "Left" || dir === "Right") {
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < colCount - 1; col += 1) {
        const first = board[row][col];
        const second = board[row][col + 1];

        if (!first || !second) {
          continue;
        }

        if (canMergeTiles(first, second, dir, configMap)) {
          return true;
        }
      }
    }

    return false;
  }

  for (let col = 0; col < colCount; col += 1) {
    for (let row = 0; row < rowCount - 1; row += 1) {
      const first = board[row][col];
      const second = board[row + 1][col];

      if (!first || !second) {
        continue;
      }

      if (canMergeTiles(first, second, dir, configMap)) {
        return true;
      }
    }
  }

  return false;
}

export function hasAvailableMove(
  board: Board,
  directions: MoveDirection[],
  configMap: Map<string, SequenceConfig>
): boolean {
  for (const dir of directions) {
    if (hasSlideSpace(board, dir) || hasMergeOpportunity(board, dir, configMap)) {
      return true;
    }
  }

  return false;
}