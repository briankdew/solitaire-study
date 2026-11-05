# Roadmap

Work planned for n-Card Solitaire, in the order the items were raised (2026-11-05).

## 1. X for ten, everywhere — done 2026-11-05

Write a ten as **X** instead of T in every place a rank appears: card faces, the Highest card
setting, the game record (on screen and copied), and the record header (`X473`). Every card
stays two characters (`XC`). Games saved with T ids are converted on load.

## 2. Vertical game-record carousel on the left

Move the game-record ticker from under the table to a vertical, scrolling carousel on the left
side of the playing area, newest at the bottom. The pictures above each token will be redesigned
to be less visually disruptive. **Waiting on the user's mock-up.**

## 3. Node diagram of the game

Show the game's tokens as nodes, left to right, so decision forks can be studied wherever two or
more plays were possible. The goal is to visualize, evaluate and eventually automate play of every
possible game for a shuffle.

- First version: the diagram builds as the game is played. It shows the path taken, with a fork
  wherever other plays were available, and a stub for each path not taken.
- It is drawn over the play area only when the **Node Diagram** button is clicked.
- **Waiting on the user's mock-up.**

## 4. Fixed-size play area, with controls on the right — done 2026-11-05 (fine-tuning to follow)

Free the top and bottom of the page so the play area can have a fixed size that never changes
and always fits the tallest possible column of cards.

- Settings and action buttons move to a vertical stack on the right of the play area (settings
  above the buttons), with **How to play** below them.
- The status line moves above the play area, just below the rule under the page title.
- Sizes and positions get fine-tuned once everything is in its new place.

## Related, deferred: end-of-play (EOP) check

After each move, check whether any progressive move is left, and flag the player when none is.
Regressive moves (foundation back to a column) stay allowed. Agreed definition: no w-c, w-n or
c-n move is available (counting any waste card that rotation can bring to the top), and no chain
of c-c moves leads to a reveal or to one of those moves.
