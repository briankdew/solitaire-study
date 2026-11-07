// What the player's actions do: shuffling, dealing, moves, the automatic finish, undo and the
// buttons' commands.
import { AUTO_STEP_MS, G, REFILL_LOCK_MS, S } from './shared.js';
import { confirmCard, confirmModal, newDealBtn, statusEl, winPanel, winText } from './dom.js';
import { shuffledMessage, syncShufflePicker } from './settings.js';
import { cardEls, render } from './table.js';
import { addToken, renderRecord } from './record.js';

let stockLockedUntil = 0;   // a draw from the refresh arrow ignores stock clicks until its cards land

// Shuffle for the current settings (randomly, unless a prepared shuffle is given) and wait for the Deal button.
export function prepareNewShuffle(prepared) {
  S.state = prepared || G.prepareDeal(Math.random, S.settings);
  S.shuffleState = S.state;
  syncShufflePicker();
  S.history = [];
  S.record = [];
  S.moves = 0;
  S.suppressAuto = false;
  S.closed = false;
  winPanel.hidden = true;
  render();
}

// The only way cards get dealt: the Deal button deals the waiting shuffle.
export function dealShuffle() {
  if (S.busy || !S.state.pending) return;
  S.state = G.dealPending(S.state);
  S.history = [];
  S.record = G.dealTokens(S.state);
  S.moves = 0;
  say('');
  render();
}

