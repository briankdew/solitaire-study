// The Game Record panel and Copy record.
import { G, S, say } from './shared.js';
import { copyRecordBtn, stepsEl } from './dom.js';

/* ---------- game record ---------- */

export function addToken(token) {
  if (S.record && token) S.record.push(token);
}

// Plain suit symbols: Cousine Record draws them itself, one cell wide, so they never fall back to another font.
const SUIT_CHAR = { S: '♠', H: '♥', C: '♣', D: '♦' };
const isRedId = (id) => id[1] === 'H' || id[1] === 'D';

/**
 * Group the record into steps: the deal (one line per column, then its waste turn),
 * then one step per move, waste turn and result. Moves are numbered.
 */
function stepsOf(tokens) {
  const steps = [];
  let i = G.dealLength(tokens);
  if (i) steps.push({ key: tokens[0], kind: 'deal', tokens: tokens.slice(0, i) });
  let n = 0;
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'move') steps.push({ key: t, kind: 'move', token: t, number: ++n });
    else if (t.type === 'turn') steps.push({ key: t, kind: 'turn', token: t });
    else if (t.type === 'result') steps.push({ key: t, kind: 'eop', token: t });
  }
  return steps;
}

// One line of a step: cards right-aligned (-- when the pile is empty), then the pile letter,
// blue for the player's own moves and gray for the deal and the waste.
// `row` places the line explicitly, so every letter stays beside its own cards.
function lineHTML(ids, letter, own, row) {
  const cards = ids.length
    ? ids.map((id) => `<span class="c${isRedId(id) ? ' r' : ''}">${id[0]}${SUIT_CHAR[id[1]]}</span>`).join('')
    : '<span class="c none">--</span>';
  const at = `style="grid-row:${row}"`;
  return `<span class="cards" ${at}>${cards}</span><span class="pile ${own ? 'play' : 'auto'}" ${at}>${letter}</span>`;
}

// The waste cards showing after a token (older records without `fan` fall back to what they name).
const fanOf = (t) => t.fan || (t.type === 'turn' ? t.cards : t.top ? [t.top] : []);

function stepEl(step) {
  const el = document.createElement('div');
  el.className = 'step';
  let html = '';
  if (step.kind === 'deal') {
    html = '<span class="lbl">D</span>' + step.tokens.map((t, i) =>
      t.type === 'turn' ? lineHTML(fanOf(t), 'w', false, i + 1) : lineHTML([t.card], t.to, false, i + 1)).join('');
  } else if (step.kind === 'move') {
    const t = step.token;
    const left = t.from === 'w' ? fanOf(t) : t.top ? [t.top] : [];
    html = `<span class="lbl">${step.number}</span>` + lineHTML([t.card], t.to, true, 1) + lineHTML(left, t.from, t.from !== 'w', 2);
  } else if (step.kind === 'turn') {
    html = lineHTML(fanOf(step.token), 'w', false, 1);
  } else {
    const t = step.token;
    html = `<span class="lbl">EOP</span><span class="result ${t.won ? 'won' : 'lost'}">${G.tokenText(t)}</span>`;
  }
  el.innerHTML = html;
  return el;
}

// Bring the record up to date: keep the steps already shown, drop any that were undone,
// add the new ones, and slide the newest up into view at the bottom.
let shownKeys = [];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export function renderRecord() {
  copyRecordBtn.disabled = !S.record || !S.record.length;
  const steps = stepsOf(S.record || []);
  let same = 0;
  while (same < shownKeys.length && same < steps.length && shownKeys[same] === steps[same].key) same++;
  if (same === shownKeys.length && same === steps.length) return;
  const fresh = same === 0;
  [...stepsEl.children].slice(same).forEach((el) => el.remove());
  for (const step of steps.slice(same)) stepsEl.appendChild(stepEl(step));
  shownKeys = steps.map((st) => st.key);
  measureSteps();
  updateStacking();
  stepsEl.scrollTo({ top: stepsEl.scrollHeight, behavior: fresh || reduceMotion.matches ? 'auto' : 'smooth' });
}

// Each step's place in the record when nothing is pinned (sticky steps report where they are
// pinned, so this is worked out from the heights).
let stepSpans = [];
export function measureSteps() {
  let y = 0;
  stepSpans = [...stepsEl.children].map((el) => { const t = y; y += el.offsetHeight; return { t, b: y }; });
}

// Stacking, like the steps of an escalator at both ends. Normally a later step is in front of an
// earlier one, so each casts its shadow up onto the step above it and slides up over the step
// pinned at the top. Steps pinned at the bottom go the other way: each is behind the one before
// it, so the step just above them slides down over them. `peak`, the step just above the bottom
// stack, is in front of both neighbours; z-index falls off by one for each step away from it.
export function updateStacking() {
  const els = stepsEl.children;
  const n = els.length;
  if (stepSpans.length !== n) measureSteps();
  const top = stepsEl.scrollTop, bottom = top + stepsEl.clientHeight;
  let pinnedTop = -1, pinnedBottom = n;
  stepSpans.forEach((sp, i) => {
    if (sp.t < top - 0.5) pinnedTop = i;                            // the last step pinned at the top
    if (pinnedBottom === n && sp.b > bottom + 0.5) pinnedBottom = i; // the first one pinned at the bottom
  });
  const peak = Math.max(pinnedTop + 1, pinnedBottom - 1);
  for (let i = 0; i < n; i++) {
    const el = els[i];
    const z = String(n - Math.abs(i - peak) + 1);
    if (el.style.zIndex !== z) el.style.zIndex = z;
  }
}
stepsEl.addEventListener('scroll', updateStacking, { passive: true });

async function copyRecord() {
  if (!S.record || !S.record.length) return;
  const text = G.recordText(S.state, S.record);
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (e) {
    // Clipboard API blocked (e.g. inside a frame): fall back to a hidden text box.
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed'; box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    box.remove();
  }
  say(ok ? 'Game record copied.' : 'Copying was blocked by the browser.');
}
copyRecordBtn.addEventListener('click', copyRecord);
