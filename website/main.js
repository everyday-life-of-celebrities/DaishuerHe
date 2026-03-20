// src/core/engine.ts
var tileIdCounter = 1;
function nextTileId() {
  const id = tileIdCounter;
  tileIdCounter += 1;
  return id;
}
function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}
function cloneBoard(board) {
  return board.map((row) => row.slice());
}
function normalizeRelations(relations) {
  if (!relations || relations.length === 0) {
    return ["H", "V"];
  }
  const next = [];
  for (const relation of relations) {
    if ((relation === "H" || relation === "V") && !next.includes(relation)) {
      next.push(relation);
    }
  }
  return next.length > 0 ? next : ["H", "V"];
}
function buildConfigMap(configs) {
  const map = new Map;
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
function getAxisByDirection(dir) {
  return dir === "Left" || dir === "Right" ? "H" : "V";
}
function samePosition(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}
function getLinePositions(size, dir, line) {
  const positions = [];
  if (dir === "Left") {
    for (let col = 0;col < size; col += 1) {
      positions.push([line, col]);
    }
    return positions;
  }
  if (dir === "Right") {
    for (let col = size - 1;col >= 0; col -= 1) {
      positions.push([line, col]);
    }
    return positions;
  }
  if (dir === "Up") {
    for (let row = 0;row < size; row += 1) {
      positions.push([row, line]);
    }
    return positions;
  }
  for (let row = size - 1;row >= 0; row -= 1) {
    positions.push([row, line]);
  }
  return positions;
}
function assertSquareBoard(board) {
  const size = board.length;
  for (const row of board) {
    if (row.length !== size) {
      throw new Error("Board must be N x N");
    }
  }
}
function createAtomicTile(sequenceId, atomIndex, atomSymbol) {
  return {
    id: nextTileId(),
    sequenceId,
    start: atomIndex,
    end: atomIndex,
    symbol: atomSymbol
  };
}
function getTileAtomPattern(tile, config) {
  const length = tile.end - tile.start + 1;
  if (length <= 0) {
    return [];
  }
  const pattern = config.atoms.slice(tile.start, tile.end + 1);
  if (pattern.length !== length) {
    return [];
  }
  return pattern;
}
function findMatchingIntervals(tile, config) {
  const pattern = getTileAtomPattern(tile, config);
  if (!pattern.length) {
    return [];
  }
  const intervals = [];
  const maxStart = config.atoms.length - pattern.length;
  for (let start = 0;start <= maxStart; start += 1) {
    let matched = true;
    for (let offset = 0;offset < pattern.length; offset += 1) {
      if (config.atoms[start + offset] !== pattern[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      intervals.push({
        start,
        end: start + pattern.length - 1
      });
    }
  }
  return intervals;
}
function buildMergePlan(first, second, config, allowReverseMerge) {
  const firstMatches = findMatchingIntervals(first, config);
  const secondMatches = findMatchingIntervals(second, config);
  for (const firstInterval of firstMatches) {
    for (const secondInterval of secondMatches) {
      if (firstInterval.end + 1 === secondInterval.start) {
        return {
          orderedFirst: first,
          orderedSecond: second,
          start: firstInterval.start,
          end: secondInterval.end
        };
      }
    }
  }
  if (!allowReverseMerge) {
    return null;
  }
  for (const firstInterval of firstMatches) {
    for (const secondInterval of secondMatches) {
      if (secondInterval.end + 1 === firstInterval.start) {
        return {
          orderedFirst: second,
          orderedSecond: first,
          start: secondInterval.start,
          end: firstInterval.end
        };
      }
    }
  }
  return null;
}
function createRangeTile(config, start, end, symbol) {
  return {
    id: nextTileId(),
    sequenceId: config.id,
    start,
    end,
    symbol: symbol ?? (start === end ? config.atoms[start] ?? `${config.id}[${start}]` : `${config.id}[${start},${end}]`)
  };
}
function slideBoard(board, dir) {
  assertSquareBoard(board);
  const size = board.length;
  const nextBoard = createEmptyBoard(size);
  const events = [];
  let changed = false;
  for (let line = 0;line < size; line += 1) {
    const orderedPositions = getLinePositions(size, dir, line);
    const packedTiles = [];
    for (const pos of orderedPositions) {
      const tile = board[pos[0]][pos[1]];
      if (tile) {
        packedTiles.push({ tile, from: pos });
      }
    }
    for (let i = 0;i < orderedPositions.length; i += 1) {
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
function canMergeTiles(first, second, dir, configMap) {
  if (first.sequenceId !== second.sequenceId) {
    return false;
  }
  const config = configMap.get(first.sequenceId);
  if (!config) {
    return false;
  }
  const relations = normalizeRelations(config.relations);
  if (!relations.includes(getAxisByDirection(dir))) {
    return false;
  }
  return buildMergePlan(first, second, config, config.allowReverseMerge === true) !== null;
}
function mergeTiles(first, second, configMap) {
  if (first.sequenceId !== second.sequenceId) {
    throw new Error("Cannot merge tiles from different sequenceId");
  }
  const config = configMap.get(first.sequenceId);
  if (!config) {
    throw new Error(`Unknown sequence id: ${first.sequenceId}`);
  }
  const normalizedConfig = {
    ...config,
    relations: normalizeRelations(config.relations),
    allowReverseMerge: config.allowReverseMerge === true
  };
  const mergePlan = buildMergePlan(first, second, normalizedConfig, normalizedConfig.allowReverseMerge);
  if (!mergePlan) {
    throw new Error("Cannot merge non-continuous intervals");
  }
  const { orderedFirst, orderedSecond, start, end } = mergePlan;
  const completed = start === 0 && end === normalizedConfig.atoms.length - 1;
  if (completed) {
    return {
      completed: true,
      rewardEvent: {
        sequenceId: normalizedConfig.id,
        reward: normalizedConfig.reward
      }
    };
  }
  return {
    completed: false,
    resultTile: createRangeTile(normalizedConfig, start, end, `${orderedFirst.symbol}${orderedSecond.symbol}`)
  };
}
function findMergeCandidates(board, dir, configMap) {
  assertSquareBoard(board);
  const size = board.length;
  const axis = getAxisByDirection(dir);
  const candidates = [];
  if (axis === "H") {
    for (let row = 0;row < size; row += 1) {
      for (let col = 0;col < size - 1; col += 1) {
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
  for (let col = 0;col < size; col += 1) {
    for (let row = 0;row < size - 1; row += 1) {
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
function resolveConflicts(candidates, _dir) {
  const selected = [];
  const occupied = new Set;
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
function applyMerges(board, selected, configMap) {
  const nextBoard = cloneBoard(board);
  const events = [];
  const rewards = [];
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
    const merged = mergeTiles(first, second, configMap);
    changed = true;
    nextBoard[r2][c2] = null;
    if (merged.completed) {
      nextBoard[r1][c1] = null;
      events.push({
        type: "merge",
        consumedTileIds: [first.id, second.id],
        anchor: [r1, c1],
        completedSequenceId: first.sequenceId
      });
      if (merged.rewardEvent) {
        rewards.push(merged.rewardEvent);
        events.push({
          type: "reward",
          sequenceId: merged.rewardEvent.sequenceId,
          reward: merged.rewardEvent.reward
        });
      }
    } else if (merged.resultTile) {
      nextBoard[r1][c1] = merged.resultTile;
      events.push({
        type: "merge",
        consumedTileIds: [first.id, second.id],
        anchor: [r1, c1],
        resultTile: merged.resultTile
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
function isInsideBoard(board, row, col) {
  return row >= 0 && col >= 0 && row < board.length && col < board.length;
}
function buildAtomIndex(configs) {
  const index = new Map;
  for (const config of configs) {
    config.atoms.forEach((atomSymbol, atomIndex) => {
      const entry = {
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
function listAtomDefinitions(configs) {
  const items = [];
  for (const defs of buildAtomIndex(configs).values()) {
    items.push(...defs);
  }
  return items;
}
function step(board, dir, configs, spawnPolicy) {
  const configMap = buildConfigMap(configs);
  const firstSlide = slideBoard(board, dir);
  const candidates = findMergeCandidates(firstSlide.board, dir, configMap);
  const selected = resolveConflicts(candidates, dir);
  const mergeResult = applyMerges(firstSlide.board, selected, configMap);
  const secondSlide = slideBoard(mergeResult.board, dir);
  let nextBoard = secondSlide.board;
  const events = [...firstSlide.events, ...mergeResult.events, ...secondSlide.events];
  const rewards = [...mergeResult.rewards];
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
// src/ui/main.ts
var BOARD_SIZE = 4;
var DIRECTIONS = ["Left", "Right", "Up", "Down"];
var configs = [
  {
    id: "姚姚领先",
    atoms: "姚姚领先".split(""),
    reward: { score: 100 },
    relations: ["H", "V"],
    allowReverseMerge: true
  }
];
var boardElement = document.querySelector("#board");
var scoreElement = document.querySelector("#score");
var movesElement = document.querySelector("#moves");
var statusElement = document.querySelector("#status");
var eventsElement = document.querySelector("#events");
var completedCountsElement = document.querySelector("#completed-counts");
var restartButton = document.querySelector("#restart");
if (!boardElement || !scoreElement || !movesElement || !statusElement || !eventsElement || !completedCountsElement || !restartButton) {
  throw new Error("UI mount failed: missing required elements");
}
var atomIndex = buildAtomIndex(configs);
var atomPool = listAtomDefinitions(configs);
function createInitialCompletedCounts() {
  const counts = {};
  for (const config of configs) {
    counts[config.id] = 0;
  }
  return counts;
}
var state = {
  board: createEmptyBoard(BOARD_SIZE),
  score: 0,
  moves: 0,
  status: "Use arrow keys or buttons to move.",
  eventLines: [],
  completedCounts: createInitialCompletedCounts()
};
function randInt(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive);
}
function randomFrom(items) {
  return items[randInt(items.length)];
}
function randomSpawnPolicy(req) {
  const empties = [];
  for (let row = 0;row < req.board.length; row += 1) {
    for (let col = 0;col < req.board.length; col += 1) {
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
function placeSpawn(board, spawn) {
  const next = board.map((row2) => row2.slice());
  const [row, col] = spawn.position;
  next[row][col] = spawn.tile;
  return next;
}
function seedBoard() {
  state.board = createEmptyBoard(BOARD_SIZE);
  state.score = 0;
  state.moves = 0;
  state.eventLines = [];
  state.status = "Use arrow keys or buttons to move.";
  state.completedCounts = createInitialCompletedCounts();
  for (let i = 0;i < 2; i += 1) {
    const spawn = randomSpawnPolicy({ board: state.board, configs });
    if (!spawn) {
      break;
    }
    state.board = placeSpawn(state.board, spawn);
  }
}
function tileClass(tile) {
  const length = tile.end - tile.start + 1;
  const level = Math.min(6, Math.max(1, length));
  return `tile tile-l${level}`;
}
function formatEvent(event) {
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
function renderBoard(board) {
  const fragment = document.createDocumentFragment();
  for (let row = 0;row < board.length; row += 1) {
    for (let col = 0;col < board.length; col += 1) {
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
function renderCompletedCounts() {
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
function render() {
  scoreElement.textContent = String(state.score);
  movesElement.textContent = String(state.moves);
  statusElement.textContent = state.status;
  eventsElement.textContent = state.eventLines.join(`
`);
  renderCompletedCounts();
  renderBoard(state.board);
}
function applyCompletionCounts(events) {
  for (const event of events) {
    if (event.type !== "merge" || !event.completedSequenceId) {
      continue;
    }
    const sequenceId = event.completedSequenceId;
    state.completedCounts[sequenceId] = (state.completedCounts[sequenceId] ?? 0) + 1;
  }
}
function executeMove(direction) {
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
function parseDirection(value) {
  if (!value) {
    return null;
  }
  return DIRECTIONS.includes(value) ? value : null;
}
document.addEventListener("keydown", (event) => {
  const keyMap = {
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
document.querySelectorAll("button[data-dir]").forEach((button) => {
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
