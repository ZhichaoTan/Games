// ===== start-up =====
$('sprite').innerHTML = AV.sprite('') + XA.sprite();
(function noise() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d'), d = x.createImageData(96, 96);
    for (let i = 0; i < d.data.length; i += 4) { const g = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = g; d.data[i + 3] = 22; }
    x.putImageData(d, 0, 0);
    document.documentElement.style.setProperty('--noise', `url(${c.toDataURL()})`);
  } catch (e) {}
})();
document.addEventListener('keydown', e => {
  if (!$('overlay').hidden || sheetOn || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
  if (!$('game').hidden) {
    if (G.ex) { if (e.key == 'ArrowLeft') $('eBack').click(); if (e.key == 'ArrowRight') $('eFwd').click(); if (e.key == 'Escape') $('eQuit').click(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 'z') { e.preventDefault(); $('tUndo').click(); }
  }
  if (!$('review').hidden) { if (e.key == 'ArrowLeft') $('rPrev').click(); if (e.key == 'ArrowRight') $('rNext').click(); }
  if (!$('explore').hidden) { if (e.key == 'ArrowLeft') $('xPrev').click(); if (e.key == 'ArrowRight') $('xNext').click(); }
});
function relayout() {
  if (!$('game').hidden) { sizeGame(); if (!G.ex) renderSideMoves(); }
  if (!$('review').hidden) { sizeReview(); drawChart(metrics()); }
  if (!$('explore').hidden) sizeExplore();
}
window.addEventListener('resize', relayout);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

if (IN_WX) $('wxTip').hidden = false;
applyStatic();
paintMe();
paintSound();
renderHome();
if (Eng.wantPf()) PF.load();
const hc = (location.hash || '').replace('#', '').toUpperCase();
if (/^[A-Z0-9]{4}$/.test(hc)) { setTab('join'); $('joinCode').value = hc; if (myName) setTimeout(() => $('btnJoin').click(), 200); }
else setTab(['join', 'host', 'solo'].includes(DB.settings.tab) ? DB.settings.tab : 'solo');
show('lobby');
// for tests and screenshots
W.XQAPP = { G, R, X, DB, E, PF, Eng, store, gb, rb, xb, get S() { return S; }, startGame, openReview, notation };
