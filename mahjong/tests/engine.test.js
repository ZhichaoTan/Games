// 规则单测：node tests/engine.test.js
const MJ = require('../src/engine.js');
const AI = require('../src/ai.js');
const { counts, calcFan, isHu, waits, Table, TY } = MJ;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));

// "123m456s789p" → 种类数组（m 万 s 条 p 筒）
function types(str) {
  const out = []; let buf = [];
  for (const ch of str.replace(/\s+/g, '')) {
    if (/\d/.test(ch)) buf.push(+ch);
    else { const su = { m: 0, s: 1, p: 2 }[ch]; for (const r of buf) out.push(su * 9 + r - 1); buf = []; }
  }
  return out;
}
const C = str => { const c = new Array(27).fill(0); for (const t of types(str)) c[t]++; return c; };
const M = (k, str) => ({ k, t: types(str)[0] });
const R0 = Object.assign({}, MJ.DEFAULT_RULES, { cap: 0 });
const fan = (conc, melds, ctx, rules) => calcFan(C(conc), melds || [], ctx || {}, Object.assign({}, R0, rules || {}));

// ---- 胡牌判定 ----
ok(isHu(C('123m456m789m234s55s'), 0, 2), '平胡');
ok(!isHu(C('123m456m789m234s55s'), 0, 1), '有缺门的牌不能胡');
ok(isHu(C('11m22m33m44s55s66s77s'), 0, 2), '七对');
ok(!isHu(C('11m22m33m44s55s66s7s8s'), 0, 2), '不是七对');
ok(isHu(C('1111m22m33m44s55s66s'), 0, 2), '龙七对（四张算两对）');
ok(isHu(C('55s'), 4, 2), '金钩钓');
ok(!MJ.isQidui(C('11m22m33m44s55s66s77s'), 1), '有碰就不算七对');
ok(isHu(C('111m123m456m789s99s'), 0, 2), '一万四张');
eq(waits(C('123m456m789m234s5s'), 0, 2), types('2s5s'), '听 2/5 条');
eq(waits(C('1112345678999m'), 0, 2), types('123456789m'), '九莲宝灯听九张');
eq(waits(C('11m22m33m44s55s66s7s'), 0, 2), types('4s7s'), '七对单钓 7s，也能 44+456+567 胡 4s');

// ---- 番型 ----
const F = (conc, melds, ctx, rules) => { const f = fan(conc, melds, ctx, rules); return f ? [f.title, f.fan] : null; };
eq(F('123m456m789m234s55s'), ['平胡', 0], '平胡 0 番');
eq(F('123m456m789m234m55m'), ['清一色', 2], '清一色 2 番');
eq(F('111m222m333s444s55s'), ['对对胡', 1], '对对胡 1 番');
eq(F('11m22m33m44s55s66s77s'), ['七对', 2], '七对 2 番（也能拆成平胡，取大）');
eq(F('1111m22m33m44s55s66s'), ['龙七对', 3], '龙七对 3 番');
eq(F('11m22m33m44m55m66m77m'), ['清七对', 4], '清七对 4 番');
eq(F('1111m22m33m44m55m66m'), ['清龙七对', 5], '清龙七对 5 番');
eq(F('55s', [M('peng', '1m'), M('peng', '2m'), M('peng', '3s'), M('peng', '4s')]), ['金钩钓', 2], '金钩钓 2 番');
eq(F('55m', [M('peng', '1m'), M('peng', '2m'), M('peng', '3m'), M('peng', '4m')]), ['清金钩钓', 4], '清金钩钓 4 番');
eq(F('55s', [M('gang', '1m'), M('angang', '2m'), M('bugang', '3s'), M('gang', '4s')]), ['十八罗汉', 6], '十八罗汉 = 对对+金钩+4根');
eq(F('123m789m123s789s99s'), ['带幺九', 2], '带幺九 2 番');
eq(F('123m789m123s789s99s', [], {}, { yjjd: false }), ['平胡', 0], '关掉幺九将对');
eq(F('222m555m888s222s55s'), ['将对', 3], '将对 3 番');
eq(F('111m123m456m789s99s'), ['平胡', 1], '根 +1');
eq(F('234m567m345s678s55s', [], {}, { mqzz: true }), ['平胡', 2], '门清 + 中张');
eq(F('234m567m345s55s', [M('peng', '6s')], {}, { mqzz: true }), ['平胡', 1], '碰了不算门清，只有中张');
eq(F('123m456m789m234s55s', [], { zimo: true }, { zimo: 'fan' }), ['平胡', 1], '自摸加番');
eq(F('123m456m789m234s55s', [], { zimo: true }, { zimo: 'di' }), ['平胡', 0], '自摸加底不加番');
eq(F('123m456m789m234s55s', [], { zimo: true, gangHua: true }), ['平胡', 1], '杠上开花');
eq(F('123m456m789m234s55s', [], { gangPao: true }), ['平胡', 1], '杠上炮');
eq(F('123m456m789m234s55s', [], { rob: true }), ['平胡', 1], '抢杠胡');
eq(F('123m456m789m234s55s', [], { zimo: true, haidi: true }), ['平胡', 1], '海底捞月');
eq(F('123m456m789m234s55s', [], { zimo: true, tian: true }), ['平胡', 5], '天胡');
eq(F('1111m22m33m44m55m66m', [], {}, { cap: 4 }), ['清龙七对', 4], '封顶 4 番');
eq(F('111m222m333m444m55m'), ['清对', 3], '清对 3 番（也能拆成顺子，取大）');

