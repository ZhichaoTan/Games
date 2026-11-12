// Save code: a round trip through the sheet, and a code in the earlier game's format (reasons in Chinese, no "g" field).
// node dev/code.js
const L = require('./lib');
const assert = require('assert');
const zlib = require('zlib');
(async () => {
  const b = await L.launch(), p = await L.open(b, { lang: 'zh' });
  // an earlier-format code: built here the way the old page built it (deflate-raw, base64url)
  const old = { v: 1, t: Date.now() - 864e5, settings: { level: 4, side: 1, sound: false, engine: 'pf', advPf: true },
    stats: { 4: { w: 2, d: 1, l: 3 } },
    history: [{ id: 5, t: Date.now() - 9e7, mode: 'ai', level: 4, side: 1, moves: 'h2e2h9g7h0g2', base: 0, result: 'loss', winner: 0, reason: '认输', hints: 0, undos: 1, engine: 'muyi' },
      { id: 6, t: Date.now() - 8e7, mode: 'ai', level: 4, side: 0, moves: 'h2e2zzzz', result: 'win', winner: 0, reason: '绝杀' }], current: null };
  const code = 'MYXQ1.' + zlib.deflateRawSync(Buffer.from(JSON.stringify(old))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await L.click(p, 'codeBtn'); await p.waitForTimeout(500);
  await p.evaluate(c => { document.getElementById('codeIn').value = c; document.getElementById('codeLoad').click(); }, code);
  await p.waitForTimeout(500); await L.shot(p, 'code-confirm');
  await p.evaluate(() => document.querySelector('#ovCard .btn.gold').click()); await p.waitForTimeout(500);
  let d = await p.evaluate(() => { const D = XQAPP.DB; return { s: D.settings, h: D.history.map(r => ({ n: r.moves.length, reason: r.reason, typ: typeof r.moves[0] })), stats: D.stats }; });
  console.log(JSON.stringify(d.h), JSON.stringify(d.stats));
  assert.strictEqual(d.h.length, 1, 'the record with an illegal move is dropped'); assert.strictEqual(d.h[0].n, 3); assert.strictEqual(d.h[0].reason, 'resign');
  assert.strictEqual(d.s.level, 4); assert.strictEqual(d.s.sound, false); assert.strictEqual(d.s.engine, 'muyi', 'an old code does not switch Pikafish on');
  // round trip in the current format
  await L.click(p, 'codeBtn'); await L.waitFor(p, () => document.getElementById('codeOut').value.length > 20);
  const mine = await p.evaluate(() => document.getElementById('codeOut').value);
  await p.evaluate(() => { const D = XQAPP.DB; D.history = []; D.stats = {}; D.settings.level = 0; });
  await p.evaluate(c => { document.getElementById('codeIn').value = '  ' + c.slice(0, 30) + '\n' + c.slice(30) + ' '; document.getElementById('codeLoad').click(); }, mine);
  await p.waitForTimeout(400); await p.evaluate(() => document.querySelector('#ovCard .btn.gold').click()); await p.waitForTimeout(400);
  d = await p.evaluate(() => { const D = XQAPP.DB; return { lv: D.settings.level, n: D.history.length, st: D.stats }; });
  assert.deepStrictEqual(d, { lv: 4, n: 1, st: { 4: { w: 2, d: 1, l: 3 } } });
  await L.click(p, 'histBtn'); await p.waitForTimeout(400); await L.shot(p, 'code-history');
  const bad = L.report(p); await b.close(); console.log(bad ? 'FAILED' : 'code ok'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
