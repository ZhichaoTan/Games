// ===== the host: it keeps the real table, runs the bots and the clocks, and talks to the guests over PeerJS.
// Practice is a host with no network. Every guest only ever gets view(seat): what that seat is allowed to see =====
let S = null;
UI.init({ act: a => (S && S.act ? S.act(a) : false), onEnd: v => showResult(v) });

function startHost(o) {
  const solo = !!o.solo;
  const restore = o.restore || null;
  let code = restore ? restore.code : (solo ? 'SOLO' : rid(4));
  const T0 = restore ? CX.Table.fromJSON(restore.T) : new CX.Table({ rules: solo ? Object.assign({}, P.rules, { timer: 0 }) : P.rules });
  const tb = { T: T0 };
  const me = T0.seats[0] || {};
  T0.seats[0] = Object.assign(me, { id: 'host', name: myName, av: myAv, bot: false, lv: 0, token, score: me.score | 0, wins: me.wins | 0, conn: true, auto: !!me.auto });
  for (let s = 1; s < 4; s++) if (T0.seats[s] && !T0.seats[s].bot) T0.seats[s].conn = false;
  const conns = new Map(), seen = [0, 0, 0, 0];
  let started = !!(restore && restore.started), paused = false, peer = null, closing = false;
  const ready = [false, false, false, false];
  const timers = [null, null, null, null], deadline = [0, 0, 0, 0], timeouts = [0, 0, 0, 0];
  let goT = null, autoStartT = 0, autoStartAt = 0, saveT = 0, syncQ = false;
  let lastGuessAt = 0, lastDealAt = 0, evSeen = tb.T.evn;

  S = { mode: solo ? 'solo' : 'host', code, isHost: true, view: null, room: null };
  S.table = () => tb.T;   // for the tests: the real table, on the host's own machine
  const usedNames = () => new Set(tb.T.seats.filter(Boolean).map(p => p.name));
  function botName() { const u = usedNames(); return T('botNames').find(n => !u.has(n)) || ('Bot ' + rid(2)); }
  function addBot(s, lv) {
    const prev = tb.T.seats[s];
    tb.T.seats[s] = { id: 'b' + rid(5), name: botName(), av: 0, bot: true, lv: clamp(lv || P.bot || 2, 1, 4), token: '', score: prev ? prev.score | 0 : 0, wins: prev ? prev.wins | 0 : 0, conn: true, auto: false };
  }
  const inRound = s => !!(tb.T.R && tb.T.R.phase !== 'end' && tb.T.R.ps.includes(s));
  function roomInfo(s) {
    const R = tb.T.R;
    let clock = null;
    if (R && R.phase !== 'end' && !paused) {
      const ps = tb.T.pending().filter(x => deadline[x]);
      if (ps.length) clock = { seats: ps, left: Math.max(0, Math.max(...ps.map(x => deadline[x])) - KeepAlive.now()), total: tb.T.rules.timer * 1000 + 1500 };
    }
    return { code, solo, started, paused, ready: ready.slice(), auto: autoStartAt ? Math.max(0, autoStartAt - Date.now()) : 0, clock, me: s };
  }
  function sync() {
    if (syncQ) return; syncQ = true;
    Promise.resolve().then(() => {
      syncQ = false;
      if (closing) return;
      onView(tb.T.view(0), roomInfo(0));
      for (const [s, c] of conns) if (c.open) { try { c.send({ t: 'state', v: tb.T.view(s), room: roomInfo(s) }); } catch (e) {} }
    });
  }
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      if (closing || !started) return;
      store.set(solo ? 'mm_solo' : 'mm_host', { code, T: tb.T.toJSON(), at: Date.now(), started });
    }, 400);
  }
  function changed() { watch(); schedule(); sync(); save(); }
  // new events: when the last guess or deal happened (everyone's screen is still showing it), and now and then a word from a bot
  let banterAt = 0;
  function watch() {
    const R = tb.T.R; if (!R) return;
    if (tb.T.evn < evSeen) evSeen = 0;
    const evs = R.ev.filter(e => e.n > evSeen); evSeen = tb.T.evn;
    const now = Date.now();
    if (evs.some(e => e.k === 'guess')) lastGuessAt = now;
    if (evs.some(e => e.k === 'deal' || e.k === 'play')) lastDealAt = now;
    if (!started || now - banterAt < 9000) return;
    const bots = [0, 1, 2, 3].filter(x => tb.T.seats[x] && tb.T.seats[x].bot);
    if (!bots.length) return;
    let who = -1, p = -1;
    for (const e of evs) {
      if (e.k === 'guess' && e.ok && tb.T.seats[e.t] && tb.T.seats[e.t].bot && Math.random() < 0.22) { who = e.t; p = Math.random() < 0.5 ? 1 : 4; }
      else if (e.k === 'guess' && !e.ok && tb.T.seats[e.t] && tb.T.seats[e.t].bot && Math.random() < 0.12) { who = e.t; p = 0; }
      else if (e.k === 'end' && tb.T.seats[e.win] && tb.T.seats[e.win].bot && Math.random() < 0.4) { who = e.win; p = Math.random() < 0.5 ? 7 : 3; }
    }
    if (who < 0) return;
    banterAt = now;
    KeepAlive.later(() => { if (!closing && tb.T.seats[who] && tb.T.seats[who].bot) broadcastChat(who, { p }); }, UI.GUESS_MS + 500);
  }

  // ----- bots and clocks -----
  // let everyone's screen finish the last guess (or the deal) before the next move lands
  const settle = () => Math.max(0, lastGuessAt + UI.GUESS_MS + 200 - Date.now(), lastDealAt + 1500 - Date.now());
  function think(s) {
    const R = tb.T.R, sp = P.speed;
    const k = sp === 'fast' ? 0.5 : sp === 'slow' ? 1.7 : 1;
    let base;
    if (R.phase === 'setup') base = 600 + Math.random() * 800;
    else if (R.stage === 'draw') base = 650 + Math.random() * 500;
    else if (R.stage === 'guess') base = 1300 + Math.random() * 1200;
    else if (R.stage === 'decide') base = 1000 + Math.random() * 1000;
    else base = 1000 + Math.random() * 700;
    return settle() + base * k;
  }
  const keyOf = s => { const Tb = tb.T, R = Tb.R; return s + ':' + Tb.evn + ':' + R.phase + ':' + R.stage + ':' + (R.setup[s] ? R.setup[s].length : 0) + ':' + (R.go ? 1 : 0); };
  function clearTimer(s) { if (timers[s]) { timers[s].id.cancel(); timers[s] = null; } deadline[s] = 0; }
  function schedule() {
    const Tb = tb.T, R = Tb.R;
    if (!R || !started || closing) return;
    if (paused) { for (let s = 0; s < 4; s++) clearTimer(s); return; }
    if (R.phase === 'end') { for (let s = 0; s < 4; s++) clearTimer(s); endReady(); return; }
    if (R.phase === 'setup' && !R.go && !goT) goT = KeepAlive.later(() => { goT = null; if (closing || !tb.T.R || tb.T.R.phase !== 'setup') return; tb.T.go(); changed(); }, 1600);
    const pend = Tb.pending();
    for (let s = 0; s < 4; s++) if (!pend.includes(s)) clearTimer(s);
    for (const s of pend) {
      const p = Tb.seats[s]; if (!p) continue;
      const key = keyOf(s);
      if (timers[s] && timers[s].key === key) continue;
      clearTimer(s);
      if (p.bot || p.auto) timers[s] = { key, id: KeepAlive.later(() => move(s, key, p.bot ? p.lv : 2, false), think(s)) };
      else if (!p.conn) timers[s] = { key, id: KeepAlive.later(() => move(s, key, 2, false), 6000 + settle()) };
      else if (Tb.rules.timer > 0) {
        const ms = Tb.rules.timer * 1000 + settle();
        deadline[s] = KeepAlive.now() + ms;
        timers[s] = { key, id: KeepAlive.later(() => move(s, key, 2, true), ms + 300) };
      }
    }
  }
  function move(s, key, lv, timedOut) {
    const Tb = tb.T, R = Tb.R;
    timers[s] = null; deadline[s] = 0;
    if (!R || paused || closing || R.phase === 'end' || key !== keyOf(s)) return;
    const v = Tb.view(s), o = v.opt;
    let a = null;
    // a player who ran out of time after a hit stops (keeps the new tile hidden) rather than risk it
    if (timedOut && o && o.k === 'decide') a = { k: 'stop', at: o.slots.length ? o.slots[Math.floor(Math.random() * o.slots.length)] : 0 };
    else try { a = AI.decide(v, lv, Math.random); } catch (e) { console.error(e); }
    let r = a ? Tb.act(s, a) : 'bad';
    if (r === 'slot' && o && o.slots && o.slots.length) r = Tb.act(s, { k: 'stop', at: o.slots[0] });
    if (r !== 'ok') r = fallback(s, v);
    if (timedOut === true) { timeouts[s]++; if (timeouts[s] >= 2 && Tb.seats[s] && !Tb.seats[s].auto) { Tb.seats[s].auto = true; } }
    changed();
  }
  function fallback(s, v) {
    const Tb = tb.T, o = v.opt, R = v.R; if (!o) return 'no';
    if (o.k === 'place') return Tb.act(s, { k: 'place', at: o.slots[0] });
    if (o.k === 'draw') return Tb.act(s, { k: 'draw', c: o.c[0] ? 0 : 1 });
    if (o.k === 'decide') return Tb.act(s, { k: 'stop', at: o.slots[0] || 0 });
    if (o.k === 'guess') { for (const t of R.ps) if (t !== s && !R.out.includes(t)) { const i = R.rows[t].findIndex(x => !x.open); if (i >= 0) return Tb.act(s, { k: 'guess', t, i, v: 0 }); } }
    if (o.k === 'reveal') return Tb.act(s, { k: 'reveal', i: R.rows[s].findIndex(x => !x.open) });
    return 'no';
  }
  // ----- between rounds: everyone says they're ready (bots, and anyone away, already are) -----
  function endReady() {
    const Tb = tb.T;
    for (let s = 1; s < 4; s++) { const p = Tb.seats[s]; if (!p || p.bot || p.auto || !p.conn) ready[s] = true; }
    if (ready.every(Boolean)) { clearTimeout(autoStartT); autoStartAt = 0; setTimeout(nextRound, 400); return; }
    if (!solo && !autoStartAt) { autoStartAt = Date.now() + 30000; autoStartT = setTimeout(nextRound, 30000); }
  }
  function nextRound() {
    const Tb = tb.T;
    if (closing || !Tb.R || Tb.R.phase !== 'end') return;
    clearTimeout(autoStartT); autoStartAt = 0;
    ready.fill(false); timeouts.fill(0);
    if (Tb.players().length < 2) { addBot([1, 2, 3].find(s => !Tb.seats[s])); }
    Tb.startRound();
    changed();
  }
  function start() {
    const Tb = tb.T;
    if (Tb.players().length < 2) { toast(esc(T('needTwo'))); return; }
    started = true;
    ready.fill(false);
    if (!Tb.R || Tb.R.phase === 'end') Tb.startRound();
    changed();
  }
  // ----- the host's own moves and buttons -----
  S.act = a => {
    if (!a) return 'no';
    if (a.k === '_auto') { tb.T.seats[0].auto = !!a.on; if (!a.on) timeouts[0] = 0; changed(); return 'ok'; }
    if (paused) { toast(esc(T('pausedBy'))); return 'paused'; }
    const r = tb.T.act(0, a);
    if (r === 'ok') { timeouts[0] = 0; changed(); }
    else if (r === 'turn') toast(esc(T('notTurn')));
    else sync();
    return r;
  };
  S.ready = () => { ready[0] = true; if (tb.T.R && tb.T.R.phase === 'end') endReady(); sync(); };
  S.chat = m => broadcastChat(0, m);
  S.setAuto = on => S.act({ k: '_auto', on });
  S.setBotLv = (s, lv) => { const p = tb.T.seats[s]; if (p && p.bot) { p.lv = clamp(lv, 1, 4); changed(); } };
  S.kick = s => kick(s);
  S.addBot = s => { if (!tb.T.seats[s] && s > 0) { addBot(s); if (started) notice(T('joinedNext', { n: tb.T.seats[s].name })); changed(); } };
  S.setRules = r => { if (started) return; tb.T.rules = CX.cleanRules(Object.assign({}, tb.T.rules, r)); Object.assign(P.rules, tb.T.rules); saveP(); changed(); };
  S.start = () => start();
  S.togglePause = () => { clearInterval(holdT); paused = !paused; changed(); };
  S.leave = async kind => {
    closing = true;
    for (let s = 0; s < 4; s++) clearTimer(s);
    if (goT) goT.cancel();
    clearTimeout(autoStartT); clearTimeout(saveT);
    if (solo) { if (started) store.set('mm_solo', { code, T: tb.T.toJSON(), at: Date.now(), started }); return; }
    if (kind === 'save' && started) {
      store.set('mm_host', { code, T: tb.T.toJSON(), at: Date.now(), started });
      for (const c of conns.values()) if (c.open) try { c.send({ t: 'saved' }); } catch (e) {}
    } else {
      store.set('mm_host', null);
      for (const [s, c] of conns) if (c.open) try { c.send({ t: 'ended', v: tb.T.view(s) }); } catch (e) {}
    }
    KeepAlive.release(); KeepAlive.mark('mm_live', null);
    await sleep(500);
    try { peer && peer.destroy(); } catch (e) {}
  };
  function kick(s) {
    if (s === 0 || !tb.T.seats[s]) return;
    const c = conns.get(s);
    if (c) { try { c.send({ t: 'kicked' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 300); conns.delete(s); }
    // in the middle of a round the seat keeps its tiles and a bot plays them out
    if (inRound(s)) addBot(s, 2); else tb.T.seats[s] = null;
    changed();
  }
  // ----- chat -----
  function broadcastChat(s, m) {
    const msg = cleanChat(m); if (!msg) return;
    chatIn(s, msg);
    for (const c of conns.values()) if (c.open) try { c.send({ t: 'chat', s, text: msg.text, emo: msg.emo, p: msg.p }); } catch (e) {}
  }
  function notice(txt) { toast(esc(txt), 2600); for (const c of conns.values()) if (c.open) try { c.send({ t: 'note', text: txt }); } catch (e) {} }

  // ----- the network -----
  function onData(conn, m) {
    if (!m || typeof m !== 'object') return;
    const Tb = tb.T;
    if (m.t === 'hello') {
      const name = String(m.name || '').replace(/\s+/g, ' ').trim().slice(0, 10) || 'Guest';
      const tk = String(m.token || '').slice(0, 40);
      const av = clamp(m.av | 0, 0, AV.AVATARS.length - 1);
      let s = Tb.seats.findIndex((p, i) => i > 0 && p && !p.bot && p.token === tk);
      if (s < 0) {
        // a new face: an empty seat (from the next round if one is being played), or a bot's seat mid-round
        const empty = [1, 2, 3].find(i => !Tb.seats[i]);
        const bot = [1, 2, 3].find(i => Tb.seats[i] && Tb.seats[i].bot);
        s = !started ? empty : (bot != null && inRound(bot) ? bot : empty != null ? empty : bot);
        if (s == null) { try { conn.send({ t: 'err', code: 'full' }); } catch (e) {} setTimeout(() => { try { conn.close(); } catch (e) {} }, 600); return; }
        const prev = Tb.seats[s];
        Tb.seats[s] = { id: 'p' + rid(6), name, av, bot: false, lv: 0, token: tk, score: prev ? prev.score | 0 : 0, wins: prev ? prev.wins | 0 : 0, conn: true, auto: false };
        notice(T(prev ? 'tookOver' : (started && Tb.R && Tb.R.phase !== 'end') ? 'joinedNext' : 'joined', { n: name }));
      } else {
        const p = Tb.seats[s], back = !p.conn;
        p.name = name; p.av = av; p.conn = true;
        if (back && started) notice(T('isBack', { n: name }));
      }
      // swap in the new connection before closing the old one: the old one's close may fire straight away
      const old = conns.get(s);
      conn._s = s; conns.set(s, conn); seen[s] = Date.now();
      if (old && old !== conn) { old._s = null; try { old.close(); } catch (e) {} }
      Tb.seats[s].conn = true;
      try { conn.send({ t: 'welcome', seat: s }); } catch (e) {}
      changed();
      return;
    }
    const s = conn._s; if (s == null || conns.get(s) !== conn) return;
    seen[s] = Date.now();
    if (m.t === 'ping') { try { conn.send({ t: 'pong' }); } catch (e) {} }
    else if (m.t === 'act' && m.a && typeof m.a === 'object') {
      if (m.a.k === '_auto') { Tb.seats[s].auto = !!m.a.on; if (!m.a.on) timeouts[s] = 0; changed(); return; }
      if (paused) { try { conn.send({ t: 'err', code: 'paused' }); } catch (e) {} return; }
      const a = { k: String(m.a.k).slice(0, 10) };
      for (const f of ['c', 't', 'i', 'v', 'at']) if (m.a[f] != null) a[f] = m.a[f] | 0;
      const r = Tb.act(s, a);
      if (r === 'ok') { timeouts[s] = 0; changed(); } else { try { conn.send({ t: 'err', code: r }); } catch (e) {} sync(); }
    }
    else if (m.t === 'ready') { ready[s] = true; if (Tb.R && Tb.R.phase === 'end') endReady(); sync(); }
    else if (m.t === 'chat') broadcastChat(s, m);
    else if (m.t === 'leave') {
      const p = Tb.seats[s];
      conns.delete(s);
      try { conn.send({ t: 'bye' }); } catch (e) {}
      notice(T('leftRoom', { n: p ? p.name : '' }));
      if (inRound(s)) addBot(s, 2); else Tb.seats[s] = null;
      changed();
    }
  }
  function onClose(conn) {
    const s = conn._s;
    if (s != null && conns.get(s) === conn) {
      conns.delete(s);
      const p = tb.T.seats[s];
      if (p && !p.bot) { p.conn = false; if (started && !closing && inRound(s)) notice(T('dropped', { n: p.name })); }
      changed();
    }
  }
  let tries = 0;
  function openPeer(first) {
    if (closing) return;
    const pr = peer = new Peer(PREFIX + code, peerOpts(KeepAlive.token(PREFIX + code)));
    pr.on('open', () => { if (pr !== peer) return; tries = 0; setNet(true); if (first) { overlay(null); toast(esc(T('kaTip')), 4200); } sync(); });
    pr.on('connection', conn => {
      conn.on('data', m => onData(conn, m));
      conn.on('close', () => onClose(conn));
      conn.on('error', () => {});
    });
    pr.on('disconnected', () => { if (pr !== peer) return; setNet(false); setTimeout(() => { if (pr === peer && !pr.destroyed && pr.disconnected && !closing) { try { pr.reconnect(); } catch (e) {} } }, 1500); });
    pr.on('error', err => {
      if (closing || pr !== peer) return;
      if (err.type === 'unavailable-id') {
        if (!restore && first && !started) { try { peer.destroy(); } catch (e) {} code = rid(4); S.code = code; openPeer(true); return; }
        if (++tries < 30) { setNet(false); try { peer.destroy(); } catch (e) {} setTimeout(() => openPeer(first), 3000); }
        else toast(esc(T('idTaken')));
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
        setNet(false); setTimeout(() => { if (closing) return; if (peer.destroyed) openPeer(first); else if (peer.disconnected) try { peer.reconnect(); } catch (e) {} }, 3000);
      }
    });
  }
  // the host just came back from the background (or the page was reloaded): pause until the guests are back (20 s at most)
  let holdT = 0;
  function holdFor() {
    clearInterval(holdT);
    const t0 = Date.now(), want = [1, 2, 3].filter(s => tb.T.seats[s] && !tb.T.seats[s].bot);
    if (!want.length) return;
    paused = true; changed();
    holdT = setInterval(() => {
      if (closing) { clearInterval(holdT); return; }
      const el = Date.now() - t0;
      if (el < 2500) return;
      if (el > 20000 || want.every(s => !tb.T.seats[s] || tb.T.seats[s].bot || tb.T.seats[s].conn)) { clearInterval(holdT); paused = false; changed(); }
    }, 500);
  }
  function revive(info) {
    if (closing || solo) return;
    if (info.frozen > 5000 && started && !paused) holdFor();
    const now = Date.now();
    for (let s = 0; s < 4; s++) if (conns.has(s)) seen[s] = Math.max(seen[s], now - 4000);
    if (info.away < 3000 && !info.online) return;
    if (info.frozen > 20000 || !peer || peer.destroyed) { try { peer && peer.destroy(); } catch (e) {} openPeer(false); }
    else if (!KeepAlive.live(peer)) { if (peer.disconnected) { try { peer.reconnect(); } catch (e) {} } else { try { peer.destroy(); } catch (e) {} openPeer(false); } }
  }
  KeepAlive.onResume(revive);
  // dropped guests: nothing heard for 11 s
  let hbAt = Date.now();
  const hb = setInterval(() => {
    if (closing) { clearInterval(hb); return; }
    const now = Date.now();
    if (now - hbAt > 6000) { hbAt = now; for (let s = 0; s < 4; s++) seen[s] = now; return; }   // the page was just frozen: don't count the guests out yet
    hbAt = now;
    for (const [s, c] of [...conns]) if (now - seen[s] > 11000) { onClose(c); c._s = null; try { c.close(); } catch (e) {} }
    if (tb.T.rules.timer > 0 || autoStartAt) sync();
  }, 3000);

  if (solo) {
    if (!restore) for (let s = 1; s <= P.opp; s++) addBot(s, P.bot || 1 + Math.floor(Math.random() * 4));
    started = true;
    if (!tb.T.R || (tb.T.R.phase === 'end' && !restore)) tb.T.startRound();
    changed();
  } else {
    overlay(`<div class="spin"></div><b>${T('opening')}</b>`);
    KeepAlive.mark('mm_live', { kind: 'host' });
    KeepAlive.hold(T('kaTitle', { c: code }));
    openPeer(true);
    if (o.auto && started) holdFor();
    changed();
  }
}
// a chat line: a bubble next to whoever said it; the stock phrases show in each player's own language
function chatIn(s, m) {
  const p = Number.isInteger(m.p) && m.p >= 0 && m.p < T('phrases').length ? m.p : -1;
  UI.bubble(s, m.emo || (p >= 0 ? T('phrases')[p] : m.text), !!m.emo);
  SND.play('ping');
}
function cleanChat(m) {
  if (!m) return null;
  if (m.emo && EMOS.includes(m.emo)) return { emo: m.emo };
  if (Number.isInteger(m.p) && m.p >= 0 && m.p < T('phrases').length) return { p: m.p, text: T('phrases')[m.p] };
  const t = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return t ? { text: t } : null;
}
