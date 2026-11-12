// ===== the game screen: against the computer, pass and play, and online (the room itself is in 50-net.js) =====
const gb = Board($('gBoard'));
const G = { mode: 'ai', moves: [], level: 2, side: 0, over: false, thinking: false, sel: -1, hint: 0, pos: new E.Position(), token: 0, base: 0, hints: 0, undos: 0, id: 0, t: 0, engine: 'muyi', ex: null, rec: null };
const INIT_COUNT = { 8: 1, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 5, 16: 1, 17: 2, 18: 2, 19: 2, 20: 2, 21: 2, 22: 5 };
const isPvp = () => G.mode == 'pvp', isNet = () => G.mode == 'net', isAi = () => G.mode == 'ai';
// "me" is the bottom player; in pass and play that is red
const bottomSide = () => isPvp() ? 0 : G.side;
const canMove = () => !G.over && !G.thinking && (isPvp() || G.pos.sd == G.side);
const pick = a => a[Math.random() * a.length | 0];

function sizeGame() {
  const sc = $('game');
  if (isWide()) {
    // a narrow column on the left; an empty column of the same width on the right keeps the board centred
    // whenever the screen is wide enough for it
    const LW = 270, GAP = 24, h = sc.clientHeight - 28 - 12, w = sc.clientWidth - 48 - LW - GAP * 2 - 12;
    const W = Math.floor(Math.max(320, Math.min(w, 1000, h / gb.ratio())));
    const sp = sc.clientWidth - 48 - LW - GAP * 2 - (W + 12) >= LW ? LW : 0;
    sc.style.setProperty('--bw', (W + 12) + 'px'); sc.style.setProperty('--sp', sp + 'px'); gb.size(W); return;
  }
  const h = $('gWrap').clientHeight - 14, w = sc.clientWidth - 16 - 12;
  gb.size(Math.floor(Math.max(240, Math.min(w, 588, h / gb.ratio()))));
}
function sizeSplit(id, board) {
  const sc = $(id);
  if (isWide()) {
    const h = sc.clientHeight - 40 - 34 - 16 - 42 - 36 - 14, w = sc.clientWidth - 64 - 360 - 32 - 12;
    const W = Math.floor(Math.max(300, Math.min(w, 900, h / board.ratio())));
    sc.style.setProperty('--bw', (W + 12) + 'px'); board.size(W); return;
  }
  board.size(Math.floor(Math.min(sc.clientWidth - 16 - 12, 588)));
}
function renderSideMoves() {
  const el = $('gMoves'); if (!isWide()) return;
  const p = new E.Position(); p.startpos();
  let h = `<h5>${T('moveList')}</h5>`;
  for (let j = 0; j < G.moves.length; j++) {
    if (j % 2 == 0) h += `<span class="no">${j / 2 + 1}.</span>`;
    const t = notation(p, G.moves[j]); p.makeMove(G.moves[j]);
    h += `<span class="mv ${j % 2 ? '' : 'r'} ${j == G.moves.length - 1 ? 'cur' : ''}">${t}</span>`;
  }
  if (!G.moves.length) h += `<span class="empty">${T('noMoves')}</span>`;
  el.innerHTML = h; el.scrollTop = el.scrollHeight;
}
function exClose() {
  if (!G.ex) return;
  clearTimeout(G.ex.timer); G.ex = null;
  $('game').classList.remove('exploring'); $('mainTools').hidden = false; $('exTools').hidden = true; $('exPanel').hidden = true; $('ticker').hidden = false;
}
function startGame(o) {
  Eng.cancel(); exClose(); closeSheet(); overlay(null);
  const pvp = o.mode == 'pvp';
  Object.assign(G, { mode: pvp ? 'pvp' : 'ai', moves: (o.moves || []).slice(), level: o.level != null ? o.level : DB.settings.level, side: pvp ? 0 : (o.side || 0),
    over: false, rec: null, thinking: false, sel: -1, hint: 0, token: G.token + 1,
    base: o.resume ? o.base || 0 : (o.moves || []).length, hints: o.resume ? o.hints || 0 : 0, undos: o.resume ? o.undos || 0 : 0,
    id: o.resume ? o.id : Date.now(), t: o.resume ? o.t : Date.now(), engine: pvp ? null : (o.resume && o.engine ? o.engine : DB.settings.engine) });
  if (!pvp && G.engine != DB.settings.engine) { DB.settings.engine = G.engine; if (G.engine == 'pf') PF.load(); }
  G.pos.fromMoves(G.moves);
  setPlates();
  show('game');
  gb.clear();
  gb.setFlip(bottomSide() == 1);
  $('gBoard').classList.toggle('facing', pvp && !!DB.settings.facing);
  requestAnimationFrame(() => { sizeGame(); renderGame(false); });
  saveCurrent(); setTicker(-1);
  AU.start();
  if (!pvp) {
    setTimeout(() => say(G.pos.sd == G.side ? T(G.moves.length ? 'sayYourTurn' : 'sayYouFirst') : T('sayMeFirst')), 300);
    if (G.engine == 'pf' && !PF.ready()) toast(T(PF.state == 'loading' ? 'pfStandIn' : 'pfNotReady'), 2600);
    if (G.pos.sd != G.side && !G.pos.isMate()) setTimeout(aiTurn, 500);
  }
}
function saveCurrent() {
  if (isNet()) return;
  DB.current = G.over ? null : { mode: G.mode, moves: G.moves, level: G.level, side: G.side, base: G.base, hints: G.hints, undos: G.undos, id: G.id, t: G.t, engine: G.engine };
  save();
}
// the two name plates
function setPlates() {
  const op = $('opAva'), me = $('meAva');
  op.className = 'avatar'; me.className = 'avatar';
  if (isPvp()) {
    op.firstElementChild.innerHTML = mascot(1); $('opName').textContent = SIDE(1); $('opSub').innerHTML = T('second');
    me.firstElementChild.innerHTML = mascot(0); $('meName').textContent = SIDE(0); $('meSub').innerHTML = T('first');
  } else if (isNet()) {
    const r = S.room, o = r.p[1 - S.me] || {}, m = r.p[S.me] || {};
    op.firstElementChild.innerHTML = avSvg(o.av); $('opName').textContent = o.name || '…';
    $('opSub').innerHTML = sideDot(1 - G.side) + SIDE(1 - G.side) + (o.on === false ? ' · ' + T(o.gone ? 'hasLeft' : 'offline') : '');
    op.classList.toggle('off', o.on === false);
    me.firstElementChild.innerHTML = avSvg(m.av); $('meName').textContent = m.name || myName; $('meSub').innerHTML = sideDot(G.side) + SIDE(G.side);
  } else {
    op.firstElementChild.innerHTML = AVA.level(G.level); $('opName').innerHTML = `${esc(lvWho(G.level))}<span class="eng-chip" data-e="opp"></span>`;
    $('opSub').innerHTML = sideDot(1 - G.side) + lvName(G.level) + ' · ' + SIDE(1 - G.side);
    me.firstElementChild.innerHTML = avSvg(myAv); $('meName').textContent = myName || T('you'); $('meSub').innerHTML = sideDot(G.side) + SIDE(G.side) + ' · ' + T(G.side == 0 ? 'first' : 'second');
  }
  updateEngChips();
}
let sayT = 0;
function bubble(mine, text, emo) {
  const b = $(mine ? 'meBubble' : 'opBubble'); b.textContent = text; b.classList.toggle('emo', !!emo); b.classList.add('show');
  clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), emo ? 2600 : 2200 + text.length * 60);
}
// the computer's mascot talks a little
function say(text, mood) {
  if (!isAi() || !text) return;
  bubble(false, text);
  if (mood) { const a = $('opAva'); a.classList.remove('happy', 'sad'); a.offsetWidth; a.classList.add(mood); setTimeout(() => a.classList.remove(mood), 1000); }
}
function legalFrom(pos, sq) { return pos.legalMoves().filter(mv => SRC(mv) == sq); }
function fmtClock(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function renderClocks() {
  const r = S && S.room, on = isNet() && !!(r && r.clk);
  $('opClock').hidden = $('meClock').hidden = !on;
  $('turnTag').hidden = on;
  if (!on) return;
  const left = r.clk.left.slice();
  if (r.clk.run >= 0 && !r.over) left[r.clk.run] = Math.max(0, left[r.clk.run] - (Date.now() - S.clkAt));
  for (const [el, sd] of [[$('meClock'), G.side], [$('opClock'), 1 - G.side]]) {
    el.textContent = fmtClock(left[sd]); el.classList.toggle('run', r.clk.run == sd && !r.over); el.classList.toggle('low', left[sd] < 60000);
  }
}
setInterval(() => { if (!$('game').hidden && isNet()) renderClocks(); }, 500);
function renderInfo(n) {
  const a = isNet() ? T('roomChip', { c: esc(S.code) }) : isPvp() ? T('modePvp') : lvName(G.level);
  $('tbInfo').innerHTML = `<span class="chip">${a}</span><span class="chip">${T('moveN', { n: `<b>${n}</b>` })}</span>`;
}
function renderGame(animate) {
  const p = G.pos;
  gb.setPosition(p.sq, animate);
  const last = G.moves[G.moves.length - 1];
  const m = { sel: G.sel, check: p.inCheck() ? p.kingSq[p.sd] : -1, last: last ? [SRC(last), DST(last)] : null };
  if (G.sel >= 0) m.dots = legalFrom(p, G.sel).map(mv => ({ sq: DST(mv), cap: !!p.sq[DST(mv)] }));
  if (G.hint) m.arrows = [{ mv: G.hint, color: 'green' }];
  gb.marks(m);
  renderInfo(G.moves.length);
  renderSideMoves();
  const tt = $('turnTag'), bot = bottomSide(), net = isNet();
  if (isPvp()) {
    tt.textContent = G.over ? T('gameOver') : T('turnOf', { s: SIDE(p.sd) }); tt.classList.toggle('mine', !G.over);
    $('meAva').classList.toggle('active', !G.over && p.sd == 0); $('opAva').classList.toggle('active', !G.over && p.sd == 1);
  } else {
    const mine = !G.over && p.sd == G.side;
    tt.textContent = G.over ? T('gameOver') : mine ? T('yourTurn') : T(net ? 'oppTurn' : 'thinking'); tt.classList.toggle('mine', mine);
    $('meAva').classList.toggle('active', mine); $('opAva').classList.toggle('active', !G.over && !mine);
  }
  const cnt = {}; for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const pc = p.sq[sqOf(r, c)]; if (pc) cnt[pc] = (cnt[pc] || 0) + 1; }
  const lost = sd => { let h = ''; [12, 11, 13, 9, 10, 14].forEach(t => { const pc = t + (sd ? 8 : 0); for (let i = (cnt[pc] || 0); i < INIT_COUNT[pc]; i++) h += capHTML(pc); }); return h; };
  $('capsMe').innerHTML = lost(1 - bot); $('capsOp').innerHTML = lost(bot);
  $('tHint').hidden = net; $('tDraw').hidden = !net; $('btnChat').hidden = !net;
  $('tUndo').disabled = G.over || (net ? G.moves.length < (p.sd == G.side ? 2 : 1) : G.moves.length <= G.base);
  $('tHint').disabled = !canMove();
  $('tDraw').disabled = G.over || G.moves.length < 2;
  // once the game is over this button brings the result back
  const toRes = G.over && !!G.rec;
  $('tResign').disabled = G.over && !toRes; $('tResign').classList.toggle('hot', toRes); $('tResignTx').textContent = T(toRes ? 'result' : 'resign');
  renderClocks();
}
function setTicker(sd, txt, extra, hot) {
  if (sd < 0 || !txt) { $('ticker').innerHTML = ''; return; }
  const who = isPvp() ? SIDE(sd) : sd == G.side ? T('you') : T('opp');
  $('ticker').innerHTML = `<span class="chip">${who}</span><b class="${sd ? '' : 'r'}">${txt}</b>${extra ? `<span class="chip${hot ? ' hot' : ''}">${extra}</span>` : ''}`;
}
$('gBoard').addEventListener('pointerdown', e => {
  const sq = gb.hit(e.clientX, e.clientY);
  if (G.ex) { if (sq >= 0) exTap(sq); return; }
  if (G.over || sq < 0) return;
  const p = G.pos, mover = p.sd, pc = p.sq[sq];
  if (!canMove()) { if (pc && sideOf(pc) == G.side) toast(T(isNet() ? 'waitOpp' : 'waitAi')); return; }
  if (pc && sideOf(pc) == mover) { G.sel = G.sel == sq ? -1 : sq; AU.select(); renderGame(false); return; }
  if (G.sel < 0) { if (isPvp() && pc) toast(T('turnOf', { s: SIDE(mover) })); return; }
  const mv = MOVE(G.sel, sq);
  if (legalFrom(p, G.sel).indexOf(mv) >= 0) { playMove(mv, true); return; }
  if (p.generate(false).indexOf(mv) >= 0) toast(T('selfCheck'));
  AU.bad(); G.sel = -1; renderGame(false);
});
// a move lands on the game board (mine, the computer's, or one that came over the network)
function playMove(mv, byHuman) {
  const p = G.pos, sd = p.sd, cap = p.sq[DST(mv)], txt = notation(p, mv), n = G.moves.length;
  G.moves.push(mv); G.sel = -1; G.hint = 0;
  p.fromMoves(G.moves);
  renderGame(true);
  setTimeout(() => cap ? AU.capture() : AU.place(), 200);
  const chk = p.inCheck(), end = checkEnd(p);
  setTicker(sd, txt, chk ? T('chkChip') : cap ? T('capChip', { p: pcName(cap) }) : '', chk);
  if (cap && isAi()) { if (byHuman) say(pick(T('sayLost')), 'sad'); else say(pick(T('sayTook')), 'happy'); }
  if (end && end.reason == 'mate') setTimeout(() => { AU.check(); bigFx(T('fxMate')); }, 260);
  else if (chk && !end) setTimeout(() => { AU.check(); AU.say(T('vCheck')); bigFx(T('fxCheck')); if (!byHuman) say(T('sayCheck'), 'happy'); }, 260);
  if (isNet()) { if (byHuman) S.move(mv2uci(mv), n); return; }
  saveCurrent();
  // lock the board right away; the result follows after the last move has landed
  if (end) { G.over = true; G.thinking = false; renderGame(false); setTimeout(() => finish(end), 650); return; }
  if (byHuman && isAi()) aiTurn();
}
function checkEnd(p) {
  if (p.isMate()) return { winner: 1 - p.sd, reason: p.inCheck() ? 'mate' : 'stale' };
  const rep = p.repStatus(2);
  if (rep) {
    if ((rep & 2) && !(rep & 4)) return { winner: 1 - p.sd, reason: 'perp' };
    if ((rep & 4) && !(rep & 2)) return { winner: p.sd, reason: 'perp' };
    return { winner: -1, reason: 'rep' };
  }
  let n = 0; for (let i = p.pcList.length - 1; i > 0 && p.pcList[i] == 0 && p.mvList[i]; i--) n++;
  if (n >= 120) return { winner: -1, reason: 'sixty' };
  if (p.noAttackers()) return { winner: -1, reason: 'nomat' };
  return null;
}
const endTxt = end => (end.winner == -1 ? T('resDraw') : T('sideWon', { s: SIDE(end.winner) })) + ' · ' + reasonTxt(end.reason);
function aiTurn() {
  if (G.over || !isAi()) return;
  const tok = ++G.token, t0 = Date.now();
  G.thinking = true; $('opAva').classList.add('think'); renderGame(false);
  const lv = G.level;
  const bubbleT = setTimeout(() => { if (G.token == tok && G.thinking) say(T(lv >= 4 ? 'sayThinkLong' : 'sayThink')); }, 900);
  Eng.ai(G.moves.slice(), lv).then(r => {
    if (tok != G.token || G.over) return;
    const minWait = lv <= 1 ? 650 : lv <= 3 ? 500 : 250;
    setTimeout(() => {
      if (tok != G.token) return;
      clearTimeout(bubbleT); G.thinking = false; $('opAva').classList.remove('think');
      if (!r || !r.mv) { renderGame(false); return; }
      playMove(r.mv, false);
    }, Math.max(0, minWait - (Date.now() - t0)));
  });
}
function addHistory(rec) { DB.history = DB.history.filter(h => h.id != rec.id); DB.history.unshift(rec); DB.history = DB.history.slice(0, 40); }
function finish(end) {
  G.over = true; G.thinking = false; Eng.cancel(); G.token++; exClose();
  $('opAva').classList.remove('think');
  let result;
  if (isPvp()) result = end.winner == -1 ? 'draw' : 'done';
  else {
    result = end.winner == -1 ? 'draw' : end.winner == G.side ? 'win' : 'loss';
    const k = statKey(G.level, G.engine), st = DB.stats[k] || { w: 0, d: 0, l: 0 }; st[result == 'win' ? 'w' : result == 'loss' ? 'l' : 'd']++; DB.stats[k] = st;
  }
  const rec = { id: G.id, t: Date.now(), mode: G.mode, level: G.level, side: G.side, moves: G.moves.slice(), base: G.base, result, winner: end.winner, reason: end.reason, hints: G.hints, undos: G.undos, engine: G.engine };
  addHistory(rec); G.rec = rec;
  DB.current = null; save();
  renderGame(false);
  endSounds(rec);
  setTimeout(() => showResult(rec), 700);
}
function endSounds(rec) {
  const mate = rec.reason == 'mate';
  if (rec.mode == 'pvp') { AU.win(); AU.say(rec.winner == -1 ? T('resDraw') : T('sideWon', { s: SIDE(rec.winner) })); }
  else if (rec.result == 'win') { AU.win(); AU.say(T(mate ? 'vWinMate' : 'vWin')); say(T('sayYouWon'), 'sad'); }
  else if (rec.result == 'loss') { AU.lose(); if (mate) AU.say(T('vMate')); say(T('sayIWon'), 'happy'); }
  else { AU.start(); AU.say(T('resDraw')); say(T('sayDraw')); }
}
const IN_WX = /MicroMessenger/i.test(navigator.userAgent);
let resMoodT = 0;
function showResult(rec) {
  const net = rec.mode == 'net', pvp = rec.mode == 'pvp', n = T('nRounds', { n: rounds(rec.moves.length) });
  let word, cls, line, extra = '';
  if (pvp) {
    word = rec.winner == -1 ? T('stDraw') : T(rec.winner == 0 ? 'stRed' : 'stBlack'); cls = rec.winner == -1 ? 'draw' : rec.winner == 0 ? 'win' : 'loss';
    line = `${winTxt(rec.winner)} · ${reasonTxt(rec.reason)} · ${n}`;
  } else {
    word = T(rec.result == 'win' ? 'stWin' : rec.result == 'loss' ? 'stLoss' : 'stDraw'); cls = rec.result;
    const who = net ? esc(rec.opp && rec.opp.name || '') : `${esc(lvWho(rec.level))} (${lvName(rec.level)})`;
    line = `${T('vsWho', { n: who })} · ${reasonTxt(rec.reason)} · ${n}`;
    if (!net) { const st = statOf(rec.level, rec.engine); extra = `<div class="res-rec">${T('resRec', { w: st.w, d: st.d, l: st.l })}</div>`; }
  }
  // the face next to the stamp: the computer sulks when it loses; a friend's avatar just sits there
  const mood = pvp ? 'happy' : net ? '' : rec.result == 'win' ? 'sad' : rec.result == 'loss' ? 'happy' : '';
  const face = pvp ? mascot(rec.winner == 1 ? 1 : 0) : net ? avSvg(rec.opp && rec.opp.av) : AVA.level(rec.level);
  const sh = sheet(`<div class="result"><div class="res-head"><div class="stamp ${cls}">${word}</div><div class="avatar ${mood}" id="resAva"><span>${face}</span></div></div>
    <div class="res-line">${line}</div>${extra}<div id="resNet"></div></div>
    <div id="resFoot"></div>`, { id: 'result', lock: true });
  clearInterval(resMoodT);
  if (mood) resMoodT = setInterval(() => { const ra = $('resAva'); if (!ra) { clearInterval(resMoodT); return; } ra.classList.remove(mood); ra.offsetWidth; ra.classList.add(mood); }, 2200);
  resultFoot(rec);
}
function resultFoot(rec) {
  const f = $('resFoot'); if (!f || sheetOn != 'result') return;
  const net = rec.mode == 'net' && S;
  let h = '';
  if (net) {
    const r = S.room, me = S.me, o = r.p[1 - me], sc = r.score;
    $('resNet').innerHTML = `<div class="res-score"><span>${sc[me]}<small>${T('you')}</small></span><span>:</span><span>${sc[1 - me]}<small>${esc(o && o.name || '')}</small></span>${sc[2] ? `<span>${sc[2]}<small>${T('recD')}</small></span>` : ''}</div>
      <div class="res-wait">${!o || o.gone ? T('oppLeft') : o.on === false ? T('oppOffline') : r.ready[me] ? T('waitRematch') : r.ready[1 - me] ? T('oppWantsMore', { n: esc(o.name) }) : ''}</div>`;
    const gone = !o || o.gone, can = gone ? S.isHost && !S.dead : !!r.over && r.gid == rec.id && !r.ready[me] && !S.dead;
    h += `<div class="btns"><button class="btn gold" id="resAgain" ${can ? '' : 'disabled'}>${T(gone && S.isHost ? 'backRoom' : 'rematch')}</button></div>
      <div class="btns" style="margin-top:8px"><button class="btn glass" id="resRv">${T('review')}</button><button class="btn glass" id="resPeek">${T('peek')}</button><button class="btn glass" id="resHome">${T('leaveRoom')}</button></div>`;
  } else {
    h += `<div class="btns"><button class="btn gold" id="resRv">${T('review')}</button></div>
      <div class="btns" style="margin-top:8px"><button class="btn glass" id="resAgain">${T('again')}</button><button class="btn glass" id="resPeek">${T('peek')}</button><button class="btn glass" id="resHome">${T('backLobby')}</button></div>`;
  }
  if (IN_WX) h += `<button class="mini-btn alt" id="resCode" style="width:100%">${T('wxBackup')}</button>`;
  f.innerHTML = h;
  $('resRv').onclick = () => { closeSheet(); openReview(rec); };
  $('resPeek').onclick = () => closeSheet();
  $('resAgain').onclick = () => { AU.select(); if (net) { const o = S.room.p[1 - S.me]; if ((!o || o.gone) && S.reopen) S.reopen(); else S.ready(); } else { closeSheet(); startGame({ mode: rec.mode, level: rec.level, side: rec.side, moves: [] }); } };
  $('resHome').onclick = () => { if (net) leaveRoom(true); else { closeSheet(); goHome(); } };
  const cb = $('resCode'); if (cb) cb.onclick = () => openCode();
}
function goHome() {
  exClose(); Eng.cancel(); G.token++; R.token++; X.token++; G.thinking = false; $('opAva').classList.remove('think');
  closeSheet(); renderHome(); show('lobby');
}
$('tUndo').onclick = () => {
  if (G.over) return;
  if (isNet()) { S.ask('undo'); return; }
  if (G.moves.length <= G.base) return;
  if (G.thinking) { Eng.cancel(); G.token++; G.thinking = false; $('opAva').classList.remove('think'); }
  if (isPvp()) G.moves.pop();
  else while (G.moves.length > G.base) { const mover = (G.moves.length - 1) % 2; G.moves.pop(); if (mover == G.side) break; }
  G.pos.fromMoves(G.moves); G.sel = -1; G.hint = 0; G.undos++;
  renderGame(true); AU.place(); setTicker(-1); saveCurrent();
  say(T('sayUndo'), 'happy');
  if (isAi() && G.pos.sd != G.side) aiTurn();
};
$('tDraw').onclick = () => { if (!G.over && isNet()) confirmBox(T('drawQ'), '', T('offerDraw'), () => S.ask('draw'), 'gold'); };
$('tResign').onclick = () => {
  if (G.over) { if (G.rec) showResult(G.rec); return; }
  if (isNet()) confirmBox(T('resignQ'), '', T('resign'), () => S.resign());
  else if (isPvp()) { const sd = G.pos.sd; confirmBox(T('resignSideQ', { s: SIDE(sd) }), '', T('resign'), () => finish({ winner: 1 - sd, reason: 'resign' })); }
  else confirmBox(T('resignQ'), T('resignSub'), T('resign'), () => finish({ winner: 1 - G.side, reason: 'resign' }));
};

