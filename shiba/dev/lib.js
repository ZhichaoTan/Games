// Shared helpers for the browser checks in this folder (Playwright is expected to be installed globally).
// A static server must serve the repo root:  python3 -m http.server 8080 --bind 127.0.0.1
// Online checks also need a local signalling server:  npx -p peer peerjs --port 9000 --host 127.0.0.1
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://127.0.0.1:8080/shiba/index.html';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
try { require('fs').mkdirSync(SHOTS, { recursive: true }); } catch (e) {}
async function launch() { return chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] }); }
async function open(browser, o = {}) {
  const w = o.w || 390, h = o.h || 844;
  const ctx = o.ctx || await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr || 2, hasTouch: w < 700 || !!o.touch, isMobile: w < 700 });
  return page(ctx, o);
}
// a page in a browser context (a context keeps its localStorage, so a second page in it is the same person coming back)
async function page(ctx, o = {}) {
  const lang = o.lang || 'zh';
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  p.on('console', m => { if (m.type() == 'error' && !/ERR_|net::|WebSocket|Failed to load resource|Could not connect to peer|Lost connection to server|peer-unavailable|Negotiation of connection/.test(m.text())) p.errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(a => { try { if (!sessionStorage.sbInit) { sessionStorage.sbInit = 1; localStorage.mh_lang = JSON.stringify(a.lang); if (a.name) localStorage.mh_name = JSON.stringify(a.name); for (const k in (a.ls || {})) localStorage[k] = a.ls[k]; } } catch (e) {} },
    { lang, name: o.name === undefined ? (lang == 'zh' ? '阿超' : 'Zed') : o.name, ls: o.ls });
  await p.goto(BASE + (o.query || '') + (o.hash || ''));
  await p.waitForTimeout(400);
  return p;
}
const shot = (p, name, full) => p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full });
const click = (p, id) => p.evaluate(id => document.getElementById(id).click(), id);
const waitFor = (p, fn, arg, ms = 15000) => p.waitForFunction(fn, arg, { timeout: ms });
// the state of my own well
const me = p => p.evaluate(() => { const g = SBAPP.U.g; return g ? { started: g.started, over: g.over, why: g.why, won: g.won, pieces: g.stats.pieces, lines: g.lines, score: g.score, level: g.level, cur: !!g.cur, pending: g.pendingRows(), cd: !!SBAPP.U.cd, paused: SBAPP.U.paused } : null; });
// Play one block with real key presses: a bot picks where it goes (the strongest one, or o.lv: a level, or the settings of
// a bot as an object), then the keys turn it, slide it and drop it. Returns false when there was nothing to play.
async function keyMove(p, o = {}) {
  const plan = await p.evaluate(lv => { const g = SBAPP.U.g; if (!g || !g.cur || g.over || !g.started || SBAPP.U.cd || SBAPP.U.paused || g.clearing) return null; if (typeof lv === 'object') { SBAI.LV[9] = lv; lv = 9; } const pl = SBAI.plan(g, lv); return pl && { hold: pl.hold, t: pl.t, r: pl.r, x: pl.x, cx: g.cur.x, cr: g.cur.r, ct: g.cur.t }; }, o.lv || 4);
  if (!plan) return false;
  const k = async key => { await p.keyboard.press(key); if (o.gap) await p.waitForTimeout(o.gap); };
  if (plan.hold) { await k('c'); }
  // after a hold the block is a different one: read where it is now
  const cur = await p.evaluate(() => { const c = SBAPP.U.g.cur; return c && { x: c.x, r: c.r, t: c.t }; });
  if (!cur) return true;
  if (cur.t !== plan.t) { await k('Space'); return true; }
  const dr = (plan.r - cur.r + 4) % 4;
  if (dr === 1) await k('ArrowUp'); else if (dr === 3) await k('z'); else if (dr === 2) { await k('ArrowUp'); await k('ArrowUp'); }
  const x1 = await p.evaluate(() => SBAPP.U.g.cur && SBAPP.U.g.cur.x);
  if (x1 == null) return true;
  const dx = plan.x - x1;
  for (let i = 0; i < Math.abs(dx); i++) await k(dx < 0 ? 'ArrowLeft' : 'ArrowRight');
  await k('Space');
  return true;
}
function report(...pages) { let bad = 0; pages.forEach((p, i) => { if (p.errs.length) { bad++; console.log('--- errors on page', i, '\n' + p.errs.join('\n')); } }); return bad; }
module.exports = { BASE, launch, open, page, shot, click, waitFor, report, me, keyMove, SHOTS };
