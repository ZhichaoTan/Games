// ===== playing: the loop, touch and mouse, the numbers above the board, hints, tutorials, and the solo modes =====
let S = null;   // the session: a level, Time Rush, a battle hosted here (with or without the network), or a guest in someone's room
const U = {
  g: null, kind: '', battle: false, paused: false, cd: null, overDue: null,
  ham: false, hamUsed: false, hintOn: false, lastInput: 0, tut: null,
  hudKey: '', hudVals: '', toolsKey: '', warned: 0, refresh: null,
};
const live = () => { const g = U.g; return g && g.started && !g.over && !g.ending && !U.paused && !U.cd ? g : null; };
// the player can move when the game can and the picture has caught up with it
const ready = () => { const g = live(); return g && g.canAct() && idle() ? g : null; };

// ---------- touch and mouse: drag a piece onto its neighbour, or tap one and then the other; tap a special to set it off ----------
let DR = null;
function cellAt(e) {
  if (!V.g) return -1;
  const q = $('game').getBoundingClientRect(), x = e.clientX - q.left - R.bx, y = e.clientY - q.top - R.by;
  const c = Math.floor(x / R.c), r = Math.floor(y / R.c);
  if (c < 0 || r < 0 || c >= V.W || r >= V.H) return -1;
  const i = r * V.W + c;
  return V.hole[i] ? -1 : i;
}
const stageEl = $('stage');
stageEl.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const i = cellAt(e); if (i < 0) return;
  e.preventDefault();
  poke();
  if (U.ham) { useHammer(i); return; }
  if (!ready()) return;
  DR = { i, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  try { stageEl.setPointerCapture(e.pointerId); } catch (x) {}
});
stageEl.addEventListener('pointermove', e => {
  if (!DR || e.pointerId !== DR.id || DR.moved) return;
  const dx = e.clientX - DR.x, dy = e.clientY - DR.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < R.c * 0.32) return;
  DR.moved = true;
  const a = DR.i, c = a % V.W, r = (a / V.W) | 0;
  let b = -1;
  if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0 && c < V.W - 1) b = a + 1; else if (dx < 0 && c > 0) b = a - 1; }
  else if (dy > 0 && r < V.H - 1) b = a + V.W; else if (dy < 0 && r > 0) b = a - V.W;
  setSel(-1);
  if (b >= 0 && !V.hole[b]) trySwap(a, b);
});
const endDrag = e => { if (!DR || e.pointerId !== DR.id) return; const d = DR; DR = null; if (!d.moved && e.type === 'pointerup') tapCell(d.i); };
stageEl.addEventListener('pointerup', endDrag);
stageEl.addEventListener('pointercancel', endDrag);
function setSel(i) { V.sel = i; V.selId = i >= 0 && V.g && V.g.pc[i] ? V.g.pc[i].id : -1; }
function tapCell(i) {
  const g = ready(); if (!g) return;
  const s = V.sel;
  if (s >= 0 && s !== i && g.adj(s, i)) { setSel(-1); trySwap(s, i); return; }
  const p = g.pc[i];
  if (p && MM.isSpecial(p.k) && g.movable(i)) { setSel(-1); act(() => g.tap(i)); return; }
  if (s === i || !g.movable(i)) { setSel(-1); if (!g.movable(i)) SND.play('bad'); return; }
  setSel(i); SND.play('pick');
}
function trySwap(a, b) {
  const g = ready(); if (!g) return;
  if (!g.movable(a) || !g.movable(b)) { SND.play('bad'); return; }
  act(() => g.swap(a, b));
}
function act(f) { const ok = f(); V.hint = null; drain(); if (ok) afterAct(); return ok; }
function afterAct() {
  U.lastInput = now();
  tutAfterAct();
  if (S && S.onAct) S.onAct();
}
function poke() { U.lastInput = now(); if (!U.tut) V.hint = null; }
// the hammer: one per level attempt, a blow on any cell that costs no move
function useHammer(i) {
  const g = ready(); if (!g) return;
  if (!act(() => g.hammer(i))) { SND.play('bad'); return; }
  U.ham = false; U.hamUsed = true; renderTools();
}
function toggleHammer() {
  if (U.kind !== 'level' || !U.g) return;
  if (U.hamUsed) { toast(T('hamNone')); SND.play('bad'); return; }
  U.ham = !U.ham; setSel(-1); SND.play('tap');
  toast(T(U.ham ? 'hamTip' : 'hamCancel'), U.ham ? 2600 : 1200);
  renderTools();
}
function renderTools() {
  const box = $('tools');
  if (U.kind !== 'level' || !U.g) { box.innerHTML = ''; U.toolsKey = ''; return; }
  const key = [U.ham, U.hamUsed, I18.lang].join();
  if (key === U.toolsKey) return; U.toolsKey = key;
  box.innerHTML = `<button class="tool${U.ham ? ' on' : ''}${U.hamUsed ? ' used' : ''}" id="tHam"><svg viewBox="0 0 24 24"><use href="#i-hammer"/></svg><span>${esc(T('hammer'))}</span><span class="n">${U.hamUsed ? 0 : 1}</span></button>`;
  $('tHam').onclick = toggleHammer;
}

