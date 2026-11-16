// ===== screens: the waiting room, the table's top bar, the round's result, the menu and the chat =====
function onView(v, room, force) {
  if (!S) return;
  S.view = v; S.room = room;
  if (!room.started) { renderRoom(v, room); return; }
  if ($('game').hidden) { show('game'); overlay(null); }
  $('btnChat').hidden = !!room.solo;
  UI.update(v, room);
  renderInfo(v, room);
  const R = v.R;
  if (R && R.phase !== 'end') { if (sheetOn === 'result') closeSheet(); const b = $('resBack'); if (b) b.hidden = true; }
  else if (R && R.phase === 'end') { if (sheetOn === 'result') { if (force) showResult(v); else refreshResultFoot(v, room); } }
  if (sheetOn === 'menu' && force) showMenu();
}
function renderInfo(v, room) {
  const R = v.R;
  let h = '';
  if (R) h += `<span>${esc(T('roundN', { n: R.no }))}</span>`;
  h += `<span>${esc(room.solo ? T('practice') : T('roomChip', { c: room.code }))}</span>`;
  if (room.paused) h += `<span class="pz">${esc(T('paused'))}</span>`;
  if ($('tbInfo')._h !== h) { $('tbInfo')._h = h; $('tbInfo').innerHTML = h; }
}

// ---------------- the waiting room ----------------
function renderRoom(v, room) {
  if ($('room').hidden) { show('room'); if (!S.isHost) overlay(null); }
  $('roomCode').textContent = room.code;
  const g = $('seats'), isHost = S.isHost;
  let h = '';
  for (let s = 0; s < 4; s++) {
    const p = v.seats[s];
    if (!p) {
      h += `<div class="rs empty">${isHost ? `<button class="addb" data-add="${s}"><i>${icon('plus', '')}</i>${T('addBot')}</button>` : `<div class="nm">${T('seatOpen')}</div><div class="sub">${T('seatWait')}</div>`}</div>`;
      continue;
    }
    const tag = s === 0 ? `<span class="tag">${T('hostTag')}</span>` : p.bot ? `<span class="tag">${T('botTag')}</span>` : '';
    let sub = s === v.me ? T('youTag') : '';
    if (!p.bot && !p.conn) sub = T('offline');
    let lvs = '';
    if (p.bot) lvs = isHost ? `<div class="lvs">${[1, 2, 3, 4].map(l => `<button data-lv="${s}:${l}" class="${p.lv === l ? 'on' : ''}">${esc(lvName(l))}</button>`).join('')}</div>` : `<div class="sub">${esc(lvName(p.lv))}</div>`;
    h += `<div class="rs${!p.bot && !p.conn ? ' off' : ''}">${tag}<div class="av">${avSvg(p)}</div><div class="nm">${esc(p.name)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}${lvs}` +
      (isHost && s !== 0 ? `<button class="x" data-kick="${s}" aria-label="${esc(T('kick'))}">${icon('close', '')}</button>` : '') + '</div>';
  }
  if (g._h === h) { renderRoomFoot(v, room); return; }
  g._h = h; g.innerHTML = h;
  g.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { S.addBot(+b.dataset.add); SND.play('tap'); });
  g.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { S.kick(+b.dataset.kick); SND.play('tap'); });
  g.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { const [s, l] = b.dataset.lv.split(':').map(Number); S.setBotLv(s, l); SND.play('tap'); });
  renderRoomFoot(v, room);
}
function renderRoomFoot(v, room) {
  const isHost = S.isHost, ob = $('optsRoom'), rk = JSON.stringify(v.rules) + isHost + I18.lang;
  if (ob._k !== rk) {
    ob._k = rk; ob.innerHTML = '';
    if (isHost) {
      const rr = () => {};
      ruleRows(ob, v.rules, x => S.setRules(x), rr);
      ob.appendChild(segRow(T('oTimer'), CX.TIMERS.slice(1).concat([0]), v.rules.timer, timerTxt, x => S.setRules({ timer: x }), rr));
      $('rulesSum').textContent = T('roomHint');
    } else $('rulesSum').textContent = rulesSummary(v.rules);
  }
  const a = $('roomActs');
  const n = v.seats.filter(Boolean).length;
  const ah = isHost ? `<button class="btn gold" id="btnStart"${n < 2 ? ' disabled' : ''}>${T('start')}</button>${n < 2 ? `<div class="more" style="margin-top:8px">${T('needTwo')}</div>` : ''}`
    : `<div class="more"><div class="spin sm"></div>${T('waitHost')}</div>`;
  if (a._h === ah) return;
  a._h = ah; a.innerHTML = ah;
  if (isHost) $('btnStart').onclick = () => { SND.play('tap'); S.start(); };
}
const rulesSummary = r => [T(r.keys ? 'sumKeys' : 'sumNoKeys'), r.timer ? T('sumTimer', { n: r.timer }) : T('sumNoTimer')].join(' · ');
$('roomBack').onclick = async () => { if (S && S.leave) await S.leave(); goLobby(); };
$('roomRules').onclick = () => showRules();
$('btnCopy').onclick = () => S && invite(S.room ? S.room.code : S.code, false);
$('btnShare').onclick = () => S && invite(S.room ? S.room.code : S.code, true);

