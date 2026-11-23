// ===== playing: the loop, the controls (keys, swipes, buttons), what shows on screen, and the solo modes =====
let S = null;   // the session: solo, a battle hosted here (with or without the network) or a guest in someone's room
const U = {
  g: null, kind: '', battle: false, paused: false, look: 0, ver: 0, worry: false,
  mood: '', moodT: 0, moodShown: '', cd: null, watch: -1, minisDirty: true, refresh: null, statKey: '', meterKey: '', tipShown: false,
};
$('pup').innerHTML = A.shiba('pp');
const pupSvg = () => $('pup').querySelector('svg');

// ---------- what the player can do ----------
const live = () => { const g = U.g; return g && g.started && !g.over && !U.paused && !U.cd ? g : null; };
function act(k) {
  const g = live(); if (!g) return false;
  let ok = false;
  if (k === 'left') ok = g.left();
  else if (k === 'right') ok = g.right();
  else if (k === 'cw') ok = g.rotate(1);
  else if (k === 'ccw') ok = g.rotate(-1);
  else if (k === 'drop') ok = g.hardDrop();
  else if (k === 'hold') ok = g.hold();
  else if (k === 'down') ok = g.down();
  drain();
  return ok;
}
function soft(on) { const g = U.g; if (g) g.setSoft(on && !!live()); }
// held left/right: a short wait, then repeats (the same for keys and buttons)
const DAS = { slow: [190, 50], mid: [150, 33], fast: [110, 16] };
const HOLD = { dir: 0, das: 0, arr: 0, keys: new Set() };
function press(dir) { HOLD.dir = dir; HOLD.das = 0; HOLD.arr = 0; act(dir < 0 ? 'left' : 'right'); }
function release(dir) {
  if (HOLD.dir !== dir) return;
  const other = dir < 0 ? (HOLD.keys.has('r') ? 1 : 0) : (HOLD.keys.has('l') ? -1 : 0);
  HOLD.dir = other; HOLD.das = 0; HOLD.arr = 0;
}
function holdTick(dt) {
  if (!HOLD.dir || !live()) return;
  const [d, r] = DAS[P.das] || DAS.mid;
  HOLD.das += dt;
  if (HOLD.das < d) return;
  HOLD.arr += dt;
  let n = 0;
  while (HOLD.arr >= r && n++ < 10) { HOLD.arr -= r; if (!act(HOLD.dir < 0 ? 'left' : 'right')) { HOLD.arr = 0; break; } }
}

