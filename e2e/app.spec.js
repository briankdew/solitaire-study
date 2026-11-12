// What a player sees and does: shuffling, dealing, clicks, drags, the record, settings and layout.
const { test, expect, openApp, pickShuffle, deal, settle, card, foundation, recordText, status, dragTo } = require('./helpers');

test.describe('start and custom shuffles', () => {
  test('opens with a shuffled deck waiting to be dealt, and no errors', async ({ page }) => {
    await openApp(page);
    await expect(status(page)).toHaveText('Cards shuffled. Click Deal to start.');
    await expect(page.locator('#ruleLine')).toContainText('Setup 3223');
    await expect(page.locator('#undoBtn')).toBeDisabled();
  });

  test('picking deal 1 sets 2223 and deals A♠ / A♥ over 2♠ / 2♥', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 1);
    await expect(status(page)).toContainText('Deal 1 shuffled');
    await expect(status(page)).toContainText('Settings changed to 2223');
    await expect(page.locator('#ruleLine')).toContainText('Setup 2223');
    await expect(page.locator('#shuffleBtn')).toContainText('1');
    await deal(page);
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w');
    await expect(foundation(page, 0)).toHaveAttribute('aria-label', 'Spades foundation');
    await expect(foundation(page, 1)).toHaveAttribute('aria-label', 'Hearts foundation');
  });

  test('the menu lists Random, the 12 four-card deals spade first, then the 8-card deal', async ({ page }) => {
    await openApp(page);
    await page.locator('#shuffleBtn').click();
    const items = page.locator('#shuffleList li[role="option"]');
    await expect(items).toHaveCount(14);
    await expect(items.nth(0)).toHaveText('Random');
    await expect(items.nth(1)).toHaveAttribute('aria-label', /^Setup 2223, deal 1: Ace of spades, 2 of spades, Ace of hearts, 2 of hearts$/);
    await expect(items.nth(12)).toHaveAttribute('aria-label', /^Setup 2223, deal 12: 2 of spades, 2 of hearts, Ace of hearts, Ace of spades$/);
    await expect(items.nth(13)).toHaveAttribute('aria-label',
      /^Setup 4223, deal 1: Ace of spades, 3 of hearts, 4 of hearts, 3 of spades, Ace of hearts, 2 of spades, 4 of spades, 2 of hearts$/);
  });

  test('the 8-card deal sets up 4223 and deals its order', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 13);
    await expect(page.locator('#ruleLine')).toContainText('Setup 4223');
    await expect(page.locator('#shuffleBtn .picker-value')).toHaveText('1· 4223');   // 8 chips don't fit
    await page.locator('#shuffleBtn').click();
    await expect(page.locator('#shuffleList .picker-heading')).toHaveText(['2223', '4223']);
    await expect(page.getByRole('group', { name: '4223' }).getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await deal(page);
    await expect.poll(() => recordText(page)).toBe('D A♠ a 4♥ b 3♠A♥2♠ w');
  });

  test('changing a setting after a deal goes back to Random', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 3);
    await page.locator('#drawSel').selectOption('1');
    await expect(page.locator('#shuffleBtn')).toContainText('Random');
    await expect(page.locator('#ruleLine')).toContainText('Setup 2221');
  });
});

