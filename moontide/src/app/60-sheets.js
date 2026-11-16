// ===== sheets: results, menu, chat, rules =====
function maybeResults(v, force) {
  const g = v.g, end = (g.ev.slice().reverse().find(e => e.k === 'end') || {}).n || g.evn;
  if (U.resultShown === end && !(force && sheetOn === 'result')) return;
  const first = U.resultShown !== end;
  U.resultShown = end;
  if (first) setTimeout(() => { if (S && S.view && S.view.g && S.view.g.over && U.resultShown === end) showResults(true); }, 1700);
  else showResults(false);
}
function showResults(sound) {
  const v = S.view, g = v.g, res = g.res; if (!res) return;
  const me = v.me, won = res.win.includes(me);
  // one winner; several sharing first place; or everyone level
  const names = res.win.map(s => nameOf(v, s));
  const both = I18.lang === 'zh' ? names.join('、') : names.length > 2 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names.join(' and ');
  const t2 = res.win.length > 1 ? (res.win.length === g.pl.length ? T('resTie') : T('resShare', { n: both })) : won ? T('resYou') : T('resWin', { n: names[0] });
  let h = `<div class="res-head"><div class="t1">${esc(T(res.why === 'sunk' ? 'resTitle' : 'resAll'))}</div><div class="t2">${esc(t2)}</div></div>`;
  const rank = [];
  res.rows.forEach((r, k) => {
    const up = res.rows[k - 1];
    rank[k] = up && up.pts === r.pts && up.saved === r.saved ? rank[k - 1] : k + 1;   // level players share a place
    const p = v.seats[r.s] || { name: '?', bot: true, lv: 2 };
    const win = res.win.includes(r.s);
    const tk = r.all.slice().sort((a, b) => (b.st === 'safe') - (a.st === 'safe') || b.v - a.v).map(x => `<span class="${x.st === 'safe' ? 'safe' : 'lost'}${x.how === 'eaten' ? ' eaten' : ''}" title="${esc(T(x.st === 'safe' ? 'howSafe' : x.how === 'eaten' ? 'howEaten' : 'howTide'))}">${A.piece('isl', r.s, x.v)}</span>`).join('');
    h += `<div class="rrow${win ? ' win' : ''}" style="--pc:${pcOf(r.s)}"><span class="rk">${rank[k]}</span><span class="av">${avSvg(p, r.s)}</span>` +
      `<div class="bd"><div class="nm">${esc(p.name)}${r.s === me ? ` <small>${esc(T('youTag'))}</small>` : ''}</div><div class="tk">${tk}</div></div>` +
      `<div class="pts"><b>${r.pts}</b><small>${esc(T('savedOf', { a: r.saved, b: r.of }))}</small></div></div>`;
  });
  if (v.games > 1) h += `<div class="tally">${g.pl.map(s => `${esc(nameOf(v, s))} ${v.wins[s]}`).join(' · ')}</div>`;
  h += '<div class="resfoot" id="resFoot"></div>';
  const sh = sheet(h, { id: 'result', lock: true });
  const f = $('resFoot');
  if (S.isHost && S.again) f.appendChild(btn(T('again'), 'gold', () => { closeSheet(); S.again(); }));
  else if (!S.ended) { const w = document.createElement('div'); w.className = 'more'; w.innerHTML = `<div class="spin sm"></div>${esc(T('waitHost'))}`; f.appendChild(w); }
  f.appendChild(btn(T('peek'), 'glass', () => { closeSheet(); peekBtn(); }));
  f.appendChild(btn(T('backLobby'), 'glass', async () => { if (S && S.leave && !S.ended) await S.leave('end'); goLobby(); }));
  if (sound) SND.play(won ? 'win' : 'lose');
  return sh;
}
function peekBtn() {
  let b = $('peekBack');
  if (!b) { b = document.createElement('button'); b.id = 'peekBack'; b.className = 'btn gold sm peekbtn'; document.body.appendChild(b); }
  b.textContent = T('results'); b.hidden = false;
  b.onclick = () => { b.hidden = true; if (S && S.view && S.view.g && S.view.g.over) showResults(false); };
}

