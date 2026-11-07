// The card table: piles, card faces, layout and drawing the game.
import { G, PIPS, S, Z, rankLabel, top } from './shared.js';
import { board, endGameBtn, newBtn, quitGameBtn, restartBtn, tableWrap, undoBtn } from './dom.js';
import { layoutRecord, placeUndo } from './layout.js';
import { renderRecord } from './record.js';
import { inPlay } from './actions.js';

/* ---------- table pieces (rebuilt when the deck or column count changes) ---------- */

export const slots = { tab: [], found: [] };
function makeSlot(cls, html, tag = 'div') {
  const el = document.createElement(tag);
  el.className = 'slot ' + cls;
  el.innerHTML = html;
  board.appendChild(el);
  return el;
}
slots.stock = makeSlot('stock',
  '<svg class="recycle" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19.6 3.8v4.6H15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'button');
slots.stock.type = 'button';
// Dashed outlines for the waste's fan positions, one per card drawn (built in buildTable).
slots.wasteFan = [];

function makeLabel(text) {
  const el = document.createElement('div');
  el.className = 'pile-label';
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  board.appendChild(el);
  return el;
}
const labels = { stock: makeLabel('s'), waste: makeLabel('w'), found: makeLabel('h'), tab: [] };
const COLUMN_LETTERS = G.COLUMN_LETTERS;

// Shown on the last waste position while a shuffled deck waits to be dealt.
export const dealBtn = document.createElement('button');
dealBtn.type = 'button';
dealBtn.className = 'btn solid deal-btn';
dealBtn.textContent = 'Deal';
dealBtn.hidden = true;
board.appendChild(dealBtn);

let builtKey = '';
export const cardEls = new Map();
export const basePos = new Map();
const lastWhere = new Map();

function faceHTML(c) {
  return frontHTML(c) + '<div class="back" aria-hidden="true"></div>';
}
function frontHTML(c) {
  const sym = G.SUIT_SYMBOL[c.suit];
  const rank = rankLabel(c.rank);
  const center = c.rank > 10
    ? `<span class="court">${rank}<span>${sym}</span></span>`
    : `<span class="pips n${c.rank}">` +
      PIPS[c.rank].map(([x, y]) => `<span class="pip${y > 50 ? ' flip' : ''}" style="left:${x}%;top:${y}%">${sym}</span>`).join('') +
      '</span>';
  return `<div class="face ${G.isRed(c) ? 'red' : 'black'}" aria-hidden="true">` +
    `<span class="idx">${rank}<span>${sym}</span></span>${center}` +
    `<span class="idx br">${rank}<span>${sym}</span></span>` +
    `</div>`;
}

/** Make sure the card elements and pile outlines match the current game. */
function buildTable() {
  const highest = G.highestOf(S.state);
  const key = `${highest}/${S.state.foundations.length}/${S.state.tableau.length}/${G.drawOf(S.state)}`;
  if (key === builtKey) return;
  builtKey = key;

  for (const el of cardEls.values()) el.remove();
  cardEls.clear(); basePos.clear(); lastWhere.clear();
  [...slots.wasteFan, ...slots.tab, ...slots.found, ...labels.tab].forEach((el) => el.remove());

  slots.wasteFan = Array.from({ length: G.drawOf(S.state) }, () => makeSlot('waste', ''));
  // Each foundation builds one suit, in the standard order ♠ ♥ ♣ ♦ (G.foundationSuit).
  slots.found = S.state.foundations.map((_, i) => {
    const suit = G.foundationSuit(S.state, i);
    const el = makeSlot('foundation', `<span class="found-mark">A<span class="found-suit">${G.SUIT_SYMBOL[suit]}</span></span>`);
    const name = G.SUIT_NAME[suit];
    el.setAttribute('aria-label', `${name[0].toUpperCase() + name.slice(1)} foundation`);
    return el;
  });
  slots.tab = S.state.tableau.map((_, i) => {
    const el = makeSlot('column', rankLabel(highest));
    el.setAttribute('aria-label', `Column ${COLUMN_LETTERS[i]}`);
    return el;
  });
  labels.tab = S.state.tableau.map((_, i) => makeLabel(COLUMN_LETTERS[i]));
  for (const c of G.makeDeck(highest, S.state.foundations.length)) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.id = c.id;
    el.innerHTML = faceHTML(c);
    board.appendChild(el);
    cardEls.set(c.id, el);
  }
  computeLayout();
}

/* ---------- layout ---------- */

