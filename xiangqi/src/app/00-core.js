// ===== core: storage, identity, piece drawing, notation, small UI helpers, sound =====
const W = window, AV = W.Art, XA = W.XQArt, AVA = XA.AVA, I18 = W.XQI18N, T = I18.t;
const E = EngineFactory(false);
const { SRC, DST, MOVE, MATE, WIN } = E;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// name, avatar, token and language are shared with Hold'em and Mahjong (localStorage mh_*)
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('mh_' + k)); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('mh_' + k); else localStorage.setItem('mh_' + k, JSON.stringify(v)); } catch (e) {} },
};
const rid = n => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const qs = new URLSearchParams(location.search);
const zh = () => I18.lang === 'zh';

let DB = { settings: {}, stats: {}, history: [], current: null };
{ const s = store.get('xq_db'); if (s && typeof s === 'object') DB = Object.assign(DB, s); }
DB.settings = Object.assign({ level: 2, side: 0, sound: true, voice: true, mode: 'ai', engine: 'muyi', advPf: false, facing: false, pvBoth: false,
  tab: '', pieces: 'auto', board: 'night', hostSide: 'rand', hostClock: 0 }, DB.settings);
if (!Array.isArray(DB.history)) DB.history = [];
if (!DB.stats || typeof DB.stats !== 'object') DB.stats = {};
function save() { store.set('xq_db', DB); }
const statKey = (lv, eng) => ((eng || DB.settings.engine) == 'pf' ? 'pf' : '') + lv;

let token = store.get('token'); if (!token) { token = rid(16); store.set('token', token); }
let myName = store.get('name') || '';
let myAv = store.get('av'); if (myAv == null || !(myAv >= 0 && myAv < AV.AVATARS.length)) { myAv = Math.floor(Math.random() * AV.AVATARS.length); store.set('av', myAv); }
const avSvg = i => `<svg viewBox="0 0 100 100"><use href="#av${clamp(i | 0, 0, AV.AVATARS.length - 1)}"/></svg>`;

// ---------------- pieces ----------------
// piece codes: 8..14 red (general, advisor, elephant, horse, chariot, cannon, soldier), 16..22 black
const GLYPH = { 8: '帥', 9: '仕', 10: '相', 11: '馬', 12: '車', 13: '炮', 14: '兵', 16: '將', 17: '士', 18: '象', 19: '馬', 20: '車', 21: '砲', 22: '卒' };
const NN = { 8: '帅', 9: '仕', 10: '相', 11: '马', 12: '车', 13: '炮', 14: '兵', 16: '将', 17: '士', 18: '象', 19: '马', 20: '车', 21: '炮', 22: '卒' };
const RN = '一二三四五六七八九';
const WXF = 'KAEHRCP';
const sideOf = pc => pc < 16 ? 0 : 1;
const rc = sq => [(sq >> 4) - 3, (sq & 15) - 3];
const sqOf = (r, c) => (r + 3) * 16 + c + 3;
// characters or figurines: a setting; "auto" follows the language so an English screen shows no Chinese
const figMode = () => DB.settings.pieces == 'fig' || (DB.settings.pieces != 'han' && !zh());
const glyph = pc => figMode() ? `<svg class="g" viewBox="0 0 24 24"><use href="#fg${pc & 7}"/></svg>` : `<span class="g">${GLYPH[pc]}</span>`;
const pcHTML = (pc, cls) => `<div class="pc ${sideOf(pc) ? 'k' : 'r'}${cls ? ' ' + cls : ''}"><div class="face">${glyph(pc)}</div></div>`;
const capHTML = pc => `<span class="cap${sideOf(pc) ? '' : ' r'}">${figMode() ? `<svg viewBox="0 0 24 24"><use href="#fg${pc & 7}"/></svg>` : GLYPH[pc]}</span>`;
const pcName = pc => zh() ? NN[pc] : T('pn')[pc & 7];
const SIDE = sd => T(sd ? 'black' : 'red');
const sideDot = sd => `<i class="sdot${sd ? ' k' : ''}"></i>`;
const mascot = side => AVA.player(side, figMode());
const lvName = lv => T('lvNames')[lv];
const lvWho = lv => T('lvWho')[lv];
const engName = e => T(e == 'pf' ? 'engPf' : 'engMuyi');