test.describe('play', () => {
  test('clicks win deal 1: the record numbers moves and ends with W4', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 1);
    await deal(page);
    await card(page, 'AS').click();
    await card(page, 'AH').click();
    await card(page, '2S').click();
    await card(page, '2H').click();
    await expect(page.locator('#winPanel')).toBeVisible();
    await expect(page.locator('#winText')).toHaveText('In 4 moves.');
    await expect.poll(() => recordText(page)).toBe(
      'D A♠ a A♥ b 2♥ w 1 A♠ h -- a 2 A♥ h 2♠ b 3 2♠ h -- b 4 2♥ h -- w EOP W4');
  });

  test('an Ace dragged onto the other suit\'s foundation lands on its own', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 1);
    await deal(page);
    await dragTo(page, card(page, 'AH'), foundation(page, 0));
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w 1 A♥ h 2♠ b');
    const ah = await card(page, 'AH').boundingBox();
    const f1 = await foundation(page, 1).boundingBox();
    expect(Math.abs(ah.x - f1.x)).toBeLessThan(3);
  });

  test('a 2 dragged onto an empty foundation slides back', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 1);
    await deal(page);
    const before = await card(page, '2H').boundingBox();
    await dragTo(page, card(page, '2H'), foundation(page, 1));
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w');
    expect(await card(page, '2H').boundingBox()).toEqual(before);   // back on the waste
    await expect(page.locator('#undoBtn')).toBeDisabled();
  });

  test('Undo takes back a move, and keyboard Enter / Ctrl+Z work', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 1);
    await deal(page);
    await card(page, 'AS').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w 1 A♠ h -- a');
    await expect(page.locator('#undoBtn')).toHaveText('Undo move');
    await page.keyboard.press('Control+z');
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w');
    await card(page, 'AS').click();
    await page.locator('#undoBtn').click();
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w');
  });

  test('turning the stock adds an unnumbered step; Undo reads Undo draw', async ({ page }) => {
    await openApp(page, { seed: 7 });
    await page.locator('#highestSel').selectOption('5');   // 10 cards: 3 in columns, 3 on the waste, 4 in the stock
    await deal(page);
    const before = await page.locator('#steps .step').count();
    await page.locator('.slot.stock').click();
    await expect(page.locator('#steps .step')).toHaveCount(before + 1);
    await expect(page.locator('#steps .step').last().locator('.lbl')).toHaveCount(0);   // a turn has no move number
    await expect(page.locator('#steps .step').last()).toContainText(/w$/);
    await expect(page.locator('#undoBtn')).toHaveText('Undo draw');
    await page.locator('#undoBtn').click();
    await expect(page.locator('#steps .step')).toHaveCount(before);
  });

  test('Restart deal deals the same shuffle again; End game records a loss', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 1);
    await deal(page);
    await card(page, 'AS').click();
    await page.locator('#restartBtn').click();
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w');
    await card(page, 'AS').click();
    await page.locator('#endGameBtn').click();
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w 1 A♠ h -- a EOP L1');
    await expect(page.locator('#endGameBtn')).toBeDisabled();
  });

  test('a reshuffle mid-game asks first: Cancel keeps the game, Continue shuffles', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 1);
    await deal(page);
    await page.locator('#newBtn').click();
    await expect(page.locator('#confirmModal')).toBeVisible();
    await page.locator('#confirmCancel').click();
    await expect(page.locator('#confirmModal')).toBeHidden();
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w');
    await page.locator('#newBtn').click();
    await page.locator('#confirmContinue').click();
    await expect(page.locator('.deal-btn')).toBeVisible();
    await expect.poll(() => recordText(page)).toBe('');
  });

  test('Copy record copies the official letters', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openApp(page);
    await pickShuffle(page, 1);
    await deal(page);
    await card(page, 'AS').click();
    await page.locator('#copyRecordBtn').click();
    await expect(status(page)).toHaveText('Game record copied.');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('Setup: 2223\nDeal: ASa AHb 2Hw\nPlay: ASh--a');
  });
});

test.describe('finishing, take-backs and the win panel', () => {
  test('the automatic finish plays the last card once nothing is hidden', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 1);
    await deal(page);
    for (const id of ['AS', 'AH', '2H']) await card(page, id).click();   // 2♠ is left, face up, with the stock and waste empty
    await expect(page.locator('#winPanel')).toBeVisible();
    await expect.poll(() => recordText(page)).toBe(
      'D A♠ a A♥ b 2♥ w 1 A♠ h -- a 2 A♥ h 2♠ b 3 2♥ h -- w 4 2♠ h -- b EOP W4');
  });

  test('with Auto-complete off, the last card waits for the player', async ({ page }) => {
    await openApp(page);
    await page.locator('#autoFinishChk').uncheck();
    await pickShuffle(page, 1);
    await deal(page);
    for (const id of ['AS', 'AH', '2H']) await card(page, id).click();
    await settle(page);
    await expect(page.locator('#winPanel')).toBeHidden();
    await card(page, '2S').click();
    await expect(page.locator('#winPanel')).toBeVisible();
  });

  test('clicking a foundation card brings it back down to a column as a new move', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 1);
    await deal(page);
    await card(page, 'AS').click();
    await card(page, 'AH').click();   // A♥ up; 2♠ shows in b
    await settle(page);
    await card(page, 'AH').click();   // no other column took it before, so this is a new move onto 2♠ (judged ?)
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w 1 A♠ h -- a 2 A♥ h 2♠ b 3 ?A♥ b -- h');
  });

  test('clicking a card again on its foundation sends it to the column instead (take-back)', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 7);   // 2♠ A♠ A♥ 2♥: a 2♠, b A♥ over A♠, waste 2♥
    await deal(page);
    await card(page, 'AH').click();   // to its foundation, though column a could take it
    await settle(page);
    await card(page, 'AH').click();   // straight back: rewritten as the move to column a
    await expect.poll(() => recordText(page)).toBe('D 2♠ a A♥ b 2♥ w 1 ?A♥ a A♠ b');
    await page.locator('#undoBtn').click();
    await expect.poll(() => recordText(page)).toBe('D 2♠ a A♥ b 2♥ w');
  });

  test('a judged move: ? before the card in the record, first in Copy record\'s token', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openApp(page);
    await page.locator('#autoFinishChk').uncheck();
    await pickShuffle(page, 7);   // 2♠ A♠ A♥ 2♥: a 2♠, b A♥ over A♠, waste 2♥
    await deal(page);
    await dragTo(page, card(page, 'AH'), card(page, '2S'));   // an Ace onto a 2: allowed, judged a mistake
    await expect.poll(() => recordText(page)).toBe('D 2♠ a A♥ b 2♥ w 1 ?A♥ a A♠ b');
    await expect(page.locator('#steps .step .j')).toHaveText('?');
    await page.locator('#copyRecordBtn').click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('Setup: 2223\nDeal: 2Sa AHb 2Hw\nPlay: ?AHaASb');
  });

  test('the win panel: Same deal, New deal and Quit', async ({ page }) => {
    await openApp(page);
    const win = async () => {
      for (const id of ['AS', 'AH', '2S', '2H']) await card(page, id).click();
      await expect(page.locator('#winPanel')).toBeVisible();
    };
    await pickShuffle(page, 1);
    await deal(page);
    await win();
    await page.locator('#sameDealBtn').click();
    await expect(page.locator('#winPanel')).toBeHidden();
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w');
    await settle(page);
    await win();
    await page.locator('#quitBtn').click();
    await expect(page.locator('#winPanel')).toBeHidden();
    await expect(status(page)).toContainText('Game stopped');
    await page.locator('#restartBtn').click();
    await settle(page);
    await win();
    await page.locator('#newDealBtn').click();
    await expect(page.locator('#winPanel')).toBeHidden();
    await expect(page.locator('.deal-btn')).toBeHidden();       // shuffled and dealt in one step
    await expect.poll(() => recordText(page)).toMatch(/^D /);
  });
});

