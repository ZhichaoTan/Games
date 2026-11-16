// Bot-only matches: node moontide/tests/sim.js [games per match]
// Every match must finish with only legal moves. It prints how each bot level does and how often the first player wins,
// and fails if the strongest bots don't beat the weakest ones on average.
const assert = require('assert');
const MT = require('../src/engine.js');
const AI = require('../src/ai.js');
const G = +process.argv[2] || 20;

function match(lvs, games, seed0, setup) {
  const n = lvs.length;
  const tot = lvs.map(() => ({ pts: 0, win: 0, saved: 0, of: 0 }));
  const byOrder = new Array(n).fill(0);   // wins by place in the turn order (0 = went first)
  const c = { eaten: 0, tide: 0, sunk: 0, ms: 0, calls: 0, max: 0 };
  for (let gi = 0; gi < games; gi++) {
    const rnd = MT.seeded(seed0 + gi);
    const T = new MT.Table({ rules: { setup } });
    // rotate who sits where, so no level always goes first: seat s plays level lvs[(s + gi) % n]
    const who = s => (s + gi) % n;
    for (let s = 0; s < n; s++) T.seats[s] = { name: 'b' + s, bot: true, lv: lvs[who(s)] };
    T.start(rnd);
    let guard = 0;
    while (!T.g.over && guard++ < 5000) {
      const s = T.g.turn, t0 = Date.now();
      const a = AI.decide(T.view(s), T.seats[s].lv, rnd);
      const dt = Date.now() - t0; c.ms += dt; c.calls++; if (dt > c.max) c.max = dt;
      const r = T.act(s, a, rnd);
      assert.strictEqual(r, 'ok', 'bot move ' + JSON.stringify(a) + ' in ' + T.g.phase);
    }
    assert.ok(T.g.over, 'match game finished');
    const g = T.g, order = g.pl.indexOf(g.first);
    for (const row of g.res.rows) {
      const t = tot[who(row.s)];
      t.pts += row.pts; t.saved += row.saved; t.of += row.of;
      if (g.res.win.includes(row.s)) { t.win++; byOrder[(g.pl.indexOf(row.s) - order + n) % n]++; }
    }
    for (const x of g.isl) { if (x.how === 'eaten') c.eaten++; if (x.how === 'tide') c.tide++; }
    c.sunk += g.sunk;
  }
  console.log(`${n} players, levels ${lvs.join('/')}, ${setup}, ${games} games · ${(c.ms / c.calls).toFixed(1)} ms a move (slowest ${c.max})`);
  tot.forEach((t, i) => console.log(`   level ${lvs[i]}: ${(t.pts / games).toFixed(2)} points a game, ${t.win} wins, ${(100 * t.saved / t.of).toFixed(0)}% of people saved`));
  console.log(`   wins by turn order: ${byOrder.join(' / ')} · eaten ${(c.eaten / games).toFixed(1)} and drowned ${(c.tide / games).toFixed(1)} a game · ${(c.sunk / games).toFixed(1)} tiles sunk`);
  return tot.map(t => t.pts / games);
}

const t0 = Date.now();
const a = match([3, 1], G, 1000, 'place');
const b = match([3, 2, 1], G, 2000, 'quick');
const c = match([3, 1, 1, 1], G, 3000, 'place');
match([2, 2, 2, 2], G, 4000, 'quick');
assert.ok(a[0] > a[1], 'level 3 beats level 1 head to head');
assert.ok(b[0] > b[2], 'level 3 beats level 1 at a table of three');
assert.ok(c[0] > (c[1] + c[2] + c[3]) / 3, 'level 3 beats level 1 at a table of four');
console.log(`sim ok (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
