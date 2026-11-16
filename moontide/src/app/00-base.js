// ===== 沉岛 Moontide · the app: shared helpers (the build joins src/app/*.js in file-name order inside one function) =====
const W = window, MT = W.MT, AI = W.MTAI, A = W.MTArt, MB = W.MTBoard, SND = W.MTSound, I18 = W.MTI18N, AV = W.Art;
const T = I18.t;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// localStorage, shared key space with the other games (mh_name, mh_av, mh_lang, mh_token); this game's own keys start with mh_cd_
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('mh_' + k)); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('mh_' + k); else localStorage.setItem('mh_' + k, JSON.stringify(v)); } catch (e) {} },
};
const rid = n => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const PREFIX = 'yejucd-v1-';
const LIVE = 'cd_live';
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
const EMOS = ['😂', '😭', '😱', '😎', '🤔', '👍', '🙏', '🥳', '🦈', '🐙', '🦀', '🌊'];

// ---------- artwork: the shared avatars and icons, plus this game's gradients for pieces drawn outside the board ----------
(function sprite() {
  const I = (id, d) => `<symbol id="i-${id}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</g></symbol>`;
  const icons = I('rule', '<path d="M6 4.5h9.5L18 7v12.5H6z"/><path d="M9 10h6M9 13.5h6M9 17h3.5"/>') +
    I('share', '<circle cx="17" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.7 10.8l6.1-3.5M8.7 13.2l6.1 3.5"/>') +
    I('undo', '<path d="M9 7.5L5 11.5l4 4"/><path d="M5.5 11.5h8.5a4.5 4.5 0 0 1 0 9H11"/>') +
    I('zin', '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5M8 10.5h5M10.5 8v5"/>') +
    I('zout', '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5M8 10.5h5"/>') +
    I('wind', '<path d="M3.5 9h10a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3.5 13h14a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3.5 17h6"/>') +
    I('vib', '<rect x="8" y="4.5" width="8" height="15" rx="2"/><path d="M4.5 9v6M19.5 9v6"/>') +
    I('check', '<path d="M5 12.5l4.5 4.5L19 7.5"/>') +
    I('skip', '<path d="M6 6.5l7 5.5-7 5.5zM16.5 6.5v11"/>') +
    I('sink', '<path d="M4 15c2 1.6 4 1.6 6 0s4-1.6 6 0 3 1.4 4 .6"/><path d="M12 4v8M8.5 8.5L12 12l3.5-3.5"/>') +
    I('pin', '<path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>');
  // small solid glyphs for the player plates
  const S = (id, vb, d) => `<symbol id="${id}" viewBox="${vb}">${d}</symbol>`;
  const solid = S('g-lh', '0 0 24 24', '<path d="M9.4 21 10.2 7h3.6l.8 14z" fill="#f4f7f9"/><path d="M9.8 14h4.4l.25 3.5H9.55zM10.1 9.6h3.8l.12 2H10z" fill="#e5492f"/><rect x="9" y="5" width="6" height="2.4" rx=".6" fill="#ffd76a"/><path d="M8.6 5 12 2l3.4 3z" fill="#e5492f"/><path d="M6 21.5h12" stroke="#7d989c" stroke-width="1.6" stroke-linecap="round"/>') +
    S('g-man', '0 0 24 24', '<circle cx="12" cy="7.5" r="3.6" fill="currentColor"/><path d="M5 20.5a7 6.4 0 0 1 14 0z" fill="currentColor"/>') +
    S('g-lost', '0 0 24 24', '<path d="M3 13.5c2 1.8 4 1.8 6 0s4-1.8 6 0 4 1.8 6 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3 18.5c2 1.8 4 1.8 6 0s4-1.8 6 0 4 1.8 6 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".55"/><path d="M12 4v6M9.5 7.5 12 10l2.5-2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>') +
    S('g-pearl', '0 0 24 24', '<circle cx="12" cy="12" r="7.5" fill="#fbf3e2"/><circle cx="9.6" cy="9.4" r="2.6" fill="#fff" opacity=".9"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="#c9b48a" stroke-width="1"/>');
  $('sprite').innerHTML = AV.sprite('') + `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${A.defs()}${icons}${solid}</svg>`;
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
const pcOf = s => (A.PC[s] || A.PC[3]).a;
// bots wear the shared robot faces (Easy, Normal, Hard), players their own avatar
function avSvg(p, s) {
  if (!p) return '';
  if (p.bot) return `<svg viewBox="0 0 100 100" style="color:${AV.BOT_EYES[s % 4]}"><use href="#bq${[0, 0, 1, 3][p.lv | 0] || 0}"/></svg>`;
  return `<svg viewBox="0 0 100 100"><use href="#av${clamp(p.av | 0, 0, AV.AVATARS.length - 1)}"/></svg>`;
}

// ---------- identity and preferences (name, avatar and token are shared with the other games) ----------
let token = store.get('token'); if (!token) { token = rid(16); store.set('token', token); }
let myName = store.get('name') || '';
let myAv = store.get('av'); if (myAv == null || !(myAv >= 0 && myAv < AV.AVATARS.length)) { myAv = Math.floor(Math.random() * AV.AVATARS.length); store.set('av', myAv); }   // keep it, so you look the same when you come back
const P = Object.assign({ bot: 2, n: 3, speed: 'normal', tab: 'solo' }, store.get('cd_prefs') || {});
P.rules = MT.cleanRules(P.rules);
if (![2, 3, 4].includes(P.n)) P.n = 3;
if (![0, 1, 2, 3].includes(P.bot)) P.bot = 2;
const saveP = () => store.set('cd_prefs', P);

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
let sheetOn = null, sheetLock = false;
function sheet(html, opt) {
  opt = opt || {};
  const sh = $('sheet'), bg = $('sheetBg');
  sh.innerHTML = html;
  sh.className = 'sheet' + (opt.cls ? ' ' + opt.cls : '');
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
function show(id) { for (const x of ['lobby', 'room', 'game']) $(x).hidden = x !== id; if (id !== 'game') closeSheet(); }
function confirmBox(q, yes) {
  overlay(`<b>${esc(q)}</b>`, [[T('cancel'), 'glass', () => overlay(null)], [T('ok'), 'red', () => { overlay(null); yes(); }]]);
}
