# Six-Card Solitaire

A tiny Klondike-style solitaire played with six cards: the A, 2 and 3 of spades and diamonds. Cards are turned from the stock three at a time, and an empty column accepts a **3** instead of a King.

It's a single static web page with no build step and no dependencies.

## Rules

- **Deal:** two columns. Column 1 has one face-up card. Column 2 has one face-down card under one face-up card. The other three cards are turned over onto the waste right away, so a card can be played immediately.
- **Goal:** build each suit from Ace up to 3 on the two foundations.
- **Stock and waste:** the waste is fanned so all three cards show, and only the top card can be played. When the stock is empty, clicking it turns the waste back over; the next click turns three cards again. Passes are unlimited.
- **Columns:** build down in alternating colors (red on black, black on red). An empty column takes only a 3, or a run that starts with a 3.
- **Foundations:** start with an Ace and build up by suit. A card on a foundation can be moved back to a column.
- A face-down card flips over as soon as it's uncovered.

## Controls

| Action | Result |
| --- | --- |
| Click the stock | Turn over three cards, or turn the waste back over |
| Click the top waste card | Play it to the leftmost column that takes it, otherwise to its foundation |
| Click a face-up column card | Same rule; the cards on top of it move with it as a group (a group can only go to a column) |
| Click an Ace (waste or column) | Always goes straight to a foundation, even if a column could take it |
| Drag a face-up card | Move it, along with the cards on top of it, to a column or foundation |
| Enter on a focused card | Same as clicking it |
| Ctrl+Z / ⌘Z, or **Undo** | Take back the last move |
| **New game** | Deal again |

Once the stock and waste are empty and every card is face up, the game finishes itself.

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
