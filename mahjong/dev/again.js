// "再来一场"之后特效和声音还在：node dev/again.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('mh_lang', JSON.stringify('zh')); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast' }));
    window.__fx = 0; document.addEventListener('DOMContentLoaded', () => new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('callout')) window.__fx++; }).observe(document.body, { childList: true, subtree: true })); });
  await p.goto('file://' + __dirname + '/../index.html?autosolo=1'); await p.waitForTimeout(800);
  await p.evaluate(() => MJAPP.S.setAuto(true));
  await p.waitForTimeout(20000);
  const a = await p.evaluate(() => ({ fx: window.__fx, evn: MJAPP.ui.view.evn }));
  await p.evaluate(() => { window.__fx = 0; MJAPP.S.again(); });
  await p.waitForTimeout(20000);
  const c = await p.evaluate(() => ({ fx: window.__fx, evn: MJAPP.ui.view.evn, no: MJAPP.ui.view.R.no }));
  console.log('first game', JSON.stringify(a), 'after again', JSON.stringify(c));
  console.log(c.fx > 0 ? 'PASS effects after play-again' : 'FAIL no effects after play-again', errs.join(' | '));
  await b.close();
})();
