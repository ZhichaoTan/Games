# Games

Two table games for phone browsers that you play online with friends. There's no sign-up: pick a name, open a table and send the four-letter room code (or the invite link) to your friends.

- **Midnight Hold'em**: https://zhichaotan.github.io/Games/
- **Sichuan Mahjong**: https://zhichaotan.github.io/Games/mahjong/

The switch at the top of each lobby takes you to the other game. Your name, avatar and language carry over. Both games are in English by default, and the globe button switches them to Chinese.

## How online play works

The host's browser runs the table. Friends connect to it directly over WebRTC (PeerJS for the handshake, public STUN/TURN servers for the connection), so there's no game server and nothing is stored online. The host keeps the page open while you play.

- If someone's connection drops, a bot plays their turns until they come back. Opening the same link again puts them back in their seat.
- Friends who arrive after the game has started take over a bot's seat.
- The host can add or remove bots, change their level, remove players, and save the game to carry on later with the same room code.
- Short of players? Add bots, or practice on your own against bots. Practice works offline.

## Midnight Hold'em

No-limit Texas Hold'em for 2 to 9 players.

- Bots come in four levels: IQ 70 (Rookie), 100 (Regular), 130 (Shark) and 160 (Genius). Pick one level or a mix, and the host can tap a bot's IQ in the menu to change it. Bots that go broke buy back in by themselves. Bot speed (Instant, Fast, Normal, Slow) is set under Practice or in the host's menu.
- Points: 1 point buys 1 chip. Everyone gets 5,000 free points a day. Sitting down takes your buy-in from your points, and leaving turns your chips back into points. Three mini-games earn more points (Higher or Lower, Who Wins?, Memory Pairs), and there's a switch for unlimited points. Points are kept in this browser only.
- Odds helper (the % button): your chance of winning if the other players still in hold random cards, the win chance a call needs to pay off, and your chances of making each hand by the river. It's off by default.
- The host can lock the room.
- Need a break? The host's Leave button offers "Save & continue later". The hand being played is called off, everyone's chips and what they've borrowed are kept, and the same room code brings everyone back. "End the game" shows the final standings and turns everyone's chips back into points.
- Going broke: borrow another stack, from your points or free with unlimited points. What each player has borrowed shows in front of their chips, and the player list shows each player's win or loss.
- Fair seats: cards are shuffled with the browser's cryptographic random numbers (Fisher–Yates), the first dealer is drawn at random, and the button moves one seat every hand. Large simulations of the engine show the same card luck, all-in win rate and blind costs for every seat.

## Sichuan Mahjong

Four players, Bloody Battle (血战到底) rules.

- 108 tiles: Characters, Bamboo and Dots, 1 to 9, four of each. There are no chows; you can only pung, kong or win.
- Swap three: after the deal everyone passes three tiles of one suit, clockwise, counter-clockwise or across. The host can turn this off.
- Void suit: everyone gives up one suit and has to discard all of it before they can win.
- Bloody Battle: whoever wins steps out and the others play on, until one player is left or the wall runs out. Several players can win on the same discard.
- Kongs pay at once: an exposed kong is paid by the player who discarded the tile, the others by everyone still playing. If the tile you discard right after a kong lets someone win, that kong's money goes to the winner.
- When the wall runs out, a player still holding their void suit pays everyone, players who aren't ready pay those who are, and players who aren't ready hand back their kong money.
- A win scores the base points × 2 to the power of the fan count, up to the room's fan cap. Fan come from the hand (All Pungs, Full Flush, Seven Pairs, Golden Hook, 2-5-8 Pungs, Terminals Everywhere and more), from each set of four identical tiles, and from how you won (Kong Bloom, Robbing the Kong, Last Tile, Heavenly and Earthly Hands). A self-drawn win collects from everyone still playing, plus one base point or one fan, as the host sets.
- Host options: number of rounds, fan cap, how self-draws score, how a win off a discarded kong counts, swap three, extra fan (terminals and 2-5-8, concealed and all simples, heavenly and earthly hands), base points and a turn timer.
- Bots come in four levels: Rookie, Regular, Shark and Genius. Stronger bots pick better swaps and void suits, count the tiles that have gone and play safe when someone looks ready.
- Tap a tile to select it, then tap it again or drag it up to discard it. You can also slide along your hand to pick a tile. With hints on, a dot marks the tiles that leave you ready, and a selected tile shows what you'd be waiting on and how many of those tiles are left.
- Autoplay hands your turns to a bot for a while, and "Take over" gives them back.

## Build

Each game is one self-contained HTML file that GitHub Pages serves as it is.

- Hold'em: the source is in `src/`. `python3 src/build.py` inlines the fonts, PeerJS, the rules engine and the artwork into the root `index.html`.
- Mahjong: the source is in `mahjong/src/`. `python3 mahjong/src/build.py` writes `mahjong/index.html`. It reuses the fonts, PeerJS and avatars from `src/`.
- Mahjong tests: `node mahjong/tests/engine.test.js` checks the rules and scoring, and `node mahjong/tests/sim.js` plays long bot-only matches.
- `mahjong/dev/` has the Playwright scripts used to try the game in a headless browser: `play.js` (autoplay screenshots), `human.js` (taps, drags and buttons like a player), and `online.js` (four browsers on a local PeerServer, including a dropped connection and a mid-game join).

## Credits

- [PeerJS](https://peerjs.com) (MIT) for the peer-to-peer connection.
- [Fraunces](https://github.com/undercasetype/Fraunces) and [Manrope](https://github.com/sharanda/manrope), SIL Open Font License 1.1 (see `src/fonts/`).
- [Ma Shan Zheng](https://fonts.google.com/specimen/Ma+Shan+Zheng) for the brush lettering on the mahjong tiles and titles, SIL Open Font License 1.1 (a subset is in `mahjong/src/fonts/`).
