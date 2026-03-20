import type {
  AtomDefinition,
  Board,
  Candidate,
  MoveDirection,
  MoveEvent,
  MoveResult,
  NormalizedSequenceConfig,
  Position,
  RelationType,
  RewardEvent,
  SequenceConfig,
  SpawnRequest,
  SpawnResult,
  Tile
} from "./types";

let tileIdCounter = 1;

export function resetTileIdCounter(nextId = 1): void {
  tileIdCounter = nextId;
}

function nextTileId(): number {
  const id = tileIdCounter;
  tileIdCounter += 1;
  return id;
}

export function createEmptyBoard(rows: number, cols = rows): Board {
  if (rows <= 0 || cols <= 0) {
    throw new Error("Board dimensions must be positive");
  }

  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

function normalizeRelations(relations?: RelationType[]): RelationType[] {
  if (!relations || relations.length === 0) {
    return ["H", "V"];
  }

  const next: RelationType[] = [];
  for (const relation of relations) {
    if ((relation === "H" || relation === "V") && !next.includes(relation)) {
      next.push(relation);
    }
  }

  return next.length > 0 ? next : ["H", "V"];
}

export function buildConfigMap(configs: SequenceConfig[]): Map<string, NormalizedSequenceConfig> {
  const map = new Map<string, NormalizedSequenceConfig>();

  for (const config of configs) {
    if (map.has(config.id)) {
      throw new Error(`Duplicate sequence id: ${config.id}`);
    }

    if (!config.atoms.length) {
      throw new Error(`Sequence atoms cannot be empty: ${config.id}`);
    }

    map.set(config.id, {
      ...config,
      relations: normalizeRelations(config.relations),
      allowReverseMerge: config.allowReverseMerge === true
    });
  }

  return map;
}

function getAxisByDirection(dir: MoveDirection): RelationType {
  return dir === "Left" || dir === "Right" ? "H" : "V";
}

function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function getLinePositions(rowCount: number, colCount: number, dir: MoveDirection, line: number): Position[] {
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

function assertRectangularBoard(board: Board): { rowCount: number; colCount: number } {
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

type SequenceInterval = {
  start: number;
  end: number;
};

type MergePlan = {
  orderedFirst: Tile;
  orderedSecond: Tile;
  start: number;
  end: number;
};

export function createAtomicTile(sequenceId: string, atomIndex: number, atomSymbol: string): Tile {
  return {
    id: nextTileId(),
    sequenceId,
    start: atomIndex,
    end: atomIndex,
    symbol: atomSymbol
  };
}
function getTileAtomPattern(tile: Tile, config: SequenceConfig): string[] {
  const length = tile.end - tile.start + 1;
  if (length <= 0) {
    return [];
  }

  const pattern = config.atoms.slice(tile.start, tile.end + 1);
  if (pattern.length !== length) {
    return [];
  }

  return pattern;
}

function findMatchingIntervals(tile: Tile, config: SequenceConfig): SequenceInterval[] {
  const pattern = getTileAtomPattern(tile, config);
  if (!pattern.length) {
    return [];
  }

  const intervals: SequenceInterval[] = [];
  const maxStart = config.atoms.length - pattern.length;
  for (let start = 0; start <= maxStart; start += 1) {
    let matched = true;
    for (let offset = 0; offset < pattern.length; offset += 1) {
      if (config.atoms[start + offset] !== pattern[offset]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      intervals.push({
        start,
        end: start + pattern.length - 1
      });
    }
  }

  return intervals;
}

function buildMergePlan(
  first: Tile,
  second: Tile,
  config: SequenceConfig,
  allowReverseMerge: boolean
): MergePlan | null {
  const firstMatches = findMatchingIntervals(first, config);
  const secondMatches = findMatchingIntervals(second, config);

  for (const firstInterval of firstMatches) {
    for (const secondInterval of secondMatches) {
      if (firstInterval.end + 1 === secondInterval.start) {
        return {
          orderedFirst: first,
          orderedSecond: second,
          start: firstInterval.start,
          end: secondInterval.end
        };
      }
    }
  }

  if (!allowReverseMerge) {
    return null;
  }

  for (const firstInterval of firstMatches) {
    for (const secondInterval of secondMatches) {
      if (secondInterval.end + 1 === firstInterval.start) {
        return {
          orderedFirst: second,
          orderedSecond: first,
          start: secondInterval.start,
          end: firstInterval.end
        };
      }
    }
  }

  return null;
}

function createRangeTile(config: NormalizedSequenceConfig, start: number, end: number, symbol?: string): Tile {
  return {
    id: nextTileId(),
    sequenceId: config.id,
    start,
    end,
    symbol:
      symbol ??
      (start === end ? (config.atoms[start] ?? `${config.id}[${start}]`) : `${config.id}[${start},${end}]`)
  };
}

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
    const packedTiles: Array<{ tile: Tile; from: Position }> = [];

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

export function canMergeTiles(
  first: Tile,
  second: Tile,
  dir: MoveDirection,
  configMap: Map<string, SequenceConfig>
): boolean {
  if (first.sequenceId !== second.sequenceId) {
    return false;
  }

  const config = configMap.get(first.sequenceId);
  if (!config) {
    return false;
  }

  const relations = normalizeRelations(config.relations);
  if (!relations.includes(getAxisByDirection(dir))) {
    return false;
  }

  return buildMergePlan(first, second, config, config.allowReverseMerge === true) !== null;
}

export function mergeTiles(
  first: Tile,
  second: Tile,
  configMap: Map<string, SequenceConfig>
): {
  completed: boolean;
  resultTile?: Tile;
  rewardEvent?: RewardEvent;
} {
  if (first.sequenceId !== second.sequenceId) {
    throw new Error("Cannot merge tiles from different sequenceId");
  }

  const config = configMap.get(first.sequenceId);
  if (!config) {
    throw new Error(`Unknown sequence id: ${first.sequenceId}`);
  }

  const normalizedConfig: NormalizedSequenceConfig = {
    ...config,
    relations: normalizeRelations(config.relations),
    allowReverseMerge: config.allowReverseMerge === true
  };

  const mergePlan = buildMergePlan(first, second, normalizedConfig, normalizedConfig.allowReverseMerge);
  if (!mergePlan) {
    throw new Error("Cannot merge non-continuous intervals");
  }

  const { orderedFirst, orderedSecond, start, end } = mergePlan;
  const completed = start === 0 && end === normalizedConfig.atoms.length - 1;

  if (completed) {
    return {
      completed: true,
      rewardEvent: {
        sequenceId: normalizedConfig.id,
        reward: normalizedConfig.reward
      }
    };
  }

  return {
    completed: false,
    resultTile: createRangeTile(normalizedConfig, start, end, `${orderedFirst.symbol}${orderedSecond.symbol}`)
  };
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

    const merged = mergeTiles(first, second, configMap);
    changed = true;

    nextBoard[r2][c2] = null;

    if (merged.completed) {
      nextBoard[r1][c1] = null;
      events.push({
        type: "merge",
        consumedTileIds: [first.id, second.id],
        anchor: [r1, c1],
        completedSequenceId: first.sequenceId
      });

      if (merged.rewardEvent) {
        rewards.push(merged.rewardEvent);
        events.push({
          type: "reward",
          sequenceId: merged.rewardEvent.sequenceId,
          reward: merged.rewardEvent.reward
        });
      }
    } else if (merged.resultTile) {
      nextBoard[r1][c1] = merged.resultTile;
      events.push({
        type: "merge",
        consumedTileIds: [first.id, second.id],
        anchor: [r1, c1],
        resultTile: merged.resultTile
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

function isInsideBoard(board: Board, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= board.length) {
    return false;
  }

  const colCount = board[0]?.length ?? 0;
  return col < colCount;
}

export function buildAtomIndex(configs: SequenceConfig[]): Map<string, AtomDefinition[]> {
  const index = new Map<string, AtomDefinition[]>();

  for (const config of configs) {
    config.atoms.forEach((atomSymbol, atomIndex) => {
      const entry: AtomDefinition = {
        sequenceId: config.id,
        atomIndex,
        atomSymbol
      };

      const existing = index.get(atomSymbol);
      if (existing) {
        existing.push(entry);
      } else {
        index.set(atomSymbol, [entry]);
      }
    });
  }

  return index;
}

export function listAtomDefinitions(configs: SequenceConfig[]): AtomDefinition[] {
  const items: AtomDefinition[] = [];
  for (const defs of buildAtomIndex(configs).values()) {
    items.push(...defs);
  }
  return items;
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
  const mergeResult = applyMerges(firstSlide.board, selected, configMap);
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