// Three browsers and a bot on a local PeerServer: open a room, join by link and by code, add a bot, play two rounds
// by tapping, chat, drop and rejoin a guest mid-round, then close the room.
//   npx -p peer@1 peerjs --port 9000 --host 127.0.0.1    (signalling)
//   python3 -m http.server 8080 --bind 127.0.0.1           (from the repo root)
//   node dev/online.js [zh|en]
const L = require('./lib');
const assert = require('assert');
const Q = '?ph=127.0.0.1:9000';
(async () => {
  const lang = process.argv[2] || 'zh';
  const b = await L.launch();
  const prefs = JSON.stringify({ hints: 'simple', speed: 'fast' });
  const A = await L.open(b, { lang, query: Q, name: lang == 'zh' ? '阿超' : 'Zed', ls: { mh_mm_prefs: prefs } });
  await A.evaluate(() => document.querySelector('#tabs [data-tab="host"]').click());
  await A.waitForTimeout(300); await L.shot(A, `host-pane-${lang}`);
  await L.click(A, 'btnCreate');
  await L.waitFor(A, () => CXAPP.S && CXAPP.S.room && !document.getElementById('room').hidden && document.getElementById('overlay').hidden);
  const code = await A.evaluate(() => CXAPP.S.code);
  console.log('room', code);
  // the first guest opens the invite link, the second types the code
  const B = await L.open(b, { lang, query: Q, hash: '#' + code, name: lang == 'zh' ? '小林' : 'Lin', ls: { mh_mm_prefs: prefs } });
  await L.waitFor(B, () => CXAPP.S && CXAPP.S.room && !document.getElementById('room').hidden);
  const C = await L.open(b, { lang, query: Q, name: lang == 'zh' ? '豆包' : 'Bea', ls: { mh_mm_prefs: prefs } });
  await C.evaluate(() => document.querySelector('#tabs [data-tab="join"]').click());
  await C.fill('#joinCode', code.toLowerCase());
  await L.click(C, 'btnJoin');
  await L.waitFor(C, () => CXAPP.S && CXAPP.S.room && !document.getElementById('room').hidden);
  await L.waitFor(A, () => CXAPP.S.view.seats.filter(Boolean).length === 3);
  // the host fills the last seat with a Shark
  await A.evaluate(() => document.querySelector('#seats [data-add="3"]').click());
  await L.waitFor(A, () => CXAPP.S.view.seats[3] && CXAPP.S.view.seats[3].bot);
  await A.evaluate(() => document.querySelector('#seats [data-lv="3:3"]').click());
  await L.waitFor(B, () => CXAPP.S.view.seats[3] && CXAPP.S.view.seats[3].lv === 3);
  await A.waitForTimeout(300); await L.shot(A, `room-host-${lang}`); await L.shot(B, `room-guest-${lang}`);
  await A.evaluate(() => document.getElementById('btnStart').click());
  const P = [A, B, C];
  for (const p of P) await L.waitFor(p, () => !document.getElementById('game').hidden);
  const seats = await Promise.all(P.map(p => p.evaluate(() => CXAPP.UI.view.me)));
  console.log('seats', seats.join(','));
  assert.deepStrictEqual(seats.slice().sort(), [0, 1, 2]);
  // nothing private ever reaches a guest: no values on anyone else's hidden tiles, no hand tile in someone else's hand
  const leakCheck = p => p.evaluate(() => {
    const v = CXAPP.UI.view; if (!v || !v.R || v.R.phase === 'end') return '';
    for (const s of v.R.ps) { if (s === v.me || !v.R.rows[s]) continue; for (const t of v.R.rows[s]) if (!t.open && t.v != null) return 'seat ' + s + ' tile ' + t.u; }
    if (v.R.hold && v.R.cur !== v.me && v.R.hold.v != null) return 'hold';
    return '';
  });
  let shotN = 0;
  async function playRound(maxMs, stopAfter) {
    const t0 = Date.now(); let moves = 0;
    while (Date.now() - t0 < maxMs) {
      const ph = await A.evaluate(() => CXAPP.S.table().R.phase);
      if (ph === 'end') return moves;
      for (const p of P) {
        const l = await leakCheck(p); assert.strictEqual(l, '', 'leak: ' + l);
        const d = await L.playMove(p, 2).catch(e => { console.log('move failed', e.message.slice(0, 160)); return ''; });
        if (d) { moves++; if (d === 'guess' && shotN < 2) { await p.waitForTimeout(500); await L.shot(p, `online-guess${shotN++}-${lang}`); } }
      }
      if (stopAfter && moves >= stopAfter) return moves;
      await A.waitForTimeout(120);
    }
    throw new Error('round took too long');
  }
  // a chat line from a guest shows up for everyone
  await B.evaluate(() => CXAPP.S.chat({ p: 2 }));
  await L.waitFor(A, () => [...document.querySelectorAll('.bubble.show')].some(x => x.textContent.length > 0), null, 5000);
  await A.waitForTimeout(200); await L.shot(A, `online-chat-${lang}`);
  // part of a round, then a guest's page reloads (same token): they get the same seat back
  await playRound(60000, 6);
  const bSeat = seats[1];
  await B.reload(); await B.waitForTimeout(500);
  await L.waitFor(B, () => CXAPP.S && CXAPP.S.mode === 'client' && CXAPP.UI.view && !document.getElementById('game').hidden, null, 20000);
  assert.strictEqual(await B.evaluate(() => CXAPP.UI.view.me), bSeat);
  console.log('guest rejoined seat', bSeat);
  const m1 = await playRound(240000);
  console.log('round 1 done, moves', m1);
  for (const p of P) await L.waitFor(p, () => !!document.querySelector('#sheet.on #resFoot'), null, 10000);
  await A.waitForTimeout(300); await L.shot(A, `online-result-host-${lang}`); await L.shot(C, `online-result-guest-${lang}`);
  for (const p of P) await p.evaluate(() => { const b = document.getElementById('btnNext'); if (b) b.click(); });
  for (const p of P) await L.waitFor(p, () => { const v = CXAPP.UI.view; return v && v.R && v.R.no === 2 && v.R.phase !== 'end'; }, null, 15000);
  console.log('round 2 started');
  await playRound(60000, 8);
  await A.waitForTimeout(400); await L.shot(B, `online-r2-guest-${lang}`);
  // the host closes the room: the guests are told
  await A.evaluate(() => CXAPP.S.leave('end'));
  await L.waitFor(B, () => !document.getElementById('overlay').hidden, null, 8000);
  const scores = await A.evaluate(() => CXAPP.S.table().seats.map(p => p && p.name + ':' + p.score));
  console.log('scores', scores.join(' '));
  const bad = L.report(A, B, C);
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
