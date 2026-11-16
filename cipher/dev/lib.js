// Shared helpers for the browser checks in this folder (Playwright is expected to be installed globally).
// A static server must serve the repo root:  python3 -m http.server 8080 --bind 127.0.0.1
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://127.0.0.1:8080/cipher/index.html';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
try { require('fs').mkdirSync(SHOTS, { recursive: true }); } catch (e) {}
async function launch() { return chromium.launch(); }
async function open(browser, o = {}) {
  const w = o.w || 390, h = o.h || 844, lang = o.lang || 'zh';
  const ctx = o.ctx || await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr || 2, hasTouch: w < 700, isMobile: w < 700 });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  p.on('console', m => { if (m.type() == 'error' && !/Failed to load resource|ERR_|WebSocket|peerjs|PeerJS/i.test(m.text())) p.errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(a => { try { if (!sessionStorage.cxInit) { sessionStorage.cxInit = 1; if (!localStorage.mh_lang) localStorage.mh_lang = JSON.stringify(a.lang); if (a.name && !localStorage.mh_name) localStorage.mh_name = JSON.stringify(a.name); for (const k in (a.ls || {})) localStorage[k] = a.ls[k]; } } catch (e) {} },
    { lang, name: o.name === undefined ? (lang == 'zh' ? '阿超' : 'Zed') : o.name, ls: o.ls });
  await p.goto(BASE + (o.query || '') + (o.hash || ''));
  await p.waitForTimeout(400);
  return p;
}
const shot = (p, name, full) => p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full });
const click = (p, id) => p.evaluate(id => document.getElementById(id).click(), id);
const waitFor = (p, fn, arg, ms = 15000) => p.waitForFunction(fn, arg, { timeout: ms });
const sel = (p, css) => { const l = p.locator(css).first(); return { click: o => l.click(Object.assign({ timeout: 4000 }, o || {})).catch(e => { throw new Error(css + ': ' + e.message.split('\n').slice(0, 6).join(' | ')); }) }; };
// one move for this page's player, made by tapping the screen the way a person would. The choice comes from the Shark bot
// reading the same view. Returns what it did, or '' when it isn't this player's move
async function playMove(p, lv = 3) {
  const plan = await p.evaluate(lv => {
    const A = CXAPP, v = A.UI.view; if (!v || !v.opt || !v.R || A.UI.busy) return null;
    if (v.seats[v.me] && v.seats[v.me].auto) return null;
    const a = CXAI.decide(v, lv, Math.random); if (!a) return null;
    const R = v.R;
    if (a.k === 'place') return { k: 'place', at: a.at };
    if (a.k === 'draw') return { k: 'draw', c: a.c };
    if (a.k === 'guess') return { k: 'guess', u: R.rows[a.t][a.i].u, v: a.v };
    if (a.k === 'stop') return { k: 'stop', at: a.at, many: (v.opt.slots || []).length > 1 };
    if (a.k === 'reveal') return { k: 'reveal', u: R.rows[v.me][a.i].u };
    return null;
  }, lv);
  if (!plan) return '';
  // slots pulse and held tiles bob, so Playwright would wait for them to stand still: force those clicks
  if (plan.k === 'place') { await sel(p, `#myRow .slot[data-at="${plan.at}"]`).click({ force: true }); return 'place'; }
  if (plan.k === 'draw') { await sel(p, `[data-act="draw${plan.c}"]`).click(); return 'draw'; }
  if (plan.k === 'guess') {
    await sel(p, `#opps .tile[data-u="${plan.u}"]`).click();
    await sel(p, `.pad .pk[data-v="${plan.v}"]`).click();
    await sel(p, '[data-act="guess"]').click();
    return 'guess';
  }
  if (plan.k === 'stop') {
    await sel(p, '[data-act="stop"]').click();
    if (plan.many) { await p.waitForTimeout(150); await sel(p, `#myRow .slot[data-at="${plan.at}"]`).click({ force: true }); }
    return 'stop';
  }
  if (plan.k === 'reveal') { await sel(p, `#myRow .tile[data-u="${plan.u}"]`).click(); await sel(p, '[data-act="reveal"]').click(); return 'reveal'; }
  return '';
}
function report(...pages) { let bad = 0; pages.forEach((p, i) => { if (p.errs.length) { bad++; console.log('--- errors on page', i, '\n' + p.errs.join('\n')); } }); return bad; }
module.exports = { launch, open, shot, click, waitFor, sel, playMove, report, SHOTS };
