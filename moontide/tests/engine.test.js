// Rules checks for Moontide: node moontide/tests/engine.test.js
// Hand-made positions for each rule, then a few hundred random games that check the board never gets into an impossible state,
// and bots of every level finishing games on what they're allowed to see.
const assert = require('assert');
const MT = require('../src/engine.js');
const AI = require('../src/ai.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok  ', name); }
  catch (e) { failed++; console.log('FAIL', name, '\n     ', (e && e.stack || String(e)).split('\n').slice(0, 4).join('\n      ')); }
}

// ---------- helpers: a position built by hand ----------
const at = (q, r) => { const i = MT.cellAt(q, r); assert.ok(i >= 0, 'no cell ' + q + ',' + r); return i; };
// land cells (all beaches with nothing underneath unless said), no pieces, seat 0 to move with three steps
function pos(o = {}) {
  const n = o.n || 2, landCells = o.land || [at(0, 0)];
  const land = new Array(MT.N).fill(false); for (const c of landCells) land[c] = true;
  const g = MT.newGame([0, 1, 2, 3].slice(0, n), { setup: 'place' }, MT.seeded(1), 0, { land, first: 0 });
  g.place = null; g.phase = 'move'; g.turn = 0; g.steps = MT.STEPS; g.die = o.die || 'moon'; g.undo = []; g.tail = false;
  g.isl = []; g.boats = []; g.cr = [];
  for (let i = 0; i < MT.N; i++) if (g.k[i] === 'L') { g.el[i] = o.el && o.el[i] != null ? o.el[i] : 0; g.back[i] = (o.back && o.back[i]) || 'none'; }
  g.sunk = 0; g.mid = o.mid != null ? o.mid : 99; g.high = o.high != null ? o.high : 199;
  return g;
}
const add = (g, s, v, st, cell, b) => { const x = { id: g.nid++, s, v, at: cell, b: b == null ? -1 : b, st, sw: false }; g.isl.push(x); return x; };
const boat = (g, cell, dock) => { const b = { id: g.nid++, at: cell, dock: !!dock }; g.boats.push(b); return b; };
const aboard = (g, b, s, v) => add(g, s, v || 1, 'boat', b.at, b.id);
const beast = (g, k, cell) => { const c = { id: g.nid++, k, at: cell }; g.cr.push(c); return c; };
const R = MT.seeded(99);
const ok = (g, s, a) => assert.strictEqual(MT.act(g, s, a, R), 'ok', 'act ' + JSON.stringify(a) + ' in ' + g.phase);
const tos = (g, s, id) => MT.steps(g, s).filter(m => m.id === id).map(m => m.to).sort((a, b) => a - b);
const sorted = a => a.slice().sort((x, y) => x - y);
// the strip used by several checks: three land hexes in a row, (0,0) (1,0) (2,0)
const A = at(0, 0), B = at(1, 0), C = at(2, 0);
const W = at(-1, 0), WN = at(0, -1), WAB = at(1, -1);   // water: west of A, north of A, between A and B (north side)

// ---------- the board ----------
test('board: 127 hexes, six lighthouses on the corners, neighbours both ways', () => {
  assert.strictEqual(MT.N, 127);
  assert.deepStrictEqual(MT.CORNERS.map(c => MT.CELLS[c].d), [6, 6, 6, 6, 6, 6]);
  for (let i = 0; i < MT.N; i++) for (const j of MT.NB[i]) { assert.ok(MT.NB[j].includes(i)); assert.strictEqual(MT.dist(i, j), 1); }
  const g = MT.newGame([0, 1], {}, MT.seeded(3), 0);
  assert.deepStrictEqual(MT.CORNERS.map(c => g.k[c]), ['H', 'H', 'H', 'H', 'H', 'H']);
});

