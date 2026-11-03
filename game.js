/*
 * n-Card Solitaire — game rules (any top card from 2 to K, 2 or 4 suits).
 *
 * Pure functions with no DOM access: every function that changes the game
 * returns a new state object (or null when the move is illegal), so the UI
 * can keep an undo history by holding on to old states.
 *
 * Works as a browser global (window.SixCard) and as a Node module.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SixCard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Suits in play: two suits use spades and diamonds; four add hearts and clubs.
  const SUITS_BY_COUNT = { 2: ['S', 'D'], 4: ['S', 'H', 'C', 'D'] };
  const SUIT_SYMBOL = { S: '♠︎', H: '♥︎', C: '♣︎', D: '♦︎' }; // text style, not emoji
  const SUIT_NAME = { S: 'spades', H: 'hearts', C: 'clubs', D: 'diamonds' };
  const RANK_LABEL = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K' };
  const RANK_NAME = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' };

  const DRAW_COUNT = 3; // cards turned from the stock each time

  // Settings. An empty column accepts the highest card (a King in classic Klondike).
  const HIGHEST_CHOICES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const COLUMN_CHOICES = [2, 3, 4, 5, 6, 7];
  const SUIT_CHOICES = [2, 4];
  const DEFAULT_SETTINGS = { highest: 3, columns: 2, suits: 2 };

  /* ---------- settings ---------- */

  /** Cards dealt to the columns: 1 + 2 + ... + columns. */
  const staircaseSize = (columns) => (columns * (columns + 1)) / 2;

  /** Column counts that still leave at least one card for the stock. */
  function allowedColumns(highest, suits = 2) {
    return COLUMN_CHOICES.filter((c) => staircaseSize(c) < highest * suits);
  }

  /** Smallest highest card that allows this many columns (above 13 means it needs more suits). */
  function minHighestFor(columns, suits = 2) {
    return Math.floor(staircaseSize(columns) / suits) + 1;
  }

  /**
   * Clean up settings: unknown values fall back to the defaults, and a
   * column count that leaves no stock drops to the largest one that fits.
   */
  function normalizeSettings(input = {}) {
    const pick = (value, choices, fallback) => (choices.includes(Number(value)) ? Number(value) : fallback);
    const highest = pick(input.highest, HIGHEST_CHOICES, DEFAULT_SETTINGS.highest);
    const suits = pick(input.suits, SUIT_CHOICES, DEFAULT_SETTINGS.suits);
    const allowed = allowedColumns(highest, suits);
    let columns = pick(input.columns, COLUMN_CHOICES, DEFAULT_SETTINGS.columns);
    if (!allowed.includes(columns)) {
      columns = allowed.filter((c) => c <= columns).pop() || allowed[0];
    }
    return { highest, columns, suits };
  }

  /* ---------- cards ---------- */

  function makeDeck(highest = DEFAULT_SETTINGS.highest, suits = DEFAULT_SETTINGS.suits) {
    const deck = [];
    for (const suit of SUITS_BY_COUNT[suits]) {
      for (let rank = 1; rank <= highest; rank++) {
        deck.push({ id: RANK_LABEL[rank] + suit, rank, suit, faceUp: false });
      }
    }
    return deck;
  }

  function shuffle(cards, rng = Math.random) {
    const a = cards.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const isRed = (card) => card.suit === 'D' || card.suit === 'H';
  const top = (pile) => pile[pile.length - 1];
  const label = (card) => RANK_LABEL[card.rank] + SUIT_SYMBOL[card.suit];
  const spokenName = (card) => `${RANK_NAME[card.rank] || card.rank} of ${SUIT_NAME[card.suit]}`;
  const clone = (state) => JSON.parse(JSON.stringify(state));
  /** The game's top rank (older saved games without it used 3). */
  const highestOf = (state) => state.highest || 3;

  /* ---------- dealing ---------- */

  /**
   * Deal a deck in the given order as a staircase:
   *   column 1 gets 1 card, column 2 gets 2, ... (only the last card face up),
   *   and the rest form the stock, face down (the deck's last card on top).
   * The first three stock cards are then turned onto the waste, so a card
   * is playable right away. With the default 6 cards and 2 columns:
   *   deck[0] -> column 1; deck[1], deck[2] -> column 2; deck[3..5] -> stock.
   */
  function deal(deck, options = {}) {
    const columns = options.columns || 2;
    const highest = Math.max(...deck.map((card) => card.rank));
    const suitCount = new Set(deck.map((card) => card.suit)).size;
    const c = deck.map((card) => ({ ...card, faceUp: false }));
    const tableau = [];
    let k = 0;
    for (let i = 0; i < columns; i++) {
      const col = [];
      for (let j = 0; j <= i; j++) col.push({ ...c[k++], faceUp: j === i });
      tableau.push(col);
    }
    return draw({
      highest,
      stock: c.slice(k),
      waste: [],
      wasteFan: 0, // how many of the waste's top cards are fanned out
      tableau,
      foundations: Array.from({ length: suitCount }, () => []),
    });
  }

  function newGame(rng = Math.random, settings = DEFAULT_SETTINGS) {
    const s = normalizeSettings(settings);
    return deal(shuffle(makeDeck(s.highest, s.suits), rng), s);
  }

  /**
   * A shuffled deck waiting to be dealt: every card face down in the stock,
   * with empty columns and foundations sized for the settings. `deck` keeps
   * the shuffle so dealPending() deals exactly this order.
   */
  function prepareDeal(rng = Math.random, settings = DEFAULT_SETTINGS) {
    const s = normalizeSettings(settings);
    const deck = shuffle(makeDeck(s.highest, s.suits), rng).map((card) => ({ ...card, faceUp: false }));
    return {
      highest: s.highest,
      pending: true,
      deck,
      stock: deck.slice().reverse(), // first card to be dealt sits on top
      waste: [],
      wasteFan: 0,
      tableau: Array.from({ length: s.columns }, () => []),
      foundations: Array.from({ length: s.suits }, () => []),
    };
  }

  /** Deal a prepared shuffle. Returns null if the state isn't waiting to be dealt. */
  function dealPending(state) {
    if (!state || !state.pending) return null;
    return deal(state.deck, { columns: state.tableau.length });
  }

  /* ---------- rules ---------- */

  /** A run is face up, descending by one, alternating colors. */
  function isValidRun(cards) {
    if (!cards.length) return false;
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].faceUp) return false;
      if (i > 0) {
        const below = cards[i - 1];
        const above = cards[i];
        if (above.rank !== below.rank - 1 || isRed(above) === isRed(below)) return false;
      }
    }
    return true;
  }

  function canPlaceOnTableau(state, cards, col) {
    if (!cards || !cards.length) return false;
    const dest = state.tableau[col];
    if (!dest) return false;
    const t = top(dest);
    if (!t) return cards[0].rank === highestOf(state); // empty column takes the highest card
    return t.faceUp && cards[0].rank === t.rank - 1 && isRed(cards[0]) !== isRed(t);
  }

  function canPlaceOnFoundation(state, cards, f) {
    if (!cards || cards.length !== 1) return false;
    const pile = state.foundations[f];
    if (!pile) return false;
    const card = cards[0];
    const t = top(pile);
    if (!t) return card.rank === 1;
    return card.suit === t.suit && card.rank === t.rank + 1;
  }

  /**
   * The cards that would be lifted from a location, or null if nothing there
   * can move. `from` is { pile: 'waste' | 'foundation' | 'tableau', index, cardIndex }.
   */
  function pickUp(state, from) {
    if (!from) return null;
    if (from.pile === 'waste') {
      return state.waste.length ? [top(state.waste)] : null;
    }
    if (from.pile === 'foundation') {
      const pile = state.foundations[from.index];
      return pile && pile.length ? [top(pile)] : null;
    }
    if (from.pile === 'tableau') {
      const col = state.tableau[from.index];
      if (!col || !col.length) return null;
      const i = from.cardIndex == null ? col.length - 1 : from.cardIndex;
      if (i < 0 || i >= col.length) return null;
      const run = col.slice(i);
      return isValidRun(run) ? run : null;
    }
    return null;
  }

  function sourcePile(state, from) {
    if (from.pile === 'waste') return state.waste;
    if (from.pile === 'foundation') return state.foundations[from.index];
    return state.tableau[from.index];
  }

  function isLegalMove(state, from, to) {
    const cards = pickUp(state, from);
    if (!cards || !to) return false;
    if (from.pile === to.pile && from.index === to.index) return false;
    if (to.pile === 'tableau') return canPlaceOnTableau(state, cards, to.index);
    if (to.pile === 'foundation') return canPlaceOnFoundation(state, cards, to.index);
    return false;
  }

  /** Apply a move. Returns the new state, or null if the move is illegal. */
  function move(state, from, to) {
    if (!isLegalMove(state, from, to)) return null;
    const count = pickUp(state, from).length;
    const s = clone(state);
    const src = sourcePile(s, from);
    const moving = src.splice(src.length - count, count);
    const dest = to.pile === 'tableau' ? s.tableau[to.index] : s.foundations[to.index];
    dest.push(...moving);

    // The rest of the fan shifts right and the next card down fills position 1.
    if (from.pile === 'waste') s.wasteFan = fanSize(s.waste);
    if (from.pile === 'tableau') {
      const t = top(src);
      if (t && !t.faceUp) t.faceUp = true; // expose and flip
    }
    return s;
  }

  /**
   * Turn up to three cards from the stock onto the waste. With the stock
   * empty, turn the whole waste back over to form the stock again
   * (unlimited passes). Returns null when there is nothing to do.
   */
  /** The waste always fans its top three cards (fewer when it holds fewer). */
  function fanSize(waste) {
    return Math.min(DRAW_COUNT, waste.length);
  }

  function draw(state) {
    if (state.pending) return null;
    const s = clone(state);
    if (s.stock.length) {
      const n = Math.min(DRAW_COUNT, s.stock.length);
      for (let i = 0; i < n; i++) {
        const card = s.stock.pop();
        card.faceUp = true;
        s.waste.push(card);
      }
      s.wasteFan = fanSize(s.waste);
      return s;
    }
    if (s.waste.length) {
      s.stock = s.waste.reverse().map((card) => ({ ...card, faceUp: false }));
      s.waste = [];
      s.wasteFan = 0;
      return s;
    }
    return null;
  }

  /** Foundation index that will take this card: same suit first, else the leftmost empty slot for an Ace. */
  function foundationTargetFor(state, card) {
    if (!card) return -1;
    let empty = -1;
    for (let f = 0; f < state.foundations.length; f++) {
      if (!canPlaceOnFoundation(state, [card], f)) continue;
      if (state.foundations[f].length) return f;
      if (empty < 0) empty = f;
    }
    return empty;
  }

  /**
   * Where a click sends the playable waste card or a face-up column card
   * (with any cards on top of it). A foundation's top card goes to the
   * leftmost column that takes it, and nowhere else. Otherwise:
   *   0. an Ace always goes straight to a foundation, otherwise
   *   1. the leftmost other column that accepts it, otherwise
   *   2. the foundation that accepts it (single cards only), otherwise null.
   * A run that already starts at the bottom of its column never moves to an
   * empty column, since that would change nothing.
   */
  function clickTarget(state, from) {
    if (!from || !['waste', 'tableau', 'foundation'].includes(from.pile)) return null;
    const cards = pickUp(state, from);
    if (!cards) return null;
    if (from.pile === 'foundation') {
      // A foundation's top card comes back down to the leftmost column that takes it.
      for (let col = 0; col < state.tableau.length; col++) {
        if (canPlaceOnTableau(state, cards, col)) return { pile: 'tableau', index: col };
      }
      return null;
    }
    if (cards.length === 1 && cards[0].rank === 1) {
      const f = foundationTargetFor(state, cards[0]);
      if (f >= 0) return { pile: 'foundation', index: f };
    }
    const fromCol = from.pile === 'tableau' ? from.index : -1;
    const wholeColumn = fromCol >= 0 && (from.cardIndex == null ? state.tableau[fromCol].length === 1 : from.cardIndex === 0);
    for (let col = 0; col < state.tableau.length; col++) {
      if (col === fromCol) continue;
      if (wholeColumn && !state.tableau[col].length) continue;
      if (canPlaceOnTableau(state, cards, col)) return { pile: 'tableau', index: col };
    }
    if (cards.length !== 1) return null;
    const f = foundationTargetFor(state, cards[0]);
    return f >= 0 ? { pile: 'foundation', index: f } : null;
  }

  function wasteClickTarget(state) {
    return clickTarget(state, { pile: 'waste' });
  }

  /** Foundation target for a double-clicked top card, or null. */
  function foundationMoveFor(state, from) {
    const cards = pickUp(state, from);
    if (!cards || cards.length !== 1) return null;
    const f = foundationTargetFor(state, cards[0]);
    return f >= 0 ? { pile: 'foundation', index: f } : null;
  }

  function isWon(state) {
    return state.foundations.every((pile) => pile.length === highestOf(state));
  }

  /** True once nothing is hidden or left to draw, so the game can play itself out. */
  function canAutoFinish(state) {
    return (
      !isWon(state) &&
      state.stock.length === 0 &&
      state.waste.length === 0 &&
      state.tableau.every((col) => col.every((card) => card.faceUp))
    );
  }

  /** The next column-to-foundation move during an automatic finish, lowest rank first. */
  function nextAutoFinishMove(state) {
    let best = null;
    state.tableau.forEach((col, index) => {
      if (!col.length) return;
      const from = { pile: 'tableau', index, cardIndex: col.length - 1 };
      const to = foundationMoveFor(state, from);
      if (to && (!best || top(col).rank < best.rank)) best = { from, to, rank: top(col).rank };
    });
    return best && { from: best.from, to: best.to };
  }

  /** Find where a card currently is, as a `from` location. */
  function locate(state, id) {
    for (let index = 0; index < state.tableau.length; index++) {
      const cardIndex = state.tableau[index].findIndex((c) => c.id === id);
      if (cardIndex >= 0) return { pile: 'tableau', index, cardIndex };
    }
    for (let index = 0; index < state.foundations.length; index++) {
      if (state.foundations[index].some((c) => c.id === id)) return { pile: 'foundation', index };
    }
    if (state.waste.some((c) => c.id === id)) return { pile: 'waste', index: 0 };
    if (state.stock.some((c) => c.id === id)) return { pile: 'stock', index: 0 };
    return null;
  }

  return {
    DRAW_COUNT,
    HIGHEST_CHOICES,
    COLUMN_CHOICES,
    SUIT_CHOICES,
    DEFAULT_SETTINGS,
    SUIT_SYMBOL,
    RANK_LABEL,
    staircaseSize,
    allowedColumns,
    minHighestFor,
    normalizeSettings,
    highestOf,
    makeDeck,
    shuffle,
    deal,
    newGame,
    prepareDeal,
    dealPending,
    isRed,
    label,
    spokenName,
    isValidRun,
    canPlaceOnTableau,
    canPlaceOnFoundation,
    pickUp,
    isLegalMove,
    move,
    draw,
    foundationTargetFor,
    clickTarget,
    wasteClickTarget,
    foundationMoveFor,
    isWon,
    canAutoFinish,
    nextAutoFinishMove,
    locate,
  };
});
