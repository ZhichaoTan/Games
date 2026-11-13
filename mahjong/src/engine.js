// ===== 四川麻将 · 血战到底：规则引擎（浏览器和 Node 通用，没有 DOM） =====
// 牌：id 0..107，种类 t = id >> 2（0..26），花色 s = t / 9 | 0（0 万 1 条 2 筒），点数 r = t % 9 + 1
// 座位 0..3，出牌顺序 s → s+1（下家）→ s+2（对家）→ s+3（上家）
// 2v2（rules.team）：对家是队友（0 和 2 一队，1 和 3 一队），互相看得到手牌，轮到自己时可以跟队友换一张牌；
// 队友之间不给钱、不能胡队友打的牌，只剩一队还在打时这一局结束
(function (G) {
  'use strict';

  const SUIT = ['万', '条', '筒'];
  const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const TY = id => id >> 2;
  const SU = t => (t / 9) | 0;
  const RK = t => t % 9 + 1;
  const tileName = t => (t === 9 ? '幺鸡' : NUM[t % 9] + SUIT[SU(t)]);

  const DEFAULT_RULES = {
    swap: true,        // 换三张
    cap: 4,            // 封顶番数，0 = 不封顶
    zimo: 'di',        // 自摸加底 'di' / 自摸加番 'fan'
    dgh: 'pao',        // 点杠花：'pao' 算点炮（放杠的人给）/ 'zimo' 算自摸
    yjjd: true,        // 幺九将对
    mqzz: false,       // 门清中张
    tdh: true,         // 天地胡
    base: 1,           // 底分
    rounds: 8,         // 局数，0 = 不限
    timer: 0,          // 真人每步限时（秒），0 = 不限时
    team: false,       // 2v2 组队
    tswap: 3,          // 2v2：每人每局能跟队友换几次牌，0 = 不限
    queFirst: false,   // 缺门牌必须先打完（false：什么时候打随你，只是打完才能胡）
  };
  const RULE_KEYS = Object.keys(DEFAULT_RULES);
  function cleanRules(r) {
    const o = Object.assign({}, DEFAULT_RULES);
    if (!r || typeof r !== 'object') return o;
    if ('swap' in r) o.swap = !!r.swap;
    if ([0, 2, 3, 4, 5, 6].includes(+r.cap)) o.cap = +r.cap;
    if (r.zimo === 'fan' || r.zimo === 'di') o.zimo = r.zimo;
    if (r.dgh === 'pao' || r.dgh === 'zimo') o.dgh = r.dgh;
    if ('yjjd' in r) o.yjjd = !!r.yjjd;
    if ('mqzz' in r) o.mqzz = !!r.mqzz;
    if ('tdh' in r) o.tdh = !!r.tdh;
    if ([1, 2, 5, 10].includes(+r.base)) o.base = +r.base;
    if ([0, 4, 8, 12, 16].includes(+r.rounds)) o.rounds = +r.rounds;
    if ([0, 10, 15, 20, 30].includes(+r.timer)) o.timer = +r.timer;
    if ('team' in r) o.team = !!r.team;
    if ([0, 1, 2, 3, 5].includes(+r.tswap)) o.tswap = +r.tswap;
    if ('queFirst' in r) o.queFirst = !!r.queFirst;
    return o;
  }

  // ---------------- 随机数：洗牌用 crypto（公平），测试可传种子 ----------------
  function cryptoRand() {
    const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    if (!c) return Math.random;
    const buf = new Uint32Array(64); let i = 64;
    return () => { if (i >= 64) { c.getRandomValues(buf); i = 0; } return buf[i++] / 4294967296; };
  }
  function seeded(seed) {
    let a = seed >>> 0 || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const randInt = (rnd, n) => Math.min(n - 1, Math.floor(rnd() * n));
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = randInt(rnd, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------------- 手牌分析 ----------------
  const counts = ids => { const c = new Array(27).fill(0); for (const id of ids) c[id >> 2]++; return c; };
  const sum = c => { let n = 0; for (let i = 0; i < c.length; i++) n += c[i]; return n; };

  // 一门牌（9 个点数的张数）能不能全部拆成刻子/顺子；带一对将
  const memoSets = new Map(), memoPair = new Map();
  const keyOf = (c, s) => { let k = 0; for (let i = 0; i < 9; i++) k = k * 5 + c[s * 9 + i]; return k; };
  const decode = k => { const a = new Array(9); for (let i = 8; i >= 0; i--) { a[i] = k % 5; k = (k - a[i]) / 5; } return a; };
  function setsOnly(a) {
    let i = 0; while (i < 9 && !a[i]) i++;
    if (i === 9) return true;
    if (a[i] >= 3) { a[i] -= 3; const ok = setsOnly(a); a[i] += 3; if (ok) return true; }
    if (i <= 6 && a[i + 1] && a[i + 2]) { a[i]--; a[i + 1]--; a[i + 2]--; const ok = setsOnly(a); a[i]++; a[i + 1]++; a[i + 2]++; if (ok) return true; }
    return false;
  }
  function suitSets(k) { let v = memoSets.get(k); if (v === undefined) { v = setsOnly(decode(k)); memoSets.set(k, v); } return v; }
  function suitPair(k) {
    let v = memoPair.get(k);
    if (v === undefined) {
      v = false; const a = decode(k);
      for (let i = 0; i < 9 && !v; i++) if (a[i] >= 2) { a[i] -= 2; v = setsOnly(a); a[i] += 2; }
      memoPair.set(k, v);
    }
    return v;
  }
  // 标准胡（n 组 + 一对将），c 是暗牌张数（3n+2 张）
  function isStdHu(c) {
    let ps = -1;
    for (let s = 0; s < 3; s++) {
      let n = 0; for (let i = 0; i < 9; i++) n += c[s * 9 + i];
      const m = n % 3;
      if (m === 1) return false;
      if (m === 2) { if (ps >= 0) return false; ps = s; }
    }
    if (ps < 0) return false;
    for (let s = 0; s < 3; s++) if (!(s === ps ? suitPair(keyOf(c, s)) : suitSets(keyOf(c, s)))) return false;
    return true;
  }
  const isQidui = (c, nMelds) => { if (nMelds) return false; let n = 0; for (let i = 0; i < 27; i++) { if (c[i] & 1) return false; n += c[i]; } return n === 14; };
  const hasSuit = (c, s) => { if (s < 0) return false; for (let i = s * 9; i < s * 9 + 9; i++) if (c[i]) return true; return false; };
  // 能不能胡：没有缺门的牌，标准胡或七对
  function isHu(c, nMelds, que) { if (hasSuit(c, que)) return false; return isStdHu(c) || isQidui(c, nMelds); }
  // 听哪些牌（c 是 3n+1 张暗牌；all = 暗牌加上碰杠的张数，用来排除已经四张都在自己手里的）
  function waits(c, nMelds, que, all) {
    const w = [];
    if (hasSuit(c, que)) return w;
    for (let t = 0; t < 27; t++) {
      if (SU(t) === que) continue;
      if ((all ? all[t] : c[t]) >= 4) continue;
      c[t]++; if (isHu(c, nMelds, que)) w.push(t); c[t]--;
    }
    return w;
  }
  // 所有拆法（算番时用）：{ pair, sets: [{k:'p'|'c', t}] }
  function decomps(c) {
    const out = [], cur = [];
    const a = c.slice();
    (function rec(i, pair) {
      while (i < 27 && !a[i]) i++;
      if (i === 27) { if (pair >= 0) out.push({ pair, sets: cur.slice() }); return; }
      if (a[i] >= 3) { a[i] -= 3; cur.push({ k: 'p', t: i }); rec(i, pair); cur.pop(); a[i] += 3; }
      if (i % 9 <= 6 && a[i + 1] && a[i + 2]) { a[i]--; a[i + 1]--; a[i + 2]--; cur.push({ k: 'c', t: i }); rec(i, pair); cur.pop(); a[i]++; a[i + 1]++; a[i + 2]++; }
      if (pair < 0 && a[i] >= 2) { a[i] -= 2; rec(i, i); a[i] += 2; }
    })(0, -1);
    return out;
  }
  const isTerm = t => t % 9 === 0 || t % 9 === 8;
  const meldN = m => (m.k === 'peng' ? 3 : 4);

  // 算番。conc：暗牌（含胡的那张），melds：[{k,t}]，ctx：{zimo,drew,gangHua,gangPao,rob,haidi,tian,di}
  // drew：胡的那张是自己摸的（点杠花按点炮算时 zimo 是 false，但最后一张还是叫海底捞月）
  // 返回 { fan（封顶后）, raw, title, items:[[名字,番]] }
  function calcFan(conc, melds, ctx, rules) {
    rules = rules || DEFAULT_RULES; ctx = ctx || {};
    const all = conc.slice(); for (const m of melds) all[m.t] += meldN(m);
    let suits = 0, gen = 0, yao = 0;
    for (let t = 0; t < 27; t++) if (all[t]) { suits |= 1 << SU(t); if (all[t] === 4) gen++; if (isTerm(t)) yao += all[t]; }
    const qing = suits === 1 || suits === 2 || suits === 4;
    const r258 = (() => { for (let t = 0; t < 27; t++) if (all[t] && ![2, 5, 8].includes(RK(t))) return false; return true; })();
    let best = null;
    const consider = (items, title) => { const f = items.reduce((a, x) => a + x[1], 0); if (!best || f > best.f) best = { f, items, title }; };
    if (isQidui(conc, melds.length)) {
      const items = [['七对', 2]]; if (qing) items.unshift(['清一色', 2]);
      consider(items, (qing ? '清' : '') + (gen ? '龙七对' : '七对'));
    }
    for (const d of decomps(conc)) {
      const pungs = d.sets.every(x => x.k === 'p');
      const jingou = melds.length === 4;
      const allKong = jingou && melds.every(m => m.k !== 'peng');
      const yj = rules.yjjd && isTerm(d.pair) && melds.every(m => isTerm(m.t)) && d.sets.every(x => x.k === 'p' ? isTerm(x.t) : (x.t % 9 === 0 || x.t % 9 === 6));
      const jd = rules.yjjd && pungs && r258;
      const items = [];
      if (qing) items.push(['清一色', 2]);
      if (pungs) items.push(['对对胡', 1]);
      if (jingou) items.push(['金钩钓', 1]);
      if (jd) items.push(['将对', 2]);
      if (yj) items.push(['带幺九', 2]);
      let title;
      if (allKong) title = (qing ? '清' : '') + '十八罗汉';
      else if (jingou) title = jd ? '将金钩钓' : (qing ? '清金钩钓' : '金钩钓');
      else if (jd) title = '将对';
      else if (pungs) title = yj ? (qing ? '清幺九' : '幺九对') : (qing ? '清对' : '对对胡');
      else if (yj) title = qing ? '清幺九' : '带幺九';
      else title = qing ? '清一色' : '平胡';
      consider(items, title);
    }
    if (!best) return null;
    const items = best.items.slice();
    if (gen) items.push(['根', gen]);
    if (rules.mqzz) {
      if (melds.every(m => m.k === 'angang')) items.push(['门清', 1]);
      if (!yao) items.push(['中张', 1]);
    }
    if (ctx.tian && rules.tdh) items.push(['天胡', 5]);
    if (ctx.di && rules.tdh) items.push(['地胡', 5]);
    if (ctx.gangHua) items.push(['杠上开花', 1]);
    if (ctx.gangPao) items.push(['杠上炮', 1]);
    if (ctx.rob) items.push(['抢杠胡', 1]);
    if (ctx.haidi) items.push([ctx.zimo || ctx.drew ? '海底捞月' : '海底炮', 1]);
    if (ctx.zimo && rules.zimo === 'fan') items.push(['自摸', 1]);
    const raw = items.reduce((a, x) => a + x[1], 0);
    const fan = rules.cap ? Math.min(rules.cap, raw) : raw;
    return { fan, raw, title: best.title, items };
  }

  // ---------------- 牌桌（一场：多局，累计分数） ----------------
  // seats[s] = { id, name, av, bot, lv, token, score, conn, auto }
  class Table {
    constructor(opts) {
      opts = opts || {};
      this.rules = cleanRules(opts.rules);
      this.rnd = opts.seed != null ? seeded(opts.seed) : cryptoRand();
      this.seats = [null, null, null, null];
      this.roundNo = 0;
      this.dealer = -1;
      this.R = null;
      this.hist = [];
      this.evn = 0;
      this.over = false;
    }
    // ----- 事件（给界面做动画、出声音） -----
    emit(k, o) {
      const e = Object.assign({ n: ++this.evn, k }, o || {});
      const R = this.R; if (R) { R.ev.push(e); if (R.ev.length > 80) R.ev.splice(0, R.ev.length - 80); }
      return e;
    }
    active() { const R = this.R; return [0, 1, 2, 3].filter(s => !R.hu[s]); }
    // 2v2：队友是对家
    mate(s) { return (s + 2) % 4; }
    isMate(a, b) { return !!this.rules.team && a !== b && (a & 1) === (b & 1); }
    // a 和 b 是对手（会互相给钱）
    foes(a, b) { return a !== b && !this.isMate(a, b); }
    // 这一局还要不要接着打：只剩一家，或者 2v2 只剩一队
    roundDone() { const a = this.active(); return a.length <= 1 || (!!this.rules.team && a.every(s => (s & 1) === (a[0] & 1))); }
    hasQue(s) { const R = this.R; return R.que[s] >= 0 && R.hands[s].some(id => SU(TY(id)) === R.que[s]); }
    allCounts(s) { const R = this.R; const c = counts(R.hands[s]); for (const m of R.melds[s]) c[m.t] += meldN(m); return c; }
    // ----- 开局 -----
    startRound() {
      if (this.over) return false;
      if (this.R && this.R.phase !== 'end') return false;
      this.roundNo++;
      if (this.dealer < 0) this.dealer = randInt(this.rnd, 4);
      const wall = shuffle([...Array(108).keys()], this.rnd);
      const dealer = this.dealer;
      const R = this.R = {
        no: this.roundNo, dealer, phase: this.rules.swap ? 'swap' : 'que', stage: null,
        wall, dice: [1 + randInt(this.rnd, 6), 1 + randInt(this.rnd, 6)],
        hands: [[], [], [], []], melds: [[], [], [], []], river: [[], [], [], []],
        que: [-1, -1, -1, -1], swapPick: [null, null, null, null], swapDir: 0, swapGot: [null, null, null, null],
        turn: dealer, drawn: null, canSelf: false, claim: null,
        hu: [0, 0, 0, 0], huN: 0, wins: [], passHu: [false, false, false, false], passFan: [-1, -1, -1, -1],
        deltas: [0, 0, 0, 0], ledger: [], discards: 0, claims: 0, firstDone: [false, false, false, false],
        afterKong: -1, lastKong: null, lastDiscard: null, ev: [], result: null,
        tsLeft: [0, 1, 2, 3].map(() => (this.rules.team ? (this.rules.tswap || 99) : 0)), tsUsed: -1, offer: null,
      };
      for (let i = 0; i < 13; i++) for (let k = 0; k < 4; k++) R.hands[(dealer + k) % 4].push(wall.pop());
      R.hands[dealer].push(wall.pop());
      for (const h of R.hands) h.sort((a, b) => a - b);
      this.emit('deal', { dealer, dice: R.dice, no: R.no });
      return true;
    }
    // ----- 统一入口：act(seat, a) → 'ok' 或错误码 -----
    act(s, a) {
      const R = this.R;
      if (!R || !a || typeof a !== 'object') return 'bad';
      if (!(s >= 0 && s < 4)) return 'bad';
      switch (a.k) {
        case 'swap': return this.actSwap(s, a.ids);
        case 'que': return this.actQue(s, a.s);
        case 'discard': return this.actDiscard(s, a.id);
        case 'zimo': return this.actZimo(s);
        case 'angang': return this.actAnGang(s, a.t);
        case 'bugang': return this.actBuGang(s, a.t);
        case 'hu': case 'peng': case 'gang': case 'pass': return this.actClaim(s, a.k);
        case 'tswap': return this.actTSwap(s, a.give, a.take);
        case 'tsyes': case 'tsno': return this.actTSAnswer(s, a.k === 'tsyes');
        case 'tsback': return this.actTSBack(s);
      }
      return 'bad';
    }
    // ----- 换三张 -----
    actSwap(s, ids) {
      const R = this.R;
      if (R.phase !== 'swap') return 'phase';
      if (R.swapPick[s]) return 'done';
      if (!Array.isArray(ids) || ids.length !== 3) return 'bad';
      ids = ids.map(x => x | 0);
      if (new Set(ids).size !== 3 || !ids.every(id => R.hands[s].includes(id))) return 'bad';
      const su = SU(TY(ids[0])); if (!ids.every(id => SU(TY(id)) === su)) return 'suit';
      R.swapPick[s] = ids;
      this.emit('swapPick', { s });
      if (R.swapPick.every(Boolean)) this.doSwap();
      return 'ok';
    }
    doSwap() {
      const R = this.R;
      const dir = 1 + randInt(this.rnd, 3); // 1 给下家（逆时针） 2 给对家 3 给上家（顺时针）
      R.swapDir = dir;
      for (let s = 0; s < 4; s++) R.hands[s] = R.hands[s].filter(id => !R.swapPick[s].includes(id));
      for (let s = 0; s < 4; s++) { const to = (s + dir) % 4; R.hands[to].push(...R.swapPick[s]); R.swapGot[to] = R.swapPick[s].slice(); }
      for (const h of R.hands) h.sort((a, b) => a - b);
      R.phase = 'que';
      this.emit('swap', { dir });
    }
    // ----- 定缺 -----
    actQue(s, su) {
      const R = this.R;
      if (R.phase !== 'que') return 'phase';
      if (R.que[s] >= 0) return 'done';
      su = su | 0; if (su < 0 || su > 2) return 'bad';
      R.que[s] = su;
      this.emit('quePick', { s });
      if (R.que.every(q => q >= 0)) this.startPlay();
      return 'ok';
    }
    startPlay() {
      const R = this.R;
      R.phase = 'play'; R.turn = R.dealer; R.stage = 'discard'; R.canSelf = true;
      const h = R.hands[R.dealer]; R.drawn = h[h.length - 1];
      // 庄家的第 14 张显示成刚摸的（挑一张非缺门、最右边的）
      const nonQue = h.filter(id => SU(TY(id)) !== R.que[R.dealer]);
      R.drawn = (nonQue.length ? nonQue : h)[(nonQue.length ? nonQue : h).length - 1];
      this.emit('que', { que: R.que.slice() });
    }
    // ----- 出牌 -----
    actDiscard(s, id) {
      const R = this.R;
      if (R.phase !== 'play' || R.stage !== 'discard' || R.turn !== s) return 'turn';
      id = id | 0;
      const i = R.hands[s].indexOf(id); if (i < 0) return 'bad';
      if (this.rules.queFirst && this.hasQue(s) && SU(TY(id)) !== R.que[s]) return 'que';
      R.hands[s].splice(i, 1);
      R.river[s].push(id);
      R.discards++; R.firstDone[s] = true;
      const gangPao = R.afterKong === s;
      R.afterKong = -1; R.canSelf = false; R.drawn = null; R.tsUsed = -1;
      R.lastDiscard = { s, id };
      this.emit('discard', { s, id });
      this.openClaim('discard', s, id, gangPao);
      return 'ok';
    }
    // o 胡别人打出（或补杠）的 t 能算几番
    claimFan(o, t, kind, gangPao) {
      const R = this.R, c = counts(R.hands[o]); c[t]++;
      return calcFan(c, R.melds[o], { gangPao: kind === 'discard' && !!gangPao, rob: kind === 'rob', haidi: R.wall.length === 0 && kind !== 'rob' }, this.rules);
    }
    // 别人打出（或补杠）一张牌：看谁能胡/碰/杠
    claimOpts(o, t, kind, from, gangPao) {
      const R = this.R;
      if (R.hu[o]) return null;
      const isQ = SU(t) === R.que[o];
      const op = {};
      // 2v2：不能胡队友打的（或者抢队友的杠）
      if (!isQ && !this.hasQue(o) && !this.isMate(o, from)) {
        const c = counts(R.hands[o]); c[t]++;
        if (isHu(c, R.melds[o].length, R.que[o])) {
          // 过手胡：放过一手胡以后，自己摸牌之前只能胡番数更大的
          if (!R.passHu[o]) op.hu = true;
          else { const f = this.claimFan(o, t, kind, gangPao); if (f && f.fan > (R.passFan ? R.passFan[o] : 99)) op.hu = true; }
        }
      }
      if (kind === 'discard' && R.wall.length > 0 && !isQ) {
        let n = 0; for (const x of R.hands[o]) if (TY(x) === t) n++;
        if (n >= 2) op.peng = true;
        if (n >= 3) op.gang = true;
      }
      return Object.keys(op).length ? op : null;
    }
    openClaim(kind, from, id, gangPao) {
      const R = this.R, t = TY(id);
      const opts = [null, null, null, null];
      let any = false;
      for (let k = 1; k < 4; k++) { const o = (from + k) % 4; opts[o] = this.claimOpts(o, t, kind, from, gangPao); if (opts[o]) any = true; }
      if (!any) {
        if (kind === 'discard') return this.nextTurn(from);
        return this.completeBuGang(from, id);
      }
      R.claim = { kind, from, id, t, opts, resp: [null, null, null, null], gangPao: !!gangPao };
      R.stage = 'claim';
      this.emit('claim', { kind, from, id });
    }
    actClaim(s, k) {
      const R = this.R, C = R.claim;
      if (R.phase !== 'play' || R.stage !== 'claim' || !C) return 'phase';
      const op = C.opts[s];
      if (!op || C.resp[s]) return 'no';
      if (k !== 'pass' && !op[k]) return 'no';
      C.resp[s] = k;
      // 过手胡：自己摸牌之前，只能胡比放过的这手番数更大的牌
      if (op.hu && k !== 'hu') {
        const f = this.claimFan(s, C.t, C.kind, C.gangPao);
        if (!R.passFan) R.passFan = [-1, -1, -1, -1];
        R.passHu[s] = true; R.passFan[s] = Math.max(R.passFan[s], f ? f.fan : 0);
      }
      this.tryResolve();
      return 'ok';
    }
    tryResolve() {
      const R = this.R, C = R.claim;
      const seats = [1, 2, 3].map(k => (C.from + k) % 4);
      if (seats.some(o => C.opts[o] && C.opts[o].hu && !C.resp[o])) return;   // 还有人能胡没表态
      const winners = seats.filter(o => C.resp[o] === 'hu');
      if (winners.length) return this.resolveHu(winners);
      if (seats.some(o => C.opts[o] && !C.resp[o])) return;
      const g = seats.find(o => C.resp[o] === 'gang'), p = seats.find(o => C.resp[o] === 'peng');
      R.claim = null;
      if (C.kind === 'rob') return this.completeBuGang(C.from, C.id);
      if (g != null) return this.doMingGang(g, C);
      if (p != null) return this.doPeng(p, C);
      this.nextTurn(C.from);
    }
    takeFromRiver(C) {
      const R = this.R, rv = R.river[C.from];
      if (rv[rv.length - 1] === C.id) rv.pop(); else { const i = rv.indexOf(C.id); if (i >= 0) rv.splice(i, 1); }
    }
    resolveHu(winners) {
      const R = this.R, C = R.claim;
      R.claim = null;
      if (C.kind === 'discard') this.takeFromRiver(C);
      else { // 抢杠：那张牌从补杠的人手里拿走，碰还是碰
        const h = R.hands[C.from], i = h.indexOf(C.id); if (i >= 0) h.splice(i, 1);
      }
      const multi = winners.length > 1;
      for (const w of winners) this.recordWin(w, C.kind === 'rob' ? 'rob' : 'pao', C.from, C.id, { gangPao: C.gangPao, multi });
      // 呼叫转移：杠完放炮，那次杠的钱给胡的人（一炮多响给第一个）
      if (C.gangPao && R.lastKong && R.lastKong.s === C.from) this.transferKong(R.lastKong, winners[0]);
      if (multi) this.emit('multi', { from: C.from, n: winners.length });
      if (this.roundDone()) return this.endRound('hu');
      this.nextTurn(winners[winners.length - 1]);
    }
    doPeng(s, C) {
      const R = this.R;
      this.takeFromRiver(C);
      const h = R.hands[s], ids = [C.id];
      for (let i = h.length - 1; i >= 0 && ids.length < 3; i--) if (TY(h[i]) === C.t) ids.push(h.splice(i, 1)[0]);
      R.melds[s].push({ k: 'peng', t: C.t, ids, from: C.from });
      R.claims++; R.lastKong = null;
      R.turn = s; R.stage = 'discard'; R.canSelf = false; R.drawn = null; R.afterKong = -1;
      this.emit('peng', { s, from: C.from, t: C.t, id: C.id });
    }
    doMingGang(s, C) {
      const R = this.R;
      this.takeFromRiver(C);
      const h = R.hands[s], ids = [C.id];
      for (let i = h.length - 1; i >= 0 && ids.length < 4; i--) if (TY(h[i]) === C.t) ids.push(h.splice(i, 1)[0]);
      R.melds[s].push({ k: 'gang', t: C.t, ids, from: C.from });
      R.claims++;
      const L = this.kongPay(s, 'ming', C.t, [C.from], 2);
      R.lastKong = { s, kind: 'ming', from: C.from, L };
      this.emit('gang', { s, kind: 'ming', from: C.from, t: C.t, id: C.id });
      this.drawFor(s, true);
    }
    // 刮风下雨：马上给钱。payers 里已经胡了的人不给
    kongPay(s, kind, t, payers, mult) {
      const R = this.R, amt = this.rules.base * mult;
      const from = payers.filter(p => this.foes(p, s) && !R.hu[p]).map(p => ({ s: p, amt }));
      for (const f of from) this.pay(f.s, s, f.amt);
      const L = { k: 'gang', kind, to: s, t, from, moved: false };
      R.ledger.push(L);
      return L;
    }
    transferKong(lk, to) {
      const R = this.R, L = lk.L;
      if (!L || L.moved) return;
      const amt = L.from.reduce((a, f) => a + f.amt, 0);
      L.moved = true;
      if (!amt) return;
      this.pay(lk.s, to, amt);
      R.ledger.push({ k: 'zhuan', to, from: [{ s: lk.s, amt }] });
      this.emit('zhuan', { from: lk.s, to, amt });
    }
    pay(from, to, amt) { const R = this.R; R.deltas[from] -= amt; R.deltas[to] += amt; }
    // ----- 自己回合：自摸、暗杠、补杠 -----
    selfOpts(s) {
      const R = this.R;
      if (R.phase !== 'play' || R.stage !== 'discard' || R.turn !== s) return null;
      // que：手里还有缺门的牌（不能胡）；queLock：房间规定缺门要先打，只能打缺门
      const o = { hu: false, an: [], bu: [], que: this.hasQue(s), ts: this.canTSwap(s) };
      o.queLock = !!this.rules.queFirst && o.que;
      if (o.ts) o.tsLeft = R.tsLeft[s];
      if (!R.canSelf) return o;
      const c = counts(R.hands[s]);
      if (!o.que && isHu(c, R.melds[s].length, R.que[s])) { o.hu = true; o.payers = this.winPayers(s, true); o.dg = this.isDgPao(s, true); }
      if (R.wall.length > 0) {
        for (let t = 0; t < 27; t++) if (c[t] === 4 && SU(t) !== R.que[s]) o.an.push(t);
        for (const m of R.melds[s]) if (m.k === 'peng' && c[m.t] >= 1) o.bu.push(m.t);
      }
      return o;
    }
    // 点杠花算点炮：直杠补上来的牌自摸，只有放杠的人给
    isDgPao(s, zimo) {
      const R = this.R;
      return !!(zimo && R.afterKong === s && R.lastKong && R.lastKong.kind === 'ming' && this.rules.dgh === 'pao' && !R.hu[R.lastKong.from] && this.foes(R.lastKong.from, s));
    }
    // 这把胡了谁给钱（给界面提前画出来）
    winPayers(s, zimo, from) {
      if (this.isDgPao(s, zimo)) return [this.R.lastKong.from];
      return zimo ? this.active().filter(p => this.foes(p, s)) : [from];
    }
    actZimo(s) {
      const o = this.selfOpts(s); if (!o || !o.hu) return 'no';
      const R = this.R;
      this.recordWin(s, 'zimo', -1, R.drawn != null ? R.drawn : R.hands[s][R.hands[s].length - 1], {});
      if (this.roundDone()) { this.endRound('hu'); return 'ok'; }
      this.nextTurn(s);
      return 'ok';
    }
    actAnGang(s, t) {
      const o = this.selfOpts(s); t = t | 0; if (!o || !o.an.includes(t)) return 'no';
      const R = this.R, h = R.hands[s], ids = [];
      for (let i = h.length - 1; i >= 0; i--) if (TY(h[i]) === t) ids.push(h.splice(i, 1)[0]);
      R.melds[s].push({ k: 'angang', t, ids, from: s });
      R.claims++;
      const L = this.kongPay(s, 'an', t, [0, 1, 2, 3], 2);
      R.lastKong = { s, kind: 'an', from: -1, L };
      this.emit('gang', { s, kind: 'an', t });
      this.drawFor(s, true);
      return 'ok';
    }
    actBuGang(s, t) {
      const o = this.selfOpts(s); t = t | 0; if (!o || !o.bu.includes(t)) return 'no';
      const R = this.R, h = R.hands[s];
      const i = h.findIndex(x => TY(x) === t);
      const id = h[i];
      R.canSelf = false; R.drawn = null;
      this.emit('bugangTry', { s, t, id });
      // 先看有没有人抢杠胡（牌还算在手里，抢走了才拿出来）
      this.openClaim('rob', s, id, false);
      return 'ok';
    }
    completeBuGang(s, id) {
      const R = this.R, t = TY(id), h = R.hands[s];
      const i = h.indexOf(id); if (i >= 0) h.splice(i, 1);
      const m = R.melds[s].find(x => x.k === 'peng' && x.t === t);
      m.k = 'bugang'; m.ids.push(id);
      R.claims++;
      const L = this.kongPay(s, 'bu', t, [0, 1, 2, 3], 1);
      R.lastKong = { s, kind: 'bu', from: -1, L };
      this.emit('gang', { s, kind: 'bu', t, id });
      this.drawFor(s, true);
    }
    // ----- 2v2：跟队友换一张牌（轮到自己出牌时，每回合一次，队友同意才换） -----
    canTSwap(s) {
      const R = this.R;
      if (!this.rules.team || !R || R.phase !== 'play' || R.stage !== 'discard' || R.turn !== s) return false;
      if (R.offer || R.tsUsed === s || !(R.tsLeft && R.tsLeft[s] > 0)) return false;
      return !R.hu[s] && !R.hu[this.mate(s)];
    }
    actTSwap(s, give, take) {
      if (!this.canTSwap(s)) return 'no';
      const R = this.R, m = this.mate(s);
      give = give | 0; take = take | 0;
      if (!R.hands[s].includes(give) || !R.hands[m].includes(take)) return 'bad';
      if (TY(give) === TY(take)) return 'bad';
      R.offer = { from: s, to: m, give, take };
      R.stage = 'offer';
      this.emit('tsAsk', { s, to: m, give, take });
      return 'ok';
    }
    actTSAnswer(s, yes) {
      const R = this.R, O = R.offer;
      if (!R || R.phase !== 'play' || R.stage !== 'offer' || !O || O.to !== s) return 'no';
      R.offer = null; R.stage = 'discard'; R.tsUsed = O.from;
      if (!yes) { this.emit('tswap', { s: O.from, to: O.to, give: O.give, take: O.take, ok: false }); return 'ok'; }
      const a = R.hands[O.from], b = R.hands[O.to];
      a.splice(a.indexOf(O.give), 1); b.splice(b.indexOf(O.take), 1);
      a.push(O.take); b.push(O.give);
      if (this.rules.tswap) R.tsLeft[O.from]--;   // 不限次数的房间不扣
      // 换来的那张当成刚摸的：可以自摸、可以暗杠/补杠；不算杠上开花，也不再有天胡地胡
      R.drawn = O.take; R.canSelf = true; R.afterKong = -1; R.claims++;
      this.emit('tswap', { s: O.from, to: O.to, give: O.give, take: O.take, ok: true });
      return 'ok';
    }
    actTSBack(s) {
      const R = this.R, O = R.offer;
      if (!R || R.phase !== 'play' || R.stage !== 'offer' || !O || O.from !== s) return 'no';
      R.offer = null; R.stage = 'discard'; R.tsUsed = s;
      this.emit('tswap', { s, to: O.to, give: O.give, take: O.take, ok: false, back: true });
      return 'ok';
    }
    // ----- 摸牌 -----
    nextTurn(after) {
      const R = this.R;
      R.lastKong = null; R.claim = null;
      for (let k = 1; k <= 4; k++) { const s = (after + k) % 4; if (!R.hu[s]) return this.drawFor(s, false); }
      this.endRound('hu');
    }
    drawFor(s, kong) {
      const R = this.R;
      if (!kong) R.lastKong = null;
      if (R.wall.length === 0) return this.endRound('wall');
      const id = R.wall.pop();
      R.hands[s].push(id);
      R.drawn = id; R.turn = s; R.stage = 'discard'; R.canSelf = true; R.passHu[s] = false; if (R.passFan) R.passFan[s] = -1;
      R.afterKong = kong ? s : -1;
      this.emit('draw', { s, id, kong: !!kong, left: R.wall.length });
    }
    // ----- 胡牌 -----
    recordWin(s, how, from, id, x) {
      const R = this.R, rules = this.rules, t = TY(id);
      const conc = counts(R.hands[s]);
      if (how !== 'zimo') conc[t]++;
      const zimo = how === 'zimo';
      const ctx = {
        zimo, drew: zimo, gangHua: zimo && R.afterKong === s, gangPao: how === 'pao' && !!x.gangPao, rob: how === 'rob',
        haidi: R.wall.length === 0 && how !== 'rob',
        tian: zimo && s === R.dealer && R.discards === 0 && R.claims === 0,
        di: zimo && s !== R.dealer && !R.firstDone[s] && R.claims === 0,
      };
      // 点杠花算点炮：直杠补上来的牌自摸，只有放杠的人给，按点炮算（不加自摸）
      const dgPao = this.isDgPao(s, zimo);
      const f = calcFan(conc, R.melds[s], dgPao ? Object.assign({}, ctx, { zimo: false }) : ctx, rules);
      const base = rules.base;
      let amt = base * Math.pow(2, f.fan);
      let payers;
      if (zimo && !dgPao) { payers = this.active().filter(p => this.foes(p, s)); if (rules.zimo === 'di') amt += base; }
      else payers = [dgPao ? R.lastKong.from : from];
      const L = { k: 'hu', to: s, how: dgPao ? 'dgh' : how, from: payers.map(p => ({ s: p, amt })), title: f.title, items: f.items, fan: f.fan, raw: f.raw, t, multi: !!x.multi, by: from };
      for (const p of payers) this.pay(p, s, amt);
      R.ledger.push(L);
      // 胡的那张单独放（一炮多响时几个人共用一张），自摸的从手里拿出来
      if (zimo) { const h = R.hands[s], i = h.indexOf(id); if (i >= 0) h.splice(i, 1); }
      R.hu[s] = ++R.huN;
      const W = { s, how, from: dgPao ? R.lastKong.from : from, id, t, fan: f.fan, raw: f.raw, title: f.title, items: f.items, amt, payers, order: R.huN, multi: !!x.multi };
      R.wins.push(W);
      this.emit('hu', { s, how, from: W.from, id, t, fan: f.fan, title: f.title, items: f.items, amt, payers, order: R.huN, multi: !!x.multi });
    }
    // ----- 一局结束：查花猪、查大叫、退税 -----
    tingInfo(s) {
      const R = this.R, c = counts(R.hands[s]);
      const all = this.allCounts(s);
      const hua = this.hasQue(s);
      if (hua) return { hua, ting: false, waits: [], max: 0 };
      const w = waits(c, R.melds[s].length, R.que[s], all);
      let max = 0, best = null;
      for (const t of w) {
        c[t]++; const f = calcFan(c, R.melds[s], {}, this.rules); c[t]--;
        if (f && f.fan >= max) { max = f.fan; best = f; }
      }
      return { hua, ting: w.length > 0, waits: w, max, best };
    }
    endRound(reason) {
      const R = this.R, rules = this.rules;
      if (R.phase === 'end') return;
      R.phase = 'end'; R.stage = null; R.claim = null; R.offer = null; R.endReason = reason;
      const act = this.active();
      const info = [null, null, null, null];
      if (reason === 'wall' && act.length >= 2 && act.some(a => act.some(b => this.foes(a, b)))) {
        for (const s of act) info[s] = this.tingInfo(s);
        const pigAmt = rules.base * Math.pow(2, rules.cap || 6);
        // 查花猪：花猪赔给每个不是花猪的人封顶番
        for (const a of act) if (info[a].hua) for (const b of act) if (this.foes(a, b) && !info[b].hua) {
          this.pay(a, b, pigAmt); R.ledger.push({ k: 'pig', to: b, from: [{ s: a, amt: pigAmt }] });
        }
        // 查大叫：没听牌的赔给听牌的人（按他最大的番）
        for (const a of act) if (!info[a].hua && !info[a].ting) for (const b of act) if (this.foes(a, b) && info[b].ting) {
          const amt = rules.base * Math.pow(2, info[b].max);
          this.pay(a, b, amt); R.ledger.push({ k: 'cha', to: b, from: [{ s: a, amt }], fan: info[b].max, title: info[b].best ? info[b].best.title : '' });
        }
        // 退税：没听牌的人把刮风下雨收的钱退回去
        for (const a of act) if (!info[a].ting) {
          for (const L of R.ledger.slice()) if (L.k === 'gang' && L.to === a && !L.moved && !L.refunded) {
            L.refunded = true;
            for (const f of L.from) { this.pay(a, f.s, f.amt); R.ledger.push({ k: 'tax', to: f.s, from: [{ s: a, amt: f.amt }], t: L.t }); }
          }
        }
      }
      // 下一局庄家：第一个胡的人；第一炮是一炮多响就是放炮的人；没人胡就连庄
      let next = R.dealer;
      if (R.wins.length) { const w = R.wins[0]; next = w.multi ? w.from : w.s; }
      for (let s = 0; s < 4; s++) if (this.seats[s]) this.seats[s].score += R.deltas[s];
      R.result = { reason, deltas: R.deltas.slice(), info: info.map(x => x && { hua: x.hua, ting: x.ting, waits: x.waits, max: x.max }), next };
      this.hist.push({ no: R.no, dealer: R.dealer, deltas: R.deltas.slice(), wins: R.wins.map(w => ({ s: w.s, how: w.how, title: w.title, fan: w.fan })) });
      this.dealer = next;
      if (rules.rounds && this.roundNo >= rules.rounds) this.over = true;
      this.emit('end', { reason, deltas: R.deltas.slice() });
    }
    // ----- 谁该动了 -----
    pending() {
      const R = this.R; if (!R) return [];
      if (R.phase === 'swap') return [0, 1, 2, 3].filter(s => !R.swapPick[s]);
      if (R.phase === 'que') return [0, 1, 2, 3].filter(s => R.que[s] < 0);
      if (R.phase === 'play') {
        if (R.stage === 'discard') return [R.turn];
        if (R.stage === 'offer' && R.offer) return [R.offer.to];
        if (R.stage === 'claim' && R.claim) {
          const C = R.claim, out = [];
          const anyHu = [0, 1, 2, 3].some(o => C.resp[o] === 'hu');
          for (let o = 0; o < 4; o++) if (C.opts[o] && !C.resp[o]) {
            if (anyHu && !C.opts[o].hu) continue;        // 已经有人胡了，只能碰杠的人不用等
            out.push(o);
          }
          return out;
        }
      }
      return [];
    }
    // 给某个座位的选项
    options(s) {
      const R = this.R; if (!R) return null;
      if (R.phase === 'swap') return R.swapPick[s] ? null : { k: 'swap' };
      if (R.phase === 'que') return R.que[s] >= 0 ? null : { k: 'que' };
      if (R.phase !== 'play') return null;
      if (R.stage === 'discard' && R.turn === s) return Object.assign({ k: 'turn' }, this.selfOpts(s));
      if (R.stage === 'offer' && R.offer && R.offer.to === s) return { k: 'offer', from: R.offer.from, give: R.offer.give, take: R.offer.take };
      if (R.stage === 'claim' && R.claim && R.claim.opts[s] && !R.claim.resp[s] && this.pending().includes(s))
        return Object.assign({ k: 'claim', id: R.claim.id, t: R.claim.t, kind: R.claim.kind, from: R.claim.from }, R.claim.opts[s]);
      return null;
    }
    // ----- 给某个座位看的画面（藏住别人的手牌） -----
    view(me) {
      const R = this.R, rules = this.rules;
      const mine = me >= 0 && me < 4;
      const mate = mine && rules.team ? this.mate(me) : -1;
      const sees = s => s === me || s === mate;   // 自己和队友的牌都看得到
      const v = { rules, roundNo: this.roundNo, over: this.over, dealer: this.dealer, me, hist: this.hist, evn: this.evn };
      v.seats = this.seats.map(p => p && { id: p.id, name: p.name, av: p.av, bot: !!p.bot, lv: p.lv || 0, score: p.score, conn: p.conn !== false, auto: !!p.auto, ready: !!p.ready });
      if (!R) return v;
      const end = R.phase === 'end';
      const showQue = R.phase === 'play' || end;
      v.R = {
        no: R.no, dealer: R.dealer, phase: R.phase, stage: R.stage, turn: R.turn, wall: R.wall.length, dice: R.dice,
        swapDir: R.phase === 'swap' ? 0 : R.swapDir, swapDone: R.swapPick.map(Boolean), queDone: R.que.map(q => q >= 0),
        que: R.que.map((q, s) => (showQue || sees(s) ? q : -1)),
        river: R.river.map(r => r.slice()),
        melds: R.melds.map((ms, s) => ms.map(m => ({ k: m.k, t: (m.k === 'angang' && !sees(s) && !end) ? -1 : m.t, ids: (m.k === 'angang' && !sees(s) && !end) ? [] : m.ids.slice(), from: m.from }))),
        counts: R.hands.map(h => h.length),
        hu: R.hu.slice(),
        wins: R.wins.map(w => ({ s: w.s, how: w.how, from: w.from, id: w.id, t: w.t, fan: w.fan, title: w.title, items: w.items, amt: w.amt, payers: w.payers, order: w.order, multi: w.multi })),
        deltas: R.deltas.slice(),
        lastDiscard: R.lastDiscard,
        claimTile: R.stage === 'claim' && R.claim ? { id: R.claim.id, from: R.claim.from, kind: R.claim.kind } : null,
        // 胡了的人把牌亮出来（推倒）；一局结束全亮
        shown: R.hands.map((h, s) => (end || R.hu[s]) ? h.slice() : null),
        ev: R.ev.map(e => (e.k === 'draw' && !sees(e.s)) ? { n: e.n, k: 'draw', s: e.s, kong: e.kong, left: e.left }
          : (e.k === 'gang' && e.kind === 'an' && !sees(e.s) && !end) ? { n: e.n, k: 'gang', s: e.s, kind: 'an', t: -1 }
          : ((e.k === 'tswap' || e.k === 'tsAsk') && !sees(e.s)) ? { n: e.n, k: e.k, s: e.s, to: e.to, ok: e.ok, back: e.back } : e),
        team: !!rules.team,
        tsLeft: (R.tsLeft || [0, 0, 0, 0]).slice(),
        offer: R.offer ? (sees(R.offer.from) ? Object.assign({}, R.offer) : { from: R.offer.from, to: R.offer.to }) : null,
      };
      if (mine) {
        v.R.hand = R.hands[me].slice();
        if (mate >= 0) {
          // 队友的手牌（换三张时扣下的三张也知道是哪几张）
          v.R.mate = mate;
          v.R.mateHand = R.hands[mate].slice();
          v.R.mateDrawn = (R.turn === mate && (R.stage === 'discard' || R.stage === 'offer')) ? R.drawn : null;
          v.R.mateSwapPick = R.swapPick[mate];
        }
        v.R.drawn = (R.turn === me && (R.stage === 'discard' || R.stage === 'offer')) ? R.drawn : null;
        v.R.swapPick = R.swapPick[me];
        v.R.swapGot = R.phase === 'swap' ? null : R.swapGot[me];
        v.R.passHu = R.passHu[me];
        v.R.passFan = R.passFan ? R.passFan[me] : (R.passHu[me] ? 99 : -1);
        v.opt = this.options(me);
      }
      if (end) {
        v.R.hands = R.hands.map(h => h.slice());
        v.R.result = R.result;
        v.R.ledger = R.ledger;
      }
      return v;
    }
    // ----- 存档 -----
    toJSON() { return { rules: this.rules, seats: this.seats, roundNo: this.roundNo, dealer: this.dealer, R: this.R, hist: this.hist, evn: this.evn, over: this.over }; }
    static fromJSON(o) {
      const T = new Table({ rules: o.rules });
      T.seats = o.seats; T.roundNo = o.roundNo; T.dealer = o.dealer; T.R = o.R; T.hist = o.hist || []; T.evn = o.evn || 0; T.over = !!o.over;
      return T;
    }
  }

  const MJ = { SUIT, NUM, TY, SU, RK, tileName, DEFAULT_RULES, RULE_KEYS, cleanRules, counts, sum, isHu, isStdHu, isQidui, waits, decomps, calcFan, hasSuit, Table, seeded, cryptoRand, shuffle, randInt };
  G.MJ = MJ;
  if (typeof module !== 'undefined' && module.exports) module.exports = MJ;
})(typeof window !== 'undefined' ? window : globalThis);
