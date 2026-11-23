// ===== drawing: the well (canvas), hold and next, the opponents' small wells, the layout =====
const { W: COLS, H: ROWS, TOP, FACE, BUB, CELLS, SHAPES } = SB;
const HEAD = 1.5;   // rows of headroom drawn above the well, where new blocks appear
const R = { c: 24, dpr: 1, wide: false, narrow: false, m: 4 };
let DPR = Math.min(3, Math.max(1, Math.round(W.devicePixelRatio || 1)));
function sizeCanvas(cv, w, h) {
  const pw = Math.round(w * DPR), ph = Math.round(h * DPR);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  return cv.getContext('2d');
}
const offscreen = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
// a cell with a face, cached per colour, size and face
const faceCache = new Map();
function faceCell(t, px, f) {
  const key = t + ':' + px + ':' + f;
  let cv = faceCache.get(key);
  if (cv) return cv;
  if (faceCache.size > 160) faceCache.clear();
  cv = offscreen(px, px);
  const x = cv.getContext('2d');
  x.drawImage(A.cellImg(t, px), 0, 0);
  A.face(x, 0, 0, px, f, 0);
  faceCache.set(key, cv);
  return cv;
}
// draw one cell value v (colour + face flag) at canvas pixel (px, py), size s
function putCell(x, v, px, py, s, f) {
  const t = v & 15; if (!t) return;
  if ((v & FACE) && s >= 9) x.drawImage(faceCell(t, s, f || 'sleep'), px, py);
  else x.drawImage(A.cellImg(t, s), px, py);
}

