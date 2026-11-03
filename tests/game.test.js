// Run with: npm test   (or: node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');

// Build a card from an id like '2S' or 'AD'.
function C(id, faceUp = true) {
  const rank = id[0] === 'A' ? 1 : Number(id[0]);
  return { id, rank, suit: id[1], faceUp };
}
function deckOf(...ids) {
  return ids.map((id) => C(id, false));
}
function blank(overrides = {}) {
  return { stock: [], waste: [], wasteFan: 0, tableau: [[], []], foundations: [[], []], ...overrides };
}
const ids = (pile) => pile.map((c) => c.id);
const T = (index, cardIndex) => ({ pile: 'tableau', index, cardIndex });
const WASTE = { pile: 'waste' };

// Deck order used by several tests: col 1 = A♠, col 2 = 3♦ (down) + 2♠, stock = 3♠ 2♦ A♦.
const SAMPLE = () => G.deal(deckOf('AS', '3D', '2S', '3S', '2D', 'AD'));

/* ---------- deck and deal ---------- */

test('deck has the A, 2 and 3 of spades and diamonds', () => {
  assert.deepEqual(ids(G.makeDeck()).sort(), ['2D', '2S', '3D', '3S', 'AD', 'AS']);
});

test('deal: two columns, and the first three cards are already turned onto the waste', () => {
  const s = SAMPLE();
  assert.deepEqual(ids(s.tableau[0]), ['AS']);
  assert.equal(s.tableau[0][0].faceUp, true);
  assert.deepEqual(ids(s.tableau[1]), ['3D', '2S']);
  assert.deepEqual(s.tableau[1].map((c) => c.faceUp), [false, true]);
  assert.equal(s.stock.length, 0);
  assert.deepEqual(ids(s.waste), ['AD', '2D', '3S']);
  assert.ok(s.waste.every((c) => c.faceUp));
  assert.equal(s.wasteFan, 3);
  assert.deepEqual(ids(G.pickUp(s, WASTE)), ['3S']); // playable straight away
});

test('newGame uses every card exactly once', () => {
  const s = G.newGame();
  const all = [...s.stock, ...s.waste, ...s.tableau.flat()];
  assert.equal(new Set(ids(all)).size, 6);
});

/* ---------- stock and waste ---------- */

test('draw turns three cards; the last one turned is playable', () => {
  const s = G.draw(blank({ stock: [C('3S', false), C('2D', false), C('AD', false)] }));
  assert.equal(s.stock.length, 0);
  assert.deepEqual(ids(s.waste), ['AD', '2D', '3S']);
  assert.equal(s.wasteFan, 3);
  assert.ok(s.waste.every((c) => c.faceUp));
});

test('drawing from an empty stock turns the waste back over in its original order', () => {
  const recycled = G.draw(SAMPLE());
  assert.deepEqual(ids(recycled.stock), ['3S', '2D', 'AD']);
  assert.ok(recycled.stock.every((c) => !c.faceUp));
  assert.equal(recycled.waste.length, 0);
  // Unlimited passes: the same three come up again.
  assert.deepEqual(ids(G.draw(recycled).waste), ['AD', '2D', '3S']);
});

test('draw returns null when stock and waste are both empty', () => {
  assert.equal(G.draw(blank()), null);
});

test('playing from the fan reveals the next fanned card', () => {
  const a = G.move(SAMPLE(), T(0), { pile: 'foundation', index: 0 });
  const b = G.move(a, WASTE, G.wasteClickTarget(a)); // 3♠ -> empty column 1
  assert.equal(b.wasteFan, 2);
  assert.deepEqual(ids(G.pickUp(b, WASTE)), ['2D']);
});

/* ---------- placement rules ---------- */

