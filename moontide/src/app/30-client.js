// ===== a guest: connects to the host's room, sends moves, draws whatever the host sends back =====
function startClient(code) {
  S = { mode: 'client', code, isHost: false, view: null, room: null };
  store.set('cd_client', { code, at: Date.now() });
  KeepAlive.mark(LIVE, { kind: 'client', code });
  let peer = null, conn = null, lastMsg = 0, ever = false, dead = false, retryT = 0, fails = 0;
  const giveUp = () => { dead = true; try { peer && peer.destroy(); } catch (e) {} goLobby(); };
  overlay(`<div class="spin"></div><b>${esc(T('connecting', { c: code }))}</b>`, [[T('cancel'), 'glass', giveUp]]);
  const send = m => { if (conn && conn.open) { try { conn.send(m); return true; } catch (e) {} } toast(T('netBad')); return false; };
  S.act = a => (send({ t: 'act', a }) ? 'sent' : 'net');
  S.chat = m => send(Object.assign({ t: 'chat' }, m));
  S.setAuto = on => send({ t: 'act', a: { k: '_auto', on } });
  S.leave = () => new Promise(res => {
    dead = true;
    store.set('cd_client', null); KeepAlive.mark(LIVE, null);
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
    c.on('open', () => { clearTimeout(to); fails = 0; lastMsg = Date.now(); c.send({ t: 'hello', name: myName, av: myAv, token }); });
    c.on('data', m => {
      lastMsg = Date.now();
      if (!m || (dead && m.t !== 'bye')) return;
      if (m.t === 'welcome') { ever = true; S.seat = m.seat; setNet(true); overlay(null); }
      else if (m.t === 'state') { setNet(true); if (!$('overlay').hidden && ever && !confirmOpen()) overlay(null); onView(m.v, m.room); }
      else if (m.t === 'chat') chatIn(m.s, m);
      else if (m.t === 'note') { if (m.k && typeof m.k === 'string' && /^[a-zA-Z]+$/.test(m.k)) toast(T(m.k, m.v && typeof m.v === 'object' ? { n: String(m.v.n || '').slice(0, 12) } : null), 2600); }
      else if (m.t === 'err') {
        if (m.code === 'full') { dead = true; overlay(`<b>${T('full')}</b>`, [[T('backLobby'), 'glass', goLobby]]); store.set('cd_client', null); }
        else if (m.code === 'paused') toast(T('pausedBy'));
        busyOff();
      }
      else if (m.t === 'bye') { if (S.onBye) S.onBye(); }
      else if (m.t === 'kicked') { dead = true; store.set('cd_client', null); overlay(`<b>${T('kicked')}</b>`, [[T('backLobby'), 'glass', goLobby]]); }
      else if (m.t === 'saved') { dead = true; overlay(`<b>${T('saved')}</b>`, [[T('backLobby'), 'glass', goLobby]]); }
      else if (m.t === 'ended') { dead = true; store.set('cd_client', null); if (!(S.view && S.view.g && S.view.g.over)) overlay(`<b>${T('ended')}</b>`, [[T('backLobby'), 'glass', goLobby]]); else S.ended = true; }
    });
    c.on('close', () => { if (c === conn && !dead) { setNet(false); retry(1500); } });
    c.on('error', () => {});
  }
  function overlayNet(txt) { if (S.view && S.room && S.room.started) toast(txt, 3000); else overlay(`<div class="spin"></div><b>${esc(txt)}</b>`, [[T('backLobby'), 'glass', giveUp]]); }
  function retry(ms) { clearTimeout(retryT); retryT = setTimeout(connect, ms); }
  const iv = setInterval(() => {
    if (dead) { clearInterval(iv); return; }
    if (conn && conn.open) { try { conn.send({ t: 'ping' }); } catch (e) {} }
    if (ever && Date.now() - lastMsg > 12000) { setNet(false); lastMsg = Date.now(); try { peer && peer.destroy(); } catch (e) {} connect(); }
  }, 4000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !dead && ever && (!conn || !conn.open || Date.now() - lastMsg > 6000)) { try { peer && peer.destroy(); } catch (e) {} connect(); }
  });
  connect();
}
const confirmOpen = () => !!$('ovCard').querySelector('.btn.red');
function setNet(ok) { const d = $('netDot'); if (!d) return; d.hidden = !!ok || !S || S.mode === 'solo'; d.classList.toggle('bad', !ok); }
function goLobby() {
  KeepAlive.mark(LIVE, null);
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  location.reload();
}
