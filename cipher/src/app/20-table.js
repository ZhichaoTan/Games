// ===== the table: everyone's rows, the two piles, the ticker, the prompt and the number pad =====
// A new view is played one event at a time. A guess puts a bubble over its tile, holds for a moment, then lands:
// the tile flips open, or it shakes and the wrong number is noted under it. Then the whole table is redrawn and every
// tile that moved slides over from where it was (tiles are keyed by their public uid), so a drawn tile flies in from
// its pile and a dealt one from the middle.
const UI = (function () {
  const HOLD_MS = 650, LAND_MS = 700;            // a guess: the pause before it lands, and how long the result stays up
  const GUESS_MS = HOLD_MS + LAND_MS;
  let V = null, room = {}, roundNo = -1, seenN = 0, endShown = -1;
  let els = new Map();                 // uid -> tile element (this round)
  const blocks = new Map();            // opponent seat -> { root, plate, row, hold }
  let busy = false, next = null, clock = null;
  const st = { sel: null, val: null, peek: null, rev: -1, stop: false, sent: false };
  let log = [];
  let cb = { act() {}, onEnd() {} };
  let hintC = null;

  const nm = (v, s) => s === v.me ? T('youName') : (v.seats[s] ? esc(v.seats[s].name) : '?');
  const cap = s => zh() ? s : s.charAt(0).toUpperCase() + s.slice(1);
  const pctTxt = p => p >= 0.995 ? '100%' : p < 0.01 ? '<1%' : Math.round(p * 100) + '%';

  function locate(u, v) {
    v = v || V; const R = v && v.R; if (!R) return null;
    for (const s of R.ps) { const row = R.rows[s]; if (!row) continue; const i = row.findIndex(t => t.u === u); if (i >= 0) return { s, i, t: row[i] }; }
    if (R.hold && R.hold.u === u) return { s: R.cur, i: -1, t: R.hold, hold: true };
    return null;
  }

  // ---------------- tiles ----------------
  const STATE = ['hold', 'sel', 'peeked', 'pop', 'shake'];
  function getEl(u) {
    let el = els.get(u);
    if (!el) { el = document.createElement('div'); el.dataset.u = u; el._sig = ''; els.set(u, el); }
    return el;
  }
  // draw t into el. anim: { delay } turns a tile that was face down over with a flip
  function paintTile(el, t, o, anim) {
    const cls = tileClass(t, o), inner = tileInner(t, o), sig = cls + '|' + inner;
    el._t = t; el._o = o;
    if (sig === el._sig) return false;
    const flipping = !!(anim && el._sig && el._back && t.v != null);
    el._sig = sig; el._back = t.v == null; el._cls = cls; el._inner = inner;
    if (!flipping) { const keep = STATE.filter(c => el.classList.contains(c)); el.className = cls; keep.forEach(c => el.classList.add(c)); el.innerHTML = inner; return true; }
    const run = () => {
      const a = el.querySelector('.in');
      const land = () => {
        const keep = STATE.filter(c => el.classList.contains(c));
        el.className = el._cls; keep.forEach(c => el.classList.add(c)); el.innerHTML = el._inner;
        const b = el.querySelector('.in');
        if (b && b.animate) b.animate([{ transform: 'perspective(420px) rotateY(-90deg)' }, { transform: 'perspective(420px) rotateY(0deg)' }], { duration: 190, easing: 'cubic-bezier(.2,.8,.3,1.2)' });
      };
      if (a && a.animate) a.animate([{ transform: 'perspective(420px) rotateY(0deg)' }, { transform: 'perspective(420px) rotateY(90deg)' }], { duration: 140, easing: 'ease-in' }).onfinish = land;
      else land();
    };
    if (anim.delay) setTimeout(run, anim.delay); else run();
    return true;
  }
  function setKids(parent, nodes) {
    const k = parent.children;
    if (k.length === nodes.length && nodes.every((n, i) => k[i] === n)) return;
    parent.replaceChildren(...nodes);
  }
  function slotEl(at) { const d = document.createElement('button'); d.className = 'slot'; d.dataset.at = at; d.setAttribute('aria-label', 'Put it here'); d.innerHTML = icon('plus', ''); return d; }
  function ghostEls(n) { const out = []; for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = 'tile k ghost'; d.innerHTML = '<div class="in"></div>'; out.push(d); } return out; }

  // ---------------- drawing the table ----------------
  function block(s) {
    let b = blocks.get(s);
    if (!b) {
      const root = document.createElement('div'); root.className = 'opp'; root.dataset.s = s;
      root.innerHTML = '<div class="plate"></div><div class="rowwrap"><div class="row"></div><div class="holdslot"></div></div>';
      b = { root, plate: root.querySelector('.plate'), row: root.querySelector('.row'), hold: root.querySelector('.holdslot') };
      blocks.set(s, b);
    }
    return b;
  }
  function ringSvg() { return '<svg class="ring" viewBox="0 0 44 44" hidden><circle cx="22" cy="22" r="20" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0"/></svg>'; }
  function plateHTML(v, s) {
    const p = v.seats[s], R = v.R;
    if (!p) return '';
    const row = R && R.rows[s], end = R && R.phase === 'end';
    let tags = '';
    if (R && R.ps.includes(s)) {
      if (end && R.win === s) tags += `<span class="tagx think">${T('winTag')}</span>`;
      else if (R.out.includes(s)) tags += `<span class="tagx out">${T('outTag')}</span>`;
      else tags += `<span class="lk">${esc(T('hiddenN', { n: row ? row.filter(t => !t.open).length : R.hand }))}</span>`;
    } else if (R) tags += `<span class="tagx">${T('nextTag')}</span>`;
    if (p.bot) tags += `<span>${esc(lvName(p.lv))}</span>`;
    if (!p.bot && !p.conn) tags += `<span class="tagx off">${T('offline')}</span>`;
    else if (p.auto && !p.bot) tags += `<span class="tagx">${T('autoTag')}</span>`;
    if (R && R.phase === 'play' && R.cur === s && (p.bot || p.auto || !p.conn)) tags += `<span class="tagx think">${T('thinking')}</span>`;
    return `<div class="av">${avSvg(p)}${ringSvg()}</div><div class="nm"><b>${esc(p.name)}</b><small>${tags}</small></div><div class="grow"></div><div class="pscore num">${p.score | 0}<small>${T('ptsShort')}</small></div>`;
  }
  function setHTML(el, h) { if (el._h !== h) { el._h = h; el.innerHTML = h; } }

  function fillRow(rowEl, tiles, s, v, x) {
    const R = v.R, mine = s === v.me, end = R.phase === 'end';
    const nodes = [];
    let marks = false;
    tiles.forEach((t, i) => {
      if (x.slots && x.slots.includes(i)) nodes.push(slotEl(i));
      const el = getEl(t.u);
      const turning = x.anim && el._sig && el._back && t.v != null;
      paintTile(el, t, { mine, end }, x.anim && { delay: end && turning ? (x.k.n++) * 85 : 0 });
      el.classList.remove('hold');
      if (t.bad && t.bad.length && !t.open && !end) marks = true;
      nodes.push(el);
    });
    if (x.slots && x.slots.includes(tiles.length)) nodes.push(slotEl(tiles.length));
    rowEl.classList.toggle('marks', marks);
    setKids(rowEl, nodes);
  }
  function fillHold(holdEl, tiles, s, v) {
    const nodes = tiles.map(t => { const el = getEl(t.u); paintTile(el, t, { mine: s === v.me }); el.classList.add('hold'); return el; });
    setKids(holdEl, nodes);
  }
  function opponents(v) {
    const R = v.R, me = v.me;
    const ps = R ? R.ps : [0, 1, 2, 3].filter(s => v.seats[s]);
    const i = ps.indexOf(me);
    return i < 0 ? ps.slice() : ps.slice(i + 1).concat(ps.slice(0, i));
  }
  function snapshot() {
    const m = new Map();
    for (const [u, el] of els) if (el.isConnected) m.set(u, el.getBoundingClientRect());
    return m;
  }
  function render(v, o) {
    o = o || {};
    const R = v.R, me = v.me;
    const snap = o.anim ? snapshot() : null;
    if (!R) { $('opps').replaceChildren(); blocks.clear(); paintDock(v); return; }
    const end = R.phase === 'end', setup = R.phase === 'setup', play = R.phase === 'play';
    const inRound = R.ps.includes(me);
    const opps = opponents(v);
    const k = { n: 0 };
    for (const [s, b] of blocks) if (!opps.includes(s)) { b.root.remove(); blocks.delete(s); }
    const oppsEl = $('opps');
    opps.forEach((s, idx) => {
      const b = block(s);
      if (oppsEl.children[idx] !== b.root) oppsEl.insertBefore(b.root, oppsEl.children[idx] || null);
      b.root.classList.toggle('cur', play && R.cur === s);
      b.root.classList.toggle('out', R.out.includes(s) && !end);
      setHTML(b.plate, plateHTML(v, s));
      const row = R.rows[s];
      if (!row) { b.row.replaceChildren(...ghostEls(R.hand)); b.row.classList.remove('marks'); b.hold.replaceChildren(); }
      else {
        fillRow(b.row, row, s, v, { anim: o.anim, k });
        fillHold(b.hold, play && R.cur === s && R.hold ? [R.hold] : [], s, v);
      }
    });
    $('mine').hidden = !inRound;
    if (inRound) {
      $('mine').classList.toggle('cur', play && R.cur === me);
      setHTML($('myPlate'), plateHTML(v, me));
      const opt = v.opt;
      const slots = opt && opt.k === 'place' ? opt.slots : (st.stop && opt && opt.k === 'decide' ? opt.slots : null);
      fillRow($('myRow'), R.rows[me] || [], me, v, { slots, anim: o.anim, k });
      fillHold($('myHold'), setup ? (R.setup || []) : (play && R.cur === me && R.hold ? [R.hold] : []), me, v);
    }
    paintPiles(v);
    paintDock(v);
    applySel();
    layout(v);
    if (snap) moves(snap, o);
    tick();
  }
  function paintPiles(v) {
    const R = v.R;
    for (const c of [0, 1]) {
      const el = $('pile' + c), n = R ? R.pool[c] : 0;
      if (!el._built) { el.innerHTML = tileHTML({ c }, {}) + tileHTML({ c }, {}) + tileHTML({ c }, {}) + '<span class="cnt num"></span>'; el._built = true; }
      el.querySelector('.cnt').textContent = n;
      el.querySelectorAll('.tile').forEach((t, i) => { t.style.visibility = n > i ? '' : 'hidden'; });
      el.classList.toggle('none', !n);
      el.classList.toggle('go', !!(v.opt && v.opt.k === 'draw' && n > 0 && !st.sent));
      el.setAttribute('aria-label', T(c ? 'White' : 'Black') + ' · ' + n);
    }
  }
  // tile sizes: as big as the room allows, wrapping a long row onto two lines rather than shrinking it to nothing
  function fit(n, aw, ah, max) {
    n = Math.max(1, n);
    let best = null;
    for (let lines = 1; lines <= 3; lines++) {
      const per = Math.ceil(n / lines);
      const gap = 5;
      const tw = Math.min(max, (aw - gap * (per - 1)) / per, (ah - (lines - 1) * 16) / (1.4 * lines));
      if (!best || tw > best.tw + 1) best = { tw, per, lines };
    }
    best.tw = Math.max(18, Math.floor(best.tw));
    return best;
  }
  function sizeRow(rowEl, holdEl, f) {
    const tw = f.tw, gap = Math.max(3, Math.round(tw * 0.11));
    for (const e of [rowEl, holdEl]) { e.style.setProperty('--tw', tw + 'px'); e.style.setProperty('--gap', gap + 'px'); }
    rowEl.style.maxWidth = f.lines > 1 ? (f.per * tw + (f.per - 1) * gap + 2) + 'px' : '';
  }
  function layout(v) {
    v = v || V; const R = v && v.R; if (!R) return;
    const tbl = $('tbl'), padOn = tbl.classList.contains('padon');
    const W0 = Math.min(tbl.clientWidth, 720) - 20 - 16;
    if (R.ps.includes(v.me)) {
      const row = $('myRow'), hold = $('myHold');
      const nHold = hold.children.length, nSlot = row.querySelectorAll('.slot').length;
      const n = row.querySelectorAll('.tile').length + nSlot * 0.6;
      const f = fit(n + nHold, W0 - (nHold ? 10 : 0), padOn ? 64 : 150, padOn ? 42 : (innerHeight < 700 ? 48 : 54));
      sizeRow(row, hold, f);
    }
    const opps = [...blocks.values()];
    if (!opps.length) return;
    const H = $('opps').clientHeight;
    const per = (H - 4 * (opps.length - 1)) / opps.length;
    for (const b of opps) {
      const n = b.row.children.length + b.hold.children.length;
      const marks = b.row.classList.contains('marks') ? 13 : 0;
      const f = fit(n, W0 - (b.hold.children.length ? 10 : 0), per - 34 - 6 - 14 - marks - 6, opps.length === 1 ? 52 : 46);
      sizeRow(b.row, b.hold, f);
    }
  }
  function slide(el, from, to, delay, dur) {
    if (!el.animate) return;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const sc = to.width ? from.width / to.width : 1;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sc - 1) < 0.03) return;
    el.animate([{ transform: `translate(${dx}px,${dy}px) scale(${sc})` }, { transform: 'translate(0,0) scale(1)' }], { duration: dur || 430, delay: delay || 0, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  }
  function moves(snap, o) {
    const mid = $('mid').getBoundingClientRect();
    const centre = { left: mid.left + mid.width / 2 - 14, top: mid.top + mid.height / 2 - 20, width: 28, height: 40 };
    let k = 0;
    for (const [u, el] of els) {
      if (!el.isConnected) continue;
      const to = el.getBoundingClientRect();
      const from = snap.get(u);
      if (from) { slide(el, from, to); continue; }
      if (o.dealNew) { slide(el, centre, to, (k++) * 60, 480); continue; }
      const loc = locate(u);
      if (loc && loc.hold) { const p = $('pile' + loc.t.c).getBoundingClientRect(); slide(el, { left: p.left + 7, top: p.top + 2, width: 38, height: 53 }, to, 0, 460); continue; }
      if (el.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    }
  }

  // ---------------- selection ----------------
  const canPick = () => !!(V && V.opt && (V.opt.k === 'guess' || V.opt.k === 'decide') && !st.sent && !st.stop);
  function applySel() {
    const R = V && V.R;
    const revU = R && V.opt && V.opt.k === 'reveal' && st.rev >= 0 && R.rows[V.me] && R.rows[V.me][st.rev] ? R.rows[V.me][st.rev].u : -1;
    for (const [u, el] of els) {
      el.classList.toggle('sel', !!(st.sel && st.sel.u === u) || u === revU);
      el.classList.toggle('peeked', !!(st.peek && st.peek.u === u));
    }
    const pick = canPick();
    for (const b of blocks.values()) b.row.classList.toggle('pick', pick && !(R && R.out.includes(+b.root.dataset.s)));
    $('myRow').classList.toggle('revealing', !!(V && V.opt && V.opt.k === 'reveal' && !st.sent));
    const padOn = !!(st.sel || st.peek);
    const tbl = $('tbl');
    if (tbl.classList.contains('padon') !== padOn) { tbl.classList.toggle('padon', padOn); if (V) requestAnimationFrame(() => layout(V)); }
  }
  // a new state: anything half-chosen goes, except a tile you're only looking at
  function tidy(v, changed) {
    if (changed) { st.sel = null; st.val = null; st.rev = -1; st.stop = false; st.sent = false; }
    if (st.peek) { const l = locate(st.peek.u, v); if (!l || l.t.open || l.hold || l.s === v.me || (v.R && v.R.phase === 'end') || canPickIn(v)) st.peek = null; }
  }
  const canPickIn = v => !!(v.opt && (v.opt.k === 'guess' || v.opt.k === 'decide'));

  // ---------------- the prompt, the buttons and the pad ----------------
  function hints(v) {
    if (P.hints === 'off') return null;
    if (hintC && hintC.evn === v.evn && hintC.me === v.me && hintC.mode === P.hints && hintC.no === v.R.no) return hintC.P;
    let Pp = null;
    try { Pp = P.hints === 'exact' ? (AI.infer(v) || AI.simple(v)) : AI.simple(v); } catch (e) { Pp = null; }
    hintC = { evn: v.evn, me: v.me, mode: P.hints, no: v.R.no, P: Pp };
    return Pp;
  }
  function padHTML(v, u, live) {
    const loc = locate(u, v); if (!loc || loc.hold) return '';
    const t = loc.t, Pp = hints(v), arr = Pp && Pp[loc.s] && Pp[loc.s][loc.i];
    const exact = P.hints === 'exact' && arr;
    let best = 0; if (exact) for (let x = 0; x < 13; x++) best = Math.max(best, arr[x]);
    const vals = []; for (let x = 0; x < 12; x++) vals.push(x); if (v.rules.keys) vals.push(KEYV);
    return `<div class="pad ${t.c ? 'w' : 'k'}${live ? '' : ' peek'}" style="grid-template-columns:repeat(${vals.length > 12 ? 7 : 6},minmax(0,1fr))">` + vals.map(x => {
      const wrong = (t.bad || []).includes(x);
      let cls = 'pk';
      if (P.hints !== 'off') { if (wrong) cls += ' wrong'; else if (arr && arr[x] < 1e-9) cls += ' no'; else if (exact && arr[x] >= best - 1e-9) cls += ' best'; }
      if (live && st.val === x) cls += ' on';
      const pct = exact && !wrong && arr[x] > 1e-9 ? pctTxt(arr[x]) : '';
      return `<button class="${cls}" data-v="${x}" aria-label="${x === KEYV ? T('keyName') : x}">${x === KEYV ? keySvg('') : `<b>${x}</b>`}${pct ? `<i>${pct}</i>` : ''}</button>`;
    }).join('') + '</div>';
  }
  const prompt = (txt, dim, extra) => `<div class="prompt${dim ? ' dim' : ''}"><span>${txt}</span><span class="sec" data-sec hidden></span>${extra || ''}</div>`;
  const btn = (act, cls, html, dis) => `<button class="btn ${cls}" data-act="${act}"${dis ? ' disabled' : ''}>${html}</button>`;
  function paintDock(v) {
    const d = $('dock'), R = v.R, me = v.me, o = v.opt;
    let h = '';
    if (!R || R.phase === 'end') { setHTML(d, ''); return; }
    const inRound = R.ps.includes(me);
    const peekPad = () => st.peek ? `<div class="bar">${prompt(T('pCould'), true)}</div>` + padHTML(v, st.peek.u, false) : '';
    const auto = v.seats[me] && v.seats[me].auto && inRound && !R.out.includes(me);
    if (room.paused) h = prompt(T('pausedBy'), true);
    else if (auto) h = `<div class="bar">${prompt(T('autoOn'), true)}${btn('takeover', 'gold sm', T('takeOver'))}</div>`;
    else if (!inRound) h = prompt(T('pSpect'), true) + peekPad();
    else if (R.phase === 'setup') h = o && o.k === 'place' ? prompt(T('pKey')) : prompt(T(R.go ? 'pKeyWait' : 'pArrange'), true);
    else if (R.out.includes(me)) h = (st.peek ? '' : prompt(T('pOut'), true)) + peekPad();
    else if (R.cur === me && o) {
      if (o.k === 'draw') {
        h = prompt(T('pDraw')) + `<div class="acts">` +
          btn('draw0', 'glass', `<span class="dot k"></span>${T('Black')} <small class="num">${o.c[0]}</small>`, !o.c[0] || st.sent) +
          btn('draw1', 'glass', `<span class="dot w"></span>${T('White')} <small class="num">${o.c[1]}</small>`, !o.c[1] || st.sent) + '</div>';
      } else if (o.k === 'guess' || o.k === 'decide') {
        const dec = o.k === 'decide';
        if (st.stop) h = prompt(T('pWhere')) + `<div class="acts">${btn('unstop', 'glass', T('back'))}</div>`;
        else if (st.sel) {
          const go = st.val == null ? '' : btn('guess', 'gold sm', st.val === KEYV ? T('guessKey') : T('guessBtn', { v: st.val }), st.sent);
          h = `<div class="bar">${prompt(T('pGuess'))}${dec ? btn('stop', 'glass sm', T('stop'), st.sent) : ''}${go}</div>` + padHTML(v, st.sel.u, !st.sent);
        } else {
          h = prompt(dec ? T(R.hold ? 'pHit' : 'pHitNo') : T(R.hold ? 'pPick' : 'pPickEmpty'));
          if (dec) h += `<div class="acts">${btn('stop', 'jade', T('stop'), st.sent)}</div>`;
        }
      } else if (o.k === 'reveal') {
        h = prompt(T('pReveal')) + (st.rev >= 0 ? `<div class="acts">${btn('reveal', 'red', T('revealBtn'), st.sent)}</div>` : '');
      }
    } else if (R.phase === 'play') {
      const n = v.seats[R.cur] ? esc(v.seats[R.cur].name) : '';
      const key = R.stage === 'draw' ? 'pWaitDraw' : R.stage === 'decide' ? 'pWaitMore' : R.stage === 'reveal' ? 'pWaitReveal' : 'pWaitGuess';
      h = st.peek ? peekPad() : prompt(T(key, { n }), true) + (P.hints !== 'off' ? `<div class="hintln">${T('pPeek')}</div>` : '');
    }
    setHTML(d, h);
  }

  // ---------------- taps ----------------
  function send(a) {
    if (st.sent) return;
    st.sent = true;
    const r = cb.act(a);
    if (r === false || (typeof r === 'string' && r !== 'ok')) st.sent = false;
    if (V) { paintDock(V); paintPiles(V); applySel(); }
  }
  function onTile(u) {
    if (!V || !V.R || V.R.phase === 'end') return;
    const loc = locate(u); if (!loc || loc.hold) return;
    const R = V.R, me = V.me, o = V.opt;
    if (loc.s === me) {
      if (o && o.k === 'reveal' && !loc.t.open && !st.sent) { st.rev = st.rev === loc.i ? -1 : loc.i; SND.play('select'); paintDock(V); applySel(); }
      return;
    }
    if (loc.t.open || R.out.includes(loc.s)) return;
    if (canPick()) {
      if (st.sel && st.sel.u === u) { st.sel = null; st.val = null; } else { st.sel = { s: loc.s, u }; st.val = null; }
      st.peek = null;
      SND.play('select'); paintDock(V); applySel();
      return;
    }
    if (R.cur === me && o) return;
    if (P.hints === 'off') return;
    st.peek = st.peek && st.peek.u === u ? null : { s: loc.s, u };
    SND.play('select'); paintDock(V); applySel();
  }
  function onKey(x) {
    if (!st.sel || st.sent || !canPick()) return;
    if (st.val === x) { sendGuess(); return; }
    st.val = x; SND.play('tap'); paintDock(V);
  }
  function sendGuess() {
    if (!st.sel || st.val == null) return;
    const loc = locate(st.sel.u); if (!loc || loc.hold) return;
    send({ k: 'guess', t: loc.s, i: loc.i, v: st.val });
  }
  function onBtn(a) {
    if (a === 'takeover') { cb.act({ k: '_auto', on: false }); SND.play('tap'); return; }
    if (!V || !V.opt) return;
    if (a === 'draw0' || a === 'draw1') { send({ k: 'draw', c: a === 'draw1' ? 1 : 0 }); return; }
    if (a === 'guess') { sendGuess(); return; }
    if (a === 'stop') {
      const sl = V.opt.slots || [];
      if (sl.length > 1) { st.stop = true; st.sel = null; st.val = null; SND.play('tap'); render(V, {}); return; }
      send({ k: 'stop' });
      return;
    }
    if (a === 'unstop') { st.stop = false; render(V, {}); return; }
    if (a === 'reveal' && st.rev >= 0) send({ k: 'reveal', i: st.rev });
  }
  function onSlot(at) {
    if (!V || !V.opt) return;
    if (V.opt.k === 'place') { send({ k: 'place', at }); return; }
    if (V.opt.k === 'decide' && st.stop) send({ k: 'stop', at });
  }
  function onDraw(c) { if (V && V.opt && V.opt.k === 'draw' && V.opt.c[c] > 0) send({ k: 'draw', c }); }
  $('tbl').addEventListener('click', e => {
    const sl = e.target.closest('.slot'); if (sl) { onSlot(+sl.dataset.at); return; }
    const pk = e.target.closest('.pk'); if (pk) { onKey(+pk.dataset.v); return; }
    const b = e.target.closest('[data-act]'); if (b) { if (!b.disabled) onBtn(b.dataset.act); return; }
    const t = e.target.closest('.tile[data-u]'); if (t) { onTile(+t.dataset.u); return; }
    const pile = e.target.closest('.pile'); if (pile) { onDraw(+pile.dataset.c); return; }
  });
  document.addEventListener('keydown', e => {
    if ($('game').hidden || sheetOn || !$('overlay').hidden || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
    if (e.key === 'Escape' && (st.sel || st.peek || st.stop)) { st.sel = null; st.val = null; st.peek = null; st.stop = false; if (V) render(V, {}); }
    else if (e.key === 'Enter' && st.sel && st.val != null) sendGuess();
    else if (/^[0-9]$/.test(e.key) && st.sel) onKey(+e.key);
  });

  // ---------------- events ----------------
  function evText(e, v) {
    const n = nm(v, e.s);
    let s = '';
    if (e.k === 'play') s = T('tPlay', { n: nm(v, v.R.first) });
    else if (e.k === 'draw') s = T('tDraw', { n, c: T(e.c ? 'white' : 'black') });
    else if (e.k === 'guess') {
      let c = 0;
      if (e.ok) c = CX.colorOf(e.id);
      else { const el = els.get(e.u), l = locate(e.u, v); c = l ? l.t.c : el && el._t ? el._t.c : 0; }
      s = e.ok ? T('tHit', { n, t: e.t === v.me ? T('yourTile') : T('theirTile', { n: nm(v, e.t) }), v: chip(c, e.v) }) : T('tMiss', { n, v: chip(c, e.v) });
    } else if (e.k === 'flip') s = T('tFlip', { n, v: chip(CX.colorOf(e.id), CX.valOf(e.id)) });
    else if (e.k === 'stop') s = T('tStop', { n });
    else if (e.k === 'out') s = T('tOut', { n });
    else if (e.k === 'end') s = T('tWin', { n: nm(v, e.win) });
    return s ? cap(s) : '';
  }
  function pushLog(h) {
    if (!h) return;
    log.unshift(h); log = log.slice(0, 2);
    paintTicker(true);
  }
  function paintTicker(flash) {
    const t = $('ticker');
    t.innerHTML = log.length ? `<div class="l1">${log[0]}</div>${log[1] ? `<div class="l2">${log[1]}</div>` : ''}` : '';
    if (flash) { t.classList.remove('flash'); t.offsetWidth; t.classList.add('flash'); }
  }
  function sparks(r, ok) {
    if (!document.body.animate) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 10; i++) {
      const d = document.createElement('i'); d.className = 'spark';
      d.style.left = cx - 3.5 + 'px'; d.style.top = cy - 3.5 + 'px';
      if (!ok) d.style.background = '#ff9d88';
      document.body.appendChild(d);
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5, dist = 30 + Math.random() * 30;
      d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist}px) scale(.3)`, opacity: 0 }], { duration: 560 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => d.remove();
    }
  }
  function fx(txt, bad) {
    const f = $('fx');
    f.innerHTML = `<div class="big${bad ? ' bad' : ''}">${esc(txt)}</div>`;
    clearTimeout(fx.t); fx.t = setTimeout(() => { f.innerHTML = ''; }, 1300);
  }
  async function playGuess(e, v) {
    const el = els.get(e.u);
    const who = v.seats[e.s];
    if (!el || !el.isConnected) { SND.play(e.ok ? 'hit' : 'miss'); pushLog(evText(e, v)); return; }
    const r = el.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = 'gbub';
    b.innerHTML = `<div class="b"><span class="who">${avSvg(who)}</span>${e.v === KEYV ? keySvg('kv') : `<span class="v">${e.v}</span>`}</div>`;
    b.style.left = (r.left + r.width / 2) + 'px'; b.style.top = Math.max(8, r.top - 4) + 'px';
    document.body.appendChild(b);
    SND.play('guess');
    await sleep(HOLD_MS);
    if (e.ok) {
      b.classList.add('ok');
      paintTile(el, { c: CX.colorOf(e.id), v: CX.valOf(e.id), open: true, bad: [] }, { mine: e.t === v.me }, { delay: 0 });
      el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 650);
      SND.play('hit');
      sparks(el.getBoundingClientRect(), true);
      SND.vib(e.t === v.me ? [50, 40, 70] : 25);
    } else {
      b.classList.add('no');
      const t0 = el._t || { c: 0 }, bad = (t0.bad || []).slice();
      if (!bad.includes(e.v)) bad.push(e.v);
      paintTile(el, Object.assign({}, t0, { bad }), el._o || {});
      el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500);
      SND.play('miss');
      if (e.s === v.me) SND.vib(70);
    }
    pushLog(evText(e, v));
    await sleep(LAND_MS);
    b.classList.add('bye'); setTimeout(() => b.remove(), 260);
  }
  function after(evs, v) {
    const me = v.me, R = v.R;
    const lastTurn = evs.filter(e => e.k === 'turn').pop();
    for (const e of evs) {
      if (e.k === 'guess') continue;
      if (e.k !== 'turn' && e.k !== 'deal') pushLog(evText(e, v));
      if (e.k === 'deal') SND.play('deal');
      else if (e.k === 'draw') SND.play('draw');
      else if (e.k === 'flip') SND.play('flip', 0.12);
      else if (e.k === 'stop') SND.play('place');
      else if (e.k === 'out') { SND.play('out', 0.25); if (e.s === me) fx(T('fxOut'), true); }
      else if (e === lastTurn && e.s === me && R.phase === 'play') { SND.play('turn', 0.1); SND.vib(30); }
    }
    if (R.phase === 'end' && endShown !== R.no) {
      endShown = R.no;
      const win = R.win === me;
      setTimeout(() => { fx(T(win ? 'fxWin' : 'fxLose'), !win); SND.play(win ? 'win' : 'end'); }, 500);
      setTimeout(() => cb.onEnd(V), 2300);
    }
  }
  // what counts as a new state: placing a key moves no event counter, so the stage and the options count too
  const sigOf = v => v.evn + '|' + (v.R ? [v.R.no, v.R.phase, v.R.stage, v.R.cur, (v.R.setup || []).length, v.R.go ? 1 : 0, v.opt ? v.opt.k : ''].join(',') : '');
  async function playView(v) {
    const R = v.R;
    const prevSig = V ? sigOf(V) : '', sameRound = !!(V && V.R && R && V.R.no === R.no);
    if (!R) { V = v; tidy(v, true); render(v, {}); return; }
    if (R.no !== roundNo) { roundNo = R.no; els = new Map(); log = []; paintTicker(false); st.peek = null; }
    const evs = (R.ev || []).filter(e => e.n > seenN);
    const first = evs[0];
    const anim = !!first && (V ? (first.n === seenN + 1 || first.k === 'deal') : first.k === 'deal') && evs.length <= 12 && document.visibilityState === 'visible';
    if (evs.length) seenN = evs[evs.length - 1].n;
    if (!anim) {
      const quiet = sameRound && !evs.length && document.visibilityState === 'visible';
      V = v; tidy(v, sigOf(v) !== prevSig);
      render(v, { anim: quiet });
      for (const e of evs.filter(e => e.k !== 'turn' && e.k !== 'deal').slice(-2)) pushLog(evText(e, v));
      if (R.phase === 'end' && endShown !== R.no) { endShown = R.no; cb.onEnd(v); }
      return;
    }
    for (const e of evs) if (e.k === 'guess') await playGuess(e, v);
    V = v; tidy(v, sigOf(v) !== prevSig);
    render(v, { anim: true, dealNew: evs.some(e => e.k === 'deal' || e.k === 'play') });
    after(evs, v);
  }
  async function pump() {
    while (next) {
      const v = next; next = null;
      busy = true;
      try { await playView(v); } catch (e) { console.error(e); try { V = v; render(v, {}); } catch (e2) {} }
      busy = false;
    }
  }
  function update(v, r) {
    room = r || {};
    clock = room.clock ? { seats: room.clock.seats, end: Date.now() + room.clock.left, total: room.clock.total || 1 } : null;
    if (!busy && V && v.R && V.R && !next && sigOf(v) === sigOf(V)) { V = v; render(v, {}); return; }
    next = v;
    if (!busy) pump();
  }

  // ---------------- the clock ----------------
  function tick() {
    if (!V || !V.R) return;
    const c = clock, now = Date.now();
    const rings = new Map();
    for (const [s, b] of blocks) rings.set(s, b.plate.querySelector('.ring'));
    rings.set(V.me, $('myPlate').querySelector('.ring'));
    for (const [s, r] of rings) {
      if (!r) continue;
      const on = !!(c && c.seats.includes(s) && !room.paused);
      r.hidden = !on;
      if (on) { const left = Math.max(0, c.end - now); const f = clamp(left / c.total, 0, 1); r.querySelector('circle').setAttribute('stroke-dashoffset', String(100 - f * 100)); r.classList.toggle('low', left < 10000); }
    }
    const sec = $('dock').querySelector('[data-sec]');
    if (sec) {
      const on = !!(c && c.seats.includes(V.me) && !room.paused);
      sec.hidden = !on;
      if (on) { const left = Math.min(V.rules.timer || 999, Math.max(0, Math.ceil((c.end - now) / 1000))); sec.textContent = T('leftSec', { n: left }); sec.classList.toggle('low', left <= 10); }
    }
  }
  setInterval(tick, 250);
  addEventListener('resize', () => { if (V && !$('game').hidden) layout(V); });

  // a chat line or an emoji, next to whoever said it
  function bubble(s, text, emo) {
    if (!V) return;
    const host = s === V.me ? $('mine') : blocks.get(s) && blocks.get(s).root;
    if (!host || host.hidden) { toast(`<b>${esc(V.seats[s] ? V.seats[s].name : '')}</b> ${esc(text)}`, 2600); return; }
    let b = host.querySelector(':scope > .bubble');
    if (!b) { b = document.createElement('div'); b.className = 'bubble'; host.appendChild(b); }
    b.classList.toggle('emo', !!emo);
    b.textContent = text;
    requestAnimationFrame(() => b.classList.add('show'));
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 3400);
  }
  return {
    init(o) { cb = Object.assign(cb, o); },
    update, bubble, layout: () => V && layout(V),
    unlock() { st.sent = false; if (V) { paintDock(V); paintPiles(V); applySel(); } },
    refresh() { hintC = null; if (V) render(V, {}); },   // a setting or the language changed
    get view() { return V; }, get busy() { return busy || !!next; }, GUESS_MS,
  };
})();
