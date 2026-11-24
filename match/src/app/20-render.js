// ===== drawing: the board on a canvas over the whole game screen, the playback of each move's steps, effects and particles =====
// The engine works a move out at once and lists its steps (game.anim). The page keeps its own picture of the board (V) and
// plays those steps in order, each for as long as the engine says, so the picture catches up with the game as the move ends.
const CV = $('cv'), CX = CV.getContext('2d');
let DPR = Math.min(3, Math.max(1, W.devicePixelRatio || 1));
const R = { c: 40, bx: 0, by: 0, gw: 0, gh: 0, wide: false };   // cell size and the board's top-left on the game screen (css px)
const PT = MM.T;
const V = {
  g: null, W: 8, H: 8, hole: null, frost: null, cage: null, box: null, exit: null,
  cell: null, pcs: new Map(), q: [], cur: null, t: 0, clock: 0,
  fx: [], parts: [], texts: [], flyers: [], drops: [],
  sel: -1, hint: null, shake: 0, flash: 0, bgKey: '', bg: null,
  score: 0, have: [], spd: 1, idleT: 0,
};
const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
const easeOut = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const cx = i => i % V.W, cy = i => (i / V.W) | 0;

// ---------- the picture of the board ----------
function newVp(p, x, y) { const v = { id: p.id, k: p.k, c: p.c, x, y, s: 1, a: 1, born: -1, pop: null, path: null, land: -1e9, sh: null, gone: false }; V.pcs.set(p.id, v); return v; }
// start over from the game as it is now (a new game, a restored one, or when the picture lost track)
function syncAll(g) {
  V.g = g; V.W = g.W; V.H = g.H;
  V.hole = g.hole.slice(); V.frost = g.frost.slice(); V.cage = g.cage.slice(); V.box = g.box.slice(); V.exit = g.exit.slice();
  V.cell = new Int32Array(g.W * g.H); V.pcs = new Map();
  for (let i = 0; i < g.pc.length; i++) { const p = g.pc[i]; if (p) { newVp(p, cx(i), cy(i)); V.cell[i] = p.id; } }
  V.q = []; V.cur = null; V.t = 0; V.fx = []; V.parts = []; V.texts = []; V.flyers = []; V.drops = [];
  V.sel = -1; V.hint = null; V.score = g.score; V.have = g.goals.map(x => x.have); V.bgKey = '';
  g.anim.length = 0;
}
const idle = () => !V.cur && !V.q.length;
const pxOf = i => [R.bx + (cx(i) + 0.5) * R.c, R.by + (cy(i) + 0.5) * R.c];

