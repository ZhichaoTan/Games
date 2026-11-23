// ===== 快乐柴柴 Shiba Stack · the rules =====
// The well is 10 wide and 40 tall; the bottom 20 rows are what you see. Seven kinds of block fall one at a time from a
// shuffled bag of all seven. Rotation follows the usual kick tables, a block locks half a second after it lands (moving or
// turning it on the ground buys time, up to 15 times), full rows clear, and in a battle every clear of three rows or more
// at once sends "bubble rows" to an opponent. Everything here is plain data and numbers, so it runs the same in a
// browser, on the host for the bots, and in node for the tests.
(function (G) {
  'use strict';
  const W = 10, H = 40, VIS = 20, TOP = H - VIS;    // TOP: the first row you can see
  const BUB = 8, FACE = 16;                          // cell values: 1..7 a block's colour, 8 a bubble row; +16 marks a block's face
  const LOCK_MS = 500, MAX_RESETS = 15, CLEAR_MS = 260, BUBBLE_MS = 600, BUBBLE_CAP = 8, SOFT_MS = 32;
  // the seven blocks in their starting turn, as [x, y] cells in an n×n box (y grows downwards). face: the cell with the face on it.
  //            1 I         2 O         3 T         4 S         5 Z         6 J         7 L
  const SHAPES = [null,
    { n: 4, c: [[0, 1], [1, 1], [2, 1], [3, 1]], face: 1 },
    { n: 2, c: [[0, 0], [1, 0], [0, 1], [1, 1]], face: 1 },
    { n: 3, c: [[1, 0], [0, 1], [1, 1], [2, 1]], face: 0 },
    { n: 3, c: [[1, 0], [2, 0], [0, 1], [1, 1]], face: 1 },
    { n: 3, c: [[0, 0], [1, 0], [1, 1], [2, 1]], face: 0 },
    { n: 3, c: [[0, 0], [0, 1], [1, 1], [2, 1]], face: 0 },
    { n: 3, c: [[2, 0], [0, 1], [1, 1], [2, 1]], face: 0 },
  ];
  // CELLS[t][r]: the cells after r quarter turns clockwise, (x, y) -> (n-1-y, x)
  const CELLS = SHAPES.map(s => {
    if (!s) return null;
    const out = [s.c];
    for (let r = 1; r < 4; r++) out.push(out[r - 1].map(([x, y]) => [s.n - 1 - y, x]));
    return out;
  });
  const SPAWN_X = [0, 3, 4, 3, 3, 3, 3, 3], SPAWN_Y = 18;
  // kick tests for each turn, written with y pointing up as they usually are and flipped below
  const K3 = { '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]] };
  const K4 = { '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]] };
  const flip = K => { const o = {}; for (const k in K) o[k] = K[k].map(([x, y]) => [x, -y]); return o; };
  const KICKS3 = flip(K3), KICKS4 = flip(K4);
  // points for a clear (times the level), and rows sent in a battle: only a clear of three rows or more at once sends any
  const PTS = { none: [0, 100, 300, 500, 800], mini: [100, 200, 400, 400, 400], full: [400, 800, 1200, 1600, 1600] };
  const PC_PTS = [0, 800, 1200, 1800, 2000];
  const SEND = { none: [0, 0, 0, 2, 4], mini: [0, 0, 0, 2, 4], full: [0, 0, 0, 6, 6] };
  const MIN_SEND = 3, PC_SEND = 10;
  // rows a clear of n rows sends: 2 for three rows, 4 for four, 6 for a T-Twist triple, one more back-to-back, 10 for an
  // all clear; one or two rows send nothing (and so cancel nothing)
  function sendOf(n, ts, btb, pc) {
    if (n < MIN_SEND) return 0;
    const a = SEND[ts || 'none'][n] + (btb ? 1 : 0);
    return pc ? Math.max(a, PC_SEND) : a;
  }
  // seconds a block takes to fall one row at each level
  const fallSec = L => Math.pow(Math.max(0.01, 0.8 - (L - 1) * 0.007), L - 1);
  const MODES = { marathon: 1, sprint: 1, ultra: 1, versus: 1 };
  const SPRINT_LINES = 40, ULTRA_MS = 120000, VS_STEP_MS = 30000, VS_MAX_LV = 15, MAX_LV = 20;

  // a small seeded random number generator (mulberry32) whose state is one number, so a game can be saved and restored
  function rnd(st) {
    let a = (st.s = (st.s + 0x6D2B79F5) | 0);
    a = Math.imul(a ^ (a >>> 15), 1 | a);
    a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  }

  class Game {
    constructor(o) {
      o = o || {};
      this.mode = MODES[o.mode] ? o.mode : 'marathon';
      this.seed = (o.seed >>> 0) || 1;
      this.bag = { s: this.seed | 0 };
      this.gr = { s: ((o.gseed != null ? o.gseed : this.seed * 7 + 3) >>> 0) | 0 };    // where the gaps in bubble rows go
      this.board = new Uint8Array(W * H);
      this.queue = [];
      this.cur = null;
      this.holdT = 0; this.holdUsed = false;
      this.startLevel = Math.max(1, Math.min(15, o.level | 0 || 1));
      this.level = this.mode === 'versus' ? 1 : this.mode === 'marathon' ? this.startLevel : 1;
      this.lines = 0; this.score = 0; this.combo = -1; this.b2b = false;
      this.time = 0; this.started = false; this.over = false; this.why = ''; this.won = false;
      this.grav = 0; this.lockT = 0; this.resets = 0; this.lowest = 0; this.soft = false;
      this.lastRot = false; this.lastKick = 0;
      this.clearing = null;
      this.pending = [];
      this.stats = { pieces: 0, sent: 0, recv: 0, cancel: 0, quads: 0, tspins: 0, pcs: 0, maxCombo: 0, b2bs: 0, clears: 0 };
      this.ev = [];
      this.fill();
    }
    emit(e) { this.ev.push(e); if (this.ev.length > 400) this.ev.splice(0, this.ev.length - 400); }
    fill() {
      while (this.queue.length < 8) {
        const b = [1, 2, 3, 4, 5, 6, 7];
        for (let i = 6; i > 0; i--) { const j = Math.floor(rnd(this.bag) * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; }
        this.queue.push(...b);
      }
    }
    start() { if (this.started) return; this.started = true; this.spawn(0); }
    // ---- geometry ----
    collide(t, x, y, r) {
      const cs = CELLS[t][r], b = this.board;
      for (let i = 0; i < 4; i++) {
        const cx = x + cs[i][0], cy = y + cs[i][1];
        if (cx < 0 || cx >= W || cy >= H) return true;
        if (cy >= 0 && b[cy * W + cx]) return true;
      }
      return false;
    }
    fits(x, y, r) { return !this.collide(this.cur.t, x, y, r); }
    grounded() { const c = this.cur; return !!c && this.collide(c.t, c.x, c.y + 1, c.r); }
    ghostY() { const c = this.cur; if (!c) return 0; let y = c.y; while (!this.collide(c.t, c.x, y + 1, c.r)) y++; return y; }
    // ---- a new block at the top ----
    spawn(t) {
      if (!t) { t = this.queue.shift(); this.fill(); }
      const c = { t, x: SPAWN_X[t], y: SPAWN_Y, r: 0 };
      this.cur = c;
      if (this.collide(t, c.x, c.y, 0)) { this.cur = null; this.end('blockout'); return false; }
      if (!this.collide(t, c.x, c.y + 1, 0)) c.y++;
      this.lowest = c.y; this.lockT = 0; this.resets = 0; this.grav = 0; this.lastRot = false; this.lastKick = 0;
      this.emit({ k: 'spawn', t });
      return true;
    }
    // ---- what a player can do ----
    moved() {   // after a successful shift or turn: on the ground that buys time, up to 15 times
      const c = this.cur;
      if (c.y > this.lowest) { this.lowest = c.y; this.resets = 0; }
      if (this.lockT > 0 || this.grounded()) { if (this.resets < MAX_RESETS) this.lockT = 0; this.resets++; }
    }
    shift(dx) {
      const c = this.cur;
      if (!c || this.over || this.clearing) return false;
      if (this.collide(c.t, c.x + dx, c.y, c.r)) return false;
      c.x += dx; this.lastRot = false; this.moved();
      this.emit({ k: 'move', d: dx });
      return true;
    }
    left() { return this.shift(-1); }
    right() { return this.shift(1); }
    // slide all the way to a wall (for "move to the wall at once" settings and the bots)
    slide(dx) { let n = 0; while (this.shift(dx)) n++; return n; }
    down() {   // one row down by hand (a soft drop step); 1 point a row
      const c = this.cur;
      if (!c || this.over || this.clearing) return false;
      if (this.collide(c.t, c.x, c.y + 1, c.r)) return false;
      c.y++; this.lastRot = false; this.score += 1;
      if (c.y > this.lowest) { this.lowest = c.y; this.resets = 0; }
      this.grav = 0;
      return true;
    }
    setSoft(on) { this.soft = !!on; }
    rotate(dir) {
      const c = this.cur;
      if (!c || this.over || this.clearing) return false;
      const to = (c.r + (dir > 0 ? 1 : 3)) % 4;
      if (c.t === 2) { c.r = to; this.lastRot = false; this.emit({ k: 'rot', d: dir, kick: 0 }); return true; }   // the square only turns its face
      const tests = (c.t === 1 ? KICKS4 : KICKS3)[c.r + '>' + to];
      for (let i = 0; i < tests.length; i++) {
        const [dx, dy] = tests[i];
        if (!this.collide(c.t, c.x + dx, c.y + dy, to)) {
          c.x += dx; c.y += dy; c.r = to; this.lastRot = true; this.lastKick = i;
          this.moved();
          this.emit({ k: 'rot', d: dir, kick: i });
          return true;
        }
      }
      return false;
    }
    hardDrop() {
      const c = this.cur;
      if (!c || this.over || this.clearing) return false;
      const y0 = c.y, y = this.ghostY();
      if (y > y0) this.lastRot = false;
      c.y = y; this.score += 2 * (y - y0);
      this.emit({ k: 'drop', t: c.t, x: c.x, r: c.r, from: y0, to: y });
      this.lock(true);
      return true;
    }
    hold() {
      const c = this.cur;
      if (!c || this.holdUsed || this.over || this.clearing) return false;
      const h = this.holdT;
      this.holdT = c.t; this.holdUsed = true; this.cur = null;
      this.emit({ k: 'hold', t: c.t });
      this.spawn(h);
      return true;
    }
    // ---- time passing: falling, locking, clearing, bubble rows getting ready ----
    gravityLevel() { return this.level; }
    tick(dt) {
      if (!this.started || this.over) return;
      dt = Math.max(0, +dt || 0);
      this.time += dt;
      for (const p of this.pending) if (p.t > 0) p.t = Math.max(0, p.t - dt);
      if (this.mode === 'versus') {
        const L = Math.min(VS_MAX_LV, 1 + Math.floor(this.time / VS_STEP_MS));
        if (L !== this.level) { this.level = L; this.emit({ k: 'level', L }); }
      }
      if (this.mode === 'ultra' && this.time >= ULTRA_MS) { this.time = ULTRA_MS; this.end('time', true); return; }
      if (this.clearing) {
        this.clearing.t -= dt;
        if (this.clearing.t > 0) return;
        this.finishClear();
        if (this.over) return;
      }
      if (!this.cur) { if (!this.spawn(0)) return; }
      const c = this.cur;
      const ms = fallSec(this.gravityLevel()) * 1000;
      const rate = this.soft ? Math.max(1 / ms, 1 / SOFT_MS) : 1 / ms;
      this.grav += dt * rate;
      while (this.grav >= 1) {
        this.grav -= 1;
        if (this.collide(c.t, c.x, c.y + 1, c.r)) { this.grav = 0; break; }
        c.y++; this.lastRot = false;
        if (this.soft) this.score += 1;
        if (c.y > this.lowest) { this.lowest = c.y; this.resets = 0; }
      }
      if (this.grounded()) {
        this.lockT += dt;
        if (this.lockT >= LOCK_MS) this.lock(false);
      } else this.lockT = 0;
    }
    // ---- a block comes to rest ----
    tspin() {
      const c = this.cur;
      if (c.t !== 3 || !this.lastRot) return null;
      const cx = c.x + 1, cy = c.y + 1, b = this.board;
      const occ = (x, y) => x < 0 || x >= W || y >= H || (y >= 0 && b[y * W + x] !== 0);
      const k = [occ(cx - 1, cy - 1), occ(cx + 1, cy - 1), occ(cx + 1, cy + 1), occ(cx - 1, cy + 1)];   // top-left, top-right, bottom-right, bottom-left
      if (k.filter(Boolean).length < 3) return null;
      const F = [[0, 1], [1, 2], [2, 3], [3, 0]][c.r];   // the two corners on the side the T points to
      if ((k[F[0]] && k[F[1]]) || this.lastKick === 4) return 'full';
      return 'mini';
    }
    lock(hard) {
      const c = this.cur, b = this.board, cs = CELLS[c.t][c.r], face = SHAPES[c.t].face;
      const ts = this.tspin();
      let above = true;
      const cells = [];
      for (let i = 0; i < 4; i++) {
        const x = c.x + cs[i][0], y = c.y + cs[i][1];
        if (y >= 0) b[y * W + x] = c.t | (i === face ? FACE : 0);
        if (y >= TOP) above = false;
        cells.push([x, y]);
      }
      this.cur = null; this.holdUsed = false; this.lockT = 0;
      this.stats.pieces++;
      const rows = [];
      for (const y of [...new Set(cells.map(q => q[1]))].sort((a, b2) => a - b2)) {
        if (y < 0) continue;
        let full = true;
        for (let x = 0; x < W; x++) if (!b[y * W + x]) { full = false; break; }
        if (full) rows.push(y);
      }
      const n = rows.length;
      this.emit({ k: 'lock', t: c.t, x: c.x, y: c.y, r: c.r, cells, hard: !!hard, ts, n });
      if (n) this.cleared(rows, ts);
      else {
        if (ts) { this.score += PTS[ts][0] * this.level; this.stats.tspins++; this.emit({ k: 'tspin0', ts }); }
        this.combo = -1;
        this.letBubblesIn();
      }
      if (this.over) return;
      if (above && !n) { this.end('lockout'); return; }
      if (!n) this.spawn(0);
    }
    cleared(rows, ts) {
      const b = this.board, n = rows.length, L = this.level;
      let filled = 0;
      for (let i = 0; i < W * H; i++) if (b[i]) filled++;
      const pc = filled === n * W;
      const hard = n === 4 || !!ts;
      const btb = hard && this.b2b;
      this.combo++;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      this.stats.clears++;
      if (n === 4) this.stats.quads++;
      if (ts) this.stats.tspins++;
      if (btb) this.stats.b2bs++;
      // points
      let pts = PTS[ts || 'none'][n] * L;
      if (btb) pts = Math.floor(pts * 1.5);
      if (this.combo > 0) pts += 50 * this.combo * L;
      if (pc) { pts += (btb && n === 4 ? 3200 : PC_PTS[n]) * L; this.stats.pcs++; }
      this.score += pts;
      // rows to send in a battle; they cancel bubble rows waiting to come in first
      const atk = sendOf(n, ts, btb, pc);
      let left = atk;
      while (left > 0 && this.pending.length) {
        const p = this.pending[0], k = Math.min(p.n, left);
        p.n -= k; left -= k;
        if (!p.n) this.pending.shift();
      }
      const cancel = atk - left;
      this.stats.cancel += cancel;
      if (this.mode === 'versus') this.stats.sent += left;
      this.b2b = hard ? true : false;
      this.lines += n;
      this.clearing = { rows, t: CLEAR_MS };
      this.emit({ k: 'clear', rows: rows.slice(), n, ts, combo: this.combo, b2b: btb, pc, pts, atk, send: left, cancel });
      if (this.mode === 'marathon') {
        const L2 = Math.min(MAX_LV, this.startLevel + Math.floor(this.lines / 10));
        if (L2 !== this.level) { this.level = L2; this.emit({ k: 'level', L: L2 }); }
      }
      if (this.mode === 'sprint' && this.lines >= SPRINT_LINES) { this.finishClear(); this.end('done', true); }
    }
    finishClear() {
      const cl = this.clearing; if (!cl) return;
      this.clearing = null;
      const b = this.board, keep = [];
      const gone = new Set(cl.rows);
      for (let y = 0; y < H; y++) if (!gone.has(y)) keep.push(b.subarray(y * W, y * W + W).slice());
      b.fill(0);
      const off = H - keep.length;
      keep.forEach((row, i) => b.set(row, (i + off) * W));
      this.emit({ k: 'collapse', rows: cl.rows });
    }
    // ---- bubble rows (a battle's attacks) ----
    addBubbles(n, col) {
      n = Math.max(0, Math.min(20, n | 0)); if (!n || this.over) return;
      if (col == null || col < 0 || col >= W) col = Math.floor(rnd(this.gr) * W);
      this.pending.push({ n, col, t: BUBBLE_MS });
      this.stats.recv += n;
      this.emit({ k: 'incoming', n });
    }
    pendingRows() { let s = 0; for (const p of this.pending) s += p.n; return s; }
    readyRows() { let s = 0; for (const p of this.pending) if (p.t <= 0) s += p.n; return s; }
    letBubblesIn() {
      let cap = BUBBLE_CAP, total = 0;
      while (cap > 0 && this.pending.length && this.pending[0].t <= 0) {
        const p = this.pending[0], k = Math.min(p.n, cap);
        if (!this.raise(k, p.col)) { this.end('bubbles'); return; }
        p.n -= k; cap -= k; total += k;
        if (!p.n) this.pending.shift();
      }
      if (total) this.emit({ k: 'bubbles', n: total });
    }
    raise(k, col) {   // push the stack up k rows and fill the bottom with bubble rows; false if something goes over the very top
      const b = this.board;
      for (let i = 0; i < k * W; i++) if (b[i]) return false;
      b.copyWithin(0, k * W);
      for (let y = H - k; y < H; y++) for (let x = 0; x < W; x++) b[y * W + x] = x === col ? 0 : BUB;
      return true;
    }
    end(why, won) {
      if (this.over) return;
      this.over = true; this.why = why; this.won = !!won;
      this.emit({ k: 'over', why, won: !!won });
    }
    // ---- for the screen and the network ----
    // the top of the stack in visible rows (0 = empty, 20 = full to the top)
    height() {
      const b = this.board;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (b[y * W + x]) return H - y;
      return 0;
    }
    // a compact picture of the well for the other players' screens: the 22 rows from 2 above the top, one character each
    // (base 32, so the faces come along: 0 empty, 1..8 a colour, +16 a face)
    snap() {
      let s = '';
      const b = this.board;
      for (let y = TOP - 2; y < H; y++) for (let x = 0; x < W; x++) s += b[y * W + x].toString(32);
      const c = this.cur;
      return { b: s, p: c ? [c.t, c.x, c.y - (TOP - 2), c.r] : 0, h: this.holdT, q: this.pendingRows(), n: this.stats.pieces, l: this.lines, a: this.stats.sent, lv: this.level, sc: this.score };
    }
    toJSON() {
      return { v: 1, mode: this.mode, seed: this.seed, bag: this.bag.s, gr: this.gr.s, board: Array.from(this.board).map(x => x.toString(36)).join(''),
        queue: this.queue.slice(), cur: this.cur && Object.assign({}, this.cur), holdT: this.holdT, holdUsed: this.holdUsed,
        startLevel: this.startLevel, level: this.level, lines: this.lines, score: this.score, combo: this.combo, b2b: this.b2b,
        time: this.time, started: this.started, over: this.over, why: this.why, won: this.won, lockT: this.lockT, resets: this.resets, lowest: this.lowest,
        lastRot: this.lastRot, lastKick: this.lastKick, clearing: this.clearing && { rows: this.clearing.rows.slice(), t: this.clearing.t },
        pending: this.pending.map(p => Object.assign({}, p)), stats: Object.assign({}, this.stats) };
    }
    static fromJSON(j) {
      if (!j || j.v !== 1 || typeof j.board !== 'string' || j.board.length !== W * H) throw new Error('bad save');
      const g = new Game({ mode: j.mode, seed: j.seed, level: j.startLevel });
      g.bag.s = j.bag | 0; g.gr.s = j.gr | 0;
      for (let i = 0; i < W * H; i++) { const v = parseInt(j.board[i], 36); g.board[i] = v >= 0 && v < 32 ? v : 0; }
      g.queue = (j.queue || []).filter(t => t >= 1 && t <= 7); g.fill();
      if (j.cur && j.cur.t >= 1 && j.cur.t <= 7) g.cur = { t: j.cur.t, x: j.cur.x | 0, y: j.cur.y | 0, r: (j.cur.r | 0) & 3 };
      for (const k of ['holdT', 'level', 'lines', 'score', 'combo', 'time', 'lockT', 'resets', 'lowest', 'lastKick']) if (typeof j[k] === 'number') g[k] = j[k];
      for (const k of ['holdUsed', 'b2b', 'started', 'over', 'won', 'lastRot']) g[k] = !!j[k];
      g.why = String(j.why || '');
      if (j.clearing && Array.isArray(j.clearing.rows)) g.clearing = { rows: j.clearing.rows.map(y => y | 0), t: +j.clearing.t || 0 };
      g.pending = Array.isArray(j.pending) ? j.pending.map(p => ({ n: p.n | 0, col: p.col | 0, t: +p.t || 0 })).filter(p => p.n > 0) : [];
      Object.assign(g.stats, j.stats || {});
      if (g.cur && g.collide(g.cur.t, g.cur.x, g.cur.y, g.cur.r)) g.cur = null;
      return g;
    }
  }
  // read a picture made by snap() back into rows of cell values (for drawing someone else's well)
  function unsnap(s) {
    const rows = [];
    if (typeof s !== 'string') s = '';
    for (let y = 0; y < VIS + 2; y++) {
      const r = [];
      for (let x = 0; x < W; x++) { const v = parseInt(s[y * W + x], 32); r.push(v >= 1 && (v & 15) >= 1 && (v & 15) <= 8 && v < 32 ? v : 0); }
      rows.push(r);
    }
    return rows;
  }
  G.SB = { W, H, VIS, TOP, BUB, FACE, SHAPES, CELLS, SPAWN_X, SPAWN_Y, KICKS3, KICKS4, PTS, SEND, MIN_SEND, PC_SEND, sendOf, LOCK_MS, CLEAR_MS, BUBBLE_MS, BUBBLE_CAP,
    SPRINT_LINES, ULTRA_MS, VS_STEP_MS, MAX_LV, fallSec, rnd, Game, unsnap };
})(typeof window !== 'undefined' ? window : globalThis);
