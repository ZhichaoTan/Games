// ===== 德州扑克引擎（房主端权威，纯逻辑，可在 node 里测试） =====
(function (G) {
  'use strict';
  // 牌：0..51，点数 = (c>>2)+2（2..14），花色 = c&3（0♠ 1♥ 2♦ 3♣）
  const RANK_CH = '??23456789TJQKA';
  const SUIT_CH = ['♠', '♥', '♦', '♣'];
  const rankOf = c => (c >> 2) + 2, suitOf = c => c & 3;
  const CAT_NAME = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺', '皇家同花顺'];

  // 洗牌用的随机数：浏览器自带的密码学随机数（crypto.getRandomValues），拒绝采样，没有取模偏差；
  // 和机器人做决定用的随机数分开，谁坐哪个位置、谁先谁后都影响不到发到的牌
  const CR = G.crypto && G.crypto.getRandomValues ? G.crypto : null;
  const RB = new Uint32Array(64); let rbi = 64;
  function randInt(n) {                     // 0..n-1 均匀
    if (!CR) return Math.floor(Math.random() * n);
    const lim = 4294967296 - 4294967296 % n;
    for (;;) { if (rbi >= 64) { CR.getRandomValues(RB); rbi = 0; } const x = RB[rbi++]; if (x < lim) return x % n; }
  }
  // Fisher–Yates：52! 种排列每种机会相同
  function shuffle(a, int) {
    for (let i = a.length - 1; i > 0; i--) { const j = int(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // 5 张牌打分：cat<<20 | 依次 5 个比较点数
  function eval5(cs) {
    const r = cs.map(rankOf).sort((a, b) => b - a);
    const flush = cs.every(c => suitOf(c) === suitOf(cs[0]));
    let straightHi = 0;
    const uniq = [...new Set(r)];
    if (uniq.length === 5) {
      if (r[0] - r[4] === 4) straightHi = r[0];
      else if (r[0] === 14 && r[1] === 5) straightHi = 5; // A2345
    }
    const cnt = {};
    r.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    const groups = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
    const shape = groups.map(g => cnt[g]).join('');
    let cat, ks;
    if (straightHi && flush) { cat = straightHi === 14 ? 9 : 8; ks = [straightHi]; }
    else if (shape === '41') { cat = 7; ks = groups; }
    else if (shape === '32') { cat = 6; ks = groups; }
    else if (flush) { cat = 5; ks = r; }
    else if (straightHi) { cat = 4; ks = [straightHi]; }
    else if (shape === '311') { cat = 3; ks = groups; }
    else if (shape === '221') { cat = 2; ks = groups; }
    else if (shape === '2111') { cat = 1; ks = groups; }
    else { cat = 0; ks = r; }
    let s = Math.min(cat, 8); // 皇家同花顺与同花顺同级比较
    for (let i = 0; i < 5; i++) s = s * 16 + (ks[i] || 0);
    return { score: s, cat };
  }

  // 快速打分（5~7 张，不分配数组），编码与 eval5 一致
  const CNT = new Int8Array(15), SM = new Int32Array(4), SC = new Int8Array(4);
  function straightHi(m) {
    if (m & (1 << 14)) m |= 2;
    for (let hi = 14; hi >= 5; hi--) if (((m >> (hi - 4)) & 31) === 31) return hi;
    return 0;
  }
  function pack(cat, a, b, c, d, e) { return ((((cat * 16 + a) * 16 + (b || 0)) * 16 + (c || 0)) * 16 + (d || 0)) * 16 + (e || 0); }
  function score(cards) {
    CNT.fill(0); SM.fill(0); SC.fill(0);
    let all = 0;
    for (let i = 0; i < cards.length; i++) { const c = cards[i], r = (c >> 2) + 2, s = c & 3; CNT[r]++; SM[s] |= 1 << r; SC[s]++; all |= 1 << r; }
    let fs = -1; for (let s = 0; s < 4; s++) if (SC[s] >= 5) fs = s;
    if (fs >= 0) { const h = straightHi(SM[fs]); if (h) return pack(8, h); }
    let q = 0, t1 = 0, t2 = 0, p1 = 0, p2 = 0;
    for (let r = 14; r >= 2; r--) {
      const n = CNT[r];
      if (n === 4) q = r;
      else if (n === 3) { if (!t1) t1 = r; else if (!t2) t2 = r; }
      else if (n === 2) { if (!p1) p1 = r; else if (!p2) p2 = r; }
    }
    const kick = (ex, k) => { const o = []; for (let r = 14; r >= 2 && o.length < k; r--) if (CNT[r] && ex.indexOf(r) < 0) o.push(r); return o; };
    if (q) return pack(7, q, kick([q], 1)[0]);
    if (t1 && (t2 || p1)) return pack(6, t1, Math.max(t2, p1));
    if (fs >= 0) { const o = []; for (let r = 14; r >= 2 && o.length < 5; r--) if (SM[fs] & (1 << r)) o.push(r); return pack(5, o[0], o[1], o[2], o[3], o[4]); }
    const sh = straightHi(all); if (sh) return pack(4, sh);
    if (t1) { const k = kick([t1], 2); return pack(3, t1, k[0], k[1]); }
    if (p1 && p2) return pack(2, p1, p2, kick([p1, p2], 1)[0]);
    if (p1) { const k = kick([p1], 3); return pack(1, p1, k[0], k[1], k[2]); }
    const k = kick([], 5); return pack(0, k[0], k[1], k[2], k[3], k[4]);
  }

  const COMBOS7 = [];
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) COMBOS7.push([a, b]);

  // 5~7 张牌里最好的 5 张
  function bestHand(cards) {
    if (cards.length < 5) return null;
    let best = null;
    const n = cards.length;
    const tryHand = h => { const e = eval5(h); if (!best || e.score > best.score) best = { score: e.score, cat: e.cat, cards: h }; };
    if (n === 5) tryHand(cards);
    else if (n === 6) for (let i = 0; i < 6; i++) tryHand(cards.filter((_, k) => k !== i));
    else for (const [a, b] of COMBOS7) tryHand(cards.filter((_, k) => k !== a && k !== b));
    best.name = CAT_NAME[best.cat];
    return best;
  }

  // 胜率估算（蒙特卡洛），给机器人和"胜率提示"用
  function equity(hole, board, nOpp, iters, rnd) {
    rnd = rnd || Math.random;
    const used = new Set([...hole, ...board]);
    const rest = []; for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
    let win = 0;
    for (let it = 0; it < iters; it++) {
      // 部分洗牌
      const need = 5 - board.length + nOpp * 2;
      for (let i = 0; i < need; i++) { const j = i + Math.floor(rnd() * (rest.length - i)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
      const b = board.concat(rest.slice(0, 5 - board.length));
      let k = 5 - board.length;
      const me = score(hole.concat(b));
      let better = 0, ties = 0;
      for (let o = 0; o < nOpp; o++) {
        const s = score([rest[k], rest[k + 1]].concat(b)); k += 2;
        if (s > me) { better = 1; break; } if (s === me) ties++;
      }
      if (!better) win += 1 / (ties + 1);
    }
    return win / iters;
  }

  // 起手牌强度：Chen 公式给 169 种起手牌打分，按组合数换算成"前百分之几"（0 最好，1 最差）
  const PF = new Float32Array(15 * 15 * 2);
  (function () {
    const base = r => r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2;
    const cls = [];
    for (let a = 2; a <= 14; a++) for (let b = 2; b <= a; b++) for (let su = 0; su < 2; su++) {
      if (a === b && su) continue;
      let sc;
      if (a === b) sc = Math.max(5, base(a) * 2);
      else {
        const gap = a - b - 1;
        sc = base(a) + (su ? 2 : 0) - (gap > 3 ? 5 : [0, 1, 2, 4][gap]) + (gap <= 1 && a < 12 ? 1 : 0);
      }
      cls.push({ k: (a * 15 + b) * 2 + su, sc: Math.ceil(sc) + (a + b) / 100, n: a === b ? 6 : su ? 4 : 12 });
    }
    cls.sort((x, y) => y.sc - x.sc);
    let acc = 0;
    for (const c of cls) { PF[c.k] = (acc + c.n / 2) / 1326; acc += c.n; }
  })();
  function pfPct(c1, c2) {
    let a = rankOf(c1), b = rankOf(c2); if (b > a) { const t = a; a = b; b = t; }
    return PF[(a * 15 + b) * 2 + (a !== b && suitOf(c1) === suitOf(c2) ? 1 : 0)];
  }
  const catOf = sc => { const c = Math.floor(sc / 1048576); return c === 8 && Math.floor(sc / 65536) % 16 === 14 ? 9 : c; };

  // 胜率提示：我赢/平的概率，以及发完五张公共牌时我各种牌型的概率
  function odds(hole, board, nOpp, iters, rnd) {
    rnd = rnd || Math.random;
    const used = new Set([...hole, ...board]);
    const rest = []; for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
    const need = 5 - board.length + nOpp * 2, cats = new Array(10).fill(0);
    let win = 0, tie = 0;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < need; i++) { const j = i + Math.floor(rnd() * (rest.length - i)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
      const b = board.concat(rest.slice(0, 5 - board.length));
      let k = 5 - board.length;
      const me = score(hole.concat(b)); cats[catOf(me)]++;
      let best = 0, n = 0;
      for (let o = 0; o < nOpp; o++) { const s = score([rest[k], rest[k + 1]].concat(b)); k += 2; if (s > best) { best = s; n = 1; } else if (s === best) n++; }
      if (me > best) win++; else if (me === best) tie++;
    }
    return { win: win / iters, tie: tie / iters, cats: cats.map(x => x / iters) };
  }

  // 机器人用的胜率：对手的手牌按他们的打法范围抽样（opps: [{range 0~1, read: 是否这一轮下过注}]）
  function equityR(hole, board, opps, iters, rnd) {
    rnd = rnd || Math.random;
    const used = new Set([...hole, ...board]);
    const rest = []; for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
    const bs = board.length >= 3 ? score(board) : 0, bcat = board.length >= 3 ? Math.floor(bs / 1048576) : -1;
    let win = 0;
    for (let it = 0; it < iters; it++) {
      let k = 0;
      const hands = [];
      for (const o of opps) {
        let a, b;
        const leak = Math.min(1, 0.1 * o.range / Math.max(0.01, 1 - o.range));   // 偶尔也会玩范围外的牌
        for (let tr = 0; tr < 30; tr++) {
          const i = k + Math.floor(rnd() * (rest.length - k)); let t = rest[k]; rest[k] = rest[i]; rest[i] = t;
          const j = k + 1 + Math.floor(rnd() * (rest.length - k - 1)); t = rest[k + 1]; rest[k + 1] = rest[j]; rest[j] = t;
          a = rest[k]; b = rest[k + 1];
          if (tr === 29) break;
          if (pfPct(a, b) > o.range && rnd() > leak) continue;            // 不在他平时会玩的牌里
          if (o.read && bcat >= 0) {                                      // 这一轮他下注了：多半是和牌面有关系的牌
            const hit = Math.floor(score([a, b].concat(board)) / 1048576) > bcat;
            const fd = board.length < 5 && [0, 1, 2, 3].some(su => board.filter(c => suitOf(c) === su).length + (suitOf(a) === su) + (suitOf(b) === su) >= 4 && (suitOf(a) === su || suitOf(b) === su));
            if (!hit && !fd && rnd() > 0.25) continue;
          }
          break;
        }
        hands.push(a, b); k += 2;
      }
      for (let i = 0; i < 5 - board.length; i++) { const j = k + i + Math.floor(rnd() * (rest.length - k - i)); const t = rest[k + i]; rest[k + i] = rest[j]; rest[j] = t; }
      const full = board.concat(rest.slice(k, k + 5 - board.length));
      const me = score(hole.concat(full));
      let better = 0, ties = 0;
      for (let o = 0; o < opps.length; o++) { const sc = score([hands[2 * o], hands[2 * o + 1]].concat(full)); if (sc > me) { better = 1; break; } if (sc === me) ties++; }
      if (!better) win += 1 / (ties + 1);
    }
    return win / iters;
  }

  // 机器人智商：模拟次数、估算误差、开池/跟注范围、激进程度、诈唬、跟注站倾向、读牌、位置意识
  const IQ = {
    70:  { it: 140, noise: 0.10, open: 0.70, call: 0.42, agg: 0.35, bluff: 0.03, loose: 0.08, model: 0, pos: 0, rk: 1 },
    100: { it: 220, noise: 0.05, open: 0.50, call: 0.30, agg: 0.55, bluff: 0.07, loose: 0.03, model: 0, pos: 0.2 },
    130: { it: 360, noise: 0,    open: 0.34, call: 0.17, agg: 0.75, bluff: 0.11, loose: 0,    model: 1, pos: 0.7 },
    160: { it: 520, noise: 0,    open: 0.30, call: 0.14, agg: 0.85, bluff: 0.14, loose: 0,    model: 2, pos: 1 },
  };
  const IQS = [70, 100, 130, 160];
  // 机器人思考快慢：在默认的思考时间上乘这个倍数（秒出、快、正常、慢）
  const PACES = [0.12, 0.4, 1, 2.2];

  const SEATS = 9;

  class Game {
    constructor(opts) {
      this.settings = Object.assign({ sb: 5, bb: 10, startChips: 1000, turnTime: 30, botPace: 1, autoNext: true }, opts.settings || {});
      this.now = opts.now || (() => Date.now());
      this.rnd = opts.rnd || Math.random;
      // 洗牌和抽庄用的随机整数；测试时传入 rnd 就用它（可复现），平时用密码学随机数
      this.int = opts.rnd ? (n => Math.floor(opts.rnd() * n)) : randInt;
      this.schedule = opts.schedule || ((fn, ms) => setTimeout(fn, ms));
      this.onChange = opts.onChange || (() => {});
      this.players = []; // {id,name,seat,chips,...}
      this.hand = null;
      this.handNum = 0;
      this.dealerSeat = -1;
      this.log = [];
      this.paused = false;
      this.nextAt = 0;
      this._timerGen = 0;
      this.actSeq = 0;
    }

    // ---------- 座位 ----------
    byId(id) { return this.players.find(p => p.id === id); }
    bySeat(s) { return this.players.find(p => p.seat === s); }
    addPlayer({ id, name, isBot, token, avatar, chips, iq }) {
      if (this.players.length >= SEATS) return null;
      let seat = 0; while (this.bySeat(seat)) seat++;
      const buyIn = chips == null ? this.settings.startChips : Math.max(0, Math.min(this.settings.startChips, Math.floor(chips)));
      const p = { id, name, isBot: !!isBot, token, avatar: avatar || 0, seat, chips: buyIn, buyin: buyIn, loan: 0, rebuys: 0, iq: isBot ? (IQ[iq] ? iq : 100) : 0,
        st: { h: 0, vpip: 0, pfr: 0, agg: 0, pas: 0 },
        connected: true, inHand: false, folded: false, allIn: false, bet: 0, committed: 0, acted: false, canRaise: true,
        hole: [], lastAction: '', actSeq: 0, showCards: false, net: 0 };
      this.players.push(p);
      this.addLog({ k: 'join', n: name });
      this.changed();
      this.maybeAutoStart();
      return p;
    }
    removePlayer(id) {
      const p = this.byId(id); if (!p) return;
      if (p.inHand && !p.folded && this.hand && this.hand.street !== 'done') {
        if (this.hand.toAct === p.seat) { this.act(p.id, { type: 'fold' }, true); }
        else { p.folded = true; p.lastAction = 'fold'; p.actSeq = ++this.actSeq; }
      }
      // 已投入的筹码留在底池里：把玩家留到这手结束再删
      if (p.inHand && this.hand && this.hand.street !== 'done') { p.leaving = true; this.afterExternalFold(); }
      else this.players = this.players.filter(x => x !== p);
      this.addLog({ k: 'leave', n: p.name });
      this.changed();
    }
    rebuy(id, amount) {
      const p = this.byId(id);
      if (!p || p.chips > 0 || (p.inHand && this.hand && this.hand.street !== 'done')) return false;
      const a = amount == null ? this.settings.startChips : Math.max(0, Math.min(this.settings.startChips, Math.floor(amount)));
      if (!a) return false;
      p.chips = a; p.rebuys++; p.loan += a;   // 输光后借的筹码记在账上
      this.addLog({ k: 'rebuy', n: p.name, a });
      this.changed(); this.maybeAutoStart();
      return true;
    }
    // 还钱：不在打的这一手里时，从筹码里还一笔（最多一次借的数）
    repay(id) {
      const p = this.byId(id), h = this.hand;
      if (!p || !(p.loan > 0) || !(p.chips > 0) || (p.inHand && !p.folded && h && h.street !== 'done')) return 0;
      const a = Math.min(p.loan, p.chips, this.settings.startChips);
      p.chips -= a; p.loan -= a;
      p.rebuys = p.loan ? Math.max(1, Math.ceil(p.loan / this.settings.startChips)) : 0;
      this.addLog({ k: 'repay', n: p.name, a });
      this.changed();
      return a;
    }
    // 中途收桌（保存进度、结束牌局）：这一手作废，每人拿回这手下的注；庄家按钮退回去，下次接着玩时这一手重发
    voidHand() {
      const h = this.hand;
      this._timerGen++; this._live = null; this._frozen = null; this.nextAt = 0;
      if (h && h.street !== 'done') {
        for (const p of this.players) if (p.inHand && !p.leaving) p.chips += p.committed;
        this.dealerSeat = h.prevDealer; this.handNum--;
        this.addLog({ k: 'void' });
      }
      for (const p of this.players) Object.assign(p, { inHand: false, folded: false, allIn: false, bet: 0, committed: 0, hole: [], lastAction: '', showCards: false, best: null, net: 0, won: 0 });
      this.players = this.players.filter(p => !p.leaving);
      this.hand = null;
      this.changed();
    }
    setIq(id, iq) { const p = this.byId(id); if (p && p.isBot && IQ[iq]) { p.iq = iq; this.changed(); } }
    setPace(k) { if (PACES.includes(k)) { this.settings.botPace = k; this.changed(); } }
    setConnected(id, on) {
      const p = this.byId(id); if (!p) return;
      if (p.connected === on) return;
      p.connected = on;
      // 掉线时缩短等待；连回来时重新给满时间
      if (this.hand && this.hand.street !== 'done' && this.hand.toAct === p.seat) this.setDeadline(p);
      this.changed();
      if (on) this.maybeAutoStart();
    }

    addLog(e) { this.log.push(e); if (this.log.length > 80) this.log.shift(); }
    changed() { this.onChange(); }

    eligible() {
      return this.players.filter(p => p.chips > 0 && !p.leaving && !p.sitOut && (p.connected || p.isBot))
        .sort((a, b) => a.seat - b.seat);
    }
    nextSeat(from, list) { // list 中座位号严格在 from 之后的第一个（循环）
      const seats = list.map(p => p.seat).sort((a, b) => a - b);
      for (const s of seats) if (s > from) return s;
      return seats[0];
    }

    maybeAutoStart() {
      if (this.paused || !this.started) return;
      if (this.hand && this.hand.street !== 'done') return;
      if (this.nextAt) return;
      if (this.eligible().length >= 2) {
        this.nextAt = this.now() + 1500;
        this.later(() => { this.nextAt = 0; this.startHand(); }, 1500);
      }
    }

    start() { this.started = true; this.paused = false; this.maybeAutoStart(); this.changed(); }
    // 所有计时都走这里。同一时刻只有一个有效计时（新的作废旧的），暂停时把它冻住，恢复后按剩下的时间接着走
    later(fn, ms) {
      const gen = ++this._timerGen;
      if (this.paused) { this._live = null; this._frozen = { fn, left: ms }; return; }
      this._live = { gen, fn, due: this.now() + ms };
      this.schedule(() => { if (gen === this._timerGen) { this._live = null; fn(); } }, ms);
    }
    // 暂停：整桌原地冻住，谁的倒计时都不走、机器人不出手、没人会被超时弃牌；恢复后从停下的地方接着来
    setPaused(v) {
      v = !!v; if (v === this.paused) return;
      const h = this.hand, live = !!(h && h.street !== 'done');
      if (v) {
        const L = this._live;
        this._frozen = live && L && L.gen === this._timerGen ? { fn: L.fn, left: Math.max(0, L.due - this.now()) } : null;
        this._timerGen++; this._live = null; this.nextAt = 0;
        if (live && h.deadline) { h.left = Math.max(0, h.deadline - this.now()); h.deadline = 0; }
        this.paused = true;
      } else {
        this.paused = false;
        const f = this._frozen; this._frozen = null;
        if (live && f) {
          const ms = Math.max(f.left, 600);   // 刚恢复时留一点反应时间
          if (h.left) { h.deadline = this.now() + Math.max(h.left, 600); h.left = 0; }
          this.later(f.fn, ms);
        } else if (live) { const p = h.toAct >= 0 && this.bySeat(h.toAct); if (p) this.setDeadline(p); }
        else this.maybeAutoStart();
      }
      this.changed();
    }

    // ---------- 一手牌 ----------
    startHand() {
      // 清理离桌；输光的机器人自己补码复活
      this.players = this.players.filter(p => !p.leaving);
      for (const p of this.players) if (p.isBot && p.chips === 0) {
        p.chips = this.settings.startChips; p.rebuys++; p.loan += p.chips;
        this.addLog({ k: 'rebuy', n: p.name, a: p.chips });
        if (this.onBotRebuy) this.onBotRebuy(p);
      }
      const el = this.eligible();
      if (el.length < 2 || this.paused) { this.hand = null; this.changed(); return; }
      this.handNum++;
      for (const p of this.players) {
        Object.assign(p, { inHand: false, folded: false, allIn: false, bet: 0, committed: 0, acted: false, canRaise: true, hole: [], lastAction: '', actSeq: 0, showCards: false, net: 0, won: 0, best: null,
          vp: false, pr: false, aggSt: '', trap: '' });
      }
      el.forEach(p => { p.inHand = true; p.st.h++; });
      // 庄家按钮每手顺时针移一位；开局第一手抽签定庄（以前总是房主先当庄）
      const prevDealer = this.dealerSeat;
      this.dealerSeat = prevDealer < 0 ? el[this.int(el.length)].seat : this.nextSeat(prevDealer, el);
      let sbSeat, bbSeat;
      if (el.length === 2) { sbSeat = this.dealerSeat; bbSeat = this.nextSeat(sbSeat, el); }
      else { sbSeat = this.nextSeat(this.dealerSeat, el); bbSeat = this.nextSeat(sbSeat, el); }
      const deck = shuffle([...Array(52).keys()], this.int);
      this.hand = { num: this.handNum, street: 'preflop', deck, board: [], dealer: this.dealerSeat, prevDealer, sbSeat, bbSeat,
        curBet: 0, minRaise: this.settings.bb, nr: 0, toAct: -1, deadline: 0, results: null, pot: 0 };
      // 从小盲开始发两轮
      const order = [];
      let s = sbSeat; for (let i = 0; i < el.length; i++) { order.push(this.bySeat(s)); s = this.nextSeat(s, el); }
      for (let r = 0; r < 2; r++) for (const p of order) p.hole.push(deck.pop());
      this.addLog({ k: 'hand', h: this.handNum });
      this.post(this.bySeat(sbSeat), this.settings.sb, 'sb');
      this.post(this.bySeat(bbSeat), this.settings.bb, 'bb');
      this.hand.curBet = this.settings.bb;
      this.hand.minRaise = this.settings.bb;
      this.hand.toAct = bbSeat;
      this.advance();
    }
    post(p, amt, label) {
      const a = Math.min(amt, p.chips);
      p.chips -= a; p.bet += a; p.committed += a;
      if (p.chips === 0) p.allIn = true;
      p.lastAction = label; p.actSeq = ++this.actSeq;
    }

    inHand() { return this.players.filter(p => p.inHand && !p.folded); }
    needsAct(p) { return p.inHand && !p.folded && !p.allIn && (!p.acted || p.bet < this.hand.curBet); }

    legal(p) {
      const h = this.hand;
      if (!h || h.street === 'done' || h.toAct !== p.seat) return null;
      const toCall = Math.min(h.curBet - p.bet, p.chips);
      const maxTo = p.bet + p.chips;
      const canRaise = p.canRaise && maxTo > h.curBet &&
        this.inHand().some(o => o !== p && !o.allIn); // 至少还有一个人能跟
      let minTo = h.curBet + h.minRaise;
      if (h.curBet === 0) minTo = Math.max(this.settings.bb, 1);
      minTo = Math.min(minTo, maxTo);
      return { toCall, canCheck: toCall === 0, canRaise, minTo, maxTo, curBet: h.curBet, myBet: p.bet };
    }

    act(id, a, force) {
      if (this.paused && !force) return 'paused';
      const p = this.byId(id), h = this.hand;
      if (!p || !h || h.street === 'done' || h.toAct !== p.seat) return 'not-your-turn';
      const L = this.legal(p);
      let type = a.type;
      if (type === 'check' && !L.canCheck) return 'cannot-check';
      if (type === 'call' && L.toCall === 0) type = 'check';
      if (type === 'raise' && !L.canRaise) type = L.toCall ? 'call' : 'check';
      if (type === 'fold') {
        p.folded = true; p.lastAction = 'fold';
        this.addLog({ k: 'fold', n: p.name });
      } else if (type === 'check') {
        p.lastAction = 'check'; this.addLog({ k: 'check', n: p.name });
      } else if (type === 'call') {
        const c = L.toCall;
        p.chips -= c; p.bet += c; p.committed += c;
        if (p.chips === 0) { p.allIn = true; p.lastAction = 'allin'; } else p.lastAction = 'call';
        this.addLog({ k: p.allIn ? 'callAllin' : 'call', n: p.name, a: c });
      } else if (type === 'raise') {
        let to = Math.floor(Number(a.to) || 0);
        to = Math.max(L.minTo, Math.min(L.maxTo, to));
        const add = to - p.bet;
        const raiseBy = to - h.curBet;
        p.chips -= add; p.bet = to; p.committed += add;
        const wasBet = h.curBet === 0;
        if (p.chips === 0) p.allIn = true;
        if (raiseBy >= h.minRaise) {
          h.minRaise = raiseBy;
          for (const o of this.players) if (o !== p && o.inHand) { o.acted = false; o.canRaise = true; }
        } else { // 不足额全押：已行动过的人不能再加注
          for (const o of this.players) if (o !== p && o.inHand) { if (o.acted) o.canRaise = false; o.acted = false; }
        }
        h.curBet = to; h.nr++;
        p.lastAction = p.allIn ? 'allin' : (wasBet ? 'bet' : 'raise');
        this.addLog({ k: p.lastAction, n: p.name, a: to });
      } else return 'bad-action';
      if (type === 'call' || type === 'raise') {
        if (!h.board.length) { if (!p.vp) { p.vp = true; p.st.vpip++; } if (type === 'raise' && !p.pr) { p.pr = true; p.st.pfr++; } }
        else if (type === 'raise') { p.st.agg++; p.aggSt = h.street; } else p.st.pas++;
      }
      p.acted = true; p.actSeq = ++this.actSeq;
      this.advance(p.seat);
      return 'ok';
    }

    afterExternalFold() {
      const h = this.hand; if (!h || h.street === 'done') return;
      if (this.inHand().length <= 1) this.advance(h.toAct);
    }

    advance(fromSeat) {
      const h = this.hand;
      h.pot = this.players.reduce((s, p) => s + p.committed - p.bet, 0);
      const live = this.inHand();
      if (live.length === 1) return this.finishUncontested(live[0]);
      const list = this.players.filter(p => p.inHand).sort((a, b) => a.seat - b.seat);
      // 下一个需要行动的人
      let s = fromSeat === undefined ? h.toAct : fromSeat;
      for (let i = 0; i < list.length; i++) {
        s = this.nextSeat(s, list);
        const p = this.bySeat(s);
        if (this.needsAct(p)) {
          h.toAct = s; this.setDeadline(p); this.changed(); return;
        }
      }
      this.endStreet();
    }

    setDeadline(p) {
      const h = this.hand;
      const t = p.isBot ? 0 : (p.connected ? this.settings.turnTime * 1000 : 6000);
      h.deadline = p.isBot || this.paused ? 0 : this.now() + t;
      h.left = p.isBot || !this.paused ? 0 : t;
      if (p.isBot) {
        this.later(() => { if (h === this.hand && h.toAct === p.seat) this.botAct(p); }, (650 + (p.iq - 70) * 3 + this.rnd() * 1100) * (PACES.includes(this.settings.botPace) ? this.settings.botPace : 1));
      } else {
        this.later(() => {
          if (h === this.hand && h.toAct === p.seat && h.street !== 'done') {
            const L = this.legal(p);
            this.addLog({ k: 'timeout', n: p.name });
            this.act(p.id, { type: L && L.canCheck ? 'check' : 'fold' }, true);
          }
        }, t);
      }
    }

    endStreet() {
      const h = this.hand;
      for (const p of this.players) { p.bet = 0; p.acted = false; p.canRaise = true; }
      h.pot = this.players.reduce((s, p) => s + p.committed, 0);
      h.curBet = 0; h.minRaise = this.settings.bb; h.nr = 0; h.toAct = -1; h.deadline = 0; h.left = 0;
      const canAct = this.inHand().filter(p => !p.allIn);
      if (h.street === 'river') return this.showdown();
      const runout = canAct.length <= 1;
      if (runout) for (const p of this.inHand()) p.showCards = true; // 全押摊牌：亮牌发完
      this.dealNext();
      this.changed();
      if (runout) {
        this.later(() => this.endStreet(), 1700);
      } else {
        for (const p of this.players) if (p.inHand && !p.folded && !p.allIn) p.lastAction = '';
        this.later(() => this.advance(h.dealer), 750);
      }
    }
    dealNext() {
      const h = this.hand, d = h.deck;
      d.pop(); // 烧牌
      if (h.street === 'preflop') { h.board.push(d.pop(), d.pop(), d.pop()); h.street = 'flop'; }
      else if (h.street === 'flop') { h.board.push(d.pop()); h.street = 'turn'; }
      else if (h.street === 'turn') { h.board.push(d.pop()); h.street = 'river'; }
      this.addLog({ k: 'street', s: h.street, b: h.board.slice() });
    }

    finishUncontested(w) {
      const h = this.hand;
      const total = this.players.reduce((s, p) => s + p.committed, 0);
      w.chips += total; w.won = total;
      h.results = [{ amount: total, winners: [w.seat], cat: -1 }];
      this.addLog({ k: 'winFold', n: w.name, a: total });
      this.endHand();
    }

    showdown() {
      const h = this.hand;
      h.street = 'showdown';
      const live = this.inHand();
      for (const p of live) { p.showCards = true; p.best = bestHand(p.hole.concat(h.board)); }
      // 按投入额分层算边池
      const all = this.players.filter(p => p.committed > 0);
      const levels = [...new Set(live.map(p => p.committed))].sort((a, b) => a - b);
      const pots = []; let prev = 0;
      for (const L of levels) {
        let amt = 0;
        for (const p of all) amt += Math.max(0, Math.min(p.committed, L) - prev);
        const elig = live.filter(p => p.committed >= L);
        if (amt > 0) pots.push({ amount: amt, elig });
        prev = L;
      }
      // 弃牌者超出最高层的部分（理论上不会出现）并入最后一个池
      let extra = 0; for (const p of all) extra += Math.max(0, p.committed - prev);
      if (extra && pots.length) pots[pots.length - 1].amount += extra;
      // 合并资格相同的池
      const merged = [];
      for (const pt of pots) {
        const last = merged[merged.length - 1];
        if (last && last.elig.length === pt.elig.length) last.amount += pt.amount; else merged.push(pt);
      }
      h.results = [];
      const orderFromDealer = p => (p.seat - h.dealer + SEATS - 1) % SEATS; // 庄家左手第一个先得零头
      merged.forEach((pt, i) => {
        const top = Math.max(...pt.elig.map(p => p.best.score));
        const ws = pt.elig.filter(p => p.best.score === top).sort((a, b) => orderFromDealer(a) - orderFromDealer(b));
        const share = Math.floor(pt.amount / ws.length); let odd = pt.amount - share * ws.length;
        for (const w of ws) { const g = share + (odd > 0 ? 1 : 0); odd--; w.chips += g; w.won = (w.won || 0) + g; }
        h.results.push({ amount: pt.amount, winners: ws.map(w => w.seat), cat: ws[0].best.cat, side: i > 0 });
        this.addLog({ k: 'pot', side: i > 0, ns: ws.map(w => w.name), a: pt.amount, cat: ws[0].best.cat });
      });
      this.endHand();
    }

    endHand() {
      const h = this.hand;
      h.street = 'done'; h.toAct = -1; h.deadline = 0; h.left = 0;
      for (const p of this.players) { p.net = (p.won || 0) - p.committed; p.bet = 0; }
      h.pot = 0;
      this.changed();
      if (this.settings.autoNext && !this.paused) {
        const wait = h.results && h.results.some(r => r.cat >= 0) ? 7000 : 4000;
        this.nextAt = this.now() + wait;
        this.later(() => { this.nextAt = 0; this.startHand(); }, wait);
      }
    }

    // ---------- 机器人 ----------
    botAct(p) {
      const L = this.legal(p);
      if (!L) return;
      let a;
      try { a = this.botDecide(p, L); } catch (e) { a = { type: L.canCheck ? 'check' : 'fold' }; }
      return this.act(p.id, a, true);
    }
    botDecide(p, L) {
      const h = this.hand, lv = IQ[p.iq] || IQ[100], r = this.rnd(), bb = this.settings.bb, sb = this.settings.sb;
      const opps = this.inHand().filter(o => o !== p), n = opps.length;
      const pot = this.players.reduce((s, q) => s + q.committed, 0);
      const odds = L.toCall / (pot + L.toCall);
      const raiseTo = frac => Math.round(Math.max(L.minTo, Math.min(L.maxTo, L.curBet + Math.max(h.minRaise, frac * (pot + L.toCall)))) / sb) * sb || L.minTo;
      const RAISE = to => L.canRaise ? { type: 'raise', to: Math.max(L.minTo, Math.min(L.maxTo, to)) } : (L.canCheck ? { type: 'check' } : { type: 'call' });
      const CALL = { type: L.canCheck ? 'check' : 'call' }, FOLD = { type: L.canCheck ? 'check' : 'fold' };
      const stack = p.chips + p.bet;

      if (!h.board.length) {
        // ---- 翻牌前：按起手牌强度、位置、加注大小决定 ----
        let pct = pfPct(p.hole[0], p.hole[1]) + (r - 0.5) * lv.noise * 2;
        const order = this.players.filter(q => q.inHand && !q.folded).sort((x, y) => ((x.seat - h.bbSeat + SEATS - 1) % SEATS) - ((y.seat - h.bbSeat + SEATS - 1) % SEATS));
        const late = order.length > 1 ? order.indexOf(p) / (order.length - 1) : 1;  // 0 枪口 ~ 1 按钮/盲注
        const short = n <= 3 ? 1 + (4 - n) * 0.18 : 1;                                   // 人少就放宽
        const open = Math.min(0.95, lv.open * (1 + lv.pos * (late * 0.9 - 0.4)) * short);
        const facing = L.curBet / bb;
        if (stack <= 12 * bb && lv.model) {                                              // 短码：要么全下要么弃
          return pct <= (facing <= 1 ? open * 1.25 : lv.call * 1.4) ? RAISE(L.maxTo) : (L.canCheck ? CALL : FOLD);
        }
        if (facing <= 1) {                                                               // 没人加注
          const limpers = this.players.filter(q => q.inHand && q.bet >= bb && q !== p && q.seat !== h.bbSeat).length;
          if (pct <= open) return r < 0.12 + 0.8 * lv.agg || !L.canCheck && pct > open * 0.7 && r < 0.3 ? RAISE(Math.round((2.5 + limpers + r) * bb / sb) * sb) : CALL;
          if (L.canCheck) return CALL;
          if (L.toCall <= sb && pct <= open * 1.5) return CALL;                          // 小盲补一点
          return pct <= lv.loose * 4 + 0.08 && r < 0.4 ? CALL : FOLD;
        }
        const big = Math.sqrt(3 / Math.max(3, facing));                                  // 加得越大越紧
        const callT = Math.min(0.9, lv.call * big * short), threeT = callT * (lv.model ? 0.3 : 0.18);
        if (pct <= threeT || (lv.model === 2 && pct <= callT * 0.75 && pct > callT * 0.55 && r < 0.12)) return RAISE(L.toCall >= p.chips * 0.45 ? L.maxTo : Math.round(L.curBet * (2.8 + r * 0.6) / sb) * sb);
        if (pct <= callT || odds < 0.16 && pct <= callT * 1.6) return CALL;
        return FOLD;
      }

      // ---- 翻牌后：估算胜率（聪明的会按对手的打法缩小他们的范围）----
      let eq;
      if (lv.model) {
        const spec = opps.map(o => {
          let range = o.st.h >= 6 ? Math.min(1, Math.max(0.12, o.st.vpip / o.st.h + 0.05)) : 0.55;
          if (o.pr) range = Math.min(range, o.st.h >= 6 ? Math.max(0.1, o.st.pfr / o.st.h + 0.05) : 0.22);
          if (!o.vp && !o.pr) range = 1;                                                // 盲注白看牌：什么都有可能
          return { range, read: lv.model === 2 && o.aggSt === h.street };
        });
        eq = equityR(p.hole, h.board, spec, lv.it, this.rnd);
      } else if (!lv.rk) eq = equityR(p.hole, h.board, opps.map(o => ({ range: o.pr ? 0.3 : 1 })), lv.it, this.rnd); // 普通：只知道加注的人牌不差
      else eq = equity(p.hole, h.board, Math.max(1, n), lv.it, this.rnd) - 0.12 * Math.min(1, L.toCall / Math.max(1, pot - L.toCall)); // 新手：只知道下大注的人可能有牌
      if (h.nr >= 2) eq -= (lv.rk ? 0.04 : 0.1) * (h.nr - 1);                           // 被反加：对方多半很强
      eq = Math.max(0, Math.min(1, eq + (this.rnd() - 0.5) * lv.noise * 2));
      const river = h.street === 'river';
      const stations = opps.filter(o => o.st.h >= 6 && o.st.vpip / o.st.h > 0.55).length; // 什么都跟的人：别诈唬他
      if (lv.rk && r < 0.006 && L.canRaise) return RAISE(L.maxTo);                     // 新手偶尔上头
      if (L.canCheck) {
        if (eq >= 0.64 - 0.04 * (n === 1)) {
          if (lv.model === 2 && eq < 0.85 && r < 0.18 && !river) { p.trap = h.street; return CALL; } // 慢打，等着过牌加注
          if (r < 0.35 + lv.agg * 0.6) return RAISE(raiseTo(0.45 + (eq - 0.6) * 1.2 + r * 0.2));
          return CALL;
        }
        if (lv.model && !river && eq >= 0.3 && eq < 0.5 && r < lv.agg * 0.4) return RAISE(raiseTo(0.5));          // 半诈唬
        if (lv.model && p.pr && h.street === 'flop' && n <= 2 && r < lv.agg * 0.55) return RAISE(raiseTo(0.38));  // 持续下注
        if (r < lv.bluff * (n === 1 ? 1.5 : 0.6) * (stations ? 0.3 : 1)) return RAISE(raiseTo(0.55 + r));
        return CALL;
      }
      const allInCall = L.toCall >= p.chips * 0.6;
      const implied = lv.model && !river && !allInCall ? 0.04 : 0;
      if (eq >= 0.8 || (p.trap === h.street && eq >= 0.62)) return RAISE(L.toCall >= p.chips * 0.4 ? L.maxTo : Math.round((L.curBet * (2.4 + r * 0.8)) / sb) * sb);
      if (eq + implied + lv.loose >= odds + (allInCall && lv.model ? 0.05 : 0)) {
        if (lv.model && !river && eq > 0.66 && r < lv.agg * 0.35) return RAISE(Math.round(L.curBet * 2.6 / sb) * sb);
        return CALL;
      }
      if (lv.model && h.street === 'flop' && eq >= 0.3 && r < lv.agg * 0.1 && !allInCall) return RAISE(Math.round(L.curBet * 2.8 / sb) * sb); // 半诈唬加注
      if (lv.rk && r < 0.08 && !allInCall) return CALL;                                                                           // 新手不服气
      return FOLD;
    }

    // ---------- 给某个玩家看的画面 ----------
    view(id) {
      const h = this.hand;
      const me = this.byId(id);
      const done = h && h.street === 'done';
      return {
        settings: this.settings, started: !!this.started, paused: this.paused, handNum: this.handNum,
        nextIn: this.nextAt ? Math.max(0, this.nextAt - this.now()) : 0,
        hand: h && { num: this.handNum, street: h.street, board: h.board, dealer: h.dealer, sb: h.sbSeat, bb: h.bbSeat, toAct: h.toAct,
          curBet: h.curBet, pot: h.pot, results: h.results, deadlineIn: h.deadline ? Math.max(0, h.deadline - this.now()) : 0, frozenIn: h.left || 0 },
        players: this.players.map(p => ({
          id: p.id, seat: p.seat, name: p.name, avatar: p.avatar, chips: p.chips, bet: p.bet, isBot: p.isBot, iq: p.iq, connected: p.connected,
          inHand: p.inHand, folded: p.folded, allIn: p.allIn, lastAction: p.lastAction, actSeq: p.actSeq, rebuys: p.rebuys, loan: p.loan || 0, buyin: p.buyin || 0, cm: h && h.street !== 'done' && p.inHand ? p.committed : 0,
          won: p.won || 0, net: done ? p.net : 0,
          hole: (p.id === id || (p.showCards && !p.folded)) ? p.hole : (p.inHand && p.hole.length ? [-1, -1] : []),
          best: (p.showCards && !p.folded && p.best) ? { cat: p.best.cat, cards: p.best.cards } : null,
        })),
        me: me ? { seat: me.seat, legal: me && h && !this.paused ? this.legal(me) : null,
          handCat: h && me.hole.length && h.board.length ? bestHand(me.hole.concat(h.board)).cat : -1 } : null,
        log: this.log.slice(-30),
      };
    }
  }

  function cardStr(c) { return RANK_CH[rankOf(c)].replace('T', '10') + SUIT_CH[suitOf(c)]; }

  G.Poker = { Game, bestHand, eval5, score, equity, equityR, odds, pfPct, cardStr, rankOf, suitOf, RANK_CH, SUIT_CH, CAT_NAME, SEATS, IQS, PACES, shuffle, randInt };
})(typeof window !== 'undefined' ? window : globalThis);