test('new game: island size, one piece of land, pearls, creatures, what lies under the tiles', () => {
  for (const n of [2, 3, 4]) for (let seed = 1; seed <= 40; seed++) {
    const pl = [0, 1, 2, 3].slice(0, n), g = MT.newGame(pl, {}, MT.seeded(seed * 7 + n), 0);
    const land = []; for (let i = 0; i < MT.N; i++) if (g.k[i] === 'L') land.push(i);
    assert.strictEqual(land.length, MT.LANDS[n]);
    assert.strictEqual(g.total, land.length);
    // one connected island, two hexes clear of every lighthouse, no lakes
    const seen = new Set([land[0]]), q = [land[0]];
    while (q.length) for (const j of MT.NB[q.pop()]) if (g.k[j] === 'L' && !seen.has(j)) { seen.add(j); q.push(j); }
    assert.strictEqual(seen.size, land.length, 'connected');
    for (const i of land) for (const c of MT.CORNERS) assert.ok(MT.dist(i, c) >= 2);
    for (let i = 0; i < MT.N; i++) if (g.k[i] === 'S' && MT.NB[i].length === 6) assert.ok(!MT.NB[i].every(j => g.k[j] === 'L'), 'lake');
    // beaches, groves and hills, with beaches on the shore
    for (const e of [0, 1, 2]) assert.ok(land.some(i => g.el[i] === e));
    // everyone the same pearls
    for (const s of pl) assert.deepStrictEqual(g.isl.filter(x => x.s === s).map(x => x.v).sort(), MT.PEARLS[n].slice().sort());
    // the crab on the highest ground, two sharks and an octopus out in open water
    const crab = MT.crab(g);
    assert.strictEqual(g.el[crab.at], 2);
    const sea = g.cr.filter(c => c.k !== 'crab');
    assert.deepStrictEqual(sea.map(c => c.k).sort(), ['oct', 'shark', 'shark']);
    for (const c of sea) { assert.strictEqual(g.k[c.at], 'S'); assert.ok(!MT.NB[c.at].some(j => g.k[j] === 'L' || g.k[j] === 'H')); }
    // one underside per tile, from the bag for this island size
    assert.deepStrictEqual(land.map(i => g.back[i]).sort(), MT.bagFor(land.length).slice().sort());
    // placing order: islanders round the table from the first player, then boats from the last player back
    const f = pl.indexOf(g.first), o = g.place.order, per = MT.PEARLS[n].length;
    assert.strictEqual(o.length, per * n + n);
    for (let t = 0; t < per * n; t++) assert.strictEqual(o[t], pl[(f + t) % n]);
    assert.deepStrictEqual(o.slice(per * n), pl.map((_, t) => pl[(f + n - 1 - t) % n]));
  }
  const bag = MT.bagFor(32);
  assert.strictEqual(bag.length, 32);
  assert.ok(bag.filter(b => b === 'boat').length >= 6, 'enough boats come up');
});

test('placing: islanders on empty land away from the crab, boats in the water by the shore, then the first turn', () => {
  const g = MT.newGame([0, 1], {}, MT.seeded(5), 0, { first: 1 });
  assert.strictEqual(g.turn, 1);
  const crabAt = MT.crab(g).at;
  assert.ok(!MT.placeCells(g).includes(crabAt));
  const c0 = MT.placeCells(g)[0];
  assert.strictEqual(MT.act(g, 0, { k: 'place', v: 5, at: c0 }), 'turn');
  ok(g, 1, { k: 'place', v: 5, at: c0 });
  assert.ok(!MT.placeCells(g).includes(c0), 'one islander per tile while placing');
  assert.strictEqual(MT.act(g, 0, { k: 'place', v: 9, at: MT.placeCells(g)[0] }), 'illegal', 'no such pearl');
  let guard = 0;
  while (MT.placeKind(g) === 'isl' && guard++ < 50) { const m = MT.legal(g)[0]; ok(g, g.turn, m); }
  assert.strictEqual(MT.placeKind(g), 'boat');
  assert.strictEqual(g.turn, 0, 'boats start from the last player');
  for (const c of MT.placeCells(g)) { assert.strictEqual(g.k[c], 'S'); assert.ok(MT.NB[c].some(j => g.k[j] === 'L')); }
  ok(g, 0, MT.legal(g)[0]);
  ok(g, 1, MT.legal(g)[0]);
  assert.strictEqual(g.place, null);
  assert.strictEqual(g.phase, 'move'); assert.strictEqual(g.turn, 1); assert.strictEqual(g.steps, MT.STEPS);
  assert.ok(MT.FACES.includes(g.die));
  assert.strictEqual(g.boats.length, 2);
  // quick start does all of that by itself
  const q = MT.newGame([0, 1, 2], { setup: 'quick' }, MT.seeded(8), 0);
  assert.strictEqual(q.place, null); assert.strictEqual(q.phase, 'move');
  assert.strictEqual(q.isl.filter(x => x.st === 'land').length, 3 * MT.PEARLS[3].length);
  assert.strictEqual(q.boats.length, 3);
});

// ---------- moving ----------
test('walking: to a free land hex, never onto the crab or a full hex', () => {
  const g = pos({ land: [A, B, C] });
  const x = add(g, 0, 3, 'land', A);
  assert.ok(tos(g, 0, x.id).includes(B));
  for (let t = 0; t < 3; t++) add(g, 1, 1, 'land', B);
  assert.ok(!tos(g, 0, x.id).includes(B), 'three to a hex');
  const g2 = pos({ land: [A, B, C] });
  const y = add(g2, 0, 3, 'land', B);
  beast(g2, 'crab', C);
  assert.ok(!tos(g2, 0, y.id).includes(C), 'not onto the crab');
});

