# Midnight Hold'em · 夜局

Online Texas Hold'em for phone browsers, with no sign-up: pick a nickname, open a table, and send the four-character room code to friends.

- The host's browser runs the table (PeerJS, peer to peer), so the host keeps the page open.
- Add bots when you're short of players, or practice solo.
- English by default; the globe button switches to 中文 (saved per device).
- The host can lock the room and remove players.

手机浏览器里玩的联网德州扑克，不用注册：起个昵称、开桌，把 4 位房间码发给朋友就能一起玩。房主的浏览器就是这桌的服务器，房主页面要一直开着。首页右上角可以切换中文。

## Build

Source lives in `src/`. `python3 src/build.py` inlines the fonts, PeerJS, the rules engine and the artwork into the single root `index.html` that GitHub Pages serves.

## Credits

- [PeerJS](https://peerjs.com) (MIT) for the peer-to-peer connection.
- [Fraunces](https://github.com/undercasetype/Fraunces) and [Manrope](https://github.com/sharanda/manrope), SIL Open Font License 1.1 (see `src/fonts/`).
