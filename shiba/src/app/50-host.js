// ===== the host: the room, the bots, the rounds and PeerJS (a solo battle against bots is a host with no network) =====
// Every player runs their own well. The host starts each round (one seed, so everyone gets the same blocks), passes the
// rows a clear sends to an opponent, keeps the score of who is out, and runs the bots.
function startHost(o) {
  const solo = !!o.solo, restore = o.restore || null;
  let code = restore ? restore.code : (solo ? 'SOLO' : rid(4));
  const room = { seats: [null, null, null, null], wins: [0, 0, 0, 0], rounds: 0, rd: null, lobby: !solo };
  if (restore && Array.isArray(restore.seats)) {
    restore.seats.forEach((p, s) => { if (p && s > 0) room.seats[s] = Object.assign({ id: (p.bot ? 'b' : 'p') + rid(5), av: 0, lv: 2, bn: -1, token: '' }, p, { conn: !!p.bot }); });
    if (Array.isArray(restore.wins)) room.wins = restore.wins.map(x => x | 0).concat([0, 0, 0, 0]).slice(0, 4);
    room.rounds = restore.rounds | 0;
  }
  room.seats[0] = { id: 'host', name: myName, av: myAv, bot: false, lv: 0, bn: -1, token, conn: true };
  const conns = new Map(), seen = [0, 0, 0, 0], lostAt = [0, 0, 0, 0];
  let peer = null, closing = false;
  let bots = {}, hits = {};
  S = { mode: solo ? 'solo' : 'host', code, isHost: true, view: null, room: null, canPause: solo, snaps: {}, aim: -1 };
  S.roomState = () => room;   // tests

  // ----- seats -----
  // a bot's name is a number into the name lists, so each player reads it in their own language
  function botNo() {
    const taken = new Set(room.seats.filter(p => p && p.bot).map(p => p.bn));
    const people = new Set(room.seats.filter(p => p && !p.bot).map(p => p.name.toLowerCase()));
    const free = I18.S.en.botNames.map((n, i) => i).filter(i => !taken.has(i));
    const i = free.find(i => !people.has(I18.S.en.botNames[i].toLowerCase()) && !people.has(I18.S.zh.botNames[i]));
    return i != null ? i : free.length ? free[0] : 0;
  }
  const botLv = () => (solo ? P.bot : P.hbot) || (1 + Math.floor(Math.random() * 4));
  function addBot(s, lv) { const bn = botNo(); room.seats[s] = { id: 'b' + rid(5), name: T('botNames')[bn], bn, av: 0, bot: true, lv: lv || botLv(), token: '', conn: true }; }
  const human = s => !!(room.seats[s] && !room.seats[s].bot);

  // ----- what everyone sees -----
  function view(s) {
    const rd = room.rd;
    return {
      seats: room.seats.map((p, i) => p && { name: p.name, av: p.av, bot: p.bot, lv: p.lv, bn: p.bn, conn: p.conn !== false, wins: room.wins[i] }),
      me: s,
      rd: rd && { id: rd.id, n: rd.n, seed: rd.seed, phase: rd.phase, goIn: Math.round(rd.go - now()), pl: rd.pl, st: rd.st, win: rd.win, names: rd.names },
    };
  }
  const roomInfo = () => ({ code, solo, lobby: room.lobby });
  let syncQ = false, syncT = 0;
  function sync() {
    clearTimeout(syncT); syncT = 0;
    if (syncQ) return; syncQ = true;
    Promise.resolve().then(() => {
      syncQ = false;
      if (closing) return;
      const ri = roomInfo();
      onView(view(0), ri);
      for (const [s, c] of conns) if (c.open) { try { c.send({ t: 'state', v: view(s), room: ri }); } catch (e) {} }
    });
  }
  const syncSoon = () => { if (!syncT) syncT = setTimeout(sync, 250); };
  function save() {
    if (solo || closing) return;
    store.set('sb_host', { code, at: Date.now(), wins: room.wins, rounds: room.rounds, seats: room.seats.map((p, s) => p && s > 0 && { name: p.name, av: p.av, bot: p.bot, lv: p.lv, bn: p.bn, token: p.token }) });
  }

  // ----- rounds -----
  function start() {
    if (closing || (room.rd && room.rd.phase !== 'over')) return;
    const pl = [0, 1, 2, 3].filter(s => room.seats[s] && (room.seats[s].bot || room.seats[s].conn !== false));
    if (pl.length < 2) { toast(T('startNeed')); return; }
    const rd = { id: (Date.now() % 1e8) * 10 + Math.floor(Math.random() * 10), n: ++room.rounds, seed: 1 + Math.floor(Math.random() * 2 ** 30), phase: 'count', go: now() + 3000, pl, st: {}, win: -1, names: {}, hum: {} };
    for (const s of pl) {
      const p = room.seats[s];
      rd.st[s] = { out: false, place: 0, why: '', ko: 0, sent: 0, by: -1 };
      rd.names[s] = { name: p.name, bn: p.bot ? p.bn : -1 };
      rd.hum[s] = !p.bot;
    }
    room.rd = rd; room.lobby = false;
    bots = {}; hits = {}; S.snaps = {}; dirty.clear(); lastKey = {};
    for (const s of pl) if (room.seats[s].bot) {
      const g = new SB.Game({ mode: 'versus', seed: rd.seed, gseed: rd.seed * 31 + s * 7 + 1 });
      bots[s] = { g, ai: new AI.Bot(g, room.seats[s].lv), said: {} };
    }
    save();
    sync();
  }
  function toRoom() { if (room.rd && room.rd.phase !== 'over') return; room.lobby = true; room.rd = null; bots = {}; sync(); }
  function attack(from, n, to) {
    const rd = room.rd; if (!rd || rd.phase !== 'play' || !rd.st[from] || rd.st[from].out) return;
    const alive = rd.pl.filter(s => s !== from && !rd.st[s].out);
    if (!alive.length) return;
    const tg = alive.includes(to) ? to : alive[Math.floor(Math.random() * alive.length)];
    rd.st[from].sent += n;
    hits[tg] = { by: from, at: now() };
    if (tg === 0) { if (U.g && U.g.started && !U.g.over) U.g.addBubbles(n); }
    else if (bots[tg]) { bots[tg].g.addBubbles(n); if (n >= 4) say(tg, 3, 0.35); }
    else { const c = conns.get(tg); if (c && c.open) try { c.send({ t: 'bub', r: rd.id, n, from }); } catch (e) {} }
    orb(from, tg, n);
    for (const c of conns.values()) if (c.open) try { c.send({ t: 'fx', a: from, b: tg, n }); } catch (e) {}
    syncSoon();
  }
  function out(s, why) {
    const rd = room.rd; if (!rd || rd.phase === 'over') return;
    const st = rd.st[s]; if (!st || st.out) return;
    st.place = rd.pl.filter(x => !rd.st[x].out).length;
    st.out = true; st.why = String(why || '').slice(0, 10);
    const h = hits[s];
    if (h && h.by !== s && now() - h.at < 15000 && rd.st[h.by]) { st.by = h.by; rd.st[h.by].ko++; }
    if (bots[s] && !bots[s].g.over) bots[s].g.end('net');
    koNote(s, st.by);
    for (const c of conns.values()) if (c.open) try { c.send({ t: 'ko', s, by: st.by }); } catch (e) {}
    checkEnd();
    sync();
  }
  function checkEnd() {
    const rd = room.rd; if (!rd || rd.phase === 'over') return;
    const alive = rd.pl.filter(s => !rd.st[s].out);
    const people = rd.pl.some(s => rd.hum[s]), peopleIn = alive.some(s => rd.hum[s]);
    if (alive.length > 1 && !(people && !peopleIn)) return;
    let win = -1;
    if (alive.length === 1) win = alive[0];
    else if (alive.length > 1) {
      // only bots are left: the one that sent the most rows wins, and the rest follow
      const r = alive.slice().sort((a, b) => rd.st[b].sent - rd.st[a].sent || (bots[a] ? bots[a].g.height() : 0) - (bots[b] ? bots[b].g.height() : 0));
      win = r[0]; r.slice(1).forEach((s, i) => { rd.st[s].place = i + 2; });
    }
    if (win >= 0) { rd.st[win].place = 1; room.wins[win]++; }
    rd.win = win; rd.phase = 'over';
    for (const s in bots) if (!bots[s].g.over) bots[s].g.end('win', true);
    const loser = rd.pl.find(s => bots[s] && s !== win);
    if (loser != null && Math.random() < 0.5) say(loser, 4, 1, 1800);
    save();
    sync();
  }

  // ----- every step of the loop: the round's clock, the bots, the pictures of everyone's well -----
  const dirty = new Set();
  let lastKey = {}, snapAcc = 0, sendAcc = 0;
  function setSnap(s, sn) {
    const k = sn.b + (sn.p ? sn.p.join(',') : '') + ':' + sn.q + ':' + sn.h + ':' + sn.lv;
    S.snaps[s] = sn;
    if (lastKey[s] !== k) { lastKey[s] = k; dirty.add(s); }
  }
  S.tick = dt => {
    const rd = room.rd; if (!rd || closing) return;
    if (solo && U.paused) return;
    if (rd.phase === 'count' && now() >= rd.go) { rd.phase = 'play'; for (const s in bots) bots[s].g.start(); sync(); }
    if (rd.phase !== 'play' || (solo && U.cd)) return;
    for (const k in bots) {
      const s = +k, b = bots[k]; if (b.g.over) continue;
      b.ai.step(dt);
      for (const e of b.g.ev.splice(0)) {
        if (e.k === 'clear' && e.send > 0) { attack(s, e.send, -1); if (e.n === 4 && Math.random() < 0.25) say(s, 2, 1); }
        else if (e.k === 'over' && e.why !== 'win' && e.why !== 'net') out(s, e.why);
      }
      if (!b.said.low && b.g.height() >= 15) { b.said.low = 1; say(s, 5, 0.4); }
      if (rd.phase !== 'play') return;
    }
    snapAcc += dt;
    if (snapAcc >= 100) {
      snapAcc = 0;
      for (const k in bots) setSnap(+k, bots[k].g.snap());
      if (U.g && U.g.started && rd.pl.includes(0)) setSnap(0, U.g.snap());
    }
    sendAcc += dt;
    if (sendAcc >= 110) {
      sendAcc = 0;
      if (dirty.size && conns.size) {
        for (const [cs, c] of conns) {
          if (!c.open) continue;
          const d = {}; let n = 0;
          for (const s of dirty) if (s !== cs) { d[s] = S.snaps[s]; n++; }
          if (n) try { c.send({ t: 'snaps', d }); } catch (e) {}
        }
      }
      dirty.clear();
    }
  };
  // my own well's clears and my top-out
  S.onEv = (g, e) => {
    if (g !== U.g) return;
    const rd = room.rd; if (!rd || !rd.pl.includes(0)) return;
    if (e.k === 'clear' && e.send > 0) { attack(0, e.send, S.aim); SND.play('send', 60); }
    else if (e.k === 'over' && e.why !== 'win') out(0, e.why);
  };
  S.out = why => out(0, why);

  // ----- bots say something now and then -----
  let saidAt = 0;
  function say(s, p, chance, delay) {
    if (Math.random() > (chance == null ? 1 : chance) || Date.now() - saidAt < 8000) return;
    saidAt = Date.now();
    setTimeout(() => { if (!closing && room.seats[s] && room.seats[s].bot) broadcastChat(s, { p }); }, delay || 500 + Math.random() * 700);
  }

  // ----- the host's own buttons -----
  S.start = () => start();
  S.toRoom = () => toRoom();
  S.chat = m => broadcastChat(0, m);
  S.setBotLv = (s, lv) => { const p = room.seats[s]; if (p && p.bot && !(room.rd && room.rd.phase !== 'over' && room.rd.pl.includes(s))) { p.lv = lv; save(); sync(); } };
  S.kick = s => kick(s);
  S.addBot = s => { if (!room.seats[s] && s > 0) { addBot(s); save(); sync(); } };
  S.fillBots = () => { for (let s = 1; s < 4; s++) if (!room.seats[s]) addBot(s); save(); sync(); };
  S.leave = async kind => {
    closing = true;
    clearTimeout(syncT);
    if (solo) return;
    if (kind === 'end') { store.set('sb_host', null); for (const c of conns.values()) if (c.open) try { c.send({ t: 'ended' }); } catch (e) {} }
    else save();
    KeepAlive.release(); KeepAlive.mark(LIVE, null);
    await sleep(500);
    try { peer && peer.destroy(); } catch (e) {}
  };
  function kick(s) {
    if (s === 0) return;
    const rd = room.rd, inRound = rd && rd.phase !== 'over' && rd.pl.includes(s);
    if (inRound && bots[s]) return;   // a bot in the middle of a round stays to the end
    const c = conns.get(s);
    if (c) { try { c.send({ t: 'kicked' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 300); conns.delete(s); }
    if (inRound) out(s, 'net');
    room.seats[s] = null;
    save(); sync();
  }
  // ----- chat -----
  function broadcastChat(s, m) {
    const msg = cleanChat(m); if (!msg) return;
    chatIn(s, msg);
    for (const c of conns.values()) if (c.open) try { c.send({ t: 'chat', s, text: msg.text, emo: msg.emo, p: msg.p }); } catch (e) {}
  }
  function notice(k, v) { toast(T(k, v), 2600); for (const c of conns.values()) if (c.open) try { c.send({ t: 'note', k, v }); } catch (e) {} }

  // ----- the network -----
  function onData(conn, m) {
    if (!m || typeof m !== 'object') return;
    const rd = room.rd;
    if (m.t === 'hello') {
      const name = String(m.name || '').trim().slice(0, 10) || 'Guest';
      const tk = String(m.token || '').slice(0, 40);
      const av = clamp(m.av | 0, 0, AV.AVATARS.length - 1);
      let s = room.seats.findIndex((p, i) => i > 0 && p && !p.bot && p.token === tk);
      if (s < 0) {
        // a newcomer: an open seat, or a bot's seat while that bot isn't in a round
        s = [1, 2, 3].find(i => !room.seats[i]);
        if (s == null) s = [1, 2, 3].find(i => room.seats[i] && room.seats[i].bot && !(rd && rd.phase !== 'over' && rd.pl.includes(i)));
        if (s == null || s < 0) { try { conn.send({ t: 'err', code: 'full' }); } catch (e) {} setTimeout(() => { try { conn.close(); } catch (e) {} }, 600); return; }
        room.seats[s] = { id: 'p' + rid(6), name, av, bot: false, lv: 0, bn: -1, token: tk, conn: true };
        notice('joined', { n: name });
      } else {
        const p = room.seats[s], back = p.conn === false;
        p.name = name; p.av = av; p.conn = true;
        if (back && rd && rd.phase !== 'over') notice('isBack', { n: name });
      }
      lostAt[s] = 0;
      // swap in the new connection before closing the old one: the old one's close may fire at once and mustn't mark them gone
      const old = conns.get(s);
      conn._s = s; conns.set(s, conn); seen[s] = Date.now();
      if (old && old !== conn) { old._s = null; try { old.close(); } catch (e) {} }
      try { conn.send({ t: 'welcome', seat: s }); } catch (e) {}
      // back without the board they were playing (a reloaded page): that board is gone
      if (rd && rd.phase !== 'over' && rd.st[s] && !rd.st[s].out && m.live !== rd.id) out(s, 'net');
      save();
      sync();
      if (rd && rd.phase === 'play') { const d = {}; for (const k in S.snaps) if (+k !== s) d[k] = S.snaps[k]; try { conn.send({ t: 'snaps', d }); } catch (e) {} }
      return;
    }
    const s = conn._s; if (s == null || conns.get(s) !== conn) return;
    seen[s] = Date.now();
    if (m.t === 'ping') { try { conn.send({ t: 'pong' }); } catch (e) {} }
    else if (m.t === 'snap') { if (rd && m.r === rd.id && rd.st[s] && !rd.st[s].out) { const sn = cleanSnap(m.d); if (sn) setSnap(s, sn); } }
    else if (m.t === 'atk') { const n = m.n | 0; if (rd && m.r === rd.id && n > 0 && n <= 14) attack(s, n, m.to | 0); }
    else if (m.t === 'out') { if (rd && m.r === rd.id) out(s, m.why); }
    else if (m.t === 'chat') broadcastChat(s, m);
    else if (m.t === 'leave') {
      const p = room.seats[s];
      conns.delete(s);
      try { conn.send({ t: 'bye' }); } catch (e) {}
      notice('leftRoom', { n: p ? p.name : '' });
      if (rd && rd.phase !== 'over' && rd.st[s] && !rd.st[s].out) out(s, 'net');
      room.seats[s] = null;
      save(); sync();
    }
  }
  function onClose(conn) {
    const s = conn._s;
    if (s != null && conns.get(s) === conn) {
      conns.delete(s);
      const p = room.seats[s];
      if (p && !p.bot) { p.conn = false; lostAt[s] = Date.now(); if (!closing) notice('dropped', { n: p.name }); }
      sync();
    }
  }
  let tries = 0;
  function openPeer(first) {
    if (closing) return;
    const pr = peer = new Peer(PREFIX + code, peerOpts(KeepAlive.token(PREFIX + code)));
    pr.on('open', () => { if (pr !== peer) return; tries = 0; setNet(true); if (first) { overlay(null); toast(T('kaTip'), 4200); } sync(); });
    pr.on('connection', conn => {
      conn.on('data', m => onData(conn, m));
      conn.on('close', () => onClose(conn));
      conn.on('error', () => {});
    });
    pr.on('disconnected', () => { if (pr !== peer) return; setNet(false); setTimeout(() => { if (pr === peer && !pr.destroyed && pr.disconnected && !closing) { try { pr.reconnect(); } catch (e) {} } }, 1500); });
    pr.on('error', err => {
      if (closing || pr !== peer) return;
      if (err.type === 'unavailable-id') {
        if (!restore && first && !room.rounds) { try { peer.destroy(); } catch (e) {} code = rid(4); S.code = code; openPeer(true); return; }
        if (++tries < 30) { setNet(false); try { peer.destroy(); } catch (e) {} setTimeout(() => openPeer(first), 3000); }
        else toast(T('idTaken'));
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
        setNet(false); setTimeout(() => { if (closing) return; if (peer.destroyed) openPeer(first); else if (peer.disconnected) try { peer.reconnect(); } catch (e) {} }, 3000);
      }
    });
  }
  function revive(info) {
    if (closing || solo) return;
    const t = Date.now();
    for (let s = 0; s < 4; s++) if (conns.has(s)) seen[s] = Math.max(seen[s], t - 4000);
    if (info.away < 3000 && !info.online) return;
    if (info.frozen > 20000 || !peer || peer.destroyed) { try { peer && peer.destroy(); } catch (e) {} openPeer(false); }
    else if (!KeepAlive.live(peer)) { if (peer.disconnected) { try { peer.reconnect(); } catch (e) {} } else { try { peer.destroy(); } catch (e) {} openPeer(false); } }
  }
  KeepAlive.onResume(revive);
  // guests who stopped answering; a player gone for 8 seconds in the middle of a round is out
  let hbAt = Date.now();
  const hb = setInterval(() => {
    if (closing) { clearInterval(hb); return; }
    const t = Date.now();
    if (t - hbAt > 6000) { hbAt = t; for (let s = 0; s < 4; s++) { seen[s] = t; if (lostAt[s]) lostAt[s] = t; } return; }   // this page was frozen: don't judge the guests yet
    hbAt = t;
    for (const [s, c] of [...conns]) if (t - seen[s] > 11000) { onClose(c); c._s = null; try { c.close(); } catch (e) {} }
    const rd = room.rd;
    if (rd && rd.phase !== 'over') for (const s of rd.pl) if (rd.hum[s] && s !== 0 && lostAt[s] && t - lostAt[s] > 8000 && rd.st[s] && !rd.st[s].out) out(s, 'net');
  }, 1000);

  if (solo) {
    for (let s = 1; s <= P.foes; s++) addBot(s);
    start();
  } else {
    overlay(`<div class="spin"></div><b>${T('opening')}</b>`);
    KeepAlive.mark(LIVE, { kind: 'host' });
    KeepAlive.hold(T('kaTitle', { c: code }));
    openPeer(true);
    sync();
  }
}
// a picture of someone's well from the network: only well-formed ones get drawn and passed on
function cleanSnap(d) {
  if (!d || typeof d !== 'object' || typeof d.b !== 'string' || d.b.length !== 220 || !/^[0-9a-v]+$/.test(d.b)) return null;
  const p = Array.isArray(d.p) && d.p.length === 4 && d.p.every(x => Number.isInteger(x)) && d.p[0] >= 1 && d.p[0] <= 7 ? d.p.map(x => clamp(x, -4, 40)) : 0;
  const n = x => (Number.isFinite(+x) ? Math.round(+x) : 0);
  return { b: d.b, p, h: clamp(n(d.h), 0, 7), q: clamp(n(d.q), 0, 99), n: n(d.n), l: n(d.l), a: n(d.a), lv: clamp(n(d.lv), 1, 20), sc: n(d.sc) };
}
// a KO, said in each reader's own language
function koNote(s, by) {
  const v = S && S.view; if (!v) return;
  if (s === v.me) return;
  toast(by >= 0 ? (by === v.me ? T('ko', { n: nameOf(v, s) }) + ' 🎯' : T('koBy', { a: nameOf(v, by), n: nameOf(v, s) })) : T('ko', { n: nameOf(v, s) }), 2200);
  SND.play('ko');
}
// a chat message: a bubble on the speaker's card; quick phrases show in each reader's own language
function chatIn(s, m) {
  const p = Number.isInteger(m.p) && m.p >= 0 && m.p < T('phrases').length ? m.p : -1;
  const text = m.emo || (p >= 0 ? T('phrases')[p] : m.text);
  if (!text) return;
  const v = S && S.view;
  let host = null;
  if (screenOn === 'room') host = $('seats4').querySelector(`.rs[data-s="${s}"]`);
  else if (v && s !== v.me) host = $('opps').querySelector(`.opp[data-s="${s}"]`);
  if (host) {
    host.querySelectorAll('.bub').forEach(b => b.remove());
    const b = document.createElement('div'); b.className = 'bub' + (m.emo ? ' emo' : ''); b.textContent = text;
    host.appendChild(b); setTimeout(() => b.remove(), 3100);
  } else if (v) {
    const who = s === v.me ? '' : nameOf(v, s) + ': ';
    if (s === v.me && screenOn === 'game') pop(text, 'sm'); else toast(who + text, 2600);
  }
  SND.play('chat');
}
function cleanChat(m) {
  if (!m) return null;
  if (m.emo && EMOS.includes(m.emo)) return { emo: m.emo };
  if (Number.isInteger(m.p) && m.p >= 0 && m.p < T('phrases').length) return { p: m.p, text: T('phrases')[m.p] };
  const t = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return t ? { text: t } : null;
}
