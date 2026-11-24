// ===== the host: the room, the bots, the rounds and PeerJS (a solo battle against bots is a host with no network) =====
// Every player runs their own board. The host starts each round (one seed, so everyone gets the same board and the same
// new pieces), sends the cages of a big move to whoever leads, relays the small pictures of everyone's board, runs the
// bots, and ranks the final scores.
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
  let peer = null, closing = false, bots = {};
  S = { mode: solo ? 'solo' : 'host', code, isHost: true, view: null, room: null, canPause: solo, snaps: {}, acc: { n: 0 } };
  S.roomState = () => room;   // tests
  S.botsNow = () => bots;     // tests

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

  // ----- what everyone sees -----
  function view(s) {
    const rd = room.rd;
    return {
      seats: room.seats.map((p, i) => p && { name: p.name, av: p.av, bot: p.bot, lv: p.lv, bn: p.bn, conn: p.conn !== false, wins: room.wins[i] }),
      me: s,
      rd: rd && { id: rd.id, n: rd.n, seed: rd.seed, dur: rd.dur, atk: rd.atk, phase: rd.phase, goIn: Math.round(rd.go - now()), pl: rd.pl, st: rd.st, win: rd.win, names: rd.names },
    };
  }
  const roomInfo = () => ({ code, solo, lobby: room.lobby, time: P.time, atk: P.atk });
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
    store.set('tt_host', { code, at: Date.now(), wins: room.wins, rounds: room.rounds, seats: room.seats.map((p, s) => p && s > 0 && { name: p.name, av: p.av, bot: p.bot, lv: p.lv, bn: p.bn, token: p.token }) });
  }

  // ----- rounds -----
  function start() {
    if (closing || (room.rd && room.rd.phase !== 'over')) return;
    const pl = [0, 1, 2, 3].filter(s => room.seats[s] && (room.seats[s].bot || room.seats[s].conn !== false));
    if (pl.length < 2) { toast(T('startNeed')); return; }
    const rd = { id: (Date.now() % 1e8) * 10 + Math.floor(Math.random() * 10), n: ++room.rounds, seed: 1 + Math.floor(Math.random() * 2 ** 30), dur: (solo ? 90 : P.time) * 1000, atk: !!P.atk, phase: 'count', go: now() + 3200, pl, st: {}, win: -1, names: {}, hum: {} };
    for (const s of pl) {
      const p = room.seats[s];
      rd.st[s] = { sc: 0, fin: false, place: 0, sent: 0, got: 0 };
      rd.names[s] = { name: p.name, bn: p.bot ? p.bn : -1 };
      rd.hum[s] = !p.bot;
    }
    room.rd = rd; room.lobby = false;
    bots = {}; S.snaps = {}; dirty.clear(); lastKey = {};
    for (const s of pl) if (room.seats[s].bot) {
      const g = new MM.Game({ mode: 'time', seed: rd.seed, time: rd.dur, colors: 6, rec: false });
      bots[s] = { g, ai: new AI.Bot(g, room.seats[s].lv), acc: { n: 0 }, said: {} };
    }
    save();
    sync();
  }
  function toRoom() { if (room.rd && room.rd.phase !== 'over') return; room.lobby = true; room.rd = null; bots = {}; sync(); }
  // the score a seat has right now, as the host knows it
  function scoreNow(s) {
    const rd = room.rd, st = rd && rd.st[s];
    if (st && st.fin) return st.sc;
    if (s === 0) return U.g && !U.watching ? U.g.score : 0;
    if (bots[s]) return bots[s].g.score;
    return S.snaps[s] ? S.snaps[s].s : 0;
  }
  // cages from a big move land on the leader among the others (a random one of them when it's a tie)
  function attack(from, n) {
    const rd = room.rd; if (!rd || rd.phase !== 'play' || !rd.atk || !rd.st[from] || n <= 0) return;
    const others = rd.pl.filter(s => s !== from && !rd.st[s].fin);
    if (!others.length) return;
    const top = Math.max(...others.map(scoreNow)), cand = others.filter(s => scoreNow(s) === top);
    const tg = cand[Math.floor(Math.random() * cand.length)];
    rd.st[from].sent += n; rd.st[tg].got += n;
    if (tg === 0) { if (U.g && U.g.started && !U.g.over) { U.g.addCages(n); drain(); cagedBy(S.view, from); } }
    else if (bots[tg]) { bots[tg].g.addCages(n); if (n >= 2) say(tg, 7, 0.3); }
    else { const c = conns.get(tg); if (c && c.open) try { c.send({ t: 'cage', r: rd.id, n, from }); } catch (e) {} }
    orb(from, tg, n);
    for (const c of conns.values()) if (c.open) try { c.send({ t: 'fx', a: from, b: tg, n }); } catch (e) {}
    syncSoon();
  }
  // a player's time is up (or they dropped out): their score is final
  function finish(s, sc) {
    const rd = room.rd; if (!rd || rd.phase === 'over') return;
    const st = rd.st[s]; if (!st || st.fin) return;
    st.fin = true; st.sc = Math.max(0, sc | 0);
    if (rd.pl.every(x => rd.st[x].fin)) end();
    else sync();
  }
  function end() {
    const rd = room.rd; if (!rd || rd.phase === 'over') return;
    for (const s of rd.pl) { const st = rd.st[s]; if (!st.fin) { st.fin = true; st.sc = scoreNow(s); } }
    for (const s of rd.pl) rd.st[s].place = 1 + rd.pl.filter(x => rd.st[x].sc > rd.st[s].sc).length;
    const firsts = rd.pl.filter(s => rd.st[s].place === 1);
    rd.win = firsts.length === 1 ? firsts[0] : -1;
    if (rd.win >= 0) room.wins[rd.win]++;
    rd.phase = 'over';
    for (const s in bots) if (!bots[s].g.over) bots[s].g.end('time');
    const bot = rd.pl.find(s => bots[s]);
    if (bot != null && Math.random() < 0.5) say(bot, rd.win === bot ? 0 : 6, 1, 2200);
    save();
    sync();
  }

  // ----- every step of the loop: the round's clock, the bots, the pictures of everyone's board -----
  const dirty = new Set();
  let lastKey = {}, snapAcc = 0, sendAcc = 0;
  function setSnap(s, sn) {
    const k = sn.b + ':' + sn.s;
    S.snaps[s] = sn;
    if (lastKey[s] !== k) { lastKey[s] = k; dirty.add(s); }
  }
  S.tick = dt => {
    const rd = room.rd; if (!rd || closing) return;
    // on my own against bots, the bots wait while I pause, and start when I do
    if (solo && (U.paused || U.cd)) return;
    if (rd.phase === 'count' && (solo ? U.g && U.g.started : now() >= rd.go)) { rd.phase = 'play'; for (const s in bots) bots[s].g.start(); sync(); }
    if (rd.phase !== 'play') return;
    for (const k in bots) {
      const s = +k, b = bots[k]; if (b.g.over) continue;
      b.ai.step(dt);
      for (const e of b.g.ev.splice(0)) {
        const n = cagesOf(b.acc, e);
        if (n) { attack(s, n); if (n >= 3) say(s, 3, 0.3); }
        if (e.k === 'over') finish(s, b.g.score);
      }
      if (rd.phase !== 'play') return;
    }
    // a guest that went quiet: the round ends for everyone a little after the clock
    if (!solo && now() > rd.go + rd.dur + 9000) { end(); return; }
    snapAcc += dt;
    if (snapAcc >= 100) {
      snapAcc = 0;
      for (const k in bots) setSnap(+k, bots[k].g.snap());
      if (U.g && U.g.started && !U.watching) setSnap(0, U.g.snap());
    }
    sendAcc += dt;
    if (sendAcc >= 120) {
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
  // my own board: its big moves and its end
  S.onEv = (g, e) => {
    if (g !== U.g || U.watching) return;
    const rd = room.rd; if (!rd || !rd.pl.includes(0)) return;
    const n = cagesOf(S.acc, e);
    if (n) { attack(0, n); SND.play('send', 60); }
    if (e.k === 'over') finish(0, g.score);
  };

  // ----- bots say something now and then -----
  let saidAt = 0;
  function say(s, p, chance, delay) {
    if (solo && U.paused) return;
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
  S.setOpt = () => { saveP(); sync(); };
  S.restart = () => { if (solo) { closeSheet(); room.rd = null; start(); } };
  S.leave = async kind => {
    closing = true;
    clearTimeout(syncT);
    if (solo) return;
    if (kind === 'end') { store.set('tt_host', null); for (const c of conns.values()) if (c.open) try { c.send({ t: 'ended' }); } catch (e) {} }
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
    if (inRound) finish(s, scoreNow(s));
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
      // back without the board they were playing (a reloaded page): that board is gone, its last score counts
      if (rd && rd.phase !== 'over' && rd.st[s] && !rd.st[s].fin && m.live !== rd.id) finish(s, scoreNow(s));
      save();
      sync();
      if (rd && rd.phase === 'play') { const d = {}; for (const k in S.snaps) if (+k !== s) d[k] = S.snaps[k]; try { conn.send({ t: 'snaps', d }); } catch (e) {} }
      return;
    }
    const s = conn._s; if (s == null || conns.get(s) !== conn) return;
    seen[s] = Date.now();
    if (m.t === 'ping') { try { conn.send({ t: 'pong' }); } catch (e) {} }
    else if (m.t === 'snap') { if (rd && m.r === rd.id && rd.st[s] && !rd.st[s].fin) { const sn = cleanSnap(m.d); if (sn) setSnap(s, sn); } }
    else if (m.t === 'atk') { const n = m.n | 0; if (rd && m.r === rd.id && n > 0 && n <= 4) attack(s, n); }
    else if (m.t === 'fin') { if (rd && m.r === rd.id && Number.isFinite(+m.sc)) finish(s, Math.min(+m.sc, 9e6)); }
    else if (m.t === 'chat') broadcastChat(s, m);
    else if (m.t === 'leave') {
      const p = room.seats[s];
      conns.delete(s);
      try { conn.send({ t: 'bye' }); } catch (e) {}
      notice('leftRoom', { n: p ? p.name : '' });
      if (rd && rd.phase !== 'over' && rd.st[s] && !rd.st[s].fin) finish(s, scoreNow(s));
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
  if (!solo) KeepAlive.onResume(revive);
  // guests who stopped answering; a player gone for 8 seconds in the middle of a round keeps the score they had
  let hbAt = Date.now();
  const hb = setInterval(() => {
    if (closing) { clearInterval(hb); return; }
    const t = Date.now();
    if (t - hbAt > 6000) { hbAt = t; for (let s = 0; s < 4; s++) { seen[s] = t; if (lostAt[s]) lostAt[s] = t; } return; }   // this page was frozen: don't judge the guests yet
    hbAt = t;
    for (const [s, c] of [...conns]) if (t - seen[s] > 11000) { onClose(c); c._s = null; try { c.close(); } catch (e) {} }
    const rd = room.rd;
    if (rd && rd.phase !== 'over') for (const s of rd.pl) if (rd.hum[s] && s !== 0 && lostAt[s] && t - lostAt[s] > 8000 && rd.st[s] && !rd.st[s].fin) finish(s, scoreNow(s));
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
// a picture of someone's board from the network: only well-formed ones get drawn and passed on
function cleanSnap(d) {
  if (!d || typeof d !== 'object') return null;
  const w = d.w | 0, b = MM.unsnap(d.b, w);
  if (!b) return null;
  const n = x => (Number.isFinite(+x) ? Math.max(0, Math.round(+x)) : 0);
  return { b, w, s: Math.min(n(d.s), 9e6), t: n(d.t), m: n(d.m) };
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
    const who = s === v.me ? '' : nameOf(v, s) + colon();
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