test('swimming: into the sea you stop for the turn, and you can\'t swim into a shark', () => {
  const g = pos({ land: [A, B] });
  const x = add(g, 0, 3, 'land', A);
  beast(g, 'shark', WN);
  assert.ok(tos(g, 0, x.id).includes(W));
  assert.ok(!tos(g, 0, x.id).includes(WN), 'shark in the way');
  ok(g, 0, { k: 'step', p: 'i', id: x.id, to: W });
  assert.strictEqual(x.st, 'swim'); assert.strictEqual(x.at, W);
  assert.deepStrictEqual(tos(g, 0, x.id), [], 'a swimmer who just jumped in waits for next turn');
  // next turn the swimmer strokes one hex at a time
  x.sw = false;
  const next = tos(g, 0, x.id);
  assert.ok(next.length > 0 && next.every(j => MT.dist(j, W) === 1 && g.k[j] !== 'L'), 'swimmers don\'t climb back onto land');
});

test('a boat with room takes you aboard, even next to a shark', () => {
  const g = pos({ land: [A, B] });
  const x = add(g, 0, 3, 'land', A);
  beast(g, 'shark', WN);
  const b = boat(g, WN);
  assert.ok(tos(g, 0, x.id).includes(WN));
  ok(g, 0, { k: 'step', p: 'i', id: x.id, to: WN });
  assert.strictEqual(x.st, 'boat'); assert.strictEqual(x.b, b.id);
  // a full boat: you'd only be swimming beside it, and not with a shark there
  const g2 = pos({ land: [A] });
  const y = add(g2, 0, 3, 'land', A);
  const b2 = boat(g2, W); aboard(g2, b2, 1); aboard(g2, b2, 1); aboard(g2, b2, 1);
  ok(g2, 0, { k: 'step', p: 'i', id: y.id, to: W });
  assert.strictEqual(y.st, 'swim');
  beast(g2, 'shark', WN); const b3 = boat(g2, WN); aboard(g2, b3, 1); aboard(g2, b3, 1); aboard(g2, b3, 1);
  const z = add(g2, 0, 2, 'land', A);
  assert.ok(!tos(g2, 0, z.id).includes(WN));
});

test('rowing: the side with most people aboard rows, anyone rows an empty boat, one boat to a hex', () => {
  const g = pos({ land: [A] });
  const b = boat(g, W);
  assert.ok(MT.steps(g, 1).some(m => m.p === 'b' && m.id === b.id), 'empty: anyone');
  aboard(g, b, 0); aboard(g, b, 0); aboard(g, b, 1);
  assert.deepStrictEqual(MT.steerers(g, b), [0]);
  assert.ok(!MT.steps(g, 1).some(m => m.p === 'b'), 'outnumbered');
  const g2 = pos({ land: [A] }), b2 = boat(g2, W);
  aboard(g2, b2, 0); aboard(g2, b2, 1);
  assert.deepStrictEqual(MT.steerers(g2, b2).sort(), [0, 1], 'a tie: either');
  // not onto land or another boat
  const other = boat(g2, at(-2, 0));
  const to = MT.boatSteps(g2, b2);
  assert.ok(!to.includes(A) && !to.includes(other.at));
  // passengers go with it
  const g3 = pos({ land: [A] }), b3 = boat(g3, W), p = aboard(g3, b3, 0);
  const dest = MT.boatSteps(g3, b3)[0];
  ok(g3, 0, { k: 'step', p: 'b', id: b3.id, to: dest });
  assert.strictEqual(p.at, dest); assert.strictEqual(b3.at, dest);
});

test('lighthouses: a boat sailing in saves everyone aboard and can row back out empty; swimmers can climb in', () => {
  const H = MT.CORNERS[0], near = MT.NB[H].find(j => MT.NB[H].includes(j));
  const g = pos({ land: [A] });
  const b = boat(g, near), p1 = aboard(g, b, 0, 5), p2 = aboard(g, b, 1, 2);
  assert.ok(MT.boatSteps(g, b).includes(H));
  ok(g, 0, { k: 'step', p: 'b', id: b.id, to: H });
  assert.ok(b.dock);
  assert.strictEqual(p1.st, 'safe'); assert.strictEqual(p2.st, 'safe');
  assert.deepStrictEqual(MT.pax(g, b), []);
  const out = MT.boatSteps(g, b);
  assert.ok(out.length > 0 && out.every(j => g.k[j] === 'S'), 'back out to sea only');
  ok(g, 0, { k: 'step', p: 'b', id: b.id, to: out[0] });
  assert.ok(!b.dock);
  // a swimmer next to a lighthouse
  const g2 = pos({ land: [A] }), x = add(g2, 1, 4, 'swim', near);
  g2.turn = 1;
  assert.ok(tos(g2, 1, x.id).includes(H));
  ok(g2, 1, { k: 'step', p: 'i', id: x.id, to: H });
  assert.strictEqual(x.st, 'safe');
});

