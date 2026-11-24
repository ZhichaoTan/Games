// Balance checks by simulation:  node match/tests/sim.js [--boards=40] [--rounds=60]
// 1. Levels: a simulated casual player (MMAI.PEOPLE.casual) plays every level on many boards with the level's moves. The win
//    rate should start high and come down slowly; no level should be a wall.
// 2. Time Rush and battles: the four bot levels play 90-second games in real time steps (they wait for each move to play out
//    and think as long as their level says). Their scores must climb with the level, and the simulated people should land
//    between them: a beginner near Rookie, a casual player near Regular, a practised one near Pro.
// 3. Battles with cages: four players on the same board, big moves throw cages at the leader. Each level should win more
//    often than the one below it, and the leader should catch most cages.
// The people here are guesses at how someone plays on a phone, so the numbers are a guide, not a measurement.
globalThis.window = globalThis;
require('../src/engine.js'); require('../src/ai.js'); require('../src/levels.js');
const { Game } = MM, AI = MMAI, LV = MMLV;
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const BOARDS = arg('boards', 40), ROUNDS = arg('rounds', 60);
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log('  <<< ' + what); } };
const rng = s => { const st = { s }; return () => MM.rnd(st); };

// ---------- 1. levels ----------
console.log(`Levels: a casual player, ${BOARDS} boards each`);
const rate = [];
for (let n = 1; n <= LV.COUNT; n++) {
  let won = 0;
  for (let b = 0; b < BOARDS; b++) {
    const g = new Game(Object.assign(LV.spec(n, 5000 + b * 7919), { rec: false }));
    g.start();
    const R = rng(900 + b);
    while (!g.over) { const m = AI.plan(g, AI.PEOPLE.casual, R); if (!m) break; AI.exec(g, m); g.busy = 0; }
    if (g.won) won++;
  }
  rate.push(won / BOARDS);
}
for (let c = 0; c < 6; c++) {
  const r = rate.slice(c * 10, c * 10 + 10);
  console.log(`  stop ${c + 1}: ` + r.map(x => String(Math.round(x * 100)).padStart(3)).join(' ') + `   mean ${Math.round(r.reduce((a, b) => a + b, 0) / r.length * 100)}%`);
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
check(mean(rate.slice(0, 10)) >= 0.8, 'the first ten levels are too hard');
check(Math.min(...rate) >= 0.3, 'a level is a wall: ' + rate.map((x, i) => [i + 1, x]).filter(([, x]) => x < 0.3).map(([n]) => n).join(','));
check(mean(rate.slice(50)) >= 0.4 && mean(rate.slice(50)) <= mean(rate.slice(0, 10)), 'the last stop is out of line');

// ---------- 2. bots and people in a 90-second game ----------
// one 90-second game played in 50 ms steps by a player of settings L (a bot level or one of the people)
function timeGame(seed, L, R, cagesIn) {
  const g = new Game({ mode: 'time', seed, time: 90000, colors: 6, rec: false });
  const bot = new AI.Bot(g, L, R);
  g.start();
  let t = 0;
  while (!g.over && t < 120000) { bot.step(50); t += 50; if (cagesIn) cagesIn(g, t); }
  return g;
}
console.log('\n90-second games, the same 24 boards for everyone (mean score):');
const who = [['Rookie', AI.LV[1]], ['Regular', AI.LV[2]], ['Pro', AI.LV[3]], ['Master', AI.LV[4]], ['beginner', AI.PEOPLE.beginner], ['casual', AI.PEOPLE.casual], ['practised', AI.PEOPLE.practised]];
const avg = {};
for (const [name, L] of who) {
  let sum = 0, moves = 0;
  for (let b = 0; b < 24; b++) { const g = timeGame(77 + b * 101, L, rng(31 + b)); sum += g.score; moves += g.used; }
  avg[name] = sum / 24;
  console.log(`  ${name.padEnd(10)} ${String(Math.round(avg[name])).padStart(6)}   ${(moves / 24).toFixed(1)} moves`);
}
check(avg.Rookie < avg.Regular && avg.Regular < avg.Pro && avg.Pro < avg.Master, 'the bot levels are out of order');
check(avg.casual > avg.Rookie && avg.casual < avg.Pro, 'a casual player is not between Rookie and Pro');
check(avg.practised > avg.Regular, 'a practised player loses to Regular');

// ---------- 3. battles with cages ----------
// the page's rule (src/app/40-battle.js cagesOf): a combo throws 2 (two fireworks 3), a firework 2, a chain of 3+ waves wave-1
// (4+ waves 3); at most 4 per move
function cagesOf(acc, e) {
  if (e.k === 'combo') acc.n += e.type === 'ww' ? 3 : 2;
  else if (e.k === 'special' && e.kind === 'fw' && !e.chain) acc.n += 2;
  else if (e.k === 'done') { const n = Math.min(4, acc.n + (e.wave >= 4 ? 3 : e.wave >= 2 ? e.wave - 1 : 0)); acc.n = 0; return n; }
  return 0;
}
function battle(seed, players, atk) {
  const ps = players.map((L, k) => { const g = new Game({ mode: 'time', seed, time: 90000, colors: 6, rec: false }); return { g, bot: new AI.Bot(g, L, rng(seed + k * 13)), acc: { n: 0 }, sent: 0, got: 0 }; });
  ps.forEach(p => p.g.start());
  const pick = rng(seed * 3 + 1);
  for (let t = 0; t < 100000 && ps.some(p => !p.g.over); t += 50) {
    for (const p of ps) {
      p.bot.step(50);
      for (const e of p.g.ev.splice(0)) {
        const n = cagesOf(p.acc, e);
        if (!n || !atk) continue;
        const others = ps.filter(q => q !== p && !q.g.over);
        if (!others.length) continue;
        const top = Math.max(...others.map(q => q.g.score)), cand = others.filter(q => q.g.score === top);
        const tg = cand[Math.floor(pick() * cand.length)];
        p.sent += n; tg.got += tg.g.addCages(n);
      }
    }
  }
  const best = Math.max(...ps.map(p => p.g.score));
  return ps.map(p => ({ sc: p.g.score, won: p.g.score === best, sent: p.sent, got: p.got }));
}
for (const atk of [true, false]) {
  const names = ['Rookie', 'Regular', 'Pro', 'Master'], wins = [0, 0, 0, 0], sc = [0, 0, 0, 0], sent = [0, 0, 0, 0], got = [0, 0, 0, 0];
  for (let r = 0; r < ROUNDS; r++) {
    const res = battle(1000 + r * 37, [AI.LV[1], AI.LV[2], AI.LV[3], AI.LV[4]], atk);
    res.forEach((x, k) => { if (x.won) wins[k]++; sc[k] += x.sc; sent[k] += x.sent; got[k] += x.got; });
  }
  console.log(`\nBattles, four bot levels, ${ROUNDS} rounds, cages ${atk ? 'on' : 'off'}:`);
  names.forEach((nm, k) => console.log(`  ${nm.padEnd(8)} won ${String(wins[k]).padStart(3)}   mean ${String(Math.round(sc[k] / ROUNDS)).padStart(6)}` + (atk ? `   threw ${(sent[k] / ROUNDS).toFixed(1)}   caught ${(got[k] / ROUNDS).toFixed(1)}` : '')));
  check(wins[3] > wins[1] && wins[2] > wins[0], 'battles: stronger bots do not win more');
  if (atk) check(got[3] >= got[0], 'battles: the leader does not catch the most cages');
}
// a casual person against three Regular bots, cages on: they should win a fair share (a quarter would be even)
{
  let w = 0;
  for (let r = 0; r < ROUNDS; r++) if (battle(5000 + r * 41, [AI.PEOPLE.casual, AI.LV[2], AI.LV[2], AI.LV[2]], true)[0].won) w++;
  console.log(`\nA casual player against three Regular bots: won ${w} of ${ROUNDS}`);
  check(w >= ROUNDS * 0.12 && w <= ROUNDS * 0.5, 'a casual player against Regular bots is out of line');
}
console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
process.exit(bad ? 1 : 0);
