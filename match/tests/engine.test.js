// The rules, checked in node:  node match/tests/engine.test.js
// Boards are drawn as rows: '0'-'5' a colour, '.' a still background colour, 'r' 'v' 'f' 'k' 'w' a special, 'i' an ingot,
// 'x' no cell. Obstacles go in a second set of rows: '1' '2' frost layers, 'c' a cage, 'a' 'b' 'd' a gift box of 1, 2 or 3 layers.
globalThis.window = globalThis;
require('../src/engine.js'); require('../src/ai.js'); require('../src/levels.js');
const assert = require('assert');
const { Game, NORM, RH, RV, FC, KL, FW, ING } = MM, AI = MMAI, LV = MMLV;
let passed = 0, failed = 0;
function test(name, f) {
  try { f(); passed++; } catch (e) { failed++; console.log('FAIL', name, '\n  ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n  ')); }
}
// a background that never lines up three of a colour or makes a square: colour (x + 2y) % 6
const BG = (x, y) => (x + 2 * y) % 6;
function mk(rows, ob, o) {
  ob = ob || []; o = o || {};
  const H = rows.length, W = rows[0].length, pre = [], top = [], base = [];
  for (let y = 0; y < H; y++) {
    let p = '', t = '', b = '';
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x], oc = (ob[y] || '')[x] || '.';
      p += ch >= '0' && ch <= '5' ? ch : ch === '.' ? String(BG(x, y)) : '.';
      t += 'rvfkwi'.includes(ch) ? ch : oc === 'c' ? 'c' : oc === 'a' ? '1' : oc === 'b' ? '2' : oc === 'd' ? '3' : '.';
      b += ch === 'x' ? 'x' : oc === '1' || oc === '2' ? oc : '.';
    }
    pre.push(p); top.push(t); base.push(b);
  }
  const g = new Game(Object.assign({ mode: 'level', moves: 30, seed: 7, colors: 6, pre, top, base, goals: [{ t: 'score', n: 1e9 }] }, o));
  assert.strictEqual(g.groups().length, 0, 'the test board starts with a match already on it');
  assert.ok(g.hasMove(), 'the test board has no move (it would be shuffled)');
  g.start();
  return g;
}
const at = (x, y, W = 8) => y * W + x;
const evs = (g, k) => g.ev.filter(e => e.k === k);
const still = g => { g.busy = 0; };
// every cell holds a piece after a move has settled (on a board without obstacles)
function whole(g) {
  for (let i = 0; i < g.pc.length; i++) if (!g.hole[i] && !g.box[i]) assert.ok(g.pc[i], 'an empty cell at ' + i);
}
// nothing can fall any more: a cell stays empty only where no piece can reach it (under a cage or a box)
function settled(g) {
  const c = g.clone(); c.rec = true; c.anim = [];
  c.fall();
  assert.strictEqual(c.anim.filter(s => s.t === 'fall').length, 0, 'pieces could still fall');
  for (let i = 0; i < g.pc.length; i++) if (!g.pc[i] && g.open(i)) assert.ok(g.starved(i), 'cell ' + i + ' is empty but could be filled');
}
// a background board with one spare move in the top right corner (a board with no move at all would be shuffled at the start)
const BOARD = n => Array.from({ length: n }, (_, y) => (y === 0 ? '.....22.' : y === 1 ? '.......2' : '........'));

