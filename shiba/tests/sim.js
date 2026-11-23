// Bot checks:  node shiba/tests/sim.js [battles] [blocks]
// 1. How long each level lasts on its own in a battle well with no opponent (rows cleared over a number of blocks, dropped at once).
// 2. Bot battles in real time (simulated 16 ms steps): each level against the one below, with the usual attack rules.
// 3. Person-like players against each level (40 battles each): a beginner, a casual player and a practised one, played by the
//    same code with slower, looser settings. Their numbers are guesses at how people play on a phone, not measurements; they
//    are here so the levels keep the same steps when the bots change: a casual player should beat Rookie most of the time,
//    have an even game with Regular and a hard one with Pro, and only a practised player should take games off Master.
globalThis.window = globalThis;
require('../src/engine.js'); require('../src/ai.js');
const SB = globalThis.SB, AI = globalThis.SBAI;
const battles = +process.argv[2] || 40, blocks = +process.argv[3] || 600;
const rng = seed => { const st = { s: seed }; return () => SB.rnd(st); };

console.log('-- alone: rows cleared in', blocks, 'blocks, 4-row clears, topped out');
for (let lv = 1; lv <= 4; lv++) {
  let lines = 0, quads = 0, outs = 0, ms = 0;
  for (let k = 0; k < 6; k++) {
    const g = new SB.Game({ mode: 'versus', seed: 100 + k }); g.start();
    const r = rng(k + 1);
    for (let i = 0; i < blocks && !g.over; i++) {
      const t0 = process.hrtime.bigint();
      const p = AI.plan(g, lv, r);
      ms += Number(process.hrtime.bigint() - t0) / 1e6;
      AI.exec(g, p);
      if (g.clearing) g.tick(SB.CLEAR_MS + 1);
    }
    lines += g.lines; quads += g.stats.quads; if (g.over) outs++;
  }
  console.log(`level ${lv}: rows ${(lines / 6).toFixed(0)}, quads ${(quads / 6).toFixed(1)}, topped out ${outs}/6, ${(ms / (6 * blocks)).toFixed(2)} ms a decision`);
}

// A real-time battle between players of the given levels, with the host's rules: rows go to a random player still in.
// With person = true seat 0 is a person, and the round ends when they are out. Returns the winner's index (or -1).
function battle(levels, seed, person) {
  const r = rng(seed * 13 + 5);
  const games = levels.map((lv, i) => new SB.Game({ mode: 'versus', seed, gseed: seed * 31 + i }));
  const bots = games.map((g, i) => new AI.Bot(g, levels[i], rng(seed * 7 + i)));
  games.forEach(g => g.start());
  let t = 0;
  const alive = () => games.map((g, i) => (g.over ? -1 : i)).filter(i => i >= 0);
  while (alive().length > 1 && !(person && games[0].over) && t < 900000) {
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      if (g.over) continue;
      bots[i].step(16);
      for (const e of g.ev) if (e.k === 'clear' && e.send > 0) {
        const tg = alive().filter(j => j !== i);
        if (tg.length) games[tg[Math.floor(r() * tg.length)]].addBubbles(e.send);
      }
      g.ev.length = 0;
    }
    t += 16;
  }
  const a = alive();
  return { win: person ? (games[0].over ? 1 : 0) : a.length === 1 ? a[0] : -1, t };
}
let bad = 0;
console.log('-- battles (' + battles + ' each)');
for (const [a, b] of [[2, 1], [3, 2], [4, 3], [4, 1]]) {
  let wa = 0, wb = 0, tt = 0;
  for (let k = 0; k < battles; k++) {
    const flipSeats = k % 2;
    const res = battle(flipSeats ? [b, a] : [a, b], 1000 + k);
    tt += res.t;
    if (res.win < 0) continue;
    const winnerLv = (flipSeats ? [b, a] : [a, b])[res.win];
    if (winnerLv === a) wa++; else wb++;
  }
  const pct = Math.round((100 * wa) / Math.max(1, wa + wb));
  console.log(`level ${a} vs ${b}: ${wa}-${wb} (${pct}%), ${(tt / battles / 1000).toFixed(0)} s a battle`);
  if (pct < 60) bad++;
}
// a four-bot free-for-all ends
const ffa = battle([1, 2, 3, 4], 77);
console.log('four bots, levels 1-4: winner level', [1, 2, 3, 4][ffa.win], 'after', (ffa.t / 1000).toFixed(0), 's');

// people, roughly: how long they take over a block, how loosely they judge, how often they slip; the practised player keeps
// a column open for four-row clears and uses hold
const PEOPLE = {
  beginner: { ms: 2600, noise: 0.1, slip: 0.12, margin: 25, hold: false, look: false, quad: false },
  casual: { ms: 1900, noise: 0.08, slip: 0.1, margin: 22, hold: false, look: false, quad: false },
  practised: { ms: 1300, noise: 0.05, slip: 0.06, margin: 20, hold: true, look: false, quad: true, build: 10 },
};
Object.keys(PEOPLE).forEach((k, i) => { AI.LV[11 + i] = PEOPLE[k]; PEOPLE[k].lv = 11 + i; });
// [person, bot level, lowest and highest share of wins for the person]
const WANT = [['beginner', 1, 50, 100], ['casual', 1, 60, 100], ['casual', 2, 30, 70], ['casual', 3, 0, 45], ['casual', 4, 0, 10],
  ['practised', 3, 70, 100], ['practised', 4, 10, 55]];
console.log('-- people against bots (40 each)');
for (const [who, lv, lo, hi] of WANT) {
  let w = 0, tt = 0;
  for (let k = 0; k < 40; k++) { const res = battle([PEOPLE[who].lv, lv], 5000 + k, true); if (res.win === 0) w++; tt += res.t; }
  const pct = Math.round(100 * w / 40), ok = pct >= lo && pct <= hi;
  console.log(`${who} vs ${['', 'Rookie', 'Regular', 'Pro', 'Master'][lv]}: wins ${pct}% (want ${lo}-${hi}%), ${(tt / 40000).toFixed(0)} s a battle${ok ? '' : '  <<<'}`);
  if (!ok) bad++;
}
// the lobby's default: a casual player against two Regular bots
let w2 = 0;
for (let k = 0; k < 40; k++) if (battle([PEOPLE.casual.lv, 2, 2], 7000 + k, true).win === 0) w2++;
console.log(`casual vs two Regular: wins ${Math.round(100 * w2 / 40)}%`);
process.exit(bad ? 1 : 0);
