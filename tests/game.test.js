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

test('deck has the A, 2 and 3 of clubs and diamonds', () => {
  assert.deepEqual(ids(G.makeDeck()).sort(), ['2C', '2D', '3C', '3D', 'AC', 'AD']);
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

test('with every stock and waste card showing, turning the stock changes nothing', () => {
  // SAMPLE's three stock cards are all on the waste fan after the deal.
  assert.equal(G.hasHiddenWaste(SAMPLE()), false);
  assert.equal(G.draw(SAMPLE()), null);
});

test('with the stock empty, one turn turns the waste back over and turns up the next cards', () => {
  // Waste (bottom to top): AS 2S 3S AD 2D; only 3S AD 2D show. Draw three.
  const s = blank({ draw: 3, waste: ['AS', '2S', '3S', 'AD', '2D'].map((id) => C(id)) });
  assert.equal(G.hasHiddenWaste(s), true);
  const next = G.draw(s);
  assert.deepEqual(ids(next.waste), ['AS', '2S', '3S'], 'the waste is turned over, then three come up in order');
  assert.ok(next.waste.every((c) => c.faceUp));
  assert.deepEqual(ids(next.stock), ['2D', 'AD']);
  assert.ok(next.stock.every((c) => !c.faceUp));
  // Unlimited passes: the next turn brings up the last two, then the cycle repeats.
  const after = G.draw(next);
  assert.deepEqual(ids(after.waste).slice(-2), ['AD', '2D']);
  assert.deepEqual(ids(G.draw(after).waste), ['AS', '2S', '3S']);
});

test('draw returns null when stock and waste are both empty', () => {
  assert.equal(G.draw(blank()), null);
});

test('the waste always fans its top three cards', () => {
  const waste = ['AS', '2S', '3S', 'AD', '2D'].map((id) => C(id));
  const s = blank({ tableau: [[C('3S')], []], waste, wasteFan: 3 });
  const played = G.move(s, WASTE, { pile: 'tableau', index: 0 }); // 2D onto 3S
  assert.equal(played.wasteFan, 3); // 2S slides into position 1
  assert.deepEqual(ids(played.waste.slice(-played.wasteFan)), ['2S', '3S', 'AD']);
  // Turning one card onto a waste of four still fans three.
  const one = G.draw(blank({ stock: [C('KS', false)], waste: waste.slice(0, 4), wasteFan: 3 }));
  assert.equal(one.wasteFan, 3);
  assert.deepEqual(ids(one.waste.slice(-3)), ['3S', 'AD', 'KS']);
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
  assert.ok(G.makeDeck(13, 2).some((c) => c.id === 'XC'));
  assert.ok(Object.values(G.RANK_LABEL).every((r) => r.length === 1)); // every card id is two characters
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
  assert.deepEqual(G.allowedColumns(2, 4), []);       // 4 columns need 10 cards; there are 8
  assert.deepEqual(G.allowedColumns(3, 4), [4]);
  assert.equal(G.minHighestFor(3, 2), 4);
  assert.equal(G.minHighestFor(4, 2), 6);
  assert.equal(G.minHighestFor(4, 4), 3);
  assert.deepEqual(G.allowedColumns(13, 2), [2, 3, 4, 5, 6]); // 7 columns needs 28 cards
  assert.deepEqual(G.allowedColumns(8, 4), [4, 5, 6, 7]);
  assert.deepEqual(G.allowedColumns(7, 4), [4, 5, 6]);
  assert.equal(G.minHighestFor(5, 2), 8);
  assert.equal(G.minHighestFor(6, 2), 11);
  assert.equal(G.minHighestFor(7, 2), 15); // more than K: needs 4 suits
  assert.equal(G.minHighestFor(7, 4), 8);
});

test('settings are cleaned up: bad values use defaults, too many columns drop to what fits', () => {
  assert.deepEqual(G.normalizeSettings({}), { highest: 3, columns: 2, suits: 2, draw: 3 });
  assert.deepEqual(G.normalizeSettings({ highest: 99, columns: 9, suits: 3 }), { highest: 3, columns: 2, suits: 2, draw: 3 });
  assert.deepEqual(G.normalizeSettings({ highest: 5, columns: 4, suits: 2 }), { highest: 5, columns: 3, suits: 2, draw: 3 });
  assert.deepEqual(G.normalizeSettings({ highest: '13', columns: '4', suits: '4' }), { highest: 13, columns: 4, suits: 4, draw: 3 });
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

test('staircase deal: 7 columns of 1-7 cards from a full deck', () => {
  const s = G.newGame(Math.random, { highest: 13, columns: 7, suits: 4 });
  assert.deepEqual(s.tableau.map((col) => col.length), [1, 2, 3, 4, 5, 6, 7]);
  for (const col of s.tableau) {
    assert.deepEqual(col.map((c) => c.faceUp), col.map((_, i) => i === col.length - 1));
  }
  assert.equal(s.waste.length, 3);
  assert.equal(s.stock.length, 52 - 28 - 3);
});

test('settings: 7 columns with 2 suits drops to the largest count that fits', () => {
  assert.deepEqual(G.normalizeSettings({ highest: 13, columns: 7, suits: 2 }), { highest: 13, columns: 6, suits: 2, draw: 3 });
  assert.deepEqual(G.normalizeSettings({ highest: 8, columns: 7, suits: 4 }), { highest: 8, columns: 7, suits: 4, draw: 3 });
});

/* ---------- draw count ---------- */

test('settings: draw is 1 to 4, default 3', () => {
  assert.equal(G.normalizeSettings({}).draw, 3);
  for (const d of [1, 2, 3, 4]) assert.equal(G.normalizeSettings({ draw: String(d) }).draw, d);
  assert.equal(G.normalizeSettings({ draw: 5 }).draw, 3);
  assert.equal(G.normalizeSettings({ draw: 0 }).draw, 3);
});

test('deal turns the draw count onto the waste and fans that many', () => {
  const deck = deckOf('AS', '3D', '2S', '3S', '2D', 'AD');
  for (const [draw, waste] of [[1, ['AD']], [2, ['AD', '2D']], [4, ['AD', '2D', '3S']]]) {
    const s = G.deal(deck, { draw });
    assert.equal(s.draw, draw);
    assert.deepEqual(ids(s.waste), waste); // draw 4 with 3 left in the stock turns all 3
    assert.equal(s.wasteFan, waste.length);
  }
});

test('draw 1 turns one card at a time and fans only the top card', () => {
  const s = G.deal(deckOf('AS', '3D', '2S', '3S', '2D', 'AD'), { draw: 1 });
  const t = G.draw(s);
  assert.deepEqual(ids(t.waste), ['AD', '2D']);
  assert.equal(t.wasteFan, 1);
  assert.deepEqual(ids(G.pickUp(t, WASTE)), ['2D']);
});

test('draw 4 fans four cards, and playing the top card slides the next one in', () => {
  const waste = ['AS', '2S', '3S', 'AD', '2D'].map((id) => C(id));
  const s = blank({ draw: 4, tableau: [[C('3S')], []], waste, wasteFan: 4 });
  const played = G.move(s, WASTE, { pile: 'tableau', index: 0 }); // 2D onto 3S
  assert.equal(played.wasteFan, 4);
  assert.deepEqual(ids(played.waste.slice(-4)), ['AS', '2S', '3S', 'AD']);
});

test('a prepared shuffle keeps its draw count through dealing, and old saves draw three', () => {
  const p = G.prepareDeal(Math.random, { highest: 13, columns: 7, suits: 4, draw: 2 });
  assert.equal(p.draw, 2);
  const d = G.dealPending(p);
  assert.equal(d.draw, 2);
  assert.equal(d.waste.length, 2);
  assert.equal(G.drawOf(blank()), 3);
});

/* ---------- at least one column per suit ---------- */

test('settings: at least as many columns as suits', () => {
  assert.equal(G.minColumnsFor(2), 2);
  assert.equal(G.minColumnsFor(4), 4);
  for (const suits of G.SUIT_CHOICES) {
    for (const highest of G.HIGHEST_CHOICES) {
      for (const c of G.allowedColumns(highest, suits)) assert.ok(c >= suits);
    }
  }
  // Too few columns for 4 suits rise to 4.
  assert.deepEqual(G.normalizeSettings({ highest: 13, columns: 2, suits: 4 }), { highest: 13, columns: 4, suits: 4, draw: 3 });
});

test('settings: 4 suits need a highest card of 3 or more', () => {
  assert.equal(G.minHighestForSuits(2), 2);
  assert.equal(G.minHighestForSuits(4), 3);
  assert.deepEqual(G.normalizeSettings({ highest: 2, columns: 2, suits: 4 }), { highest: 3, columns: 4, suits: 4, draw: 3 });
  assert.deepEqual(G.normalizeSettings({ highest: 2, columns: 2, suits: 2 }), { highest: 2, columns: 2, suits: 2, draw: 3 });
});

/* ---------- play notation ---------- */

// The user's mock-up game: highest 3, 2 suits, 2 columns, draw 3.
// Deck order deals a = 3D, b = AC (down) + AD, waste 2D 2C 3C (3C playable).
const MOCKUP = () => G.deal(deckOf('3D', 'AC', 'AD', '3C', '2C', '2D'), { columns: 2, draw: 3 });
const H = (index) => ({ pile: 'foundation', index });

test('notation: deal tokens follow the card-then-pile scheme', () => {
  const s = MOCKUP();
  assert.deepEqual(G.dealTokens(s).map((t) => G.tokenText(t)), ['2D2C3Cw', '3Da', 'ADb']);
});

test('notation: the mock-up game is recorded token for token', () => {
  let s = MOCKUP();
  const tokens = G.dealTokens(s);
  const play = (from, to) => {
    tokens.push(G.moveToken(s, from, to));
    s = G.move(s, from, to);
    assert.ok(s, 'move is legal');
  };
  play(T(1), H(0));     // A♦ to h, A♣ revealed in b
  play(T(1), H(1));     // A♣ to h, b empty
  play(WASTE, T(1));    // 3♣ to b, 2♣ playable
  play(WASTE, H(1));    // 2♣ to h, 2♦ playable
  play(WASTE, H(0));    // 2♦ to h, waste empty
  play(T(0), H(0));     // 3♦ to h, a empty
  play(T(1), H(1));     // 3♣ to h, b empty
  assert.ok(G.isWon(s));
  assert.equal(G.recordText(s, tokens), [
    'Setup: 3223',
    'Deal: 2D2C3Cw 3Da ADb',
    'Play: ADhACb ACh--b 3Cb2Cw 2Ch2Dw 2Dh--w 3Dh--a 3Ch--b',
  ].join('\n'));
});

test('notation: display text can use suit symbols', () => {
  const sym = (id) => id[0] + { C: '♣', D: '♦' }[id[1]];
  const t = { type: 'move', card: 'AD', to: 'h', top: 'AC', from: 'b' };
  assert.equal(G.tokenText(t, sym), 'A♦hA♣b');
});

test('notation: a run is named by its bottom card', () => {
  // a holds AC (down) under the run 2C AD; the run moves onto 3D in b and AC is revealed.
  const s = blank({ tableau: [[C('AC', false), C('2C'), C('AD')], [C('3D')]] });
  const t = G.moveToken(s, T(0, 1), T(1));
  assert.equal(G.tokenText(t), '2CbACa');
});

test('notation: a foundation card brought back down', () => {
  const s = blank({ tableau: [[C('3C')], []], foundations: [[C('AD'), C('2D')], []] });
  assert.equal(G.tokenText(G.moveToken(s, H(0), T(0))), '2DaADh');
});

test('notation: a turn names the cards turned up; its fan is every waste card showing', () => {
  const s = blank({ draw: 3, stock: [C('3C', false)], waste: [C('AD'), C('2D'), C('AC')] });
  const next = G.draw(s);
  const t = G.turnToken(s, next);
  assert.equal(G.tokenText(t), '3Cw');
  assert.deepEqual(t.fan, ['2D', 'AC', '3C']);
  // Stock now empty: the next turn turns the waste over and brings up AD 2D AC in one token.
  const again = G.draw(next);
  assert.equal(G.tokenText(G.turnToken(next, again)), 'AD2DACw');
  assert.deepEqual(G.turnToken(next, again).fan, ['AD', '2D', 'AC']);
});

test('notation: a move from the waste carries the fan left showing', () => {
  let s = MOCKUP();
  const t = G.moveToken(s, WASTE, T(1)); // not legal yet: b holds AD
  assert.equal(t, null);
  s = G.move(s, T(1), H(0));
  s = G.move(s, T(1), H(1)); // b empty
  const m = G.moveToken(s, WASTE, T(1));
  assert.equal(G.tokenText(m), '3Cb2Cw');
  assert.deepEqual(m.fan, ['2D', '2C']);
});

test('notation: the result token ends the Play line and counts move tokens only', () => {
  let s = MOCKUP();
  const tokens = G.dealTokens(s);
  for (const [from, to] of [[T(1), H(0)], [T(1), H(1)], [WASTE, T(1)], [WASTE, H(1)], [WASTE, H(0)], [T(0), H(0)], [T(1), H(1)]]) {
    tokens.push(G.moveToken(s, from, to));
    s = G.move(s, from, to);
  }
  tokens.push(G.resultToken(tokens, G.isWon(s)));
  assert.equal(G.tokenText(tokens[tokens.length - 1]), 'W7');
  assert.ok(G.recordText(s, tokens).endsWith('3Ch--b W7'));
  assert.equal(G.tokenText(G.resultToken(tokens.slice(0, 5), false)), 'L2');
});

test('automatic finish plays only straight to the foundations, one move per card', () => {
  // Every card face up in descending runs; stock and waste empty. 4 suits, highest 3.
  const run = (...idsList) => idsList.map((id) => C(id));
  let s = {
    highest: 3, draw: 3, stock: [], waste: [], wasteFan: 0,
    tableau: [run('3S', '2H', 'AC'), run('3H', '2S'), run('3C', '2D', 'AS'), run('3D', '2C', 'AH'), run('AD')],
    foundations: [[], [], [], []],
  };
  const remaining = 12;
  let moves = 0;
  while (G.canAutoFinish(s)) {
    const m = G.nextAutoFinishMove(s);
    assert.ok(m, 'never gets stuck');
    assert.equal(m.from.pile, 'tableau');
    assert.equal(m.to.pile, 'foundation');
    s = G.move(s, m.from, m.to);
    moves++;
  }
  assert.ok(G.isWon(s));
  assert.equal(moves, remaining);
});

test('notation: an illegal move has no token', () => {
  assert.equal(G.moveToken(MOCKUP(), T(0), T(1)), null);
});

test('notation: ten is X in card ids and the record header', () => {
  const s = G.newGame(() => 0.5, { highest: 10, suits: 4, columns: 7, draw: 3 });
  assert.equal(G.setupText(s), 'X473');
  assert.deepEqual(G.parseCard('XH'), { id: 'XH', rank: 10, suit: 'H' });
});
