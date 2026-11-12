// ===== the board: grid, pieces that slide, marks, arrows and move badges =====
const CLS = { best: { c: 'c-best' }, good: { c: 'c-good' }, slow: { c: 'c-slow' }, err: { c: 'c-err' }, blun: { c: 'c-blun' } };
const clsT = k => T('cls')[k][0], clsN = k => T('cls')[k][1];
let boardUid = 0;
const BOARDS = [];
function Board(el) {
  const uid = ++boardUid;
  el.innerHTML = '<svg class="grid"></svg><div class="layer marks"></div><div class="layer pieces"></div><svg class="arrows"></svg><div class="layer badges"></div>';
  const grid = el.querySelector('.grid'), marks = el.querySelector('.marks'), pcsL = el.querySelector('.pieces'),
    arrows = el.querySelector('.arrows'), badges = el.querySelector('.badges');
  const B = { el, flip: false, cell: 40, pad: 28, py: 36, W: 0, H: 0, items: [], lastMarks: null };
  // margins around the grid, in cells: [sides, top and bottom]. Top and bottom are deeper, to leave room for the file numbers.
  const margins = () => isWide() ? [0.8, 1.02] : [0.62, 0.9];
  B.xy = sq => { let [r, c] = rc(sq); if (B.flip) { r = 9 - r; c = 8 - c; } return { x: B.pad + c * B.cell, y: B.py + r * B.cell }; };
  B.hit = (cx, cy) => {
    const rect = el.getBoundingClientRect(); let c = Math.round((cx - rect.left - B.pad) / B.cell), r = Math.round((cy - rect.top - B.py) / B.cell);
    if (r < 0 || r > 9 || c < 0 || c > 8) return -1;
    if (B.flip) { r = 9 - r; c = 8 - c; }
    return sqOf(r, c);
  };
  // height of a board that is W wide
  B.ratio = () => { const [mx, my] = margins(); return (9 + my * 2) / (8 + mx * 2); };
  B.size = W => {
    // phones: a thinner margin around the grid and bigger pieces, so they are easier to tap
    const cm = !isWide(), [mx, my] = margins();
    B.W = W; B.cell = W / (8 + mx * 2); B.pad = B.cell * mx; B.py = B.cell * my; B.H = B.cell * 9 + B.py * 2; B.ps = B.cell * (cm ? 0.94 : 0.9);
    el.style.width = W + 'px'; el.style.height = B.H + 'px'; el.style.setProperty('--ps', B.ps + 'px');
    drawGrid();
    B.items.forEach(it => { it.el.style.transition = 'none'; place(it.el, it.sq); it.el.offsetWidth; it.el.style.transition = ''; });
    if (B.lastMarks) B.marks(B.lastMarks);
  };
  function drawGrid() {
    if (!B.W) return;
    const c = B.cell, p = B.pad, q = B.py, x1 = p + 8 * c, y1 = q + 9 * c, f = n => n.toFixed(1);
    const X = k => p + k * c, Y = r => q + r * c;
    let s = `<rect x="${f(p - c * .13)}" y="${f(q - c * .13)}" width="${f(8 * c + c * .26)}" height="${f(9 * c + c * .26)}" rx="${f(c * .06)}" fill="none" stroke="currentColor" stroke-width="2.2"/>`;
    s += `<g stroke="currentColor" stroke-width="1.15" stroke-linecap="round" fill="none">`;
    for (let r = 0; r < 10; r++) s += `<path d="M${f(p)} ${f(Y(r))}H${f(x1)}"/>`;
    for (let k = 0; k < 9; k++) {
      if (k == 0 || k == 8) s += `<path d="M${f(X(k))} ${f(q)}V${f(y1)}"/>`;
      else s += `<path d="M${f(X(k))} ${f(q)}V${f(Y(4))}M${f(X(k))} ${f(Y(5))}V${f(y1)}"/>`;
    }
    s += `<path d="M${f(X(3))} ${f(Y(0))}L${f(X(5))} ${f(Y(2))}M${f(X(5))} ${f(Y(0))}L${f(X(3))} ${f(Y(2))}M${f(X(3))} ${f(Y(7))}L${f(X(5))} ${f(Y(9))}M${f(X(5))} ${f(Y(7))}L${f(X(3))} ${f(Y(9))}"/>`;
    const g = c * .09, l = c * .2;
    const tick = (k, r) => { for (const dx of [-1, 1]) { if (k + dx < 0 || k + dx > 8) continue; for (const dy of [-1, 1]) {
      const x = X(k) + dx * g, y = Y(r) + dy * g; s += `<path d="M${f(x + dx * l)} ${f(y)}H${f(x)}V${f(y + dy * l)}"/>`; } } };
    [[1, 2], [7, 2], [1, 7], [7, 7]].forEach(a => tick(a[0], a[1]));
    [0, 2, 4, 6, 8].forEach(k => { tick(k, 3); tick(k, 6); });
    s += `</g>`;
    if (zh()) {
      // the river: 楚河 汉界, read from each player's own side when the board is flipped
      const fy = Y(4.5) + c * .22, fs = c * .64, a = B.flip ? ['汉界', '楚河'] : ['楚河', '汉界'];
      s += `<g font-family='XQBrush,"STXingkai","Kaiti SC","KaiTi",serif' font-size="${f(fs)}" text-anchor="middle"><text x="${f(X(2))}" y="${f(fy)}" letter-spacing="${f(c * .5)}" dx="${f(c * .25)}">${a[0]}</text><text x="${f(X(6))}" y="${f(fy)}" letter-spacing="${f(c * .5)}" dx="${f(c * .25)}">${a[1]}</text></g>`;
    } else {
      // no lettering on the English board: three quiet ripples mark the river
      const w = c * .9, wave = (x, y) => `<path d="M${f(x - w)} ${f(y)}q${f(w / 4)} ${f(-c * .14)} ${f(w / 2)} 0t${f(w / 2)} 0t${f(w / 2)} 0t${f(w / 2)} 0"/>`;
      s += `<g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".5">`;
      [2, 6].forEach(k => { s += wave(X(k), Y(4.5) - c * .13) + wave(X(k), Y(4.5) + c * .13); });
      s += `</g>`;
    }
    // file numbers: black's files along the top, red's along the bottom (as each side counts them)
    const ls = c * .24, band = q - B.ps / 2, ty = band / 2 + ls * .36 - c * .02;   // centred in the strip above the back rank
    s += `<g font-size="${f(ls)}" text-anchor="middle" font-family='${zh() ? 'XQPiece,"Songti SC","Noto Serif SC",serif' : 'Manrope,sans-serif'}' font-weight="${zh() ? 700 : 600}">`;
    for (let k = 0; k < 9; k++) {
      const col = B.flip ? 8 - k : k;
      const red = zh() ? RN[8 - col] : String(9 - col), blk = String(col + 1);
      s += `<text x="${f(X(k))}" y="${f(ty)}">${B.flip ? red : blk}</text><text x="${f(X(k))}" y="${f(B.H - band / 2 + ls * .36 + c * .05)}">${B.flip ? blk : red}</text>`;
    }
    s += `</g>`;
    grid.setAttribute('viewBox', `0 0 ${B.W} ${B.H}`); grid.innerHTML = s;
    arrows.setAttribute('viewBox', `0 0 ${B.W} ${B.H}`);
  }
  function place(node, sq) { const { x, y } = B.xy(sq); node.style.transform = `translate(${x - B.ps / 2}px,${y - B.ps / 2}px)`; }
  function makePiece(pc) {
    const d = document.createElement('div'); d.className = 'pc ' + (sideOf(pc) ? 'k' : 'r');
    d.innerHTML = `<div class="face">${glyph(pc)}</div>`; return d;
  }
  B.setFlip = f => { f = !!f; el.classList.toggle('flipped', f); if (B.flip != f) { B.flip = f; drawGrid(); B.items.forEach(it => place(it.el, it.sq)); if (B.lastMarks) B.marks(B.lastMarks); } };
  B.clear = () => { B.items.forEach(it => it.el.remove()); B.items = []; B.lastMarks = null; marks.innerHTML = ''; arrows.innerHTML = ''; badges.innerHTML = ''; };
  // language, piece style or board colour changed
  B.restyle = () => {
    el.classList.toggle('wood', DB.settings.board == 'wood');
    drawGrid();
    B.items.forEach(it => { it.el.firstChild.innerHTML = glyph(it.pc); });
    if (B.lastMarks) B.marks(B.lastMarks);
  };
  B.setPosition = (sqArr, animate = true) => {
    const target = [];
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const s = sqOf(r, c), pc = sqArr[s]; if (pc) target.push({ sq: s, pc, done: false }); }
    const free = B.items.slice(); const next = [];
    target.forEach(t => { const i = free.findIndex(it => it.sq == t.sq && it.pc == t.pc); if (i >= 0) { next.push(free[i]); free.splice(i, 1); t.done = true; } });
    target.forEach(t => {
      if (t.done) return;
      let bi = -1, bd = 1e9; const [tr, tc] = rc(t.sq);
      free.forEach((it, i) => { if (it.pc != t.pc) return; const [r, c] = rc(it.sq), dd = Math.abs(r - tr) + Math.abs(c - tc); if (dd < bd) { bd = dd; bi = i; } });
      if (bi >= 0) {
        const it = free.splice(bi, 1)[0]; it.sq = t.sq;
        if (!animate) it.el.style.transition = 'none';
        it.el.classList.add('moving'); place(it.el, t.sq);
        if (!animate) { it.el.offsetWidth; it.el.style.transition = ''; }
        setTimeout(() => it.el.classList.remove('moving'), 300);
        next.push(it);
      } else {
        const node = makePiece(t.pc); node.style.transition = 'none'; place(node, t.sq); pcsL.appendChild(node);
        node.offsetWidth; node.style.transition = ''; if (animate) node.classList.add('born');
        next.push({ el: node, sq: t.sq, pc: t.pc });
      }
    });
    free.forEach(it => {
      if (animate) { setTimeout(() => { it.el.classList.add('dead'); it.el.style.transform += ' scale(.5)'; }, 170); setTimeout(() => it.el.remove(), 480); }
      else it.el.remove();
    });
    B.items = next;
  };
  const ACOL = { green: '#35c98a', orange: '#f0913a', blue: '#6aa5f5' };
  B.marks = m => {
    B.lastMarks = m;
    let h = '';
    const at = (sq, cls) => { const { x, y } = B.xy(sq); return `<div class="mk ${cls}" style="transform:translate(${x}px,${y}px) translate(-50%,-50%)"></div>`; };
    if (m.last) { h += at(m.last[0], 'from') + at(m.last[1], 'to'); }
    (m.dots || []).forEach(d => h += at(d.sq, d.cap ? 'ring' : 'dot'));
    marks.innerHTML = h;
    B.items.forEach(it => { it.el.classList.toggle('sel', it.sq == m.sel); it.el.classList.toggle('chk', it.sq == m.check); });
    let a = '<defs>' + Object.keys(ACOL).map(k => `<marker id="ah${k}${uid}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M0 0 10 5 0 10z" fill="${ACOL[k]}"/></marker>`).join('') + '</defs>';
    (m.arrows || []).forEach(ar => {
      if (!ar.mv) return;
      const p1 = B.xy(SRC(ar.mv)), p2 = B.xy(DST(ar.mv)), dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1;
      const sh = B.cell * .18, ex = p2.x - dx / len * B.cell * .32, ey = p2.y - dy / len * B.cell * .32, sx = p1.x + dx / len * sh, sy = p1.y + dy / len * sh;
      const k = ACOL[ar.color] ? ar.color : 'green', col = ACOL[k];
      const op = ar.op || .9, wd = B.cell * (ar.thin ? .1 : .15);
      a += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${col}" stroke-width="${wd}" stroke-linecap="round" opacity="${op}" marker-end="url(#ah${k}${uid})" ${ar.dash ? `stroke-dasharray="${B.cell * .2} ${B.cell * .16}"` : ''}/>
        <circle cx="${p1.x}" cy="${p1.y}" r="${B.cell * .12}" fill="${col}" opacity="${op}"/>`;
    });
    arrows.innerHTML = a;
    let bh = '';
    if (m.badge) {
      const { x, y } = B.xy(m.badge.sq);
      bh = `<div class="bdgw" style="transform:translate(${x + B.ps * .26}px,${y - B.ps * .7}px)"><div class="bdg ${CLS[m.badge.cls].c}">${clsT(m.badge.cls)}</div></div>`;
    }
    badges.innerHTML = bh;
  };
  el.classList.toggle('wood', DB.settings.board == 'wood');
  BOARDS.push(B);
  return B;
}