// ---------- keyboard ----------
const KEYS = { ArrowLeft: 'l', ArrowRight: 'r', ArrowDown: 'soft', Space: 'drop', ArrowUp: 'cw', KeyX: 'cw', KeyZ: 'ccw', ControlLeft: 'ccw', ControlRight: 'ccw', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold', Escape: 'pause', KeyP: 'pause', KeyA: 'l', KeyD: 'r', KeyS: 'soft', KeyW: 'cw', KeyJ: 'l', KeyL: 'r', KeyK: 'soft', KeyI: 'cw' };
document.addEventListener('keydown', e => {
  if (screenOn !== 'game') return;
  const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
  const k = KEYS[e.code]; if (!k) return;
  if (sheetOn || !$('overlay').hidden) { if (k === 'pause' && sheetOn && !sheetLock) { e.preventDefault(); closeSheet(); } return; }
  e.preventDefault();
  if (e.repeat) return;
  if (k === 'pause') { if (U.paused) resumePlay(); else if (S && S.canPause && live()) pausePlay(); else showMenu(); return; }
  if (U.paused && (k === 'drop' || k === 'cw')) { resumePlay(); return; }
  if (k === 'l' || k === 'r') { HOLD.keys.add(k); press(k === 'l' ? -1 : 1); }
  else if (k === 'soft') soft(true);
  else act(k);
});
document.addEventListener('keyup', e => {
  const k = KEYS[e.code]; if (!k) return;
  if (k === 'l' || k === 'r') { HOLD.keys.delete(k); release(k === 'l' ? -1 : 1); }
  else if (k === 'soft') soft(false);
});
addEventListener('blur', () => { HOLD.keys.clear(); HOLD.dir = 0; soft(false); });

// ---------- swipes on the stage ----------
const SENS = { lo: 1.15, mid: 0.9, hi: 0.68 };
let SW = null;
$('stage').addEventListener('pointerdown', e => {
  const tg = e.target;
  if (tg.closest('#holdBox')) { e.preventDefault(); act('hold'); return; }
  if (tg.closest('#pup')) { pet(); return; }
  if (tg.closest('button')) return;
  if (U.paused) { resumePlay(); return; }
  if (e.pointerType === 'mouse' || P.ctl !== 'swipe' || !live()) return;
  if (SW) return;
  e.preventDefault();
  try { $('stage').setPointerCapture(e.pointerId); } catch (er) {}
  SW = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t0: e.timeStamp, ax: '', moved: false, pts: [[e.timeStamp, e.clientX, e.clientY]] };
}, { passive: false });
$('stage').addEventListener('pointermove', e => {
  if (!SW || e.pointerId !== SW.id) return;
  e.preventDefault();
  const step = R.c * (SENS[P.sens] || SENS.mid);
  SW.pts.push([e.timeStamp, e.clientX, e.clientY]); if (SW.pts.length > 12) SW.pts.shift();
  const tx = e.clientX - SW.x0, ty = e.clientY - SW.y0;
  if (!SW.ax && Math.hypot(tx, ty) > Math.min(10, step * 0.45)) SW.ax = Math.abs(tx) >= Math.abs(ty) ? 'x' : 'y';
  if (SW.ax === 'x') {
    let dx = e.clientX - SW.lx;
    while (dx >= step) { act('right'); SW.lx += step; dx -= step; SW.moved = true; }
    while (dx <= -step) { act('left'); SW.lx -= step; dx += step; SW.moved = true; }
    if (e.clientY - SW.ly > step * 2.4) { SW.ax = 'y'; SW.ly = e.clientY - step; }   // the finger turned downwards: drop it from here
    else SW.ly = Math.min(SW.ly, e.clientY);
  }
  if (SW.ax === 'y') {
    let dy = e.clientY - SW.ly;
    while (dy >= step) { act('down'); SW.ly += step; dy -= step; SW.moved = true; }
  }
}, { passive: false });
function endSwipe(e, cancel) {
  if (!SW || e.pointerId !== SW.id) return;
  const s = SW; SW = null;
  if (cancel) return;
  const tx = e.clientX - s.x0, ty = e.clientY - s.y0, dt = e.timeStamp - s.t0;
  // speed over the last 90 ms
  const t1 = e.timeStamp, back = s.pts.filter(p => t1 - p[0] <= 90), p0 = back[0] || s.pts[0];
  const vy = (e.clientY - p0[2]) / Math.max(16, t1 - p0[0]), vx = (e.clientX - p0[1]) / Math.max(16, t1 - p0[0]);
  if (!s.moved && dt < 320 && Math.abs(tx) < 12 && Math.abs(ty) < 12) { act('cw'); return; }
  if (vy > 0.75 && ty > R.c * 1.1 && Math.abs(vy) > Math.abs(vx) * 1.4) { act('drop'); return; }
  if (vy < -0.6 && ty < -R.c * 1.3 && Math.abs(ty) > Math.abs(tx) * 1.3) { act('hold'); return; }
}
$('stage').addEventListener('pointerup', e => endSwipe(e, false));
$('stage').addEventListener('pointercancel', e => endSwipe(e, true));

// ---------- buttons at the bottom ----------
$('pad').querySelectorAll('button').forEach(b => {
  const k = b.dataset.k;
  const up = e => {
    if (!b.classList.contains('dn')) return;
    b.classList.remove('dn');
    if (k === 'left' || k === 'right') { HOLD.keys.delete(k[0]); release(k === 'left' ? -1 : 1); }
    if (k === 'down') soft(false);
  };
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { b.setPointerCapture(e.pointerId); } catch (er) {}
    b.classList.add('dn');
    if (U.paused) { resumePlay(); return; }
    if (k === 'left' || k === 'right') { HOLD.keys.add(k[0]); press(k === 'left' ? -1 : 1); }
    else if (k === 'down') soft(true);
    else act(k);
    if (k === 'drop') SND.vibrate(8);
  }, { passive: false });
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
});

