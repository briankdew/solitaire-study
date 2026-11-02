/*
 * Six-Card Solitaire — game rules.
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

  const SUITS = ['S', 'D'];
  const SUIT_SYMBOL = { S: '♠︎', D: '♦︎' }; // ♠ ♦ (text style, not emoji)
  const SUIT_NAME = { S: 'spades', D: 'diamonds' };
  const RANK_LABEL = { 1: 'A', 2: '2', 3: '3' };
  const RANK_NAME = { 1: 'Ace', 2: '2', 3: '3' };

  const DRAW_COUNT = 3;        // cards turned from the stock each time
  const EMPTY_COLUMN_RANK = 3; // an empty column accepts a 3 (instead of a King)
  const TOP_RANK = 3;          // a foundation is complete at this rank

  /* ---------- cards ---------- */

  function makeDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (let rank = 1; rank <= TOP_RANK; rank++) {
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

  const isRed = (card) => card.suit === 'D';
  const top = (pile) => pile[pile.length - 1];
  const label = (card) => RANK_LABEL[card.rank] + SUIT_SYMBOL[card.suit];
  const spokenName = (card) => `${RANK_NAME[card.rank]} of ${SUIT_NAME[card.suit]}`;
  const clone = (state) => JSON.parse(JSON.stringify(state));

  /* ---------- dealing ---------- */

  /**
   * Deal a 6-card deck in the given order:
   *   deck[0]        -> column 1, face up
   *   deck[1]        -> column 2, face down
   *   deck[2]        -> column 2, face up
   *   deck[3..5]     -> stock, face down (deck[5] on top)
   * The first three stock cards are then turned onto the waste, so a card
   * is playable right away.
   */
  function deal(deck) {
    const c = deck.map((card) => ({ ...card, faceUp: false }));
    const up = (card) => ({ ...card, faceUp: true });
    return draw({
      stock: [c[3], c[4], c[5]],
      waste: [],
      wasteFan: 0, // how many of the waste's top cards are fanned out
      tableau: [[up(c[0])], [c[1], up(c[2])]],
      foundations: [[], []],
    });
  }

  function newGame(rng = Math.random) {
    return deal(shuffle(makeDeck(), rng));
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
    if (!t) return cards[0].rank === EMPTY_COLUMN_RANK;
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

    if (from.pile === 'waste') {
      s.wasteFan = s.wasteFan - 1;
      // Once the fanned cards are used up, the next waste card shows on its own.
      if (s.waste.length && s.wasteFan < 1) s.wasteFan = 1;
      if (!s.waste.length) s.wasteFan = 0;
    }
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
  function draw(state) {
    const s = clone(state);
    if (s.stock.length) {
      const n = Math.min(DRAW_COUNT, s.stock.length);
      for (let i = 0; i < n; i++) {
        const card = s.stock.pop();
        card.faceUp = true;
        s.waste.push(card);
      }
      s.wasteFan = n;
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
   * (with any cards on top of it):
   *   0. an Ace always goes straight to a foundation, otherwise
   *   1. the leftmost other column that accepts it, otherwise
   *   2. the foundation that accepts it (single cards only), otherwise null.
   * A run that already starts at the bottom of its column never moves to an
   * empty column, since that would change nothing.
   */
  function clickTarget(state, from) {
    if (!from || (from.pile !== 'waste' && from.pile !== 'tableau')) return null;
    const cards = pickUp(state, from);
    if (!cards) return null;
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
    return state.foundations.every((pile) => pile.length === TOP_RANK);
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
    EMPTY_COLUMN_RANK,
    TOP_RANK,
    SUIT_SYMBOL,
    RANK_LABEL,
    makeDeck,
    shuffle,
    deal,
    newGame,
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