test.describe('game play diagram', () => {
  const snaps = (page) => page.locator('#diagram .dg-snap');
  const heads = async (page) => (await page.locator('#diagram .dg-head-text').allTextContents());
  const strip = (page) => page.locator('#diagram .dg-strip');
  async function openDiagram(page, n) {
    await openApp(page);
    await page.locator('#autoFinishChk').uncheck();
    await expect(page.locator('#diagramBtn')).toBeDisabled();   // random shuffles have no diagram
    await pickShuffle(page, n);
    await expect(page.locator('#diagramBtn')).toBeEnabled();
    await page.locator('#diagramBtn').click();
    await expect(page.locator('#diagram')).toBeVisible();
    await deal(page);
  }

  test('builds a snapshot per move, with the play and every other legal play, and Undo takes it back', async ({ page }) => {
    await openDiagram(page, 1);
    await expect(snaps(page)).toHaveCount(1);
    expect(await heads(page)).toEqual(['2223 D/CS1']);
    await card(page, 'AS').click();
    await expect(snaps(page)).toHaveCount(2);
    expect(await heads(page)).toEqual(['2223 D/CS1', '1']);
    const second = snaps(page).nth(1);
    await expect(second.locator('.dg-play')).toHaveCount(1);
    await expect(second.locator('.dg-possible')).toHaveCount(1);   // A♥ b→h♥
    await expect(second.locator('.dg-same')).toHaveCount(2);       // w and b
    await card(page, 'AH').click();
    await expect(snaps(page).nth(2).locator('.dg-reveal')).toHaveCount(1);   // 2♠ turned over in b
    await page.locator('#undoBtn').click();
    await expect(snaps(page)).toHaveCount(2);
    await page.locator('#diagramBtn').click();
    await expect(page.locator('#diagram')).toBeHidden();
  });

  test('the take-back rewrites the last snapshot instead of adding one', async ({ page }) => {
    await openDiagram(page, 1);
    await card(page, 'AS').click();
    await card(page, 'AH').click();
    await card(page, '2H').click();
    await settle(page);
    await card(page, '2H').click();   // back off the foundation: rewritten as 2♥ w→a
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w 1 A♠ h -- a 2 A♥ h 2♠ b 3 2♥ a -- w');
    await expect(snaps(page)).toHaveCount(4);
    const cells = await snaps(page).nth(3).locator('.dg-card').allTextContents();
    expect(cells.map((t) => t.replace(/\uFE0E/g, ''))).toEqual(['2♥', '2♠', 'A♠', 'A♥']);   // a, b, h♠, h♥; waste empty
  });

  test('a judged move shows ? beside the card where it landed', async ({ page }) => {
    await openDiagram(page, 7);   // a 2♠, b A♥ over A♠, waste 2♥
    await dragTo(page, card(page, 'AH'), card(page, '2S'));
    await expect(snaps(page)).toHaveCount(2);
    await expect(snaps(page).nth(1).locator('.dg-mark')).toHaveText('?');
    await expect(snaps(page).nth(0).locator('.dg-mark')).toHaveCount(0);
  });

  test('older snapshots slide off to the left, and back on Undo; the win card sits above the diagram', async ({ page }) => {
    await openDiagram(page, 1);
    for (const id of ['AS', '2H', 'AH', '2S']) { await card(page, id).click(); await settle(page); }
    await expect(snaps(page)).toHaveCount(5);
    await expect.poll(() => strip(page).evaluate((e) => e.style.transform)).toBe('translateX(0px)');
    await card(page, '2H').click();
    await expect(snaps(page)).toHaveCount(6);
    await expect.poll(() => strip(page).evaluate((e) => e.style.transform)).not.toBe('translateX(0px)');
    await expect(page.locator('#winPanel')).toBeVisible();
    const win = await page.locator('.win-card').first().boundingBox();
    const dia = await page.locator('#diagram').boundingBox();
    expect(win.y + win.height).toBeLessThanOrEqual(dia.y);
    await page.keyboard.press('Control+z');   // Undo the winning move
    await expect(snaps(page)).toHaveCount(5);
    await expect.poll(() => strip(page).evaluate((e) => e.style.transform)).toBe('translateX(0px)');
  });

  test('stays open across a reload, and stays put whatever the columns', async ({ page }) => {
    await openDiagram(page, 1);
    await page.reload();
    await pickShuffle(page, 2);
    await expect(page.locator('#diagram')).toBeVisible();
    // Undo: on the status line, its right edge level with the last foundation's.
    const undo = await page.locator('#undoBtn').boundingBox();
    const lastFound = await page.locator('.slot.foundation').last().boundingBox();
    const status = await page.locator('#status').boundingBox();
    expect(Math.round(undo.x + undo.width)).toBe(Math.round(lastFound.x + lastFound.width));
    expect(Math.abs((undo.y + undo.height / 2) - (status.y + status.height / 2))).toBeLessThan(1);
  });
});

