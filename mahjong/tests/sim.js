// 机器人对战统计：node tests/sim.js <场数> <种子> <等级A>,<等级B> [封顶]
// 复式：同一副牌打两遍，A/B 交换座位（A B A B ↔ B A B A），大幅减少运气影响
const path = require('path');
const MJ = require(path.join(__dirname, '../src/engine.js')), AI = require(path.join(__dirname, '../src/ai.js'));
for (const k of [1, 2, 3, 4]) if (process.env['LV' + k]) Object.assign(AI.LV[k], JSON.parse(process.env['LV' + k]));
const N = +process.argv[2] || 100, seed = +process.argv[3] || 1;
const [A, B] = (process.argv[4] || '2,3').split(',').map(Number);
const cap = process.argv[5] != null ? +process.argv[5] : 4;
const rnd = MJ.seeded(seed * 7919);
const st = {};
const S = lv => st[lv] || (st[lv] = { n: 0, score: 0, hu: 0, zimo: 0, fan: 0, ting: 0, rounds: 0, dealin: 0, t: 0, calls: 0, peng: 0, gang: 0 });
let rounds = 0, wins = 0, three = 0;
const diffs = [];
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const lv = g % 2 ? [B, A, B, A] : [A, B, A, B];
  const T = new MJ.Table({ rules: { swap: true, rounds: 4, cap }, seed: seed * 100000 + (g >> 1) });
  for (let s = 0; s < 4; s++) T.seats[s] = { id: 'b' + s, name: 'B' + s, score: 0, bot: true, lv: lv[s] };
  while (!T.over) {
    T.startRound(); rounds++;
    let guard = 0;
    while (T.R.phase !== 'end' && guard++ < 3000) {
      const p = T.pending();
      const s = p[Math.floor(rnd() * p.length)];
      const v = T.view(s);
      const t1 = process.hrtime.bigint();
      const a = AI.decide(v, lv[s], rnd);
      S(lv[s]).t += Number(process.hrtime.bigint() - t1) / 1e6; S(lv[s]).calls++;
      if (a.k === 'peng') S(lv[s]).peng++;
      if (a.k === 'gang' || a.k === 'angang' || a.k === 'bugang') S(lv[s]).gang++;
      const r = T.act(s, a);
      if (r !== 'ok') { console.log('BAD', r, JSON.stringify(a)); process.exit(1); }
    }
    const R = T.R;
    wins += R.wins.length; if (R.endReason !== 'wall') three++;
    for (let s = 0; s < 4; s++) S(lv[s]).rounds++;
    for (const w of R.wins) { const x = S(lv[w.s]); x.hu++; x.fan += w.fan; if (w.how === 'zimo') x.zimo++; else S(lv[w.from]).dealin++; }
    if (R.result.info) R.result.info.forEach((inf, s) => { if (inf && inf.ting) S(lv[s]).ting++; });
  }
  let dA = 0;
  for (let s = 0; s < 4; s++) { S(lv[s]).n++; S(lv[s]).score += T.seats[s].score; if (lv[s] === A) dA += T.seats[s].score; }
  diffs.push(dA / 2);   // A 方两个座位的平均得分（B 方 = -A 方）
}
// 复式成对：同一副牌两场的平均
const pairs = []; for (let i = 0; i + 1 < diffs.length; i += 2) pairs.push((diffs[i] + diffs[i + 1]) / 2);
const mean = pairs.reduce((a, b) => a + b, 0) / pairs.length;
const sd = Math.sqrt(pairs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, pairs.length - 1));
console.log(`${N} 场 ${rounds} 局，平均每局胡 ${(wins / rounds).toFixed(2)} 人，三家胡完 ${(100 * three / rounds).toFixed(1)}%，${((Date.now() - t0) / rounds).toFixed(1)} ms/局`);
for (const k of Object.keys(st).sort()) {
  const x = st[k];
  console.log(`等级 ${k}: 每场 ${(x.score / x.n).toFixed(2)} 分 | 胡 ${(100 * x.hu / x.rounds).toFixed(1)}% 自摸 ${(100 * x.zimo / Math.max(1, x.hu)).toFixed(0)}% ${(x.fan / Math.max(1, x.hu)).toFixed(2)} 番 | 点炮 ${(100 * x.dealin / x.rounds).toFixed(1)}% | 碰 ${(x.peng / x.rounds).toFixed(2)} 杠 ${(x.gang / x.rounds).toFixed(2)} | ${(x.t / x.calls).toFixed(2)} ms/步`);
}
console.log(`A(${A}) 比 B(${B}) 每场多 ${(2 * mean).toFixed(2)} ± ${(2 * sd / Math.sqrt(pairs.length)).toFixed(2)} 分（复式）`);