// ---------- hints: after a while with no move, the two pieces of a good swap nudge each other ----------
function hintTick() {
  const g = ready();
  if (!g || V.hint) return;
  if (U.tut) { if (U.tut.move) V.hint = hintOf(g, U.tut.move); return; }
  if (!P.hints || now() - U.lastInput < (U.kind === 'level' ? 6000 : 4500)) return;
  let m = AI.plan(g, 3, Math.random);
  if (!m || m[1] < 0) { const all = g.moveList().filter(x => x[1] >= 0); m = all.length ? all[(Math.random() * all.length) | 0] : null; }
  if (m) V.hint = hintOf(g, m);
}
const hintOf = (g, m) => (g.pc[m[0]] && g.pc[m[1]] ? { a: m[0], b: m[1], ia: g.pc[m[0]].id, ib: g.pc[m[1]].id } : null);

// ---------- tutorials: the first time a level teaches something, a note and a finger showing the swap ----------
const TEACH = { swap: -1, rocket: MM.RV, lantern: MM.KL, cracker: MM.FC, firework: MM.FW };
// the swaps of plain pieces on this board that make special k (-1: one plain match of three)
function teachMoves(g, k) {
  const out = [];
  for (const [a, b] of g.moveList()) {
    if (b < 0) continue;
    const pa = g.pc[a], pb = g.pc[b];
    if (pa.k || pb.k) continue;
    g.pc[a] = pb; g.pc[b] = pa;
    const gs = g.groups().filter(x => x.cells.has(a) || x.cells.has(b));
    g.pc[a] = pa; g.pc[b] = pb;
    if (!gs.length) continue;
    const kinds = gs.map(x => x.kind);
    if (k < 0 ? kinds.every(x => x === 0) : k === MM.RV ? kinds.some(x => x === MM.RV || x === MM.RH) : kinds.includes(k)) out.push([a, b]);
  }
  return out;
}
function tutIcon(k) {
  return { swap: pic('m', 0, 'happy'), rocket: pic('rh'), lantern: pic('kl'), cracker: pic('fc'), firework: pic('fw'), frost: pic('frost', 2), cage: pic('cage'), box: pic('box', 3), ingot: pic('ing') }[k] || '';
}
function tutStart(g, k) {
  if (!k || PROG.seen.includes(k)) return;
  const t = { k, move: null, at: -1, step: 0, wait: false };
  if (k in TEACH) {
    const W = g.W, H = g.H, mid = ([a, b]) => [a, b].every(i => i % W > 0 && i % W < W - 1 && (i / W | 0) > 0 && (i / W | 0) < H - 1);
    const mv = teachMoves(g, TEACH[k]);
    t.move = mv.find(mid) || mv[0] || null;
    if (!t.move) return;   // this board can't show it: no tutorial this time
  }
  U.tut = t;
  tutBox(T('tut')[k], tutIcon(k), !(k in TEACH));
}
// after each move: the swap lesson is over; a special lesson goes on to "now use it"
function tutAfterAct() {
  const t = U.tut, g = U.g; if (!t || !g) return;
  if (t.step === 0 && t.k in TEACH && t.k !== 'swap') {
    const want = TEACH[t.k];
    let at = -1;
    for (let i = 0; i < g.pc.length && at < 0; i++) { const p = g.pc[i]; if (p && (p.k === want || (want === MM.RV && p.k === MM.RH)) && g.movable(i)) at = i; }
    if (at < 0) { tutDone(); return; }
    t.step = 1; t.move = null; t.at = at; t.wait = true; V.hint = null;
    if (t.k === 'firework') {   // the firework goes with a neighbour: show a swap with one
      const nb = g.nbrs(at).find(j => g.colorAt(j) >= 0 && g.movable(j));
      if (nb != null) { t.move = [at, nb]; t.at = -1; }
    }
    tutBox(null);
    return;
  }
  tutDone();
}
function tutDone() {
  const t = U.tut; if (!t) return;
  U.tut = null; tutBox(null); V.hint = null;
  if (!PROG.seen.includes(t.k)) { PROG.seen.push(t.k); saveProg(); }
}
function tutTick() {
  const t = U.tut;
  if (t && t.wait && idle()) { t.wait = false; tutBox(T('tutUse')[t.k], tutIcon(t.k), false); }
}
function tutBox(text, icon, btn) {
  let el = $('tutBox');
  $('tools').style.visibility = text ? 'hidden' : '';
  if (!text) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'tutBox'; el.className = 'tutbox'; $('game').appendChild(el); }
  el.innerHTML = `<span class="gi">${icon || ''}</span><span class="tx">${esc(text)}</span>` + (btn ? `<button class="btn gold" id="tutOk">${esc(T('tutGo'))}</button>` : '');
  el.classList.toggle('tap', !btn);
  if (btn) $('tutOk').onclick = () => { SND.play('tap'); tutDone(); };
}
// a finger sliding from one cell to the other, or a ring on the special to tap
function drawTutHand(t) {
  const tu = U.tut; if (!tu || tu.wait || !ready()) return;
  const x = CX, c = R.c;
  x.save(); x.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (tu.move) {
    const [a, b] = tu.move, [ax, ay] = pxOf(a), [bx, by] = pxOf(b), k = (t % 1600) / 1600;
    const m = k < 0.2 ? 0 : k > 0.72 ? 1 : ease((k - 0.2) / 0.52);
    x.globalAlpha = k < 0.08 ? k / 0.08 : k > 0.86 ? Math.max(0, 1 - (k - 0.86) / 0.14) : 1;
    finger(x, ax + (bx - ax) * m, ay + (by - ay) * m, c, k > 0.12 && k < 0.8);
  } else if (tu.at >= 0) {
    const [px, py] = pxOf(tu.at), k = (t % 1100) / 1100;
    x.globalAlpha = 1 - k; x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.arc(px, py, c * (0.42 + 0.3 * k), 0, 7); x.stroke();
    x.globalAlpha = 1; finger(x, px, py, c, Math.sin(t / 180) > 0);
  }
  x.restore();
}
function finger(x, px, py, c, down) {
  x.save(); x.translate(px + c * 0.06, py + c * (down ? 0.06 : 0.12)); x.rotate(-0.42);
  x.lineJoin = 'round'; x.lineWidth = Math.max(1.5, c * 0.045); x.strokeStyle = '#5b4740'; x.fillStyle = '#fff';
  x.beginPath(); x.ellipse(c * 0.05, c * 0.5, c * 0.19, c * 0.17, 0, 0, 7); x.fill(); x.stroke();
  x.beginPath(); rrect(x, -c * 0.075, 0, c * 0.15, c * 0.46, c * 0.075); x.fill(); x.stroke();
  x.beginPath(); x.ellipse(c * 0.05, c * 0.52, c * 0.16, c * 0.14, 0, 0, 7); x.fill();
  if (down) { x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, c * 0.2, 0, 7); x.stroke(); }
  x.restore();
}

