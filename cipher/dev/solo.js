// Plays practice games against bots by tapping the screen (the moves come from the Shark bot reading the same view),
// taking screenshots on the way: the deal, a selected tile with the number pad, a guess landing, the result sheet.
// node dev/solo.js [zh|en] [opponents] [width] [height] [rounds]
const L = require('./lib');
(async () => {
  const [lang = 'zh', opp = 1, w = 390, h = 844, rounds = 2] = process.argv.slice(2);
  const tag = `${lang}-${opp}-${w}`;
  const b = await L.launch(), p = await L.open(b, { lang, w: +w, h: +h, ls: { mh_mm_prefs: JSON.stringify({ opp: +opp, bot: 2, hints: 'exact', speed: 'fast' }) } });
  await L.shot(p, `lobby-${tag}`);
  await L.click(p, 'btnSolo');
  await p.waitForTimeout(400); await L.shot(p, `deal-${tag}`);
  let moves = 0, shots = { pad: 0, bubble: 0 }, done = 0, t0 = Date.now();
  while (done < +rounds && Date.now() - t0 < 240000) {
    const phase = await p.evaluate(() => { const v = CXAPP.UI.view; return v && v.R ? v.R.phase : ''; });
    if (phase === 'end') {
      await L.waitFor(p, () => !!document.querySelector('#sheet.on #btnNext'), null, 8000);
      await p.waitForTimeout(400);
      if (!done) await L.shot(p, `result-${tag}`);
      done++;
      if (done >= +rounds) break;
      await p.locator('#btnNext').click();
      await L.waitFor(p, () => { const v = CXAPP.UI.view; return v && v.R && v.R.phase !== 'end'; }, null, 8000);
      continue;
    }
    // a screenshot of the pad the first time it's my turn to guess
    const k = await p.evaluate(() => { const v = CXAPP.UI.view; return v && v.opt ? v.opt.k : ''; });
    if (k === 'guess' && !shots.pad) {
      const u = await p.evaluate(() => { const v = CXAPP.UI.view, R = v.R; for (const s of R.ps) if (s !== v.me) { const t = R.rows[s].find(t => !t.open); if (t) return t.u; } return 0; });
      await L.sel(p, `#opps .tile[data-u="${u}"]`).click(); await p.waitForTimeout(250);
      await L.shot(p, `pad-${tag}`); shots.pad = 1;
      await L.sel(p, `#opps .tile[data-u="${u}"]`).click(); await p.waitForTimeout(150);
    }
    const did = await L.playMove(p, 3).catch(e => { console.log('move failed', e.message.split('\n')[0]); return ''; });
    if (did) {
      moves++;
      if (did === 'guess' && !shots.bubble) { await p.waitForTimeout(450); await L.shot(p, `bubble-${tag}`); shots.bubble = 1; }
      await p.waitForTimeout(120);
    } else await p.waitForTimeout(150);
  }
  const st = await p.evaluate(() => ({ round: CXAPP.S.table().round, score: CXAPP.S.table().seats.map(x => x && x.score) }));
  console.log(tag, 'moves', moves, 'rounds done', done, JSON.stringify(st), 'secs', Math.round((Date.now() - t0) / 1000));
  const bad = L.report(p);
  await b.close();
  process.exit(bad ? 1 : 0);
})();
