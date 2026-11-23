// The game screen at several screen sizes, solo and in a battle against three bots: a screenshot of each after a few blocks,
// and a check that the well, the side columns, the opponents' cards and the buttons stay on the screen and clear of each other.
//   node shiba/dev/layout.js [zh|en] [WxH,WxH...] [touch|keys]
const L = require('./lib');
const lang = process.argv[2] || 'zh';
const SIZES = (process.argv[3] || '360x640,375x667,390x844,430x932,844x390,820x1180,1024x768,1280x800,1920x1080').split(',').map(x => x.split('x').map(Number));
function measure() {
  const r = e => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const vis = e => e && !e.hidden && e.offsetParent !== null && e.getBoundingClientRect().width > 0;
  const boxes = [];
  const add = (k, e) => { if (vis(e)) boxes.push([k, r(e)]); };
  add('topbar', document.querySelector('#game .topbar'));
  add('well', document.getElementById('wellbox'));
  document.querySelectorAll('#play .side').forEach((e, i) => add('side' + (e.classList.contains('l') ? 'L' : 'R'), e));
  document.querySelectorAll('#opps .opp').forEach((e, i) => add('opp' + i, e));
  add('pad', document.getElementById('pad'));
  add('ktip', document.getElementById('ktip'));
  const bad = [];
  const W = innerWidth, H = innerHeight;
  for (const [k, b] of boxes) if (b.l < -1 || b.t < -1 || b.r > W + 1 || b.b > H + 1) bad.push(`${k} off screen (${Math.round(b.l)},${Math.round(b.t)},${Math.round(b.r)},${Math.round(b.b)})`);
  // the side columns sit inside the play area, so only pairs from different parts are compared
  const part = k => k.startsWith('opp') ? 'opps' : k;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, A] = boxes[i], [b, B] = boxes[j];
    if (part(a) === part(b) && a.startsWith('opp')) continue;
    const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l), oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
    if (ox > 1 && oy > 1) bad.push(`${a} overlaps ${b} by ${Math.round(ox)}x${Math.round(oy)}`);
  }
  // the opponents' cards next to each other must not overlap
  const opps = boxes.filter(([k]) => k.startsWith('opp'));
  for (let i = 0; i < opps.length; i++) for (let j = i + 1; j < opps.length; j++) {
    const A = opps[i][1], B = opps[j][1], ox = Math.min(A.r, B.r) - Math.max(A.l, B.l), oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
    if (ox > 1 && oy > 1) bad.push(`${opps[i][0]} overlaps ${opps[j][0]}`);
  }
  // text that is cut off in the cards and the side column
  document.querySelectorAll('#opps .nm, #stats .stat b, #stats .stat span').forEach(e => { if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis') bad.push('text cut: ' + e.textContent); });
  return { c: SBAPP.R.c, m: SBAPP.R.m, narrow: !!SBAPP.R.narrow, wide: !!SBAPP.R.wide, bad };
}
(async () => {
  const b = await L.launch();
  let bad = 0;
  for (const [w, h] of SIZES) for (const kind of ['marathon', 'versus']) {
    const tag = `${lang}-${w}x${h}-${kind}`;
    const touch = w < 1000 && (process.argv[4] || (w < 900 ? 'touch' : 'keys')) === 'touch';
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && w < 900 });
    const p = await L.open(b, { lang, ctx, query: `?autosolo=${kind}&foes=3&lv=2`, ls: { mh_sb_tip: '1', mh_sb_tip_aim: '1' } });
    await L.waitFor(p, () => SBAPP.U.g && SBAPP.U.g.started && !SBAPP.U.cd, null, 10000);
    for (let i = 0; i < 12; i++) if (!(await L.keyMove(p, { lv: 3 }))) await p.waitForTimeout(60);
    await p.waitForTimeout(900);
    const m = await p.evaluate(measure);
    await L.shot(p, `layout-${tag}`);
    if (m.bad.length) bad++;
    console.log(tag.padEnd(28), 'cell', String(m.c).padEnd(3), kind === 'versus' ? 'mini ' + String(m.m).padEnd(3) : '        ', m.narrow ? 'narrow' : m.wide ? 'wide  ' : '      ', m.bad.length ? '<<< ' + m.bad.join('; ') : 'ok');
    bad += L.report(p);
    await ctx.close();
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
