// ===== Cipher sound: the recorded tile clicks the mahjong game ships (mahjong/src/sfx.js, Kenney CC0) plus WebAudio bells and thuds =====
(function (G) {
  'use strict';
  const KEY = 'cx_snd';
  const P = Object.assign({ on: true, vib: true }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };
  let ctx = null, out = null, nbuf = null;
  function ac() {
    if (ctx) { if (ctx.state === 'suspended' && P.on) ctx.resume().catch(() => {}); return ctx; }
    const AC = G.AudioContext || G.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    out = ctx.createGain(); out.gain.value = P.on ? 0.8 : 0;
    out.connect(comp); comp.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 0.6);
    nbuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const SFX = G.MJ_SFX || {};
    for (const k in SFX) {
      try {
        const bin = atob(SFX[k]), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const r = ctx.decodeAudioData(u8.buffer, b => { BUF[k] = b; }, () => {});
        if (r && r.catch) r.catch(() => {});
      } catch (e) {}
    }
    return ctx;
  }
  const BUF = {};
  const any = (...ks) => ks[Math.floor(Math.random() * ks.length)];
  function rec(k, t0, v, rate) {
    const b = BUF[k]; if (!b) return false;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; src.playbackRate.value = rate || 0.95 + Math.random() * 0.1;
    g.gain.value = v == null ? 1 : v;
    src.connect(g); g.connect(out); src.start(t0);
    return true;
  }
  function tone(f, t0, dur, o) {
    o = o || {};
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const v = o.v == null ? 0.2 : o.v, a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(out);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, o) {
    o = o || {};
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = nbuf;
    f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 2400, t0); f.Q.value = o.q || 2;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v == null ? 0.3 : o.v, t0 + (o.a || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t0, Math.random() * 0.3); src.stop(t0 + dur + 0.02);
  }
  function clack(t0, k) {
    k = k == null ? 1 : k;
    const j = 0.92 + Math.random() * 0.16;
    noise(t0, 0.05 * (0.7 + k * 0.3), { f: 2600 * j, q: 2.2, v: 0.5 * k });
    tone(1750 * j, t0, 0.035, { v: 0.16 * k, type: 'triangle' });
    tone(210 * j, t0, 0.06, { v: 0.22 * k });
  }
  const bell = (f, t0, dur, v) => { tone(f, t0, dur, { v, type: 'sine' }); tone(f * 2.01, t0, dur * 0.6, { v: v * 0.35 }); tone(f * 3.02, t0, dur * 0.3, { v: v * 0.15 }); };
  const FX = {
    tap(t) { tone(900, t, 0.04, { v: 0.05, type: 'triangle' }); },
    select(t) { if (!rec('flip-1', t, 0.2, 1.2)) tone(1500, t, 0.03, { v: 0.06, type: 'triangle' }); },
    draw(t) { if (!rec(any('pick-1', 'pick-2'), t, 0.5)) clack(t, 0.35); },
    place(t) { if (!rec(any('place-1', 'place-2', 'place-3'), t, 0.85)) clack(t, 0.9); },
    deal(t) {
      if (rec('shuffle-1', t, 0.7)) { for (let i = 0; i < 4; i++) rec(any('pick-1', 'pick-2'), t + 0.75 + i * 0.11, 0.3); return; }
      for (let i = 0; i < 6; i++) clack(t + i * 0.08, 0.25 + Math.random() * 0.2);
    },
    // a guess goes in: a soft tick while everyone holds their breath
    guess(t) { tone(740, t, 0.09, { v: 0.05, type: 'triangle' }); tone(988, t + 0.11, 0.09, { v: 0.04, type: 'triangle' }); },
    hit(t) {
      rec('flip-1', t, 0.8);
      [1047, 1319, 1568].forEach((f, i) => bell(f, t + 0.03 + i * 0.07, 0.7, 0.09));
      tone(196, t, 0.5, { v: 0.14 });
    },
    miss(t) { tone(196, t, 0.32, { v: 0.2, type: 'triangle', to: 131 }); noise(t, 0.12, { f: 420, q: 1.2, v: 0.12 }); },
    flip(t) { if (!rec('flip-1', t, 0.7, 0.9)) clack(t, 0.6); },
    out(t) { [523, 440, 349, 262].forEach((f, i) => tone(f, t + i * 0.12, 0.3, { v: 0.07, type: 'triangle' })); },
    turn(t) { bell(1319, t, 0.3, 0.05); bell(1760, t + 0.08, 0.4, 0.04); },
    tick(t) { tone(1900, t, 0.04, { v: 0.06, type: 'square' }); },
    win(t) { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => bell(f, t + i * 0.09, 1.1, 0.09)); tone(131, t, 1.6, { v: 0.16 }); rec('win-1', t + 0.05, 0.7); },
    end(t) { [523, 659, 784].forEach((f, i) => bell(f, t + i * 0.1, 0.8, 0.07)); },
    ping(t) { bell(1175, t, 0.4, 0.06); bell(1568, t + 0.09, 0.5, 0.05); },
  };
  let gestured = false;
  function play(k, delay) {
    if (!P.on || !gestured || !ac() || !FX[k]) return;
    try { FX[k](ctx.currentTime + 0.005 + (delay || 0)); } catch (e) {}
  }
  function vib(p) { if (!P.vib || !gestured) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
  function mute(m) {
    if (!ctx || !out) return;
    try { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(m ? 0 : 0.8, ctx.currentTime); } catch (e) { out.gain.value = m ? 0 : 0.8; }
    if (m) { try { ctx.suspend(); } catch (e) {} } else if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} }
  }
  // iOS wants the sound started inside a tap
  let unlocked = false;
  function unlock() {
    gestured = true;
    if (unlocked) return;
    if (ac()) {
      try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
      unlocked = ctx.state === 'running';
    }
  }
  if (G.document) ['pointerdown', 'touchend', 'keydown'].forEach(k => G.document.addEventListener(k, unlock, { passive: true }));
  G.CXSound = { play, vib, unlock, prefs: P, set(k, v) { P[k] = v; save(); if (k === 'on') { mute(!v); if (v) unlock(); } } };
})(typeof window !== 'undefined' ? window : globalThis);