test('an empty column accepts only a 3, or a run starting with a 3', () => {
  const s = blank();
  assert.equal(G.canPlaceOnTableau(s, [C('3S')], 0), true);
  assert.equal(G.canPlaceOnTableau(s, [C('3D'), C('2S'), C('AD')], 0), true);
  assert.equal(G.canPlaceOnTableau(s, [C('2S')], 0), false);
  assert.equal(G.canPlaceOnTableau(s, [C('AD')], 0), false);
});

test('columns build down in alternating colors', () => {
  const s = blank({ tableau: [[C('3S')], [C('3D')]] });
  assert.equal(G.canPlaceOnTableau(s, [C('2D')], 0), true);  // red on black
  assert.equal(G.canPlaceOnTableau(s, [C('2S')], 1), true);  // black on red
  assert.equal(G.canPlaceOnTableau(s, [C('2S')], 0), false); // same color
  assert.equal(G.canPlaceOnTableau(s, [C('AD')], 0), false); // wrong rank
});

test('foundations start with an Ace and build up by suit', () => {
  const s = blank({ foundations: [[C('AS')], []] });
  assert.equal(G.canPlaceOnFoundation(s, [C('2S')], 0), true);
  assert.equal(G.canPlaceOnFoundation(s, [C('2D')], 0), false);
  assert.equal(G.canPlaceOnFoundation(s, [C('AD')], 1), true);
  assert.equal(G.canPlaceOnFoundation(s, [C('2D')], 1), false);
  assert.equal(G.canPlaceOnFoundation(s, [C('3D'), C('2S')], 1), false); // one card at a time
});

test('a card can move from a foundation back to a column', () => {
  const s = blank({ tableau: [[C('3D')], []], foundations: [[C('AS'), C('2S')], []] });
  const next = G.move(s, { pile: 'foundation', index: 0 }, T(0));
  assert.deepEqual(ids(next.tableau[0]), ['3D', '2S']);
  assert.deepEqual(ids(next.foundations[0]), ['AS']);
});

test('moving a run carries every card above the one picked up', () => {
  const blocked = blank({ tableau: [[C('3S'), C('2D'), C('AS')], [C('2S', false)]] });
  assert.equal(G.move(blocked, T(0, 0), T(1)), null); // column 2's top is face down
  const s = blank({ tableau: [[C('3S'), C('2D'), C('AS')], []] });
  const moved = G.move(s, T(0, 0), T(1));
  assert.deepEqual(ids(moved.tableau[1]), ['3S', '2D', 'AS']);
  assert.equal(moved.tableau[0].length, 0);
});

test('exposing a face-down card flips it face up', () => {
  const a = G.move(SAMPLE(), T(0), { pile: 'foundation', index: 0 });
  const b = G.move(a, T(1), { pile: 'foundation', index: 0 });
  assert.deepEqual(ids(b.tableau[1]), ['3D']);
  assert.equal(b.tableau[1][0].faceUp, true);
});

test('moves do not mutate the previous state (undo relies on this)', () => {
  const s = SAMPLE();
  const before = JSON.stringify(s);
  G.move(s, T(0), { pile: 'foundation', index: 0 });
  G.draw(s);
  assert.equal(JSON.stringify(s), before);
});

/* ---------- click rules: waste card ---------- */

test('waste click: plays on the leftmost column that accepts the card', () => {
  // Both columns show a red 3, so both can take the 2♠.
  const s = blank({ tableau: [[C('3D')], [C('3D')]], waste: [C('2S')], wasteFan: 1 });
  assert.deepEqual(G.wasteClickTarget(s), { pile: 'tableau', index: 0 });
  const onlyRight = blank({ tableau: [[C('3S')], [C('3D')]], waste: [C('2S')], wasteFan: 1 });
  assert.deepEqual(G.wasteClickTarget(onlyRight), { pile: 'tableau', index: 1 });
});

test('waste click: a column wins over a foundation', () => {
  const s = blank({
    tableau: [[C('AD', false)], [C('3D')]],
    foundations: [[C('AS')], []],
    waste: [C('2S')],
    wasteFan: 1,
  });
  assert.deepEqual(G.wasteClickTarget(s), { pile: 'tableau', index: 1 });
});

