# n-Card Solitaire

A small Klondike-style solitaire for learning how the game works, with a deck you can size from 4 to 52 cards. The default game uses six cards, the A, 2 and 3 of clubs and diamonds. Cards are turned from the stock one to four at a time (three by default), and an empty column accepts the **highest card** (a 3 in the six-card game) instead of a King.

It's a single static web page with no build step and no dependencies.

## Settings

| Setting | Options | Default |
| --- | --- | --- |
| Highest card | 2, 3, 4 … 9, T, J, Q, K (T is ten) | 3 |
| Suits | 2 (♣♦) or 4 (♠♥♣♦) | 2 |
| Columns | 2, 3, 4, 5, 6, 7 (at least one per suit) | 2 |
| Draw | 1, 2, 3 or 4 cards turned from the stock at a time | 3 |
| Auto-complete | On or off | On |

The deck is every rank from Ace to the highest card in each suit, so K with 4 suits is a full 52-card deck. Changing a setting shuffles a new deck for the new settings (with the same warning as **New shuffle** if a game is in play). The browser remembers your choices. There are always at least as many columns as suits. The highest card can only go to an empty column or a foundation, so with fewer columns than suits some highest cards could never head a column, and the game would play differently from normal solitaire. A column count is also unavailable if the deal would leave no cards for the stock; the settings line shows what each one needs. With 2 suits, 3 columns needs a highest card of 4 or more, 4 needs 6, 5 needs 8 and 6 needs J; 7 columns needs 4 suits. With 4 suits, columns start at 4, which needs a highest card of 3 or more (so 4 suits can't use a highest card of 2); 5 needs 4, 6 needs 6 and 7 needs 8.

## Rules

- **Shuffle, then deal:** shuffling only mixes the cards. A shuffled deck waits face down in the stock, with a **Deal** button on the last waste position, and nothing is dealt until you click it (or choose **Restart deal**, **New deal** or **Same deal**). The page opens with a shuffled deck waiting.
- **Deal:** a staircase. Column 1 gets 1 card, column 2 gets 2, and so on, with only the last card in each column face up. The remaining cards form the stock, and the first ones (as many as one turn takes) are turned over onto the waste right away, so a card can be played immediately.
- **Goal:** build each suit from Ace up to the highest card on the foundations (one per suit).
- **Stock and waste:** the waste has one dashed position per card drawn (three in the default draw-three game), and its top cards always fill them from the left, with the top card on the right and the only one that can be played. Playing it slides the others right and brings the next card up into position 1; with fewer cards left than positions, they fill the positions from the left. Clicking the stock turns over as many cards as the **Draw** setting; when it's empty, a click turns the waste back over. Passes are unlimited. Once one turn or less is left in the stock (three or fewer cards when drawing three), the top card shows how many, the way you'd see it in your hand.
- **Columns:** build down in alternating colors (red on black, black on red). An empty column takes only the highest card, or a run that starts with it.
- **Foundations:** start with an Ace and build up by suit. A card on a foundation can be moved back to a column.
- **Pile names:** a letter above each pile names it for writing down play: **s** stock, **w** waste, **n** foundations, and **a**, **b**, **c**… the columns from left to right.
- A face-down card flips over as soon as it's uncovered.

## Controls

| Action | Result |
| --- | --- |
| Click the stock | Turn over the next 1–4 cards (the **Draw** setting), or turn the waste back over |
| Click the top waste card | Play it to the leftmost column that takes it, otherwise to its foundation |
| Click a face-up column card | Same rule; the cards on top of it move with it as a group (a group can only go to a column) |
| Click an Ace (waste or column) | Always goes straight to a foundation, even if a column could take it |
| Click a foundation's top card | Bring it back down to the leftmost column that takes it |
| Drag a face-up card | Move it, along with the cards on top of it, to a column or foundation |
| Enter on a focused card | Same as clicking it |
| Ctrl+Z / ⌘Z, or **Undo move** | Take back the last action, including a turn of the stock |
| **Deal** | Deal the waiting shuffle and start play |
| **Restart deal** | Deal the current shuffle again and start play from the beginning |
| **New shuffle** | Mix the cards without dealing. If a game is in play, it first warns *Reshuffling will end the current game!* with Continue and Cancel |
| **Quit** | Stop play and leave the table exactly as it is, until Restart deal or New shuffle |

The move counter counts cards played to a column or foundation; turning the stock over isn't a move.

Once the stock and waste are empty and every card is face up, the game finishes itself. Turn **Auto-complete** off to play every card yourself; switching it never reshuffles, and turning it off mid-finish stops the finish where it is. When you win, the panel offers **New deal** (shuffle and deal a new game), **Same deal** (deal this shuffle again) or **Quit** (stop, leaving the table as it is).

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