// ---------- playing the steps ----------
function pumpAnim() {
  const g = V.g; if (!g || !g.anim.length) return;
  for (const ph of g.anim.splice(0)) V.q.push(ph);
}
function advanceAnim(dt) {
  V.clock += dt;
  let left = dt * V.spd;
  // a long queue (the page was hidden, or the finale) plays faster
  let queued = V.cur ? V.cur.d - V.t : 0; for (const p of V.q) queued += p.d;
  if (queued > 4500) left *= 2.2;
  let guard = 0;
  while (guard++ < 400) {
    if (!V.cur) { if (!V.q.length) break; V.cur = V.q.shift(); V.t = 0; beginPhase(V.cur); }
    const need = V.cur.d - V.t;
    if (left < need) { V.t += left; break; }
    left -= need; V.t = V.cur.d;
    endPhase(V.cur); V.cur = null;
  }
  if (V.cur) updatePhase(V.cur, V.t);
}
// how long after the start of a blast step each cell goes (a rocket sweeps along its line)
function hitDelay(ph, cell) {
  let d = 0;
  for (const f of ph.fx) {
    if (f.k === 'row' || f.k === 'col') { const dist = f.k === 'row' ? Math.abs(cx(cell) - cx(f.i)) : Math.abs(cy(cell) - cy(f.i)); d = Math.max(d, Math.min(dist * 22, 170)); }
    else if (f.k === 'boom') d = Math.max(d, Math.min(Math.hypot(cx(cell) - cx(f.i), cy(cell) - cy(f.i)) * 30, 120));
    else if (f.k === 'rays') d = Math.max(d, 120 + Math.min(Math.hypot(cx(cell) - cx(f.i), cy(cell) - cy(f.i)) * 25, 200));
  }
  return d;
}
function beginPhase(ph) {
  const T0 = V.clock;
  if (ph.t === 'ev') { onShowEv(ph.e); return; }
  if (ph.t === 'swap') { ph.pa = V.cell[ph.a]; ph.pb = V.cell[ph.b]; SND.play(ph.ok ? 'swap' : 'bad'); return; }
  if (ph.t === 'ring') {
    ph.delays = new Map();
    let any = false, kinds = new Set();
    for (const f of ph.fx) kinds.add(f.k);
    for (const [cell, id, c, keep] of ph.hits) {
      const v = V.pcs.get(id); if (!v) continue;
      const dl = hitDelay(ph, cell);
      v.pop = { t0: T0 + dl, keep, burst: false };
      ph.delays.set(cell, dl);
      any = true;
      // a mochi a goal wants flies up to its counter
      if (c >= 0) goalFly(c, cell, T0 + dl);
    }
    for (const [i, f, cg, bx] of ph.obs) {
      const dl = hitDelay(ph, i);
      V.drops.push({ at: T0 + dl, i, f, cg, bx });
    }
    for (const [at, p] of ph.made) { const v = newVp(p, cx(at), cy(at)); v.born = T0 + PT.ring * 0.45; v.s = 0; }
    for (const [i, pts] of ph.pts) if (pts > 0) V.texts.push({ i, text: '+' + fmtN(pts), t0: T0 + Math.min(260, (ph.delays.get(i) || 0)) + 80, big: pts >= 600 });
    for (const f of ph.fx) addFx(f, T0, ph);
    if (kinds.has('row') || kinds.has('col')) SND.play('rocket');
    if (kinds.has('boom')) SND.play('boom');
    if (kinds.has('pop')) SND.play('lantern');
    if (kinds.has('rays') || kinds.has('conv')) SND.play('firework');
    if (kinds.has('flash')) SND.play('combo');
    if (kinds.has('ham')) SND.play('hammer');
    if (any && !kinds.size) SND.play('pop', 0, { w: ph.wave, big: ph.hits.length >= 5 });
    else if (any && ph.ring > 0) SND.play('pop', 40, { w: ph.wave + 1 });
    if (ph.obs.length) { const o = ph.obs.map(x => x[0]); if (ph.obs.some(x => x[3] >= 0 && V.box[x[0]] > x[3])) SND.play('box', 30); if (ph.obs.some(x => V.cage[x[0]] && !x[2])) SND.play('cage', 30); if (ph.obs.some(x => V.frost[x[0]] > x[1])) SND.play('frost', 40); void o; }
    if (ph.made.length) SND.play('make', 120);
    return;
  }
  if (ph.t === 'fall') {
    for (const m of ph.movers) {
      let v = V.pcs.get(m.id);
      if (!v) { if (!m.p) continue; v = newVp(m.p, m.col, m.row - 1.08); }
      v.path = m.path; v.fx0 = v.x; v.fy0 = v.y; v.pop = null;
      const last = m.path[m.path.length - 1];
      v.landAt = T0 + last[0] * PT.tick;
    }
    return;
  }
  if (ph.t === 'collect') {
    for (const [cell, id] of ph.got) { const v = V.pcs.get(id); if (v) v.out = T0; goalFlyIngot(cell, T0 + 200); }
    SND.play('ingot');
    return;
  }
  if (ph.t === 'shuffle') {
    for (const [id, from, to, col] of ph.moves) { const v = V.pcs.get(id); if (v) v.sh = { from, to, col, x0: v.x, y0: v.y }; }
    return;
  }
  if (ph.t === 'cage') { for (const i of ph.cells) V.drops.push({ at: T0 + 120, i, cg: 1, drop: true }); SND.play('caged'); V.shake = Math.max(V.shake, 6); return; }
  if (ph.t === 'spark') {
    const old = V.pcs.get(ph.old); if (old) old.gone = true;
    const v = newVp(ph.p, cx(ph.i), cy(ph.i)); v.born = T0; v.s = 0;
    V.cell[ph.i] = ph.p.id;
    burst(ph.i, '#fff3b0', 8, 'star');
    SND.play('spark');
    return;
  }
}
function updatePhase(ph, t) {
  if (ph.t === 'swap') {
    const va = V.pcs.get(ph.pa), vb = V.pcs.get(ph.pb);
    // a good swap goes all the way; a bad one goes half way and comes back
    const k = ph.ok ? ease(t / ph.d) : t < ph.d / 2 ? ease(t / (ph.d / 2)) * 0.55 : 0.55 * (1 - ease((t - ph.d / 2) / (ph.d / 2)));
    const ax = cx(ph.a), ay = cy(ph.a), bx = cx(ph.b), by = cy(ph.b);
    if (va) { va.x = ax + (bx - ax) * k; va.y = ay + (by - ay) * k; }
    if (vb) { vb.x = bx + (ax - bx) * k; vb.y = by + (ay - by) * k; }
    return;
  }
  if (ph.t === 'fall') {
    const tk = t / PT.tick;
    for (const m of ph.movers) {
      const v = V.pcs.get(m.id); if (!v || !v.path) continue;
      const path = v.path;
      let px = v.fx0, py = v.fy0;
      for (let j = 0; j < path.length; j++) {
        const [tick, cell] = path[j], nx = cx(cell), ny = cy(cell);
        if (tk >= tick) { px = nx; py = ny; continue; }
        if (tk > tick - 1) { const f = tk - (tick - 1); px = px + (nx - px) * f; py = py + (ny - py) * f; }
        break;
      }
      v.x = px; v.y = py;
    }
    return;
  }
  if (ph.t === 'shuffle') {
    const k = ease(t / ph.d);
    for (const [id, from, to, col] of ph.moves) {
      const v = V.pcs.get(id); if (!v || !v.sh) continue;
      const x0 = cx(from), y0 = cy(from), x1 = cx(to), y1 = cy(to);
      // out towards the middle and back in
      const mx = (V.W - 1) / 2, my = (V.H - 1) / 2, lift = Math.sin(k * Math.PI);
      v.x = x0 + (x1 - x0) * k + (mx - (x0 + x1) / 2) * lift * 0.35;
      v.y = y0 + (y1 - y0) * k + (my - (y0 + y1) / 2) * lift * 0.35;
      if (k > 0.5 && v.c !== col) v.c = col;
    }
  }
}
function endPhase(ph) {
  if (ph.t === 'swap') {
    const va = V.pcs.get(ph.pa), vb = V.pcs.get(ph.pb);
    if (ph.ok) { V.cell[ph.a] = ph.pb || 0; V.cell[ph.b] = ph.pa || 0; if (va) { va.x = cx(ph.b); va.y = cy(ph.b); } if (vb) { vb.x = cx(ph.a); vb.y = cy(ph.a); } }
    else { if (va) { va.x = cx(ph.a); va.y = cy(ph.a); } if (vb) { vb.x = cx(ph.b); vb.y = cy(ph.b); } }
    return;
  }
  if (ph.t === 'ring') {
    for (const [cell, id] of ph.hits) { const v = V.pcs.get(id); if (v) v.gone = true; if (V.cell[cell] === id) V.cell[cell] = 0; }
    for (const [at, p] of ph.made) { V.cell[at] = p.id; const v = V.pcs.get(p.id); if (v) { v.born = -1; v.s = 1; } }
    for (const f of ph.fx) if (f.k === 'conv') for (const [c, p] of f.cells) { V.cell[c] = p.id; }
    flushDrops(Infinity);
    return;
  }
  if (ph.t === 'fall') {
    for (const m of ph.movers) if (m.from >= 0 && V.cell[m.from] === m.id) V.cell[m.from] = 0;
    for (const m of ph.movers) {
      const v = V.pcs.get(m.id); const last = m.path[m.path.length - 1][1];
      V.cell[last] = m.id;
      if (v) { v.x = cx(last); v.y = cy(last); v.path = null; v.land = v.landAt || V.clock; }
    }
    return;
  }
  if (ph.t === 'collect') { for (const [cell, id] of ph.got) { const v = V.pcs.get(id); if (v) v.gone = true; if (V.cell[cell] === id) V.cell[cell] = 0; } return; }
  if (ph.t === 'shuffle') {
    for (const [id, , to, col] of ph.moves) { V.cell[to] = id; const v = V.pcs.get(id); if (v) { v.x = cx(to); v.y = cy(to); v.c = col; v.sh = null; } }
    return;
  }
  if (ph.t === 'cage') { flushDrops(Infinity); return; }
}
// obstacle changes land when their cell is hit
function flushDrops(upTo) {
  if (!V.drops.length) return;
  const keep = [];
  for (const d of V.drops) {
    if (d.at > upTo) { keep.push(d); continue; }
    const i = d.i;
    if (d.drop) { V.cage[i] = 1; V.fx.push({ k: 'cagein', i, t0: V.clock, d: 380 }); continue; }
    if (V.box[i] > d.bx) { burst(i, ['#fff1d6', '#ffd24a', '#e0382f'][Math.min(2, V.box[i] - 1)], 12, 'paper'); obsTick('box', V.box[i] && !d.bx); }
    if (V.cage[i] && !d.cg) { burst(i, '#7cc95a', 10, 'shard'); obsTick('cage', true); }
    if (V.frost[i] > d.f) { burst(i, '#e6f4ff', 10, 'shard'); obsTick('frost', !d.f); }
    V.frost[i] = d.f; V.cage[i] = d.cg; V.box[i] = d.bx;
  }
  V.drops = keep;
}
// the goal counters move as the page shows things go
function obsTick(t, done) {
  if (!done || !V.g) return;
  V.g.goals.forEach((g, k) => { if (g.t === t) { V.have[k] = Math.min(g.n, (V.have[k] | 0) + 1); bumpGoal(k); } });
}

