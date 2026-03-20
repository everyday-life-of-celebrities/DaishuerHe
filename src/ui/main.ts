import {
  buildAtomIndex,
  buildConfigMap,
  canMergeTiles,
  createAtomicTile,
  createEmptyBoard,
  listAtomDefinitions,
  RelationType,
  RewardConfig,
  step,
  type Board,
  type MoveDirection,
  type MoveEvent,
  type SequenceConfig,
  type SpawnRequest,
  type SpawnResult,
  type Tile
} from "../core";

const BOARD_COLS = 4;
const BOARD_ROWS = 4;
const DIRECTIONS: MoveDirection[] = ["Left", "Right", "Up", "Down"];

const seq = (
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

const configs: SequenceConfig[] = [
  // {
  //   id: "講到很多和我有關而又完全錯誤的事情",
  //   atoms: "講到很多和我有關而又完全錯誤的事情".split(""),
  //   reward: { score: 100 },
  //   relations: ["H", "V"],
  //   allowReverseMerge: true
  // },
  // {
  //   id: "姚姚领先",
  //   atoms: "姚姚领先".split(""),
  //   reward: { score: 100 },
  //   relations: ["H", "V"],
  //   allowReverseMerge: true
  // },
  seq({ id: "代数儿何" }),
  seq({ id: "這種成績，使人汗顏！如此成績，如何招生？" }),


  // {
  //   id: "求真子弟，必须尋天人樂處，拓万古心胸。",
  //   atoms: ["求真子弟", "必须尋天人樂處", "拓万古心胸"],
  //   reward: { score: 100 },
  //   relations: ["H", "V"],
  //   allowReverseMerge: true
  // },
  // {
  //   id: "今日中国，强敵环伺，科技卡膀，海疆未靖，幼苗未长，此誠危急存亡之秋也。",
  //   atoms: ["今日中国", "强敵环伺", "科技卡膀", "海疆未靖", "幼苗未长", "此誠危急存亡之秋也"],
  //   reward: { score: 100 },
  //   relations: ["H", "V"],
  //   allowReverseMerge: true
  // },
];

const boardElement = document.querySelector<HTMLDivElement>("#board") as HTMLDivElement;
const scoreElement = document.querySelector<HTMLElement>("#score") as HTMLElement;
const movesElement = document.querySelector<HTMLElement>("#moves") as HTMLElement;
const statusElement = document.querySelector<HTMLElement>("#status") as HTMLElement;
const eventsElement = document.querySelector<HTMLElement>("#events") as HTMLElement;
const completedCountsElement = document.querySelector<HTMLUListElement>("#completed-counts") as HTMLUListElement;
const restartButton = document.querySelector<HTMLButtonElement>("#restart") as HTMLButtonElement;

if (
  !boardElement ||
  !scoreElement ||
  !movesElement ||
  !statusElement ||
  !eventsElement ||
  !completedCountsElement ||
  !restartButton
) {
  throw new Error("UI mount failed: missing required elements");
}

type GameState = {
  board: Board;
  score: number;
  moves: number;
  status: string;
  eventLines: string[];
  completedCounts: Record<string, number>;
};

const atomIndex = buildAtomIndex(configs);
const atomPool = listAtomDefinitions(configs);
const configMap = buildConfigMap(configs);

function createInitialCompletedCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const config of configs) {
    counts[config.id] = 0;
  }
  return counts;
}

const state: GameState = {
  board: createEmptyBoard(BOARD_ROWS, BOARD_COLS),
  score: 0,
  moves: 0,
  status: "Use arrow keys or buttons to move.",
  eventLines: [],
  completedCounts: createInitialCompletedCounts()
};

function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function randomFrom<T>(items: T[]): T {
  return items[randInt(items.length)];
}

function getTileAt(board: Board, row: number, col: number): Tile | null {
  if (row < 0 || row >= board.length || col < 0) {
    return null;
  }

  if (col >= board[row].length) {
    return null;
  }

  return board[row][col];
}

