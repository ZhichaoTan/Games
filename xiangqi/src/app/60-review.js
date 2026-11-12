// ===== review: every position analysed, a win-rate curve, graded moves, best lines to step through =====
const rb = Board($('rBoard'));
const R = { rec: null, moves: [], ply: 0, ana: [], token: 0, tab: 'chart', preview: null, playT: 0, deep: false, eng: 'muyi', verifying: false };
function sizeReview() { sizeSplit('review', rb); }
const anaMs = () => R.deep ? 1100 : (Eng.adv() == 'pf' ? 400 : 300);
function paintReviewHead() {
  const rec = R.rec; if (!rec) return;
  $('rvTitle').innerHTML = recTitle(rec) + (rec.mode == 'pvp' ? '' : ' · ' + resTxt(rec.result)) + '<span class="eng-chip"></span>';
  $('rvRetry').hidden = !!S;
  updateEngChips();
}
function openReview(rec) {
  Eng.cancel(); G.token++; LX.gen++; LX.cache = {};
  R.rec = rec; R.moves = rec.moves; R.ply = rec.moves.length; R.preview = null;
  const eng = Eng.adv();
  // stored analysis is reused only if it was made by the engine in use now
  R.ana = rec.analysis && (rec.anaEngine || 'muyi') == eng ? rec.analysis.slice() : [];
  R.deep = R.ana.length ? !!rec.deep : false;
  stopPlay(); closeSheet();
  paintReviewHead();
  show('review'); $('review').scrollTop = 0;
  rb.clear();
  rb.setFlip(rec.mode != 'pvp' && rec.side == 1);
  requestAnimationFrame(() => { sizeReview(); renderReview(false); });
  renderPfCta();
  runAnalysis(anaMs());
}
function runAnalysis(ms) {
  const tok = ++R.token, n = R.moves.length, eng = Eng.adv(); R.verifying = false; R.eng = eng;
  updateProgress();
  (async () => {
    for (let i = 0; i <= n; i++) {
      if (R.ana[i]) continue;
      const r = await Eng.analyze(R.moves.slice(0, i), ms);
      if (tok != R.token) return;
      if (!r) { i--; await sleep(300); if (tok != R.token) return; continue; }
      R.ana[i] = { vl: r.vl, w: r.w, mv: r.mv || 0, pv: (r.pv || []).slice(0, LINE_PLIES), d: r.depth || 0 };
      updateProgress();
      if (!R.preview && (i == R.ply || i == R.ply - 1)) renderReview(false); else if (i % 4 == 0) refreshPanels();
    }
    // second pass: a short search can misjudge a move, so every suspected mistake (and every missed mate)
    // is checked again with a longer search before it is shown as one
    R.verifying = true; updateProgress();
    const vms = Math.max(ms * 3, eng == 'pf' ? 1500 : 1800), M0 = metrics(), redo = new Set();
    M0.forEach((m, j) => { if (m && !m.best && (m.cls == 'err' || m.cls == 'blun' || m.drop >= 6)) { redo.add(j); redo.add(j + 1); } });
    for (const i of [...redo].sort((x, y) => x - y)) {
      if (R.ana[i] && R.ana[i].v) continue;
      const r = await Eng.analyze(R.moves.slice(0, i), vms);
      if (tok != R.token) return;
      if (!r) continue;
      R.ana[i] = { vl: r.vl, w: r.w, mv: r.mv || 0, pv: (r.pv || []).slice(0, LINE_PLIES), d: r.depth || 0, v: 1 };
      refreshPanels();
    }
    R.verifying = false;
    R.rec.analysis = R.ana.slice(); R.rec.anaEngine = eng; R.rec.deep = R.deep; save();
    updateProgress(); if (!R.preview) renderReview(false); else refreshPanels();
  })();
}
function updateProgress() {
  const n = R.moves.length + 1, done = R.ana.filter(Boolean).length, e = engName(R.eng);
  $('progBar').style.width = (done / n * 100) + '%';
  $('progTxt').textContent = done < n ? T('anaProg', { e, a: done, b: n }) : R.verifying ? T('anaVerify', { e }) : T('anaDone', { e, m: T(R.deep ? 'modeDeep' : 'modeFast') });
  $('deepBtn').hidden = R.deep;
}
function restartAnalysis(deep) {
  R.deep = deep; R.ana = []; LX.gen++; LX.cache = {}; exitPreview(true); Eng.cancel(); refreshPanels(); runAnalysis(anaMs());
}
$('deepBtn').onclick = () => { restartAnalysis(true); toast(T('deepOn'), 2200); };
// the built-in engine reads a game roughly; offer Pikafish (a one-time download) for a sharper review
function renderPfCta() {
  const el = $('pfCta'), on = Eng.adv() != 'pf';
  el.hidden = !on; if (!on) return;
  if (PF.state == 'loading') el.innerHTML = `<span class="grow">${T(PF.cached ? 'pfStarting' : 'pfLoading')} ${Math.round(PF.progress * 100)}%</span>`;
  else if (PF.state == 'error') el.innerHTML = `<span class="grow">${T('pfFailed')}${esc(PF.err)}</span><button class="btn jade xs" id="pfGo">${T('retryLoad')}</button>`;
  else el.innerHTML = `<span class="grow">${T('pfCta')}</span><button class="btn jade xs" id="pfGo">${T('pfEnable')}</button>`;
  const b = $('pfGo'); if (b) b.onclick = () => { DB.settings.advPf = true; save(); if (PF.state == 'error') PF.set('off'); PF.load(); renderPfCta(); };
}
PF.subs.push(() => {
  if ($('review').hidden) return;
  renderPfCta();
  if (PF.ready() && Eng.adv() == 'pf' && R.eng != 'pf') { restartAnalysis(false); updateEngChips(); toast(T('pfNowOn'), 2400); }
});
function metrics() {
  const n = R.moves.length, out = [];
  for (let j = 0; j < n; j++) {
    const a = R.ana[j], b = R.ana[j + 1];
    if (!a || !b) { out.push(null); continue; }
    const before = entW(a), after = 1 - entW(b);
    const best = a.mv == R.moves[j];
    let drop = best ? 0 : Math.max(0, (before - after) * 100);
    const mB = realMate(a.vl), mA = -realMate(b.vl);
    if (!best && mB > 0 && mA <= 0) drop = Math.max(drop, 15);   // let a forced mate slip
    if (!best && mB > 0 && mA > mB + 1) drop = Math.max(drop, 5); // the mate is still there but slower
    const cls = best ? 'best' : drop < 3 ? 'good' : drop < 8 ? 'slow' : drop < 18 ? 'err' : 'blun';
    const acc = Math.max(0, Math.min(100, 103.17 * Math.exp(-0.04354 * drop) - 3.17));
    out.push({ before, after, drop, cls, acc, best });
  }
  return out;
}
const redWin = i => R.ana[i] ? (i % 2 == 0 ? entW(R.ana[i]) : 1 - entW(R.ana[i])) : null;
const redScore = i => R.ana[i] ? (i % 2 == 0 ? R.ana[i].vl : -R.ana[i].vl) : null;
function setEval(prefix, w, rs) {
  const id = k => $(prefix ? prefix + 'Ev' + k : 'ev' + k), r = T('redS'), b = T('blackS');
  if (w == null) { id('R').textContent = r + ' —'; id('B').textContent = '— ' + b; id('Fill').style.width = '50%'; return; }
  id('Fill').style.width = (w * 100) + '%';
  const m = rs != null ? realMate(rs) : 0;
  if (m > 0) { id('R').textContent = r + ' ' + T('evMate', { n: m }); id('B').textContent = b; return; }
  if (m < 0) { id('R').textContent = r; id('B').textContent = T('evMate', { n: -m }) + ' ' + b; return; }
  id('R').textContent = r + ' ' + pctTxt(w); id('B').textContent = pctTxt(1 - w) + ' ' + b;
}
function renderReview(animate = true) {
  const p = new E.Position(); let base = R.moves.slice(0, R.ply);
  if (R.preview) base = R.moves.slice(0, R.preview.base).concat(R.preview.line.slice(0, R.preview.k));
  p.fromMoves(base);
  rb.setPosition(p.sq, animate);
  const M = metrics();
  const m = { check: p.inCheck() ? p.kingSq[p.sd] : -1 };
  const lastMv = base[base.length - 1];
  if (lastMv) m.last = [SRC(lastMv), DST(lastMv)];
  if (!R.preview && R.ply > 0) {
    const j = R.ply - 1, mt = M[j];
    if (mt) { m.badge = { sq: DST(R.moves[j]), cls: mt.cls }; if (!mt.best && R.ana[j].mv && mt.cls != 'good') m.arrows = [{ mv: R.ana[j].mv, color: 'green', dash: true }]; }
  } else if (R.preview && R.preview.k < R.preview.line.length) {
    const own = R.preview.k % 2 == 0;
    m.arrows = [{ mv: R.preview.line[R.preview.k], color: own ? 'green' : 'orange', dash: true, thin: !own }];
    // at the start of a line from the selected move's position, also show what was actually played
    const pm = R.moves[R.preview.base];
    if (R.preview.k == 0 && R.preview.base == R.ply - 1 && pm && pm != R.preview.line[0]) m.arrows.unshift({ mv: pm, color: 'blue', dash: true, thin: true, op: .75 });
  }
  rb.marks(m);
  if (!R.preview) setEval('', redWin(R.ply), redScore(R.ply));
  let pb = document.querySelector('.preview-bar');
  if (R.preview) {
    if (!pb) { pb = document.createElement('div'); pb.className = 'preview-bar'; $('rBoard').parentElement.appendChild(pb); }
    updPreviewBar(pb);
  } else if (pb) pb.remove();
  $('rPlay').disabled = !!R.preview;
  refreshPanels(M);
}
function refreshPanels(M) {
  M = M || metrics();
  drawChart(M);
  if (R.tab == 'ana') renderAna(M);
  if (R.tab == 'moves') renderMoves(M);
  if (R.tab == 'report') renderReport(M);
}
function previewTo(k) {
  const P = R.preview; k = Math.max(0, Math.min(P.line.length, k));
  if (k == P.k) return;
  const fwd = k == P.k + 1;
  let cap = 0;
  if (fwd) { const p = new E.Position(); p.fromMoves(R.moves.slice(0, P.base).concat(P.line.slice(0, P.k))); cap = p.sq[DST(P.line[P.k])]; }
  P.k = k; renderReview(true);
  if (fwd) setTimeout(() => cap ? AU.capture() : AU.place(), 180); else AU.select();
}
function goPly(k, anim = true) {
  if (R.preview) { previewTo(k - R.ply + R.preview.k); return; }
  k = Math.max(0, Math.min(R.moves.length, k));
  if (k == R.ply) return;
  const fwd = k == R.ply + 1, mv = R.moves[R.ply];
  const cap = fwd ? (() => { const p = new E.Position(); p.fromMoves(R.moves.slice(0, R.ply)); return p.sq[DST(mv)]; })() : 0;
  R.ply = k; renderReview(anim);
  if (fwd) setTimeout(() => cap ? AU.capture() : AU.place(), 180); else AU.select();
}
function updPreviewBar(pb) {
  pb = pb || document.querySelector('.preview-bar'); if (!pb || !R.preview) return;
  const P = R.preview, both = !!DB.settings.pvBoth, len = P.line.length;
  const cur = both ? P.k : Math.ceil(P.k / 2), tot = both ? len : Math.ceil(len / 2);
  pb.innerHTML = `${P.k == 0 ? T('pvStart') : T('pvStep', { a: cur, b: tot })}${P.e.busy ? '…' : ''}${P.mate && P.k >= len ? ' · ' + T('mateEnd') : ''} · ${T('pvHint')}<button id="pvExit">${T('pvExit')}</button>`;
  pb.querySelector('#pvExit').onclick = () => exitPreview();
}
// stepping through a line; in "one side only" mode one step = the reply plus that side's next move
function pvStep(dir) {
  const P = R.preview, len = P.line.length;
  if (DB.settings.pvBoth) return previewTo(P.k + dir);
  if (dir > 0) {
    const t = P.k % 2 == 1 ? P.k + 2 : P.k + 1;
    if (t > len) { if (P.k < len) previewTo(len); return; }
    if (t - P.k == 2) { previewTo(P.k + 1); clearTimeout(P.t2); P.t2 = setTimeout(() => { if (R.preview === P) previewTo(t); }, 430); }
    else previewTo(t);
  } else previewTo(P.k <= 1 ? 0 : P.k % 2 == 1 ? P.k - 2 : P.k - 1);
}
$('rFirst').onclick = () => { stopPlay(); R.preview ? previewTo(0) : goPly(0); };
$('rPrev').onclick = () => { stopPlay(); R.preview ? pvStep(-1) : goPly(R.ply - 1); };
$('rNext').onclick = () => { stopPlay(); R.preview ? pvStep(1) : goPly(R.ply + 1); };
$('rLast').onclick = () => { stopPlay(); if (!R.preview) return goPly(R.moves.length); const len = R.preview.line.length; previewTo(DB.settings.pvBoth || len % 2 ? len : len - 1); };
$('rPlay').onclick = () => {
  if (R.preview) return;
  if (R.playT) { stopPlay(); return; }
  if (R.ply >= R.moves.length) goPly(0);
  R.playT = setInterval(() => { if (R.ply >= R.moves.length) stopPlay(); else goPly(R.ply + 1); }, 1000);
  $('rPlayIco').innerHTML = '<use href="#i-pause"/>';
};
function stopPlay() { clearInterval(R.playT); R.playT = 0; $('rPlayIco').innerHTML = '<use href="#i-play"/>'; }
$('rvBack').onclick = () => { stopPlay(); R.token++; exitPreview(true); if (S) { Eng.cancel(); resumeSession(); } else goHome(); };
function reviewBaseMoves() { return R.preview ? R.moves.slice(0, R.preview.base).concat(R.preview.line.slice(0, R.preview.k)) : R.moves.slice(0, R.ply); }
$('rvRetry').onclick = () => {
  const mv = reviewBaseMoves(), p = new E.Position(); p.fromMoves(mv);
  if (checkEnd(p)) { toast(T('posOver')); return; }
  stopPlay(); R.token++;
  toast(T('retryFrom', { n: mv.length }));
  if (R.rec.mode == 'pvp') startGame({ mode: 'pvp', moves: mv });
  else startGame({ mode: 'ai', level: R.rec.mode == 'ai' ? R.rec.level : DB.settings.level, side: R.rec.side, moves: mv });
};
$('rvExplore').onclick = () => { stopPlay(); R.token++; const mv = reviewBaseMoves(); openExplore(mv, mv.length, R.rec.mode != 'pvp' && R.rec.side == 1, 'review'); };
$('ptabs').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  R.tab = b.dataset.tab;
  $('ptabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x == b));
  ['chart', 'ana', 'moves', 'report'].forEach(t => $('p-' + t).hidden = t != R.tab);
  refreshPanels();
};

