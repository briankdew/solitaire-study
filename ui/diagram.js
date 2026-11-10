// The game play diagram: a panel over the lower play area that draws the game as it is played,
// one snapshot per action (the deal, each move, each draw), for the custom shuffles only.
// Rows are the piles (w, the columns, each foundation) and stay put on the left; the snapshots
// slide left out of view as new ones arrive, and slide back on Undo.
// The diagram is worked out from the game record replayed on the dealt shuffle (G.replayRecord),
// so whatever rebuilds the record (Undo, the take-back, a reloaded game) rebuilds the diagram too.
import { G, S } from './shared.js';
import { diagramBtn, diagramEl, tableWrap, winPanel } from './dom.js';

const STORE_KEY = 'solitaire-study.diagram';
const SLIDE_MS = 300;
const SVG_NS = 'http://www.w3.org/2000/svg';
const LEGEND = [
  ['same', 'No change'], ['reveal', 'Reveal'], ['promote', 'Promote'],
  ['possible', 'Possible play'], ['draw', 'Draw'], ['play', 'Selected play'],
];

let open = loadOpen();
let shownKey = '';      // what the strip shows now, so unrelated redraws don't restart its animation
let shownCount = 0;     // snapshots in the strip now
let geom = null;        // sizes from the card width, set by placeDiagram

function loadOpen() {
  try { return localStorage.getItem(STORE_KEY) === 'on'; } catch (e) { return false; }
}
function saveOpen() {
  try { localStorage.setItem(STORE_KEY, open ? 'on' : 'off'); } catch (e) { /* ignore */ }
}

/** The custom shuffle being played (1–12), or 0. */
function shuffleNumber() {
  return S.shuffleState ? G.shuffleIndexOf(S.shuffleState.deck, S.settings) : 0;
}

/** The diagram's model for the game on the table, { rows, snaps } (no snaps before the deal), or null. */
function currentModel() {
  if (!S.shuffleState || !shuffleNumber()) return null;
  const dealt = G.dealPending(S.shuffleState);
  if (S.state.pending) {
    const empty = G.diagramModel([{ type: 'deal', state: dealt }]);
    return { rows: empty.rows, snaps: [] };
  }
  if (!S.record) return null;
  const steps = G.replayRecord(dealt, S.record);
  return steps ? G.diagramModel(steps) : null;
}

export function toggleDiagram() {
  if (diagramBtn.disabled) return;
  open = !open;
  saveOpen();
  updateDiagram();
}

/* ---------- drawing ---------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const isRedSuit = (suit) => suit === 'H' || suit === 'D';
// Cards, judgments and pile letters are in the record panel's font (Cousine Record), written the same
// way: rank then the plain suit character, which the font has its own glyph for.
const SUIT_CHAR = { S: '♠', H: '♥', C: '♣', D: '♦' };
const cardText = (id) => id[0] + SUIT_CHAR[id[1]];

/** Sizes, all from the card width so the panel scales with the table. */
function computeGeom(model) {
  const cw = S.L.cw;
  const width = S.L.found[S.L.found.length - 1].x + cw - S.L.stock.x;   // the play area's width
  const cellW = cw;
  const cellH = Math.max(18, Math.round(cw * 0.3));
  const rowGap = Math.max(4, Math.round(cw * 0.08));
  const pad = Math.max(8, Math.round(cw * 0.14));
  const labelW = Math.max(18, Math.round(cw * 0.32));
  const viewX = pad + labelW + Math.round(cw * 0.08);
  const viewW = width - viewX - pad;
  const minGap = Math.round(cw * 0.5);
  const slots = Math.max(2, Math.floor((viewW + minGap) / (cellW + minGap)));
  const gap = (viewW - slots * cellW) / (slots - 1);
  const headerY = pad;
  const rowsY = headerY + cellH + Math.round(cw * 0.12);
  const pitchY = cellH + rowGap;
  const rowsBottom = rowsY + model.rows.length * pitchY - rowGap;
  const legendY = rowsBottom + Math.round(cw * 0.16);
  const legendH = Math.max(16, Math.round(cellH * 0.8));
  return {
    cw, width, cellW, cellH, rowGap, pad, labelW, viewX, viewW, slots, pitch: cellW + gap,
    headerY, rowsY, pitchY, legendY, legendH, height: legendY + legendH + pad,
    font: Math.max(10, Math.round(cellH * 0.68)),
  };
}