// ---------- effects ----------
function addFx(f, T0, ph) {
  const d = Math.max(300, ph.d);
  if (f.k === 'row' || f.k === 'col') V.fx.push({ k: f.k, i: f.i, w: f.w || 1, t0: T0, d: 520 });
  else if (f.k === 'boom') { V.fx.push({ k: 'boom', i: f.i, r: f.r, t0: T0, d: 520 }); V.shake = Math.max(V.shake, 5 + f.r * 2); burst(f.i, '#ffd24a', 16, 'star'); }
  else if (f.k === 'pop') { V.fx.push({ k: 'ring', i: f.i, t0: T0, d: 380, col: '#ffcf7a' }); }
  else if (f.k === 'fly') V.fx.push({ k: 'fly', i: f.i, to: f.to, carry: f.carry, t0: T0 + PT.ring * 0.4, d: PT.fly + PT.ring * 0.4 });
  else if (f.k === 'rays') V.fx.push({ k: 'rays', i: f.i, cells: f.cells, col: f.color, t0: T0, d: Math.max(d, 600) });
  else if (f.k === 'conv') {
    V.fx.push({ k: 'rays', i: f.i, cells: f.cells.map(x => x[0]), col: -1, t0: T0, d: Math.max(d, 600) });
    f.cells.forEach(([c, p, oldId], n) => {
      const at = T0 + 160 + n * 28;
      V.fx.push({ k: 'conv', i: c, p, oldId, t0: at, d: 1 });
    });
  }
  else if (f.k === 'flash') { V.flash = 1; V.shake = 14; }
  else if (f.k === 'ham') { V.fx.push({ k: 'ham', i: f.i, t0: T0 - 260, d: 520 }); V.shake = Math.max(V.shake, 6); }
}
function burst(i, col, n, kind) {
  const [x, y] = pxOf(i), c = R.c;
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 1.4) * c * 0.0045;
    V.parts.push({ x: x + Math.cos(a) * c * 0.15, y: y + Math.sin(a) * c * 0.15, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - c * 0.002, g: c * 0.000012, life: 0, max: 420 + Math.random() * 380, size: c * (0.05 + Math.random() * 0.07), col, kind: kind || 'dot', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02 });
  }
}
// where a goal's counter is, in game-screen pixels
function goalPos(k) {
  const el = $('hud').querySelector(`.goal[data-g="${k}"]`), gm = $('game');
  if (!el) return null;
  const r = el.getBoundingClientRect(), q = gm.getBoundingClientRect();
  return [r.left - q.left + r.width / 2, r.top - q.top + r.height / 2];
}
function goalFly(c, cell, at) {
  const g = V.g; if (!g || g.mode !== 'level') return;
  const k = g.goals.findIndex((x, j) => x.t === 'col' && x.c === c && (V.have[j] | 0) + V.flyers.filter(f => f.k === j).length < x.n);
  if (k < 0) return;
  V.flyers.push({ k, c, cell, t0: at, d: 520 + Math.random() * 160 });
}
function goalFlyIngot(cell, at) {
  const g = V.g; if (!g) return;
  const k = g.goals.findIndex(x => x.t === 'ing'); if (k < 0) return;
  V.flyers.push({ k, c: -1, ing: true, cell, t0: at, d: 650 });
}
function bumpGoal(k) {
  const el = $('hud').querySelector(`.goal[data-g="${k}"]`); if (!el) return;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  U.hudKey = '';
}

