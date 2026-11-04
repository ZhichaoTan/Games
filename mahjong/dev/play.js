// 练习模式，自己也托管，隔一段时间截一张：node play.js url outprefix W H n interval [lang]
const { chromium } = require('playwright');
(async () => {
  const [url, out, W, H, n, iv, lang] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript((lang) => { try { localStorage.setItem('mh_name', JSON.stringify('Zhichao')); if (lang) localStorage.setItem('mh_lang', JSON.stringify(lang)); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast' })); } catch (e) {} }, lang || 'en');
  await p.goto(url);
  await p.waitForTimeout(800);
  await p.evaluate(() => MJAPP.S.setAuto(true));
  for (let i = 0; i < +n; i++) { await p.waitForTimeout(+iv); await p.screenshot({ path: `${out}-${i}.png` }); }
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
