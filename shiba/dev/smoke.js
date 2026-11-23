// Quick look: the lobby in both languages, and a Marathon game a few blocks in. node shiba/dev/smoke.js
const L = require('./lib');
(async () => {
  const b = await L.launch();
  const pages = [];
  for (const lang of ['zh', 'en']) {
    const p = await L.open(b, { lang }); pages.push(p);
    await p.waitForTimeout(600);
    await L.shot(p, `lobby-${lang}`);
  }
  const g = await L.open(b, { lang: 'zh', query: '?autosolo=marathon' }); pages.push(g);
  await L.waitFor(g, () => SBAPP.U.g && SBAPP.U.g.started && !SBAPP.U.cd, null, 8000);
  for (let i = 0; i < 8; i++) await L.keyMove(g, { lv: 4 });
  await g.waitForTimeout(400);
  await L.shot(g, 'game');
  console.log(await L.me(g));
  process.exitCode = L.report(...pages);
  await b.close();
})();
