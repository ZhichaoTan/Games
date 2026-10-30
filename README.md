# Midnight Hold'em · 夜局

Online Texas Hold'em for phone browsers, with no sign-up: pick a nickname, open a table, and send the four-character room code to friends.

- The host's browser runs the table (PeerJS, peer to peer), so the host keeps the page open.
- Add bots when you're short of players, or practice solo against 1–8 bots.
- Bots come in four levels: IQ 70 (Rookie), 100 (Regular), 130 (Shark) and 160 (Genius). Pick one level or a mix, and the host can tap a bot's IQ in the menu to change it. Bots that go broke rebuy by themselves.
- Points: 1 point buys 1 chip. Everyone gets 5,000 free points a day, sitting down takes your buy-in from your points, and leaving turns your chips back into points. Three mini-games earn more points (Higher or Lower, Who Wins?, Memory Pairs), and there is an unlimited-points switch. Points are kept in this browser only.
- Odds helper (the % button): your chance to win if the other players still in hold random cards, the win chance a call needs to pay off, and your chances of each hand by the river. Off by default.
- English by default; the globe button switches to 中文 (saved per device).
- The host can lock the room and remove players.

手机浏览器里玩的联网德州扑克，不用注册：起个昵称、开桌，把 4 位房间码发给朋友就能一起玩。房主的浏览器就是这桌的服务器，房主页面要一直开着。

- 机器人分四档智商：70 新手、100 普通、130 高手、160 大师，可以混着来，也可以指定；房主在菜单里点机器人的 IQ 就能换。机器人输光了会自己补码。
- 积分：1 积分换 1 个筹码。每天免费领 5,000；入座从积分里扣，离桌筹码换回积分。三个小游戏（比大小、谁的牌大、翻牌配对）可以赚积分，也可以打开无限积分。积分只存在这个浏览器里。
- 胜率辅助（右上角 % 按钮）：按对手随机手牌估算你现在的胜率，标出跟注需要多少胜率才划算，以及到河牌时各种牌型的概率。默认关闭。
- 首页右上角可以切换中文。

## Build

Source lives in `src/`. `python3 src/build.py` inlines the fonts, PeerJS, the rules engine and the artwork into the single root `index.html` that GitHub Pages serves.

## Credits

- [PeerJS](https://peerjs.com) (MIT) for the peer-to-peer connection.
- [Fraunces](https://github.com/undercasetype/Fraunces) and [Manrope](https://github.com/sharanda/manrope), SIL Open Font License 1.1 (see `src/fonts/`).
