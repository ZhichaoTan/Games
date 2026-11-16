// Rules, views and the inference: node cipher/tests/engine.test.js
const CX = require('../src/engine.js');
const AI = require('../src/ai.js');
const { Table, slotsFor, idOf, KEY, JK, seeded } = CX;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
const B = v => idOf(v, 0), W = v => idOf(v, 1);   // black / white tile ids
const BK = JK, WK = JK + 1;

function table(n, rules, seed) {
  const T = new Table({ rules: Object.assign({ keys: true, timer: 0 }, rules || {}), rnd: seeded(seed || 7) });
  for (let s = 0; s < n; s++) T.seats[s] = { id: 'p' + s, name: 'P' + s, score: 0 };
  return T;
}
// lay out a round by hand: rows (arrays of ids, in order), the pool, who starts
function rig(T, rows, pool, cur) {
  T.startRound(); T.go();
  const R = T.R; let u = 100;
  const mk = id => ({ id, u: ++u, open: false, bad: [] });
  R.rows = [null, null, null, null];
  rows.forEach((r, s) => { if (r) R.rows[s] = r.map(mk); });
  R.pool = pool.map(mk);
  R.ps = rows.map((r, s) => r ? s : -1).filter(s => s >= 0);
  R.setup = [[], [], [], []]; R.out = []; R.phase = 'play';
  T.turn(cur || 0);
  return R;
}

// ---- where a tile can go ----
eq(slotsFor([B(1), W(3), B(7)], B(5)), [2], 'a number has one place between smaller and larger');
eq(slotsFor([B(1), W(3), B(7)], W(1)), [1], 'black before white for the same number');
eq(slotsFor([B(1), W(3), B(7)], B(1) - 2 < 0 ? B(0) : B(0)), [0], 'smallest goes far left');
eq(slotsFor([B(1), BK, B(7)], W(4)), [1, 2], 'next to a key there is a choice');
eq(slotsFor([B(1), B(7)], WK), [0, 1, 2], 'a key goes anywhere');
eq(slotsFor([], B(3)), [0], 'empty row');

// ---- the deal ----
for (const [n, keys, hand, pool] of [[2, true, 4, 18], [3, true, 4, 14], [4, true, 3, 14], [2, false, 4, 16], [4, false, 3, 12]]) {
  const T = table(n, { keys }, 3 + n);
  T.startRound();
  const R = T.R;
  const sizes = R.ps.map(s => R.rows[s].length + R.setup[s].length);
  eq(sizes, new Array(n).fill(hand), `${n} players${keys ? '' : ' no keys'}: ${hand} tiles each`);
  eq(R.pool.length, pool, `${n} players${keys ? '' : ' no keys'}: pool of ${pool}`);
  ok(R.ps.every(s => R.rows[s].every((t, i, a) => i === 0 || a[i - 1].id < t.id)), 'numbers dealt in order');
  ok(R.ps.every(s => R.setup[s].every(t => t.id >= JK)), 'keys wait to be placed');
  const all = [].concat(...R.ps.map(s => R.rows[s].concat(R.setup[s])), R.pool).map(t => t.id).sort((a, b) => a - b);
  eq(all.length, keys ? 26 : 24, 'every tile dealt once');
  ok(new Set(all).size === all.length, 'no tile twice');
  ok(new Set([].concat(...R.ps.map(s => R.rows[s].concat(R.setup[s])), R.pool).map(t => t.u)).size === all.length, 'public ids are unique');
}

