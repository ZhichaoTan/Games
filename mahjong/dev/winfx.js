// 胡牌提示截图：练习模式里自己按 AI 打，能胡的时候（自摸/点炮）截按钮，胡了以后截特效
// node winfx.js url outprefix W H [lang] [want=zimo,pao] [team]
const { chromium } = require('playwright');
(async () => {
  const [url, out, W, H, lang, wantS] = process.argv.slice(2);
  const want = new Set((wantS || 'zimo,pao').split(','));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DSF || 1), hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript((lang) => { try { localStorage.setItem('mh_name', JSON.stringify('Tester')); localStorage.setItem('mh_lang', JSON.stringify(lang)); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast' })); } catch (e) {} }, lang || 'en');
  await p.goto(url);
  await p.waitForTimeout(900);
  const got = new Set(); let lastEvn = -1, other = 0, n = 0;
  while (n++ < 3000 && [...want].some(w => !got.has(w))) {
    await p.waitForTimeout(120);
    const st = await p.evaluate(() => {
      const v = MJAPP.ui.view; if (!v || !v.R) return null;
      const nb = document.getElementById('btnNext');
      return { opt: v.opt, phase: v.R.phase, next: !!nb && !nb.disabled, dec: v.opt ? MJAI.decide(v, 3, Math.random) : null, wins: v.R.wins.length, me: v.me };
    });
    if (!st) continue;
    if (st.next) { if (!got.has('res')) { got.add('res'); await p.waitForTimeout(400); await p.screenshot({ path: `${out}-result.png` }); } await p.click('#btnNext'); continue; }
    if (!st.opt) continue;
    const o = st.opt;
    const kind = o.hu ? (o.k === 'turn' ? 'zimo' : 'pao') : null;
    if (kind && want.has(kind) && !got.has(kind)) {
      got.add(kind);
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${out}-${kind}-pre.png` });
      const bt = await (await p.$('.acts .abtn.hu')).boundingBox();
      await p.touchscreen.tap(bt.x + bt.width / 2, bt.y + bt.height / 2);
      for (const [ms, nm] of [[250, 'a'], [600, 'b'], [1300, 'c'], [2600, 'd']]) { await p.waitForTimeout(ms - (nm === 'a' ? 0 : 0)); await p.screenshot({ path: `${out}-${kind}-${nm}.png` }); }
      continue;
    }
    if (st.dec) await p.evaluate(d => MJAPP.S.act(d), st.dec);
  }
  console.log('got', [...got].join(','));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
