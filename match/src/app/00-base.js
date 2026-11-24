// ===== 萌宠消消乐 / 团团圆圆 · the app: shared helpers (the build joins src/app/*.js in file-name order inside one function) =====
const W = window, MM = W.MM, AI = W.MMAI, LV = W.MMLV, A = W.MMArt, SND = W.MMSound, I18 = W.MMI18N, AV = W.Art;
const T = I18.t;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// localStorage, shared key space with the other games (mh_name, mh_av, mh_lang, mh_token); this game's own keys start with mh_tt_
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('mh_' + k)); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('mh_' + k); else localStorage.setItem('mh_' + k, JSON.stringify(v)); } catch (e) {} },
};
const rid = n => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const now = () => performance.now();
const PREFIX = 'yejutt-v1-';
const LIVE = 'tt_live';
const qs = new URLSearchParams(location.search);
const ICE = [
  { urls: 'stun:stun.miwifi.com:3478' }, { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];
function peerOpts(tok) {
  const o = { config: { iceServers: ICE, iceCandidatePoolSize: 4 }, debug: 1 };
  if (tok) o.token = tok;   // the host keeps one token per room id, so a reloaded page gets the same room code straight back
  const ph = qs.get('ph');   // tests: a local PeerServer
  if (ph) { const [h, p] = ph.split(':'); Object.assign(o, { host: h, port: +p || 9000, path: '/', secure: false, config: { iceServers: [] } }); }
  return o;
}
const EMOS = ['😂', '😭', '😱', '😎', '🤔', '👍', '🙏', '🥳', '🐷', '🐸', '🍡', '🎆'];   // the same in both looks: the host checks a guest's against this list
const MODES = ['levels', 'rush', 'versus'];
const TIMES = [60, 90, 120];
const touchy = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in W;

// ---------- artwork: the shared avatars and icons, plus this game's icons ----------
(function sprite() {
  $('sprite').innerHTML = AV.sprite('') + `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${A.icons()}</svg>`;
})();
(function noise() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d'), d = x.createImageData(96, 96);
    for (let i = 0; i < d.data.length; i += 4) { const g = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = g; d.data[i + 3] = 20; }
    x.putImageData(d, 0, 0);
    document.documentElement.style.setProperty('--noise', `url(${c.toDataURL()})`);
  } catch (e) {}
})();
const pcOf = s => A.PC[s] || A.PC[3];
// bots wear the shared robot faces (one look per level), players their own avatar
function avSvg(p, s) {
  if (!p) return '';
  if (p.bot) return `<svg viewBox="0 0 100 100" style="color:${AV.BOT_EYES[s % 4]}"><use href="#bq${clamp((p.lv | 0) - 1, 0, 3)}"/></svg>`;
  return `<svg viewBox="0 0 100 100"><use href="#av${clamp(p.av | 0, 0, AV.AVATARS.length - 1)}"/></svg>`;
}
const botName = p => (p && p.bot && p.bn >= 0 ? T('botNames')[p.bn % 8] : p ? p.name : '?');
// a piece or obstacle as a small picture: pic('m', colour), pic('rh'), pic('box', layers), pic('frost', layers), pic('cage'), pic('ing')
let picN = 0;
function pic(kind, c, face) {
  const p = 'p' + (picN++).toString(36);
  if (kind === 'm') return A.svg(0, c, face || 'idle', p);
  const K = { rh: 1, rv: 2, fc: 3, kl: 4, fw: 5, ing: 6 };
  if (kind in K) return A.svg(K[kind], 0, '', p);
  if (kind === 'cage') return `<svg class="pc" viewBox="-6 -6 112 112" aria-hidden="true">${A.toSvg(A.partsOf(0, 3, 'sleep'), p + 'a')}${A.toSvg(A.partsOf('cage', 0), p + 'b')}</svg>`;
  if (kind === 'frost') return `<svg class="pc" viewBox="-6 -6 112 112" aria-hidden="true"><rect x="3" y="3" width="94" height="94" rx="16" fill="${A.theme === 'pal' ? '#fbf0dc' : 'rgba(30,30,70,.7)'}"/>${A.toSvg(A.partsOf('frost', c || 1), p)}</svg>`;
  if (kind === 'box') return `<svg class="pc" viewBox="-6 -6 112 112" aria-hidden="true">${A.toSvg(A.partsOf('box', c || 3), p)}</svg>`;
  if (kind === 'star') return `<svg class="pc" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" fill="currentColor"/></svg>`;
  return '';
}
const STAR = on => `<svg viewBox="0 0 24 24" class="${on ? '' : 'off'}" aria-hidden="true"><path d="M12 2.2l2.95 6 6.6.95-4.78 4.66 1.13 6.57L12 17.27l-5.9 3.1 1.13-6.57L2.45 9.15l6.6-.95z" fill="${on ? 'url(#starg)' : '#fff'}" stroke="${on ? '#b8770f' : 'none'}" stroke-width=".8"/></svg>`;
// a gradient for the gold stars, shared by every page picture
$('sprite').insertAdjacentHTML('beforeend', '<svg style="position:absolute;width:0;height:0"><defs><linearGradient id="starg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b8"/><stop offset=".5" stop-color="#ffd24a"/><stop offset="1" stop-color="#e09a18"/></linearGradient></defs></svg>');

