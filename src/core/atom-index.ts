import type { AtomDefinition, SequenceConfig } from "./types";

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