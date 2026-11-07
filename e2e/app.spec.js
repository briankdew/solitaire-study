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

  test('the menu lists Random and the 12 deals, spade first', async ({ page }) => {
    await openApp(page);
    await page.locator('#shuffleBtn').click();
    const items = page.locator('#shuffleList li');
    await expect(items).toHaveCount(13);
    await expect(items.nth(0)).toHaveText('Random');
    await expect(items.nth(1)).toHaveAttribute('aria-label', /^Deal 1: Ace of spades, 2 of spades, Ace of hearts, 2 of hearts$/);
    await expect(items.nth(12)).toHaveAttribute('aria-label', /^Deal 12: 2 of spades, 2 of hearts, Ace of hearts, Ace of spades$/);
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
    await card(page, 'AH').click();   // no other column took it before, so this is a new move onto 2♠
    await expect.poll(() => recordText(page)).toBe('D A♠ a A♥ b 2♥ w 1 A♠ h -- a 2 A♥ h 2♠ b 3 A♥ b -- h');
  });

  test('clicking a card again on its foundation sends it to the column instead (take-back)', async ({ page }) => {
    await openApp(page);
    await pickShuffle(page, 7);   // 2♠ A♠ A♥ 2♥: a 2♠, b A♥ over A♠, waste 2♥
    await deal(page);
    await card(page, 'AH').click();   // to its foundation, though column a could take it
    await settle(page);
    await card(page, 'AH').click();   // straight back: rewritten as the move to column a
    await expect.poll(() => recordText(page)).toBe('D 2♠ a A♥ b 2♥ w 1 A♥ a A♠ b');
    await page.locator('#undoBtn').click();
    await expect.poll(() => recordText(page)).toBe('D 2♠ a A♥ b 2♥ w');
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
