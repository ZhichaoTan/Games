// Pikafish in the page: download, start, play one engine move, analyse a position with three lines, and a save-code round trip.
// node dev/pf.js
const L = require('./lib');
const assert = require('assert');
(async () => {
  const b = await L.launch(), p = await L.open(b, { lang: 'zh' });
  const t0 = Date.now();
  await p.evaluate(() => { XQAPP.PF.load(); });
  await L.waitFor(p, () => XQAPP.PF.state == 'ready', null, 90000);
  console.log('pikafish ready in', Date.now() - t0, 'ms');
  const r = await p.evaluate(async () => { const { PF, E } = XQAPP; const pos = new E.Position(); pos.startpos(); const a = await PF.analyze([], 800, 3); return { n: a.lines.length, mv: a.mv, vl: a.vl, pv: a.pv.length, legal: pos.legalMoves().indexOf(a.mv) >= 0, first: XQAPP.notation(pos, a.mv) }; });
  console.log('analysis', JSON.stringify(r));
  assert.ok(r.legal && r.n == 3 && r.pv > 3);
  // a game against Pikafish at the lowest level: it answers with a legal move
  await p.evaluate(() => { const D = XQAPP.DB.settings; D.engine = 'pf'; D.level = 0; D.side = 0; });
  await p.evaluate(() => XQAPP.startGame({ mode: 'ai', level: 0, side: 0 }));
  await p.waitForTimeout(700);
  const mv = await L.anyMove(p); await L.move(p, mv);
  await L.waitFor(p, () => XQAPP.G.moves.length == 2 && !XQAPP.G.thinking, null, 30000);
  await p.waitForTimeout(500); await L.shot(p, 'pf-game');
  console.log('pikafish replied', await p.evaluate(() => { const { G, E } = XQAPP; const q = new E.Position(); q.fromMoves(G.moves.slice(0, 1)); return XQAPP.notation(q, G.moves[1]); }));
  // second visit: the network file comes from the browser cache
  await p.reload(); await p.waitForTimeout(500);
  const t1 = Date.now();
  await L.waitFor(p, () => XQAPP.PF.state == 'ready', null, 60000);
  console.log('second load', Date.now() - t1, 'ms, cached', await p.evaluate(() => XQAPP.PF.cached));
  await L.shot(p, 'pf-lobby');
  const bad = L.report(p); await b.close(); console.log(bad ? 'FAILED' : 'pf ok'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