const rowY = (g, r) => g.rowsY + r * g.pitchY;

/** One cell: card-colored with its cards, or an empty felt slot. Covered waste cards are shaded. */
function cellSVG(g, x, y, cards, mark = '') {
  if (!cards.length) return `<rect class="dg-empty" x="${x}" y="${y}" width="${g.cellW}" height="${g.cellH}" rx="4"/>`;
  let out = `<rect class="dg-cell" x="${x}" y="${y}" width="${g.cellW}" height="${g.cellH}" rx="4"/>`;
  const step = g.font * 1.75;   // one card's text plus a little space
  cards.forEach((id, i) => {
    const cx = x + 4 + i * step;
    if (i < cards.length - 1) out += `<rect class="dg-covered" x="${cx - 2}" y="${y + 3}" width="${step - 2}" height="${g.cellH - 6}" rx="2"/>`;
    out += `<text class="dg-card${isRedSuit(id[1]) ? ' r' : ''}" x="${cx}" y="${y + g.cellH / 2}" font-size="${g.font}">${esc(cardText(id))}</text>`;
  });
  // A judged move's judgment, to the right of the card it moved.
  if (mark) out += `<text class="dg-mark" x="${x + 4 + cards.length * step}" y="${y + g.cellH / 2}" font-size="${g.font}">${esc(mark)}</text>`;
  return out;
}

/** A link from snapshot k-1 (its cell's right edge) to snapshot k (the left edge), between rows. */
function linkSVG(g, k, link) {
  const x1 = (k - 1) * g.pitch + g.cellW, x2 = k * g.pitch;
  const y1 = rowY(g, link.from) + g.cellH / 2, y2 = rowY(g, link.to) + g.cellH / 2;
  const ends = { play: 'url(#dg-arrow-gold)', draw: 'url(#dg-arrow-gold)', reveal: 'url(#dg-arrow-white)', promote: 'url(#dg-arrow-white)' };
  const starts = { play: 'url(#dg-dot)', draw: 'url(#dg-dot)' };
  // Arrows stop short of the cell so their heads show.
  const x2a = ends[link.type] ? x2 - 1 : x2;
  return `<line class="dg-${link.type}" x1="${x1}" y1="${y1}" x2="${x2a}" y2="${y2}"` +
    (starts[link.type] ? ` marker-start="${starts[link.type]}"` : '') +
    (ends[link.type] ? ` marker-end="${ends[link.type]}"` : '') + '/>';
}

const LINK_ORDER = ['possible', 'same', 'reveal', 'promote', 'draw', 'play'];

function snapSVG(g, model, k, label) {
  const snap = model.snaps[k];
  const x = k * g.pitch;
  let out = '';
  const links = snap.links.slice().sort((a, b) => LINK_ORDER.indexOf(a.type) - LINK_ORDER.indexOf(b.type));
  for (const link of links) out += linkSVG(g, k, link);
  const hw = snap.type === 'deal' ? g.cellW : Math.round(g.cellW * 0.62);
  out += `<rect class="dg-head" x="${x + (g.cellW - hw) / 2}" y="${g.headerY}" width="${hw}" height="${g.cellH}" rx="4"/>`;
  // Long labels (the deal's) shrink to fit their box on small tables.
  const size = Math.min(g.font, Math.floor(g.font * (hw - 8) / Math.max(1, textWidth(label, g.font))));
  out += `<text class="dg-head-text" x="${x + g.cellW / 2}" y="${g.headerY + g.cellH / 2}" font-size="${size}">${esc(label)}</text>`;
  snap.cells.forEach((cell, r) => { out += cellSVG(g, x, rowY(g, r), cell.cards, cell.mark); });
  return out;
}