test('waste click: goes to the foundation when no column takes it', () => {
  const s = blank({
    tableau: [[C('3S')], [C('2D', false)]],
    foundations: [[], [C('AS')]],
    waste: [C('2S')],
    wasteFan: 1,
  });
  assert.deepEqual(G.wasteClickTarget(s), { pile: 'foundation', index: 1 });
  const ace = blank({ tableau: [[C('3S')], [C('3D')]], waste: [C('AD')], wasteFan: 1 });
  assert.deepEqual(G.wasteClickTarget(ace), { pile: 'foundation', index: 0 });
});

test('waste click: a 3 goes to an empty column before a foundation', () => {
  const s = blank({
    tableau: [[C('2D', false)], []],
    foundations: [[C('AS'), C('2S')], []],
    waste: [C('3S')],
    wasteFan: 1,
  });
  assert.deepEqual(G.wasteClickTarget(s), { pile: 'tableau', index: 1 });
});

test('waste click: null when nothing can take the card', () => {
  const s = blank({ tableau: [[C('3S')], [C('AD')]], waste: [C('2S')], wasteFan: 1 });
  assert.equal(G.wasteClickTarget(s), null);
});

/* ---------- click rules: column cards ---------- */

test('column click: the top card goes to the other column before a foundation', () => {
  const s = blank({ tableau: [[C('3D')], [C('3S', false), C('2S')]], foundations: [[C('AS')], []] });
  assert.deepEqual(G.clickTarget(s, T(1, 1)), { pile: 'tableau', index: 0 });
});

test('column click: the top card goes to its foundation when no column takes it', () => {
  const s = blank({ tableau: [[C('3S')], [C('3D', false), C('2S')]], foundations: [[C('AS')], []] });
  assert.deepEqual(G.clickTarget(s, T(1, 1)), { pile: 'foundation', index: 0 });
});

test('column click: a card with cards on top of it moves as a group', () => {
  const s = blank({ tableau: [[C('AS', false), C('3D'), C('2S'), C('AD')], []] });
  const to = G.clickTarget(s, T(0, 1)); // click the 3♦ under 2♠ and A♦
  assert.deepEqual(to, { pile: 'tableau', index: 1 });
  const next = G.move(s, T(0, 1), to);
  assert.deepEqual(ids(next.tableau[1]), ['3D', '2S', 'AD']);
  assert.deepEqual(ids(next.tableau[0]), ['AS']);
  assert.equal(next.tableau[0][0].faceUp, true);
});

test('column click: a group never goes to a foundation', () => {
  const s = blank({ tableau: [[C('3S'), C('2D'), C('AS')], [C('2S', false)]], foundations: [[], [C('AD')]] });
  assert.equal(G.clickTarget(s, T(0, 1)), null); // 2♦ + A♠ can't stack on a foundation
});

test('column click: a whole column is not shuffled into an empty column', () => {
  const s = blank({ tableau: [[C('3S')], []], foundations: [[C('AS'), C('2S')], []] });
  assert.deepEqual(G.clickTarget(s, T(0, 0)), { pile: 'foundation', index: 0 });
  const stuck = blank({ tableau: [[C('3S'), C('2D')], []] });
  assert.equal(G.clickTarget(stuck, T(0, 0)), null);
});

test('column click: a 3 under a face-down card can move to an empty column', () => {
  const s = blank({ tableau: [[C('AD', false), C('3S'), C('2D')], []] });
  assert.deepEqual(G.clickTarget(s, T(0, 1)), { pile: 'tableau', index: 1 });
});

test('ace click: a waste Ace goes to a foundation even when a column could take it', () => {
  const s = blank({ tableau: [[C('2S')], [C('3D')]], waste: [C('AD')], wasteFan: 1 });
  assert.deepEqual(G.wasteClickTarget(s), { pile: 'foundation', index: 0 });
});