function scoreSpawnCandidate(board: Board, row: number, col: number, atom: (typeof atomPool)[number]): number {
  const previewTile: Tile = {
    id: -1,
    sequenceId: atom.sequenceId,
    start: atom.atomIndex,
    end: atom.atomIndex,
    symbol: atom.atomSymbol
  };

  const left = getTileAt(board, row, col - 1);
  const right = getTileAt(board, row, col + 1);
  const up = getTileAt(board, row - 1, col);
  const down = getTileAt(board, row + 1, col);

  let score = 0;

  if (left && canMergeTiles(left, previewTile, "Left", configMap)) {
    score += 14;
  }

  if (right && canMergeTiles(previewTile, right, "Left", configMap)) {
    score += 14;
  }

  if (up && canMergeTiles(up, previewTile, "Up", configMap)) {
    score += 14;
  }

  if (down && canMergeTiles(previewTile, down, "Up", configMap)) {
    score += 14;
  }

  const neighbors = [left, right, up, down];
  for (const neighbor of neighbors) {
    if (!neighbor) {
      score += 0.25;
      continue;
    }

    if (neighbor.sequenceId === previewTile.sequenceId) {
      score += 2;
      score += Math.min(3, (neighbor.end - neighbor.start + 1) * 0.6);
    }
  }

  if (atom.atomIndex === 0) {
    score += 0.75;
  }

  return score;
}

function strategicSpawnPolicy(req: SpawnRequest): SpawnResult {
  const empties: Array<[number, number]> = [];
  for (let row = 0; row < req.board.length; row += 1) {
    for (let col = 0; col < req.board[row].length; col += 1) {
      if (req.board[row][col] === null) {
        empties.push([row, col]);
      }
    }
  }

  if (!empties.length || !atomPool.length) {
    return null;
  }

  const rowCount = req.board.length;
  const colCount = req.board[0]?.length ?? 0;
  const totalCells = rowCount * colCount;
  const occupiedCells = totalCells - empties.length;
  const shouldUseStrategic = totalCells > 0 && occupiedCells * 4 >= totalCells * 3;

  if (!shouldUseStrategic) {
    const randomPosition = randomFrom(empties);
    const randomAtom = randomFrom(atomPool);
    return {
      position: randomPosition,
      tile: createAtomicTile(randomAtom.sequenceId, randomAtom.atomIndex, randomAtom.atomSymbol)
    };
  }

  let bestScore = Number.NEGATIVE_INFINITY;
  const bestCandidates: Array<{ position: [number, number]; atom: (typeof atomPool)[number] }> = [];

  for (const position of empties) {
    const [row, col] = position;
    for (const atom of atomPool) {
      const score = scoreSpawnCandidate(req.board, row, col, atom);

      if (score > bestScore) {
        bestScore = score;
        bestCandidates.length = 0;
        bestCandidates.push({ position, atom });
        continue;
      }

      if (score === bestScore) {
        bestCandidates.push({ position, atom });
      }
    }
  }

  if (bestScore <= 0 || !bestCandidates.length) {
    const fallbackPosition = randomFrom(empties);
    const fallbackAtom = randomFrom(atomPool);
    return {
      position: fallbackPosition,
      tile: createAtomicTile(fallbackAtom.sequenceId, fallbackAtom.atomIndex, fallbackAtom.atomSymbol)
    };
  }

  const selected = randomFrom(bestCandidates);

  return {
    position: selected.position,
    tile: createAtomicTile(selected.atom.sequenceId, selected.atom.atomIndex, selected.atom.atomSymbol)
  };
}

function placeSpawn(board: Board, spawn: Exclude<SpawnResult, null>): Board {
  const next = board.map((row) => row.slice());
  const [row, col] = spawn.position;
  next[row][col] = spawn.tile;
  return next;
}

function seedBoard(): void {
  state.board = createEmptyBoard(BOARD_ROWS, BOARD_COLS);
  state.score = 0;
  state.moves = 0;
  state.eventLines = [];
  state.status = "Use arrow keys or buttons to move.";
  state.completedCounts = createInitialCompletedCounts();

  for (let i = 0; i < 2; i += 1) {
    const spawn = strategicSpawnPolicy({ board: state.board, configs });
    if (!spawn) {
      break;
    }
    state.board = placeSpawn(state.board, spawn);
  }
}

function tileClass(tile: Tile): string {
  const length = tile.end - tile.start + 1;
  const level = Math.min(6, Math.max(1, length));
  return `tile tile-l${level}`;
}

function getBoardColumnCount(board: Board): number {
  return board[0]?.length ?? 0;
}

