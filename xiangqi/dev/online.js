// Two browsers on a local PeerServer: create a room, join by link, play, undo, draw offer, chat, reconnect, resign, rematch.
//   npx -p peer peerjs --port 9000 --host 127.0.0.1      (signalling)
//   python3 -m http.server 8080 --bind 127.0.0.1          (from the repo root)
//   node dev/online.js [zh|en]
const L = require('./lib');
const assert = require('assert');
const Q = '?ph=127.0.0.1:9000';
(async () => {
  const lang = process.argv[2] || 'zh';
  const b = await L.launch();
  const A = await L.open(b, { lang, query: Q, name: lang == 'zh' ? '阿超' : 'Zed' });
  // host a room: host plays red, 10 minute clocks
  await A.evaluate(() => { document.querySelector('#tabs [data-tab="host"]').click(); });
  await A.waitForTimeout(300); await L.shot(A, `host-pane-${lang}`);
  await A.evaluate(() => { const D = XQAPP.DB.settings; D.hostSide = 'red'; D.hostClock = 10; });
  await L.click(A, 'btnCreate');
  await L.waitFor(A, () => XQAPP.S && XQAPP.S.room && !document.getElementById('room').hidden);
  const code = await A.evaluate(() => XQAPP.S.code);
  console.log('room', code);
  await A.waitForTimeout(400); await L.shot(A, `room-wait-${lang}`);
  // the guest opens the invite link
  const B = await L.open(b, { lang, query: Q, hash: '#' + code, name: lang == 'zh' ? '小林' : 'Lin' });
  await L.waitFor(B, () => XQAPP.S && XQAPP.S.room && !document.getElementById('room').hidden);
  await L.waitFor(A, () => { const p = XQAPP.S.room.p[1]; return p && p.on; });
  await A.waitForTimeout(500); await L.shot(A, `room-host-${lang}`); await L.shot(B, `room-guest-${lang}`);
  await A.evaluate(() => document.querySelector('#roomActs .btn').click());
  await L.waitFor(A, () => XQAPP.G.mode == 'net'); await L.waitFor(B, () => XQAPP.G.mode == 'net');
  assert.strictEqual(await A.evaluate(() => XQAPP.G.side), 0); assert.strictEqual(await B.evaluate(() => XQAPP.G.side), 1);
  await A.waitForTimeout(3200);
  const P = [A, B];
  const play = async n => {
    for (let i = 0; i < n; i++) {
      const len = await A.evaluate(() => XQAPP.G.moves.length), who = P[len % 2];
      await L.waitFor(who, len => XQAPP.G.moves.length == len && !XQAPP.G.thinking, len);
      const mv = await L.anyMove(who, 60); await L.move(who, mv);
      await L.waitFor(A, len => XQAPP.G.moves.length == len + 1, len); await L.waitFor(B, len => XQAPP.G.moves.length == len + 1, len);
      await A.waitForTimeout(260);
    }
  };
  await play(7);
  await L.shot(A, `net-host-${lang}`); await L.shot(B, `net-guest-${lang}`);
  // the guest cannot move on red's turn... and the host cannot move twice
  await play(1);
  // undo: the guest (black) just moved; it asks to take back, the host accepts
  let len = await A.evaluate(() => XQAPP.G.moves.length);
  await L.click(B, 'tUndo'); await A.waitForTimeout(600);
  await L.shot(A, `net-ask-undo-${lang}`); await L.shot(B, `net-ask-wait-${lang}`);
  await A.evaluate(() => document.querySelector('#ovCard .btn.gold, #ovCard .btn.primary').click());
  await L.waitFor(A, len => XQAPP.G.moves.length < len, len);
  const len2 = await A.evaluate(() => XQAPP.G.moves.length);
  await L.waitFor(B, l => XQAPP.G.moves.length == l, len2);
  console.log('undo', len, '->', len2, 'turn side', len2 % 2);
  assert.strictEqual(len2 % 2, 1, 'after the undo it is black (the asker) to move');
  // draw offer from the host, declined
  await play(1);
  await L.click(A, 'tDraw'); await A.waitForTimeout(400);
  await A.evaluate(() => document.querySelector('#ovCard .btn.gold').click());
  await L.waitFor(B, () => XQAPP.S.room.ask && !document.getElementById('overlay').hidden);
  await B.waitForTimeout(400); await L.shot(B, `net-ask-draw-${lang}`); await L.shot(A, `net-ask-draw-wait-${lang}`);
  await B.evaluate(() => { const bs = document.querySelectorAll('#ovCard .btn'); bs[0].click(); });
  await L.waitFor(A, () => !XQAPP.S.room.ask);
  await A.waitForTimeout(700); await L.shot(A, `net-draw-no-${lang}`);
  assert.strictEqual(await A.evaluate(() => XQAPP.G.over), false);
  // chat
  await L.click(B, 'btnChat'); await B.waitForTimeout(400); await L.shot(B, `chat-${lang}`);
  await B.evaluate(() => document.querySelector('#sheet [data-e]').click());
  await A.waitForTimeout(600); await L.shot(A, `net-chat-${lang}`);
  await B.evaluate(() => { const x = document.querySelector('#sheet [data-close]'); if (x) x.click(); });
  // the guest reloads the page and comes back into the same game
  len = await A.evaluate(() => XQAPP.G.moves.length);
  await B.reload(); await B.waitForTimeout(600);
  await L.shot(B, `net-resume-box-${lang}`);
  if (await B.evaluate(() => !XQAPP.S)) await B.evaluate(() => { const r = document.querySelector('#resumeBox button'); if (r) r.click(); });
  await L.waitFor(B, len => XQAPP.S && XQAPP.G.mode == 'net' && XQAPP.G.moves.length == len, len, 20000);
  console.log('guest reconnected at ply', len);
  await play(4);
  await L.shot(A, `net-host2-${lang}`); await L.shot(B, `net-guest2-${lang}`);
  // the host reloads too (the room is restored from storage, the guest reconnects by itself)
  len = await A.evaluate(() => XQAPP.G.moves.length);
  await A.reload(); await A.waitForTimeout(600);
  await L.shot(A, `net-host-resume-box-${lang}`);
  if (await A.evaluate(() => !XQAPP.S)) await A.evaluate(() => { const r = document.querySelector('#resumeBox button'); if (r) r.click(); });
  await L.waitFor(A, len => XQAPP.S && XQAPP.G.mode == 'net' && XQAPP.G.moves.length == len, len, 20000);
  await L.waitFor(A, () => XQAPP.S.room.p[1].on, null, 30000);
  await L.waitFor(B, () => XQAPP.S.room.p[0].on !== false && XQAPP.S.net !== false, null, 30000);
  console.log('host restored at ply', len);
  await play(2);
  // resign: whoever is to move
  len = await A.evaluate(() => XQAPP.G.moves.length);
  await L.click(B, 'tResign'); await B.waitForTimeout(400);
  await B.evaluate(() => document.querySelector('#ovCard .btn.danger, #ovCard .btn:last-child').click());
  await L.waitFor(A, () => XQAPP.G.over); await L.waitFor(B, () => XQAPP.G.over);
  await A.waitForTimeout(1800); await L.shot(A, `net-result-host-${lang}`); await L.shot(B, `net-result-guest-${lang}`);
  const score = await A.evaluate(() => XQAPP.S.room.score); console.log('score', JSON.stringify(score));
  assert.deepStrictEqual(score, [1, 0, 0]);
  // rematch: both press it, sides swap
  const again = p => p.evaluate(() => { const b = document.querySelector('#resFoot [data-x="again"]') || document.querySelector('#resFoot .btn.gold'); b.click(); });
  await again(B); await A.waitForTimeout(500); await L.shot(A, `net-rematch-wait-${lang}`);
  await again(A);
  await L.waitFor(A, () => !XQAPP.G.over && XQAPP.G.moves.length == 0 && XQAPP.S.room.gameNo == 2, null, 10000);
  await L.waitFor(B, () => !XQAPP.G.over && XQAPP.G.moves.length == 0);
  assert.strictEqual(await A.evaluate(() => XQAPP.G.side), 1, 'sides swap on a rematch'); assert.strictEqual(await B.evaluate(() => XQAPP.G.side), 0);
  P.reverse(); await A.waitForTimeout(600); await play(3);
  await L.shot(A, `net-game2-host-${lang}`);
  // the guest leaves in the middle: the host wins
  await L.click(B, 'btnMenu'); await B.waitForTimeout(400); await L.shot(B, `net-menu-${lang}`);
  await B.evaluate(() => { const x = [...document.querySelectorAll('#sheet .item')].pop(); x.click(); }); await B.waitForTimeout(400);
  await L.shot(B, `net-leave-${lang}`);
  await B.evaluate(() => document.querySelector('#ovCard .btn.danger, #ovCard .btn:last-child').click());
  await L.waitFor(A, () => XQAPP.G.over, null, 10000);
  await A.waitForTimeout(1800); await L.shot(A, `net-left-host-${lang}`);
  await B.waitForTimeout(600); await L.shot(B, `net-left-guest-${lang}`);
  const bad = L.report(A, B);
  await b.close();
  console.log(bad ? 'FAILED' : 'online ok');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
