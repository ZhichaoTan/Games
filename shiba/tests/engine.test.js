// The rules, checked on hand-made wells:  node shiba/tests/engine.test.js
globalThis.window = globalThis;
require('../src/engine.js');
const SB = globalThis.SB, { W, H, TOP, BUB, FACE } = SB;
let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('FAIL', msg); } }
function eq(a, b, msg) { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) pass++; else { fail++; console.log('FAIL', msg, '\n  got     ', A, '\n  expected', B); } }
function test(name, fn) { try { fn(); } catch (e) { fail++; console.log('FAIL (threw)', name, e.stack); } }
// a game with a ready-made well: rows is a list of strings for the bottom rows ('X' a block, '.' empty), the last one at the bottom
function well(rows, o) {
  const g = new SB.Game(Object.assign({ mode: 'versus', seed: 7 }, o));
  rows.forEach((r, i) => { const y = H - rows.length + i; for (let x = 0; x < W; x++) if (r[x] === 'X') g.board[y * W + x] = 5; });
  g.started = true;
  return g;
}
const rowStr = (g, y) => { let s = ''; for (let x = 0; x < W; x++) { const v = g.board[y * W + x] & 15; s += v === 0 ? '.' : v === BUB ? 'B' : 'X'; } return s; };
const lastEv = (g, k) => g.ev.slice().reverse().find(e => e.k === k);

test('shapes', () => {
  // each block has 4 cells in every turn, and turning four times comes back to the start
  for (let t = 1; t <= 7; t++) for (let r = 0; r < 4; r++) eq(SB.CELLS[t][r].length, 4, 'cells ' + t + r);
  eq(SB.CELLS[3][1].map(c => c.join()).sort(), ['1,0', '1,1', '1,2', '2,1'], 'T turned right points right');
  eq(SB.CELLS[1][1].map(c => c.join()).sort(), ['2,0', '2,1', '2,2', '2,3'], 'I turned right stands in its third column');
  eq(SB.CELLS[1][2].map(c => c[1]), [2, 2, 2, 2], 'I turned twice lies in its third row');
});

test('the bag', () => {
  const g = new SB.Game({ seed: 12345 });
  const seq = []; for (let i = 0; i < 70; i++) { seq.push(g.queue.shift()); g.fill(); }
  for (let k = 0; k < 10; k++) eq(seq.slice(k * 7, k * 7 + 7).sort(), [1, 2, 3, 4, 5, 6, 7], 'bag ' + k + ' has all seven');
  const g2 = new SB.Game({ seed: 12345 }); const seq2 = []; for (let i = 0; i < 70; i++) { seq2.push(g2.queue.shift()); g2.fill(); }
  eq(seq, seq2, 'the same seed deals the same blocks');
  const g3 = new SB.Game({ seed: 54321 }); const seq3 = []; for (let i = 0; i < 70; i++) { seq3.push(g3.queue.shift()); g3.fill(); }
  ok(JSON.stringify(seq) !== JSON.stringify(seq3), 'another seed deals other blocks');
});

test('spawning and moving', () => {
  const g = new SB.Game({ seed: 3 });
  g.start();
  ok(g.cur && g.cur.y === SB.SPAWN_Y + 1, 'a new block drops one row at once');
  const t = g.cur.t;
  eq(g.cur.x, SB.SPAWN_X[t], 'spawn column');
  let n = 0; while (g.left()) n++;
  ok(n >= 3 && n <= 4, 'slides to the left wall: ' + n);
  ok(!g.left(), 'stops at the wall');
  const x0 = g.cur.x; g.right(); eq(g.cur.x, x0 + 1, 'moves right');
  const y0 = g.cur.y, gy = g.ghostY();
  ok(gy > y0, 'the ghost is below');
  const s0 = g.score; g.hardDrop();
  eq(g.score - s0, 2 * (gy - y0), 'hard drop scores 2 a row');
  eq(g.stats.pieces, 1, 'one block placed');
  ok(g.cur && g.cur.t === g.ev.filter(e => e.k === 'spawn').pop().t, 'the next block comes in');
});