test.describe('settings', () => {
  test('4 suits: menus and foundations in the order ♠ ♥ ♣ ♦', async ({ page }) => {
    await openApp(page);
    await page.locator('#suitsBtn').click();
    await expect(page.locator('#suitsList li').nth(1)).toHaveAttribute('aria-label', '4 (spades, hearts, clubs, diamonds)');
    await page.locator('#suitsList li').nth(1).click();
    await expect(page.locator('#ruleLine')).toContainText('Setup 3443');
    const labels = await page.locator('.slot.foundation').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(labels).toEqual(['Spades foundation', 'Hearts foundation', 'Clubs foundation', 'Diamonds foundation']);
    await expect(page.locator('#columnsSel')).toHaveValue('4');
  });

  test('settings are remembered across a reload', async ({ page }) => {
    await openApp(page);
    await page.locator('#drawSel').selectOption('1');
    await page.reload();
    await expect(page.locator('#drawSel')).toHaveValue('1');
    await expect(page.locator('#ruleLine')).toContainText('Setup 3221');
  });

  test('Card font sets the card faces\' font without reshuffling, and is remembered', async ({ page }) => {
    await openApp(page);
    await deal(page);
    const faceFont = () => page.locator('.card .idx').first().evaluate((el) => getComputedStyle(el).fontFamily);
    await expect(page.locator('#cardFontSel')).toHaveValue('libertinus');
    expect(await faceFont()).toContain('Libertinus Mono Cards');
    // Only the card faces change: the record keeps its own font.
    expect(await page.locator('#steps .step').first().evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Cousine Record');
    const before = await recordText(page);
    await page.locator('#cardFontSel').selectOption('original');
    expect(await faceFont()).toContain('Libre Bodoni');
    expect(await recordText(page)).toBe(before);                  // same game, nothing reshuffled
    await expect(page.locator('#confirmModal')).toBeHidden();
    await page.reload();
    await expect(page.locator('#cardFontSel')).toHaveValue('original');
    expect(await faceFont()).toContain('Libre Bodoni');           // applied to the cards, not just the menu
  });
});

test.describe('layout', () => {
  for (const [width, where] of [[1400, 'left'], [1000, 'left'], [800, 'below'], [400, 'below']]) {
    test(`at ${width}px the record is ${where} of the table, with no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openApp(page);
      const rec = await page.locator('#record').boundingBox();
      const board = await page.locator('#board').boundingBox();
      if (where === 'left') expect(rec.x + rec.width).toBeLessThanOrEqual(board.x);
      else expect(rec.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('game play diagram, 8-card deal', () => {
  test('labels the deal with its number in its own list', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 13);
    await page.locator('#diagramBtn').click();
    await expect(page.locator('#diagram')).toBeVisible();
    await deal(page);
    expect(await page.locator('#diagram .dg-head-text').allTextContents()).toEqual(['4223 D/CS1']);
  });
});
