// Shared helpers for the browser checks in this folder (Playwright is expected to be installed globally).
// A static server must serve the repo root:  python3 -m http.server 8080 --bind 127.0.0.1
// Online checks also need a local signalling server:  npx -p peer peerjs --port 9000 --host 127.0.0.1
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://127.0.0.1:8080/moontide/index.html';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
try { require('fs').mkdirSync(SHOTS, { recursive: true }); } catch (e) {}
async function launch() { return chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] }); }
async function open(browser, o = {}) {
  const w = o.w || 390, h = o.h || 844;
  const ctx = o.ctx || await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr || 2, hasTouch: w < 700, isMobile: w < 700 });
  return page(ctx, o);
}
// a page in a browser context (a context keeps its localStorage, so a second page in it is the same person coming back)
async function page(ctx, o = {}) {
  const lang = o.lang || 'zh';
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  p.on('console', m => { if (m.type() == 'error' && !/ERR_|net::|WebSocket|Failed to load resource|Could not connect to peer|Lost connection to server|peer-unavailable|Negotiation of connection/.test(m.text())) p.errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(a => { try { if (!sessionStorage.mtInit) { sessionStorage.mtInit = 1; localStorage.mh_lang = JSON.stringify(a.lang); if (a.name) localStorage.mh_name = JSON.stringify(a.name); for (const k in (a.ls || {})) localStorage[k] = a.ls[k]; } } catch (e) {} },
    { lang, name: o.name === undefined ? (lang == 'zh' ? '阿超' : 'Zed') : o.name, ls: o.ls });
  await p.goto(BASE + (o.query || '') + (o.hash || ''));
  await p.waitForTimeout(400);
  return p;
}
// tap a cell of the board (a real pointer tap at the cell's centre on screen)
async function tapCell(p, c) {
  const pt = await p.evaluate(c => MTAPP.board.clientXY(c), c);
  await p.mouse.click(pt.x, pt.y);
}
const shot = (p, name, full) => p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full });
const click = (p, id) => p.evaluate(id => document.getElementById(id).click(), id);
const waitFor = (p, fn, arg, ms = 15000) => p.waitForFunction(fn, arg, { timeout: ms });
// One action on this page, if it is this player's turn, done the way a person would: by tapping the board and the dock.
// Returns 'over', 'wait' or 'acted'. ctx collects counts ({taps, turns}) and may carry snap(name) for screenshots.
const state = p => p.evaluate(() => { const S = MTAPP.S, v = S && S.view, g = v && v.g; if (!g) return { none: true }; const me = v.me; return { over: g.over, turn: g.turn, me, phase: g.place ? 'place' : g.phase, steps: g.steps, sel: MTAPP.U.sel, sub: MTAPP.U.sub, busy: MTAPP.U.busy, paused: S.room && S.room.paused, auto: !!(v.seats[me] && v.seats[me].auto) }; });
const dockBtn = (p, txt) => p.evaluate(t => { const b = [...document.querySelectorAll('#dk3 .btn')].find(x => x.textContent.trim() === t); if (b && !b.disabled) { b.click(); return true; } return false; }, txt);
const tr = (p, k) => p.evaluate(k => MTI18N.t(k), k);
async function playStep(p, ctx) {
  const assert = require('assert');
  const snap = ctx.snap || (async () => {});
  const tap = async c => { await tapCell(p, c); ctx.taps = (ctx.taps || 0) + 1; };
  const s = await state(p);
  if (s.none) return 'wait';
  if (s.over) return 'over';
  if (s.turn !== s.me || s.paused || s.busy || s.auto) return 'wait';
  ctx.turns = ctx.turns || 0;
  if (s.phase === 'place') {
    const c = await p.evaluate(() => { const cs = MT.placeCells(MTAPP.S.view.g); return cs[Math.floor(Math.random() * cs.length)]; });
    await snap('place');
    await tap(c); await p.waitForTimeout(150);
    return 'acted';
  }
  if (s.phase === 'move') {
    if (!s.sel) await snap('move');
    // pick a random legal step; tap its piece's hex until that piece is picked up, then tap the target
    const m = await p.evaluate(() => { const g = MTAPP.S.view.g, ms = g.steps > 0 ? MT.steps(g, MTAPP.S.view.me) : []; if (!ms.length || Math.random() < 0.08) return null; const m = ms[Math.floor(Math.random() * ms.length)]; const at = m.p === 'b' ? MT.boatById(g, m.id).at : (() => { const x = g.isl.find(y => y.id === m.id); return x.st === 'boat' ? MT.boatById(g, x.b).at : x.at; })(); return { m, at }; });
    if (!m) { assert.ok(await dockBtn(p, await tr(p, 'bDone')), 'Done button'); await p.waitForTimeout(200); return 'acted'; }
    // a different piece is picked up and the hex we want is one of its targets: put it down first by tapping an empty spot
    const clear = await p.evaluate(m => { const U = MTAPP.U, g = MTAPP.S.view.g, me = MTAPP.S.view.me; if (!U.sel || (U.sel.p === m.m.p && U.sel.id === m.m.id)) return -1; const ms = MT.steps(g, me); const tg = new Set(ms.filter(x => x.p === U.sel.p && x.id === U.sel.id).map(x => x.to)); if (!tg.has(m.at)) return -1; for (let c = 0; c < MT.N; c++) if (!tg.has(c) && g.k[c] === 'S' && !g.boats.some(b => b.at === c) && !g.isl.some(x => x.at === c)) return c; return -1; }, m);
    if (clear >= 0) { await tap(clear); await p.waitForTimeout(90); }
    let ok = false;
    for (let k = 0; k < 8 && !ok; k++) {
      const t = await state(p);
      if (t.turn !== t.me || t.phase !== 'move' || t.busy) return 'acted';   // the turn moved on under us (timer, bot takeover)
      if (t.sel && t.sel.p === m.m.p && t.sel.id === m.m.id) ok = true;
      else { await tap(m.at); await p.waitForTimeout(90); }
    }
    assert.ok(ok, 'could select the piece ' + JSON.stringify(m));
    await snap('selected');
    await tap(m.m.to); await p.waitForTimeout(200);
    return 'acted';
  }
  if (s.phase === 'sink') {
    const c = await p.evaluate(() => { const L = MT.sinkable(MTAPP.S.view.g); return L[Math.floor(Math.random() * L.length)]; });
    await tap(c); await p.waitForTimeout(120);
    await snap('sink-pick');
    if (Math.random() < 0.5) await tap(c); else assert.ok(await dockBtn(p, await tr(p, 'bSink')), 'Sink button');
    await p.waitForTimeout(700);
    await snap('sunk');
    return 'acted';
  }
  if (s.phase === 'dol') { await snap('dolphin'); assert.ok(await dockBtn(p, await tr(p, 'bSkip')), 'Skip (dolphin)'); await p.waitForTimeout(200); return 'acted'; }
  if (s.phase === 'cr') {
    const m = await p.evaluate(() => { const g = MTAPP.S.view.g, ms = MT.crMoves(g); if (!ms.length || Math.random() < 0.15) return null; const m = ms[Math.floor(Math.random() * ms.length)]; return { m, at: g.cr.find(c => c.id === m.id).at, bat: m.grab >= 0 ? MT.boatById(g, m.grab).at : -1 }; });
    if (!m) { assert.ok(await dockBtn(p, await tr(p, 'bSkip')), 'Skip (creature)'); ctx.turns++; await p.waitForTimeout(200); return 'acted'; }
    let ok = false;
    for (let k = 0; k < 6 && !ok; k++) { const t = await state(p); if (t.turn !== t.me || t.phase !== 'cr' || t.busy) return 'acted'; if (t.sel && t.sel.p === 'c' && t.sel.id === m.m.id) ok = true; else { await tap(m.at); await p.waitForTimeout(90); } }
    assert.ok(ok, 'select creature');
    await tap(m.m.to); await p.waitForTimeout(150);
    const s2 = await state(p);
    if (s2.sub && s2.sub.kind === 'grab') { await snap('grab'); if (m.bat >= 0) await tap(m.bat); else assert.ok(await dockBtn(p, await tr(p, 'bNoGrab'))); }
    else if (s2.sub && s2.sub.kind === 'push') { await snap('push'); await tap(m.m.push); }
    ctx.turns++;
    await p.waitForTimeout(300);
    return 'acted';
  }
  return 'wait';
}
function report(...pages) { let bad = 0; pages.forEach((p, i) => { if (p.errs.length) { bad++; console.log('--- errors on page', i, '\n' + p.errs.join('\n')); } }); return bad; }
module.exports = { BASE, launch, open, page, tapCell, shot, click, waitFor, report, state, dockBtn, tr, playStep, SHOTS };
