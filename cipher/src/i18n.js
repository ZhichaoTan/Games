// ===== English and Chinese. The language is shared with the other games (localStorage mh_lang); English by default =====
(function (G) {
  'use strict';
  const S = {
    en: {
      title: 'Cipher', titleA: 'Cipher', titleB: 'NUMBER TILES', allGames: 'All games', rules: 'Rules', langBtn: '中文',
      tagline: 'Work out the numbers your friends are hiding<br>before they work out yours',
      wx: 'Opened inside WeChat? Tap ··· at the top right and open it in your browser. Online play is steadier there.',
      yourName: 'Your name', namePh: 'Up to 10 characters',
      tabJoin: 'Join', tabHost: 'Host', tabSolo: 'Practice',
      join: 'Join', joinHint: 'Ask a friend to open a room and send you the code',
      create: 'Open a room', startSolo: 'Start',
      oKeys: 'Keys', oOn: 'On', oOff: 'Off', oTimer: 'Timer', oNoTimer: 'Off', oSec: '{n}s', oOpp: 'Opponents', oLevel: 'Bots', oMixed: 'Mixed',
      keysNote: 'Two key tiles that fit anywhere in a row. Turn them off for the plain game.',
      lvNames: ['Rookie', 'Regular', 'Shark', 'Genius'],
      lvDesc: ['Reasons it out loosely and guesses on a whim', 'Works out the whole table and plays it safe', 'Works it all out and presses on when the odds are good', 'Works it all out and thinks one guess ahead'],
      needName: 'Pick a name first', badCode: 'Room codes are four letters or digits',
      howTo: 'How to play', settings: 'Settings',
      foot: 'Two to four players. Send friends the four-letter room code to play together, or practise against bots.',
      resume: 'Resume', rejoin: 'Rejoin', resumeSolo: 'Unfinished practice game · round {n}', resumeHost: 'Room <b>{c}</b> is still open', resumeClient: 'You were in room <b>{c}</b>',
      botNames: ['Ada', 'Max', 'Juno', 'Leo', 'Iris', 'Otto', 'Nova', 'Felix'],
      // room
      roomCode: 'Room code', copyInvite: 'Copy invite', share: 'Share', copied: 'Invite copied',
      invite: 'Come and play Cipher with me! Room {c}: {u}',
      seatOpen: 'Open seat', seatWait: 'Waiting for a friend', addBot: 'Add a bot', hostTag: 'Host', youTag: 'you', botTag: 'Bot',
      kick: 'Remove', start: 'Start', needTwo: 'At least two players are needed',
      waitHost: 'Waiting for the host to start', roomHint: 'Send friends the code. An empty seat can take a bot.',
      sumKeys: 'with keys', sumNoKeys: 'no keys', sumTimer: '{n}s a move', sumNoTimer: 'no timer',
      offline: 'offline', full: 'This room is full', kicked: 'The host removed you from the room', ended: 'The host closed the room',
      connecting: 'Joining room {c}…', notFound: 'Can’t find room {c}. Check the code, or ask the host whether the room is still open',
      hostGone: 'Lost the host. Reconnecting…', slow: 'Taking a while. Still trying…', netBad: 'Not connected right now', opening: 'Opening the room…',
      idTaken: 'Couldn’t get the room back. Please open a new one', cancel: 'Cancel', backLobby: 'Lobby', ok: 'OK',
      kaTitle: 'Cipher · room {c}', kaTip: 'Keep this page open while you play. Switching apps for a while is fine (in Safari or Chrome)',
      joined: '{n} joined', leftRoom: '{n} left', dropped: '{n} dropped out. A bot covers until they’re back', isBack: '{n} is back', tookOver: '{n} took over a bot’s seat',
      paused: 'Paused', pausedBy: 'The host paused the game',
      // table
      roundN: 'Round {n}', roomChip: 'Room {c}', practice: 'Practice',
      hiddenN: '{n} hidden', outTag: 'Out', thinking: 'Thinking…', autoTag: 'Bot playing',
      black: 'black', white: 'white', Black: 'Black', White: 'White', keyName: 'key',
      pArrange: 'Shuffling and dealing…', pKey: 'You have a key. It fits anywhere: tap a gap in your row to put it in', pKeyWait: 'Waiting for everyone to arrange their tiles',
      pDraw: 'Your turn. Draw a tile', pPick: 'Tap one of the hidden tiles in front of your opponents',
      pPickEmpty: 'Nothing left to draw: a miss now turns up one of your own tiles', pGuess: 'What is it?', guessBtn: 'Guess {v}', guessKey: 'Guess the key',
      pHit: 'Got it! Guess again, or stop and keep your new tile hidden', pHitNo: 'Got it! Guess again, or stop here', stop: 'Stop here',
      pWhere: 'Next to a key there’s a choice. Where does your new tile go?', pReveal: 'Missed. Pick one of your own tiles to turn up', revealBtn: 'Turn this one up',
      pWaitDraw: '{n} is drawing', pWaitGuess: '{n} is choosing a tile', pWaitMore: '{n} is deciding whether to go on', pWaitReveal: '{n} is picking a tile to turn up',
      pOut: 'You’re out. Stay and see who wins', pPeek: 'Tap any hidden tile to see what it could be',
      notTurn: 'Wait for your turn', leftSec: '{n}s left',
      tDraw: '{n} drew a {c} tile', tHit: '{n} cracked {t} {v}', tMiss: '{n} guessed {v}. Wrong', tFlip: '{n} turned up {v}', tStop: '{n} stopped',
      tOut: '{n} is out', tWin: '{n} wins!', tPlay: '{n} goes first', youName: 'you', yourTile: 'your', theirTile: '{n}’s',
      fxOut: 'Out', fxWin: 'You win', fxLose: 'Round over',
      // results
      resWin: 'You win!', resWho: '{n} wins', rankN: ['1st', '2nd', '3rd', '4th'], ptsN: '+{n}', total: 'Total', ptsShort: 'pts',
      statLine: '{h} right · {m} wrong', nextRound: 'Next round', waitNext: 'Waiting for the host to start the next round', peek: 'See the table',
      ptsNote: 'A point for every player you outlast.',
      // menu, settings, chat
      menu: 'Menu', autoplay: 'Let a bot play for me', autoplaySub: 'Until you take over again', takeOver: 'Take over', pause: 'Pause', unpause: 'Resume',
      players: 'Players', inviteMore: 'Invite', endRoom: 'Close the room', leaveRoom: 'Leave the room', leaveQ: 'Leave the room?',
      leaveSub: 'A bot takes your seat. Open the link again to come back', leaveSubHost: 'You’re the host: leaving closes the room for everyone',
      quitSolo: 'Back to the lobby', quitSoloSub: 'This round is kept, so you can pick it up later',
      hSettings: 'Settings', sSound: 'Sound', sSoundSub: 'Tiles, hits and misses', sVib: 'Vibration', sHints: 'Hints', hintOff: 'Off', hintSimple: 'Simple', hintExact: 'Exact',
      sHintsSub: 'Simple greys out the values you can rule out at a glance. Exact works through the whole table and shows each value’s chance.',
      sSpeed: 'Bot speed', spFast: 'Fast', spNormal: 'Normal', spSlow: 'Slow', sLang: 'Language',
      chat: 'Chat', chatPh: 'Say something', send: 'Send',
      phrases: ['Phew, close one', 'How did you get that?', 'Leave me alone!', 'I know what you’ve got', 'Lucky guess', 'Let me think…', 'Your turn, hurry up', 'Nicely done'],
      winTag: 'Winner', nextTag: 'Next round', pCould: 'What it could be', pSpect: 'You’ll join in from the next round', back: 'Back',
      autoOn: 'A bot is playing for you', lvMixDesc: 'Each bot gets a level at random', joinedNext: '{n} joined and plays from the next round',
      savedRoom: 'The host saved this game for later', kickQ: 'Remove {n} from the room?', endQ: 'Close the room for everyone?',
      waitFor: 'Waiting for {n}', nextIn: 'Next round in {s}s', backRes: 'Results', resOver: 'Round over',
      hRules: 'How to play',
      rulesHtml: '<p>There are 24 number tiles, black and white, each colour from 0 to 11, plus two key tiles (the host can leave those out). Everyone can see the colour of every tile; only its owner knows the number.</p>' +
        '<h4>Setting up</h4><p>With two or three players everyone gets 4 tiles, with four players 3. Your tiles stand in a row from smallest to largest, left to right. When a black and a white tile share a number, the black one goes on the left.</p>' +
        '<h4>Your turn</h4><p>Draw a tile from the pool: you choose black or white. Then tap one of an opponent’s hidden tiles and say what number it is.</p>' +
        '<p><b>Right:</b> that tile is turned face up. Guess again (any opponent), or stop: your new tile then goes into your row face down.</p>' +
        '<p><b>Wrong:</b> your new tile goes into your row face up and your turn ends. The wrong number is noted under the tile for everyone to see.</p>' +
        '<p><b>Nothing left to draw:</b> just guess. If you’re wrong, turn up one of your own hidden tiles.</p>' +
        '<h4>Keys</h4><p>A key has no number, so it can stand anywhere in a row; you choose where when you get it. You can guess that a hidden tile is the key.</p>' +
        '<h4>Winning</h4><p>Once all your tiles are face up, you’re out. The last player with a hidden tile wins the round. Every round scores a point for each player you outlast.</p>' +
        '<h4>Hints</h4><p>When you pick a tile, the number pad greys out what it can’t be. Settings can turn this off, or switch to the exact version that works through the whole table.</p>',
    },
    zh: {
      title: '数字密码', titleA: '数字密码', titleB: '', allGames: '全部游戏', rules: '规则', langBtn: 'English',
      tagline: '猜出对手藏着的数字<br>守住你自己的',
      wx: '在微信里打开的？点右上角 ··· 用浏览器打开，联机会更稳。',
      yourName: '你的名字', namePh: '最多 10 个字',
      tabJoin: '加入', tabHost: '开房', tabSolo: '练习',
      join: '加入', joinHint: '让朋友开个房间，把房间码发给你',
      create: '开一个房间', startSolo: '开始',
      oKeys: '钥匙牌', oOn: '带', oOff: '不带', oTimer: '限时', oNoTimer: '不限', oSec: '{n} 秒', oOpp: '对手', oLevel: '电脑', oMixed: '混合',
      keysNote: '两张钥匙牌，放在哪儿都行。不带就是最基本的玩法。',
      lvNames: ['新手', '普通', '高手', '大师'],
      lvDesc: ['大概推一推，猜得比较随性', '整张桌子都会算，打得稳', '全都算清楚，机会好就接着猜', '全都算清楚，还会多想一步'],
      needName: '先起个名字', badCode: '房间码是四位字母或数字',
      howTo: '怎么玩', settings: '设置',
      foot: '2 到 4 人。把四位房间码发给朋友一起玩，也可以跟电脑练手。',
      resume: '继续', rejoin: '回去', resumeSolo: '有一局练习没打完 · 第 {n} 局', resumeHost: '房间 <b>{c}</b> 还开着', resumeClient: '你刚才在房间 <b>{c}</b>',
      botNames: ['阿青', '老唐', '小满', '豆豆', '七七', '阿哲', '米粒', '大熊'],
      roomCode: '房间码', copyInvite: '复制邀请', share: '分享', copied: '邀请已复制',
      invite: '来玩数字密码！房间 {c}：{u}',
      seatOpen: '空位', seatWait: '等朋友进来', addBot: '加电脑', hostTag: '房主', youTag: '你', botTag: '电脑',
      kick: '请出', start: '开始', needTwo: '至少要两个人',
      waitHost: '等房主开始', roomHint: '把房间码发给朋友，空位可以加电脑。',
      sumKeys: '带钥匙牌', sumNoKeys: '不带钥匙牌', sumTimer: '每步 {n} 秒', sumNoTimer: '不限时',
      offline: '掉线了', full: '房间满了', kicked: '房主把你请出了房间', ended: '房主解散了房间',
      connecting: '正在进入房间 {c}…', notFound: '找不到房间 {c}。检查一下房间码，或者问问房主房间还开着没',
      hostGone: '和房主断开了，正在重连…', slow: '有点慢，还在连…', netBad: '现在没连上', opening: '正在开房…',
      idTaken: '房间找不回来了，重新开一个吧', cancel: '取消', backLobby: '回大厅', ok: '好',
      kaTitle: '数字密码 · 房间 {c}', kaTip: '玩的时候别关这个页面，临时切出去没关系（用 Safari 或 Chrome）',
      joined: '{n} 进来了', leftRoom: '{n} 走了', dropped: '{n} 掉线了，电脑先帮着打', isBack: '{n} 回来了', tookOver: '{n} 接替了电脑的位置',
      paused: '已暂停', pausedBy: '房主暂停了游戏',
      roundN: '第 {n} 局', roomChip: '房间 {c}', practice: '练习',
      hiddenN: '暗牌 {n}', outTag: '出局', thinking: '思考中…', autoTag: '托管中',
      black: '黑', white: '白', Black: '黑', White: '白', keyName: '钥匙',
      pArrange: '洗牌、发牌…', pKey: '你拿到了钥匙牌，放在哪儿都行：点你牌里的一个空隙放进去', pKeyWait: '等大家理好牌',
      pDraw: '轮到你了，摸一张牌', pPick: '点对手面前的一张暗牌',
      pPickEmpty: '牌堆摸完了：这回猜错，要翻开自己的一张', pGuess: '你猜是几？', guessBtn: '猜 {v}', guessKey: '猜是钥匙',
      pHit: '中了！接着猜，还是收手把新牌藏好？', pHitNo: '中了！接着猜，还是到此为止？', stop: '收手',
      pWhere: '新牌挨着钥匙牌，左右都能放。放哪边？', pReveal: '没猜中，挑一张自己的牌翻开', revealBtn: '翻开这张',
      pWaitDraw: '{n} 在摸牌', pWaitGuess: '{n} 在挑牌', pWaitMore: '{n} 在想要不要接着猜', pWaitReveal: '{n} 在挑一张自己的牌翻开',
      pOut: '你出局了，留下来看看谁赢', pPeek: '点任意一张暗牌，看看它可能是几',
      notTurn: '还没轮到你', leftSec: '还剩 {n} 秒',
      tDraw: '{n} 摸了一张{c}牌', tHit: '{n} 猜中了 {t}{v}', tMiss: '{n} 猜 {v}，没中', tFlip: '{n} 亮出了 {v}', tStop: '{n} 收手了',
      tOut: '{n} 出局了', tWin: '{n} 赢了！', tPlay: '{n} 先来', youName: '你', yourTile: '你的', theirTile: '{n} 的',
      fxOut: '出局', fxWin: '你赢了', fxLose: '本局结束',
      resWin: '你赢了！', resWho: '{n} 赢了', rankN: ['1', '2', '3', '4'], ptsN: '+{n}', total: '总分', ptsShort: '分',
      statLine: '猜中 {h} · 猜错 {m}', nextRound: '再来一局', waitNext: '等房主开下一局', peek: '看看牌桌',
      ptsNote: '比几个人坚持得久，就得几分。',
      menu: '菜单', autoplay: '托管', autoplaySub: '让电脑先帮你打，随时可以拿回来', takeOver: '我自己来', pause: '暂停', unpause: '继续',
      players: '玩家', inviteMore: '邀请', endRoom: '解散房间', leaveRoom: '离开房间', leaveQ: '离开房间？',
      leaveSub: '电脑会接替你的位置。再点一次邀请链接就能回来', leaveSubHost: '你是房主，离开会解散房间',
      quitSolo: '回大厅', quitSoloSub: '这一局会存着，下次接着打',
      hSettings: '设置', sSound: '声音', sSoundSub: '摸牌、猜中、猜错', sVib: '振动', sHints: '推理提示', hintOff: '关', hintSimple: '简单', hintExact: '精确',
      sHintsSub: '简单：一眼就能排除的数字变灰。精确：把整张桌子算一遍，标出每个数字的可能性。',
      sSpeed: '电脑速度', spFast: '快', spNormal: '正常', spSlow: '慢', sLang: '语言',
      chat: '聊天', chatPh: '说点什么', send: '发送',
      phrases: ['好险好险', '这也能猜中？', '别盯着我猜了', '我知道你那张是几', '运气不错嘛', '让我想想…', '到你了，快点', '厉害厉害'],
      winTag: '赢家', nextTag: '下局加入', pCould: '它可能是', pSpect: '下一局开始你就能加入', back: '返回',
      autoOn: '电脑正在帮你打', lvMixDesc: '每个电脑随机一个水平', joinedNext: '{n} 进来了，下一局加入',
      savedRoom: '房主把这局存起来了，下次接着玩', kickQ: '把 {n} 请出房间？', endQ: '解散房间？',
      waitFor: '等 {n}', nextIn: '{s} 秒后开始下一局', backRes: '看结果', resOver: '本局结束',
      hRules: '怎么玩',
      rulesHtml: '<p>一共 24 张数字牌，黑白两色，每种颜色都是 0 到 11。另外还有黑白两张钥匙牌（房主可以不要）。每张牌的颜色大家都看得到，数字只有主人自己知道。</p>' +
        '<h4>开局</h4><p>两三个人每人 4 张，四个人每人 3 张。自己的牌从左到右按数字从小到大立好，同一个数字黑的放在白的左边。</p>' +
        '<h4>轮到你</h4><p>先从牌堆里摸一张，黑的白的自己挑。然后点对手的一张暗牌，猜它是几。</p>' +
        '<p><b>猜中了</b>：那张牌翻开。你可以接着猜（猜谁都行），也可以收手，新摸的牌就扣着放进你的牌里。</p>' +
        '<p><b>猜错了</b>：新摸的牌要亮着放进你的牌里，这一轮结束。猜错的数字会记在那张牌下面，大家都看得到。</p>' +
        '<p><b>牌堆摸完了</b>：直接猜。猜错的话，从自己的暗牌里挑一张翻开。</p>' +
        '<h4>钥匙牌</h4><p>钥匙牌没有数字，放在一排里的哪个位置都行，拿到的时候自己决定放哪儿。猜别人的牌时也可以猜“钥匙”。</p>' +
        '<h4>输赢</h4><p>牌全被翻开就出局，最后一个还留着暗牌的人赢下这一局。每局按名次得分：比几个人坚持得久，就得几分。</p>' +
        '<h4>推理提示</h4><p>选中一张牌时，数字键盘会把它不可能是的数字变灰。设置里可以关掉，或者换成精确模式，把整张桌子都算进去。</p>',
    },
  };
  const read = () => { try { return JSON.parse(localStorage.getItem('mh_lang')); } catch (e) { return null; } };
  let lang = read() === 'zh' ? 'zh' : 'en';
  function t(k, v) {
    let s = S[lang][k]; if (s == null) s = S.en[k];
    if (typeof s !== 'string') return s;
    return v ? s.replace(/\{(\w+)\}/g, (_, x) => (v[x] != null ? v[x] : '')) : s;
  }
  function setLang(l) { lang = l === 'zh' ? 'zh' : 'en'; try { localStorage.setItem('mh_lang', JSON.stringify(lang)); } catch (e) {} if (G.document) G.document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }
  if (G.document) G.document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  G.CXI18N = { t, setLang, get lang() { return lang; }, S };
  if (typeof module !== 'undefined' && module.exports) module.exports = G.CXI18N;
})(typeof window !== 'undefined' ? window : globalThis);