// ---------------- a round's result ----------------
function showResult(v) {
  v = v || (S && S.view);
  if (!S || !v || !v.R || v.R.phase !== 'end') return;
  const R = v.R, me = v.me, win = R.win === me;
  const wn = v.seats[R.win] ? v.seats[R.win].name : '';
  let h = `<div class="res-head"><div class="big">${T(win ? 'resWin' : 'resOver')}</div><div class="sub">${esc(win ? T('roundN', { n: R.no }) : T('resWho', { n: wn }) + ' · ' + T('roundN', { n: R.no }))}</div></div>`;
  (R.rank || []).forEach((s, i) => {
    const p = v.seats[s]; if (!p) return;
    const x = R.st[s] || { hit: 0, miss: 0 };
    h += `<div class="rk${s === me ? ' me' : ''}${i === 0 ? ' first' : ''}"><span class="pl">${i === 0 ? icon('crown', '') : esc(T('rankN')[i])}</span><span class="av">${avSvg(p)}</span>` +
      `<span class="nm"><b>${esc(p.name)}</b><small>${esc(T('statLine', { h: x.hit, m: x.miss }))}</small></span>` +
      `<span class="pts"><b>${esc(T('ptsN', { n: R.pts[s] | 0 }))}</b><small>${esc(T('total'))} ${p.score | 0}</small></span></div>`;
  });
  h += `<p class="note">${T('ptsNote')}</p><div id="resFoot"></div>`;
  sheet(h, { id: 'result', lock: true });
  const b = $('resBack'); if (b) b.hidden = true;
  refreshResultFoot(v, S.room || {});
}
let rfT = 0;
function refreshResultFoot(v, room) {
  const f = $('resFoot'); if (!f) return;
  const me = v.me, rd = room.ready || [];
  const waiting = v.seats.map((p, s) => p && !p.bot && p.conn && !rd[s] && s !== me ? p.name : null).filter(Boolean);
  let h = '<div class="btns">';
  if (!rd[me]) h += `<button class="btn gold" id="btnNext">${T('nextRound')}</button>`;
  h += `<button class="btn glass" id="btnPeek">${T('peek')}</button></div>`;
  if (rd[me]) h += `<div class="note">${esc(waiting.length ? T('waitFor', { n: waiting.join(zh() ? '、' : ', ') }) : T('waitNext'))}</div>`;
  if (room.auto) h += `<div class="note" id="autoCd"></div>`;
  if (f._h === h) return;
  f._h = h; f.innerHTML = h;
  const nb = $('btnNext'); if (nb) nb.onclick = () => { SND.play('tap'); nb.disabled = true; S.ready(); };
  $('btnPeek').onclick = () => { closeSheet(); peekBtn(); };
  clearInterval(rfT);
  if (room.auto) {
    const end = Date.now() + room.auto;
    const tk = () => { const el = $('autoCd'); if (!el) { clearInterval(rfT); return; } el.textContent = T('nextIn', { s: Math.max(0, Math.ceil((end - Date.now()) / 1000)) }); };
    tk(); rfT = setInterval(tk, 500);
  }
}
function peekBtn() {
  let b = $('resBack');
  if (!b) { b = document.createElement('button'); b.id = 'resBack'; b.className = 'btn gold sm floatbtn'; document.body.appendChild(b); }
  b.textContent = T('backRes'); b.hidden = false;
  b.onclick = () => { b.hidden = true; showResult(S && S.view); };
}

