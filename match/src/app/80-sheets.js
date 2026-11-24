// ===== sheets: the menu and settings, the theme, chat, rules =====
$('btnMenu').onclick = () => showMenu();
$('btnChat').onclick = () => showChat();
const togRow = (lab, on, id) => `<div class="mrow"><span class="grow">${esc(lab)}</span><button class="tog${on ? ' on' : ''}" data-tog="${id}" aria-label="${esc(lab)}"><i></i></button></div>`;
const THEMES = ['pal', 'mm'];
const themeSeg = () => `<div class="mrow"><span class="grow">${esc(T('theme'))}</span><div class="seg">${THEMES.map(x => `<button data-theme="${x}" class="${P.theme === x ? 'on' : ''}">${esc(T('themes')[x])}</button>`).join('')}</div></div>`;
function showMenu() {
  if (!S) return;
  const solo = S.mode === 'solo', battle = U.battle, v = S.view;
  if (S.canPause && live()) pausePlay();
  let h = head(T('menu'));
  if (!solo) h += `<div class="mrow"><span class="grow">${esc(T('roomChip', { c: S.code }))}</span><button class="btn glass sm" id="mInv"><svg class="ic" viewBox="0 0 24 24"><use href="#i-share"/></svg>${esc(T('share'))}</button></div>`;
  if (battle && v) {
    h += `<div class="mhd">${esc(T('players'))}</div>`;
    v.seats.forEach((p, s) => {
      if (!p) return;
      const rd = v.rd, st = rd && rd.st[s];
      const tag = !p.bot && !p.conn ? T('offline') : st ? T('inRound') : rd && rd.phase !== 'over' ? T('watchTag') : '';
      let right = '';
      if (S.isHost && s !== 0 && !p.bot && S.mode === 'host') right = `<button class="btn glass sm" data-kick="${s}">${esc(T('kick'))}</button>`;
      if (p.bot) right = `<span class="lvb">${esc(T('lv')[p.lv])}</span>`;
      h += `<div class="mrow"><span class="av" style="--pc:${pcOf(s)}">${avSvg(p, s)}</span><span class="grow">${esc(p.bot ? botName(p) : p.name)}${s === v.me ? ` <small>${esc(T('youTag'))}</small>` : ''} <small>${esc(tag)}</small></span>${right}</div>`;
    });
  }
  h += `<div class="mhd">${esc(T('soundH'))}</div>`;
  h += togRow(T('sound'), SND.prefs.on && SND.prefs.sfx, 'sfx');
  h += togRow(T('music'), SND.prefs.on && SND.prefs.music, 'music');
  if ('vibrate' in navigator) h += togRow(T('vib'), SND.prefs.vib, 'vib');
  h += `<div class="mhd">${esc(T('ctlH'))}</div>`;
  h += togRow(T('hintsOn'), P.hints, 'hints');
  if (U.kind === 'level') h += togRow(T('fast'), P.fast, 'fast');
  h += themeSeg();
  h += `<div class="mrow"><span class="grow">${esc(T('lang'))}</span><div class="seg"><button data-lang="en" class="${I18.lang === 'en' ? 'on' : ''}">English</button><button data-lang="zh" class="${I18.lang === 'zh' ? 'on' : ''}">中文</button></div></div>`;
  h += '<div class="mgrid">';
  h += `<button class="btn glass" id="mRules"><svg class="ic" viewBox="0 0 24 24"><use href="#i-rule"/></svg>${esc(T('rules'))}</button>`;
  if (solo && S.restart) h += `<button class="btn glass" id="mRestart"><svg class="ic" viewBox="0 0 24 24"><use href="#i-again"/></svg>${esc(T(U.kind === 'level' ? 'restart' : 'restartRush'))}</button>`;
  else if (S.isHost && !solo && v && v.rd && v.rd.phase === 'over') h += `<button class="btn glass" id="mRoom"><svg class="ic" viewBox="0 0 24 24"><use href="#i-room"/></svg>${esc(T('toRoom'))}</button>`;
  h += '</div><div class="mgrid one">';
  if (U.paused) h += `<button class="btn gold" id="mResume"><svg class="ic" viewBox="0 0 24 24"><use href="#i-play"/></svg>${esc(T('resumeGame'))}</button>`;
  if (solo) h += `<button class="btn red" id="mLeave">${esc(T('leaveSolo'))}</button>`;
  else if (S.isHost) h += `<button class="btn red" id="mEnd">${esc(T('endRoom'))}</button>`;
  else h += `<button class="btn red" id="mLeave">${esc(T('leaveRoom'))}</button>`;
  h += '</div>';
  const sh = sheet(h, { id: 'menu' });
  sh.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => {
    const k = b.dataset.tog, on = !b.classList.contains('on');
    b.classList.toggle('on', on); SND.play('tap');
    if (k === 'hints') { P.hints = on; saveP(); V.hint = null; return; }
    if (k === 'fast') { P.fast = on; saveP(); V.spd = on ? 1.35 : 1; return; }
    if (on && (k === 'sfx' || k === 'music') && !SND.prefs.on) { SND.set('on', true); paintSound(); }
    SND.set(k, on);
    if (k === 'vib' && on) SND.vibrate(40);
  });
  sh.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { setTheme(b.dataset.theme); showMenu(); });
  sh.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { I18.set(b.dataset.lang); refreshLang(); showMenu(); });
  sh.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { S.kick(+b.dataset.kick); setTimeout(showMenu, 80); });
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('mInv', () => invite(S.code, true));
  on('mRules', () => showRules());
  on('mResume', () => { closeSheet(); resumePlay(); });
  on('mRestart', () => { closeSheet(); confirmBox(T(U.kind === 'level' ? 'confirmRestart' : 'confirmRush'), () => S.restart(), () => {}); });
  on('mRoom', () => { closeSheet(); S.toRoom(); });
  on('mLeave', async () => {
    if (solo) { if (S.leave) await S.leave(); goLobby(); return; }
    closeSheet(); confirmBox(T('confirmLeave'), async () => { await S.leave(); goLobby(); });
  });
  on('mEnd', () => { closeSheet(); confirmBox(T('confirmEnd'), async () => { await S.leave('end'); goLobby(); }); });
}
// a different look, at once, on whatever is showing
function setTheme(t) {
  if (!THEMES.includes(t) || t === P.theme) return;
  P.theme = t; saveP(); applyTheme();
  SND.play('tap');
  $('scene').innerHTML = A.scene('sc');
  applyStatic(); paintMe(); renderModes(); renderOpts(); renderResume();
  if (screenOn === 'map') renderMap();
  if (screenOn === 'room' && S && S.view) renderRoom(S.view, S.room);
  if (screenOn === 'game') { V.bgKey = ''; U.miniKey = {}; if (U.refresh) U.refresh(); }
}
// the lobby's theme button: the two looks side by side
function showThemes() {
  let h = head(T('theme')) + '<div class="themes">';
  for (const t of THEMES) {
    const was = A.theme; A.setTheme(t);
    const art = [0, 1, 2].map(c => A.svg(0, c, c === 1 ? 'happy' : 'idle', 'th' + t + c)).join('');
    A.setTheme(was);
    h += `<button class="thm${P.theme === t ? ' on' : ''}" data-th="${t}" style="--thbg:${t === 'pal' ? 'linear-gradient(180deg,#bfe6fb,#e9f7d8)' : 'linear-gradient(180deg,#2b2f72,#0f1030)'}"><span class="art">${art}</span><b>${esc(T('themes')[t])}</b></button>`;
  }
  h += '</div>';
  const sh = sheet(h, { id: 'themes' });
  sh.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { setTheme(b.dataset.th); closeSheet(); });
}
$('btnTheme').onclick = () => showThemes();