const CH = { padL: 36, padR: 10, padT: 12, padB: 22 };
function drawChart(M) {
  const cv = $('chart'); if ($('p-chart').hidden) return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const n = Math.max(1, R.moves.length), w = W - CH.padL - CH.padR, h = H - CH.padT - CH.padB;
  const X = i => CH.padL + i / n * w, Y = pr => CH.padT + (1 - pr) * h;
  const RED = '#ff7a66', INK = '#d9cfc2', MUT = '#a08c7e', GOLD = 'rgba(232,198,123,.75)';
  g.fillStyle = 'rgba(226,87,74,.07)'; g.fillRect(CH.padL, CH.padT, w, h / 2);
  g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(CH.padL, CH.padT + h / 2, w, h / 2);
  g.font = "11px Manrope,-apple-system,'PingFang SC',sans-serif"; g.textBaseline = 'middle';
  [[1, '100%'], [0.75, '75%'], [0.5, '50%'], [0.25, '25%'], [0, '0%']].forEach(([p, t]) => {
    g.strokeStyle = p == 0.5 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.08)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(CH.padL, Y(p)); g.lineTo(CH.padL + w, Y(p)); g.stroke();
    g.fillStyle = MUT; g.textAlign = 'right'; g.fillText(t, CH.padL - 5, Y(p));
  });
  g.textAlign = 'left'; g.fillStyle = RED; g.fillText(T('chRed'), CH.padL + 5, CH.padT + 9); g.fillStyle = INK; g.fillText(T('chBlack'), CH.padL + 5, CH.padT + h - 9);
  g.fillStyle = MUT; g.textAlign = 'center'; g.textBaseline = 'top';
  const stepEvery = n > 120 ? 40 : n > 60 ? 20 : 10;
  for (let i = stepEvery; i < n; i += stepEvery) g.fillText(i, X(i), CH.padT + h + 5);
  let endStart = -1; { const p = new E.Position(); p.startpos();
    for (let i = 0; i <= R.moves.length; i++) { let big = 0; for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const t = p.sq[sqOf(r, c)] & 7; if (p.sq[sqOf(r, c)] && (t == 3 || t == 4 || t == 5)) big++; }
      if (big <= 5) { endStart = i; break; } if (i < R.moves.length) p.makeMove(R.moves[i]); } }
  g.setLineDash([3, 3]); g.strokeStyle = 'rgba(232,198,123,.4)';
  [[16, T('phMid')], [endStart, T('phEnd')]].forEach(([i, t]) => { if (i > 0 && i < n) { g.beginPath(); g.moveTo(X(i), CH.padT); g.lineTo(X(i), CH.padT + h); g.stroke(); g.fillStyle = GOLD; g.textBaseline = 'top'; g.fillText(t, X(i), CH.padT + 2); } });
  g.setLineDash([]);
  const pts = []; for (let i = 0; i <= R.moves.length; i++) { const v = redWin(i); if (v == null) break; pts.push([X(i), Y(v)]); }
  if (pts.length > 1) {
    const mid = Y(0.5), frac = (mid - CH.padT) / h;
    const grad = g.createLinearGradient(0, CH.padT, 0, CH.padT + h);
    grad.addColorStop(0, 'rgba(255,110,90,.42)'); grad.addColorStop(frac, 'rgba(255,110,90,.08)'); grad.addColorStop(frac, 'rgba(255,255,255,.04)'); grad.addColorStop(1, 'rgba(255,255,255,.22)');
    g.beginPath(); g.moveTo(pts[0][0], mid); pts.forEach(pt => g.lineTo(pt[0], pt[1])); g.lineTo(pts[pts.length - 1][0], mid); g.closePath(); g.fillStyle = grad; g.fill();
    const sg = g.createLinearGradient(0, CH.padT, 0, CH.padT + h); sg.addColorStop(0, RED); sg.addColorStop(frac, RED); sg.addColorStop(frac, INK); sg.addColorStop(1, INK);
    g.beginPath(); pts.forEach((pt, i) => i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])); g.strokeStyle = sg; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
    const mine = j => R.rec.mode == 'pvp' || j % 2 == R.rec.side;
    M.forEach((mt, j) => { if (!mt || (mt.cls != 'err' && mt.cls != 'blun') || !pts[j + 1]) return;
      g.beginPath(); g.arc(pts[j + 1][0], pts[j + 1][1], mine(j) ? 4.5 : 3, 0, 7);
      g.fillStyle = mt.cls == 'blun' ? '#e0503c' : '#e59238'; g.fill(); if (mine(j)) { g.strokeStyle = '#fff6e4'; g.lineWidth = 1.5; g.stroke(); } });
  }
  const cx = X(R.ply); g.strokeStyle = '#3fb884'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, CH.padT); g.lineTo(cx, CH.padT + h); g.stroke();
  const cv2 = redWin(R.ply); if (cv2 != null) { g.beginPath(); g.arc(cx, Y(cv2), 5, 0, 7); g.fillStyle = '#3fb884'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
  const rs = redScore(R.ply), rw = redWin(R.ply);
  const mt = R.ply > 0 ? M[R.ply - 1] : null;
  $('chartCap').innerHTML = `<span>${T('moveN', { n: `<b>${R.ply}</b>` })}${mt ? ` · <span class="tag ${CLS[mt.cls].c}">${clsN(mt.cls)}</span>` : ''}</span><span>${rs == null ? T('analysing') : realMate(rs) ? `<b style="color:#ff9c8f">${fmtScore(rs)}</b>` : fmtScore(rs) + ' · ' + T('redRate') + ' <b>' + pctTxt(rw) + '</b>'}</span>`;
}
(function chartDrag() {
  const cv = $('chart'); let down = false;
  const pickAt = e => { const r = cv.getBoundingClientRect(), w = r.width - CH.padL - CH.padR; const k = Math.round((e.clientX - r.left - CH.padL) / w * R.moves.length); stopPlay(); if (R.preview) exitPreview(true); goPly(k, false); };
  cv.addEventListener('pointerdown', e => { down = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} pickAt(e); });
  cv.addEventListener('pointermove', e => { if (down) pickAt(e); });
  cv.addEventListener('pointerup', () => down = false); cv.addEventListener('pointercancel', () => down = false);
})();