// ---- trying moves out on the same board: both sides are yours to move, the real game comes back on exit ----
$('tExplore').onclick = () => {
  if (G.thinking) { Eng.cancel(); G.token++; G.thinking = false; $('opAva').classList.remove('think'); }
  G.sel = -1; G.hint = 0;
  G.ex = { moves: G.moves.slice(), cur: G.moves.length, base: G.moves.length, sel: -1, timer: 0, pos: new E.Position() };
  $('game').classList.add('exploring');
  $('mainTools').hidden = true; $('exTools').hidden = false; $('exPanel').hidden = false; $('ticker').hidden = true;
  say(T('sayExplore'));
  AU.select();
  requestAnimationFrame(() => { sizeGame(); renderEx(false); });
};
function exQuit() {
  if (!G.ex) return;
  exClose(); PF.flush();
  gb.setFlip(bottomSide() == 1);
  AU.select();
  requestAnimationFrame(() => { sizeGame(); renderGame(true); });
  if (!G.over && isAi() && G.pos.sd != G.side && !G.pos.isMate()) setTimeout(aiTurn, 400);
}
function renderEx(animate) {
  const X2 = G.ex, p = X2.pos; p.fromMoves(X2.moves.slice(0, X2.cur));
  gb.setPosition(p.sq, animate);
  const last = X2.cur ? X2.moves[X2.cur - 1] : 0;
  const m = { sel: X2.sel, check: p.inCheck() ? p.kingSq[p.sd] : -1, last: last ? [SRC(last), DST(last)] : null };
  if (X2.sel >= 0) m.dots = legalFrom(p, X2.sel).map(mv => ({ sq: DST(mv), cap: !!p.sq[DST(mv)] }));
  gb.marks(m);
  const end = checkEnd(p), tried = X2.cur - X2.base;
  $('exTurn').textContent = end ? endTxt(end) : T('turnOf', { s: SIDE(p.sd) }) + ' · ' + (tried > 0 ? T('exTried', { n: tried }) : tried < 0 ? T('exBackN', { n: -tried }) : T('exReal'));
  renderInfo(X2.cur);
  $('eBack').disabled = X2.cur == 0; $('eFwd').disabled = X2.cur >= X2.moves.length; $('eReset').disabled = X2.cur == X2.base && X2.moves.length == X2.base;
  const el = $('exChips');
  const items = lineText(X2.moves.slice(0, X2.base), X2.moves.slice(X2.base));
  if (!items.length) { el.innerHTML = `<span class="ex-wait">${T(X2.cur < X2.base ? 'exLooking' : 'exHelp')}</span>`; return; }
  el.innerHTML = items.map((x, i) => `<button class="cchip ${X2.base + i + 1 == X2.cur ? 'on' : ''} ${X2.base + i + 1 > X2.cur ? 'dim' : ''}" data-k="${X2.base + i + 1}"><i>${i + 1}</i><b class="${x.sd ? '' : 'r'}">${x.t}</b></button>`).join('');
  el.querySelectorAll('.cchip').forEach(b => b.onclick = () => { X2.cur = +b.dataset.k; X2.sel = -1; AU.select(); renderEx(true); });
  const on = el.querySelector('.on'); if (on) scrollInto(el, on, true);
}
function exPlay(mv) {
  const X2 = G.ex, cap = X2.pos.sq[DST(mv)];
  X2.moves = X2.moves.slice(0, X2.cur).concat(mv); X2.cur++; X2.sel = -1;
  setTimeout(() => cap ? AU.capture() : AU.place(), 180);
  renderEx(true);
  if (X2.pos.inCheck() && !checkEnd(X2.pos)) setTimeout(() => AU.check(), 250);
}
function exTap(sq) {
  const X2 = G.ex, p = X2.pos; if (p.isMate()) return;
  const pc = p.sq[sq];
  if (pc && sideOf(pc) == p.sd) { X2.sel = X2.sel == sq ? -1 : sq; AU.select(); renderEx(false); return; }
  if (X2.sel < 0) { if (pc) toast(T('turnOf', { s: SIDE(p.sd) })); return; }
  const mv = MOVE(X2.sel, sq);
  if (legalFrom(p, X2.sel).indexOf(mv) >= 0) { exPlay(mv); return; }
  if (p.generate(false).indexOf(mv) >= 0) toast(T('selfCheck'));
  AU.bad(); X2.sel = -1; renderEx(false);
}
$('eQuit').onclick = exQuit;
$('eBack').onclick = () => { const X2 = G.ex; if (X2 && X2.cur > 0) { X2.cur--; X2.sel = -1; AU.select(); renderEx(true); } };
$('eFwd').onclick = () => { const X2 = G.ex; if (X2 && X2.cur < X2.moves.length) { const cap = X2.pos.sq[DST(X2.moves[X2.cur])]; X2.cur++; X2.sel = -1; setTimeout(() => cap ? AU.capture() : AU.place(), 180); renderEx(true); } };
$('eReset').onclick = () => { const X2 = G.ex; if (!X2) return; X2.moves = G.moves.slice(); X2.base = X2.cur = G.moves.length; X2.sel = -1; AU.select(); renderEx(true); toast(T('exResetDone')); };
$('eFlip').onclick = () => { gb.setFlip(!gb.flip); AU.select(); };

