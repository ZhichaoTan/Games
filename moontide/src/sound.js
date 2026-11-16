// ===== 沉岛 Moontide · sound: everything is synthesised with Web Audio, no sound files =====
(function (G) {
  'use strict';
  const KEY = 'mh_cd_snd';
  let prefs = { on: true, vib: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  let ctx = null, master = null, noiseBuf = null;
  function ac() {
    if (ctx) return ctx;
    const C = G.AudioContext || G.webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
      master = ctx.createGain(); master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
    return ctx;
  }
  function unlock() { const c = ac(); if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} } }
  if (G.document) for (const ev of ['pointerdown', 'keydown', 'touchend']) G.document.addEventListener(ev, unlock, { passive: true });

  // a tone with an attack/decay envelope; f can glide to f2
  function tone(f, t0, dur, o) {
    o = o || {};
    const c = ctx, os = c.createOscillator(), g = c.createGain();
    os.type = o.type || 'sine';
    os.frequency.setValueAtTime(f, t0);
    if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibAmt || f * 0.06; l.connect(lg); lg.connect(os.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    const v = o.vol == null ? 0.3 : o.vol, a = o.a || 0.006;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    os.connect(g); g.connect(o.out || master);
    os.start(t0); os.stop(t0 + dur + 0.05);
  }
  // filtered noise: splashes, rumbles, oars
  function noise(t0, dur, o) {
    o = o || {};
    const c = ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; s.loop = true;
    fl.type = o.ft || 'bandpass'; fl.Q.value = o.q || 1;
    fl.frequency.setValueAtTime(o.f || 1200, t0);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    const v = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.a || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const SFX = {
    tap: t => tone(880, t, 0.05, { vol: 0.12, type: 'triangle' }),
    sel: t => { tone(660, t, 0.06, { vol: 0.13, type: 'triangle' }); tone(990, t + 0.04, 0.07, { vol: 0.1, type: 'triangle' }); },
    step: t => { tone(540, t, 0.09, { f2: 360, vol: 0.2, type: 'triangle' }); noise(t, 0.05, { f: 2400, q: 2, vol: 0.05 }); },
    board: t => { tone(320, t, 0.12, { f2: 220, vol: 0.2, type: 'triangle' }); noise(t + 0.02, 0.12, { f: 700, q: 1.5, vol: 0.08 }); },
    oar: t => { noise(t, 0.34, { ft: 'bandpass', f: 420, f2: 980, q: 1.2, vol: 0.16, a: 0.08 }); tone(180, t + 0.05, 0.2, { f2: 140, vol: 0.06 }); },
    swim: t => { noise(t, 0.28, { f: 1600, f2: 700, q: 1.4, vol: 0.18, a: 0.02 }); tone(300, t, 0.12, { f2: 520, vol: 0.06 }); },
    splash: t => { noise(t, 0.5, { f: 1800, f2: 500, q: 0.9, vol: 0.28, a: 0.01 }); noise(t + 0.06, 0.35, { ft: 'lowpass', f: 600, vol: 0.12 }); },
    safe: t => { for (const [n, d] of [[84, 0], [88, 0.09], [91, 0.18]]) tone(NOTE(n), t + d, 1.1, { vol: 0.11 }); tone(NOTE(96), t + 0.27, 1.3, { vol: 0.07 }); },
    sink: t => { noise(t, 1.0, { ft: 'lowpass', f: 240, f2: 90, vol: 0.32, a: 0.12 }); tone(70, t, 0.9, { f2: 42, vol: 0.18, type: 'sine' }); },
    flip: t => { noise(t, 0.07, { ft: 'highpass', f: 2600, vol: 0.12 }); tone(1200, t + 0.02, 0.05, { vol: 0.05, type: 'triangle' }); },
    good: t => { for (const [n, d] of [[72, 0], [76, 0.08], [79, 0.16], [84, 0.26]]) tone(NOTE(n), t + d, 0.4, { vol: 0.12, type: 'triangle' }); },
    bad: t => { tone(NOTE(45), t, 0.32, { vol: 0.2, type: 'sawtooth', f2: NOTE(44) }); tone(NOTE(41), t + 0.36, 0.5, { vol: 0.22, type: 'sawtooth', f2: NOTE(40) }); noise(t, 0.6, { ft: 'lowpass', f: 300, vol: 0.06 }); },
    wobble: t => tone(260, t, 0.7, { vib: 9, vibAmt: 40, vol: 0.18, type: 'triangle', f2: 200 }),
    meh: t => tone(420, t, 0.18, { f2: 300, vol: 0.08 }),
    reef: t => { tone(NOTE(69), t, 0.35, { vol: 0.16, type: 'triangle' }); tone(NOTE(76), t + 0.08, 0.4, { vol: 0.1, type: 'triangle' }); },
    chomp: t => { noise(t, 0.12, { ft: 'lowpass', f: 900, vol: 0.3 }); tone(220, t, 0.25, { f2: 55, vol: 0.32, type: 'square' }); noise(t + 0.14, 0.12, { ft: 'lowpass', f: 700, vol: 0.22 }); },
    grab: t => { tone(170, t, 0.75, { vib: 22, vibAmt: 50, vol: 0.2, f2: 90 }); noise(t + 0.25, 0.5, { f: 900, f2: 300, vol: 0.18 }); },
    shove: t => { noise(t, 0.12, { ft: 'lowpass', f: 500, vol: 0.32 }); tone(150, t, 0.14, { f2: 80, vol: 0.2, type: 'triangle' }); },
    die: t => { for (let k = 0; k < 5; k++) { noise(t + k * 0.055, 0.04, { ft: 'highpass', f: 1800 + k * 300, vol: 0.09 }); tone(900 + Math.random() * 500, t + k * 0.055, 0.03, { vol: 0.04, type: 'square' }); } },
    turn: t => { tone(NOTE(67), t, 1.3, { vol: 0.16 }); tone(NOTE(79), t, 1.1, { vol: 0.07 }); tone(NOTE(74), t + 0.14, 1.2, { vol: 0.1 }); },
    dolphin: t => { tone(1400, t, 0.12, { f2: 2400, vol: 0.06 }); tone(1800, t + 0.13, 0.12, { f2: 2800, vol: 0.05 }); SFX.good(t + 0.2); },
    win: t => { [[72, 0], [76, 0.12], [79, 0.24], [84, 0.38], [88, 0.52]].forEach(([n, d]) => tone(NOTE(n), t + d, 0.7, { vol: 0.13, type: 'triangle' })); tone(NOTE(60), t + 0.38, 1.4, { vol: 0.08 }); },
    lose: t => { [[67, 0], [64, 0.2], [60, 0.4]].forEach(([n, d]) => tone(NOTE(n), t + d, 0.6, { vol: 0.12, type: 'triangle' })); },
    chat: t => tone(1046, t, 0.12, { vol: 0.08 }),
  };
  function play(k, delay) {
    if (!prefs.on) return;
    const c = ac(); if (!c || !SFX[k]) return;
    if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
    try { SFX[k](c.currentTime + 0.01 + (delay || 0) / 1000); } catch (e) {}
  }
  function vibrate(p) { if (!prefs.vib) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function set(k, v) { prefs[k] = v; try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} }
  G.MTSound = { play, vibrate, set, unlock, get prefs() { return prefs; }, KINDS: Object.keys(SFX) };
})(typeof window !== 'undefined' ? window : globalThis);
