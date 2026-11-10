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

## 3. Game play diagram — first version built 2026-11-08 (custom shuffles only)

Terminology draft (2026-11-09, not yet discussed): see TERMINOLOGY.md.

Show the game as it is played so decision points can be studied wherever two or more plays were
possible. The goal is to visualize, evaluate and eventually automate play of every possible game
for a shuffle.

Built (from the user's swimlane mock-ups): a panel over the lower play area, toggled by the
**Game play diagram** button at the bottom of the play area (remembered; enabled for the 12 custom shuffles only).
Rows are the piles (w, columns, each foundation), each showing its top card (the waste its fan,
covered cards shaded). One snapshot per action: the deal (`2223 D/CS1`), each numbered move, each
**Draw** (not numbered). Lines between snapshots: no change (white), reveal (dashed white arrow:
a face-down card turned over), promote (dotted white arrow: a known card comes to the top, in the
waste or a column), possible play (dashed gold: every other legal move, unpruned), draw
(dashed gold arrow), selected play (solid gold arrow). No stubs for the current position. Older
snapshots slide off to the left; Undo slides them back. The win card centers above the diagram.

Judgments (2026-11-08): moves are judged with the chess marks (! good, !! brilliant, ? mistake,
?? blunder, !? interesting, ?! dubious). Nothing is blocked: the player decides, by click or drag.
So far only ? is used, for two clearly regressive moves: an Ace played to a column (from anywhere)
and a 2 taken off its foundation. A judgment is never stored; `G.judgeMove` works it out from the
move, so changing the rules re-judges old games. Shown before the card in the record panel
(`? A♥ a`), first in the official token (`?AHa--h`), and after the card where it landed in the
diagram (`A♥ ?`, #666666). Later: ?? or !? for a move or draw made while a progressive play was
showing; ! on the cards of better moves not played, once move quality can be quantified.

How it works: the diagram is rebuilt from the game record replayed on the dealt shuffle
(`G.replayRecord`, `G.diagramModel`, `G.legalMoves` in game.js; drawing in ui/diagram.js), so
Undo, the take-back and a reloaded game all follow. The same replay is what saved games (item 5)
will need, and the diagram is SVG, so exporting the finished diagram as an image is a small step.

Next, after the user tries it: classify possible plays (progressive / null / regressive) to decide
what to prune; open item 7 from the design talk (face-down counts and runs in column cells);
expand beyond the custom shuffles.

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
  the settings' width; the gap between the table and the settings is doubled (64px).
- **Reflow (2026-11-06):** at 1160px wide and below, the settings column moves under the play area;
  at 900px and below, the Game Record moves under the play area too, left of the settings; at
  440px and below (phones), everything stacks in one column.
- The Game Record is 13.5ch wide, set when the deal's first line was its waste line at Draw 4
  ("D" + four cards + w). Since 2026-11-06 the deal lists the columns first and the waste last,
  and lines after a step's first may use the label's space, so the record could now be a little
  narrower. The gap from the record to the table matches the settings side
  (64px).

## 5. Saving games (not started; added 2026-11-06)

Nothing is saved today except the settings (in the browser). A game in progress is lost when the
page is closed or reloaded; the only carry-over is on the claude.ai preview, where a game survives
a republish while the tab stays open. Copy record is the only way to keep a game now.

To decide when this is picked up:
- **Where:** in the browser on one device (simplest), a file to download and load again, or
  somewhere shared across devices.
- **What:** the record text alone (with the shuffle order, enough to replay the game exactly), or
  the full game so it can be resumed where it stopped.
- How saved games are listed, opened, and tied to the study work (e.g. which deals of a setup have
  been played).
- The user wants (2026-11-08): saved game records that replay automatically, and an image of each
  finished game play diagram to export and study. `G.replayRecord` already replays a record on its
  dealt shuffle, and the diagram is drawn as SVG.

## 6. Shuffle menu and the standard deal — done 2026-11-07

A **Custom shuffle** menu under Draw picks a numbered deal or Random, and is always available. Each deal is
a deck order, top card first, shown left to right after its number. Choosing one changes the other
settings to the ones its list gives (high card, suits, columns) with Draw 3. The first list is the
4-card deck (high card 2, 2 suits, 2 columns): 12 deals, one from each pair that trading the suits
makes the same game. More lists go in `SHUFFLE_LISTS` in game.js.
Added 2026-11-10: a 4223 list (8 cards) with one deal, `AS 3H 4H 3S AH 2S 4S 2H`, reconstructed from
the record of a won game. The menu now shows each list under a setup heading, numbering restarts in
each list (the diagram label uses that number: `4223 D/CS1`), and a deal longer than 4 cards shows
`number · setup` on the closed menu button.

The deal is now standard Klondike for every setting: rows from the top of the deck (one card to each
column, first face up, then a row from the next column), and the leftover stock keeps deck order, so
the next card off the deck is the next one turned. (Before, columns were filled one at a time and
the stock was upside down. With 2 columns the deal is the same either way.)

## 7. Standard suit order ♠ ♥ ♣ ♦ — done 2026-11-07

Suits everywhere follow ♠ ♥ ♣ ♦. Two suits are ♠ and ♥ (they were ♣ and ♦), in the Suits menu,
the deck, and the Custom shuffle deals (re-lettered ♦→♠, ♣→♥, so the list stays spade-first and
each deal is the same game as before). Foundations are fixed to the suit order, left to right, each
showing A and its suit while empty and taking only its own Ace. The order alternates colors. Games saved before the change are
dropped for a fresh shuffle.

## 8. Browser tests and splitting the page's code — done 2026-11-07

Groundwork for the larger items above. 23 Playwright browser tests (`npm run test:e2e`) now cover
what a player does on the page, alongside the 79 rule tests. The page's 1,080-line inline script
became ten JavaScript modules in `ui/` and its styles moved to `styles.css`, with no change to how the
app looks or plays (screenshots at three widths are pixel-identical to before).

## Related, deferred: end-of-play (EOP) check

After each move, check whether any progressive move is left, and flag the player when none is.
Regressive moves (foundation back to a column) stay allowed. Agreed definition: no w-c, w-n or
c-n move is available (counting any waste card that rotation can bring to the top), and no chain
of c-c moves leads to a reveal or to one of those moves.