// ---------- the loop ----------
let rafOn = false, lastT = 0, lastPaint = 0;
function frame(t) {
  if (!rafOn) return;
  requestAnimationFrame(frame);
  advance(t);
  paint(t);
}
function advance(t) {
  let dt = t - lastT; lastT = t;
  if (!(dt > 0)) return;
  dt = Math.min(dt, 3000);
  // long gaps (a page in the background) go in small steps, so the bots and the clock keep up
  while (dt > 0) {
    const d = Math.min(dt, 50); dt -= d;
    const g = U.g;
    if (g && g.started && !U.paused && !U.cd) g.tick(d * V.spd);
    if (S && S.tick) S.tick(d);
    drain();
  }
  if (U.cd && t >= U.cd.at) {
    const f = U.cd.then; U.cd = null;
    msg(`<div class="n go">${esc(T('go'))}</div>`);
    setTimeout(() => { if (!U.cd && !U.paused && $('wmsg').querySelector('.n')) msg(''); }, 600);
    SND.play('go'); if (f) f();
  }
}
function paint(t) {
  const fdt = clamp(t - lastPaint, 0, 100); lastPaint = t;
  const g = U.g;
  if (g && V.g === g) {
    pumpAnim();
    if (!U.paused) advanceAnim(fdt);
    flushDrops(V.clock);
    if (idle()) {
      if (g.busy > 0) g.busy = 0;   // the picture is done: the player may move again
      if (!V.flyers.length && !V.texts.length && !V.drops.length) { V.score = g.score; V.have = g.goals.map(x => x.have); }
    }
    U.hintOn = P.hints || !!U.tut;
    tutTick();
    hintTick();
    drawBoard(V.clock);
    drawTutHand(V.clock);
    timeWarn(g);
    budTick();
    if (U.overDue && idle() && !V.flyers.length && !V.texts.length) { const e = U.overDue; U.overDue = null; if (S && S.onOver) S.onOver(g, e); }
  }
  hud();
  if (S && S.paint) S.paint(t);
}
function startLoop() { if (rafOn) return; rafOn = true; lastT = lastPaint = now(); requestAnimationFrame(frame); }
function stopLoop() { rafOn = false; }
// the page in the background: rAF stops, so a timer keeps the bots, the clock and the network going
setInterval(() => { if (rafOn && document.hidden) advance(now()); }, 120);