test('gravity and lock delay', () => {
  const g = new SB.Game({ seed: 9, mode: 'sprint' });
  g.start();
  const y0 = g.cur.y;
  g.tick(999); eq(g.cur.y, y0, 'not yet');
  g.tick(2); eq(g.cur.y, y0 + 1, 'level 1 falls a row a second');
  // put it on the floor, then keep it alive by shifting
  while (g.down()) ;
  ok(g.grounded(), 'on the floor');
  const pieces = g.stats.pieces;
  for (let i = 0; i < 14; i++) { g.tick(400); (i % 2 ? g.left() : g.right()) || (i % 2 ? g.right() : g.left()); }
  eq(g.stats.pieces, pieces, 'moving on the ground keeps it from locking');
  for (let i = 0; i < 6; i++) { g.tick(150); (i % 2 ? g.left() : g.right()) || (i % 2 ? g.right() : g.left()); }
  g.tick(500);
  eq(g.stats.pieces, pieces + 1, 'after 15 moves it locks anyway');
  // soft drop is fast
  const y1 = g.cur.y; g.setSoft(true); g.tick(100); g.setSoft(false);
  ok(g.cur.y >= y1 + 2, 'soft drop falls fast');
  eq(SB.fallSec(1), 1, 'level 1: one second a row');
  ok(SB.fallSec(10) < 0.07 && SB.fallSec(10) > 0.05, 'level 10 is quick: ' + SB.fallSec(10));
});

test('rotation kicks', () => {
  // an I standing against the left wall turns flat by kicking two columns right
  const g = well([]);
  g.cur = { t: 1, x: -2, y: 25, r: 1 };
  ok(!g.collide(1, -2, 25, 1), 'I upright at the wall fits');
  ok(g.rotate(1), 'turns');
  eq([g.cur.x, g.cur.y, g.cur.r, g.lastKick], [0, 25, 2, 2], 'I kicked to x=0');
  // a T in a corner kicks up when the floor is in the way
  const g2 = well(['XXXXXXXX..', 'XXXXXXXX..']);
  g2.cur = { t: 3, x: 7, y: 37, r: 0 };   // cells (8,37),(7,38),(8,38),(9,38): (7,38) is a block
  ok(g2.collide(3, 7, 37, 0), 'that spot is taken');
  g2.cur = { t: 3, x: 7, y: 36, r: 0 };
  ok(!g2.collide(3, 7, 36, 0), 'one row up is free');
  ok(g2.rotate(1), 'turns right');
  ok(!g2.collide(g2.cur.t, g2.cur.x, g2.cur.y, g2.cur.r), 'and fits');
  // the square turns in place (only its face moves)
  const g3 = well([]); g3.cur = { t: 2, x: 4, y: 20, r: 0 }; g3.rotate(1); eq([g3.cur.x, g3.cur.y, g3.cur.r], [4, 20, 1], 'square stays put');
  // a T with nowhere to go doesn't turn
  const g4 = well(['XXXX...XXX', 'XXXX...XXX', 'XXXX...XXX']);
  g4.cur = { t: 1, x: 3, y: 34, r: 0 };   // a flat I above a three-wide slot
  ok(!g4.collide(1, 3, 34, 0), 'flat I fits above');
});

test('T twist double', () => {
  const g = well(['.....X....', 'XXX...XXXX', 'XXXX.XXXXX']);
  g.cur = { t: 3, x: 3, y: 37, r: 3 };
  ok(!g.collide(3, 3, 37, 3), 'T pointing left sits in the slot');
  ok(g.rotate(-1), 'turns to point down');
  eq([g.cur.x, g.cur.y, g.cur.r], [3, 37, 2], 'no kick needed');
  g.hardDrop();
  const c = lastEv(g, 'clear');
  ok(c && c.n === 2 && c.ts === 'full', 'a T twist double: ' + JSON.stringify(c));
  eq(c.atk, 4, 'sends 4');
  eq(c.pts, 1200, 'scores 1200 at level 1');
  ok(g.b2b, 'starts a back-to-back');
});

