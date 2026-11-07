// Fitting the Game Record panel and the Undo button around the table at each page width.
import { S } from './shared.js';
import { board, copyRecordBtn, highestLabel, recordEl, recordFrame, recordTitle, statusEl, stepsEl, tableWrap, undoBtn } from './dom.js';
import { measureSteps, updateStacking } from './record.js';

// The record's window is a whole number of move steps tall (a move step is two lines), less one waste step.
// Beside the table, the title lines up with the High card label across the table (or with the
// status line once the settings have moved below) and the record fills the space down to the
// bottom of the table. Below the table (narrow screens) it is as tall as the table from the top
// of the stock down.
const STEP_LINE = 20, STEP_PAD = 3;
const MOVE_STEP_H = 2 * STEP_LINE + 2 * STEP_PAD;
const TURN_STEP_H = STEP_LINE + 2 * STEP_PAD;   // a one-line waste step: the window is this much shorter
const settingsBelow = window.matchMedia('(max-width: 1160px)');   // the CSS breakpoints, kept in step
const narrowLayout = window.matchMedia('(max-width: 900px)');
const stackedLayout = window.matchMedia('(max-width: 440px)');
export function layoutRecord() {
  if (!S.L.fixedHeight) return;
  const bars = 2 * parseFloat(getComputedStyle(recordFrame).paddingTop);   // the end bars
  const below = copyRecordBtn.offsetHeight + 8;        // Copy record and the gap above it
  recordEl.style.marginTop = '0';
  // The title lines up with whatever sits beside it: High card, or the status line in the
  // middle layout. Stacked on a phone, nothing does.
  const beside = !narrowLayout.matches ? (settingsBelow.matches ? statusEl : highestLabel)
    : stackedLayout.matches ? null : highestLabel;
  const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
  if (beside) recordEl.style.marginTop = mid(beside) - mid(recordTitle) + 'px';
  let room = S.L.fixedHeight - S.L.stock.y;
  if (!narrowLayout.matches) room = board.getBoundingClientRect().top + S.L.fixedHeight - recordFrame.getBoundingClientRect().top;
  const fit = Math.floor((room - bars - below) / MOVE_STEP_H);
  stepsEl.style.height = Math.max(4, fit) * MOVE_STEP_H - TURN_STEP_H + 'px';
  measureSteps();
  updateStacking();
  placeUndo();
}
// Undo goes under column a, one card wide. Beside the table its bottom lines up with the bottom of
// the record's frame; below the table (narrow screens) it sits at the bottom of the play area.
export function placeUndo() {
  const wrapTop = tableWrap.getBoundingClientRect().top;
  const bottom = narrowLayout.matches
    ? board.getBoundingClientRect().top - wrapTop + S.L.fixedHeight - 8
    : recordFrame.getBoundingClientRect().bottom - wrapTop;
  undoBtn.style.transform = `translate(${S.L.tab[0].x}px, ${Math.round(bottom - undoBtn.offsetHeight)}px)`;
}
for (const q of [settingsBelow, narrowLayout, stackedLayout]) q.addEventListener('change', () => { if (S.L) layoutRecord(); });
// Web fonts can change the labels' heights once they load, so line the title up again then.
if (document.fonts) document.fonts.ready.then(() => { if (S.L) layoutRecord(); });
