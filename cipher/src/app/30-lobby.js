// ===== the lobby: name and avatar, join / host / practice, settings =====
function applyStatic() {
  document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = T(el.dataset.t); });
  $('nick').placeholder = T('namePh');
  $('btnLang').querySelector('span').textContent = T('langBtn');
  document.title = T('title');
}
// five tiles fanned out over the title: two backs, two numbers and a key in the middle
(function hero() {
  const tiles = [{ c: 1 }, { c: 0, v: 2 }, { c: 0, v: KEYV }, { c: 1, v: 9 }, { c: 0 }];
  $('hart').insertAdjacentHTML('beforeend', tiles.map((t, i) => tileHTML(t, {}, 'h' + i)).join(''));
})();
function paintMe() {
  $('meAv').innerHTML = `<svg viewBox="0 0 100 100"><use href="#av${myAv}"/></svg>`;
  const g = $('avs'); g.innerHTML = '';
  AV.AVATARS.forEach((a, i) => {
    const b = document.createElement('button');
    b.className = i === myAv ? 'on' : '';
    b.setAttribute('aria-label', a.en || ('Avatar ' + (i + 1)));
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

// ---------------- options ----------------
function segRow(lab, vals, cur, txt, set, rerender) {
  const frag = document.createDocumentFragment();
  const l = document.createElement('span'); l.textContent = lab; frag.appendChild(l);
  const seg = document.createElement('div'); seg.className = 'seg';
  for (const v of vals) {
    const b = document.createElement('button');
    b.innerHTML = txt(v); b.className = v === cur ? 'on' : '';
    b.onclick = () => { set(v); SND.play('tap'); (rerender || renderOpts)(); };
    seg.appendChild(b);
  }
  frag.appendChild(seg);
  return frag;
}
const keysTxt = v => T(v ? 'oOn' : 'oOff');
const timerTxt = v => v ? T('oSec', { n: v }) : T('oNoTimer');
const botTxt = v => v ? esc(lvName(v)) : T('oMixed');
function ruleRows(box, r, set, rerender) {
  box.appendChild(segRow(T('oKeys'), [true, false], r.keys, keysTxt, v => set({ keys: v }), rerender));
  const n = document.createElement('p'); n.className = 'optnote'; n.textContent = T('keysNote'); box.appendChild(n);
}
function renderOpts() {
  const h = $('optsHost'); h.innerHTML = '';
  ruleRows(h, P.rules, x => { Object.assign(P.rules, x); saveP(); });
  h.appendChild(segRow(T('oTimer'), CX.TIMERS.slice(1).concat([0]), P.rules.timer, timerTxt, v => { P.rules.timer = v; saveP(); }));
  const s = $('optsSolo'); s.innerHTML = '';
  s.appendChild(segRow(T('oOpp'), [1, 2, 3], P.opp, v => String(v), v => { P.opp = v; saveP(); }));
  s.appendChild(segRow(T('oLevel'), [1, 2, 3, 4, 0], P.bot, botTxt, v => { P.bot = v; saveP(); }));
  ruleRows(s, P.rules, x => { Object.assign(P.rules, x); saveP(); });
  const lv = P.bot;
  $('lvCard').innerHTML = lv
    ? `<span class="bq"><svg viewBox="0 0 100 100"><use href="#bq${lv - 1}"/></svg></span><div><b>${esc(lvName(lv))}</b><small>${esc(T('lvDesc')[lv - 1])}</small></div>`
    : `<span class="bq"><svg viewBox="0 0 100 100"><use href="#bq${Math.floor(Date.now() / 4000) % 4}"/></svg></span><div><b>${T('oMixed')}</b><small>${esc(T('lvMixDesc'))}</small></div>`;
}
function setTab(k) {
  P.tab = k; saveP();
  const i = ['join', 'host', 'solo'].indexOf(k);
  $('tabs').querySelector('.pill').style.transform = `translateX(${i * 100}%)`;
  $('tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === k));
  $('paneJoin').hidden = k !== 'join'; $('paneHost').hidden = k !== 'host'; $('paneSolo').hidden = k !== 'solo';
  $('lobErr').textContent = '';
}
$('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { setTab(b.dataset.tab); SND.play('tap'); });
$('joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); $('lobErr').textContent = ''; });
$('btnJoin').onclick = () => {
  if (!needName()) return;
  const c = $('joinCode').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(c)) { $('lobErr').textContent = T('badCode'); return; }
  startClient(c);
};
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
$('btnCreate').onclick = () => { if (!needName()) return; startHost({ solo: false }); };
$('btnSolo').onclick = () => { if (!needName()) return; store.set('mm_solo', null); startHost({ solo: true }); };
$('btnRules').onclick = () => showRules();
$('howBtn').onclick = () => showRules();
$('setBtn').onclick = () => showSettings();
$('btnLang').onclick = () => { I18.setLang(zh() ? 'en' : 'zh'); refreshLang(); SND.play('tap'); };
function refreshLang() {
  applyStatic(); renderOpts(); renderResume();
  UI.refresh();
  if (S && S.view && S.room) onView(S.view, S.room, true);
}
function renderResume() {
  const box = $('resumeBox');
  const hs = store.get('mm_host'), ss = store.get('mm_solo'), cs = store.get('mm_client');
  const fresh = (x, ms) => x && Date.now() - (x.at || 0) < ms;
  let h = '';
  if (fresh(ss, 14 * 86400e3) && ss.T && ss.T.R) h += `<div class="resume"><div class="tx">${T('resumeSolo', { n: ss.T.round || 1 })}</div><button class="btn gold sm" data-r="solo">${T('resume')}</button><button class="btn glass sm" data-x="mm_solo" aria-label="Discard">${icon('close')}</button></div>`;
  if (fresh(hs, 12 * 3600e3) && hs.T) h += `<div class="resume"><div class="tx">${T('resumeHost', { c: esc(hs.code) })}</div><button class="btn gold sm" data-r="host">${T('resume')}</button><button class="btn glass sm" data-x="mm_host" aria-label="Discard">${icon('close')}</button></div>`;
  if (fresh(cs, 12 * 3600e3) && cs.code) h += `<div class="resume"><div class="tx">${T('resumeClient', { c: esc(cs.code) })}</div><button class="btn gold sm" data-r="client">${T('rejoin')}</button><button class="btn glass sm" data-x="mm_client" aria-label="Discard">${icon('close')}</button></div>`;
  box.innerHTML = h; box.hidden = !h;
  box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { store.set(b.dataset.x, null); renderResume(); });
  box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    if (!needName()) return;
    if (b.dataset.r === 'host') startHost({ solo: false, restore: hs });
    else if (b.dataset.r === 'solo') startHost({ solo: true, restore: ss });
    else startClient(cs.code);
  });
}

// ---------------- settings (the lobby's sheet and the in-game menu share these rows) ----------------
function settingsHTML(o) {
  o = o || {};
  const sw = (k, on) => `<button class="sw${on ? ' on' : ''}" data-sw="${k}" role="switch" aria-checked="${on}"></button>`;
  const seg = (k, vals, cur, txt) => `<div class="seg">${vals.map(x => `<button data-${k}="${x}" class="${x === cur ? 'on' : ''}">${txt(x)}</button>`).join('')}</div>`;
  let h = '';
  if (o.auto != null) h += `<div class="srow"><div class="lab">${T('autoplay')}<small>${T('autoplaySub')}</small></div>${sw('auto', o.auto)}</div>`;
  h += `<div class="srow col"><div class="lab">${T('sHints')}<small>${T('sHintsSub')}</small></div>${seg('hint', ['off', 'simple', 'exact'], P.hints, x => T(x === 'off' ? 'hintOff' : x === 'simple' ? 'hintSimple' : 'hintExact'))}</div>`;
  h += `<div class="srow"><div class="lab">${T('sSound')}<small>${T('sSoundSub')}</small></div>${sw('on', SND.prefs.on)}</div>`;
  if ('vibrate' in navigator) h += `<div class="srow"><div class="lab">${T('sVib')}</div>${sw('vib', SND.prefs.vib)}</div>`;
  h += `<div class="srow"><div class="lab">${T('sLang')}</div>${seg('lang', ['en', 'zh'], I18.lang, x => x === 'en' ? 'English' : '中文')}</div>`;
  if (o.speed !== false) h += `<div class="srow"><div class="lab">${T('sSpeed')}</div>${seg('sp', ['fast', 'normal', 'slow'], P.speed, x => T(x === 'fast' ? 'spFast' : x === 'slow' ? 'spSlow' : 'spNormal'))}</div>`;
  return h;
}
function bindSettings(sh, again) {
  sh.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => {
    const k = b.dataset.sw, on = !b.classList.contains('on');
    b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
    if (k === 'auto') { if (S && S.setAuto) S.setAuto(on); }
    else { SND.set(k, on); if (k === 'on') { paintSound(); if (on) SND.play('tap'); } if (k === 'vib' && on) SND.vib(30); }
  });
  sh.querySelectorAll('[data-hint]').forEach(b => b.onclick = () => { P.hints = b.dataset.hint; saveP(); SND.play('tap'); UI.refresh(); again(); });
  sh.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { I18.setLang(b.dataset.lang); refreshLang(); again(); });
  sh.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { P.speed = b.dataset.sp; saveP(); SND.play('tap'); again(); });
}
function showSettings() {
  const sh = sheet(head(T('hSettings')) + settingsHTML({}), { id: 'settings' });
  bindSettings(sh, showSettings);
}
function showRules() {
  sheet(head(T('hRules')) + `<div class="rules-txt">${T('rulesHtml')}</div>`, { id: 'rules' });
}