test('mini T twist', () => {
  const g = well(['..........', '..........', '.XXXXXXXXX']);
  g.cur = { t: 3, x: 0, y: 37, r: 0 };
  ok(!g.collide(3, 0, 37, 0), 'T fits');
  ok(g.rotate(1), 'turns right with a kick');
  eq([g.cur.x, g.lastKick], [-1, 1], 'kicked left into the corner');
  g.hardDrop();
  const c = lastEv(g, 'clear');
  ok(c && c.n === 1 && c.ts === 'mini', 'mini T twist single: ' + JSON.stringify(c));
  eq(c.atk, 0, 'sends nothing');
  eq(c.pts, 200, 'scores 200');
});

test('a plain T drop is not a twist', () => {
  const g = well(['XXX...XXXX', 'XXXX.XXXXX', 'X.XXXXXXXX']);
  g.cur = { t: 3, x: 3, y: 20, r: 2 };
  g.hardDrop();
  const c = lastEv(g, 'clear');
  ok(c && c.n === 2 && !c.ts, 'just a double');
  eq(c.atk, 1, 'a double sends 1');
});

test('quads, back-to-back, combos, all clear', () => {
  // two quads in a row: the second sends one more
  const rows = []; for (let i = 0; i < 8; i++) rows.push('XXXXXXXXX.'); rows.push('.XXXXXXXXX');
  const g = well(rows);
  g.cur = { t: 1, x: 7, y: 20, r: 1 }; g.hardDrop();
  let c = lastEv(g, 'clear'); eq([c.n, c.atk, c.b2b, c.pc], [4, 4, false, false], 'first quad');
  g.tick(SB.CLEAR_MS + 1); g.cur = { t: 1, x: 7, y: 20, r: 1 }; g.hardDrop();
  c = lastEv(g, 'clear'); eq([c.n, c.atk, c.b2b, c.pc], [4, 5, true, false], 'second quad: one more for back-to-back');
  eq(c.pts, 1200 + 50, 'back-to-back quad scores half as much again, plus the combo');
  // emptying the well: all clear
  const gp = well(['XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.']);
  gp.cur = { t: 1, x: 7, y: 20, r: 1 }; gp.hardDrop();
  c = lastEv(gp, 'clear');
  ok(c.pc && c.atk === SB.PC_SEND, 'all clear sends ' + c.atk);
  eq(c.pts, 800 + 2000, 'quad + all clear points');
  // combos: three doubles in a row with squares
  const g2 = well(['XXXXXXXX..', 'XXXXXXXX..', 'XXXXXXXX..', 'XXXXXXXX..', 'XXXXXXXX..', 'XXXXXXXX..', 'XXXXXXXXX.']);
  const sends = [];
  for (let i = 0; i < 3; i++) { g2.cur = { t: 2, x: 8, y: 20, r: 0 }; g2.hardDrop(); sends.push(lastEv(g2, 'clear').atk); g2.tick(SB.CLEAR_MS + 1); }
  eq(sends, [1, 1, 2], 'doubles send 1, 1, then 2 with the combo');
  eq(g2.combo, 2, 'combo count');
  g2.cur = { t: 2, x: 0, y: 20, r: 0 }; g2.hardDrop();
  eq(g2.combo, -1, 'a block that clears nothing ends the combo');
  // a single after a quad ends the back-to-back
  const g3 = well(['XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.', '.XXXXXXXXX']);
  g3.cur = { t: 1, x: 7, y: 20, r: 1 }; g3.hardDrop(); g3.tick(SB.CLEAR_MS + 1);
  ok(g3.b2b, 'quad starts it');
  g3.cur = { t: 1, x: 7, y: 20, r: 1 }; g3.hardDrop();
  c = lastEv(g3, 'clear'); ok(c.n === 1 && !g3.b2b, 'a single ends it');
});

