// The settings menus: High card, Suits, Columns, Draw, Custom shuffle and Auto-complete.
import { AUTO_FINISH_KEY, CARD_FONT_KEY, G, S, SETTINGS_KEY, inPlay, rankLabel, say, setupCode, withArticle } from './shared.js';
import { autoFinishChk, cardFontSel, columnsSel, drawSel, highestSel, ruleLine, settingsHint, tableWrap } from './dom.js';
import { makePicker } from './picker.js';
import { confirmReshuffle, prepareNewShuffle, runAutoFinish } from './actions.js';

// The settings and Auto-complete start from what the browser remembers.
S.settings = loadSettings();
S.autoFinish = loadAutoFinish();

/* ---------- settings ---------- */

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return G.normalizeSettings(JSON.parse(raw));
  } catch (e) { /* storage unavailable */ }
  return G.normalizeSettings(G.DEFAULT_SETTINGS);
}
// Auto-complete is a preference, not a deck setting, so changing it never reshuffles.
function loadAutoFinish() {
  try { return localStorage.getItem(AUTO_FINISH_KEY) !== 'off'; } catch (e) { return true; }
}
function onAutoFinishChange() {
  S.autoFinish = autoFinishChk.checked;
  try { localStorage.setItem(AUTO_FINISH_KEY, S.autoFinish ? 'on' : 'off'); } catch (e) { /* ignore */ }
  if (S.autoFinish && inPlay() && !S.busy && G.canAutoFinish(S.state)) runAutoFinish();
  else if (!S.autoFinish && S.busy) say('Auto-complete off. Play the rest yourself.');
}
autoFinishChk.checked = S.autoFinish;
autoFinishChk.addEventListener('change', onAutoFinishChange);

// Card font: the font of everything on the card faces on the table (not the record or the diagram).
// A preference like Auto-complete, so changing it never reshuffles. 'original' is the first design:
// Libre Bodoni ranks with Karla (or the device's) suits, the corner suit a little smaller.
const CARD_FONTS = { libertinus: 'Libertinus Mono', original: 'Original' };
function loadCardFont() {
  try { const v = localStorage.getItem(CARD_FONT_KEY); if (v in CARD_FONTS) return v; } catch (e) { /* storage unavailable */ }
  return 'libertinus';
}
function applyCardFont(v) {
  tableWrap.dataset.cardFont = v;
  cardFontSel.value = v;
}
cardFontSel.innerHTML = Object.entries(CARD_FONTS).map(([v, text]) => `<option value="${v}">${text}</option>`).join('');
applyCardFont(loadCardFont());
cardFontSel.addEventListener('change', () => {
  applyCardFont(cardFontSel.value);
  try { localStorage.setItem(CARD_FONT_KEY, cardFontSel.value); } catch (e) { /* ignore */ }
});

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S.settings)); } catch (e) { /* ignore */ }
}

function fillSelect(sel, values, text) {
  sel.innerHTML = values.map((v) => `<option value="${v}">${text(v)}</option>`).join('');
}
fillSelect(highestSel, G.HIGHEST_CHOICES, rankLabel);
fillSelect(columnsSel, G.COLUMN_CHOICES, String);
fillSelect(drawSel, G.DRAW_CHOICES, String);
const suitsSel = makePicker(document.getElementById('suitsBtn'), document.getElementById('suitsList'), 'Suits', G.SUIT_CHOICES,
  (n) => `${n} <span class="suit-set">${G.SUITS_BY_COUNT[n].map((s) => `<span class="${s === 'H' || s === 'D' ? 'r' : 'b'}">${G.SUIT_SYMBOL[s]}</span>`).join('')}</span>`,
  (n) => `${n} (${G.SUITS_BY_COUNT[n].map((s) => G.SUIT_NAME[s]).join(', ')})`);

// Shuffle: Random (0) or a numbered preset deal (game.js SHUFFLE_LISTS), its cards left to right
// from the top of the deck. The menu's value for a deal is its position in the list plus 1.
// Each list sits in a group headed by its setup (2223, 4223, ...), and numbering restarts in each
// list. The closed button shows a deal's cards when they fit (4 cards), otherwise its number and setup.
const shuffleOptions = G.presetShuffles().map((p) => ({ ...p, setup: setupCode(p.settings) }));
const opt = (v) => shuffleOptions[v - 1];   // the deal for a menu value (1 and up; 0 is Random)
const BUTTON_CARDS = 4;
const cardHTML = (c) => `<span class="${G.isRed(c) ? 'r' : 'b'}">${G.label(c)}</span>`;
const dealHTML = (v) => (v ? `<span class="deal-no">${opt(v).n}</span><span class="deal-cards">${opt(v).deck.map(cardHTML).join('')}</span>` : 'Random');
const shuffleSel = makePicker(document.getElementById('shuffleBtn'), document.getElementById('shuffleList'), 'Custom shuffle',
  [0, ...shuffleOptions.map((_, i) => i + 1)],
  dealHTML,
  (v) => (v ? `Setup ${opt(v).setup}, deal ${opt(v).n}: ${opt(v).deck.map(G.spokenName).join(', ')}` : 'Random'),
  {
    group: (v) => (v ? opt(v).setup : ''),
    buttonHtml: (v) => (v && opt(v).deck.length > BUTTON_CARDS
      ? `<span class="deal-no tight">${opt(v).n}</span>· ${opt(v).setup}` : dealHTML(v)),
  });

