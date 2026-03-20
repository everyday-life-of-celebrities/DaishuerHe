export type RelationType = "H" | "V";

export type RewardConfig = {
  score?: number;
  clearAround?: boolean;
  extraMove?: number;
  spawnAtoms?: string[];
};

export type SequenceConfig = {
  id: string;
  atoms: string[];
  reward?: RewardConfig;
  relations?: RelationType[];
  allowReverseMerge?: boolean;
};

export type NormalizedSequenceConfig = Omit<SequenceConfig, "relations" | "allowReverseMerge"> & {
  relations: RelationType[];
  allowReverseMerge: boolean;
};

export type Tile = {
  id: number;
  sequenceId: string;
  start: number;
  end: number;
  symbol: string;
};

export type Cell = Tile | null;
export type Board = Cell[][];

export type Position = [number, number];

export type MoveDirection = "Left" | "Right" | "Up" | "Down";

export type RewardEvent = {
  sequenceId: string;
  reward?: RewardConfig;
};

export type MoveEvent =
  | { type: "slide"; tileId: number; from: Position; to: Position }
  | {
      type: "merge";
      consumedTileIds: [number, number];
      anchor: Position;
      resultTile?: Tile;
      completedSequenceId?: string;
    }
  | { type: "spawn"; tile: Tile; at: Position }
  | { type: "reward"; sequenceId: string; reward?: RewardConfig };

export type MoveResult = {
  board: Board;
  changed: boolean;
  events: MoveEvent[];
  rewards: RewardEvent[];
};

export type SpawnRequest = {
  board: Board;
  configs: SequenceConfig[];
};

export type SpawnResult =
  | {
      position: Position;
      tile: Tile;
    }
  | null;

export type Candidate = {
  firstPos: Position;
  secondPos: Position;
  firstTileId: number;
  secondTileId: number;
};

export type AtomDefinition = {
  sequenceId: string;
  atomIndex: number;
  atomSymbol: string;
};