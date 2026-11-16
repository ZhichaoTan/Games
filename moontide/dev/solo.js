// A whole practice game played by real taps on the board (and the dock buttons), against fast bots. Screenshots along the way.
//   node dev/solo.js [zh|en] [players]
const L = require('./lib');
const assert = require('assert');
(async () => {
  const lang = process.argv[2] || 'zh', n = +(process.argv[3] || 3);
  const b = await L.launch();
  const p = await L.open(b, { lang, query: `?autosolo=1&n=${n}`, ls: { mh_cd_prefs: JSON.stringify({ speed: 'fast', bot: 2, n, rules: { setup: 'place', timer: 0 } }) } });
  let shots = 0;
  const seen = {};
  // a few screenshots of each kind of moment, numbered in the order they happen
  const ctx = { snap: async name => { seen[name] = (seen[name] || 0) + 1; if (shots < 14 && seen[name] <= 2) { shots++; await L.shot(p, `solo-${lang}-${String(shots).padStart(2, '0')}-${name}`); } } };
  let guard = 0, r = '';
  while (guard++ < 3000 && (r = await L.playStep(p, ctx)) !== 'over') if (r === 'wait') await p.waitForTimeout(120);
  assert.strictEqual(r, 'over', 'the game finished');
  await p.waitForTimeout(2400);
  await L.shot(p, `solo-${lang}-result`);
  const res = await p.evaluate(() => MTAPP.S.view.g.res);
  console.log('done: my turns', ctx.turns, 'taps', ctx.taps, 'result', JSON.stringify(res.rows.map(r => [r.s, r.pts, r.saved + '/' + r.of])), 'why', res.why);
  // play again from the result sheet
  await p.evaluate(() => [...document.querySelectorAll('#resFoot .btn')][0].click());
  await L.waitFor(p, () => MTAPP.S.view.g && !MTAPP.S.view.g.over);
  console.log('again ok, gid', await p.evaluate(() => MTAPP.S.room.gid));
  process.exitCode = L.report(p);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
