// Picks the first board of each level that teaches a special: a board where one swap makes that special, near the middle.
//   node match/dev/tutseeds.js [--write]
// With --write the seeds go into src/levels.js as ts: (the page plays that board the first time, and points at the swap).
globalThis.window = globalThis;
const fs = require('fs'), path = require('path');
require('../src/engine.js'); require('../src/levels.js');
const { Game, RH, RV, FC, KL, FW } = MM, LV = MMLV;
const WANT = { swap: -1, rocket: RV, lantern: KL, cracker: FC, firework: FW };
// the swaps on this board that make special k (-1: any match of three, and nothing bigger)
function teach(g, k) {
  const out = [];
  for (const [a, b] of g.moveList()) {
    if (b < 0) continue;
    const pa = g.pc[a], pb = g.pc[b];
    if (pa.k || pb.k) continue;
    g.pc[a] = pb; g.pc[b] = pa;
    const gs = g.groups().filter(x => x.cells.has(a) || x.cells.has(b));
    g.pc[a] = pa; g.pc[b] = pb;
    if (!gs.length) continue;
    const kinds = gs.map(x => x.kind);
    const ok = k < 0 ? kinds.every(x => x === 0) && gs.length === 1 : k === RV ? kinds.some(x => x === RV || x === RH) : kinds.includes(k);
    if (ok) out.push([a, b]);
  }
  return out;
}
const found = {};
for (let n = 1; n <= LV.COUNT; n++) {
  const d = LV.L[n - 1];
  if (!(d.tut in WANT)) continue;
  const k = WANT[d.tut];
  let best = null;
  for (let seed = 1; seed < 60000 && !best; seed++) {
    const g = new Game(Object.assign(LV.spec(n, seed), { rec: false }));
    g.start();
    const mv = teach(g, k);
    // exactly one such swap (so the pointer shows the one), away from the edges
    const W = g.W, H = g.H, mid = ([a, b]) => [a, b].every(i => i % W > 0 && i % W < W - 1 && (i / W | 0) > 0 && (i / W | 0) < H - 1);
    if (k < 0) { const m = mv.find(mid); if (m && !teach(g, RV).length && !teach(g, KL).length) best = { seed, move: m }; }   // any plain swap, and no bigger one to distract
    else if (mv.length === 1 && mid(mv[0])) best = { seed, move: mv[0] };
  }
  console.log('level', n, d.tut, best ? `seed ${best.seed} swap ${best.move}` : 'none found');
  if (best) found[n] = best.seed;
}
if (process.argv.includes('--write')) {
  const file = path.join(__dirname, '..', 'src', 'levels.js');
  let src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\{ c: \d, g: \[/.test(lines[i])) continue;
    n++;
    if (!found[n]) continue;
    lines[i] = lines[i].replace(/, ts: \d+/, '').replace(/ \},(\s*)$/, `, ts: ${found[n]} },$1`);
  }
  fs.writeFileSync(file, lines.join('\n'));
  console.log('wrote seeds to', path.relative(process.cwd(), file));
}