test('steps: three a turn, a tailwind adds two once, undo takes a step back, then the sinking', () => {
  const g = pos({ land: [A, B, C] });
  let x = add(g, 0, 3, 'land', A);
  const me = () => g.isl.find(y => y.id === x.id);   // undo puts back a copy of the pieces
  g.hand[0].tail = 1;
  ok(g, 0, { k: 'step', p: 'i', id: x.id, to: B });
  ok(g, 0, { k: 'step', p: 'i', id: x.id, to: C });
  ok(g, 0, { k: 'undo' });
  x = me();
  assert.strictEqual(x.at, B); assert.strictEqual(g.steps, 2);
  ok(g, 0, { k: 'step', p: 'i', id: x.id, to: C });
  ok(g, 0, { k: 'step', p: 'i', id: x.id, to: B });
  assert.strictEqual(g.steps, 0);
  assert.strictEqual(g.phase, 'move', 'still time to play the tailwind');
  assert.strictEqual(MT.act(g, 0, { k: 'step', p: 'i', id: x.id, to: A }, R), 'phase');
  ok(g, 0, { k: 'tail' });
  assert.strictEqual(g.steps, MT.TAILWIND); assert.strictEqual(g.hand[0].tail, 0);
  assert.strictEqual(MT.act(g, 0, { k: 'tail' }, R), 'illegal');
  ok(g, 0, { k: 'undo' });
  assert.strictEqual(g.hand[0].tail, 1, 'undo gives the tailwind back');
  ok(g, 0, { k: 'tail' });
  ok(g, 0, { k: 'step', p: 'i', id: x.id, to: A });
  ok(g, 0, { k: 'step', p: 'i', id: x.id, to: B });
  assert.strictEqual(g.phase, 'sink');
  // stopping early
  const g2 = pos({ land: [A, B] }); add(g2, 0, 1, 'land', A);
  ok(g2, 0, { k: 'done' });
  assert.strictEqual(g2.phase, 'sink');
});

// ---------- the tide ----------
test('the tide: beaches go first, then groves, then hills, and only from the shore', () => {
  // a flower of seven hexes: the middle one is not on the shore
  const ring = MT.NB[A];
  const el = {}; el[A] = 0; ring.forEach((c, i) => { el[c] = i < 2 ? 0 : i < 4 ? 1 : 2; });
  const g = pos({ land: [A].concat(ring), el, mid: 2, high: 4 });
  g.phase = 'sink';
  assert.deepStrictEqual(sorted(MT.sinkable(g)), sorted(ring.slice(0, 2)), 'low tide: beaches on the shore');
  assert.ok(!MT.sinkable(g).includes(A), 'the middle is never on the shore');
  g.sunk = 2;
  assert.deepStrictEqual(sorted(MT.sinkable(g)), sorted(ring.slice(0, 4)), 'mid tide: groves too');
  g.sunk = 4;
  assert.deepStrictEqual(sorted(MT.sinkable(g)), sorted(ring), 'high tide: anything on the shore');
  // no beach left on the shore at low tide: the lowest shore tiles go
  const g2 = pos({ land: [A].concat(ring), el: Object.assign({}, el, { [ring[0]]: 1, [ring[1]]: 1 }), mid: 5, high: 9 });
  assert.deepStrictEqual(sorted(MT.sinkable(g2)), sorted(ring.slice(0, 4)));
});

test('the crab\'s tile stays up unless it is the only one left on the shore; then the crab is gone', () => {
  const g = pos({ land: [A, B] });
  beast(g, 'crab', A);
  g.phase = 'sink';
  assert.deepStrictEqual(MT.sinkable(g), [B]);
  ok(g, 0, { k: 'sink', at: B });
  const g2 = pos({ land: [A, B] }); beast(g2, 'crab', A); g2.k[B] = 'S'; g2.phase = 'sink';
  assert.deepStrictEqual(MT.sinkable(g2), [A]);
  // sinking the last land ends the game
  ok(g2, 0, { k: 'sink', at: A });
  assert.ok(!MT.crab(g2));
  assert.ok(g2.over); assert.strictEqual(g2.res.why, 'sunk');
});

