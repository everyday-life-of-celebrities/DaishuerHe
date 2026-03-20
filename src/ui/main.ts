import {
  buildAtomIndex,
  createAtomicTile,
  createEmptyBoard,
  listAtomDefinitions,
  step,
  type Board,
  type MoveDirection,
  type MoveEvent,
  type SequenceConfig,
  type SpawnRequest,
  type SpawnResult,
  type Tile
} from "../core";

const BOARD_SIZE = 4;
const DIRECTIONS: MoveDirection[] = ["Left", "Right", "Up", "Down"];

const configs: SequenceConfig[] = [
  // {
  //   id: "季理真",
  //   atoms: ["季理真", "花了五年", "寫一本書", "剛剛出版", "講到很多和我有關而又完全錯誤的事情"],
  //   reward: { score: 100 },
  //   relations: ["H", "V"],
  //   allowReverseMerge: true
  // },
  {
    id: "姚姚领先",
    atoms: "姚姚领先".split(""),
    reward: { score: 100 },
    relations: ["H", "V"],
    allowReverseMerge: true
  },
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

function createInitialCompletedCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const config of configs) {
    counts[config.id] = 0;
  }
  return counts;
}

const state: GameState = {
  board: createEmptyBoard(BOARD_SIZE),
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

function randomSpawnPolicy(req: SpawnRequest): SpawnResult {
  const empties: Array<[number, number]> = [];
  for (let row = 0; row < req.board.length; row += 1) {
    for (let col = 0; col < req.board.length; col += 1) {
      if (req.board[row][col] === null) {
        empties.push([row, col]);
      }
    }
  }

  if (!empties.length || !atomPool.length) {
    return null;
  }

  const position = randomFrom(empties);
  const atom = randomFrom(atomPool);

  return {
    position,
    tile: createAtomicTile(atom.sequenceId, atom.atomIndex, atom.atomSymbol)
  };
}

function placeSpawn(board: Board, spawn: Exclude<SpawnResult, null>): Board {
  const next = board.map((row) => row.slice());
  const [row, col] = spawn.position;
  next[row][col] = spawn.tile;
  return next;
}

function seedBoard(): void {
  state.board = createEmptyBoard(BOARD_SIZE);
  state.score = 0;
  state.moves = 0;
  state.eventLines = [];
  state.status = "Use arrow keys or buttons to move.";
  state.completedCounts = createInitialCompletedCounts();

  for (let i = 0; i < 2; i += 1) {
    const spawn = randomSpawnPolicy({ board: state.board, configs });
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

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";

      const tile = board[row][col];
      if (tile) {
        const tileElement = document.createElement("div");
        tileElement.className = tileClass(tile);
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
  const result = step(state.board, direction, configs, randomSpawnPolicy);

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