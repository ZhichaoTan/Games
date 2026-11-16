// ===== Cipher: working out what a hidden tile can be, and the bots that use it =====
// Everything here reads one seat's view only (what that player is allowed to see), never the host's full table.
//
// infer(view): for every hidden tile the viewer can't see, the chance of each value (0..11, 12 = key).
// The tiles the viewer can't see are shared out between the hidden tiles on the table and the pool (plus the
// tile in the hand of whoever is drawing). Every way of sharing them out that fits what is known counts the
// same: each tile's colour, every row in order, no tile where a wrong guess already ruled it out.
// A row must go up from left to right, so taking the unknown numbers from smallest to largest, each one goes
// either to the next empty place of one row or to the pool. That turns the counting into a small walk over
// "how far along each row are we" (one pointer per row), run forwards and backwards to get each place's chances.
// Keys don't take part in the order, so each place a key could be is tried in turn.
//
// simple(view): the quick version a player does in their head, used by the hint that's on by default and by the
// Rookie bot: the colour, the tiles in plain sight, the wrong guesses, and the nearest cracked numbers on either side.
(function (G) {
  'use strict';
  const CX = G.CX || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const { JK, KEY, valOf, idOf, isKey, slotsFor } = CX;

  // what the viewer knows. pub: leave out the viewer's own private tiles (how the table looks to everyone else)
  function scan(v, pub) {
    const R = v.R, me = v.me, keysOn = !!v.rules.keys;
    const known = new Uint8Array(26);
    const rows = [];   // { o, ents: [ { i, fix: id } | { i, c, bad:Set(values) } ] }
    for (const o of R.ps) {
      const row = R.rows[o]; if (!row) continue;
      const ents = row.map((t, i) => {
        const fixed = t.open || (o === me && !pub && t.v != null);
        if (fixed && t.v != null) { const id = idOf(t.v, t.c); known[id] = 1; return { i, fix: id }; }
        return { i, c: t.c, bad: new Set(t.bad || []) };
      });
      rows.push({ o, ents });
    }
    if (R.hold && R.hold.v != null && !pub) known[idOf(R.hold.v, R.hold.c)] = 1;
    const nums = [], keys = [];
    for (let id = 0; id < 24; id++) if (!known[id]) nums.push(id);
    if (keysOn) for (let id = JK; id < JK + 2; id++) if (!known[id]) keys.push(id);
    return { rows, nums, keys, known, keysOn };
  }

  // the count for one placement of the keys. rowsF: for each row its places to fill with numbers, in order, each
  // { c, lo, hi, bad: Set of ids } (lo/hi: the nearest fixed numbers either side, as ids). Returns the number of
  // ways Z and, for each place, how many of them put each unknown number there.
  function walk(rowsF, nums) {
    const m = rowsF.length, N = nums.length;
    const dims = rowsF.map(r => r.length + 1), stride = [];
    let S = 1;
    for (let r = 0; r < m; r++) { stride.push(S); S *= dims[r]; }
    const ptr = new Uint8Array(S * m);
    for (let st = 0; st < S; st++) for (let r = 0; r < m; r++) ptr[st * m + r] = Math.floor(st / stride[r]) % dims[r];
    const fits = (k, r, p) => {
      const sl = rowsF[r][p], u = nums[k];
      return sl && sl.c === (u & 1) && u > sl.lo && u < sl.hi && !sl.bad.has(u);
    };
    // allowed[k][r][p] precomputed
    const ok = [];
    for (let k = 0; k < N; k++) { ok.push(rowsF.map((row, r) => row.map((_, p) => fits(k, r, p)))); }
    const F = new Array(N + 1);
    F[0] = new Float64Array(S); F[0][0] = 1;
    for (let k = 0; k < N; k++) {
      const f = F[k], g = new Float64Array(S), okk = ok[k];
      for (let st = 0; st < S; st++) {
        const x = f[st]; if (!x) continue;
        g[st] += x;
        for (let r = 0; r < m; r++) { const p = ptr[st * m + r]; if (p < dims[r] - 1 && okk[r][p]) g[st + stride[r]] += x; }
      }
      F[k + 1] = g;
    }
    const full = S - 1, Z = F[N][full];
    if (!Z) return { Z: 0 };
    const B = new Array(N + 1);
    B[N] = new Float64Array(S); B[N][full] = 1;
    for (let k = N - 1; k >= 0; k--) {
      const b1 = B[k + 1], b = new Float64Array(S), okk = ok[k];
      for (let st = 0; st < S; st++) {
        let x = b1[st];
        for (let r = 0; r < m; r++) { const p = ptr[st * m + r]; if (p < dims[r] - 1 && okk[r][p]) x += b1[st + stride[r]]; }
        b[st] = x;
      }
      B[k] = b;
    }
    const M = rowsF.map(row => row.map(() => new Float64Array(N)));
    for (let k = 0; k < N; k++) {
      const f = F[k], b1 = B[k + 1], okk = ok[k];
      for (let st = 0; st < S; st++) {
        const x = f[st]; if (!x) continue;
        for (let r = 0; r < m; r++) {
          const p = ptr[st * m + r];
          if (p < dims[r] - 1 && okk[r][p]) { const y = b1[st + stride[r]]; if (y) M[r][p][k] += x * y; }
        }
      }
    }
    return { Z, M, S };
  }

  // the size of the walk, to keep the public version (which also counts the viewer's own row) affordable
  function cost(sc) {
    let S = 1, kb = 1, kw = 1;
    for (const r of sc.rows) { const h = r.ents.filter(e => e.fix == null).length; S *= h + 1; }
    for (const r of sc.rows) for (const e of r.ents) if (e.fix == null) { if (e.c === 0) kb++; else kw++; }
    const cfg = (sc.keys.includes(JK) ? kb : 1) * (sc.keys.includes(JK + 1) ? kw : 1);
    return S * cfg * (sc.nums.length + 1) * Math.max(1, sc.rows.length);
  }

  // P[o][i]: a 13-long array of chances for tile i of seat o, or null where the tile is known.
  function infer(v, opt) {
    opt = opt || {};
    const sc = scan(v, !!opt.pub);
    if (opt.max && cost(sc) > opt.max) return null;
    const { rows, nums, keys } = sc;
    const out = [null, null, null, null];
    // the unknown places, each row's own list
    const places = rows.map(r => r.ents.filter(e => e.fix == null));
    const acc = places.map(pl => pl.map(() => new Float64Array(13)));
    let total = 0;
    // where each unknown key could be: any unknown place of its colour where "key" hasn't been ruled out, or off the table (-1)
    const spots = keys.map(kid => {
      const c = kid - JK, list = [[-1, -1]];
      places.forEach((pl, r) => pl.forEach((e, j) => { if (e.c === c && !e.bad.has(KEY)) list.push([r, j]); }));
      return list;
    });
    const combos = [];
    if (!keys.length) combos.push([]);
    else if (keys.length === 1) for (const a of spots[0]) combos.push([a]);
    else for (const a of spots[0]) for (const b of spots[1]) combos.push([a, b]);
    for (const cmb of combos) {
      const isK = (r, j) => cmb.some(x => x[0] === r && x[1] === j);
      // the places left for numbers, with the fixed numbers either side as bounds
      const rowsF = rows.map((row, r) => {
        const list = [];
        let lo = -1, j = 0;
        const ents = row.ents;
        for (let x = 0; x < ents.length; x++) {
          const e = ents[x];
          if (e.fix != null) { if (!isKey(e.fix)) lo = e.fix; continue; }
          const jj = j++;
          if (isK(r, jj)) continue;
          let hi = 24;
          for (let y = x + 1; y < ents.length; y++) if (ents[y].fix != null && !isKey(ents[y].fix)) { hi = ents[y].fix; break; }
          const bad = new Set(); for (const b of e.bad) if (b !== KEY) bad.add(idOf(b, e.c));
          list.push({ c: e.c, lo, hi, bad, j: jj });
        }
        return list;
      });
      const w = walk(rowsF, nums);
      if (!w.Z) continue;
      total += w.Z;
      rowsF.forEach((list, r) => list.forEach((sl, p) => { const a = acc[r][sl.j], mm = w.M[r][p]; for (let k = 0; k < nums.length; k++) if (mm[k]) a[nums[k] >> 1] += mm[k]; }));
      for (const [r, j] of cmb) if (r >= 0) acc[r][j][KEY] += w.Z;
    }
    if (!total) return null;
    rows.forEach((row, r) => {
      const arr = row.ents.map(() => null);
      places[r].forEach((e, j) => { const a = acc[r][j]; for (let x = 0; x < 13; x++) a[x] /= total; arr[e.i] = a; });
      out[row.o] = arr;
    });
    return out;
  }

  // the quick version: candidate values for each tile, as a 13-long array of 1/n over the values still possible
  function simple(v, opt) {
    opt = opt || {};
    const sc = scan(v, !!opt.pub), out = [null, null, null, null];
    for (const row of sc.rows) {
      const arr = row.ents.map(() => null);
      row.ents.forEach((e, x) => {
        if (e.fix != null) return;
        let lo = -1, hi = 24;
        for (let y = x - 1; y >= 0; y--) { const f = row.ents[y].fix; if (f != null && !isKey(f)) { lo = f; break; } }
        for (let y = x + 1; y < row.ents.length; y++) { const f = row.ents[y].fix; if (f != null && !isKey(f)) { hi = f; break; } }
        const a = new Float64Array(13);
        let n = 0;
        for (let val = 0; val < 12; val++) { const id = idOf(val, e.c); if (!sc.known[id] && id > lo && id < hi && !e.bad.has(val)) { a[val] = 1; n++; } }
        if (sc.keysOn && !sc.known[JK + e.c] && !e.bad.has(KEY)) { a[KEY] = 1; n++; }
        if (n) for (let val = 0; val < 13; val++) a[val] /= n;
        arr[e.i] = a;
      });
      out[row.o] = arr;
    }
    return out;
  }

  // ---------------- bots ----------------
  // Four levels, each a set of habits:
  //   exact  works out the whole table (otherwise only the quick reasoning)
  //   pick   'whim': a tile with few possibilities, any value it could be; 'noisy': usually the best chance;
  //          'best': the best chance, then the player closest to going out; 'look': also weighs how good the next guess would be
  //   th     keep guessing after a hit when the next guess is at least this likely (thOut lower when it knocks someone out)
  //   colour 'any' draws either pile; 'unseen' draws the colour with more tiles nobody has seen (harder to work out)
  //   reveal which of its own tiles to turn up after a miss with nothing to draw: 'any', or the one most exposed already
//   expo   keep going more readily when the new tile would be easy for the others to work out anyway
  const LEVELS = {
    1: { exact: false, pick: 'whim', th: 0.5, gamble: 0.2, sure: 0.9, colour: 'any', reveal: 'any' },
    2: { exact: true, pick: 'noisy', th: 0.6, colour: 'any', reveal: 'any' },
    3: { exact: true, pick: 'best', thBy: [0, 0, 0.42, 0.48, 0.52], thOut: 0.06, colour: 'unseen', reveal: 'exposed' },
    4: { exact: true, pick: 'look', look: 0.3, thBy: [0, 0, 0.3, 0.36, 0.42], thOut: 0.08, expo: 0.3, colour: 'unseen', reveal: 'exact' },
  };
  // (bot-only matches, tests/sim.js: pressing on after a hit pays. Stopping keeps the new tile hidden, but a hit
  // also cracks open its neighbours, so the next guess is usually better than it looks. With more players a miss
  // shows your tile to everyone while a hit hurts only one of them, so the bar goes up a little.)
  const hiddenOf = row => row ? row.filter(t => !t.open).length : 0;
  function candidates(v, P) {
    const R = v.R, out = [];
    for (const o of R.ps) {
      if (o === v.me || R.out.includes(o) || !P[o]) continue;
      P[o].forEach((a, i) => { if (!a) return; for (let val = 0; val < 13; val++) if (a[val] > 1e-9) out.push({ t: o, i, v: val, p: a[val] }); });
    }
    return out;
  }
  const pick = (arr, rnd) => arr[Math.min(arr.length - 1, Math.floor(rnd() * arr.length))];
  function weighted(list, w, rnd) {
    let sum = 0; for (const x of list) sum += w(x);
    let r = rnd() * sum;
    for (const x of list) { r -= w(x); if (r <= 0) return x; }
    return list[list.length - 1];
  }
  // a copy of the view with one more tile cracked, for looking a guess ahead
  function withCrack(v, g) {
    const R = Object.assign({}, v.R);
    R.rows = R.rows.map((row, o) => row && (o === g.t ? row.map((t, i) => i === g.i ? Object.assign({}, t, { open: true, v: g.v }) : t) : row));
    return Object.assign({}, v, { R });
  }
  function bestP(v) {
    const P = infer(v); if (!P) return 0;
    let b = 0; for (const c of candidates(v, P)) if (c.p > b) b = c.p;
    return b;
  }
  function chooseGuess(v, H, rnd) {
    const R = v.R;
    let P = H.exact ? infer(v) : simple(v);
    if (!P) P = simple(v);
    let cs = candidates(v, P);
    if (!cs.length) { P = simple(v); cs = candidates(v, P); }
    if (!cs.length) {
      // nothing fits (shouldn't happen): any hidden tile, any value
      for (const o of R.ps) if (o !== v.me && !R.out.includes(o)) R.rows[o].forEach((t, i) => { if (!t.open) cs.push({ t: o, i, v: Math.floor(rnd() * 12), p: 0 }); });
      return pick(cs, rnd);
    }
    const left = o => hiddenOf(R.rows[o]);
    if (H.pick === 'whim') {
      const tiles = new Map();
      for (const c of cs) { const k = c.t + ':' + c.i; if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push(c); }
      const list = [...tiles.values()];
      const t = rnd() < 0.25 ? pick(list, rnd) : weighted(list, l => 1 / (l.length * l.length), rnd);
      return pick(t, rnd);
    }
    cs.sort((a, b) => b.p - a.p || left(a.t) - left(b.t));
    if (H.pick === 'noisy') {
      if (rnd() < 0.7) { const top = cs.filter(c => c.p >= cs[0].p - 1e-9); return pick(top, rnd); }
      return weighted(cs.slice(0, 6), c => c.p, rnd);
    }
    if (H.pick === 'best' || !H.look) {
      const top = cs.filter(c => c.p >= cs[0].p - 1e-9);
      const fewest = Math.min(...top.map(c => left(c.t)));
      return pick(top.filter(c => left(c.t) === fewest), rnd);
    }
    // chance now, plus how good the next guess would be after this one lands, plus a little for knocking someone out
    const look = cs.slice(0, 6).filter(c => c.p > 0.02);
    let best = cs[0], bv = -1;
    for (const c of look) {
      const next = c.p > 0 ? bestP(withCrack(v, c)) : 0;
      const val = c.p * (1 + H.look * next) + (left(c.t) === 1 ? (H.outBonus || 0) * c.p : 0) + rnd() * 1e-6;
      if (val > bv) { bv = val; best = c; }
    }
    return best;
  }
  function keepGoing(v, g, H, rnd) {
    const R = v.R, p = g.p;
    if (p >= 0.999) return H.sure ? rnd() < H.sure : true;
    if (H.gamble && rnd() < H.gamble) return true;
    let th = H.thBy ? H.thBy[Math.max(2, Math.min(4, R.ps.length - R.out.length))] : H.th;
    if (H.thOut && hiddenOf(R.rows[g.t]) === 1) th -= H.thOut;
    // how easy my new tile would be for the others to work out where it would stand: an easy one is worth less to keep hidden
    if (H.expo && R.hold && R.hold.v != null) {
      const row = R.rows[v.me], ids = row.map(t => idOf(t.v, t.c)), hid = idOf(R.hold.v, R.hold.c);
      const at = slotsFor(ids, hid)[0];
      const rows = R.rows.slice(); rows[v.me] = row.slice(0, at).concat([R.hold], row.slice(at));
      const S = simple(Object.assign({}, v, { R: Object.assign({}, R, { rows, hold: null }) }), { pub: true });
      const a = S[v.me] && S[v.me][at];
      if (a) th -= H.expo * (a[R.hold.v] || 0);
    }
    return p >= th;
  }
  // which of my tiles to turn up after a miss with nothing to draw: the one the others are closest to working out anyway
  function chooseReveal(v, H, rnd) {
    const row = v.R.rows[v.me], hid = [];
    row.forEach((t, i) => { if (!t.open) hid.push(i); });
    if (H.reveal === 'any' || hid.length <= 1) return pick(hid, rnd);
    let P = H.reveal === 'exact' ? infer(v, { pub: true, max: 4e6 }) : null;
    if (!P) P = simple(v, { pub: true });
    const mine = P[v.me];
    if (!mine) return pick(hid, rnd);
    let best = hid[0], bv = -1;
    for (const i of hid) { const a = mine[i]; if (!a) continue; const tv = row[i].v; const val = (tv != null ? a[tv] : 0) + rnd() * 1e-6; if (val > bv) { bv = val; best = i; } }
    return best;
  }
  // a bot's move for its own view. lv 1..4; H overrides the level's habits (for experiments)
  function decide(v, lv, rnd, H) {
    rnd = rnd || Math.random;
    lv = Math.max(1, Math.min(4, lv | 0 || 2));
    H = Object.assign({}, LEVELS[lv], H || {});
    const R = v.R, o = v.opt;
    if (!R || !o) return null;
    if (o.k === 'place') return { k: 'place', at: pick(o.slots, rnd) };
    if (o.k === 'draw') {
      const cs = [0, 1].filter(c => o.c[c] > 0);
      if (cs.length === 1) return { k: 'draw', c: cs[0] };
      if (H.colour === 'any') return { k: 'draw', c: rnd() * (o.c[0] + o.c[1]) < o.c[0] ? 0 : 1 };
      const seen = [0, 0];
      for (const s of R.ps) for (const t of (R.rows[s] || [])) if (t.open) seen[t.c]++;
      const unseen = [13 - seen[0], 13 - seen[1]];
      return { k: 'draw', c: unseen[0] === unseen[1] ? (rnd() < 0.5 ? 0 : 1) : unseen[0] > unseen[1] ? 0 : 1 };
    }
    if (o.k === 'guess') { const g = chooseGuess(v, H, rnd); return { k: 'guess', t: g.t, i: g.i, v: g.v }; }
    if (o.k === 'decide') {
      const g = chooseGuess(v, H, rnd);
      if (keepGoing(v, g, H, rnd)) return { k: 'guess', t: g.t, i: g.i, v: g.v };
      return { k: 'stop', at: o.slots.length ? pick(o.slots, rnd) : 0 };
    }
    if (o.k === 'reveal') return { k: 'reveal', i: chooseReveal(v, H, rnd) };
    return null;
  }

  const AI = { infer, simple, decide, candidates, scan, LEVELS };
  G.CXAI = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})(typeof window !== 'undefined' ? window : globalThis);
