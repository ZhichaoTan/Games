// The host switches away mid-game (its JavaScript paused, as a phone suspends it) and comes back; then the browser throws the page away and reloads it.
// The guest must get back in by itself, the clocks must not charge anyone for the time the host was away, and play must go on.
//   npx -p peer peerjs --port 9000 --host 127.0.0.1   +   python3 -m http.server 8080 --bind 127.0.0.1 (repo root)
//   node dev/background.js [freeze seconds, default 30]
const L = require('./lib');
const { chromium } = require('playwright');
const Q = '?ph=127.0.0.1:9000';
const FREEZE = +(process.argv[2] || 30);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const wait = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 30000 }).then(() => true, () => false);
const freeze = async (p, s) => { const c = await p.context().newCDPSession(p); await c.send('Debugger.enable'); await c.send('Debugger.pause'); await sleep(s * 1000); await c.send('Debugger.resume'); await c.send('Debugger.disable'); };
(async () => {
  const b = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const A = await L.open(b, { lang: 'en', query: Q, name: 'Zed', dpr: 1 });
  await A.evaluate(() => { document.querySelector('#tabs [data-tab="host"]').click(); const D = XQAPP.DB.settings; D.hostSide = 'red'; D.hostClock = 10; });
  await L.click(A, 'btnCreate');
  await L.waitFor(A, () => XQAPP.S && XQAPP.S.room && !document.getElementById('room').hidden);
  const code = await A.evaluate(() => XQAPP.S.code);
  ok(await A.evaluate(() => KeepAlive.holding), 'host page holds the keep-alive audio');
  const B = await L.open(b, { lang: 'en', query: Q, hash: '#' + code, name: 'Lin', dpr: 1 });
  await L.waitFor(A, () => { const p = XQAPP.S.room.p[1]; return p && p.on; });
  await A.evaluate(() => document.querySelector('#roomActs .btn').click());
  await L.waitFor(A, () => XQAPP.G.mode == 'net'); await L.waitFor(B, () => XQAPP.G.mode == 'net');
  await sleep(3300);
  // red (host) moves, then the host leaves on black's (the guest's) turn
  await L.move(A, await L.anyMove(A, 60));
  await L.waitFor(B, () => XQAPP.G.moves.length == 1);
  const left0 = await B.evaluate(() => XQAPP.S.room.clk.left[1]);
  await freeze(A, FREEZE);
  await sleep(4000);
  ok(await wait(A, () => XQAPP.S.room.p[1].on) && await wait(B, () => XQAPP.S.room.p[0].on && XQAPP.S.room.p[1].on && XQAPP.S.room.clk.run == 1), `after a ${FREEZE}s freeze the guest is back with the host and black's clock runs again`);
  const left1 = await B.evaluate(() => XQAPP.S.room.clk.left[1]);
  ok(left0 - left1 < 15000, `black was not charged for the freeze (lost ${((left0 - left1) / 1000).toFixed(1)}s, freeze ${FREEZE}s)`);
  await L.move(B, await L.anyMove(B, 60));
  ok(await wait(A, () => XQAPP.G.moves.length == 2), 'the guest\'s move reaches the host');
  // the browser drops the host page and reloads it in the same tab
  await A.reload();
  ok(await wait(A, () => XQAPP.S && XQAPP.S.isHost && XQAPP.G.mode == 'net' && XQAPP.G.moves.length == 2), 'reloaded host page reopened the room by itself');
  ok(await wait(B, () => XQAPP.S.room && XQAPP.S.room.p[0].on && XQAPP.S.room.p[1].on), 'guest reconnected to the reopened room');
  await sleep(500);
  await L.move(A, await L.anyMove(A, 60));
  ok(await wait(B, () => XQAPP.G.moves.length == 3), 'play goes on after the reload');
  // the guest reloads too
  await B.reload();
  ok(await wait(B, () => XQAPP.S && XQAPP.S.mode == 'client' && XQAPP.G.mode == 'net' && XQAPP.G.moves.length == 3), 'reloaded guest page rejoined by itself');
  // leaving clears the mark
  await A.evaluate(async () => { await XQAPP.S.leave(); history.replaceState(null, '', location.pathname + location.search); location.reload(); });
  await sleep(1500);
  ok(await A.evaluate(() => !XQAPP.S && !KeepAlive.holding), 'after leaving, a reload stays in the lobby');
  for (const p of [A, B]) p.errs = p.errs.filter(e => !/Could not connect to peer/.test(e)); // expected while the host is away
  fails += L.report(A, B);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