// ---------- drawing ----------
function layoutBoard() {
  const gm = $('game'); if (gm.hidden || !V.g) return;
  DPR = Math.min(3, Math.max(1, W.devicePixelRatio || 1));
  const gw = gm.clientWidth, gh = gm.clientHeight;
  R.gw = gw; R.gh = gh;
  const pw = Math.round(gw * DPR), ph = Math.round(gh * DPR);
  if (CV.width !== pw || CV.height !== ph) { CV.width = pw; CV.height = ph; }
  const st = $('stage'), sr = st.getBoundingClientRect(), q = gm.getBoundingClientRect();
  let left = sr.left - q.left, top = sr.top - q.top, aw = sr.width, ah = sr.height;
  // a phone on its side keeps the numbers in a column on the left
  if (R.side) { const hw = SIDE_W + 20; left += hw; aw -= hw; }
  // the other players' boards sit to the right on a wide screen or a phone on its side
  const oppW = (R.wide || R.side) && $('opps').children.length ? oppColW() + 24 : 0;
  aw -= oppW;
  const c = Math.floor(clamp(Math.min((aw - 16) / V.W, (ah - 14) / V.H), 24, 86));
  R.c = c;
  R.bx = Math.round(left + (aw - c * V.W) / 2);
  R.by = Math.round(top + Math.max(4, (ah - c * V.H) / 2));
  V.bgKey = '';
  const box = { left: R.bx + 'px', top: R.by + 'px', width: c * V.W + 'px', height: c * V.H + 'px' };
  Object.assign($('wmsg').style, box);
  Object.assign($('pops').style, { left: R.bx + c * V.W / 2 + 'px', top: R.by + c * V.H * 0.42 + 'px' });
  gm.style.setProperty('--c', c + 'px');
  if (oppW) { const o = $('opps'); o.style.left = (R.bx + c * V.W + 24) + 'px'; o.style.top = R.by + 'px'; o.style.width = (oppW - 24) + 'px'; }
  budPlace();
}
// the width of the numbers' column on a phone on its side, and of the others' cards beside the board
const SIDE_W = 172;
const oppColW = () => (R.side ? Math.min(230, Math.round(R.gw * 0.27)) : Math.min(300, Math.round(R.gw * 0.24)));
// colours that follow the theme: the board's floor, its rim and shadow, and the small boards
const FLOOR = () => A.theme === 'pal'
  ? { shadow: 'rgba(80,60,40,.28)', rim: 'rgba(255,255,255,.85)', base: 'rgba(255,248,232,.94)', odd: 'rgba(236,214,178,.38)', even: 'rgba(255,255,255,.5)', mini: 'rgba(255,248,232,.95)' }
  : { shadow: 'rgba(0,0,0,.55)', rim: 'rgba(255,236,210,.2)', base: 'rgba(14,12,44,.86)', odd: 'rgba(255,255,255,.075)', even: 'rgba(255,255,255,.035)', mini: 'rgba(14,12,44,.85)' };