// With nothing else to say, a game in play shows "Good luck!" rather than an empty line.
export function say(msg) { statusEl.textContent = msg || (inPlay() ? 'Good luck!' : ''); }
function shake(id) {
  const el = cardEls.get(id);
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

/* ---------- actions ---------- */

// countsAsMove: true for a card played to a column or foundation; turning the stock isn't a move.
// token: the play-notation token for this action, or null when it writes nothing.
function commit(next, message, countsAsMove, token) {
  S.history.push({ state: S.state, moves: S.moves, recLen: S.record && S.record.length });
  addToken(token);
  S.state = next;
  if (countsAsMove) S.moves++;
  S.suppressAuto = false;
  say(message);
  afterChange();
}

function afterChange() {
  render();
  if (G.isWon(S.state)) return showWin();
  if (S.autoFinish && G.canAutoFinish(S.state) && !S.suppressAuto) runAutoFinish();
}

export function tryMove(from, to) {
  const next = G.move(S.state, from, to);
  if (!next) return false;
  commit(next, '', true, G.moveToken(S.state, from, to));
  return true;
}

// With every stock and waste card already showing, turning the stock changes nothing:
// the waste shakes, and nothing is recorded or added to Undo.
// From an empty stock (the refresh arrow), the waste is turned back over and the next cards come
// up in one go: the refilled stock and the new waste show together. Stock clicks are ignored for
// a moment while the cards slide into place, so a quick second click can't draw again.
export function drawFromStock() {
  if (S.busy || S.closed || performance.now() < stockLockedUntil) return;
  const next = G.draw(S.state);
  if (!next) { G.fanIds(S.state).forEach(shake); return; }
  const refill = !S.state.stock.length;
  commit(next, '', false, G.turnToken(S.state, next));
  if (refill) stockLockedUntil = performance.now() + REFILL_LOCK_MS;
}

// Click rules (see G.clickTarget): the top waste card and face-up column cards
// (with the cards on top of them) go to their foundation when a single card
// can go there, otherwise to the leftmost column that takes them. A
// foundation's top card comes back down to the leftmost column that takes it.
export function playByClick(from) {
  if (S.closed || !['waste', 'tableau', 'foundation'].includes(from.pile)) return;
  const cards = G.pickUp(S.state, from);
  if (!cards) return;
  if (from.pile === 'foundation' && retakeToColumn(cards[0])) return;
  const to = G.clickTarget(S.state, from);
  if (to && tryMove(from, to)) {
    // Remember a click that went to a foundation, so clicking the card again can send it to a column instead.
    if (to.pile === 'foundation') S.history[S.history.length - 1].foundationClick = { id: cards[0].id, from };
    return;
  }
  shake(cards[0].id);
  if (from.pile === 'foundation') return say(`No column can take the ${G.label(cards[0])} right now.`);
  say(cards.length > 1
    ? `The ${G.label(cards[0])} and the cards on it have nowhere to go yet.`
    : `The ${G.label(cards[0])} has nowhere to go yet.`);
}

// A click that sent a card to a foundation, followed straight away by a click on that card there,
// means the player wanted the column: the foundation move is rewritten as the move to the column
// the click would otherwise have chosen. It replaces that move in the record and in Undo (Undo then
// puts the card back where it was first), and it doesn't count as another move.
function retakeToColumn(card) {
  const last = S.history[S.history.length - 1];
  const fc = last && last.foundationClick;
  if (!fc || fc.id !== card.id || S.moves !== last.moves + 1) return false;
  const to = G.columnClickTarget(last.state, fc.from);
  const next = to && G.move(last.state, fc.from, to);
  if (!next) return false;
  delete last.foundationClick;
  if (S.record && last.recLen != null) S.record.length = last.recLen;
  addToken(G.moveToken(last.state, fc.from, to));
  S.state = next;
  S.suppressAuto = false;
  say('');
  afterChange();
  return true;
}

export function runAutoFinish() {
  S.busy = true;
  S.history.push({ state: S.state, moves: S.moves, recLen: S.record && S.record.length });
  say('Finishing…');
  render();
  const step = () => {
    const m = G.nextAutoFinishMove(S.state);
    if (!m || !S.autoFinish) { S.busy = false; if (!m) say(''); render(); return; }
    addToken(G.moveToken(S.state, m.from, m.to));
    S.state = G.move(S.state, m.from, m.to);
    S.moves++;
    render();
    if (G.isWon(S.state)) { S.busy = false; render(); showWin(); return; }
    setTimeout(step, AUTO_STEP_MS);
  };
  setTimeout(step, AUTO_STEP_MS);
}

export function showWin() {
  // The record ends with the result (once: a restored game may already have it).
  if (S.record && !(S.record.length && S.record[S.record.length - 1].type === 'result')) {
    S.record.push(G.resultToken(S.record, true));
    renderRecord();
  }
  say('');
  winText.textContent = `In ${S.moves} ${S.moves === 1 ? 'move' : 'moves'}.`;
  winPanel.hidden = false;
  newDealBtn.focus({ preventScroll: true });
}

/** A dealt game that hasn't been won or quit. */
export function inPlay() {
  return !!S.state && !S.state.pending && !S.closed && !G.isWon(S.state);
}

// Ask before a reshuffle ends a game in play. Resolves true for Continue, false for Cancel.
// The dialog can only be closed with one of its two buttons, and neither is preselected.
let confirmResolve = null;
export function confirmReshuffle() {
  confirmModal.hidden = false;
  confirmCard.focus({ preventScroll: true });
  return new Promise((resolve) => { confirmResolve = resolve; });
}
export function closeConfirm(answer) {
  confirmModal.hidden = true;
  const resolve = confirmResolve;
  confirmResolve = null;
  if (resolve) resolve(answer);
}
const modalOpen = () => !confirmModal.hidden;

// New shuffle: mix the cards only. They wait in the stock for the Deal button.
export async function newShuffle() {
  if (S.busy) return;
  if (inPlay() && !(await confirmReshuffle())) return;
  prepareNewShuffle();
  say(shuffledMessage());
}

// Restart deal: deal the current shuffle again and start play from the beginning.
export function restartGame() {
  if (S.busy || !S.shuffleState) return;
  S.state = G.dealPending(S.shuffleState);
  S.history = [];
  S.record = G.dealTokens(S.state);
  S.moves = 0;
  S.suppressAuto = false;
  S.closed = false;
  winPanel.hidden = true;
  say('Same shuffle dealt again. Good luck!');
  render();
}

// Win panel "New deal": shuffle and deal in one step.
export function newDealNow() {
  if (S.busy) return;
  prepareNewShuffle();
  dealShuffle();
}

// Quit: leave the table exactly as it is, with no more play until Restart deal or New shuffle.
export function quitGame() {
  if (S.busy || S.closed) return;
  S.closed = true;
  S.drag = null;
  winPanel.hidden = true;
  say('Game stopped. Choose Restart deal to replay this deal, or New shuffle to mix the cards.');
  render();
}

// End game: stop play and record a loss (W/L and the moves). Like Quit, it can't be undone.
export function endGame() {
  if (S.busy || !inPlay()) return;
  addToken(G.resultToken(S.record || [], false));
  S.closed = true;
  S.drag = null;
  winPanel.hidden = true;
  say('Game ended and recorded as a loss. Choose Restart deal to replay this deal, or New shuffle to mix the cards.');
  render();
}

export function undo() {
  if (S.closed || S.busy || modalOpen() || !S.history.length) return;
  const prev = S.history.pop();
  stockLockedUntil = 0;
  S.state = prev.state;
  S.moves = prev.moves;
  if (S.record && prev.recLen != null) S.record.length = prev.recLen;
  S.suppressAuto = true;
  winPanel.hidden = true;
  say('');
  render();
}