// ---- 向听数 ----
const sh = (str, nm, que) => AI.shanten(C(str), nm || 0, que == null ? 2 : que);
eq(sh('123m456m789m234s5s'), 0, '听牌 0 向听');
eq(sh('123m456m789m234s55s'), -1, '胡了 -1');
eq(sh('123m456m789m23s5s9s'), 1, '一向听');
eq(sh('123m456m789m234s9p'), 1, '四组 + 一张缺门：1 向听（要先换掉缺门）');
eq(sh('123m456m789m2s4s9p9p'), 2, '三组+坎张+两张缺门 = 2');
eq(sh('11m22m33m44s55s66s7s'), 0, '七对听');
eq(sh('1m4m7m1s4s7s2m5m8m2s5s8s9m'), 3, '散牌：789m 一组 + 三个搭子 = 3 向听');

// ---- 场景测试：直接改牌局 ----
// 给每家手里塞指定的牌（按种类找空闲的 id），剩下的进牌墙（wallTop：接下来摸到的牌，按顺序）
function scenario(opts) {
  const T = new Table({ rules: Object.assign({ swap: false }, opts.rules || {}), seed: 7 });
  for (let s = 0; s < 4; s++) T.seats[s] = { id: 'p' + s, name: 'P' + s, score: 0 };
  T.dealer = opts.dealer || 0;
  T.startRound();
  const R = T.R;
  const free = new Map(); for (let id = 0; id < 108; id++) { const t = id >> 2; if (!free.has(t)) free.set(t, []); free.get(t).push(id); }
  const take = t => { const a = free.get(t); if (!a.length) throw new Error('no tile ' + t); return a.shift(); };
  R.hands = opts.hands.map(str => types(str).map(take));
  if (opts.melds) R.melds = opts.melds.map(ms => (ms || []).map(([k, str, from]) => { const t = types(str)[0]; const n = k === 'peng' ? 3 : 4; return { k, t, ids: Array.from({ length: n }, () => take(t)), from: from == null ? -1 : from }; }));
  const top = types(opts.wallTop || '').map(take);
  const rest = []; for (const a of free.values()) rest.push(...a);
  // 牌墙从末尾摸
  const keep = opts.wallLen != null ? opts.wallLen - top.length : rest.length;
  R.wall = rest.slice(0, Math.max(0, keep)).concat(top.slice().reverse());
  R.que = opts.que || [2, 2, 2, 2];
  R.phase = 'play'; R.turn = T.dealer; R.stage = 'discard'; R.canSelf = true; R.drawn = R.hands[T.dealer][R.hands[T.dealer].length - 1];
  return T;
}
const id1 = (T, s, str) => { const t = types(str)[0]; return T.R.hands[s].find(id => TY(id) === t); };
const conserve = T => {
  const R = T.R, seen = new Set();
  const add = id => seen.add(id);
  R.wall.forEach(add); R.hands.forEach(h => h.forEach(add)); R.river.forEach(r => r.forEach(add));
  R.melds.forEach(ms => ms.forEach(m => m.ids.forEach(add))); R.wins.forEach(w => add(w.id));
  return seen.size;
};