// ---------- events from my game ----------
// right away (for saving and the network) ...
function drain() {
  const g = U.g; if (!g || !g.ev.length) return;
  for (const e of g.ev.splice(0)) {
    if (e.k === 'over') U.overDue = e;
    if (S && S.onEv) S.onEv(g, e);
  }
}
// ... and as the picture gets to them (callouts and sounds)
function onShowEv(e) {
  const g = V.g; if (!g) return;
  switch (e.k) {
    case 'match': if (e.kind > 0) { pop(T('made')[e.kind], 'sm'); SND.vibrate(12); } break;
    case 'done': if (e.wave >= 2) { const a = T('nice'); pop(a[Math.min(a.length - 1, e.wave - 2)], e.wave >= 4 ? 'big' : ''); if (e.wave >= 3) { SND.play('star', 60, { n: Math.min(3, e.wave - 2) }); budFace('happy', 1500, true); } } break;
    case 'special': if (e.kind !== 'combo') budFace('wow', 800); break;
    case 'combo': pop(T('comboCall')[e.type], 'big'); V.shake = Math.max(V.shake, 9); V.flash = Math.max(V.flash, 0.35); SND.vibrate([20, 30, 40]); budFace('happy', 1800, true); break;
    case 'shuffle': pop(T('shuffle'), 'sm'); SND.play('shuffle'); budFace('wow', 900); break;
    case 'finale': pop(T('finale'), 'big'); SND.play('combo'); budFace('happy', 0, true); break;
    case 'caged': if (U.battle) { pop(T('cagedYou'), 'sm'); SND.vibrate([30, 40, 30]); budFace('wow', 1200, true); } break;
    case 'move':
      if (g.mode === 'level' && !g.won) { const left = g.moves - e.n; if (left === 5 || left === 1) pop(left === 1 ? T('oneMove') : T('lastMoves', { n: left }), 'sm'); }
      break;
  }
  if (S && S.onShow) S.onShow(e);
}
function timeWarn(g) {
  if (g.mode !== 'time' || !g.started || g.over || U.paused || U.cd) return;
  const s = Math.ceil(g.timeLeft() / 1000);
  if (s <= 10 && !U.warned) { U.warned = 11; pop(T('lastSecs'), 'sm'); }
  if (s >= 1 && s <= 5 && U.warned > s) { U.warned = s; SND.play('tick'); }
}
function pop(text, cls) {
  if (!text) return;
  const box = $('pops'), d = document.createElement('div');
  d.className = 'pop ' + (cls || ''); d.textContent = text;
  box.appendChild(d);
  // a long call-out shrinks to fit across the board
  const w = d.offsetWidth, max = R.c * V.W * 0.94;
  if (w > max) d.style.fontSize = (parseFloat(getComputedStyle(d).fontSize) * max / w).toFixed(1) + 'px';
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => d.remove(), 1300);
}
function msg(html, dim) { const m = $('wmsg'); m.innerHTML = html || ''; m.classList.toggle('dim', !!dim && !!html); }

