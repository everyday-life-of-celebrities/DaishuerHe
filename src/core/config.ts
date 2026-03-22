import type { MoveDirection, NormalizedSequenceConfig, RelationType, SequenceConfig } from "./types";

export function normalizeRelations(relations?: RelationType[]): RelationType[] {
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

export function normalizeConfig(config: SequenceConfig): NormalizedSequenceConfig {
  return {
    ...config,
    relations: normalizeRelations(config.relations),
    allowReverseMerge: config.allowReverseMerge === true
  };
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

    map.set(config.id, normalizeConfig(config));
  }

  return map;
}

export function getAxisByDirection(dir: MoveDirection): RelationType {
  return dir === "Left" || dir === "Right" ? "H" : "V";
}