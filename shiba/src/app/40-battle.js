// ===== a battle on this screen (the same for the host and a guest): rounds, the opponents' wells, aiming, results =====
// view: { seats: [{name, av, bot, lv, bn, conn, wins} | null], me, rd: { id, n, phase: count|play|over, goIn, pl, st: {seat: {out, place, why, ko, sent, by}}, win } | null }
// room: { code, solo, lobby (the waiting room is showing) }
function onView(v, room, again) {
  S.view = v; S.room = room;
  S.minis = drawMinis; S.tbInfo = battleInfo; S.myStat = myStatOf;
  if (room.lobby || !v.rd) { renderRoom(v, room); return; }
  if (screenOn !== 'game' || U.kind !== 'battle') {
    S.snaps = S.snaps || {};
    setupScreen({ kind: 'battle', battle: true, chat: !room.solo });
    U.rid = 0;
  }
  battle(v, room);
}
const nameOf = (v, s) => { const p = v.seats[s]; if (p) return p.bot ? botName(p) : p.name; const n = v.rd && v.rd.names && v.rd.names[s]; return n ? (n.bn >= 0 ? T('botNames')[n.bn % 8] : n.name) : '?'; };
const playing = v => !!(v.rd && v.rd.pl.includes(v.me));
const aliveIn = (v, s) => !!(v.rd && v.rd.pl.includes(s) && v.rd.st[s] && !v.rd.st[s].out);
function battle(v, room) {
  const rd = v.rd;
  if (U.rid !== rd.id) {
    // a new round
    U.rid = rd.id; U.resShown = false; U.outPlace = 0; U.watch = -1; S.aim = -1; S.snaps = {};
    WELL.fx = []; WELL.flash = []; WELL.trail = []; U.ver++;
    if (sheetOn) closeSheet();
    const pk = $('peekBack'); if (pk) pk.hidden = true;
    U.g = null;
    if (playing(v) && rd.phase === 'count') {
      const g = new SB.Game({ mode: 'versus', seed: rd.seed, gseed: rd.seed * 31 + v.me * 7 + 1 });
      U.g = g;
      SND.music.tempo(1);
      countdown(now() + Math.max(0, rd.goIn), () => { if (U.g === g && S.view.rd && S.view.rd.id === rd.id && S.view.rd.phase !== 'over') { g.start(); drain(); SND.music.start(true); } });
    } else if (playing(v) && rd.phase === 'play' && aliveIn(v, v.me)) {
      // the page was reloaded during a round: that board is gone
      if (S.out) S.out('net');
      U.outPlace = -1;
    } else if (!playing(v) && rd.phase !== 'over') {
      msg(`<div class="s">${esc(T('joinNext'))}</div>`);
      setTimeout(() => { if (U.rid === rd.id && !U.g) msg(''); }, 3500);
    }
    buildOpps(v);
    // the first battle with two or more opponents: say how aiming works
    if (playing(v) && oppSeats(v).length >= 2 && !store.get('sb_tip_aim')) { store.set('sb_tip_aim', 1); setTimeout(() => toast(T('autoTarget'), 5500), 900); }
  }
  paintOpps(v);
  tbInfo();
  const me = rd.st[v.me];
  // the host says I'm out (I dropped off the network for too long): stop my well too
  if (me && me.out && U.g && U.g.started && !U.g.over) { U.g.end('net'); drain(); }
  // I'm out: say where I finished, then watch someone still in
  if (me && me.out && U.outPlace !== me.place && rd.phase !== 'over') {
    U.outPlace = me.place;
    const others = rd.pl.filter(s => s !== v.me && aliveIn(v, s));
    msg(`<div class="h">${esc(T('youOut'))}</div><div class="s">${esc(T('placeN')[me.place] || '')}</div>` + (others.length > 1 ? `<div class="s">${esc(T('tapWatch'))}</div>` : ''), true);
    setTimeout(() => { if (U.rid === rd.id && S.view.rd.phase !== 'over') { pickWatch(); msg(''); } }, 2200);
  }
  if (U.watch >= 0 && !aliveIn(v, U.watch) && rd.phase === 'play' && (!U.g || U.g.over)) pickWatch();
  if (rd.phase === 'over' && !U.resShown) {
    U.resShown = true;
    if (U.g && !U.g.over) U.g.end('win', true);
    drain();
    SND.music.stop();
    const won = rd.win === v.me;
    if (won) { SND.play('win'); setMood('proud', 4000); }
    else if (playing(v)) SND.play('lose', 300);
    msg(rd.win < 0 ? `<div class="h">${esc(T('draw'))}</div>` : won ? `<div class="h">${esc(T('youWin'))}</div>` : `<div class="h">${esc(T('roundOver'))}</div><div class="s">${esc(T('theyWin', { n: nameOf(v, rd.win) }))}</div>`, true);
    setTimeout(() => { if (U.rid === rd.id && S.view.rd && S.view.rd.phase === 'over') showBattleResults(); }, 1700);
  }
}
function pickWatch() {
  const v = S.view, rd = v.rd; if (!rd) return;
  const alive = rd.pl.filter(s => s !== v.me && aliveIn(v, s));
  if (!alive.length) return;
  if (!alive.includes(U.watch)) U.watch = alive.includes(S.aim) ? S.aim : alive[0];
  U.ver++;
  paintOpps(v); tbInfo();
}
// ---------- the opponents' cards ----------
function oppSeats(v) { return v.rd ? v.rd.pl.filter(s => s !== v.me) : []; }
function buildOpps(v) {
  const box = $('opps'); box.innerHTML = '';
  for (const s of oppSeats(v)) {
    const d = document.createElement('div');
    d.className = 'opp'; d.dataset.s = s; d.style.setProperty('--pc', pcOf(s));
    d.innerHTML = `<canvas></canvas><div class="inf"><div class="who"><span class="av"></span><span class="nm"></span></div><div class="st"></div></div><span class="tg"><svg viewBox="0 0 24 24"><use href="#i-target"/></svg></span><span class="pl"></span>`;
    d.onclick = () => tapOpp(s);
    box.appendChild(d);
  }
  U.minisDirty = true; U.miniKey = {};
  layout();
}
function paintOpps(v) {
  const rd = v.rd; if (!rd) return;
  $('opps').querySelectorAll('.opp').forEach(d => {
    const s = +d.dataset.s, p = v.seats[s], st = rd.st[s] || {};
    const av = d.querySelector('.av'), key = p ? (p.bot ? 'b' + p.lv : 'a' + p.av) + ':' + s : 'x';
    if (av.dataset.k !== key) { av.dataset.k = key; av.innerHTML = p ? avSvg(p, s) : ''; }
    d.querySelector('.nm').textContent = nameOf(v, s);
    const ko = st.ko || 0;
    d.querySelector('.st').innerHTML = `<span>${esc(T('sent'))} <b>${st.sent || 0}</b></span><span>${esc(T('kos'))} <b>${ko}</b></span>`;
    d.classList.toggle('out', !!st.out);
    const pl = d.querySelector('.pl');
    pl.textContent = st.out ? (T('placeN')[st.place] || '') : '';
    const cv = d.querySelector('canvas'); pl.style.width = cv.style.width; pl.style.height = cv.style.height;
    d.classList.toggle('aim', S.aim === s && !st.out && aliveIn(v, v.me) && !!U.g && !U.g.over);
    d.classList.toggle('watch', U.watch === s && (!U.g || U.g.over));
  });
}
function tapOpp(s) {
  const v = S.view; if (!v || !v.rd) return;
  if (aliveIn(v, v.me) && U.g && !U.g.over) {
    if (!aliveIn(v, s)) return;
    S.aim = S.aim === s ? -1 : s;
    SND.play('aim');
    toast(S.aim >= 0 ? T('aimAt', { n: nameOf(v, s) }) : T('aimAuto'), 1500);
  } else if (aliveIn(v, s) || (S.snaps && S.snaps[s])) { U.watch = s; U.ver++; SND.play('tap'); }
  paintOpps(v); tbInfo();
}
// each frame: redraw the small wells whose picture changed
function drawMinis() {
  if (!S || !S.view) return;
  const keys = U.miniKey || (U.miniKey = {});
  $('opps').querySelectorAll('.opp').forEach(d => {
    const s = +d.dataset.s, sn = S.snaps && S.snaps[s];
    const k = (sn ? sn.b + (sn.p || '') : '-') + ':' + R.m + ':' + DPR;
    if (keys[s] === k && !U.minisDirty) return;
    keys[s] = k;
    drawMini(d.querySelector('canvas'), sn, R.m);
  });
  U.minisDirty = false;
}
// rows flying from one well to another
function cardOf(s) { const v = S.view; if (!v) return null; if (s === v.me) return $('wellbox'); return $('opps').querySelector(`.opp[data-s="${s}"]`); }
function orb(a, b, n) {
  const ea = cardOf(a), eb = cardOf(b); if (!ea || !eb) return;
  const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
  const o = document.createElement('div'); o.className = 'orb';
  const sz = clamp(10 + n * 2.5, 12, 30); o.style.width = o.style.height = sz + 'px'; o.style.margin = `${-sz / 2}px 0 0 ${-sz / 2}px`;
  o.style.transform = `translate(${ra.left + ra.width / 2}px,${ra.top + ra.height * 0.45}px)`;
  document.body.appendChild(o);
  requestAnimationFrame(() => requestAnimationFrame(() => { o.style.transform = `translate(${rb.left + rb.width / 2}px,${rb.top + rb.height * 0.5}px)`; }));
  setTimeout(() => { o.style.opacity = '0'; if (eb.classList.contains('opp')) { eb.classList.remove('hit'); void eb.offsetWidth; eb.classList.add('hit'); } }, 480);
  setTimeout(() => o.remove(), 720);
}
// top bar: round, room, who my rows go to
function battleInfo(box) {
  const v = S.view, room = S.room || {}; if (!v || !v.rd) { box.innerHTML = ''; return; }
  let h = `<span class="chip"><b>${esc(T('round', { n: v.rd.n }))}</b></span>`;
  const others = v.rd.pl.filter(s => s !== v.me && aliveIn(v, s));
  // a phone needs the room for the aiming and watching chips (the room code is in the menu too)
  if (!room.solo && room.code && !R.narrow) h += `<span class="chip">${esc(T('roomChip', { c: room.code }))}</span>`;
  if (aliveIn(v, v.me) && others.length > 1) h += `<button class="chip aim${S.aim >= 0 ? ' on' : ''}" id="aimChip"><svg viewBox="0 0 24 24"><use href="#i-target"/></svg><span>${esc(S.aim >= 0 && aliveIn(v, S.aim) ? nameOf(v, S.aim) : T('aimAuto'))}</span></button>`;
  else if ((!U.g || U.g.over) && U.watch >= 0) h += `<span class="chip"><svg viewBox="0 0 24 24"><use href="#i-eye"/></svg><span>${esc(T('watching', { n: nameOf(v, U.watch) }))}</span></span>`;
  if (box.innerHTML !== h) box.innerHTML = h;
  const ac = $('aimChip');
  if (ac) ac.onclick = () => { const L = others; const i = L.indexOf(S.aim); S.aim = i < 0 ? L[0] : i + 1 < L.length ? L[i + 1] : -1; SND.play('aim'); paintOpps(v); tbInfo(); };
}
function myStatOf() { const v = S.view; return v && v.rd && v.rd.st[v.me] ? v.rd.st[v.me] : null; }