test('a sinking tile: people on it end up swimming; what was underneath happens', () => {
  const backs = { boat: 0, shark: 0, oct: 0, reef: 0, buoy: 0, tail: 0 };
  for (const k of Object.keys(backs)) {
    const g = pos({ land: [A, B, C], back: { [A]: k } });
    const xs = [add(g, 1, 3, 'land', A), add(g, 1, 2, 'land', A)];
    add(g, 0, 1, 'land', C);
    g.phase = 'sink';
    ok(g, 0, { k: 'sink', at: A });
    assert.strictEqual(g.k[A], k === 'reef' ? 'F' : 'S');
    const e = g.ev.filter(e => e.k === 'sink').pop();
    assert.strictEqual(e.at, A); assert.strictEqual(e.back, k);
    if (k === 'boat') {
      const b = MT.boatAt(g, A);
      assert.ok(b, 'a boat comes up');
      assert.deepStrictEqual(MT.pax(g, b).map(x => x.id).sort(), xs.map(x => x.id).sort(), 'and picks them up');
    } else for (const x of xs) { assert.strictEqual(x.st, 'swim'); assert.strictEqual(x.at, A); }
    if (k === 'shark' || k === 'oct') assert.ok(MT.crAt(g, A, k), 'a creature comes up');
    if (k === 'buoy' || k === 'tail') assert.strictEqual(g.hand[0][k], 1, 'the player who sank it keeps it');
    assert.strictEqual(g.phase === 'cr' || g.turn === 1, true);
  }
  // a boat coming up takes three at most
  const g = pos({ land: [A, B], back: { [A]: 'boat' } });
  for (let t = 0; t < 3; t++) add(g, 0, 1, 'land', A);
  add(g, 1, 1, 'swim', A);
  g.phase = 'sink';
  ok(g, 0, { k: 'sink', at: A });
  assert.strictEqual(MT.pax(g, MT.boatAt(g, A)).length, 3);
  assert.strictEqual(g.isl.filter(x => x.st === 'swim').length, 1);
});

test('the dolphin: a swimmer rides up to three hexes, past sharks but not onto one, into a lighthouse too', () => {
  const H = MT.CORNERS[0];
  const two = MT.NB[H].map(j => MT.NB[j].find(k => MT.dist(k, H) === 2)).find(k => k != null);
  const g = pos({ land: [A, B], back: { [B]: 'dolphin' } });
  const x = add(g, 1, 5, 'swim', two);
  add(g, 0, 1, 'land', A);
  const mid = MT.NB[two].find(j => MT.NB[j].includes(H));
  beast(g, 'shark', mid);
  const reach = MT.dolReach(g, x);
  assert.ok(reach.cells.includes(H), 'into the lighthouse, past the shark');
  assert.ok(!reach.cells.includes(mid), 'not onto the shark');
  assert.ok(reach.cells.every(j => MT.dist(j, two) <= 3));
  g.phase = 'sink';
  ok(g, 0, { k: 'sink', at: B });
  assert.strictEqual(g.phase, 'dol');
  assert.strictEqual(MT.act(g, 0, { k: 'dol', id: x.id, to: mid }, R), 'illegal');
  ok(g, 0, { k: 'dol', id: x.id, to: H });
  assert.strictEqual(x.st, 'safe');
  // no swimmers: no dolphin ride, straight on to the creatures
  const g2 = pos({ land: [A, B], back: { [B]: 'dolphin' } }); add(g2, 0, 1, 'land', A); beast(g2, 'shark', at(-3, 0)); g2.phase = 'sink';
  ok(g2, 0, { k: 'sink', at: B });
  assert.strictEqual(g2.phase, 'cr');
});

// ---------- creatures ----------
test('the tide die says which creature moves; the moon, or a creature not in play, lets you pick any', () => {
  const g = pos({ land: [A], die: 'oct' });
  beast(g, 'shark', at(-3, 0)); beast(g, 'crab', A);
  assert.deepStrictEqual(MT.crTypes(g), ['shark', 'crab'], 'no octopus about: any');
  beast(g, 'oct', at(3, -3));
  assert.deepStrictEqual(MT.crTypes(g), ['oct']);
  g.die = 'moon';
  assert.deepStrictEqual(MT.crTypes(g), ['shark', 'oct', 'crab']);
});

test('sharks: up to three hexes of open sea (not over reefs or land), and they eat the swimmers where they stop', () => {
  const g = pos({ land: [A], die: 'shark' });
  const s0 = at(-4, 0), sh = beast(g, 'shark', s0);
  const cells = MT.reach(g, sh).cells;
  assert.ok(cells.length > 0 && cells.every(j => MT.dist(j, s0) <= 3 && g.k[j] === 'S'));
  const vic = at(-2, 0);
  const a = add(g, 0, 5, 'swim', vic), b = add(g, 1, 3, 'swim', vic), safe = add(g, 1, 2, 'swim', at(-2, -1));
  g.phase = 'cr';
  ok(g, 0, { k: 'cr', id: sh.id, to: vic });
  assert.strictEqual(a.st, 'lost'); assert.strictEqual(a.how, 'eaten');
  assert.strictEqual(b.st, 'lost');
  assert.strictEqual(safe.st, 'swim');
  assert.strictEqual(g.turn, 1, 'next player');
  // a reef in the way
  const g2 = pos({ land: [A], die: 'shark' });
  const s2 = beast(g2, 'shark', at(-4, 0));
  for (const j of MT.NB[s2.at]) g2.k[j] = 'F';
  assert.deepStrictEqual(MT.reach(g2, s2).cells, []);
  // people in a boat are fine
  const g3 = pos({ land: [A], die: 'shark' }), s3 = beast(g3, 'shark', at(-4, 0)), bt = boat(g3, at(-3, 0)), p = aboard(g3, bt, 0);
  g3.phase = 'cr'; ok(g3, 0, { k: 'cr', id: s3.id, to: bt.at });
  assert.strictEqual(p.st, 'boat');
});