function computeLayout() {
  const W = board.clientWidth;
  const nFound = S.state.foundations.length;
  const nCols = S.state.tableau.length;
  // One card size for every game: the largest that fits seven columns across
  // the table, with the same gap between columns as between foundations. The
  // seven-column grid also places the top row: the stock over column 1, the
  // waste over column 2 and the foundations over the last columns. Fewer
  // columns are centered under it.
  const MAX_COLS = 7, GAP = 0.16;
  let cw = Math.max(30, Math.floor(W / (MAX_COLS + (MAX_COLS - 1) * GAP)));
  let gap = Math.round(cw * GAP);
  while (cw > 30 && MAX_COLS * cw + (MAX_COLS - 1) * gap > W) gap = Math.round(--cw * GAP);
  const gridW = MAX_COLS * cw + (MAX_COLS - 1) * gap;
  const ox = Math.max(0, Math.floor((W - gridW) / 2));
  const ch = Math.round(cw * 1.4);
  const fanDx = Math.round(cw * 0.3);
  const colGap = gap;
  // A band above each row holds the pile letters.
  const labelH = Math.max(18, Math.round(cw * 0.32));
  const topY = labelH;
  // The gap above the columns is 1.5 times the label band, so the column letters have room.
  const tabY = topY + ch + Math.round(Math.max(labelH, Math.round(cw * 0.45)) * 1.5);
  const rowW = nCols * cw + (nCols - 1) * colGap;
  const x0 = ox + Math.round((gridW - rowW) / 2);
  S.L = {
    W, cw, ch, gap, fanDx,
    downDy: Math.round(ch * 0.12),
    upDy: Math.round(ch * 0.25),
    tabY,
    stock: { x: ox, y: topY },
    waste: { x: ox + cw + gap, y: topY },
    found: Array.from({ length: nFound }, (_, i) => ({ x: ox + gridW - (nFound - i) * cw - (nFound - 1 - i) * gap, y: topY })),
    tab: Array.from({ length: nCols }, (_, i) => ({ x: x0 + i * (cw + colGap), y: tabY })),
    height: 0,
  };
  // The play area never changes height: it always fits the tallest column any settings allow,
  // the last of seven columns (six face-down cards) holding a face-up run from King to Ace.
  const maxDown = Math.max(...G.COLUMN_CHOICES) - 1;
  const maxUp = Math.max(...G.HIGHEST_CHOICES);
  S.L.fixedHeight = tabY + maxDown * S.L.downDy + (maxUp - 1) * S.L.upDy + ch + 8;
  // Set on the table's wrapper so the Undo button beside the board can size itself to a card too.
  tableWrap.style.setProperty('--cw', cw + 'px');
  tableWrap.style.setProperty('--ch', ch + 'px');
  place(slots.stock, S.L.stock);
  slots.wasteFan.forEach((el, i) => place(el, { x: S.L.waste.x + i * fanDx, y: S.L.waste.y }));
  const lastFan = (slots.wasteFan.length - 1) * fanDx; // offset of the last fan position
  dealBtn.style.left = S.L.waste.x + lastFan + cw / 2 + 'px';
  dealBtn.style.top = S.L.waste.y + ch / 2 + 'px';
  slots.found.forEach((el, i) => place(el, S.L.found[i]));
  slots.tab.forEach((el, i) => place(el, S.L.tab[i]));
  // Each letter is centered over its pile: w over the whole fan, h over all the foundations.
  const lift = Math.round(cw * 0.1);
  placeLabel(labels.stock, S.L.stock.x + cw / 2, topY - lift);
  placeLabel(labels.waste, S.L.waste.x + lastFan / 2 + cw / 2, topY - lift);
  placeLabel(labels.found, (S.L.found[0].x + S.L.found[nFound - 1].x + cw) / 2, topY - lift);
  labels.tab.forEach((el, i) => placeLabel(el, S.L.tab[i].x + cw / 2, tabY - lift));
  layoutRecord();
}
function place(el, p) { el.style.transform = `translate(${p.x}px, ${p.y}px)`; }
// x is the letter's center, y its baseline area: the letter sits just above y.
function placeLabel(el, x, y) { el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }

/* ---------- render ---------- */

