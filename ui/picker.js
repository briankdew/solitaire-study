// The custom dropdown used for Suits and Custom shuffle.

/**
 * A small dropdown (button + listbox) that acts like a <select> for the settings code:
 * it has a `value` and fires 'change' when the player picks a different option.
 * Options: `heading(v)` gives a heading to show above choice v in the list (or nothing), and
 * `buttonHtml(v)` what the closed button shows for v when it differs from the list row.
 */
export function makePicker(btn, list, name, choices, html, spoken, { heading = () => '', buttonHtml = html } = {}) {
  const picker = new EventTarget();
  let value = choices[0];
  let active = 0;
  list.innerHTML = choices.map((v, i) => {
    const head = heading(v);
    return (head ? `<li role="presentation" class="picker-heading">${head}</li>` : '')
      + `<li role="option" id="${list.id}-${i}" aria-label="${spoken(v)}">${html(v)}</li>`;
  }).join('');
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
