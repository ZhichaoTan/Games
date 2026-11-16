// ===== start up =====
if (/MicroMessenger/i.test(navigator.userAgent)) $('wxTip').hidden = false;
applyStatic();
paintMe();
renderOpts();
renderResume();
const hc = (location.hash || '').replace('#', '').toUpperCase();
if (/^[A-Z0-9]{4}$/.test(hc)) { setTab('join'); $('joinCode').value = hc; if (myName) setTimeout(() => $('btnJoin').click(), 200); }
else setTab(P.tab || 'solo');
show('lobby');
// the browser threw the page away in the background and it's being reopened: go straight back to the room
const liveMark = KeepAlive.marked(LIVE);
if (liveMark && myName && !/^[A-Z0-9]{4}$/.test(hc)) {
  const hs = store.get('cd_host'), cs = store.get('cd_client');
  if (liveMark.kind === 'host' && hs && hs.T && Date.now() - (hs.at || 0) < 12 * 3600e3) startHost({ solo: false, restore: hs, auto: true });
  else if (liveMark.kind === 'client' && cs && cs.code === liveMark.code) startClient(cs.code);
  else KeepAlive.mark(LIVE, null);
}
// tests and screenshots: ?autosolo=1 starts a practice game straight away (&n=2..4 players, &quick=1 for a quick start)
if (qs.get('autosolo')) {
  if (!myName) { myName = 'Me'; $('nick').value = myName; }
  if (qs.get('n')) P.n = clamp(+qs.get('n') || 3, 2, 4);
  if (qs.get('quick')) P.rules.setup = 'quick';
  startHost({ solo: true });
}
W.MTAPP = { get S() { return S; }, get board() { return board; }, U, store, onTap, draw };
