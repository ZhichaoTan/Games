// The game screen at several screen sizes, a level and a battle against three bots, in both looks: a screenshot of each after
// a few moves, and a check that the board, the numbers, the opponents' cards, the friend above the board and the buttons stay
// on the screen and clear of each other.
//   node match/dev/layout.js [zh|en] [WxH,WxH...] [pal|mm|both]
const L = require('./lib');
const lang = process.argv[2] || 'zh';
const SIZES = (process.argv[3] || '360x640,375x667,390x844,430x932,844x390,820x1180,1024x768,1280x800,1920x1080').split(',').map(x => x.split('x').map(Number));
const THEMES = (process.argv[4] || 'both') === 'both' ? ['pal', 'mm'] : [process.argv[4]];
function measure() {
  const r = e => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const vis = e => e && !e.hidden && e.offsetParent !== null && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
  const boxes = [];
  const add = (k, e) => { if (vis(e)) boxes.push([k, r(e)]); };
  const R = TTAPP.R, V = TTAPP.V, q = document.getElementById('game').getBoundingClientRect();
  boxes.push(['board', { l: q.left + R.bx - R.c * 0.12, t: q.top + R.by - R.c * 0.12, r: q.left + R.bx + R.c * (V.W + 0.12), b: q.top + R.by + R.c * (V.H + 0.12) }]);
  add('topbar', document.querySelector('#game .topbar'));
  document.querySelectorAll('#hud .hb').forEach((e, i) => add('hud' + i, e));
  document.querySelectorAll('#opps .opp').forEach((e, i) => add('opp' + i, e));
  add('tools', document.getElementById('tools'));
  add('buddy', document.getElementById('buddy'));
  const bad = [];
  const W = innerWidth, H = innerHeight;
  for (const [k, b] of boxes) if (b.l < -1 || b.t < -1 || b.r > W + 1 || b.b > H + 1) bad.push(`${k} off screen (${Math.round(b.l)},${Math.round(b.t)},${Math.round(b.r)},${Math.round(b.b)})`);
  const part = k => k.replace(/\d+$/, '');
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, A] = boxes[i], [b, B] = boxes[j];
    if (part(a) === part(b) && part(a) !== 'opp') continue;
    if ((a === 'buddy' && b === 'board') || (a === 'board' && b === 'buddy')) continue;   // it peeks over the board's rim
    const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l), oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
    if (ox > 1 && oy > 1) bad.push(`${a} overlaps ${b} by ${Math.round(ox)}x${Math.round(oy)}`);
  }
  document.querySelectorAll('#opps .nm, #hud .hb b, #hud .hb span, #tbInfo .chip span').forEach(e => { const cs = getComputedStyle(e); if (e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis') bad.push('text cut: ' + e.textContent.slice(0, 30)); });
  return { c: R.c, wide: !!R.wide, buddy: !document.getElementById('buddy').hidden, bad };
}
(async () => {
  const b = await L.launch();
  let bad = 0;
  for (const theme of THEMES) for (const [w, h] of SIZES) for (const kind of ['levels', 'versus']) {
    const tag = `${theme}-${lang}-${w}x${h}-${kind}`;
    const touch = w < 1000;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && w < 900 });
    const p = await L.open(b, { lang, ctx, query: `?theme=${theme}&autosolo=${kind}&n=24&foes=3&lv=2` });
    await L.waitFor(p, () => TTAPP.U.g && TTAPP.U.g.started && !TTAPP.U.cd, null, 10000);
    await p.evaluate(() => { const b = document.getElementById('tutOk'); if (b) b.click(); });
    for (let i = 0; i < 3; i++) await L.move(p, 3);
    await p.waitForTimeout(1200);
    const m = await p.evaluate(measure);
    await L.shot(p, `layout-${tag}`);
    if (m.bad.length) bad++;
    console.log(tag.padEnd(30), 'cell', String(m.c).padEnd(3), m.wide ? 'wide ' : '     ', m.buddy ? 'buddy' : '     ', m.bad.length ? '<<< ' + m.bad.join('; ') : 'ok');
    bad += L.report(p);
    await ctx.close();
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
