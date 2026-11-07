// Shared by every module: the game rules (G), settings and timing constants, the game's
// changing state (S), and small helpers.

/** The game's changing state, shared by the modules. */
export const S = {
  settings: null,
  autoFinish: true,
  state: null,
  shuffleState: null,
  history: [],
  record: [],
  moves: 0,
  busy: false,
  closed: false,
  suppressAuto: false,
  L: null,
  drag: null,
};

export const G = window.SixCard;

export const AUTO_STEP_MS = 180;
export const REFILL_LOCK_MS = 500; // after the refresh arrow, stock clicks are ignored this long (a reflex double click)
export const DRAG_THRESHOLD = 5;
export const SETTINGS_KEY = 'solitaire-study.settings';
// Raised whenever the rules change how a saved game deals or plays (2: row deal, suit order ♠ ♥ ♣ ♦).
export const SAVE_RULES = 2;
export const AUTO_FINISH_KEY = 'solitaire-study.autoFinish';
export const Z = { stock: 100, waste: 200, foundation: 300, tableau: 400, moving: 1000, dragging: 3000 };

// Pip positions inside the .pips box, as [x%, y%]; pips below the middle are drawn upside down.
export const PIPS = {
  1: [[50, 50]],
  2: [[50, 0], [50, 100]],
  3: [[50, 0], [50, 50], [50, 100]],
  4: [[0, 0], [100, 0], [0, 100], [100, 100]],
  5: [[0, 0], [100, 0], [50, 50], [0, 100], [100, 100]],
  6: [[0, 0], [100, 0], [0, 50], [100, 50], [0, 100], [100, 100]],
  7: [[0, 0], [100, 0], [50, 25], [0, 50], [100, 50], [0, 100], [100, 100]],
  8: [[0, 0], [100, 0], [50, 25], [0, 50], [100, 50], [50, 75], [0, 100], [100, 100]],
  9: [[0, 0], [100, 0], [0, 33], [100, 33], [50, 50], [0, 67], [100, 67], [0, 100], [100, 100]],
  10: [[0, 0], [100, 0], [50, 17], [0, 33], [100, 33], [0, 67], [100, 67], [50, 83], [0, 100], [100, 100]],
};

export const top = (pile) => pile[pile.length - 1];
export const rankLabel = (rank) => G.RANK_LABEL[rank];
export const withArticle = (rank) => (rank === 8 ? 'an ' : 'a ') + rankLabel(rank);
/** The setup code (the record header): highest card, suits, columns, draw, as G.setupText writes it. */
export const setupCode = () => rankLabel(S.settings.highest) + S.settings.suits + S.settings.columns + S.settings.draw;
