import { canMergeTiles, type AtomDefinition, type Board, type SequenceConfig, type Tile } from "../../core";

function getTileAt(board: Board, row: number, col: number): Tile | null {
  if (row < 0 || row >= board.length || col < 0) {
    return null;
  }

  if (col >= board[row].length) {
    return null;
  }

  return board[row][col];
}

export function scoreSpawnCandidate(
  board: Board,
  row: number,
  col: number,
  atom: AtomDefinition,
  configMap: Map<string, SequenceConfig>
): number {
  const previewTile: Tile = {
    id: -1,
    sequenceId: atom.sequenceId,
    start: atom.atomIndex,
    end: atom.atomIndex,
    symbol: atom.atomSymbol
  };

  const left = getTileAt(board, row, col - 1);
  const right = getTileAt(board, row, col + 1);
  const up = getTileAt(board, row - 1, col);
  const down = getTileAt(board, row + 1, col);

  let score = 0;

  if (left && canMergeTiles(left, previewTile, "Left", configMap)) {
    score += 14;
  }

  if (right && canMergeTiles(previewTile, right, "Left", configMap)) {
    score += 14;
  }

  if (up && canMergeTiles(up, previewTile, "Up", configMap)) {
    score += 14;
  }

  if (down && canMergeTiles(previewTile, down, "Up", configMap)) {
    score += 14;
  }

  const neighbors = [left, right, up, down];
  for (const neighbor of neighbors) {
    if (!neighbor) {
      score += 0.25;
      continue;
    }

    if (neighbor.sequenceId === previewTile.sequenceId) {
      score += 2;
      score += Math.min(3, (neighbor.end - neighbor.start + 1) * 0.6);
    }
  }

  if (atom.atomIndex === 0) {
    score += 0.75;
  }

  return score;
}