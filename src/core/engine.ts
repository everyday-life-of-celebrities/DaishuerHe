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

type ResolvedMergeContext = {
  config: NormalizedSequenceConfig;
  orderedFirst: Tile;
  orderedSecond: Tile;
  start: number;
  end: number;
  completed: boolean;
};

type MergeTilesResult = {
  removeFirst: boolean;
  removeSecond: boolean;
  resultTile?: Tile;
  rewardEvent?: RewardEvent;
  completedSequenceId?: string;
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
function normalizeConfig(config: SequenceConfig): NormalizedSequenceConfig {
  return {
    ...config,
    relations: normalizeRelations(config.relations),
    allowReverseMerge: config.allowReverseMerge === true
  };
}

function findMatchingIntervalsBySymbol(tileSymbol: string, config: NormalizedSequenceConfig): SequenceInterval[] {
  if (tileSymbol.length === 0) {
    return [];
  }

  const intervals: SequenceInterval[] = [];

  for (let start = 0; start < config.atoms.length; start += 1) {
    let combined = "";

    for (let end = start; end < config.atoms.length; end += 1) {
      combined += config.atoms[end] ?? "";

      if (!tileSymbol.startsWith(combined)) {
        break;
      }

      if (combined === tileSymbol) {
        intervals.push({ start, end });
        break;
      }
    }
  }

  return intervals;
}

function resolveMergeContext(
  first: Tile,
  second: Tile,
  configMap: Map<string, SequenceConfig>,
  dir?: MoveDirection
): ResolvedMergeContext | null {
  const axis = dir ? getAxisByDirection(dir) : null;

  for (const rawConfig of configMap.values()) {
    const config = normalizeConfig(rawConfig);
    if (axis && !config.relations.includes(axis)) {
      continue;
    }

    const firstMatches = findMatchingIntervalsBySymbol(first.symbol, config);
    if (!firstMatches.length) {
      continue;
    }

    const secondMatches = findMatchingIntervalsBySymbol(second.symbol, config);
    if (!secondMatches.length) {
      continue;
    }

    for (const firstInterval of firstMatches) {
      for (const secondInterval of secondMatches) {
        if (firstInterval.end + 1 === secondInterval.start) {
          const start = firstInterval.start;
          const end = secondInterval.end;
          return {
            config,
            orderedFirst: first,
            orderedSecond: second,
            start,
            end,
            completed: start === 0 && end === config.atoms.length - 1
          };
        }
      }
    }

    if (!config.allowReverseMerge) {
      continue;
    }

    for (const firstInterval of firstMatches) {
      for (const secondInterval of secondMatches) {
        if (secondInterval.end + 1 === firstInterval.start) {
          const start = secondInterval.start;
          const end = firstInterval.end;
          return {
            config,
            orderedFirst: second,
            orderedSecond: first,
            start,
            end,
            completed: start === 0 && end === config.atoms.length - 1
          };
        }
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
function getSequenceLength(sequenceId: string, configMap: Map<string, SequenceConfig>): number | null {
  const config = configMap.get(sequenceId);
  if (!config) {
    return null;
  }

  return config.atoms.length;
}

function isFinalTile(tile: Tile, configMap: Map<string, SequenceConfig>): boolean {
  const sequenceLength = getSequenceLength(tile.sequenceId, configMap);
  if (sequenceLength === null) {
    return false;
  }

  return tile.start === 0 && tile.end === sequenceLength - 1;
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
  const firstIsFinal = isFinalTile(first, configMap);
  const secondIsFinal = isFinalTile(second, configMap);
  if (firstIsFinal && secondIsFinal) {
    return true;
  }

  return resolveMergeContext(first, second, configMap, dir) !== null;
}
export function mergeTiles(
  first: Tile,
  second: Tile,
  configMap: Map<string, SequenceConfig>,
  dir?: MoveDirection
): MergeTilesResult {
  const firstIsFinal = isFinalTile(first, configMap);
  const secondIsFinal = isFinalTile(second, configMap);
  if (firstIsFinal && secondIsFinal) {
    return {
      removeFirst: true,
      removeSecond: true
    };
  }

  const mergeContext = resolveMergeContext(first, second, configMap, dir);
  if (!mergeContext) {
    throw new Error("Cannot merge non-continuous intervals");
  }

  const { config, orderedFirst, orderedSecond, start, end, completed } = mergeContext;
  const resultTile = createRangeTile(config, start, end, `${orderedFirst.symbol}${orderedSecond.symbol}`);

  if (completed) {
    return {
      removeFirst: false,
      removeSecond: true,
      resultTile,
      completedSequenceId: config.id,
      rewardEvent: {
        sequenceId: config.id,
        reward: config.reward
      }
    };
  }

  return {
    removeFirst: false,
    removeSecond: true,
    resultTile
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