// ---- recommended lines: always LINE_MOVES own moves (twice as many plies), extended on demand ----
const LX = { cache: {}, gen: 0 };
function legalPrefix(base, line) {
  const p = new E.Position(); p.fromMoves(base); const out = [];
  for (const mv of line || []) { if (checkEnd(p) || p.legalMoves().indexOf(mv) < 0) break; p.makeMove(mv); out.push(mv); }
  return out;
}
function lineEntry(key, base, seed, upd) {
  let e = LX.cache[key];
  if (!e) e = LX.cache[key] = { key, base: base.slice(), line: [], done: false, busy: false };
  if (!e.busy && !e.done && seed && !e.line.length) e.line = legalPrefix(base, seed).slice(0, LINE_CHUNK);
  e.upd = upd;
  if (!e.done && !e.busy) extendLine(e);
  return e;
}
async function extendLine(e) {
  e.busy = true; const gen = LX.gen;
  for (let tries = 0; tries < 30 && e.line.length < LINE_PLIES; tries++) {
    const mv = e.base.concat(e.line), p = new E.Position(); p.fromMoves(mv);
    if (checkEnd(p)) break;
    const r = await hintMove(mv, LINE_MS[Eng.adv()]);
    if (gen != LX.gen) return;
    if (!r) { e.busy = false; return; } // the request was cancelled; it resumes on the next render
    let add = legalPrefix(mv, (r.pv && r.pv.length && r.pv[0] == r.mv ? r.pv : r.mv ? [r.mv] : []).slice(0, LINE_CHUNK));
    // later plies of the chunk are not checked for shuffling, so stop before the first one that repeats
    for (let i = 1; i < add.length; i++) if (repeatsPos(mv.concat(add.slice(0, i)), add[i])) { add = add.slice(0, i); break; }
    if (!add.length) break;
    e.line = e.line.concat(add).slice(0, LINE_PLIES);
    e.upd && e.upd();
  }
  e.done = true; e.busy = false; e.upd && e.upd();
}
function lineInfo(base, line) {
  const items = lineText(base, line), p = new E.Position(); p.fromMoves(base.concat(line.slice(0, items.length)));
  return { items, mate: items.length > 0 && p.isMate() };
}
// html for one line; "one side only" shows just the moves of the side that starts the line
function lineHtml(e, opt = {}) {
  const { items, mate } = lineInfo(e.base, e.line), both = !!DB.settings.pvBoth;
  const on = R.preview && R.preview.e === e;
  let n = 0, h = '';
  items.forEach((x, i) => {
    if (opt.skipFirst && i == 0) return;
    if (!both && i % 2) return;
    n++;
    const lab = opt.bestFirst ? (i == 0 ? T('labBest') : both ? '' : String(n - 1)) : both ? '' : String(n + (opt.skipFirst ? 1 : 0));
    h += `<span class="k ${x.sd ? '' : 'r'} ${on && R.preview.k == i + 1 ? 'on' : ''}" data-pv="${i + 1}">${lab ? `<em>${lab}</em>` : ''}${x.t}</span>`;
  });
  if (mate) h += `<span class="mate-end">${T('mateEnd')}</span>`;
  else if (e.busy || (!e.done && items.length < LINE_PLIES)) h += `<span class="calc">${T('calc')}</span>`;
  return `<div class="pv" data-key="${esc(e.key)}">${h}</div>`;
}
function bindLines(el, onPick) {
  el.querySelectorAll('.pv[data-key]').forEach(d => {
    const e = LX.cache[d.dataset.key]; if (!e) return;
    d.querySelectorAll('span[data-pv]').forEach(sp => sp.onclick = ev => { ev.stopPropagation(); onPick(e, +sp.dataset.pv); });
  });
  el.querySelectorAll('[data-start]').forEach(b => b.onclick = () => { const e = LX.cache[b.dataset.start]; if (e) onPick(e, $('review').hidden ? 1 : 0); });
  el.querySelectorAll('[data-pvm]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    DB.settings.pvBoth = b.dataset.pvm == 'both'; save(); AU.select();
    if (!$('review').hidden) { updPreviewBar(); refreshPanels(); } else renderCands();
  });
}
function pvModeHtml(name) {
  const both = !!DB.settings.pvBoth;
  return `<div class="pv-mode"><button data-pvm="mine" class="${both ? '' : 'on'}">${T('onlyOf', { n: name })}</button><button data-pvm="both" class="${both ? 'on' : ''}">${T('bothSides')}</button></div>`;
}
function whoName(sd) {
  const r = R.rec;
  if (r.mode == 'pvp') return SIDE(sd);
  if (sd == r.side) return T('you');
  return r.mode == 'net' ? esc(r.opp && r.opp.name || T('opp')) : esc(lvWho(r.level));
}
function reviewUpd() { if ($('review').hidden) return; updPreviewBar(); if (R.tab == 'ana') renderAna(metrics()); }
function rvLine(baseLen, seed) {
  const base = R.moves.slice(0, baseLen);
  return lineEntry('r' + baseLen + ':' + (seed[0] || 0), base, seed, reviewUpd);
}
const mateTag = m => m > 0 ? `<span class="tag mate">${mateTxt(m)}</span>` : '';
function wtxt(w, m) { return m > 0 ? `<b style="color:#ff9c8f">${T('evMate', { n: m })}</b>` : m < 0 ? T('evMated', { n: -m }) : pctTxt(w); }
// the best line from the position before move j: the engine's first choice, then LINE_MOVES more moves of that side
function bestLine(j) {
  const a = R.ana[j]; if (!a || !a.mv) return null;
  let seed = !a.pv.length || a.pv[0] == a.mv ? a.pv : [a.mv];
  const b = R.ana[j + 1];
  if (j < R.moves.length && R.moves[j] == a.mv && b && b.pv.length + 1 > seed.length) seed = [a.mv].concat(b.pv);
  return rvLine(j, seed.length ? seed : [a.mv]);
}
function renderAna(M) {
  const el = $('p-ana');
  // the panel always describes the move selected in the game record, also while stepping through a line
  const j = R.ply - 1;
  const demoNote = () => R.preview ? `<p class="note dim" style="margin-top:10px">${T('demoNote', { b: R.preview.base == j && R.moves[j] != R.preview.line[0] ? T('demoBlue') : '', p: DB.settings.pvBoth ? '' : T('demoPair') })}</p>` : '';
  if (j < 0) {
    const a = R.ana[0];
    if (!a || !a.mv) { el.innerHTML = `<p class="note">${T('anaStart')}</p>`; return; }
    const e = bestLine(0);
    el.innerHTML = `<div class="ana-top"><span class="note">${T('anaOpening')}</span>${pvModeHtml(SIDE(0))}</div>
      <dl class="kv"><dt>${T('bestMove')}</dt><dd><b class="pv red-t">${lineText([], [a.mv])[0].t}</b> ${mateTag(realMate(a.vl))}</dd><dt>${T('bestLine')}</dt><dd>${lineHtml(e, { bestFirst: true })}</dd></dl>
      <button class="mini-btn" data-start="${esc(e.key)}">${T('demoBest')}</button>${demoNote()}`;
    bindLines(el, startPreview); return;
  }
  const sd = j % 2, mt = M[j], a = R.ana[j], b = R.ana[j + 1];
  const before = R.moves.slice(0, j);
  const played = lineText(before, [R.moves[j]])[0] || { t: '?' };
  const col = sd ? 'blk-t' : 'red-t';
  let h = `<div class="ana-top"><span class="note dim" style="font-size:13px">${T('roundWho', { n: Math.floor(j / 2) + 1, w: whoName(sd), s: SIDE(sd) })}</span>${pvModeHtml(whoName(sd))}</div>
    <div class="ana-move" style="margin-top:6px"><span class="note dim">${T('actual')}</span><span class="big ${col}">${played.t}</span>${mt ? `<span class="tag ${CLS[mt.cls].c}">${clsN(mt.cls)}</span>` : `<span class="note dim">${T('analysing')}</span>`}</div>`;
  if (!a || !a.mv) { el.innerHTML = h + `<p class="note" style="margin-top:10px">${T('anaWait')}</p>`; return; }
  const mB = realMate(a.vl), isBest = a.mv == R.moves[j];
  const e = bestLine(j), rec = lineText(before, [a.mv])[0];
  h += `<dl class="kv">`;
  if (mt) {
    const mA = -realMate(b.vl);
    h += `<dt>${T('swing')}</dt><dd>${SIDE(sd)} ${wtxt(mt.before, mB)} → <b>${wtxt(mt.after, mA)}</b>${!mB && !mA && mt.drop >= 1 ? ` (<span style="color:#ff9c8f">−${Math.round(mt.drop)}%</span>)` : ''}</dd>`;
    if (mB > 0 && mA <= 0) h += `<dt></dt><dd><span class="tag mate">${T('missedMate')}</span> ${T('hadMate', { n: mB })}</dd>`;
  }
  h += `<dt>${T('bestMove')}</dt><dd><b class="pv ${col}">${rec ? rec.t : '—'}</b> ${mateTag(mB)}${isBest ? ` <span class="note dim" style="display:inline">${T('sameAsPlayed')}</span>` : ''}</dd>`;
  h += `<dt>${T('bestLine')}</dt><dd>${lineHtml(e, { bestFirst: true })}</dd>`;
  if (!isBest) {
    const ea = rvLine(j, [R.moves[j]].concat(b ? b.pv : []));
    h += `<dt>${T('actualLine')}</dt><dd>${lineHtml(ea)}</dd></dl>`;
    h += `<div class="btns" style="margin-top:12px"><button class="mini-btn" style="margin:0" data-start="${esc(e.key)}">${T('demoBestPrev')}</button><button class="mini-btn alt" style="margin:0" data-start="${esc(ea.key)}">${T('demoActual')}</button></div>`;
  } else h += `</dl><button class="mini-btn" data-start="${esc(e.key)}">${T('demoBestPrev')}</button>`;
  h += demoNote();
  el.innerHTML = h; bindLines(el, startPreview);
}
function startPreview(e, k) {
  stopPlay(); if (!e || !e.line.length) return;
  if (R.preview && R.preview.e === e) { previewTo(k); return; }
  if (R.preview) clearTimeout(R.preview.t2);
  // start on the position before the move (k = 0): the arrow shows the best move, › plays it
  R.preview = { base: e.base.length, e, k: 0, get line() { return this.e.line; }, get mate() { return lineInfo(this.e.base, this.e.line).mate; } };
  renderReview(true); AU.select();
  if (k) previewTo(k);
  const rv = $('review'), bt = $('rBoard').getBoundingClientRect(), rt = rv.getBoundingClientRect();
  if (bt.top < rt.top || bt.bottom > rt.bottom) rv.scrollTo({ top: rv.scrollTop + bt.top - rt.top - 40, behavior: 'smooth' });
}
function exitPreview(silent) { if (!R.preview) return; clearTimeout(R.preview.t2); R.preview = null; if (silent !== true) renderReview(true); else { const pb = document.querySelector('.preview-bar'); if (pb) pb.remove(); } }
function renderMoves(M) {
  const el = $('p-moves'), p = new E.Position(); p.startpos();
  let h = '<div class="moves">';
  for (let j = 0; j < R.moves.length; j++) {
    if (j % 2 == 0) h += `<span class="no">${j / 2 + 1}.</span>`;
    const t = notation(p, R.moves[j]); p.makeMove(R.moves[j]);
    const mt = M[j];
    h += `<button class="${j % 2 ? '' : 'r'} ${R.ply == j + 1 ? 'cur' : ''}" data-k="${j + 1}"><span>${t}</span>${mt && mt.cls != 'good' ? `<span class="tag ${CLS[mt.cls].c}">${clsT(mt.cls)}</span>` : ''}</button>`;
  }
  if (R.moves.length % 2 == 1) h += '<span></span>';
  h += '</div>';
  el.innerHTML = R.moves.length ? h : `<p class="note">${T('noMovesPlayed')}</p>`;
  el.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => { stopPlay(); exitPreview(true); goPly(+b.dataset.k); });
  const box = el.querySelector('.moves'), cur = el.querySelector('.cur'); if (cur) scrollInto(isWide() ? el : box, cur);
}
function renderReport(M) {
  const el = $('p-report'), pvp = R.rec.mode == 'pvp', me = pvp ? 0 : R.rec.side;
  const sum = sd => { const xs = M.filter((m, j) => m && j % 2 == sd && j >= (R.rec.base || 0)); const c = { best: 0, good: 0, slow: 0, err: 0, blun: 0 }; xs.forEach(m => c[m.cls]++);
    return { n: xs.length, acc: xs.length ? xs.reduce((s, m) => s + m.acc, 0) / xs.length : null, c }; };
  const A = [sum(0), sum(1)];
  const done = R.ana.filter(Boolean).length >= R.moves.length + 1;
  const ring = sd => { const s = A[sd], col = sd ? '#d9cfc2' : '#ff7a66';
    return `<div><span class="nm" style="color:${col}">${whoName(sd)}${pvp ? '' : ' · ' + SIDE(sd)}</span><div class="ring" style="--p:${s.acc == null ? 0 : s.acc};--c:${col}"><b>${s.acc == null ? '—' : Math.round(s.acc)}</b></div><small>${T('accOf', { n: s.n })}</small></div>`; };
  let h = `<div class="acc">${ring(me)}${ring(1 - me)}</div>`;
  h += `<table class="cnt"><tr><th></th><th>${whoName(me)}</th><th>${whoName(1 - me)}</th></tr>` +
    ['best', 'good', 'slow', 'err', 'blun'].map(k => `<tr><td><span class="tag ${CLS[k].c}">${clsT(k)}</span> ${clsN(k)}</td><td>${A[me].c[k]}</td><td>${A[1 - me].c[k]}</td></tr>`).join('') + '</table>';
  const keys = M.map((m, j) => ({ m, j })).filter(x => x.m && (pvp || x.j % 2 == me) && x.j >= (R.rec.base || 0) && x.m.drop >= 8).sort((a, b) => b.m.drop - a.m.drop).slice(0, pvp ? 6 : 5);
  const p = new E.Position();
  h += `<div class="keys"><h4>${keys.length ? T(pvp ? 'keyBoth' : 'keyMine') : T(done ? 'keyNone' : 'keyWait')}</h4>`;
  keys.forEach(({ m, j }) => { p.fromMoves(R.moves.slice(0, j)); const t = notation(p, R.moves[j]), best = R.ana[j].mv ? notation(p, R.ana[j].mv) : '';
    h += `<button data-k="${j + 1}"><span class="tag ${CLS[m.cls].c}">${clsT(m.cls)}</span><span class="grow">${T('keyRow', { n: Math.floor(j / 2) + 1, s: pvp ? SIDE(j % 2) + ' ' : '', t })}${best ? T('keyBest', { b: best }) : ''}</span><small>−${Math.round(m.drop)}%</small></button>`; });
  h += '</div>';
  if (done && !pvp && A[me].acc != null) {
    const acc = A[me].acc, tip = T(acc >= 85 ? 'tipHigh' : acc >= 70 ? 'tipMid' : 'tipLow');
    h += `<p class="note" style="margin-top:12px">${T('accYou', { n: `<b>${Math.round(acc)}</b>` })} ${tip}${R.rec.hints ? ' ' + T('usedHints', { n: R.rec.hints }) : ''}${R.rec.undos ? ' ' + T('usedUndos', { n: R.rec.undos }) : ''}</p>`;
  }
  el.innerHTML = h;
  el.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => { stopPlay(); exitPreview(true); goPly(+b.dataset.k); $('ptabs').querySelector('[data-tab="ana"]').click(); });
}
