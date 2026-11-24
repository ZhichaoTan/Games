// Three browsers and a bot on a local PeerServer: open a room, join by link and by code, add a bot, change the round's time,
// play a round with real moves, chat, throw cages, reload a guest in the middle of the round, see the results, play a second
// round, go back to the room, remove a guest, then close the room.
//   npx -p peer@1 peerjs --port 9000 --host 127.0.0.1    (signalling)
//   python3 -m http.server 8080 --bind 127.0.0.1           (from the repo root)
//   node match/dev/online.js [zh|en] [pal|mm]
const L = require('./lib');
const assert = require('assert');
const lang = process.argv[2] || 'zh', theme = process.argv[3] || 'pal';
const Q = '?ph=127.0.0.1:9000&theme=' + theme;
const zh = lang === 'zh';
const rdOf = p => p.evaluate(() => { const v = TTAPP.S && TTAPP.S.view; return v && v.rd ? { id: v.rd.id, n: v.rd.n, phase: v.rd.phase, me: v.me, st: v.rd.st, win: v.rd.win, pl: v.rd.pl, dur: v.rd.dur } : null; });
// cut the round short on every page and on the host's bots
const cutShort = ps => Promise.all(ps.map(p => p.evaluate(() => { const g = TTAPP.U.g; if (g && g.started && !g.over) g.timeMs = g.time + 800; const b = TTAPP.S.botsNow && TTAPP.S.botsNow(); if (b) for (const k in b) b[k].g.timeMs = b[k].g.time + 800; })));
(async () => {
  const b = await L.launch();
  const t0 = Date.now(), log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6), ...a);
  // the host on a computer, the guests on phones
  const A = await L.open(b, { lang, query: Q, name: zh ? '阿超' : 'Zed', w: 1280, h: 800, dpr: 1 });
  await A.evaluate(() => document.querySelector('#tabs [data-tab="host"]').click());
  await L.click(A, 'btnCreate');
  await L.waitFor(A, () => TTAPP.S && TTAPP.screen === 'room' && document.getElementById('overlay').hidden);
  const code = await A.evaluate(() => TTAPP.S.code);
  log('room', code);
  const B = await L.open(b, { lang, query: Q, hash: '#' + code, name: zh ? '小林' : 'Lin' });
  await L.waitFor(B, () => TTAPP.S && TTAPP.screen === 'room' && document.getElementById('overlay').hidden);
  const C = await L.open(b, { lang, query: Q, name: zh ? '豆包' : 'Bea' });
  await C.evaluate(() => document.querySelector('#tabs [data-tab="join"]').click());
  await C.fill('#joinCode', code.toLowerCase());
  await L.click(C, 'btnJoin');
  await L.waitFor(C, () => TTAPP.S && TTAPP.screen === 'room' && document.getElementById('overlay').hidden);
  await L.waitFor(A, () => TTAPP.S.view.seats.filter(Boolean).length === 3);
  log('three people in the room');
  // a bot in the last seat, turned up to Master; the round's time set to 60 seconds
  await A.evaluate(() => document.querySelector('#seats4 [data-add="3"]').click());
  await L.waitFor(A, () => TTAPP.S.view.seats[3] && TTAPP.S.view.seats[3].bot);
  for (let i = 0; i < 4 && (await A.evaluate(() => TTAPP.S.view.seats[3].lv)) !== 4; i++) { await A.evaluate(() => document.querySelector('#seats4 [data-lv="3"]').click()); await A.waitForTimeout(150); }
  await L.waitFor(B, () => TTAPP.S.view.seats[3] && TTAPP.S.view.seats[3].lv === 4);
  await A.evaluate(() => [...document.querySelectorAll('#roomOpts .seg')[0].children].find(b => /60/.test(b.textContent)).click());
  await L.waitFor(B, () => TTAPP.S.room && TTAPP.S.room.time === 60);
  assert.ok(/60/.test(await B.evaluate(() => document.getElementById('roomSum').textContent)), 'a guest does not see the round time');
  assert.strictEqual(await B.evaluate(() => !!document.querySelector('#roomActs .btn.gold')), false, 'a guest sees Start');
  await A.waitForTimeout(300); await L.shot(A, `online-room-host-${theme}-${lang}`); await L.shot(B, `online-room-guest-${theme}-${lang}`);

  // ----- round 1 -----
  const P = [A, B, C];
  const startRound = async n => {
    for (const p of P) await L.waitFor(p, n => { const v = TTAPP.S.view; return TTAPP.screen === 'game' && v && v.rd && v.rd.n === n; }, n, 15000);
    for (const p of P) await L.waitFor(p, () => { const g = TTAPP.U.g; return g && g.started && !TTAPP.U.cd; }, null, 15000);
  };
  await A.evaluate(() => document.querySelector('#roomActs .btn.gold').click());
  for (const p of P) await L.waitFor(p, () => TTAPP.screen === 'game');
  await B.waitForTimeout(600); await L.shot(B, `online-countdown-guest-${theme}-${lang}`);
  await startRound(1);
  const rd1 = await rdOf(A);
  assert.strictEqual(rd1.dur, 60000);
  assert.deepStrictEqual(rd1.pl, [0, 1, 2, 3]);
  // everyone starts from the same board
  const boards = await Promise.all(P.map(p => p.evaluate(() => TTAPP.U.g.toJSON().o.seed)));
  assert.ok(boards.every(x => x === boards[0]), 'different seeds: ' + boards);
  log('round 1 started, seed', boards[0]);
  // play for a while
  for (let k = 0; k < 6; k++) for (const p of P) await L.move(p, 4, 3000);
  // each page sees the others' small boards and scores
  for (const p of P) await L.waitFor(p, () => { const v = TTAPP.S.view; return v.rd.pl.filter(s => s !== v.me).every(s => TTAPP.S.snaps[s] && TTAPP.S.snaps[s].b.length === 64); }, null, 8000);
  const scB = await B.evaluate(() => TTAPP.U.g.score);
  await L.waitFor(A, sc => TTAPP.S.snaps[1] && TTAPP.S.snaps[1].s === sc, scB, 6000);
  log('small boards and scores arrive');
  // chat: an emoji from a guest shows over their card on the host and the other guest
  await B.evaluate(() => TTAPP.S.chat({ emo: '👍' }));
  await L.waitFor(A, () => !!document.querySelector('#opps .opp[data-s="1"] .bub'), null, 4000);
  await L.waitFor(C, () => !!document.querySelector('#opps .opp[data-s="1"] .bub'), null, 4000);
  // cages: a guest's big move throws cages at the leader among the others
  const sent0 = (await rdOf(A)).st[1].sent;
  await B.evaluate(() => { const g = TTAPP.U.g; TTAPP.S.onEv(g, { k: 'combo', type: 'ww' }); TTAPP.S.onEv(g, { k: 'done', wave: 0 }); });
  await L.waitFor(A, s0 => TTAPP.S.view.rd.st[1].sent >= s0 + 3, sent0, 4000);
  const st = (await rdOf(A)).st;
  log('cages thrown by the guest:', st[1].sent, 'caught:', [0, 2, 3].map(s => st[s].got).join('/'));
  await L.shot(A, `online-play-host-${theme}-${lang}`); await L.shot(C, `online-play-guest-${theme}-${lang}`);
  // a guest reloads in the middle of the round and comes back to the same seat
  await C.waitForTimeout(1200);   // the guest's board is saved every second
  const before = await C.evaluate(() => TTAPP.U.g.score);
  await C.reload();
  await L.waitFor(C, () => TTAPP.S && TTAPP.S.view && TTAPP.screen === 'game' && TTAPP.S.view.me === 2, null, 15000);
  await L.waitFor(C, () => TTAPP.U.g && TTAPP.U.g.started && !TTAPP.U.watching && !TTAPP.U.cd, null, 8000);
  const after = await C.evaluate(() => TTAPP.U.g.score);
  assert.strictEqual(after, before, 'the reloaded guest lost their board');
  assert.strictEqual((await rdOf(A)).st[2].fin, false, 'the host finished the reloaded guest');
  for (let k = 0; k < 2; k++) await L.move(C, 4, 3000);
  log('guest reloaded and played on from', before, 'to', await C.evaluate(() => TTAPP.U.g.score));
  // the round ends
  await cutShort(P);
  for (const p of P) await L.waitFor(p, () => TTAPP.S.view.rd.phase === 'over', null, 20000);
  const end1 = await rdOf(A);
  log('round 1 over, winner seat', end1.win, 'scores', end1.pl.map(s => end1.st[s].sc).join(' / '));
  assert.ok(end1.pl.every(s => end1.st[s].fin && end1.st[s].place >= 1));
  for (const p of P) await L.waitFor(p, () => document.getElementById('sheet').classList.contains('on'), null, 6000);
  await A.waitForTimeout(500); await L.shot(A, `online-result-host-${theme}-${lang}`); await L.shot(B, `online-result-guest-${theme}-${lang}`);
  // the guests see the same result as the host
  for (const p of [B, C]) { const r = await rdOf(p); assert.strictEqual(r.win, end1.win); assert.deepStrictEqual(r.pl.map(s => r.st[s].sc), end1.pl.map(s => end1.st[s].sc)); }

  // ----- round 2, then back to the room -----
  await A.evaluate(() => [...document.querySelectorAll('#resFoot .btn.gold')][0].click());
  await startRound(2);
  for (let k = 0; k < 3; k++) for (const p of P) await L.move(p, 4, 3000);
  await cutShort(P);
  for (const p of P) await L.waitFor(p, () => TTAPP.S.view.rd.phase === 'over', null, 20000);
  const wins = await A.evaluate(() => TTAPP.S.view.seats.map(p => p && p.wins));
  log('round 2 over, wins', wins.join(' / '));
  await A.evaluate(() => { const b = [...document.querySelectorAll('#resFoot .btn')].find(x => x.querySelector('use') && x.querySelector('use').getAttribute('href') === '#i-room'); b.click(); });
  for (const p of P) await L.waitFor(p, () => TTAPP.screen === 'room', null, 8000);
  // remove a guest
  await A.evaluate(() => document.querySelector('#seats4 [data-kick="2"]').click());
  await L.waitFor(C, () => !document.getElementById('overlay').hidden && TTAPP.screen !== 'game', null, 6000);
  await L.waitFor(A, () => !TTAPP.S.view.seats[2], null, 6000);
  log('guest removed');
  // close the room: the other guest is told
  await L.click(A, 'roomBack');
  await A.evaluate(() => document.querySelector('#ovCard .btn.red').click());
  await L.waitFor(A, () => TTAPP.screen === 'lobby', null, 6000);
  await L.waitFor(B, () => !document.getElementById('overlay').hidden && /\S/.test(document.getElementById('ovCard').textContent), null, 6000);
  log('room closed:', await B.evaluate(() => document.getElementById('ovCard').textContent.trim()));
  const errs = L.report(A, B, C);
  console.log(errs ? 'errors on ' + errs + ' page(s)' : 'online check passed');
  process.exitCode = errs ? 1 : 0;
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
