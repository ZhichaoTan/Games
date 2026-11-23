// ===== sheets: the menu and settings, chat, rules =====
$('btnMenu').onclick = () => showMenu();
$('btnChat').onclick = () => showChat();
const togRow = (lab, on, id) => `<div class="mrow"><span class="grow">${esc(lab)}</span><button class="tog${on ? ' on' : ''}" data-tog="${id}" aria-label="${esc(lab)}"><i></i></button></div>`;
const segHtml = (lab, id, vals, cur, txt) => `<div class="mrow"><span class="grow">${esc(lab)}</span><div class="seg">${vals.map(x => `<button data-${id}="${x}" class="${cur === x ? 'on' : ''}">${esc(txt(x))}</button>`).join('')}</div></div>`;
function showMenu() {
  if (!S) return;
  const solo = S.mode === 'solo', battle = U.battle, v = S.view, room = S.room || {};
  if (S.canPause && live()) pausePlay();
  let h = head(T('menu'));
  if (!solo) h += `<div class="mrow"><span class="grow">${esc(T('roomChip', { c: S.code }))}</span><button class="btn glass sm" id="mInv"><svg class="ic" viewBox="0 0 24 24"><use href="#i-share"/></svg>${esc(T('share'))}</button></div>`;
  if (battle && v) {
    h += `<div class="mhd">${esc(T('players'))}</div>`;
    v.seats.forEach((p, s) => {
      if (!p) return;
      const rd = v.rd, st = rd && rd.st[s];
      let tag = !p.bot && !p.conn ? T('offline') : st ? (st.out ? T('outTag') : T('inRound')) : rd && rd.phase !== 'over' ? T('watchTag') : '';
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
  if (touchy) {
    h += segHtml(T('controls'), 'ctl', ['swipe', 'pad'], P.ctl, x => T(x === 'pad' ? 'ctlPad' : 'ctlSwipe'));
    h += `<div class="mnote">${esc(T('ctlTip')[P.ctl])}</div>`;
    if (P.ctl === 'swipe') h += segHtml(T('sens'), 'sens', ['lo', 'mid', 'hi'], P.sens, x => T(x === 'lo' ? 'sensLo' : x === 'hi' ? 'sensHi' : 'sensMid'));
  }
  if (!touchy || P.ctl === 'pad') h += segHtml(T('das'), 'das', ['slow', 'mid', 'fast'], P.das, x => T(x === 'slow' ? 'dasSlow' : x === 'fast' ? 'dasFast' : 'dasMid'));
  h += togRow(T('ghost'), P.ghost, 'ghost');
  h += `<div class="mrow"><span class="grow">${esc(T('lang'))}</span><div class="seg"><button data-lang="en" class="${I18.lang === 'en' ? 'on' : ''}">English</button><button data-lang="zh" class="${I18.lang === 'zh' ? 'on' : ''}">中文</button></div></div>`;
  if (!touchy) h += `<div class="mnote" style="border:0;padding-top:10px">${esc(T('keysTip'))}</div>`;
  h += '<div class="mgrid">';
  h += `<button class="btn glass" id="mRules"><svg class="ic" viewBox="0 0 24 24"><use href="#i-rule"/></svg>${esc(T('rules'))}</button>`;
  if (solo && !battle) h += `<button class="btn glass" id="mRestart"><svg class="ic" viewBox="0 0 24 24"><use href="#i-again"/></svg>${esc(T('restart'))}</button>`;
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
    if (k === 'ghost') { P.ghost = on; saveP(); U.ver++; return; }
    if (on && (k === 'sfx' || k === 'music') && !SND.prefs.on) { SND.set('on', true); paintSound(); }
    SND.set(k, on);
    if (k === 'vib' && on) SND.vibrate(40);
  });
  sh.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { I18.set(b.dataset.lang); refreshLang(); showMenu(); });
  sh.querySelectorAll('[data-ctl]').forEach(b => b.onclick = () => { P.ctl = b.dataset.ctl; saveP(); $('pad').hidden = !(touchy && P.ctl === 'pad'); layout(); showMenu(); });
  sh.querySelectorAll('[data-sens]').forEach(b => b.onclick = () => { P.sens = b.dataset.sens; saveP(); showMenu(); });
  sh.querySelectorAll('[data-das]').forEach(b => b.onclick = () => { P.das = b.dataset.das; saveP(); showMenu(); });
  sh.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { S.kick(+b.dataset.kick); setTimeout(showMenu, 80); });
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('mInv', () => invite(S.code, true));
  on('mRules', () => showRules());
  on('mResume', () => { closeSheet(); resumePlay(); });
  on('mRestart', () => { closeSheet(); confirmBox(T('confirmRestart'), () => S.restart(), () => {}); });
  on('mRoom', () => { closeSheet(); S.toRoom(); });
  on('mLeave', async () => {
    if (solo) { if (S.leave) await S.leave(); goLobby(); return; }
    closeSheet(); confirmBox(T('confirmLeave'), async () => { await S.leave(); goLobby(); });
  });
  on('mEnd', () => { closeSheet(); confirmBox(T('confirmEnd'), async () => { await S.leave('end'); goLobby(); }); });
}
U.refresh = () => {
  if (!S) return;
  if (screenOn === 'game') { $('ktip').textContent = T('keysTip'); SIDE.hk = SIDE.nk = ''; U.statKey = ''; tbInfo(); if (U.battle && S.view) paintOpps(S.view); }
  else if (screenOn === 'room' && S.view) renderRoom(S.view, S.room);
};

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

// ---------- rules, with the blocks drawn in ----------
function showRules() {
  const pic = (inner, w, h) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`;
  const s = 13;
  const seven = [1, 2, 3, 4, 5, 6, 7].map(t => {
    const cs = SB.CELLS[t][0], w = (Math.max(...cs.map(c => c[0])) - Math.min(...cs.map(c => c[0])) + 1) * s, hh = (Math.max(...cs.map(c => c[1])) - Math.min(...cs.map(c => c[1])) + 1) * s;
    return pic(A.block(t, 0, 4, s, { p: 'sb', face: 'awake' }), w, hh + 4);
  }).join('');
  const bub = pic([0, 1, 2, 3, 5, 6, 7, 8, 9].map(x => A.cell(8, x * 12, 0, 12, { p: 'sb' })).join('') + [0, 1, 2, 3, 4, 5, 7, 8, 9].map(x => A.cell(8, x * 12, 12, 12, { p: 'sb' })).join(''), 120, 24);
  let h = head(T('rulesTitle'));
  h += '<div class="rules-txt">';
  h += `<h4>${esc(T('rWellH'))}</h4><div class="pics">${seven}</div><p>${esc(T('rWell'))}</p>`;
  h += `<h4>${esc(T('rCtlH'))}</h4>`;
  if (touchy) h += `<p>${esc(T('rCtlSwipe'))}</p><p>${esc(T('rCtlPad'))}</p>`;
  h += `<p>${esc(T('rCtlKeys'))}</p>`;
  h += `<h4>${esc(T('rGhostH'))}</h4><p>${esc(T('rGhost'))}</p>`;
  h += `<h4>${esc(T('rScoreH'))}</h4><p>${esc(T('rScore'))}</p>`;
  h += `<h4>${esc(T('rVsH'))}</h4><div class="pics">${bub}</div><p>${esc(T('rVs'))}</p>`;
  h += `<h4>${esc(T('rAimH'))}</h4><p>${esc(T('rAim'))}</p>`;
  h += `<h4>${esc(T('rModesH'))}</h4><p>${esc(T('rModes'))}</p>`;
  h += '</div>';
  sheet(h, { id: 'rules' });
}