test('a life buoy saves all of one player\'s swimmers from one shark, and is used up', () => {
  const g = pos({ land: [A], die: 'shark' });
  const sh = beast(g, 'shark', at(-4, 0)), vic = at(-3, 0);
  const a = add(g, 1, 5, 'swim', vic), b = add(g, 1, 1, 'swim', vic), c = add(g, 0, 2, 'swim', vic);
  g.hand[1].buoy = 1;
  g.phase = 'cr';
  ok(g, 0, { k: 'cr', id: sh.id, to: vic });
  assert.strictEqual(a.st, 'swim'); assert.strictEqual(b.st, 'swim');
  assert.strictEqual(c.st, 'lost');
  assert.strictEqual(g.hand[1].buoy, 0);
  const e = g.ev.filter(e => e.k === 'cr').pop();
  assert.deepStrictEqual(e.buoy, [1]);
});

test('the octopus: one hex or stays put, and can drag a boat under where it stops or next to it', () => {
  const g = pos({ land: [A], die: 'oct' });
  const o = beast(g, 'oct', at(-4, 0));
  const near = boat(g, at(-3, 0)), far = boat(g, at(-4, 3));
  const p = aboard(g, near, 1, 5), q = aboard(g, near, 0, 2);
  const ms = MT.crMovesOf(g, o);
  assert.ok(ms.every(m => m.to === o.at || MT.dist(m.to, o.at) === 1));
  assert.ok(ms.some(m => m.to === o.at && m.grab === near.id), 'grab without moving');
  assert.ok(!ms.some(m => m.grab === far.id), 'too far');
  g.phase = 'cr';
  ok(g, 0, { k: 'cr', id: o.id, to: o.at, grab: near.id });
  assert.ok(!MT.boatById(g, near.id), 'the boat is gone');
  for (const x of [p, q]) { assert.strictEqual(x.st, 'swim'); assert.strictEqual(x.at, at(-3, 0)); }
  // docked boats are out of reach
  const H = MT.CORNERS[3], nb = MT.NB[H][0];
  const g2 = pos({ land: [A], die: 'oct' }), o2 = beast(g2, 'oct', nb), d = boat(g2, H, true);
  assert.ok(!MT.crMovesOf(g2, o2).some(m => m.grab === d.id));
});

test('the crab: up to two hexes over land, shoving whoever is there into the water beside it', () => {
  const g = pos({ land: [A, B, C], die: 'crab' });
  const cr = beast(g, 'crab', A);
  const x = add(g, 1, 5, 'land', C), y = add(g, 0, 1, 'land', C);
  const ms = MT.crMovesOf(g, cr).filter(m => m.to === C);
  assert.ok(ms.length > 0 && ms.every(m => g.k[m.push] === 'S' && MT.NB[C].includes(m.push)), 'shoves into water next to it');
  assert.ok(MT.crMovesOf(g, cr).every(m => g.k[m.to] === 'L' && MT.dist(m.to, A) <= 2));
  g.phase = 'cr';
  assert.strictEqual(MT.act(g, 0, { k: 'cr', id: cr.id, to: C, push: B }, R), 'illegal', 'not onto land');
  ok(g, 0, { k: 'cr', id: cr.id, to: C, push: ms[0].push });
  assert.strictEqual(cr.at, C);
  for (const z of [x, y]) { assert.strictEqual(z.st, 'swim'); assert.strictEqual(z.at, ms[0].push); }
});

test('after the creature (or skipping it) the next player\'s turn starts fresh', () => {
  const g = pos({ n: 3, land: [A] });
  const x = add(g, 1, 1, 'swim', W); x.sw = true;
  beast(g, 'shark', at(-4, 0));
  g.phase = 'cr';
  ok(g, 0, { k: 'cr', skip: 1 });
  assert.strictEqual(g.turn, 1); assert.strictEqual(g.phase, 'move'); assert.strictEqual(g.steps, MT.STEPS);
  assert.strictEqual(x.sw, false, 'swimmers can swim again');
  g.phase = 'cr';
  g.turn = 2; ok(g, 2, { k: 'cr', skip: 1 });
  assert.strictEqual(g.turn, 0, 'round the table');
});

