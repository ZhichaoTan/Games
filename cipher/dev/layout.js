// The table at several screen sizes with one, two and three opponents: a screenshot in the draw stage and one with the
// number pad open, and a check that names, notes and tiles keep clear of each other and nothing runs off the screen.
//   node dev/layout.js [zh|en] [WxH,WxH...] [opponents e.g. 1,2,3]
const L = require('./lib');
const lang = process.argv[2] || 'zh';
const SIZES = (process.argv[3] || '375x667,390x664,390x844,430x932,360x740,820x1180,1280x800').split(',').map(x => x.split('x').map(Number));
const OPPS = (process.argv[4] || '1,2,3').split(',').map(Number);
const MIN = 6;   // px between any text and a tile
// distances on the page: name plates to the tiles under them, tiles (and their notes) to whatever comes next
function measure() {
  const out = [], r = e => e.getBoundingClientRect();
  const tilesOf = el => [...el.querySelectorAll('.row .tile, .holdslot .tile')].map(r);
  const notesOf = el => [...el.querySelectorAll('.tile .bad')].map(r);
  const opps = [...document.querySelectorAll('#opps .opp')];
  opps.forEach((o, i) => {
    const nm = r(o.querySelector('.plate .nm')), ts = tilesOf(o), ns = notesOf(o), side = o.classList.contains('side');
    if (!ts.length) return;
    const top = Math.min(...ts.map(t => t.top)), bottom = Math.max(...ts.map(t => t.bottom), ...ns.map(t => t.bottom));
    const left = Math.min(...ts.map(t => t.left)), right = Math.max(...ts.map(t => t.right)), sc = r(o.querySelector('.pscore'));
    if (side) { out.push(['opp' + i + ' name→tiles (side)', left - nm.right]); out.push(['opp' + i + ' tiles→score', sc.left - right]); }
    else out.push(['opp' + i + ' name→tiles', top - nm.bottom]);
    const nx = opps[i + 1];
    const next = nx ? Math.min(r(nx.querySelector('.plate .nm')).top, ...tilesOf(nx).map(t => t.top)) : r(document.getElementById(document.getElementById('mid').offsetParent ? 'mid' : 'mine')).top;
    out.push(['opp' + i + ' tiles→next', next - bottom]);
  });
  const mine = document.getElementById('mine');
  if (!mine.hidden) {
    const ts = tilesOf(mine), ns = notesOf(mine), pl = r(document.querySelector('#myPlate .nm'));
    if (ts.length) {
      out.push(['my tiles→name', pl.top - Math.max(...ts.map(t => t.bottom), ...ns.map(t => t.bottom))]);
      const above = opps.length ? Math.max(...tilesOf(opps[opps.length - 1]).map(t => t.bottom), ...notesOf(opps[opps.length - 1]).map(t => t.bottom)) : 0;
      if (opps.length && !document.getElementById('mid').offsetParent) out.push(['last opp→my tiles', Math.min(...ts.map(t => t.top)) - above]);
    }
    const dock = document.getElementById('dock'), first = dock.firstElementChild;
    if (first) out.push(['my name→dock', r(first).top - pl.bottom]);
  }
  const dock = document.getElementById('dock');
  out.push(['dock bottom overflow', innerHeight - r(dock).bottom + 0.5]);
  const sizes = { mine: (document.getElementById('myRow').style.getPropertyValue('--tw')), opps: (opps[0] && opps[0].classList.contains('side') ? 'side ' : '') + opps.map(o => parseInt(o.querySelector('.row').style.getPropertyValue('--tw'))).join('/') };
  return { gaps: out.map(([k, d]) => [k, Math.round(d)]), sizes };
}
// wait until no tile is sliding, flipping or resizing (the looping glows and bobs don't count)
const settle = p => p.waitForFunction(() => document.getAnimations().every(a => { const t = a.effect && a.effect.target; return !t || a.playState !== 'running' || (a.effect.getTiming && a.effect.getTiming().iterations === Infinity); }), null, { timeout: 5000 }).catch(() => {});
(async () => {
  const b = await L.launch();
  let bad = 0;
  for (const [w, h] of SIZES) for (const opp of OPPS) {
    const tag = `${lang}-${w}x${h}-${opp}`;
    const p = await L.open(b, { lang, w, h, dpr: 1, ls: { mh_mm_prefs: JSON.stringify({ opp, bot: 2, speed: 'fast', tab: 'solo' }) } });
    await L.click(p, 'btnSolo');
    for (let i = 0; i < 100; i++) {   // through the deal, placing any key I got
      const ph = await p.evaluate(() => { const v = CXAPP.UI.view; return v && v.R ? v.R.phase + ':' + (v.opt ? v.opt.k : '') : ''; });
      if (ph.startsWith('play')) break;
      if (ph === 'setup:place') await L.playMove(p, 2).catch(() => {});
      await p.waitForTimeout(200);
    }
    // play until my third turn, so there are notes and open tiles on the table
    let turns = 0, shot = false, t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      const s = await p.evaluate(() => { const v = CXAPP.UI.view; return v && v.R ? v.R.phase + ':' + (v.opt ? v.opt.k : '') + ':' + (CXAPP.UI.busy ? 1 : 0) : ''; });
      if (s.startsWith('end')) break;
      if (s === 'play:draw:0') {
        turns++;
        if (turns >= 3) {
          await p.waitForTimeout(300); await settle(p);
          const m = await p.evaluate(measure);
          await L.shot(p, `layout-draw-${tag}`);
          report('draw', m);
          await L.playMove(p, 2);
          await L.waitFor(p, () => CXAPP.UI.view.opt && CXAPP.UI.view.opt.k === 'guess' && !CXAPP.UI.busy, null, 8000).catch(() => {});
          // pick the hidden tile with the most notes, or the first hidden one
          const u = await p.evaluate(() => { const ts = [...document.querySelectorAll('#opps .row.pick .tile.back')]; ts.sort((a, b) => b.querySelectorAll('.bad s').length - a.querySelectorAll('.bad s').length); return ts[0] && ts[0].dataset.u; });
          if (u) {
            await settle(p);
            await L.sel(p, `#opps .tile[data-u="${u}"]`).click({ force: true });
            await p.waitForTimeout(350); await settle(p);
            const m2 = await p.evaluate(measure);
            await L.shot(p, `layout-pad-${tag}`);
            report('pad', m2);
          }
          shot = true; break;
        }
      }
      if (s.endsWith(':0') && !s.startsWith('play::')) await L.playMove(p, 2).catch(() => {});
      await p.waitForTimeout(120);
    }
    if (!shot) console.log(tag, 'no shot (round ended early)');
    bad += L.report(p);
    await p.context().close();
    function report(k, m) {
      const low = m.gaps.filter(([n, d]) => n === 'dock bottom overflow' ? d < 0 : d < MIN);
      if (low.length) bad++;
      console.log(tag.padEnd(22), k.padEnd(4), 'tw', String(m.sizes.mine).padEnd(5), String(m.sizes.opps).padEnd(16), m.gaps.map(([n, d]) => n + ' ' + d).join(' | '), low.length ? '  <<< TIGHT' : '');
    }
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