// ---------- the result of a round ----------
function showBattleResults() {
  const v = S.view, rd = v.rd, room = S.room || {};
  if (!rd) return;
  const won = rd.win === v.me;
  const t1 = rd.win < 0 ? T('draw') : won ? T('youWin') : T('roundOver');
  const t2 = (rd.win >= 0 && !won ? T('theyWin', { n: nameOf(v, rd.win) }) + ' · ' : '') + T('round', { n: rd.n });
  let h = `<div class="res-head"><div class="pupr">${A.shiba('rb')}</div><div class="t1">${esc(t1)}</div><div class="t2">${esc(t2)}</div></div>`;
  const order = rd.pl.slice().sort((a, b) => (rd.st[a].place || 9) - (rd.st[b].place || 9));
  for (const s of order) {
    const st = rd.st[s], p = v.seats[s] || { bot: true, lv: 2 };
    const w = (v.seats[s] && v.seats[s].wins) || 0;
    h += `<div class="rrow${st.place === 1 ? ' win' : ''}" style="--pc:${pcOf(s)}"><span class="rk">${st.place || '·'}</span><span class="av">${avSvg(p, s)}</span>` +
      `<div class="bd"><div class="nm">${esc(nameOf(v, s))}${s === v.me ? `<small>${esc(T('youTag'))}</small>` : ''}</div><div class="dt">${esc(T('sentN', { n: st.sent || 0 }))} · ${esc(T(st.ko === 1 ? 'koN' : 'koNs', { n: st.ko || 0 }))}</div></div>` +
      `<div class="w"><b>${w}</b><small>${esc(T(w === 1 ? 'winLbl' : 'winsLbl'))}</small></div></div>`;
  }
  h += '<div class="resfoot" id="resFoot"></div>';
  const sh = sheet(h, { id: 'result', lock: true });
  A.mood(sh.querySelector('.pupr svg'), won ? 'proud' : playing(v) ? 'sad' : 'happy');
  const f = $('resFoot');
  const btn = (txt, cls, fn, ic) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.innerHTML = (ic ? `<svg class="ic" viewBox="0 0 24 24"><use href="#i-${ic}"/></svg>` : '') + esc(txt); b.onclick = fn; return b; };
  if (S.isHost) {
    f.appendChild(btn(T('nextRound'), 'gold', () => { closeSheet(); S.start(); }, 'again'));
    const r2 = document.createElement('div'); r2.className = 'row2';
    if (!room.solo) r2.appendChild(btn(T('toRoom'), 'glass', () => { closeSheet(); S.toRoom(); }, 'room'));
    r2.appendChild(btn(T('backLobby'), 'glass', async () => { if (room.solo) goLobby(); else confirmBox(T('confirmEnd'), async () => { await S.leave('end'); goLobby(); }, () => showBattleResults()); }));
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
