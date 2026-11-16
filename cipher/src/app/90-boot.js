// ===== start-up =====
$('sprite').innerHTML = AV.sprite('') + ART.sprite();
(function noise() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d'), d = x.createImageData(96, 96);
    for (let i = 0; i < d.data.length; i += 4) { const g = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = g; d.data[i + 3] = 22; }
    x.putImageData(d, 0, 0);
    document.documentElement.style.setProperty('--noise', `url(${c.toDataURL()})`);
  } catch (e) {}
})();
if (/MicroMessenger/i.test(navigator.userAgent)) $('wxTip').hidden = false;
applyStatic();
paintMe();
paintSound();
renderOpts();
renderResume();
const hc = (location.hash || '').replace('#', '').toUpperCase();
if (/^[A-Z0-9]{4}$/.test(hc)) { setTab('join'); $('joinCode').value = hc; if (myName) setTimeout(() => $('btnJoin').click(), 200); }
else setTab(['join', 'host', 'solo'].includes(P.tab) ? P.tab : 'solo');
show('lobby');
// the browser dropped this page in the background and loaded it again: go straight back into the room
(function () {
  const live = KeepAlive.marked('mm_live');
  if (!live || !myName || /^[A-Z0-9]{4}$/.test(hc)) return;
  const hs = store.get('mm_host'), cs = store.get('mm_client');
  if (live.kind === 'host' && hs && hs.T && Date.now() - (hs.at || 0) < 12 * 3600e3) startHost({ solo: false, restore: hs, auto: true });
  else if (live.kind === 'client' && cs && cs.code === live.code) startClient(cs.code);
  else KeepAlive.mark('mm_live', null);
})();
// tests and screenshots: ?autosolo=1 starts a practice game straight away
if (qs.get('autosolo') && !S) { if (!myName) { myName = 'Me'; $('nick').value = myName; } startHost({ solo: true }); }
W.CXAPP = { get S() { return S; }, UI, store, P };
