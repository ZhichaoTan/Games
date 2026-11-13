// ===== online play: a two-seat room over PeerJS. The host's page is the referee; the guest sends requests =====
let S = null;
const PREFIX = 'yejuxq-v1-';
const ICE = [
  { urls: 'stun:stun.miwifi.com:3478' }, { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];
function peerOpts(tok) {
  const o = { config: { iceServers: ICE, iceCandidatePoolSize: 4 }, debug: 1 };
  if (tok) o.token = tok; // the host keeps one token per room, so a reloaded or rebuilt page takes the room id straight back
  const ph = qs.get('ph'); // a local PeerServer, for tests
  if (ph) { const [h, p] = ph.split(':'); Object.assign(o, { host: h, port: +p || 9000, path: '/', secure: false, config: { iceServers: [] } }); }
  return o;
}
const inviteUrl = code => location.origin + location.pathname + '#' + code;
function invite(code, share) {
  const text = T('invite', { c: code, u: inviteUrl(code) });
  if (share && navigator.share) { navigator.share({ title: T('title'), text, url: inviteUrl(code) }).catch(() => {}); return; }
  copyText(text).then(ok => toast(ok ? T('copied') : esc(text), 3200));
}
function setNet(ok) { const d = $('netDot'); d.hidden = !!ok || !S; d.classList.toggle('bad', !ok); }
function reloadLobby() {
  KeepAlive.mark('xq_live', null);
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  location.reload();
}
function leaveRoom(sure) {
  const live = S && S.room && S.room.started && !S.room.over;
  const go = async () => { overlay(null); closeSheet(); if (S && S.leave) await S.leave(); reloadLobby(); };
  if (live && !sure) confirmBox(T('leaveQ'), T(S.isHost ? 'leaveSubHost' : 'leaveSub'), T('leaveRoom'), go); else go();
}
function netNote(k, v) { const o = {}; for (const x in (v || {})) o[x] = esc(String(v[x]).slice(0, 20)); const s = T('n_' + k, o); if (s) toast(s, 2800); }
function cleanChat(m) {
  if (!m) return null;
  if (m.emo && EMOS.includes(m.emo)) return { emo: m.emo };
  const t = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return t ? { text: t } : null;
}

// ---------- host ----------
function startHost(o) {
  const restore = o.restore || null, st = DB.settings;
  let code = restore ? restore.code : rid(4);
  const room = restore ? restore.room : { code, started: false, gameNo: 0, gid: 0, p: [null, null], red: 0, opt: { side: st.hostSide, clock: st.hostClock }, moves: '', over: null, ask: null, ready: [false, false], score: [0, 0, 0], clk: null };
  const tokens = restore && restore.tokens ? restore.tokens : [token, ''];
  room.p[0] = { name: myName, av: myAv, on: true };
  if (room.p[1]) room.p[1].on = false;
  room.ask = null; if (room.clk) room.clk.run = -1;
  let conn = null, seen = 0, peer = null, closing = false, tries = 0, askSeq = 0, clkT0 = 0, flagT = 0, syncQ = false;
  const lastAsk = [{}, {}], pos = new E.Position();
  S = { mode: 'host', isHost: true, code, me: 0, room: null, clkAt: 0 };
  const moves = () => strMv(room.moves);
  const turn = () => (room.moves.length / 4) % 2;          // side to move: 0 red, 1 black
  const sideOfP = i => i == room.red ? 0 : 1, pOfSide = sd => sd == 0 ? room.red : 1 - room.red;
  const guestOn = () => !!(room.p[1] && room.p[1].on && !room.p[1].gone);
  const send = m => { if (conn && conn.open) { try { conn.send(m); } catch (e) {} } };
  const note = (i, k, v) => { if (i == 0) netNote(k, v); else send({ t: 'note', k, v }); };
  const noteAll = (k, v) => { note(0, k, v); note(1, k, v); };

  // clocks: each side's time runs only on its own turn, and only while both players are connected
  let lost0 = 0; // the host page being frozen in the background doesn't cost anyone time
  function clkNow() { const l = room.clk.left.slice(); if (clkT0) l[turn()] = Math.max(0, l[turn()] - Math.max(0, Date.now() - clkT0 - (KeepAlive.lost() - lost0))); return l; }
  function clkStop() { clearTimeout(flagT); if (room.clk) { if (clkT0) room.clk.left = clkNow(); room.clk.run = -1; } clkT0 = 0; }
  function clkGo() {
    clkStop();
    if (!room.clk || !room.started || room.over || !guestOn()) return;
    clkT0 = Date.now(); lost0 = KeepAlive.lost(); room.clk.run = turn();
    flagT = setTimeout(() => { if (room.over || !clkT0) return; if (clkNow()[turn()] <= 0) { finish({ winner: 1 - turn(), reason: 'time' }); sync(); } else clkGo(); }, room.clk.left[turn()] + 60);
  }
  function view() { const r = JSON.parse(JSON.stringify(room)); if (r.clk) r.clk.left = clkNow(); return r; }
  function sync() {
    if (syncQ) return; syncQ = true;
    Promise.resolve().then(() => {
      syncQ = false;
      if (closing) return;
      const v = view();
      store.set('xq_host', { code, room: v, tokens, at: Date.now() });
      onRoom(v, 0);
      send({ t: 'state', room: v, me: 1 });
    });
  }
  function begin() {
    if (!guestOn()) return;
    room.started = true; room.gameNo++; room.gid = Date.now(); room.moves = ''; room.over = null; room.ask = null; room.ready = [false, false];
    lastAsk[0] = {}; lastAsk[1] = {};
    // the first game follows the room setting; after that the two swap sides every game
    if (room.gameNo == 1) room.red = room.opt.side == 'red' ? 0 : room.opt.side == 'black' ? 1 : (Math.random() < .5 ? 0 : 1); else room.red = 1 - room.red;
    room.clk = room.opt.clock ? { left: [room.opt.clock * 60000, room.opt.clock * 60000], run: -1 } : null;
    clkGo(); sync();
  }
  function finish(end) {
    clkStop(); room.over = end; room.ask = null;
    if (end.winner == -1) room.score[2]++; else room.score[pOfSide(end.winner)]++;
  }
  function doMove(i, uci, n) {
    if (!room.started || room.over) return 'over';
    const mv = moves();
    if (n != null && n !== mv.length) return 'stale';
    if (sideOfP(i) != mv.length % 2) return 'turn';
    pos.fromMoves(mv);
    const m = uci2mv(String(uci || ''));
    if (!m || pos.legalMoves().indexOf(m) < 0) return 'bad';
    if (room.clk && clkT0) room.clk.left = clkNow();
    clkT0 = 0;
    room.moves += mv2uci(m); room.ask = null;
    pos.fromMoves(mv.concat(m));
    const end = checkEnd(pos);
    if (end) finish(end); else clkGo();
    sync(); return 'ok';
  }
  // how many moves an undo takes back: mine and the reply if it is my turn again, otherwise just my last one
  const undoCount = i => sideOfP(i) == turn() ? 2 : 1;
  function ask(i, k) {
    if (!room.started || room.over || room.ask || (k != 'undo' && k != 'draw')) return;
    const n = room.moves.length / 4;
    if (k == 'undo' && n < undoCount(i)) return;
    if (!guestOn()) { note(i, 'askOff'); return; }
    if (lastAsk[i][k] === n) { note(i, 'askOnce'); return; }
    lastAsk[i][k] = n;
    room.ask = { k, by: i, id: ++askSeq };
    sync();
  }
  function answer(i, ok) {
    const a = room.ask; if (!a || a.by == i || room.over) return;
    room.ask = null;
    if (!ok) note(a.by, a.k == 'undo' ? 'undoNo' : 'drawNo');
    else if (a.k == 'draw') finish({ winner: -1, reason: 'agree' });
    else {
      const n = room.moves.length / 4, c = Math.min(n, undoCount(a.by));
      if (room.clk && clkT0) room.clk.left = clkNow();
      clkT0 = 0;
      room.moves = room.moves.slice(0, (n - c) * 4);
      clkGo(); noteAll('undoYes');
    }
    sync();
  }
  function resign(i) { if (!room.started || room.over) return; finish({ winner: 1 - sideOfP(i), reason: 'resign' }); sync(); }
  function ready(i) { if (!room.started || !room.over) return; room.ready[i] = true; if (room.ready[0] && room.ready[1] && guestOn()) begin(); else sync(); }
  function chat(i, m) { const msg = cleanChat(m); if (!msg) return; if (screen() == 'game') bubble(i == 0, msg.emo || msg.text, !!msg.emo); send({ t: 'chat', by: i, text: msg.text, emo: msg.emo }); }
  // back to the waiting room (after the guest has left for good)
  function reopen() {
    clkStop(); room.started = false; room.over = null; room.moves = ''; room.ask = null; room.score = [0, 0, 0]; room.gameNo = 0; room.clk = null; room.ready = [false, false];
    if (room.p[1] && room.p[1].gone) { room.p[1] = null; tokens[1] = ''; }
  }

  S.move = (uci, n) => { if (doMove(0, uci, n) != 'ok') sync(); };
  S.ask = k => ask(0, k);
  S.answer = ok => answer(0, ok);
  S.cancelAsk = () => { if (room.ask && room.ask.by == 0) { room.ask = null; sync(); } };
  S.resign = () => resign(0);
  S.ready = () => ready(0);
  S.chat = m => chat(0, m);
  S.start = () => begin();
  S.reopen = () => { reopen(); sync(); };
  S.setOpt = (k, v) => { if (room.started) return; room.opt[k] = v; st[k == 'side' ? 'hostSide' : 'hostClock'] = v; save(); sync(); };
  S.kick = () => {
    if (room.started) return;
    const c = conn; conn = null;
    if (c) { c._ok = false; try { c.send({ t: 'kicked' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 300); }
    room.p[1] = null; tokens[1] = ''; sync();
  };
  S.leave = async () => {
    closing = true; clkStop();
    store.set('xq_host', null); KeepAlive.release(); KeepAlive.mark('xq_live', null);
    send({ t: 'ended' });
    await sleep(400);
    try { peer && peer.destroy(); } catch (e) {}
  };

  function onData(c, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      const name = String(m.name || '').trim().slice(0, 10) || 'Guest', tk = String(m.token || '').slice(0, 40), av = clamp(m.av | 0, 0, AV.AVATARS.length - 1);
      const cur = room.p[1] && !room.p[1].gone ? room.p[1] : null;
      // the seat is taken by someone else who is connected right now
      if (cur && tokens[1] !== tk && cur.on && conn && conn.open && conn !== c) { try { c.send({ t: 'err', code: 'full' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 600); return; }
      const back = !!cur && tokens[1] === tk;
      // an empty seat, or one whose player went offline (they may have reopened the link in another browser)
      if (!cur && room.started) reopen();
      room.p[1] = { name, av, on: true }; tokens[1] = tk;
      const old = conn; conn = c; c._ok = true; seen = Date.now();
      if (old && old !== c) { old._ok = false; try { old.close(); } catch (e) {} }
      try { c.send({ t: 'welcome', me: 1 }); } catch (e) {}
      if (!back) { note(0, 'joined', { n: name }); AU.ping(); } else if (room.started) note(0, 'isBack', { n: name });
      if (room.started && !room.over) clkGo();
      sync(); return;
    }
    if (c !== conn || !c._ok) return;
    seen = Date.now();
    if (m.t === 'ping') send({ t: 'pong' });
    else if (m.t === 'move') { const r = doMove(1, m.mv, m.n == null ? null : m.n | 0); if (r != 'ok') sync(); }
    else if (m.t === 'ask') ask(1, String(m.k));
    else if (m.t === 'answer') answer(1, !!m.ok);
    else if (m.t === 'cancelAsk') { if (room.ask && room.ask.by == 1) { room.ask = null; sync(); } }
    else if (m.t === 'resign') resign(1);
    else if (m.t === 'ready') ready(1);
    else if (m.t === 'chat') chat(1, m);
    else if (m.t === 'leave') {
      const p = room.p[1]; c._ok = false; conn = null;
      try { c.send({ t: 'bye' }); } catch (e) {}
      if (room.started && !room.over) finish({ winner: sideOfP(0), reason: 'left' });
      clkStop(); room.ask = null;
      if (room.started) { p.on = false; p.gone = true; } else room.p[1] = null;
      tokens[1] = '';
      note(0, 'leftRoom', { n: p ? p.name : '' });
      sync();
    }
  }
  function onClose(c) {
    if (c !== conn) return;
    conn = null;
    const p = room.p[1];
    if (p && !p.gone) { p.on = false; if (!closing) note(0, 'dropped', { n: p.name }); }
    if (room.ask) room.ask = null;
    clkStop(); sync();
  }
  function openPeer(first) {
    if (closing) return;
    const pr = peer = new Peer(PREFIX + code, peerOpts(KeepAlive.token(PREFIX + code)));
    pr.on('open', () => { if (pr !== peer) return; tries = 0; setNet(true); if (ovTag == 'net') { overlay(null); if (first) toast(T('kaTip'), 4200); } sync(); });
    pr.on('connection', c => {
      c.on('data', m => onData(c, m));
      c.on('close', () => onClose(c));
      c.on('error', () => {});
    });
    pr.on('disconnected', () => { if (pr !== peer) return; setNet(false); setTimeout(() => { if (pr === peer && !pr.destroyed && pr.disconnected && !closing) { try { pr.reconnect(); } catch (e) {} } }, 1500); });
    pr.on('error', err => {
      if (closing || pr !== peer) return;
      if (err.type === 'unavailable-id') {
        if (!restore && first && !room.p[1]) { try { peer.destroy(); } catch (e) {} code = rid(4); room.code = code; S.code = code; openPeer(true); return; }
        if (++tries < 30) { setNet(false); try { peer.destroy(); } catch (e) {} setTimeout(() => openPeer(first), 3000); }
        else toast(T('idTaken'));
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
        setNet(false); setTimeout(() => { if (closing) return; if (peer.destroyed) openPeer(first); else if (peer.disconnected) try { peer.reconnect(); } catch (e) {} }, 3000);
      }
    });
  }
  // back from the background: get the signalling link back (same token, same room id) and give the guest time to reconnect
  KeepAlive.onResume(info => {
    if (closing) return;
    if (conn) seen = Math.max(seen, Date.now() - 4000);
    if (info.away < 3000 && !info.online) return;
    if (info.frozen > 20000 || !peer || peer.destroyed) { try { peer && peer.destroy(); } catch (e) {} openPeer(false); }
    else if (!KeepAlive.live(peer)) { if (peer.disconnected) { try { peer.reconnect(); } catch (e) {} } else { try { peer.destroy(); } catch (e) {} openPeer(false); } }
  });
  let hbAt = Date.now();
  const hb = setInterval(() => {
    if (closing) { clearInterval(hb); return; }
    const now = Date.now();
    if (now - hbAt > 6000) { hbAt = now; seen = now; return; } // the page was just frozen: don't call the guest gone yet
    hbAt = now;
    if (conn && Date.now() - seen > 11000) { const c = conn; onClose(c); c._ok = false; try { c.close(); } catch (e) {} }
  }, 3000);
  overlay(`<div class="spin"></div><b>${T('opening')}</b>`, [[T('cancel'), 'glass', () => { closing = true; KeepAlive.release(); store.set('xq_host', restore ? restore : null); try { peer && peer.destroy(); } catch (e) {} reloadLobby(); }]], 'net');
  KeepAlive.mark('xq_live', { kind: 'host' });
  KeepAlive.hold(T('kaTitle', { c: code }));
  openPeer(true);
}

// ---------- guest ----------
function startClient(code) {
  S = { mode: 'client', isHost: false, code, me: 1, room: null, clkAt: 0 };
  store.set('xq_client', { code, at: Date.now() });
  KeepAlive.mark('xq_live', { kind: 'client', code });
  let peer = null, conn = null, lastMsg = 0, ever = false, dead = false, retryT = 0, fails = 0;
  const quit = () => { dead = true; try { peer && peer.destroy(); } catch (e) {} reloadLobby(); };
  overlay(`<div class="spin"></div><b>${T('connecting', { c: esc(code) })}</b>`, [[T('cancel'), 'glass', quit]], 'net');
  const send = m => { if (conn && conn.open) { try { conn.send(m); return true; } catch (e) {} } toast(T('netBad')); return false; };
  S.move = (uci, n) => send({ t: 'move', mv: uci, n });
  S.ask = k => send({ t: 'ask', k });
  S.answer = ok => send({ t: 'answer', ok });
  S.cancelAsk = () => send({ t: 'cancelAsk' });
  S.resign = () => send({ t: 'resign' });
  S.ready = () => send({ t: 'ready' });
  S.chat = m => send(Object.assign({ t: 'chat' }, m));
  S.leave = () => new Promise(res => {
    dead = true;
    store.set('xq_client', null);
    if (!conn || !conn.open) { try { peer && peer.destroy(); } catch (e) {} return res(); }
    const done = () => { clearTimeout(tm); S.onBye = null; setTimeout(() => { try { peer && peer.destroy(); } catch (e) {} }, 100); res(); };
    const tm = setTimeout(done, 1200);
    S.onBye = done;
    try { conn.send({ t: 'leave' }); } catch (e) { done(); }
  });
  const lobbyBtn = [[T('backLobby'), 'glass', quit]];
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
          else { overlay(`<b>${esc(T('notFound', { c: code }))}</b>`, lobbyBtn, 'net'); retry(5000); }
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
      if (m.t === 'welcome') { ever = true; S.me = m.me; setNet(true); if (ovTag == 'net') overlay(null); }
      else if (m.t === 'state') { setNet(true); if (ovTag == 'net' && ever) overlay(null); onRoom(m.room, m.me); }
      else if (m.t === 'chat') { const msg = cleanChat(m); if (msg && screen() == 'game') bubble(m.by === S.me, msg.emo || msg.text, !!msg.emo); }
      else if (m.t === 'note') netNote(String(m.k), m.v);
      else if (m.t === 'err') { if (m.code === 'full') { dead = true; store.set('xq_client', null); overlay(`<b>${T('full')}</b>`, lobbyBtn, 'net'); } }
      else if (m.t === 'bye') { if (S.onBye) S.onBye(); }
      else if (m.t === 'kicked') { dead = true; store.set('xq_client', null); overlay(`<b>${T('kicked')}</b>`, lobbyBtn, 'net'); }
      else if (m.t === 'ended') {
        dead = true; store.set('xq_client', null);
        // the host closed the room in the middle of a game: that counts as the host leaving
        if (S.room && S.room.started && !S.room.over && G.mode == 'net') { const r = Object.assign({}, S.room, { over: { winner: G.side, reason: 'left' } }); r.p = r.p.slice(); r.p[0] = Object.assign({}, r.p[0], { on: false, gone: true }); r.score = r.score.slice(); r.score[1]++; S.dead = true; onRoom(r, S.me); }
        else if (S.room && S.room.started && S.room.over) { const r = Object.assign({}, S.room); r.p = r.p.slice(); r.p[0] = Object.assign({}, r.p[0], { on: false, gone: true }); S.dead = true; onRoom(r, S.me); toast(T('ended'), 3000); }
        else overlay(`<b>${T('ended')}</b>`, lobbyBtn, 'net');
      }
    });
    c.on('close', () => { if (c === conn && !dead) { setNet(false); retry(1500); } });
    c.on('error', () => {});
  }
  function overlayNet(txt) { if (S.room && S.room.started) toast(esc(txt), 3000); else overlay(`<div class="spin"></div><b>${esc(txt)}</b>`, lobbyBtn, 'net'); }
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

// ---------- the room as each player sees it ----------
function onRoom(room, me) {
  if (!S) return;
  S.room = room; S.me = me; S.clkAt = Date.now(); S.code = room.code;
  const scr = screen(), away = scr == 'review' || scr == 'explore';
  if (!room.started) {
    if (!away) renderRoom(room, me);
    handleAsk(room, me);
    return;
  }
  const mvs = strMv(room.moves);
  if (G.mode != 'net' || G.id != room.gid) { if (away) return; netBegin(room, me, mvs); }
  else netSync(room, me, mvs);
  if (room.over && !G.over) netOver(room, me);
  handleAsk(room, me);
  if (sheetOn == 'result' && G.rec) resultFoot(G.rec);
}
// coming back from the review of an online game
function resumeSession() {
  const r = S.room;
  if (r && r.started && G.mode == 'net' && G.id == r.gid) { show('game'); requestAnimationFrame(() => { sizeGame(); renderGame(false); if (G.over && G.rec) showResult(G.rec); }); }
  else if (r) onRoom(r, S.me);
}
function netBegin(room, me, mvs) {
  Eng.cancel(); exClose(); closeSheet();
  Object.assign(G, { mode: 'net', moves: mvs.slice(), level: 0, side: me == room.red ? 0 : 1, over: false, rec: null, thinking: false, sel: -1, hint: 0, token: G.token + 1,
    base: 0, hints: 0, undos: 0, id: room.gid, t: Date.now(), engine: null });
  G.pos.fromMoves(G.moves);
  setPlates(); show('game');
  gb.clear(); gb.setFlip(G.side == 1); $('gBoard').classList.remove('facing');
  requestAnimationFrame(() => { sizeGame(); renderGame(false); });
  setTicker(-1);
  if (!room.over) { AU.start(); toast(T(G.side == 0 ? 'youRed' : 'youBlack'), 2800); }
}
function netSync(room, me, mvs) {
  const old = G.moves, n = old.length;
  const same = mvs.length >= n && old.every((m, i) => m == mvs[i]);
  if (same && mvs.length == n + 1) {
    // a move from the other side. While I am trying moves out, the real game only updates underneath
    if (G.ex) { const t = notation(G.pos, mvs[n]); G.moves.push(mvs[n]); G.pos.fromMoves(G.moves); toast(T('oppMoved', { m: `<b>${t}</b>` }), 2800); AU.place(); }
    else playMove(mvs[n], false);
  } else if (!same || mvs.length != n) {
    G.moves = mvs.slice(); G.pos.fromMoves(G.moves); G.sel = -1; G.hint = 0;
    if (!G.ex) { renderGame(true); setTicker(-1); if (mvs.length < n) AU.place(); }
  }
  setPlates();
  if (!G.ex) renderGame(false);
}
function netOver(room, me) {
  const o = room.over;
  G.over = true; G.thinking = false; G.sel = -1;
  if (G.ex) { exClose(); gb.setFlip(G.side == 1); requestAnimationFrame(() => { sizeGame(); renderGame(true); }); }
  let rec = DB.history.find(h => h.id == room.gid && h.mode == 'net');
  const isNew = !rec;
  if (isNew) {
    const opp = room.p[1 - me] || {}, result = o.winner == -1 ? 'draw' : o.winner == G.side ? 'win' : 'loss';
    rec = { id: room.gid, t: Date.now(), mode: 'net', level: 0, side: G.side, moves: G.moves.slice(), base: 0, result, winner: o.winner, reason: o.reason, opp: { name: opp.name, av: opp.av }, hints: 0, undos: 0 };
    addHistory(rec);
    const st = DB.stats.net || { w: 0, d: 0, l: 0 }; st[result == 'win' ? 'w' : result == 'loss' ? 'l' : 'd']++; DB.stats.net = st;
    save(); endSounds(rec);
  }
  G.rec = rec; renderGame(false);
  setTimeout(() => { if (G.rec === rec && screen() == 'game' && sheetOn != 'result') showResult(rec); }, isNew ? 900 : 150);
}
// a request to take a move back or to agree a draw
function handleAsk(room, me) {
  const a = room.ask;
  if (!a) { if (ovTag == 'ask') overlay(null); S.askShown = 0; return; }
  if (S.askShown === a.id) return;
  S.askShown = a.id;
  const opp = room.p[1 - me] || {};
  if (a.by == me) overlay(`<div class="spin"></div><b>${T(a.k == 'undo' ? 'askUndoWait' : 'askDrawWait')}</b>`, [[T('cancel'), 'glass', () => S.cancelAsk()]], 'ask');
  else { overlay(`<b>${T(a.k == 'undo' ? 'askUndoQ' : 'askDrawQ', { n: esc(opp.name || '') })}</b>`, [[T('decline'), 'glass', () => S.answer(false)], [T('accept'), 'gold', () => S.answer(true)]], 'ask'); AU.ping(); }
}
function renderRoom(room, me) {
  show('room'); closeSheet();
  if (ovTag == 'net') overlay(null);
  $('roomCode').textContent = room.code;
  const host = S.isHost, guest = room.p[1] && !room.p[1].gone ? room.p[1] : null;
  const seat = i => {
    const p = i == 0 ? room.p[0] : guest;
    if (!p) return `<div class="rs empty"><div class="spin sm"></div><div class="nm">${T('seatOpen')}</div><div class="sub">${T('seatWait')}</div></div>`;
    const sd = room.opt.side == 'rand' ? -1 : (room.opt.side == 'red') == (i == 0) ? 0 : 1;
    return `<div class="rs${p.on === false ? ' off' : ''}">${i == 0 ? `<span class="tag">${T('hostTag')}</span>` : ''}<div class="av">${avSvg(p.av)}</div>
      <div class="nm">${esc(p.name)}${i == me ? ` (${T('you')})` : ''}</div><div class="sub">${p.on === false ? T('offline') : sd < 0 ? T('oRand') : sideDot(sd) + SIDE(sd)}</div>
      ${host && i == 1 ? `<button class="x" id="kickBtn" aria-label="${esc(T('kick'))}"><svg viewBox="0 0 24 24"><use href="#i-close"/></svg></button>` : ''}</div>`;
  };
  $('seats2').innerHTML = seat(0) + '<span class="vs">vs</span>' + seat(1);
  const kb = $('kickBtn'); if (kb) kb.onclick = () => { AU.select(); S.kick(); };
  const box = $('optsRoom'); box.innerHTML = ''; box.hidden = !host;
  if (host) {
    segRow(box, T('oHostSide'), sideItems(), room.opt.side, v => S.setOpt('side', v));
    segRow(box, T('oClock'), clockItems(), room.opt.clock, v => S.setOpt('clock', v));
  }
  const o = room.opt;
  $('rulesSum').innerHTML = host ? T(guest ? 'roomReady' : 'roomHint')
    : `${T('sumSide', { s: o.side == 'rand' ? T('oRand') : SIDE(o.side == 'red' ? 0 : 1) })} · ${o.clock ? T('sumClock', { n: o.clock }) : T('sumNoClock')}<br>${T('sumSwap')}`;
  const a = $('roomActs'); a.innerHTML = '';
  if (host) {
    const b = document.createElement('button'); b.className = 'btn gold'; b.textContent = T('start'); b.disabled = !(guest && guest.on);
    b.onclick = () => { AU.select(); S.start(); };
    a.appendChild(b);
  } else {
    const w = document.createElement('div'); w.className = 'more'; w.innerHTML = `<div class="spin sm"></div>${T('waitHost')}`; a.appendChild(w);
  }
}
$('roomBack').onclick = () => leaveRoom(true);
$('roomRules').onclick = () => showRules();
$('btnCopy').onclick = () => S && invite(S.code, false);
$('btnShare').onclick = () => S && invite(S.code, true);
