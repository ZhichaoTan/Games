// Plays a game against the computer by tapping the board, then walks through the result sheet, review and explore.
// node dev/solo.js [zh|en] [width] [height]
const L = require('./lib');
(async () => {
  const [lang = 'zh', w = 390, h = 844] = process.argv.slice(2);
  const tag = `${lang}-${w}`;
  const b = await L.launch(), p = await L.open(b, { lang, w: +w, h: +h });
  await p.evaluate(() => { XQAPP.DB.settings.level = 1; });
  await L.shot(p, `lobby-${tag}`);
  await L.click(p, 'btnSolo'); await p.waitForTimeout(900);
  await L.shot(p, `game0-${tag}`);
  let n = 0;
  for (let i = 0; i < 14; i++) {
    await L.waitFor(p, () => { const G = XQAPP.G; return G.over || (!G.thinking && G.pos.sd == G.side); }, null, 20000);
    if (await p.evaluate(() => XQAPP.G.over)) break;
    const mv = await L.anyMove(p); if (!mv) break;
    await L.move(p, mv); n++;
    await p.waitForTimeout(350);
  }
  await L.waitFor(p, () => { const G = XQAPP.G; return G.over || (!G.thinking && G.pos.sd == G.side); }, null, 20000);
  console.log('my moves', n, 'plies', await p.evaluate(() => XQAPP.G.moves.length));
  await p.waitForTimeout(500); await L.shot(p, `game1-${tag}`);
  // a selected piece with its legal moves
  const mv = await L.anyMove(p); await L.tap(p, mv & 255); await p.waitForTimeout(250); await L.shot(p, `game-sel-${tag}`); await L.tap(p, mv & 255);
  // hint
  await L.click(p, 'tHint'); await p.waitForTimeout(2500); await L.shot(p, `game-hint-${tag}`);
  // explore inside the game
  await L.click(p, 'tExplore'); await p.waitForTimeout(600); await L.shot(p, `game-ex-${tag}`);
  await L.click(p, 'eQuit'); await p.waitForTimeout(300);
  // menu and chat sheets
  await L.click(p, 'btnMenu'); await p.waitForTimeout(450); await L.shot(p, `menu-${tag}`);
  await p.evaluate(() => document.querySelector('#sheet [data-close]').click()); await p.waitForTimeout(350);
  // undo
  const before = await p.evaluate(() => XQAPP.G.moves.length);
  await L.click(p, 'tUndo'); await p.waitForTimeout(600);
  console.log('undo', before, '->', await p.evaluate(() => XQAPP.G.moves.length));
  // resign
  await L.click(p, 'tResign'); await p.waitForTimeout(400); await L.shot(p, `resign-${tag}`);
  await p.evaluate(() => document.querySelector('#ovCard .btn.danger, #ovCard .btn.primary, #ovCard button:last-child').click());
  await p.waitForTimeout(1600); await L.shot(p, `result-${tag}`);
  // review
  await p.evaluate(() => { const b = document.querySelector('#resFoot [data-x="review"]') || [...document.querySelectorAll('#resFoot button')].find(x => /复盘|Review/.test(x.textContent)); b.click(); });
  await p.waitForTimeout(800); await L.shot(p, `review0-${tag}`);
  await L.waitFor(p, () => { const R = XQAPP.R; return R.ana.filter(Boolean).length >= R.moves.length + 1; }, null, 90000);
  await p.waitForTimeout(600); await L.shot(p, `review1-${tag}`, true);
  for (const t of ['ana', 'moves', 'report']) {
    await p.evaluate(t => document.querySelector(`#ptabs [data-tab="${t}"]`).click(), t); await p.waitForTimeout(350);
    if (t == 'ana') { for (let i = 0; i < 5; i++) await L.click(p, 'rNext'); await p.waitForTimeout(700); }
    await L.shot(p, `review-${t}-${tag}`, true);
  }
  // explore from the review
  await L.click(p, 'rvExplore'); await p.waitForTimeout(3200); await L.shot(p, `explore-${tag}`, true);
  await L.click(p, 'xBack'); await p.waitForTimeout(500);
  await L.click(p, 'rvBack'); await p.waitForTimeout(500); await L.shot(p, `lobby-after-${tag}`, true);
  // history and settings sheets
  await L.click(p, 'histBtn'); await p.waitForTimeout(450); await L.shot(p, `history-${tag}`);
  await p.evaluate(() => document.querySelector('#sheet [data-close]').click()); await p.waitForTimeout(350);
  await L.click(p, 'setBtn'); await p.waitForTimeout(450); await L.shot(p, `settings-${tag}`);
  await p.evaluate(() => document.querySelector('#sheet [data-close]').click()); await p.waitForTimeout(350);
  await L.click(p, 'btnRules'); await p.waitForTimeout(450); await L.shot(p, `rules-${tag}`);
  await p.evaluate(() => document.querySelector('#sheet [data-close]').click()); await p.waitForTimeout(350);
  await L.click(p, 'codeBtn'); await p.waitForTimeout(450); await L.shot(p, `code-${tag}`);
  const bad = L.report(p);
  await b.close();
  console.log(bad ? 'FAILED' : 'solo ok');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
