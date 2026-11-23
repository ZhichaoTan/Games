// ===== 快乐柴柴 Shiba Stack · sound: everything is synthesised with Web Audio (no sound files), plus a gentle loop of music =====
// prefs: on (the mute button in the top bar), sfx (sound effects), music, vib (vibration)
(function (G) {
  'use strict';
  const KEY = 'mh_sb_snd';
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
  // filtered noise: thumps, swishes, the hi-hat
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
  // the notes clears ring on (F major pentatonic); a combo walks up the scale
  const BELL = [65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89, 91, 93, 96];
  const bell = (n, t, o) => { tone(NOTE(n), t, (o && o.dur) || 0.5, { vol: (o && o.vol) || 0.13, type: 'triangle' }); tone(NOTE(n + 12), t, 0.3, { vol: 0.03 }); };
  const SFX = {
    tap: t => tone(880, t, 0.05, { vol: 0.11, type: 'triangle' }),
    move: t => tone(1250, t, 0.022, { vol: 0.04, type: 'triangle' }),
    rot: t => tone(700, t, 0.05, { f2: 960, vol: 0.07, type: 'triangle' }),
    drop: t => { noise(t, 0.12, { ft: 'lowpass', f: 520, f2: 140, vol: 0.3 }); tone(170, t, 0.14, { f2: 62, vol: 0.32 }); },
    lock: t => { tone(430, t, 0.06, { f2: 300, vol: 0.08, type: 'triangle' }); noise(t, 0.03, { ft: 'highpass', f: 3000, vol: 0.04 }); },
    hold: t => { noise(t, 0.15, { f: 900, f2: 2600, q: 1.4, vol: 0.1, a: 0.02 }); tone(520, t, 0.11, { f2: 780, vol: 0.05 }); },
    // a clear: n rows, c the combo count
    clear: (t, a) => {
      const n = (a && a.n) || 1, c = Math.min(6, Math.max(0, (a && a.c) || 0));
      for (let i = 0; i < n; i++) bell(BELL[c + i * 2], t + i * 0.06, { vol: 0.12 });
      noise(t, 0.25, { ft: 'highpass', f: 5000, vol: 0.035, a: 0.02 });
      if (n >= 4) { for (const [k, d] of [[BELL[Math.min(13, c + 7)], 0.26], [BELL[Math.min(13, c + 9)], 0.34]]) bell(k, t + d, { vol: 0.1, dur: 0.8 }); SFX.yip(t + 0.42); }
    },
    tspin: t => { noise(t, 0.2, { f: 700, f2: 3200, q: 2, vol: 0.12, a: 0.03 }); bell(79, t + 0.08, { vol: 0.1 }); bell(84, t + 0.16, { vol: 0.1 }); },
    b2b: t => { for (let k = 0; k < 4; k++) tone(NOTE(96 + [0, 4, 7, 12][k]), t + k * 0.045, 0.35, { vol: 0.035, vib: 7, vibAmt: 12 }); },
    pc: t => { [[72, 0], [77, 0.1], [81, 0.2], [84, 0.32], [89, 0.46]].forEach(([n, d]) => bell(n, t + d, { vol: 0.12, dur: 0.9 })); SFX.yip(t + 0.6); },
    // a puppy yip: up, then a little down
    yip: t => { tone(880, t, 0.08, { f2: 1480, vol: 0.09, type: 'sine', vib: 30, vibAmt: 40 }); tone(1320, t + 0.085, 0.13, { f2: 760, vol: 0.08, type: 'sine' }); },
    incoming: t => { tone(NOTE(57), t, 0.12, { vol: 0.08, type: 'square' }); tone(NOTE(53), t + 0.13, 0.16, { vol: 0.07, type: 'square' }); },
    bubbles: t => { noise(t, 0.32, { ft: 'lowpass', f: 180, f2: 520, vol: 0.22, a: 0.04 }); tone(80, t, 0.3, { f2: 140, vol: 0.16 }); for (let k = 0; k < 3; k++) tone(500 + k * 160, t + 0.05 + k * 0.06, 0.06, { f2: 900 + k * 200, vol: 0.03 }); },
    lvup: t => { [[72, 0], [76, 0.07], [79, 0.14], [84, 0.21]].forEach(([n, d]) => tone(NOTE(n), t + d, 0.25, { vol: 0.09, type: 'triangle' })); },
    count: t => tone(660, t, 0.14, { vol: 0.12, type: 'triangle' }),
    go: t => { tone(NOTE(84), t, 0.4, { vol: 0.12, type: 'triangle' }); tone(NOTE(88), t, 0.4, { vol: 0.08, type: 'triangle' }); tone(NOTE(91), t, 0.5, { vol: 0.06 }); },
    send: t => { tone(600, t, 0.16, { f2: 1500, vol: 0.06 }); noise(t, 0.16, { f: 1500, f2: 4000, q: 2, vol: 0.05 }); },
    ko: t => { tone(700, t, 0.12, { f2: 220, vol: 0.18, type: 'triangle' }); bell(84, t + 0.1, { vol: 0.08 }); bell(88, t + 0.17, { vol: 0.07 }); },
    out: t => { tone(520, t, 0.7, { f2: 130, vol: 0.16, type: 'triangle' }); noise(t + 0.1, 0.5, { ft: 'lowpass', f: 600, f2: 150, vol: 0.08 }); },
    win: t => { [[72, 0], [76, 0.12], [79, 0.24], [84, 0.38], [88, 0.52]].forEach(([n, d]) => tone(NOTE(n), t + d, 0.7, { vol: 0.13, type: 'triangle' })); tone(NOTE(60), t + 0.38, 1.4, { vol: 0.08 }); SFX.yip(t + 0.8); },
    lose: t => { [[67, 0], [64, 0.2], [60, 0.4]].forEach(([n, d]) => tone(NOTE(n), t + d, 0.6, { vol: 0.12, type: 'triangle' })); },
    best: t => { [[77, 0], [81, 0.1], [84, 0.2], [89, 0.34]].forEach(([n, d]) => bell(n, t + d, { vol: 0.11, dur: 0.8 })); },
    chat: t => tone(1046, t, 0.12, { vol: 0.08 }),
    aim: t => { tone(1320, t, 0.05, { vol: 0.07, type: 'triangle' }); tone(1760, t + 0.05, 0.07, { vol: 0.06, type: 'triangle' }); },
  };
  function play(k, delay, arg) {
    if (!prefs.on || !prefs.sfx) return;
    const c = ac(); if (!c || !SFX[k]) return;
    if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
    try { SFX[k](c.currentTime + 0.005 + (delay || 0) / 1000, arg); } catch (e) {}
  }
  function vibrate(p) { if (!prefs.vib) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function set(k, v) { prefs[k] = v; try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} music.check(); }

  // ---------- music: an original eight-bar tune over F, Dm, B♭, C, one eighth note per step ----------
  // melody: [step, note, length in steps]; bass roots per bar; chords for the soft plucks
  const MEL = [
    [0, 72, 2], [2, 69, 1], [3, 72, 1], [4, 74, 2], [6, 72, 2],
    [8, 69, 3], [11, 67, 1], [12, 69, 2], [14, 65, 2],
    [16, 74, 2], [18, 72, 1], [19, 74, 1], [20, 77, 2], [22, 74, 2],
    [24, 72, 3], [27, 69, 1], [28, 67, 4],
    [32, 69, 1], [33, 72, 1], [34, 77, 2], [36, 79, 1], [37, 77, 1], [38, 74, 2],
    [40, 77, 2], [42, 74, 1], [43, 72, 1], [44, 69, 4],
    [48, 74, 2], [50, 77, 2], [52, 79, 1], [53, 77, 1], [54, 74, 2],
    [56, 72, 2], [58, 67, 2], [60, 72, 1], [61, 74, 1], [62, 76, 2],
  ];
  const ROOT = [41, 38, 46, 48];
  const CHORD = [[65, 69, 72], [62, 65, 69], [62, 65, 70], [64, 67, 72]];
  const mel = new Map(MEL.map(m => [m[0], m]));
  const music = (() => {
    let want = false, iv = 0, step = 0, at = 0, bpm = 100;
    const sec = () => 30 / bpm;   // one eighth note
    function note(i, t) {
      const bar = Math.floor(i / 8) % 4, s8 = i % 8, out = muBus, d = sec();
      const m = mel.get(i % 64);
      if (m) { tone(NOTE(m[1]), t, d * m[2] + 0.25, { vol: 0.1, type: 'triangle', a: 0.012, out }); tone(NOTE(m[1] + 12), t, d * m[2] * 0.6 + 0.1, { vol: 0.018, a: 0.012, out }); }
      if (s8 === 0) tone(NOTE(ROOT[bar]), t, d * 3.2, { vol: 0.16, type: 'triangle', a: 0.01, out });
      if (s8 === 4) tone(NOTE(ROOT[bar] + 7), t, d * 2.6, { vol: 0.1, type: 'triangle', a: 0.01, out });
      if (s8 === 2 || s8 === 6) for (const n of CHORD[bar]) tone(NOTE(n), t, d * 1.4, { vol: 0.022, a: 0.008, out });
      if (s8 % 2 === 1) noise(t, 0.03, { ft: 'highpass', f: 7500, vol: 0.016, out });
    }
    function pump() {
      if (!ctx) return;
      if (at < ctx.currentTime) at = ctx.currentTime + 0.06;
      while (at < ctx.currentTime + 0.3) { note(step, at); step = (step + 1) % 64; at += sec(); }
    }
    function on() { return want && prefs.on && prefs.music && !(G.document && G.document.hidden); }
    function check() {
      const c = ctx || (want ? ac() : null); if (!c) return;
      const go = on();
      const g = muBus.gain, now = c.currentTime;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(go ? 0.36 : 0, now + (go ? 0.6 : 0.25));
      if (go && !iv) { at = 0; iv = setInterval(pump, 60); pump(); }
      if (!go && iv) { const k = iv; setTimeout(() => { if (!on()) { clearInterval(k); if (iv === k) iv = 0; } }, 300); }
    }
    if (G.document) G.document.addEventListener('visibilitychange', () => check());
    return {
      start(fresh) { want = true; if (fresh) step = 0; check(); },
      stop() { want = false; check(); },
      tempo(level) { bpm = 100 + Math.min(14, Math.max(0, (level || 1) - 1)) * 2.5; },
      get playing() { return on(); },
      check,
    };
  })();
  G.SBSound = { play, vibrate, set, unlock, music, get prefs() { return prefs; }, KINDS: Object.keys(SFX) };
})(typeof window !== 'undefined' ? window : globalThis);