const mv2uci = mv => { const f = s => String.fromCharCode(97 + (s & 15) - 3) + (9 - ((s >> 4) - 3)); return f(SRC(mv)) + f(DST(mv)); };
const uci2mv = s => E.iccs(s);
const mvStr = ms => (ms || []).map(mv2uci).join('');
const strMv = t => (String(t || '').match(/.{4}/g) || []).map(uci2mv);

// Chinese: the standard four-character notation. Red counts files 一~九 from its right, black 1~9 from its right;
// tandem pieces on one file use 前/后 (three: 前/中/后, more pawns: 一二三四五 from the front); when pawns are
// doubled on two or more files the file number replaces the piece name (前七进一).
// English: WXF notation with the same logic (C2=5, H8+7; tandem R+ / R-; a, b, c… for three or more).
function notation(pos, mv) {
  const s = SRC(mv), d = DST(mv), pc = pos.sq[s];
  if (!pc) return '?';
  const en = !zh(), t = pc & 7, sd = sideOf(pc), [r1, c1] = rc(s), [r2, c2] = rc(d);
  const num = n => (sd == 0 && !en) ? RN[n - 1] : String(n);
  const fnum = c => sd == 0 ? 9 - c : c + 1;
  const colRows = c => { const rows = []; for (let r = 0; r < 10; r++) if (pos.sq[sqOf(r, c)] == pc) rows.push(r); return rows.sort((a, b) => sd == 0 ? a - b : b - a); };
  const rows = colRows(c1), name = en ? WXF[t] : NN[pc];
  let head;
  if (rows.length >= 2) {
    const tags = en ? (rows.length == 2 ? ['+', '-'] : ['a', 'b', 'c', 'd', 'e'])
      : rows.length == 2 ? ['前', '后'] : rows.length == 3 ? ['前', '中', '后'] : ['一', '二', '三', '四', '五'];
    let other = false;
    if (t == 6) for (let c = 0; c < 9; c++) if (c != c1 && colRows(c).length >= 2) other = true;
    const tag = tags[rows.indexOf(r1)];
    head = other ? tag + num(fnum(c1)) : en ? name + tag : tag + name;
  } else head = name + num(fnum(c1));
  let act;
  if (r1 == r2) act = (en ? '=' : '平') + num(fnum(c2));
  else {
    const fwd = sd == 0 ? r2 < r1 : r2 > r1;
    act = (en ? (fwd ? '+' : '-') : (fwd ? '进' : '退')) + ((t == 1 || t == 2 || t == 3) ? num(fnum(c2)) : num(Math.abs(r2 - r1)));
  }
  return head + act;
}
function lineText(baseMoves, line) {
  const p = new E.Position(); p.fromMoves(baseMoves);
  const out = [];
  for (const mv of line) {
    if (p.legalMoves().indexOf(mv) < 0) break;
    out.push({ t: notation(p, mv), sd: p.sd, mv }); p.makeMove(mv);
  }
  return out;
}
// win chance for a human-level game, from the score. Engine WDL is not used: Pikafish's model is fitted to
// its own games, where a knight up already counts as a sure win. Here a knight up in the opening is about
// 75%, a rook up about 90%. Pikafish scores (knight ~330) are a bit smaller than the built-in engine's
// (knight ~400), hence the two scales.
const winP = (v, k = 340) => v > WIN ? 1 : v < -WIN ? 0 : 1 / (1 + Math.exp(-v / k));
// mate distance in moves for the side the score belongs to (+ = delivers mate, - = gets mated)
const mateIn = v => v > WIN ? Math.ceil((MATE - v) / 2) : v < -WIN ? -Math.ceil((MATE + v) / 2) : 0;
const realMate = v => { const m = mateIn(v); return Math.abs(m) <= 40 ? m : 0; };
// win probability: 100% / 0% only for a forced mate, otherwise capped to 1–99%
const entW = e => { const m = realMate(e.vl); if (m) return m > 0 ? 1 : 0; const w = winP(e.vl, e.w != null ? 280 : 340); return Math.min(.99, Math.max(.01, w)); };
const pctTxt = w => Math.min(99, Math.max(1, Math.round(w * 100))) + '%';
const LINE_MOVES = 10; // recommended lines: the best move, then 10 more moves of the side to move
const LINE_PLIES = LINE_MOVES * 2 + 1;
// lines are built from several searches; the tail of a short search's pv is its weakest part,
// so each search only contributes its first few plies and the next search re-checks from there
const LINE_CHUNK = 6, LINE_MS = { pf: 900, muyi: 1000 };
function fmtScore(rs) {
  const m = realMate(rs), s = SIDE(rs >= 0 ? 0 : 1);
  if (m) return T('scMate', { s: SIDE(m > 0 ? 0 : 1), n: Math.abs(m) });
  if (rs > WIN || rs < -WIN) return T('scWon', { s });
  return T('scAdv', { s: T(rs >= 0 ? 'redS' : 'blackS'), n: Math.abs(Math.round(rs)) });
}
const mateTxt = m => m == 1 ? T('mate1') : T('mateN', { n: m });