const DEFS = `<defs>
  <marker id="dg-arrow-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0 10 5 0 10z" class="dg-head-gold"/></marker>
  <marker id="dg-arrow-white" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0 10 5 0 10z" class="dg-head-white"/></marker>
  <marker id="dg-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse"><circle cx="5" cy="5" r="5" class="dg-head-gold"/></marker>
</defs>`;

/** The fixed parts: the panel, the pile labels and the legend. */
function frameSVG(g, model) {
  let out = `<rect class="dg-panel" x="0" y="0" width="${g.width}" height="${g.height}" rx="14"/>`;
  model.rows.forEach((row, r) => {
    const y = rowY(g, r);
    out += `<rect class="dg-cell" x="${g.pad}" y="${y}" width="${g.labelW}" height="${g.cellH}" rx="4"/>`;
    const cls = row.pile === 'waste' ? 'dg-letter auto' : 'dg-letter';
    const suit = row.suit ? `<tspan class="dg-suit${isRedSuit(row.suit) ? ' r' : ''}" font-size="${Math.round(g.font * 0.7)}">${SUIT_CHAR[row.suit]}</tspan>` : '';
    out += `<text class="${cls}" x="${g.pad + g.labelW / 2}" y="${y + g.cellH / 2}" font-size="${g.font}">${row.letter}${suit}</text>`;
  });
  out += legendSVG(g);
  return out;
}

let measureCtx = null;
function textWidth(text, size) {
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = `${size}px Karla, sans-serif`;
  return measureCtx.measureText(text).width;
}

/** The legend along the bottom: each kind of line beside a label box, spread across the panel. */
function legendSVG(g) {
  const left = g.pad, right = g.width - g.pad;
  const lineW = Math.round(g.cw * 0.34);
  const space = (right - left) / LEGEND.length;
  // The largest text that lets the longest label and its line fit in an item's space.
  let size = Math.max(9, Math.round(g.legendH * 0.62));
  const longest = LEGEND.reduce((m, [, t]) => Math.max(m, textWidth(t, size)), 0);
  const room = space - lineW - 14;
  if (longest > room) size = Math.max(7, Math.floor(size * room / longest));
  let out = '';
  LEGEND.forEach(([type, text], i) => {
    const x = left + i * space;
    const boxW = Math.ceil(textWidth(text, size)) + 8;
    const y = g.legendY;
    out += `<rect class="dg-head" x="${x}" y="${y}" width="${boxW}" height="${g.legendH}" rx="3"/>`;
    out += `<text class="dg-legend-text" x="${x + 4}" y="${y + g.legendH / 2}" font-size="${size}">${esc(text)}</text>`;
    const ly = y + g.legendH / 2, lx1 = x + boxW + 4, lx2 = Math.min(x + space - 6, lx1 + lineW);
    const marks = type === 'play' || type === 'draw' ? ' marker-start="url(#dg-dot)" marker-end="url(#dg-arrow-gold)"'
      : type === 'reveal' || type === 'promote' ? ' marker-end="url(#dg-arrow-white)"' : '';
    out += `<line class="dg-${type}" x1="${lx1}" y1="${ly}" x2="${lx2}" y2="${ly}"${marks}/>`;
  });
  return out;
}

/* ---------- placing and updating ---------- */

// The button sits at the bottom of the play area (where Undo used to be), centered under it; the
// panel sits over the lower play area, just above the button. placeUndo calls this with the row's
// bottom; the diagram's own redraws reuse it.
let rowBottom = 0;       // the bottom of the toggle's row, from placeUndo
export function placeDiagram(bottom = rowBottom) {
  if (!S.L) return;
  rowBottom = bottom;
  const btnY = Math.round(bottom - diagramBtn.offsetHeight);
  const width = S.L.found[S.L.found.length - 1].x + S.L.cw - S.L.stock.x;
  const bx = S.L.stock.x + width / 2 - diagramBtn.offsetWidth / 2;
  diagramBtn.style.transform = `translate(${Math.round(bx)}px, ${btnY}px)`;
  if (geom) {
    const gapAbove = Math.round(S.L.cw * 0.18);
    const top = Math.round(btnY - gapAbove - geom.height);
    diagramEl.style.transform = `translate(${S.L.stock.x}px, ${top}px)`;
    // With the diagram showing, the win card centers in the room above it instead of covering it
    // (the win panel reaches 8px past the table on every side).
    winPanel.style.paddingBottom = diagramEl.hidden ? '' : `${tableWrap.offsetHeight + 8 - top}px`;
  }
}