test('bubble rows come in, and clears cancel them', () => {
  const g = well([]);
  g.addBubbles(3, 6);
  eq(g.pendingRows(), 3, 'three waiting');
  g.cur = { t: 2, x: 0, y: 20, r: 0 }; g.hardDrop();
  eq(g.height(), 2, 'not ready yet: the square lands, nothing comes in');
  g.tick(SB.BUBBLE_MS);
  eq(g.readyRows(), 3, 'ready after a moment');
  g.cur = { t: 2, x: 4, y: 20, r: 0 }; g.hardDrop();
  eq(g.height(), 5, 'in they come under the stack');
  for (let y = H - 3; y < H; y++) eq(rowStr(g, y), 'BBBBBB.BBB', 'bubble row with the gap in column 6');
  eq(lastEv(g, 'bubbles').n, 3, 'event');
  // more than 8 at once: 8 now, the rest on the next block
  const g2 = well([]); g2.addBubbles(11, 2); g2.tick(SB.BUBBLE_MS);
  g2.cur = { t: 2, x: 4, y: 20, r: 0 }; g2.hardDrop();
  eq(g2.pendingRows(), 3, 'eight came in, three wait');
  // a clear cancels waiting rows before anything is sent
  const g3 = well(['XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.']);
  g3.addBubbles(3);
  g3.cur = { t: 1, x: 7, y: 20, r: 1 }; g3.hardDrop();
  const c = lastEv(g3, 'clear');
  eq([c.atk, c.cancel, c.send, g3.pendingRows()], [SB.PC_SEND, 3, SB.PC_SEND - 3, 0], 'quad + all clear: 3 cancelled, the rest sent');
  // being pushed over the top ends the game
  const g4 = well([]); for (let y = 2; y < H; y++) for (let x = 0; x < W; x++) if (x !== y % W) g4.board[y * W + x] = 1;
  g4.addBubbles(4); g4.pending[0].t = 0; g4.cur = null;
  g4.letBubblesIn();
  ok(g4.over && g4.why === 'bubbles', 'pushed over the top: ' + g4.why);
});

test('topping out', () => {
  const g = new SB.Game({ seed: 4 });
  for (let y = TOP - 3; y < H; y++) for (let x = 0; x < W; x++) if (x !== 9) g.board[y * W + x] = 1;
  g.start();
  ok(g.over && g.why === 'blockout', 'no room for a new block: ' + g.why);
  // a block locking entirely above the visible well
  const g2 = new SB.Game({ seed: 4 });
  for (let y = TOP; y < H; y++) for (let x = 0; x < W; x++) if (x !== y % W) g2.board[y * W + x] = 1;
  g2.started = true; g2.cur = { t: 2, x: 0, y: TOP - 3, r: 0 };
  g2.hardDrop();
  ok(g2.over && g2.why === 'lockout', 'locked out: ' + g2.why);
});

test('hold', () => {
  const g = new SB.Game({ seed: 77 });
  g.start();
  const a = g.cur.t, b = g.queue[0];
  ok(g.hold(), 'first hold');
  eq([g.holdT, g.cur.t], [a, b], 'held the first, the next one came in');
  ok(!g.hold(), 'only once per block');
  g.hardDrop();
  const c = g.cur.t;
  ok(g.hold(), 'hold again after a lock');
  eq([g.holdT, g.cur.t, g.cur.r], [c, a, 0], 'swapped back, standing the right way up');
});

test('modes end', () => {
  const g = well(['XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.'], { mode: 'sprint' });
  g.lines = 38;
  g.cur = { t: 1, x: 7, y: 20, r: 1 }; g.hardDrop();
  ok(g.over && g.won && g.why === 'done', 'sprint: 40 rows done');
  const u = new SB.Game({ mode: 'ultra', seed: 2 }); u.start();
  for (let i = 0; i < 500 && !u.over; i++) { u.tick(250); u.board.fill(0); }
  ok(u.over && u.why === 'time' && u.time === SB.ULTRA_MS, 'ultra: time up after two minutes: ' + u.why + ' ' + u.time);
  const m = well(['XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.'], { mode: 'marathon' });
  m.lines = 8; m.cur = { t: 1, x: 7, y: 20, r: 1 }; m.hardDrop();
  eq(m.level, 2, 'marathon: level 2 after 10 rows');
  const v = new SB.Game({ mode: 'versus', seed: 2 }); v.start();
  for (let i = 0; i < 40 * 4; i++) { v.tick(250); if (v.cur && v.cur.y > 22) v.hardDrop(); if (v.over) break; }
  ok(v.level >= 2 || v.over, 'battle: speeds up every 30 s');
});

