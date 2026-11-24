// ===== a battle on this screen (the same for the host and a guest): a score race on the same board, cages, results =====
// view: { seats: [{name, av, bot, lv, bn, conn, wins} | null], me, rd: { id, n, seed, dur, atk, phase: count|play|over, goIn, pl,
//         st: {seat: {sc, fin, place, sent, got}}, win, names } | null }
// room: { code, solo, lobby (the waiting room is showing), time, atk }
function onView(v, room) {
  S.view = v; S.room = room;
  S.tbInfo = battleInfo; S.paint = paintMinis; S.refresh = () => { if (S.view && S.view.rd) { buildOpps(S.view); paintOpps(S.view); } };
  if (room.lobby || !v.rd) { renderRoom(v, room); return; }
  if (screenOn !== 'game' || U.kind !== 'battle') {
    S.snaps = S.snaps || {};
    U.rid = 0; U.g = null;
    setupScreen({ kind: 'battle', battle: true, chat: !room.solo });
  }
  battle(v, room);
}
const nameOf = (v, s) => { const p = v.seats[s]; if (p) return p.bot ? botName(p) : p.name; const n = v.rd && v.rd.names && v.rd.names[s]; return n ? (n.bn >= 0 ? T('botNames')[n.bn % 8] : n.name) : '?'; };
const playing = v => !!(v.rd && v.rd.pl.includes(v.me));
// big moves drop cages on the leader: two specials together, a firework, a chain of three waves or more.
// acc keeps the count for the move being worked out; the cages go when the move is done
function cagesOf(acc, e) {
  if (e.k === 'combo') acc.n += e.type === 'ww' ? 3 : 2;
  else if (e.k === 'special' && e.kind === 'fw' && !e.chain) acc.n += 2;
  else if (e.k === 'done') { const n = Math.min(4, acc.n + (e.wave >= 4 ? 3 : e.wave >= 2 ? e.wave - 1 : 0)); acc.n = 0; return n; }
  return 0;
}
function battle(v, room) {
  const rd = v.rd;
  if (U.rid !== rd.id) {
    // a new round: everyone gets the same board from the round's seed
    U.rid = rd.id; U.resShown = false; U.fin = false; S.snaps = {}; S.acc = { n: 0 };
    if (sheetOn) closeSheet();
    const pk = $('peekBack'); if (pk) pk.hidden = true;
    msg('');
    // a guest whose page was reloaded in the middle of this round picks up its own board where it was
    let g = null;
    const back = S.resume && S.resume.rid === rd.id && rd.phase === 'play' && playing(v) && rd.st[v.me] && !rd.st[v.me].fin;
    if (back) { try { g = MM.Game.fromJSON(S.resume.G); if (!g.started || g.over || g.W * g.H !== 64) g = null; } catch (e) { g = null; } }
    S.resume = null;
    if (!g) g = new MM.Game({ mode: 'time', seed: rd.seed, time: rd.dur, colors: 6 });
    U.g = g; U.watching = !(playing(v) && (rd.phase === 'count' || g.started));
    buildOpps(v);
    syncAll(g); setSel(-1); layoutGame();
    if (!U.watching && g.started) {
      SND.music.tempo(true);
      countdown(now() + 1500, () => { if (U.g === g && S.view.rd && S.view.rd.id === rd.id && S.view.rd.phase !== 'over') SND.music.start(true); }, 1500);
    } else if (!U.watching) {
      introPop();
      SND.music.tempo(true);
      countdown(now() + Math.max(600, rd.goIn), () => { if (U.g === g && S.view.rd && S.view.rd.id === rd.id && S.view.rd.phase !== 'over') { g.start(); drain(); SND.music.start(true); } });
    } else if (rd.phase !== 'over') msg(`<div class="s">${esc(T('joinNext'))}</div>`, true);   // a round that started without me: I watch the others
  }
  paintOpps(v);
  tbInfo();
  // my time is up and the others are still going
  if (!U.watching && U.g && U.g.over && rd.phase !== 'over' && !U.fin) { U.fin = true; msg(`<div class="h">${esc(T('timeUp'))}</div><div class="s">${esc(T('waitOthers'))}</div>`, true); }
  if (rd.phase === 'over' && !U.resShown) {
    U.resShown = true;
    if (!U.watching && U.g && U.g.started && !U.g.over) { U.g.end('time'); drain(); }
    SND.music.stop();
    const won = rd.win === v.me;
    if (won) SND.play('win');
    else if (playing(v)) SND.play('lose', 300);
    msg(rd.win < 0 ? `<div class="h">${esc(T('draw'))}</div>` : won ? `<div class="h">${esc(T('youWin'))}</div>` : `<div class="h">${esc(T('roundOver'))}</div><div class="s">${esc(T('theyWin', { n: nameOf(v, rd.win) }))}</div>`, true);
    setTimeout(() => { if (U.rid === rd.id && S.view.rd && S.view.rd.phase === 'over') showBattleResults(); }, 1700);
  }
}

