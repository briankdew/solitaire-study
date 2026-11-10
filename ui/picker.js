// The custom dropdown used for Suits and Custom shuffle.

/**
 * A small dropdown (button + listbox) that acts like a <select> for the settings code:
 * it has a `value` and fires 'change' when the player picks a different option.
 * Options: `group(v)` names the group choice v belongs to (or '' for none); consecutive choices
 * with the same name are listed together under it as a heading. `buttonHtml(v)` is what the
 * closed button shows for v when it differs from the list row.
 */
export function makePicker(btn, list, name, choices, html, spoken, { group = () => '', buttonHtml = html } = {}) {
  const picker = new EventTarget();
  let value = choices[0];
  let active = 0;
  const optionHTML = (v, i) => `<li role="option" id="${list.id}-${i}" aria-label="${spoken(v)}">${html(v)}</li>`;
  let rows = '';
  for (let i = 0; i < choices.length;) {
    const g = group(choices[i]);
    if (!g) { rows += optionHTML(choices[i], i); i++; continue; }
    const id = `${list.id}-g${i}`;
    let inner = '';
    for (; i < choices.length && group(choices[i]) === g; i++) inner += optionHTML(choices[i], i);
    rows += `<li role="group" class="picker-group" aria-labelledby="${id}">`
      + `<div class="picker-heading" id="${id}">${g}</div><ul role="none">${inner}</ul></li>`;
  }
  list.innerHTML = rows;
  const items = [...list.querySelectorAll('li[role="option"]')];
  function show() {
    btn.querySelector('.picker-value').innerHTML = buttonHtml(value);
    btn.setAttribute('aria-label', `${name}: ${spoken(value)}`);
    items.forEach((li, i) => li.setAttribute('aria-selected', String(choices[i] === value)));
  }
  function setActive(i) {
    active = (i + items.length) % items.length;
    items.forEach((li, j) => li.classList.toggle('active', j === active));
    list.setAttribute('aria-activedescendant', items[active].id);
  }
  function open() {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    setActive(choices.indexOf(value));
    list.focus();
  }
  function close(refocus) {
    if (list.hidden) return;
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (refocus) btn.focus();
  }
  function choose(i) {
    close(true);
    if (choices[i] === value) return;
    value = choices[i];
    show();
    picker.dispatchEvent(new Event('change'));
  }
  btn.addEventListener('click', () => (list.hidden ? open() : close(true)));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') setActive(active + 1);
    else if (e.key === 'ArrowUp') setActive(active - 1);
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(items.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') choose(active);
    else if (e.key === 'Escape') close(true);
    else if (e.key === 'Tab') { close(false); return; }
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[role="option"]');
    if (li) choose(items.indexOf(li));
  });
  list.addEventListener('focusout', (e) => { if (e.relatedTarget !== btn) close(false); });
  document.addEventListener('pointerdown', (e) => { if (!btn.parentElement.contains(e.target)) close(false); });
  Object.defineProperty(picker, 'value', {
    get: () => value,
    set: (v) => { value = Number(v); show(); },
  });
  show();
  return picker;
}
