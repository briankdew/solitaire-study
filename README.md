# n-Card Solitaire

A small Klondike-style solitaire for learning how the game works, with a deck you can size from 4 to 52 cards. The default game uses six cards, the A, 2 and 3 of clubs and diamonds. Cards are turned from the stock one to four at a time (three by default), and an empty column accepts the **highest card** (a 3 in the six-card game) instead of a King.

It's a single static web page with no build step and no dependencies.

## Settings

| Setting | Options | Default |
| --- | --- | --- |
| High card | 2, 3, 4 … 9, X, J, Q, K (X is ten) | 3 |
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
| Click the stock | Turn over the next 1–4 cards (the **Draw** setting). Once the stock runs out it shows the refresh arrow while waste cards are hidden, and a click turns the waste back over onto the stock and turns up the next cards in one go; with every card showing, the stock is empty and a click just shakes the waste |
| Click the top waste card | Play it to its foundation if it can go there, otherwise to the leftmost column that takes it |
| Click a face-up column card | Same rule; the cards on top of it move with it as a group (a group can only go to a column) |
| Click a card again on the foundation, right after a click sent it there | Send it to the column the click would otherwise have chosen instead: the record's foundation move is rewritten as the column move, no move is added, and Undo puts the card back where it started |
| Click a foundation's top card | Bring it back down to the leftmost column that takes it |
| Drag a face-up card | Move it, along with the cards on top of it, to a column or foundation |
| Enter on a focused card | Same as clicking it |
| Ctrl+Z / ⌘Z, or **Undo move** | Take back the last action. The button reads **Undo draw** when that action was a turn of the stock |
| **Deal** | Deal the waiting shuffle and start play |
| **Restart deal** | Deal the current shuffle again and start play from the beginning |
| **New shuffle** | Mix the cards without dealing. If a game is in play, it first warns *Reshuffling will end the current game!* with Continue and Cancel |
| **Quit** | Stop play and leave the table exactly as it is, until Restart deal or New shuffle |
| **End game** | Stop play like Quit and record the game as a loss (`L` and the move count) |

Moves (numbered in the game record) count cards played to a column or foundation, including the automatic finish's; turning the stock over isn't a move. The automatic finish plays only straight to the foundations, one move per card, which is the fewest possible.

Once the stock and waste are empty and every card is face up, the game finishes itself. Turn **Auto-complete** off to play every card yourself; switching it never reshuffles, and turning it off mid-finish stops the finish where it is. When you win, the panel offers **New deal** (shuffle and deal a new game), **Same deal** (deal this shuffle again) or **Quit** (stop, leaving the table as it is).

## Game record

The **Game Record** panel on the left shows the game as it is played, one step per action, newest at the bottom. Each step slides up over the one above it and pins at the top edge as you scroll. It is a visual aid; **Copy record** copies the official record, the notation used to write a game down by hand, described below. The letters above the table name the piles: **s** stock, **w** waste, **h** foundations, **a**, **b**, **c**… columns.

In the panel, each line is cards then a pile letter, in a monospaced font (Cousine, as a subset with its own suit symbols, in `fonts/`) so everything lines up; step labels are smaller, in Archivo. **D** is the deal; a numbered step is a move (the card and where it went, then what now shows on the pile it came from); an unnumbered step is a stock turn showing every waste card in view. Pile letters of the player's own moves are blue; the deal and the waste are gray. **EOP** ends a finished game with the result.

Every item is a card followed by its pile letter. Cards are rank then suit, two characters each, with **X** for ten (`XC`, `AH`). On screen suits are shown as symbols; the official record uses the letters S, H, C, D.

- **Deal:** the waste cards turned up, left to right with the playable card last, then each column's face-up card: `2D2C3Cw 3Da ADb`.
- **Move:** the card moved (the bottom card of a run) and where it went, then the new top card of the pile it came from and that pile's letter. `--` marks a pile that is now empty: `ADhACb`, `2Dh--w`.
- **Turn:** each turn of the stock names the cards turned up, like the deal's first item (`8S4H9Dw`). A turn with the stock empty turns the waste back over first, in the same action.
- **Result:** a finished game ends with `W` (won) or `L` (lost, from **End game**) and the number of moves, which is the number of move tokens: `W104`, `L34`.

Undo removes the last item. The copied record has a **Setup** line (highest card, suits, columns, draw), then the deal and the play:

```
Setup: 3223
Deal: 2D2C3Cw 3Da ADb
Play: ADhACb ACh--b 3Cb2Cw 2Ch2Dw 2Dh--w 3Dh--a 3Ch--b W7
```

## Page layout

The play area keeps a fixed size, tall enough for the longest column any settings allow, so it never changes when the settings do. The status line sits above it; the settings, the action buttons and How to play are stacked on its right, and the Game Record panel is on its left. On screens narrower than about 1160px everything stacks in one column. Planned work is listed in `ROADMAP.md`.

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
fonts/            Cousine subset, the record panel's font (Apache 2.0 license included)
ROADMAP.md        planned work
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