// the round starts only after go() and once every key is placed; nobody else's row is visible until then
{
  let T, R;
  for (let seed = 1; seed < 400; seed++) { T = table(2, {}, seed); T.startRound(); R = T.R; if (R.setup[0].length || R.setup[1].length) break; }
  const s = R.setup[0].length ? 0 : 1, o = 1 - s;
  eq(T.view(o).R.rows[s], null, 'during setup the other rows are hidden');
  eq(T.view(s).R.rows[o], null, 'and the other way round');
  ok(T.view(s).opt && T.view(s).opt.k === 'place', 'key holder is asked to place it');
  eq(T.view(o).opt || null, null, 'the other player has nothing to do');
  T.go(); eq(R.phase, 'setup', 'still arranging until the key is placed');
  while (R.setup[s].length) eq(T.act(s, { k: 'place', at: 0 }), 'ok', 'place a key');
  if (R.setup[o].length) while (R.setup[o].length) T.act(o, { k: 'place', at: R.rows[o].length });
  eq(R.phase, 'play', 'play starts after the keys are down');
  eq(R.rows[s][0].id >= JK, true, 'the key went where it was put');
}
{
  // nobody has a key: still waits for go()
  let T;
  for (let seed = 1; seed < 400; seed++) { T = table(2, {}, seed); T.startRound(); if (!T.R.setup[0].length && !T.R.setup[1].length) break; }
  eq(T.R.phase, 'setup', 'no keys: waits for go()');
  T.go(); eq(T.R.phase, 'play', 'then plays');
  ok(T.R.stage === 'draw' && T.R.cur === T.R.first, 'first player draws');
}

// ---- a turn ----
{
  const T = table(2);
  const R = rig(T, [[B(1), W(4), B(8), W(10)], [W(0), B(3), W(6), B(11)]], [B(5), W(7)], 0);
  eq(T.act(1, { k: 'draw', c: 0 }), 'turn', 'not your turn');
  eq(T.act(0, { k: 'guess', t: 1, i: 0, v: 0 }), 'no', 'draw first');
  eq(T.act(0, { k: 'draw', c: 0 }), 'ok', 'draw black');
  eq(R.hold.id, B(5), 'holding the black 5');
  ok(R.rows[0].length === 4, 'not in the row yet');
  const v1 = T.view(1);
  eq(v1.R.hold, { u: R.hold.u, c: 0, open: false }, 'the others see the colour only');
  eq(T.view(0).R.hold.v, 5, 'the drawer sees it');
  eq(T.act(0, { k: 'guess', t: 0, i: 0, v: 1 }), 'bad', "can't guess your own tile");
  eq(T.act(0, { k: 'guess', t: 1, i: 1, v: 3 }), 'ok', 'guess black 3');
  ok(R.rows[1][1].open && R.rows[1][1].by === 0, 'cracked');
  eq(R.stage, 'decide', 'may go on or stop');
  eq(T.view(0).opt, { k: 'decide', slots: [2] }, 'one place for the 5');
  eq(T.act(0, { k: 'stop' }), 'ok', 'stop');
  eq(R.rows[0].map(t => t.id), [B(1), W(4), B(5), B(8), W(10)], 'the 5 went in its place');
  ok(!R.rows[0][2].open, 'face down');
  eq(R.cur, 1, 'next player');
  eq(R.stage, 'draw', 'who draws');
  // a miss: the drawn tile goes in face up
  T.act(1, { k: 'draw', c: 1 });
  eq(R.hold.id, W(7), 'white 7');
  eq(T.act(1, { k: 'guess', t: 0, i: 0, v: 2 }), 'ok', 'wrong guess');
  eq(R.rows[0][0].bad, [2], 'the wrong value is noted on the tile');
  ok(!R.rows[0][0].open, 'still hidden');
  eq(R.rows[1].map(t => t.id), [W(0), B(3), W(6), W(7), B(11)], 'white 7 put in');
  ok(R.rows[1][3].open, 'face up');
  eq(R.cur, 0, 'turn passes');
  eq(R.stage, 'guess', 'pool empty: straight to guessing');
  eq(T.view(1).R.rows[0][0].bad, [2], 'everyone sees the wrong guess');
  // pool empty: a miss turns up one of your own
  eq(T.act(0, { k: 'guess', t: 1, i: 0, v: 5 }), 'ok', 'miss with nothing drawn');
  eq(R.stage, 'reveal', 'pick a tile to turn up');
  eq(T.act(0, { k: 'reveal', i: 99 }), 'bad', 'not a tile');
  eq(T.act(0, { k: 'reveal', i: 2 }), 'ok', 'turn up the 5');
  ok(R.rows[0][2].open, 'the 5 is up');
  eq(R.cur, 1, 'and the turn passes');
}

