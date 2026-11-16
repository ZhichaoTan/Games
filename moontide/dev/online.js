// An online room end to end, on a local signalling server: a host (Chinese) and a guest (English) play by real taps,
// with a bot in the third seat. Along the way: chat, the guest's page reloading, the guest closing the page and coming
// back, someone joining mid-game in the bot's seat and leaving again, the host's page reloading, the result, a rematch,
// and the host ending the room.
//   node dev/online.js            (needs: python3 -m http.server 8080 --bind 127.0.0.1  and  npx -p peer peerjs --port 9000 --host 127.0.0.1)
const L = require('./lib');
const assert = require('assert');
const Q = '?ph=127.0.0.1:9000';
const PREFS = JSON.stringify({ speed: 'fast', bot: 2, n: 3, rules: { setup: 'place', timer: 0 } });
// press OK on the confirm box; the page goes back to the lobby by reloading itself
async function okAndBackToLobby(p) {
  await Promise.all([p.waitForEvent('load', { timeout: 10000 }), p.evaluate(() => document.querySelector('#ovCard .btn.red').click())]);
  await L.waitFor(p, () => !document.getElementById('lobby').hidden);
}
const log = (...a) => console.log(new Date().toISOString().slice(14, 19), ...a);
(async () => {
  const b = await L.launch();
  const H = await L.open(b, { lang: 'zh', name: '阿超', query: Q, ls: { mh_cd_prefs: PREFS } });
  const hv = fn => H.evaluate(fn);
  // ----- the room -----
  await H.evaluate(() => document.querySelector('#tabs [data-tab="host"]').click());
  await L.click(H, 'btnCreate');
  await L.waitFor(H, () => !document.getElementById('room').hidden && /^[A-Z0-9]{4}$/.test(document.getElementById('roomCode').textContent) && document.getElementById('overlay').hidden, null, 20000);
  const code = await H.evaluate(() => document.getElementById('roomCode').textContent);
  log('room', code);
  const gctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  let G = await L.open(b, { ctx: gctx, lang: 'en', name: 'Mia', query: Q, hash: '#' + code });
  await L.waitFor(G, () => !document.getElementById('room').hidden && MTAPP.S && MTAPP.S.view, null, 20000);
  await L.waitFor(H, () => MTAPP.S.view.seats[1] && MTAPP.S.view.seats[1].name === 'Mia');
  // the host adds two bots and takes one away again
  await H.evaluate(() => document.querySelector('[data-add="2"]').click());
  await H.evaluate(() => document.querySelector('[data-add="3"]').click());
  await L.waitFor(G, () => MTAPP.S.view.seats.filter(Boolean).length === 4);
  await H.evaluate(() => document.querySelector('[data-kick="3"]').click());
  await L.waitFor(G, () => MTAPP.S.view.seats.filter(Boolean).length === 3 && !MTAPP.S.view.seats[3]);
  assert.ok(await G.evaluate(() => !document.querySelector('#roomActs .btn.gold')), 'only the host gets a Start button');
  await L.shot(H, 'online-zh-room'); await L.shot(G, 'online-en-room');
  await H.evaluate(() => document.querySelector('#roomActs .btn.gold').click());
  await L.waitFor(G, () => !document.getElementById('game').hidden && MTAPP.S.view.g);
  log('started');
  // each reader sees the game in their own language
  assert.ok(/[一-鿿]/.test(await H.evaluate(() => document.getElementById('dkTx').textContent + document.getElementById('tbInfo').textContent)), 'host text in Chinese');
  const gt = await G.evaluate(() => ['dkWho', 'dkTx', 'tbInfo', 'plates'].map(id => document.getElementById(id).textContent).join(' | ').split('阿超').join('NAME'));
  assert.ok(!/[\u4e00-\u9fff]/.test(gt), 'guest text in English: ' + gt);

  // ----- chat: a quick phrase shows on the speaker's plate in each reader's language -----
  await L.click(G, 'btnChat');
  await G.waitForSelector('#sheet [data-p="0"]');
  await G.evaluate(() => document.querySelector('#sheet [data-p="0"]').click());
  await L.waitFor(H, () => { const b = document.querySelector('.plate[data-s="1"] .bub'); return b && b.textContent === MTI18N.t('phrases')[0]; });
  log('chat ok');

  const cH = {}, cG = { snap: async n => { if (n === 'selected' && !cG.shot) { cG.shot = 1; await L.shot(G, 'online-en-turn'); } } };
  let players = [[H, cH], [G, cG]];
  const evn = () => H.evaluate(() => MTAPP.S.view.g.evn);
  async function play(until, ms, label) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await until()) return;
      let acted = false;
      for (const [p, c] of players) if (await L.playStep(p, c) === 'acted') acted = true;
      if (!acted) await H.waitForTimeout(120);
    }
    throw new Error('timed out: ' + label);
  }
  const over = () => H.evaluate(() => MTAPP.S.view.g.over);
  // the setup (everyone places their islanders) and a few turns
  await play(async () => (await H.evaluate(() => !MTAPP.S.view.g.place && MTAPP.S.view.g.sunk >= 2)) || await over(), 120000, 'setup');
  log("setup done, tiles sunk", await H.evaluate(() => MTAPP.S.view.g.sunk));

  // ----- the guest's page reloads (the phone threw it away in the background): straight back into the same seat -----
  await G.reload();
  await L.waitFor(G, () => MTAPP.S && MTAPP.S.mode === 'client' && MTAPP.S.view && MTAPP.S.view.me === 1 && !document.getElementById('game').hidden, null, 25000);
  log('guest reload: back in seat 1');
  let e0 = await evn();
  await play(async () => (await evn()) > e0 + 6 || await over(), 90000, 'after reload');

  // ----- the guest closes the page: the others hear about it, a bot covers their turns, then they come back from the lobby -----
  const gAv = await H.evaluate(() => MTAPP.S.view.seats[1].av);
  await G.close();
  players = [[H, cH]];
  await L.waitFor(H, () => MTAPP.S.view.seats[1].conn === false, null, 20000);
  log('guest dropped');
  e0 = await evn();
  const t1 = await H.evaluate(() => MTAPP.S.view.g.sunk);
  await play(async () => (await H.evaluate(() => MTAPP.S.view.g.sunk)) > t1 + 2 || await over(), 90000, 'while the guest is away');
  log('play went on without the guest');
  G = await L.page(gctx, { lang: 'en', name: 'Mia', query: Q });
  await L.waitFor(G, () => !document.getElementById('resumeBox').hidden && document.querySelector('#resumeBox [data-r="client"]'));
  await L.shot(G, 'online-en-resume');
  await G.evaluate(() => document.querySelector('#resumeBox [data-r="client"]').click());
  await L.waitFor(G, () => MTAPP.S && MTAPP.S.view && MTAPP.S.view.me === 1 && !document.getElementById('game').hidden, null, 25000);
  await L.waitFor(H, () => MTAPP.S.view.seats[1].conn === true);
  assert.strictEqual(await H.evaluate(() => MTAPP.S.view.seats[1].av), gAv, 'the guest comes back with the same avatar');
  log('guest rejoined from the lobby');
  players = [[H, cH], [G, cG]];

  // ----- a third friend opens the link mid-game: they take over the bot's seat, then leave and a bot steps back in -----
  if (!await over()) {
    const X = await L.open(b, { lang: 'en', name: 'Rex', query: Q, hash: '#' + code });
    await L.waitFor(X, () => MTAPP.S && MTAPP.S.view && MTAPP.S.view.me === 2 && !document.getElementById('game').hidden, null, 25000);
    await L.waitFor(H, () => MTAPP.S.view.seats[2].name === 'Rex' && !MTAPP.S.view.seats[2].bot);
    log('Rex took the bot seat');
    players.push([X, {}]);
    e0 = await evn();
    await play(async () => (await evn()) > e0 + 4 || await over(), 60000, 'with Rex');
    await L.click(X, 'btnMenu');
    await X.waitForSelector('#mLeave');
    await X.evaluate(() => document.getElementById('mLeave').click());
    await X.waitForSelector('#ovCard .btn.red');
    await okAndBackToLobby(X);
    await L.waitFor(H, () => MTAPP.S.view.seats[2] && MTAPP.S.view.seats[2].bot);
    players.pop();
    assert.strictEqual(await X.evaluate(() => localStorage.mh_cd_client), undefined, 'leaving forgets the room');
    log('Rex left, a bot is back');
    if (L.report(X)) process.exitCode = 1;
    await X.context().close();
  }

  // ----- the host's page reloads: the room comes back with the same code and the guest finds it again -----
  if (!await over()) {
    const before = await H.evaluate(() => MTAPP.S.view.seats.map(p => p && [p.name, p.av, p.bot]));
    await H.reload();
    await L.waitFor(H, () => MTAPP.S && MTAPP.S.mode === 'host' && MTAPP.S.view && MTAPP.S.view.g && MTAPP.S.room.code, null, 25000);
    assert.strictEqual(await H.evaluate(() => MTAPP.S.room.code), code);
    assert.deepStrictEqual(await H.evaluate(() => MTAPP.S.view.seats.map(p => p && [p.name, p.av, p.bot])), before, 'the same seats after the host reloads');
    await L.waitFor(H, () => MTAPP.S.view.seats[1].conn === true && !MTAPP.S.room.paused, null, 40000);
    log('host reload: guest reconnected, game resumed');
  }

  // ----- to the end -----
  await play(over, 400000, 'to the end');
  await L.waitFor(G, () => MTAPP.S.view.g.over && document.getElementById('resFoot'), null, 20000);
  await H.waitForTimeout(800);
  await L.shot(H, 'online-zh-result'); await L.shot(G, 'online-en-result');
  const res = await H.evaluate(() => MTAPP.S.view.g.res);
  log('result', JSON.stringify(res.rows.map(r => [r.s, r.pts, r.saved + '/' + r.of])), res.why);
  assert.ok(await G.evaluate(() => [...document.querySelectorAll('#resFoot .btn')].length >= 1));
  // a rematch: the host presses Play again and the guest is dealt in
  await H.evaluate(() => [...document.querySelectorAll('#resFoot .btn')][0].click());
  await L.waitFor(G, () => MTAPP.S.room.gid === 2 && MTAPP.S.view.g && !MTAPP.S.view.g.over, null, 20000);
  await L.waitFor(G, () => !document.getElementById('sheet').classList.contains('on'));
  log('rematch dealt');
  // the host ends the room: the guest is told, and the room is forgotten
  await L.click(H, 'btnMenu');
  await H.waitForSelector('#mEnd');
  await H.evaluate(() => document.getElementById('mEnd').click());
  await H.waitForSelector('#ovCard .btn.red');
  await okAndBackToLobby(H);
  await L.waitFor(G, () => !document.getElementById('overlay').hidden && document.getElementById('ovCard').textContent.includes(MTI18N.t('ended')), null, 15000);
  assert.strictEqual(await G.evaluate(() => localStorage.mh_cd_client), undefined, 'an ended room is forgotten');
  await L.shot(G, 'online-en-ended');
  log('room ended');
  const bad = L.report(H, G);
  if (bad) process.exitCode = 1;
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