test('points', () => {
  const g = well(['XXXXXXXXX.'], { mode: 'marathon', level: 3 });
  g.level = 3;
  g.cur = { t: 1, x: 7, y: 30, r: 1 };
  const s0 = g.score; g.hardDrop();
  const c = lastEv(g, 'clear');
  eq(c.n, 1, 'a single');
  eq(g.score - s0, 100 * 3 + 2 * (36 - 30), 'single at level 3 plus the drop');
});

test('save and restore', () => {
  const g = new SB.Game({ mode: 'marathon', seed: 99 }); g.start();
  const rnd = { s: 5 };
  const acts = [];
  for (let i = 0; i < 300; i++) acts.push(Math.floor(SB.rnd(rnd) * 7));
  const play = (gm, from, to) => { for (let i = from; i < to && !gm.over; i++) { const a = acts[i]; if (a === 0) gm.left(); else if (a === 1) gm.right(); else if (a === 2) gm.rotate(1); else if (a === 3) gm.rotate(-1); else if (a === 4) gm.hardDrop(); else if (a === 5) gm.hold(); else gm.tick(120); } };
  play(g, 0, 150);
  g.addBubbles(2, 3);
  const j = JSON.parse(JSON.stringify(g.toJSON()));
  const h = SB.Game.fromJSON(j);
  play(g, 150, 300); play(h, 150, 300);
  eq(Array.from(h.board), Array.from(g.board), 'same well after the same moves');
  eq([h.score, h.lines, h.stats.pieces, h.queue.slice(0, 5)], [g.score, g.lines, g.stats.pieces, g.queue.slice(0, 5)], 'same score, rows, blocks and queue');
  let bad = 0; try { SB.Game.fromJSON({ v: 1, board: 'xx' }); } catch (e) { bad = 1; }
  ok(bad, 'a broken save is refused');
});

test('snapshots', () => {
  const g = well(['XXXXXXXXX.', 'XXXX.XXXXX']); g.cur = { t: 3, x: 3, y: 30, r: 0 };
  const s = g.snap();
  eq(s.b.length, 220, '22 rows of 10');
  const rows = SB.unsnap(s.b);
  eq(rows.length, 22, 'unsnap gives 22 rows');
  eq(rows[21].map(v => (v ? 'X' : '.')).join(''), 'XXXX.XXXXX', 'bottom row');
  eq(s.p, [3, 3, 30 - (TOP - 2), 0], 'the falling block');
  eq(SB.unsnap('zz').length, 22, 'junk gives an empty picture');
  eq(SB.unsnap(null).length, 22, 'nothing gives an empty picture');
  const f = new SB.Game({ seed: 3 }); f.start(); f.hardDrop();
  const faces = SB.unsnap(f.snap().b).flat().filter(v => v & SB.FACE).length;
  eq(faces, 1, 'the face of a placed block comes along');
});

test('random play never breaks the well', () => {
  const r = { s: 2024 };
  for (let game = 0; game < 40; game++) {
    const g = new SB.Game({ mode: 'versus', seed: game * 31 + 1 }); g.start();
    for (let i = 0; i < 4000 && !g.over; i++) {
      const a = SB.rnd(r);
      if (a < 0.2) g.left(); else if (a < 0.4) g.right(); else if (a < 0.55) g.rotate(SB.rnd(r) < 0.5 ? 1 : -1);
      else if (a < 0.62) g.hardDrop(); else if (a < 0.64) g.hold(); else if (a < 0.66) g.addBubbles(1 + Math.floor(SB.rnd(r) * 4));
      else g.tick(16 + SB.rnd(r) * 60);
      if (g.cur && g.collide(g.cur.t, g.cur.x, g.cur.y, g.cur.r)) { fail++; console.log('FAIL the falling block overlaps the well', game, i); return; }
    }
    for (let i = 0; i < W * H; i++) { const v = g.board[i]; if (!(v === 0 || v === BUB || ((v & 15) >= 1 && (v & 15) <= 7))) { fail++; console.log('FAIL bad cell', v); return; } }
  }
  pass++;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