test('ace click: a column Ace goes to a foundation even when the other column could take it', () => {
  const s = blank({ tableau: [[C('2D')], [C('3S', false), C('AS')]], foundations: [[C('AD')], []] });
  assert.deepEqual(G.clickTarget(s, T(1, 1)), { pile: 'foundation', index: 1 });
  const next = G.move(s, T(1, 1), G.clickTarget(s, T(1, 1)));
  assert.deepEqual(ids(next.foundations[1]), ['AS']);
  assert.equal(next.tableau[1][0].faceUp, true);
});

test('clicking a stock card has no target', () => {
  const s = blank({ stock: [C('2D', false)] });
  assert.equal(G.clickTarget(s, { pile: 'stock', index: 0 }), null);
});

/* ---------- click rules: foundation cards ---------- */

const F = (index) => ({ pile: 'foundation', index });

test('foundation click: the top card goes to the leftmost column that takes it', () => {
  // Both columns show a red 3, so both can take the 2♠.
  const s = blank({ tableau: [[C('3D')], [C('3D')]], foundations: [[C('AS'), C('2S')], []] });
  assert.deepEqual(G.clickTarget(s, F(0)), { pile: 'tableau', index: 0 });
  const onlyRight = blank({ tableau: [[C('3S')], [C('3D')]], foundations: [[C('AS'), C('2S')], []] });
  assert.deepEqual(G.clickTarget(onlyRight, F(0)), { pile: 'tableau', index: 1 });
  const next = G.move(onlyRight, F(0), G.clickTarget(onlyRight, F(0)));
  assert.deepEqual(ids(next.tableau[1]), ['3D', '2S']);
  assert.deepEqual(ids(next.foundations[0]), ['AS']);
});

test('foundation click: an Ace can come down onto a 2, but never hops to another foundation', () => {
  const s = blank({ tableau: [[C('2S')], []], foundations: [[C('AD')], []] });
  assert.deepEqual(G.clickTarget(s, F(0)), { pile: 'tableau', index: 0 });
  const noColumn = blank({ tableau: [[C('2D')], []], foundations: [[C('AD')], []] });
  assert.equal(G.clickTarget(noColumn, F(0)), null);
});

test('foundation click: the highest card can go to an empty column', () => {
  const s = blank({ tableau: [[C('AD', false)], []], foundations: [[C('AS'), C('2S'), C('3S')], []] });
  assert.deepEqual(G.clickTarget(s, F(0)), { pile: 'tableau', index: 1 });
});

test('foundation click: null when no column takes the card, or the foundation is empty', () => {
  const s = blank({ tableau: [[C('3S')], [C('AD')]], foundations: [[C('AS'), C('2S')], []] });
  assert.equal(G.clickTarget(s, F(0)), null);
  assert.equal(G.clickTarget(s, F(1)), null);
});

/* ---------- full game ---------- */

test('a scripted deal plays through to a win, with an automatic finish at the end', () => {
  let s = SAMPLE();
  s = G.move(s, T(0), { pile: 'foundation', index: 0 });              // A♠ up
  s = G.move(s, T(1), G.clickTarget(s, T(1, 1)));                     // 2♠ clicked -> foundation, 3♦ flips
  assert.deepEqual(ids(s.foundations[0]), ['AS', '2S']);
  s = G.move(s, WASTE, G.wasteClickTarget(s));                        // 3♠ -> empty col 1
  assert.deepEqual(ids(s.tableau[0]), ['3S']);
  s = G.move(s, WASTE, G.wasteClickTarget(s));                        // 2♦ -> on 3♠
  assert.deepEqual(ids(s.tableau[0]), ['3S', '2D']);
  s = G.move(s, WASTE, G.wasteClickTarget(s));                        // A♦ -> foundation
  assert.deepEqual(ids(s.foundations[1]), ['AD']);
  assert.equal(G.canAutoFinish(s), true);
  let guard = 0;
  while (!G.isWon(s) && guard++ < 10) {
    const m = G.nextAutoFinishMove(s);
    assert.ok(m, 'auto-finish should always find a move');
    s = G.move(s, m.from, m.to);
  }
  assert.equal(G.isWon(s), true);
  assert.equal(G.canAutoFinish(s), false);
});

