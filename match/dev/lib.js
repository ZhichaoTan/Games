// Shared helpers for the browser checks in this folder (Playwright is expected to be installed globally).
// A static server must serve the repo root:  python3 -m http.server 8080 --bind 127.0.0.1
// Online checks also need a local signalling server:  npx -p peer peerjs --port 9000 --host 127.0.0.1
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://127.0.0.1:8080/match/index.html';
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
  await p.addInitScript(a => { try { if (!sessionStorage.ttInit) { sessionStorage.ttInit = 1; localStorage.mh_lang = JSON.stringify(a.lang); if (a.name) localStorage.mh_name = JSON.stringify(a.name); for (const k in (a.ls || {})) localStorage[k] = a.ls[k]; } } catch (e) {} },
    { lang, name: o.name === undefined ? (lang == 'zh' ? '阿超' : 'Zed') : o.name, ls: o.ls });
  await p.goto(BASE + (o.query || '') + (o.hash || ''));
  await p.waitForTimeout(400);
  return p;
}
const shot = (p, name, full) => p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full });
const click = (p, id) => p.evaluate(id => document.getElementById(id).click(), id);
const waitFor = (p, fn, arg, ms = 15000) => p.waitForFunction(fn, arg, { timeout: ms });
// the state of my own board
const me = p => p.evaluate(() => { const g = TTAPP.U.g; return g ? { mode: g.mode, started: g.started, over: g.over, won: g.won, score: g.score, used: g.used, moves: g.moves, left: g.mode === 'time' ? g.timeLeft() : null, cd: !!TTAPP.U.cd, paused: TTAPP.U.paused, screen: TTAPP.screen } : { screen: TTAPP.screen }; });
// One move the way a player makes it (through the same calls a drag or a tap ends in), picked by a bot of level lv.
// Waits until the board is still. Returns false when the game can't take a move.
async function move(p, lv = 4, ms = 6000) {
  try { await p.waitForFunction(() => { const U = TTAPP.U, g = U.g; return !g || g.over || (g.started && !U.cd && !U.paused && g.canAct() && TTAPP.idle()); }, null, { timeout: ms }); } catch (e) { return false; }
  return p.evaluate(lv => {
    const g = TTAPP.U.g; if (!g || g.over || !g.started) return false;
    const m = MMAI.plan(g, lv); if (!m) return false;
    if (m[1] < 0) TTAPP.tapCell(m[0]); else TTAPP.trySwap(m[0], m[1]);
    return true;
  }, lv);
}
function report(...pages) { let bad = 0; pages.forEach((p, i) => { if (p.errs.length) { bad++; console.log('--- errors on page', i, '\n' + p.errs.join('\n')); } }); return bad; }
module.exports = { BASE, launch, open, page, shot, click, waitFor, report, me, move, SHOTS };