// ---- hints ----
// does mv shuffle back: undo our previous move, or bring back a position already seen with the same side to move
function repeatsPos(moves, mv) {
  const prev = moves[moves.length - 2];
  if (prev && SRC(mv) == DST(prev) && DST(mv) == SRC(prev)) return true;
  const p = new E.Position(); p.startpos(); const seen = new Set();
  if (moves.length % 2) seen.add(p.key + ':' + p.lock);
  moves.forEach((m, i) => { p.makeMove(m); if ((moves.length - i) % 2 == 0) seen.add(p.key + ':' + p.lock); });
  p.makeMove(mv);
  return seen.has(p.key + ':' + p.lock);
}
// the engine's best move; but when that only shuffles back and forth in a position that is not lost, look
// for the best move that keeps the game going and take it if it is about as good
async function hintMove(moves, ms) {
  const r = await Eng.analyze(moves, ms);
  if (!r || !r.mv || r.eng != 'pf' || realMate(r.vl) > 0 || r.vl < -150 || !repeatsPos(moves, r.mv)) return r;
  const p = new E.Position(); p.fromMoves(moves);
  const alts = p.legalMoves().filter(m => !repeatsPos(moves, m));
  if (!alts.length) return r;
  const a = await PF.analyze(moves, Math.round(ms * .6), 1, alts);
  return a && a.mv && alts.indexOf(a.mv) >= 0 && !realMate(-a.vl) && a.vl >= Math.min(r.vl, 0) - 60 ? a : r;
}
$('tHint').onclick = () => {
  if (!canMove() || isNet()) return;
  const tok = G.token, eng = Eng.adv(); toast(T('hintWait', { e: engName(eng) }), 1600);
  $('tHint').disabled = true;
  hintMove(G.moves.slice(), eng == 'pf' ? 2500 : 3000).then(r => {
    if (tok != G.token || G.over || G.ex || !r || !r.mv) { if (!G.ex) renderGame(false); return; }
    G.hint = r.mv; G.hints++; saveCurrent();
    const m = realMate(r.vl);
    toast(T('hintIs', { e: engName(r.eng || eng), m: `<b>${notation(G.pos, r.mv)}</b>` }) + (m > 0 ? ` · <b>${mateTxt(m)}</b>` : ''), m > 0 ? 3600 : 2800); renderGame(false);
    if (m > 0) AU.check();
  });
};

