import { cloneBoard, createEmptyBoard } from "./board";
import { assertRectangularBoard, getLinePositions, isInsideBoard, samePosition } from "./board-utils";
import { buildConfigMap, getAxisByDirection } from "./config";
import { canMergeTiles, mergeTiles } from "./merge";
import type {
  Board,
  Candidate,
  MoveDirection,
  MoveEvent,
  MoveResult,
  RewardEvent,
  SequenceConfig,
  SpawnRequest,
  SpawnResult,
  Tile
} from "./types";

export function slideBoard(
  board: Board,
  dir: MoveDirection
): {
  board: Board;
  events: MoveEvent[];
  changed: boolean;
} {
  const { rowCount, colCount } = assertRectangularBoard(board);

  const lineCount = dir === "Left" || dir === "Right" ? rowCount : colCount;
  const nextBoard = createEmptyBoard(rowCount, colCount);
  const events: MoveEvent[] = [];
  let changed = false;

  for (let line = 0; line < lineCount; line += 1) {
    const orderedPositions = getLinePositions(rowCount, colCount, dir, line);
    const packedTiles: Array<{ tile: Tile; from: [number, number] }> = [];

    for (const pos of orderedPositions) {
      const tile = board[pos[0]][pos[1]];
      if (tile) {
        packedTiles.push({ tile, from: pos });
      }
    }

    for (let i = 0; i < orderedPositions.length; i += 1) {
      const to = orderedPositions[i];
      const packed = packedTiles[i];

      if (!packed) {
        nextBoard[to[0]][to[1]] = null;
        continue;
      }

      nextBoard[to[0]][to[1]] = packed.tile;
      if (!samePosition(packed.from, to)) {
        changed = true;
        events.push({
          type: "slide",
          tileId: packed.tile.id,
          from: packed.from,
          to
        });
      }
    }
  }

  return { board: nextBoard, events, changed };
}

export function findMergeCandidates(
  board: Board,
  dir: MoveDirection,
  configMap: Map<string, SequenceConfig>
): Candidate[] {
  const { rowCount, colCount } = assertRectangularBoard(board);

  const axis = getAxisByDirection(dir);
  const candidates: Candidate[] = [];

  if (axis === "H") {
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < colCount - 1; col += 1) {
        const first = board[row][col];
        const second = board[row][col + 1];

        if (!first || !second) {
          continue;
        }

        if (canMergeTiles(first, second, dir, configMap)) {
          candidates.push({
            firstPos: [row, col],
            secondPos: [row, col + 1],
            firstTileId: first.id,
            secondTileId: second.id
          });
        }
      }
    }

    return candidates;
  }

  for (let col = 0; col < colCount; col += 1) {
    for (let row = 0; row < rowCount - 1; row += 1) {
      const first = board[row][col];
      const second = board[row + 1][col];

      if (!first || !second) {
        continue;
      }

      if (canMergeTiles(first, second, dir, configMap)) {
        candidates.push({
          firstPos: [row, col],
          secondPos: [row + 1, col],
          firstTileId: first.id,
          secondTileId: second.id
        });
      }
    }
  }

  return candidates;
}

export function resolveConflicts(candidates: Candidate[], _dir: MoveDirection): Candidate[] {
  const selected: Candidate[] = [];
  const occupied = new Set<number>();

  for (const candidate of candidates) {
    if (occupied.has(candidate.firstTileId) || occupied.has(candidate.secondTileId)) {
      continue;
    }

    occupied.add(candidate.firstTileId);
    occupied.add(candidate.secondTileId);
    selected.push(candidate);
  }

  return selected;
}

export function applyMerges(
  board: Board,
  selected: Candidate[],
  dir: MoveDirection,
  configMap: Map<string, SequenceConfig>
): {
  board: Board;
  events: MoveEvent[];
  rewards: RewardEvent[];
  changed: boolean;
} {
  const nextBoard = cloneBoard(board);
  const events: MoveEvent[] = [];
  const rewards: RewardEvent[] = [];
  let changed = false;

  for (const candidate of selected) {
    const [r1, c1] = candidate.firstPos;
    const [r2, c2] = candidate.secondPos;
    const first = nextBoard[r1][c1];
    const second = nextBoard[r2][c2];

    if (!first || !second) {
      continue;
    }

    if (first.id !== candidate.firstTileId || second.id !== candidate.secondTileId) {
      continue;
    }

    const merged = mergeTiles(first, second, configMap, dir);
    changed = true;

    if (merged.removeSecond) {
      nextBoard[r2][c2] = null;
    }

    if (merged.removeFirst) {
      nextBoard[r1][c1] = null;
    } else if (merged.resultTile) {
      nextBoard[r1][c1] = merged.resultTile;
    }

    events.push({
      type: "merge",
      consumedTileIds: [first.id, second.id],
      anchor: [r1, c1],
      ...(merged.resultTile ? { resultTile: merged.resultTile } : {}),
      ...(merged.completedSequenceId ? { completedSequenceId: merged.completedSequenceId } : {})
    });

    if (merged.rewardEvent) {
      rewards.push(merged.rewardEvent);
      events.push({
        type: "reward",
        sequenceId: merged.rewardEvent.sequenceId,
        reward: merged.rewardEvent.reward
      });
    }
  }

  return {
    board: nextBoard,
    events,
    rewards,
    changed
  };
}

export function step(
  board: Board,
  dir: MoveDirection,
  configs: SequenceConfig[],
  spawnPolicy?: (req: SpawnRequest) => SpawnResult
): MoveResult {
  const configMap = buildConfigMap(configs);

  const firstSlide = slideBoard(board, dir);
  const candidates = findMergeCandidates(firstSlide.board, dir, configMap);
  const selected = resolveConflicts(candidates, dir);
  const mergeResult = applyMerges(firstSlide.board, selected, dir, configMap);
  const secondSlide = slideBoard(mergeResult.board, dir);

  let nextBoard = secondSlide.board;
  const events: MoveEvent[] = [...firstSlide.events, ...mergeResult.events, ...secondSlide.events];
  const rewards: RewardEvent[] = [...mergeResult.rewards];
  let changed = firstSlide.changed || mergeResult.changed || secondSlide.changed;

  if (spawnPolicy && changed) {
    const spawned = spawnPolicy({
      board: cloneBoard(nextBoard),
      configs
    });

    if (spawned) {
      const [row, col] = spawned.position;
      if (!isInsideBoard(nextBoard, row, col)) {
        throw new Error(`Spawn position out of board: [${row}, ${col}]`);
      }

      if (nextBoard[row][col] !== null) {
        throw new Error(`Spawn position is occupied: [${row}, ${col}]`);
      }

      nextBoard = cloneBoard(nextBoard);
      nextBoard[row][col] = spawned.tile;
      events.push({ type: "spawn", tile: spawned.tile, at: [row, col] });
      changed = true;
    }
  }

  return {
    board: nextBoard,
    changed,
    events,
    rewards
  };
}