// the board's floor: drawn once per size and shape
function boardBg() {
  const key = A.theme + ':' + R.c + ':' + DPR + ':' + V.W + 'x' + V.H + ':' + Array.from(V.hole).join('') + ':' + (V.g && V.g.ing.total ? 1 : 0);
  const F = FLOOR();
  if (key === V.bgKey && V.bg) return V.bg;
  V.bgKey = key;
  const c = R.c * DPR, w = Math.ceil(c * V.W + c), h = Math.ceil(c * V.H + c), m = c * 0.5;
  const cv = V.bg && V.bg.width === w && V.bg.height === h ? V.bg : (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
  const x = cv.getContext('2d'); x.clearRect(0, 0, w, h);
  const cells = []; for (let i = 0; i < V.W * V.H; i++) if (!V.hole[i]) cells.push(i);
  const shape = (pad, rad) => { x.beginPath(); for (const i of cells) rrect(x, m + cx(i) * c - pad, m + cy(i) * c - pad, c + 2 * pad, c + 2 * pad, rad); };
  // a soft shadow, a light rim, then the floor
  x.save(); x.shadowColor = F.shadow; x.shadowBlur = c * 0.45; x.shadowOffsetY = c * 0.12;
  shape(c * 0.12, c * 0.3); x.fillStyle = F.rim; x.fill(); x.restore();
  shape(c * 0.07, c * 0.26); x.fillStyle = F.base; x.fill();
  for (const i of cells) {
    const px = m + cx(i) * c, py = m + cy(i) * c;
    x.fillStyle = (cx(i) + cy(i)) % 2 ? F.odd : F.even;
    x.beginPath(); rrect(x, px + c * 0.035, py + c * 0.035, c * 0.93, c * 0.93, c * 0.18); x.fill();
  }
  V.bg = cv;
  return cv;
}
function rrect(x, a, b, w, h, r) { x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
const FACE_FOR = (v, t) => {
  if (v.pop && t >= v.pop.t0) return 'happy';
  if (v.id === V.selId) return 'wow';
  const ph = (t + v.id * 977) % 5200;
  return ph < 150 ? 'blink' : 'idle';
};
function drawBoard(t) {
  const x = CX, c = R.c, d = DPR;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, CV.width, CV.height);
  if (!V.g || $('game').hidden) return;
  let sx = 0, sy = 0;
  if (V.shake > 0.2) { sx = (Math.random() - 0.5) * V.shake; sy = (Math.random() - 0.5) * V.shake; V.shake *= 0.86; } else V.shake = 0;
  x.setTransform(d, 0, 0, d, sx * d, sy * d);
  // floor
  const bg = boardBg();
  x.drawImage(bg, R.bx - c * 0.5, R.by - c * 0.5, bg.width / d, bg.height / d);
  const N = V.W * V.H;
  // frost under the pieces, the way out for ingots
  for (let i = 0; i < N; i++) {
    if (V.hole[i]) continue;
    if (V.frost[i]) x.drawImage(A.img('frost', V.frost[i], '', Math.round(c * d)), R.bx + cx(i) * c - c * A.PAD, R.by + cy(i) * c - c * A.PAD, c * (1 + 2 * A.PAD), c * (1 + 2 * A.PAD));
    if (V.exit[i] && V.g.ing.total) {
      const px = R.bx + (cx(i) + 0.5) * c, py = R.by + (cy(i) + 1) * c + c * 0.12 + Math.sin(t / 260) * c * 0.04;
      x.fillStyle = 'rgba(255,215,106,.85)'; x.beginPath(); x.moveTo(px - c * 0.16, py); x.lineTo(px + c * 0.16, py); x.lineTo(px, py + c * 0.16); x.closePath(); x.fill();
    }
  }
  // the selected cell and the hint
  if (V.sel >= 0) { x.fillStyle = 'rgba(255,215,106,.22)'; x.beginPath(); rrect(x, R.bx + cx(V.sel) * c + 2, R.by + cy(V.sel) * c + 2, c - 4, c - 4, c * 0.2); x.fill(); x.strokeStyle = 'rgba(255,215,106,.8)'; x.lineWidth = 2; x.stroke(); }
  if (U.ham) { x.strokeStyle = `rgba(255,215,106,${0.35 + 0.25 * Math.sin(t / 180)})`; x.lineWidth = 3; x.beginPath(); rrect(x, R.bx - 3, R.by - 3, c * V.W + 6, c * V.H + 6, c * 0.3); x.stroke(); }
  // pieces: clipped to the board (with a margin for ears), so new ones slide in from the top edge
  x.save();
  x.beginPath();
  for (let i = 0; i < N; i++) if (!V.hole[i]) x.rect(R.bx + cx(i) * c - c * 0.2, R.by + cy(i) * c - c * 0.16, c * 1.4, c * 1.32);
  x.clip();
  const list = [];
  for (const v of V.pcs.values()) { if (v.gone) continue; list.push(v); }
  list.sort((a, b) => a.y - b.y);
  const hint = V.hint && U.hintOn ? V.hint : null;
  for (const v of list) drawPiece(x, v, t, hint);
  x.restore();
  // boxes and cages over everything in their cells
  for (let i = 0; i < N; i++) {
    if (V.box[i]) { const s = c * (1 + 2 * A.PAD); x.drawImage(A.img('box', V.box[i], '', Math.round(c * d)), R.bx + cx(i) * c - c * A.PAD, R.by + cy(i) * c - c * A.PAD, s, s); }
    if (V.cage[i]) { const s = c * (1 + 2 * A.PAD); x.drawImage(A.img('cage', 0, '', Math.round(c * d)), R.bx + cx(i) * c - c * A.PAD, R.by + cy(i) * c - c * A.PAD, s, s); }
  }
  drawFx(x, t);
  drawParts(x, t);
  if (V.flash > 0.01) { x.fillStyle = `rgba(255,250,230,${V.flash * 0.7})`; x.fillRect(0, 0, R.gw, R.gh); V.flash *= 0.9; }
}
function drawPiece(x, v, t, hint) {
  const c = R.c, d = DPR;
  let s = v.s, a = 1, ox = 0, oy = 0, sxk = 1, syk = 1;
  // a new special grows in
  if (v.born >= 0) { const k = (t - v.born) / 260; s = k <= 0 ? 0 : k >= 1 ? 1 : easeOut(k) * (1 + 0.25 * Math.sin(k * Math.PI)); }
  // popping: a little swell, then gone
  if (v.pop && t >= v.pop.t0) {
    const k = (t - v.pop.t0) / 200;
    if (!v.pop.burst) { v.pop.burst = true; if (v.k === 0) burst(cellOfV(v), A.COL[v.c].k, 7, 'dot'); else burst(cellOfV(v), '#ffe28a', 9, 'star'); }
    s = k < 0.35 ? 1 + k * 0.7 : Math.max(0, 1.25 - (k - 0.35) * 2.2); a = clamp(1.4 - k, 0, 1);
    if (s <= 0.02) return;
  }
  // landing squash
  const lk = (t - v.land) / 190;
  if (lk >= 0 && lk < 1) { const q = Math.sin(lk * Math.PI) * (1 - lk); syk = 1 - 0.16 * q; sxk = 1 + 0.12 * q; oy = c * 0.08 * q; }
  // an ingot on its way out
  if (v.out) { const k = clamp((t - v.out) / PT.collect, 0, 1); oy += k * c * 0.8; a *= 1 - k; s *= 1 - 0.3 * k; }
  // idle: a slow breath
  if (!v.pop && !v.path && v.k === 0) { const b = Math.sin(t / 620 + v.id * 1.7) * 0.018; syk *= 1 + b; sxk *= 1 - b * 0.6; }
  // the hint wiggles the two pieces towards each other
  if (hint && (v.id === hint.ia || v.id === hint.ib)) {
    const other = v.id === hint.ia ? hint.b : hint.a, me = v.id === hint.ia ? hint.a : hint.b;
    const w = Math.max(0, Math.sin(t / 130)) * 0.12 * (0.6 + 0.4 * Math.sin(t / 900));
    ox += (cx(other) - cx(me)) * w * c; oy += (cy(other) - cy(me)) * w * c;
  }
  if (v.id === V.selId) { const b = Math.abs(Math.sin(t / 150)) * c * 0.06; oy -= b; }
  const face = v.k === 0 ? (V.cage[cellOfV(v)] && !v.path ? 'sleep' : FACE_FOR(v, t)) : '';
  const img = A.img(v.k, v.k === 0 ? v.c : 0, face, Math.round(c * d));
  const full = c * (1 + 2 * A.PAD);
  const px = R.bx + (v.x + 0.5) * c + ox, py = R.by + (v.y + 0.5) * c + oy;
  x.globalAlpha = a;
  // specials glow a little
  if (v.k >= 1 && v.k <= 5) { const gl = 0.5 + 0.5 * Math.sin(t / 300 + v.id); x.fillStyle = `rgba(255,214,120,${0.12 + 0.1 * gl})`; x.beginPath(); x.arc(px, py, c * 0.48 * s, 0, 7); x.fill(); }
  if (sxk !== 1 || syk !== 1 || s !== 1) {
    x.save(); x.translate(px, py + c * 0.4); x.scale(s * sxk, s * syk); x.drawImage(img, -full / 2, -c * 0.4 - full / 2, full, full); x.restore();
  } else x.drawImage(img, px - full / 2, py - full / 2, full, full);
  x.globalAlpha = 1;
}
function cellOfV(v) { return clamp(Math.round(v.y), 0, V.H - 1) * V.W + clamp(Math.round(v.x), 0, V.W - 1); }
function drawFx(x, t) {
  const c = R.c, d = DPR;
  V.fx = V.fx.filter(f => t < f.t0 + f.d + 60);
  for (const f of V.fx) {
    const k = (t - f.t0) / f.d; if (k < 0) continue;
    const [px, py] = pxOf(f.i);
    if (f.k === 'row' || f.k === 'col') {
      const len = (f.k === 'row' ? V.W : V.H) * c, lines = f.w === 3 ? [-1, 0, 1] : [0];
      for (const o of lines) {
        const reach = easeOut(k) * len, fade = 1 - clamp((k - 0.55) / 0.45, 0, 1);
        x.save();
        x.translate(px + (f.k === 'col' ? o * c : 0), py + (f.k === 'row' ? o * c : 0));
        if (f.k === 'col') x.rotate(Math.PI / 2);
        const gr = x.createLinearGradient(-reach, 0, reach, 0);
        gr.addColorStop(0, 'rgba(255,120,60,0)'); gr.addColorStop(0.5, `rgba(255,236,170,${0.85 * fade})`); gr.addColorStop(1, 'rgba(255,120,60,0)');
        x.fillStyle = gr; x.fillRect(-reach, -c * 0.17, reach * 2, c * 0.34);
        x.fillStyle = `rgba(255,255,255,${0.7 * fade})`; x.fillRect(-reach * 0.9, -c * 0.04, reach * 1.8, c * 0.08);
        // the two rockets
        const rk = A.img(1, 0, '', Math.round(c * d * 0.8)), s = c * 0.8 * (1 + 2 * A.PAD);
        if (k < 0.75) { x.drawImage(rk, reach - s / 2, -s / 2, s, s); x.save(); x.scale(-1, 1); x.drawImage(rk, reach - s / 2, -s / 2, s, s); x.restore(); }
        x.restore();
      }
      if (Math.random() < 0.5) V.parts.push({ x: px + (Math.random() - 0.5) * (f.k === 'row' ? V.W * c : c * 0.3), y: py + (Math.random() - 0.5) * (f.k === 'col' ? V.H * c : c * 0.3), vx: 0, vy: -0.02, g: 0, life: 0, max: 400, size: c * 0.06, col: '#ffe9a8', kind: 'star', rot: 0, vr: 0.02 });
    } else if (f.k === 'boom') {
      const r = (f.r + 0.5) * c * easeOut(k), fade = 1 - k;
      x.fillStyle = `rgba(255,220,140,${0.35 * fade})`; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
      x.strokeStyle = `rgba(255,250,220,${0.9 * fade})`; x.lineWidth = c * 0.12 * fade + 1; x.beginPath(); x.arc(px, py, r, 0, 7); x.stroke();
    } else if (f.k === 'ring') {
      const r = c * (0.3 + 1.3 * easeOut(k)), fade = 1 - k;
      x.strokeStyle = `rgba(255,214,130,${0.9 * fade})`; x.lineWidth = c * 0.1 * fade + 1; x.beginPath(); x.arc(px, py, r, 0, 7); x.stroke();
    } else if (f.k === 'fly') {
      const [tx, ty] = pxOf(f.to), kk = ease(k);
      const fx = px + (tx - px) * kk, fy = py + (ty - py) * kk - Math.sin(kk * Math.PI) * c * 1.6;
      const img = A.img(4, 0, '', Math.round(c * d * 0.9)), s = c * 0.9 * (1 + 2 * A.PAD);
      if (f.carry) { const ci = A.img(f.carry, 0, '', Math.round(c * d * 0.55)), cs = c * 0.55 * (1 + 2 * A.PAD); x.save(); x.translate(fx, fy + c * 0.45); if (f.carry === 2) x.rotate(Math.PI / 2); x.drawImage(ci, -cs / 2, -cs / 2, cs, cs); x.restore(); }
      x.drawImage(img, fx - s / 2, fy - s / 2 - Math.sin(t / 90) * 2, s, s);
      if (Math.random() < 0.6) V.parts.push({ x: fx + (Math.random() - 0.5) * c * 0.3, y: fy + c * 0.3, vx: 0, vy: 0.01, g: 0, life: 0, max: 380, size: c * 0.05, col: '#ffd27a', kind: 'dot', rot: 0, vr: 0 });
    } else if (f.k === 'rays') {
      const col = f.col >= 0 ? A.COL[f.col].k : null;
      x.lineCap = 'round';
      f.cells.forEach((cell, n) => {
        const [tx, ty] = pxOf(cell), kk = clamp(k * 1.8 - n * 0.02, 0, 1), fade = 1 - clamp((k - 0.6) / 0.4, 0, 1);
        if (kk <= 0) return;
        x.strokeStyle = col || A.COL[n % 6].k; x.globalAlpha = 0.85 * fade; x.lineWidth = c * 0.08;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + (tx - px) * kk, py + (ty - py) * kk); x.stroke();
        x.strokeStyle = '#fff'; x.lineWidth = c * 0.03; x.stroke();
        x.globalAlpha = 1;
      });
      const fw = A.img(5, 0, '', Math.round(c * d)), s = c * (1 + 2 * A.PAD) * (1 + 0.15 * Math.sin(t / 60));
      if (k < 0.7) { x.save(); x.translate(px, py); x.rotate(t / 160); x.drawImage(fw, -s / 2, -s / 2, s, s); x.restore(); }
    } else if (f.k === 'conv') {
      if (!f.done) {
        f.done = true;
        const old = V.pcs.get(f.oldId); if (old) old.gone = true;
        const v = newVp(f.p, cx(f.i), cy(f.i)); v.born = t; v.s = 0;
        V.cell[f.i] = f.p.id;
        burst(f.i, '#fff3b0', 6, 'star');
      }
    } else if (f.k === 'cagein') {
      const s = c * (1 + 2 * A.PAD) * (1 + 0.6 * (1 - easeOut(k)));
      x.globalAlpha = clamp(k * 2, 0, 1) * 0.9;
      x.drawImage(A.img('cage', 0, '', Math.round(c * d)), px - s / 2, py - s / 2, s, s);
      x.globalAlpha = 1;
    } else if (f.k === 'ham') {
      const kk = clamp(k * 2, 0, 1), ang = -1.1 + 1.1 * ease(kk), fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      x.save(); x.globalAlpha = fade; x.translate(px + c * 0.5, py - c * 0.1); x.rotate(ang);
      x.fillStyle = '#8a5a2b'; x.fillRect(-c * 0.06, -c * 0.1, c * 0.12, c * 0.9);
      x.fillStyle = '#c9cede'; x.beginPath(); rrect(x, -c * 0.5, -c * 0.32, c * 0.62, c * 0.34, c * 0.08); x.fill(); x.strokeStyle = '#6b708a'; x.lineWidth = 1.5; x.stroke();
      x.restore();
      if (kk >= 1 && !f.hit) { f.hit = true; V.fx.push({ k: 'ring', i: f.i, t0: t, d: 320 }); burst(f.i, '#ffffff', 10, 'shard'); }
    }
  }
}
function drawParts(x, t) {
  const c = R.c;
  const dt = Math.min(50, t - (V.lastT || t)); V.lastT = t;
  V.parts = V.parts.filter(p => (p.life += dt) < p.max);
  if (V.parts.length > 500) V.parts.splice(0, V.parts.length - 500);
  for (const p of V.parts) {
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const k = p.life / p.max, a = 1 - k;
    x.globalAlpha = a; x.fillStyle = p.col;
    if (p.kind === 'star') { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); const s = p.size * 1.4; x.beginPath(); for (let j = 0; j < 8; j++) { const r = j % 2 ? s * 0.4 : s, an = j * Math.PI / 4; x.lineTo(Math.cos(an) * r, Math.sin(an) * r); } x.closePath(); x.fill(); x.restore(); }
    else if (p.kind === 'shard' || p.kind === 'paper') { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size); x.restore(); }
    else { x.beginPath(); x.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, 7); x.fill(); }
  }
  x.globalAlpha = 1;
  // points
  V.texts = V.texts.filter(s => t < s.t0 + 900);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const s of V.texts) {
    const k = (t - s.t0) / 900; if (k < 0) continue;
    if (!s.counted) { s.counted = true; V.score += +s.text.replace(/\D/g, '') || 0; }
    const [px, py] = pxOf(s.i);
    x.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    x.font = `800 ${Math.round(c * (s.big ? 0.5 : 0.38))}px Manrope,sans-serif`;
    x.lineWidth = Math.max(2, c * 0.08); x.strokeStyle = A.theme === 'pal' ? 'rgba(150,72,24,.92)' : 'rgba(30,14,40,.85)'; x.strokeText(s.text, px, py - k * c * 0.7);
    x.fillStyle = s.big ? (A.theme === 'pal' ? '#ffe36e' : '#ffe9a8') : '#ffffff'; x.fillText(s.text, px, py - k * c * 0.7);
  }
  x.globalAlpha = 1;
  // mochi flying up to their goal
  V.flyers = V.flyers.filter(f => {
    const k = (t - f.t0) / f.d; if (k < 0) return true;
    const to = goalPos(f.k); if (!to || k >= 1) { V.have[f.k] = Math.min(V.g.goals[f.k] ? V.g.goals[f.k].n : 0, (V.have[f.k] | 0) + 1); bumpGoal(f.k); SND.play('spark'); return false; }
    const [px, py] = pxOf(f.cell), kk = ease(k);
    const fx = px + (to[0] - px) * kk, fy = py + (to[1] - py) * kk - Math.sin(kk * Math.PI) * c * 1.2;
    const s = c * (0.8 - 0.35 * kk) * (1 + 2 * A.PAD);
    x.drawImage(f.ing ? A.img(6, 0, '', Math.round(c * DPR)) : A.img(0, f.c, 'happy', Math.round(c * DPR)), fx - s / 2, fy - s / 2, s, s);
    return true;
  });
}
addEventListener('resize', () => { if (screenOn === 'game') layoutGame(); });
// the numbers above the board and the buttons below it fill in after the first frame: lay the board out again whenever its space changes
if (W.ResizeObserver) new ResizeObserver(() => { if (screenOn === 'game') layoutBoard(); }).observe($('stage'));

