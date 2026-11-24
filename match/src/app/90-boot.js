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
  const hs = store.get('tt_host'), cs = store.get('tt_client');
  if (liveMark.kind === 'host' && hs && hs.code && Date.now() - (hs.at || 0) < 12 * 3600e3) startHost({ solo: false, restore: hs, auto: true });
  else if (liveMark.kind === 'client' && cs && cs.code === liveMark.code) startClient(cs.code);
  else KeepAlive.mark(LIVE, null);
}
// tests and screenshots: ?autosolo=levels|rush|versus starts a game straight away (&n=level, &foes=1..3 &lv=1..4 for a battle, &theme=pal|mm)
const auto = qs.get('autosolo');
if (qs.get('theme') && THEMES.includes(qs.get('theme'))) setTheme(qs.get('theme'));
if (auto && !S) {
  if (!myName) { myName = 'Me'; $('nick').value = myName; }
  if (qs.get('foes')) P.foes = clamp(+qs.get('foes') || 2, 1, 3);
  if (qs.get('lv')) P.bot = clamp(+qs.get('lv') || 2, 1, 4);
  if (auto === 'versus') startHost({ solo: true });
  else if (auto === 'rush') startRush();
  else if (auto === 'map') showMap(nextLevel());
  else {
    const n = clamp(+qs.get('n') || 1, 1, LV.COUNT);
    for (let k = 0; k < n - 1; k++) if (!PROG.stars[k]) PROG.stars[k] = 1;
    startLevel(n);
  }
}
W.TTAPP = { get S() { return S; }, U, V, R, P, PROG, store, act, trySwap, tapCell, idle, layoutGame, setTheme, showMenu, showRules, showThemes, get screen() { return screenOn; } };
