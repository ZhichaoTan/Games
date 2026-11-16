// ===== 沉岛 Moontide · rules engine =====
// The host runs the real game with it, guests use it to light up legal moves, the bots plan with it, and the tests run it under node.
//
// The board is a hexagon of flat-top hexes, every cell within six steps of the centre (127 cells). Six lighthouses stand on the corners.
// A random island of 30 tiles sits in the middle: beaches on the shore, palm groves inside them, hills in the heart.
// Each player has a few islanders, and each islander carries a number of pearls only its owner can see.
// A turn: the tide die is rolled (it names the creature you'll command), you take 3 steps, you sink one shoreline tile
// (its underside does something), then you may move one creature of the rolled kind.
// When the last tile goes under the storm arrives: whoever isn't in a lighthouse by then is lost. Most pearls in the lighthouses wins.
(function (G) {
  'use strict';
  const RAD = 6, CAP = 3, STEPS = 3, TAILWIND = 2, LAND = 30;
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const CELLS = [], IDX = new Map();
  for (let q = -RAD; q <= RAD; q++) for (let r = -RAD; r <= RAD; r++) {
    const s = -q - r; if (Math.abs(s) > RAD) continue;
    IDX.set(q + ',' + r, CELLS.length);
    CELLS.push({ q, r, d: Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) });
  }
  const N = CELLS.length;
  const cellAt = (q, r) => { const i = IDX.get(q + ',' + r); return i == null ? -1 : i; };
  const NB = CELLS.map(c => DIRS.map(([dq, dr]) => cellAt(c.q + dq, c.r + dr)).filter(i => i >= 0));
  const CORNERS = DIRS.map(([dq, dr]) => cellAt(dq * RAD, dr * RAD));
  function dist(a, b) { const A = CELLS[a], B = CELLS[b], dq = A.q - B.q, dr = A.r - B.r; return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)); }

  // the tide die: which creature the player commands this turn (the moon lets them pick any)
  const FACES = ['shark', 'shark', 'oct', 'oct', 'crab', 'moon'];
  const SPEED = { shark: 3, oct: 1, crab: 2 };
  // what's under the tiles (30 of them)
  const BACKS = [['boat', 7], ['shark', 4], ['oct', 3], ['reef', 3], ['dolphin', 3], ['buoy', 3], ['tail', 3], ['none', 4]];
  // pearls per islander, by the number of players: fewer players, more islanders each
  const PEARLS = { 2: [5, 4, 3, 2, 2, 1, 1], 3: [5, 3, 2, 2, 1, 1], 4: [5, 3, 2, 1, 1] };
  // island size by the number of players: the island is the clock (a tile sinks every turn), so a two-player night is shorter;
  // each size divides evenly, so everyone gets the same number of turns
  const LANDS = { 2: 24, 3: 30, 4: 32 };
  // the tile undersides for an island of n tiles: the 30-tile mix scaled, the rest empty
  function bagFor(n) {
    const out = [];
    for (const [b, c] of BACKS) if (b !== 'none') for (let t = 0; t < Math.round(c * n / 30); t++) out.push(b);
    while (out.length > n) out.pop();
    while (out.length < n) out.push('none');
    return out;
  }

  // ---------- randomness ----------
  function seeded(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function cryptoRnd() {
    const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    if (!c) return Math.random();
    const u = new Uint32Array(2); c.getRandomValues(u);
    return (u[0] * 2097152 + (u[1] >>> 11)) / 9007199254740992;
  }
  const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- the island ----------
  // Grown outward from the centre, favouring cells with many land neighbours so it stays one chunky island with bays and points.
  // Never closer than two hexes to a lighthouse, and no lakes.
  function genIsland(rnd, want) {
    want = want || LAND;
    for (let tries = 0; tries < 80; tries++) {
      const land = new Array(N).fill(false);
      land[cellAt(0, 0)] = true;
      let n = 1;
      while (n < want) {
        const cand = []; let tot = 0;
        for (let i = 0; i < N; i++) {
          if (land[i] || CELLS[i].d > 4) continue;
          let k = 0; for (const j of NB[i]) if (land[j]) k++;
          if (!k) continue;
          const w = Math.pow(k, 2.3) * (CELLS[i].d <= 2 ? 1.25 : CELLS[i].d === 3 ? 1 : 0.34);
          cand.push(i, w); tot += w;
        }
        let x = rnd() * tot, got = cand[0];
        for (let t = 0; t < cand.length; t += 2) { x -= cand[t + 1]; if (x <= 0) { got = cand[t]; break; } }
        land[got] = true; n++;
      }
      let lake = false;
      for (let i = 0; i < N; i++) if (!land[i] && NB[i].length === 6 && NB[i].every(j => land[j])) lake = true;
      if (lake) continue;
      return land;
    }
    const land = new Array(N).fill(false);   // fallback, never seen in practice: the inner hexagon
    for (let i = 0, n = 0; i < N && n < want; i++) if (CELLS[i].d <= 3) { land[i] = true; n++; }
    return land;
  }
  // elevation 0 beach, 1 palm grove, 2 hill: by how far a tile is from the shore, with a little noise so the bands aren't perfect rings
  function elevations(land, rnd) {
    const dd = new Array(N).fill(-1), q = [];
    for (let i = 0; i < N; i++) if (land[i] && NB[i].some(j => !land[j])) { dd[i] = 1; q.push(i); }
    for (let h = 0; h < q.length; h++) for (const j of NB[q[h]]) if (land[j] && dd[j] < 0) { dd[j] = dd[q[h]] + 1; q.push(j); }
    const ids = [], key = {};
    for (let i = 0; i < N; i++) if (land[i]) { ids.push(i); key[i] = dd[i] + rnd() * 0.95 + (CELLS[i].d === 0 ? 0.6 : 0); }
    ids.sort((a, b) => key[a] - key[b]);
    const nb = Math.round(ids.length * 0.43), np = Math.round(ids.length * 0.37);
    const el = new Array(N).fill(-1);
    ids.forEach((i, k) => { el[i] = k < nb ? 0 : k < nb + np ? 1 : 2; });
    return { el, top: ids[ids.length - 1] };
  }
  // spread-out sea cells for the opening creatures: on the ring next to the lighthouses' ring, not right beside a lighthouse
  function spread(g, count, rnd) {
    const cand = [];
    for (let i = 0; i < N; i++) if (CELLS[i].d === 5 && g.k[i] === 'S' && !NB[i].some(j => g.k[j] === 'H' || g.k[j] === 'L')) cand.push(i);
    shuffle(cand, rnd);
    const out = [];
    while (out.length < count && cand.length) {
      let best = -1, bd = -1;
      for (const c of cand) { const d = out.length ? Math.min(...out.map(o => dist(o, c))) : 0; if (d > bd) { bd = d; best = c; } }
      out.push(best); cand.splice(cand.indexOf(best), 1);
    }
    return out;
  }

  // ---------- small queries ----------
  const live = x => x.st === 'land' || x.st === 'boat' || x.st === 'swim';
  const landIsl = (g, i) => g.isl.filter(x => x.st === 'land' && x.at === i);
  const boatAt = (g, i) => g.boats.find(b => !b.dock && b.at === i) || null;
  const boatById = (g, id) => g.boats.find(b => b.id === id) || null;
  const pax = (g, b) => g.isl.filter(x => x.st === 'boat' && x.b === b.id);
  const crAt = (g, i, k) => g.cr.find(c => c.at === i && (!k || c.k === k)) || null;
  const crab = g => g.cr.find(c => c.k === 'crab') || null;
  const room = (g, b) => !!b && pax(g, b).length < CAP;
  const coastal = (g, i) => g.k[i] === 'L' && NB[i].some(j => g.k[j] !== 'L');
  const isWater = k => k === 'S' || k === 'F';
  // a boat is rowed by whoever has the most people aboard (any of them on a tie); anyone may row an empty boat
  function steerers(g, b) {
    const p = pax(g, b);
    if (!p.length) return null;   // anyone
    const cnt = {}; for (const x of p) cnt[x.s] = (cnt[x.s] || 0) + 1;
    const mx = Math.max(...Object.values(cnt));
    return Object.keys(cnt).filter(s => cnt[s] === mx).map(Number);
  }
  function canSteer(g, seat, b) { const s = steerers(g, b); return !s || s.includes(seat); }
  // how high the tide is: 0 only beaches can go under, 1 beaches and groves, 2 anything on the shore
  const tide = g => g.sunk < g.mid ? 0 : g.sunk < g.high ? 1 : 2;

  // ---------- moves ----------
  function islSteps(g, x) {
    const out = [];
    if (x.st === 'land' || x.st === 'boat') {
      const from = x.st === 'land' ? x.at : boatById(g, x.b).at;
      for (const j of NB[from]) {
        const k = g.k[j];
        if (k === 'L') { if (!crAt(g, j, 'crab') && landIsl(g, j).length < CAP) out.push(j); }
        else if (k === 'H' || k === 'F') out.push(j);
        else if (k === 'S') { const b = boatAt(g, j); if ((b && room(g, b)) || !crAt(g, j, 'shark')) out.push(j); }
      }
    } else if (x.st === 'swim' && !x.sw) {
      if (room(g, boatAt(g, x.at))) out.push(x.at);   // climb into the boat beside you
      for (const j of NB[x.at]) {
        const k = g.k[j];
        if (k === 'H' || k === 'F') out.push(j);
        else if (k === 'S') { const b = boatAt(g, j); if ((b && room(g, b)) || !crAt(g, j, 'shark')) out.push(j); }
      }
    }
    return out;
  }
  function boatSteps(g, b) {
    const out = [];
    for (const j of NB[b.at]) {
      if (g.k[j] === 'S' && !boatAt(g, j)) out.push(j);
      else if (g.k[j] === 'H' && !b.dock) out.push(j);
    }
    return out;
  }
  function steps(g, seat) {
    const out = [];
    for (const x of g.isl) if (x.s === seat && live(x)) for (const j of islSteps(g, x)) out.push({ k: 'step', p: 'i', id: x.id, to: j });
    for (const b of g.boats) if (canSteer(g, seat, b)) for (const j of boatSteps(g, b)) out.push({ k: 'step', p: 'b', id: b.id, to: j });
    return out;
  }
  // where an islander ends up when it moves into cell j: what happens there
  function landOn(g, x, j) {
    const k = g.k[j];
    x.b = -1; x.at = j;
    if (k === 'H') { x.st = 'safe'; return 'safe'; }
    if (k === 'L') { x.st = 'land'; return 'land'; }
    const b = k === 'S' ? boatAt(g, j) : null;
    if (b && room(g, b)) { x.st = 'boat'; x.b = b.id; return 'board'; }
    x.st = 'swim'; x.sw = true; return 'swim';
  }
  function doStep(g, a) {
    if (a.p === 'i') {
      const x = g.isl.find(y => y.id === a.id);
      const from = x.st === 'boat' ? boatById(g, x.b).at : x.at;
      const res = landOn(g, x, a.to);
      return { k: 'step', s: g.turn, p: 'i', id: x.id, from, to: a.to, res };
    }
    const b = boatById(g, a.id), from = b.at, p = pax(g, b);
    b.at = a.to;
    let res = 'sail';
    if (g.k[a.to] === 'H') { b.dock = true; res = 'dock'; for (const x of p) { x.st = 'safe'; x.at = a.to; x.b = -1; } }
    else { b.dock = false; for (const x of p) x.at = a.to; }
    return { k: 'step', s: g.turn, p: 'b', id: b.id, from, to: a.to, res, pax: p.map(x => x.id) };
  }

  function sinkable(g) {
    const coast = [];
    for (let i = 0; i < N; i++) if (coastal(g, i)) coast.push(i);
    const c = crab(g);
    let cand = coast.filter(i => !(c && c.at === i));
    if (!cand.length) cand = coast;   // only the crab's tile is left: it dives off
    const t = tide(g);
    let ok = cand.filter(i => g.el[i] <= t);
    if (!ok.length && cand.length) { const m = Math.min(...cand.map(i => g.el[i])); ok = cand.filter(i => g.el[i] === m); }
    return ok;
  }

  // where a swimmer can be carried by the dolphin: up to three hexes of open water (passing sharks is fine, stopping beside one isn't)
  function dolReach(g, x) {
    const prev = new Map([[x.at, -1]]), out = [];
    let fr = [x.at];
    for (let d = 1; d <= 3; d++) {
      const nx = [];
      for (const i of fr) for (const j of NB[i]) {
        if (prev.has(j)) continue;
        const k = g.k[j];
        if (k === 'H') { prev.set(j, i); out.push(j); continue; }
        if (!isWater(k)) continue;
        prev.set(j, i); nx.push(j);
        if (!crAt(g, j, 'shark')) out.push(j);
      }
      fr = nx;
    }
    const path = j => { const p = []; for (let y = j; y !== -1; y = prev.get(y)) p.unshift(y); return p; };
    return { cells: out, path };
  }
  function dolMoves(g) {
    const out = [];
    for (const x of g.isl) if (x.st === 'swim') for (const j of dolReach(g, x).cells) out.push({ k: 'dol', id: x.id, to: j });
    return out;
  }

  // creatures: sharks and octopuses swim (not over reefs), the crab walks the island
  function reach(g, c) {
    const ok = c.k === 'crab' ? (j => g.k[j] === 'L') : (j => g.k[j] === 'S');
    const prev = new Map([[c.at, -1]]), out = [];
    let fr = [c.at];
    for (let d = 1; d <= SPEED[c.k]; d++) {
      const nx = [];
      for (const i of fr) for (const j of NB[i]) if (!prev.has(j) && ok(j)) { prev.set(j, i); nx.push(j); out.push(j); }
      fr = nx;
    }
    const path = j => { const p = []; for (let y = j; y !== -1; y = prev.get(y)) p.unshift(y); return p; };
    return { cells: out, path };
  }
  function crTypes(g) {
    const has = k => g.cr.some(c => c.k === k);
    if (g.die && g.die !== 'moon' && has(g.die)) return [g.die];
    return ['shark', 'oct', 'crab'].filter(has);
  }
  const grabbable = (g, j) => g.boats.filter(b => !b.dock && (b.at === j || NB[j].includes(b.at)));
  const pushCells = (g, j) => NB[j].filter(p => isWater(g.k[p]));
  function crMovesOf(g, c) {
    const out = [], R = reach(g, c);
    if (c.k === 'shark') for (const j of R.cells) out.push({ k: 'cr', id: c.id, to: j });
    else if (c.k === 'oct') for (const j of [c.at].concat(R.cells)) {
      out.push({ k: 'cr', id: c.id, to: j, grab: -1 });
      for (const b of grabbable(g, j)) out.push({ k: 'cr', id: c.id, to: j, grab: b.id });
    } else for (const j of R.cells) {
      if (!landIsl(g, j).length) out.push({ k: 'cr', id: c.id, to: j, push: -1 });
      else for (const p of pushCells(g, j)) out.push({ k: 'cr', id: c.id, to: j, push: p });
    }
    return out;
  }
  function crMoves(g) {
    const ty = crTypes(g), out = [];
    for (const c of g.cr) if (ty.includes(c.k)) out.push(...crMovesOf(g, c));
    return out;
  }
  // the cells a creature may stop on (for the board highlights)
  function crTargets(g, c) {
    const seen = new Set();
    for (const m of crMovesOf(g, c)) seen.add(m.to);
    return [...seen];
  }

  function doCr(g, a) {
    const c = g.cr.find(x => x.id === a.id);
    const path = a.to === c.at ? [c.at] : reach(g, c).path(a.to);
    const e = { k: 'cr', s: g.turn, id: c.id, ck: c.k, path };
    c.at = a.to;
    if (c.k === 'shark') {
      const vic = g.isl.filter(x => x.st === 'swim' && x.at === a.to);
      e.eat = []; e.spared = []; e.buoy = [];
      const seats = [...new Set(vic.map(x => x.s))];
      for (const s of seats) {
        const xs = vic.filter(x => x.s === s);
        if (g.hand[s] && g.hand[s].buoy > 0) { g.hand[s].buoy--; e.buoy.push(s); e.spared.push(...xs.map(x => x.id)); }
        else for (const x of xs) { x.st = 'lost'; x.how = 'eaten'; e.eat.push(x.id); }
      }
    } else if (c.k === 'oct') {
      const b = a.grab >= 0 ? boatById(g, a.grab) : null;
      if (b) {
        const p = pax(g, b);
        for (const x of p) { x.st = 'swim'; x.b = -1; x.at = b.at; x.sw = true; }
        g.boats.splice(g.boats.indexOf(b), 1);
        e.grab = b.id; e.gat = b.at; e.pax = p.map(x => x.id);
      }
    } else {
      const here = landIsl(g, a.to);
      if (here.length) { for (const x of here) { x.st = 'swim'; x.at = a.push; x.sw = true; } e.push = a.push; e.pushed = here.map(x => x.id); }
    }
    return e;
  }

  function doSink(g, i) {
    const back = g.back[i];
    g.back[i] = null;
    g.k[i] = 'S';
    const el = g.el[i];
    g.el[i] = -1;
    g.sunk++;
    const fell = g.isl.filter(x => x.st === 'land' && x.at === i);
    for (const x of fell) { x.st = 'swim'; x.sw = true; }
    const e = { k: 'sink', s: g.turn, at: i, el, back, fell: fell.map(x => x.id) };
    const c = crab(g);
    if (c && c.at === i) { g.cr.splice(g.cr.indexOf(c), 1); e.crabGone = c.id; }
    if (back === 'boat') {
      const b = { id: g.nid++, at: i, dock: false };
      g.boats.push(b);
      e.boat = b.id; e.board = [];
      for (const x of g.isl) if (x.st === 'swim' && x.at === i && pax(g, b).length < CAP) { x.st = 'boat'; x.b = b.id; e.board.push(x.id); }
    } else if (back === 'shark' || back === 'oct') {
      const c2 = { id: g.nid++, k: back, at: i };
      g.cr.push(c2); e.cr = c2.id;
    } else if (back === 'reef') g.k[i] = 'F';
    else if (back === 'buoy' || back === 'tail') g.hand[g.turn][back]++;
    return e;
  }

  // ---------- the game ----------
  function log(g, e) { e.n = ++g.evn; g.ev.push(e); if (g.ev.length > 60) g.ev.splice(0, g.ev.length - 60); }
  function hasLand(g) { for (let i = 0; i < N; i++) if (g.k[i] === 'L') return true; return false; }

  function newGame(pl, rules, rnd, evn, opts) {
    rnd = rnd || cryptoRnd;
    opts = opts || {};
    const n = pl.length;
    const land = opts.land || genIsland(rnd, opts.size || LANDS[Math.min(4, Math.max(2, n))]);
    const { el, top } = elevations(land, rnd);
    const k = new Array(N).fill('S');
    for (const c of CORNERS) k[c] = 'H';
    const back = new Array(N).fill(null);
    const ids = [];
    for (let i = 0; i < N; i++) if (land[i]) { k[i] = 'L'; ids.push(i); }
    const bag = shuffle(bagFor(ids.length), rnd);
    ids.forEach((i, t) => { back[i] = bag[t]; });
    const g = {
      pl: pl.slice(), n, k, el, back, isl: [], boats: [], cr: [],
      hand: [0, 1, 2, 3].map(s => pl.includes(s) ? { buoy: 0, tail: 0 } : null),
      sunk: 0, total: ids.length, mid: Math.round(ids.length / 3), high: Math.round(ids.length * 2 / 3),
      turn: -1, first: -1, phase: 'place', die: null, steps: 0, tail: false, place: null,
      ev: [], evn: evn || 0, undo: [], over: false, res: null, nid: 1, quick: rules && rules.setup === 'quick',
    };
    for (const s of pl) for (const v of PEARLS[Math.min(4, Math.max(2, n))]) g.isl.push({ id: g.nid++, s, v, at: -1, b: -1, st: 'new', sw: false });
    g.cr.push({ id: g.nid++, k: 'crab', at: top });
    const sp = spread(g, 3, rnd);
    g.cr.push({ id: g.nid++, k: 'shark', at: sp[0] }, { id: g.nid++, k: 'oct', at: sp[1] }, { id: g.nid++, k: 'shark', at: sp[2] });
    g.first = opts.first != null ? opts.first : pick(pl, rnd);
    // placing: one islander at a time, round the table from the first player, then a boat each in the same order.
    // One order for everything: in bot matches the boat order made no measurable difference to who wins.
    const f = pl.indexOf(g.first), order = [];
    const per = g.isl.length / n;
    for (let r = 0; r < per + 1; r++) for (let t = 0; t < n; t++) order.push(pl[(f + t) % n]);
    g.place = { order, i: 0 };
    g.turn = order[0];
    log(g, { k: 'setup', first: g.first });
    if (g.quick) quickSetup(g, rnd);
    return g;
  }
  const placeKind = g => g.place && g.place.i < g.place.order.length ? (g.place.i < g.isl.length ? 'isl' : 'boat') : null;
  function placeCells(g) {
    const out = [], c = crab(g);
    if (placeKind(g) === 'isl') { for (let i = 0; i < N; i++) if (g.k[i] === 'L' && !(c && c.at === i) && !landIsl(g, i).length) out.push(i); }
    else for (let i = 0; i < N; i++) if (g.k[i] === 'S' && NB[i].some(j => g.k[j] === 'L') && !boatAt(g, i) && !crAt(g, i)) out.push(i);
    return out;
  }
  function placeMoves(g) {
    const s = g.turn, cells = placeCells(g);
    if (placeKind(g) === 'boat') return cells.map(at => ({ k: 'boat', at }));
    const vals = [...new Set(g.isl.filter(x => x.s === s && x.st === 'new').map(x => x.v))];
    const out = [];
    for (const v of vals) for (const at of cells) out.push({ k: 'place', v, at });
    return out;
  }
  function doPlace(g, a) {
    if (a.k === 'place') {
      const x = g.isl.find(y => y.s === g.turn && y.st === 'new' && y.v === a.v);
      x.st = 'land'; x.at = a.at;
      log(g, { k: 'place', s: g.turn, id: x.id, at: a.at });
    } else {
      const b = { id: g.nid++, at: a.at, dock: false };
      g.boats.push(b);
      log(g, { k: 'boat', s: g.turn, id: b.id, at: a.at });
    }
    g.place.i++;
    if (g.place.i >= g.place.order.length) { g.place = null; return true; }
    g.turn = g.place.order[g.place.i];
    return false;
  }
  // "Quick start": everyone's islanders and boats go down at random, the big ones a little more often up the hill
  function quickSetup(g, rnd) {
    while (g.place) {
      const ms = placeMoves(g);
      let a;
      if (placeKind(g) === 'isl') {
        const vals = [...new Set(ms.map(m => m.v))].sort((x, y) => y - x);
        const v = vals[0];
        const cells = ms.filter(m => m.v === v).map(m => m.at);
        const w = cells.map(i => 1 + g.el[i] * (v >= 3 ? 1.5 : 0.3));
        let x = rnd() * w.reduce((p, q) => p + q, 0), at = cells[0];
        for (let t = 0; t < cells.length; t++) { x -= w[t]; if (x <= 0) { at = cells[t]; break; } }
        a = { k: 'place', v, at };
      } else {
        // a boat near your own islanders
        const mine = g.isl.filter(x => x.s === g.turn && x.st === 'land');
        let best = null, bs = -1e9;
        for (const m of ms) { const sc = mine.reduce((p, x) => p + x.v / (1 + dist(x.at, m.at)), 0) + rnd() * 0.8; if (sc > bs) { bs = sc; best = m; } }
        a = best;
      }
      if (doPlace(g, a)) { startTurn(g, g.first, rnd); return; }
    }
  }
  function startTurn(g, s, rnd) {
    g.turn = s; g.phase = 'move'; g.steps = STEPS; g.tail = false; g.undo = [];
    for (const x of g.isl) x.sw = false;
    g.die = pick(FACES, rnd || cryptoRnd);
    log(g, { k: 'turn', s, die: g.die });
  }
  function afterCreature(g, rnd) {
    if (!g.isl.some(live)) return finish(g, 'all');
    const i = g.pl.indexOf(g.turn);
    startTurn(g, g.pl[(i + 1) % g.n], rnd);
  }
  function toCreature(g, rnd) {
    g.phase = 'cr';
    if (!crMoves(g).length) { log(g, { k: 'nocr', s: g.turn }); afterCreature(g, rnd); }
  }
  function finish(g, why) {
    for (const x of g.isl) if (live(x)) { x.st = 'lost'; x.how = 'tide'; }
    const rows = g.pl.map(s => {
      const mine = g.isl.filter(x => x.s === s);
      const saved = mine.filter(x => x.st === 'safe');
      return { s, pts: saved.reduce((p, x) => p + x.v, 0), saved: saved.length, of: mine.length, all: mine.map(x => ({ id: x.id, v: x.v, st: x.st, how: x.how || '' })) };
    });
    rows.sort((a, b) => b.pts - a.pts || b.saved - a.saved);
    const top = rows[0];
    g.res = { why, rows, win: rows.filter(r => r.pts === top.pts && r.saved === top.saved).map(r => r.s) };
    g.over = true; g.phase = 'over';
    log(g, { k: 'end', why, win: g.res.win });
  }
  const snap = g => JSON.stringify({ isl: g.isl, boats: g.boats, steps: g.steps, tail: g.tail, hand: g.hand });

  // every action the player to move could take now (bots and tests use this; the UI builds the same ones from taps)
  function legal(g) {
    if (g.over) return [];
    if (g.place) return placeMoves(g);
    if (g.phase === 'move') {
      const out = g.steps > 0 ? steps(g, g.turn) : [];
      if (g.hand[g.turn].tail > 0 && !g.tail) out.push({ k: 'tail' });
      out.push({ k: 'done' });
      return out;
    }
    if (g.phase === 'sink') return sinkable(g).map(at => ({ k: 'sink', at }));
    if (g.phase === 'dol') return dolMoves(g).concat([{ k: 'dol', skip: 1 }]);
    if (g.phase === 'cr') return crMoves(g).concat([{ k: 'cr', skip: 1 }]);
    return [];
  }
  const same = (a, b) => a.k === b.k && ['p', 'id', 'to', 'at', 'v', 'grab', 'push', 'skip'].every(f => (a[f] == null ? null : a[f]) === (b[f] == null ? null : b[f]));
  // shape an action that came over the network into a clean one (numbers only, known keys)
  function clean(a) {
    if (!a || typeof a !== 'object') return null;
    const o = { k: String(a.k || '') };
    if (a.p === 'i' || a.p === 'b') o.p = a.p;
    for (const f of ['id', 'to', 'at', 'v', 'grab', 'push']) if (a[f] != null && isFinite(a[f])) o[f] = a[f] | 0;
    if (a.skip) o.skip = 1;
    return o;
  }

  function act(g, seat, a0, rnd) {
    if (g.over) return 'over';
    if (seat !== g.turn) return 'turn';
    const a = clean(a0); if (!a) return 'bad';
    rnd = rnd || cryptoRnd;
    if (g.place) {
      if (a.k !== 'place' && a.k !== 'boat') return 'phase';
      if (!placeMoves(g).some(m => same(m, a))) return 'illegal';
      if (doPlace(g, a)) startTurn(g, g.first, rnd);
      return 'ok';
    }
    if (g.phase === 'move') {
      if (a.k === 'undo') {
        if (!g.undo.length) return 'illegal';
        Object.assign(g, JSON.parse(g.undo.pop()));
        log(g, { k: 'undo', s: seat });
        return 'ok';
      }
      if (a.k === 'tail') {
        if (!(g.hand[seat].tail > 0) || g.tail) return 'illegal';
        g.undo.push(snap(g));
        g.hand[seat].tail--; g.tail = true; g.steps += TAILWIND;
        log(g, { k: 'tail', s: seat });
        return 'ok';
      }
      if (a.k === 'done') { g.phase = 'sink'; g.undo = []; log(g, { k: 'done', s: seat }); return 'ok'; }
      if (a.k !== 'step' || g.steps <= 0) return 'phase';
      if (!steps(g, seat).some(m => same(m, a))) return 'illegal';
      g.undo.push(snap(g));
      const e = doStep(g, a);
      g.steps--;
      log(g, e);
      if (g.steps <= 0 && !(g.hand[seat].tail > 0 && !g.tail)) { g.phase = 'sink'; g.undo = []; }
      return 'ok';
    }
    if (g.phase === 'sink') {
      if (a.k !== 'sink') return 'phase';
      if (!sinkable(g).includes(a.at)) return 'illegal';
      const back = g.back[a.at];
      log(g, doSink(g, a.at));
      if (!hasLand(g)) { finish(g, 'sunk'); return 'ok'; }
      if (!g.isl.some(live)) { finish(g, 'all'); return 'ok'; }
      if (back === 'dolphin' && dolMoves(g).length) g.phase = 'dol';
      else toCreature(g, rnd);
      return 'ok';
    }
    if (g.phase === 'dol') {
      if (a.k !== 'dol') return 'phase';
      if (a.skip) { log(g, { k: 'dolskip', s: seat }); toCreature(g, rnd); return 'ok'; }
      const x = g.isl.find(y => y.id === a.id);
      if (!x || x.st !== 'swim') return 'illegal';
      const R = dolReach(g, x);
      if (!R.cells.includes(a.to)) return 'illegal';
      const path = R.path(a.to);
      const res = landOn(g, x, a.to);
      log(g, { k: 'dol', s: seat, id: x.id, path, res });
      if (!g.isl.some(live)) { finish(g, 'all'); return 'ok'; }
      toCreature(g, rnd);
      return 'ok';
    }
    if (g.phase === 'cr') {
      if (a.k !== 'cr') return 'phase';
      if (a.skip) { log(g, { k: 'crskip', s: seat }); afterCreature(g, rnd); return 'ok'; }
      const c = g.cr.find(y => y.id === a.id);
      if (!c) return 'illegal';
      const m = Object.assign({ k: 'cr', id: a.id, to: a.to }, c.k === 'oct' ? { grab: a.grab == null ? -1 : a.grab } : c.k === 'crab' ? { push: a.push == null ? -1 : a.push } : {});
      if (!crMoves(g).some(x => same(x, m))) return 'illegal';
      log(g, doCr(g, m));
      afterCreature(g, rnd);
      return 'ok';
    }
    return 'phase';
  }

  // what a player gets to see: everything except other players' pearls and the undersides of tiles still standing
  function view(g, seat) {
    const all = g.over;
    return {
      me: seat, pl: g.pl, n: g.n, turn: g.turn, first: g.first, phase: g.phase, die: g.die, steps: g.steps, tail: g.tail,
      k: g.k.slice(), el: g.el.slice(),
      isl: g.isl.map(x => ({ id: x.id, s: x.s, v: (all || x.s === seat) ? x.v : 0, at: x.at, b: x.b, st: x.st, sw: x.sw, how: all ? (x.how || '') : '' })),
      boats: g.boats.map(b => ({ id: b.id, at: b.at, dock: b.dock })),
      cr: g.cr.map(c => ({ id: c.id, k: c.k, at: c.at })),
      hand: g.hand.map(h => h && { buoy: h.buoy, tail: h.tail }),
      sunk: g.sunk, total: g.total, mid: g.mid, high: g.high,
      place: g.place ? { order: g.place.order, i: g.place.i } : null,
      undo: seat === g.turn ? g.undo.length : 0,
      ev: g.ev.slice(-30), evn: g.evn, over: g.over, res: g.res,
      // everyone's pearl total is public (every set is the same); what's hidden is who carries what
      pearls: PEARLS[Math.min(4, Math.max(2, g.n))],
    };
  }
  // a copy that bots can play moves on (from a view: hidden pearls stay 0, tiles have no known underside)
  function sim(v) {
    const g = JSON.parse(JSON.stringify(v));
    g.back = new Array(N).fill('none');
    g.undo = []; g.nid = 100000; g.ev = []; g.evn = 0;
    return g;
  }

  // ---------- the table: seats, rules, a running tally across games ----------
  const DEFAULT_RULES = { setup: 'place', timer: 0 };
  function cleanRules(r) {
    r = r || {};
    return { setup: r.setup === 'quick' ? 'quick' : 'place', timer: [0, 45, 90].includes(r.timer) ? r.timer : 0 };
  }
  class Table {
    constructor(o) {
      o = o || {};
      this.rules = cleanRules(o.rules);
      this.seats = [null, null, null, null];
      this.g = null; this.evn = 0; this.wins = [0, 0, 0, 0]; this.games = 0; this.counted = false;
    }
    start(rnd, opts) {
      const pl = [0, 1, 2, 3].filter(s => this.seats[s]);
      if (pl.length < 2) return 'few';
      this.g = newGame(pl, this.rules, rnd, this.evn, opts);
      this.counted = false;
      this.evn = this.g.evn;
      return 'ok';
    }
    act(s, a, rnd) {
      if (!this.g) return 'nogame';
      const r = act(this.g, s, a, rnd);
      this.evn = this.g.evn;
      if (this.g.over && !this.counted) { this.counted = true; this.games++; for (const w of this.g.res.win) this.wins[w]++; }
      return r;
    }
    pending() { const g = this.g; return !g || g.over ? [] : [g.turn]; }
    legal() { return this.g ? legal(this.g) : []; }
    view(s) {
      return {
        me: s, rules: Object.assign({}, this.rules), wins: this.wins.slice(), games: this.games,
        seats: this.seats.map(p => p && { name: p.name, bn: p.bot && p.bn >= 0 ? p.bn : -1, av: p.av, bot: !!p.bot, lv: p.lv || 0, conn: p.conn !== false, auto: !!p.auto }),
        g: this.g ? view(this.g, s) : null,
      };
    }
    toJSON() { return { rules: this.rules, seats: this.seats, g: this.g, evn: this.evn, wins: this.wins, games: this.games, counted: this.counted }; }
    static fromJSON(o) {
      const T = new Table({ rules: o.rules });
      T.seats = (o.seats || [null, null, null, null]).slice(0, 4);
      while (T.seats.length < 4) T.seats.push(null);
      T.g = o.g || null; T.evn = o.evn || (T.g ? T.g.evn : 0); T.wins = o.wins || [0, 0, 0, 0]; T.games = o.games || 0; T.counted = !!o.counted;
      return T;
    }
  }

  const MT = {
    RAD, CAP, STEPS, TAILWIND, LAND, LANDS, N, CELLS, NB, CORNERS, DIRS, FACES, SPEED, BACKS, PEARLS, DEFAULT_RULES,
    cellAt, dist, bagFor, seeded, cryptoRnd, shuffle, genIsland, elevations,
    live, landIsl, boatAt, boatById, pax, crAt, crab, room, coastal, steerers, canSteer, tide,
    islSteps, boatSteps, steps, sinkable, dolReach, dolMoves, reach, crTypes, crMoves, crMovesOf, crTargets, grabbable, pushCells, placeCells, placeMoves, placeKind,
    doStep, doSink, doCr, landOn, legal, same, clean, act, view, sim, newGame, finish, cleanRules, Table,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT;
  G.MT = MT;
})(typeof window !== 'undefined' ? window : globalThis);
