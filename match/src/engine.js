// ===== 萌宠消消乐 Puffy Pals / 团团圆圆 Mochi Moon · the rules =====
// A board of up to 9×9 cells holds round rice-ball "mochi" in six colours (each colour is a different little animal).
// Swap two neighbours to line up three or more of a colour, or make a 2×2 square. Bigger matches leave a special piece:
//   four in a line      → a rocket that clears its row or its column (a match along a row makes a rocket that fires up and down)
//   an L, T or + shape  → a firecracker that blasts the cells around it
//   a 2×2 square        → a sky lantern that pops its neighbours, then flies to a cell that matters and pops that
//   five in a line      → a firework: swap it with a piece to clear every piece of that colour
// Specials have no colour: tap one, or swap it with a neighbour, to set it off; two specials swapped together make a bigger blast.
// Levels add frost under pieces, bamboo cages over pieces, gift boxes in cells, and gold ingots to bring down to the bottom.
// Everything here is plain data, so it runs the same in the page, on the host for the bots, and in node for the tests.
// Each move is worked out at once; the steps (swap, clears, falls) are written to game.anim for the page to play back, and
// the board counts as busy for as long as that playback takes, so people and bots spend the same time per move.
(function (G) {
  'use strict';
  const NORM = 0, RH = 1, RV = 2, FC = 3, KL = 4, FW = 5, ING = 6;   // piece kinds; RH clears its row, RV its column
  const isSpecial = k => k >= RH && k <= FW;
  const KIND_NAMES = ['norm', 'rh', 'rv', 'fc', 'kl', 'fw', 'ing'];
  // how long each step takes to show (ms)
  const T = { swap: 150, back: 300, ring: 230, fly: 430, rays: 400, conv: 360, tick: 52, land: 110, collect: 420, shuffle: 760, cage: 520, spark: 130, pause: 220 };
  // points: a matched piece, a piece hit by a blast, making each special, each obstacle layer, an ingot brought down
  const PTS = { piece: 20, blast: 30, made: [0, 60, 60, 120, 80, 200, 0], frost: 40, cage: 40, box: 40, ingot: 400, spare: 300 };
  const FC_R = 2;                       // a firecracker hits a 5×5 square without its corners
  const CASCADE_STEP = 0.5;             // each wave of a chain reaction scores half as much again

  // a small seeded random number generator (mulberry32) whose state is one number, so a game can be saved and restored
  function rnd(st) {
    let a = (st.s = (st.s + 0x6D2B79F5) | 0);
    a = Math.imul(a ^ (a >>> 15), 1 | a);
    a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  class Game {
    // o: { mode: 'level'|'time', w, h, colors, seed, moves, time (ms), goals: [...], base: [rows], top: [rows], pre: [rows],
    //      ing (ingots to bring down), ingMax (on the board at once), stars: [s1, s2, s3], rec (record the steps, default true) }
    // base rows: '.' a cell, 'x' no cell, '1' / '2' frost layers.  top rows: '.' nothing, 'c' a cage over the piece,
    // '1'..'3' a gift box with that many layers, 'i' an ingot, 'r' 'v' 'f' 'k' 'w' a rocket (row / column), firecracker,
    // lantern or firework.  pre rows: '0'..'5' this colour here, '.' any.
    constructor(o) {
      o = o || {};
      this.o = o;
      this.mode = o.mode === 'time' ? 'time' : 'level';
      const W = this.W = clamp(o.w | 0 || (o.base ? o.base[0].length : 8), 4, 9);
      const H = this.H = clamp(o.h | 0 || (o.base ? o.base.length : 8), 4, 9);
      const n = W * H;
      this.hole = new Uint8Array(n); this.frost = new Uint8Array(n); this.cage = new Uint8Array(n); this.box = new Uint8Array(n);
      this.pc = new Array(n).fill(null);
      this.ncol = clamp(o.colors | 0 || 6, 3, 6);
      this.seed = (o.seed >>> 0) || 1;
      this.rng = { s: this.seed | 0 };
      this.nextId = 1;
      this.moves = this.mode === 'level' ? Math.max(1, o.moves | 0 || 20) : 0;
      this.used = 0;                               // moves made
      this.timeMs = this.mode === 'time' ? Math.max(10000, o.time | 0 || 90000) : 0;
      this.time = 0;                               // ms played (time mode)
      this.score = 0;
      this.goals = (o.goals || []).map(g => Object.assign({ have: 0 }, g));
      this.ing = { total: o.ing | 0, max: o.ingMax | 0 || 2, spawned: 0, collected: 0, gap: 3 };
      this.stars = Array.isArray(o.stars) ? o.stars.slice(0, 3) : [];
      this.busy = 0; this.started = false; this.over = false; this.won = false; this.why = ''; this.ending = false; this.finaleDone = false;
      this.anim = []; this.ev = []; this.rec = o.rec !== false;
      this.stats = { moves: 0, matches: 0, cleared: 0, made: [0, 0, 0, 0, 0, 0, 0], used: [0, 0, 0, 0, 0, 0, 0], combos: 0, maxWave: 0, shuffles: 0, best: 0, caged: 0 };
      this.lastMove = null;
      this.layout(o);
      this.goalBase();
    }
    // events go to ev for the app's logic, and (when recording) into the steps too, so the page can show each one in its place
    emit(e) { this.ev.push(e); if (this.ev.length > 300) this.ev.splice(0, this.ev.length - 300); if (this.rec) this.anim.push({ t: 'ev', d: 0, e }); }
    r() { return rnd(this.rng); }
    ri(n) { return Math.floor(rnd(this.rng) * n); }
    newPiece(k, c) { return { id: this.nextId++, k, c: k === NORM ? c : -1 }; }

    // ---------- the board's shape and the starting pieces ----------
    layout(o) {
      const W = this.W, H = this.H;
      const row = (rows, y) => (Array.isArray(rows) && typeof rows[y] === 'string' ? rows[y] : '');
      const preset = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, b = row(o.base, y)[x] || '.', t = row(o.top, y)[x] || '.', p = row(o.pre, y)[x] || '.';
        if (b === 'x') { this.hole[i] = 1; continue; }
        if (b === '1' || b === '2') this.frost[i] = +b;
        if (t >= '1' && t <= '3') this.box[i] = +t;
        else if (t === 'c') this.cage[i] = 1;
        if (t === 'i') { this.pc[i] = this.newPiece(ING); this.ing.spawned++; }
        else if ('rvfkw'.includes(t) && t !== '.') this.pc[i] = this.newPiece({ r: RH, v: RV, f: FC, k: KL, w: FW }[t]);
        if (p >= '0' && p <= '5' && !this.box[i] && !this.pc[i]) preset[i] = +p;
      }
      // where new pieces come in (the top cell of each column) and where ingots leave (the bottom of each run of cells)
      this.spawn = []; this.exit = new Uint8Array(W * H);
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) { const i = y * W + x; if (!this.hole[i]) { this.spawn.push(i); break; } }
        for (let y = 0; y < H; y++) { const i = y * W + x; if (!this.hole[i] && (y === H - 1 || this.hole[i + W])) this.exit[i] = 1; }
      }
      this.fill(preset);
    }
    // fill the empty cells with colours that make no match, so the board starts still and has at least one move
    fill(preset) {
      const W = this.W, H = this.H, n = W * H;
      for (let tries = 0; tries < 80; tries++) {
        const empty = [];
        for (let i = 0; i < n; i++) {
          if (this.hole[i] || this.box[i]) continue;
          if (this.pc[i] && this.pc[i].k !== NORM) continue;
          this.pc[i] = null;
          if (preset && preset[i] != null) this.pc[i] = this.newPiece(NORM, preset[i]); else empty.push(i);
        }
        let ok = true;
        for (const i of empty) {
          const opts = [];
          for (let c = 0; c < this.ncol; c++) if (!this.wouldMatch(i, c)) opts.push(c);
          if (!opts.length) { ok = false; break; }
          this.pc[i] = this.newPiece(NORM, opts[this.ri(opts.length)]);
        }
        if (ok && !this.groups().length && this.hasMove()) return;
      }
      // a board this crowded can't be made still: take it as it is (the first move will clear what matches)
    }

    // ---------- looking at the board ----------
    open(i) { return !this.hole[i] && !this.box[i]; }
    movable(i) { const p = this.pc[i]; return !!p && !this.cage[i] && !this.box[i] && !this.hole[i]; }
    colorAt(i) { const p = this.pc[i]; return p && p.k === NORM ? p.c : -1; }
    // would colour c at cell i make a line of three or a 2×2 square with the pieces around it?
    wouldMatch(i, c) {
      const W = this.W, H = this.H, x = i % W, y = (i / W) | 0;
      const same = (xx, yy) => xx >= 0 && xx < W && yy >= 0 && yy < H && this.colorAt(yy * W + xx) === c;
      let a = 0, b = 0;
      while (same(x - a - 1, y)) a++;
      while (same(x + b + 1, y)) b++;
      if (a + b >= 2) return true;
      a = 0; b = 0;
      while (same(x, y - a - 1)) a++;
      while (same(x, y + b + 1)) b++;
      if (a + b >= 2) return true;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (same(x + dx, y) && same(x, y + dy) && same(x + dx, y + dy)) return true;
      return false;
    }
    // does the piece at i (as it stands) make a match?
    matchAt(i) { const c = this.colorAt(i); return c >= 0 && this.wouldMatch(i, c); }
    adj(a, b) { const W = this.W; return a >= 0 && b >= 0 && ((Math.abs(a - b) === 1 && ((a / W) | 0) === ((b / W) | 0)) || Math.abs(a - b) === W); }
    // every move that does something: swaps [a, b] (a < b) and taps [i, -1] on specials
    moveList() {
      const W = this.W, H = this.H, out = [];
      for (let i = 0; i < W * H; i++) {
        if (!this.movable(i)) continue;
        const p = this.pc[i];
        if (isSpecial(p.k)) out.push([i, -1]);
        const x = i % W;
        for (const j of [x + 1 < W ? i + 1 : -1, i + W < W * H ? i + W : -1]) {
          if (j < 0 || !this.movable(j)) continue;
          const q = this.pc[j];
          if (isSpecial(p.k) || isSpecial(q.k)) { out.push([i, j]); continue; }
          if (p.k === NORM && q.k === NORM && p.c === q.c) continue;
          this.pc[i] = q; this.pc[j] = p;
          const ok = this.matchAt(i) || this.matchAt(j);
          this.pc[i] = p; this.pc[j] = q;
          if (ok) out.push([i, j]);
        }
      }
      return out;
    }
    hasMove() {
      const W = this.W, n = W * this.H;
      for (let i = 0; i < n; i++) {
        if (!this.movable(i)) continue;
        const p = this.pc[i];
        if (isSpecial(p.k)) return true;
        const x = i % W;
        for (const j of [x + 1 < W ? i + 1 : -1, i + W < n ? i + W : -1]) {
          if (j < 0 || !this.movable(j)) continue;
          const q = this.pc[j];
          if (isSpecial(q.k)) return true;
          if (p.k === NORM && q.k === NORM && p.c === q.c) continue;
          this.pc[i] = q; this.pc[j] = p;
          const ok = this.matchAt(i) || this.matchAt(j);
          this.pc[i] = p; this.pc[j] = q;
          if (ok) return true;
        }
      }
      return false;
    }
    // all matches on the board, grouped: lines of 3+ and 2×2 squares of one colour that touch become one group
    groups() {
      const W = this.W, H = this.H, n = W * H, runs = [], squares = [];
      for (let y = 0; y < H; y++) {
        let x = 0;
        while (x < W) {
          const c = this.colorAt(y * W + x);
          let e = x + 1;
          if (c >= 0) while (e < W && this.colorAt(y * W + e) === c) e++;
          if (c >= 0 && e - x >= 3) { const cells = []; for (let k = x; k < e; k++) cells.push(y * W + k); runs.push({ d: 'h', cells }); }
          x = e;
        }
      }
      for (let x = 0; x < W; x++) {
        let y = 0;
        while (y < H) {
          const c = this.colorAt(y * W + x);
          let e = y + 1;
          if (c >= 0) while (e < H && this.colorAt(e * W + x) === c) e++;
          if (c >= 0 && e - y >= 3) { const cells = []; for (let k = y; k < e; k++) cells.push(k * W + x); runs.push({ d: 'v', cells }); }
          y = e;
        }
      }
      for (let y = 0; y + 1 < H; y++) for (let x = 0; x + 1 < W; x++) {
        const i = y * W + x, c = this.colorAt(i);
        if (c >= 0 && this.colorAt(i + 1) === c && this.colorAt(i + W) === c && this.colorAt(i + W + 1) === c) squares.push([i, i + 1, i + W, i + W + 1]);
      }
      if (!runs.length && !squares.length) return [];
      // join the pieces that share cells (union-find over cells)
      const par = new Int32Array(n).fill(-1);
      const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
      const add = a => { if (par[a] < 0) par[a] = a; };
      const join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
      for (const r of runs) { r.cells.forEach(add); for (let k = 1; k < r.cells.length; k++) join(r.cells[0], r.cells[k]); }
      for (const s of squares) { s.forEach(add); for (let k = 1; k < 4; k++) join(s[0], s[k]); }
      const by = new Map();
      const get = root => { let g = by.get(root); if (!g) { g = { cells: new Set(), runs: [], squares: [], color: -1 }; by.set(root, g); } return g; };
      for (const r of runs) { const g = get(find(r.cells[0])); g.runs.push(r); r.cells.forEach(c => g.cells.add(c)); }
      for (const s of squares) { const g = get(find(s[0])); g.squares.push(s); s.forEach(c => g.cells.add(c)); }
      const out = [...by.values()];
      for (const g of out) { g.color = this.colorAt([...g.cells][0]); g.kind = this.classify(g); }
      return out;
    }
    // what a match leaves behind
    classify(g) {
      let max = 0, h = false, v = false, four = null;
      for (const r of g.runs) {
        if (r.cells.length > max) max = r.cells.length;
        if (r.d === 'h') h = true; else v = true;
        if (r.cells.length === 4 && !four) four = r;
      }
      if (max >= 5) return FW;
      if (h && v) return FC;
      if (four) return four.d === 'h' ? RV : RH;
      if (g.squares.length) return KL;
      return NORM;
    }
    // where the special appears: on the cell the player moved into if it's part of the match, otherwise in the middle of it
    placeOf(g, moved) {
      const ok = c => c != null && c >= 0 && !this.cage[c];
      if (moved) for (const m of moved) if (g.cells.has(m) && ok(m)) return m;
      if (g.kind === FC) {
        for (const a of g.runs) if (a.d === 'h') for (const b of g.runs) if (b.d === 'v') { const c = a.cells.find(x => b.cells.includes(x)); if (ok(c)) return c; }
      }
      if (g.kind === KL && g.squares.length) { const s = g.squares[0]; if (ok(s[2])) return s[2]; }
      let best = g.runs[0];
      for (const r of g.runs) if (r.cells.length > best.cells.length) best = r;
      if (best) { const L = best.cells.length, c = best.cells[best.d === 'v' ? Math.floor(L / 2) : Math.floor((L - 1) / 2)]; if (ok(c)) return c; }
      const free = [...g.cells].filter(ok).sort((a, b) => b - a);
      return free.length ? free[0] : -1;
    }
    mostColor(skip) {
      const cnt = new Array(6).fill(0);
      for (let i = 0; i < this.pc.length; i++) { const c = this.colorAt(i); if (c >= 0 && !(skip && skip.has(i))) cnt[c]++; }
      let best = -1, bc = 0;
      for (let c = 0; c < 6; c++) if (cnt[c] > bc) { bc = cnt[c]; best = c; }
      return best;
    }

    // ---------- moves ----------
    canAct() { return this.started && !this.over && !this.ending && this.busy <= 0 && !(this.mode === 'level' && this.used >= this.moves); }
    start() { if (this.started) return; this.started = true; if (!this.hasMove()) this.settle(); }
    // swap the piece at a with its neighbour b (a is the one the player dragged). Returns false if nothing happened.
    swap(a, b) {
      if (!this.canAct() || !this.adj(a, b) || !this.movable(a) || !this.movable(b)) return false;
      const pa = this.pc[a], pb = this.pc[b];
      this.pc[a] = pb; this.pc[b] = pa;
      if (isSpecial(pa.k) || isSpecial(pb.k)) {
        this.step({ t: 'swap', a, b, ok: true, d: T.swap });
        this.useMove([a, b]);
        let acts;
        if (isSpecial(pa.k) && isSpecial(pb.k)) acts = [this.combo(b, pa, a, pb)];
        else if (isSpecial(pa.k)) acts = [{ i: b, p: pa, c: pa.k === FW ? (pb.k === NORM ? pb.c : -1) : -1 }];
        else acts = [{ i: a, p: pb, c: pb.k === FW ? (pa.k === NORM ? pa.c : -1) : -1 }];
        this.resolve(acts, null, [b, a]);
        return true;
      }
      const gs = this.groups();
      if (!gs.length) {
        this.pc[a] = pa; this.pc[b] = pb;
        this.step({ t: 'swap', a, b, ok: false, d: T.back });
        this.emit({ k: 'bad', a, b });
        return false;
      }
      this.step({ t: 'swap', a, b, ok: true, d: T.swap });
      this.useMove([a, b]);
      this.resolve([], gs, [b, a]);
      return true;
    }
    // tap a special to set it off where it stands
    tap(i) {
      if (!this.canAct() || !this.movable(i) || !isSpecial(this.pc[i].k)) return false;
      this.useMove([i]);
      this.resolve([{ i, p: this.pc[i], c: -1 }], null, [i]);
      return true;
    }
    // the hammer (one per level attempt): a blow on one cell that doesn't use a move. It breaks a box layer or a cage, sets off
    // a special, or clears a mochi and the frost under it. Not on an empty cell or on a free ingot.
    hammer(i) {
      if (!this.canAct() || !(i >= 0 && i < this.pc.length) || this.hole[i]) return false;
      const p = this.pc[i];
      if (!this.box[i] && !(p && (p.k !== ING || this.cage[i]))) return false;
      this.stats.hammers = (this.stats.hammers || 0) + 1;
      this.emit({ k: 'hammer', i });
      this.resolve([{ i, k: 'one', ham: true }], null, [i]);
      return true;
    }
    useMove(cells) { this.used++; this.stats.moves++; this.lastMove = cells; this.emit({ k: 'move', n: this.used }); }
    // two specials swapped together: one bigger blast at b, the cell the dragged one moved into
    combo(b, pa, a, pb) {
      this.stats.combos++;
      const ks = [pa.k, pb.k].sort((x, y) => x - y), [k1, k2] = ks;
      const rocket = k => k === RH || k === RV;
      let type;
      if (k2 === FW && k1 === FW) type = 'ww';
      else if (k2 === FW) type = 'w' + (rocket(k1) ? 'r' : k1 === FC ? 'f' : 'k');
      else if (k1 === KL && k2 === KL) type = 'kk';
      else if (k2 === KL) type = 'k' + (rocket(k1) ? 'r' : 'f');
      else if (rocket(k1) && rocket(k2)) type = 'rr';
      else if (rocket(k1) && k2 === FC) type = 'rf';
      else type = 'ff';
      const carry = type === 'kr' || type === 'wr' ? (rocket(pa.k) ? pa.k : pb.k) : type === 'kf' || type === 'wf' ? FC : type === 'wk' ? KL : 0;
      this.emit({ k: 'combo', type });
      return { i: b, p: pa, p2: pb, i2: a, combo: type, carry, c: -1 };
    }

    // ---------- working out a move ----------
    // acts: specials going off; gs: match groups; moved: the cells the player moved (for where new specials go)
    resolve(acts, gs, moved) {
      let wave = 0, total = 0;
      const before = this.score;
      while (true) {
        const mult = 1 + CASCADE_STEP * wave;
        let ringActs = acts || [], ringGroups = gs || [], ring = 0;
        while (ringActs.length || ringGroups.length) {
          const ph = { t: 'ring', d: T.ring, wave, ring, hits: [], fx: [], made: [], obs: [], pts: [] };
          const hitNow = new Set(), next = [], made = [];
          for (const g of ringGroups) {
            const k = g.kind, at = k ? this.placeOf(g, wave === 0 ? moved : null) : -1;
            let gain = 0;
            for (const c of g.cells) gain += this.hit(c, 'match', hitNow, next, ph, mult, at === c && k ? 1 : 0);
            // boxes next to a match take a knock
            const near = new Set();
            for (const c of g.cells) for (const j of this.nbrs(c)) if (this.box[j] && !g.cells.has(j)) near.add(j);
            for (const j of near) gain += this.hit(j, 'near', hitNow, next, ph, mult);
            if (k && at >= 0) { made.push([at, k]); gain += this.addPts(PTS.made[k], mult); this.stats.made[k]++; }
            this.stats.matches++;
            ph.pts.push([at >= 0 ? at : this.centerOf(g.cells), gain]);
            total += g.cells.size;
            this.emit({ k: 'match', n: g.cells.size, kind: k, color: g.color, wave });
          }
          for (const a of ringActs) total += this.activate(a, hitNow, next, ph, mult);
          for (const [at, k] of made) { const p = this.newPiece(k); this.pc[at] = p; ph.made.push([at, p]); }
          if (ph.fx.some(f => f.k === 'fly')) ph.d += T.fly;
          if (ph.fx.some(f => f.k === 'rays')) ph.d += T.rays;
          if (ph.fx.some(f => f.k === 'conv')) ph.d += T.conv;
          this.step(ph);
          ringActs = next; ringGroups = []; ring++;
          if (ring > 60) break;
        }
        this.fall();
        while (this.collect()) this.fall();
        gs = this.groups(); acts = null;
        if (!gs.length) break;
        wave++;
        if (wave > 80) break;
      }
      this.stats.cleared += total;
      this.stats.maxWave = Math.max(this.stats.maxWave, wave);
      const gain = this.score - before;
      this.stats.best = Math.max(this.stats.best, gain);
      this.emit({ k: 'done', wave, total, gain });
      this.settle();
      this.checkEnd();
    }
    centerOf(cells) { const a = [...cells].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; }
    nbrs(i) {
      const W = this.W, H = this.H, x = i % W, y = (i / W) | 0, out = [];
      if (x > 0 && !this.hole[i - 1]) out.push(i - 1);
      if (x < W - 1 && !this.hole[i + 1]) out.push(i + 1);
      if (y > 0 && !this.hole[i - W]) out.push(i - W);
      if (y < H - 1 && !this.hole[i + W]) out.push(i + W);
      return out;
    }
    // one hit on a cell: a box loses a layer, a cage breaks, a special goes off next, a piece is cleared, then frost goes down a layer.
    // how: 'match' (part of a match), 'blast' (a special's blast), 'near' (beside a match: only boxes care). Returns the points.
    hit(i, how, hitNow, next, ph, mult, keep) {
      if (i < 0 || i >= this.pc.length || this.hole[i] || hitNow.has(i)) return 0;
      hitNow.add(i);
      let pts = 0;
      if (this.box[i]) {
        this.box[i]--; pts += PTS.box; ph.obs.push([i, this.frost[i], this.cage[i], this.box[i]]);
        if (!this.box[i]) this.goalTick('box');
        return this.addPts(pts, mult);
      }
      if (how === 'near') return 0;
      const p = this.pc[i];
      if (p) {
        if (this.cage[i]) {
          this.cage[i] = 0; pts += PTS.cage; ph.obs.push([i, this.frost[i], 0, 0]); this.goalTick('cage');
          return this.addPts(pts, mult);
        }
        if (p.k === ING) return 0;
        if (isSpecial(p.k)) { if (how === 'blast') next.push({ i, p, c: -1, chain: true }); return 0; }
        this.pc[i] = null;
        ph.hits.push([i, p.id, p.c, keep ? 1 : 0]);
        pts += how === 'match' ? PTS.piece : PTS.blast;
        this.goalCollect(p.c);
      }
      if (this.frost[i]) { this.frost[i]--; pts += PTS.frost; ph.obs.push([i, this.frost[i], this.cage[i], this.box[i]]); if (!this.frost[i]) this.goalTick('frost'); }
      return this.addPts(pts, mult);
    }
    addPts(p, mult) { const v = Math.round(p * mult); this.score += v; return v; }
    // a special goes off. a: { i: cell, p: the piece, c: colour for a firework, combo, carry, chain }
    activate(a, hitNow, next, ph, mult) {
      const W = this.W, H = this.H, i = a.i, x = i % W, y = (i / W) | 0;
      // the special leaves the board as it goes off (if it's still there: two blasts may have set it off)
      if (a.p) {
        if (this.pc[i] !== a.p) { if (!a.combo && !a.fly) return 0; } else this.pc[i] = null;
        if (a.p2 && this.pc[a.i2] === a.p2) this.pc[a.i2] = null;
        if (!a.fly) { ph.hits.push([i, a.p.id, -1, 0]); if (a.p2) ph.hits.push([a.i2, a.p2.id, -1, 0]); }
      }
      const before = this.score;
      let count = 0;
      const H1 = c => { if (c >= 0 && c < W * H && !this.hole[c]) { count++; this.hit(c, 'blast', hitNow, next, ph, mult); } };
      if (a.k === 'one') { if (a.ham) ph.fx.push({ k: 'ham', i }); H1(i); return this.score - before; }   // where a lantern lands, or the hammer
      const k = a.combo ? 0 : (a.p ? a.p.k : a.k);
      if (k > 0) this.stats.used[k]++;
      const rowOf = yy => { if (yy >= 0 && yy < H) for (let xx = 0; xx < W; xx++) H1(yy * W + xx); };
      const colOf = xx => { if (xx >= 0 && xx < W) for (let yy = 0; yy < H; yy++) H1(yy * W + xx); };
      const square = (r, round) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (round && Math.abs(dx) === r && Math.abs(dy) === r) continue; const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H) H1(yy * W + xx); } };
      // its own cell first (frost under it)
      if (!this.pc[i]) this.hit(i, 'blast', hitNow, next, ph, mult);
      if (a.combo) {
        const t = a.combo;
        this.emit({ k: 'special', kind: 'combo', type: t });
        if (t === 'rr') { ph.fx.push({ k: 'row', i }, { k: 'col', i }); rowOf(y); colOf(x); }
        else if (t === 'rf') { ph.fx.push({ k: 'row', i, w: 3 }, { k: 'col', i, w: 3 }); for (let d = -1; d <= 1; d++) { rowOf(y + d); colOf(x + d); } }
        else if (t === 'ff') { ph.fx.push({ k: 'boom', i, r: 3 }); square(3, true); }
        else if (t === 'kk') { ph.fx.push({ k: 'pop', i }); this.plus(i, H1); for (let n = 0; n < 3; n++) this.launch(i, 0, hitNow, next, ph); }
        else if (t === 'kr' || t === 'kf') { ph.fx.push({ k: 'pop', i }); this.plus(i, H1); this.launch(i, a.carry, hitNow, next, ph); }
        else if (t === 'ww') { ph.fx.push({ k: 'flash', i }); for (let c = 0; c < W * H; c++) H1(c); }
        else if (t === 'wr' || t === 'wf' || t === 'wk') {
          const col = this.mostColor(), cells = [];
          for (let c = 0; c < W * H; c++) if (this.colorAt(c) === col && !this.cage[c]) cells.push(c);
          const into = [];
          for (const c of cells) {
            const kk = a.carry === RH || a.carry === RV ? (this.r() < 0.5 ? RH : RV) : a.carry;
            const p = this.newPiece(kk); const old = this.pc[c];
            this.pc[c] = p; into.push([c, p, old ? old.id : 0]);
            next.push({ i: c, p, c: -1, chain: true });
          }
          ph.fx.push({ k: 'conv', i, cells: into });
          this.emit({ k: 'convert', n: into.length, into: a.carry });
        }
        const got = this.score - before;
        if (got > 0) ph.pts.push([i, got]);
        return got;
      }
      this.emit({ k: 'special', kind: KIND_NAMES[k], chain: !!a.chain });
      if (k === RH) { ph.fx.push({ k: 'row', i }); rowOf(y); }
      else if (k === RV) { ph.fx.push({ k: 'col', i }); colOf(x); }
      else if (k === FC) { ph.fx.push({ k: 'boom', i, r: FC_R }); square(FC_R, true); }
      else if (k === KL) { ph.fx.push({ k: 'pop', i }); this.plus(i, H1); this.launch(i, 0, hitNow, next, ph); }
      else if (k === FW) {
        const col = a.c >= 0 ? a.c : this.mostColor();
        const cells = [];
        for (let c = 0; c < W * H; c++) if (this.colorAt(c) === col) cells.push(c);
        ph.fx.push({ k: 'rays', i, cells: cells.slice(), color: col });
        for (const c of cells) H1(c);
      }
      const got = this.score - before;
      if (got > 0) ph.pts.push([i, got]);
      return got;
    }
    plus(i, H1) { H1(i); for (const j of this.nbrs(i)) H1(j); }
    // a sky lantern takes off from i and lands on a cell that matters: it pops that cell (or sets off what it carries there) on the next beat
    launch(i, carry, hitNow, next, ph) {
      const t = this.target(i, hitNow, next);
      if (t < 0) return;
      ph.fx.push({ k: 'fly', i, to: t, carry });
      next.push(carry ? { i: t, k: carry, p: { id: 0, k: carry, c: -1 }, fly: true, c: -1 } : { i: t, k: 'one', fly: true });
    }
    // where a lantern goes: a goal still to do (boxes, cages, frost, a colour to collect, the piece under an ingot), else any piece
    target(from, hitNow, next) {
      const n = this.W * this.H, taken = new Set(next.filter(a => a.fly).map(a => a.i));
      const free = c => c !== from && !taken.has(c) && !hitNow.has(c) && !this.hole[c];
      const pick = list => (list.length ? list[this.ri(list.length)] : -1);
      const want = t => this.goals.some(g => g.t === t && !this.goalDone(g));
      const L = [];
      if (want('box')) { for (let c = 0; c < n; c++) if (this.box[c] && free(c)) L.push(c); if (L.length) return pick(L); }
      if (want('cage') || this.mode === 'time') { for (let c = 0; c < n; c++) if (this.cage[c] && free(c)) L.push(c); if (L.length) return pick(L); }
      if (want('frost')) { for (let c = 0; c < n; c++) if (this.frost[c] && free(c) && !this.box[c]) L.push(c); if (L.length) return pick(L); }
      if (want('ing')) {
        let low = -1;
        for (let c = 0; c < n; c++) if (this.pc[c] && this.pc[c].k === ING && !this.exit[c]) low = c;
        if (low >= 0 && low + this.W < n && free(low + this.W) && this.colorAt(low + this.W) >= 0) return low + this.W;
      }
      const cols = this.goals.filter(g => g.t === 'col' && !this.goalDone(g)).map(g => g.c);
      if (cols.length) { for (let c = 0; c < n; c++) if (cols.includes(this.colorAt(c)) && free(c)) L.push(c); if (L.length) return pick(L); }
      for (let c = 0; c < n; c++) if (this.colorAt(c) >= 0 && free(c)) L.push(c);
      return pick(L);
    }

    // ---------- falling ----------
    // pieces fall a cell per beat; a piece resting on something slides down sideways into a cell nothing can reach from above;
    // the top cell of each column takes a new piece whenever it's empty
    starved(i) {
      const W = this.W;
      for (let k = i - W; k >= 0; k -= W) {
        if (this.hole[k] || this.box[k]) return true;
        const p = this.pc[k];
        if (p) return !!this.cage[k];
        if (this.spawn.includes(k)) return false;
      }
      return !this.spawn.includes(i);
    }
    fall() {
      const W = this.W, H = this.H, n = W * H;
      const movers = new Map();
      const track = (p, from) => { let m = movers.get(p.id); if (!m) { m = { id: p.id, from, path: [] }; movers.set(p.id, m); } return m; };
      let tick = 0;
      for (; tick < 400; tick++) {
        let any = false;
        const movedNow = new Set();
        for (let y = H - 2; y >= 0; y--) for (let x = 0; x < W; x++) {
          const i = y * W + x, p = this.pc[i];
          if (!p || this.cage[i]) continue;
          const j = i + W;
          if (this.open(j) && !this.pc[j]) { this.pc[j] = p; this.pc[i] = null; track(p, i).path.push([tick + 1, j]); movedNow.add(p.id); any = true; }
        }
        const dirs = tick % 2 ? [1, -1] : [-1, 1];
        for (let y = H - 2; y >= 0; y--) for (let x = 0; x < W; x++) {
          const i = y * W + x, p = this.pc[i];
          if (!p || this.cage[i] || movedNow.has(p.id)) continue;
          const below = i + W;
          if (this.open(below) && !this.pc[below]) continue;
          for (const dx of dirs) {
            const nx = x + dx; if (nx < 0 || nx >= W) continue;
            const k = (y + 1) * W + nx;
            if (this.open(k) && !this.pc[k] && this.starved(k)) { this.pc[k] = p; this.pc[i] = null; track(p, i).path.push([tick + 1, k]); movedNow.add(p.id); any = true; break; }
          }
        }
        for (const s of this.spawn) {
          if (!this.open(s) || this.pc[s]) continue;
          const p = this.spawnPiece();
          this.pc[s] = p;
          const m = { id: p.id, from: -1, col: s % W, row: (s / W) | 0, p: { id: p.id, k: p.k, c: p.c }, path: [[tick + 1, s]] };
          movers.set(p.id, m);
          any = true;
        }
        if (!any) break;
      }
      if (movers.size) this.step({ t: 'fall', d: tick * T.tick + T.land, ticks: tick, movers: [...movers.values()] });
      void n;
    }
    // the next piece to drop in: usually a mochi of a random colour; now and then an ingot while the level needs more
    spawnPiece() {
      const ing = this.ing;
      if (ing.total && ing.spawned < ing.total) {
        let on = 0; for (const p of this.pc) if (p && p.k === ING) on++;
        if (on < ing.max && --ing.gap <= 0) { ing.spawned++; ing.gap = 5 + this.ri(5); return this.newPiece(ING); }
      }
      return this.newPiece(NORM, this.ri(this.ncol));
    }
    // ingots that reached the bottom of their column are collected
    collect() {
      const got = [];
      for (let i = 0; i < this.pc.length; i++) {
        const p = this.pc[i];
        if (p && p.k === ING && this.exit[i] && !this.cage[i]) { this.pc[i] = null; got.push([i, p.id]); this.ing.collected++; this.score += PTS.ingot; this.goalTick('ing'); }
      }
      if (got.length) { this.step({ t: 'collect', d: T.collect, got }); this.emit({ k: 'ingot', n: got.length }); }
      return got.length > 0;
    }
    // no move left: shuffle the free pieces until the board is still and has a move
    settle() {
      if (this.hasMove()) return;
      const cells = [];
      for (let i = 0; i < this.pc.length; i++) if (this.movable(i) && this.pc[i].k === NORM) cells.push(i);
      if (cells.length < 3) { this.gift(cells); return; }
      const orig = cells.map(i => this.pc[i]);
      let ok = false;
      for (let t = 0; t < 120 && !ok; t++) {
        const ps = orig.slice();
        for (let k = ps.length - 1; k > 0; k--) { const j = this.ri(k + 1); const tmp = ps[k]; ps[k] = ps[j]; ps[j] = tmp; }
        cells.forEach((c, k) => { this.pc[c] = ps[k]; });
        ok = !this.groups().length && this.hasMove();
      }
      if (!ok) {
        // recolour the free pieces until it works
        for (let t = 0; t < 200 && !ok; t++) {
          cells.forEach(c => { this.pc[c] = null; });
          cells.forEach((c, k) => { const opts = []; for (let cc = 0; cc < this.ncol; cc++) if (!this.wouldMatch(c, cc)) opts.push(cc); const p = orig[k]; p.c = opts.length ? opts[this.ri(opts.length)] : this.ri(this.ncol); this.pc[c] = p; });
          ok = !this.groups().length && this.hasMove();
        }
      }
      const moves = [];
      cells.forEach((c, k) => { const p = this.pc[c]; const from = cells[orig.indexOf(p)]; moves.push([p.id, from, c, p.c]); });
      this.stats.shuffles++;
      this.step({ t: 'shuffle', d: T.shuffle, moves });
      this.emit({ k: 'shuffle' });
      if (!ok) this.gift(cells);
    }
    // the last resort when shuffling can't make a move: one free mochi turns into a lantern
    gift(cells) {
      const free = (cells || []).filter(c => this.movable(c) && this.pc[c].k === NORM);
      if (!free.length) return;
      const c = free[this.ri(free.length)], old = this.pc[c], p = this.newPiece(KL);
      this.pc[c] = p;
      this.step({ t: 'spark', d: T.spark, i: c, p, old: old.id, n: 0, gift: true });
    }
    step(ph) { this.busy += ph.d; if (this.rec) this.anim.push(ph); }

    // ---------- goals ----------
    goalBase() {
      for (const g of this.goals) {
        if (g.t === 'frost') { g.n = 0; for (const f of this.frost) if (f) g.n++; }
        if (g.t === 'box') { g.n = 0; for (const b of this.box) if (b) g.n++; }
        if (g.t === 'cage') { g.n = 0; for (const c of this.cage) if (c) g.n++; }
        if (g.t === 'ing') g.n = g.n || this.ing.total;
      }
    }
    goalTick(t) { for (const g of this.goals) if (g.t === t) g.have++; }
    goalCollect(c) { for (const g of this.goals) if (g.t === 'col' && g.c === c) g.have++; }
    goalDone(g) { if (g.t === 'score') return this.score >= g.n; return g.have >= g.n; }
    goalLeft(g) { if (g.t === 'score') return Math.max(0, g.n - this.score); return Math.max(0, g.n - g.have); }
    allDone() { return this.goals.length > 0 && this.goals.every(g => this.goalDone(g)); }
    starsOf(score) { const s = this.stars; if (!this.won) return 0; return score >= (s[2] || Infinity) ? 3 : score >= (s[1] || Infinity) ? 2 : 1; }
    checkEnd() {
      if (this.over || this.mode !== 'level') return;
      if (this.allDone()) { this.won = true; this.wonAt = this.used; this.finale(); this.end('win'); }
      else if (this.used >= this.moves) this.end('moves');
    }
    // the level is won: each move left lights a rocket somewhere on the board, then every special on the board goes off
    finale() {
      if (this.finaleDone) return;
      this.finaleDone = true;
      let left = this.moves - this.used;
      const spare = left;
      this.emit({ k: 'finale', left });
      const lit = [];
      for (let n = 0; n < left && n < 15; n++) {
        const cand = [];
        for (let i = 0; i < this.pc.length; i++) if (this.colorAt(i) >= 0 && !this.cage[i]) cand.push(i);
        if (!cand.length) break;
        const i = cand[this.ri(cand.length)], old = this.pc[i], p = this.newPiece(n % 2 ? RV : RH);
        this.pc[i] = p; lit.push(i);
        this.score += PTS.spare;
        this.step({ t: 'spark', d: T.spark, i, p, old: old.id, n });
      }
      if (spare > 15) this.score += (spare - 15) * PTS.spare;
      this.used = this.moves;
      // set off every special still on the board until none are left
      for (let round = 0; round < 12; round++) {
        const acts = [];
        for (let i = 0; i < this.pc.length; i++) { const p = this.pc[i]; if (p && isSpecial(p.k) && !this.cage[i]) acts.push({ i, p, c: -1, chain: true }); }
        if (!acts.length) break;
        this.step({ t: 'pause', d: T.pause });
        this.resolveQuiet(acts);
      }
    }
    // the finale's blasts: like resolve(), but no end check and no shuffle in between
    resolveQuiet(acts) {
      let wave = 0, gs = null;
      while (true) {
        const mult = 1 + CASCADE_STEP * wave;
        let ringActs = acts || [], ringGroups = gs || [], ring = 0;
        while (ringActs.length || ringGroups.length) {
          const ph = { t: 'ring', d: T.ring, wave, ring, hits: [], fx: [], made: [], obs: [], pts: [] };
          const hitNow = new Set(), next = [];
          for (const g of ringGroups) { let gain = 0; for (const c of g.cells) gain += this.hit(c, 'match', hitNow, next, ph, mult); ph.pts.push([this.centerOf(g.cells), gain]); }
          for (const a of ringActs) this.activate(a, hitNow, next, ph, mult);
          if (ph.fx.some(f => f.k === 'fly')) ph.d += T.fly;
          if (ph.fx.some(f => f.k === 'rays')) ph.d += T.rays;
          this.step(ph);
          ringActs = next; ringGroups = []; ring++;
          if (ring > 60) break;
        }
        this.fall();
        while (this.collect()) this.fall();
        gs = this.groups(); acts = null;
        if (!gs.length || ++wave > 40) break;
      }
    }
    end(why) {
      if (this.over) return;
      this.over = true; this.why = why;
      if (why === 'win') this.won = true;
      this.emit({ k: 'over', why, won: this.won, score: this.score, stars: this.starsOf(this.score) });
    }

    // ---------- time ----------
    // dt ms passing: the playback of the last move, and the clock in time mode
    tick(dt) {
      if (!(dt > 0)) return;
      if (this.busy > 0) this.busy = Math.max(0, this.busy - dt);
      if (this.mode === 'time' && this.started && !this.over) {
        this.time = Math.min(this.timeMs, this.time + dt);
        if (this.time >= this.timeMs) this.ending = true;
        if (this.ending && this.busy <= 0) this.end('time');
      }
    }
    timeLeft() { return Math.max(0, this.timeMs - this.time); }
    movesLeft() { return Math.max(0, this.moves - this.used); }

    // ---------- battles: cages thrown by other players ----------
    // n cages land on random free mochi (not specials); returns how many landed
    addCages(n) {
      if (this.over) return 0;
      const cand = [];
      for (let i = 0; i < this.pc.length; i++) if (this.colorAt(i) >= 0 && !this.cage[i] && this.movable(i)) cand.push(i);
      const got = [];
      for (let k = 0; k < n && cand.length; k++) { const j = this.ri(cand.length); got.push(cand[j]); cand.splice(j, 1); }
      for (const i of got) this.cage[i] = 1;
      if (!got.length) return 0;
      this.stats.caged += got.length;
      this.step({ t: 'cage', d: T.cage, cells: got });
      this.emit({ k: 'caged', n: got.length });
      this.settle();
      return got.length;
    }

    // ---------- a copy for the bots to try moves on, saving, and the small picture for other players ----------
    clone() {
      const g = Object.create(Game.prototype);
      for (const k of Object.keys(this)) {
        const v = this[k];
        if (v instanceof Uint8Array) g[k] = v.slice();
        else if (k === 'pc') g[k] = v.map(p => (p ? { id: p.id, k: p.k, c: p.c } : null));
        else if (k === 'rng' || k === 'ing' || k === 'stats') g[k] = JSON.parse(JSON.stringify(v));
        else if (k === 'goals') g[k] = v.map(x => Object.assign({}, x));
        else if (k === 'anim' || k === 'ev') g[k] = [];
        else g[k] = v;
      }
      g.rec = false;
      return g;
    }
    toJSON() {
      return {
        v: 1, o: this.o, mode: this.mode, W: this.W, H: this.H, ncol: this.ncol, seed: this.seed, rng: this.rng.s, nextId: this.nextId,
        moves: this.moves, used: this.used, timeMs: this.timeMs, time: this.time, score: this.score, started: this.started,
        goals: this.goals.map(g => Object.assign({}, g)), ing: Object.assign({}, this.ing), stats: JSON.parse(JSON.stringify(this.stats)),
        hole: Array.from(this.hole), frost: Array.from(this.frost), cage: Array.from(this.cage), box: Array.from(this.box),
        pc: this.pc.map(p => (p ? [p.id, p.k, p.c] : 0)),
      };
    }
    static fromJSON(j) {
      if (!j || j.v !== 1) throw new Error('bad save');
      const g = new Game(Object.assign({}, j.o, { rec: true }));
      if (g.W !== j.W || g.H !== j.H) throw new Error('bad save');
      const n = g.W * g.H;
      for (const k of ['hole', 'frost', 'cage', 'box']) { if (!Array.isArray(j[k]) || j[k].length !== n) throw new Error('bad save'); g[k] = Uint8Array.from(j[k]); }
      if (!Array.isArray(j.pc) || j.pc.length !== n) throw new Error('bad save');
      g.pc = j.pc.map(p => (Array.isArray(p) ? { id: p[0] | 0, k: clamp(p[1] | 0, 0, 6), c: p[1] === NORM ? clamp(p[2] | 0, 0, 5) : -1 } : null));
      g.rng.s = j.rng | 0; g.nextId = Math.max(j.nextId | 0, 1); g.used = j.used | 0; g.time = +j.time || 0; g.score = j.score | 0;
      g.started = !!j.started; g.goals = (j.goals || []).map(x => Object.assign({}, x)); Object.assign(g.ing, j.ing || {}); Object.assign(g.stats, j.stats || {});
      g.anim = []; g.ev = []; g.busy = 0;
      return g;
    }
    // the board as a string for the small boards of other players: a char per cell
    snap() {
      let b = '';
      for (let i = 0; i < this.pc.length; i++) b += cellChar(this, i);
      return { b, w: this.W, s: this.score, t: Math.round(this.timeLeft() / 100), m: this.used };
    }
  }
  // '0'-'5' a mochi, 'A'-'F' a caged mochi, '6' row rocket, '7' column rocket, '8' firecracker, '9' lantern, 'w' firework,
  // 'i' ingot, '.' empty, '#' no cell, 'b' box
  function cellChar(g, i) {
    if (g.hole[i]) return '#';
    if (g.box[i]) return 'b';
    const p = g.pc[i];
    if (!p) return '.';
    if (p.k === NORM) return g.cage[i] ? 'ABCDEF'[p.c] : String(p.c);
    return '.6789wi'[p.k];
  }
  const SNAP_RE = /^[0-9A-Fwib.#]+$/;
  function unsnap(s, w) {
    if (typeof s !== 'string' || !SNAP_RE.test(s) || s.length > 81 || !(w >= 4 && w <= 9) || s.length % w) return null;
    return s;
  }

  G.MM = { Game, NORM, RH, RV, FC, KL, FW, ING, isSpecial, KIND_NAMES, T, PTS, FC_R, rnd, unsnap, cellChar };
})(typeof window !== 'undefined' ? window : globalThis);
