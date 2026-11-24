// ===== the waiting room: four seats, bots, the round's time and cages, Start =====
function renderRoom(v, room) {
  if (screenOn !== 'room') { show('room'); stopLoop(); U.g = null; V.g = null; U.rid = 0; U.kind = ''; }
  if (!confirmOpen() && !(S && S.mode === 'client' && !$('overlay').hidden && $('ovCard').querySelector('.spin'))) overlay(null);
  $('roomCode').textContent = room.code;
  const g = $('seats4'); g.innerHTML = '';
  const isHost = S.isHost;
  for (let s = 0; s < 4; s++) {
    const p = v.seats[s];
    const d = document.createElement('div');
    d.dataset.s = s;
    if (!p) {
      d.className = 'rs empty';
      d.innerHTML = `<div class="nm">${T('seatOpen')}</div><div class="sub">${T('seatWait')}</div>` + (isHost ? `<button class="btn glass sm" data-add="${s}"><svg class="ic" viewBox="0 0 24 24"><use href="#i-bot"/></svg>${T('addBot')}</button>` : '');
    } else {
      d.className = 'rs';
      d.style.setProperty('--pc', pcOf(s));
      const tags = (s === 0 ? `<span class="tag">${T('hostTag')}</span>` : '') + (s === v.me ? `<span class="tag me">${T('youTag')}</span>` : '');
      const wins = p.wins ? `<span class="wn">${esc(p.wins === 1 ? T('win1') : T('wins', { n: p.wins }))}</span>` : '';
      d.innerHTML = `${tags}<div class="av">${avSvg(p, s)}</div><div class="nm">${esc(p.bot ? botName(p) : p.name)}</div><div class="sub">${p.bot ? `<button class="lvb" data-lv="${s}">${T('lv')[p.lv]}</button>` : (p.conn ? '' : T('offline'))}</div>${wins}` + (isHost && s !== 0 ? `<button class="x" data-kick="${s}" aria-label="${esc(T('remove'))}"><svg viewBox="0 0 24 24"><use href="#i-close"/></svg></button>` : '');
    }
    g.appendChild(d);
  }
  g.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { S.addBot(+b.dataset.add); SND.play('tap'); });
  g.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { S.kick(+b.dataset.kick); SND.play('tap'); });
  g.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { if (!isHost) return; const s = +b.dataset.lv; S.setBotLv(s, v.seats[s].lv % 4 + 1); SND.play('tap'); });
  // what a round is: the same board for everyone, the time, and whether big moves drop cages
  $('roomSum').innerHTML = esc(T('roomSum')) + (room.atk ? '<br>' + esc(T('roomAtk')) : '') + (isHost ? '' : `<br><b>${esc(T('oTime'))}${colon()}${esc(T('secs', { n: room.time }))} · ${esc(T('oAtk'))}${colon()}${esc(T(room.atk ? 'atkOn' : 'atkOff'))}</b>`);
  const o = $('roomOpts'); o.innerHTML = '';
  if (isHost) {
    o.appendChild(segRow(T('oTime'), TIMES, P.time, x => T('secs', { n: x }), x => { P.time = x; }, () => S.setOpt()));
    o.appendChild(segRow(T('oAtk'), [true, false], P.atk, x => T(x ? 'atkOn' : 'atkOff'), x => { P.atk = x; }, () => S.setOpt()));
  }
  const a = $('roomActs'); a.innerHTML = '';
  if (isHost) {
    const n = v.seats.filter(p => p && (p.bot || p.conn)).length, empty = v.seats.filter(p => !p).length;
    const b = document.createElement('button'); b.className = 'btn gold'; b.textContent = T('start');
    b.disabled = n < 2;
    b.onclick = () => { SND.play('tap'); S.start(); };
    a.appendChild(b);
    if (empty) { const f = document.createElement('button'); f.className = 'btn glass'; f.innerHTML = `<svg class="ic" viewBox="0 0 24 24"><use href="#i-bot"/></svg>${T('fillBots')}`; f.onclick = () => { SND.play('tap'); S.fillBots(); }; a.appendChild(f); }
    if (n < 2) { const w = document.createElement('div'); w.className = 'more'; w.textContent = T('startNeed'); a.appendChild(w); }
  } else {
    const w = document.createElement('div'); w.className = 'more'; w.innerHTML = `<div class="spin sm"></div>${T('waitHost')}`; a.appendChild(w);
  }
}
$('roomBack').onclick = () => {
  if (!S) return goLobby();
  if (S.isHost) confirmBox(T('confirmEnd'), async () => { await S.leave('end'); goLobby(); });
  else confirmBox(T('confirmLeave'), async () => { await S.leave(); goLobby(); });
};
$('roomRules').onclick = () => showRules();
$('btnCopy').onclick = () => S && invite(S.code, false);
$('btnShare').onclick = () => S && invite(S.code, true);
