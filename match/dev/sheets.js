// The sheets and result cards in both looks: the theme picker, a level's card, the menu, the rules, a level won and lost,
// Time Rush over, and a battle's results (the round is cut short).   node match/dev/sheets.js [zh|en]
const L = require('./lib');
const lang = process.argv[2] || 'zh';
const short = p => p.evaluate(() => { const g = TTAPP.U.g; g.timeMs = g.time + 600; const b = TTAPP.S.botsNow && TTAPP.S.botsNow(); if (b) for (const k in b) b[k].g.timeMs = b[k].g.time + 600; });
(async () => {
  const b = await L.launch();
  const pages = [];
  for (const theme of ['pal', 'mm']) {
    const t = `${theme}-${lang}`;
    const lob = await L.open(b, { lang, query: `?theme=${theme}` }); pages.push(lob);
    await lob.evaluate(() => TTAPP.showThemes()); await lob.waitForTimeout(500);
    await L.shot(lob, `sheet-themes-${t}`);
    const map = await L.open(b, { lang, query: `?theme=${theme}&autosolo=map` }); pages.push(map);
    await map.evaluate(() => document.querySelector('.node[data-n="1"]').click()); await map.waitForTimeout(500);
    await L.shot(map, `sheet-level-${t}`);
    const g = await L.open(b, { lang, query: `?theme=${theme}&autosolo=levels&n=12` }); pages.push(g);
    await L.waitFor(g, () => TTAPP.U.g && TTAPP.U.g.started && !TTAPP.U.cd, null, 8000);
    await g.evaluate(() => { const b = document.getElementById('tutOk'); if (b) b.click(); });
    await g.evaluate(() => TTAPP.showMenu()); await g.waitForTimeout(500);
    await L.shot(g, `sheet-menu-${t}`);
    await g.evaluate(() => TTAPP.showRules()); await g.waitForTimeout(500);
    await L.shot(g, `sheet-rules-${t}`);
    await g.evaluate(() => document.querySelector('#sheet [data-close]').click()); await g.waitForTimeout(300);
    // win: a big score and the goals done
    await g.evaluate(() => { const g = TTAPP.U.g; for (const x of g.goals) x.have = x.n; g.score = 99999; TTAPP.V.score = g.score; TTAPP.S.onOver(g, { won: true }); });
    await g.waitForTimeout(2200);
    await L.shot(g, `result-level-won-${t}`);
    const g2 = await L.open(b, { lang, query: `?theme=${theme}&autosolo=levels&n=3` }); pages.push(g2);
    await L.waitFor(g2, () => TTAPP.U.g && TTAPP.U.g.started && !TTAPP.U.cd, null, 8000);
    await g2.evaluate(() => { const g = TTAPP.U.g; TTAPP.S.onOver(g, { won: false }); });
    await g2.waitForTimeout(2200);
    await L.shot(g2, `result-level-lost-${t}`);
    const r = await L.open(b, { lang, query: `?theme=${theme}&autosolo=rush` }); pages.push(r);
    await L.waitFor(r, () => TTAPP.U.g && TTAPP.U.g.started && !TTAPP.U.cd, null, 8000);
    for (let i = 0; i < 3; i++) await L.move(r, 4);
    await short(r);
    await L.waitFor(r, () => document.getElementById('sheet').classList.contains('on'), null, 15000);
    await r.waitForTimeout(800);
    await L.shot(r, `result-rush-${t}`);
    const v = await L.open(b, { lang, query: `?theme=${theme}&autosolo=versus&foes=3&lv=4` }); pages.push(v);
    await L.waitFor(v, () => TTAPP.U.g && TTAPP.U.g.started && !TTAPP.U.cd, null, 10000);
    for (let i = 0; i < 4; i++) await L.move(v, 4);
    await short(v);
    await L.waitFor(v, () => document.getElementById('sheet').classList.contains('on'), null, 20000);
    await v.waitForTimeout(800);
    await L.shot(v, `result-battle-${t}`);
  }
  process.exitCode = L.report(...pages);
  await b.close();
})();
