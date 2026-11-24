// ===== the lobby: name and avatar, join / host / solo modes, unfinished games =====
function applyStatic() {
  document.documentElement.lang = I18.lang === 'zh' ? 'zh' : 'en';
  document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = T(el.dataset.t); });
  $('nick').placeholder = T('namePh');
  $('btnLang').querySelector('span').textContent = T('langBtn');
  $('thName').textContent = T('theme') + colon() + T('themes')[P.theme];
  document.title = T('pageTitle');
}
$('scene').innerHTML = A.scene('sc');
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
function segRow(lab, vals, cur, txt, set, after) {
  const row = document.createDocumentFragment();
  const l = document.createElement('span'); l.textContent = lab; row.appendChild(l);
  const seg = document.createElement('div'); seg.className = 'seg';
  for (const v of vals) {
    const b = document.createElement('button');
    b.textContent = txt(v); b.className = v === cur ? 'on' : '';
    b.onclick = () => { set(v); saveP(); SND.play('tap'); (after || renderOpts)(); };
    seg.appendChild(b);
  }
  row.appendChild(seg);
  return row;
}
// the three solo modes as cards, each with its little picture and progress
function modeArt(m) {
  if (m === 'levels') return pic('m', 0, 'happy');
  if (m === 'rush') return pic('m', 2, 'wow') + `<svg viewBox="0 0 24 24" style="right:-2px;top:-2px;width:22px;height:22px;color:var(--gold)"><use href="#i-timer"/></svg>`;
  return `<svg viewBox="-6 -6 112 112" style="width:36px;height:36px;position:absolute;left:0;top:10px">${A.toSvg(A.partsOf(0, 4, 'idle'), 'mv1')}</svg><svg viewBox="-6 -6 112 112" style="width:36px;height:36px;position:absolute;right:0;top:10px;transform:scaleX(-1)">${A.toSvg(A.partsOf(0, 1, 'idle'), 'mv2')}</svg>`;
}
function renderModes() {
  const g = $('modes'); g.innerHTML = '';
  for (const m of MODES) {
    const b = document.createElement('button');
    b.className = 'mode' + (P.mode === m ? ' on' : '');
    b.dataset.m = m;
    const sub = m === 'levels' ? I18.fill(T('modeSub').levels, { n: nextLevel(), s: starsTotal() }) : m === 'rush' ? (PROG.rush ? I18.fill(T('modeSub').rush, { v: fmtN(PROG.rush) }) : T('modeSub').rushNone) : T('modeSub').versus;
    b.innerHTML = `<span class="art">${modeArt(m)}</span><b>${esc(T('mode')[m])}</b><small>${esc(sub)}</small>`;
    b.onclick = () => { P.mode = m; saveP(); SND.play('tap'); renderModes(); renderOpts(); };
    g.appendChild(b);
  }
  $('modeTip').textContent = T('modeTip')[P.mode];
}
function renderOpts() {
  const h = $('optsHost'); h.innerHTML = '';
  h.appendChild(segRow(T('oBots'), BOTV, P.hbot, botTxt, v => { P.hbot = v; }));
  h.appendChild(segRow(T('oTime'), TIMES, P.time, v => T('secs', { n: v }), v => { P.time = v; }));
  h.appendChild(segRow(T('oAtk'), [true, false], P.atk, v => T(v ? 'atkOn' : 'atkOff'), v => { P.atk = v; }));
  const s = $('optsSolo'); s.innerHTML = '';
  if (P.mode === 'versus') {
    s.appendChild(segRow(T('oFoes'), [1, 2, 3], P.foes, String, v => { P.foes = v; }));
    s.appendChild(segRow(T('oBots'), BOTV, P.bot, botTxt, v => { P.bot = v; }));
  }
  $('btnSolo').textContent = P.mode === 'levels' ? T('map') : T('startSolo');
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
  else if (P.mode === 'rush') startRush();
  else showMap(nextLevel());
};
$('btnRules').onclick = () => showRules();
$('btnLang').onclick = () => { I18.set(I18.lang === 'zh' ? 'en' : 'zh'); refreshLang(); SND.play('tap'); };
function refreshLang() { applyStatic(); paintMe(); renderModes(); renderOpts(); renderResume(); if (screenOn === 'map') renderMap(); if (U.refresh) U.refresh(); }
const fresh = (x, ms) => x && Date.now() - (x.at || 0) < (ms || 3 * 86400e3);
function renderResume() {
  const box = $('resumeBox');
  const hs = store.get('tt_host'), ss = store.get('tt_solo'), cs = store.get('tt_client');
  let h = '';
  if (fresh(hs, 12 * 3600e3) && hs.code) h += `<div class="resume"><div class="tx">${T('resumeHost', { c: esc(hs.code) })}</div><button class="btn gold sm" data-r="host">${T('reopen')}</button><button class="btn glass sm" data-x="tt_host">${T('discard')}</button></div>`;
  if (fresh(ss) && ss.G && (ss.kind === 'rush' || (ss.kind === 'level' && ss.n >= 1 && ss.n <= LV.COUNT))) {
    const tx = ss.kind === 'level' ? T('resumeLevel', { n: ss.n }) : T('resumeSolo', { m: esc(T('mode').rush) });
    h += `<div class="resume"><div class="tx">${tx}</div><button class="btn gold sm" data-r="solo">${T('resume')}</button><button class="btn glass sm" data-x="tt_solo">${T('discard')}</button></div>`;
  }
  if (fresh(cs, 12 * 3600e3) && cs.code) h += `<div class="resume"><div class="tx">${T('resumeClient', { c: esc(cs.code) })}</div><button class="btn gold sm" data-r="client">${T('rejoin')}</button><button class="btn glass sm" data-x="tt_client">${T('discard')}</button></div>`;
  box.innerHTML = h; box.hidden = !h;
  box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { store.set(b.dataset.x, null); renderResume(); });
  box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    if (!needName()) return;
    if (b.dataset.r === 'host') startHost({ solo: false, restore: hs });
    else if (b.dataset.r === 'solo') { if (ss.kind === 'rush') startRush(ss); else startLevel(ss.n, ss); }
    else startClient(cs.code);
  });
}
