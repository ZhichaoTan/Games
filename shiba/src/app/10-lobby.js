// ===== the lobby: name and avatar, join / host / solo modes, unfinished games =====
function applyStatic() {
  document.documentElement.lang = I18.lang === 'zh' ? 'zh' : 'en';
  document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = T(el.dataset.t); });
  $('nick').placeholder = T('namePh');
  $('btnLang').querySelector('span').textContent = T('langBtn');
  document.title = I18.lang === 'zh' ? T('titleA') + T('titleB') : T('title');
}
$('scene').innerHTML = A.scene('sc');
A.mood($('scene').querySelector('.shiba'), 'happy');
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
const BOTV = [1, 2, 3, 4, 0];
const botTxt = v => (v ? T('lv')[v] : T('lvMix'));
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
// the four solo modes as cards, each with a little block and the best result
// [block, turn, x, y, cell size, where it looks]
const MODE_ART = { marathon: [[2, 0, 24, 14, 12, 0]], sprint: [[1, 0, 2, 26, 12, 1]], ultra: [[3, 0, 12, 14, 12, 0]], versus: [[3, 1, 4, 9, 10, 1], [3, 3, 26, 9, 10, -1]] };
function renderModes() {
  const g = $('modes'); g.innerHTML = '';
  for (const m of MODES) {
    const b = document.createElement('button');
    b.className = 'mode' + (P.mode === m ? ' on' : '');
    b.dataset.m = m;
    const art = MODE_ART[m].map(([t, r, x, y, s, look]) => A.block(t, x, y, s, { p: 'sb', r, face: 'awake', look })).join('');
    const best = m === 'versus' ? '' : bestTxt(m);
    b.innerHTML = `<svg viewBox="0 0 50 40">${art}</svg><b>${esc(T('mode')[m])}</b><small>${best ? esc(T('best', { v: best })) : m === 'versus' ? '&nbsp;' : esc(T('noBest'))}</small>`;
    b.onclick = () => { P.mode = m; saveP(); SND.play('tap'); renderModes(); renderOpts(); };
    g.appendChild(b);
  }
  $('modeTip').textContent = T('modeTip')[P.mode];
}
function renderOpts() {
  const h = $('optsHost'); h.innerHTML = '';
  h.appendChild(segRow(T('oBots'), BOTV, P.hbot, botTxt, v => { P.hbot = v; }));
  const s = $('optsSolo'); s.innerHTML = '';
  if (P.mode === 'versus') {
    s.appendChild(segRow(T('oFoes'), [1, 2, 3], P.foes, String, v => { P.foes = v; }));
    s.appendChild(segRow(T('oBots'), BOTV, P.bot, botTxt, v => { P.bot = v; }));
  } else if (P.mode === 'marathon') s.appendChild(segRow(T('oLevel'), [1, 5, 10, 15], P.lv0, String, v => { P.lv0 = v; }));
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
$('btnSolo').onclick = () => {
  if (!needName()) return;
  if (P.mode === 'versus') startHost({ solo: true });
  else startSolo(P.mode);
};
$('btnRules').onclick = () => showRules();
$('btnLang').onclick = () => { I18.set(I18.lang === 'zh' ? 'en' : 'zh'); refreshLang(); SND.play('tap'); };
function refreshLang() { applyStatic(); paintMe(); renderModes(); renderOpts(); renderResume(); if (U.refresh) U.refresh(); }
const fresh = (x, ms) => x && Date.now() - (x.at || 0) < (ms || 3 * 86400e3);
function renderResume() {
  const box = $('resumeBox');
  const hs = store.get('sb_host'), ss = store.get('sb_solo'), cs = store.get('sb_client');
  let h = '';
  if (fresh(hs, 12 * 3600e3) && hs.code) h += `<div class="resume"><div class="tx">${T('resumeHost', { c: esc(hs.code) })}</div><button class="btn gold sm" data-r="host">${T('reopen')}</button><button class="btn glass sm" data-x="sb_host">${T('discard')}</button></div>`;
  if (fresh(ss) && ss.G && MODES.includes(ss.mode)) h += `<div class="resume"><div class="tx">${T('resumeSolo', { m: esc(T('mode')[ss.mode]) })}</div><button class="btn gold sm" data-r="solo">${T('resume')}</button><button class="btn glass sm" data-x="sb_solo">${T('discard')}</button></div>`;
  if (fresh(cs, 12 * 3600e3) && cs.code) h += `<div class="resume"><div class="tx">${T('resumeClient', { c: esc(cs.code) })}</div><button class="btn gold sm" data-r="client">${T('rejoin')}</button><button class="btn glass sm" data-x="sb_client">${T('discard')}</button></div>`;
  box.innerHTML = h; box.hidden = !h;
  box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { store.set(b.dataset.x, null); renderResume(); });
  box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    if (!needName()) return;
    if (b.dataset.r === 'host') startHost({ solo: false, restore: hs });
    else if (b.dataset.r === 'solo') startSolo(ss.mode, ss);
    else startClient(cs.code);
  });
}