// ---------- the end ----------
test('the end: the island is gone, everyone still out there is lost, pearls in lighthouses count', () => {
  const g = pos({ n: 3, land: [A] });
  add(g, 0, 5, 'safe', MT.CORNERS[0]); add(g, 0, 1, 'safe', MT.CORNERS[0]);
  add(g, 1, 3, 'safe', MT.CORNERS[1]); add(g, 1, 3, 'safe', MT.CORNERS[1]);
  add(g, 2, 5, 'swim', W); const stuck = add(g, 2, 2, 'land', A);
  g.phase = 'sink';
  ok(g, 0, { k: 'sink', at: A });
  assert.ok(g.over); assert.strictEqual(g.res.why, 'sunk');
  assert.strictEqual(stuck.st, 'lost'); assert.strictEqual(stuck.how, 'tide');
  assert.deepStrictEqual(g.res.rows.map(r => [r.s, r.pts]), [[0, 6], [1, 6], [2, 0]]);
  assert.deepStrictEqual(g.res.win, [0, 1], 'level on pearls and on people saved: both win');
  // more people saved breaks a tie on pearls
  const g2 = pos({ land: [A] });
  add(g2, 0, 5, 'safe', MT.CORNERS[0]); add(g2, 1, 3, 'safe', MT.CORNERS[1]); add(g2, 1, 2, 'safe', MT.CORNERS[1]);
  g2.phase = 'sink'; ok(g2, 0, { k: 'sink', at: A });
  assert.deepStrictEqual(g2.res.win, [1]);
  // it also ends when nobody is left out there
  const g3 = pos({ land: [A, B], back: { [B]: 'dolphin' } });
  const H = MT.CORNERS[0], last = add(g3, 1, 2, 'swim', MT.NB[H][0]);
  g3.phase = 'sink'; ok(g3, 0, { k: 'sink', at: B });
  ok(g3, 0, { k: 'dol', id: last.id, to: H });
  assert.ok(g3.over); assert.strictEqual(g3.res.why, 'all');
});

// ---------- what each player sees, and junk from the network ----------
test('a player sees their own pearls only, and nothing under the tiles, until the end', () => {
  const T = new MT.Table({ rules: { setup: 'quick' } });
  T.seats[0] = { name: 'a' }; T.seats[2] = { name: 'b' };
  assert.strictEqual(T.start(MT.seeded(4)), 'ok');
  const v = T.view(2);
  assert.ok(v.g.isl.filter(x => x.s === 2).every(x => x.v > 0));
  assert.ok(v.g.isl.filter(x => x.s !== 2).every(x => x.v === 0));
  assert.ok(!('back' in v.g));
  assert.ok(!JSON.stringify(v).includes('"dolphin"') || !JSON.stringify(v.g).includes('back'), 'no undersides');
  assert.deepStrictEqual(v.g.pearls, MT.PEARLS[2]);
  // at the end everything shows
  let guard = 0;
  while (!T.g.over && guard++ < 3000) { const L = T.legal(); T.act(T.g.turn, L[L.length - 1], MT.seeded(guard)); }
  assert.ok(T.g.over);
  assert.ok(T.view(2).g.isl.every(x => x.v > 0));
});

test('the rules refuse moves out of turn, out of phase, made up, or malformed', () => {
  const g = pos({ land: [A, B] });
  const x = add(g, 0, 3, 'land', A);
  assert.strictEqual(MT.act(g, 1, { k: 'done' }, R), 'turn');
  assert.strictEqual(MT.act(g, 0, null, R), 'bad');
  assert.strictEqual(MT.act(g, 0, 'done', R), 'bad');
  assert.strictEqual(MT.act(g, 0, { k: 'sink', at: B }, R), 'phase');
  assert.strictEqual(MT.act(g, 0, { k: 'step', p: 'i', id: x.id, to: at(3, 3) }, R), 'illegal');
  assert.strictEqual(MT.act(g, 0, { k: 'step', p: 'i', id: 9999, to: B }, R), 'illegal');
  assert.strictEqual(MT.act(g, 0, { k: 'undo' }, R), 'illegal');
  assert.deepStrictEqual(MT.clean({ k: 'step', p: 'i', id: '7', to: 3.9, evil: 1, __proto__: { x: 1 } }), { k: 'step', p: 'i', id: 7, to: 3 });
  ok(g, 0, { k: 'step', p: 'i', id: String(x.id), to: String(B) });
  assert.strictEqual(x.at, B);
});