/** Show the current shuffle's deal in the Shuffle menu if it's a listed one, otherwise Random. */
export function syncShufflePicker() {
  shuffleSel.value = S.shuffleState ? G.shuffleIndexOf(S.shuffleState.deck, S.settings) : 0;
}

/** Status for a fresh random shuffle, naming its number if it is one of the listed deals. */
export function shuffledMessage() {
  const v = shuffleSel.value;
  return v ? `Cards shuffled: deal ${opt(v).n} on the ${opt(v).setup} Custom shuffle list. Click Deal to start.` : 'Cards shuffled. Click Deal to start.';
}

export function syncSettingsUI() {
  highestSel.value = S.settings.highest;
  suitsSel.value = S.settings.suits;
  drawSel.value = S.settings.draw;
  const minHighest = G.minHighestForSuits(S.settings.suits);
  for (const opt of highestSel.options) opt.disabled = Number(opt.value) < minHighest;
  const allowed = G.allowedColumns(S.settings.highest, S.settings.suits);
  for (const opt of columnsSel.options) opt.disabled = !allowed.includes(Number(opt.value));
  columnsSel.value = S.settings.columns;
  // Columns can be unavailable for two reasons: fewer than one per suit, or too many for the deck.
  const minCols = G.minColumnsFor(S.settings.suits);
  const tooBig = G.COLUMN_CHOICES.filter((c) => c >= minCols && !allowed.includes(c));
  const need = (c) => {
    const h = G.minHighestFor(c, S.settings.suits);
    return h <= 13 ? `${c} needs ${rankLabel(h)}+` : `${c} needs 4 suits`;
  };
  const hints = [];
  if (minCols > G.COLUMN_CHOICES[0]) {
    hints.push(`${S.settings.suits} suits need at least ${minCols} columns` +
      (minHighest > G.HIGHEST_CHOICES[0] ? ` and a highest card of ${rankLabel(minHighest)} or more.` : '.'));
  }
  if (tooBig.length) hints.push(`More columns need a bigger deck: ${tooBig.map(need).join(', ')}.`);
  settingsHint.textContent = hints.join(' ');
  const n = S.settings.highest * S.settings.suits;
  ruleLine.textContent = `Setup ${setupCode()} · ${n} Cards · Draw ${S.settings.draw} · Empty column takes ${withArticle(S.settings.highest)}`;
  syncShufflePicker();
}

async function onSettingsChange() {
  if (S.busy) { syncSettingsUI(); return; }
  if (inPlay() && !(await confirmReshuffle())) { syncSettingsUI(); return; } // put the menus back
  const wanted = Number(columnsSel.value);
  const wantedHighest = Number(highestSel.value);
  S.settings = G.normalizeSettings({ highest: wantedHighest, columns: wanted, suits: suitsSel.value, draw: drawSel.value });
  saveSettings();
  syncSettingsUI();
  prepareNewShuffle();
  let note = '';
  if (S.settings.highest !== wantedHighest) {
    note += ` ${S.settings.suits} suits need a highest card of ${rankLabel(S.settings.highest)} or more, so this uses ${rankLabel(S.settings.highest)}.`;
  }
  if (S.settings.columns > wanted) note += ` ${S.settings.suits} suits need at least ${S.settings.suits} columns, so this uses ${S.settings.columns}.`;
  else if (S.settings.columns < wanted) note += ` ${wanted} columns needs a higher card, so this uses ${S.settings.columns}.`;
  say(`New deck of ${S.settings.highest * S.settings.suits} cards shuffled for ${S.settings.columns} columns. Click Deal to deal it.${note}`);
}
[highestSel, columnsSel, suitsSel, drawSel].forEach((sel) => sel.addEventListener('change', onSettingsChange));

// Choosing from the Shuffle menu: a listed deal, or Random for a new random shuffle.
async function onShuffleChange() {
  if (S.busy) { syncShufflePicker(); return; }
  if (inPlay() && !(await confirmReshuffle())) { syncShufflePicker(); return; } // put the menu back
  const v = shuffleSel.value;
  if (!v) { prepareNewShuffle(); say(shuffledMessage()); return; }
  // A deal sets the settings it was listed for, with Draw 3.
  const { n, deck, settings: wanted } = shuffleOptions[v - 1];
  const prepared = G.prepareDeck(deck, wanted); // before anything changes, in case the list is wrong
  const changed = ['highest', 'suits', 'columns', 'draw'].some((k) => S.settings[k] !== wanted[k]);
  S.settings = { ...wanted };
  saveSettings();
  syncSettingsUI();
  prepareNewShuffle(prepared);
  say(`Deal ${n} shuffled: ${deck.map(G.label).join(' ')}.${changed ? ` Settings changed to ${setupCode()}.` : ''} Click Deal to start.`);
}
shuffleSel.addEventListener('change', onShuffleChange);
document.getElementById('settingsForm').addEventListener('submit', (e) => e.preventDefault());
