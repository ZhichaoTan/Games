// ===== the host: the real table, the bots, the turn clock and PeerJS (practice is a host with no network) =====
let S = null;   // the session: practice, host or guest
function startHost(o) {
  const solo = !!o.solo, restore = o.restore || null;
  let code = restore ? restore.code : (solo ? 'SOLO' : rid(4));
  const tb = { T: restore ? MT.Table.fromJSON(restore.T) : new MT.Table({ rules: Object.assign({}, P.rules, solo ? { timer: 0 } : {}) }), gid: restore ? (restore.gid || 1) : 0 };
  const me0 = tb.T.seats[0] || {};
  tb.T.seats[0] = Object.assign(me0, { id: 'host', name: myName, av: myAv, bot: false, lv: 0, token, conn: true, auto: !!me0.auto });
  for (let s = 1; s < 4; s++) if (tb.T.seats[s] && !tb.T.seats[s].bot) tb.T.seats[s].conn = false;
  const conns = new Map(), seen = [0, 0, 0, 0];
  let started = !!(restore && restore.started), paused = false, peer = null, closing = false;
  const timers = [null, null, null, null], timeouts = [0, 0, 0, 0], stand = [false, false, false, false], rush = [false, false, false, false];
  let deadline = 0, deadlineFor = -1, clockKey = '', saveT = 0, syncQ = false;

  S = { mode: solo ? 'solo' : 'host', code, isHost: true, view: null, room: null };
  S.table = () => tb.T;   // tests: the real table on this device
  // a bot's name is a number into the name lists, so each player reads it in their own language
  function botNo() {
    const taken = new Set(tb.T.seats.filter(p => p && p.bot).map(p => p.bn));
    const people = new Set(tb.T.seats.filter(p => p && !p.bot).map(p => p.name.toLowerCase()));
    const free = I18.S.en.botNames.map((n, i) => i).filter(i => !taken.has(i));
    const i = free.find(i => !people.has(I18.S.en.botNames[i].toLowerCase()) && !people.has(I18.S.zh.botNames[i]));
    return i != null ? i : free.length ? free[0] : -1;
  }
  const botLv = () => P.bot || (1 + Math.floor(Math.random() * 3));
  function addBot(s, lv) { const bn = botNo(); tb.T.seats[s] = { id: 'b' + rid(5), name: bn >= 0 ? T('botNames')[bn] : 'Bot ' + rid(2), bn, av: 0, bot: true, lv: lv || botLv(), token: '', conn: true, auto: false }; }
  function roomInfo(s) {
    const g = tb.T.g;
    let clock = null;
    if (g && !g.over && !paused && deadline && deadlineFor === g.turn) clock = { s: g.turn, left: Math.max(0, deadline - KeepAlive.now()), total: tb.T.rules.timer * 1000 * (g.place ? 0.5 : 1) };
    return { code, solo, started, paused, clock, gid: tb.gid, me: s };
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
  // the table is written down at most every 0.4 s, and at once when the page is hidden or thrown away
  function writeSave() {
    clearTimeout(saveT); saveT = 0;
    if (closing || (solo && !started)) return;
    const key = solo ? 'cd_solo' : 'cd_host';
    if (tb.T.g && tb.T.g.over) { store.set(key, null); return; }
    store.set(key, { code, T: tb.T.toJSON(), at: Date.now(), started, gid: tb.gid });
  }
  function save() { if (!saveT) saveT = setTimeout(writeSave, 400); }
  const flush = () => { if (saveT) writeSave(); };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  function changed() { schedule(); sync(); save(); banter(); }

  // ----- bots and the turn clock -----
  const turnKey = g => g.place ? 'p' + g.place.i : 't' + ((g.ev.slice().reverse().find(e => e.k === 'turn') || {}).n || 0);
  function think(s) {
    const g = tb.T.g, sp = P.speed;
    const base = sp === 'fast' ? 360 : sp === 'slow' ? 1250 : 720, k = sp === 'fast' ? 0.75 : 1;
    let ms = base * (0.85 + Math.random() * 0.3);
    if (g.place) ms *= 0.7;
    const last = g.ev[g.ev.length - 1];
    if (last) {
      if (last.k === 'sink') ms += 1550 * k;   // let the tile flip over first
      else if (last.k === 'cr') ms += (300 * Math.max(1, (last.path || []).length - 1) + 450) * k;
      else if (last.k === 'dol') ms += (280 * (last.path || []).length + 300) * k;
      else if (last.k === 'turn') ms += 650 * k;
      else if (last.k === 'setup') ms += 900;
    }
    return ms;
  }
  function clearTimer(s) { if (timers[s]) { timers[s].id.cancel(); timers[s] = null; } }
  function schedule() {
    const Tb = tb.T, g = Tb.g;
    if (!g || !started || closing) return;
    if (paused || g.over) { for (let s = 0; s < 4; s++) clearTimer(s); deadline = 0; return; }
    const s = g.turn, p = Tb.seats[s];
    if (!p) return;
    const key = s + ':' + g.evn;
    if (timers[s] && timers[s].key === key) return;
    for (let i = 0; i < 4; i++) clearTimer(i);
    const tk = turnKey(g);
    if (clockKey !== tk) { clockKey = tk; rush.fill(false); deadline = 0; deadlineFor = -1; }
    const human = !p.bot && !p.auto && p.conn !== false && !rush[s];
    if (human && Tb.rules.timer > 0 && !deadline) { deadline = KeepAlive.now() + Tb.rules.timer * 1000 * (g.place ? 0.5 : 1); deadlineFor = s; }
    if (!human) deadline = 0;
    if (p.bot || p.auto || rush[s]) timers[s] = { key, id: KeepAlive.later(() => move(s, key, p.bot ? p.lv : 2), think(s)) };
    else if (p.conn === false) timers[s] = { key, id: KeepAlive.later(() => { stand[s] = true; move(s, key, 2); }, stand[s] ? think(s) : 6000) };
    else if (deadline) timers[s] = { key, id: KeepAlive.later(() => timeUp(s, key), Math.max(0, deadline - KeepAlive.now()) + 250) };
  }
  function timeUp(s, key) {
    const g = tb.T.g; timers[s] = null;
    if (!g || g.over || paused || key !== s + ':' + g.evn) return;
    rush[s] = true; deadline = 0;
    if (++timeouts[s] >= 2) tb.T.seats[s].auto = true;
    noteTo(s, 'timeUp');
    move(s, key, 2);
  }
  function move(s, key, lv) {
    const Tb = tb.T, g = Tb.g;
    timers[s] = null;
    if (!g || g.over || paused || closing || key !== s + ':' + g.evn || g.turn !== s) return;
    let a = null;
    try { a = AI.decide(Tb.view(s), lv, Math.random); } catch (e) { console.error(e); }
    let r = a ? Tb.act(s, a) : 'bad';
    if (r !== 'ok') { const L = Tb.legal(); const b = L.find(x => x.k === 'done') || L.find(x => x.skip) || L[0]; r = b ? Tb.act(s, b) : 'no'; }
    changed();
  }
  function start() {
    const Tb = tb.T;
    if (Tb.seats.filter(Boolean).length < 2) { toast(T('startNeed')); return; }
    if (Tb.start() !== 'ok') return;
    started = true; tb.gid++;
    timeouts.fill(0); rush.fill(false);
    changed();
  }
  function again() {
    const old = tb.T;
    const N = new MT.Table({ rules: old.rules });
    N.seats = old.seats.map(p => p && Object.assign({}, p));
    N.wins = old.wins.slice(); N.games = old.games;
    N.evn = old.evn;   // keep counting events from the last game, so everyone's screen treats the new ones as new
    tb.T = N;
    start();
  }
  // a bot says something now and then
  let banterN = tb.T.evn, banterAt = 0;
  function banter() {
    const g = tb.T.g; if (!g || !started) return;
    if (g.evn < banterN) banterN = 0;
    const evs = g.ev.filter(e => e.n > banterN); banterN = g.evn;
    if (Date.now() - banterAt < 7000 || !evs.length) return;
    const bot = s => s != null && s >= 0 && tb.T.seats[s] && tb.T.seats[s].bot;
    const owner = id => { const x = g.isl.find(y => y.id === id); return x ? x.s : -1; };
    for (const e of evs) {
      if (e.k === 'cr' && e.eat && e.eat.length) {
        const vs = [...new Set(e.eat.map(owner))];
        const v = vs.find(o => o !== e.s && bot(o));
        if (v != null && Math.random() < 0.45) return say(v, 1);
        if (bot(e.s) && vs.some(o => o !== e.s) && Math.random() < 0.3) return say(e.s, 2);
      }
      if (e.k === 'cr' && e.grab && e.pax && e.pax.length) { const v = [...new Set(e.pax.map(owner))].find(o => o !== e.s && bot(o)); if (v != null && Math.random() < 0.5) return say(v, 4); }
      if (e.k === 'sink' && e.back === 'shark' && Math.random() < 0.22) { const b = [0, 1, 2, 3].filter(s => s !== e.s && bot(s)); if (b.length) return say(b[Math.floor(Math.random() * b.length)], 5); }
      if (e.k === 'step' && e.res === 'dock' && (e.pax || []).length >= 2 && bot(e.s) && Math.random() < 0.3) return say(e.s, 0);
    }
  }
  function say(s, p) { banterAt = Date.now(); KeepAlive.later(() => { if (!closing && tb.T.seats[s] && tb.T.seats[s].bot) broadcastChat(s, { p }); }, 900 + Math.random() * 600); }

  // ----- the host's own moves and menu -----
  S.act = a => {
    if (!a) return 'bad';
    if (a.k === '_auto') { tb.T.seats[0].auto = !!a.on; if (!a.on) timeouts[0] = 0; changed(); return 'ok'; }
    if (paused) { toast(T('paused')); return 'paused'; }
    const r = tb.T.act(0, a);
    if (r === 'ok') { timeouts[0] = 0; changed(); } else sync();
    return r;
  };
  S.again = () => again();
  S.chat = m => broadcastChat(0, m);
  S.setAuto = on => S.act({ k: '_auto', on });
  S.setBotLv = (s, lv) => { const p = tb.T.seats[s]; if (p && p.bot) { p.lv = lv; changed(); } };
  S.kick = s => kick(s);
  S.addBot = s => { if (!started && !tb.T.seats[s]) { addBot(s); changed(); } };
  S.fillBots = () => { if (started) return; for (let s = 1; s < 4; s++) if (!tb.T.seats[s]) addBot(s); changed(); };
  S.start = () => start();
  S.togglePause = () => { clearInterval(holdT); paused = !paused; if (!paused) { clockKey = ''; deadline = 0; } changed(); };
  S.setSpeed = sp => { P.speed = sp; saveP(); };
  S.leave = async kind => {
    closing = true;
    for (let s = 0; s < 4; s++) clearTimer(s);
    clearTimeout(saveT); saveT = 0;
    const over = tb.T.g && tb.T.g.over;
    if (solo) { store.set('cd_solo', started && !over ? { code, T: tb.T.toJSON(), at: Date.now(), started, gid: tb.gid } : null); return; }
    if (kind === 'save' && started && !over) {
      store.set('cd_host', { code, T: tb.T.toJSON(), at: Date.now(), started, gid: tb.gid });
      for (const c of conns.values()) if (c.open) try { c.send({ t: 'saved' }); } catch (e) {}
    } else {
      store.set('cd_host', null);
      for (const [s, c] of conns) if (c.open) try { c.send({ t: 'ended' }); } catch (e) {}
    }
    KeepAlive.release(); KeepAlive.mark(LIVE, null);
    await sleep(500);
    try { peer && peer.destroy(); } catch (e) {}
  };
  function kick(s) {
    if (s === 0) return;
    const c = conns.get(s);
    if (c) { try { c.send({ t: 'kicked' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 300); conns.delete(s); }
    if (started && tb.T.g && !tb.T.g.over && tb.T.g.pl.includes(s)) addBot(s, 2); else tb.T.seats[s] = null;
    changed();
  }
  // ----- chat and notes -----
  function broadcastChat(s, m) {
    const msg = cleanChat(m); if (!msg) return;
    chatIn(s, msg);
    for (const c of conns.values()) if (c.open) try { c.send({ t: 'chat', s, text: msg.text, emo: msg.emo, p: msg.p }); } catch (e) {}
  }
  // a note everyone sees in their own language
  function notice(k, v) { toast(T(k, v), 2600); for (const c of conns.values()) if (c.open) try { c.send({ t: 'note', k, v }); } catch (e) {} }
  function noteTo(s, k, v) { if (s === 0) toast(T(k, v), 2800); else { const c = conns.get(s); if (c && c.open) try { c.send({ t: 'note', k, v }); } catch (e) {} } }

  // ----- the network -----
  function onData(conn, m) {
    if (!m || typeof m !== 'object') return;
    const Tb = tb.T;
    if (m.t === 'hello') {
      const name = String(m.name || '').trim().slice(0, 10) || 'Guest';
      const tk = String(m.token || '').slice(0, 40);
      const av = clamp(m.av | 0, 0, AV.AVATARS.length - 1);
      let s = Tb.seats.findIndex((p, i) => i > 0 && p && !p.bot && p.token === tk);
      if (s < 0) {
        // a newcomer: an open seat before the game; once it's going, a bot's seat in it (the bot's islanders become theirs)
        const inGame = started && Tb.g && !Tb.g.over;
        if (!inGame) s = [1, 2, 3].find(i => !Tb.seats[i]);
        else s = [1, 2, 3].find(i => Tb.seats[i] && Tb.seats[i].bot && Tb.g.pl.includes(i));
        if (s == null || s < 0) { try { conn.send({ t: 'err', code: 'full' }); } catch (e) {} setTimeout(() => { try { conn.close(); } catch (e) {} }, 600); return; }
        const prev = Tb.seats[s];
        Tb.seats[s] = { id: 'p' + rid(6), name, av, bot: false, lv: 0, token: tk, conn: true, auto: false };
        notice(prev ? 'tookOver' : 'joined', { n: name });
      } else {
        const p = Tb.seats[s], back = p.conn === false;
        p.name = name; p.av = av; p.conn = true;
        if (back && started) notice('isBack', { n: name });
      }
      stand[s] = false;
      // swap in the new connection before closing the old one: the old one's close may fire at once and mustn't mark them gone
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
      const r = Tb.act(s, m.a);
      if (r === 'ok') { timeouts[s] = 0; changed(); } else { try { conn.send({ t: 'err', code: r }); } catch (e) {} sync(); }
    }
    else if (m.t === 'chat') broadcastChat(s, m);
    else if (m.t === 'leave') {
      const p = Tb.seats[s];
      conns.delete(s);
      try { conn.send({ t: 'bye' }); } catch (e) {}
      notice('leftRoom', { n: p ? p.name : '' });
      if (started && Tb.g && !Tb.g.over && Tb.g.pl.includes(s)) addBot(s, 2); else Tb.seats[s] = null;
      changed();
    }
  }
  function onClose(conn) {
    const s = conn._s;
    if (s != null && conns.get(s) === conn) {
      conns.delete(s);
      const p = tb.T.seats[s];
      if (p && !p.bot) { p.conn = false; if (started && !closing) notice('dropped', { n: p.name }); }
      changed();
    }
  }
  let tries = 0;
  function openPeer(first) {
    if (closing) return;
    const pr = peer = new Peer(PREFIX + code, peerOpts(KeepAlive.token(PREFIX + code)));
    pr.on('open', () => { if (pr !== peer) return; tries = 0; setNet(true); if (first) { overlay(null); toast(T('kaTip'), 4200); } if (!started) sync(); });
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
        else toast(T('idTaken'));
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
        setNet(false); setTimeout(() => { if (closing) return; if (peer.destroyed) openPeer(first); else if (peer.disconnected) try { peer.reconnect(); } catch (e) {} }, 3000);
      }
    });
  }
  // back from the background (or a reloaded page): pause until the friends who were here reconnect (20 s at most),
  // so nobody gets a bot playing for them just because the host was away
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
      if (el > 20000 || want.every(s => !tb.T.seats[s] || tb.T.seats[s].bot || tb.T.seats[s].conn)) { clearInterval(holdT); paused = false; clockKey = ''; deadline = 0; changed(); }
    }, 500);
  }
  function revive(info) {
    if (closing || solo) return;
    if (info.frozen > 5000 && started && !paused && tb.T.g && !tb.T.g.over) holdFor();
    const now = Date.now();
    for (let s = 0; s < 4; s++) if (conns.has(s)) seen[s] = Math.max(seen[s], now - 4000);
    if (info.away < 3000 && !info.online) return;
    if (info.frozen > 20000 || !peer || peer.destroyed) { try { peer && peer.destroy(); } catch (e) {} openPeer(false); }
    else if (!KeepAlive.live(peer)) { if (peer.disconnected) { try { peer.reconnect(); } catch (e) {} } else { try { peer.destroy(); } catch (e) {} openPeer(false); } }
  }
  KeepAlive.onResume(revive);
  // dropped guests
  let hbAt = Date.now();
  const hb = setInterval(() => {
    if (closing) { clearInterval(hb); return; }
    const now = Date.now();
    if (now - hbAt > 6000) { hbAt = now; for (let s = 0; s < 4; s++) seen[s] = now; return; }   // the page was just frozen: don't judge the guests yet
    hbAt = now;
    for (const [s, c] of [...conns]) if (now - seen[s] > 11000) { onClose(c); c._s = null; try { c.close(); } catch (e) {} }
    if (deadline) sync();
  }, 3000);

  if (solo) {
    if (!restore) { for (let s = 1; s < P.n; s++) addBot(s); for (let s = P.n; s < 4; s++) tb.T.seats[s] = null; }
    if (!started || !tb.T.g) start(); else changed();
  } else {
    overlay(`<div class="spin"></div><b>${T('opening')}</b>`);
    KeepAlive.mark(LIVE, { kind: 'host' });
    KeepAlive.hold(T('kaTitle', { c: code }));
    openPeer(true);
    if (o.auto && started) holdFor();
    changed();
  }
}
// a chat message arrives: a bubble on the speaker's plate; quick phrases show in each reader's own language
function chatIn(s, m) {
  const p = Number.isInteger(m.p) && m.p >= 0 && m.p < T('phrases').length ? m.p : -1;
  bubble(s, m.emo || (p >= 0 ? T('phrases')[p] : m.text), !!m.emo);
  SND.play('chat');
}
function cleanChat(m) {
  if (!m) return null;
  if (m.emo && EMOS.includes(m.emo)) return { emo: m.emo };
  if (Number.isInteger(m.p) && m.p >= 0 && m.p < T('phrases').length) return { p: m.p, text: T('phrases')[m.p] };
  const t = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return t ? { text: t } : null;
}
