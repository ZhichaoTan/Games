// ===== the waiting room: four seats, bots, the rules in one line, Start =====
function renderRoom(v, room) {
  show('room');
  if (!confirmOpen()) overlay(null);
  $('roomCode').textContent = room.code;
  const g = $('seats4'); g.innerHTML = '';
  const isHost = S.isHost;
  for (let s = 0; s < 4; s++) {
    const p = v.seats[s];
    const d = document.createElement('div');
    if (!p) {
      d.className = 'rs empty';
      d.innerHTML = `<div class="nm">${T('seatOpen')}</div><div class="sub">${T('seatWait')}</div>` + (isHost ? `<button class="btn glass sm" data-add="${s}"><svg class="ic" viewBox="0 0 24 24"><use href="#i-bot"/></svg>${T('addBot')}</button>` : '');
    } else {
      d.className = 'rs';
      d.style.setProperty('--pc', pcOf(s));
      const tags = (s === 0 ? `<span class="tag">${T('hostTag')}</span>` : '') + (s === v.me ? `<span class="tag me">${T('youTag')}</span>` : '');
      d.innerHTML = `${tags}<div class="av">${avSvg(p, s)}</div><div class="nm">${esc(p.name)}</div><div class="sub">${p.bot ? `<button class="lvb" data-lv="${s}">${T('lv')[p.lv]}</button>` : (p.conn ? '' : T('offline'))}</div>` + (isHost && s !== 0 ? `<button class="x" data-kick="${s}" aria-label="${esc(T('remove'))}"><svg viewBox="0 0 24 24"><use href="#i-close"/></svg></button>` : '');
    }
    g.appendChild(d);
  }
  g.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { S.addBot(+b.dataset.add); SND.play('tap'); });
  g.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { S.kick(+b.dataset.kick); SND.play('tap'); });
  g.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { if (!isHost) return; const s = +b.dataset.lv; S.setBotLv(s, v.seats[s].lv % 3 + 1); SND.play('tap'); });
  $('rulesSum').innerHTML = rulesSummary(v.rules);
  const a = $('roomActs'); a.innerHTML = '';
  if (isHost) {
    const n = v.seats.filter(Boolean).length, empty = 4 - n;
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
function rulesSummary(r) {
  return [T(r.setup === 'quick' ? 'sumSetupQuick' : 'sumSetupPlace'), r.timer ? T('sumTimer', { n: r.timer }) : T('sumNoTimer')].map(esc).join(' · ');
}
$('roomBack').onclick = async () => { if (S && S.leave) await S.leave(); goLobby(); };
$('roomRules').onclick = () => showRules();
$('btnCopy').onclick = () => S && invite(S.room ? S.room.code : S.code, false);
$('btnShare').onclick = () => S && invite(S.room ? S.room.code : S.code, true);
