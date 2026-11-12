// ===== explore: a free board with the engine's candidate moves, opened from a review position =====
const xb = Board($('xBoard'));
const X = { moves: [], cur: 0, sel: -1, flip: false, token: 0, live: true, cands: null, pos: new E.Position(), thinking: false, timer: 0, from: 'lobby' };
function sizeExplore() { sizeSplit('explore', xb); }
function openExplore(moves, cur, flip, from) {
  Eng.cancel(); G.token++; R.token++;
  X.from = from || 'lobby';
  $('xBackTx').textContent = T(X.from == 'review' ? 'backReview' : 'back');
  $('xPlay').hidden = !!S;
  X.moves = moves.slice(); X.cur = Math.min(cur != null ? cur : moves.length, moves.length); X.sel = -1; X.cands = null;
  if (flip != null) X.flip = !!flip;
  show('explore'); $('explore').scrollTop = 0;
  xb.clear(); xb.setFlip(X.flip);
  requestAnimationFrame(() => { sizeExplore(); renderExplore(false); });
}
function xBase() { return X.moves.slice(0, X.cur); }
function renderExplore(animate, keepCands) {
  const p = X.pos; p.fromMoves(xBase());
  xb.setPosition(p.sq, animate);
  const last = X.cur ? X.moves[X.cur - 1] : 0;
  const m = { sel: X.sel, check: p.inCheck() ? p.kingSq[p.sd] : -1, last: last ? [SRC(last), DST(last)] : null };
  if (X.sel >= 0) m.dots = legalFrom(p, X.sel).map(mv => ({ sq: DST(mv), cap: !!p.sq[DST(mv)] }));
  if (X.live && X.cands && X.cands.lines.length) m.arrows = X.cands.lines.slice(0, 3).map((l, i) => ({ mv: l.mv, color: i == 0 ? 'green' : 'blue', op: i == 0 ? .9 : .55, thin: i > 0, dash: i > 0 })).reverse();
  xb.marks(m);
  const end = checkEnd(p);
  $('xTurn').textContent = end ? endTxt(end) : T('turnOf', { s: SIDE(p.sd) }) + ' · ' + T('moveN', { n: X.cur });
  $('xTitle').innerHTML = `${T('explore')}<span class="eng-chip"></span>`; updateEngChips();
  $('xPrev').disabled = X.cur == 0; $('xFirst').disabled = X.cur == 0; $('xNext').disabled = X.cur >= X.moves.length;
  $('xAi').disabled = !!end || X.thinking;
  $('xLive').querySelector('.sw').classList.toggle('on', X.live);
  renderXMoves();
  if (!keepCands) { X.cands = null; renderCands(); scheduleAnalysis(); }
  else renderCands();
}
function renderXMoves() {
  const el = $('xMoves'), p = new E.Position(); p.startpos();
  let h = '';
  for (let j = 0; j < X.moves.length; j++) {
    if (j % 2 == 0) h += `<span class="no">${j / 2 + 1}.</span>`;
    const t = notation(p, X.moves[j]); p.makeMove(X.moves[j]);
    h += `<button class="${j % 2 ? '' : 'r'} ${X.cur == j + 1 ? 'cur' : ''}" data-k="${j + 1}" style="${j >= X.cur ? 'opacity:.45' : ''}"><span>${t}</span></button>`;
  }
  if (X.moves.length % 2 == 1) h += '<span></span>';
  el.innerHTML = h || `<p class="note" style="grid-column:1/4">${T('xEmpty')}</p>`;
  $('xMovesH').textContent = T(X.moves.length > X.cur ? 'xMovesRedo' : 'tabMoves');
  el.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => { X.cur = +b.dataset.k; X.sel = -1; AU.select(); renderExplore(true); });
  const cur = el.querySelector('.cur'); if (cur) scrollInto(isWide() ? el.parentElement : el, cur);
}
function renderCands() {
  const el = $('xCands'), p = X.pos;
  if (!X.live) { el.innerHTML = `<p class="note">${T('liveOff')}</p>`; setEval('x', null); return; }
  if (checkEnd(p)) { el.innerHTML = ''; setEval('x', p.isMate() ? (p.sd == 0 ? 0 : 1) : 0.5); return; }
  if (!X.cands) { el.innerHTML = `<p class="note">${T('engThinking', { e: engName(Eng.adv()) })}</p>`; return; }
  const sd = p.sd, base = xBase();
  const rw = e => sd == 0 ? entW(e) : 1 - entW(e), top = X.cands.lines[0] || X.cands;
  setEval('x', rw(top), sd == 0 ? top.vl : -top.vl);
  const upd = () => { if (!$('explore').hidden && X.cands) renderCands(); };
  el.innerHTML = `<div class="ana-top" style="margin-bottom:2px"><span class="note dim">${T('candHead', { n: LINE_MOVES })}</span>${pvModeHtml(SIDE(sd))}</div>` + X.cands.lines.slice(0, 3).map((l, i) => {
    const e = lineEntry('x' + base.join(',') + ':' + l.mv, base, l.pv, upd);
    const first = lineText(base, [l.mv])[0], rs = sd == 0 ? l.vl : -l.vl, m = realMate(l.vl);
    return `<div class="cand" data-i="${i}" role="button" tabindex="0"><span class="rk">${i + 1}</span><span class="mv ${sd ? 'blk-t' : 'red-t'}">${first ? first.t : '—'} ${mateTag(m)}</span>
      <span class="sc">${m ? `<b style="color:#ff9c8f">${fmtScore(rs)}</b>` : `<b>${fmtScore(rs)}</b><br>${T('redRate')} ${pctTxt(rw(l))}`}</span>
      <span class="line">${lineHtml(e, { skipFirst: true })}</span></div>`;
  }).join('') + (Eng.adv() == 'muyi' ? `<p class="note dim">${T(PF.state == 'loading' ? 'candPfLoading' : 'candPfOff')}</p>` : '');
  bindLines(el, (e, k) => { const add = e.line.slice(0, k); X.moves = e.base.concat(add); X.cur = X.moves.length; X.sel = -1; AU.place(); renderExplore(true); });
  el.querySelectorAll('.cand').forEach(b => b.onclick = () => { const l = X.cands.lines[+b.dataset.i]; if (l && l.mv) xPlay(l.mv); });
}
function scheduleAnalysis() {
  clearTimeout(X.timer);
  if (!X.live) return;
  const p = X.pos; if (checkEnd(p)) return;
  const tok = ++X.token, base = xBase();
  X.timer = setTimeout(() => {
    PF.flush();
    Eng.analyze(base, Eng.adv() == 'pf' ? 900 : 1200, 3).then(r => {
      if (tok != X.token || !r || $('explore').hidden) return;
      X.cands = r; renderExplore(false, true);
    });
  }, 220);
}
function xPlay(mv) {
  const p = X.pos, cap = p.sq[DST(mv)];
  X.moves = xBase().concat(mv); X.cur++; X.sel = -1;
  setTimeout(() => cap ? AU.capture() : AU.place(), 180);
  renderExplore(true);
  if (X.pos.inCheck() && !checkEnd(X.pos)) setTimeout(() => AU.check(), 250);
}
$('xBoard').addEventListener('pointerdown', e => {
  const sq = xb.hit(e.clientX, e.clientY); if (sq < 0) return;
  const p = X.pos; if (p.isMate()) return;
  const pc = p.sq[sq];
  if (pc && sideOf(pc) == p.sd) { X.sel = X.sel == sq ? -1 : sq; AU.select(); renderExplore(false, true); return; }
  if (X.sel < 0) { if (pc) toast(T('turnOf', { s: SIDE(p.sd) })); return; }
  const mv = MOVE(X.sel, sq);
  if (legalFrom(p, X.sel).indexOf(mv) >= 0) { xPlay(mv); return; }
  if (p.generate(false).indexOf(mv) >= 0) toast(T('selfCheck'));
  AU.bad(); X.sel = -1; renderExplore(false, true);
});
$('xPrev').onclick = () => { if (X.cur > 0) { X.cur--; X.sel = -1; AU.select(); renderExplore(true); } };
$('xNext').onclick = () => { if (X.cur < X.moves.length) { const p = X.pos, cap = p.sq[DST(X.moves[X.cur])]; X.cur++; X.sel = -1; setTimeout(() => cap ? AU.capture() : AU.place(), 180); renderExplore(true); } };
$('xFirst').onclick = () => { if (X.cur) { X.cur = 0; X.sel = -1; AU.select(); renderExplore(true); } };
$('xFlip').onclick = () => { X.flip = !X.flip; xb.setFlip(X.flip); AU.select(); };
$('xLive').onclick = () => { X.live = !X.live; X.token++; renderExplore(false, !X.live); };
$('xAi').onclick = () => {
  if (X.thinking) return;
  const p = X.pos; if (checkEnd(p)) return;
  const tok = ++X.token, base = xBase(); X.thinking = true; $('xAi').disabled = true;
  toast(T('engThinking', { e: engName(Eng.adv()) }), 1200);
  PF.flush();
  Eng.analyze(base, 1500, 1).then(r => {
    X.thinking = false;
    if (tok != X.token || !r || !r.mv || $('explore').hidden) { if (!$('explore').hidden) renderExplore(false, true); return; }
    xPlay(r.mv);
  });
};
$('xBack').onclick = () => {
  X.token++; clearTimeout(X.timer); PF.flush(); X.thinking = false;
  if (X.from == 'review' && R.rec) {
    show('review'); requestAnimationFrame(() => { sizeReview(); renderReview(false); });
    if (R.ana.filter(Boolean).length < R.moves.length + 1) runAnalysis(anaMs());
  } else if (S) resumeSession(); else goHome();
};
$('xPlay').onclick = () => {
  const base = xBase(), p = new E.Position(); p.fromMoves(base);
  if (checkEnd(p)) { toast(T('posOver')); return; }
  const lv = DB.settings.level;
  const sh = sheet(head(T('hPlayOn')) + `<p class="note">${T('turnOf', { s: SIDE(p.sd) })}</p><div class="list" style="margin-top:12px">
    <button class="item" data-x="me"><div class="avatar"><span>${AVA.level(lv)}</span></div><span class="grow">${T('playAs', { s: SIDE(p.sd) })}<small>${T('playVs', { l: lvName(lv), e: engName(DB.settings.engine) })}</small></span></button>
    <button class="item" data-x="other"><div class="avatar"><span>${AVA.level(lv)}</span></div><span class="grow">${T('playAs', { s: SIDE(1 - p.sd) })}<small>${T('playAiFirst')}</small></span></button>
    <button class="item" data-x="pvp"><div class="avatar"><span>${mascot(0)}</span></div><span class="grow">${T('modePvp')}</span></button></div>`, { id: 'playon' });
  const go = o => { closeSheet(); X.token++; clearTimeout(X.timer); startGame(Object.assign({ moves: base }, o)); };
  sh.querySelector('[data-x="me"]').onclick = () => go({ mode: 'ai', level: lv, side: p.sd });
  sh.querySelector('[data-x="other"]').onclick = () => go({ mode: 'ai', level: lv, side: 1 - p.sd });
  sh.querySelector('[data-x="pvp"]').onclick = () => go({ mode: 'pvp' });
};
