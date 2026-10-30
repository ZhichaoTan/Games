// ===== 德州扑克引擎（房主端权威，纯逻辑，可在 node 里测试） =====
(function (G) {
  'use strict';
  // 牌：0..51，点数 = (c>>2)+2（2..14），花色 = c&3（0♠ 1♥ 2♦ 3♣）
  const RANK_CH = '??23456789TJQKA';
  const SUIT_CH = ['♠', '♥', '♦', '♣'];
  const rankOf = c => (c >> 2) + 2, suitOf = c => c & 3;
  const CAT_NAME = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺', '皇家同花顺'];

  function shuffle(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
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

  const SEATS = 9;

  class Game {
    constructor(opts) {
      this.settings = Object.assign({ sb: 5, bb: 10, startChips: 1000, turnTime: 30, autoNext: true }, opts.settings || {});
      this.now = opts.now || (() => Date.now());
      this.rnd = opts.rnd || Math.random;
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
    addPlayer({ id, name, isBot, token, avatar }) {
      if (this.players.length >= SEATS) return null;
      let seat = 0; while (this.bySeat(seat)) seat++;
      const p = { id, name, isBot: !!isBot, token, avatar: avatar || 0, seat, chips: this.settings.startChips, rebuys: 0,
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
        if (this.hand.toAct === p.seat) { this.act(p.id, { type: 'fold' }); }
        else { p.folded = true; p.lastAction = 'fold'; p.actSeq = ++this.actSeq; }
      }
      // 已投入的筹码留在底池里：把玩家留到这手结束再删
      if (p.inHand && this.hand && this.hand.street !== 'done') { p.leaving = true; this.afterExternalFold(); }
      else this.players = this.players.filter(x => x !== p);
      this.addLog({ k: 'leave', n: p.name });
      this.changed();
    }
    rebuy(id) {
      const p = this.byId(id);
      if (!p || p.chips > 0 || (p.inHand && this.hand && this.hand.street !== 'done')) return false;
      p.chips = this.settings.startChips; p.rebuys++;
      this.addLog({ k: 'rebuy', n: p.name, a: this.settings.startChips });
      this.changed(); this.maybeAutoStart();
      return true;
    }
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
        const gen = ++this._timerGen;
        this.schedule(() => { if (gen === this._timerGen) { this.nextAt = 0; this.startHand(); } }, 1500);
      }
    }

    start() { this.started = true; this.paused = false; this.maybeAutoStart(); this.changed(); }
    setPaused(v) {
      this.paused = v;
      if (v) { this._timerGen++; this.nextAt = 0; }
      else this.maybeAutoStart();
      this.changed();
    }

    // ---------- 一手牌 ----------
    startHand() {
      // 清理离桌
      this.players = this.players.filter(p => !p.leaving);
      const el = this.eligible();
      if (el.length < 2 || this.paused) { this.hand = null; this.changed(); return; }
      this.handNum++;
      for (const p of this.players) {
        Object.assign(p, { inHand: false, folded: false, allIn: false, bet: 0, committed: 0, acted: false, canRaise: true, hole: [], lastAction: '', actSeq: 0, showCards: false, net: 0, won: 0, best: null });
      }
      el.forEach(p => p.inHand = true);
      this.dealerSeat = this.nextSeat(this.dealerSeat, el);
      let sbSeat, bbSeat;
      if (el.length === 2) { sbSeat = this.dealerSeat; bbSeat = this.nextSeat(sbSeat, el); }
      else { sbSeat = this.nextSeat(this.dealerSeat, el); bbSeat = this.nextSeat(sbSeat, el); }
      const deck = shuffle([...Array(52).keys()], this.rnd);
      this.hand = { num: this.handNum, street: 'preflop', deck, board: [], dealer: this.dealerSeat, sbSeat, bbSeat,
        curBet: 0, minRaise: this.settings.bb, toAct: -1, deadline: 0, results: null, pot: 0 };
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

    act(id, a) {
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
        h.curBet = to;
        p.lastAction = p.allIn ? 'allin' : (wasBet ? 'bet' : 'raise');
        this.addLog({ k: p.lastAction, n: p.name, a: to });
      } else return 'bad-action';
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
      const gen = ++this._timerGen;
      h.deadline = p.isBot ? 0 : this.now() + t;
      if (p.isBot) {
        this.schedule(() => { if (gen === this._timerGen && h === this.hand && h.toAct === p.seat) this.botAct(p); }, 700 + this.rnd() * 1100);
      } else {
        this.schedule(() => {
          if (gen === this._timerGen && h === this.hand && h.toAct === p.seat && h.street !== 'done') {
            const L = this.legal(p);
            this.addLog({ k: 'timeout', n: p.name });
            this.act(p.id, { type: L && L.canCheck ? 'check' : 'fold' });
          }
        }, t);
      }
    }

    endStreet() {
      const h = this.hand;
      for (const p of this.players) { p.bet = 0; p.acted = false; p.canRaise = true; }
      h.pot = this.players.reduce((s, p) => s + p.committed, 0);
      h.curBet = 0; h.minRaise = this.settings.bb; h.toAct = -1; h.deadline = 0;
      const canAct = this.inHand().filter(p => !p.allIn);
      if (h.street === 'river') return this.showdown();
      const runout = canAct.length <= 1;
      if (runout) for (const p of this.inHand()) p.showCards = true; // 全押摊牌：亮牌发完
      this.dealNext();
      this.changed();
      const gen = ++this._timerGen;
      if (runout) {
        this.schedule(() => { if (gen === this._timerGen) this.endStreet(); }, 1700);
      } else {
        for (const p of this.players) if (p.inHand && !p.folded && !p.allIn) p.lastAction = '';
        this.schedule(() => { if (gen === this._timerGen) this.advance(h.dealer); }, 750);
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
      h.street = 'done'; h.toAct = -1; h.deadline = 0;
      for (const p of this.players) { p.net = (p.won || 0) - p.committed; p.bet = 0; }
      h.pot = 0;
      this.changed();
      if (this.settings.autoNext && !this.paused) {
        const gen = ++this._timerGen;
        const wait = h.results && h.results.some(r => r.cat >= 0) ? 7000 : 4000;
        this.nextAt = this.now() + wait;
        this.schedule(() => { if (gen === this._timerGen) { this.nextAt = 0; this.startHand(); } }, wait);
      }
    }

    // ---------- 机器人 ----------
    botAct(p) {
      const h = this.hand, L = this.legal(p);
      if (!L) return;
      const opp = this.inHand().length - 1;
      const eq = equity(p.hole, h.board, Math.max(1, opp), h.board.length ? 260 : 200, this.rnd);
      const pot = this.players.reduce((s, q) => s + q.committed, 0);
      const odds = L.toCall / (pot + L.toCall);
      const r = this.rnd();
      const style = p.style == null ? (p.style = this.rnd()) : p.style; // 0 稳健 ~ 1 激进
      const fair = 1 / (opp + 1);
      const strength = eq / fair; // >1 表示比平均强
      const raiseTo = frac => Math.round(Math.max(L.minTo, Math.min(L.maxTo, L.curBet + Math.max(h.minRaise, frac * (pot + L.toCall)))) / this.settings.sb) * this.settings.sb || L.minTo;
      if (L.canRaise && (eq > 0.8 || strength > 2.2) && r < 0.75 + style * 0.2) {
        const to = eq > 0.9 && r < 0.3 ? L.maxTo : raiseTo(0.6 + r * 0.6);
        return this.act(p.id, { type: 'raise', to });
      }
      if (L.canRaise && strength > 1.4 && r < 0.25 + style * 0.35) return this.act(p.id, { type: 'raise', to: raiseTo(0.45 + r * 0.3) });
      if (L.canCheck) {
        if (L.canRaise && r < 0.06 + style * 0.1) return this.act(p.id, { type: 'raise', to: raiseTo(0.5) }); // 偶尔诈唬
        return this.act(p.id, { type: 'check' });
      }
      if (eq >= odds + 0.04 - style * 0.05 || (L.toCall <= this.settings.bb && strength > 0.7)) return this.act(p.id, { type: 'call' });
      return this.act(p.id, { type: 'fold' });
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
          curBet: h.curBet, pot: h.pot, results: h.results, deadlineIn: h.deadline ? Math.max(0, h.deadline - this.now()) : 0 },
        players: this.players.map(p => ({
          id: p.id, seat: p.seat, name: p.name, avatar: p.avatar, chips: p.chips, bet: p.bet, isBot: p.isBot, connected: p.connected,
          inHand: p.inHand, folded: p.folded, allIn: p.allIn, lastAction: p.lastAction, actSeq: p.actSeq, rebuys: p.rebuys,
          won: p.won || 0, net: done ? p.net : 0,
          hole: (p.id === id || (p.showCards && !p.folded)) ? p.hole : (p.inHand && p.hole.length ? [-1, -1] : []),
          best: (p.showCards && !p.folded && p.best) ? { cat: p.best.cat, cards: p.best.cards } : null,
        })),
        me: me ? { seat: me.seat, legal: me && h ? this.legal(me) : null,
          handCat: h && me.hole.length && h.board.length ? bestHand(me.hole.concat(h.board)).cat : -1 } : null,
        log: this.log.slice(-30),
      };
    }
  }

  function cardStr(c) { return RANK_CH[rankOf(c)].replace('T', '10') + SUIT_CH[suitOf(c)]; }

  G.Poker = { Game, bestHand, eval5, score, equity, cardStr, rankOf, suitOf, RANK_CH, SUIT_CH, CAT_NAME, SEATS };
})(typeof window !== 'undefined' ? window : globalThis);
