// Shared steps for the browser tests.
const base = require('@playwright/test');
const { expect } = base;

/** Playwright's test, failing any test whose page throws or logs an error. */
const test = base.test.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await use(page);
    expect(errors, 'errors on the page').toEqual([]);
  },
});

/**
 * Open the page with a repeatable Math.random (so a "random" shuffle is the same every run),
 * and wait for the waiting shuffle's Deal button.
 */
async function openApp(page, { seed = 1 } = {}) {
  await page.addInitScript((s) => {
    let x = s >>> 0 || 1;
    Math.random = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  }, seed);
  await page.goto('/index.html');
  await expect(page.locator('.deal-btn')).toBeVisible();
}

/** Choose a Custom shuffle menu row by position (0 Random, 1-12 the 2223 deals, 13 the 4223 deal 1). */
async function pickShuffle(page, n) {
  await page.locator('#shuffleBtn').click();
  await page.locator('#shuffleList li[role="option"]').nth(n).click();
}

/** Wait until no card is still sliding (CSS transitions show up in getAnimations). */
const settle = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

async function deal(page) {
  await page.locator('.deal-btn').click();
  await settle(page);
}
const card = (page, id) => page.locator(`.card[data-id="${id}"]`);
const foundation = (page, i) => page.locator('.slot.foundation').nth(i);
/** The Game Record panel as one line of text. */
const recordText = async (page) => (await page.locator('#steps').innerText()).split(/\s+/).join(' ').trim();
const status = (page) => page.locator('#status');

/** Drag one element's center onto another's, in small steps like a real pointer. */
async function dragTo(page, from, to) {
  await settle(page);
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await settle(page);
}

module.exports = { test, expect, openApp, pickShuffle, deal, settle, card, foundation, recordText, status, dragTo };
