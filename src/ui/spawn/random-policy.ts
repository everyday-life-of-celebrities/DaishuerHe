import { createAtomicTile, type AtomDefinition, type SpawnResult } from "../../core";

function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

export function randomFrom<T>(items: T[]): T {
  return items[randInt(items.length)];
}

export function randomSpawn(empties: Array<[number, number]>, atomPool: AtomDefinition[]): SpawnResult {
  const randomPosition = randomFrom(empties);
  const randomAtom = randomFrom(atomPool);

  return {
    position: randomPosition,
    tile: createAtomicTile(randomAtom.sequenceId, randomAtom.atomIndex, randomAtom.atomSymbol)
  };
}