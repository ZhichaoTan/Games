// Quick look: the lobby in both languages, a practice game a few turns in. node dev/smoke.js
const L = require('./lib');
(async () => {
  const b = await L.launch();
  const pages = [];
  for (const lang of ['zh', 'en']) {
    const p = await L.open(b, { lang }); pages.push(p);
    await p.waitForTimeout(600);
    await L.shot(p, `lobby-${lang}`, true);
  }
  const g = await L.open(b, { lang: 'zh', query: '?autosolo=1&n=4' }); pages.push(g);
  await g.waitForTimeout(1500);
  await L.shot(g, 'game-start');
  console.log(await g.evaluate(() => { const v = MTAPP.S.view; return { phase: v.g.phase, turn: v.g.turn, me: v.me, place: v.g.place && v.g.place.i }; }));
  process.exitCode = L.report(...pages);
  await b.close();
})();