// ---------------- small UI helpers ----------------
let toastT = 0;
function toast(html, ms) { const t = $('toast'); t.innerHTML = html; t.hidden = false; t.style.animation = 'none'; t.offsetWidth; t.style.animation = ''; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2200); }
let ovTag = '';
function overlay(html, btns, tag) {
  const o = $('overlay'), c = $('ovCard');
  ovTag = html ? (tag || 'x') : '';
  if (!html) { o.hidden = true; return; }
  c.innerHTML = html + (btns && btns.length ? '<div class="ovb"></div>' : '');
  if (btns) { const b = c.querySelector('.ovb'); for (const [txt, cls, fn] of btns) { const x = document.createElement('button'); x.className = 'btn sm ' + cls; x.textContent = txt; x.onclick = fn; b.appendChild(x); } }
  o.hidden = false;
}
function confirmBox(title, text, okText, onOk, cls) {
  overlay(`<b>${title}</b>${text ? `<p>${text}</p>` : ''}`, [[T('cancel'), 'glass', () => overlay(null)], [okText || T('ok'), cls || 'red', () => { overlay(null); onOk(); }]]);
}
let sheetOn = null, sheetLock = false;
function sheet(html, opt) {
  opt = opt || {};
  const sh = $('sheet'), bg = $('sheetBg');
  sh.innerHTML = html;
  sheetOn = opt.id || 'x'; sheetLock = !!opt.lock;
  bg.hidden = false; requestAnimationFrame(() => { bg.classList.add('on'); sh.classList.add('on'); });
  sh.scrollTop = 0;
  sh.querySelectorAll('[data-close]').forEach(b => b.onclick = closeSheet);
  return sh;
}
function closeSheet() {
  const sh = $('sheet'), bg = $('sheetBg');
  sh.classList.remove('on'); bg.classList.remove('on');
  sheetOn = null; sheetLock = false;
  setTimeout(() => { if (!sheetOn) bg.hidden = true; }, 300);
}
$('sheetBg').onclick = () => { if (!sheetLock) closeSheet(); };
const head = (title, x) => `<h3>${title}<span class="grow"></span>${x === false ? '' : '<button class="x" data-close><svg viewBox="0 0 24 24"><use href="#i-close"/></svg></button>'}</h3>`;
const toggleHTML = (key, label, sub, on) => `<button class="toggle" data-tog="${key}"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><i class="sw${on ? ' on' : ''}"></i></button>`;
const segHTML = (key, items, cur) => `<div class="seg" data-seg="${key}">${items.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
function copyText(s) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).then(() => true, () => fallback());
  return Promise.resolve(fallback());
  function fallback() { const ta = document.createElement('textarea'); ta.value = s; ta.style.cssText = 'position:fixed;top:-100px'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok; }
}
// scroll only the given list, never the page (scrollIntoView would also shift a screen that has overflow hidden)
function scrollInto(box, el, horiz) {
  const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
  if (horiz) { if (r.left < b.left) box.scrollLeft += r.left - b.left; else if (r.right > b.right) box.scrollLeft += r.right - b.right; return; }
  if (r.top < b.top) box.scrollTop += r.top - b.top; else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
}
const SCREENS = ['lobby', 'room', 'game', 'review', 'explore'];
function show(id) { for (const x of SCREENS) $(x).hidden = x !== id; }
const screen = () => SCREENS.find(x => !$(x).hidden);
const isWide = () => matchMedia('(min-width: 900px) and (min-aspect-ratio: 1/1)').matches;
function fmtDate(t) { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
const rounds = n => Math.ceil(n / 2);
// a big word across the screen: check, checkmate
function bigFx(txt) { const f = $('fx'); f.innerHTML = `<div class="big">${esc(txt)}</div>`; clearTimeout(bigFx.t); bigFx.t = setTimeout(() => { f.innerHTML = ''; }, 1300); }

// ---------------- sound: everything is synthesised ----------------
const AU = {
  ctx: null, nb: null, ks: {},
  ok() {
    if (!DB.settings.sound) return false;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const sr = this.ctx.sampleRate, len = sr * 0.3 | 0;
        this.nb = this.ctx.createBuffer(1, len, sr);
        const d = this.nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { return false; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },
  env(g, t, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); },
  clack(vol = 1, freq = 1600, delay = 0, body = 240) {
    const c = this.ctx, t = c.currentTime + delay;
    const n = c.createBufferSource(); n.buffer = this.nb;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 2.4;
    const g = c.createGain(); this.env(g, t, 0.95 * vol, 0.07);
    n.connect(bp).connect(g).connect(c.destination); n.start(t); n.stop(t + 0.1);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(body, t); o.frequency.exponentialRampToValueAtTime(body * 0.42, t + 0.09);
    const g2 = c.createGain(); this.env(g2, t, 0.6 * vol, 0.13);
    o.connect(g2).connect(c.destination); o.start(t); o.stop(t + 0.15);
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 1.9;
    const g3 = c.createGain(); this.env(g3, t, 0.12 * vol, 0.03);
    o2.connect(g3).connect(c.destination); o2.start(t); o2.stop(t + 0.05);
  },
  drum(delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.4);
    const g = c.createGain(); this.env(g, t, 0.9, 0.5); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.55);
  },
  pluck(freq, delay = 0, vol = 0.45, dur = 1.8) {
    const c = this.ctx, sr = c.sampleRate, key = freq.toFixed(1);
    let buf = this.ks[key];
    if (!buf) {
      const len = sr * dur | 0, N = Math.round(sr / freq); buf = c.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = i <= N ? (Math.random() * 2 - 1) * (1 - i / N * 0.3) : 0.4975 * (d[i - N] + d[i - N - 1]);
      this.ks[key] = buf;
    }
    const s = c.createBufferSource(); s.buffer = buf;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(lp).connect(g).connect(c.destination); s.start(c.currentTime + delay);
  },
  vib(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} },
  select() { if (this.ok()) this.clack(0.35, 2600, 0, 420); },
  place() { if (this.ok()) { this.clack(1, 1500); this.vib(8); } },
  capture() { if (this.ok()) { this.clack(1.25, 1100, 0, 170); this.clack(0.7, 2100, 0.045, 300); this.vib([10, 30, 14]); } },
  bad() { if (this.ok()) this.clack(0.4, 500, 0, 120); },
  check() { if (this.ok()) this.drum(0.05); },
  start() { if (this.ok()) { this.pluck(293.66, 0); this.pluck(440, 0.16); } },
  ping() { if (this.ok()) { this.pluck(587.33, 0, 0.3, 0.8); this.pluck(880, 0.09, 0.25, 0.8); } },
  win() { if (this.ok()) [293.66, 329.63, 369.99, 440, 493.88, 587.33].forEach((f, i) => this.pluck(f, i * 0.13, 0.5)); },
  lose() { if (this.ok()) [440, 369.99, 329.63, 246.94].forEach((f, i) => this.pluck(f, i * 0.22, 0.45)); },
  say(text) {
    if (!DB.settings.voice || !DB.settings.sound || !window.speechSynthesis || !text) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = zh() ? 'zh-CN' : 'en-US'; u.rate = 1.05; u.pitch = 0.9; speechSynthesis.speak(u); } catch (e) {}
  }
};
document.addEventListener('pointerdown', () => AU.ok(), { capture: true });
