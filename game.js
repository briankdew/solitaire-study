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

  // Suits in play, in the standard order ♠ ♥ ♣ ♦: two suits are spades and hearts, four add
  // clubs and diamonds (alternating colors). Foundations follow this order, one suit each, left to right.
  const SUITS_BY_COUNT = { 2: ['S', 'H'], 4: ['S', 'H', 'C', 'D'] };
  const SUIT_SYMBOL = { S: '♠︎', H: '♥︎', C: '♣︎', D: '♦︎' }; // text style, not emoji
  const SUIT_NAME = { S: 'spades', H: 'hearts', C: 'clubs', D: 'diamonds' };
  // Every rank is one character (X for ten), so each card is two: 'XC', 'AH'. This matches the play notation.
  const RANK_LABEL = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: 'X', 11: 'J', 12: 'Q', 13: 'K' };
  const RANK_NAME = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' };

  const DRAW_COUNT = 3; // default number of cards turned from the stock each time

  // Settings. An empty column accepts the highest card (a King in classic Klondike).
  const HIGHEST_CHOICES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const COLUMN_CHOICES = [2, 3, 4, 5, 6, 7];
  const SUIT_CHOICES = [2, 4];
  const DRAW_CHOICES = [1, 2, 3, 4];
  const DEFAULT_SETTINGS = { highest: 3, columns: 2, suits: 2, draw: DRAW_COUNT };

  /* ---------- settings ---------- */

  /** Cards dealt to the columns: 1 + 2 + ... + columns. */
  const staircaseSize = (columns) => (columns * (columns + 1)) / 2;

  /**
   * Fewest columns for a suit count: one per suit. The highest card can only
   * go to an empty column or a foundation, so with fewer columns than suits
   * some highest cards could never head a column, which changes the game.
   */
  const minColumnsFor = (suits) => suits;

  /** Column counts with at least one column per suit that still leave at least one card for the stock. */
  function allowedColumns(highest, suits = 2) {
    return COLUMN_CHOICES.filter((c) => c >= minColumnsFor(suits) && staircaseSize(c) < highest * suits);
  }

  /** Smallest highest card that allows any column count with this many suits (4 suits need 3). */
  function minHighestForSuits(suits) {
    return HIGHEST_CHOICES.find((h) => allowedColumns(h, suits).length);
  }

  /** Smallest highest card that allows this many columns (above 13 means it needs more suits). */
  function minHighestFor(columns, suits = 2) {
    return Math.floor(staircaseSize(columns) / suits) + 1;
  }

  /**
   * Clean up settings: unknown values fall back to the defaults, a highest
   * card too low for the suit count rises to the lowest that works, a column
   * count below one per suit rises to the suit count, and one that leaves no
   * stock drops to the largest one that fits.
   */
  function normalizeSettings(input = {}) {
    const pick = (value, choices, fallback) => (choices.includes(Number(value)) ? Number(value) : fallback);
    const suits = pick(input.suits, SUIT_CHOICES, DEFAULT_SETTINGS.suits);
    const highest = Math.max(pick(input.highest, HIGHEST_CHOICES, DEFAULT_SETTINGS.highest), minHighestForSuits(suits));
    const draw = pick(input.draw, DRAW_CHOICES, DEFAULT_SETTINGS.draw);
    const allowed = allowedColumns(highest, suits);
    let columns = pick(input.columns, COLUMN_CHOICES, DEFAULT_SETTINGS.columns);
    if (!allowed.includes(columns)) {
      columns = allowed.filter((c) => c <= columns).pop() || allowed[0];
    }
    return { highest, columns, suits, draw };
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
  /** Cards turned from the stock at a time (older saved games without it drew three). */
  const drawOf = (state) => state.draw || DRAW_COUNT;

  /* ---------- dealing ---------- */

  /**
   * Deal a deck (deck[0] is the top card) the standard Klondike way, in rows:
   * one card to each column left to right with only the first face up, then a
   * row starting at the second column (its first card face up), and so on, so
   * column 1 ends with 1 card, column 2 with 2, ... The rest stay in deck order
   * as the stock, face down, so the next card off the deck is the next one
   * turned. The first stock cards (as many as one turn takes) are then turned
   * onto the waste, so a card is playable right away. With 7 cards and 3 columns:
   *   deck[0] -> a (up); deck[1] -> b, deck[2] -> c; deck[3] -> b (up), deck[4] -> c;
   *   deck[5] -> c (up); deck[6] -> stock.
   */
  function deal(deck, options = {}) {
    const columns = options.columns || 2;
    const highest = Math.max(...deck.map((card) => card.rank));
    const suitSet = new Set(deck.map((card) => card.suit));
    const suitCount = suitSet.size;
    // Foundations take their suits from SUITS_BY_COUNT, so the deck must use exactly one of those sets.
    const suits = SUITS_BY_COUNT[suitCount];
    if (!suits || !suits.every((suit) => suitSet.has(suit))) {
      throw new Error(`A deck needs the suits ${Object.values(SUITS_BY_COUNT).map((s) => s.join('')).join(' or ')}`);
    }
    const c = deck.map((card) => ({ ...card, faceUp: false }));
    const tableau = Array.from({ length: columns }, () => []);
    let k = 0;
    for (let row = 0; row < columns; row++) {
      for (let i = row; i < columns; i++) tableau[i].push({ ...c[k++], faceUp: i === row });
    }
    return draw({
      highest,
      draw: options.draw || DRAW_COUNT,
      stock: c.slice(k).reverse(), // the stock's top is the end of the array: the next card off the deck
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
    return prepareDeck(shuffle(makeDeck(s.highest, s.suits), rng), s);
  }

  /**
   * Like prepareDeal, for a deck in a given order (deck[0] is the top card).
   * Throws unless the order holds exactly the cards of the settings' deck.
   */
  function prepareDeck(order, settings = DEFAULT_SETTINGS) {
    const s = normalizeSettings(settings);
    const wanted = makeDeck(s.highest, s.suits).map((card) => card.id).sort().join();
    if (order.map((card) => card.id).sort().join() !== wanted) throw new Error('The order is not the deck for these settings');
    const deck = order.map((card) => ({ ...card, faceUp: false }));
    return {
      highest: s.highest,
      draw: s.draw,
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
    return deal(state.deck, { columns: state.tableau.length, draw: drawOf(state) });
  }

  /* ---------- preset shuffles ---------- */

  /**
   * Shuffles to choose from, in lists by setup: the deck (highest card, suits)
   * and the columns to deal it to. Choosing one also sets those settings, with
   * Draw 3 (PRESET_DRAW). Each deal is the deck top card first, in the official
   * letters. The first list is the 4-card deck: one shuffle from each pair that
   * trading the two suits makes the same game (the one led by a spade).
   */
  const PRESET_DRAW = 3;
  const SHUFFLE_LISTS = [
    {
      highest: 2, suits: 2, columns: 2,
      deals: [
        'AS 2S AH 2H', 'AS 2S 2H AH', 'AS AH 2S 2H', 'AS AH 2H 2S', 'AS 2H 2S AH', 'AS 2H AH 2S',
        '2S AS AH 2H', '2S AS 2H AH', '2S AH AS 2H', '2S AH 2H AS', '2S 2H AS AH', '2S 2H AH AS',
      ],
    },
    {
      // 8-card deck (high card 4, 2 suits): deals added one at a time, as they come up in study.
      highest: 4, suits: 2, columns: 2,
      deals: [
        'AS 3H 4H 3S AH 2S 4S 2H', // reconstructed from a won game's record, 2026-11-10
      ],
    },
  ];
  const toDeck = (text) => text.split(' ').map((id) => ({ ...parseCard(id), faceUp: false }));

  /**
   * Every preset shuffle, in menu order: { n (its number in its list), settings, deck }.
   * The menu's value for one is its position here plus 1 (0 is Random).
   */
  function presetShuffles() {
    return SHUFFLE_LISTS.flatMap((list) => list.deals.map((text, i) => ({
      n: i + 1,
      settings: normalizeSettings({ highest: list.highest, suits: list.suits, columns: list.columns, draw: PRESET_DRAW }),
      deck: toDeck(text),
    })));
  }

  /**
   * A shuffle's menu value (its position in presetShuffles() plus 1), or 0 if it isn't a listed
   * deal under these exact settings (columns and draw included, since choosing it sets them).
   */
  function shuffleIndexOf(deck, settings) {
    const text = deck.map((card) => card.id).join(' ');
    const s = normalizeSettings(settings);
    const same = (p) => ['highest', 'suits', 'columns', 'draw'].every((k) => p.settings[k] === s[k]);
    return presetShuffles().findIndex((p) => same(p) && p.deck.map((card) => card.id).join(' ') === text) + 1;
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

  /** The suit a foundation builds: foundations follow the standard suit order left to right. */
  const foundationSuit = (state, f) => (SUITS_BY_COUNT[state.foundations.length] || [])[f];

  function canPlaceOnFoundation(state, cards, f) {
    if (!cards || cards.length !== 1) return false;
    const pile = state.foundations[f];
    if (!pile) return false;
    const card = cards[0];
    if (card.suit !== foundationSuit(state, f)) return false;
    const t = top(pile);
    return card.rank === (t ? t.rank + 1 : 1);
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
    if (from.pile === 'waste') s.wasteFan = fanSize(s);
    if (from.pile === 'tableau') {
      const t = top(src);
      if (t && !t.faceUp) t.faceUp = true; // expose and flip
    }
    return s;
  }

  /** The waste always fans as many top cards as one turn takes (fewer when it holds fewer). */
  function fanSize(state) {
    return Math.min(drawOf(state), state.waste.length);
  }

  /** True when some stock or waste cards can't be seen, so turning the stock would show something new. */
  function hasHiddenWaste(state) {
    return !state.pending && (state.stock.length > 0 || state.waste.length > fanSize(state));
  }

  /**
   * The stock and waste with the waste turned back over: every waste card
   * face down in the stock, in the order it will be turned up again. This is
   * the first half of a draw from an empty stock.
   */
  function recycle(state) {
    const s = clone(state);
    s.stock = s.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    s.waste = [];
    s.wasteFan = 0;
    return s;
  }

  /**
   * Turn the game's draw count of cards (or what's left) from the stock onto
   * the waste. With the stock empty, the stock and waste act as one pile:
   * the waste is turned back over and the next cards are turned up in the
   * same action (unlimited passes). Returns null when nothing would change,
   * because every remaining stock and waste card is already showing.
   */
  function draw(state) {
    if (!hasHiddenWaste(state)) return null;
    const s = state.stock.length ? clone(state) : recycle(state);
    const n = Math.min(drawOf(s), s.stock.length);
    for (let i = 0; i < n; i++) {
      const card = s.stock.pop();
      card.faceUp = true;
      s.waste.push(card);
    }
    s.wasteFan = fanSize(s);
    return s;
  }

  /** Foundation index that will take this card (its suit's foundation), or -1. */
  function foundationTargetFor(state, card) {
    if (!card) return -1;
    return state.foundations.findIndex((_, f) => canPlaceOnFoundation(state, [card], f));
  }

  /**
   * Where a click sends the playable waste card or a face-up column card
   * (with any cards on top of it). A foundation's top card goes to the
   * leftmost column that takes it, and nowhere else. Otherwise:
   *   1. the foundation that accepts it (single cards only), otherwise
   *   2. the leftmost other column that accepts it, otherwise null.
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
    if (cards.length === 1) {
      const f = foundationTargetFor(state, cards[0]);
      if (f >= 0) return { pile: 'foundation', index: f };
    }
    return columnClickTarget(state, from);
  }

  /**
   * The column a click would send the waste card or a face-up column card to
   * if no foundation took it: the leftmost other column that accepts it, or
   * null. A run that already starts at the bottom of its column never moves
   * to an empty column. Used for the click to a foundation and for taking
   * that click back to a column instead.
   */
  function columnClickTarget(state, from) {
    if (!from || !['waste', 'tableau'].includes(from.pile)) return null;
    const cards = pickUp(state, from);
    if (!cards) return null;
    const fromCol = from.pile === 'tableau' ? from.index : -1;
    const wholeColumn = fromCol >= 0 && (from.cardIndex == null ? state.tableau[fromCol].length === 1 : from.cardIndex === 0);
    for (let col = 0; col < state.tableau.length; col++) {
      if (col === fromCol) continue;
      if (wholeColumn && !state.tableau[col].length) continue;
      if (canPlaceOnTableau(state, cards, col)) return { pile: 'tableau', index: col };
    }
    return null;
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

  /* ---------- play notation ---------- */
  /*
   * Every item is a card followed by its pile letter: w waste, h foundations,
   * a, b, c… columns. A token is one of:
   *   turn  — cards brought up on the waste, left to right, playable last: 2D2C3Cw
   *   deal  — a column's face-up card after the deal: 3Da
   *   move  — card moved (the bottom card of a run) + destination, then the
   *           source's new top card + source; -- when the source is now empty:
   *           ADhACb, 2Dh--w
   *   result — W or L and the number of moves, at the end of a finished game: W104, L34
   * A judged move starts with its judgment: ?AHa--h (see judgeMove).
   * The deal is written as a turn token followed by one deal token per column.
   * A turn with the stock empty also turns the waste back over first; the
   * token names the cards turned up, as for any other turn.
   *
   * Turn tokens and moves from the waste also carry `fan`: every waste card
   * showing afterwards, left to right. The official text doesn't use it; the
   * app's record panel shows it.
   */
  const COLUMN_LETTERS = 'abcdefg';
  const RANK_OF = Object.fromEntries(Object.entries(RANK_LABEL).map(([rank, l]) => [l, Number(rank)]));

  /** Card fields from an id like 'TC'. */
  function parseCard(id) {
    return { id, rank: RANK_OF[id[0]], suit: id[1] };
  }

  function pileLetter(loc) {
    if (loc.pile === 'waste') return 'w';
    if (loc.pile === 'foundation') return 'h';
    return COLUMN_LETTERS[loc.index];
  }

  /**
   * Token for going from `prev` to `next` by turning cards onto the waste,
   * or null when nothing was turned up (the waste was turned back over).
   */
  function turnToken(prev, next) {
    if (!next) return null;
    // With the stock empty, the waste was turned back over before the new cards came up.
    const before = prev && prev.stock.length ? prev.waste.length : 0;
    const cards = next.waste.slice(before).map((c) => c.id);
    return cards.length ? { type: 'turn', cards, fan: fanIds(next) } : null;
  }

  /** Ids of the waste cards showing, left to right (the playable one last). */
  function fanIds(state) {
    return state.waste.slice(state.waste.length - fanSize(state)).map((c) => c.id);
  }

  /**
   * Tokens for a game just dealt, in the order a physical deal shows them: each column's face-up
   * card, then the waste's turned cards.
   */
  function dealTokens(state) {
    const tokens = [];
    state.tableau.forEach((col, i) => {
      if (col.length) tokens.push({ type: 'deal', card: top(col).id, to: COLUMN_LETTERS[i] });
    });
    if (state.waste.length) tokens.push({ type: 'turn', cards: state.waste.map((c) => c.id), fan: fanIds(state) });
    return tokens;
  }

  /**
   * How many tokens at the start of a record belong to the deal: the column tokens, then the
   * waste turn. (A deal always turns up waste cards, since every allowed setup leaves a stock.)
   */
  function dealLength(tokens) {
    let n = 0;
    while (n < tokens.length && tokens[n].type === 'deal') n++;
    return n && n < tokens.length && tokens[n].type === 'turn' ? n + 1 : n;
  }

  /** Records saved before the deal order changed start with the waste turn; put it after the columns. */
  function reorderOldDeal(tokens) {
    if (tokens.length < 2 || tokens[0].type !== 'turn' || tokens[1].type !== 'deal') return tokens;
    let n = 1;
    while (n < tokens.length && tokens[n].type === 'deal') n++;
    return [...tokens.slice(1, n), tokens[0], ...tokens.slice(n)];
  }

  /* ---------- judgments ---------- */
  /*
   * Moves are judged with the chess marks: ! good, !! brilliant, ? mistake, ?? blunder,
   * !? interesting, ?! dubious. A judgment is never stored: it is worked out from the move each
   * time, so changing these rules re-judges every game already recorded. The rules so far
   * (2026-11-08) mark two clearly regressive moves as mistakes, since winning in the fewest moves
   * means every foundation must fill:
   *   ?  an Ace played to a column (from the waste, a column or its foundation)
   *   ?  a 2 taken off its foundation
   */
  function judgeMove(card, fromPile, toPile) {
    const rank = typeof card === 'string' ? RANK_OF[card[0]] : card.rank;
    if (rank === 1 && toPile === 'tableau') return '?';
    if (rank === 2 && fromPile === 'foundation') return '?';
    return '';
  }

  const PILE_OF_LETTER = (letter) => (letter === 'w' ? 'waste' : letter === 'h' ? 'foundation' : 'tableau');

  /** The judgment of a move token ('?', or '' for none). */
  function judgeToken(token) {
    if (!token || token.type !== 'move') return '';
    return judgeMove(token.card, PILE_OF_LETTER(token.from), PILE_OF_LETTER(token.to));
  }

  /** Token for a legal move, worked out before it is made; null if the move is illegal. */
  function moveToken(state, from, to) {
    const next = move(state, from, to);
    if (!next) return null;
    const card = pickUp(state, from)[0];
    const src = sourcePile(next, from);
    const t = top(src);
    const token = { type: 'move', card: card.id, to: pileLetter(to), top: t ? t.id : null, from: pileLetter(from) };
    if (from.pile === 'waste') token.fan = fanIds(next);
    return token;
  }

  /** Moves in a record: every move token (the deal and stock turns don't count). */
  const movesIn = (tokens) => tokens.filter((t) => t.type === 'move').length;

  /** The result token that ends a finished game: W or L and the number of moves. */
  function resultToken(tokens, won) {
    return { type: 'result', won: !!won, moves: movesIn(tokens) };
  }

  /** A token as text. `cardText` turns a card id into text (the official form is the id itself: 'XC'). */
  function tokenText(token, cardText = (id) => id) {
    if (token.type === 'turn') return token.cards.map(cardText).join('') + 'w';
    if (token.type === 'deal') return cardText(token.card) + token.to;
    if (token.type === 'result') return (token.won ? 'W' : 'L') + token.moves;
    return judgeToken(token) + cardText(token.card) + token.to + (token.top ? cardText(token.top) : '--') + token.from;
  }

  /** Record header: highest card, suits, columns, draw (e.g. K473). */
  function setupText(state) {
    return RANK_LABEL[highestOf(state)] + state.foundations.length + state.tableau.length + drawOf(state);
  }

  /**
   * The official game record, written the way it is by hand:
   *   Setup: 3223
   *   Deal: 3Da ADb 2D2C3Cw
   *   Play: ADhACb ACh--b … W7
   * `tokens` starts with the deal's tokens (one per column, then the waste turn).
   */
  function recordText(state, tokens) {
    const split = dealLength(tokens);
    const line = (list) => list.map((t) => tokenText(t)).join(' ');
    return `Setup: ${setupText(state)}\nDeal: ${line(tokens.slice(0, split))}\nPlay: ${line(tokens.slice(split))}`;
  }

  /* ---------- replay and the game play diagram ---------- */

  /**
   * Every legal move in a position: the top waste card, every face-up column card (with the
   * cards on it) and every foundation's top card, to every column and foundation that takes it.
   * Nothing is left out, not even moves that change nothing or take a card back off a foundation.
   */
  function legalMoves(state) {
    const sources = [];
    if (state.waste.length) sources.push({ pile: 'waste' });
    state.tableau.forEach((col, index) => col.forEach((c, cardIndex) => {
      if (c.faceUp) sources.push({ pile: 'tableau', index, cardIndex });
    }));
    state.foundations.forEach((pile, index) => { if (pile.length) sources.push({ pile: 'foundation', index }); });
    const targets = [
      ...state.tableau.map((_, index) => ({ pile: 'tableau', index })),
      ...state.foundations.map((_, index) => ({ pile: 'foundation', index })),
    ];
    const out = [];
    for (const from of sources) for (const to of targets) if (isLegalMove(state, from, to)) out.push({ from, to });
    return out;
  }

  /** Where a move token's card is in `state` (the token names the card and its pile), or null. */
  function tokenSource(state, token) {
    if (token.from === 'w') {
      const t = top(state.waste);
      return t && t.id === token.card ? { pile: 'waste' } : null;
    }
    if (token.from === 'h') {
      const index = state.foundations.findIndex((p) => p.length && top(p).id === token.card);
      return index >= 0 ? { pile: 'foundation', index } : null;
    }
    const index = COLUMN_LETTERS.indexOf(token.from);
    const col = index >= 0 ? state.tableau[index] : null;
    const cardIndex = col ? col.findIndex((c) => c.id === token.card) : -1;
    return cardIndex >= 0 ? { pile: 'tableau', index, cardIndex } : null;
  }

  /** Where a move token's card went: its suit's foundation for h, otherwise the lettered column. */
  function tokenTarget(state, token) {
    if (token.to === 'h') {
      const index = (SUITS_BY_COUNT[state.foundations.length] || []).indexOf(token.card[1]);
      return index >= 0 ? { pile: 'foundation', index } : null;
    }
    const index = COLUMN_LETTERS.indexOf(token.to);
    return index >= 0 && index < state.tableau.length ? { pile: 'tableau', index } : null;
  }

  /**
   * Replay a game record from its dealt position: one step per action, the deal first.
   * Each step is { type: 'deal' | 'move' | 'draw', state } (the position after it), and a move
   * also has `from` and `to`. A result token ends the replay. Returns null when the record
   * doesn't fit the deal (a token that names the wrong card, or a move that isn't legal).
   */
  function replayRecord(dealt, tokens) {
    if (!dealt || dealt.pending || !Array.isArray(tokens)) return null;
    const split = dealLength(tokens);
    const dealText = (list) => list.map((t) => tokenText(t)).join(' ');
    if (dealText(dealTokens(dealt)) !== dealText(tokens.slice(0, split))) return null;
    let state = dealt;
    const steps = [{ type: 'deal', state }];
    for (const token of tokens.slice(split)) {
      if (token.type === 'result') break;
      if (token.type === 'turn') {
        const next = draw(state);
        const turned = turnToken(state, next);
        if (!turned || turned.cards.join() !== token.cards.join()) return null;
        steps.push({ type: 'draw', state: next });
        state = next;
        continue;
      }
      if (token.type !== 'move') return null;
      const from = tokenSource(state, token);
      const to = from && tokenTarget(state, token);
      const next = to && move(state, from, to);
      if (!next) return null;
      steps.push({ type: 'move', state: next, from, to });
      state = next;
    }
    return steps;
  }

  /**
   * The game play diagram for replayed steps: one row per pile (waste, columns a…, then each
   * foundation) and one snapshot per step. A snapshot holds what each pile shows (the waste's fan,
   * a column's or foundation's top card) and the links from the snapshot before it:
   *   play     — the move made (from row → to row)
   *   draw     — a turn of the stock (waste row → waste row)
   *   reveal   — the move turned over the face-down card under it
   *   promote  — the move uncovered a card that was already face up (or the next waste card)
   *   same     — a pile that didn't change (empty piles get no line)
   *   possible — every other legal move in the snapshot before (from row → to row), once per pair of rows
   * The deal's snapshot has no links. Rows and links name piles by row number. A judged move's
   * destination cell also has `mark` (its judgment, see judgeMove).
   */
  function diagramModel(steps) {
    const first = steps[0].state;
    const nCols = first.tableau.length;
    const suits = SUITS_BY_COUNT[first.foundations.length] || [];
    const rows = [
      { pile: 'waste', letter: 'w' },
      ...first.tableau.map((_, i) => ({ pile: 'tableau', letter: COLUMN_LETTERS[i] })),
      ...first.foundations.map((_, i) => ({ pile: 'foundation', letter: 'h', suit: suits[i] })),
    ];
    const rowOf = (loc) => (loc.pile === 'waste' ? 0 : loc.pile === 'tableau' ? 1 + loc.index : 1 + nCols + loc.index);
    const pileAt = (state, r) => (r === 0 ? state.waste : r <= nCols ? state.tableau[r - 1] : state.foundations[r - 1 - nCols]);
    const pileKey = (pile) => pile.map((c) => c.id + (c.faceUp ? '' : '*')).join(' ');
    const cellOf = (state, r) => {
      if (r === 0) return { cards: fanIds(state) };
      const t = top(pileAt(state, r));
      return { cards: t && t.faceUp ? [t.id] : [] };
    };
    let moves = 0;
    const snaps = steps.map((step, k) => {
      const cells = rows.map((_, r) => cellOf(step.state, r));
      if (step.type === 'deal') return { type: 'deal', label: null, cells, links: [] };
      const prev = steps[k - 1].state;
      const links = [];
      let fromRow = 0, toRow = 0;
      if (step.type === 'move') {
        fromRow = rowOf(step.from);
        toRow = rowOf(step.to);
      }
      // Every legal move in the snapshot before, except the one made.
      const seen = new Set(step.type === 'move' ? [fromRow + '>' + toRow] : []);
      for (const m of legalMoves(prev)) {
        const pair = rowOf(m.from) + '>' + rowOf(m.to);
        if (seen.has(pair)) continue;
        seen.add(pair);
        links.push({ type: 'possible', from: rowOf(m.from), to: rowOf(m.to) });
      }
      rows.forEach((_, r) => {
        const before = pileAt(prev, r), after = pileAt(step.state, r);
        if (step.type === 'move' && (r === fromRow || r === toRow)) {
          if (r === fromRow && after.length) {
            // The card now on top was face down before the move: a reveal; otherwise it was already known.
            const wasDown = r !== 0 && !before[after.length - 1].faceUp;
            links.push({ type: wasDown ? 'reveal' : 'promote', from: r, to: r });
          }
          return;
        }
        if (step.type === 'draw' && r === 0) return;
        if (after.length && pileKey(before) === pileKey(after)) links.push({ type: 'same', from: r, to: r });
      });
      if (step.type === 'draw') {
        links.push({ type: 'draw', from: 0, to: 0 });
        return { type: 'draw', label: 'Draw', cells, links };
      }
      links.push({ type: 'play', from: fromRow, to: toRow });
      // A judged move shows its judgment beside the card, where it landed.
      const mark = judgeMove(pickUp(prev, step.from)[0], step.from.pile, step.to.pile);
      if (mark) cells[toRow] = { ...cells[toRow], mark };
      moves++;
      return { type: 'move', label: String(moves), cells, links };
    });
    return { rows, snaps };
  }

  return {
    DRAW_COUNT,
    HIGHEST_CHOICES,
    COLUMN_CHOICES,
    SUIT_CHOICES,
    DRAW_CHOICES,
    DEFAULT_SETTINGS,
    SUIT_SYMBOL,
    SUIT_NAME,
    SUITS_BY_COUNT,
    RANK_LABEL,
    staircaseSize,
    allowedColumns,
    minColumnsFor,
    minHighestFor,
    minHighestForSuits,
    normalizeSettings,
    highestOf,
    drawOf,
    makeDeck,
    shuffle,
    deal,
    newGame,
    prepareDeal,
    prepareDeck,
    dealPending,
    SHUFFLE_LISTS,
    PRESET_DRAW,
    presetShuffles,
    shuffleIndexOf,
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
    recycle,
    foundationTargetFor,
    foundationSuit,
    clickTarget,
    columnClickTarget,
    wasteClickTarget,
    foundationMoveFor,
    isWon,
    canAutoFinish,
    nextAutoFinishMove,
    locate,
    COLUMN_LETTERS,
    parseCard,
    hasHiddenWaste,
    fanIds,
    turnToken,
    dealTokens,
    dealLength,
    reorderOldDeal,
    movesIn,
    resultToken,
    moveToken,
    tokenText,
    setupText,
    recordText,
    judgeMove,
    judgeToken,
    legalMoves,
    replayRecord,
    diagramModel,
  };
});
