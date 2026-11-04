// 大厅截图（整页）：node lobby.js url out W H lang
const { chromium } = require('playwright');
(async () => {
  const [url, out, W, H, lang] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DSF || 1), hasTouch: true, isMobile: true });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.addInitScript((lang) => { try { localStorage.setItem('mh_lang', JSON.stringify(lang)); } catch (e) {} }, lang || 'en');
  await p.goto(url);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out + '.png', fullPage: true });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