// ---------- the loop ----------
let rafOn = false, lastT = 0;
function frame(t) {
  if (!rafOn) return;
  requestAnimationFrame(frame);
  advance(t);
  render(t);
}
function advance(t) {
  let dt = t - lastT; lastT = t;
  if (!(dt > 0)) return;
  dt = Math.min(dt, 3000);
  // long gaps (a page in the background) go in small steps, so the bots keep up
  while (dt > 0) {
    const d = Math.min(dt, 50); dt -= d;
    if (U.g && !U.paused && !U.cd && U.g.started && !U.g.over) { holdTick(d); U.g.tick(d); }
    if (S && S.tick) S.tick(d);
    drain();
  }
  if (U.cd && t >= U.cd.at) { const f = U.cd.then; U.cd = null; msg(`<div class="n go">${esc(T('go'))}</div>`); setTimeout(() => { if (!U.cd && !U.paused && $('wmsg').querySelector('.n')) msg(''); }, 600); SND.play('go'); if (f) f(); }
}
function startLoop() { if (rafOn) return; rafOn = true; lastT = now(); requestAnimationFrame(frame); }
function stopLoop() { rafOn = false; }
// the page in the background: rAF stops, so a timer keeps the bots and the network going
setInterval(() => { if (rafOn && document.hidden) advance(now()); }, 120);

// ---------- events from my game ----------
function drain() {
  const g = U.g; if (!g || !g.ev.length) return;
  const evs = g.ev.splice(0);
  for (const e of evs) onEv(g, e);
}
function onEv(g, e) {
  switch (e.k) {
    case 'spawn': U.look = 0; break;
    case 'move': U.look = e.d; SND.play('move'); break;
    case 'rot': SND.play('rot'); break;
    case 'hold': SND.play('hold'); break;
    case 'drop':
      if (e.to > e.from) WELL.trail.push({ at: now(), t: e.t, from: Math.max(TOP - 1, e.from), to: e.to, cols: [...new Set(CELLS[e.t][e.r].map(q => q[0] + e.x))] });
      SND.play('drop'); bump('shake'); break;
    case 'lock':
      U.ver++; WELL.flash.push({ at: now(), cells: e.cells });
      if (!e.hard) SND.play('lock');
      break;
    case 'tspin0': pop(T(e.ts === 'mini' ? 'twMini' : 'tw'), 'tw'); SND.play('tspin'); setMood('wow', 1200); break;
    case 'clear': onClear(g, e); break;
    case 'collapse': U.ver++; break;
    case 'level':
      if (g.mode === 'versus') { if (e.L > 1) pop(T('faster'), 'sm'); }
      else { pop(T('lvUp', { n: e.L }), 'sm'); SND.play('lvup'); }
      SND.music.tempo(e.L);
      break;
    case 'incoming': SND.play('incoming'); if (e.n >= 4) setMood('shock', 1300); break;
    case 'bubbles': U.ver++; SND.play('bubbles'); bump('jolt'); SND.vibrate(30); break;
    case 'over': onOver(g, e); break;
  }
  if (S && S.onEv) S.onEv(g, e);
}
function onClear(g, e) {
  U.ver++;
  const big = e.n === 4 || !!e.ts || e.pc;
  if (e.pc) pop(T('pc'), 'pc');
  else if (e.ts) pop(e.ts === 'mini' ? T('twMini') + (e.n ? ' · ' + T('clr')[e.n].replace(/！|!/, '') : '') : T('twN')[e.n], 'tw big');
  else if (e.n >= 2) pop(T('clr')[e.n], e.n === 4 ? 'big' : '');
  if (e.b2b) pop(T('b2b'), 'sm');
  if (e.combo > 0) pop(T('combo', { n: e.combo }), 'sm');
  SND.play('clear', 0, { n: e.n, c: Math.max(0, e.combo) });
  if (e.ts) SND.play('tspin', 40);
  if (e.b2b) SND.play('b2b', 120);
  if (e.pc) SND.play('pc', 200);
  burst(e.rows, big);
  setMood(e.pc ? 'love' : big ? 'wow' : 'happy', big ? 1500 : 900);
  SND.vibrate(big ? [20, 40, 30] : 14);
}
// my game ended (the session decides what comes next)
function onOver(g, e) {
  HOLD.dir = 0; soft(false); SW = null;
  if (!e.won) { SND.vibrate([40, 60, 90]); setMood('', 0); }
}
function bump(cls) { const w = $('wellbox'); w.classList.remove('shake', 'jolt'); void w.offsetWidth; w.classList.add(cls); }
function pop(text, cls) {
  const box = $('pops'), d = document.createElement('div');
  d.className = 'pop ' + (cls || ''); d.textContent = text;
  box.appendChild(d);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => d.remove(), 1300);
}
function msg(html, dim) { const m = $('wmsg'); m.innerHTML = html || ''; m.classList.toggle('dim', !!dim && !!html); }
function setMood(m, ms) { U.mood = m; U.moodT = ms ? now() + ms : 0; }
function pet() { setMood('love', 1400); SND.play('yip'); }
function baseMood() {
  if (U.paused) return 'sleep';
  const g = U.g;
  if (!g) return U.battle && U.outPlace ? 'sad' : 'idle';
  if (g.over) return g.won ? 'proud' : U.battle ? 'ko' : 'sad';
  return U.worry ? 'worry' : 'idle';
}

