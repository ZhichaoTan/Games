// 联机测试：先开一个本地 PeerServer（npx -p peer peerjs --port 9000 --host 127.0.0.1），再跑：房主 + 两个朋友 + 中途断线重连 + 新人接管电脑座位
// node online.js http://127.0.0.1:8765/mahjong/ outprefix
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/mahjong/';
const OUT = process.argv[3] || 'on';
const PH = '?ph=127.0.0.1:9000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async (name, lang, size) => {
    const ctx = await b.newContext({ viewport: size || { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: !size });
    await ctx.addInitScript(([n, l]) => { try { if (!localStorage.getItem('mh_name')) { localStorage.setItem('mh_name', JSON.stringify(n)); localStorage.setItem('mh_lang', JSON.stringify(l)); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast' })); } } catch (e) {} }, [name, lang]);
    const u = { ctx, name };
    u.open = async (hash) => {
      u.p = await ctx.newPage();
      u.p.on('pageerror', e => errs.push(name + ' pageerror: ' + e.message));
      u.p.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_|net::/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
      await u.p.goto(BASE + PH + (hash ? '#' + hash : ''));
      await u.p.waitForTimeout(700);
    };
    return u;
  };
  const view = u => u.p.evaluate(() => { const v = MJAPP.ui.view; return v ? { me: v.me, phase: v.R && v.R.phase, no: v.R && v.R.no, seats: v.seats.map(p => p && { name: p.name, bot: !!p.bot, conn: p.conn, auto: !!p.auto }), wall: v.R && v.R.wall } : null; });
  const H = await mk('Host', 'en');
  await H.open();
  await H.p.click('#tabs [data-tab="host"]');
  await H.p.click('#btnCreate');
  await H.p.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('roomCode').textContent.trim()), null, { timeout: 15000 });
  const code = (await H.p.textContent('#roomCode')).trim();
  console.log('room', code);
  const A = await mk('Ann', 'zh'); await A.open(code);
  const B = await mk('Ben', 'en'); await B.open(code);
  await H.p.waitForFunction(() => document.querySelectorAll('#seats4 .rs:not(.empty)').length === 3, null, { timeout: 20000 });
  console.log('3 players in the room');
  await H.p.click('#seats4 [data-add]');
  await H.p.waitForTimeout(500);
  await H.p.screenshot({ path: OUT + '-room-host.png' });
  await A.p.waitForFunction(() => document.querySelectorAll('#seats4 .rs:not(.empty)').length === 4, null, { timeout: 10000 });
  await A.p.screenshot({ path: OUT + '-room-ann.png' });
  await H.p.click('#roomActs .btn.gold');
  await A.p.waitForFunction(() => MJAPP.ui.view && MJAPP.ui.view.R, null, { timeout: 15000 });
  await sleep(1500);
  await H.p.screenshot({ path: OUT + '-swap-host.png' });
  await A.p.screenshot({ path: OUT + '-swap-ann.png' });
  console.log('started', JSON.stringify(await view(A)));
  for (const u of [H, A, B]) await u.p.evaluate(() => MJAPP.S.setAuto(true));
  await sleep(9000);
  await A.p.screenshot({ path: OUT + '-play-ann.png' });
  await B.p.screenshot({ path: OUT + '-play-ben.png' });
  // Ben 断线
  await B.p.close();
  await sleep(9000);
  const hv = await view(H);
  console.log('after Ben left:', JSON.stringify(hv.seats[hv.seats.findIndex(s => s && s.name === 'Ben')]));
  await H.p.screenshot({ path: OUT + '-ben-gone-host.png' });
  // Ben 回来（同一个浏览器，带着原来的 token）
  await B.open(code);
  await B.p.waitForFunction(() => MJAPP.ui.view && MJAPP.ui.view.R, null, { timeout: 20000 });
  const bv = await view(B);
  console.log('Ben back: me=' + bv.me + ' phase=' + bv.phase, JSON.stringify(bv.seats[bv.me]));
  await sleep(1500);
  await B.p.screenshot({ path: OUT + '-ben-back.png' });
  // Dee 中途进来，接管电脑
  const D = await mk('Dee', 'en', { width: 1280, height: 720 }); await D.open(code);
  await D.p.waitForFunction(() => MJAPP.ui.view && MJAPP.ui.view.R, null, { timeout: 20000 });
  const dv = await view(D);
  console.log('Dee joined: me=' + dv.me, JSON.stringify(dv.seats));
  await D.p.evaluate(() => MJAPP.S.setAuto(true));
  await sleep(2500);
  await D.p.screenshot({ path: OUT + '-dee.png' });
  // 打到这局结束，大家点下一局
  let ended = false;
  for (let i = 0; i < 60 && !ended; i++) {
    await sleep(1000);
    for (const u of [H, A, B, D]) {
      const nx = await u.p.$('#btnNext:not([disabled])');
      if (nx) { if (!ended) { await u.p.screenshot({ path: OUT + '-result-' + u.name + '.png' }); } ended = true; await nx.click().catch(() => {}); }
    }
  }
  console.log('round ended:', ended);
  await sleep(4000);
  for (const u of [H, A, B, D]) { const nx = await u.p.$('#btnNext:not([disabled])'); if (nx) await nx.click().catch(() => {}); }
  await sleep(5000);
  for (const u of [H, A, B, D]) console.log(u.name, JSON.stringify(await view(u)).slice(0, 160));
  await H.p.screenshot({ path: OUT + '-round2-host.png' });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