// ---------- the main well ----------
const WELL = { cv: $('cvWell'), x: null, st: null, stx: null, key: '', fx: [], flash: [], trail: [] };
// src: { cell(x, y) -> value for rows TOP-2..ROWS-1, cur: {t,x,y,r} or null, ghost: y or null, clr: Set of rows clearing, clrT: 0..1, danger, key }
function drawWell(src, tnow) {
  const c = R.c, s = Math.round(c * DPR), x = WELL.x; if (!x) return;
  const cw = WELL.cv.width, ch = WELL.cv.height, y0 = Math.round(HEAD * c * DPR);
  const rowY = y => y0 + (y - TOP) * s;
  // the still part (grid and resting blocks) is drawn once per change
  const key = src.key + '|' + s + '|' + (src.danger ? 1 : 0) + '|' + (src.clr ? [...src.clr].join(',') : '');
  if (WELL.key !== key || !WELL.st) {
    WELL.key = key;
    if (!WELL.st || WELL.st.width !== cw || WELL.st.height !== ch) { WELL.st = offscreen(cw, ch); WELL.stx = WELL.st.getContext('2d'); }
    const g = WELL.stx;
    g.clearRect(0, 0, cw, ch);
    // the well's floor and a faint grid
    const bg = g.createLinearGradient(0, y0, 0, ch);
    bg.addColorStop(0, 'rgba(16,8,26,.78)'); bg.addColorStop(1, 'rgba(26,12,38,.86)');
    g.fillStyle = bg; A.rr(g, 0, y0, cw, ch - y0, Math.round(c * 0.4 * DPR)); g.fill();
    g.fillStyle = 'rgba(255,240,230,.035)';
    for (let i = 1; i < COLS; i++) g.fillRect(i * s - Math.max(1, DPR * 0.5) / 2, y0, Math.max(1, DPR * 0.5), ch - y0);
    for (let j = 1; j < 20; j++) g.fillRect(0, y0 + j * s - Math.max(1, DPR * 0.5) / 2, cw, Math.max(1, DPR * 0.5));
    const f = src.danger ? 'worry' : 'sleep';
    for (let y = TOP - 2; y < ROWS; y++) {
      const clr = src.clr && src.clr.has(y);
      for (let xx = 0; xx < COLS; xx++) {
        const v = src.cell(xx, y); if (!v) continue;
        if (y < TOP) g.globalAlpha = 0.55;
        putCell(g, v, xx * s, rowY(y), s, clr ? 'squish' : f);
        g.globalAlpha = 1;
      }
    }
  }
  x.clearRect(0, 0, cw, ch);
  x.drawImage(WELL.st, 0, 0);
  // rows being cleared: a white flash that fades
  if (src.clr && src.clr.size) {
    const k = clamp(src.clrT, 0, 1);
    x.fillStyle = `rgba(255,250,235,${0.75 * (1 - k)})`;
    for (const y of src.clr) { const w = cw * (1 - k * 0.15); x.fillRect((cw - w) / 2, rowY(y) + s * 0.08 * k, w, s * (1 - 0.16 * k)); }
  }
  // the landing guide
  const cur = src.cur;
  if (cur && src.ghost != null && src.ghost > cur.y && P.ghost) {
    const col = A.COL[cur.t];
    x.save(); x.lineWidth = Math.max(1, s * 0.07); x.setLineDash([s * 0.18, s * 0.12]); x.strokeStyle = col.a; x.fillStyle = col.a;
    for (const [cx, cy] of CELLS[cur.t][cur.r]) {
      const yy = src.ghost + cy; if (yy < TOP - 2) continue;
      const px = (cur.x + cx) * s, py = rowY(yy), k = s * 0.12;
      x.globalAlpha = 0.13; A.rr(x, px + k, py + k, s - 2 * k, s - 2 * k, s * 0.22); x.fill();
      x.globalAlpha = 0.75; x.stroke();
    }
    x.restore();
  }
  // hard drop trails
  WELL.trail = WELL.trail.filter(t => tnow - t.at < 220);
  for (const t of WELL.trail) {
    const k = (tnow - t.at) / 220, col = A.COL[t.t];
    for (const cx of t.cols) {
      const top = rowY(t.from), bot = rowY(t.to);
      if (bot <= top) continue;
      const gr = x.createLinearGradient(0, top, 0, bot);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, col.c);
      x.globalAlpha = 0.45 * (1 - k); x.fillStyle = gr;
      x.fillRect(cx * s + s * 0.2, top, s * 0.6, bot - top);
    }
    x.globalAlpha = 1;
  }
  // the falling block, awake, with its ears up and its eyes on where it is going
  if (cur) {
    const cs = CELLS[cur.t][cur.r], fi = SHAPES[cur.t].face, own = new Set(cs.map(q => q.join()));
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = cs[i], yy = cur.y + cy; if (yy < TOP - 2) continue;
      x.drawImage(A.cellImg(cur.t, s), (cur.x + cx) * s, rowY(yy));
    }
    const [fx, fy] = cs[fi], px = (cur.x + fx) * s, py = rowY(cur.y + fy);
    if (cur.y + fy >= TOP - 2) {
      if (!own.has(fx + ',' + (fy - 1))) A.ears(x, cur.t, px, py, s, src.worry ? 0.6 : 1);
      x.drawImage(A.cellImg(cur.t, s), px, py);
      A.face(x, px, py, s, src.worry ? 'worry' : 'awake', src.look || 0);
    }
  }
  // blocks that just landed glow for a moment
  WELL.flash = WELL.flash.filter(f => tnow - f.at < 170);
  for (const f of WELL.flash) {
    x.fillStyle = `rgba(255,255,255,${0.42 * (1 - (tnow - f.at) / 170)})`;
    for (const [cx, cy] of f.cells) if (cy >= TOP - 2) { A.rr(x, cx * s + s * 0.05, rowY(cy) + s * 0.05, s * 0.9, s * 0.9, s * 0.24); x.fill(); }
  }
  // sparkles and paw prints from cleared rows
  if (WELL.fx.length) {
    const live = [];
    for (const p of WELL.fx) {
      const age = tnow - p.at; if (age > p.life) continue;
      live.push(p);
      const k = age / p.life, dt = age / 1000;
      const px = p.x + p.vx * dt, py = p.y + p.vy * dt + 700 * dt * dt * p.g;
      x.globalAlpha = Math.max(0, 1 - k * k);
      x.fillStyle = p.col;
      const r = p.r * (1 - k * 0.4) * DPR;
      x.save(); x.translate(px * DPR, py * DPR); x.rotate(p.rot + k * p.spin);
      if (p.kind === 'paw') { x.beginPath(); x.ellipse(0, r * 0.35, r * 0.62, r * 0.5, 0, 0, 7); x.fill(); for (const [a, b] of [[-0.62, -0.32], [-0.22, -0.66], [0.22, -0.66], [0.62, -0.32]]) { x.beginPath(); x.arc(a * r, b * r, r * 0.22, 0, 7); x.fill(); } }
      else { x.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.38 : r; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill(); }
      x.restore();
    }
    x.globalAlpha = 1;
    WELL.fx = live;
  }
}
// confetti for cleared rows (css px inside the well canvas)
function burst(rows, big) {
  const c = R.c, t0 = now();
  const cols = ['#fff3b0', '#ffd9e8', '#d6f7dc', '#d2ecff', '#ffdcad', '#fff'];
  for (const y of rows) {
    const py = (HEAD + y - TOP + 0.5) * c;
    const n = big ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const px = (i + 0.5 + Math.random() * 0.6 - 0.3) * (c * 10 / n);
      WELL.fx.push({ at: t0, life: 650 + Math.random() * 450, x: px, y: py, vx: (Math.random() - 0.5) * c * 6, vy: -c * (3 + Math.random() * 5), g: 1.2, r: c * (0.16 + Math.random() * 0.14), col: cols[(Math.random() * cols.length) | 0], kind: Math.random() < 0.3 ? 'paw' : 'star', rot: Math.random() * 6, spin: (Math.random() - 0.5) * 6 });
    }
  }
  if (WELL.fx.length > 140) WELL.fx.splice(0, WELL.fx.length - 140);
}