// ---------- drawing a frame ----------
const ownSrc = { key: '', cell: null, cur: null, ghost: null, clr: null, clrT: 0, danger: false, worry: false, look: 0 };
function render(t) {
  const g = U.g;
  // the well: my own, or someone else's while I watch
  if (g && !(U.battle && g.over && U.watch >= 0)) {
    const b = g.board, h = g.height();
    U.worry = !g.over && h >= 15;
    ownSrc.key = 'g' + U.ver;
    ownSrc.cell = (x, y) => b[y * COLS + x];
    ownSrc.cur = g.over ? null : g.cur;
    ownSrc.ghost = g.cur ? g.ghostY() : null;
    ownSrc.clr = g.clearing ? new Set(g.clearing.rows) : null;
    ownSrc.clrT = g.clearing ? 1 - g.clearing.t / SB.CLEAR_MS : 0;
    ownSrc.danger = U.worry; ownSrc.worry = U.worry; ownSrc.look = U.look;
    drawWell(ownSrc, t);
    drawHold(g.holdT, g.holdUsed);
    drawNext(g.queue);
    meter(g.pending);
  } else if (U.battle && U.watch >= 0 && S && S.snaps && S.snaps[U.watch]) {
    const sn = S.snaps[U.watch], rows = SB.unsnap(sn.b), p = sn.p;
    U.worry = false;
    drawWell({ key: 's' + sn.b, cell: (x, y) => rows[y - (TOP - 2)][x], cur: Array.isArray(p) && p[0] ? { t: p[0], x: p[1], y: p[2] + TOP - 2, r: p[3] & 3 } : null, ghost: null, clr: null, danger: false, look: 0 }, t);
    drawHold(sn.h || 0, false); drawNext([]); meter([{ n: sn.q || 0, t: 1 }]);
  } else {
    U.worry = false;
    drawWell({ key: 'empty', cell: () => 0, cur: null, ghost: null, clr: null }, t);
    drawHold(0, false); drawNext([]); meter([]);
  }
  $('wellbox').classList.toggle('danger', U.worry);
  if (U.moodT && t > U.moodT) { U.mood = ''; U.moodT = 0; }
  const m = U.mood || baseMood();
  if (m !== U.moodShown) { U.moodShown = m; A.mood(pupSvg(), m); }
  hud();
  if (U.battle && S && S.minis) S.minis();
}
function meter(pending) {
  const c = R.c, key = pending.map(p => p.n + (p.t <= 0 ? 'r' : 'w')).join(',') + ':' + c;
  if (key === U.meterKey) return; U.meterKey = key;
  const box = $('meter'); box.innerHTML = '';
  let left = 20;
  for (const p of pending) {
    const n = Math.min(left, p.n); if (n <= 0) break; left -= n;
    const i = document.createElement('i'); i.style.height = n * c + 'px'; if (p.t <= 0) i.className = 'rdy';
    box.appendChild(i);
  }
}
// the numbers on the left
function statRows() {
  const g = U.g;
  if (U.battle) {
    const st = S && S.myStat ? S.myStat() : null;
    return [[T('sent'), g ? g.stats.sent : st ? st.sent : 0], [T('kos'), st ? st.ko : 0], [T('level'), g ? g.level : 1]];
  }
  if (!g) return [];
  if (g.mode === 'sprint') { const pps = g.time > 0 ? g.stats.pieces / (g.time / 1000) : 0; return [[T('time'), fmtT(g.time, true)], [T('left'), Math.max(0, SB.SPRINT_LINES - g.lines)], [T('pps'), pps.toFixed(2)]]; }
  if (g.mode === 'ultra') return [[T('time'), fmtT(SB.ULTRA_MS - g.time + 999)], [T('score'), fmtN(g.score)], [T('lines'), g.lines]];
  return [[T('score'), fmtN(g.score)], [T('lines'), g.lines], [T('level'), g.level]];
}
function hud() {
  const rows = statRows(), key = rows.map(r => r.join(':')).join('|');
  if (key === U.statKey) return; U.statKey = key;
  const box = $('stats');
  if (box.children.length !== rows.length) box.innerHTML = rows.map(() => '<div class="stat"><span></span><b></b></div>').join('');
  rows.forEach(([l, v], i) => { const d = box.children[i]; d.firstChild.textContent = l; d.lastChild.textContent = v; });
}