// ---------- the other players' cards: a small board, the name and the score ----------
const oppSeats = v => (v.rd ? v.rd.pl.filter(s => s !== v.me) : []);
function buildOpps(v) {
  const box = $('opps'); box.innerHTML = '';
  for (const s of oppSeats(v)) {
    const d = document.createElement('div');
    d.className = 'opp'; d.dataset.s = s; d.style.setProperty('--pc', pcOf(s));
    d.innerHTML = `<canvas></canvas><div class="inf"><div class="who"><span class="av"></span><span class="nm"></span></div><div class="sc num"></div></div><span class="rk">${esc(T('leader'))}</span>`;
    box.appendChild(d);
  }
  U.miniKey = {};
  layoutGame();
}
// everyone's score right now: mine from my game, the others' from their latest picture (or the final score)
function scoreOf(v, s) {
  const st = v.rd && v.rd.st[s];
  if (st && st.fin) return st.sc;
  if (s === v.me && U.g && !U.watching) return U.g.score;
  const sn = S.snaps && S.snaps[s];
  return sn ? sn.s : 0;
}
function leaderOf(v) {
  let best = -1, who = -1;
  for (const s of v.rd.pl) { const x = scoreOf(v, s); if (x > best) { best = x; who = s; } else if (x === best) who = -1; }
  return best > 0 ? who : -1;
}
function paintOpps(v) {
  const rd = v.rd; if (!rd) return;
  const lead = leaderOf(v);
  $('opps').querySelectorAll('.opp').forEach(d => {
    const s = +d.dataset.s, p = v.seats[s], st = rd.st[s] || {};
    const av = d.querySelector('.av'), key = p ? (p.bot ? 'b' + p.lv : 'a' + p.av) + ':' + s : 'x';
    if (av.dataset.k !== key) { av.dataset.k = key; av.innerHTML = p ? avSvg(p, s) : ''; }
    const nm = nameOf(v, s); if (d.querySelector('.nm').textContent !== nm) d.querySelector('.nm').textContent = nm;
    const sc = fmtN(scoreOf(v, s)); if (d.querySelector('.sc').textContent !== sc) d.querySelector('.sc').textContent = sc;
    d.classList.toggle('lead', lead === s && rd.phase !== 'count');
    d.classList.toggle('done', !!st.fin && rd.phase !== 'over');
  });
  const hs = $('hud').querySelector('.hb.sc');
  if (hs) { const on = lead === v.me && rd.phase === 'play' && playing(v); if (on !== hs.classList.contains('lead')) { hs.classList.toggle('lead', on); hs.dataset.lead = T('leader'); } }
}
// each frame: redraw the small boards whose picture changed, and the scores
function paintMinis() {
  const v = S && S.view; if (!v || !v.rd || screenOn !== 'game') return;
  const keys = U.miniKey || (U.miniKey = {}), m = miniCell();
  let any = false;
  $('opps').querySelectorAll('.opp').forEach(d => {
    const s = +d.dataset.s, sn = S.snaps && S.snaps[s];
    const k = (sn ? sn.b + ':' + sn.s : '-') + ':' + m + ':' + DPR + ':' + A.theme;
    if (keys[s] === k) return;
    keys[s] = k; any = true;
    drawMini(d.querySelector('canvas'), sn || blankSnap(v), m);
  });
  if (any || (U.g && U.g.score !== U.myLast)) { U.myLast = U.g ? U.g.score : 0; paintOpps(v); }
}
const blankSnap = v => { const g = U.g || V.g; return g ? { b: g.snap().b.replace(/[^#]/g, '.'), w: g.W } : null; };
// the cell size of the small boards: a row of cards on a phone, a column beside the board on a wide screen
function miniCell() {
  const n = Math.max(1, $('opps').children.length), w = (V.g && V.g.W) || 8, h = (V.g && V.g.H) || 8;
  // a column of cards as tall as the board: on a wide screen each card has its board on top, on a phone on its side beside the name
  if (R.side && U.battle) return clamp(Math.floor(Math.min((oppColW() - 100) / w, ((R.c * h - (n - 1) * 8) / n - 12) / h)), 3, 9);
  if (R.wide && U.battle) {
    const byH = Math.floor((R.c * h - n * 70 - (n - 1) * 10) / n / h);
    return clamp(Math.min(Math.floor((oppColW() - 18) / w), byH), 6, 30);
  }
  const card = (innerWidth - 16 - 6 * (n - 1)) / n;
  return clamp(Math.floor(card * 0.4 / w), 3, 7);
}
// cages flying from one player to another
function cardOf(s) { const v = S && S.view; if (!v) return null; if (s === v.me) return $('stage'); return $('opps').querySelector(`.opp[data-s="${s}"]`); }
function orb(a, b, n) {
  const ea = cardOf(a), eb = cardOf(b); if (!ea || !eb || screenOn !== 'game') return;
  const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
  for (let k = 0; k < Math.min(n, 4); k++) {
    const o = document.createElement('div'); o.className = 'orb';
    o.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-cage"/></svg>';
    o.style.transform = `translate(${ra.left + ra.width / 2}px,${ra.top + ra.height * 0.45}px) scale(.6)`;
    document.body.appendChild(o);
    setTimeout(() => requestAnimationFrame(() => { o.style.transform = `translate(${rb.left + rb.width * (0.3 + 0.13 * k)}px,${rb.top + rb.height * 0.5}px) scale(1)`; }), 40 + k * 90);
    setTimeout(() => { o.style.opacity = '0'; if (k === 0 && eb.classList.contains('opp')) { eb.classList.remove('hit'); void eb.offsetWidth; eb.classList.add('hit'); } }, 560 + k * 90);
    setTimeout(() => o.remove(), 820 + k * 90);
  }
}
// cages are coming my way: the toast says who sent them
function cagedBy(v, from) { if (v && from >= 0 && from !== v.me) toast(T('caged', { n: nameOf(v, from) }), 2000); }
// top bar: the round, and the room on a wider screen
function battleInfo(box) {
  const v = S.view, room = S.room || {}; if (!v || !v.rd) { box.innerHTML = ''; return; }
  let h = `<span class="chip"><b>${esc(T('round', { n: v.rd.n }))}</b></span>`;
  if (!room.solo && room.code && innerWidth >= 380) h += `<span class="chip">${esc(T('roomChip', { c: room.code }))}</span>`;
  if (box.innerHTML !== h) box.innerHTML = h;
}

// ---------- the result of a round ----------
function showBattleResults() {
  const v = S.view, rd = v.rd, room = S.room || {};
  if (!rd) return;
  const won = rd.win === v.me;
  const t1 = rd.win < 0 ? T('draw') : won ? T('youWin') : T('roundOver');
  const t2 = (rd.win >= 0 && !won ? T('theyWin', { n: nameOf(v, rd.win) }) + ' · ' : '') + T('round', { n: rd.n });
  const face = won ? 'happy' : playing(v) ? 'sleep' : 'wow';
  let h = `<div class="res-head"><div class="mo">${pic('m', won ? 0 : 2, face)}</div><div class="t1">${esc(t1)}</div><div class="t2">${esc(t2)}</div></div>`;
  const order = rd.pl.slice().sort((a, b) => (rd.st[a].place || 9) - (rd.st[b].place || 9) || rd.st[b].sc - rd.st[a].sc);
  for (const s of order) {
    const st = rd.st[s], p = v.seats[s] || { bot: true, lv: 2 };
    const w = (v.seats[s] && v.seats[s].wins) || 0;
    const dt = (w === 1 ? T('win1') : T('wins', { n: w })) + (st.sent ? ' · ' + T('cagesN', { n: st.sent }) : '');
    h += `<div class="rrow${st.place === 1 ? ' win' : ''}" style="--pc:${pcOf(s)}"><span class="rk">${st.place || '·'}</span><span class="av">${avSvg(p, s)}</span>` +
      `<div class="bd"><div class="nm">${esc(nameOf(v, s))}${s === v.me ? `<small>${esc(T('youTag'))}</small>` : ''}</div><div class="dt">${esc(dt)}</div></div>` +
      `<div class="w"><b>${fmtN(st.sc)}</b><small>${esc(T('score'))}</small></div></div>`;
  }
  h += '<div class="resfoot" id="resFoot"></div>';
  sheet(h, { id: 'result', lock: true });
  const f = $('resFoot');
  const btn = (txt, cls, fn, ic) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.innerHTML = (ic ? `<svg class="ic" viewBox="0 0 24 24"><use href="#i-${ic}"/></svg>` : '') + esc(txt); b.onclick = fn; return b; };
  if (S.isHost) {
    f.appendChild(btn(T('nextRound'), 'gold', () => { closeSheet(); S.start(); }, 'again'));
    const r2 = document.createElement('div'); r2.className = 'row2';
    if (!room.solo) r2.appendChild(btn(T('toRoom'), 'glass', () => { closeSheet(); S.toRoom(); }, 'room'));
    r2.appendChild(btn(T('backLobby'), 'glass', () => { if (room.solo) goLobby(); else confirmBox(T('confirmEnd'), async () => { await S.leave('end'); goLobby(); }, () => showBattleResults()); }));
    f.appendChild(r2);
  } else {
    if (!S.ended) { const w = document.createElement('div'); w.className = 'more'; w.innerHTML = `<div class="spin sm"></div>${esc(T('waitHost'))}`; f.appendChild(w); }
    f.appendChild(btn(T('leaveRoom'), 'glass', async () => { if (S && S.leave && !S.ended) await S.leave(); goLobby(); }));
  }
  f.appendChild(btn(T('peek'), 'glass', () => { closeSheet(); peekBtn(); }, 'eye'));
}
function peekBtn() {
  let b = $('peekBack');
  if (!b) { b = document.createElement('button'); b.id = 'peekBack'; b.className = 'btn gold sm peekbtn'; document.body.appendChild(b); }
  b.textContent = T('results'); b.hidden = false;
  b.onclick = () => { b.hidden = true; if (S && S.view && S.view.rd && S.view.rd.phase === 'over') showBattleResults(); };
}
