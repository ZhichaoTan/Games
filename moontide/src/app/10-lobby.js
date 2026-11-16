// ===== the lobby: name and avatar, join / host / practice, unfinished games =====
function applyStatic() {
  document.documentElement.lang = I18.lang === 'zh' ? 'zh' : 'en';
  document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = T(el.dataset.t); });
  $('nick').placeholder = T('namePh');
  $('btnLang').querySelector('span').textContent = T('langBtn');
  document.title = I18.lang === 'zh' ? T('titleA') + T('titleB') : T('title');
}
$('scene').innerHTML = A.scene();
function paintMe() {
  $('meAv').innerHTML = `<svg viewBox="0 0 100 100"><use href="#av${myAv}"/></svg>`;
  const g = $('avs'); g.innerHTML = '';
  AV.AVATARS.forEach((a, i) => {
    const b = document.createElement('button');
    b.className = i === myAv ? 'on' : '';
    b.setAttribute('aria-label', I18.lang === 'zh' ? a.zh : a.en);
    b.innerHTML = `<svg viewBox="0 0 100 100"><use href="#av${i}"/></svg>`;
    b.onclick = () => { myAv = i; store.set('av', i); paintMe(); SND.play('tap'); };
    g.appendChild(b);
  });
}
$('nick').value = myName;
$('nick').addEventListener('input', () => { $('lobErr').textContent = ''; });
function needName() {
  const n = $('nick').value.trim().slice(0, 10);
  if (!n) { $('lobErr').textContent = T('needName'); $('nick').focus(); return false; }
  myName = n; store.set('name', n); return true;
}
// options for hosting and practice
const BOTV = [1, 2, 3, 0];
const botTxt = v => (v ? T('lv')[v] : T('lvMix'));
const spTxt = v => T(v === 'fast' ? 'spFast' : v === 'slow' ? 'spSlow' : 'spNormal');
function segRow(lab, vals, cur, txt, set) {
  const row = document.createDocumentFragment();
  const l = document.createElement('span'); l.textContent = lab; row.appendChild(l);
  const seg = document.createElement('div'); seg.className = 'seg';
  for (const v of vals) {
    const b = document.createElement('button');
    b.textContent = txt(v); b.className = v === cur ? 'on' : '';
    b.onclick = () => { set(v); saveP(); SND.play('tap'); renderOpts(); };
    seg.appendChild(b);
  }
  row.appendChild(seg);
  return row;
}
function renderOpts() {
  for (const [id, solo] of [['optsHost', false], ['optsSolo', true]]) {
    const box = $(id); box.innerHTML = '';
    if (solo) box.appendChild(segRow(T('oPlayers'), [2, 3, 4], P.n, String, v => { P.n = v; }));
    box.appendChild(segRow(T('oBots'), BOTV, P.bot, botTxt, v => { P.bot = v; }));
    box.appendChild(segRow(T('oSetup'), ['place', 'quick'], P.rules.setup, v => T(v === 'quick' ? 'setupQuick' : 'setupPlace'), v => { P.rules.setup = v; }));
    if (solo) box.appendChild(segRow(T('oSpeed'), ['fast', 'normal', 'slow'], P.speed, spTxt, v => { P.speed = v; }));
    else box.appendChild(segRow(T('oTimer'), [0, 45, 90], P.rules.timer, v => (v ? T('tSec', { n: v }) : T('tOff')), v => { P.rules.timer = v; }));
  }
}
function setTab(k) {
  if (!['join', 'host', 'solo'].includes(k)) k = 'solo';
  P.tab = k; saveP();
  const i = ['join', 'host', 'solo'].indexOf(k);
  $('tabs').querySelector('.pill').style.transform = `translateX(${i * 100}%)`;
  $('tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === k));
  $('paneJoin').hidden = k !== 'join'; $('paneHost').hidden = k !== 'host'; $('paneSolo').hidden = k !== 'solo';
  $('lobErr').textContent = '';
}
$('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { setTab(b.dataset.tab); SND.play('tap'); });
$('joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
$('btnJoin').onclick = () => {
  if (!needName()) return;
  const c = $('joinCode').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(c)) { $('lobErr').textContent = T('badCode'); return; }
  startClient(c);
};
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
$('btnCreate').onclick = () => { if (!needName()) return; startHost({ solo: false }); };
$('btnSolo').onclick = () => { if (!needName()) return; startHost({ solo: true }); };
$('btnRules').onclick = () => showRules();
$('btnLang').onclick = () => { I18.set(I18.lang === 'zh' ? 'en' : 'zh'); refreshLang(); SND.play('tap'); };
function refreshLang() { applyStatic(); paintMe(); renderOpts(); renderResume(); if (S && S.view) onView(S.view, S.room, true); }
const fresh = (x, ms) => x && Date.now() - (x.at || 0) < (ms || 3 * 86400e3);
function renderResume() {
  const box = $('resumeBox');
  const hs = store.get('cd_host'), ss = store.get('cd_solo'), cs = store.get('cd_client');
  let h = '';
  if (fresh(hs) && hs.T) h += `<div class="resume"><div class="tx">${T('resumeHost', { c: esc(hs.code) })}</div><button class="btn gold sm" data-r="host">${T('resume')}</button><button class="btn glass sm" data-x="cd_host">${T('discard')}</button></div>`;
  if (fresh(ss) && ss.T) h += `<div class="resume"><div class="tx">${T('resumeSolo')}</div><button class="btn gold sm" data-r="solo">${T('resume')}</button><button class="btn glass sm" data-x="cd_solo">${T('discard')}</button></div>`;
  if (fresh(cs, 12 * 3600e3) && cs.code) h += `<div class="resume"><div class="tx">${T('resumeClient', { c: esc(cs.code) })}</div><button class="btn gold sm" data-r="client">${T('rejoin')}</button><button class="btn glass sm" data-x="cd_client">✕</button></div>`;
  box.innerHTML = h; box.hidden = !h;
  box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { store.set(b.dataset.x, null); renderResume(); });
  box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    if (!needName()) return;
    if (b.dataset.r === 'host') startHost({ solo: false, restore: hs });
    else if (b.dataset.r === 'solo') startHost({ solo: true, restore: ss });
    else startClient(cs.code);
  });
}