// ---------- the game screen ----------
function setupScreen(o) {
  U.battle = !!o.battle; U.kind = o.kind || ''; U.paused = false; U.cd = null; U.watch = -1; U.outPlace = 0;
  U.statKey = ''; U.meterKey = ''; U.mood = ''; U.moodShown = '';
  WELL.fx = []; WELL.flash = []; WELL.trail = [];
  $('pops').innerHTML = ''; msg('');
  $('opps').innerHTML = '';
  $('btnChat').hidden = !o.chat;
  $('meter').hidden = !U.battle;
  $('pad').hidden = !(touchy && P.ctl === 'pad');
  $('ktip').hidden = touchy;
  $('ktip').textContent = T('keysTip');
  show('game');
  layout();
  startLoop();
  tbInfo();
  if (touchy && P.ctl === 'swipe' && !store.get('sb_tip')) { store.set('sb_tip', 1); hint(T('firstTip')); }
}
function hint(text) { const d = document.createElement('div'); d.className = 'hint'; d.textContent = text; $('wellbox').appendChild(d); setTimeout(() => d.remove(), 6200); }
function tbInfo() {
  const box = $('tbInfo');
  if (!S) { box.innerHTML = ''; return; }
  if (U.battle) { if (S.tbInfo) S.tbInfo(box); return; }
  if (S.mode === 'solo') { box.innerHTML = `<span class="chip"><b>${esc(T('mode')[S.kind])}</b></span>` + (S.kind === 'marathon' && BEST.marathon ? `<span class="chip"><svg viewBox="0 0 24 24"><use href="#i-trophy"/></svg><span class="num">${fmtN(BEST.marathon)}</span></span>` : S.kind === 'sprint' && BEST.sprint ? `<span class="chip"><svg viewBox="0 0 24 24"><use href="#i-trophy"/></svg><span class="num">${fmtT(BEST.sprint, true)}</span></span>` : S.kind === 'ultra' && BEST.ultra ? `<span class="chip"><svg viewBox="0 0 24 24"><use href="#i-trophy"/></svg><span class="num">${fmtN(BEST.ultra)}</span></span>` : ''); return; }
  if (S.tbInfo) S.tbInfo(box);
}
function pausePlay() {
  if (!S || !S.canPause || U.paused || !U.g || U.g.over) return;
  U.paused = true; soft(false); HOLD.dir = 0;
  SND.music.stop();
  $('pops').innerHTML = '';
  msg(`<div class="h">${esc(T('paused'))}</div><div class="s">${esc(T('tapResume'))}</div><button class="btn gold" id="btnResume">${esc(T('resumeGame'))}</button>`, true);
  $('btnResume').onclick = () => resumePlay();
  if (S.onPause) S.onPause(true);
}
function resumePlay() {
  if (!U.paused) return;
  closeSheet();
  U.paused = false;
  msg('');
  countdown(now() + 1500, () => { SND.music.start(); if (S && S.onPause) S.onPause(false); }, 1500);
}
// 3, 2, 1, go: then() runs at the given time
function countdown(at, then, len) {
  len = len || 1800;
  U.cd = { at, then };
  const step = len / 3;
  for (let k = 3; k >= 1; k--) {
    const d = at - k * step - now();
    setTimeout(() => { if (U.cd && U.cd.at === at && !U.paused) { msg(`<div class="n">${k}</div>`); SND.play('count'); } }, Math.max(0, d));
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && S && S.canPause && live()) pausePlay(); });
$('btnSound').onclick = () => { SND.set('on', !SND.prefs.on); paintSound(); if (SND.prefs.on) SND.play('tap'); };
function paintSound() { $('btnSound').innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${SND.prefs.on ? 'sound' : 'mute'}"/></svg>`; }
paintSound();

// ---------- solo: marathon, sprint, two minutes ----------
function startSolo(kind, restore) {
  let g = null;
  if (restore) { try { g = SB.Game.fromJSON(restore.G); } catch (e) { g = null; } }
  if (!g) g = new SB.Game({ mode: kind, seed: (Math.random() * 2 ** 31) | 0, level: kind === 'marathon' ? P.lv0 : 1 });
  S = { mode: 'solo', kind, code: 'SOLO', isHost: true, canPause: true };
  store.set('sb_solo', null);
  U.g = g;
  setupScreen({ kind, battle: false });
  SND.music.tempo(g.level);
  const save = () => { if (S && S.mode === 'solo' && U.g === g && g.started && !g.over) store.set('sb_solo', { mode: kind, G: g.toJSON(), at: Date.now() }); };
  S.save = save;
  S.leave = async () => { save(); stopLoop(); U.g = null; };
  S.restart = () => { store.set('sb_solo', null); startSolo(kind); };
  S.onPause = on => { if (on) save(); };
  S.onEv = (gg, e) => { if (e.k === 'over') soloOver(gg, kind); };
  if (g.started) { U.paused = false; pausePlay(); }
  else countdown(now() + 1800, () => { g.start(); drain(); SND.music.start(true); });
}
addEventListener('pagehide', () => { if (S && S.save) S.save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S && S.save) S.save(); });
function soloOver(g, kind) {
  store.set('sb_solo', null);
  SND.music.stop();
  let nb = false;
  if (kind === 'sprint' && g.won) { if (!BEST.sprint || g.time < BEST.sprint) { BEST.sprint = Math.round(g.time); nb = true; } }
  else if (kind === 'marathon' || kind === 'ultra') { if (g.score > 0 && (!BEST[kind] || g.score > BEST[kind])) { BEST[kind] = g.score; nb = true; } }
  if (nb) store.set('sb_best', BEST);
  SND.play(nb ? 'best' : g.won ? 'win' : 'out');
  msg(`<div class="h">${esc(T('over')[g.why] || T('over').blockout)}</div>`, true);
  setTimeout(() => { if (S && S.mode === 'solo' && U.g === g) soloResults(g, kind, nb); }, 1300);
}
function soloResults(g, kind, nb) {
  const pps = g.time > 0 ? g.stats.pieces / (g.time / 1000) : 0;
  const big = kind === 'sprint' ? (g.won ? fmtT(g.time, true) : `${g.lines} / ${SB.SPRINT_LINES}`) : fmtN(g.score);
  let h = `<div class="res-head"><div class="pupr">${A.shiba('rs')}</div><div class="t1">${esc(T('over')[g.why] || '')}</div><div class="t2 num">${esc(big)}</div>${nb ? `<div class="t3">${esc(T('newBest'))}</div>` : ''}</div>`;
  const cells = [[T('resScore'), fmtN(g.score)], [T('resLines'), g.lines], [T('resLevel'), g.level], [T('resTime'), fmtT(g.time, kind === 'sprint')], [T('resPieces'), g.stats.pieces], [T('resPPS'), pps.toFixed(2)], [T('resQuads'), g.stats.quads], [T('resTw'), g.stats.tspins], [T('resCombo'), Math.max(0, g.stats.maxCombo)]];
  h += `<div class="rgrid">${cells.map(([l, v], i) => `<div class="${(kind === 'sprint' ? i === 3 : i === 0) ? 'hi' : ''}"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  h += '<div class="resfoot"><button class="btn gold" id="rsAgain"><svg class="ic" viewBox="0 0 24 24"><use href="#i-again"/></svg>' + esc(T('again')) + '</button><button class="btn glass" id="rsLobby">' + esc(T('backLobby')) + '</button></div>';
  const sh = sheet(h, { id: 'result', lock: true });
  A.mood(sh.querySelector('.pupr svg'), nb ? 'proud' : g.won ? 'happy' : 'sad');
  $('rsAgain').onclick = () => { closeSheet(); S.restart(); };
  $('rsLobby').onclick = () => goLobby();
}
function goLobby() {
  KeepAlive.mark(LIVE, null);
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  location.reload();
}