// ---------- hold and next ----------
// a block centred in a box of w × h css px with cells of size cs
function drawPiece(x, t, cx, cy, cs, o) {
  o = o || {};
  const cells = CELLS[t][0], fi = SHAPES[t].face;
  const xs = cells.map(q => q[0]), ys = cells.map(q => q[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const s = Math.round(cs * DPR), w = (maxx - minx + 1) * s, h = (maxy - miny + 1) * s;
  const ox = Math.round(cx * DPR - w / 2), oy = Math.round(cy * DPR - h / 2);
  const own = new Set(cells.map(q => q.join()));
  if (o.dim) x.globalAlpha = 0.38;
  for (let i = 0; i < 4; i++) if (i !== fi) x.drawImage(A.cellImg(t, s), ox + (cells[i][0] - minx) * s, oy + (cells[i][1] - miny) * s);
  const [fx, fy] = cells[fi], px = ox + (fx - minx) * s, py = oy + (fy - miny) * s;
  if (!own.has(fx + ',' + (fy - 1))) A.ears(x, t, px, py, s, o.dim ? 0.5 : 1);
  x.drawImage(A.cellImg(t, s), px, py);
  A.face(x, px, py, s, o.dim ? 'sleep' : 'awake', 0);
  x.globalAlpha = 1;
}
const SIDE = { hk: '', nk: '' };
// the side column's width and the size of the blocks in hold and next
const sideW = () => R.c * (R.narrow ? 2.1 : 2.75);
function drawHold(t, used) {
  const key = t + ':' + (used ? 1 : 0) + ':' + R.c + ':' + DPR + ':' + (R.narrow ? 1 : 0);
  if (SIDE.hk === key) return; SIDE.hk = key;
  const k = R.narrow ? 0.4 : 0.5;
  const cv = $('cvHold'), w = sideW() - 4, h = R.c * k * 3.6, x = sizeCanvas(cv, w, h);
  x.clearRect(0, 0, cv.width, cv.height);
  if (t) drawPiece(x, t, w / 2, h / 2 + R.c * 0.08, R.c * k, { dim: used });
  $('holdBox').classList.toggle('used', !!used);
}
function drawNext(q) {
  const list = (q || []).slice(0, 5);
  const key = list.join('') + ':' + R.c + ':' + DPR + ':' + (R.narrow ? 1 : 0);
  if (SIDE.nk === key) return; SIDE.nk = key;
  const k0 = R.narrow ? 0.42 : 0.52, k1 = R.narrow ? 0.36 : 0.44, step = R.c * (R.narrow ? 1.12 : 1.42);
  const cv = $('cvNext'), w = sideW() - 4, h = step * 5 + R.c * 0.25, x = sizeCanvas(cv, w, h);
  x.clearRect(0, 0, cv.width, cv.height);
  list.forEach((t, i) => drawPiece(x, t, w / 2, R.c * k0 * 1.45 + i * step + (i ? R.c * 0.1 : 0), R.c * (i ? k1 : k0)));
}

// ---------- someone else's well, small ----------
function drawMini(cv, snap, m) {
  const w = COLS * m, h = 20 * m, x = sizeCanvas(cv, w, h), s = Math.max(2, Math.round(m * DPR));
  x.clearRect(0, 0, cv.width, cv.height);
  x.fillStyle = 'rgba(14,7,22,.82)'; x.fillRect(0, 0, cv.width, cv.height);
  if (!snap) return;
  const rows = SB.unsnap(snap.b);
  for (let y = 2; y < 22; y++) for (let xx = 0; xx < COLS; xx++) { const v = rows[y][xx]; if (v) putCell(x, v, xx * s, (y - 2) * s, s, 'sleep'); }
  const p = snap.p;
  if (Array.isArray(p) && p[0] >= 1 && p[0] <= 7) {
    for (const [cx, cy] of CELLS[p[0]][p[3] & 3]) { const yy = p[2] + cy - 2; if (yy >= 0 && yy < 20) x.drawImage(A.cellImg(p[0], s), (p[1] + cx) * s, yy * s); }
  }
}

// ---------- the layout: one cell size for everything, picked to fit the screen ----------
function layout() {
  const gm = $('game'); if (gm.hidden) return;
  DPR = Math.min(3, Math.max(1, Math.round(W.devicePixelRatio || 1)));
  const stage = $('stage'), opps = $('opps'), n = opps.children.length;
  const vw = innerWidth, vh = innerHeight;
  R.wide = vw >= 760 && vw / vh >= 1.12;
  gm.classList.toggle('wide', R.wide && n > 0);
  // the small wells: a row above on phones, a column on the right on wide screens
  const minis = () => { opps.style.setProperty('--om', COLS * R.m + 'px'); opps.querySelectorAll('canvas').forEach(cv => { cv.style.width = COLS * R.m + 'px'; cv.style.height = 20 * R.m + 'px'; }); };
  if (!R.wide || !n) {
    opps.style.cssText = '';
    R.m = (n === 1 ? 6 : n === 2 ? 5 : 4) + (vh >= 760 && n > 1 ? 1 : 0) - (vh < 620 ? 1 : 0);
    minis();
  }
  const ktip = !$('ktip').hidden ? 22 : 0;
  let sw, sh, oppW, availW, availH, per, c;
  const fit = () => {
    sw = stage.clientWidth; sh = stage.clientHeight;
    // phones held upright: one narrow column on the right, so the well can be as big as possible
    R.narrow = !R.wide && sw < 640;
    oppW = R.wide && n ? clamp(Math.round(sw * 0.3), 200, 460) : 0;
    availW = sw - (R.narrow ? 10 : 16) - (oppW ? oppW + 24 : 0); availH = sh - 8 - ktip;
    per = R.narrow ? 12.96 : 16.5;
    c = clamp(Math.floor(Math.min(availW / per, availH / 21.8)), 11, R.wide ? 38 : 40);
  };
  fit();
  // a tall screen (a tablet held upright) where the well is already as big as it gets: the room left over goes to the small wells
  if (!R.wide && n) {
    const cardW = (vw - 16 - (n - 1) * 6) / n;
    const dm = Math.min(Math.floor((availH - c * 21.8 - 12) / 20), Math.min(12, Math.floor((cardW - 104) / COLS)) - R.m);
    if (dm > 0) { R.m += dm; minis(); fit(); }
  }
  R.c = c;
  let cols = 1;
  if (R.wide && n) {
    // the other wells to the right, in as many columns as makes them biggest
    const remW = Math.min(560, sw - 16 - c * per - 24), hTop = c * HEAD + 22;
    let best = null;
    for (let k = 1; k <= n; k++) {
      const rows = Math.ceil(n / k);
      const mW = Math.floor(((remW - (k - 1) * 12) / k - 16) / 10);
      const mH = Math.floor((availH - hTop - rows * 62 - (rows - 1) * 12) / (20 * rows));
      const m = Math.min(mW, mH, Math.round(c * 0.62));
      if (!best || m > best.m) best = { k, m };
    }
    cols = best.k; R.m = clamp(best.m, 5, 22);
    oppW = cols * (10 * R.m + 16) + (cols - 1) * 12;
  }
  const play = $('play');
  play.classList.toggle('narrow', R.narrow);
  play.style.setProperty('--c', c + 'px');
  // hold, the numbers and the shiba go to the left column, or under next in the narrow one
  const L = play.querySelector('.side.l'), Rt = play.querySelector('.side.r');
  if (R.narrow) { Rt.prepend($('holdBox')); Rt.append($('stats'), $('pup')); }
  else { L.append($('holdBox'), $('stats'), $('pup')); }
  const playW = c * per;
  const total = playW + (oppW ? 24 + oppW : 0);
  const left = Math.max(R.narrow ? 4 : 8, (sw - total) / 2);
  play.style.left = (left + playW / 2) + 'px';
  play.style.top = Math.max(0, Math.min(14, (availH - c * 21.6) / 2)) + 'px';
  WELL.x = sizeCanvas(WELL.cv, c * 10, c * (20 + HEAD));
  WELL.key = '';
  SIDE.hk = SIDE.nk = '';
  if (R.wide && n) {
    const top = stage.offsetTop + parseFloat(play.style.top) + c * HEAD;
    opps.style.cssText = `left:${left + playW + 24}px;top:${top}px;width:${oppW}px;grid-template-columns:repeat(${cols},${10 * R.m + 16}px)`;
    opps.querySelectorAll('canvas').forEach(cv => { cv.style.width = COLS * R.m + 'px'; cv.style.height = 20 * R.m + 'px'; });
  }
  U.minisDirty = true;
}
addEventListener('resize', () => { layout(); });