test('illegal moves return null', () => {
  const s = SAMPLE();
  assert.equal(G.move(s, T(1, 0), { pile: 'foundation', index: 0 }), null); // face-down card
  assert.equal(G.move(s, T(0), T(0)), null);                              // same pile
  assert.equal(G.move(s, WASTE, { pile: 'foundation', index: 0 }), null); // 3♠ onto an empty foundation
  assert.equal(G.move(blank(), WASTE, T(0)), null);                       // empty waste
});

/* ---------- settings: highest card, columns, suits ---------- */

test('deck size follows the highest card and the number of suits', () => {
  assert.equal(G.makeDeck(13, 2).length, 26);
  assert.equal(G.makeDeck(13, 4).length, 52);
  assert.equal(G.makeDeck(2, 2).length, 4);
  assert.deepEqual(ids(G.makeDeck(2, 4)), ['AS', '2S', 'AH', '2H', 'AC', '2C', 'AD', '2D']);
  assert.ok(G.makeDeck(13, 2).some((c) => c.id === '10S'));
});

test('hearts are red and clubs are black', () => {
  assert.equal(G.isRed(C('2H')), true);
  assert.equal(G.isRed(C('2C')), false);
  const s = blank({ tableau: [[C('3C')], [C('3H')]] });
  assert.equal(G.canPlaceOnTableau(s, [C('2H')], 0), true);
  assert.equal(G.canPlaceOnTableau(s, [C('2D')], 1), false);
});

test('staircase deal: 4 columns of 1-4 cards, one face up on each, and three turned to the waste', () => {
  const s = G.newGame(Math.random, { highest: 13, columns: 4, suits: 2 });
  assert.deepEqual(s.tableau.map((col) => col.length), [1, 2, 3, 4]);
  for (const col of s.tableau) {
    assert.deepEqual(col.map((c) => c.faceUp), col.map((_, i) => i === col.length - 1));
  }
  assert.equal(s.waste.length, 3);
  assert.equal(s.stock.length, 26 - 10 - 3);
  assert.equal(s.foundations.length, 2);
  assert.equal(s.highest, 13);
});

test('four suits give four foundations', () => {
  const s = G.newGame(Math.random, { highest: 5, columns: 3, suits: 4 });
  assert.equal(s.foundations.length, 4);
  assert.equal(s.stock.length + s.waste.length + s.tableau.flat().length, 20);
});

test('an empty column accepts the highest card, whatever it is', () => {
  const kings = blank({ highest: 13 });
  assert.equal(G.canPlaceOnTableau(kings, [C('3S')], 0), false);
  assert.equal(G.canPlaceOnTableau(kings, [{ id: 'KS', rank: 13, suit: 'S', faceUp: true }], 0), true);
  const twos = blank({ highest: 2 });
  assert.equal(G.canPlaceOnTableau(twos, [C('2D'), C('AS')], 0), true);
});

test('a foundation is complete at the highest card', () => {
  const s = blank({ highest: 2, foundations: [[C('AS'), C('2S')], [C('AD'), C('2D')]] });
  assert.equal(G.isWon(s), true);
  assert.equal(G.isWon({ ...s, highest: 3 }), false);
});