// ---------- matching ----------
test('three in a line clear, score and use a move', () => {
  const r = BOARD(8); r[6] = '..3.....'; r[7] = '33......';
  const g = mk(r);
  const s0 = g.score;
  assert.ok(g.swap(at(2, 6), at(2, 7)));
  const m = evs(g, 'match');
  assert.ok(m.length >= 1 && m[0].n === 3 && m[0].kind === NORM && m[0].color === 3 && m[0].wave === 0, JSON.stringify(m));
  assert.strictEqual(g.used, 1);
  assert.ok(g.score >= s0 + 60);
  assert.ok(g.stats.cleared >= 3);
  whole(g);
});
test('a swap that lines nothing up goes back', () => {
  const g = mk(BOARD(8));
  const before = g.snap().b;
  assert.strictEqual(g.swap(at(0, 0), at(1, 0)), false);
  assert.strictEqual(g.used, 0);
  assert.strictEqual(g.snap().b, before);
  assert.strictEqual(evs(g, 'bad').length, 1);
});
test('only neighbours swap', () => {
  const g = mk(BOARD(8));
  assert.strictEqual(g.swap(at(0, 0), at(2, 0)), false);
  assert.strictEqual(g.swap(at(7, 0), at(0, 1)), false);   // the end of one row and the start of the next are not neighbours
  assert.strictEqual(g.used, 0);
});
test('four in a row make a column rocket where the piece moved to', () => {
  const r = BOARD(8); r[6] = '..3.....'; r[7] = '331300..';
  const g = mk(r);
  assert.ok(g.swap(at(2, 6), at(2, 7)));
  const m = evs(g, 'match')[0];
  assert.strictEqual(m.n, 4); assert.strictEqual(m.kind, RV);
  assert.strictEqual(g.pc[at(2, 7)].k, RV);
  whole(g);
});
test('four in a column make a row rocket', () => {
  const r = BOARD(8); r[4] = '1.......'; r[5] = '1.......'; r[6] = '41......'; r[7] = '1.......';
  const g = mk(r);
  assert.ok(g.swap(at(1, 6), at(0, 6)));
  assert.strictEqual(evs(g, 'match')[0].kind, RH);
  assert.ok(g.pc.some(p => p && p.k === RH));
});
test('an L makes a firecracker at the corner', () => {
  const r = BOARD(8); r[5] = '..5.....'; r[6] = '..5.....'; r[7] = '5545....';
  const g = mk(r);
  assert.ok(g.swap(at(3, 7), at(2, 7)));
  const m = evs(g, 'match')[0];
  assert.strictEqual(m.kind, FC); assert.strictEqual(m.n, 5);
  assert.strictEqual(g.pc[at(2, 7)].k, FC);
});
test('a 2x2 square makes a sky lantern', () => {
  const r = BOARD(8); r[6] = '33......'; r[7] = '303.....';
  const g = mk(r);
  assert.ok(g.swap(at(2, 7), at(1, 7)));
  assert.strictEqual(evs(g, 'match')[0].kind, KL);
  assert.strictEqual(g.pc[at(1, 7)].k, KL);
});
test('five in a line make a firework', () => {
  const r = BOARD(8); r[6] = '..5.....'; r[7] = '55255...';
  const g = mk(r);
  assert.ok(g.swap(at(2, 6), at(2, 7)));
  const m = evs(g, 'match')[0];
  assert.strictEqual(m.kind, FW); assert.strictEqual(m.n, 5);
  assert.strictEqual(g.pc[at(2, 7)].k, FW);
});
test('falling pieces that line up clear again, worth more each wave', () => {
  // clearing the bottom three drops the column above onto a waiting pair
  let found = false;
  for (let seed = 1; seed < 400 && !found; seed++) {
    const g = new Game({ mode: 'time', seed, colors: 6, rec: false });
    g.start();
    for (let k = 0; k < 30 && !g.over; k++) {
      const mv = AI.plan(g, 4, () => 0.5); if (!mv) break;
      const before = g.score; AI.exec(g, mv); still(g);
      const ms = evs(g, 'match');
      if (ms.some(e => e.wave >= 1)) { found = true; assert.ok(evs(g, 'done').some(e => e.wave >= 1)); break; }
      g.ev.length = 0;
    }
  }
  assert.ok(found, 'no chain reaction in 400 games');
});

