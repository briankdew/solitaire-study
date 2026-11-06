# Roadmap

Work planned for n-Card Solitaire, in the order the items were raised (2026-11-05).

## 1. X for ten, everywhere — done 2026-11-05

Write a ten as **X** instead of T in every place a rank appears: card faces, the Highest card
setting, the game record (on screen and copied), and the record header (`X473`). Every card
stays two characters (`XC`). Games saved with T ids are converted on load.

## 2. Vertical game-record carousel on the left — done 2026-11-05

Move the game-record ticker from under the table to a vertical, scrolling carousel on the left
side of the playing area, newest at the bottom. Mock-up received 2026-11-05; details agreed so far:

- **Display only.** The handwritten notation stays the standard for recording, copying and
  exporting (Copy record is unchanged). The carousel is a visual aid; if the standard changes,
  the carousel follows it.
- **Panel:** "Game Record" above, **Copy record** below, card-colored steps between green end bars.
  No card pictures; red suits in red, black suits in black.
- **Steps:** one per action. The deal step is labeled **D** (the waste line plus one line per
  column, so 3 to 8 lines). A move step is numbered and has two right-aligned lines, each cards
  then a pile letter: the card moved and its destination, then what is now showing on the source
  pile and its letter (`--` when empty). A waste step is one line. An **EOP** step ends the record
  (e.g. `W7` in green for a win in 7 moves).
- **Waste lines** show every face-up waste card the player can see after the change, from `--` up
  to the Draw count (e.g. `2♦ 2♣ w`), even where the official record names fewer.
- **Scrolling:** each step slides up over the step above it, covering it from the bottom, and pins
  at the top edge. The scrolling is smooth with no snapping, and it stops when the last step's
  bottom edge reaches the bottom edge. No scrolling when everything fits. The window's height is a
  whole number of move-step heights. Each step's top edge casts a shadow up onto the step above
  (black 25%, 1px up, 6px blur). A new step scrolls into view at the bottom.
- **Alignment:** every character lines up in columns. Use a monospaced font whose suits are its
  own characters (Cousine, built into the page as a subset), with the small gap between cards made
  by page styling rather than a U+2006 character. Step labels (D, move numbers, EOP) in Archivo at
  85% size, gray #666666, not monospaced.
- **Look (2026-11-06):** green end bars (#5d8071), a little taller than the corner radius. The
  "GAME RECORD" title is styled like the setting labels and lines up with "HIGHEST CARD" across
  the table.
- **Waste turnover:** turning the waste over becomes "revealing the next cards in the waste": one
  click turns it over and turns up the next cards, recorded as one waste step. The stock shows a
  card back whenever any cards are hidden (in the real stock or under the waste fan). When none
  are hidden, clicking the stock only shakes the waste and records nothing (no undo step). The
  stock count badge counts only the real stock.
- **Letter colors:** pile letters of the player's own moves are blue (including `h` as a source);
  every `w` and everything in the deal step is gray. Move numbers are gray.
- **Numbering:** move steps are numbered, counting every move including the automatic finish's.
  Waste steps aren't numbered (a turnover isn't a move).
- **Automatic finish** must use the fewest moves: only column-to-foundation plays, one per card.
  (It already does: the lowest card left is always on top of its column and always fits its
  foundation, so it can never get stuck.)
- **EOP:** `W` plus the number of moves, in green, written automatically on a win. `L` plus the
  number of moves (red) is written by a new **End game** button below Quit, for recording losses
  by hand until the end-of-play check is worked out (that moves up in priority after the
  carousel). End game stops play like Quit (no undo). The result is part of the official
  notation: the last token on the Play line (`W7`, `L34`), counting move tokens.

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
- **Fine-tuning (2026-11-06):** every menu is as wide as the Suits menu needs for "4" and four
  suits (6rem), with the setting names just left of the menus; "Highest card" is now "High card";
  the Moves counter is gone (moves are numbered in the game record); the action buttons stretch to
  the settings' width; the gap between the table and the settings is doubled (64px). The page
  stacks into one column below about 1160px wide, where the side columns stop fitting.
- The Game Record is as narrow as its widest line allows (13.5ch): the deal's first line at Draw 4
  ("D" + four cards + w) is wider than a move line with a three-digit number. Lines after a step's
  first may use the label's space. The gap from the record to the table matches the settings side
  (64px).

## Related, deferred: end-of-play (EOP) check

After each move, check whether any progressive move is left, and flag the player when none is.
Regressive moves (foundation back to a column) stay allowed. Agreed definition: no w-c, w-n or
c-n move is available (counting any waste card that rotation can bring to the top), and no chain
of c-c moves leads to a reveal or to one of those moves.
