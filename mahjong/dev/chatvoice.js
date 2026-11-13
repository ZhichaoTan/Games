// 聊天语音 + 出牌限时（联机）：先开本地 PeerServer（npx -p peer peerjs --port 9000 --host 127.0.0.1）
// node chatvoice.js http://127.0.0.1:8765/mahjong/
// 房主（中文、女声）开房，客人（英文、男声）加入，两个电脑补位。检查：快捷语按说话人的声音念、各自语言显示；默认限时 30 秒，客人不动会被自动出牌
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/mahjong/';
const PH = '?ph=127.0.0.1:9000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const mk = async (name, lang, g) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(([n, l, g]) => {
      localStorage.setItem('mh_name', JSON.stringify(n)); localStorage.setItem('mh_lang', JSON.stringify(l)); localStorage.setItem('mh_vg', JSON.stringify(g));
      localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast' }));
      window.__cs = [];
      const t = setInterval(() => { if (window.MJSound) { clearInterval(t); const o = MJSound.chatSay; MJSound.chatSay = (i, gg) => { const r = o(i, gg); window.__cs.push([i, gg, r]); return r; }; } }, 5);
    }, [name, lang, g]);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ' pageerror: ' + e.message));
    return p;
  };
  const H = await mk('Host', 'zh', 'f');
  await H.goto(BASE + PH); await sleep(700);
  await H.mouse.click(5, 5);
  await H.click('#tabs [data-tab="host"]');
  await H.click('#btnCreate');
  await H.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('roomCode').textContent.trim()), null, { timeout: 15000 });
  const code = (await H.textContent('#roomCode')).trim();
  const G = await mk('Guest', 'en', 'm');
  await G.goto(BASE + PH + '#' + code); await sleep(700); await G.mouse.click(5, 5);
  await H.waitForFunction(() => document.querySelectorAll('#seats4 .rs:not(.empty)').length === 2, null, { timeout: 20000 });
  await H.click('#roomActs .btn.gold');
  await G.waitForFunction(() => MJAPP.ui.view && MJAPP.ui.view.R, null, { timeout: 15000 });
  await sleep(1500);
  const v = await G.evaluate(() => ({ timer: MJAPP.ui.view.rules.timer, g: MJAPP.ui.view.seats.map(p => p && p.g) }));
  ok(v.timer === 30, 'room timer defaults to 30s: ' + v.timer);
  ok(v.g[1] === 'm' && v.g[0] === 'f', 'seats carry chat voice: ' + JSON.stringify(v.g));
  // 客人发一句快捷语
  await G.evaluate(() => MJAPP.S.chat({ p: 2 }));
  await sleep(800);
  const hs = await H.evaluate(() => ({ cs: window.__cs, txt: [...document.querySelectorAll('.bubble')].map(e => e.textContent) }));
  const gs = await G.evaluate(() => ({ cs: window.__cs, txt: [...document.querySelectorAll('.bubble')].map(e => e.textContent) }));
  ok(hs.cs.some(x => x[0] === 2 && x[1] === 'm' && x[2]), 'host heard the guest in a male voice: ' + JSON.stringify(hs.cs));
  ok(hs.txt.includes('这牌不错'), 'host sees the phrase in Chinese: ' + JSON.stringify(hs.txt));
  ok(gs.cs.some(x => x[0] === 2 && x[1] === 'm' && x[2]), 'guest hears own phrase: ' + JSON.stringify(gs.cs));
  ok(gs.txt.includes('Nice hand!'), 'guest sees the phrase in English: ' + JSON.stringify(gs.txt));
  await H.evaluate(() => MJAPP.S.chat({ p: 7 }));
  await sleep(800);
  const gs2 = await G.evaluate(() => window.__cs);
  ok(gs2.some(x => x[0] === 7 && x[1] === 'f' && x[2]), 'guest heard the host in a female voice: ' + JSON.stringify(gs2));
  // 限时：房主托管，客人什么都不点，等到客人自己出牌
  await H.evaluate(() => MJAPP.S.setAuto(true));
  const t0 = Date.now();
  let moved = false;
  for (let i = 0; i < 400 && !moved; i++) {
    await sleep(500);
    moved = await G.evaluate(() => { const v = MJAPP.ui.view; return !!(v && v.R && v.R.phase === 'play' && v.R.river[v.me].length > 0); });
  }
  const secs = (Date.now() - t0) / 1000;
  ok(moved, `idle guest auto-discarded after the timer (${secs.toFixed(0)}s)`);
  const clk = await G.evaluate(() => { const v = MJAPP.ui.view; return v.clock ? Math.round((v.clock.end - Date.now()) / 1000) : null; });
  console.log('clock now', clk);
  await G.screenshot({ path: '/tmp/claude-0/sh/chat-guest.png' });
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
  process.exit(bad ? 1 : 0);
})();
