// 桌面截图：node desk.js out W H lang [mode=lobby|play] [wait]
const { chromium } = require('playwright');
(async () => {
  const [out, W, H, lang, mode, wait] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W, height: +H } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript((lang) => { localStorage.setItem('mh_name', JSON.stringify('Zhichao')); localStorage.setItem('mh_lang', JSON.stringify(lang)); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast' })); }, lang);
  const url = 'file://' + require('path').resolve(__dirname, '../index.html') + (mode === 'play' ? '?autosolo=1' : '');
  await p.goto(url); await p.waitForTimeout(1000);
  if (mode === 'play') { await p.evaluate(() => MJAPP.S.setAuto(true)); await p.waitForTimeout(+(wait || 15000)); }
  await p.screenshot({ path: out });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
