// ===== a guest: connects to the host's room, plays its own board, and sends the host its big moves, its score and a picture of its board =====
function startClient(code) {
  S = { mode: 'client', code, isHost: false, view: null, room: null, canPause: false, snaps: {}, acc: { n: 0 } };
  // my board in this room's current round, saved every second: a reloaded page picks it up again (see battle())
  const prev = store.get('tt_client');
  S.resume = prev && prev.code === code && prev.rid && prev.G ? { rid: prev.rid, G: prev.G } : null;
  store.set('tt_client', { code, at: Date.now() });
  KeepAlive.mark(LIVE, { kind: 'client', code });
  let peer = null, conn = null, lastMsg = 0, ever = false, dead = false, retryT = 0, fails = 0;
  const giveUp = () => { dead = true; try { peer && peer.destroy(); } catch (e) {} goLobby(); };
  overlay(`<div class="spin"></div><b>${esc(T('connecting', { c: code }))}</b>`, [[T('cancel'), 'glass', giveUp]]);
  const send = (m, quiet) => { if (conn && conn.open) { try { conn.send(m); return true; } catch (e) {} } if (!quiet) toast(T('netBad')); return false; };
  const rdNow = () => S.view && S.view.rd;
  S.chat = m => send(Object.assign({ t: 'chat' }, m));
  // my final score goes again every few seconds until the host has it (a message can be lost while reconnecting)
  let finSc = -1, finRd = 0, finAt = 0;
  S.onEv = (g, e) => {
    if (g !== U.g || U.watching) return;
    const rd = rdNow(); if (!rd) return;
    const n = cagesOf(S.acc, e);
    if (n && rd.atk) { send({ t: 'atk', r: rd.id, n }, true); SND.play('send', 60); }
    if (e.k === 'over') { finSc = g.score; finRd = rd.id; finAt = 0; }
  };
  // a picture of my board for the others, about seven times a second while it changes
  let snapAcc = 0, lastSnap = '', saveAcc = 0, savedRid = 0;
  S.tick = dt => {
    const rd = rdNow(), g = U.g;
    if (!rd || dead) return;
    if (savedRid && (rd.phase === 'over' || rd.id !== savedRid)) { savedRid = 0; store.set('tt_client', { code, at: Date.now() }); }
    if (finRd === rd.id && finSc >= 0 && rd.phase !== 'over' && !(rd.st[S.view.me] && rd.st[S.view.me].fin)) {
      finAt -= dt;
      if (finAt <= 0) { finAt = 2500; send({ t: 'fin', r: rd.id, sc: finSc }, true); }
    }
    if (rd.phase !== 'play' || !g || !g.started || U.watching) return;
    saveAcc += dt;
    if (saveAcc >= 1000 && !g.over) { saveAcc = 0; savedRid = rd.id; store.set('tt_client', { code, at: Date.now(), rid: rd.id, G: g.toJSON() }); }
    snapAcc += dt; if (snapAcc < 140) return; snapAcc = 0;
    const sn = g.snap(), k = sn.b + ':' + sn.s;
    if (k === lastSnap) return; lastSnap = k;
    send({ t: 'snap', r: rd.id, d: sn }, true);
  };
  S.leave = () => new Promise(res => {
    dead = true;
    store.set('tt_client', null); KeepAlive.mark(LIVE, null);
    if (!conn || !conn.open) { try { peer && peer.destroy(); } catch (e) {} return res(); }
    const done = () => { clearTimeout(tm); S.onBye = null; setTimeout(() => { try { peer && peer.destroy(); } catch (e) {} }, 100); res(); };
    const tm = setTimeout(done, 1200);
    S.onBye = done;
    try { conn.send({ t: 'leave' }); } catch (e) { done(); }
  });
  function connect() {
    if (dead) return;
    try { conn && conn.close(); } catch (e) {}
    if (!peer || peer.destroyed || peer.disconnected) {
      try { peer && peer.destroy(); } catch (e) {}
      peer = new Peer(peerOpts());
      peer.on('open', () => dial());
      peer.on('error', err => {
        if (dead) return;
        if (err.type === 'peer-unavailable') {
          if (ever) { setNet(false); overlayNet(T('hostGone')); retry(3000); }
          else { overlay(`<b>${esc(T('notFound', { c: code }))}</b>`, [[T('backLobby'), 'glass', giveUp]]); retry(5000); }
        } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(err.type)) { setNet(false); retry(2500); }
      });
    } else dial();
  }
  function dial() {
    if (dead) return;
    conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
    const c = conn;
    const to = setTimeout(() => { if (c === conn && !c.open) { if (ever) overlayNet(T('slow')); if (++fails % 2 === 0) { try { peer && peer.destroy(); } catch (e) {} } retry(300); } }, 8000);
    c.on('open', () => {
      clearTimeout(to); fails = 0; lastMsg = Date.now();
      const rd = rdNow(), g = U.g;
      c.send({ t: 'hello', name: myName, av: myAv, token, live: rd && g && g.started && !g.over && !U.watching ? rd.id : S.resume ? S.resume.rid : 0 });
      finAt = 0;
    });
    c.on('data', m => {
      lastMsg = Date.now();
      if (!m || (dead && m.t !== 'bye')) return;
      if (m.t === 'welcome') { ever = true; S.seat = m.seat; setNet(true); overlay(null); }
      else if (m.t === 'state') { setNet(true); if (!$('overlay').hidden && ever && !confirmOpen()) overlay(null); if (m.v && m.room) onView(m.v, m.room); }
      else if (m.t === 'snaps') { if (m.d && typeof m.d === 'object') for (const k in m.d) { const s = k | 0, sn = cleanSnap(m.d[k]); if (s >= 0 && s < 4 && sn) S.snaps[s] = sn; } }
      else if (m.t === 'cage') { const rd = rdNow(), g = U.g, n = m.n | 0; if (rd && m.r === rd.id && g && g.started && !g.over && !U.watching && n > 0 && n <= 4) { g.addCages(n); drain(); cagedBy(S.view, m.from | 0); } }
      else if (m.t === 'fx') { if (Number.isInteger(m.a) && Number.isInteger(m.b)) orb(m.a, m.b, clamp(m.n | 0, 1, 4)); }
      else if (m.t === 'chat') chatIn(m.s, m);
      else if (m.t === 'note') { if (m.k && typeof m.k === 'string' && /^[a-zA-Z]+$/.test(m.k)) toast(T(m.k, m.v && typeof m.v === 'object' ? { n: String(m.v.n || '').slice(0, 12) } : null), 2600); }
      else if (m.t === 'err') { if (m.code === 'full') { dead = true; overlay(`<b>${T('full')}</b>`, [[T('backLobby'), 'glass', goLobby]]); store.set('tt_client', null); } }
      else if (m.t === 'bye') { if (S.onBye) S.onBye(); }
      else if (m.t === 'kicked') { dead = true; store.set('tt_client', null); overlay(`<b>${T('kicked')}</b>`, [[T('backLobby'), 'glass', goLobby]]); }
      else if (m.t === 'ended') { dead = true; S.ended = true; store.set('tt_client', null); KeepAlive.mark(LIVE, null); overlay(`<b>${T('ended')}</b>`, [[T('backLobby'), 'glass', goLobby]]); }
    });
    c.on('close', () => { if (c === conn && !dead) { setNet(false); retry(1500); } });
    c.on('error', () => {});
  }
  function overlayNet(txt) { if (screenOn === 'game') toast(txt, 3000); else overlay(`<div class="spin"></div><b>${esc(txt)}</b>`, [[T('backLobby'), 'glass', giveUp]]); }
  function retry(ms) { clearTimeout(retryT); retryT = setTimeout(connect, ms); }
  const iv = setInterval(() => {
    if (dead) { clearInterval(iv); return; }
    if (conn && conn.open) { try { conn.send({ t: 'ping' }); } catch (e) {} }
    if (ever && Date.now() - lastMsg > 9000) { setNet(false); lastMsg = Date.now(); try { peer && peer.destroy(); } catch (e) {} connect(); }
  }, 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !dead && ever && (!conn || !conn.open || Date.now() - lastMsg > 6000)) { try { peer && peer.destroy(); } catch (e) {} connect(); }
  });
  connect();
}
function setNet(ok) { const d = $('netDot'); if (!d) return; d.hidden = !!ok || !S || S.mode === 'solo'; d.classList.toggle('bad', !ok); }
