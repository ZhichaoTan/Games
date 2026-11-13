// The host switches away (its JavaScript paused, as a phone suspends it) and comes back; then the browser throws the page away and reloads it.
// Guests must get back in by themselves and the game must carry on; a friend who tries to join while the host is away gets in once they return.
// Needs a local PeerServer (npx -p peer peerjs --port 9000 --host 127.0.0.1) and the repo served on 8765.
// node background.js [http://127.0.0.1:8765/mahjong/] [freeze seconds, default 30]
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/mahjong/';
const FREEZE = +(process.argv[3] || 30);
const PH = '?ph=127.0.0.1:9000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const mk = async name => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(n => { try { if (!localStorage.getItem('mh_name')) { localStorage.setItem('mh_name', JSON.stringify(n)); localStorage.setItem('mh_lang', '"en"'); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast' })); } } catch (e) {} }, name);
    const u = { ctx, name };
    u.open = async hash => {
      u.p = await ctx.newPage();
      u.p.on('pageerror', e => errs.push(name + ' pageerror: ' + e.message));
      await u.p.goto(BASE + PH + (hash ? '#' + hash : ''));
      await u.p.waitForTimeout(600);
    };
    return u;
  };
  const view = u => u.p.evaluate(() => { const v = MJAPP.ui.view; return v ? { me: v.me, wall: v.R && v.R.wall, no: v.R && v.R.no, seats: v.seats.map(p => p && { name: p.name, bot: !!p.bot, conn: p.conn }) } : null; });
  const freeze = async (u, s) => { const c = await u.ctx.newCDPSession(u.p); await c.send('Debugger.enable'); await c.send('Debugger.pause'); await sleep(s * 1000); await c.send('Debugger.resume'); await c.send('Debugger.disable'); await u.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); };

  const H = await mk('Host'); await H.open();
  await H.p.click('#tabs [data-tab="host"]');
  await H.p.click('#btnCreate');
  await H.p.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('roomCode').textContent.trim()), null, { timeout: 15000 });
  const code = (await H.p.textContent('#roomCode')).trim();
  ok(await H.p.evaluate(() => KeepAlive.holding), 'host page holds the keep-alive audio');
  ok(await H.p.evaluate(() => !!(navigator.mediaSession.metadata && /room/i.test(navigator.mediaSession.metadata.title))), 'media session names the room');

  // 1. the host steps away before the game starts; a friend tries to join meanwhile
  const A = await mk('Ann'); await A.open(code);
  await H.p.waitForFunction(() => document.querySelectorAll('#seats4 .rs:not(.empty)').length === 2, null, { timeout: 20000 });
  const fz = freeze(H, FREEZE);
  await sleep(3000);
  const B = await mk('Ben'); await B.open(code);
  await fz;
  await H.p.waitForFunction(() => document.querySelectorAll('#seats4 .rs:not(.empty)').length === 3 && [...document.querySelectorAll('#seats4 .rs .sub')].every(e => !/off/i.test(e.textContent)), null, { timeout: 30000 }).then(() => ok(true, `after a ${FREEZE}s freeze in the room, Ann is back and Ben (who tried to join meanwhile) got in`), () => ok(false, 'room not whole again after the freeze'));

  // 2. start, then the host steps away mid-game
  await H.p.click('#seats4 [data-add]');
  await sleep(500);
  await H.p.click('#roomActs .btn.gold');
  await A.p.waitForFunction(() => MJAPP.ui.view && MJAPP.ui.view.R, null, { timeout: 15000 });
  for (const u of [H, A, B]) await u.p.evaluate(() => MJAPP.S.setAuto(true));
  await sleep(4000);
  const w0 = (await view(A)).wall;
  await freeze(H, FREEZE);
  await A.p.waitForFunction(w => MJAPP.ui.view && MJAPP.ui.view.R && (MJAPP.ui.view.R.wall < w - 2 || MJAPP.ui.view.R.no > 1), w0, { timeout: 30000 }).then(() => ok(true, `after a ${FREEZE}s freeze mid-game, Ann sees the game moving again`), () => ok(false, 'game did not continue for Ann'));
  const hv = await view(H);
  ok(hv.seats.filter(s => s && !s.bot).every(s => s.conn), 'host sees every guest connected: ' + JSON.stringify(hv.seats.map(s => s && s.name + (s.conn ? '' : '(off)'))));

  // 3. the browser throws the host page away and loads it again (same tab: sessionStorage survives)
  await sleep(1500);
  await H.p.reload();
  await H.p.waitForFunction(() => MJAPP.S && MJAPP.S.isHost && MJAPP.ui.view && MJAPP.ui.view.R, null, { timeout: 15000 }).then(() => ok(true, 'reloaded host page reopened the room by itself'), () => ok(false, 'host page did not reopen the room'));
  const w1 = (await view(B)).wall;
  await H.p.evaluate(() => MJAPP.S.setAuto(true));
  await B.p.waitForFunction(w => MJAPP.ui.view && MJAPP.ui.view.R && (MJAPP.ui.view.R.wall !== w || MJAPP.ui.view.R.no > 1), w1, { timeout: 30000 }).then(() => ok(true, 'Ben reconnected to the reopened room and play continues'), () => ok(false, 'Ben stuck after host reload'));

  // 4. a guest page reloads too
  await A.p.reload();
  await A.p.waitForFunction(() => MJAPP.S && MJAPP.S.mode === 'client' && MJAPP.ui.view && MJAPP.ui.view.R, null, { timeout: 20000 }).then(() => ok(true, 'reloaded guest page rejoined by itself'), () => ok(false, 'guest did not rejoin after reload'));

  // 5. leaving clears the mark: a reload afterwards lands in the lobby
  await H.p.evaluate(() => MJAPP.S.leave('end'));
  await H.p.evaluate(() => { history.replaceState(null, '', location.pathname + location.search); location.reload(); });
  await sleep(1500);
  ok(await H.p.evaluate(() => !MJAPP.S && !KeepAlive.holding), 'after leaving, a reload stays in the lobby with no keep-alive');

  console.log(errs.length ? errs.join('\n') : 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
