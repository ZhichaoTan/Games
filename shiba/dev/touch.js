// Touch play on a phone with real touch events: swipe mode (tap to turn, drag to move, slow drag down, flick down to drop,
// flick up to hold, tap the hold box, pat the shiba), then button mode from the menu (each button, and holding an arrow).
// node shiba/dev/touch.js [zh|en] [width] [height]
const L = require('./lib');
const assert = require('assert');
(async () => {
  const [lang = 'zh', w = 390, h = 844] = process.argv.slice(2);
  const b = await L.launch();
  const p = await L.open(b, { lang, w: +w, h: +h, query: '?autosolo=marathon', ls: { mh_sb_tip: '1' } });
  await L.waitFor(p, () => SBAPP.U.g && SBAPP.U.g.started && !SBAPP.U.cd, null, 8000);
  const cdp = await p.context().newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  // a finger from (x0, y0) to (x1, y1) in `ms`
  async function swipe(x0, y0, x1, y1, ms, steps = 10) {
    await touch('touchStart', x0, y0);
    for (let i = 1; i <= steps; i++) { await p.waitForTimeout(ms / steps); await touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); }
    await touch('touchEnd');
  }
  async function tap(x, y) { await touch('touchStart', x, y); await p.waitForTimeout(60); await touch('touchEnd'); }
  // A flick is too quick for touch events sent one by one from here (each takes about 40 ms), so it is played inside the
  // page as pointer events every 16 ms, the way a phone delivers them.
  const flick = (x0, y0, x1, y1, ms) => p.evaluate(([x0, y0, x1, y1, ms]) => new Promise(res => {
    const st = document.getElementById('stage'), o = (x, y) => ({ pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true });
    (document.elementFromPoint(x0, y0) || st).dispatchEvent(new PointerEvent('pointerdown', o(x0, y0)));
    const n = Math.max(2, Math.round(ms / 16)); let i = 0;
    const iv = setInterval(() => {
      i++; const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      st.dispatchEvent(new PointerEvent('pointermove', o(x, y)));
      if (i >= n) { clearInterval(iv); setTimeout(() => { st.dispatchEvent(new PointerEvent('pointerup', o(x1, y1))); res(); }, 8); }
    }, 16);
  }), [x0, y0, x1, y1, ms]);
  const cur = () => p.evaluate(() => { const g = SBAPP.U.g, c = g.cur; return c ? { t: c.t, x: c.x, y: c.y, r: c.r, pieces: g.stats.pieces, hold: g.holdT, used: g.holdUsed } : null; });
  const fresh = async () => { await L.waitFor(p, () => { const g = SBAPP.U.g; return g.cur && !g.clearing && g.cur.y < 22; }, null, 4000); return cur(); };
  const well = await p.evaluate(() => { const r = document.getElementById('cvWell').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, c: SBAPP.R.c }; });
  const mx = well.x + well.w / 2, my = well.y + well.h * 0.55, c = well.c;
  console.log('cell', c, 'px');

  // tap: turn clockwise (the O block turns too, it just looks the same)
  let a = await fresh();
  await tap(mx, my); await p.waitForTimeout(80);
  let z = await cur();
  assert.strictEqual(z.r, (a.r + 1) % 4, 'tap did not turn: ' + JSON.stringify([a, z]));
  // drag right about three cells, then left about three cells
  a = await cur();
  await swipe(mx - 2 * c, my, mx - 2 * c + 3.3 * c * 0.9, my, 260);
  z = await cur();
  assert.ok(z.x - a.x >= 2 && z.x - a.x <= 4, 'drag right moved ' + (z.x - a.x));
  a = z;
  await swipe(mx + 2 * c, my, mx + 2 * c - 3.3 * c * 0.9, my, 260);
  z = await cur();
  assert.ok(a.x - z.x >= 2 && a.x - z.x <= 4, 'drag left moved ' + (a.x - z.x));
  console.log('tap turns, drags move', Math.abs(z.x - a.x), 'cells');
  // a slow drag down brings the block down without dropping it
  a = await cur();
  await swipe(mx, my - 3 * c, mx, my + 1 * c, 700, 14);
  z = await cur();
  assert.strictEqual(z.pieces, a.pieces, 'a slow drag dropped the block');
  assert.ok(z.y - a.y >= 3, 'slow drag moved down only ' + (z.y - a.y));
  // a flick down drops it at once
  a = await cur();
  await flick(mx, my - 3 * c, mx, my + 1.5 * c, 90);
  await p.waitForTimeout(80);
  z = await cur();
  assert.strictEqual(z.pieces, a.pieces + 1, 'flick down did not drop');
  // a flick up holds it
  a = await fresh();
  assert.ok(!a.used);
  await flick(mx, my + 2 * c, mx, my - 2 * c, 100);
  await p.waitForTimeout(80);
  z = await cur();
  assert.strictEqual(z.hold, a.t, 'flick up did not hold');
  // the hold box can't be used twice for one block, so drop, then tap the box
  await flick(mx, my - 3 * c, mx, my + 1.5 * c, 90);
  a = await fresh();
  const hb = await p.evaluate(() => { const r = document.getElementById('holdBox').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await tap(hb.x, hb.y); await p.waitForTimeout(80);
  z = await cur();
  assert.strictEqual(z.hold, a.t, 'tapping the hold box did not hold');
  // pat the shiba
  const pp = await p.evaluate(() => { const r = document.getElementById('pup').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await tap(pp.x, pp.y); await p.waitForTimeout(100);
  assert.strictEqual(await p.evaluate(() => SBAPP.U.mood), 'love', 'patting the shiba did nothing');
  console.log('swipe mode: drops, holds, hold box and the shiba all work');
  await L.shot(p, `touch-swipe-${lang}`);

  // ----- switch to buttons in the menu -----
  await p.evaluate(() => document.getElementById('btnMenu').click());
  await L.waitFor(p, () => !!document.querySelector('#sheet [data-ctl="pad"]'));
  await p.evaluate(() => document.querySelector('#sheet [data-ctl="pad"]').click());
  await L.waitFor(p, () => !document.getElementById('pad').hidden);
  await p.waitForTimeout(150); await L.shot(p, `touch-menu-pad-${lang}`);
  await p.evaluate(() => document.getElementById('mResume').click());
  await L.waitFor(p, () => !SBAPP.U.paused && !SBAPP.U.cd, null, 5000);
  const btn = k => p.evaluate(k => { const r = document.querySelector(`#pad [data-k="${k}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, k);
  const press = async k => { const q = await btn(k); await tap(q.x, q.y); await p.waitForTimeout(70); };
  a = await fresh();
  await press('right'); z = await cur(); assert.strictEqual(z.x, a.x + 1, 'right button');
  await press('left'); await press('left'); z = await cur(); assert.strictEqual(z.x, a.x - 1, 'left button');
  a = await cur(); await press('cw'); z = await cur(); assert.strictEqual(z.r, (a.r + 1) % 4, 'turn button');
  a = await cur(); await press('ccw'); z = await cur(); assert.strictEqual(z.r, (a.r + 3) % 4, 'turn-back button');
  a = await cur(); await press('drop'); await p.waitForTimeout(60); z = await cur(); assert.strictEqual(z.pieces, a.pieces + 1, 'drop button');
  a = await fresh(); await press('hold'); z = await cur(); assert.strictEqual(z.hold, a.t, 'hold button');
  // holding the left arrow slides the block to the wall
  a = await fresh();
  const q = await btn('left');
  await touch('touchStart', q.x, q.y); await p.waitForTimeout(650); await touch('touchEnd');
  z = await cur();
  const minX = await p.evaluate(() => { const g = SBAPP.U.g, c = g.cur; return c.x + Math.min(...SB.CELLS[c.t][c.r].map(v => v[0])); });
  assert.strictEqual(minX, 0, 'holding left did not reach the wall: ' + JSON.stringify([a, z]));
  // holding the down button brings it down faster than falling
  a = await cur();
  const d = await btn('down');
  await touch('touchStart', d.x, d.y); await p.waitForTimeout(300); await touch('touchEnd');
  z = await cur();
  assert.ok(z.pieces > a.pieces || z.y - a.y >= 3, 'down button: ' + JSON.stringify([a, z]));
  await L.shot(p, `touch-pad-${lang}`);
  console.log('button mode: every button works, holding an arrow slides to the wall');
  const bad = L.report(p);
  await b.close();
  console.log(bad ? 'ERRORS' : 'touch check passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