test('the table: needs two players, keeps the score, survives a save and load', () => {
  const T = new MT.Table({ rules: { setup: 'quick', timer: 45 } });
  T.seats[0] = { name: 'a' };
  assert.strictEqual(T.start(MT.seeded(1)), 'few');
  T.seats[1] = { name: 'b', bot: true, bn: 3, lv: 2 };
  assert.strictEqual(T.start(MT.seeded(1)), 'ok');
  assert.strictEqual(T.view(0).seats[1].bn, 3);
  assert.strictEqual(T.view(0).seats[0].bn, -1);
  const T2 = MT.Table.fromJSON(JSON.parse(JSON.stringify(T.toJSON())));
  assert.deepStrictEqual(T2.view(1), T.view(1));
  assert.deepStrictEqual(MT.cleanRules({ setup: 'weird', timer: 7 }), { setup: 'place', timer: 0 });
  let guard = 0;
  while (!T2.g.over && guard++ < 3000) { const L = T2.legal(); T2.act(T2.g.turn, L[0], MT.seeded(guard)); }
  assert.ok(T2.g.over);
  T2.act(0, { k: 'done' });
  assert.strictEqual(T2.games, 1, 'a game counts once');
  assert.strictEqual(T2.wins.reduce((a, b) => a + b, 0), T2.g.res.win.length);
});

// ---------- random games ----------
test('300 random games: always finish, the board always makes sense', () => {
  let games = 0, sunk = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const rnd = MT.seeded(seed);
    const T = new MT.Table({ rules: { setup: seed % 2 ? 'quick' : 'place' } });
    const n = 2 + seed % 3;
    for (let s = 0; s < n; s++) T.seats[s] = { name: 'p' + s };
    T.start(rnd);
    let guard = 0;
    while (!T.g.over && guard++ < 5000) {
      const L = T.legal();
      assert.ok(L.length, 'something to do in ' + T.g.phase);
      let a = L[Math.floor(rnd() * L.length)];
      if (a.k === 'done' && L.length > 1 && rnd() < 0.8) a = L[Math.floor(rnd() * (L.length - 1))];
      assert.strictEqual(T.act(T.g.turn, a, rnd), 'ok', JSON.stringify(a));
      const g = T.g;
      for (const b of g.boats) { assert.ok(MT.pax(g, b).length <= MT.CAP); assert.ok(b.dock ? g.k[b.at] === 'H' : g.k[b.at] === 'S'); }
      for (const x of g.isl) {
        if (x.st === 'land') assert.strictEqual(g.k[x.at], 'L');
        if (x.st === 'swim') assert.ok(g.k[x.at] === 'S' || g.k[x.at] === 'F');
        if (x.st === 'boat') { const b = MT.boatById(g, x.b); assert.ok(b && !b.dock && b.at === x.at); }
        if (x.st === 'safe') assert.strictEqual(g.k[x.at], 'H');
      }
      for (let i = 0; i < MT.N; i++) assert.ok(MT.landIsl(g, i).length <= MT.CAP);
      for (const c of g.cr) assert.strictEqual(g.k[c.at], c.k === 'crab' ? 'L' : 'S');
      assert.ok(g.cr.filter(c => c.k === 'crab').length <= 1);
    }
    assert.ok(T.g.over, 'game ' + seed + ' finished');
    assert.ok(T.g.sunk <= T.g.total);
    const total = T.g.res.rows.reduce((p, r) => p + r.of, 0);
    assert.strictEqual(total, T.g.isl.length);
    games++; sunk += T.g.sunk;
  }
  console.log('      ', games, 'games, on average', (sunk / games).toFixed(1), 'tiles sunk');
});

test('bots of every level finish games using only what a player can see', () => {
  let calls = 0, slow = 0;
  for (let gi = 0; gi < 12; gi++) {
    const rnd = MT.seeded(700 + gi), n = 2 + gi % 3;
    const T = new MT.Table({ rules: { setup: gi % 2 ? 'quick' : 'place' } });
    for (let s = 0; s < n; s++) T.seats[s] = { name: 'b' + s, bot: true, lv: 1 + (s + gi) % 3 };
    T.start(rnd);
    let guard = 0;
    while (!T.g.over && guard++ < 4000) {
      const s = T.g.turn, v = T.view(s);
      const t0 = Date.now();
      // half the time from the table's view, half from just the game part, as the page passes it
      const a = AI.decide(guard % 2 ? v : v.g, T.seats[s].lv, rnd);
      if (Date.now() - t0 > 1500) slow++;
      calls++;
      assert.strictEqual(T.act(s, a, rnd), 'ok', 'bot move ' + JSON.stringify(a) + ' in ' + T.g.phase);
    }
    assert.ok(T.g.over);
  }
  assert.ok(slow === 0, slow + ' slow bot moves');
  console.log('      ', calls, 'bot decisions');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