// ---------- chat ----------
function showChat() {
  if (!S || S.mode === 'solo') return;
  let h = head(T('chat'));
  h += `<div class="emos">${EMOS.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>`;
  h += `<div class="phr">${T('phrases').map((p, i) => `<button data-p="${i}">${esc(p)}</button>`).join('')}</div>`;
  h += `<div class="code-row chatrow"><input class="inp" id="chatIn" maxlength="40" placeholder="${esc(T('chatPh'))}"><button class="btn gold" id="chatGo">${esc(T('send'))}</button></div>`;
  const sh = sheet(h, { id: 'chat' });
  sh.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { S.chat({ emo: b.dataset.e }); closeSheet(); });
  sh.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { S.chat({ p: +b.dataset.p }); closeSheet(); });
  const go = () => { const t = $('chatIn').value.trim(); if (t) { S.chat({ text: t }); closeSheet(); } };
  $('chatGo').onclick = go;
  $('chatIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); });
}

// ---------- rules, with the pieces drawn in ----------
function showRules() {
  const row = (p, txt) => `<div class="rr">${p}<p>${esc(txt)}</p></div>`;
  let h = head(T('rulesTitle'));
  h += '<div class="rules-txt">';
  h += `<h4>${esc(T('rBasicH'))}</h4><div class="pics">${[0, 0, 0].map((c, k) => pic('m', 0, k === 1 ? 'happy' : 'idle')).join('')}<span style="width:10px"></span>${[3, 3, 3].map(c => pic('m', c, 'idle')).join('')}</div><p>${esc(T('rBasic'))}</p>`;
  h += `<h4>${esc(T('rSpecH'))}</h4>`;
  h += row(pic('rh'), T('rSpecRocket')) + row(pic('kl'), T('rSpecLantern')) + row(pic('fc'), T('rSpecCracker')) + row(pic('fw'), T('rSpecFirework'));
  h += `<p>${esc(T('rSpecUse'))}</p>`;
  h += `<h4>${esc(T('rComboH'))}</h4><div class="pics">${pic('rh')}${pic('fc')}<span style="width:10px"></span>${pic('fw')}${pic('kl')}</div><p>${esc(T('rCombo'))}</p>`;
  h += `<h4>${esc(T('rObsH'))}</h4>`;
  h += row(pic('frost', 2), T('rObsFrost')) + row(pic('cage'), T('rObsCage')) + row(pic('box', 3), T('rObsBox')) + row(pic('ing'), T('rObsIngot'));
  h += `<h4>${esc(T('rLevelsH'))}</h4><p>${esc(T('rLevels'))}</p>`;
  h += `<h4>${esc(T('rVsH'))}</h4><p>${esc(T('rVs'))}</p>`;
  h += `<h4>${esc(T('rBotsH'))}</h4><p>${esc(T('rBots'))}</p>`;
  h += '</div>';
  sheet(h, { id: 'rules' });
}
