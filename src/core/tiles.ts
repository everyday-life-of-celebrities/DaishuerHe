import type { NormalizedSequenceConfig, Tile } from "./types";

let tileIdCounter = 1;

export function resetTileIdCounter(nextId = 1): void {
  tileIdCounter = nextId;
}

function nextTileId(): number {
  const id = tileIdCounter;
  tileIdCounter += 1;
  return id;
}

export function createAtomicTile(sequenceId: string, atomIndex: number, atomSymbol: string): Tile {
  return {
    id: nextTileId(),
    sequenceId,
    start: atomIndex,
    end: atomIndex,
    symbol: atomSymbol
  };
}

export function createRangeTile(
  config: NormalizedSequenceConfig,
  start: number,
  end: number,
  symbol?: string
): Tile {
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