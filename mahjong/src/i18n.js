// ===== 中英文 =====  语言和扑克共用一个设置（localStorage mh_lang），默认英文
(function (G) {
  'use strict';
  const S = {
    en: {
      title: 'Sichuan Mahjong', titleA: 'Sichuan', titleB: 'MAHJONG', allGames: 'All games', rules: 'Rules', langBtn: '中文',
      tagline: 'Bloody Battle rules · Swap three · Void suit<br>Send friends a four-letter room code and play',
      wx: 'Opened inside WeChat? Tap ··· at the top right and open it in your browser. Online play is steadier there and your progress is kept.',
      yourName: 'Your name', namePh: 'Up to 10 characters',
      tabJoin: 'Join', tabHost: 'Host', tabSolo: 'Practice',
      join: 'Join', joinHint: 'Ask a friend to open a room and send you the code',
      create: 'Open a room', startSolo: 'Start practice',
      foot: 'Sichuan Bloody Battle: 108 tiles and no chows.<br>Give up one suit and discard it first. Winners step out; the rest play on.',
      needName: 'Pick a name first', badCode: 'Room codes are four letters or digits',
      oRounds: 'Rounds', oCap: 'Fan cap', oZimo: 'Self-draw', oDgh: 'Kong bloom', oSwap: 'Swap three', oExtra: 'Extras', oBase: 'Base points', oTimer: 'Turn timer', oBots: 'Bots', oSpeed: 'Bot speed',
      nRounds: '{n}', noLimit: 'No limit', nFan: '{n} fan', noCap: 'None', zDi: '+1 base', zFan: '+1 fan', dPao: 'Kong giver pays', dZimo: 'Everyone pays',
      on: 'On', off: 'Off', xYjjd: 'Terminals, 2-5-8', xMqzz: 'Concealed, simples', xTdh: 'Heaven & earth', tOff: 'Off', tSec: '{n}s',
      lv: ['', 'Rookie', 'Regular', 'Shark', 'Genius'], lvMix: 'Mixed', spFast: 'Fast', spNormal: 'Normal', spSlow: 'Slow',
      resumeHost: 'Room <b>{c}</b> is unfinished · round {r}', resumeSolo: 'Your practice game is unfinished · round {r}', resumeClient: 'You were playing in room <b>{c}</b>',
      resume: 'Resume', rejoin: 'Rejoin', discard: 'Discard',
      roomCode: 'Room code', copyInvite: 'Copy invite', share: 'Share', copied: 'Invite copied. Send it to your friends',
      invite: 'Come play Sichuan mahjong with me! Room {c}: {u}',
      seatOpen: 'Open seat', seatWait: 'Waiting for a friend', addBot: 'Add a bot', hostTag: 'Host', youTag: 'You',
      start: 'Start', startFill: 'Start · bots fill open seats', waitHost: 'Waiting for the host to start…', leave: 'Leave',
      sumRounds: '{n} rounds', sumNoLimit: 'no round limit', sumCap: '{n} fan cap', sumNoCap: 'no fan cap', sumDi: 'self-draw +1 base', sumFan: 'self-draw +1 fan', sumSwap: 'swap three', sumNoSwap: 'no swap', sumBase: 'base {n}', sumTimer: '{n}s per move',
      opening: 'Opening the room…', connecting: 'Connecting to room {c}…', notFound: "Can't find room {c}. Check the code, or wait for the host to open it.",
      full: 'The room is full', hostGone: 'The host dropped out. Waiting for them to come back…', netBad: 'Connection hiccup, reconnecting…', slow: 'Slow to connect, trying again…',
      kicked: 'The host removed you from the room', saved: 'The host saved the game. Come back later with the same room code.', ended: 'The host ended the game',
      backLobby: 'Back to lobby', cancel: 'Cancel', ok: 'OK',
      joined: '{n} joined', leftRoom: '{n} left', tookOver: '{n} took over a bot seat', isBack: '{n} is back', dropped: '{n} dropped out. A bot plays for now.',
      roundOf: 'Round {r}/{n}', roundN: 'Round {r}', practice: 'Practice', roomChip: 'Room {c}', paused: 'Paused', pausedBy: 'The host paused the game',
      wall: 'left', stWon: 'Won', stZimo: 'Won', stOff: 'Offline', stAuto: 'Auto', stPicked: 'Ready', stPicking: 'Picking', stQued: 'Ready', stQuing: 'Choosing',
      ting: 'Ready', autoOn: 'Autoplay is on', autoOff: 'Take over',
      nLeft: '{n} left', nFanS: '{n} fan', nAll: '{n} in all', tipDiscard: 'Discard to wait on', tipWait: 'Waiting on',
      bPeng: 'Pung', bGang: 'Kong', bHu: 'Hu', bPass: 'Pass',
      swapH: 'Swap Three', swapS: 'Pick three tiles of one suit to pass on.<br>A set is picked for you; tap tiles to change it.', swapOk: 'Swap these three', waitOthers: 'Waiting for the others…',
      queH: 'Void Suit', queS: 'Choose a suit to give up. You can’t win until you’ve discarded all of it.', nTiles: '{n} tiles', rec: 'Suggested',
      suit: ['Characters', 'Bamboo', 'Dots'], suitS: ['C', 'B', 'D'],
      youWon: "You've won this round. Watch the others finish.", queFirst: 'Discard your {s} first',
      queLeft: 'You can’t win until your {s} are gone ({n} left)',
      passHuAny: 'You passed a win: no winning on discards until you draw', passHuMore: 'You passed a win: until you draw, only a win over {n} fan',
      oQue: 'Void tiles', qFree: 'Any time', qFirst: 'Must go first', sumQueFirst: 'void suit goes first',
      dirAcross: 'Swap across', dirRight: 'Counter-clockwise · to the right', dirLeft: 'Clockwise · to the left',
      cPeng: 'Pung', cGang: 'Kong', cRain: 'Rain', cWind: 'Wind', cHu: 'Hu', cZimo: 'Self-drawn', cBloom: 'Kong bloom', cRob: 'Robbed', cMulti2: 'Double win', cMulti3: 'Triple win', cZhuan: 'Kong money moves', cDraw: 'Draw', cWall: 'Wall empty', cCha: 'Ready check',
      toastQue: 'Discard your void suit first: {s}',
      vPeng: 'Pung', vGang: 'Kong', vHu: 'Hu', vZimo: 'Self drawn',
      resEnd: 'Round over', resDraw: 'Draw', resRound: 'Round {r}', resLast: 'final round',
      ord: ['', '1st', '2nd', '3rd'], dealerB: 'D', winOrder: '{o} to win · {h}',
      how: { zimo: 'self-drawn', pao: 'on a discard', rob: 'robbed a kong', dgh: 'kong bloom, giver pays' },
      hua: 'Flower pig · still holding the void suit', tingMax: 'Ready · up to {f} fan', noTing: 'Not ready', dealerP: 'Dealer · ', dealerW: 'Dealer', you: 'You', youS: ' (you)',
      lHu: '{h} · {t} · {f} fan', lHu0: '{h} · {t}', lHuN: ' ×{n}', lPayZimo: '{n} self-drew', lPayDgh: 'Kong bloom · {n}', lPayRob: 'Kong robbed by {n}', lPayPao: 'Dealt in to {n}',
      lGang: '{w} ({k})', kAn: 'concealed kong', kBu: 'added kong', kMing: 'exposed kong', lGangPay: "{n}'s {w}",
      lZhuan: 'Kong money moved to you', lZhuanPay: 'Kong money to {n}', lPig: 'Flower pig check', lPigPay: 'Flower pig', lCha: 'Ready check ({f} fan)', lChaPay: 'Not ready', lTax: 'Kong refund', lTaxPay: 'Kong refund',
      next: 'Next round', nextIn: 'Next round starts in {s}s', waitFor: 'Waiting for {n}', readyMe: 'Ready',
      final: 'Final standings', finalRounds: '{n} rounds', finalLine: '{w} wins · {z} self-drawn', bigFan: ' · best {f} fan', again: 'Play again', newMatch: 'New game',
      menu: 'Menu', mRoom: 'Room {c}', mPlayers: 'Players', mAuto: 'Autoplay', mHints: 'Ready hints', mSound: 'Sound', mVoice: 'Voice', mCall: 'Call out discards', mSc: 'Sichuan dialect', mVib: 'Vibration', mLang: 'Language', mSpeed: 'Bot speed',
      mPause: 'Pause', mResume: 'Resume', mLeave: 'Leave the table', mSaveLeave: 'Save & continue later', mEnd: 'End the game', mLeaveSolo: 'Back to lobby (saved)', mKick: 'Remove', mBotLv: 'Bot level', mSettings: 'Settings', mInvite: 'Invite',
      leaveQ: 'A bot will take over your seat. Leave the table?', endQ: 'Everyone will see the final standings. End the game now?',
      chat: 'Chat', send: 'Send', chatPh: 'Say something…',
      phrases: ['Hurry up!', 'Let me think…', 'Nice hand!', "I'm on a roll", 'That was close', 'Go easy on me', 'Well played', 'One more round?'],
      botNames: ['Ada', 'Bo', 'Coco', 'Dex', 'Echo', 'Fig', 'Gus', 'Hana'],
      fan: {
        '平胡': 'Plain Win', '对对胡': 'All Pungs', '清一色': 'Full Flush', '七对': 'Seven Pairs', '龙七对': 'Dragon Pairs', '清七对': 'Pure Seven Pairs', '清龙七对': 'Pure Dragon Pairs',
        '清对': 'Pure Pungs', '金钩钓': 'Golden Hook', '清金钩钓': 'Pure Golden Hook', '将金钩钓': '2-5-8 Golden Hook', '将对': '2-5-8 Pungs', '带幺九': 'Terminals Everywhere',
        '幺九对': 'Terminal Pungs', '清幺九': 'Pure Terminals', '十八罗汉': 'Eighteen Arhats', '清十八罗汉': 'Pure Eighteen Arhats',
        '根': 'Quad', '门清': 'Concealed', '中张': 'All Simples', '天胡': 'Heavenly Hand', '地胡': 'Earthly Hand', '杠上开花': 'Kong Bloom', '杠上炮': 'Kong Discard',
        '抢杠胡': 'Robbing the Kong', '海底捞月': 'Last Tile Draw', '海底炮': 'Last Tile Discard', '自摸': 'Self-drawn',
      },
      tile: (r, s) => (['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][r - 1]) + ' ' + ['character', 'bamboo', 'dot'][s],
      rulesTitle: 'How to play',
      rulesHTML: `<h4>The tiles</h4>108 tiles: Characters, Bamboo and Dots, 1 to 9, four of each. No chows; you can only pung, kong or win.
<h4>Swap three</h4>After the deal, everyone picks three tiles of one suit. They are passed clockwise, counter-clockwise or across, chosen at random.
<h4>Void suit</h4>Everyone gives up one suit. You can’t win while you still hold any of it, and you can’t pung or kong it. When you discard those tiles is up to you (a room can make them go first); anyone still holding some when the wall runs out is a flower pig.
<h4>Bloody battle</h4>Whoever wins steps out and the others play on, until one player is left or the wall runs out. Several players can win on the same discard.
<h4>A winning hand</h4>Four sets (runs or pungs) plus a pair, or seven pairs. Only two suits at most, since one suit is void.
<h4>Passing a win</h4>If you could win on someone’s tile and don’t (you pass, pung or kong instead), then until your next draw you can only win on a discard worth more fan than the one you passed. Self-draws aren’t affected.
<h4>Wind and rain</h4>Kongs pay at once. An exposed kong: the player who discarded pays 2× base. An added kong: everyone still playing pays 1×. A concealed kong: everyone still playing pays 2×. If you kong and then deal in, that kong money moves to the winner.
<h4>When the wall runs out</h4>Anyone still holding their void suit is a flower pig and pays everyone else the capped amount. Players who are not ready pay each ready player for that player's best hand. Players who are not ready return their kong money.
<h4>Scoring</h4>A win is worth base × 2<sup>fan</sup>, up to the fan cap. A discard win is paid by the player who discarded. A self-draw is paid by everyone still playing, plus one base (or one fan, depending on the room). A kong bloom off an exposed kong is paid either by the player who gave the kong, as a discard win, or by everyone, as a self-draw (a room setting).
<h4>Dealer</h4>The first dealer is random. After that, the first player to win deals the next round; if that first win was several players winning on one discard, the player who discarded deals. If nobody wins, the dealer stays.`,
      fanTable: [['All Pungs', 1], ['Full Flush (one suit)', 2], ['Seven Pairs', 2], ['Quad: each set of four identical tiles, kongs included', 1], ['Golden Hook: four melds out, waiting on one tile', 1], ['2-5-8 Pungs: all pungs of 2, 5 and 8 (optional)', 2], ['Terminals Everywhere: a 1 or 9 in every set and the pair (optional)', 2], ['Kong Bloom (win on the kong’s replacement tile) / Kong Discard (win on the discard right after a kong)', 1], ['Robbing the Kong (win on the tile someone adds to a pung)', 1], ['Last Tile: win on the wall’s last tile, or on the discard after it', 1], ['Heavenly Hand (dealer wins on the deal) / Earthly Hand (another player self-draws on their first draw); no pung or kong before it (optional)', 5], ['Concealed (no pung or exposed kong), All Simples (no 1 or 9) (optional)', 1], ['Self-draw, when the room adds a fan for it', 1]],
      fanNote: 'Fan add up. Examples: a full flush of all pungs is 3 fan; seven pairs with a set of four (Dragon Seven Pairs) is 3 fan; four kongs and a pair (Eighteen Arhats) is 6 fan, before the cap.',
      moreRules: 'More rules', idTaken: 'That room code is busy. Try again in a moment.', peek: 'View table', backRes: 'Results', lastRound: 'Last round', fanH: 'Fan',
      oMode: 'Mode', mFree: 'Free-for-all', mTeam: '2v2 teams', oTsw: 'Partner swaps', sumTeam: '2v2 teams', sumTsw: '{n} partner swaps a round', sumTswInf: 'unlimited partner swaps',
      mateTag: 'Partner', foeTag: 'Opponent', makeMate: 'Make partner', teamNote: 'Partners sit across from each other and can see each other\'s tiles.',
      stTs: 'Swapping', bTs: 'Swap', tsCanWin: 'Win', tsWin: 'win', tsReady: 'ready', tsAway: '{n} from ready', tsAfter: 'After the swap: you {a}, your partner {b}',
      tsAskH: 'Your partner wants to swap', tsGiveYou: 'You get', tsWantYour: 'You give', tsNo: 'No', tsYes: 'Swap',
      tsWaitH: 'Waiting for your partner…', tsYouGive: 'You give', tsYouTake: 'You get', tsBack: 'Take it back',
      tsH: 'Swap with your partner', tsLeftN: '{n} left this round', tslN: 'Swaps {n}', tslInf: 'Swaps ∞', tslNone: 'Swaps 0', tsPick1: "Tap the partner's tile you want", tsPick2: 'Now tap one of your tiles to give', tsSend: 'Ask',
      cTs: 'Swap', cTsNo: 'No swap', tsNoT: 'Your partner said no',
      teamUs: 'Your team', teamThem: 'Opponents', teamTot: 'Totals: your team {a} · opponents {b}', teamWin: 'Your team wins!', teamLose: 'The other team wins', teamTie: "It's a tie",
      rulesTeam: `<h4>2v2 teams</h4>Partners sit across from each other and can see each other's tiles. On your turn you can ask your partner for one tile and give one of yours back; it only happens if your partner agrees. Each player has a few swaps a round (set by the room), and how many you and your partner have left is always shown under your names. Swaps stop once either of you has won. If the tile you get completes your hand, you can declare a self-draw. Partners never pay each other, and you can't win on your partner's discard. The round ends when only one team is still playing, and the team with the higher total wins the game.`,
    },
    zh: {
      title: '四川麻将', titleA: '四川麻将', titleB: '', allGames: '全部游戏', rules: '规则', langBtn: 'English',
      tagline: '血战到底 · 换三张 · 定缺<br>约上朋友，发个四位房间码就能开打',
      wx: '在微信里打开的话，建议点右上角「···」用浏览器打开，联机更稳，进度也不会丢。',
      yourName: '你的名字', namePh: '最多 10 个字',
      tabJoin: '加入房间', tabHost: '开房间', tabSolo: '人机练习',
      join: '加入', joinHint: '朋友开好房间后，把四位房间码发给你',
      create: '开房间', startSolo: '开始练习',
      foot: '四川血战到底：一百零八张，不能吃，<br>定缺后先打缺门，胡了的人退出，其他人接着打。',
      needName: '先起个名字', badCode: '房间码是四位字母或数字',
      oRounds: '局数', oCap: '封顶', oZimo: '自摸', oDgh: '点杠花', oSwap: '换三张', oExtra: '加番', oBase: '底分', oTimer: '限时', oBots: '电脑', oSpeed: '电脑速度',
      nRounds: '{n} 局', noLimit: '不限', nFan: '{n} 番', noCap: '不封顶', zDi: '加底', zFan: '加番', dPao: '算点炮', dZimo: '算自摸',
      on: '开', off: '关', xYjjd: '幺九将对', xMqzz: '门清中张', xTdh: '天地胡', tOff: '不限', tSec: '{n} 秒',
      lv: ['', '新手', '普通', '高手', '大师'], lvMix: '混合', spFast: '快', spNormal: '正常', spSlow: '慢',
      resumeHost: '房间 <b>{c}</b> 还没打完 · 第 {r} 局', resumeSolo: '上次的练习还没打完 · 第 {r} 局', resumeClient: '你刚才在房间 <b>{c}</b>',
      resume: '继续', rejoin: '回到房间', discard: '不要了',
      roomCode: '房间码', copyInvite: '复制邀请', share: '分享', copied: '邀请复制好了，发给朋友吧',
      invite: '来打四川麻将！房间码 {c}，点链接直接进：{u}',
      seatOpen: '空位', seatWait: '等朋友加入', addBot: '加电脑', hostTag: '房主', youTag: '你',
      start: '开始', startFill: '开始（空位补电脑）', waitHost: '等房主开始…', leave: '离开',
      sumRounds: '{n} 局', sumNoLimit: '不限局数', sumCap: '{n} 番封顶', sumNoCap: '不封顶', sumDi: '自摸加底', sumFan: '自摸加番', sumSwap: '换三张', sumNoSwap: '不换牌', sumBase: '底分 {n}', sumTimer: '每步 {n} 秒',
      opening: '正在开房间…', connecting: '正在连接房间 {c}…', notFound: '没找到房间 {c}。确认一下房间码，或者等房主开好房间。',
      full: '房间满了', hostGone: '房主断开了，等房主回来…', netBad: '网络不稳，正在重连…', slow: '连接有点慢，再试一次…',
      kicked: '你被房主请出了房间', saved: '房主保存了牌局，之后用同一个房间码回来接着打。', ended: '房主结束了牌局',
      backLobby: '回大厅', cancel: '取消', ok: '好',
      joined: '{n} 加入了', leftRoom: '{n} 离开了', tookOver: '{n} 接替了电脑的座位', isBack: '{n} 回来了', dropped: '{n} 掉线了，电脑先代打',
      roundOf: '第 {r}/{n} 局', roundN: '第 {r} 局', practice: '练习', roomChip: '房间 {c}', paused: '已暂停', pausedBy: '房主暂停了牌局',
      wall: '剩余', stWon: '胡', stZimo: '自摸', stOff: '掉线', stAuto: '托管', stPicked: '选好了', stPicking: '选牌中', stQued: '定好了', stQuing: '定缺中',
      ting: '听', autoOn: '托管中，电脑替你出牌', autoOff: '取消托管',
      nLeft: '{n}张', nFanS: '{n}番', nAll: '共 {n} 张', tipDiscard: '打这张听', tipWait: '听',
      bPeng: '碰', bGang: '杠', bHu: '胡', bPass: '过',
      swapH: '换三张', swapS: '挑三张同一花色的牌换给别人<br>已经帮你挑了一组，点牌可以改', swapOk: '确定换这三张', waitOthers: '等其他人…',
      queH: '定缺', queS: '选一门不要的花色，这门的牌打完才能胡', nTiles: '{n} 张', rec: '推荐',
      suit: ['万', '条', '筒'], suitS: ['万', '条', '筒'],
      youWon: '你已经胡了，看他们打完这一局', queFirst: '先把缺的{s}打完',
      queLeft: '缺的{s}还有 {n} 张，打完才能胡',
      passHuAny: '过水：自己摸牌前不能胡别人打的牌', passHuMore: '过水：自己摸牌前只能胡大于 {n} 番的牌',
      oQue: '缺门牌', qFree: '随时打', qFirst: '必须先打', sumQueFirst: '缺门先打',
      dirAcross: '对家互换', dirRight: '逆时针 · 换给下家', dirLeft: '顺时针 · 换给上家',
      cPeng: '碰', cGang: '杠', cRain: '下雨', cWind: '刮风', cHu: '胡', cZimo: '自摸', cBloom: '杠上花', cRob: '抢杠', cMulti2: '一炮双响', cMulti3: '一炮三响', cZhuan: '呼叫转移', cDraw: '流局', cWall: '牌摸完了', cCha: '查叫',
      toastQue: '先打缺门：{s}',
      vPeng: '碰', vGang: '杠', vHu: '胡了', vZimo: '自摸',
      resEnd: '本局结束', resDraw: '流局', resRound: '第 {r} 局', resLast: '最后一局',
      ord: ['', '第 1 个', '第 2 个', '第 3 个'], dealerB: '庄', winOrder: '{o}胡 · {h}',
      how: { zimo: '自摸', pao: '接炮', rob: '抢杠胡', dgh: '点杠花' },
      hua: '花猪（手里还有缺门）', tingMax: '听牌 · 最大 {f} 番', noTing: '没听牌', dealerP: '庄 · ', dealerW: '庄家', you: '你', youS: '（你）',
      lHu: '{h} · {t} {f}番', lHu0: '{h} · {t}', lHuN: '（{n}家给）', lPayZimo: '{n} 自摸', lPayDgh: '点杠花 · {n}', lPayRob: '被抢杠 · {n}', lPayPao: '点炮 · {n}',
      lGang: '{w}（{k}）', kAn: '暗杠', kBu: '补杠', kMing: '直杠', lGangPay: '{n} {w}',
      lZhuan: '呼叫转移', lZhuanPay: '呼叫转移 · {n}', lPig: '查花猪', lPigPay: '花猪', lCha: '查大叫（听{f}番）', lChaPay: '没听牌', lTax: '退税', lTaxPay: '退税',
      next: '下一局', nextIn: '{s} 秒后开始下一局', waitFor: '等 {n}', readyMe: '已准备',
      final: '最终战绩', finalRounds: '一共 {n} 局', finalLine: '胡 {w} 次 · 自摸 {z} 次', bigFan: ' · 最大 {f} 番', again: '再来一场', newMatch: '再来一场',
      menu: '菜单', mRoom: '房间 {c}', mPlayers: '玩家', mAuto: '托管（电脑代打）', mHints: '听牌提示', mSound: '音效', mVoice: '语音播报', mCall: '报牌', mSc: '用四川话', mVib: '震动', mLang: '语言', mSpeed: '电脑速度',
      mPause: '暂停', mResume: '继续', mLeave: '离开牌桌', mSaveLeave: '保存进度，下次接着打', mEnd: '结束牌局', mLeaveSolo: '回大厅（进度会保存）', mKick: '请出', mBotLv: '电脑难度', mSettings: '设置', mInvite: '邀请',
      leaveQ: '离开后电脑会接替你的座位，确定离开吗？', endQ: '结束后大家会看到最终战绩，确定结束吗？',
      chat: '聊天', send: '发送', chatPh: '说点什么…',
      phrases: ['快点出牌呀', '等我想想', '这牌不错', '手气来了', '好险好险', '手下留情', '厉害厉害', '再来一局？'],
      botNames: ['阿杰', '小雨', '老周', '小林', '阿珍', '大鹏', '小葵', '老陈'],
      fan: {},
      tile: (r, s) => (s === 1 && r === 1 ? '幺鸡' : ['一', '二', '三', '四', '五', '六', '七', '八', '九'][r - 1] + ['万', '条', '筒'][s]),
      rulesTitle: '怎么玩',
      rulesHTML: `<h4>牌</h4>一百零八张：万、条、筒，各 1 到 9，每种 4 张。不能吃，只能碰、杠、胡。
<h4>换三张</h4>发完牌，每人挑三张同一花色的牌，随机顺时针、逆时针或者和对家交换。
<h4>定缺</h4>每人选一门花色不要。手里还有这门的牌就不能胡，也不能碰、杠这门的牌。什么时候打掉随你（房间可以设成必须先打），牌摸完时手里还有就是花猪。
<h4>血战到底</h4>有人胡了就退出这一局，其他人接着打，直到只剩一家或者牌摸完。一张牌可以同时被几家胡（一炮多响）。
<h4>胡牌</h4>四组（顺子或刻子）加一对将，或者七对。缺了一门，所以最多两门花色。
<h4>过水</h4>别人打的牌能胡却没胡（点了过，或者去碰、杠），在自己下次摸牌之前，只能胡比放过的那手番数更大的牌。自摸不受影响。
<h4>刮风下雨</h4>杠了马上收钱。直杠：放杠的人给 2 倍底分；补杠：还在打的每家给 1 倍；暗杠：还在打的每家给 2 倍。杠完打出去的牌被人胡了，这次杠的钱转给胡的人（呼叫转移）。
<h4>牌摸完了</h4>手里还有缺门的是花猪，赔给其他人封顶的番；没听牌的赔给听牌的人（查大叫，按对方能胡的最大番）；没听牌的人把杠钱退回去（退税）。
<h4>算分</h4>每次胡牌得 底分 × 2<sup>番数</sup>，最多到封顶。点炮由放炮的人给；自摸是还在打的每家都给，另外加一底（或者加一番，看房间设置）。直杠后杠上开花（点杠花）看房间设置：算点炮由放杠的人给，或者算自摸。
<h4>坐庄</h4>第一局随机坐庄。之后第一个胡牌的人下一局坐庄；第一炮是一炮多响的话，放炮的人坐庄。没人胡就连庄。`,
      fanTable: [['对对胡', 1], ['清一色（只有一门）', 2], ['七对', 2], ['根（每有四张一样的，杠也算）', 1], ['金钩钓（碰杠了四组，只剩一张单钓）', 1], ['将对（全是 2、5、8 的对对胡，可选）', 2], ['带幺九（每组和将都带 1 或 9，可选）', 2], ['杠上开花（杠完补的牌胡）/ 杠上炮（杠完打的牌被胡）', 1], ['抢杠胡（胡别人补杠的那张）', 1], ['海底捞月 / 海底炮（最后一张牌）', 1], ['天胡（庄家起手就胡）/ 地胡（闲家第一次摸牌就自摸），之前没人碰杠（可选）', 5], ['门清（没有碰和明杠）、中张（没有 1 和 9）（可选）', 1], ['自摸（房间设成自摸加番时）', 1]],
      fanNote: '番数相加，最多到封顶。比如清一色加对对胡（清对）是 3 番，七对带一个根（龙七对）是 3 番，四个杠单钓（十八罗汉）是 6 番。',
      moreRules: '更多规则', idTaken: '这个房间码被占用了，稍后再试', peek: '看看牌桌', backRes: '结算', lastRound: '最后一局', fanH: '番数',
      oMode: '玩法', mFree: '各自为战', mTeam: '2v2 组队', oTsw: '每局换牌', sumTeam: '2v2 组队', sumTsw: '每局换牌 {n} 次', sumTswInf: '换牌不限次数',
      mateTag: '队友', foeTag: '对手', makeMate: '设为队友', teamNote: '对家是队友，互相看得到手牌',
      stTs: '换牌中', bTs: '换', tsCanWin: '能胡', tsWin: '胡了', tsReady: '听牌', tsAway: '差 {n} 张听牌', tsAfter: '换完：你{a}，队友{b}',
      tsAskH: '队友想跟你换牌', tsGiveYou: '你拿到', tsWantYour: '你给出', tsNo: '不换', tsYes: '换',
      tsWaitH: '等队友回话…', tsYouGive: '你给出', tsYouTake: '你拿到', tsBack: '撤回',
      tsH: '跟队友换一张', tsLeftN: '这局还能换 {n} 次', tslN: '可换{n}次', tslInf: '换牌不限', tslNone: '不能再换', tsPick1: '点一张你想要的队友的牌', tsPick2: '再点一张自己的牌给队友', tsSend: '请求换牌',
      cTs: '换牌', cTsNo: '不换', tsNoT: '队友没同意',
      teamUs: '我方', teamThem: '对方', teamTot: '累计：我方 {a} · 对方 {b}', teamWin: '我方获胜！', teamLose: '对方获胜', teamTie: '打平了',
      rulesTeam: `<h4>2v2 组队</h4>对家是队友，互相看得到手牌。轮到你出牌时，可以拿自己的一张牌换队友的一张，队友同意才换。每人每局能换几次看房间设置，你和队友还能换几次一直写在名字下面；队里有人胡了就不能再换。换来的牌让你胡了，就算自摸。队友之间不给钱，也不能胡队友打的牌。只剩一队还在打时这一局就结束，最后两人总分高的那队赢。`,
    },
  };
  const read = () => { try { return JSON.parse(localStorage.getItem('mh_lang')); } catch (e) { return null; } };
  let lang = read() === 'zh' ? 'zh' : 'en';
  function t(k, v) {
    let s = S[lang][k]; if (s == null) s = S.en[k];
    if (typeof s !== 'string') return s;
    return v ? s.replace(/\{(\w+)\}/g, (_, x) => (v[x] != null ? v[x] : '')) : s;
  }
  const fan = name => (lang === 'zh' ? name : (S.en.fan[name] || name));
  const tile = t => S[lang].tile(t % 9 + 1, (t / 9) | 0);
  function setLang(l) { lang = l === 'zh' ? 'zh' : 'en'; try { localStorage.setItem('mh_lang', JSON.stringify(lang)); } catch (e) {} if (G.document) G.document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }
  if (G.document) G.document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  G.MJI18N = { t, fan, tile, setLang, get lang() { return lang; }, S };
})(typeof window !== 'undefined' ? window : globalThis);
