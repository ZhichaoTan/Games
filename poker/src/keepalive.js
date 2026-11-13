// Keep an online room alive while the host's page is in the background. Shared by every game (the builds inline it right after PeerJS).
// - hold(title): loops a 2-second, -60 dB, 30 Hz tone in an <audio> element. Nobody can hear it, but iPhone Safari and Android Chrome
//   keep running a page that is playing audio, so the room keeps answering after the host switches apps or locks the phone.
//   It has to start from a tap; if the browser refuses, it tries again on the next tap.
// - onResume(fn): fn({ away, frozen }) when the page comes back. away = ms it was hidden, frozen = longest stretch its timers were stopped.
// - lost(): total ms the page spent frozen, so turn clocks don't charge a player for time the host was away.
// - now() / later(fn, ms): a clock and a timer that stand still while the page is frozen.
// - token(id): a PeerJS token kept per peer id, so a reloaded or rebuilt host page takes its room id straight back from the server.
// - mark(role) / marked(): a sessionStorage note that this tab is hosting or in a room, so a page the browser discarded reopens the room by itself.
var KeepAlive = (function () {
  let audio = null, want = false, hiddenAt = 0, frozen = 0, last = Date.now(), title = '';
  const cbs = [];
  function wav() {
    const sr = 8000, n = sr * 2, b = new ArrayBuffer(44 + n * 2), d = new DataView(b);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
    d.setUint32(24, sr, true); d.setUint32(28, sr * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) d.setInt16(44 + i * 2, Math.round(32 * Math.sin(2 * Math.PI * 30 * i / sr)), true);   // 60 whole cycles: loops without a click
    return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  }
  function play() {
    if (!want) return;
    try {
      if (!audio) { audio = new Audio(); audio.loop = true; audio.preload = 'auto'; audio.setAttribute('playsinline', ''); audio.src = wav(); }
      const p = audio.play();
      if (p && p.catch) p.catch(() => arm());
    } catch (e) { arm(); }
    try {
      if ('mediaSession' in navigator && window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({ title, artist: location.hostname });
        navigator.mediaSession.playbackState = 'playing';
      }
    } catch (e) {}
  }
  let armed = false;
  function arm() {
    if (armed) return; armed = true;
    const go = () => { armed = false; ['pointerdown', 'keydown', 'touchend'].forEach(k => removeEventListener(k, go, true)); play(); };
    ['pointerdown', 'keydown', 'touchend'].forEach(k => addEventListener(k, go, true));
  }
  function fire(info) { for (const f of cbs.slice()) { try { f(info); } catch (e) { console.error(e); } } }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); frozen = 0; return; }
    const away = hiddenAt ? Date.now() - hiddenAt : 0; hiddenAt = 0;
    if (want && audio && audio.paused) play();
    fire({ away, frozen });
  });
  addEventListener('pageshow', e => { if (e.persisted) fire({ away: 60000, frozen: 60000 }); });
  addEventListener('online', () => fire({ away: 0, frozen: 0, online: true }));
  let lostSum = 0;
  setInterval(() => {
    const now = Date.now(), gap = now - last; last = now;
    if (gap > 3000) lostSum += gap - 1000;
    if (gap > 5000) { frozen = Math.max(frozen, gap); if (document.visibilityState === 'visible') fire({ away: gap, frozen: gap }); }
  }, 1000);
  const ls = (() => { try { return localStorage; } catch (e) { return null; } })();
  const ss = (() => { try { return sessionStorage; } catch (e) { return null; } })();
  return {
    hold(t) { title = t || title; if (want && audio && !audio.paused) { play(); return; } want = true; play(); },
    release() { want = false; try { audio && audio.pause(); } catch (e) {} try { if ('mediaSession' in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } } catch (e) {} },
    get holding() { return want && !!audio && !audio.paused; },
    onResume(f) { cbs.push(f); },
    // a clock and a setTimeout that stand still while the page is frozen (a turn timer shouldn't run out because the host was away)
    now() { return Date.now() - this.lost(); },
    later(fn, ms) {
      const due = this.now() + ms, h = { id: 0, cancel() { clearTimeout(h.id); h.id = -1; } };
      const go = () => { if (h.id === -1) return; const r = due - KeepAlive.now(); if (r > 20) h.id = setTimeout(go, r); else fn(); };
      h.id = setTimeout(go, ms);
      return h;
    },
    // total ms this page has spent frozen (counting a freeze that just ended but hasn't been noticed yet): turn clocks leave it out
    lost() { const g = Date.now() - last; return lostSum + (g > 3000 ? g - 1000 : 0); },
    token(id) {
      let m = {};
      try { m = JSON.parse(ls.getItem('mh_ptok') || '{}') || {}; } catch (e) {}
      const now = Date.now();
      for (const k in m) if (!m[k] || now - m[k].at > 7 * 86400e3) delete m[k];
      if (!m[id]) m[id] = { t: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) };
      m[id].at = now;
      try { ls.setItem('mh_ptok', JSON.stringify(m)); } catch (e) {}
      return m[id].t;
    },
    // a peer whose socket to the signalling server is really open
    live(peer) { const ws = peer && peer.socket && peer.socket._socket; return !!(peer && !peer.destroyed && !peer.disconnected && peer.open && ws && ws.readyState === 1); },
    mark(key, v) { try { if (v) ss.setItem(key, JSON.stringify(v)); else ss.removeItem(key); } catch (e) {} },
    marked(key) { try { return JSON.parse(ss.getItem(key) || 'null'); } catch (e) { return null; } },
  };
})();