// ---------- specials ----------
test('a row rocket clears its row when tapped', () => {
  const r = BOARD(8); r[4] = '...r....';
  const g = mk(r);
  assert.ok(g.tap(at(3, 4)));
  const sp = evs(g, 'special');
  assert.strictEqual(sp[0].kind, 'rh');
  assert.ok(g.stats.cleared >= 7, 'cleared ' + g.stats.cleared);
  assert.strictEqual(g.used, 1);
  whole(g);
});
test('a column rocket clears its column', () => {
  const r = BOARD(8); r[2] = '.....v..';
  const g = mk(r);
  assert.ok(g.tap(at(5, 2)));
  assert.strictEqual(evs(g, 'special')[0].kind, 'rv');
  assert.ok(g.stats.cleared >= 7);
});
test('a firecracker blasts the cells around it', () => {
  const r = BOARD(8); r[4] = '....f...';
  const g = mk(r);
  assert.ok(g.tap(at(4, 4)));
  assert.strictEqual(evs(g, 'special')[0].kind, 'fc');
  assert.ok(g.stats.cleared >= 18, 'cleared ' + g.stats.cleared);   // a 5x5 square without its corners: 20 cells
});
test('a sky lantern pops its neighbours, then flies off to another cell', () => {
  const r = BOARD(8); r[4] = '...k....';
  const g = mk(r);
  assert.ok(g.tap(at(3, 4)));
  assert.strictEqual(evs(g, 'special')[0].kind, 'kl');
  assert.ok(g.stats.cleared >= 5);
});
test('a firework swapped with a piece clears that whole colour', () => {
  const r = BOARD(8); r[4] = '...w....';
  const g = mk(r);
  const c = g.colorAt(at(4, 4));
  const count = g.pc.filter((p, i) => g.colorAt(i) === c).length;
  assert.ok(g.swap(at(3, 4), at(4, 4)));
  assert.strictEqual(evs(g, 'special')[0].kind, 'fw');
  assert.ok(g.stats.cleared >= count, `cleared ${g.stats.cleared} of ${count}`);
  whole(g);
});
test('two specials swapped together make a combo', () => {
  const pairs = { rr: 'rv', rf: 'rf', ff: 'ff', kk: 'kk', kr: 'kr', kf: 'kf', wr: 'wr', wf: 'wf', wk: 'wk', ww: 'ww' };
  const ch = { r: 'r', v: 'v', f: 'f', k: 'k', w: 'w' };
  for (const [type, two] of Object.entries(pairs)) {
    const r = BOARD(8); r[4] = '...' + ch[two[0]] + ch[two[1]] + '...';
    const g = mk(r);
    assert.ok(g.swap(at(3, 4), at(4, 4)), type);
    const cb = evs(g, 'combo');
    assert.strictEqual(cb.length, 1, type);
    assert.strictEqual(cb[0].type, type);
    assert.ok(g.stats.cleared >= 8, type + ' cleared ' + g.stats.cleared);
    whole(g);
  }
});
test('two fireworks clear the whole board', () => {
  const r = BOARD(8); r[4] = '...ww...';
  const g = mk(r);
  assert.ok(g.swap(at(3, 4), at(4, 4)));
  assert.ok(g.stats.cleared >= 62, 'cleared ' + g.stats.cleared);
});
test('a special set off by a blast goes off too', () => {
  const r = BOARD(8); r[4] = '.r....v.';
  const g = mk(r);
  assert.ok(g.tap(at(1, 4)));
  const kinds = evs(g, 'special').map(e => e.kind);
  assert.deepStrictEqual(kinds.slice(0, 2), ['rh', 'rv']);
  assert.ok(evs(g, 'special')[1].chain);
});
test('the hammer clears one piece without using a move', () => {
  const g = mk(BOARD(8));
  assert.ok(g.hammer(at(3, 3)));
  assert.strictEqual(g.used, 0);
  assert.ok(g.stats.cleared >= 1);
  whole(g);
});