export function render() {
  const s = S.state;
  buildTable();
  const items = [];
  s.stock.forEach((c, i) => {
    const d = Math.min(i, 3); // a little thickness, capped
    items.push({ c, x: S.L.stock.x + d, y: S.L.stock.y - d, z: Z.stock + i, where: 'stock', buried: i < s.stock.length - 3 });
  });
  // The waste's top cards (one per card drawn) fill the fan positions from the left; the top one is playable.
  const drawN = G.drawOf(s);
  const fanStart = s.waste.length - Math.min(drawN, s.waste.length);
  s.waste.forEach((c, i) =>
    items.push({
      c, x: S.L.waste.x + Math.max(0, i - fanStart) * S.L.fanDx, y: S.L.waste.y, z: Z.waste + i, where: 'waste', buried: i < fanStart - 1,
      grab: i === s.waste.length - 1, playable: i === s.waste.length - 1,
    }));
  s.foundations.forEach((pile, f) => pile.forEach((c, i) =>
    items.push({ c, x: S.L.found[f].x, y: S.L.found[f].y, z: Z.foundation + i, where: 'f' + f, grab: i === pile.length - 1, buried: i < pile.length - 2 })));
  let bottom = S.L.tabY + S.L.ch + 3 * S.L.upDy;
  s.tableau.forEach((col, t) => {
    let y = S.L.tab[t].y;
    col.forEach((c, i) => {
      items.push({
        c, x: S.L.tab[t].x, y, z: Z.tableau + i, where: 't' + t,
        grab: !!G.pickUp(s, { pile: 'tableau', index: t, cardIndex: i }),
      });
      bottom = Math.max(bottom, y + S.L.ch);
      y += c.faceUp ? S.L.upDy : S.L.downDy;
    });
  });
  S.L.height = Math.max(S.L.fixedHeight, bottom + 8);
  board.style.height = S.L.height + 'px';

  for (const it of items) {
    const el = cardEls.get(it.c.id);
    el.classList.toggle('up', it.c.faceUp);
    el.classList.toggle('grab', !!it.grab && !S.busy && !S.closed);
    el.classList.toggle('playable', !!it.playable);
    el.classList.toggle('buried', !!it.buried);
    el.classList.remove('dragging');
    el.style.transform = `translate(${it.x}px, ${it.y}px)`;
    basePos.set(it.c.id, { x: it.x, y: it.y });
    // A card changing piles rides above everything while it slides.
    const prev = lastWhere.get(it.c.id);
    clearTimeout(el._zTimer);
    if (prev && prev !== it.where) {
      el.style.zIndex = Z.moving + it.z;
      el._zTimer = setTimeout(() => { el.style.zIndex = it.z; }, 260);
    } else {
      el.style.zIndex = it.z;
    }
    lastWhere.set(it.c.id, it.where);
    el.tabIndex = it.grab && !S.busy && !S.closed ? 0 : -1;
    el.setAttribute('role', it.grab ? 'button' : 'img');
    el.setAttribute('aria-label', it.c.faceUp ? G.spokenName(it.c) : 'Face-down card');
  }

  // Like a stock held in the hand: once one turn or less is left, the top card shows how many.
  const left = s.pending ? 0 : s.stock.length;
  for (const c of s.stock.concat(s.waste)) cardEls.get(c.id).lastElementChild.removeAttribute('data-left');
  if (left > 0 && left <= drawN) cardEls.get(top(s.stock).id).lastElementChild.dataset.left = left;

  board.classList.toggle('closed', S.closed);
  dealBtn.hidden = S.closed || !s.pending;
  // An empty stock shows the refresh arrow while turning the waste over would show something new.
  const canRecycle = !S.closed && !s.stock.length && G.hasHiddenWaste(s);
  slots.stock.classList.toggle('can-recycle', canRecycle);
  slots.stock.disabled = S.closed || S.busy || s.pending || (!s.stock.length && !s.waste.length);
  slots.stock.setAttribute('aria-label',
    s.stock.length
      ? `Draw ${Math.min(drawN, s.stock.length)} ${Math.min(drawN, s.stock.length) === 1 ? 'card' : 'cards'}` +
        (left > 0 && left <= drawN ? `, ${left} left in the stock` : '')
      : G.hasHiddenWaste(s) ? `Turn the waste over and draw ${Math.min(drawN, s.waste.length)}` : 'No more cards to turn up');

  renderRecord();
  undoBtn.disabled = S.closed || S.busy || !S.history.length;
  // A draw is the only action that doesn't add a move, so the button names what it would take back.
  const lastAction = S.history[S.history.length - 1];
  const undoText = lastAction && lastAction.moves === S.moves ? 'Undo draw' : 'Undo move';
  if (undoBtn.textContent !== undoText) { undoBtn.textContent = undoText; placeUndo(); }
  restartBtn.disabled = S.busy || !S.shuffleState || (!S.closed && (S.state.pending || !S.history.length));
  newBtn.disabled = S.busy;
  quitGameBtn.disabled = S.busy || S.closed;
  endGameBtn.disabled = S.busy || !inPlay();
}

let resizeFrame = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (!S.state) return;
    board.classList.add('no-anim');
    computeLayout();
    render();
    requestAnimationFrame(() => board.classList.remove('no-anim'));
  });
}).observe(board);