// ---- menu and chat ----
$('btnMenu').onclick = () => showMenu();
function showMenu() {
  const net = isNet(), pvp = isPvp();
  let h = head(T('hMenu'));
  if (net) h += `<div class="list" style="margin-bottom:8px"><div class="item"><span class="grow">${T('roomChip', { c: esc(S.code) })}</span><button class="btn glass xs" id="mInv"><svg class="ic" viewBox="0 0 24 24"><use href="#i-share"/></svg>${T('share')}</button></div></div>`;
  h += `<div class="list" style="margin-bottom:8px">`;
  if (!net) h += `<button class="item" id="mNew"><svg class="ic" viewBox="0 0 24 24"><use href="#i-reset"/></svg><span class="grow">${T('restart')}<small>${T(pvp ? 'restartSubPvp' : 'restartSub')}</small></span></button>`;
  h += `<button class="item" id="mRules"><svg class="ic" viewBox="0 0 24 24"><use href="#i-rule"/></svg><span class="grow">${T('rules')}</span></button>`;
  if (pvp) h += toggleHTML('facing', T('facing'), T('facingSub'), DB.settings.facing);
  h += `</div>${settingsHTML()}<div class="list" style="margin-top:8px">`;
  h += net ? `<button class="item danger" id="mLeave"><svg class="ic" viewBox="0 0 24 24"><use href="#i-door"/></svg><span class="grow">${T('leaveRoom')}<small>${T(S.isHost ? 'leaveSubHost' : 'leaveSub')}</small></span></button>`
    : `<button class="item" id="mLeave"><svg class="ic" viewBox="0 0 24 24"><use href="#i-home"/></svg><span class="grow">${T('backLobby')}<small>${T('backLobbySub')}</small></span></button>`;
  h += `</div>`;
  const sh = sheet(h, { id: 'menu' });
  bindSettings(sh, showMenu);
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('mInv', () => invite(S.code, true));
  on('mRules', () => showRules());
  on('mNew', () => { const go = () => { closeSheet(); startGame({ mode: G.mode, level: G.level, side: G.side, moves: [] }); };
    if (!G.over && G.moves.length > 2) confirmBox(T('restart'), T(pvp ? 'restartQPvp' : 'restartQ'), T('restart'), go); else go(); });
  on('mLeave', () => { if (net) leaveRoom(); else goHome(); });
}
const EMOS = ['😂', '😭', '😡', '😎', '🤔', '👍', '🙏', '👏', '🔥', '😱', '🤡', '🥳'];
$('btnChat').onclick = () => {
  if (!isNet()) return;
  let h = head(T('hChat'));
  h += `<div class="emos">${EMOS.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>`;
  h += `<div class="phr">${T('phrases').map(p => `<button data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>`;
  h += `<div class="code-row chatrow"><input class="inp" id="chatIn" maxlength="40" placeholder="${esc(T('chatPh'))}" autocomplete="off"><button class="btn gold" id="chatGo">${T('send')}</button></div>`;
  const sh = sheet(h, { id: 'chat' });
  sh.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { S.chat({ emo: b.dataset.e }); closeSheet(); });
  sh.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { S.chat({ text: b.dataset.p }); closeSheet(); });
  const go = () => { const t = $('chatIn').value.trim(); if (t) { S.chat({ text: t }); closeSheet(); } };
  $('chatGo').onclick = go;
  $('chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
};