// ---------- menu ----------
$('btnMenu').onclick = () => showMenu();
$('btnChat').onclick = () => showChat();
$('btnSound').onclick = () => { SND.set('on', !SND.prefs.on); paintSound(); if (SND.prefs.on) SND.play('tap'); };
function paintSound() { $('btnSound').innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${SND.prefs.on ? 'sound' : 'mute'}"/></svg>`; }
paintSound();
const togRow = (lab, on, id) => `<div class="mrow"><span class="grow">${lab}</span><button class="tog${on ? ' on' : ''}" data-tog="${id}" aria-label="${esc(lab)}"><i></i></button></div>`;
function showMenu() {
  if (!S || !S.view) return;
  const v = S.view, room = S.room || {}, me = v.me, host = S.isHost, g = v.g;
  let h = head(T('menu'));
  if (!room.solo) h += `<div class="mrow"><span class="grow">${esc(T('roomChip', { c: room.code }))}</span><button class="btn glass sm" id="mInv"><svg class="ic" viewBox="0 0 24 24"><use href="#i-share"/></svg>${esc(T('share'))}</button></div>`;
  h += `<div class="mhd">${esc(T('players'))}</div>`;
  v.seats.forEach((p, s) => {
    if (!p || (g && !g.pl.includes(s))) return;
    let right = '';
    if (host && p.bot) right += `<button class="lvb" data-lv="${s}">${esc(T('lv')[p.lv])}</button>`;
    if (host && s !== 0 && !p.bot && !room.solo) right += `<button class="btn glass sm" data-kick="${s}">${esc(T('kick'))}</button>`;
    const st = !p.bot && p.conn === false ? ` · ${T('offline')}` : !p.bot && p.auto ? ` · ${T('autoTag')}` : '';
    h += `<div class="mrow"><span class="av" style="--pc:${pcOf(s)}">${avSvg(p, s)}</span><span class="grow">${esc(p.name)}${s === me ? ` <small>${esc(T('youTag'))}</small>` : ''}<small>${esc(st)}</small></span>${right}</div>`;
  });
  h += `<div class="mhd">${esc(T('menu'))}</div>`;
  if (g && !g.over) h += togRow(T('mAuto'), !!(v.seats[me] && v.seats[me].auto), 'auto');
  h += togRow(T('sound'), SND.prefs.on, 'on');
  if ('vibrate' in navigator) h += togRow(T('vib'), SND.prefs.vib, 'vib');
  h += `<div class="mrow"><span class="grow">${esc(T('lang'))}</span><div class="seg"><button data-lang="en" class="${I18.lang === 'en' ? 'on' : ''}">English</button><button data-lang="zh" class="${I18.lang === 'zh' ? 'on' : ''}">中文</button></div></div>`;
  if (host) h += `<div class="mrow"><span class="grow">${esc(T('botSpeed'))}</span><div class="seg">${['fast', 'normal', 'slow'].map(x => `<button data-sp="${x}" class="${P.speed === x ? 'on' : ''}">${esc(spTxt(x))}</button>`).join('')}</div></div>`;
  h += '<div class="mgrid">';
  h += `<button class="btn glass" id="mRules"><svg class="ic" viewBox="0 0 24 24"><use href="#i-rule"/></svg>${esc(T('rules'))}</button>`;
  if (host && !room.solo) h += `<button class="btn glass" id="mPause"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${room.paused ? 'play' : 'pause'}"/></svg>${esc(T(room.paused ? 'resumeGame' : 'pause'))}</button>`;
  h += '</div><div class="mgrid one">';
  if (room.solo) h += `<button class="btn red" id="mLeave">${esc(T('leaveSolo'))}</button>`;
  else if (host) h += `<button class="btn glass" id="mSave">${esc(T('leaveSave'))}</button><button class="btn red" id="mEnd">${esc(T('endGame'))}</button>`;
  else h += `<button class="btn red" id="mLeave">${esc(T('leaveRoom'))}</button>`;
  h += '</div>';
  const sh = sheet(h, { id: 'menu' });
  sh.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => {
    const k = b.dataset.tog, on = !b.classList.contains('on');
    b.classList.toggle('on', on); SND.play('tap');
    if (k === 'auto') S.setAuto(on);
    else { SND.set(k, on); if (k === 'on') paintSound(); if (k === 'vib' && on) SND.vibrate(40); }
  });
  sh.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { I18.set(b.dataset.lang); refreshLang(); showMenu(); });
  sh.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { S.setSpeed(b.dataset.sp); showMenu(); });
  sh.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { const s = +b.dataset.lv; S.setBotLv(s, v.seats[s].lv % 3 + 1); setTimeout(showMenu, 60); });
  sh.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { S.kick(+b.dataset.kick); setTimeout(showMenu, 60); });
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('mInv', () => invite(room.code, true));
  on('mRules', () => showRules());
  on('mPause', () => { S.togglePause(); closeSheet(); });
  on('mLeave', async () => {
    if (room.solo) { await S.leave(); goLobby(); return; }
    closeSheet(); confirmBox(T('confirmLeave'), async () => { await S.leave(); goLobby(); });
  });
  on('mSave', async () => { await S.leave('save'); goLobby(); });
  on('mEnd', () => { closeSheet(); confirmBox(T('confirmEnd'), async () => { await S.leave('end'); goLobby(); }); });
}

