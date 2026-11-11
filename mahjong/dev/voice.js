// 四川话播报检查：中文界面托管打一段，统计念了哪些录音：node dev/voice.js [url]
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2] || 'file://' + require('path').resolve(__dirname, '../index.html') + '?autosolo=1';
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.addInitScript(() => {
    localStorage.setItem('mh_lang', JSON.stringify('zh')); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast' }));
    window.__said = []; window.__tts = 0;
    if (window.speechSynthesis) { const s = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { if (u.text.trim()) window.__tts++; return s(u); }; }
  });
  await p.goto(url);
  await p.waitForTimeout(500);
  await p.mouse.click(200, 300); // 用户手势
  await p.evaluate(() => { const o = MJSound.scSay; MJSound.scSay = (k, d) => { const r = o(k, d); window.__said.push(k + (r ? '' : '!')); return r; }; });
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => typeof MJAPP);
  await p.evaluate(() => MJAPP.S.setAuto(true));
  await p.waitForTimeout(25000);
  const r = await p.evaluate(() => ({ said: window.__said, tts: window.__tts, sc: MJSound.prefs.sc, ready: MJSound.scReady() }));
  console.log(JSON.stringify({ n: r.said.length, first: r.said.slice(0, 40), tts: r.tts, sc: r.sc, ready: r.ready }));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
