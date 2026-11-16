// The host switches away mid-game (its JavaScript paused, as a phone suspends it) and comes back; then the browser throws the page away and reloads it.
// The guest must get back in by itself, nobody may be charged a timeout or handed to a bot for the time the host was away, and play must go on.
//   npx -p peer peerjs --port 9000 --host 127.0.0.1   +   python3 -m http.server 8080 --bind 127.0.0.1 (repo root)
//   node dev/background.js [freeze seconds, default 30]
const L = require('./lib');
const Q = '?ph=127.0.0.1:9000';
const FREEZE = +(process.argv[2] || 30);
const PREFS = JSON.stringify({ speed: 'fast', bot: 2, n: 2, rules: { setup: 'quick', timer: 45 } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const wait = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 30000 }).then(() => true, () => false);
const freeze = async (p, s) => { const c = await p.context().newCDPSession(p); await c.send('Debugger.enable'); await c.send('Debugger.pause'); await sleep(s * 1000); await c.send('Debugger.resume'); await c.send('Debugger.disable'); };
(async () => {
  const b = await L.launch();
  const A = await L.open(b, { lang: 'en', query: Q, name: 'Zed', dpr: 1, ls: { mh_cd_prefs: PREFS } });
  await A.evaluate(() => document.querySelector('#tabs [data-tab="host"]').click());
  await L.click(A, 'btnCreate');
  await L.waitFor(A, () => MTAPP.S && MTAPP.S.room && !document.getElementById('room').hidden && document.getElementById('overlay').hidden, null, 20000);
  const code = await A.evaluate(() => MTAPP.S.room.code);
  ok(await A.evaluate(() => KeepAlive.holding), 'host page holds the keep-alive audio');
  const B = await L.open(b, { lang: 'en', query: Q, hash: '#' + code, name: 'Lin', dpr: 1 });
  await L.waitFor(A, () => MTAPP.S.view.seats[1] && MTAPP.S.view.seats[1].conn);
  await A.evaluate(() => document.querySelector('#roomActs .btn.gold').click());
  await L.waitFor(B, () => MTAPP.S.view && MTAPP.S.view.g && !document.getElementById('game').hidden);
  // play until it is the guest's turn, with their clock running
  const ctx = {};
  for (let k = 0; k < 400; k++) {
    if (await B.evaluate(() => { const v = MTAPP.S.view; return v.g.turn === 1 && v.g.phase === 'move' && MTAPP.S.room.clock && MTAPP.S.room.clock.s === 1; })) break;
    if (await L.playStep(A, ctx) !== 'acted') await sleep(150);
  }
  ok(await B.evaluate(() => MTAPP.S.view.g.turn === 1 && !!MTAPP.S.room.clock), 'the guest is to move, with the turn clock running');
  await freeze(A, FREEZE);
  ok(await wait(A, () => MTAPP.S.view.seats[1].conn && !MTAPP.S.room.paused, null, 40000) && await wait(B, () => MTAPP.S.view.seats[0].conn && !MTAPP.S.room.paused && !!MTAPP.S.room.clock, null, 40000), `after a ${FREEZE}s freeze the guest is back with the host and the game runs again`);
  const st = await A.evaluate(() => ({ auto: MTAPP.S.view.seats[1].auto, turn: MTAPP.S.view.g.turn, left: MTAPP.S.room.clock && MTAPP.S.room.clock.left }));
  ok(!st.auto && st.turn === 1, 'no bot took over the guest\'s turn while the host was away');
  ok(st.left > 30000, `the guest's clock started again (${((st.left || 0) / 1000).toFixed(0)} s left of 45)`);
  const e0 = await A.evaluate(() => MTAPP.S.view.g.evn);
  for (let k = 0; k < 20 && await A.evaluate(() => MTAPP.S.view.g.evn) === e0; k++) { await L.playStep(B, ctx); await sleep(300); }
  ok(await A.evaluate(e => MTAPP.S.view.g.evn > e, e0), 'the guest\'s move reaches the host');
  // the browser drops the host page and reloads it in the same tab
  const before = await A.evaluate(() => MTAPP.S.view.g.evn);
  await A.reload();
  ok(await wait(A, () => MTAPP.S && MTAPP.S.isHost && MTAPP.S.view && MTAPP.S.view.g && !document.getElementById('game').hidden), 'reloaded host page reopened the room by itself');
  ok(await A.evaluate(b => MTAPP.S.view.g.evn >= b - 2, before), 'with the game where it was');
  ok(await wait(B, () => MTAPP.S.view.seats[0].conn && MTAPP.S.view.seats[1].conn && !MTAPP.S.room.paused, null, 40000), 'guest reconnected to the reopened room');
  const e1 = await A.evaluate(() => MTAPP.S.view.g.evn);
  for (let k = 0; k < 60 && await A.evaluate(() => MTAPP.S.view.g.evn) <= e1 + 1; k++) { for (const p of [A, B]) await L.playStep(p, ctx); await sleep(200); }
  ok(await A.evaluate(e => MTAPP.S.view.g.evn > e + 1, e1), 'play goes on after the reload');
  // the guest reloads too
  await B.reload();
  ok(await wait(B, () => MTAPP.S && MTAPP.S.mode === 'client' && MTAPP.S.view && MTAPP.S.view.me === 1 && !document.getElementById('game').hidden), 'reloaded guest page rejoined by itself');
  // leaving clears the mark
  await A.evaluate(async () => { await MTAPP.S.leave('end'); history.replaceState(null, '', location.pathname + location.search); location.reload(); });
  await sleep(1500);
  ok(await A.evaluate(() => !MTAPP.S && !KeepAlive.holding && !document.getElementById('lobby').hidden), 'after leaving, a reload stays in the lobby');
  for (const p of [A, B]) p.errs = p.errs.filter(e => !/Could not connect to peer/.test(e));   // expected while the host is away
  fails += L.report(A, B);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