// ---------- the small boards of the other players ----------
function drawMini(cv, sn, m) {
  if (!sn || !sn.b) { const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); return; }
  const w = sn.w || 8, h = Math.ceil(sn.b.length / w), d = DPR;
  const pw = Math.round(w * m * d), ph = Math.round(h * m * d);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; cv.style.width = w * m + 'px'; cv.style.height = h * m + 'px'; }
  const x = cv.getContext('2d'), s = m * d;
  x.clearRect(0, 0, pw, ph);
  x.fillStyle = FLOOR().mini; x.fillRect(0, 0, pw, ph);
  for (let i = 0; i < sn.b.length; i++) {
    const ch = sn.b[i], px = (i % w) * s, py = ((i / w) | 0) * s;
    if (ch === '#' || ch === '.') continue;
    let col = null;
    if (ch >= '0' && ch <= '5') col = A.COL[+ch].a;
    else if (ch >= 'A' && ch <= 'F') col = A.COL['ABCDEF'.indexOf(ch)].a;
    else if (ch === 'i') col = '#ffcf3a';
    else if (ch === 'b') { x.fillStyle = '#e0382f'; x.fillRect(px + s * 0.1, py + s * 0.1, s * 0.8, s * 0.8); continue; }
    else col = '#fff3b0';
    x.fillStyle = col; x.beginPath(); x.arc(px + s / 2, py + s / 2, s * 0.42, 0, 7); x.fill();
    if (ch >= '6' && ch <= '9' || ch === 'w') { x.fillStyle = ch === '9' ? '#ff9a3c' : ch === 'w' ? '#6d5bd0' : '#e8382f'; x.beginPath(); x.arc(px + s / 2, py + s / 2, s * 0.24, 0, 7); x.fill(); }
    if (ch >= 'A' && ch <= 'F') { x.fillStyle = '#4c9a3a'; x.fillRect(px + s * 0.2, py, s * 0.14, s); x.fillRect(px + s * 0.66, py, s * 0.14, s); }
  }
}
