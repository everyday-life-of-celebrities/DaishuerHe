import {
  canMergeTiles,
  createAtomicTile,
  type AtomDefinition,
  type Board,
  type SequenceConfig,
  type SpawnRequest,
  type SpawnResult,
  type Tile
} from "../core";
import { StrategicRatio } from "./constants";

type SpawnCandidate = {
  position: [number, number];
  atom: AtomDefinition;
};

function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function randomFrom<T>(items: T[]): T {
  return items[randInt(items.length)];
}

function getTileAt(board: Board, row: number, col: number): Tile | null {
  if (row < 0 || row >= board.length || col < 0) {
    return null;
  }

  if (col >= board[row].length) {
    return null;
  }

  return board[row][col];
}

function getEmptyPositions(board: Board): Array<[number, number]> {
  const empties: Array<[number, number]> = [];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col] === null) {
        empties.push([row, col]);
      }
    }
  }

  return empties;
}

function scoreSpawnCandidate(
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

function randomSpawn(empties: Array<[number, number]>, atomPool: AtomDefinition[]): SpawnResult {
  const randomPosition = randomFrom(empties);
  const randomAtom = randomFrom(atomPool);

  return {
    position: randomPosition,
    tile: createAtomicTile(randomAtom.sequenceId, randomAtom.atomIndex, randomAtom.atomSymbol)
  };
}

export function createStrategicSpawnPolicy(
  atomPool: AtomDefinition[],
  configMap: Map<string, SequenceConfig>
): (req: SpawnRequest) => SpawnResult {
  return function strategicSpawnPolicy(req: SpawnRequest): SpawnResult {
    const empties = getEmptyPositions(req.board);
    if (!empties.length || !atomPool.length) {
      return null;
    }

    const rowCount = req.board.length;
    const colCount = req.board[0]?.length ?? 0;
    const totalCells = rowCount * colCount;
    const occupiedCells = totalCells - empties.length;
    const shouldUseStrategic = totalCells > 0 && occupiedCells * StrategicRatio.q >= totalCells * StrategicRatio.p;

    if (!shouldUseStrategic) {
      return randomSpawn(empties, atomPool);
    }

    let bestScore = Number.NEGATIVE_INFINITY;
    const bestCandidates: SpawnCandidate[] = [];

    for (const position of empties) {
      const [row, col] = position;
      for (const atom of atomPool) {
        const score = scoreSpawnCandidate(req.board, row, col, atom, configMap);

        if (score > bestScore) {
          bestScore = score;
          bestCandidates.length = 0;
          bestCandidates.push({ position, atom });
          continue;
        }

        if (score === bestScore) {
          bestCandidates.push({ position, atom });
        }
      }
    }

    if (bestScore <= 0 || !bestCandidates.length) {
      return randomSpawn(empties, atomPool);
    }

    const selected = randomFrom(bestCandidates);
    return {
      position: selected.position,
      tile: createAtomicTile(selected.atom.sequenceId, selected.atom.atomIndex, selected.atom.atomSymbol)
    };
  };
}