// ---- knocking players out and the end of a round ----
{
  const T = table(3);
  const R = rig(T, [[B(1), W(2)], [B(5)], [W(9), B(10)]], [], 0);
  eq(T.act(0, { k: 'guess', t: 1, i: 0, v: 5 }), 'ok', 'crack the last tile');
  eq(R.out, [1], 'player 1 is out');
  eq(R.stage, 'decide', 'still my turn');
  eq(T.act(0, { k: 'guess', t: 1, i: 0, v: 5 }), 'bad', "can't guess a player who's out");
  eq(T.act(0, { k: 'guess', t: 2, i: 0, v: 9 }), 'ok', 'keep going');
  eq(T.act(0, { k: 'guess', t: 2, i: 1, v: 10 }), 'ok', 'and the last one');
  eq(R.phase, 'end', 'round over');
  eq(R.win, 0, 'winner');
  eq(R.rank, [0, 2, 1], 'ranked: winner, then last out first');
  eq(R.pts, [2, 0, 1, 0], 'a point for each player outlasted');
  eq([T.seats[0].score, T.seats[0].wins, T.seats[2].score, T.seats[1].score], [2, 1, 1, 0], 'scores kept on the seats');
  ok(T.view(1).R.rows[0].every(t => t.v != null), 'everything shown at the end');
  eq(T.act(0, { k: 'stop' }), 'no', 'nothing to do after the end');
}
{
  // turning up your own last tile knocks you out, and the round can end on it
  const T = table(2);
  const R = rig(T, [[B(1)], [W(3), B(6)]], [], 0);
  T.act(0, { k: 'guess', t: 1, i: 0, v: 4 });
  eq(R.phase, 'end', 'missing with one tile left ends it');
  eq(R.win, 1, 'the other player wins');
  eq(R.out, [0], 'player 0 went out');
}
{
  // turns skip players who are out
  const T = table(4);
  const R = rig(T, [[B(1), W(2)], [B(5)], [W(9), B(10)], [B(0), W(11)]], [], 0);
  T.act(0, { k: 'guess', t: 1, i: 0, v: 5 }); T.act(0, { k: 'stop' });
  eq(R.cur, 2, 'player 1 is skipped');
  T.act(2, { k: 'guess', t: 3, i: 0, v: 7 }); T.act(2, { k: 'reveal', i: 0 });
  eq(R.cur, 3, 'then 3');
  T.act(3, { k: 'guess', t: 0, i: 0, v: 6 }); T.act(3, { k: 'reveal', i: 1 });
  eq(R.cur, 0, 'round the table to 0');
}

// ---- keys ----
{
  const T = table(2);
  const R = rig(T, [[B(2), BK, W(9)], [W(1), B(4)]], [W(5), B(6)], 0);
  T.act(0, { k: 'draw', c: 1 });
  T.act(0, { k: 'guess', t: 1, i: 0, v: 1 });
  eq(T.view(0).opt.slots, [1, 2], 'white 5 can go either side of the key');
  eq(T.act(0, { k: 'stop' }), 'slot', 'a place has to be picked');
  eq(T.act(0, { k: 'stop', at: 0 }), 'slot', 'and it has to fit');
  eq(T.act(0, { k: 'stop', at: 2 }), 'ok', 'after the key');
  eq(R.rows[0].map(t => t.id), [B(2), BK, W(5), W(9)], 'placed');
  T.act(1, { k: 'draw', c: 0 });
  eq(T.act(1, { k: 'guess', t: 0, i: 1, v: KEY }), 'ok', 'guess the key');
  ok(R.rows[0][1].open, 'the key is cracked');
  const T2 = table(2, { keys: false });
  rig(T2, [[B(2)], [W(1)]], [], 0);
  eq(T2.act(0, { k: 'guess', t: 1, i: 0, v: KEY }), 'bad', 'no key guesses without keys');
}
{
  // a miss while holding a number that could go either side of a key: it goes to one of them at random
  const T = table(2);
  const R = rig(T, [[B(2), BK, W(9)], [W(1), B(4)]], [W(5)], 0);
  T.act(0, { k: 'draw', c: 1 });
  T.act(0, { k: 'guess', t: 1, i: 0, v: 7 });
  const at = R.rows[0].findIndex(t => t.id === W(5));
  ok(at === 1 || at === 2, 'beside the key');
  ok(R.rows[0][at].open, 'face up');
}

