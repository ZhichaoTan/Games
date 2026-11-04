// ===== 声音：录好的牌声（sfx.js，Kenney CC0）+ WebAudio 合成的铃声，加上可选的语音播报。录音解不开时退回合成的牌声 =====
(function (G) {
  'use strict';
  const KEY = 'mj_snd';
  const P = Object.assign({ on: true, voice: true, call: false, vib: true }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };
  let ctx = null, out = null, nbuf = null;

  function ac() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = G.AudioContext || G.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    out = ctx.createGain(); out.gain.value = 0.8;
    out.connect(comp); comp.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 0.6);
    nbuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    loadSfx();
    return ctx;
  }
  // ----- 录音：第一次出声时解码 -----
  const SFX = G.MJ_SFX || {}, BUF = {};
  function loadSfx() {
    for (const k in SFX) {
      try {
        const bin = atob(SFX[k]), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const r = ctx.decodeAudioData(u8.buffer, b => { BUF[k] = b; }, () => {});
        if (r && r.catch) r.catch(() => {});
      } catch (e) {}
    }
  }
  const any = (...ks) => ks[Math.floor(Math.random() * ks.length)];
  // 放一段录音；没解码好就返回 false，让调用的地方用合成的声音
  function rec(k, t0, v, rate) {
    const b = BUF[k]; if (!b) return false;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; src.playbackRate.value = rate || 0.95 + Math.random() * 0.1;
    g.gain.value = v == null ? 1 : v;
    src.connect(g); g.connect(out); src.start(t0);
    return true;
  }
  // 单个音：频率 f，从 t0 开始，dur 秒衰减完
  function tone(f, t0, dur, o) {
    o = o || {};
    const c = ctx, osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const v = o.v == null ? 0.2 : o.v, a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.dest || out);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, o) {
    o = o || {};
    const c = ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = nbuf;
    f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 2400, t0); f.Q.value = o.q || 2;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const v = o.v == null ? 0.3 : o.v;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.a || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t0, Math.random() * 0.3); src.stop(t0 + dur + 0.02);
  }
  // 牌碰桌面：一声脆响 + 一点木头的闷声
  function clack(t0, k) {
    k = k == null ? 1 : k;
    const j = 0.92 + Math.random() * 0.16;
    noise(t0, 0.05 * (0.7 + k * 0.3), { f: 2600 * j, q: 2.2, v: 0.5 * k });
    tone(1750 * j, t0, 0.035, { v: 0.16 * k, type: 'triangle' });
    tone(3300 * j, t0, 0.025, { v: 0.07 * k });
    tone(210 * j, t0, 0.06, { v: 0.22 * k });
  }
  const bell = (f, t0, dur, v) => { tone(f, t0, dur, { v, type: 'sine' }); tone(f * 2.01, t0, dur * 0.6, { v: v * 0.35 }); tone(f * 3.02, t0, dur * 0.3, { v: v * 0.15 }); };
  const FX = {
    discard(t) { if (!rec(any('place-1', 'place-2', 'place-3'), t, 0.95)) clack(t, 1); },
    draw(t) { if (!rec(any('pick-1', 'pick-2'), t, 0.42)) clack(t, 0.32); },
    select(t) { if (!rec('flip-1', t, 0.22, 1.18)) tone(1500, t, 0.03, { v: 0.06, type: 'triangle' }); },
    deal(t) {
      if (rec('shuffle-1', t, 0.75)) { for (let i = 0; i < 4; i++) rec(any('pick-1', 'pick-2'), t + 0.8 + i * 0.1, 0.32); return; }
      for (let i = 0; i < 6; i++) clack(t + i * 0.07, 0.25 + Math.random() * 0.2);
    },
    peng(t) {
      if (rec(any('pair-1', 'pair-2', 'pair-3'), t, 0.9)) rec(any('place-1', 'place-3'), t + 0.1, 0.75);
      else { clack(t, 1); clack(t + 0.09, 0.9); }
      tone(523, t + 0.02, 0.25, { v: 0.06, type: 'triangle' });
    },
    gang(t) {
      if (rec(any('pair-1', 'pair-2'), t, 0.9)) { rec('pair-3', t + 0.09, 0.8); rec(any('place-1', 'place-2'), t + 0.19, 0.85); }
      else { clack(t, 1); clack(t + 0.08, 0.9); clack(t + 0.16, 1); }
      tone(392, t, 0.5, { v: 0.08, type: 'triangle' }); tone(587, t + 0.1, 0.45, { v: 0.06 });
    },
    hu(t) {
      const N = [784, 880, 1047, 1175, 1319, 1568];
      N.forEach((f, i) => bell(f, t + i * 0.07, 0.9, 0.11));
      tone(98, t, 1.4, { v: 0.22, type: 'sine' }); tone(147, t, 1.2, { v: 0.12, type: 'triangle' });
      if (!rec('win-1', t + 0.04, 0.85)) noise(t, 0.9, { f: 5000, q: 0.7, v: 0.05, to: 9000 });
    },
    coin(t) { rec('win-2', t, 0.55); bell(2093, t, 0.25, 0.06); bell(2637, t + 0.07, 0.35, 0.05); },
    lose(t) { tone(330, t, 0.28, { v: 0.07, type: 'triangle', to: 262 }); },
    swap(t) { if (!rec('shuffle-2', t, 0.7)) noise(t, 0.55, { f: 380, to: 2600, q: 1.4, v: 0.16, a: 0.12 }); },
    que(t) { tone(660, t, 0.18, { v: 0.08, type: 'triangle' }); tone(990, t + 0.06, 0.22, { v: 0.06 }); },
    turn(t) { bell(1319, t, 0.35, 0.06); bell(1760, t + 0.09, 0.45, 0.05); },
    tick(t) { tone(1900, t, 0.04, { v: 0.07, type: 'square' }); },
    end(t) { [523, 659, 784].forEach((f, i) => bell(f, t + i * 0.1, 0.8, 0.08)); },
    win(t) { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => bell(f, t + i * 0.09, 1.1, 0.09)); tone(131, t, 1.6, { v: 0.18 }); },
    tap(t) { tone(900, t, 0.04, { v: 0.05, type: 'triangle' }); },
  };
  let gestured = false;
  function play(k, delay) {
    if (!P.on || !gestured) return;
    if (!ac() || !FX[k]) return;
    try { FX[k](ctx.currentTime + 0.005 + (delay || 0)); } catch (e) {}
  }

  // ----- 语音（系统自带的语音，跟着界面语言选中文或英文；没有就不出声） -----
  const SS = G.speechSynthesis;
  const VO = { zh: null, en: null };
  function pickVoice() {
    if (!SS) return;
    const vs = SS.getVoices() || [];
    VO.zh = vs.find(v => /zh[-_]CN/i.test(v.lang) && /Ting|Mei|Xiao|Yu|Google/i.test(v.name)) || vs.find(v => /zh[-_](CN|Hans)/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
    VO.en = vs.find(v => /^en[-_](US|GB)/i.test(v.lang) && /Samantha|Daniel|Karen|Google|Aria|Jenny|Guy/i.test(v.name)) || vs.find(v => /^en[-_](US|GB)/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  }
  const curLang = () => (G.document && /^zh/i.test(G.document.documentElement.lang || '')) ? 'zh' : 'en';
  const voice = () => { const k = curLang(); if (!VO[k]) pickVoice(); return VO[k]; };
  if (SS) { pickVoice(); try { SS.addEventListener('voiceschanged', pickVoice); } catch (e) {} }
  function say(text, rate) {
    if (!P.on || !P.voice || !SS || !text) return;
    const vo = voice(); if (!vo) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = vo; u.lang = vo.lang; u.rate = (rate || 1.15) * (curLang() === 'en' ? 0.95 : 1); u.pitch = 1; u.volume = 1;
      SS.speak(u);
    } catch (e) {}
  }
  const hasVoice = () => !!(SS && voice());
  function vib(p) { if (!P.vib) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

  // iOS 要在手指点击里先开一次声音
  let unlocked = false;
  function unlock() {
    gestured = true;
    if (unlocked) return;
    if (ac()) {
      try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
      unlocked = ctx.state === 'running';
    }
    if (SS && P.voice) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; SS.speak(u); } catch (e) {} }
  }
  if (G.document) ['pointerdown', 'touchend', 'keydown'].forEach(k => G.document.addEventListener(k, unlock, { passive: true }));

  G.MJSound = { play, say, vib, unlock, hasVoice, prefs: P, set(k, v) { P[k] = v; save(); if (k === 'on' && v) unlock(); } };
})(typeof window !== 'undefined' ? window : globalThis);
