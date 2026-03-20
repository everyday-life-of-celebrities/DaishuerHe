import { RelationType, RewardConfig, SequenceConfig } from "../core/types";

export const seq = (
  {
    id,
    atoms = id.replace(/[，|。|？|！]/g, "").split(""),
    relations = ["H", "V"],
    allowReverseMerge = true,
    score = 100,
  }: {
    id: string;
    atoms?: string[];
    reward?: RewardConfig;
    relations?: RelationType[];
    allowReverseMerge?: boolean;
    score?: number;
  }
): SequenceConfig => ({
  id,
  atoms,
  reward: { score },
  relations,
  allowReverseMerge,
})

export const group = (
  {
    atoms,
    id = atoms.join(""),
    relations = ["H", "V"],
    allowReverseMerge = true,
    score = 100,
  }: {
    atoms: string[];
    id?: string;
    reward?: RewardConfig;
    relations?: RelationType[];
    allowReverseMerge?: boolean;
    score?: number;
  }
): SequenceConfig => ({
  id,
  atoms,
  reward: { score },
  relations,
  allowReverseMerge,
})