function computeTileFontSize(tile: Tile): number {
  const glyphCount = Math.max(1, Array.from(tile.symbol).length);

  if (glyphCount <= 6) {
    return 24;
  }

  if (glyphCount <= 12) {
    return 23;
  }

  if (glyphCount <= 18) {
    return 22;
  }

  if (glyphCount <= 25) {
    return 21;
  }

  const overflow = glyphCount - 25;
  const size = 21 - Math.ceil(overflow / 8);
  return Math.max(12, size);
}

function formatEvent(event: MoveEvent): string {
  switch (event.type) {
    case "slide":
      return `slide #${event.tileId} ${event.from.join(",")} -> ${event.to.join(",")}`;
    case "merge":
      if (event.completedSequenceId) {
        return `merge [${event.consumedTileIds.join("+")}] completed ${event.completedSequenceId}`;
      }
      return `merge [${event.consumedTileIds.join("+")}] => ${event.resultTile?.symbol ?? "?"}`;
    case "reward":
      return `reward ${event.sequenceId} +${event.reward?.score ?? 0}`;
    case "spawn":
      return `spawn ${event.tile.symbol} @ ${event.at.join(",")}`;
    default:
      return "event";
  }
}

function renderBoard(board: Board): void {
  const fragment = document.createDocumentFragment();
  const columnCount = getBoardColumnCount(board);
  boardElement.style.setProperty("--board-cols", String(Math.max(1, columnCount)));

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";

      const tile = board[row][col];
      if (tile) {
        const tileElement = document.createElement("div");
        tileElement.className = tileClass(tile);
        tileElement.style.setProperty("--tile-font-size", `${computeTileFontSize(tile)}px`);
        tileElement.textContent = tile.symbol;
        cell.appendChild(tileElement);
      }

      fragment.appendChild(cell);
    }
  }

  boardElement.replaceChildren(fragment);
}

function renderCompletedCounts(): void {
  const fragment = document.createDocumentFragment();

  for (const config of configs) {
    const item = document.createElement("li");
    item.className = "completed-item";

    const label = document.createElement("span");
    label.textContent = config.id;

    const value = document.createElement("strong");
    value.textContent = String(state.completedCounts[config.id] ?? 0);

    item.append(label, value);
    fragment.appendChild(item);
  }

  completedCountsElement?.replaceChildren(fragment);
}

function render(): void {
  scoreElement.textContent = String(state.score);
  movesElement.textContent = String(state.moves);
  statusElement.textContent = state.status;
  eventsElement.textContent = state.eventLines.join("\n");
  renderCompletedCounts();
  renderBoard(state.board);
}

function applyCompletionCounts(events: MoveEvent[]): void {
  for (const event of events) {
    if (event.type !== "merge" || !event.completedSequenceId) {
      continue;
    }

    const sequenceId = event.completedSequenceId;
    state.completedCounts[sequenceId] = (state.completedCounts[sequenceId] ?? 0) + 1;
  }
}

function executeMove(direction: MoveDirection): void {
  const result = step(state.board, direction, configs, strategicSpawnPolicy);

  if (!result.changed) {
    state.status = "No tiles moved.";
    render();
    return;
  }

  state.board = result.board;
  state.moves += 1;

  const scoreDelta = result.rewards.reduce((acc, item) => acc + (item.reward?.score ?? 0), 0);
  state.score += scoreDelta;
  applyCompletionCounts(result.events);

  state.status = scoreDelta > 0 ? `Gained ${scoreDelta} score this move.` : "Move applied.";
  state.eventLines = result.events.slice(-8).map(formatEvent);
  render();
}

function parseDirection(value: string | null): MoveDirection | null {
  if (!value) {
    return null;
  }

  return DIRECTIONS.includes(value as MoveDirection) ? (value as MoveDirection) : null;
}

document.addEventListener("keydown", (event) => {
  const keyMap: Record<string, MoveDirection> = {
    ArrowLeft: "Left",
    ArrowRight: "Right",
    ArrowUp: "Up",
    ArrowDown: "Down"
  };

  const dir = keyMap[event.key];
  if (!dir) {
    return;
  }

  event.preventDefault();
  executeMove(dir);
});

document.querySelectorAll<HTMLButtonElement>("button[data-dir]").forEach((button) => {
  button.addEventListener("click", () => {
    const dir = parseDirection(button.dataset.dir ?? null);
    if (dir) {
      executeMove(dir);
    }
  });
});

restartButton.addEventListener("click", () => {
  seedBoard();
  render();
});

seedBoard();
render();

console.log("Atom index:", atomIndex);
console.log("Atom pool size:", atomPool.length);