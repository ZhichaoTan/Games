// ===== 快乐柴柴 Shiba Stack · the bots =====
// A bot looks at every way to drop the block it has (and the one it could swap from hold), scores the well each one
// leaves (holes, bumps, deep wells, how high it gets) plus what the clear is worth, and plays the best. Better bots look
// one block further ahead, keep a column open for four-row clears, and play faster. The well is kept as one 10-bit
// number per row, which keeps all of this quick enough to run three bots on a phone.
(function (G) {
  'use strict';
  const SB = G.SB, { W, H, CELLS, SPAWN_X, SPAWN_Y } = SB;
  const FULL = (1 << W) - 1;
  // think: ms per block; noise: how loosely it judges; slip: chance of a careless drop; quad: keeps a column open for four-row clears
  const LV = [null,
    { ms: 1500, noise: 0.1, slip: 0.12, margin: 20, hold: false, look: false, quad: false },
    { ms: 900, noise: 0.06, slip: 0.05, margin: 15, hold: true, look: false, quad: false },
    { ms: 560, noise: 0.03, slip: 0, hold: true, look: true, quad: true },
    { ms: 330, noise: 0, slip: 0, hold: true, look: true, quad: true },
  ];
  // the cells of each block and turn as row masks: [dy, bits at x = 0], and the x range that keeps every cell inside
  const SHAPE = CELLS.map((rs, t) => rs && rs.map(cs => {
    const rows = new Map();
    let lo = 9, hi = 0;
    for (const [cx, cy] of cs) { rows.set(cy, (rows.get(cy) || 0) | (1 << cx)); lo = Math.min(lo, cx); hi = Math.max(hi, cx); }
    return { rows: [...rows.entries()].sort((a, b) => a[0] - b[0]), xmin: -lo, xmax: W - 1 - hi, bottom: Math.max(...cs.map(c => c[1])) };
  }));
  const sh = (m, x) => (x >= 0 ? m << x : m >> -x);
  const TURNS = [null, [0, 1], [0], [0, 1, 2, 3], [0, 1], [0, 1], [0, 1, 2, 3], [0, 1, 2, 3]];   // I, S and Z look the same after two turns
  function rowsOf(board) {
    const R = new Uint16Array(H);
    for (let y = 0; y < H; y++) { let m = 0; for (let x = 0; x < W; x++) if (board[y * W + x]) m |= 1 << x; R[y] = m; }
    return R;
  }
  function hits(R, s, x, y) {
    for (const [dy, m] of s.rows) { const yy = y + dy; if (yy >= H) return true; if (yy >= 0 && (R[yy] & sh(m, x))) return true; }
    return false;
  }
  // every place a block can be dropped from the top: turn it, slide it, drop it
  function drops(R, t) {
    const out = [];
    for (const r of TURNS[t]) {
      const s = SHAPE[t][r], y0 = SPAWN_Y + 1;
      if (hits(R, s, SPAWN_X[t], y0)) { if (hits(R, s, SPAWN_X[t], y0 - 1)) continue; }
      const top = hits(R, s, SPAWN_X[t], y0) ? y0 - 1 : y0;
      for (const dir of [-1, 1]) {
        for (let x = SPAWN_X[t] + (dir > 0 ? 1 : 0); x >= s.xmin && x <= s.xmax; x += dir) {
          if (hits(R, s, x, top)) break;
          let y = top; while (!hits(R, s, x, y + 1)) y++;
          out.push({ t, r, x, y });
        }
      }
    }
    return out;
  }
  // drop it: the new well (rows cleared) and what it made
  function place(R, d) {
    const s = SHAPE[d.t][d.r], N = R.slice();
    let lh = 0;
    for (const [dy, m] of s.rows) { const yy = d.y + dy; if (yy >= 0) N[yy] |= sh(m, d.x); lh += H - yy; }
    lh /= s.rows.length;
    let n = 0;
    for (let y = H - 1; y >= 0; y--) if (N[y] === FULL) n++;
    if (n) {
      let w = H - 1;
      for (let y = H - 1; y >= 0; y--) if (N[y] !== FULL) N[w--] = N[y];
      while (w >= 0) N[w--] = 0;
    }
    let pc = false;
    if (n) { pc = true; for (let y = 0; y < H; y++) if (N[y]) { pc = false; break; } }
    return { N, n, lh, pc };
  }
  const hgt = new Int32Array(W);
  // how good a well is (higher is better)
  function judge(N, o) {
    let holes = 0, covered = 0, rowT = 0, colT = 0, wells = 0, maxH = 0, agg = 0;
    for (let x = 0; x < W; x++) {
      let h = 0, seen = 0, prev = 1, above = 0;
      for (let y = H - 1; y >= 0; y--) {
        const f = (N[y] >> x) & 1;
        if (f !== prev) colT++;
        prev = f;
      }
      for (let y = 0; y < H; y++) {
        const f = (N[y] >> x) & 1;
        if (f) { if (!seen) { seen = 1; h = H - y; } above++; }
        else if (seen) { holes++; covered += Math.min(above, 4); }
      }
      hgt[x] = h; agg += h; if (h > maxH) maxH = h;
    }
    let top = H - maxH;
    const wellBit = o.quad ? 1 << (W - 1) : 0;   // the open column doesn't count as a gap in its row
    for (let y = Math.max(0, top - 1); y < H; y++) {
      const row = N[y] | wellBit;
      let prev = 1;
      for (let x = 0; x < W; x++) { const f = (row >> x) & 1; if (f !== prev) rowT++; prev = f; }
      if (!prev) rowT++;
    }
    const wellCol = o.quad ? W - 1 : -1;
    let bump = 0;
    for (let x = 0; x < W; x++) {
      if (x === wellCol) continue;
      const l = x === 0 ? 99 : hgt[x - 1], r = x === W - 1 ? 99 : hgt[x + 1];
      const d = Math.min(l, r) - hgt[x];
      if (d > 0) wells += (d * (d + 1)) / 2;
      if (x < W - 1 && x + 1 !== wellCol) bump += Math.abs(hgt[x] - hgt[x + 1]);
    }
    const danger = maxH + (o.pending || 0);
    let v = -3.22 * rowT - 9.35 * colT - 7.9 * holes - 1.6 * covered - 3.39 * wells - 0.6 * bump;
    if (o.quad) {
      // rows that are full but for the open column: four of them make a four-row clear
      let ready = 0;
      for (let y = H - 1; y >= top && ready < 4; y--) if ((N[y] | wellBit) === FULL && !(N[y] & wellBit)) ready++; else break;
      v += 1.6 * ready - 3.5 * hgt[W - 1] - 0.12 * agg;
    }
    if (danger > 9) v -= 1.4 * (danger - 9) * (danger - 9);
    return { v, maxH };
  }
  // what a drop is worth: the well it leaves, how high it landed, and the clear
  function worth(R, d, o) {
    const p = place(R, d);
    const j = judge(p.N, o);
    let v = j.v - 4.5 * p.lh;
    const n = p.n;
    if (n) {
      const safe = o.quad && j.maxH + n + (o.pending || 0) < 12;
      if (safe) v += [0, -16, -11, -2, 28][n];
      else v += 3.4 * n + (n === 4 ? 6 : 0);
      if (o.vs) v += 2.2 * ([0, 0, 1, 2, 4][n] + (n === 4 && o.b2b ? 1 : 0));
      if (p.pc) v += 40;
    }
    return { v, p };
  }
  // pick a drop: { hold, t, r, x, y }
  function plan(g, lv, rand) {
    rand = rand || Math.random;
    const L = LV[lv] || LV[2];
    const c = g.cur; if (!c) return null;
    const R = rowsOf(g.board);
    const o = { quad: L.quad, vs: g.mode === 'versus', pending: g.pendingRows(), b2b: g.b2b };
    const pieces = [{ t: c.t, hold: false, next: g.queue[0] }];
    if (L.hold && !g.holdUsed) {
      const ht = g.holdT || g.queue[0];
      if (ht !== c.t) pieces.push({ t: ht, hold: true, next: g.holdT ? g.queue[0] : g.queue[1] });
    }
    let all = [];
    for (const pc of pieces) for (const d of drops(R, pc.t)) {
      const w = worth(R, d, o);
      all.push({ hold: pc.hold, next: pc.next, t: d.t, r: d.r, x: d.x, y: d.y, v: w.v, p: w.p });
    }
    if (!all.length) return { hold: false, t: c.t, r: c.r, x: c.x, y: c.y, v: -1e9 };
    if (L.noise) for (const a of all) a.v += (rand() - 0.5) * L.noise * (Math.abs(a.v) + 20);
    all.sort((a, b) => b.v - a.v);
    if (L.look) {
      // look one block ahead for the best few
      const top = all.slice(0, 6);
      for (const a of top) {
        let best = -1e9;
        const o2 = Object.assign({}, o, { pending: a.p.n ? Math.max(0, o.pending - [0, 0, 1, 2, 4][a.p.n]) : o.pending, b2b: a.p.n ? a.p.n === 4 : o.b2b });
        for (const d of drops(a.p.N, a.next)) { const w = worth(a.p.N, d, o2); if (w.v > best) best = w.v; }
        const imm = a.v - judge(a.p.N, o).v;   // what the first drop itself was worth, besides the well it left
        a.v2 = imm * 0.5 + (best > -1e9 ? best : a.v);
      }
      top.sort((a, b) => b.v2 - a.v2);
      all = top.concat(all.slice(6));
    }
    let pick = all[0];
    // a careless moment: some other drop that looked nearly as good
    if (L.slip && rand() < L.slip) {
      const base = pick.v2 != null ? pick.v2 : pick.v, near = all.slice(1, 8).filter(a => (a.v2 != null ? a.v2 : a.v) > base - (L.margin || 20));
      if (near.length) pick = near[Math.floor(rand() * near.length)];
    }
    return { hold: pick.hold, t: pick.t, r: pick.r, x: pick.x, y: pick.y, v: pick.v };
  }
  // carry a plan out with real moves (hold, turn, slide, drop); if the well is in the way it drops wherever it got to
  function exec(g, p) {
    if (!g.cur || !p) return false;
    if (p.hold && !g.holdUsed) g.hold();
    if (!g.cur) return false;
    if (g.cur.t === p.t) {
      const dr = (p.r - g.cur.r + 4) % 4;
      if (dr === 1) g.rotate(1); else if (dr === 3) g.rotate(-1); else if (dr === 2) { g.rotate(1); g.rotate(1); }
      let guard = 12;
      while (g.cur.x < p.x && guard-- > 0 && g.right());
      while (g.cur.x > p.x && guard-- > 0 && g.left());
    }
    return g.hardDrop();
  }
  // a bot player: call step(dt) as time passes; it waits its thinking time after each new block, then plays it
  class Bot {
    constructor(g, lv, rand) { this.g = g; this.lv = lv; this.rand = rand || Math.random; this.wait = 0; this.plan = null; this.piece = -1; }
    step(dt) {
      const g = this.g;
      if (!g.started || g.over) return;
      const id = g.stats.pieces * 2 + (g.holdUsed ? 1 : 0);
      if (g.cur && this.piece !== id) {
        this.piece = id;
        const L = LV[this.lv] || LV[2];
        this.wait = L.ms * (0.75 + this.rand() * 0.5);
        this.plan = null;
      }
      g.tick(dt);
      if (!g.cur || g.over) return;
      this.wait -= dt;
      // with the block about to lock (very fast falling), it plays at once
      if (this.wait <= 0 || g.lockT > 250) {
        if (!this.plan) this.plan = plan(g, this.lv, this.rand);
        exec(g, this.plan);
        this.plan = null;
      }
    }
  }
  G.SBAI = { LV, plan, exec, Bot, rowsOf, drops, place, judge };
})(typeof window !== 'undefined' ? window : globalThis);
