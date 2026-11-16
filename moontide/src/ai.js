// ===== 沉岛 Moontide · bots =====
// A bot only sees what a player sees (its own pearls, nobody else's). It scores a position by how likely each islander is to reach a
// lighthouse, weighted by pearls (its own known, everyone else's guessed at the average), and picks the action that scores best:
// a short beam search over its steps, then every possible sinking, dolphin ride and creature move.
(function (G) {
  'use strict';
  const MT = G.MT || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const { N, NB, CELLS } = MT;
  // per level: how much hurting others counts, how much randomness, how wide the step search is
  const LV = {
    1: { hurt: 0.12, noise: 1.6, beam: 3, plan: 0.5 },
    2: { hurt: 0.3, noise: 0.45, beam: 6, plan: 0.85 },
    3: { hurt: 0.42, noise: 0.08, beam: 10, plan: 1 },
  };

  // distances over the board from a set of start cells, moving only through cells ok() accepts
  function bfs(starts, ok) {
    const d = new Array(N).fill(99), q = [];
    for (const s of starts) { d[s] = 0; q.push(s); }
    for (let h = 0; h < q.length; h++) { const i = q[h]; for (const j of NB[i]) if (d[j] === 99 && ok(j)) { d[j] = d[i] + 1; q.push(j); } }
    return d;
  }
  function features(g) {
    const H = []; for (let i = 0; i < N; i++) if (g.k[i] === 'H') H.push(i);
    // to a lighthouse: by boat (open sea) and by swimming (sea and reef)
    const dBoat = bfs(H, j => g.k[j] === 'S');
    const dSwim = bfs(H, j => g.k[j] === 'S' || g.k[j] === 'F');
    // for people on land: how far to a boat with room (stepping onto the boat counts as a step)
    const roomy = g.boats.filter(b => !b.dock && MT.room(g, b)).map(b => b.at);
    const dToBoat = bfs(roomy, j => g.k[j] === 'L');
    // how far to open water from land (walking), for people who'd have to swim
    const water = []; for (let i = 0; i < N; i++) if (g.k[i] === 'S' || g.k[i] === 'F') water.push(i);
    const dToWater = bfs(water, j => g.k[j] === 'L');
    const sharks = g.cr.filter(c => c.k === 'shark'), octs = g.cr.filter(c => c.k === 'oct'), crab = g.cr.find(c => c.k === 'crab');
    const shark = new Array(N).fill(0), oct = new Array(N).fill(0), crabD = crab ? bfs([crab.at], j => g.k[j] === 'L') : null;
    for (const c of sharks) { const d = bfs([c.at], j => g.k[j] === 'S'); for (let i = 0; i < N; i++) if (d[i] <= 2) shark[i] += d[i] <= 1 ? 1 : 0.8; }
    for (const c of octs) { const d = bfs([c.at], j => g.k[j] === 'S'); for (let i = 0; i < N; i++) if (d[i] <= 2) oct[i] += d[i] <= 1 ? 1 : 0.7; else if (d[i] === 3) oct[i] += 0.2; }
    return { dBoat, dSwim, dToBoat, dToWater, shark, oct, crabD };
  }
  // how many of my own turns are left before the island is gone (roughly)
  const myTurns = g => Math.max(0, (g.total - g.sunk) / g.n);

  // chance an islander makes it, 0..1
  function chance(g, x, F, me) {
    if (x.st === 'safe') return 1;
    if (x.st === 'lost' || x.st === 'new') return 0;
    const left = myTurns(g);
    const others = g.n - 1;   // creature moves by others before this islander's owner moves again
    if (x.st === 'boat') {
      const b = MT.boatById(g, x.b); if (!b) return 0;
      const d = F.dBoat[b.at];
      const mine = MT.canSteer(g, x.s, b);
      let p = (mine ? 0.97 : 0.62) - 0.065 * Math.min(d, 8);
      if (d / 3 > left + 0.5) p *= 0.3;
      p -= Math.min(0.45, F.oct[b.at] * 0.22 * Math.min(2, others) / 2 + F.oct[b.at] * 0.08);
      return Math.max(0.02, p);
    }
    if (x.st === 'swim') {
      const d = F.dSwim[x.at];
      // a boat with room right here or next door is almost as good as being aboard
      let nearBoat = 0;
      for (const b of g.boats) if (!b.dock && MT.room(g, b) && (b.at === x.at || NB[x.at].includes(b.at))) nearBoat = 1;
      let p = 0.78 - 0.11 * Math.min(d, 7) + nearBoat * 0.16;
      if (d > left + 0.5) p *= 0.25;
      if (g.k[x.at] === 'F') p += 0.12; else p -= Math.min(0.62, F.shark[x.at] * 0.3 * (others >= 1 ? 1 : 0.4));
      return Math.max(0.01, Math.min(0.95, p));
    }
    // on land
    const el = g.el[x.at] < 0 ? 0 : g.el[x.at];
    const tb = F.dToBoat[x.at], tw = F.dToWater[x.at];
    let p = 0.5 + 0.045 * el - 0.05 * Math.min(tb, 6) - 0.015 * Math.min(tw, 5);
    if (tb >= 99) p -= 0.08;
    if (MT.coastal(g, x.at) && g.el[x.at] <= MT.tide(g)) p -= 0.06;   // the next wave could take this tile
    if (F.crabD && F.crabD[x.at] <= 2 && MT.coastal(g, x.at)) p -= 0.05;
    if (left < 2) p *= 0.6;
    return Math.max(0.03, p);
  }
  function guess(v) { return v.pearls.reduce((a, b) => a + b, 0) / v.pearls.length; }
  function score(g, me, cfg, avg) {
    const F = features(g);
    let s = 0;
    const lead = {};
    for (const x of g.isl) {
      const p = chance(g, x, F, me);
      if (x.s === me) s += x.v * p;
      else { const w = (x.v || avg) * p; lead[x.s] = (lead[x.s] || 0) + w; }
    }
    // hurting the player in front a little more
    const vals = Object.values(lead), top = vals.length ? Math.max(...vals) : 0;
    for (const k in lead) s -= cfg.hurt * lead[k] * (lead[k] >= top - 0.01 ? 1.25 : 1);
    return s;
  }
  const clone = g => JSON.parse(JSON.stringify(g));
  // apply one of my steps to a copy (no events, no turn changes)
  function stepOn(g, a) {
    const h = clone(g);
    MT.doStep(h, a);
    h.steps--;
    return h;
  }

  function decide(v, lv, rnd) {
    rnd = rnd || Math.random;
    const cfg = LV[lv] || LV[2];
    const me = v.me;
    const g0 = MT.sim(v.g || v);
    if (g0.over || g0.turn !== me) return null;
    const avg = guess(g0);
    const noisy = x => x + (rnd() - 0.5) * 2 * cfg.noise;
    const best = (cands, f) => { let b = null, bs = -1e9; for (const c of cands) { const s = noisy(f(c)); if (s > bs) { bs = s; b = c; } } return b; };

    if (g0.place) return place(g0, me, cfg, rnd);
    if (g0.phase === 'move') return move(g0, me, cfg, avg, rnd);
    if (g0.phase === 'sink') {
      const L = MT.sinkable(g0);
      return { k: 'sink', at: best(L, at => { const h = clone(g0); MT.doSink(h, at); return score(h, me, cfg, avg); }) };
    }
    if (g0.phase === 'dol') {
      const L = MT.dolMoves(g0);
      const base = score(g0, me, cfg, avg);
      let b = null, bs = base + 0.05;
      for (const m of L) {
        const h = clone(g0); const x = h.isl.find(y => y.id === m.id); MT.landOn(h, x, m.to);
        const s = noisy(score(h, me, cfg, avg));
        if (s > bs) { bs = s; b = m; }
      }
      return b || { k: 'dol', skip: 1 };
    }
    if (g0.phase === 'cr') {
      const L = MT.crMoves(g0);
      const base = score(g0, me, cfg, avg);
      let b = null, bs = base + 0.02;
      for (const m of L) {
        const h = clone(g0); MT.doCr(h, m);
        // a creature left right next to my own people is a small worry for later
        const s = noisy(score(h, me, cfg, avg)) - 0.04 * near(h, m, me);
        if (s > bs) { bs = s; b = m; }
      }
      return b || { k: 'cr', skip: 1 };
    }
    return null;
  }
  function near(h, m, me) {
    let n = 0;
    for (const x of h.isl) if (x.s === me && (x.st === 'swim' || x.st === 'boat') && MT.dist(x.at, m.to) <= 2) n += x.v;
    return n;
  }

  // beam search over this turn's steps: the best line's first step and its score
  function plan(g0, me, cfg, avg, rnd, n) {
    const K = cfg.beam;
    const start = score(g0, me, cfg, avg);
    let beam = [{ g: g0, first: null, s: start }];
    let bestLine = { first: null, s: start + 0.01 };
    const seen = new Set();
    for (let d = 0; d < n; d++) {
      const next = [];
      for (const node of beam) {
        for (const a of MT.steps(node.g, me)) {
          const h = stepOn(node.g, a);
          const key = h.isl.map(x => x.at + x.st + x.b).join() + '|' + h.boats.map(b => b.at).join();
          if (seen.has(key)) continue; seen.add(key);
          const s = score(h, me, cfg, avg) + (rnd() - 0.5) * cfg.noise * 0.6;
          next.push({ g: h, first: node.first || a, s });
        }
      }
      if (!next.length) break;
      next.sort((a, b) => b.s - a.s);
      beam = next.slice(0, K);
      if (beam[0].s > bestLine.s) bestLine = beam[0];
    }
    return bestLine;
  }
  function move(g0, me, cfg, avg, rnd) {
    const h = g0.hand[me], canTail = h && h.tail > 0 && !g0.tail;
    const base = g0.steps > 0 ? plan(g0, me, cfg, avg, rnd, g0.steps) : { first: null, s: score(g0, me, cfg, avg) };
    // a tailwind: two more steps, worth it when they make a real difference (checked at the start of the turn, or when out of steps)
    if (canTail && (g0.steps === MT.STEPS || g0.steps === 0)) {
      const more = plan(g0, me, cfg, avg, () => 0.5, g0.steps + MT.TAILWIND);
      if (more.s - base.s > (g0.steps ? 1.1 : 0.6)) return { k: 'tail' };
    }
    return base.first || { k: 'done' };
  }

  // setting up: the big pearls go somewhere high, the small ones anywhere; boats go where my people are
  function place(g, me, cfg, rnd) {
    const ms = MT.placeMoves(g);
    if (MT.placeKind(g) === 'boat') {
      const mine = g.isl.filter(x => x.s === me && x.st === 'land');
      let b = null, bs = -1e9;
      for (const m of ms) {
        let s = mine.reduce((p, x) => p + x.v / (1 + MT.dist(x.at, m.at)), 0);
        for (const c of g.cr) if (c.k === 'oct' && MT.dist(c.at, m.at) <= 2) s -= 1.5;
        s += (rnd() - 0.5) * cfg.noise * 2;
        if (s > bs) { bs = s; b = m; }
      }
      return b;
    }
    const vals = [...new Set(ms.map(m => m.v))].sort((a, b) => b - a);
    const v = cfg.plan < 0.6 && rnd() < 0.4 ? vals[Math.floor(rnd() * vals.length)] : vals[0];
    const crab = MT.crab(g);
    let b = null, bs = -1e9;
    for (const m of ms) {
      if (m.v !== v) continue;
      const el = g.el[m.at];
      let s = (v >= 3 ? 1.1 : 0.35) * el;
      // not right beside the crab, and not crowded by my own (spread the risk)
      if (crab && MT.dist(crab.at, m.at) <= 1) s -= 0.6;
      for (const x of g.isl) if (x.s === me && x.st === 'land' && MT.dist(x.at, m.at) <= 1) s -= 0.25;
      // a short way to open sea is handy later
      s -= 0.12 * Math.min(4, CELLS[m.at].d);
      s += (rnd() - 0.5) * cfg.noise * 2 + rnd() * 0.3;
      if (s > bs) { bs = s; b = m; }
    }
    return b;
  }

  const AI = { decide, score, chance, features, LV };
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  G.MTAI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