test('column counts that would leave no stock are not allowed', () => {
  assert.deepEqual(G.allowedColumns(2, 2), [2]);
  assert.deepEqual(G.allowedColumns(3, 2), [2]);       // 3 columns would use all 6 cards
  assert.deepEqual(G.allowedColumns(4, 2), [2, 3]);
  assert.deepEqual(G.allowedColumns(6, 2), [2, 3, 4]);
  assert.deepEqual(G.allowedColumns(2, 4), [2, 3]);
  assert.deepEqual(G.allowedColumns(3, 4), [2, 3, 4]);
  assert.equal(G.minHighestFor(3, 2), 4);
  assert.equal(G.minHighestFor(4, 2), 6);
  assert.equal(G.minHighestFor(4, 4), 3);
});

test('settings are cleaned up: bad values use defaults, too many columns drop to what fits', () => {
  assert.deepEqual(G.normalizeSettings({}), { highest: 3, columns: 2, suits: 2 });
  assert.deepEqual(G.normalizeSettings({ highest: 99, columns: 9, suits: 3 }), { highest: 3, columns: 2, suits: 2 });
  assert.deepEqual(G.normalizeSettings({ highest: 5, columns: 4, suits: 2 }), { highest: 5, columns: 3, suits: 2 });
  assert.deepEqual(G.normalizeSettings({ highest: '13', columns: '4', suits: '4' }), { highest: 13, columns: 4, suits: 4 });
});

test('every allowed setting deals a full, consistent game', () => {
  for (const suits of G.SUIT_CHOICES) {
    for (const highest of G.HIGHEST_CHOICES) {
      for (const columns of G.allowedColumns(highest, suits)) {
        const s = G.newGame(Math.random, { highest, columns, suits });
        const all = [...s.stock, ...s.waste, ...s.tableau.flat()];
        assert.equal(new Set(ids(all)).size, highest * suits, `${highest}/${columns}/${suits}`);
        assert.equal(s.tableau.length, columns);
        assert.ok(s.waste.length >= 1, 'a waste card is playable at the start');
      }
    }
  }
});

test('auto-finish always completes a big all-face-up game', () => {
  // Kings, two suits: each column holds an alternating run; nothing hidden.
  const run = (suits) => suits.map((suit, i) => ({ id: `${13 - i}${suit}`, rank: 13 - i, suit, faceUp: true }));
  const alt = (a, b) => Array.from({ length: 13 }, (_, i) => (i % 2 ? b : a));
  let s = blank({ highest: 13, tableau: [run(alt('S', 'D')), run(alt('D', 'S'))] });
  assert.equal(G.canAutoFinish(s), true);
  let guard = 0;
  while (!G.isWon(s) && guard++ < 100) {
    const m = G.nextAutoFinishMove(s);
    assert.ok(m);
    s = G.move(s, m.from, m.to);
  }
  assert.equal(G.isWon(s), true);
});

/* ---------- waiting to deal ---------- */

test('prepareDeal: the whole shuffled deck waits face down in the stock', () => {
  const s = G.prepareDeal(Math.random, { highest: 7, columns: 3, suits: 2 });
  assert.equal(s.pending, true);
  assert.equal(s.stock.length, 14);
  assert.ok(s.stock.every((c) => !c.faceUp));
  assert.deepEqual(s.tableau, [[], [], []]);
  assert.deepEqual(s.foundations, [[], []]);
  assert.equal(s.waste.length, 0);
  assert.equal(G.draw(s), null, 'the stock cannot be turned before the deal');
  assert.equal(G.isWon(s), false);
  assert.equal(G.canAutoFinish(s), false);
});

test('dealPending deals exactly the prepared shuffle', () => {
  const s = G.prepareDeal(Math.random, { highest: 7, columns: 3, suits: 2 });
  const dealt = G.dealPending(s);
  assert.equal(dealt.pending, undefined);
  assert.deepEqual(dealt, G.deal(s.deck, { columns: 3 }));
  assert.deepEqual(dealt.tableau.map((col) => col.length), [1, 2, 3]);
  assert.equal(dealt.waste.length, 3);
  assert.equal(G.dealPending(dealt), null);
});
