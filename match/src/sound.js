// ===== 萌宠消消乐 Puffy Pals / 团团圆圆 Mochi Moon · sound: everything is synthesised with Web Audio (no sound files), plus a festive loop of music =====
// prefs: on (the mute button in the top bar), sfx (sound effects), music, vib (vibration)
(function (G) {
  'use strict';
  const KEY = 'mh_tt_snd';
  let prefs = { on: true, sfx: true, music: true, vib: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  let ctx = null, master = null, fxBus = null, muBus = null, noiseBuf = null;
  function ac() {
    if (ctx) return ctx;
    const C = G.AudioContext || G.webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
      master = ctx.createGain(); master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      fxBus = ctx.createGain(); fxBus.connect(master);
      muBus = ctx.createGain(); muBus.gain.value = 0; muBus.connect(master);
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
    if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.glide || dur));
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibAmt || f * 0.05; l.connect(lg); lg.connect(os.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    const v = o.vol == null ? 0.3 : o.vol, a = o.a || 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    os.connect(g); g.connect(o.out || fxBus);
    os.start(t0); os.stop(t0 + dur + 0.05);
  }
  // filtered noise: pops, whooshes, crackles, the woodblock
  function noise(t0, dur, o) {
    o = o || {};
    const c = ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; s.loop = true;
    fl.type = o.ft || 'bandpass'; fl.Q.value = o.q || 1;
    fl.frequency.setValueAtTime(o.f || 1200, t0);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    const v = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(o.out || fxBus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  // pops ring on the D major pentatonic; each wave of a chain climbs the scale
  const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88, 90, 93, 95, 98];
  const pluck = (n, t, o) => { o = o || {}; tone(NOTE(n), t, o.dur || 0.42, { vol: o.vol || 0.11, type: 'triangle', a: 0.004 }); tone(NOTE(n + 12), t, 0.18, { vol: (o.vol || 0.11) * 0.25, a: 0.003 }); };
  const SFX = {
    tap: t => tone(880, t, 0.05, { vol: 0.1, type: 'triangle' }),
    pick: t => { tone(620, t, 0.07, { f2: 820, vol: 0.08, type: 'triangle' }); },
    swap: t => { noise(t, 0.09, { f: 1400, f2: 2600, q: 1.2, vol: 0.06, a: 0.01 }); tone(520, t, 0.08, { f2: 700, vol: 0.05, type: 'triangle' }); },
    bad: t => { tone(300, t, 0.1, { f2: 240, vol: 0.12, type: 'triangle' }); tone(260, t + 0.11, 0.14, { f2: 200, vol: 0.1, type: 'triangle' }); },
    // a match popping: w is the wave of the chain (0 for the first)
    pop: (t, a) => {
      const w = Math.min(10, (a && a.w) || 0), n = PENTA[Math.min(PENTA.length - 1, 3 + w)];
      noise(t, 0.06, { ft: 'bandpass', f: 1800 + w * 200, q: 2.2, vol: 0.16 });
      tone(NOTE(n) * 0.5, t, 0.08, { f2: NOTE(n), vol: 0.12, type: 'sine', glide: 0.05 });
      pluck(n, t + 0.02, { vol: 0.09 });
      if (a && a.big) pluck(n + 7, t + 0.08, { vol: 0.08 });
    },
    // a special made: a little sparkle up
    make: t => { [0, 1, 2, 3].forEach(k => tone(NOTE(PENTA[6 + k * 2]), t + k * 0.05, 0.28, { vol: 0.05, type: 'triangle', vib: 9, vibAmt: 8 })); },
    rocket: t => { noise(t, 0.42, { f: 600, f2: 4200, q: 1.6, vol: 0.2, a: 0.02 }); tone(300, t, 0.4, { f2: 1400, vol: 0.06, type: 'sawtooth' }); },
    boom: t => { noise(t, 0.5, { ft: 'lowpass', f: 900, f2: 90, vol: 0.45, a: 0.004 }); tone(120, t, 0.42, { f2: 40, vol: 0.4 }); for (let k = 0; k < 5; k++) noise(t + 0.06 + k * 0.05, 0.04, { ft: 'highpass', f: 3000 + k * 400, vol: 0.06 }); },
    lantern: t => { noise(t, 0.14, { ft: 'lowpass', f: 700, f2: 200, vol: 0.25 }); tone(420, t + 0.08, 0.5, { f2: 980, vol: 0.06, type: 'sine', vib: 6, vibAmt: 10 }); },
    land: t => { tone(980, t, 0.12, { f2: 520, vol: 0.08, type: 'triangle' }); },
    firework: t => { noise(t, 0.3, { f: 2000, f2: 5000, q: 1, vol: 0.18, a: 0.01 }); for (let k = 0; k < 9; k++) noise(t + 0.2 + k * 0.045 + Math.random() * 0.02, 0.05, { ft: 'highpass', f: 2500 + Math.random() * 3000, vol: 0.09 }); [86, 90, 93, 98].forEach((n, k) => tone(NOTE(n), t + 0.25 + k * 0.06, 0.4, { vol: 0.04, type: 'triangle' })); },
    combo: t => { SFX.boom(t); [74, 78, 81, 86, 90].forEach((n, k) => pluck(n, t + 0.12 + k * 0.06, { vol: 0.09, dur: 0.6 })); },
    frost: t => { for (let k = 0; k < 3; k++) tone(2400 + k * 500 + Math.random() * 300, t + k * 0.025, 0.12, { vol: 0.035, type: 'sine' }); noise(t, 0.12, { ft: 'highpass', f: 5000, vol: 0.06 }); },
    cage: t => { noise(t, 0.07, { f: 900, q: 6, vol: 0.2 }); noise(t + 0.06, 0.06, { f: 700, q: 6, vol: 0.14 }); tone(330, t, 0.08, { vol: 0.08, type: 'square' }); },
    box: t => { noise(t, 0.16, { f: 1600, f2: 3500, q: 0.8, vol: 0.16, a: 0.01 }); tone(700, t + 0.04, 0.08, { f2: 1100, vol: 0.05, type: 'triangle' }); },
    ingot: t => { [88, 93, 98].forEach((n, k) => tone(NOTE(n), t + k * 0.07, 0.5, { vol: 0.07, type: 'triangle' })); tone(NOTE(100), t + 0.22, 0.7, { vol: 0.04 }); },
    hammer: t => { noise(t, 0.1, { ft: 'lowpass', f: 1200, f2: 300, vol: 0.35 }); tone(180, t, 0.18, { f2: 80, vol: 0.3, type: 'triangle' }); },
    shuffle: t => { for (let k = 0; k < 6; k++) noise(t + k * 0.07, 0.07, { f: 1800 + k * 300, q: 3, vol: 0.06 }); },
    caged: t => { noise(t, 0.08, { f: 800, q: 5, vol: 0.2 }); noise(t + 0.12, 0.08, { f: 650, q: 5, vol: 0.18 }); tone(220, t, 0.25, { f2: 160, vol: 0.1, type: 'triangle' }); },
    send: t => { tone(600, t, 0.16, { f2: 1500, vol: 0.06 }); noise(t, 0.16, { f: 1500, f2: 4000, q: 2, vol: 0.05 }); },
    star: (t, a) => { const k = (a && a.n) || 0; pluck([81, 86, 90][Math.min(2, k)], t, { vol: 0.12, dur: 0.7 }); tone(NOTE([93, 98, 102][Math.min(2, k)]), t + 0.03, 0.5, { vol: 0.03, vib: 8, vibAmt: 10 }); },
    spark: t => tone(1600 + Math.random() * 600, t, 0.06, { vol: 0.03, type: 'triangle' }),
    tick: t => { noise(t, 0.03, { f: 3200, q: 8, vol: 0.12 }); },
    count: t => { noise(t, 0.05, { f: 1400, q: 9, vol: 0.2 }); tone(660, t, 0.14, { vol: 0.08, type: 'triangle' }); },
    go: t => { [74, 78, 81, 86].forEach((n, k) => pluck(n, t + k * 0.05, { vol: 0.1, dur: 0.5 })); },
    win: t => { [[74, 0], [78, 0.12], [81, 0.24], [86, 0.38], [90, 0.52], [93, 0.66]].forEach(([n, d]) => pluck(n, t + d, { vol: 0.12, dur: 0.8 })); tone(NOTE(62), t + 0.38, 1.4, { vol: 0.07 }); },
    lose: t => { [[69, 0], [66, 0.2], [62, 0.4]].forEach(([n, d]) => tone(NOTE(n), t + d, 0.6, { vol: 0.12, type: 'triangle' })); },
    best: t => { [[81, 0], [86, 0.1], [90, 0.2], [93, 0.34]].forEach(([n, d]) => pluck(n, t + d, { vol: 0.11, dur: 0.8 })); },
    chat: t => tone(1046, t, 0.12, { vol: 0.08 }),
  };
  function play(k, delay, arg) {
    if (!prefs.on || !prefs.sfx) return;
    const c = ac(); if (!c || !SFX[k]) return;
    if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
    try { SFX[k](c.currentTime + 0.005 + (delay || 0) / 1000, arg); } catch (e) {}
  }
  function vibrate(p) { if (!prefs.vib) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function set(k, v) { prefs[k] = v; try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} music.check(); }

  // ---------- music: an original sixteen-bar tune on the D major pentatonic, plucked like a zither, with a woodblock ----------
  // melody: [step, note, length in eighths]; bass roots per bar; open fifths for the soft chords
  const MEL = [
    [0, 74, 2], [2, 76, 1], [3, 78, 1], [4, 81, 3], [7, 78, 1],
    [8, 76, 2], [10, 74, 1], [11, 71, 1], [12, 74, 4],
    [16, 78, 2], [18, 81, 1], [19, 83, 1], [20, 86, 2], [22, 83, 1], [23, 81, 1],
    [24, 78, 3], [27, 76, 1], [28, 78, 4],
    [32, 81, 2], [34, 78, 1], [35, 81, 1], [36, 83, 2], [38, 81, 2],
    [40, 78, 1], [41, 76, 1], [42, 74, 2], [44, 71, 2], [46, 74, 2],
    [48, 76, 2], [50, 78, 1], [51, 81, 1], [52, 78, 1], [53, 76, 1], [54, 74, 2],
    [56, 71, 2], [58, 69, 2], [60, 74, 4],
    [64, 86, 2], [66, 83, 1], [67, 81, 1], [68, 83, 3], [71, 86, 1],
    [72, 88, 2], [74, 86, 1], [75, 83, 1], [76, 81, 4],
    [80, 78, 1], [81, 81, 1], [82, 83, 2], [84, 81, 1], [85, 78, 1], [86, 76, 2],
    [88, 78, 3], [91, 81, 1], [92, 76, 4],
    [96, 74, 1], [97, 76, 1], [98, 78, 2], [100, 81, 2], [102, 83, 2],
    [104, 86, 3], [107, 83, 1], [108, 81, 4],
    [112, 78, 2], [114, 76, 1], [115, 74, 1], [116, 71, 2], [118, 76, 2],
    [120, 74, 6],
  ];
  const ROOT = [50, 47, 43, 45, 50, 47, 43, 45, 47, 43, 50, 45, 50, 43, 45, 50];
  const mel = new Map(MEL.map(m => [m[0], m]));
  const music = (() => {
    let want = false, iv = 0, step = 0, at = 0, bpm = 96;
    const sec = () => 30 / bpm;   // one eighth note
    function note(i, t) {
      const bar = Math.floor(i / 8) % 16, s8 = i % 8, out = muBus, d = sec();
      const m = mel.get(i % 128);
      if (m) { tone(NOTE(m[1]), t, d * m[2] + 0.3, { vol: 0.09, type: 'triangle', a: 0.004, out }); tone(NOTE(m[1] + 12), t, 0.16, { vol: 0.02, a: 0.003, out }); }
      const r = ROOT[bar];
      if (s8 === 0) tone(NOTE(r), t, d * 3.4, { vol: 0.15, type: 'triangle', a: 0.01, out });
      if (s8 === 4) tone(NOTE(r + 7), t, d * 2.6, { vol: 0.09, type: 'triangle', a: 0.01, out });
      if (s8 === 2 || s8 === 6) for (const n of [r + 12, r + 19, r + 24]) tone(NOTE(n), t, d * 1.2, { vol: 0.016, a: 0.006, out });
      // the woodblock on the beats, a softer tap off the beat
      if (s8 % 2 === 0) noise(t, 0.05, { f: s8 === 0 ? 1100 : 1500, q: 10, vol: s8 === 0 ? 0.07 : 0.045, out });
      else if (s8 === 7) noise(t, 0.03, { f: 1900, q: 10, vol: 0.025, out });
      if (s8 === 0 && bar % 4 === 0) noise(t, 0.5, { ft: 'highpass', f: 6000, vol: 0.02, a: 0.01, out });
    }
    function pump() {
      if (!ctx) return;
      if (at < ctx.currentTime) at = ctx.currentTime + 0.06;
      while (at < ctx.currentTime + 0.3) { note(step, at); step = (step + 1) % 128; at += sec(); }
    }
    function on() { return want && prefs.on && prefs.music && !(G.document && G.document.hidden); }
    function check() {
      const c = ctx || (want ? ac() : null); if (!c) return;
      const go = on();
      const g = muBus.gain, now = c.currentTime;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(go ? 0.34 : 0, now + (go ? 0.6 : 0.25));
      if (go && !iv) { at = 0; iv = setInterval(pump, 60); pump(); }
      if (!go && iv) { const k = iv; setTimeout(() => { if (!on()) { clearInterval(k); if (iv === k) iv = 0; } }, 300); }
    }
    if (G.document) G.document.addEventListener('visibilitychange', () => check());
    return {
      start(fresh) { want = true; if (fresh) step = 0; check(); },
      stop() { want = false; check(); },
      tempo(fast) { bpm = fast ? 112 : 96; },
      get playing() { return on(); },
      check,
    };
  })();
  G.MMSound = { play, vibrate, set, unlock, music, get prefs() { return prefs; }, KINDS: Object.keys(SFX) };
})(typeof window !== 'undefined' ? window : globalThis);