/** Redraw the diagram for the game on the table (called by render). */
export function updateDiagram() {
  const model = S.state && S.L ? currentModel() : null;
  diagramBtn.disabled = !model;
  diagramBtn.title = model ? '' : 'Available for the custom shuffles';
  diagramBtn.setAttribute('aria-pressed', String(open && !!model));
  diagramBtn.classList.toggle('on', open && !!model);
  const show = open && !!model;
  diagramEl.hidden = !show;
  diagramEl.classList.toggle('over-win', !winPanel.hidden);
  if (!show) { shownKey = ''; shownCount = 0; winPanel.style.paddingBottom = ''; return; }

  const g = computeGeom(model);
  const label = (k) => model.snaps[k].label || `${G.setupText(S.shuffleState)} D/CS${shuffleNumber()}`;
  const key = [g.width, g.cw, shuffleNumber(), S.record ? S.record.map((t) => G.tokenText(t)).join(' ') : ''].join('|');
  const sizeChanged = !geom || geom.width !== g.width || geom.height !== g.height;
  geom = g;
  if (sizeChanged || !winPanel.style.paddingBottom) placeDiagram();
  if (key === shownKey) return;
  const before = shownCount;
  const wasShown = shownKey !== '';
  const sameGame = wasShown && key.split('|').slice(0, 3).join('|') === shownKey.split('|').slice(0, 3).join('|');
  const grew = sameGame && model.snaps.length === before + 1;
  shownKey = key;
  shownCount = model.snaps.length;

  const frame = diagramEl.querySelector('.dg-frame');
  frame.setAttribute('width', g.width);
  frame.setAttribute('height', g.height);
  frame.innerHTML = DEFS + frameSVG(g, model);

  const view = diagramEl.querySelector('.dg-view');
  Object.assign(view.style, { left: g.viewX + 'px', top: '0px', width: g.viewW + 'px', height: g.legendY + 'px' });
  const strip = diagramEl.querySelector('.dg-strip');
  const n = model.snaps.length;
  strip.setAttribute('width', Math.max(g.viewW, n * g.pitch));
  strip.setAttribute('height', g.legendY);
  let body = '';
  for (let k = 0; k < n; k++) {
    const isNew = grew && k === n - 1;
    body += `<g class="dg-snap${isNew ? ' dg-new' : ''}">${snapSVG(g, model, k, label(k))}</g>`;
  }
  strip.innerHTML = body;

  // Older snapshots slide left out of view so the newest is in the right-most position; Undo slides them back.
  const offset = Math.max(0, n - g.slots) * g.pitch;
  const slid = grew && n > g.slots;
  const newSnap = strip.querySelector('.dg-new');
  if (newSnap) newSnap.style.animationDelay = (slid ? SLIDE_MS : 0) + 'ms';
  strip.style.transition = sameGame && !sizeChanged ? `transform ${SLIDE_MS}ms ease` : 'none';
  strip.style.transform = `translateX(${-offset}px)`;
}

// The win panel dims the table; the diagram goes above it so the finished game can be read.
new MutationObserver(() => diagramEl.classList.toggle('over-win', !winPanel.hidden))
  .observe(winPanel, { attributes: true, attributeFilter: ['hidden'] });

// Show the panel's elements for the first time.
diagramEl.innerHTML = `<svg class="dg-frame" xmlns="${SVG_NS}"></svg><div class="dg-view"><svg class="dg-strip" xmlns="${SVG_NS}"></svg></div>`;