// 碰：P0 打 5s，P2 有一对 5s
// 不参与的人手里拿缺门（筒）：不能胡，也碰不了万条
const FA = '1p1p2p2p3p3p4p4p5p5p6p6p7p', FB = '1p1p2p2p3p3p4p4p5p5p6p6p8p';
const P1A = FA, P2A = '55s678s567m789m9s8s', P3A = FB;
{
  const T = scenario({ hands: ['123m456m789m234s5s9s', P1A, P2A, P3A], wallTop: '9m' });
  eq(T.act(0, { k: 'discard', id: id1(T, 0, '5s') }), 'ok', '出牌');
  eq(T.R.stage, 'claim', '有人能碰');
  eq(!!T.options(2) && T.options(2).peng, true, 'P2 可碰');
  eq(T.act(2, { k: 'peng' }), 'ok', '碰');
  eq(T.R.turn, 2, '碰完轮到 P2');
  eq(T.R.melds[2].length, 1, 'P2 有一组碰');
  eq(T.R.hands[2].length, 11, '碰完手里 11 张');
  eq(T.R.river[0].length, 0, '被碰的牌从河里拿走');
  eq(T.options(2).hu, false, '碰完不能自摸');
  eq(conserve(T), 108, '牌守恒');
}
// 定缺：手里有缺门不能打别的
{
  const T = scenario({ hands: ['123m456m789m234s5s9p', P1A, P2A, P3A] });
  eq(T.act(0, { k: 'discard', id: id1(T, 0, '5s') }), 'que', '有缺门牌不能打 5s');
  eq(T.act(0, { k: 'discard', id: id1(T, 0, '9p') }), 'ok', '先打缺门');
}
// 点炮 + 一炮多响：P0 打 5s，P1 和 P3 都胡
{
  const T = scenario({ hands: ['123m456m789m234s5s9s', '123m456m789m234s5s', FA, '123m456m789m234s5s'], wallTop: '9s9s9s' });
  T.act(0, { k: 'discard', id: id1(T, 0, '5s') });
  eq(!!T.options(1) && T.options(1).hu, true, 'P1 可胡');
  eq(!!T.options(3) && T.options(3).hu, true, 'P3 可胡');
  T.act(3, { k: 'hu' });
  eq(T.R.stage, 'claim', 'P1 还没表态，等');
  T.act(1, { k: 'hu' });
  eq(T.R.hu[1] > 0 && T.R.hu[3] > 0, true, '两家都胡');
  eq(T.R.deltas, [-2, 1, 0, 1], '放炮的人各给 1 分');
  eq(T.R.turn, 0, '下一个摸牌的是最后一个胡牌者（P3）的下家 P0');
  ok(T.R.wins.every(w => w.multi), '标记一炮多响');
  eq(conserve(T), 108, '牌守恒（一炮多响）');
}
// 过手胡：P1 能胡 5s 但过了；P2 碰了打 2s，P1 这时不能胡；P1 自己摸牌后恢复
{
  const T = scenario({ hands: ['123m456m789m234s5s9s', '123m456m789m234s5s', '55s2s5m5m6m6m7m7m8m8m9m1m', FA], wallTop: '9s9s' });
  T.act(0, { k: 'discard', id: id1(T, 0, '5s') });
  eq(!!T.options(1) && T.options(1).hu, true, 'P1 能胡');
  eq(!!T.R.claim.opts[2] && T.R.claim.opts[2].peng, true, 'P2 能碰');
  T.act(1, { k: 'pass' });
  eq(T.R.passHu[1], true, '记下过手');
  T.act(2, { k: 'peng' });
  T.act(2, { k: 'discard', id: id1(T, 2, '2s') });
  eq(T.R.stage, 'discard', 'P1 过手，不能胡 2s，没人有选项');
  eq(T.R.turn, 3, '轮到 P3');
  eq(T.act(3, { k: 'discard', id: T.R.drawn }), 'que', 'P3 手里有缺门，不能打摸到的条');
  eq(T.act(3, { k: 'discard', id: id1(T, 3, '7p') }), 'ok', 'P3 打缺门');
  eq(T.R.turn, 0, '轮到 P0');
}
// 直杠：放杠的人给 2 分，补牌；杠上开花 + 点杠花（点炮）
const P2B = FA, P3B = FB;
{
  const T = scenario({ hands: ['123m456m789m234s5s9s', '555s123m456m789m9s', P2B, P3B], wallTop: '9s' });
  T.act(0, { k: 'discard', id: id1(T, 0, '5s') });
  eq(!!T.options(1) && T.options(1).gang, true, 'P1 可直杠');
  T.act(1, { k: 'gang' });
  eq(T.R.deltas, [-2, 2, 0, 0], '刮风：放杠的人给 2');
  eq(T.R.turn, 1, 'P1 补牌');
  eq(T.options(1).hu, true, '补到 9s 杠上开花');
  T.act(1, { k: 'zimo' });
  const w = T.R.wins[0];
  ok(w && w.items.some(x => x[0] === '杠上开花'), '算杠上开花');
  eq(T.R.deltas, [-2 - 4, 2 + 4, 0, 0], '点杠花算点炮：只有放杠的人给（1 根 + 杠上花 = 2 番 = 4 分）');
  eq(conserve(T), 108, '牌守恒（杠）');
}
{
  const T = scenario({ hands: ['123m456m789m234s5s9s', '555s123m456m789m9s', P2B, P3B], wallTop: '9s', rules: { dgh: 'zimo' } });
  T.act(0, { k: 'discard', id: id1(T, 0, '5s') });
  T.act(1, { k: 'gang' }); T.act(1, { k: 'zimo' });
  eq(T.R.deltas, [-2 - 5, 2 + 15, -5, -5], '点杠花算自摸：三家各给 4+1（加底）');
}
// 暗杠：每家给 2
{
  const T = scenario({ hands: ['5555s123m456m789m9s', FA, FB, '11m22m33m44m55m66m7m'], wallTop: '9p' });
  eq(T.options(0).an.includes(types('5s')[0]), true, '可暗杠');
  T.act(0, { k: 'angang', t: types('5s')[0] });
  eq(T.R.deltas, [6, -2, -2, -2], '下雨：每家 2');
  eq(T.R.hands[0].length, 11, '暗杠后补一张（10+1）');
  eq(T.view(1).R.melds[0][0].t, -1, '别人看不到暗杠是什么');
}
// 补杠 + 抢杠胡
{
  const T = scenario({ hands: ['5s123m456m789m9s', '123m456m789m34s99s', FA, FB], melds: [[['peng', '5s', 2]], [], [], []], wallTop: '9p' });
  eq(T.options(0).bu.includes(types('5s')[0]), true, '可补杠');
  T.act(0, { k: 'bugang', t: types('5s')[0] });
  eq(T.R.stage, 'claim', 'P1 可以抢杠');
  eq(!!T.options(1) && T.options(1).hu, true, 'P1 抢杠胡');
  T.act(1, { k: 'hu' });
  ok(T.R.wins[0] && T.R.wins[0].items.some(x => x[0] === '抢杠胡'), '算抢杠胡');
  eq(T.R.melds[0][0].k, 'peng', '被抢了还是碰');
  eq(T.R.deltas, [-2, 2, 0, 0], '补杠的人算点炮（抢杠 1 番）');
  eq(T.R.turn, 2, '轮到抢杠者的下家');
  eq(conserve(T), 108, '牌守恒（抢杠）');
}
// 补杠没人抢：每家 1 分
{
  const T = scenario({ hands: ['5s123m456m789m9s', '123m456m789m36s99s', FA, FB], melds: [[['peng', '5s', 2]], [], [], []], wallTop: '9p' });
  T.act(0, { k: 'bugang', t: types('5s')[0] });
  eq(T.R.deltas, [3, -1, -1, -1], '补杠每家 1');
  eq(T.R.melds[0][0].k, 'bugang', '变成补杠');
}
// 呼叫转移：杠完补牌打出去点炮
{
  const T = scenario({ hands: ['5555s123m456m789m9m', '1m2m3m4m5m6m7m8m9m1s2s3s7s', FA, FB], wallTop: '7s' });
  T.act(0, { k: 'angang', t: types('5s')[0] });
  eq(T.R.deltas, [6, -2, -2, -2], '暗杠收 6');
  T.act(0, { k: 'discard', id: id1(T, 0, '7s') });
  eq(!!T.options(1) && T.options(1).hu, true, 'P1 胡 7s');
  T.act(1, { k: 'hu' });
  ok(T.R.ledger.some(L => L.k === 'zhuan'), '呼叫转移');
  ok(T.R.wins[0].items.some(x => x[0] === '杠上炮'), '算杠上炮');
  eq(T.R.deltas, [-2, 6, -2, -2], 'P0 的 6 分杠钱转给 P1，再赔点炮 2');
}
// 流局：查花猪、退税
{
  const T = scenario({ hands: ['123m456m789m2s3s9p9p8p', '123m456m789m23s9s9s', '11m22m33m44m55m66m1s', '1s1s2s2s3s3s4s4s6s6s7s7s8s'], wallLen: 0, rules: { cap: 0 } });
  T.R.ledger.push({ k: 'gang', kind: 'an', to: 0, t: 0, from: [{ s: 1, amt: 2 }, { s: 2, amt: 2 }, { s: 3, amt: 2 }], moved: false });
  T.R.deltas = [6, -2, -2, -2];
  T.act(0, { k: 'discard', id: id1(T, 0, '9p') });
  eq(T.R.phase, 'end', '牌摸完了，流局');
  const res = T.R.result;
  ok(res.info[0].hua, 'P0 花猪');
  ok(res.info[1].ting && res.info[2].ting && res.info[3].ting, '其余三家听牌');
  eq(T.R.deltas[0], 6 - 64 * 3 - 6, '花猪赔三家 64（不封顶按 6 番）+ 退税 6');
  eq(T.R.deltas.reduce((a, b) => a + b, 0), 0, '零和');
}
// 流局：查大叫（没听牌的赔听牌的人最大番）
{
  const T = scenario({ hands: ['123m456m789m2s5s9s9p', '111m222m333m44m55m', '1s1s2s2s3s3s4s4s6s6s7s7s8s', '5m6m7m8m9m6m7m8m3s4s6s7s9s'], wallLen: 0, rules: { cap: 4 } });
  T.act(0, { k: 'discard', id: id1(T, 0, '9p') });
  const res = T.R.result;
  ok(!res.info[0].ting && !res.info[0].hua, 'P0 没听');
  ok(res.info[1].ting, 'P1 听');
  ok(res.info[2].ting, 'P2 听（清七对 4 番）');
  eq(res.info[1].max, 3, 'P1 最大清对 3 番');
  eq(res.info[2].max, 4, 'P2 最大清七对 4 番');
  ok(!res.info[3].ting, 'P3 没听');
  const p1 = Math.pow(2, res.info[1].max), p2 = Math.pow(2, res.info[2].max);
  eq(T.R.deltas, [-(p1 + p2), 2 * p1, 2 * p2, -(p1 + p2)], '没听的两家各赔听牌的两家');
}
// 随机对局：牌守恒、分数零和、不卡死
{
  let games = 0, rounds = 0, stuck = 0, sumErr = 0, conErr = 0, huN = 0, liuju = 0, multi = 0, rob = 0, zhuan = 0;
  const lvStat = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const lvN = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const rnd = MJ.seeded(12345);
  for (let g = 0; g < 160; g++) {
    const T = new Table({ rules: { swap: true, rounds: 4, cap: 4 }, seed: 1000 + g });
    const lvs = [1, 2, 3, 4].sort(() => rnd() - 0.5);
    for (let s = 0; s < 4; s++) T.seats[s] = { id: 'b' + s, name: 'B' + s, score: 0, bot: true, lv: lvs[s] };
    while (!T.over) {
      T.startRound(); rounds++;
      let steps = 0;
      while (T.R.phase !== 'end' && steps < 2000) {
        const p = T.pending();
        if (!p.length) { stuck++; break; }
        const s = p[Math.floor(rnd() * p.length)];
        const v = T.view(s);
        const a = AI.decide(v, T.seats[s].lv, rnd);
        const r = T.act(s, a);
        if (r !== 'ok') { console.log('bad act', s, JSON.stringify(a), r, T.R.phase, T.R.stage); stuck++; break; }
        steps++;
        if (conserve(T) !== 108) { conErr++; break; }
      }
      if (T.R.phase !== 'end') { stuck++; break; }
      const d = T.R.deltas; if (d.reduce((a, b) => a + b, 0) !== 0) sumErr++;
      huN += T.R.wins.length; if (T.R.endReason === 'wall') liuju++;
      if (T.R.wins.some(w => w.multi)) multi++;
      if (T.R.wins.some(w => w.how === 'rob')) rob++;
      if (T.R.ledger.some(L => L.k === 'zhuan')) zhuan++;
    }
    games++;
    for (let s = 0; s < 4; s++) { lvStat[T.seats[s].lv] += T.seats[s].score; lvN[T.seats[s].lv]++; }
  }
  eq(stuck, 0, '随机对局不卡死');
  eq(sumErr, 0, '每局分数零和');
  eq(conErr, 0, '牌守恒');
  console.log(`  ${games} 场 ${rounds} 局，平均每局胡 ${(huN / rounds).toFixed(2)} 人，流局 ${(100 * liuju / rounds).toFixed(1)}%，一炮多响 ${multi}，抢杠 ${rob}，呼叫转移 ${zhuan}`);
  console.log('  各等级平均每场得分', Object.keys(lvStat).map(k => `${k}:${(lvStat[k] / lvN[k]).toFixed(1)}`).join('  '));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
