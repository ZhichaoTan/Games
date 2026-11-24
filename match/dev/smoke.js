// Quick look: the lobby in both looks and both languages, the map, a level a few moves in, Time Rush, and a battle with bots.
// node match/dev/smoke.js   (screenshots go to match/dev/shots/)
const L = require('./lib');
(async () => {
  const b = await L.launch();
  const pages = [];
  for (const theme of ['pal', 'mm']) for (const lang of ['zh', 'en']) {
    const p = await L.open(b, { lang, query: '?theme=' + theme }); pages.push(p);
    await p.waitForTimeout(700);
    await L.shot(p, `lobby-${theme}-${lang}`);
  }
  for (const theme of ['pal', 'mm']) {
    const m = await L.open(b, { lang: 'zh', query: `?theme=${theme}&autosolo=map` }); pages.push(m);
    await m.waitForTimeout(700);
    await L.shot(m, `map-${theme}`);
    const g = await L.open(b, { lang: 'zh', query: `?theme=${theme}&autosolo=levels&n=7` }); pages.push(g);
    await L.waitFor(g, () => TTAPP.U.g && TTAPP.U.g.started && !TTAPP.U.cd, null, 8000);
    await g.evaluate(() => { const b = document.getElementById('tutOk'); if (b) b.click(); });
    for (let i = 0; i < 4; i++) await L.move(g, 4);
    await g.waitForTimeout(500);
    await L.shot(g, `level-${theme}`);
    console.log(theme, 'level', JSON.stringify(await L.me(g)));
    const r = await L.open(b, { lang: 'en', query: `?theme=${theme}&autosolo=rush` }); pages.push(r);
    await L.waitFor(r, () => TTAPP.U.g && TTAPP.U.g.started && !TTAPP.U.cd, null, 8000);
    for (let i = 0; i < 4; i++) await L.move(r, 4);
    await r.waitForTimeout(300);
    await L.shot(r, `rush-${theme}`);
    console.log(theme, 'rush', JSON.stringify(await L.me(r)));
    const v = await L.open(b, { lang: 'zh', query: `?theme=${theme}&autosolo=versus&foes=3&lv=3` }); pages.push(v);
    await L.waitFor(v, () => TTAPP.U.g && TTAPP.U.g.started && !TTAPP.U.cd, null, 10000);
    for (let i = 0; i < 6; i++) await L.move(v, 4);
    await v.waitForTimeout(1500);
    await L.shot(v, `versus-${theme}`);
    console.log(theme, 'versus', JSON.stringify(await L.me(v)), JSON.stringify(await v.evaluate(() => TTAPP.S.view.rd.st)));
  }
  process.exitCode = L.report(...pages);
  await b.close();
})();