// ---------- the numbers above the board ----------
const short = n => (n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n));
function hud() {
  const g = U.g, box = $('hud');
  if (!g || screenOn !== 'game') return;
  const lvl = g.mode === 'level';
  const key = (lvl ? 'L' : 'T') + g.goals.map(x => x.t + x.c).join() + I18.lang + A.theme;
  if (key !== U.hudKey) {
    U.hudKey = key; U.hudVals = '';
    let h;
    if (lvl) {
      h = `<div class="hb mv"><span>${esc(T('moves'))}</span><b class="num"></b></div>` +
        `<div class="hb gl"><span>${esc(T('target'))}</span><div class="goals">${g.goals.map((x, k) => `<div class="goal" data-g="${k}">${goalPic(x)}<b class="num"></b></div>`).join('')}</div></div>` +
        `<div class="hb sc"><span>${esc(T('score'))}</span><b class="num"></b><div class="sbar"><i></i>${[0, 1, 2].map(j => `<u data-s="${j}">${pic('star')}</u>`).join('')}</div></div>`;
    } else h = `<div class="hb tm"><span>${esc(T('time'))}</span><b class="num"></b></div><div class="hb sc"><span>${esc(T('score'))}</span><b class="num"></b></div>`;
    box.innerHTML = h;
    if (lvl) {
      const s = g.stars, u = box.querySelectorAll('.sbar u');
      u[0].style.left = '6%'; u[1].style.left = clamp(s[1] / (s[2] || 1) * 100, 20, 90) + '%'; u[2].style.left = '96%';
    }
  }
  const score = Math.min(V.score, g.score);
  if (lvl) {
    const left = g.moves - g.used, have = g.goals.map((x, k) => (x.t === 'score' ? Math.max(0, x.n - score) : Math.max(0, x.n - (V.have[k] | 0))));
    const vals = [left, score, have.join(), g.over].join('|');
    if (vals === U.hudVals) return; U.hudVals = vals;
    const mv = box.querySelector('.hb.mv'); mv.querySelector('b').textContent = Math.max(0, left); mv.classList.toggle('low', left <= 5 && left > 0 && !g.over);
    box.querySelectorAll('.goal').forEach((el, k) => {
      const x = g.goals[k], n = have[k], done = n <= 0;
      el.classList.toggle('done', done);
      const b = el.querySelector('b');
      if (done) { if (!b.querySelector('svg')) b.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12"><use href="#i-check"/></svg>'; }
      else b.textContent = x.t === 'score' ? short(n) : n;
    });
    const sc = box.querySelector('.hb.sc'), s = g.stars;
    sc.querySelector('b').textContent = fmtN(score);
    sc.querySelector('.sbar i').style.width = clamp(score / (s[2] || 1) * 100, 0, 100) + '%';
    const u = sc.querySelectorAll('.sbar u'), goalsDone = have.every(x => x <= 0);
    u[0].classList.toggle('on', goalsDone); u[1].classList.toggle('on', goalsDone && score >= s[1]); u[2].classList.toggle('on', goalsDone && score >= s[2]);
  } else {
    const ms = g.started ? g.timeLeft() : g.timeMs, vals = [Math.ceil(ms / 1000), score].join('|');
    if (vals === U.hudVals) return; U.hudVals = vals;
    const tm = box.querySelector('.hb.tm'); tm.querySelector('b').textContent = fmtT(ms); tm.classList.toggle('low', g.started && ms <= 10000);
    box.querySelector('.hb.sc b').textContent = fmtN(score);
  }
}
function tbInfo() {
  const box = $('tbInfo');
  if (!S) { box.innerHTML = ''; return; }
  if (S.tbInfo) S.tbInfo(box); else box.innerHTML = '';
}
U.refresh = () => { U.hudKey = ''; U.toolsKey = ''; renderTools(); tbInfo(); if (U.tut) tutBox(U.tut.step ? T('tutUse')[U.tut.k] : T('tut')[U.tut.k], tutIcon(U.tut.k), !(U.tut.k in TEACH)); if (S && S.refresh) S.refresh(); };

// ---------- the game screen ----------
function layoutGame() {
  // a phone on its side: the numbers go to a column on the left, the others' cards to the right, and the board gets the full height
  R.side = innerHeight < 520 && innerWidth > innerHeight * 1.25;
  R.wide = !R.side && innerWidth >= 900 && innerWidth > innerHeight * 1.1;
  $('game').classList.toggle('wide', R.wide && U.battle);
  $('game').classList.toggle('side', R.side);
  layoutBoard();
}
function setupScreen(o) {
  U.battle = !!o.battle; U.kind = o.kind || ''; U.paused = false; U.cd = null; U.overDue = null;
  U.ham = false; U.tut = null; U.hudKey = ''; U.hudVals = ''; U.toolsKey = ''; U.warned = 0; U.lastInput = now();
  if (!o.keepHam) U.hamUsed = false;
  DR = null;
  V.spd = U.kind === 'level' && P.fast ? 1.35 : 1;
  $('pops').innerHTML = ''; msg(''); tutBox(null);
  $('opps').innerHTML = '';
  $('btnChat').hidden = !o.chat;
  $('netDot').hidden = true;
  const gm = $('game');
  gm.className = 'screen' + (o.ch != null ? ' ch' + o.ch : '');
  show('game');
  if (U.g) syncAll(U.g);
  setSel(-1);
  layoutGame();
  budShow(o.ch != null ? chPet(o.ch) : Math.floor(Math.random() * 6));
  renderTools(); tbInfo(); paintSound();
  startLoop();
}
// the pieces pop in, in a wave from the top left
function introPop() {
  const t0 = V.clock + 80;
  for (const v of V.pcs.values()) { v.born = t0 + (v.x + v.y) * 34 + Math.random() * 30; v.s = 0; }
  SND.play('make', 120);
}
function pausePlay() {
  if (!S || !S.canPause || U.paused || !U.g || U.g.over) return;
  U.paused = true; DR = null;
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
document.addEventListener('visibilitychange', () => {
  if (!document.hidden || !S) return;
  if (S.canPause && live()) pausePlay();
  if (S.save) S.save();
});
addEventListener('pagehide', () => { if (S && S.save) S.save(); });
$('btnSound').onclick = () => { SND.set('on', !SND.prefs.on); paintSound(); if (SND.prefs.on) SND.play('tap'); };
function paintSound() { $('btnSound').innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${SND.prefs.on ? 'sound' : 'mute'}"/></svg>`; }
// leave a solo game for the map or the lobby (the game is saved if it isn't over)
function leaveSolo() {
  closeSheet(); overlay(null);
  if (S && S.save) S.save();
  S = null; U.g = null; V.g = null; U.tut = null; tutBox(null);
  stopLoop(); SND.music.stop();
}

// ---------- a level ----------
function startLevel(n, restore) {
  const d = LV.L[n - 1]; if (!d || !unlocked(n)) return;
  closeSheet();
  let g = null, ham = false;
  if (restore && restore.kind === 'level' && restore.n === n) { try { g = MM.Game.fromJSON(restore.G); ham = !!restore.ham; } catch (e) { g = null; } }
  const first = !!(d.tut && !PROG.seen.includes(d.tut));
  if (!g) { g = new MM.Game(LV.spec(n, first && d.ts ? d.ts : (Math.random() * 2 ** 31) >>> 0)); g.start(); }
  else g.started = true;
  store.set('tt_solo', null);
  S = { mode: 'solo', kind: 'level', n, canPause: false };
  U.g = g; U.hamUsed = ham;
  setupScreen({ kind: 'level', ch: LV.chapterOf(n), keepHam: true });
  introPop();
  if (!restore) tutStart(g, d.tut);
  SND.music.tempo(false); SND.music.start(true);
  const save = () => { if (S && S.kind === 'level' && U.g === g && !g.over && !g.ending && g.used > 0) store.set('tt_solo', { kind: 'level', n, G: g.toJSON(), ham: U.hamUsed ? 1 : 0, at: Date.now() }); };
  S.save = save;
  S.onAct = save;
  S.tbInfo = box => { box.innerHTML = `<span class="chip"><b>${esc(T('levelN', { n }))}</b></span><span class="chip"><span>${esc(T('chapters')[LV.chapterOf(n)])}</span></span>`; };
  S.restart = () => { store.set('tt_solo', null); startLevel(n); };
  S.onEv = (gg, e) => { if (e.k === 'over') store.set('tt_solo', null); };
  S.onOver = (gg, e) => levelOver(n, gg, e);
  tbInfo();
}
function levelOver(n, g, e) {
  SND.music.stop();
  const won = !!e.won, stars = won ? g.starsOf(g.score) : 0, i = n - 1;
  let nb = false;
  if (won) {
    for (let k = 0; k < i; k++) if (PROG.stars[k] == null) PROG.stars[k] = 0;
    PROG.stars[i] = Math.max(PROG.stars[i] | 0, stars);
    if (g.score > (PROG.best[i] | 0)) { nb = (PROG.best[i] | 0) > 0; for (let k = 0; k < i; k++) if (PROG.best[k] == null) PROG.best[k] = 0; PROG.best[i] = g.score; }
    saveProg();
  }
  SND.play(won ? (nb ? 'best' : 'win') : 'lose');
  SND.vibrate(won ? [20, 40, 30] : [40, 60, 90]);
  msg(`<div class="h">${esc(T(won ? 'levelDone' : 'outMoves'))}</div>`, true);
  setTimeout(() => { if (S && S.kind === 'level' && U.g === g) levelResults(n, g, won, stars, nb); }, 1300);
}
function levelResults(n, g, won, stars, nb) {
  const ch = LV.chapterOf(n);
  let h = `<div class="res-head"><div class="mo">${pic('m', chPet(ch), won ? 'happy' : 'sleep')}</div><div class="t1">${esc(T(won ? 'levelDone' : 'outMoves'))}</div>`;
  if (won) h += `<div class="bigstars">${[0, 1, 2].map(k => STAR(k < stars)).join('')}</div>`;
  h += `<div class="t2"><span class="num">${esc(T('levelN', { n }))} · ${fmtN(g.score)}</span></div>${nb ? `<div class="t3">${esc(T('newBest'))}</div>` : ''}</div>`;
  if (!won) h += `<div class="leftg">${g.goals.map(x => { const left = g.goalLeft(x); return left > 0 ? `<div class="goal">${goalPic(x)}<b class="num">${x.t === 'score' ? short(left) : left}</b></div>` : ''; }).join('')}</div>`;
  const made = g.stats.made.slice(1, 6).reduce((a, b) => a + b, 0);
  const cells = [[T('resScore'), fmtN(g.score)], [T('resBest'), fmtN(Math.max(g.score, PROG.best[n - 1] | 0))], [T('resMoves'), `${won && g.wonAt != null ? g.wonAt : g.used} / ${g.moves}`], [T('resSpecials'), made], [T('resCombo'), g.stats.maxWave + 1], [T('resCleared'), fmtN(g.stats.cleared)]];
  h += `<div class="rgrid">${cells.map(([l, v], k) => `<div class="${k === 0 ? 'hi' : ''}"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  const next = won && n < LV.COUNT;
  h += '<div class="resfoot">' + (next ? `<button class="btn gold" id="rsNext"><svg class="ic" viewBox="0 0 24 24"><use href="#i-play"/></svg>${esc(T('next'))}</button>` : '') +
    `<div class="row2"><button class="btn ${next ? 'glass' : 'gold'}" id="rsRetry"><svg class="ic" viewBox="0 0 24 24"><use href="#i-again"/></svg>${esc(T('retry'))}</button><button class="btn glass" id="rsMap"><svg class="ic" viewBox="0 0 24 24"><use href="#i-map"/></svg>${esc(T('toMap'))}</button></div></div>`;
  sheet(h, { id: 'result', lock: true });
  if (won) setTimeout(() => { for (let k = 0; k < stars; k++) SND.play('star', k * 250, { n: k + 1 }); }, 120);
  if (next) $('rsNext').onclick = () => { SND.play('tap'); startLevel(n + 1); };
  $('rsRetry').onclick = () => { SND.play('tap'); startLevel(n); };
  $('rsMap').onclick = () => { SND.play('tap'); leaveSolo(); showMap(won ? Math.min(LV.COUNT, n + 1) : n); };
}

// ---------- Time Rush: ninety seconds, as many points as you can ----------
function startRush(restore) {
  closeSheet();
  let g = null;
  if (restore && restore.kind === 'rush') { try { g = MM.Game.fromJSON(restore.G); } catch (e) { g = null; } }
  if (!g) g = new MM.Game({ mode: 'time', seed: (Math.random() * 2 ** 31) >>> 0, time: 90000, colors: 6 });
  store.set('tt_solo', null);
  S = { mode: 'solo', kind: 'rush', canPause: true };
  U.g = g;
  setupScreen({ kind: 'rush', ch: 0 });
  const save = () => { if (S && S.kind === 'rush' && U.g === g && g.started && !g.over && !g.ending) store.set('tt_solo', { kind: 'rush', G: g.toJSON(), at: Date.now() }); };
  S.save = save;
  S.onPause = on => { if (on) save(); };
  S.tbInfo = box => { box.innerHTML = `<span class="chip"><b>${esc(T('mode').rush)}</b></span>` + (PROG.rush ? `<span class="chip"><svg viewBox="0 0 24 24"><use href="#i-trophy"/></svg><span class="num">${fmtN(PROG.rush)}</span></span>` : ''); };
  S.restart = () => { store.set('tt_solo', null); startRush(); };
  S.onEv = (gg, e) => { if (e.k === 'over') store.set('tt_solo', null); };
  S.onOver = gg => rushOver(gg);
  tbInfo();
  SND.music.tempo(true);
  if (g.started) { U.paused = false; pausePlay(); }
  else { introPop(); countdown(now() + 2000, () => { g.start(); drain(); SND.music.start(true); }, 1800); }
}
function rushOver(g) {
  SND.music.stop();
  let nb = false;
  if (g.score > PROG.rush) { nb = PROG.rush > 0; PROG.rush = g.score; saveProg(); }
  SND.play(nb ? 'best' : 'win');
  msg(`<div class="h">${esc(T('timeUp'))}</div>`, true);
  setTimeout(() => { if (S && S.kind === 'rush' && U.g === g) rushResults(g, nb); }, 1300);
}
function rushResults(g, nb) {
  let h = `<div class="res-head"><div class="mo">${pic('m', 2, 'happy')}</div><div class="t1">${esc(T('timeUp'))}</div><div class="t2"><span class="num">${fmtN(g.score)}</span></div>${nb ? `<div class="t3">${esc(T('newBest'))}</div>` : ''}</div>`;
  const made = g.stats.made.slice(1, 6).reduce((a, b) => a + b, 0);
  const cells = [[T('resScore'), fmtN(g.score)], [T('resBest'), fmtN(PROG.rush)], [T('resMoves'), g.stats.moves], [T('resSpecials'), made], [T('resCombo'), g.stats.maxWave + 1], [T('resCleared'), fmtN(g.stats.cleared)]];
  h += `<div class="rgrid">${cells.map(([l, v], k) => `<div class="${k === 0 ? 'hi' : ''}"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  h += `<div class="resfoot"><button class="btn gold" id="rsAgain"><svg class="ic" viewBox="0 0 24 24"><use href="#i-again"/></svg>${esc(T('again'))}</button><button class="btn glass" id="rsLobby">${esc(T('backLobby'))}</button></div>`;
  sheet(h, { id: 'result', lock: true });
  $('rsAgain').onclick = () => { SND.play('tap'); startRush(); };
  $('rsLobby').onclick = () => goLobby();
}
function goLobby() {
  if (typeof KeepAlive !== 'undefined') KeepAlive.mark(LIVE, null);
  if (S && S.mode === 'solo') { leaveSolo(); show('lobby'); renderModes(); renderOpts(); renderResume(); return; }
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  location.reload();
}
