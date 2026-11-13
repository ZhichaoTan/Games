// The host switches away (its JavaScript paused, as a phone suspends it) on a guest's turn and comes back; then the browser throws the host page away and reloads it.
// The guest must not be timed out for the time the host was away, must reconnect by itself, and the table must keep dealing.
//   npx -p peer peerjs --port 9000 --host 127.0.0.1   +   python3 -m http.server 8765 --bind 127.0.0.1 (repo root)
//   node poker/dev/background.js [freeze seconds, default 30]
const { chromium } = require('playwright');
const U = (process.env.URL || 'http://127.0.0.1:8765/poker/') + '?ph=127.0.0.1:9000';
const FREEZE = +(process.argv[2] || 30);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const wait = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 30000 }).then(() => true, () => false);
const freeze = async (p, s) => { const c = await p.context().newCDPSession(p); await c.send('Debugger.enable'); await c.send('Debugger.pause'); await sleep(s * 1000); await c.send('Debugger.resume'); await c.send('Debugger.disable'); };
const myTurn = p => p.evaluate(() => { const S = PKAPP.S, v = S.view; if (!v || !v.hand || v.hand.street === 'done') return false; const me = v.players.find(x => x.id === S.myId); return !!me && v.hand.toAct === me.seat; });
const act = p => p.evaluate(() => { const S = PKAPP.S, v = S.view, me = v.players.find(x => x.id === S.myId); S.act({ type: me.bet >= v.hand.curBet ? 'check' : 'call' }); });
(async () => {
  const b = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const mk = async (name, hash) => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c.addInitScript(() => { try { if (!localStorage.getItem('mh_seeded')) { localStorage.setItem('mh_lang', '"en"'); localStorage.setItem('mh_wallet', JSON.stringify({ bal: 9000, day: '', inf: false, seat: null, best: {} })); localStorage.setItem('mh_seeded', '1'); } } catch (e) {} });
    const p = await c.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(U + (hash || '')); await p.fill('#nick', name); return p;
  };
  const H = await mk('Host');
  await H.click('[data-tab="host"]'); await H.click('#btnCreate');
  await H.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.querySelector('#codeTxt').textContent.trim()), null, { timeout: 20000 });
  const code = (await H.textContent('#codeTxt')).trim();
  ok(await H.evaluate(() => KeepAlive.holding), 'host page holds the keep-alive audio');
  const G = await mk('Gina', '#' + code);
  await G.click('#btnJoin');
  ok(await wait(G, () => PKAPP.S.online && PKAPP.S.online()), 'guest joined');
  await H.evaluate(() => { PKAPP.hostApi.addBot(); PKAPP.hostApi.start(); });
  // play until it is the guest's turn (the host checks/calls on its own turns)
  let turn = false;
  for (let i = 0; i < 200 && !turn; i++) { if (await myTurn(H)) await act(H); turn = await myTurn(G); if (!turn) await sleep(200); }
  ok(turn, 'it is the guest\'s turn');
  const hand0 = await G.evaluate(() => PKAPP.S.view.handNum);
  await freeze(H, FREEZE);
  ok(await wait(G, () => PKAPP.S.online(), null, 30000), `after a ${FREEZE}s freeze the guest is connected again`);
  const st = await G.evaluate(() => { const v = PKAPP.S.view, me = v.players.find(x => x.id === PKAPP.S.myId); return { hand: v.handNum, toAct: v.hand.toAct, seat: me.seat, folded: me.folded, left: v.hand.deadlineIn }; });
  ok(st.hand === hand0 && st.toAct === st.seat && !st.folded, `the guest was not timed out while the host was away (${JSON.stringify(st)})`);
  ok(await wait(G, () => !PKAPP.S.view.paused, null, 25000), 'the table un-pauses by itself once the guest is back');
  await act(G);
  ok(await wait(H, () => { const h = PKAPP.S.view.hand; return h && h.toAct !== PKAPP.S.view.players.find(x => x.id !== 'host' && !x.isBot).seat; }), 'the guest\'s action reached the host');
  // play on to the next hand
  for (let i = 0; i < 300; i++) { for (const p of [H, G]) if (await myTurn(p)) await act(p); if (await H.evaluate(h0 => PKAPP.S.view.handNum > h0, hand0)) break; await sleep(200); }
  // the browser drops the host page and reloads it in the same tab
  await H.reload();
  ok(await wait(H, () => PKAPP.S.mode === 'host' && PKAPP.S.view && PKAPP.S.view.players.length === 3), 'reloaded host page reopened the table by itself');
  ok(await wait(H, () => PKAPP.S.view.players.every(p => p.isBot || p.connected)), 'the guest reconnected to the reopened table');
  const h1 = await H.evaluate(() => PKAPP.S.view.handNum);
  for (let i = 0; i < 300; i++) { for (const p of [H, G]) if (await myTurn(p)) await act(p).catch(() => {}); if (await H.evaluate(h => PKAPP.S.view.handNum > h, h1)) break; await sleep(200); }
  ok(await H.evaluate(h => PKAPP.S.view.handNum > h, h1), 'the table keeps dealing after the reload');
  await G.reload();
  ok(await wait(G, () => PKAPP.S.mode === 'client' && PKAPP.S.online()), 'reloaded guest page rejoined by itself');
  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fails++;
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
