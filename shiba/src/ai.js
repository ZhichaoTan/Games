// ===== 快乐柴柴 Shiba Stack · the bots =====
// A bot looks at every way to drop the block it has (and the one it could swap from hold), scores the well each one
// leaves (holes, bumps, deep wells, how high it gets) plus what the clear is worth, and plays the best. Better bots build
// higher for four-row clears, slip less, look one block further ahead and play faster. A bot whose block lands before it
// has finished thinking (late in a battle, when blocks fall fast) plays more carelessly, as a person would. The well is
// kept as one 10-bit number per row, which keeps all of this quick enough to run three bots on a phone.
(function (G) {
  'use strict';
  const SB = G.SB, { W, H, CELLS, SPAWN_X, SPAWN_Y } = SB;
  const FULL = (1 << W) - 1;
  // think: ms per block; noise: how loosely it judges; slip: chance of a careless drop (one of the drops within margin of the
  // best); quad: keeps a column open for four-row clears while the stack is under `build` rows (a low build cashes in early,
  // with three-row clears); look: looks one block ahead. Tuned in tests/sim.js against person-like players: a casual player
  // beats Rookie most of the time, has an even game with Regular and a hard one with Pro, and Master is for strong players.
  const LV = [null,
    { ms: 3000, noise: 0.08, slip: 0.14, margin: 25, hold: false, look: false, quad: true, build: 5 },
    { ms: 2000, noise: 0.07, slip: 0.1, margin: 22, hold: false, look: false, quad: true, build: 8 },
    { ms: 1500, noise: 0.06, slip: 0.08, margin: 20, hold: false, look: false, quad: true, build: 9 },
    { ms: 1100, noise: 0.04, slip: 0.04, margin: 18, hold: false, look: true, quad: true, build: 10 },
  ];
  const RUSH = { noise: 0.1, slip: 0.3, margin: 15 };   // added in full when the block lands the moment it appears
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
      const safe = o.quad && j.maxH + n + (o.pending || 0) < (o.build || 12);
      if (safe) v += [0, -16, -11, -2, 28][n];
      else v += 3.4 * n + (n === 4 ? 6 : 0);
      if (o.vs) v += 2.2 * SB.sendOf(n, null, n === 4 && o.b2b, false);
      if (p.pc) v += 40;
    }
    return { v, p };
  }
  // pick a drop: { hold, t, r, x, y }. rush: 0..1, how much of its thinking time it didn't get
  function plan(g, lv, rand, rush) {
    rand = rand || Math.random;
    const L = LV[lv] || LV[2], k = Math.max(0, Math.min(1, rush || 0));
    const noise = L.noise + k * RUSH.noise, slip = L.slip + k * RUSH.slip, margin = (L.margin || 20) + k * RUSH.margin;
    const c = g.cur; if (!c) return null;
    const R = rowsOf(g.board);
    const o = { quad: L.quad, build: L.build, vs: g.mode === 'versus', pending: g.pendingRows(), b2b: g.b2b };
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
    if (noise) for (const a of all) a.v += (rand() - 0.5) * noise * (Math.abs(a.v) + 20);
    all.sort((a, b) => b.v - a.v);
    if (L.look) {
      // look one block ahead for the best few
      const top = all.slice(0, 6);
      for (const a of top) {
        let best = -1e9;
        const o2 = Object.assign({}, o, { pending: Math.max(0, o.pending - SB.sendOf(a.p.n, null, a.p.n === 4 && o.b2b, a.p.pc)), b2b: a.p.n ? a.p.n === 4 : o.b2b });
        for (const d of drops(a.p.N, a.next)) { const w = worth(a.p.N, d, o2); if (w.v > best) best = w.v; }
        const imm = a.v - judge(a.p.N, o).v;   // what the first drop itself was worth, besides the well it left
        a.v2 = imm * 0.5 + (best > -1e9 ? best : a.v);
      }
      top.sort((a, b) => b.v2 - a.v2);
      all = top.concat(all.slice(6));
    }
    let pick = all[0];
    // a careless moment: some other drop that looked nearly as good
    if (slip && rand() < slip) {
      const base = pick.v2 != null ? pick.v2 : pick.v, near = all.slice(1, 8).filter(a => (a.v2 != null ? a.v2 : a.v) > base - margin);
      if (near.length) pick = near[Math.floor(rand() * near.length)];
    }
    return { hold: pick.hold, t: pick.t, r: pick.r, x: pick.x, y: pick.y, v: pick.v };
  }
  // carry a plan out with real moves (hold, turn, slide, then drop unless drop is false); if the well is in the way it stops
  // wherever it got to
  function exec(g, p, drop) {
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
    return drop === false ? true : g.hardDrop();
  }
  // a bot player: call step(dt) as time passes. For each new block it takes a while to decide (DECIDE of its thinking time),
  // moves the block into place, and drops it when the thinking time is up. If the block lands first (very fast falling), it
  // decides at once, and the less time it had the more loosely it plays.
  const DECIDE = 0.6;
  class Bot {
    constructor(g, lv, rand) { this.g = g; this.lv = lv; this.rand = rand || Math.random; this.wait = 0; this.think = 1; this.moved = false; this.piece = -1; }
    step(dt) {
      const g = this.g;
      if (!g.started || g.over) return;
      g.tick(dt);
      if (!g.cur || g.over) return;
      if (this.piece !== g.stats.pieces) {   // a new block (after a clear it appears during the tick)
        this.piece = g.stats.pieces;
        const L = LV[this.lv] || LV[2];
        this.wait = this.think = L.ms * (0.75 + this.rand() * 0.5);
        this.moved = false;
      }
      this.wait -= dt;
      const landed = g.lockT > 250, moveAt = this.think * (1 - DECIDE);
      if (!this.moved && (this.wait <= moveAt || landed)) {
        exec(g, plan(g, this.lv, this.rand, landed ? (this.wait - moveAt) / (this.think * DECIDE) : 0), false);
        this.moved = true;
      }
      if (this.moved && g.cur && (this.wait <= 0 || landed)) g.hardDrop();
    }
  }
  G.SBAI = { LV, RUSH, DECIDE, plan, exec, Bot, rowsOf, drops, place, judge };
})(typeof window !== 'undefined' ? window : globalThis);