// ---------- obstacles ----------
test('frost under a match loses a layer', () => {
  const r = BOARD(8); r[6] = '..3.....'; r[7] = '33......';
  const o = BOARD(8).map(() => '........'); o[7] = '21......';
  const g = mk(r, o, { goals: [{ t: 'frost', n: 1 }], moves: 5 });
  assert.ok(g.swap(at(2, 6), at(2, 7)));
  assert.strictEqual(g.frost[at(0, 7)], 1);
  assert.strictEqual(g.frost[at(1, 7)], 0);
  assert.strictEqual(g.goals[0].have, 1);
});
test("a caged piece can't move; a match through it breaks the cage and the piece stays", () => {
  const r = BOARD(8); r[6] = '..3.....'; r[7] = '33......';
  const o = BOARD(8).map(() => '........'); o[7] = 'c.......';
  const g = mk(r, o);
  assert.strictEqual(g.swap(at(0, 7), at(0, 6)), false);
  assert.ok(g.swap(at(2, 6), at(2, 7)));
  assert.strictEqual(g.cage[at(0, 7)], 0);
  // the first blast frees the caged piece instead of clearing it
  const ring = g.anim.find(s => s.t === 'ring');
  assert.ok(!ring.hits.some(h => h[0] === at(0, 7)), 'the caged piece was cleared');
  assert.ok(ring.obs.some(o => o[0] === at(0, 7)));
});
test('a gift box next to a match loses a layer; a box holds no piece', () => {
  const r = BOARD(8); r[6] = '..3.....'; r[7] = '33......';
  const o = BOARD(8).map(() => '........'); o[6] = 'b.......';
  const g = mk(r, o, { goals: [{ t: 'box', n: 1 }] });
  assert.strictEqual(g.pc[at(0, 6)], null);
  assert.ok(g.swap(at(2, 6), at(2, 7)));
  assert.strictEqual(g.box[at(0, 6)], 1);
  whole(g);
});
test('an ingot that reaches the bottom is collected', () => {
  const r = BOARD(8); r[5] = 'i.......'; r[6] = '1.3.....'; r[7] = '33......';
  const g = mk(r, null, { ing: 1, goals: [{ t: 'ing', n: 1 }], moves: 5 });
  // clear the bottom-left three: the 1 and the ingot fall one cell, then the ingot is one away from the bottom
  assert.ok(g.swap(at(2, 6), at(2, 7)));
  still(g);
  for (let k = 0; k < 4 && !g.over; k++) {
    // the hammer on the piece under the ingot brings it down
    let i = g.pc.findIndex(p => p && p.k === ING);
    if (i < 0) break;
    if (i + 8 < 64 && g.pc[i + 8]) { g.ev.length = 0; assert.ok(g.hammer(i + 8)); still(g); }
  }
  assert.strictEqual(g.ing.collected, 1);
  assert.ok(g.won);
});
test("an ingot can't be matched", () => {
  const r = BOARD(8); r[4] = '...i....';
  const g = mk(r, null, { ing: 1 });
  assert.strictEqual(g.colorAt(at(3, 4)), -1);
  assert.strictEqual(g.tap(at(3, 4)), false);
});

