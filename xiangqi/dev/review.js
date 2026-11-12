// Screenshots of the review and explore screens on a tall phone, from a generated game: node dev/review.js [zh|en] [w] [h]
const L = require('./lib');
(async () => {
  const [lang = 'zh', w = 390, h = 1500] = process.argv.slice(2), tag = `${lang}-${w}`;
  const b = await L.launch(), p = await L.open(b, { lang, w: +w, h: +h });
  await p.evaluate(() => {
    const { E } = XQAPP, pos = new E.Position(); pos.startpos(); const moves = [];
    for (let i = 0; i < 46 && !pos.isMate(); i++) { const s = new E.Search(pos); const r = i % 9 == 5 ? { mv: pos.legalMoves()[i % pos.legalMoves().length] } : s.think({ timeMs: 40 }); moves.push(r.mv); pos.makeMove(r.mv); }
    XQAPP.openReview({ id: 1, t: Date.now(), mode: 'ai', level: 3, side: 0, moves, base: 0, result: 'loss', winner: 1, reason: 'resign', hints: 1, undos: 2, engine: 'muyi' });
  });
  await L.waitFor(p, () => { const R = XQAPP.R; return R.ana.filter(Boolean).length >= R.moves.length + 1; }, null, 100000);
  await p.waitForTimeout(500);
  for (const t of ['chart', 'ana', 'moves', 'report']) {
    await p.evaluate(t => document.querySelector(`#ptabs [data-tab="${t}"]`).click(), t); await p.waitForTimeout(300);
    if (t == 'ana') { for (let i = 0; i < 14; i++) await L.click(p, 'rPrev'); await p.waitForTimeout(2500); }
    await L.shot(p, `rv-${t}-${tag}`);
  }
  await L.click(p, 'rvExplore'); await p.waitForTimeout(3500); await L.shot(p, `rv-explore-${tag}`);
  const bad = L.report(p); await b.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
