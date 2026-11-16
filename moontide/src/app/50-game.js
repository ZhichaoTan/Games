// ===== the game screen: the board, the player plates, the dock with the prompt and buttons, taps, narration and sounds =====
let board = null;
const U = { sel: null, multi: false, pick: -1, sub: null, placeV: 0, busy: 0, busyT: 0, gid: -1, seenN: -1, phaseKey: '', resultShown: -1, plateKey: '' };
const myTurn = (v, room) => !!(v && v.g && !v.g.over && v.g.turn === v.me && !(room && room.paused) && !(v.seats[v.me] && v.seats[v.me].auto));
const turnN = g => (g.ev.slice().reverse().find(e => e.k === 'turn') || {}).n || 0;
const nameOf = (v, s) => (v.seats[s] || {}).name || '';
const kTxt = n => (n === 1 ? T('kPerson') : T('kPeople', { k: n }));
function busyOff() { U.busy = 0; clearTimeout(U.busyT); }

function onView(v, room, force) {
  if (!S) return;
  // bots go by a name from this reader's own language
  for (const p of v.seats) if (p && p.bot && p.bn >= 0) p.name = T('botNames')[p.bn] || p.name;
  S.view = v; S.room = room;
  busyOff();
  if (!room.started || !v.g) { renderRoom(v, room); return; }
  if ($('game').hidden) { show('game'); overlay(null); }
  if (!board) {
    board = MB.create($('stage'), { onTap, label: k => T('back')[k] || '', onZoom: z => { $('btnZoom').innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${z > 1.02 ? 'zout' : 'zin'}"/></svg>`; } });
    // the first game on a phone: say once that the board zooms
    if (innerWidth < 700 && !store.get('cd_ztip')) { store.set('cd_ztip', 1); setTimeout(() => toast(T('zoomHint'), 3600), 3200); }
  }
  if (U.gid !== room.gid) {
    U.gid = room.gid; board.reset(); board.zoomOut();
    U.sel = null; U.pick = -1; U.sub = null; U.seenN = -1; U.resultShown = -1; U.plateKey = '';
    if (sheetOn === 'result') closeSheet();
    const pb = $('peekBack'); if (pb) pb.remove();
  }
  validate(v, room);
  events(v);
  draw();
  if (v.g.over) maybeResults(v, force);
  else if (sheetOn === 'result') closeSheet();
}
function draw() {
  const v = S.view, room = S.room;
  if (!v || !v.g || !board) return;
  board.update(v.g, uiState(v, room));
  plates(v, room);
  topInfo(v, room);
  dock(v, room);
}
// forget a selection that no longer fits the position
function validate(v, room) {
  const g = v.g, me = v.me;
  const key = g.turn + ':' + g.phase + ':' + (g.place ? g.place.i : '') + ':' + (myTurn(v, room) ? 1 : 0);
  if (key !== U.phaseKey) { U.phaseKey = key; U.sel = null; U.pick = -1; U.sub = null; U.multi = false; }
  if (!myTurn(v, room)) { U.sel = null; U.pick = -1; U.sub = null; return; }
  if (g.place) {
    const vals = g.isl.filter(x => x.s === me && x.st === 'new').map(x => x.v);
    if (!vals.includes(U.placeV)) U.placeV = vals.length ? Math.max(...vals) : 0;
  }
  if (g.phase === 'move' && U.sel) {
    const ms = g.steps > 0 ? MT.steps(g, me) : [];
    if (!ms.some(m => m.p === U.sel.p && m.id === U.sel.id)) { U.sel = null; U.multi = false; }
  }
  if (g.phase === 'sink' && U.pick >= 0 && !MT.sinkable(g).includes(U.pick)) U.pick = -1;
}

// ---------- what the board highlights ----------
function stepKind(g, sel, to) {
  if (g.k[to] === 'H') return 'safe';
  if (sel.p === 'i' && (g.k[to] === 'S' || g.k[to] === 'F')) {
    const b = MT.boatAt(g, to);
    if (!(b && MT.room(g, b))) return 'risk';
  }
  return '';
}
function crTargetsUI(g, ms, id) {
  const c = g.cr.find(x => x.id === id); if (!c) return [];
  const cells = [...new Set(ms.filter(m => m.id === id).map(m => m.to))];
  return cells.map(to => {
    let hit = false;
    if (c.k === 'shark') hit = g.isl.some(x => x.st === 'swim' && x.at === to);
    else if (c.k === 'oct') hit = ms.some(m => m.id === id && m.to === to && m.grab >= 0);
    else hit = g.isl.some(x => x.st === 'land' && x.at === to);
    return { c: to, k: hit ? 'hit' : '' };
  });
}
function uiState(v, room) {
  const g = v.g, me = v.me, ui = {};
  if (!myTurn(v, room)) return ui;
  if (g.place) { ui.place = MT.placeCells(g); return ui; }
  if (g.phase === 'move') {
    if (g.steps > 0) {
      const ms = MT.steps(g, me);
      ui.glow = { i: [...new Set(ms.filter(m => m.p === 'i').map(m => m.id))], b: [...new Set(ms.filter(m => m.p === 'b').map(m => m.id))] };
      if (U.sel) { ui.sel = U.sel; ui.targets = ms.filter(m => m.p === U.sel.p && m.id === U.sel.id).map(m => ({ c: m.to, k: stepKind(g, U.sel, m.to) })); }
    }
  } else if (g.phase === 'sink') { ui.sinkable = MT.sinkable(g); ui.pick = U.pick; }
  else if (g.phase === 'dol') {
    const ms = MT.dolMoves(g);
    ui.glow = { i: [...new Set(ms.map(m => m.id))] };
    if (U.sel) { ui.sel = U.sel; ui.targets = ms.filter(m => m.id === U.sel.id).map(m => ({ c: m.to, k: g.k[m.to] === 'H' ? 'safe' : '' })); }
  } else if (g.phase === 'cr') {
    const ms = MT.crMoves(g);
    if (U.sub && U.sub.kind === 'grab') {
      ui.sel = { p: 'c', id: U.sub.id };
      ui.glow = { b: ms.filter(m => m.id === U.sub.id && m.to === U.sub.to && m.grab >= 0).map(m => m.grab) };
      ui.targets = [{ c: U.sub.to, k: 'hit' }];
    } else if (U.sub && U.sub.kind === 'push') {
      ui.sel = { p: 'c', id: U.sub.id };
      ui.targets = ms.filter(m => m.id === U.sub.id && m.to === U.sub.to && m.push >= 0).map(m => ({ c: m.push, k: 'hit' }));
    } else {
      ui.glow = { c: [...new Set(ms.map(m => m.id))] };
      if (U.sel) { ui.sel = U.sel; ui.targets = crTargetsUI(g, ms, U.sel.id); }
    }
  }
  return ui;
}

// ---------- taps on the board ----------
function send(a) {
  if (!S || !a) return;
  const r = S.act(a);
  if (r === 'sent') { U.busy = Date.now(); clearTimeout(U.busyT); U.busyT = setTimeout(busyOff, 1500); }
  else if (r !== 'ok') draw();
}
function pickFrom(cands) {
  if (!cands.length) { if (U.sel) { U.sel = null; U.multi = false; draw(); } return; }
  const i = U.sel ? cands.findIndex(x => x.p === U.sel.p && x.id === U.sel.id) : -1;
  if (i >= 0 && cands.length === 1) { U.sel = null; U.multi = false; SND.play('tap'); draw(); return; }   // tap it again to put it down
  U.sel = cands[(i + 1) % cands.length];
  U.multi = cands.length > 1;
  SND.play('sel'); draw();
}
// what you can pick up in a hex on your turn: the boat first, then your people in it, on the tile, in the water
function moveCands(g, me, ms, c) {
  const has = (p, id) => ms.some(m => m.p === p && m.id === id);
  const out = [];
  for (const b of g.boats) if (b.at === c && has('b', b.id)) out.push({ p: 'b', id: b.id, o: b.dock ? 4 : 0, v: 0 });   // a boat tied up at a lighthouse can be rowed back out
  for (const x of g.isl) {
    if (x.s !== me || !has('i', x.id)) continue;
    const at = x.st === 'boat' ? (MT.boatById(g, x.b) || {}).at : x.at;
    if (at === c) out.push({ p: 'i', id: x.id, o: x.st === 'boat' ? 1 : x.st === 'land' ? 2 : 3, v: x.v });
  }
  out.sort((a, b) => a.o - b.o || b.v - a.v || a.id - b.id);
  return out.map(x => ({ p: x.p, id: x.id }));
}
function onTap(c) {
  const v = S && S.view, room = S && S.room;
  if (!v || !v.g || !myTurn(v, room) || U.busy) return;
  const g = v.g, me = v.me;
  if (g.place) {
    if (!MT.placeCells(g).includes(c)) return;
    if (MT.placeKind(g) === 'isl') send({ k: 'place', v: U.placeV, at: c }); else send({ k: 'boat', at: c });
    return;
  }
  if (g.phase === 'move') {
    if (g.steps <= 0) return;
    const ms = MT.steps(g, me);
    if (U.sel) { const m = ms.find(x => x.p === U.sel.p && x.id === U.sel.id && x.to === c); if (m) { send(m); return; } }
    pickFrom(moveCands(g, me, ms, c));
    return;
  }
  if (g.phase === 'sink') {
    const L = MT.sinkable(g);
    if (!L.includes(c)) { if (U.pick >= 0) { U.pick = -1; draw(); } return; }
    if (U.pick === c) { send({ k: 'sink', at: c }); return; }
    U.pick = c; SND.play('sel'); draw();
    return;
  }
  if (g.phase === 'dol') {
    const ms = MT.dolMoves(g);
    if (U.sel) { const m = ms.find(x => x.id === U.sel.id && x.to === c); if (m) { send(m); return; } }
    pickFrom([...new Set(ms.filter(m => (g.isl.find(x => x.id === m.id) || {}).at === c).map(m => m.id))].map(id => ({ p: 'i', id })));
    return;
  }
  if (g.phase === 'cr') {
    const ms = MT.crMoves(g);
    if (U.sub) {
      if (U.sub.kind === 'grab') { const m = ms.find(x => x.id === U.sub.id && x.to === U.sub.to && x.grab >= 0 && (MT.boatById(g, x.grab) || {}).at === c); if (m) send(m); }
      else { const m = ms.find(x => x.id === U.sub.id && x.to === U.sub.to && x.push === c); if (m) send(m); }
      return;
    }
    if (U.sel) {
      const opts = ms.filter(x => x.id === U.sel.id && x.to === c);
      if (opts.length) {
        const cr = g.cr.find(x => x.id === U.sel.id);
        if (cr.k === 'oct' && opts.some(x => x.grab >= 0)) { U.sub = { kind: 'grab', id: cr.id, to: c }; SND.play('sel'); draw(); return; }
        if (cr.k === 'crab' && opts.some(x => x.push >= 0)) {
          const ps = opts.filter(x => x.push >= 0);
          if (ps.length === 1) { send(ps[0]); return; }
          U.sub = { kind: 'push', id: cr.id, to: c }; SND.play('sel'); draw(); return;
        }
        send(opts.find(x => !(x.grab >= 0) && !(x.push >= 0)) || opts[0]);
        return;
      }
    }
    pickFrom([...new Set(ms.filter(m => (g.cr.find(x => x.id === m.id) || {}).at === c).map(m => m.id))].map(id => ({ p: 'c', id })));
  }
}
$('btnZoom').onclick = () => { if (!board) return; if (board.zoom > 1.02) board.zoomOut(); else board.zoomIn(); SND.play('tap'); };

// ---------- the player plates ----------
const itemSvg = k => k === 'buoy' ? `<svg viewBox="-6.5 -6.5 13 13">${A.buoy()}</svg>` : `<svg viewBox="-7 -6.5 14 13">${A.wind()}</svg>`;
function plates(v, room) {
  const g = v.g, box = $('plates');
  const key = g.pl.join(',') + ':' + room.gid;
  if (U.plateKey !== key) {
    U.plateKey = key; box.innerHTML = '';
    for (const s of g.pl) {
      const d = document.createElement('div');
      d.className = 'plate'; d.dataset.s = s; d.style.setProperty('--pc', pcOf(s));
      d.innerHTML = '<div class="av"></div><div class="nm"></div><div class="st"></div><div class="tags"></div><div class="clk" hidden></div>';
      box.appendChild(d);
    }
  }
  for (const d of box.children) {
    const s = +d.dataset.s, p = v.seats[s] || { name: '?', bot: true, lv: 2 };
    const mine = g.isl.filter(x => x.s === s);
    const safe = mine.filter(x => x.st === 'safe').length, out = mine.filter(x => MT.live(x) || x.st === 'new').length, lost = mine.filter(x => x.st === 'lost').length;
    const hand = g.hand[s] || {};
    const set = (sel, html) => { const el = d.querySelector(sel); if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; } };
    set('.av', avSvg(p, s));
    set('.nm', esc(p.name));
    set('.st', `<span class="sf" title="${esc(T('tipSafe'))}"><svg><use href="#g-lh"/></svg>${safe}</span><span title="${esc(T('tipOut'))}"><svg><use href="#g-man"/></svg>${out}</span>` +
      (lost ? `<span class="ls" title="${esc(T('tipLost'))}"><svg><use href="#g-lost"/></svg>${lost}</span>` : '') +
      (hand.buoy ? `<span class="it" title="${esc(T('tipBuoy'))}">${itemSvg('buoy')}${hand.buoy > 1 ? hand.buoy : ''}</span>` : '') +
      (hand.tail ? `<span class="it" title="${esc(T('tipTail'))}">${itemSvg('tail')}${hand.tail > 1 ? hand.tail : ''}</span>` : ''));
    set('.tags', (s === v.me ? `<i class="me">${esc(T('youTag'))}</i>` : '') + (!p.bot && p.conn === false ? `<i>${esc(T('offline'))}</i>` : '') + (!p.bot && p.auto ? `<i class="au">${esc(T('autoTag'))}</i>` : ''));
    d.classList.toggle('on', !g.over && g.turn === s);
    d.classList.toggle('off', !p.bot && p.conn === false);
    // the turn clock: a bar that runs down under the plate of whoever is on the clock
    const clk = d.querySelector('.clk'), c = room.clock && room.clock.s === s ? room.clock : null;
    if (!c) { clk.hidden = true; d.clkEnd = 0; }
    else {
      const end = Date.now() + c.left;
      if (clk.hidden || Math.abs(end - (d.clkEnd || 0)) > 800) {
        d.clkEnd = end; clk.hidden = false;
        clk.style.transition = 'none'; clk.style.transform = `scaleX(${clamp(c.left / (c.total || 1), 0, 1)})`;
        void clk.offsetWidth;
        clk.style.transition = `transform ${c.left}ms linear`; clk.style.transform = 'scaleX(0)';
      }
    }
  }
}
function bubble(s, text, emo) {
  const d = $('plates').querySelector(`.plate[data-s="${s}"]`);
  if (!d || $('game').hidden) { toast(((S && S.view && S.view.seats[s]) || {}).name + ': ' + text, 2200); return; }
  d.querySelectorAll('.bub').forEach(b => b.remove());
  const b = document.createElement('div'); b.className = 'bub' + (emo ? ' emo' : ''); b.textContent = text;
  d.appendChild(b); setTimeout(() => b.remove(), 3100);
}

// ---------- the top bar: room and tide ----------
function topInfo(v, room) {
  const g = v.g, t = MT.tide(g), left = g.k.filter(k => k === 'L').length;
  let h = `<span class="chip">${esc(room.solo ? T('practice') : T('roomChip', { c: room.code }))}</span>`;
  h += `<span class="chip tide" id="tideChip"><span class="tbar"><i class="e0 on"></i><i class="e1${t >= 1 ? ' on' : ''}"></i><i class="e2${t >= 2 ? ' on' : ''}"></i></span>${esc(T('tide')[t])} · <b>${left}</b></span>`;
  if (room.paused) h += `<span class="chip warn">${esc(T('paused'))}</span>`;
  if ($('tbInfo').dataset.h !== h) { $('tbInfo').dataset.h = h; $('tbInfo').innerHTML = h; $('tideChip').onclick = () => { const t2 = MT.tide(S.view.g); toast(T('tideTip') + ': ' + T('el').slice(0, t2 + 1).join(' · '), 2600); }; }
}

// ---------- the dock: die, prompt, steps, buttons ----------
function promptText(v, room) {
  const g = v.g, me = v.me, n = nameOf(v, g.turn);
  if (g.over) return '';
  if (room.paused) return T('pausedBy');
  if (g.turn === me && v.seats[me] && v.seats[me].auto) return T('autoOn');
  const mine = g.turn === me;
  if (g.place) { const k = MT.placeKind(g); return mine ? T(k === 'isl' ? 'pPlace' : 'pBoat') : T(k === 'isl' ? 'pPlaceWait' : 'pBoatWait', { n }); }
  if (!mine) {
    if (g.phase === 'move') return T('wMove', { n });
    if (g.phase === 'sink') return T('wSink', { n });
    if (g.phase === 'dol') return T('wDol', { n });
    const ty = MT.crTypes(g);
    return T('wCr', { n, c: T('crThe')[ty.length === 1 ? ty[0] : 'moon'] });
  }
  if (g.phase === 'move') {
    if (g.steps <= 0) return T('pMoveOut');
    if (!MT.steps(g, me).length) return T('pMoveNone');
    return U.sel ? T('pMoveSel') + (U.multi ? ' · ' + T('pSwitch') : '') : T('pMove');
  }
  if (g.phase === 'sink') return U.pick >= 0 ? T('pSinkSel') : T('pSink');
  if (g.phase === 'dol') return U.sel ? T('pMoveSel') : T('pDol');
  if (g.phase === 'cr') {
    if (U.sub) return T(U.sub.kind === 'grab' ? 'pGrab' : 'pPush');
    if (U.sel) { const c = g.cr.find(x => x.id === U.sel.id); if (c) return T('pCrSel')[c.k] + (U.multi ? ' · ' + T('pSwitch') : ''); }
    const ty = MT.crTypes(g);
    return ty.length === 1 ? T('pCr')[ty[0]] : g.die === 'moon' ? T('pCr').moon : T('pCrAny');
  }
  return '';
}
function btn(label, cls, fn, icon, dis) {
  const b = document.createElement('button');
  b.className = 'btn ' + cls; b.innerHTML = (icon ? `<svg viewBox="0 0 24 24"><use href="#i-${icon}"/></svg>` : '') + `<span>${esc(label)}</span>`;
  if (dis) b.disabled = true;
  b.onclick = () => { SND.play('tap'); fn(); };
  return b;
}
function dock(v, room) {
  const g = v.g, me = v.me, mine = myTurn(v, room);
  // the tide die of the turn being played
  const die = !g.place && !g.over ? g.die : null;
  const db = $('dieB'), dk = die ? die + ':' + turnN(g) : 'none';
  if (db.dataset.k !== dk) {
    db.dataset.k = dk; db.innerHTML = A.dieFace(die || 'moon');
    db.classList.toggle('none', !die); db.classList.remove('roll');
    if (die) { void db.offsetWidth; db.classList.add('roll'); }
  }
  db.title = die ? T('rolled') + ': ' + T('die')[die] : '';
  const who = g.over ? T('results') : g.turn === me ? T('yourTurn') : g.place ? T('setupTurn') : T('theirTurn', { n: nameOf(v, g.turn) });
  $('dkWho').innerHTML = `<span class="sw" style="--pc:${pcOf(g.turn)}"></span>${esc(who)}`;
  const tx = $('dkTx'); tx.textContent = promptText(v, room); tx.classList.toggle('wait', !mine);
  // the middle row
  const d2 = $('dk2'); d2.innerHTML = '';
  if (mine && g.place && MT.placeKind(g) === 'isl') {
    const tray = document.createElement('div'); tray.className = 'tray';
    const cnt = {}; for (const x of g.isl) if (x.s === me && x.st === 'new') cnt[x.v] = (cnt[x.v] || 0) + 1;
    for (const val of Object.keys(cnt).map(Number).sort((a, b) => b - a)) {
      const b = document.createElement('button');
      b.className = val === U.placeV ? 'on' : '';
      b.innerHTML = A.piece('isl', me, val) + (cnt[val] > 1 ? `<span class="n">×${cnt[val]}</span>` : '');
      b.onclick = () => { U.placeV = val; SND.play('sel'); draw(); };
      tray.appendChild(b);
    }
    d2.appendChild(tray);
  } else if (!g.place && !g.over && g.phase === 'move') {
    const pp = document.createElement('div'); pp.className = 'pips';
    const total = MT.STEPS + (g.tail ? MT.TAILWIND : 0);
    let h = `<span>${esc(T('steps'))}</span>`;
    for (let k = 0; k < total; k++) h += `<i class="${k >= MT.STEPS ? 'tw' : ''}${k < g.steps ? ' on' : ''}"></i>`;
    pp.innerHTML = h; d2.appendChild(pp);
  }
  const grow = document.createElement('span'); grow.className = 'grow'; d2.appendChild(grow);
  const items = document.createElement('div'); items.className = 'items';
  const hand = g.hand[me];
  if (hand) {
    const pearls = g.isl.filter(x => x.s === me && x.st === 'safe').reduce((a, x) => a + x.v, 0);
    let h = `<span class="item" title="${esc(T('myPearls'))}"><svg viewBox="0 0 24 24"><use href="#g-pearl"/></svg>${pearls}</span>`;
    if (hand.buoy) h += `<span class="item" title="${esc(T('tipBuoy'))}">${itemSvg('buoy')}${hand.buoy}</span>`;
    if (hand.tail) h += `<span class="item" title="${esc(T('tipTail'))}">${itemSvg('tail')}${hand.tail}</span>`;
    items.innerHTML = h;
  }
  d2.appendChild(items);
  // buttons
  const d3 = $('dk3'); d3.innerHTML = '';
  if (g.turn === me && !g.over && v.seats[me] && v.seats[me].auto) {
    const bar = document.createElement('div'); bar.className = 'autobar';
    bar.innerHTML = `<span class="grow">${esc(T('autoOn'))}</span><button>${esc(T('autoOff'))}</button>`;
    bar.querySelector('button').onclick = () => { SND.play('tap'); S.setAuto(false); };
    d3.appendChild(bar);
    return;
  }
  if (!mine) return;
  if (g.place) {
    if (MT.placeKind(g) === 'isl' || MT.placeKind(g) === 'boat') d3.appendChild(btn(T('bAuto'), 'glass', () => { const a = AI.decide(S.view, 2, Math.random); if (a) send(a); }, 'bot'));
  } else if (g.phase === 'move') {
    if (v.g.undo > 0) d3.appendChild(btn(T('bUndo'), 'glass sm2', () => { U.sel = null; send({ k: 'undo' }); }, 'undo'));
    if (hand && hand.tail > 0 && !g.tail) d3.appendChild(btn(T('bTail'), 'teal', () => send({ k: 'tail' }), 'wind'));
    d3.appendChild(btn(T('bDone'), 'gold', () => { U.sel = null; send({ k: 'done' }); }, 'check'));
  } else if (g.phase === 'sink') {
    d3.appendChild(btn(T('bSink'), 'red', () => { if (U.pick >= 0) send({ k: 'sink', at: U.pick }); }, 'sink', U.pick < 0));
  } else if (g.phase === 'dol') {
    d3.appendChild(btn(T('bSkip'), 'glass', () => send({ k: 'dol', skip: 1 }), 'skip'));
  } else if (g.phase === 'cr') {
    if (U.sub) {
      d3.appendChild(btn(T('bBack'), 'glass sm2', () => { U.sub = null; draw(); }, 'back'));
      if (U.sub.kind === 'grab') d3.appendChild(btn(T('bNoGrab'), 'gold', () => { const s = U.sub; U.sub = null; send({ k: 'cr', id: s.id, to: s.to, grab: -1 }); }));
    } else d3.appendChild(btn(T('bSkip'), 'glass', () => send({ k: 'cr', skip: 1 }), 'skip'));
  }
}

// ---------- narration, sounds and the "your turn" banner ----------
// one line of narration at a time, always the newest: a line stays at least a moment, then the next one replaces it
let feedNext = null, feedT = 0, feedHide = 0, feedAt = 0;
function feed(text, tone) {
  if (!text) return;
  feedNext = { text, tone: tone || '' };
  clearTimeout(feedT);
  const wait = 900 - (Date.now() - feedAt);
  if (wait <= 0 || !$('feed').classList.contains('on')) showFeed(); else feedT = setTimeout(showFeed, wait);
}
function showFeed() {
  const el = $('feed'), it = feedNext; feedNext = null;
  if (!it) return;
  el.innerHTML = `<span class="${it.tone}">${esc(it.text)}</span>`;
  el.classList.add('on'); feedAt = Date.now();
  clearTimeout(feedHide); feedHide = setTimeout(() => el.classList.remove('on'), 3400);
}
function banner(h, s) {
  const b = $('banner');
  b.querySelector('.h').textContent = h; b.querySelector('.s').textContent = s || '';
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
}
function events(v) {
  const g = v.g, evs = g.ev || [];
  const lastN = evs.length ? evs[evs.length - 1].n : 0;
  if (U.seenN < 0 || lastN < U.seenN || lastN - U.seenN > 14) { U.seenN = lastN; return; }   // a fresh screen or a big jump: don't replay
  const fresh = evs.filter(e => e.n > U.seenN);
  U.seenN = lastN;
  let best = null;
  for (const e of fresh) { try { const l = onEvent(e, v); if (l && (!best || l.pr >= best.pr)) best = l; } catch (er) { console.error(er); } }
  if (best) feed(best.text, best.tone);
}
function onEvent(e, v) {
  const nm = s => nameOf(v, s), me = v.me, g = v.g;
  let line = null;
  const feed = (text, tone, pr) => { line = { text, tone: tone || '', pr: pr == null ? (tone ? 2 : 1) : pr }; };
  const isMine = id => { const x = g.isl.find(y => y.id === id); return x && x.s === me; };
  switch (e.k) {
    case 'setup': feed(T('nFirst', { n: nm(e.first) })); break;
    case 'place': SND.play('step'); break;
    case 'boat': SND.play('board'); break;
    case 'turn':
      SND.play('die');
      if (e.s === me && !(v.seats[me] && v.seats[me].auto)) { banner(T('yourTurn'), T('rolled') + ' · ' + T('die')[e.die]); SND.play('turn', 380); SND.vibrate([50, 40, 50]); }
      break;
    case 'step':
      if (e.p === 'b') {
        SND.play('oar');
        if (e.res === 'dock' && e.pax.length) { SND.play('safe', 300); feed(e.pax.length === 1 ? T('nDock1', { n: nm(e.s) }) : T('nDock', { n: nm(e.s), k: kTxt(e.pax.length) }), 'good'); }
      } else {
        SND.play(e.res === 'land' ? 'step' : e.res === 'board' ? 'board' : e.res === 'swim' ? 'swim' : 'safe');
        if (e.res === 'safe') feed(T('nSafe', { n: nm(e.s) }), 'good');
      }
      break;
    case 'tail': SND.play('good'); feed(T('nTail', { n: nm(e.s) }), 'good'); break;
    case 'undo': SND.play('tap'); break;
    case 'sink': {
      SND.play('sink'); SND.play('flip', 500);
      const good = ['boat', 'dolphin', 'buoy', 'tail'].includes(e.back), bad = e.back === 'shark' || e.back === 'oct';
      SND.play(e.back === 'dolphin' ? 'dolphin' : good ? 'good' : e.back === 'shark' ? 'bad' : e.back === 'oct' ? 'wobble' : e.back === 'reef' ? 'reef' : 'meh', 720);
      if (e.fell.length) SND.play('splash', 950);
      let t = T('nSink', { n: nm(e.s), el: T('el')[e.el] || '', what: T('back')[e.back || 'none'] });
      if (e.fell.length) t += ' · ' + (e.fell.length === 1 ? T('nFell1') : T('nFell', { k: kTxt(e.fell.length) }));
      feed(t, bad ? 'bad' : good ? 'good' : '');
      break;
    }
    case 'dol':
      SND.play('dolphin');
      feed(T(e.res === 'safe' ? 'nDolSafe' : 'nDol'), 'good');
      if (e.res === 'safe') SND.play('safe', 280 * e.path.length);
      break;
    case 'cr': {
      const d = 300 * Math.max(1, e.path.length - 1);
      if (e.ck === 'shark') {
        SND.play('swim');
        if (e.eat.length) { SND.play('chomp', d); feed(e.eat.length === 1 ? T('nEat1') : T('nEat', { k: kTxt(e.eat.length) }), 'bad'); if (e.eat.some(isMine)) SND.vibrate(140); }
        else if (e.spared.length) { SND.play('good', d); feed(T('nSpared', { n: e.buoy.map(nm).join(', ') }), 'good'); }
        else feed(T('nCrMove', { n: nm(e.s), c: T('crThe').shark }));
      } else if (e.ck === 'oct') {
        SND.play('wobble');
        if (e.grab) { SND.play('grab', d); feed(T('nGrab') + (e.pax.length ? ' · ' + (e.pax.length === 1 ? T('nFell1') : T('nFell', { k: kTxt(e.pax.length) })) : ''), 'bad'); }
        else feed(T('nCrMove', { n: nm(e.s), c: T('crThe').oct }));
      } else {
        SND.play('step');
        if (e.pushed && e.pushed.length) { SND.play('shove', d); SND.play('splash', d + 260); feed(e.pushed.length === 1 ? T('nPush1') : T('nPush', { k: kTxt(e.pushed.length) }), 'bad'); }
        else feed(T('nCrMove', { n: nm(e.s), c: T('crThe').crab }));
      }
      break;
    }
    case 'crskip': feed(T('nCrSkip', { n: nm(e.s) })); break;
    case 'nocr': feed(T('nNoCr')); break;
  }
  return line;
}
