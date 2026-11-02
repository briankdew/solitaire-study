# n-Card Solitaire

A small Klondike-style solitaire for learning how the game works, with a deck you can size from 4 to 52 cards. The default game uses six cards, the A, 2 and 3 of spades and diamonds. Cards are turned from the stock three at a time, and an empty column accepts the **highest card** (a 3 in the six-card game) instead of a King.

It's a single static web page with no build step and no dependencies.

## Settings

| Setting | Options | Default |
| --- | --- | --- |
| Highest card | 2, 3, 4 … 10, J, Q, K | 3 |
| Columns | 2, 3, 4 | 2 |
| Suits | 2 (♠ ♦) or 4 (♠ ♥ ♣ ♦) | 2 |

The deck is every rank from Ace to the highest card in each suit, so K with 4 suits is a full 52-card deck. Changing a setting deals a new game, and the browser remembers your choice. A column count is unavailable if the deal would leave no cards for the stock; for example, with 2 suits, 3 columns needs a highest card of 4 or more, and 4 columns needs 6 or more.

## Rules

- **Deal:** a staircase. Column 1 gets 1 card, column 2 gets 2, and so on, with only the last card in each column face up. The remaining cards form the stock, and the first three are turned over onto the waste right away, so a card can be played immediately.
- **Goal:** build each suit from Ace up to the highest card on the foundations (one per suit).
- **Stock and waste:** the latest three waste cards are fanned so they all show, and only the top card can be played. Clicking the stock turns three more; when it's empty, a click turns the waste back over. Passes are unlimited.
- **Columns:** build down in alternating colors (red on black, black on red). An empty column takes only the highest card, or a run that starts with it.
- **Foundations:** start with an Ace and build up by suit. A card on a foundation can be moved back to a column.
- A face-down card flips over as soon as it's uncovered.

## Controls

| Action | Result |
| --- | --- |
| Click the stock | Turn over three cards, or turn the waste back over |
| Click the top waste card | Play it to the leftmost column that takes it, otherwise to its foundation |
| Click a face-up column card | Same rule; the cards on top of it move with it as a group (a group can only go to a column) |
| Click an Ace (waste or column) | Always goes straight to a foundation, even if a column could take it |
| Click a foundation's top card | Bring it back down to the leftmost column that takes it |
| Drag a face-up card | Move it, along with the cards on top of it, to a column or foundation |
| Enter on a focused card | Same as clicking it |
| Ctrl+Z / ⌘Z, or **Undo move** | Take back the last move |
| **Restart game** | Start the same deal over from the beginning |
| **New game** | Shuffle and deal a new game |

Once the stock and waste are empty and every card is face up, the game finishes itself. When you win, the panel offers **New deal**, **Same deal** (replay the same shuffle) or **Quit** (clear the table, leaving the empty pile outlines).

## Run it locally

Open `index.html` in a browser. To serve it instead:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Tests

The rules live in `game.js` as pure functions that don't touch the page, and they're tested with Node's built-in test runner (Node 18 or newer, no install needed):

```sh
npm test
```

## Project layout

```
index.html        page, styles, rendering and input handling
game.js           game rules (works in the browser and in Node)
tests/            rule tests (node --test)
```

## Publishing on GitHub Pages

```sh
git init
git add .
git commit -m "Six-card solitaire"
git branch -M main
git remote add origin git@github.com:<your-username>/solitaire-study.git
git push -u origin main
```

Then open **Settings → Pages** in the repository, set **Source** to *Deploy from a branch*, and pick `main` / `(root)`. The game will be served at `https://<your-username>.github.io/solitaire-study/`.