// ---------- winning, losing, time ----------
test('a level is won when its goals are done; moves left become rockets', () => {
  const r = BOARD(8); r[6] = '..3.....'; r[7] = '33......';
  const g = mk(r, null, { goals: [{ t: 'col', c: 3, n: 3 }], moves: 6, stars: [0, 500, 900] });
  assert.ok(g.swap(at(2, 6), at(2, 7)));
  assert.ok(g.over && g.won);
  assert.strictEqual(g.wonAt, 1);
  assert.strictEqual(evs(g, 'finale')[0].left, 5);
  assert.strictEqual(g.used, g.moves);
  assert.ok(g.score >= 5 * MM.PTS.spare);
  const over = evs(g, 'over')[0];
  assert.ok(over.won && over.stars >= 1);
});
test('running out of moves loses', () => {
  const r = BOARD(8); r[6] = '..3.....'; r[7] = '33......';
  const g = mk(r, null, { goals: [{ t: 'col', c: 3, n: 50 }], moves: 1 });
  assert.ok(g.swap(at(2, 6), at(2, 7)));
  assert.ok(g.over && !g.won);
  assert.strictEqual(g.why, 'moves');
  assert.strictEqual(g.canAct(), false);
});
test('stars follow the score once won', () => {
  const g = mk(BOARD(8), null, { stars: [0, 1000, 2000] });
  g.won = true;
  assert.strictEqual(g.starsOf(10), 1);
  assert.strictEqual(g.starsOf(1000), 2);
  assert.strictEqual(g.starsOf(5000), 3);
});
test('time mode ends when the clock runs out, after the last move has played', () => {
  const g = new Game({ mode: 'time', seed: 3, time: 10000, colors: 6 });
  g.start();
  g.tick(9990); assert.ok(!g.over && g.canAct());
  AI.exec(g, AI.plan(g, 4));
  assert.ok(g.busy > 20);
  g.tick(10);
  assert.ok(g.ending && !g.over, 'the game ended in the middle of a move');
  g.tick(g.busy);
  assert.ok(g.over); assert.strictEqual(g.why, 'time');
  assert.strictEqual(g.timeLeft(), 0);
});
test('the board is busy while a move plays, and nobody can move then', () => {
  const g = new Game({ mode: 'time', seed: 5, colors: 6 });
  g.start();
  AI.exec(g, AI.plan(g, 4));
  assert.ok(g.busy > 0);
  assert.strictEqual(g.canAct(), false);
  g.tick(g.busy);
  assert.ok(g.canAct());
});

// ---------- the same game for everyone, saving, cages, pictures ----------
test('the same seed gives the same board, a different one another', () => {
  const a = new Game({ mode: 'time', seed: 42, colors: 6 }), b = new Game({ mode: 'time', seed: 42, colors: 6 }), c = new Game({ mode: 'time', seed: 43, colors: 6 });
  assert.strictEqual(a.snap().b, b.snap().b);
  assert.notStrictEqual(a.snap().b, c.snap().b);
  assert.strictEqual(a.groups().length, 0);
  assert.ok(a.hasMove());
});
test('a saved game goes on exactly as the original', () => {
  const g1 = new Game(Object.assign(LV.spec(23, 99), { rec: false }));
  g1.start();
  const R = () => 0.37;
  for (let k = 0; k < 5; k++) { AI.exec(g1, AI.plan(g1, 3, R)); still(g1); }
  const g2 = Game.fromJSON(JSON.parse(JSON.stringify(g1.toJSON())));
  still(g2);
  for (let k = 0; k < 6 && !g1.over; k++) {
    const mv = AI.plan(g1, 3, R);
    AI.exec(g1, mv); AI.exec(g2, mv); still(g1); still(g2);
    assert.strictEqual(g1.snap().b, g2.snap().b, 'after move ' + k);
    assert.strictEqual(g1.score, g2.score);
  }
  assert.deepStrictEqual(g1.goals, g2.goals);
});
test('a damaged save is refused', () => {
  assert.throws(() => Game.fromJSON({ v: 2 }));
  const j = new Game({ seed: 1 }).toJSON(); j.pc = j.pc.slice(1);
  assert.throws(() => Game.fromJSON(j));
});
test('cages thrown in a battle land on free pieces', () => {
  const g = new Game({ mode: 'time', seed: 8, colors: 6 });
  g.start();
  assert.strictEqual(g.addCages(3), 3);
  assert.strictEqual(g.cage.reduce((a, b) => a + b, 0), 3);
  assert.strictEqual(evs(g, 'caged')[0].n, 3);
  assert.ok(g.hasMove());
  g.end('time');
  assert.strictEqual(g.addCages(2), 0);
});
test('the small picture of a board reads back, and junk is refused', () => {
  const g = new Game({ mode: 'time', seed: 8, colors: 6 });
  g.addCages(2);
  const sn = g.snap();
  assert.strictEqual(sn.b.length, 64);
  assert.strictEqual(MM.unsnap(sn.b, sn.w), sn.b);
  assert.ok(/[A-F]/.test(sn.b));
  assert.strictEqual(MM.unsnap('<script>', 8), null);
  assert.strictEqual(MM.unsnap(sn.b.slice(1), 8), null);
  assert.strictEqual(MM.unsnap(sn.b, 3), null);
  assert.strictEqual(MM.unsnap('0'.repeat(100), 10), null);
});
test('a board with no move left is shuffled until it has one', () => {
  // 3 colours on a 4x4 board, arranged so that no swap lines up three
  const g = new Game({ mode: 'time', seed: 4, colors: 3, w: 4, h: 4 });
  const rows = ['0120', '1201', '2012', '0120'];
  // check this really has no move, then let the board deal with it
  rows.forEach((row, y) => [...row].forEach((c, x) => { g.pc[y * 4 + x] = g.newPiece(NORM, +c); }));
  if (g.hasMove()) {
    // find a dead arrangement by search instead
    let dead = false;
    for (let t = 0; t < 5000 && !dead; t++) { for (let i = 0; i < 16; i++) g.pc[i] = g.newPiece(NORM, g.ri(3)); dead = !g.groups().length && !g.hasMove(); }
    assert.ok(dead, 'no dead 4x4 board found');
  }
  g.started = true;
  g.settle();
  assert.ok(g.hasMove());
  assert.strictEqual(g.groups().length, 0);
  assert.strictEqual(evs(g, 'shuffle').length, 1);
});
test('a copy for the bots is independent of the game', () => {
  const g = new Game({ mode: 'time', seed: 12, colors: 6 });
  g.start();
  const b = g.snap().b, c = g.clone();
  AI.exec(c, AI.plan(c, 4));
  assert.strictEqual(g.snap().b, b);
  assert.strictEqual(g.score, 0);
});