// ---------- identity and preferences (name, avatar and token are shared with the other games) ----------
let token = store.get('token'); if (!token) { token = rid(16); store.set('token', token); }
let myName = store.get('name') || '';
let myAv = store.get('av'); if (myAv == null || !(myAv >= 0 && myAv < AV.AVATARS.length)) { myAv = Math.floor(Math.random() * AV.AVATARS.length); store.set('av', myAv); }   // keep it, so you look the same when you come back
// tab, solo mode, bots (count and level), room settings (bot level, round time, cages on), hints, quicker animations
const P = Object.assign({ tab: 'solo', mode: 'levels', foes: 2, bot: 2, hbot: 2, time: 90, atk: true, hints: true, fast: false, theme: 'pal' }, store.get('tt_prefs') || {});
if (!MODES.includes(P.mode)) P.mode = 'levels';
if (![1, 2, 3].includes(P.foes)) P.foes = 2;
if (![0, 1, 2, 3, 4].includes(P.bot)) P.bot = 2;
if (![0, 1, 2, 3, 4].includes(P.hbot)) P.hbot = 2;
if (!TIMES.includes(P.time)) P.time = 90;
if (!['pal', 'mm'].includes(P.theme)) P.theme = 'pal';
const saveP = () => store.set('tt_prefs', P);
// the look: 'pal' six little animals in a sunny meadow (the default), 'mm' the lantern-fair mochi at night
function applyTheme() {
  A.setTheme(P.theme); I18.setTheme(P.theme);
  document.documentElement.dataset.theme = P.theme;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = P.theme === 'pal' ? '#bfe6fb' : '#0c0d24';
}
applyTheme();
// level progress: stars and best score per level (index n-1), and the best Time Rush score
const PROG = (() => {
  const p = store.get('tt_prog') || {};
  const ok = a => Array.isArray(a) ? a.slice(0, LV.COUNT).map(x => Math.max(0, x | 0)) : [];
  return { stars: ok(p.stars).map(x => Math.min(3, x)), best: ok(p.best), rush: Math.max(0, p.rush | 0), seen: Array.isArray(p.seen) ? p.seen.filter(x => typeof x === 'string').slice(0, 20) : [] };
})();
const saveProg = () => store.set('tt_prog', PROG);
const starsTotal = () => PROG.stars.reduce((a, b) => a + (b | 0), 0);
const unlocked = n => n === 1 || (PROG.stars[n - 2] | 0) > 0;
const nextLevel = () => { for (let n = 1; n <= LV.COUNT; n++) if (!PROG.stars[n - 1]) return n; return LV.COUNT; };
const fmtN = n => Math.round(n || 0).toLocaleString('en-US');
const colon = () => (I18.lang === 'zh' ? '：' : ': ');
const fmtT = ms => { const s = Math.ceil(Math.max(0, ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// ---------- toast, overlay, bottom sheet ----------
let toastT = 0;
function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2400); }
function overlay(html, btns) {
  const o = $('overlay'), c = $('ovCard');
  if (!html) { o.hidden = true; return; }
  c.innerHTML = html + (btns && btns.length ? '<div class="ovb"></div>' : '');
  if (btns) { const b = c.querySelector('.ovb'); for (const [txt, cls, fn] of btns) { const x = document.createElement('button'); x.className = 'btn sm ' + cls; x.textContent = txt; x.onclick = fn; b.appendChild(x); } }
  o.hidden = false;
}
let sheetOn = null, sheetLock = false, sheetClose = null;
function sheet(html, opt) {
  opt = opt || {};
  const sh = $('sheet'), bg = $('sheetBg');
  sh.innerHTML = html;
  sh.className = 'sheet' + (opt.cls ? ' ' + opt.cls : '');
  sheetOn = opt.id || 'x'; sheetLock = !!opt.lock; sheetClose = opt.onClose || null;
  bg.hidden = false; requestAnimationFrame(() => { bg.classList.add('on'); sh.classList.add('on'); });
  sh.scrollTop = 0;
  sh.querySelectorAll('[data-close]').forEach(b => b.onclick = closeSheet);
  return sh;
}
function closeSheet() {
  const sh = $('sheet'), bg = $('sheetBg'), f = sheetClose;
  sh.classList.remove('on'); bg.classList.remove('on');
  sheetOn = null; sheetLock = false; sheetClose = null;
  setTimeout(() => { if (!sheetOn) bg.hidden = true; }, 300);
  if (f) f();
}
$('sheetBg').onclick = () => { if (!sheetLock) closeSheet(); };
const head = (title, x) => `<h3>${title}<span class="grow"></span>${x === false ? '' : '<button class="x" data-close aria-label="close"><svg viewBox="0 0 24 24"><use href="#i-close"/></svg></button>'}</h3>`;
function copyText(s) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).then(() => true, () => fallback());
  return Promise.resolve(fallback());
  function fallback() { const ta = document.createElement('textarea'); ta.value = s; ta.style.cssText = 'position:fixed;top:-100px'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok; }
}
const inviteUrl = code => location.origin + location.pathname + '#' + code;
function invite(code, share) {
  const text = T('invite', { c: code, u: inviteUrl(code) });
  if (share && navigator.share) { navigator.share({ title: T('title'), text, url: inviteUrl(code) }).catch(() => {}); return; }
  copyText(text).then(ok => toast(ok ? T('copied') : text, 3200));
}
let screenOn = 'lobby';
function show(id) { screenOn = id; for (const x of ['lobby', 'map', 'room', 'game']) $(x).hidden = x !== id; if (id !== 'game') { closeSheet(); SND.music.stop(); } }
function confirmBox(q, yes, no) {
  overlay(`<b>${esc(q)}</b>`, [[T('cancel'), 'glass', () => { overlay(null); if (no) no(); }], [T('ok'), 'red', () => { overlay(null); yes(); }]]);
}
const confirmOpen = () => !$('overlay').hidden && !!$('ovCard').querySelector('.btn.red');
// a level's goals as words, in the reader's language
function goalText(g) {
  if (g.t === 'col') return T('goal').col.replace('{n}', g.n).replace('{c}', T('animal')[g.c]);
  return I18.fill(T('goal')[g.t] || '', { n: g.t === 'score' ? fmtN(g.n) : g.n });
}
function goalPic(g) {
  if (g.t === 'col') return pic('m', g.c);
  if (g.t === 'frost') return pic('frost', 2);
  if (g.t === 'cage') return pic('cage');
  if (g.t === 'box') return pic('box', 3);
  if (g.t === 'ing') return pic('ing');
  return `<svg class="pc" viewBox="0 0 24 24" aria-hidden="true" style="color:var(--gold)"><path d="M12 2.2l2.95 6 6.6.95-4.78 4.66 1.13 6.57L12 17.27l-5.9 3.1 1.13-6.57L2.45 9.15l6.6-.95z" fill="url(#starg)" stroke="#b8770f" stroke-width=".8"/></svg>`;
}
