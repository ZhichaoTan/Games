// Shared helpers for the browser checks in this folder (Playwright is expected to be installed globally).
// A static server must serve the repo root:  python3 -m http.server 8080 --bind 127.0.0.1
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://127.0.0.1:8080/xiangqi/index.html';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
try { require('fs').mkdirSync(SHOTS, { recursive: true }); } catch (e) {}
async function launch() { return chromium.launch(); }
async function open(browser, o = {}) {
  const w = o.w || 390, h = o.h || 844, lang = o.lang || 'zh';
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr || 2, hasTouch: w < 700, isMobile: w < 700 });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  p.on('console', m => { if (m.type() == 'error') p.errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(a => { try { if (!sessionStorage.xqInit) { sessionStorage.xqInit = 1; if (!localStorage.mh_lang) localStorage.mh_lang = JSON.stringify(a.lang); if (a.name && !localStorage.mh_name) localStorage.mh_name = JSON.stringify(a.name); for (const k in (a.ls || {})) localStorage[k] = a.ls[k]; } } catch (e) {} },
    { lang, name: o.name === undefined ? (lang == 'zh' ? '阿超' : 'Zed') : o.name, ls: o.ls });
  await p.goto(BASE + (o.query || '') + (o.hash || ''));
  await p.waitForTimeout(400);
  return p;
}
// tap a square of a board ('gb' game, 'rb' review, 'xb' explore)
async function tap(p, sq, board = 'gb') {
  const pt = await p.evaluate(([sq, b]) => { const B = XQAPP[b], r = B.el.getBoundingClientRect(), q = B.xy(sq); return { x: r.left + q.x, y: r.top + q.y }; }, [sq, board]);
  await p.mouse.click(pt.x, pt.y);
}
async function move(p, mv, board = 'gb') { await tap(p, mv & 255, board); await p.waitForTimeout(120); await tap(p, mv >> 8, board); }
// a sensible legal move for the side to move in the game screen (a shallow search by the built-in engine)
async function anyMove(p, ms = 150) {
  return p.evaluate(ms => { const { G, E } = XQAPP; const pos = new E.Position(); pos.fromMoves(G.moves); if (pos.isMate()) return 0; const r = new E.Search(pos).think({ timeMs: ms }); return r && r.mv ? r.mv : pos.legalMoves()[0]; }, ms);
}
const shot = (p, name, full) => p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full });
const click = (p, id) => p.evaluate(id => document.getElementById(id).click(), id);
const waitFor = (p, fn, arg, ms = 15000) => p.waitForFunction(fn, arg, { timeout: ms });
function report(...pages) { let bad = 0; pages.forEach((p, i) => { if (p.errs.length) { bad++; console.log('--- errors on page', i, '\n' + p.errs.join('\n')); } }); return bad; }
module.exports = { launch, open, tap, move, anyMove, shot, click, waitFor, report, SHOTS };
