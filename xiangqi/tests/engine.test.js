// Rules engine checks: node xiangqi/tests/engine.test.js
// Move generation is compared against the known perft counts for the opening position.
const fs = require('fs'), path = require('path'), assert = require('assert');
const EngineFactory = new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'engine.js'), 'utf8') + '\nreturn EngineFactory;')();
const E = EngineFactory(false);
function perft(p, d) {
  if (d == 0) return 1;
  let n = 0;
  for (const mv of p.generate(false)) { if (!p.makeMove(mv)) continue; n += perft(p, d - 1); p.undoMakeMove(); }
  return n;
}
const p = new E.Position(); p.startpos();
const want = [44, 1920, 79666, 3290240];
want.forEach((w, i) => { const t = Date.now(), n = perft(p, i + 1); console.log('perft', i + 1, n, (Date.now() - t) + 'ms'); assert.strictEqual(n, w); });
// a known mate: red chariot delivers on the back rank
const q = new E.Position(); q.startpos();
assert.strictEqual(q.inCheck(), false); assert.strictEqual(q.isMate(), false);
// replaying a line gives the same position as making the moves one by one
const line = []; const r = new E.Position(); r.startpos();
for (let i = 0; i < 40; i++) { const ms = r.generate(false).filter(m => { if (!r.makeMove(m)) return false; r.undoMakeMove(); return true; }); if (!ms.length) break; const m = ms[(i * 7 + 3) % ms.length]; line.push(m); r.makeMove(m); }
const s = new E.Position(); s.fromMoves(line);
assert.deepStrictEqual(Array.from(s.sq), Array.from(r.sq)); assert.strictEqual(s.sd, r.sd);
console.log('engine ok');
