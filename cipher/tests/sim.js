// Bot-only matches, to compare the levels: node cipher/tests/sim.js [rounds] [levels e.g. 3,4] [keys 0|1]
const CX = require('../src/engine.js');
const AI = require('../src/ai.js');
const N = +process.argv[2] || 400;
const lvs = (process.argv[3] || '3,4').split(',').map(Number);
const keys = process.argv[4] !== '0';
const n = lvs.length, wins = new Array(n).fill(0), pts = new Array(n).fill(0);
let moves = 0, hits = 0, misses = 0;
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const T = new CX.Table({ rules: { keys, timer: 0 }, rnd: CX.seeded(5000 + g) });
  // rotate who sits where, so first-player luck evens out
  const seatLv = [];
  for (let s = 0; s < n; s++) { seatLv[s] = (s + g) % n; T.seats[s] = { name: 'L' + lvs[seatLv[s]], score: 0 }; }
  const rnd = CX.seeded(g * 7 + 3);
  T.startRound();
  for (const s of T.R.ps) while (T.R.setup[s].length) T.act(s, AI.decide(T.view(s), lvs[seatLv[s]], rnd));
  T.go();
  let guard = 0;
  while (T.R.phase === 'play' && guard++ < 3000) { const s = T.R.cur; T.act(s, AI.decide(T.view(s), lvs[seatLv[s]], rnd)); moves++; }
  wins[seatLv[T.R.win]]++;
  T.R.ps.forEach(s => { pts[seatLv[s]] += T.R.pts[s]; });
  for (const s of T.R.ps) { hits += T.R.st[s].hit; misses += T.R.st[s].miss; }
}
console.log(`${N} rounds, ${n} players, keys ${keys ? 'on' : 'off'}, ${((Date.now() - t0) / N).toFixed(1)} ms a round, ${(moves / N).toFixed(1)} moves a round, ${(100 * hits / (hits + misses)).toFixed(1)}% of guesses right`);
lvs.forEach((lv, i) => console.log(`  level ${lv}: won ${(100 * wins[i] / N).toFixed(1)}%  points ${(pts[i] / N).toFixed(2)}`));
