// ===== the level map: six streets of ten levels, each level with its stars; a level's card with its goals =====
// each stop's animal on its sign, and its colour, in each look
const CH_PET = { pal: [2, 1, 5, 0, 4, 3], mm: [0, 5, 3, 1, 2, 4] };
const CH_HUE = { pal: [100, 205, 150, 345, 40, 255] };
const chPet = c => CH_PET[P.theme === 'pal' ? 'pal' : 'mm'][((c | 0) % 6 + 6) % 6];
const chHue = c => (P.theme === 'pal' ? CH_HUE.pal[((c | 0) % 6 + 6) % 6] : LV.CH[c].hue);
const ZIG = [50, 74, 78, 56, 30, 20, 36, 62, 80, 64];   // where each of a street's ten levels sits across the path (%)
function showMap(focus) {
  show('map');
  renderMap();
  const n = focus || nextLevel();
  requestAnimationFrame(() => {
    const el = $('mapScroll').querySelector(`.node[data-n="${n}"]`), box = $('mapScroll');
    if (el) box.scrollTop = Math.max(0, el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - box.clientHeight * 0.45);
  });
}
function renderMap() {
  $('mapStars').innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2.2l2.95 6 6.6.95-4.78 4.66 1.13 6.57L12 17.27l-5.9 3.1 1.13-6.57L2.45 9.15l6.6-.95z" fill="url(#starg)"/></svg>${starsTotal()} / ${LV.COUNT * 3}`;
  const cur = nextLevel(), allDone = PROG.stars.length >= LV.COUNT && PROG.stars.every(s => s > 0);
  let h = '';
  for (let c = 0; c < LV.CH.length; c++) {
    const first = c * 10 + 1, last = Math.min(LV.COUNT, first + 9), rows = last - first + 1;
    let got = 0; for (let n = first; n <= last; n++) got += PROG.stars[n - 1] | 0;
    const open = unlocked(first);
    h += `<div class="chap${open ? '' : ' locked'}" style="--h:${chHue(c)};--rows:${rows}">`;
    h += `<div class="ch"><span class="lamp">${pic('m', chPet(c), open ? 'happy' : 'sleep')}</span><span class="tx"><small>${esc(T('chapterN', { n: c + 1 }))}</small><b>${esc(T('chapters')[c])}</b></span>` +
      `<span class="cs"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2.2l2.95 6 6.6.95-4.78 4.66 1.13 6.57L12 17.27l-5.9 3.1 1.13-6.57L2.45 9.15l6.6-.95z" fill="url(#starg)"/></svg>${got}/${rows * 3}</span></div>`;
    // the path through the street's levels
    const pts = [];
    for (let k = 0; k < rows; k++) pts.push([ZIG[k % 10], 46 + k * 76]);
    const H = 20 + rows * 76;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let k = 1; k < pts.length; k++) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k]; d += `C${x0} ${y0 + 38} ${x1} ${y1 - 38} ${x1} ${y1}`; }
    h += `<div class="path"><svg class="ln" viewBox="0 0 100 ${H}" preserveAspectRatio="none"><path class="pa" d="${d}" fill="none" stroke-width="10" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
      `<path class="pb" d="${d}" fill="none" stroke-width="2" stroke-dasharray="2 9" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
    for (let k = 0; k < rows; k++) {
      const n = first + k, st = PROG.stars[n - 1] | 0, ok = unlocked(n), d0 = LV.L[n - 1];
      const cls = 'node' + (ok ? '' : ' lock') + (n === cur && ok && !allDone ? ' cur' : '') + (d0.tut && ok && !st ? ' tut' : '');
      const stars = ok ? `<span class="st">${[0, 1, 2].map(i => `<i class="${i < st ? 'on' : ''}">★</i>`).join('')}</span>` : '';
      const me = n === cur && ok && !allDone ? `<span class="me"><svg viewBox="0 0 100 100"><use href="#av${myAv}"/></svg></span>` : '';
      h += `<button class="${cls}" data-n="${n}" style="left:${pts[k][0]}%;top:${pts[k][1]}px" aria-label="${esc(T('levelN', { n }))}">${ok ? n : '<svg viewBox="0 0 24 24"><use href="#i-lock"/></svg>'}${stars}${me}</button>`;
    }
    h += '</div></div>';
  }
  if (allDone) h += `<div class="foot" style="padding:0 24px">${esc(T('allDone'))}</div>`;
  const box = $('mapScroll');
  box.innerHTML = h;
  box.querySelectorAll('.node').forEach(b => b.onclick = () => {
    const n = +b.dataset.n;
    if (!unlocked(n)) { toast(T('locked')); SND.play('bad'); return; }
    SND.play('tap');
    levelCard(n);
  });
}
$('mapBack').onclick = () => { show('lobby'); renderModes(); renderResume(); };
// a level's card: its goals, moves, best score and stars, and Play
function levelCard(n) {
  const sp = LV.spec(n, 1), st = PROG.stars[n - 1] | 0, best = PROG.best[n - 1] | 0, c = LV.chapterOf(n);
  let h = `<div class="lvcard">` + head(`<span class="lvh"><span class="lamp">${pic('m', chPet(c), 'happy')}</span><span><small>${esc(T('chapters')[c])}</small><b>${esc(T('levelN', { n }))}</b></span></span>`);
  h += `<div class="bigstars">${[0, 1, 2].map(i => STAR(i < st)).join('')}</div>`;
  h += `<div class="glist">${sp.goals.map(g => `<div class="gl"><span class="gi">${goalPic(g)}</span><span>${esc(goalText(g))}</span></div>`).join('')}</div>`;
  h += `<div class="lvmeta"><span><b>${esc(T('movesN', { n: sp.moves }))}</b></span><span>${best ? esc(T('best', { v: fmtN(best) })) : esc(T('noBest'))}</span><span>${esc(T('starsNeed', { a: fmtN(sp.stars[1]), b: fmtN(sp.stars[2]) }))}</span></div>`;
  h += `<button class="btn gold" id="lvGo"><svg class="ic" viewBox="0 0 24 24"><use href="#i-play"/></svg>${esc(T('play'))}</button></div>`;
  sheet(h, { id: 'level' });
  $('lvGo').onclick = () => { closeSheet(); startLevel(n); };
}