// ---- what each seat sees ----
{
  const T = table(4, {}, 11);
  T.startRound();
  for (const s of T.R.ps) while (T.R.setup[s].length) T.act(s, { k: 'place', at: 0 });
  T.go();
  for (let n = 0; n < 6; n++) {
    const s = T.R.cur, v = T.view(s);
    const a = AI.decide(v, 3, seeded(n + 1));
    T.act(s, a);
  }
  for (const me of T.R.ps) {
    const v = T.view(me);
    for (const o of v.R.ps) v.R.rows[o].forEach((t, i) => {
      const real = T.R.rows[o][i];
      if (o === me || real.open) ok(t.v === CX.valOf(real.id), 'sees own and cracked tiles');
      else ok(t.v == null && t.c === CX.colorOf(real.id), 'only the colour of a hidden tile');
    });
    // nothing secret anywhere in the view: no hidden tile id appears, not even in the events
    const hiddenIds = new Set();
    for (const o of T.R.ps) if (o !== me) for (const t of T.R.rows[o]) if (!t.open) hiddenIds.add(t.id);
    for (const e of v.R.ev) if (e.id != null) ok(!hiddenIds.has(e.id), 'events only name cracked tiles');
    ok(!JSON.stringify(v).includes('"pool":[{'), 'the pool is only counted');
  }
}

// ---- saving ----
{
  const T = table(3, {}, 5);
  T.startRound(); T.go();
  for (const s of T.R.ps) while (T.R.setup[s].length) T.act(s, { k: 'place', at: 0 });
  const J = JSON.parse(JSON.stringify(T.toJSON()));
  const T2 = Table.fromJSON(J, seeded(1));
  eq(T2.view(1), T.view(1), 'a saved table comes back the same');
  eq(CX.cleanRules({ timer: 45 }).timer, 60, 'unknown timer → default');
  eq(CX.cleanRules({ timer: 0, keys: false }), { keys: false, timer: 0 }, 'rules kept');
}