// ---------- the sixty levels ----------
test('every level builds, starts still with a move, and plays to the end', () => {
  assert.strictEqual(LV.COUNT, 60);
  let wins = 0;
  for (let n = 1; n <= LV.COUNT; n++) {
    for (const seed of [11, 12]) {
      const g = new Game(Object.assign(LV.spec(n, seed), { rec: false }));
      assert.strictEqual(g.groups().length, 0, 'level ' + n + ' starts with a match');
      g.start();
      assert.ok(g.hasMove(), 'level ' + n + ' has no move');
      assert.ok(g.goals.length >= 1 && g.moves > 0, 'level ' + n);
      for (let k = 0; k < 200 && !g.over; k++) {
        const mv = AI.plan(g, 4); if (!mv) break;
        assert.ok(AI.exec(g, mv), 'level ' + n + ': a planned move was refused');
        still(g); settled(g);
      }
      assert.ok(g.over, 'level ' + n + ' never ended');
      if (g.won) wins++;
    }
  }
  // a strong bot wins most of them (a casual player is what the moves were set for)
  assert.ok(wins >= 96, 'the master bot won only ' + wins + ' of 120');
});
test('levels unlock in order and each teaches what it uses first', () => {
  const seen = new Set();
  for (let n = 1; n <= LV.COUNT; n++) {
    const d = LV.L[n - 1];
    if (d.tut) { assert.ok(!seen.has(d.tut), 'taught twice: ' + d.tut); seen.add(d.tut); }
  }
  for (const k of ['swap', 'rocket', 'lantern', 'cracker', 'firework', 'frost', 'cage', 'box', 'ingot']) assert.ok(seen.has(k), 'never taught: ' + k);
  assert.strictEqual(LV.chapterOf(1), 0); assert.strictEqual(LV.chapterOf(60), 5);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
