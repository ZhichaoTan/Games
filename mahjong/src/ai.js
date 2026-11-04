// ===== 四川麻将 AI：向听数、进张、番型计划、防守 =====
// 只看自己座位的画面（view），不偷看别人的牌
(function (G) {
  'use strict';
  const MJ = G.MJ || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const { TY, SU, RK, counts, isHu, waits, calcFan } = MJ;

  // ---------------- 向听数 ----------------
  const W5 = [390625, 78125, 15625, 3125, 625, 125, 25, 5, 1];
  const NEG = -99;
  const memoF = new Map(), memoG = new Map();
  const keyOf = (c, s) => { let k = 0; for (let i = 0; i < 9; i++) k = k * 5 + c[s * 9 + i]; return k; };
  function digits(key) { const a = new Array(9); for (let i = 8; i >= 0; i--) { a[i] = key % 5; key = (key - a[i]) / 5; } return a; }
  function merge(r, sub, dm, dt) { for (let m = 0; m + dm < 5; m++) if (sub[m] > NEG) { const v = sub[m] + dt; if (v > r[m + dm]) r[m + dm] = v; } }
  // 一门牌：组了 m 个面子时最多有几个搭子
  function fTab(key) {
    let r = memoF.get(key); if (r) return r;
    r = new Int8Array(5).fill(NEG);
    if (key === 0) { r[0] = 0; memoF.set(key, r); return r; }
    const a = digits(key); let i = 0; while (!a[i]) i++;
    const w = W5;
    if (a[i] >= 3) merge(r, fTab(key - 3 * w[i]), 1, 0);
    if (i <= 6 && a[i + 1] && a[i + 2]) merge(r, fTab(key - w[i] - w[i + 1] - w[i + 2]), 1, 0);
    if (a[i] >= 2) merge(r, fTab(key - 2 * w[i]), 0, 1);
    if (i <= 7 && a[i + 1]) merge(r, fTab(key - w[i] - w[i + 1]), 0, 1);
    if (i <= 6 && a[i + 2]) merge(r, fTab(key - w[i] - w[i + 2]), 0, 1);
    merge(r, fTab(key - w[i]), 0, 0);
    memoF.set(key, r); return r;
  }
  // 同上，但这门牌里出一对将
  function gTab(key) {
    let r = memoG.get(key); if (r) return r;
    r = new Int8Array(5).fill(NEG);
    if (key === 0) { memoG.set(key, r); return r; }
    const a = digits(key); let i = 0; while (!a[i]) i++;
    const w = W5;
    if (a[i] >= 2) merge(r, fTab(key - 2 * w[i]), 0, 0);
    if (a[i] >= 3) merge(r, gTab(key - 3 * w[i]), 1, 0);
    if (i <= 6 && a[i + 1] && a[i + 2]) merge(r, gTab(key - w[i] - w[i + 1] - w[i + 2]), 1, 0);
    if (a[i] >= 2) merge(r, gTab(key - 2 * w[i]), 0, 1);
    if (i <= 7 && a[i + 1]) merge(r, gTab(key - w[i] - w[i + 1]), 0, 1);
    if (i <= 6 && a[i + 2]) merge(r, gTab(key - w[i] - w[i + 2]), 0, 1);
    merge(r, gTab(key - w[i]), 0, 0);
    memoG.set(key, r); return r;
  }
  // 标准型向听（dead：不能用的花色位掩码，比如缺门）。死牌占着位置，要补“种子”
  function shantenStd(c, nMelds, dead) {
    const need = 4 - nMelds;
    const F = [], Gh = [];
    let L = 0;
    for (let s = 0; s < 3; s++) {
      if (dead >> s & 1) continue;
      const k = keyOf(c, s);
      for (let i = s * 9; i < s * 9 + 9; i++) L += c[i];
      F.push(fTab(k)); Gh.push(gTab(k));
    }
    let best = 99;
    const n = F.length;
    const ev = (M, T, P) => {
      if (M > need) M = need;
      const Tc = Math.min(T, need - M);
      const used = 3 * M + 2 * Tc + 2 * P;
      const seeds = (need - M - Tc) + (P ? 0 : 1);
      const pen = Math.max(0, seeds - (L - used));
      const v = 8 - 2 * (M + nMelds) - Tc - P + pen;
      if (v < best) best = v;
    };
    for (let h = -1; h < n; h++) {
      const T0 = h === 0 ? Gh[0] : F[0];
      if (n === 1) { for (let a = 0; a < 5; a++) if (T0[a] > NEG) ev(a, T0[a], h >= 0 ? 1 : 0); continue; }
      const T1 = h === 1 ? Gh[1] : F[1];
      if (n === 2) {
        for (let a = 0; a < 5; a++) if (T0[a] > NEG) for (let b = 0; a + b < 5; b++) if (T1[b] > NEG) ev(a + b, T0[a] + T1[b], h >= 0 ? 1 : 0);
        continue;
      }
      const T2 = h === 2 ? Gh[2] : F[2];
      for (let a = 0; a < 5; a++) if (T0[a] > NEG) for (let b = 0; a + b < 5; b++) if (T1[b] > NEG) for (let d = 0; a + b + d < 5; d++) if (T2[d] > NEG) ev(a + b + d, T0[a] + T1[b] + T2[d], h >= 0 ? 1 : 0);
    }
    if (n === 0) best = 8 - 2 * nMelds + (need + 1);
    return best;
  }
  // 七对向听（四张一样算两对）
  function shanten7(c, nMelds, dead) {
    if (nMelds) return 99;
    let P = 0, L = 0;
    for (let t = 0; t < 27; t++) { if (dead >> SU(t) & 1) continue; P += c[t] >> 1; L += c[t]; }
    if (P > 7) P = 7;
    return 6 - P + Math.max(0, 7 + P - L);
  }
  function shanten(c, nMelds, que) {
    const dead = que >= 0 ? 1 << que : 0;
    return Math.min(shantenStd(c, nMelds, dead), shanten7(c, nMelds, dead));
  }

  // ---------------- 从画面算出“我”知道的东西 ----------------
  function know(v) {
    const R = v.R, me = v.me;
    const seen = new Array(27).fill(0);
    for (const id of R.hand) seen[TY(id)]++;
    for (let s = 0; s < 4; s++) {
      for (const id of R.river[s]) seen[TY(id)]++;
      for (const m of R.melds[s]) if (m.t >= 0) seen[m.t] += m.ids.length || (m.k === 'peng' ? 3 : 4);
    }
    // 胡了的人亮出来的牌
    if (R.shown) for (let s = 0; s < 4; s++) if (s !== me && R.shown[s]) for (const id of R.shown[s]) seen[TY(id)]++;
    const winIds = new Set();
    for (const w of R.wins) if (!winIds.has(w.id)) { winIds.add(w.id); seen[w.t]++; }
    // 换出去的三张：我知道在谁手里（还没打出来就当看得见）
    if (R.swapPick && R.swapDir) {
      const gone = counts(R.swapPick);
      const to = (me + R.swapDir) % 4;
      const out = new Array(27).fill(0);
      for (const id of R.river[to]) out[TY(id)]++;
      for (const m of R.melds[to]) if (m.t >= 0) out[m.t] += 3;
      for (let t = 0; t < 27; t++) if (gone[t]) seen[t] += Math.max(0, gone[t] - out[t]);
    }
    const unseen = seen.map(x => Math.max(0, 4 - x));
    const active = [0, 1, 2, 3].filter(s => !R.hu[s]);
    return { seen, unseen, active, U: unseen.reduce((a, b) => a + b, 0) || 1 };
  }

  // ---------------- 牌力评估：几种打法（平胡、七对、清一色），取期望最大 ----------------
  function poissonAtLeast(lam, n) {
    if (n <= 0) return 1;
    let term = Math.exp(-lam), cum = term;
    for (let k = 1; k < n; k++) { term *= lam / k; cum += term; }
    return Math.max(0, 1 - cum);
  }
  // 速度：还差 s 步听牌、进张 uk 张、听牌后大约能等 wEst 张，在剩下 D 次摸牌内胡的概率（Erlang 近似）
  function speedP(s, uk, wEst, ctx, seven) {
    const { U, D, nAct } = ctx;
    if (uk <= 0) return 0;
    const helpWin = 1 + 0.55 * (nAct - 1);   // 别人打出来也能胡
    const helpStep = seven ? 1 : 1 + 0.12 * (nAct - 1);  // 对子可以碰（七对不能碰）
    if (seven && s > 0) wEst = Math.min(wEst, 2.6);       // 七对最后是单钓
    if (s === 0) return 1 - Math.exp(-D * uk / U * helpWin);
    let E = 0;
    for (let i = 0; i < s; i++) E += U / (uk * helpStep * Math.pow(0.78, i));
    E += U / (Math.max(1, wEst) * helpWin);
    return poissonAtLeast(D * (s + 1) / E, s + 1);
  }
  // 听牌时的等张和平均番值（缓存）
  const tenpaiMemo = new Map();
  function tenpaiValue(c, ctx, dead) {
    const key = c.join('') + '|' + ctx.nMelds + '|' + ctx.que + '|' + dead + '|' + ctx.meldKey;
    let r = tenpaiMemo.get(key);
    if (!r) {
      const w = waits(c, ctx.nMelds, ctx.que, null);
      const list = [];
      for (const t of w) {
        if (dead >> SU(t) & 1) continue;
        c[t]++; const f = calcFan(c, ctx.melds, {}, ctx.rules); c[t]--;
        if (f) list.push([t, Math.pow(2, f.fan)]);
      }
      r = list;
      if (tenpaiMemo.size > 20000) tenpaiMemo.clear();
      tenpaiMemo.set(key, r);
    }
    let uk = 0, vs = 0;
    for (const [t, v] of r) { const n = ctx.unseen[t]; uk += n; vs += n * v; }
    return { uk, V: uk ? vs / uk : 0 };
  }
  // 一向听时往前看一步：摸到每张有效牌后，最好的听牌能等几张、值多少
  function lookahead1(c, ctx, p) {
    let tot = 0, wsum = 0, vsum = 0;
    for (let t = 0; t < 27; t++) {
      const n = ctx.unseen[t];
      if (!n || (p.dead >> SU(t) & 1) || c[t] >= 4) continue;
      c[t]++;
      const s2 = p.seven ? shanten7(c, ctx.nMelds, p.dead) : shantenStd(c, ctx.nMelds, p.dead);
      if (s2 === 0 || s2 < 0) {
        let bw = 0, bv = 0, bs = -1;
        for (let d = 0; d < 27; d++) {
          if (!c[d] || d === t && c[d] === 1) continue;
          c[d]--;
          const s3 = p.seven ? shanten7(c, ctx.nMelds, p.dead) : shantenStd(c, ctx.nMelds, p.dead);
          if (s3 === 0) { const tv = tenpaiValue(c, ctx, p.dead); const sc = tv.uk * Math.max(1, tv.V); if (sc > bs) { bs = sc; bw = tv.uk; bv = tv.V; } }
          c[d]++;
        }
        if (bs >= 0) { tot += n; wsum += n * bw; vsum += n * bv; }
      }
      c[t]--;
    }
    return tot ? { w: wsum / tot, V: vsum / tot } : null;
  }
  // c：13 张（或碰杠后的 3n+1 张）暗牌；ctx：{nMelds, que, meldMask, melds, unseen, U, D, nAct, rules, lv, allC}
  function evalHand(c, ctx) {
    const { nMelds, que, meldMask, unseen, rules, lv } = ctx;
    const deadQ = que >= 0 ? 1 << que : 0;
    const cap = rules.cap ? Math.pow(2, rules.cap) : 1e9;
    let gen = 0; for (let t = 0; t < 27; t++) if (ctx.allC[t] + c[t] - ctx.handC0[t] >= 4) gen++;
    if (ctx.meldKey == null) ctx.meldKey = ctx.melds.map(m => m.k[0] + m.t).join(',');
    const plans = [];
    plans.push({ k: 'std', dead: deadQ, seven: false, V: 1 });
    if (!nMelds && ctx.P.qd) plans.push({ k: 'qd', dead: deadQ, seven: true, V: 4 });
    if (ctx.P.qing) for (let x = 0; x < 3; x++) {
      if (x === que || (meldMask & ~(1 << x))) continue;
      let nx = 0, no = 0; for (let t = 0; t < 27; t++) { if (SU(t) === x) nx += c[t]; else if (SU(t) !== que) no += c[t]; }
      if (!no || nx < 7) continue; // 已经清一色了（std 就是）或者差太远
      const dead = 7 & ~(1 << x);
      plans.push({ k: 'qing', dead, seven: false, V: 4 });
      if (!nMelds) plans.push({ k: 'qingqd', dead, seven: true, V: 16 });
    }
    let best = { ev: 0, s: 9, uk: 0, plan: 'std' };
    let stdS = 9, stdUk = 0;
    for (const p of plans) {
      const s = p.seven ? shanten7(c, nMelds, p.dead) : shantenStd(c, nMelds, p.dead);
      if (s > 8) continue;
      if (p.seven && s > (ctx.P.qdGate != null ? ctx.P.qdGate : 9)) continue;   // 对子不够多就别想七对
      let uk = 0, ev, V;
      if (s <= 0) {
        const tv = tenpaiValue(c, ctx, p.dead);
        uk = tv.uk; V = Math.min(cap, tv.V);
        ev = speedP(0, uk, uk, ctx, p.seven) * V * 1.15;
      } else {
        for (let t = 0; t < 27; t++) {
          if (!unseen[t] || (p.dead >> SU(t) & 1) || c[t] >= 4) continue;
          c[t]++;
          const s2 = p.seven ? shanten7(c, nMelds, p.dead) : shantenStd(c, nMelds, p.dead);
          c[t]--;
          if (s2 < s) uk += unseen[t];
        }
        let wEst = Math.max(2, Math.min(9, 2 + uk * 0.18));
        V = Math.min(cap, p.V * Math.pow(2, gen));
        if (s === 1 && ctx.P.look && uk) { const la = lookahead1(c, ctx, p); if (la) { wEst = la.w; V = Math.min(cap, Math.max(1, la.V)); } }
        ev = speedP(s, uk, wEst, ctx, p.seven) * V;
      }
      if (p.k === 'std' || p.k === 'qd') { if (s < stdS || (s === stdS && uk > stdUk)) { stdS = s; stdUk = uk; } }
      if (ev > best.ev || (best.ev === 0 && (s < best.s || (s === best.s && uk > best.uk)))) best = { ev, s, uk, plan: p.k };
    }
    best.stdS = stdS; best.stdUk = stdUk;
    return best;
  }

  // ---------------- 危险度：这张牌打出去会不会点炮 ----------------
  function threats(v, K) {
    const R = v.R, me = v.me, out = [];
    for (const j of K.active) {
      if (j === me) continue;
      const q = R.que[j];
      const rv = R.river[j];
      // 打过非缺门的牌 = 缺门已经打完
      let clearAt = -1;
      for (let i = 0; i < rv.length; i++) if (SU(TY(rv[i])) !== q) { clearAt = i; break; }
      const melds = R.melds[j].length;
      if (clearAt < 0 && !melds) { out.push(null); continue; }
      const turns = rv.length - Math.max(0, clearAt);
      let p = 1 - Math.exp(-(Math.max(0, turns - 2) * 0.11 + melds * 0.22));
      if (K.wallLeft < 20) p = Math.min(0.92, p + 0.1);
      // 花色倾向：碰的都是一门、又很少打那门 → 清一色
      const suitCnt = [0, 0, 0];
      for (const id of rv.slice(Math.max(0, clearAt))) suitCnt[SU(TY(id))]++;
      let mmask = 0; for (const m of R.melds[j]) if (m.t >= 0) mmask |= 1 << SU(m.t);
      const live = [0, 1, 2].filter(x => x !== q);
      let pref = null;
      if (melds >= 2 && (mmask === 1 || mmask === 2 || mmask === 4)) pref = Math.log2(mmask);
      else if (turns >= 6) { const [a, b] = live; if (suitCnt[a] === 0 && suitCnt[b] >= 4) pref = a; else if (suitCnt[b] === 0 && suitCnt[a] >= 4) pref = b; }
      const val = pref != null ? 6 : 2.2 + melds * 0.3;
      const discarded = new Set(rv.slice(Math.max(0, clearAt)).map(TY));
      out.push({ j, p, q, pref, val, discarded });
    }
    return out;
  }
  const RANK_DANGER = [0.55, 0.8, 0.95, 1, 1, 1, 0.95, 0.8, 0.55];
  function danger(t, TH, K) {
    let d = 0;
    for (const th of TH) {
      if (!th) continue;
      const su = SU(t);
      if (su === th.q) continue;
      let x = RANK_DANGER[t % 9];
      if (th.discarded.has(t)) x *= 0.35;
      if (K.seen[t] >= 3) x *= 0.5;                 // 只剩一张了：对倒/单钓不可能
      // 筋：两边的牌都见光了，顺子等这张的可能小
      const r = t % 9;
      const lo = r >= 3 ? K.seen[t - 3] : 4, hi = r <= 5 ? K.seen[t + 3] : 4;
      if (lo >= 3 && hi >= 3) x *= 0.7;
      if (th.pref != null) x *= su === th.pref ? 1.6 : 0.25;
      d += th.p * x * 0.14 * th.val;   // 听牌的人等的是这张的概率大约 x×0.14
    }
    return d;
  }

  // ---------------- 决策 ----------------
  function ctxFor(v, K, lv) {
    const R = v.R, me = v.me;
    const melds = R.melds[me].map(m => ({ k: m.k, t: m.t }));
    let meldMask = 0; for (const m of melds) meldMask |= 1 << SU(m.t);
    const allC = counts(R.hand); for (const m of melds) allC[m.t] += m.k === 'peng' ? 3 : 4;
    const nAct = K.active.length;
    const D = Math.max(1, R.wall / Math.max(1, nAct));
    return { nMelds: melds.length, melds, que: R.que[me], meldMask, unseen: K.unseen, U: K.U, D, nAct, rules: v.rules, lv, P: LV[lv], allC, handC0: counts(R.hand) };
  }
  // 四个等级：新手 / 普通 / 高手 / 大师
  const LV = {
    1: { noise: 0.18, qd: false, qing: false, look: false, defense: 0, claim: 'greedy' },
    2: { noise: 0.05, qd: true, qdGate: 1, qing: false, look: false, defense: 0.25, claim: 'shanten' },
    3: { noise: 0, qd: true, qdGate: 1, qing: true, look: true, defense: 0.5, claim: 'shanten' },
    4: { noise: 0, qd: true, qdGate: 1, qing: true, look: true, defense: 0.5, claim: 'shanten' },
  };
  const lvOf = x => (x >= 1 && x <= 4 ? x : 2);

  // 打哪张
  function chooseDiscard(v, lv, rnd) {
    lv = lvOf(lv); rnd = rnd || Math.random;
    const R = v.R, me = v.me, P = LV[lv];
    const hand = R.hand.slice();
    const que = R.que[me];
    const K = know(v); K.wallLeft = R.wall;
    const queTiles = hand.filter(id => SU(TY(id)) === que);
    const TH = P.defense ? threats(v, K) : [];
    if (queTiles.length) {
      // 先打缺门：没人有威胁时先打中张（留着越来越危险），有威胁时打最安全的
      const threat = TH.reduce((a, th) => a + (th ? th.p : 0), 0);
      let best = null, bs = -1e9;
      for (const id of queTiles) {
        const t = TY(id);
        let sc = lv >= 2 ? (threat > 0.4 ? -danger(t, TH, K) : RANK_DANGER[t % 9] - K.seen[t] * 0.1) : rnd();
        if (id === R.drawn) sc += 0.001;
        if (sc > bs) { bs = sc; best = id; }
      }
      return best;
    }
    const ctx = ctxFor(v, K, lv);
    const c = counts(hand);
    const cands = [];
    const tried = new Set();
    for (const id of hand) {
      const t = TY(id); if (tried.has(t)) continue; tried.add(t);
      c[t]--;
      const e = evalHand(c, ctx);
      c[t]++;
      const dg = P.defense ? danger(t, TH, K) : 0;
      cands.push({ t, e, dg });
    }
    const minS = Math.min(...cands.map(x => x.e.s));
    let pick;
    if (lv === 1) {
      // 新手：只看向听，偶尔乱打
      const pool = cands.filter(x => x.e.s === minS);
      pick = rnd() < P.noise ? cands[Math.floor(rnd() * cands.length)] : pool.sort((a, b) => b.e.stdUk - a.e.stdUk || a.t % 9 - b.t % 9)[Math.floor(rnd() * Math.min(2, pool.length))];
    } else {
      // 没人有威胁：只比进攻（期望值，乘法打破平局）；有威胁：期望得分 - 点炮代价
      const threat = TH.reduce((a, th) => a + (th ? th.p : 0), 0);
      const useDef = P.defense > 0 && threat > 0.15;
      // 先保证快：普通打法向听数最小的那些；做大牌（清一色/七对）最多慢一步，而且期望要明显更高
      const fastS = Math.min(...cands.map(x => x.e.stdS));
      const fastBest = Math.max(1e-12, ...cands.filter(x => x.e.stdS === fastS).map(x => x.e.ev));
      for (const x of cands) {
        const fast = x.e.stdS === fastS;
        const value = x.e.plan !== 'std' && x.e.s <= fastS + 1 && x.e.ev >= fastBest * 1.3;
        x.keep = fast || value;
        const tb = 1 + 1e-3 * (1 - RANK_DANGER[x.t % 9]) + 1e-4 * x.e.stdUk;   // 同等情况下先打幺九、留进张多的
        x.score = x.e.ev > 0 ? x.e.ev * tb : 1e-15 * (x.e.stdUk + 1);
        if (useDef) x.score = x.e.ev * 1.6 * tb - x.dg * P.defense;
        if (!x.keep) x.score -= 1e6;
      }
      // 真危险的时候可以放弃进攻（弃胡）：允许打慢的牌
      if (useDef && fastS >= 2) for (const x of cands) if (!x.keep) x.score += 1e6 - 0.5;
      if (P.noise && rnd() < P.noise) { const pool = cands.filter(x => x.e.s <= minS); pick = pool[Math.floor(rnd() * pool.length)]; }
      else pick = cands.reduce((a, b) => (b.score > a.score ? b : a));
    }
    // 优先打刚摸的那张（同种类时）
    const t = pick.t;
    if (R.drawn != null && TY(R.drawn) === t) return R.drawn;
    for (let i = hand.length - 1; i >= 0; i--) if (TY(hand[i]) === t) return hand[i];
    return hand[hand.length - 1];
  }

  // 现在这手（不出牌）值多少
  function handValue(v, K, lv, c, extraMeld) {
    const ctx = ctxFor(v, K, lv);
    if (extraMeld) { ctx.nMelds++; ctx.melds = ctx.melds.concat([extraMeld]); ctx.meldMask |= 1 << SU(extraMeld.t); ctx.allC = ctx.allC.slice(); }
    return evalHand(c, ctx);
  }
  // 碰/杠/过 —— 别人打出 t
  function chooseClaim(v, lv, rnd) {
    lv = lvOf(lv); rnd = rnd || Math.random;
    const R = v.R, me = v.me, o = v.opt;
    if (o.hu) return 'hu';
    if (!o.peng && !o.gang) return 'pass';
    const t = o.t;
    if (LV[lv].claim === 'greedy') return o.gang ? 'gang' : (rnd() < 0.85 ? 'peng' : 'pass');
    const K = know(v); K.wallLeft = R.wall;
    const ctx = ctxFor(v, K, lv);
    const c = counts(R.hand);
    const now = evalHand(c, ctx);
    const TH = LV[lv].defense ? threats(v, K) : [];
    // 碰：拿走两张，然后要打一张
    let pengEv = -1, pengS = 9;
    if (o.peng) {
      const c2 = c.slice(); c2[t] -= 2;
      const ctx2 = Object.assign({}, ctx, { nMelds: ctx.nMelds + 1, melds: ctx.melds.concat([{ k: 'peng', t }]), meldMask: ctx.meldMask | 1 << SU(t), allC: ctx.allC.slice() });
      ctx2.allC[t] += 1; ctx2.handC0 = ctx.handC0;
      const hasQ = c2.some((n, x) => n && SU(x) === ctx.que);
      for (let d = 0; d < 27; d++) {
        if (!c2[d]) continue;
        if (hasQ && SU(d) !== ctx.que) continue;
        c2[d]--;
        const e = evalHand(c2, ctx2);
        c2[d]++;
        const sc = e.ev - (TH.length ? danger(d, TH, K) * LV[lv].defense * 0.55 : 0);
        if (sc > pengEv) { pengEv = sc; pengS = e.s; }
      }
    }
    let gangEv = -1;
    if (o.gang) {
      const c3 = c.slice(); c3[t] -= 3;
      const ctx3 = Object.assign({}, ctx, { nMelds: ctx.nMelds + 1, melds: ctx.melds.concat([{ k: 'gang', t }]), meldMask: ctx.meldMask | 1 << SU(t), allC: ctx.allC.slice() });
      ctx3.allC[t] += 1; ctx3.handC0 = ctx.handC0;
      const e = evalHand(c3, ctx3);
      gangEv = e.ev + 2 / 1.6;    // 刮风：马上拿 2 分
    }
    const nowEv = now.ev;
    if (LV[lv].claim === 'shanten' || LV[lv].claim === 'strict') {
      if (o.gang && now.stdS >= 0) return 'gang';
      if (o.peng && pengS < now.stdS) return 'peng';
      if (o.peng && pengS === now.stdS) {
        if (LV[lv].claim === 'shanten') return 'peng';
        // 一样快时：对子多（奔对对胡）或者碰的是清一色那门才碰
        let pairs = 0; for (let x = 0; x < 27; x++) if (c[x] >= 2 && SU(x) !== ctx.que) pairs++;
        if (pairs >= 4) return 'peng';
        return 'pass';
      }
      return 'pass';
    }
    const margin = lv >= 4 ? 1.04 : 1.08;
    if (o.gang && gangEv >= Math.max(pengEv, nowEv)) return 'gang';
    if (o.peng && pengEv > nowEv * margin + 0.002) return 'peng';
    return 'pass';
  }
  // 自己回合：自摸 / 暗杠 / 补杠 / 出牌
  function chooseTurn(v, lv, rnd) {
    lv = lvOf(lv); rnd = rnd || Math.random;
    const R = v.R, me = v.me, o = v.opt;
    if (o.hu) return { k: 'zimo' };
    if ((o.an && o.an.length) || (o.bu && o.bu.length)) {
      if (lv === 1) {
        if (o.an.length) return { k: 'angang', t: o.an[0] };
        return { k: 'bugang', t: o.bu[0] };
      }
      const K = know(v); K.wallLeft = R.wall;
      const ctx = ctxFor(v, K, lv);
      const c = counts(R.hand);
      // 不杠：打出最好的一张后的价值
      let base = -1;
      for (let d = 0; d < 27; d++) {
        if (!c[d]) continue;
        c[d]--; const e = evalHand(c, ctx); c[d]++;
        if (e.ev > base) base = e.ev;
      }
      const TH = LV[lv].defense ? threats(v, K) : [];
      const nOther = K.active.length - 1;
      for (const t of o.an || []) {
        const c2 = c.slice(); c2[t] -= 4;
        const ctx2 = Object.assign({}, ctx, { nMelds: ctx.nMelds + 1, melds: ctx.melds.concat([{ k: 'angang', t }]), meldMask: ctx.meldMask | 1 << SU(t) });
        const e = evalHand(c2, ctx2);
        if (lv === 2 || e.ev + 2 * nOther / 1.6 >= base * 0.95) return { k: 'angang', t };
      }
      for (const t of o.bu || []) {
        const c2 = c.slice(); c2[t] -= 1;
        const ctx2 = Object.assign({}, ctx, { melds: ctx.melds.map(m => (m.t === t ? { k: 'bugang', t } : m)) });
        const e = evalHand(c2, ctx2);
        const rob = TH.length ? danger(t, TH, K) * 0.6 : 0;
        if (lv === 2 || e.ev + nOther / 1.6 - rob >= base * 0.95) return { k: 'bugang', t };
      }
    }
    return { k: 'discard', id: chooseDiscard(v, lv, rnd) };
  }

  // 换三张：挑三张同花色
  function chooseSwap(hand, lv, rnd) {
    lv = lvOf(lv); rnd = rnd || Math.random;
    const c = counts(hand);
    const bySuit = [0, 1, 2].map(s => hand.filter(id => SU(TY(id)) === s));
    const ok = [0, 1, 2].filter(s => bySuit[s].length >= 3);
    if (lv === 1) {
      const s = ok.sort((a, b) => bySuit[a].length - bySuit[b].length)[0];
      const ids = bySuit[s].slice(); shuffleIn(ids, rnd);
      return ids.slice(0, 3);
    }
    let best = null, bs = -1e9;
    for (const s of ok) {
      // 这门里最“孤”的几张
      const tiles = bySuit[s].slice().sort((a, b) => isoScore(c, TY(b)) - isoScore(c, TY(a)));
      const cand = tiles.slice(0, Math.min(6, tiles.length));
      for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) for (let k = j + 1; k < cand.length; k++) {
        const pick = [cand[i], cand[j], cand[k]];
        const c2 = c.slice(); for (const id of pick) c2[TY(id)]--;
        let sc = -1e9;
        for (let q = 0; q < 3; q++) {
          let nq = 0; for (let t = q * 9; t < q * 9 + 9; t++) nq += c2[t];
          const sh = shantenStd(c2, 0, 1 << q);
          const s7 = shanten7(c2, 0, 1 << q);
          const v = -Math.min(sh, s7 + 1) * 10 - nq * 1.2 + (q === s ? 1.5 : 0);
          if (v > sc) sc = v;
        }
        sc += rnd() * 0.01;
        if (sc > bs) { bs = sc; best = pick; }
      }
    }
    return best;
  }
  function isoScore(c, t) {
    // 越孤立分越高：没有对子、没有相邻
    const r = t % 9;
    let s = 3 - Math.min(3, c[t] - 1) * 1.5;
    if (r > 0 && c[t - 1]) s -= 1.2; if (r < 8 && c[t + 1]) s -= 1.2;
    if (r > 1 && c[t - 2]) s -= 0.5; if (r < 7 && c[t + 2]) s -= 0.5;
    if (r === 0 || r === 8) s += 0.4;
    return s;
  }
  function shuffleIn(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

  // 定缺
  function chooseQue(hand, lv, rnd) {
    lv = lvOf(lv); rnd = rnd || Math.random;
    const c = counts(hand);
    const n = [0, 1, 2].map(s => hand.filter(id => SU(TY(id)) === s).length);
    if (lv === 1) { const m = Math.min(...n); const cs = [0, 1, 2].filter(s => n[s] === m); return cs[Math.floor(rnd() * cs.length)]; }
    let best = 0, bs = -1e9;
    for (let q = 0; q < 3; q++) {
      const sh = shantenStd(c, 0, 1 << q);
      const s7 = shanten7(c, 0, 1 << q);
      const v = -Math.min(sh, s7 + 1) * 10 - n[q] * 1.5 + rnd() * 0.01;
      if (v > bs) { bs = v; best = q; }
    }
    return best;
  }

  // 统一入口
  function decide(v, lv, rnd) {
    const o = v.opt; if (!o) return null;
    if (o.k === 'swap') return { k: 'swap', ids: chooseSwap(v.R.hand, lv, rnd) };
    if (o.k === 'que') return { k: 'que', s: chooseQue(v.R.hand, lv, rnd) };
    if (o.k === 'claim') return { k: chooseClaim(v, lv, rnd) };
    if (o.k === 'turn') return chooseTurn(v, lv, rnd);
    return null;
  }

  // 给玩家的提示：打哪些牌能听、听什么、剩几张、几番
  function tingHints(v) {
    const R = v.R, me = v.me;
    if (!R || !R.hand) return null;
    const K = know(v);
    const que = R.que[me];
    const melds = R.melds[me].map(m => ({ k: m.k, t: m.t }));
    const allC = counts(R.hand); for (const m of melds) allC[m.t] += m.k === 'peng' ? 3 : 4;
    const c = counts(R.hand);
    const n = R.hand.length;
    const res = {};
    const one = cc => {
      const all = allC.slice();
      for (let t = 0; t < 27; t++) all[t] += cc[t] - c[t];
      const w = waits(cc, melds.length, que, all);
      return w.map(t => { cc[t]++; const f = calcFan(cc, melds, {}, v.rules); cc[t]--; return { t, left: K.unseen[t], fan: f ? f.fan : 0, title: f ? f.title : '' }; });
    };
    if (n % 3 === 2) {
      for (let t = 0; t < 27; t++) {
        if (!c[t]) continue;
        c[t]--; const w = one(c); c[t]++;
        if (w.length) res[t] = w;
      }
      return { mode: 'discard', by: res };
    }
    const w = one(c);
    return { mode: 'wait', waits: w };
  }

  const AI = { LV, shanten, shantenStd, shanten7, decide, chooseDiscard, chooseClaim, chooseTurn, chooseSwap, chooseQue, tingHints, know, evalHand };
  G.MJAI = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})(typeof window !== 'undefined' ? window : globalThis);
