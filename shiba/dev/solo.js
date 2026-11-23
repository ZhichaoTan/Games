// Solo games through the lobby, played with real key presses (the strongest bot picks each move):
// Sprint 40 to the finish and its record, Marathon with pause and resume, an unfinished game picked up again after a
// reload, Two Minutes running out, and a battle against bots won by the player.
// node shiba/dev/solo.js [zh|en] [width] [height]
const L = require('./lib');
const assert = require('assert');
(async () => {
  const [lang = 'zh', w = 390, h = 844] = process.argv.slice(2);
  const tag = `${lang}-${w}`;
  const b = await L.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: +w < 700, isMobile: +w < 700 });
  const p = await L.open(b, { lang, ctx });
  await L.shot(p, `lobby-${tag}`);
  const pick = async m => {
    await p.evaluate(() => document.querySelector('#tabs [data-tab="solo"]').click());
    await p.evaluate(m => document.querySelector(`#modes [data-m="${m}"]`).click(), m);
    await L.click(p, 'btnSolo');
    await L.waitFor(p, () => SBAPP.screen === 'game' && SBAPP.U.g && SBAPP.U.g.started && !SBAPP.U.cd, null, 8000);
  };
  const play = async (until, ms = 120000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = await L.me(p); if (!m || m.over || until(m)) return m; if (!(await L.keyMove(p, { lv: 4 }))) await p.waitForTimeout(40); } throw new Error('took too long'); };
  const results = async name => { await L.waitFor(p, () => !!document.getElementById('rsAgain'), null, 6000); await p.waitForTimeout(350); await L.shot(p, name); };

  // ----- Sprint 40 to the end: a time and a record -----
  await pick('sprint');
  await p.waitForTimeout(300); await L.shot(p, `sprint-start-${tag}`);
  const t0 = Date.now();
  await play(() => false, 180000);
  const sp = await L.me(p);
  assert.ok(sp.over && sp.won && sp.lines >= 40, 'sprint did not finish: ' + JSON.stringify(sp));
  await results(`sprint-result-${tag}`);
  const best = await p.evaluate(() => SBAPP.BEST.sprint);
  console.log('sprint: 40 rows in', (best / 1000).toFixed(1), 's of game time (', Math.round((Date.now() - t0) / 1000), 's real), pieces', sp.pieces);
  assert.ok(best > 0, 'no sprint record');
  assert.ok(await p.evaluate(() => /New best|新纪录/.test(document.querySelector('#sheet .t3') ? document.querySelector('#sheet .t3').textContent : '')), 'no new-best line');
  // Play again starts a fresh sprint
  await L.click(p, 'rsAgain');
  await L.waitFor(p, () => SBAPP.U.g && SBAPP.U.g.started && SBAPP.U.g.lines === 0 && !SBAPP.U.cd, null, 8000);
  await play(m => m.pieces >= 6, 20000);
  // the menu: back to the lobby keeps the unfinished game
  await L.click(p, 'btnMenu');
  await L.waitFor(p, () => !!document.getElementById('mLeave'));
  assert.strictEqual(await p.evaluate(() => SBAPP.U.paused), true, 'the menu should pause a solo game');
  await p.waitForTimeout(250); await L.shot(p, `menu-${tag}`);
  await p.evaluate(() => document.getElementById('mLeave').click());
  await p.waitForNavigation({ timeout: 8000 }).catch(() => {});
  await L.waitFor(p, () => SBAPP.screen === 'lobby' && !document.getElementById('resumeBox').hidden, null, 8000);
  await L.shot(p, `lobby-resume-${tag}`);
  await p.evaluate(() => document.querySelector('#resumeBox [data-x="sb_solo"]').click());
  assert.strictEqual(await p.evaluate(() => document.getElementById('resumeBox').hidden), true);
  // the lobby shows the record on the Sprint card
  assert.ok(await p.evaluate(() => /\d/.test(document.querySelector('#modes [data-m="sprint"] small').textContent)), 'no record on the sprint card');

  // ----- Marathon: pause with Esc, carry on, then the page is reloaded and the game is picked up again -----
  await pick('marathon');
  await play(m => m.lines >= 8, 60000);
  await p.keyboard.press('Escape');
  await L.waitFor(p, () => SBAPP.U.paused);
  await p.waitForTimeout(200); await L.shot(p, `paused-${tag}`);
  const before = await p.evaluate(() => ({ score: SBAPP.U.g.score, lines: SBAPP.U.g.lines, b: SBAPP.U.g.snap().b }));
  await p.waitForTimeout(1500);
  assert.strictEqual(await p.evaluate(() => SBAPP.U.g.snap().b), before.b, 'the well moved while paused');
  await p.keyboard.press('Escape');
  await L.waitFor(p, () => !SBAPP.U.paused && !SBAPP.U.cd, null, 5000);
  await play(m => m.lines >= before.lines + 4, 60000);
  await p.keyboard.press('KeyP');
  await L.waitFor(p, () => SBAPP.U.paused);
  const mid = await p.evaluate(() => ({ score: SBAPP.U.g.score, lines: SBAPP.U.g.lines, b: SBAPP.U.g.snap().b }));
  await p.reload(); await p.waitForTimeout(500);
  await L.waitFor(p, () => SBAPP.screen === 'lobby' && !!document.querySelector('#resumeBox [data-r="solo"]'), null, 8000);
  await p.evaluate(() => document.querySelector('#resumeBox [data-r="solo"]').click());
  await L.waitFor(p, () => SBAPP.screen === 'game' && SBAPP.U.paused, null, 5000);
  const back = await p.evaluate(() => ({ score: SBAPP.U.g.score, lines: SBAPP.U.g.lines, b: SBAPP.U.g.snap().b }));
  assert.deepStrictEqual(back, mid, 'the game came back different');
  console.log('marathon: paused, resumed, reloaded and picked up at', back.lines, 'rows,', back.score, 'points');
  await p.keyboard.press('Space');
  await L.waitFor(p, () => !SBAPP.U.paused && !SBAPP.U.cd, null, 5000);
  // drop straight down to the end of the game
  for (let i = 0; i < 300 && !(await L.me(p)).over; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(30); }
  assert.ok((await L.me(p)).over, 'marathon never ended');
  await results(`marathon-result-${tag}`);
  assert.ok(await p.evaluate(() => SBAPP.BEST.marathon > 0), 'no marathon record');
  await L.click(p, 'rsLobby');
  await p.waitForNavigation({ timeout: 8000 }).catch(() => {});
  await L.waitFor(p, () => SBAPP.screen === 'lobby' && document.getElementById('resumeBox').hidden, null, 8000);

  // ----- Two Minutes: the clock runs out -----
  await pick('ultra');
  await play(m => m.pieces >= 10, 30000);
  await p.evaluate(() => { SBAPP.U.g.time = 119400; });
  await L.waitFor(p, () => SBAPP.U.g.over, null, 6000);
  assert.strictEqual(await p.evaluate(() => SBAPP.U.g.why), 'time');
  await results(`ultra-result-${tag}`);
  await L.click(p, 'rsLobby');
  await p.waitForNavigation({ timeout: 8000 }).catch(() => {});
  await L.waitFor(p, () => SBAPP.screen === 'lobby', null, 8000);

  // ----- vs Bots: one Rookie, played until it's out -----
  await p.evaluate(() => { SBAPP.P.foes = 1; SBAPP.P.bot = 1; });
  await pick('versus');
  await p.waitForTimeout(200);
  const vt0 = Date.now();
  while (Date.now() - vt0 < 240000) {
    const done = await p.evaluate(() => { const v = SBAPP.S.view; return v && v.rd && v.rd.phase === 'over'; });
    if (done) break;
    if (!(await L.keyMove(p, { lv: 4 }))) await p.waitForTimeout(40);
  }
  const rd = await p.evaluate(() => { const v = SBAPP.S.view; return { phase: v.rd.phase, win: v.rd.win, st: v.rd.st }; });
  console.log('vs bots:', JSON.stringify(rd));
  assert.strictEqual(rd.phase, 'over');
  await L.waitFor(p, () => !!document.getElementById('resFoot'), null, 6000);
  await p.waitForTimeout(350); await L.shot(p, `versus-result-${tag}`);
  // Next round
  await p.evaluate(() => document.querySelector('#resFoot .btn.gold').click());
  await L.waitFor(p, () => SBAPP.S.view.rd.n === 2 && SBAPP.U.g && SBAPP.U.g.started && !SBAPP.U.cd, null, 8000);
  await play(m => m.pieces >= 5, 20000);
  const bad = L.report(p);
  await b.close();
  console.log(bad ? 'ERRORS' : 'solo check passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
