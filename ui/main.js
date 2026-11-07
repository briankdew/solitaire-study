// Starting the page, and keeping a game in progress when the page updates on claude.ai.
import { G, S, SAVE_RULES } from './shared.js';
import { board } from './dom.js';
import { shuffledMessage, syncSettingsUI } from './settings.js';
import { render } from './table.js';
import { prepareNewShuffle, say, showWin } from './actions.js';
import './input.js';   // only adds listeners, so nothing else imports it

/* ---------- start ---------- */

function start(saved) {
  board.classList.add('no-anim');
  // Games saved with older names for ten used ids like "10C" or "TC".
  if (saved && saved.state) saved = JSON.parse(JSON.stringify(saved).replace(/"(?:10|T)([SHCD])"/g, '"X$1"'));
  // Games saved under older rules (column-by-column deal, upside-down stock, clubs and diamonds
  // for two suits, any Ace on any foundation) can't be restarted or continued the same way, so
  // they're dropped for a fresh shuffle.
  if (saved && saved.rules !== SAVE_RULES) saved = null;
  if (saved && saved.state && Array.isArray(saved.history)) {
    S.state = saved.state;
    S.history = saved.history;
    // A game saved before the record existed can't be recorded from the middle.
    S.record = Array.isArray(saved.record) ? G.reorderOldDeal(saved.record) : (S.state.pending ? [] : null);
    S.shuffleState = saved.shuffleState || null;
    S.closed = !!saved.closed;
    S.moves = saved.moves || 0;
    S.settings = G.normalizeSettings(saved.settings || {
      highest: G.highestOf(S.state), columns: S.state.tableau.length, suits: S.state.foundations.length,
    });
    S.suppressAuto = true;
    syncSettingsUI();
    render();
    if (G.isWon(S.state) && !S.closed) showWin();
  } else {
    syncSettingsUI();
    prepareNewShuffle();
    say(shuffledMessage());
  }
  requestAnimationFrame(() => board.classList.remove('no-anim'));
}

// Keep the game in progress when the page is updated while open on claude.ai.
const hot = window.claude && window.claude.hot;
if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => ({ rules: SAVE_RULES, state: S.state, history: S.history, record: S.record, moves: S.moves, settings: S.settings, shuffleState: S.shuffleState, closed: S.closed }));
if (hot && typeof hot.ready === 'function') hot.ready(start);
else start((hot && hot.data) || {});
