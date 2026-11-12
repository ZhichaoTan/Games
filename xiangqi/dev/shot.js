// Screenshot helper: node dev/shot.js <out.png> [lang=zh|en] [w] [h] [js to run in page, may be async] [waitMs]
// Serves from a static server at the repo root: python3 -m http.server 8080 --bind 127.0.0.1
const { chromium } = require('playwright');
(async () => {
  const [out, lang = 'zh', w = 390, h = 844, js = '', wait = 600] = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: +w < 700, isMobile: +w < 700 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  p.on('console', m => { if (m.type() == 'error' || m.type() == 'warning') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(l => { try { if (!localStorage.mh_lang) localStorage.mh_lang = JSON.stringify(l); if (!localStorage.mh_name) localStorage.mh_name = JSON.stringify(l == 'zh' ? '阿超' : 'Zed'); } catch (e) {} }, lang);
  await p.goto(process.env.URL || 'http://127.0.0.1:8080/xiangqi/index.html');
  await p.waitForTimeout(500);
  if (js) { try { const r = await p.evaluate(`(async()=>{${js}})()`); if (r !== undefined) console.log('result:', JSON.stringify(r)); } catch (e) { errs.push('EVAL ' + e.message); } }
  await p.waitForTimeout(+wait);
  await p.screenshot({ path: out, fullPage: !!process.env.FULL });
  if (errs.length) console.log(errs.join('\n'));
  await b.close();
})();
