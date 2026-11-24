// ===== 萌宠消消乐 Puffy Pals / 团团圆圆 Mochi Moon · the bots =====
// A bot looks at the moves it notices, tries each one on a copy of the board and keeps the one it likes best. The copy gets
// its own random refills, so a bot can't foresee which mochi drop in next (nobody can); it only knows what a person could
// work out by looking. Levels differ in how many moves they notice, how loosely they judge, how much they value specials,
// and (in a battle) how long they take over each move.
(function (G) {
  'use strict';
  const MM = G.MM;
  // see: share of the possible moves noticed; noise: how loosely moves are judged; spec: how much a special made now is worth
  // later; think: ms per move in a battle (from the moment the board is still); goal: how much the level's goals count
  const LV = {
    1: { see: 0.32, noise: 0.55, spec: 0.3, think: 3300, goal: 0.6 },   // Rookie
    2: { see: 0.5, noise: 0.35, spec: 0.6, think: 2500, goal: 0.8 },    // Regular
    3: { see: 0.75, noise: 0.18, spec: 0.9, think: 1850, goal: 1 },     // Pro
    4: { see: 1, noise: 0.06, spec: 1, think: 1300, goal: 1 },          // Master
  };
  // what a special is worth before it is used (points, roughly what it clears)
  const SPEC_VAL = [0, 260, 260, 420, 330, 700, 0];

  // a person, roughly, for the balance checks: a beginner, a casual player and a practised one
  const PEOPLE = {
    beginner: { see: 0.3, noise: 0.6, spec: 0.25, think: 2900, goal: 0.6 },
    casual: { see: 0.45, noise: 0.4, spec: 0.5, think: 2200, goal: 0.8 },
    practised: { see: 0.8, noise: 0.15, spec: 0.9, think: 1500, goal: 1 },
  };

  // how much nearer the goals a game g2 is than g1 (in pieces' worth)
  function goalGain(g1, g2) {
    let v = 0;
    for (let k = 0; k < g1.goals.length; k++) {
      const a = g1.goals[k], b = g2.goals[k];
      if (a.t === 'score') continue;
      const left1 = g1.goalLeft(a), left2 = g2.goalLeft(b);
      const w = a.t === 'col' ? 1 : a.t === 'ing' ? 14 : a.t === 'box' ? 4 : a.t === 'cage' ? 3 : 3.2;
      v += (left1 - left2) * w;
    }
    // ingots: every row nearer the bottom counts a little
    if (g1.ing.total) v += (ingDepth(g2) - ingDepth(g1)) * 1.5;
    return v;
  }
  function ingDepth(g) { let d = 0; for (let i = 0; i < g.pc.length; i++) { const p = g.pc[i]; if (p && p.k === MM.ING) d += (i / g.W) | 0; } return d + g.ing.collected * g.H; }
  function specsOn(g) { const n = [0, 0, 0, 0, 0, 0, 0]; for (const p of g.pc) if (p && MM.isSpecial(p.k)) n[p.k]++; return n; }

  // how good a move is for a player of level L (higher is better)
  function value(g, mv, L, rnd) {
    const c = g.clone();
    c.rng.s = (rnd() * 4294967296) | 0;      // its own refills: no peeking at what drops in next
    const ok = mv[1] < 0 ? c.tap(mv[0]) : c.swap(mv[0], mv[1]);
    if (!ok) return -1e9;
    let v = (c.score - g.score) / 10;
    const s1 = specsOn(g), s2 = specsOn(c);
    for (let k = 1; k <= 5; k++) v += (s2[k] - s1[k]) * SPEC_VAL[k] / 10 * L.spec;
    if (g.mode === 'level') {
      v += goalGain(g, c) * 12 * L.goal;
      if (c.won && !g.won) v += 1e5;
      // spending a special is only worth it if it did something useful
    }
    return v;
  }
  // pick a move: the moves noticed, each judged with some noise
  function plan(g, lv, rnd) {
    rnd = rnd || Math.random;
    const L = typeof lv === 'object' ? lv : LV[lv] || LV[2];
    const all = g.moveList();
    if (!all.length) return null;
    let seen = all.filter(() => rnd() < L.see);
    // specials stand out: one sitting on the board is easy to spot
    for (const m of all) if (m[1] < 0 && !seen.includes(m) && rnd() < Math.min(1, L.see * 1.6)) seen.push(m);
    if (!seen.length) seen = [all[Math.floor(rnd() * all.length)]];
    if (seen.length > 26) seen = seen.sort(() => rnd() - 0.5).slice(0, 26);
    let best = null, bv = -Infinity;
    for (const m of seen) {
      // a swap can go either way; the special lands where the dragged piece goes
      const tries = m[1] < 0 ? [m] : [m, [m[1], m[0]]];
      for (const t of tries) {
        let v = value(g, t, L, rnd);
        v *= 1 + L.noise * gauss(rnd);
        v += L.noise * 6 * gauss(rnd);
        if (v > bv) { bv = v; best = t; }
      }
    }
    return best;
  }
  function gauss(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function exec(g, m) { if (!m) return false; return m[1] < 0 ? g.tap(m[0]) : g.swap(m[0], m[1]); }

  // a bot playing in real time: it waits for the board to be still, thinks a while, then makes its move
  class Bot {
    constructor(g, lv, rnd) {
      this.g = g;
      this.L = typeof lv === 'object' ? lv : LV[lv] || LV[2];
      this.rnd = rnd || Math.random;
      this.t = 0;
      this.wait = this.nextWait();
    }
    nextWait() { return this.L.think * (0.65 + 0.7 * this.rnd()); }
    step(dt) {
      const g = this.g;
      if (!g.started || g.over) return;
      g.tick(dt);
      if (!g.canAct()) return;
      this.t += dt;
      if (this.t < this.wait) return;
      this.t = 0; this.wait = this.nextWait();
      const m = plan(g, this.L, this.rnd);
      if (m) exec(g, m);
    }
  }

  G.MMAI = { LV, PEOPLE, SPEC_VAL, plan, exec, value, goalGain, Bot };
})(typeof window !== 'undefined' ? window : globalThis);
