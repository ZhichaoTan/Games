// ===== start up =====
if (/MicroMessenger/i.test(navigator.userAgent)) $('wxTip').hidden = false;
applyStatic();
paintMe();
renderModes();
renderOpts();
renderResume();
const hc = (location.hash || '').replace('#', '').toUpperCase();
if (/^[A-Z0-9]{4}$/.test(hc)) { setTab('join'); $('joinCode').value = hc; if (myName) setTimeout(() => $('btnJoin').click(), 200); }
else setTab(P.tab || 'solo');
show('lobby');
// the browser threw the page away in the background and it's being reopened: go straight back to the room
const liveMark = KeepAlive.marked(LIVE);
if (liveMark && myName && !/^[A-Z0-9]{4}$/.test(hc)) {
  const hs = store.get('sb_host'), cs = store.get('sb_client');
  if (liveMark.kind === 'host' && hs && hs.code && Date.now() - (hs.at || 0) < 12 * 3600e3) startHost({ solo: false, restore: hs, auto: true });
  else if (liveMark.kind === 'client' && cs && cs.code === liveMark.code) startClient(cs.code);
  else KeepAlive.mark(LIVE, null);
}
// tests and screenshots: ?autosolo=marathon|sprint|ultra|versus starts a game straight away (&foes=1..3 &lv=1..4 for a battle)
const auto = qs.get('autosolo');
if (auto && !S) {
  if (!myName) { myName = 'Me'; $('nick').value = myName; }
  if (qs.get('foes')) P.foes = clamp(+qs.get('foes') || 2, 1, 3);
  if (qs.get('lv')) P.bot = clamp(+qs.get('lv') || 2, 1, 4);
  if (qs.get('ctl')) P.ctl = qs.get('ctl') === 'pad' ? 'pad' : 'swipe';
  if (auto === 'versus') startHost({ solo: true }); else startSolo(MODES.includes(auto) ? auto : 'marathon');
}
W.SBAPP = { get S() { return S; }, U, R, P, store, act, soft, layout, BEST, get screen() { return screenOn; } };