// ---------- chat ----------
function showChat() {
  if (!S) return;
  let h = head(T('chat'));
  h += `<div class="emos">${EMOS.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>`;
  h += `<div class="phr">${T('phrases').map((p, i) => `<button data-p="${i}">${esc(p)}</button>`).join('')}</div>`;
  h += `<div class="code-row chatrow"><input class="inp" id="chatIn" maxlength="40" placeholder="${esc(T('chatPh'))}"><button class="btn gold" id="chatGo">${esc(T('send'))}</button></div>`;
  const sh = sheet(h, { id: 'chat' });
  sh.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { S.chat({ emo: b.dataset.e }); closeSheet(); });
  sh.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { S.chat({ p: +b.dataset.p }); closeSheet(); });
  const go = () => { const t = $('chatIn').value.trim(); if (t) { S.chat({ text: t }); closeSheet(); } };
  $('chatGo').onclick = go;
  $('chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}

// ---------- rules, with the pieces drawn in ----------
function showRules() {
  const P2 = (k, seat, num) => A.piece(k, seat || 0, num || 0, 'pc');
  let h = head(T('rulesTitle'));
  h += '<div class="rules-txt">';
  h += `<h4>${esc(T('rGoalH'))}</h4><p>${esc(T('rGoal'))}</p>`;
  h += `<h4>${esc(T('rTurnH'))}</h4><div class="dice">${['shark', 'shark', 'oct', 'oct', 'crab', 'moon'].map(k => A.dieFace(k)).join('')}</div><ol>${T('rTurn').map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
  h += `<h4>${esc(T('rStepsH'))}</h4><p>${esc(T('rSteps'))}</p>`;
  h += `<h4>${esc(T('rTideH'))}</h4><div class="tiers">${[0, 1, 2].map(el => `<div>${A.swatch(el)}${esc(T('elC')[el])}<br>${esc(T('tide')[el])}</div>`).join('')}</div><p>${esc(T('rTide'))}</p>`;
  h += `<h4>${esc(T('rBacksH'))}</h4>`;
  const RB = T('rBacks');
  for (const k of ['boat', 'shark', 'oct', 'reef', 'dolphin', 'buoy', 'tail', 'none']) h += `<div class="rl">${P2(k)}<div><b>${esc(T('back')[k])}</b> ${esc(RB[k])}</div></div>`;
  h += `<h4>${esc(T('rCrH'))}</h4>`;
  const RC = T('rCr');
  for (const k of ['shark', 'oct', 'crab', 'moon']) h += `<div class="rl">${k === 'moon' ? A.dieFace('moon', 'pc') : P2(k)}<div><b>${esc(T('cr')[k])}</b> ${esc(RC[k])}</div></div>`;
  h += `<h4>${esc(T('rSetupH'))}</h4><p>${esc(T('rSetup'))}</p>`;
  h += `<h4>${esc(T('rTipsH'))}</h4><p>${esc(T('rTips'))}</p>`;
  h += '</div>';
  sheet(h, { id: 'rules' });
}
