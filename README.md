# Games

Table games for phone browsers that you play online with friends. There's no sign-up: pick a name, open a table and send the four-letter room code (or the invite link) to your friends.

- **Home page**, with the list of games: https://zhichaotan.github.io/Games/
- **Midnight Hold'em**: https://zhichaotan.github.io/Games/poker/
- **Sichuan Mahjong**: https://zhichaotan.github.io/Games/mahjong/

Tap a game on the home page to open its lobby, and the "All games" button at the top of each lobby goes back. Each game has its own rooms, so friends can be in different games at the same time. Your name, avatar and language carry over from game to game. Everything is in English by default, and the globe button switches to Chinese.

Hold'em used to be at the top of the site, so an old invite link like `/Games/#ABCD` still opens that Hold'em room.

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

Four players, Bloody Battle (血战到底) rules, every player for themselves or in 2v2 teams.

- 108 tiles: Characters, Bamboo and Dots, 1 to 9, four of each. There are no chows; you can only pung, kong or win.
- Swap three: after the deal everyone passes three tiles of one suit, clockwise, counter-clockwise or across. The host can turn this off.
- Void suit: everyone gives up one suit. You can't win while you hold any of it and you can't pung or kong it, but when you discard it is up to you (the host can make it go first). Anyone still holding some when the wall runs out is a flower pig.
- Bloody Battle: whoever wins steps out and the others play on, until one player is left or the wall runs out. Several players can win on the same discard.
- Passing a win: if you could win on someone's tile and don't, then until your next draw you can only win on a discard worth more fan than the one you passed. The table says so while it applies.
- Kongs pay at once: an exposed kong is paid by the player who discarded the tile, the others by everyone still playing. If the tile you discard right after a kong lets someone win, that kong's money goes to the winner.
- When the wall runs out, a player still holding their void suit pays everyone, players who aren't ready pay those who are, and players who aren't ready hand back their kong money.
- A win scores the base points × 2 to the power of the fan count, up to the room's fan cap. Fan come from the hand (All Pungs, Full Flush, Seven Pairs, Golden Hook, 2-5-8 Pungs, Terminals Everywhere and more), from each set of four identical tiles, and from how you won (Kong Bloom, Robbing the Kong, Last Tile, Heavenly and Earthly Hands). A self-drawn win collects from everyone still playing, plus one base point or one fan, as the host sets.
- Dealer: the first dealer is random. The first player to win deals the next round, or the discarder if that first win was several players winning on one discard. If nobody wins, the dealer stays.
- Host options: free-for-all or 2v2 teams, number of rounds, fan cap, how self-draws score, how a win off a discarded kong counts, swap three, whether the void suit must be discarded first, extra fan (terminals and 2-5-8, concealed and all simples, heavenly and earthly hands), base points and a turn timer.
- 2v2 teams: partners sit across from each other and play as one side. You see your partner's hand face up and they see yours, while the other team sees neither. You can't win off your partner's discard, money only moves between the two teams, and the round ends once both players of one team have won. In the room, the host taps "Make partner" on the player they want to team up with, and the other two play together. In practice your partner is the bot across the table.
- Partner swap: on your turn, after you draw, tap Swap, pick the tile you want from your partner's hand and one of yours to give back (of a different kind), and tap Ask. Your partner sees what the swap does for both hands and taps Swap or No; after 20 seconds it counts as a no. A swap you get counts as a fresh draw, so you can win on the tile your partner gave you. One request per turn, and swaps stop once either partner has won. The host sets how many swaps each player gets per round: 1, 2, 3 (the default), 5 or no limit. Bots ask for a swap when it wins them the hand, or when it helps without setting either hand back, and they agree to swaps that cost them little.
- Bots come in four levels: Rookie, Regular, Shark and Genius. Stronger bots pick better swaps and void suits, count the tiles that have gone and play safe when someone looks ready.
- Tap a tile to select it, then tap it again or drag it up to discard it. You can also slide along your hand to pick a tile. With hints on, a dot marks the tiles that leave you ready, and a selected tile shows what you'd be waiting on and how many of those tiles are left.
- Autoplay hands your turns to a bot for a while, and "Take over" gives them back.

## Build

Each page is one self-contained HTML file that GitHub Pages serves as it is. The sources are next to it, and each build script inlines the fonts, artwork and code.

- Home page: the source is `hub/index.html`. `python3 hub/build.py` writes the root `index.html`. It reuses the fonts, avatars and seal from `poker/src/` and four tile faces from `mahjong/src/tiles.js`.
- Hold'em: the source is in `poker/src/`. `python3 poker/src/build.py` writes `poker/index.html`.
- Mahjong: the source is in `mahjong/src/`. `python3 mahjong/src/build.py` writes `mahjong/index.html`. It reuses the fonts, PeerJS, avatars and the zoom guard (`nozoom.js`) from `poker/src/`.
- Mahjong tests: `node mahjong/tests/engine.test.js` checks the rules and scoring, and `node mahjong/tests/sim.js` plays long bot-only matches.
- `mahjong/dev/` has the Playwright scripts used to try the game in a headless browser: `play.js` (autoplay screenshots), `human.js` (taps, drags and buttons like a player), `online.js` (four browsers on a local PeerServer, including a dropped connection and a mid-game join), `team.js` (2v2 practice, asking for and answering swaps through the buttons) `online2v2.js` (a 2v2 room in four browsers: choosing a partner, a swap between two people, a dropped partner rejoining) and `rules.js` (both void-suit settings, the passed-win notice and the lobby option). It also has the scripts that made the generated files: `maketiles.py` (`mahjong/src/tiles.js`), `makesfx.py` (`mahjong/src/sfx.js`) and `makefont.py` (the brush-font subset). `hub/makefont.py` makes the home page's brush-font subset.

### Adding a game

Put it in its own folder at the top of the repo, named after the game (the folder name becomes the address, like `/Games/poker/`). Give its lobby an "All games" link to `../`, add an entry to the `GAMES` list in `hub/index.html` with its card artwork, and run `python3 hub/build.py`. Each card has a Chinese and an English version of its lettering and artwork, and they don't mix: no English wordmark on the Chinese page, and no Chinese seal or characters on the English one. Use a PeerJS id prefix of its own so its rooms stay separate, and keep the shared `mh_name`, `mh_av` and `mh_lang` settings so players keep their name, avatar and language.

## Credits

- [PeerJS](https://peerjs.com) (MIT) for the peer-to-peer connection.
- [Fraunces](https://github.com/undercasetype/Fraunces) and [Manrope](https://github.com/sharanda/manrope), SIL Open Font License 1.1 (see `poker/src/fonts/`).
- [Ma Shan Zheng](https://fonts.google.com/specimen/Ma+Shan+Zheng) for the brush lettering on the mahjong titles and the home page, SIL Open Font License 1.1 (subsets in `mahjong/src/fonts/` and `hub/fonts/`).
- Mahjong tile faces: [riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles) by FluffyStuff, public domain (CC0), recoloured slightly. The optimised copies come from the npm package [@johnmorrisdotca/jarajara](https://www.npmjs.com/package/@johnmorrisdotca/jarajara) (MIT, © 2026 John Morris).
- Mahjong table sounds: [Casino Audio](https://kenney.nl/assets/casino-audio) by Kenney, CC0 1.0, in the short cuts shipped with the same jarajara package.
