// ===== core: storage, identity, preferences, avatars, tile drawing and the small UI helpers (toast, overlay, sheets) =====
const W = window, CX = W.CX, AI = W.CXAI, AV = W.Art, ART = W.CXArt, SND = W.CXSound, I18 = W.CXI18N, T = I18.t;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// name, avatar, token and language are shared with the other games (localStorage mh_*)
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('mh_' + k)); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('mh_' + k); else localStorage.setItem('mh_' + k, JSON.stringify(v)); } catch (e) {} },
};
const rid = n => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const qs = new URLSearchParams(location.search);
const zh = () => I18.lang === 'zh';
const PREFIX = 'yejumm-v1-';
const ICE = [
  { urls: 'stun:stun.miwifi.com:3478' }, { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];
function peerOpts(tok) {
  const o = { config: { iceServers: ICE, iceCandidatePoolSize: 4 }, debug: 1 };
  if (tok) o.token = tok;   // the host's fixed token: a reopened page gets the same room id straight back
  const ph = qs.get('ph');   // tests: a local PeerServer
  if (ph) { const [h, p] = ph.split(':'); Object.assign(o, { host: h, port: +p || 9000, path: '/', secure: false, config: { iceServers: [] } }); }
  return o;
}
const EMOS = ['😂', '😭', '😡', '😎', '🤔', '👍', '🙏', '🔥', '😱', '🤡', '🥳', '😏'];

let token = store.get('token'); if (!token) { token = rid(16); store.set('token', token); }
let myName = store.get('name') || '';
let myAv = store.get('av'); if (myAv == null || !(myAv >= 0 && myAv < AV.AVATARS.length)) { myAv = Math.floor(Math.random() * AV.AVATARS.length); store.set('av', myAv); }

// preferences: hints off / simple / exact, bot speed, the practice table (how many bots, how strong), the last tab, and the rules
const P = Object.assign({ hints: 'simple', speed: 'normal', bot: 2, opp: 1, tab: 'solo' }, store.get('mm_prefs') || {});
P.rules = CX.cleanRules(P.rules);
if (!['off', 'simple', 'exact'].includes(P.hints)) P.hints = 'simple';
if (!['fast', 'normal', 'slow'].includes(P.speed)) P.speed = 'normal';
P.opp = clamp(P.opp | 0 || 1, 1, 3); P.bot = clamp(P.bot | 0, 0, 4);
const saveP = () => store.set('mm_prefs', P);

const avSvg = p => !p ? '' : p.bot
  ? `<svg viewBox="0 0 100 100"><use href="#bq${clamp((p.lv | 0) - 1, 0, 3)}"/></svg>`
  : `<svg viewBox="0 0 100 100"><use href="#av${clamp(p.av | 0, 0, AV.AVATARS.length - 1)}"/></svg>`;
const icon = (id, cls) => `<svg class="${cls || 'ic'}" viewBox="0 0 24 24"><use href="#i-${id}"/></svg>`;
const lvName = lv => T('lvNames')[clamp((lv | 0) - 1, 0, 3)];

// ---------------- a tile ----------------
// t: { c: 0 black / 1 white, v: the value when the viewer can see it (12 = key), open: cracked (everyone sees it), bad: wrong guesses }
const KEYV = CX.KEY;
const keySvg = cls => `<svg class="${cls || 'ky'}" viewBox="0 0 24 40"><use href="#cx-key"/></svg>`;
const holeSvg = () => '<svg class="kh" viewBox="0 0 24 40"><use href="#cx-hole"/></svg>';
function faceHTML(v) {
  if (v === KEYV) return keySvg();
  return `<span class="n${v >= 10 ? ' two' : ''}${v === 6 || v === 9 ? ' u' : ''}">${v}</span>`;
}
// o.mine: in your own row a cracked tile gets an eye (everyone can see it); o.end: the round is over, so nothing is struck through any more
function tileClass(t, o) {
  let c = 'tile ' + (t.c ? 'w' : 'k');
  if (t.v == null) c += ' back';
  if (t.open) c += ' open';
  if (o && o.ghost) c += ' ghost';
  return c;
}
function tileInner(t, o) {
  let h = '<div class="in">' + (o && o.ghost ? '' : t.v == null ? holeSvg() : faceHTML(t.v)) + '</div>';
  if (o && o.mine && t.open && !o.end) h += `<span class="eye">${icon('eye', '')}</span>`;
  if (t.bad && t.bad.length && !t.open && !(o && o.end)) h += `<div class="bad">${t.bad.map(b => b === KEYV ? `<s>${keySvg('kb')}</s>` : `<s>${b}</s>`).join('')}</div>`;
  return h;
}
function tileHTML(t, o, extra, tw) { return `<div class="${tileClass(t, o)}${extra ? ' ' + extra : ''}"${tw ? ` style="--tw:${tw}px"` : ''}>${tileInner(t, o)}</div>`; }
// a small coloured chip with a value, for the ticker and the guess bubble
const chip = (c, v) => `<span class="chip ${c ? 'w' : 'k'}">${v === KEYV ? keySvg('') : v}</span>`;

// ---------------- toast, overlay, sheets ----------------
let toastT = 0;
function toast(msg, ms) { const t = $('toast'); t.innerHTML = msg; t.hidden = false; t.style.animation = 'none'; t.offsetWidth; t.style.animation = ''; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2400); }
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
const head = (title, x) => `<h3>${title}<span class="grow"></span>${x === false ? '' : `<button class="x" data-close aria-label="Close">${icon('close', '')}</button>`}</h3>`;
function copyText(s) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).then(() => true, () => fallback());
  return Promise.resolve(fallback());
  function fallback() { const ta = document.createElement('textarea'); ta.value = s; ta.style.cssText = 'position:fixed;top:-100px'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok; }
}
const inviteUrl = code => location.origin + location.pathname + '#' + code;
function invite(code, share) {
  const text = T('invite', { c: code, u: inviteUrl(code) });
  if (share && navigator.share) { navigator.share({ title: T('title'), text, url: inviteUrl(code) }).catch(() => {}); return; }
  copyText(text).then(ok => toast(ok ? esc(T('copied')) : esc(text), 3200));
}
function show(id) { for (const x of ['lobby', 'room', 'game']) $(x).hidden = x !== id; if (id !== 'game') closeSheet(); }
function confirmBox(q, sub, yes) {
  overlay(`<b>${esc(q)}</b>${sub ? `<p>${esc(sub)}</p>` : ''}`, [[T('cancel'), 'glass', () => overlay(null)], [T('ok'), 'red', () => { overlay(null); yes(); }]]);
}
