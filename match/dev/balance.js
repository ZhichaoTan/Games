// Sets each level's moves and star scores:  node match/dev/balance.js [--levels=1-10,12] [--runs=240] [--write]
// A simulated casual player (MMAI.PEOPLE.casual, played by the same code as the bots) plays each level many times on
// different boards. The level gets the fewest moves with which that player wins at least `want(n)` of the time. Then the
// same boards are played again with those moves: 2 stars go to about the median winning score, 3 stars to about the best
// sixth. With --write the numbers go into TUNE in src/levels.js; without it they are only printed.
// --levels: a list like 1,2,10 or a range like 41-50 (default all). --runs: boards per level (default 240).
// The casual player is a guess at how people play on a phone, not a measurement, so these numbers are a starting point.
const { Worker, isMainThread, parentPort } = require('worker_threads');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const CAP = 160;   // the most moves a level can get; a run that has not won by then counts as a loss

function load() {
  globalThis.window = globalThis;
  require(path.join(SRC, 'engine.js')); require(path.join(SRC, 'ai.js')); require(path.join(SRC, 'levels.js'));
  return { MM: globalThis.MM, AI: globalThis.MMAI, LV: globalThis.MMLV };
}
// one run: the level on board `seed` with `moves` moves; the player's own choices come from `pseed`
function run(env, n, seed, pseed, moves) {
  const { MM, AI, LV } = env;
  const sp = LV.spec(n, seed); sp.moves = moves; sp.rec = false;
  const g = new MM.Game(sp); g.start();
  const st = { s: pseed }, R = () => MM.rnd(st);
  while (!g.over) {
    const m = AI.plan(g, AI.PEOPLE.casual, R);
    if (!m) break;
    AI.exec(g, m); g.busy = 0;
  }
  return { won: g.won, at: g.won ? g.wonAt : Infinity, score: g.score };
}

if (!isMainThread) {
  const env = load();
  parentPort.on('message', job => {
    const out = job.seeds.map(([s, p]) => run(env, job.n, s, p, job.moves));
    parentPort.postMessage({ id: job.id, out });
  });
  return;
}

const env = load(), LV = env.LV;
const argv = process.argv.slice(2);
const write = argv.includes('--write');
const opt = k => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : ''; };
const levels = [];
for (const part of opt('levels').split(',').filter(Boolean)) {
  const m = part.match(/^(\d+)-(\d+)$/);
  if (m) for (let k = +m[1]; k <= +m[2]; k++) levels.push(k); else levels.push(+part);
}
if (!levels.length) for (let k = 1; k <= LV.COUNT; k++) levels.push(k);
const runs = +opt('runs') || 240;
const seedsOf = n => Array.from({ length: runs }, (_, r) => [9001 + r * 7919 + n * 104729, 31337 + r * 17 + n * 1013]);

// a small pool of workers that take jobs from a queue
const pool = [], queue = [], waiting = new Map();
let nextId = 1;
for (let k = 0; k < Math.max(1, require('os').cpus().length); k++) {
  const w = new Worker(__filename);
  w.busy = false;
  w.on('message', msg => { w.busy = false; const done = waiting.get(msg.id); waiting.delete(msg.id); done(msg.out); pump(); });
  w.on('error', e => { console.error(e); process.exit(1); });
  pool.push(w);
}
function pump() {
  for (const w of pool) {
    if (w.busy || !queue.length) continue;
    const job = queue.shift();
    w.busy = true; w.postMessage(job);
  }
}
function play(n, moves) {
  const seeds = seedsOf(n), parts = [];
  for (let k = 0; k < seeds.length; k += 20) {
    parts.push(new Promise(res => {
      const id = nextId++;
      waiting.set(id, res);
      queue.push({ id, n, moves, seeds: seeds.slice(k, k + 20) });
    }));
  }
  pump();
  return Promise.all(parts).then(a => a.flat());
}
const nice = v => v < 10000 ? Math.round(v / 100) * 100 : Math.round(v / 500) * 500;
const pct = (arr, f) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(f * arr.length)))];

(async () => {
  const t0 = Date.now();
  const res = {};
  // pass 1: how many moves each run needs to win (the same choices happen whatever the move limit, up to the win)
  await Promise.all(levels.map(n => play(n, CAP).then(out => {
    const at = out.map(o => o.at).sort((a, b) => a - b);
    const want = LV.want(n);
    let m = at[Math.ceil(want * at.length) - 1];
    if (!isFinite(m)) m = CAP;
    res[n] = { at, want, m: Math.max(m, n <= 3 ? 10 : 8) };   // the first levels get a few spare moves
  })));
  // pass 2: final scores with those moves (moves left over become rockets at the end, which adds to the score)
  await Promise.all(levels.map(n => play(n, res[n].m).then(out => {
    const r = res[n];
    const wins = out.filter(o => o.won).map(o => o.score).sort((a, b) => a - b);
    const goal = LV.spec(n, 1).goals.find(g => g.t === 'score');
    const s1 = goal ? goal.n : 0;
    let s2 = nice(pct(wins, 0.5)), s3 = nice(pct(wins, 0.84));
    if (s2 <= s1) s2 = nice(s1 * 1.25);
    if (s3 <= s2 * 1.12) s3 = nice(s2 * 1.3);
    r.rate = wins.length / out.length;
    r.s = [s1, s2, s3];
    r.two = wins.filter(v => v >= s2).length / Math.max(1, wins.length);
    r.three = wins.filter(v => v >= s3).length / Math.max(1, wins.length);
  })));
  for (const w of pool) w.terminate();
  console.log('level  moves  want  won   p50  p80  stars              2-star 3-star (share of wins)');
  for (const n of levels) {
    const r = res[n], fin = r.at.filter(isFinite);
    const p50 = pct(r.at, 0.5), p80 = pct(r.at, 0.8);
    console.log(`${String(n).padStart(5)}  ${String(r.m).padStart(5)}  ${r.want.toFixed(2)}  ${r.rate.toFixed(2)}  ${String(isFinite(p50) ? p50 : '-').padStart(4)} ${String(isFinite(p80) ? p80 : '-').padStart(4)}  ${JSON.stringify(r.s).padEnd(18)} ${r.two.toFixed(2)}   ${r.three.toFixed(2)}${fin.length < r.at.length * 0.9 ? '   (' + (r.at.length - fin.length) + ' never won)' : ''}`);
  }
  console.log(`${levels.length} levels x ${runs} boards in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (!write) return;
  const fs = require('fs'), file = path.join(SRC, 'levels.js');
  let src = fs.readFileSync(file, 'utf8');
  const m = src.match(/const TUNE = \[([\s\S]*?)\];/);
  if (!m) throw new Error('TUNE not found in levels.js');
  // keep the levels that were not run this time
  const old = [];
  for (const line of m[1].split('\n')) { const k = line.match(/\{ m: (\d+), s: \[(\d+), (\d+), (\d+)\] \}, \/\/ (\d+)/); if (k) old[+k[5]] = { m: +k[1], s: [+k[2], +k[3], +k[4]] }; }
  for (const n of levels) old[n] = { m: res[n].m, s: res[n].s };
  let body = '\n';
  for (let n = 1; n <= LV.COUNT; n++) {
    const t = old[n];
    body += t ? `    { m: ${t.m}, s: [${t.s.join(', ')}] }, // ${n}\n` : `    null, // ${n}\n`;
  }
  src = src.replace(m[0], 'const TUNE = [' + body + '  ];');
  fs.writeFileSync(file, src);
  console.log('wrote TUNE to', path.relative(process.cwd(), file));
})();