// ---- the inference, checked against counting every possibility ----
// brute force: give every unknown place each unknown tile it could hold, keep rows in order, count
function brute(v) {
  const sc = AI.scan(v);
  const places = [];
  sc.rows.forEach(r => r.ents.forEach((e, x) => { if (e.fix == null) places.push({ o: r.o, i: e.i, x, c: e.c, bad: e.bad, r }); }));
  const tiles = sc.nums.concat(sc.keys);
  const counts = places.map(() => new Array(13).fill(0));
  let total = 0;
  const used = new Set(), asg = new Array(places.length);
  const fitsRow = r => {
    const ids = r.ents.map((e, x) => e.fix != null ? e.fix : asg[places.findIndex(p => p.r === r && p.x === x)]);
    const nums = ids.filter(id => id != null && id < JK);
    for (let k = 1; k < nums.length; k++) if (nums[k] < nums[k - 1]) return false;
    return true;
  };
  (function go(k) {
    if (k === places.length) { total++; places.forEach((p, j) => counts[j][CX.valOf(asg[j])]++); return; }
    const p = places[k];
    for (const id of tiles) {
      if (used.has(id) || CX.colorOf(id) !== p.c || p.bad.has(CX.valOf(id))) continue;
      asg[k] = id; used.add(id);
      if (fitsRow(p.r)) go(k + 1);
      used.delete(id); asg[k] = null;
    }
  })(0);
  return { places, counts, total };
}
function checkInfer(T, s, label) {
  const v = T.view(s), P = AI.infer(v), bf = brute(v);
  let worst = 0;
  bf.places.forEach((p, j) => { for (let val = 0; val < 13; val++) worst = Math.max(worst, Math.abs(P[p.o][p.i][val] - bf.counts[j][val] / bf.total)); });
  ok(worst < 1e-9, `${label}: exact chances match counting (off by ${worst})`);
  // and the quick version never rules out something possible
  const S = AI.simple(v);
  let missed = 0;
  bf.places.forEach((p, j) => { for (let val = 0; val < 13; val++) if (bf.counts[j][val] && !S[p.o][p.i][val]) missed++; });
  ok(!missed, `${label}: the quick hint keeps every possible value`);
}
{
  const T = table(2);
  const R = rig(T, [[B(1), W(4), B(8), W(10)], [W(0), B(3), W(6), B(11)]], [B(5), W(7), B(0), WK, BK, W(2)], 0);
  checkInfer(T, 0, 'start of a 2-player round');
  R.rows[1][1].open = true; R.rows[1][0].bad = [3, 5];
  checkInfer(T, 0, 'a cracked tile and wrong guesses');
}
{
  const T = table(3);
  const R = rig(T, [[B(1), W(4), B(8)], [W(0), BK, W(6)], [B(2), W(5), B(9)]], [B(5), W(7), WK], 1);
  T.act(1, { k: 'draw', c: 0 });
  checkInfer(T, 0, '3 players, someone holding a tile');
  checkInfer(T, 1, 'the drawer');
  R.rows[2][1].open = true; R.rows[0][2].bad = [KEY];
  checkInfer(T, 1, 'a key ruled out');
}
{
  // random small positions from real play
  for (let seed = 1; seed <= 40; seed++) {
    const n = 2 + seed % 3;
    const T = table(n, { keys: seed % 4 !== 0 }, seed);
    T.startRound();
    for (const s of T.R.ps) while (T.R.setup[s].length) T.act(s, { k: 'place', at: Math.floor(seeded(seed)() * (T.R.rows[s].length + 1)) });
    T.go();
    const rnd = seeded(seed * 31);
    const steps = 3 + seed % 9;
    for (let k = 0; k < steps && T.R.phase === 'play'; k++) { const s = T.R.cur; T.act(s, AI.decide(T.view(s), 1 + k % 4, rnd)); }
    if (T.R.phase !== 'play') continue;
    // keep the brute force small
    const unknown = T.R.ps.reduce((a, s) => a + T.R.rows[s].filter(t => !t.open).length, 0);
    if (unknown > 14) continue;
    checkInfer(T, T.R.ps[seed % T.R.ps.length], `random position ${seed} (${n} players)`);
  }
}

// ---- bots: every move they make is legal, rounds always finish, stronger bots win more ----
{
  const wins = [0, 0, 0, 0, 0];
  let rounds = 0, moves = 0, bad = 0;
  for (let g = 0; g < 120; g++) {
    const n = 2 + g % 3, T = table(n, { keys: g % 5 !== 0 }, 1000 + g), rnd = seeded(g + 9);
    const lvs = []; for (let s = 0; s < n; s++) lvs.push(1 + (s + g) % 4);
    T.startRound();
    let guard = 0;
    for (const s of T.R.ps) while (T.R.setup[s].length && guard++ < 10) { const a = AI.decide(T.view(s), lvs[s], rnd); if (T.act(s, a) !== 'ok') bad++; }
    T.go();
    while (T.R.phase === 'play' && guard++ < 2000) {
      const s = T.R.cur, a = AI.decide(T.view(s), lvs[s], rnd);
      const r = T.act(s, a); moves++;
      if (r !== 'ok') { bad++; break; }
    }
    if (T.R.phase === 'end') { rounds++; wins[lvs[T.R.win]]++; }
  }
  eq(bad, 0, 'bots only make legal moves');
  eq(rounds, 120, 'every round finishes');
  ok(wins[4] + wins[3] > wins[1] * 1.5, `stronger bots win more (Rookie ${wins[1]}, Regular ${wins[2]}, Shark ${wins[3]}, Genius ${wins[4]})`);
  console.log(`  bots: ${rounds} rounds, ${moves} moves; wins by level`, wins.slice(1));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
