// ===== a guest: connects to the host's room and shows whatever the host sends =====
function startClient(code) {
  S = { mode: 'client', code, isHost: false, view: null, room: null };
  store.set('mm_client', { code, at: Date.now() });
  KeepAlive.mark('mm_live', { kind: 'client', code });
  let peer = null, conn = null, lastMsg = 0, ever = false, dead = false, retryT = 0, fails = 0;
  const quit = () => { dead = true; try { peer && peer.destroy(); } catch (e) {} goLobby(); };
  overlay(`<div class="spin"></div><b>${esc(T('connecting', { c: code }))}</b>`, [[T('cancel'), 'glass', quit]]);
  const send = m => { if (conn && conn.open) { try { conn.send(m); return true; } catch (e) {} } toast(esc(T('netBad'))); return false; };
  S.act = a => send({ t: 'act', a });
  S.ready = () => send({ t: 'ready' });
  S.chat = m => send(Object.assign({ t: 'chat' }, m));
  S.setAuto = on => send({ t: 'act', a: { k: '_auto', on } });
  S.leave = () => new Promise(res => {
    dead = true;
    store.set('mm_client', null); KeepAlive.mark('mm_live', null);
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
          else { overlay(`<b>${esc(T('notFound', { c: code }))}</b>`, [[T('backLobby'), 'glass', quit]]); retry(5000); }
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
      else if (m.t === 'state') { setNet(true); if (!$('overlay').hidden && ever) overlay(null); if (m.v && m.room) onView(m.v, m.room); }
      else if (m.t === 'chat') chatIn(m.s | 0, m);
      else if (m.t === 'note') toast(esc(String(m.text || '').slice(0, 80)), 2600);
      else if (m.t === 'err') {
        if (m.code === 'full') { dead = true; store.set('mm_client', null); KeepAlive.mark('mm_live', null); overlay(`<b>${esc(T('full'))}</b>`, [[T('backLobby'), 'glass', goLobby]]); return; }
        UI.unlock();
        if (m.code === 'paused') toast(esc(T('pausedBy')));
        else if (m.code === 'turn') toast(esc(T('notTurn')));
      }
      else if (m.t === 'bye') { if (S.onBye) S.onBye(); }
      else if (m.t === 'kicked') { dead = true; store.set('mm_client', null); KeepAlive.mark('mm_live', null); overlay(`<b>${esc(T('kicked'))}</b>`, [[T('backLobby'), 'glass', goLobby]]); }
      else if (m.t === 'saved') { dead = true; overlay(`<b>${esc(T('savedRoom'))}</b>`, [[T('backLobby'), 'glass', goLobby]]); }
      else if (m.t === 'ended') { dead = true; store.set('mm_client', null); KeepAlive.mark('mm_live', null); overlay(`<b>${esc(T('ended'))}</b>`, [[T('backLobby'), 'glass', goLobby]]); }
    });
    c.on('close', () => { if (c === conn && !dead) { setNet(false); retry(1500); } });
    c.on('error', () => {});
  }
  function overlayNet(txt) { if (S.view && S.room && S.room.started) toast(esc(txt), 3000); else overlay(`<div class="spin"></div><b>${esc(txt)}</b>`, [[T('backLobby'), 'glass', quit]]); }
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
function setNet(ok) { const d = $('netDot'); if (!d) return; d.hidden = !!ok || !S || S.mode === 'solo'; d.classList.toggle('bad', !ok); }
function goLobby() {
  KeepAlive.mark('mm_live', null);
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  location.reload();
}
