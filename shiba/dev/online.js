// Three browsers and a bot on a local PeerServer: open a room, join by link and by code, add a bot, play rounds with real
// key presses, send bubble rows across, chat, reload a guest in the middle of a round, go back to the room, remove the bot,
// win a round, then close the room.
//   npx -p peer@1 peerjs --port 9000 --host 127.0.0.1    (signalling)
//   python3 -m http.server 8080 --bind 127.0.0.1           (from the repo root)
//   node shiba/dev/online.js [zh|en]
const L = require('./lib');
const assert = require('assert');
const Q = '?ph=127.0.0.1:9000';
const rdOf = p => p.evaluate(() => { const v = SBAPP.S && SBAPP.S.view; return v && v.rd ? { id: v.rd.id, n: v.rd.n, phase: v.rd.phase, me: v.me, st: v.rd.st, win: v.rd.win, pl: v.rd.pl } : null; });
(async () => {
  const lang = process.argv[2] || 'zh';
  const zh = lang == 'zh';
  const b = await L.launch();
  // the host on a computer, the guests on phones
  const A = await L.open(b, { lang, query: Q, name: zh ? '阿超' : 'Zed', w: 1280, h: 800, dpr: 1 });
  await A.evaluate(() => document.querySelector('#tabs [data-tab="host"]').click());
  await A.waitForTimeout(250); await L.shot(A, `host-pane-${lang}`);
  await L.click(A, 'btnCreate');
  await L.waitFor(A, () => SBAPP.S && SBAPP.screen === 'room' && document.getElementById('overlay').hidden);
  const code = await A.evaluate(() => SBAPP.S.code);
  console.log('room', code);
  // the first guest opens the invite link, the second types the code
  const B = await L.open(b, { lang, query: Q, hash: '#' + code, name: zh ? '小林' : 'Lin' });
  await L.waitFor(B, () => SBAPP.S && SBAPP.screen === 'room' && document.getElementById('overlay').hidden);
  const C = await L.open(b, { lang, query: Q, name: zh ? '豆包' : 'Bea' });
  await C.evaluate(() => document.querySelector('#tabs [data-tab="join"]').click());
  await C.fill('#joinCode', code.toLowerCase());
  await L.click(C, 'btnJoin');
  await L.waitFor(C, () => SBAPP.S && SBAPP.screen === 'room' && document.getElementById('overlay').hidden);
  await L.waitFor(A, () => SBAPP.S.view.seats.filter(Boolean).length === 3);
  // a bot in the last seat, turned up to Master
  await A.evaluate(() => document.querySelector('#seats4 [data-add="3"]').click());
  await L.waitFor(A, () => SBAPP.S.view.seats[3] && SBAPP.S.view.seats[3].bot);
  for (let i = 0; i < 4 && (await A.evaluate(() => SBAPP.S.view.seats[3].lv)) !== 4; i++) { await A.evaluate(() => document.querySelector('#seats4 [data-lv="3"]').click()); await A.waitForTimeout(120); }
  await L.waitFor(B, () => SBAPP.S.view.seats[3] && SBAPP.S.view.seats[3].lv === 4);
  await A.waitForTimeout(300); await L.shot(A, `room-host-${lang}`); await L.shot(B, `room-guest-${lang}`);
  // a guest can't start the round
  assert.strictEqual(await B.evaluate(() => !!document.querySelector('#roomActs .btn.gold')), false, 'a guest sees Start');

  const P = [A, B, C];
  const startRound = async n => {
    for (const p of P) await L.waitFor(p, n => { const v = SBAPP.S.view; return SBAPP.screen === 'game' && v && v.rd && v.rd.n === n; }, n, 15000);
    for (const p of P) await L.waitFor(p, () => { const g = SBAPP.U.g; return g && g.started && !SBAPP.U.cd; }, null, 15000);
  };
  // every player places blocks well for a while, the way a bot would that clears rows as they come and keeps its stack low:
  // people then rarely send rows (only three or more at once do), so they and the bot stay in. until: stop early when true
  const SAFE = { ms: 0, noise: 0, slip: 0, hold: true, look: false, quad: false };
  const playWell = async (ms, until) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { for (const p of P) await L.keyMove(p, { lv: SAFE }).catch(() => false); if (until && (await until())) return; await A.waitForTimeout(30); } };
  // drop blocks straight down until this player is out
  const topOut = async p => { for (let i = 0; i < 200; i++) { const m = await L.me(p); if (!m || m.over || !m.started) return; await p.keyboard.press('Space'); await p.waitForTimeout(40); } throw new Error('never topped out'); };

  // ----- round 1: three people and a Master bot -----
  await A.evaluate(() => document.querySelector('#roomActs .btn.gold').click());
  for (const p of P) await L.waitFor(p, () => SBAPP.screen === 'game');
  await B.waitForTimeout(700); await L.shot(B, `countdown-guest-${lang}`);
  await startRound(1);
  const seats = await Promise.all(P.map(p => p.evaluate(() => SBAPP.S.view.me)));
  console.log('seats', seats.join(','));
  assert.deepStrictEqual(seats, [0, 1, 2]);
  // everyone got the same blocks
  const firsts = await Promise.all(P.map(p => p.evaluate(() => SBAPP.U.g.seed)));
  assert.ok(firsts.every(x => x === firsts[0]), 'seeds differ: ' + firsts);
  await playWell(9000);
  // a quick phrase from a guest shows on the host's card for that guest
  await B.evaluate(() => SBAPP.S.chat({ p: 2 }));
  await L.waitFor(A, () => !!document.querySelector('#opps .opp[data-s="1"] .bub'), null, 5000);
  await L.waitFor(C, () => !!document.querySelector('#opps .opp[data-s="1"] .bub'), null, 5000);
  await A.waitForTimeout(150); await L.shot(A, `online-chat-host-${lang}`); await L.shot(C, `online-chat-guest-${lang}`);
  await playWell(9000);
  // play on until bubble rows have reached a person (the Master bot's four-row clears at least)
  const hit = async () => { const r = await rdOf(A); const n = await Promise.all(P.map(p => p.evaluate(() => SBAPP.U.g.stats.recv))); return Object.values(r.st).some(s => s.sent > 0) && n.some(x => x > 0); };
  await playWell(45000, hit);
  // pictures of the other wells reach everyone
  for (const p of P) {
    const have = await p.evaluate(() => Object.keys(SBAPP.S.snaps || {}).map(Number).sort());
    const me = await p.evaluate(() => SBAPP.S.view.me);
    assert.ok([0, 1, 2, 3].every(s => s === me || have.includes(s)), 'snapshots on seat ' + me + ': ' + have);
  }
  const r1 = await rdOf(A);
  const sent = Object.values(r1.st).reduce((a, s) => a + s.sent, 0);
  const recv = await Promise.all(P.map(p => p.evaluate(() => SBAPP.U.g.stats.recv)));
  console.log('round 1: sent', JSON.stringify(Object.fromEntries(Object.entries(r1.st).map(([s, x]) => [s, x.sent]))), 'people got', recv.join(','));
  assert.ok(sent > 0, 'nobody sent any rows');
  assert.ok(recv.some(x => x > 0), 'no bubble rows reached a person');
  await L.shot(A, `online-play-host-${lang}`); await L.shot(B, `online-play-guest-${lang}`);
  // a guest's page reloads in the middle of the round: that well is gone, so they're out, and they watch the rest
  const pre = await rdOf(A);
  assert.ok(pre.phase === 'play' && !pre.st[2].out, 'the guest was already out before the reload: ' + JSON.stringify(pre));
  await C.reload(); await C.waitForTimeout(400);
  await L.waitFor(C, () => SBAPP.S && SBAPP.S.mode === 'client' && SBAPP.screen === 'game' && SBAPP.S.view && SBAPP.S.view.me === 2, null, 20000);
  await L.waitFor(A, () => SBAPP.S.view.rd.st[2].out && SBAPP.S.view.rd.st[2].why === 'net', null, 10000);
  await C.waitForTimeout(600); await L.shot(C, `online-reload-out-${lang}`);
  console.log('guest reloaded: out, still in seat 2');
  // the two people left drop out on purpose: the bot is last standing
  await Promise.all([topOut(B), topOut(A)]);
  for (const p of P) await L.waitFor(p, () => SBAPP.S.view.rd.phase === 'over' && !!document.querySelector('#sheet #resFoot'), null, 15000);
  const e1 = await rdOf(A);
  console.log('round 1 winner', e1.win, 'places', JSON.stringify(Object.fromEntries(Object.entries(e1.st).map(([s, x]) => [s, x.place]))));
  assert.strictEqual(e1.win, 3);
  await A.waitForTimeout(300); await L.shot(A, `online-result-host-${lang}`); await L.shot(B, `online-result-guest-${lang}`);

  // ----- round 2 from the results: Next round -----
  await A.evaluate(() => document.querySelector('#resFoot .btn.gold').click());
  await startRound(2);
  await playWell(4000);
  await Promise.all([topOut(A), topOut(B), topOut(C)]);
  for (const p of P) await L.waitFor(p, () => SBAPP.S.view.rd.phase === 'over' && !!document.querySelector('#sheet #resFoot'), null, 15000);
  console.log('round 2 over, winner', (await rdOf(A)).win);

  // ----- back to the room, the bot leaves, and the host wins round 3 -----
  await A.evaluate(() => [...document.querySelectorAll('#resFoot .btn')].find(b => b.querySelector('use[href="#i-room"]')).click());
  for (const p of P) await L.waitFor(p, () => SBAPP.screen === 'room', null, 10000);
  await A.evaluate(() => document.querySelector('#seats4 [data-kick="3"]').click());
  await L.waitFor(C, () => !SBAPP.S.view.seats[3]);
  const wins = await C.evaluate(() => SBAPP.S.view.seats.map(p => p ? p.wins : null));
  console.log('wins in the room', JSON.stringify(wins));
  await A.waitForTimeout(200); await L.shot(C, `room-again-guest-${lang}`);
  await A.evaluate(() => document.querySelector('#roomActs .btn.gold').click());
  await startRound(3);
  await playWell(3000);
  await Promise.all([topOut(B), topOut(C)]);
  for (const p of P) await L.waitFor(p, () => SBAPP.S.view.rd.phase === 'over', null, 15000);
  const e3 = await rdOf(A);
  assert.strictEqual(e3.win, 0, 'the host should have won round 3');
  assert.strictEqual(await A.evaluate(() => SBAPP.U.g.over && SBAPP.U.g.why), 'win');
  await L.waitFor(A, () => !!document.querySelector('#sheet #resFoot'), null, 6000);
  await A.waitForTimeout(400); await L.shot(A, `online-win-host-${lang}`); await L.shot(B, `online-lose-guest-${lang}`);
  console.log('round 3: the host won');

  // ----- the host closes the room: the guests are told -----
  await A.evaluate(() => SBAPP.S.leave('end'));
  for (const p of [B, C]) await L.waitFor(p, () => !document.getElementById('overlay').hidden && SBAPP.S.ended, null, 8000);
  await L.shot(B, `online-ended-${lang}`);
  const bad = L.report(A, B, C);
  await b.close();
  console.log(bad ? 'ERRORS' : 'online check passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
