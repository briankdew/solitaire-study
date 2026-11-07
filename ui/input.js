// Pointer, button and keyboard input.
import { DRAG_THRESHOLD, G, S, Z } from './shared.js';
import { board, confirmCancel, confirmContinue, confirmModal, endGameBtn, newBtn, newDealBtn, quitBtn, quitGameBtn, restartBtn, sameDealBtn, undoBtn } from './dom.js';
import { basePos, cardEls, dealBtn, render, slots } from './table.js';
import { closeConfirm, dealShuffle, drawFromStock, endGame, newDealNow, newShuffle, playByClick, quitGame, restartGame, say, tryMove, undo } from './actions.js';

/* ---------- pointer: tap and drag ---------- */

function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function dropTarget(from, ids, dx, dy) {
  const first = basePos.get(ids[0]);
  const r = { x: first.x + dx, y: first.y + dy, w: S.L.cw, h: S.L.ch };
  // An Ace dropped on any foundation goes to its own suit's foundation.
  const card = ids.length === 1 ? G.parseCard(ids[0]) : null;
  const aceTo = card && card.rank === 1 ? G.foundationTargetFor(S.state, card) : -1;
  const candidates = [
    ...S.L.tab.map((p, i) => ({ to: { pile: 'tableau', index: i }, rect: { x: p.x, y: p.y, w: S.L.cw, h: S.L.height - p.y } })),
    ...S.L.found.map((p, i) => ({ to: { pile: 'foundation', index: aceTo >= 0 ? aceTo : i }, rect: { x: p.x, y: p.y, w: S.L.cw, h: S.L.ch } })),
  ];
  let best = null, bestArea = 0;
  for (const c of candidates) {
    const a = overlap(r, c.rect);
    if (a > bestArea && G.isLegalMove(S.state, from, c.to)) { best = c.to; bestArea = a; }
  }
  return best;
}

board.addEventListener('pointerdown', (e) => {
  if (S.busy || S.drag || e.button > 0) return;
  const el = e.target.closest('.card.grab');
  if (!el) return;
  const from = G.locate(S.state, el.dataset.id);
  const cards = G.pickUp(S.state, from);
  if (!cards) return;
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  S.drag = { from, ids: cards.map((c) => c.id), x0: e.clientX, y0: e.clientY, moved: false, pointerId: e.pointerId };
});

board.addEventListener('pointermove', (e) => {
  if (!S.drag || e.pointerId !== S.drag.pointerId) return;
  const dx = e.clientX - S.drag.x0, dy = e.clientY - S.drag.y0;
  if (!S.drag.moved) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    S.drag.moved = true;
    say('');
  }
  S.drag.ids.forEach((id, i) => {
    const el = cardEls.get(id);
    const p = basePos.get(id);
    el.classList.add('dragging');
    el.style.zIndex = Z.dragging + i;
    el.style.transform = `translate(${p.x + dx}px, ${p.y + dy}px)`;
  });
});

function endDrag(e, cancelled) {
  if (!S.drag || e.pointerId !== S.drag.pointerId) return;
  const d = S.drag;
  S.drag = null;
  if (!d.moved) { if (!cancelled) playByClick(d.from); return; }
  const to = cancelled ? null : dropTarget(d.from, d.ids, e.clientX - d.x0, e.clientY - d.y0);
  if (!(to && tryMove(d.from, to))) render(); // slide back
}
board.addEventListener('pointerup', (e) => endDrag(e, false));
board.addEventListener('pointercancel', (e) => endDrag(e, true));

/* ---------- buttons and keyboard ---------- */

slots.stock.addEventListener('click', drawFromStock);
newBtn.addEventListener('click', newShuffle);
quitGameBtn.addEventListener('click', quitGame);
endGameBtn.addEventListener('click', endGame);
confirmContinue.addEventListener('click', () => closeConfirm(true));
confirmCancel.addEventListener('click', () => closeConfirm(false));
// Keep keyboard focus inside the dialog while it's open; Escape does not dismiss it.
confirmModal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); return; }
  if (e.key !== 'Tab') return;
  const order = [confirmContinue, confirmCancel];
  const i = order.indexOf(document.activeElement);
  e.preventDefault();
  order[(i + (e.shiftKey ? order.length - 1 : 1)) % order.length].focus();
});
dealBtn.addEventListener('click', dealShuffle);
restartBtn.addEventListener('click', restartGame);
newDealBtn.addEventListener('click', newDealNow);
sameDealBtn.addEventListener('click', restartGame);
quitBtn.addEventListener('click', quitGame);
undoBtn.addEventListener('click', undo);

board.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('.card.grab');
  if (!el || S.busy) return;
  e.preventDefault();
  playByClick(G.locate(S.state, el.dataset.id));
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
});
