// ===== 快乐柴柴 Shiba Stack · the app: shared helpers (the build joins src/app/*.js in file-name order inside one function) =====
const W = window, SB = W.SB, AI = W.SBAI, A = W.SBArt, SND = W.SBSound, I18 = W.SBI18N, AV = W.Art;
const T = I18.t;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// localStorage, shared key space with the other games (mh_name, mh_av, mh_lang, mh_token); this game's own keys start with mh_sb_
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('mh_' + k)); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('mh_' + k); else localStorage.setItem('mh_' + k, JSON.stringify(v)); } catch (e) {} },
};
const rid = n => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const now = () => performance.now();
const PREFIX = 'yejusb-v1-';
const LIVE = 'sb_live';
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
const EMOS = ['😂', '😭', '😱', '😎', '🤔', '👍', '🙏', '🥳', '🐶', '🦴', '🍡', '💥'];
const MODES = ['marathon', 'sprint', 'ultra', 'versus'];
const touchy = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in W;

// ---------- artwork: the shared avatars and icons, plus this game's gradients and icons ----------
(function sprite() {
  $('sprite').innerHTML = AV.sprite('') + `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>${A.defs('sb')}</defs>${A.icons()}</svg>`;
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

// ---------- identity and preferences (name, avatar and token are shared with the other games) ----------
let token = store.get('token'); if (!token) { token = rid(16); store.set('token', token); }
let myName = store.get('name') || '';
let myAv = store.get('av'); if (myAv == null || !(myAv >= 0 && myAv < AV.AVATARS.length)) { myAv = Math.floor(Math.random() * AV.AVATARS.length); store.set('av', myAv); }   // keep it, so you look the same when you come back
// tab, solo mode, bot count and level, marathon start level, room bot level, touch controls, swipe speed, key repeat, landing guide
const P = Object.assign({ tab: 'solo', mode: 'marathon', foes: 2, bot: 2, lv0: 1, hbot: 2, ctl: 'swipe', sens: 'mid', das: 'mid', ghost: true }, store.get('sb_prefs') || {});
if (!MODES.includes(P.mode)) P.mode = 'marathon';
if (![1, 2, 3].includes(P.foes)) P.foes = 2;
if (![0, 1, 2, 3, 4].includes(P.bot)) P.bot = 2;
if (![0, 1, 2, 3, 4].includes(P.hbot)) P.hbot = 2;
if (![1, 5, 10, 15].includes(P.lv0)) P.lv0 = 1;
if (!['swipe', 'pad'].includes(P.ctl)) P.ctl = 'swipe';
const saveP = () => store.set('sb_prefs', P);
// best results: marathon and two minutes by points, sprint by time
const BEST = Object.assign({}, store.get('sb_best') || {});
const fmtN = n => Math.round(n || 0).toLocaleString('en-US');
function fmtT(ms, cs) {
  ms = Math.max(0, ms || 0);
  const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60;
  return m + ':' + String(s).padStart(2, '0') + (cs ? '.' + String(Math.floor(ms / 10) % 100).padStart(2, '0') : '');
}
const bestTxt = m => (m === 'sprint' ? (BEST.sprint ? fmtT(BEST.sprint, true) : '') : BEST[m] ? fmtN(BEST[m]) : '');

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
function show(id) { screenOn = id; for (const x of ['lobby', 'room', 'game']) $(x).hidden = x !== id; if (id !== 'game') { closeSheet(); SND.music.stop(); } }
function confirmBox(q, yes, no) {
  overlay(`<b>${esc(q)}</b>`, [[T('cancel'), 'glass', () => { overlay(null); if (no) no(); }], [T('ok'), 'red', () => { overlay(null); yes(); }]]);
}
const confirmOpen = () => !$('overlay').hidden && !!$('ovCard').querySelector('.btn.red');
