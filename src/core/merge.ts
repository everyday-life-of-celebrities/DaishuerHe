import { getAxisByDirection, normalizeConfig } from "./config";
import { createRangeTile } from "./tiles";
import type {
  MoveDirection,
  NormalizedSequenceConfig,
  RewardEvent,
  SequenceConfig,
  Tile
} from "./types";

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

export type MergeTilesResult = {
  removeFirst: boolean;
  removeSecond: boolean;
  resultTile?: Tile;
  rewardEvent?: RewardEvent;
  completedSequenceId?: string;
};

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