// ---------------- the menu ----------------
$('btnMenu').onclick = () => showMenu();
$('btnChat').onclick = () => showChat();
$('btnSound').onclick = () => { SND.set('on', !SND.prefs.on); paintSound(); if (SND.prefs.on) SND.play('tap'); };
function paintSound() { $('btnSound').innerHTML = icon(SND.prefs.on ? 'sound' : 'mute', ''); $('btnSound').setAttribute('aria-label', T('sSound')); }
function showMenu() {
  if (!S || !S.view) return;
  const v = S.view, room = S.room || {}, me = v.me, host = S.isHost, R = v.R;
  let h = head(T('menu'));
  if (!room.solo) h += `<div class="srow"><div class="lab">${esc(T('roomChip', { c: room.code }))}</div><button class="btn glass sm" data-m="invite">${icon('share')}${T('inviteMore')}</button></div>`;
  h += `<h4>${T('players')}</h4>`;
  v.seats.forEach((p, s) => {
    if (!p) return;
    let sub = p.bot ? lvName(p.lv) : !p.conn ? T('offline') : p.auto ? T('autoTag') : s === me ? T('youTag') : '';
    let right = '';
    if (host && p.bot) right += `<div class="seg">${[1, 2, 3, 4].map(l => `<button data-lv="${s}:${l}" class="${p.lv === l ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    if (host && s !== 0 && !p.bot && !room.solo) right += `<button class="btn glass sm" data-kick="${s}">${T('kick')}</button>`;
    h += `<div class="prow"><span class="av">${avSvg(p)}</span><span class="nm grow"><b>${esc(p.name)}</b><small>${esc(sub)}</small></span>${right}<span class="pscore num">${p.score | 0}<small>${T('ptsShort')}</small></span></div>`;
  });
  h += `<h4>${T('hSettings')}</h4>`;
  const inR = R && R.phase !== 'end' && R.ps.includes(me) && !R.out.includes(me);
  h += settingsHTML({ auto: inR ? !!(v.seats[me] && v.seats[me].auto) : null, speed: host });
  h += '<div class="list" style="margin-top:12px">';
  h += `<button class="item" data-m="rules">${icon('rule')}<span class="grow">${T('hRules')}</span></button>`;
  if (host && !room.solo) h += `<button class="item" data-m="pause">${icon(room.paused ? 'play' : 'pause')}<span class="grow">${T(room.paused ? 'unpause' : 'pause')}</span></button>`;
  if (room.solo) h += `<button class="item" data-m="leave">${icon('door')}<span class="grow">${T('quitSolo')}<small>${T('quitSoloSub')}</small></span></button>`;
  else if (host) h += `<button class="item danger" data-m="end">${icon('door')}<span class="grow">${T('endRoom')}<small>${T('leaveSubHost')}</small></span></button>`;
  else h += `<button class="item danger" data-m="leave">${icon('door')}<span class="grow">${T('leaveRoom')}<small>${T('leaveSub')}</small></span></button>`;
  h += '</div>';
  const sh = sheet(h, { id: 'menu' });
  bindSettings(sh, () => setTimeout(showMenu, 30));
  sh.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { const [s, l] = b.dataset.lv.split(':').map(Number); S.setBotLv(s, l); SND.play('tap'); setTimeout(showMenu, 60); });
  sh.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => confirmBox(T('kickQ', { n: v.seats[+b.dataset.kick].name }), '', () => { S.kick(+b.dataset.kick); closeSheet(); }));
  sh.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => {
    const k = b.dataset.m;
    SND.play('tap');
    if (k === 'invite') invite(room.code, true);
    else if (k === 'rules') showRules();
    else if (k === 'pause') { S.togglePause(); closeSheet(); }
    else if (k === 'leave') {
      if (room.solo) { await S.leave(); goLobby(); return; }
      confirmBox(T('leaveQ'), T('leaveSub'), async () => { await S.leave(); goLobby(); });
    } else if (k === 'end') confirmBox(T('endQ'), T('leaveSubHost'), async () => { await S.leave('end'); goLobby(); });
  });
}
function showChat() {
  if (!S) return;
  let h = head(T('chat'));
  h += `<div class="emos">${EMOS.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>`;
  h += `<div class="phr">${T('phrases').map((p, i) => `<button data-p="${i}">${esc(p)}</button>`).join('')}</div>`;
  h += `<div class="chatin"><input class="inp" id="chatIn" maxlength="40" autocomplete="off" placeholder="${esc(T('chatPh'))}"><button class="btn gold" id="chatGo">${T('send')}</button></div>`;
  const sh = sheet(h, { id: 'chat' });
  sh.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { S.chat({ emo: b.dataset.e }); closeSheet(); });
  sh.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { S.chat({ p: +b.dataset.p }); closeSheet(); });
  const go = () => { const t = $('chatIn').value.trim(); if (t) { S.chat({ text: t }); closeSheet(); } };
  $('chatGo').onclick = go;
  $('chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}
