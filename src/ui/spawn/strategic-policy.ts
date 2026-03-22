import { createAtomicTile, type AtomDefinition, type SequenceConfig, type SpawnRequest, type SpawnResult } from "../../core";
import type { StrategicRatio } from "../constants";
import { randomFrom, randomSpawn } from "./random-policy";
import { scoreSpawnCandidate } from "./scoring";

type SpawnCandidate = {
  position: [number, number];
  atom: AtomDefinition;
};

function getEmptyPositions(board: SpawnRequest["board"]): Array<[number, number]> {
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

export function createStrategicSpawnPolicy(
  atomPool: AtomDefinition[],
  configMap: Map<string, SequenceConfig>,
  strategicRatio: StrategicRatio
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
    const shouldUseStrategic = totalCells > 0 && occupiedCells * strategicRatio.q >= totalCells * strategicRatio.p;

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
