// src/core/engine.ts
var tileIdCounter = 1;
function nextTileId() {
  const id = tileIdCounter;
  tileIdCounter += 1;
  return id;
}
function createEmptyBoard(rows, cols = rows) {
  if (rows <= 0 || cols <= 0) {
    throw new Error("Board dimensions must be positive");
  }
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
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
function getLinePositions(rowCount, colCount, dir, line) {
  const positions = [];
  if (dir === "Left") {
    for (let col = 0;col < colCount; col += 1) {
      positions.push([line, col]);
    }
    return positions;
  }
  if (dir === "Right") {
    for (let col = colCount - 1;col >= 0; col -= 1) {
      positions.push([line, col]);
    }
    return positions;
  }
  if (dir === "Up") {
    for (let row = 0;row < rowCount; row += 1) {
      positions.push([row, line]);
    }
    return positions;
  }
  for (let row = rowCount - 1;row >= 0; row -= 1) {
    positions.push([row, line]);
  }
  return positions;
}
function assertRectangularBoard(board) {
  const rowCount = board.length;
  if (rowCount <= 0) {
    throw new Error("Board must have at least one row");
  }
  const colCount = board[0]?.length ?? 0;
  if (colCount <= 0) {
    throw new Error("Board must have at least one column");
  }
  for (const row of board) {
    if (row.length !== colCount) {
      throw new Error("Board rows must have equal length");
    }
  }
  return { rowCount, colCount };
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
function normalizeConfig(config) {
  return {
    ...config,
    relations: normalizeRelations(config.relations),
    allowReverseMerge: config.allowReverseMerge === true
  };
}
function findMatchingIntervalsBySymbol(tileSymbol, config) {
  if (tileSymbol.length === 0) {
    return [];
  }
  const intervals = [];
  for (let start = 0;start < config.atoms.length; start += 1) {
    let combined = "";
    for (let end = start;end < config.atoms.length; end += 1) {
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
function resolveMergeContext(first, second, configMap, dir) {
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
function createRangeTile(config, start, end, symbol) {
  return {
    id: nextTileId(),
    sequenceId: config.id,
    start,
    end,
    symbol: symbol ?? (start === end ? config.atoms[start] ?? `${config.id}[${start}]` : `${config.id}[${start},${end}]`)
  };
}
function getSequenceLength(sequenceId, configMap) {
  const config = configMap.get(sequenceId);
  if (!config) {
    return null;
  }
  return config.atoms.length;
}
function isFinalTile(tile, configMap) {
  const sequenceLength = getSequenceLength(tile.sequenceId, configMap);
  if (sequenceLength === null) {
    return false;
  }
  return tile.start === 0 && tile.end === sequenceLength - 1;
}
function slideBoard(board, dir) {
  const { rowCount, colCount } = assertRectangularBoard(board);
  const lineCount = dir === "Left" || dir === "Right" ? rowCount : colCount;
  const nextBoard = createEmptyBoard(rowCount, colCount);
  const events = [];
  let changed = false;
  for (let line = 0;line < lineCount; line += 1) {
    const orderedPositions = getLinePositions(rowCount, colCount, dir, line);
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
  const firstIsFinal = isFinalTile(first, configMap);
  const secondIsFinal = isFinalTile(second, configMap);
  if (firstIsFinal && secondIsFinal) {
    return true;
  }
  return resolveMergeContext(first, second, configMap, dir) !== null;
}
function mergeTiles(first, second, configMap, dir) {
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
function findMergeCandidates(board, dir, configMap) {
  const { rowCount, colCount } = assertRectangularBoard(board);
  const axis = getAxisByDirection(dir);
  const candidates = [];
  if (axis === "H") {
    for (let row = 0;row < rowCount; row += 1) {
      for (let col = 0;col < colCount - 1; col += 1) {
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
  for (let col = 0;col < colCount; col += 1) {
    for (let row = 0;row < rowCount - 1; row += 1) {
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
function applyMerges(board, selected, dir, configMap) {
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
    const merged = mergeTiles(first, second, configMap, dir);
    changed = true;
    if (merged.removeSecond) {
      nextBoard[r2][c2] = null;
    }
    if (merged.removeFirst) {
      nextBoard[r1][c1] = null;
    } else if (merged.resultTile) {
      nextBoard[r1][c1] = merged.resultTile;
    }
    events.push({
      type: "merge",
      consumedTileIds: [first.id, second.id],
      anchor: [r1, c1],
      ...merged.resultTile ? { resultTile: merged.resultTile } : {},
      ...merged.completedSequenceId ? { completedSequenceId: merged.completedSequenceId } : {}
    });
    if (merged.rewardEvent) {
      rewards.push(merged.rewardEvent);
      events.push({
        type: "reward",
        sequenceId: merged.rewardEvent.sequenceId,
        reward: merged.rewardEvent.reward
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
  if (row < 0 || col < 0 || row >= board.length) {
    return false;
  }
  const colCount = board[0]?.length ?? 0;
  return col < colCount;
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
  const mergeResult = applyMerges(firstSlide.board, selected, dir, configMap);
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
// src/ui/constants.ts
var ElPsyCongroo = (xs) => xs.map((c) => String.fromCharCode(c)).join("");
var BOARD_ROWS = 4;
var BOARD_COLS = 4;
var DIRECTIONS = ["Left", "Right", "Up", "Down"];
var STATUS_TEXT = {
  ready: "Use arrow keys or buttons to move.",
  noMove: "No tiles moved.",
  moveApplied: "Move applied.",
  gameOver: ElPsyCongroo([25105, 23459, 24067, 20320, 24050, 32147, 19981, 26159, 25105, 30340, 23416, 29983, 20102, 33])
};
var GAME_OVER_TEXT = STATUS_TEXT.gameOver;
var RETRY_TEXT = ElPsyCongroo([30003, 35831, 20854, 20182, 23548, 24072]);
var StrategicRatio = { p: 7, q: 8 };
var BEST_SCORE_STORAGE_KEY = "sequence-grid.best-score.v1";

// src/ui/best-score.ts
function sanitizeScore(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}
function loadBestScore() {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    if (!raw) {
      return 0;
    }
    return sanitizeScore(Number(raw));
  } catch {
    return 0;
  }
}
function saveBestScore(score) {
  try {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(sanitizeScore(score)));
  } catch {}
}

// src/ui/deadlock.ts
function samePosition2(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}
function getLinePositions2(rowCount, colCount, dir, line) {
  const positions = [];
  if (dir === "Left") {
    for (let col = 0;col < colCount; col += 1) {
      positions.push([line, col]);
    }
    return positions;
  }
  if (dir === "Right") {
    for (let col = colCount - 1;col >= 0; col -= 1) {
      positions.push([line, col]);
    }
    return positions;
  }
  if (dir === "Up") {
    for (let row = 0;row < rowCount; row += 1) {
      positions.push([row, line]);
    }
    return positions;
  }
  for (let row = rowCount - 1;row >= 0; row -= 1) {
    positions.push([row, line]);
  }
  return positions;
}
function hasSlideSpace(board, dir) {
  const rowCount = board.length;
  if (rowCount === 0) {
    return false;
  }
  const colCount = board[0]?.length ?? 0;
  if (colCount === 0) {
    return false;
  }
  const lineCount = dir === "Left" || dir === "Right" ? rowCount : colCount;
  for (let line = 0;line < lineCount; line += 1) {
    const positions = getLinePositions2(rowCount, colCount, dir, line);
    const occupied = [];
    for (const pos of positions) {
      if (board[pos[0]][pos[1]] !== null) {
        occupied.push(pos);
      }
    }
    for (let i = 0;i < occupied.length; i += 1) {
      if (!samePosition2(occupied[i], positions[i])) {
        return true;
      }
    }
  }
  return false;
}
function hasMergeOpportunity(board, dir, configMap) {
  const rowCount = board.length;
  if (rowCount === 0) {
    return false;
  }
  const colCount = board[0]?.length ?? 0;
  if (colCount === 0) {
    return false;
  }
  if (dir === "Left" || dir === "Right") {
    for (let row = 0;row < rowCount; row += 1) {
      for (let col = 0;col < colCount - 1; col += 1) {
        const first = board[row][col];
        const second = board[row][col + 1];
        if (!first || !second) {
          continue;
        }
        if (canMergeTiles(first, second, dir, configMap)) {
          return true;
        }
      }
    }
    return false;
  }
  for (let col = 0;col < colCount; col += 1) {
    for (let row = 0;row < rowCount - 1; row += 1) {
      const first = board[row][col];
      const second = board[row + 1][col];
      if (!first || !second) {
        continue;
      }
      if (canMergeTiles(first, second, dir, configMap)) {
        return true;
      }
    }
  }
  return false;
}
function hasAvailableMove(board, directions, configMap) {
  for (const dir of directions) {
    if (hasSlideSpace(board, dir) || hasMergeOpportunity(board, dir, configMap)) {
      return true;
    }
  }
  return false;
}

// src/ui/dom.ts
function requireElement(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`UI mount failed: missing required element: ${selector}`);
  }
  return element;
}
function mountUi() {
  const boardElement = requireElement("#board");
  const scoreElement = requireElement("#score");
  const bestScoreElement = requireElement("#best-score");
  const movesElement = requireElement("#moves");
  const statusElement = requireElement("#status");
  const eventsElement = requireElement("#events");
  const completedCountsElement = requireElement("#completed-counts");
  const restartButton = requireElement("#restart");
  const gamePanelElement = requireElement(".game-panel");
  const gameMessageElement = document.createElement("div");
  gameMessageElement.className = "game-message";
  gameMessageElement.setAttribute("aria-live", "assertive");
  const gameMessageTextElement = document.createElement("p");
  gameMessageTextElement.className = "game-message-text";
  gameMessageTextElement.textContent = GAME_OVER_TEXT;
  const retryButtonElement = document.createElement("button");
  retryButtonElement.type = "button";
  retryButtonElement.className = "retry-button";
  retryButtonElement.textContent = RETRY_TEXT;
  gameMessageElement.append(gameMessageTextElement, retryButtonElement);
  gamePanelElement.appendChild(gameMessageElement);
  return {
    boardElement,
    scoreElement,
    bestScoreElement,
    movesElement,
    statusElement,
    eventsElement,
    completedCountsElement,
    restartButton,
    gameMessageElement,
    retryButtonElement
  };
}
function updateGameOverUI(ui, gameOver) {
  ui.gameMessageElement.classList.toggle("visible", gameOver);
  ui.retryButtonElement.disabled = !gameOver;
}

// src/ui/render.ts
function tileClass(tile) {
  const length = tile.end - tile.start + 1;
  const level = Math.min(6, Math.max(1, length));
  return `tile tile-l${level}`;
}
function getBoardColumnCount(board) {
  return board[0]?.length ?? 0;
}
function computeTileFontSize(tile) {
  const glyphCount = Math.max(1, Array.from(tile.symbol).length);
  const size = -2 / 5 * glyphCount + 25;
  return Math.max(12, size);
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
function renderBoard(board, boardElement) {
  const fragment = document.createDocumentFragment();
  const columnCount = getBoardColumnCount(board);
  boardElement.style.setProperty("--board-cols", String(Math.max(1, columnCount)));
  for (let row = 0;row < board.length; row += 1) {
    for (let col = 0;col < board[row].length; col += 1) {
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
function renderCompletedCounts(completedCountsElement, completedCounts, configs) {
  const fragment = document.createDocumentFragment();
  for (const config of configs) {
    const item = document.createElement("li");
    item.className = "completed-item";
    const label = document.createElement("span");
    label.textContent = config.id;
    const value = document.createElement("strong");
    value.textContent = String(completedCounts[config.id] ?? 0);
    item.append(label, value);
    fragment.appendChild(item);
  }
  completedCountsElement.replaceChildren(fragment);
}
function render(ui, state, configs) {
  ui.scoreElement.textContent = String(state.score);
  ui.bestScoreElement.textContent = String(state.bestScore);
  ui.movesElement.textContent = String(state.moves);
  ui.statusElement.textContent = state.status;
  ui.eventsElement.textContent = state.eventLines.join(`
`);
  renderCompletedCounts(ui.completedCountsElement, state.completedCounts, configs);
  renderBoard(state.board, ui.boardElement);
  updateGameOverUI(ui, state.gameOver);
}

// src/ui/seq.ts
var group = ({
  atoms,
  id = atoms.join(""),
  relations = ["H", "V"],
  allowReverseMerge = true,
  score = 100
}) => ({
  id,
  atoms,
  reward: { score },
  relations,
  allowReverseMerge
});

// src/ui/seq-data.ts
var configs = [
  ...[
    ["代数", "儿何"],
    ["这是一个", "下等的論文"],
    ["已經到了", "無恥的地步"],
    ["從頭到尾，", "秘密行動"],
    ["朋比为奸", "！"],
    ["居心叵测", "！"],
    ["有没有", "利益輸送", "？"],
    ["要求不會改變", "！"],
    ["羞之", "羞之", "！"],
    ["獎一个", "华为手表"],
    ["這種成績，", "使人汗顏！", "如此成績，", "如何招生", "？"],
    ["何其斤斤计较於", "一餐之饱食"],
    ["尋天人樂處，", "拓万古心胸。"],
    ["我們学生躲在遊戲屋，", "不觉得羞愧, ", "？"],
    ["大家可以討論，", "正如小孩子們喜歡吃零食，", "不願意吃正餐一樣。"],
    ["花點時間去挑戰數学有趣的難題，", "不再討論這件事情了"],
    ["躲在家中", "玩耍游戏，", "置一流学問於不顾", "！"]
  ].map((s) => group({ atoms: s }))
];

// src/ui/spawn-policy.ts
function randInt(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive);
}
function randomFrom(items) {
  return items[randInt(items.length)];
}
function getTileAt(board, row, col) {
  if (row < 0 || row >= board.length || col < 0) {
    return null;
  }
  if (col >= board[row].length) {
    return null;
  }
  return board[row][col];
}
function getEmptyPositions(board) {
  const empties = [];
  for (let row = 0;row < board.length; row += 1) {
    for (let col = 0;col < board[row].length; col += 1) {
      if (board[row][col] === null) {
        empties.push([row, col]);
      }
    }
  }
  return empties;
}
function scoreSpawnCandidate(board, row, col, atom, configMap) {
  const previewTile = {
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
function randomSpawn(empties, atomPool) {
  const randomPosition = randomFrom(empties);
  const randomAtom = randomFrom(atomPool);
  return {
    position: randomPosition,
    tile: createAtomicTile(randomAtom.sequenceId, randomAtom.atomIndex, randomAtom.atomSymbol)
  };
}
function createStrategicSpawnPolicy(atomPool, configMap) {
  return function strategicSpawnPolicy(req) {
    const empties = getEmptyPositions(req.board);
    if (!empties.length || !atomPool.length) {
      return null;
    }
    const rowCount = req.board.length;
    const colCount = req.board[0]?.length ?? 0;
    const totalCells = rowCount * colCount;
    const occupiedCells = totalCells - empties.length;
    const shouldUseStrategic = totalCells > 0 && occupiedCells * StrategicRatio.q >= totalCells * StrategicRatio.p;
    if (!shouldUseStrategic) {
      return randomSpawn(empties, atomPool);
    }
    let bestScore = Number.NEGATIVE_INFINITY;
    const bestCandidates = [];
    for (const position of empties) {
      const [row, col] = position;
      for (const atom of atomPool) {
        const score = scoreSpawnCandidate(req.board, row, col, atom, configMap);
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
      return randomSpawn(empties, atomPool);
    }
    const selected = randomFrom(bestCandidates);
    return {
      position: selected.position,
      tile: createAtomicTile(selected.atom.sequenceId, selected.atom.atomIndex, selected.atom.atomSymbol)
    };
  };
}

// src/ui/state.ts
function createInitialCompletedCounts(configs2) {
  const counts = {};
  for (const config of configs2) {
    counts[config.id] = 0;
  }
  return counts;
}
function createInitialState(configs2, bestScore = 0) {
  return {
    board: createEmptyBoard(BOARD_ROWS, BOARD_COLS),
    score: 0,
    bestScore,
    moves: 0,
    status: STATUS_TEXT.ready,
    eventLines: [],
    completedCounts: createInitialCompletedCounts(configs2),
    gameOver: false
  };
}

// src/ui/main.ts
var ui = mountUi();
var atomIndex = buildAtomIndex(configs);
var atomPool = listAtomDefinitions(configs);
var configMap = buildConfigMap(configs);
var spawnPolicy = createStrategicSpawnPolicy(atomPool, configMap);
var state = createInitialState(configs, loadBestScore());
function placeSpawn(board, spawn) {
  const next = board.map((row2) => row2.slice());
  const [row, col] = spawn.position;
  next[row][col] = spawn.tile;
  return next;
}
function resetState() {
  const next = createInitialState(configs, state.bestScore);
  state.board = next.board;
  state.score = next.score;
  state.bestScore = next.bestScore;
  state.moves = next.moves;
  state.status = next.status;
  state.eventLines = next.eventLines;
  state.completedCounts = next.completedCounts;
  state.gameOver = next.gameOver;
}
function seedBoard() {
  resetState();
  for (let i = 0;i < 2; i += 1) {
    const spawn = spawnPolicy({ board: state.board, configs });
    if (!spawn) {
      break;
    }
    state.board = placeSpawn(state.board, spawn);
  }
  updateGameOverState(state.board);
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
function updateGameOverState(board) {
  state.gameOver = !hasAvailableMove(board, DIRECTIONS, configMap);
  if (state.gameOver) {
    state.status = STATUS_TEXT.gameOver;
  }
}
function syncBestScore() {
  if (state.score <= state.bestScore) {
    return;
  }
  state.bestScore = state.score;
  saveBestScore(state.bestScore);
}
function setStatusAfterMove(scoreDelta) {
  if (state.gameOver) {
    return;
  }
  state.status = scoreDelta > 0 ? `Gained ${scoreDelta} score this move.` : STATUS_TEXT.moveApplied;
}
function executeMove(direction) {
  if (state.gameOver) {
    return;
  }
  const result = step(state.board, direction, configs, spawnPolicy);
  if (!result.changed) {
    updateGameOverState(state.board);
    if (!state.gameOver) {
      state.status = STATUS_TEXT.noMove;
    }
    render(ui, state, configs);
    return;
  }
  state.board = result.board;
  state.moves += 1;
  const scoreDelta = result.rewards.reduce((acc, reward) => acc + (reward.reward?.score ?? 0), 0);
  state.score += scoreDelta;
  syncBestScore();
  applyCompletionCounts(result.events);
  updateGameOverState(state.board);
  setStatusAfterMove(scoreDelta);
  state.eventLines = result.events.slice(-8).map(formatEvent);
  render(ui, state, configs);
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
function restartGame() {
  seedBoard();
  render(ui, state, configs);
}
ui.restartButton.addEventListener("click", restartGame);
ui.retryButtonElement.addEventListener("click", () => {
  window.open(ElPsyCongroo([104, 116, 116, 112, 115, 58, 47, 47, 116, 105, 97, 110, 46, 98, 105, 99, 109, 114, 46, 112, 107, 117, 46, 101, 100, 117, 46, 99, 110]), "_blank", "noopener,noreferrer");
});
seedBoard();
render(ui, state, configs);
console.log("Atom index:", atomIndex);
console.log("Atom pool size:", atomPool.length);
