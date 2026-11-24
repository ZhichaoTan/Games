// ===== the default theme · six original little animals: a piglet, a penguin, a chick, a lamb, a fox and a frog =====
// Drawn the soft way: round bodies, a thin dark line, flat fills, pink cheeks. Each one is painted with canvas calls in a
// 100×100 box (feet near y 92). The calls go to a real canvas or to the recorder below, which turns them into the parts
// language of art.js ({ d, f | s, w, o, cl }), so an animal looks the same as SVG on the page and on the board's canvas.
(function (G) {
  'use strict';
  const TAU = Math.PI * 2;

  // ---------- a pretend canvas that writes what it paints as parts ----------
  function sweepOf(a0, a1, ccw) {
    if (!ccw) { if (a1 - a0 >= TAU) return TAU; let s = (a1 - a0) % TAU; if (s < 0) s += TAU; return s; }
    if (a0 - a1 >= TAU) return -TAU;
    let s = (a0 - a1) % TAU; if (s < 0) s += TAU; return -s;
  }
  function recorder() {
    const parts = [], stack = [];
    let m = [1, 0, 0, 1, 0, 0], d = '', open = false, clip = null;
    const num = v => { const r = Math.round(v * 100) / 100; return String(r === 0 ? 0 : r); };
    const P = (x, y) => num(m[0] * x + m[2] * y + m[4]) + ' ' + num(m[1] * x + m[3] * y + m[5]);
    const scale = () => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    const KEEP = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'lineCap', 'lineJoin'];
    const g = {
      parts, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, lineCap: 'round', lineJoin: 'round',
      save() { const s = { m: m.slice(), clip }; for (const k of KEEP) s[k] = g[k]; stack.push(s); },
      restore() { const s = stack.pop(); if (!s) return; m = s.m; clip = s.clip; for (const k of KEEP) g[k] = s[k]; },
      translate(x, y) { m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
      scale(x, y) { m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]]; },
      rotate(a) { const c = Math.cos(a), s = Math.sin(a); m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[2] * c - m[0] * s, m[3] * c - m[1] * s, m[4], m[5]]; },
      beginPath() { d = ''; open = false; },
      moveTo(x, y) { d += 'M' + P(x, y); open = true; },
      lineTo(x, y) { d += (open ? 'L' : 'M') + P(x, y); open = true; },
      quadraticCurveTo(a, b, x, y) { if (!open) g.moveTo(a, b); d += 'Q' + P(a, b) + ' ' + P(x, y); },
      bezierCurveTo(a, b, c, e, x, y) { if (!open) g.moveTo(a, b); d += 'C' + P(a, b) + ' ' + P(c, e) + ' ' + P(x, y); },
      closePath() { if (open) d += 'Z'; },
      arc(x, y, r, a0, a1, ccw) { g.ellipse(x, y, r, r, 0, a0, a1, ccw); },
      // an arc of an ellipse as cubic Béziers of at most a quarter turn each, so any transform can bend it
      ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
        const sw = sweepOf(a0, a1, ccw), cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
        const pt = t => { const u = Math.cos(t) * rx, v = Math.sin(t) * ry; return [x + u * cr - v * sr, y + u * sr + v * cr]; };
        const dv = t => { const u = -Math.sin(t) * rx, v = Math.cos(t) * ry; return [u * cr - v * sr, u * sr + v * cr]; };
        const p0 = pt(a0);
        g.lineTo(p0[0], p0[1]);
        const n = Math.max(1, Math.ceil(Math.abs(sw) / (Math.PI / 2) - 1e-9)), h = sw / n, k = 4 / 3 * Math.tan(h / 4);
        for (let i = 0; i < n; i++) {
          const t1 = a0 + h * i, t2 = t1 + h, A = pt(t1), B = pt(t2), dA = dv(t1), dB = dv(t2);
          d += 'C' + P(A[0] + k * dA[0], A[1] + k * dA[1]) + ' ' + P(B[0] - k * dB[0], B[1] - k * dB[1]) + ' ' + P(B[0], B[1]);
        }
      },
      rect(x, y, w, h) { g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); },
      fill() { if (d) parts.push(part({ f: g.fillStyle })); },
      stroke() { if (d) parts.push(part({ s: g.strokeStyle, w: Math.round(g.lineWidth * scale() * 100) / 100, j: 1 })); },
      clip() { clip = d; },
    };
    function part(o) { o.d = d; if (g.globalAlpha < 1) o.o = Math.round(g.globalAlpha * 100) / 100; if (clip) o.cl = clip; return o; }
    return g;
  }

  // ---------- colours ----------
  const INK = '#3d2c2e', BLUSH = '#ff9cb0', MOUTH = '#b8475c', TONGUE = '#ff8fa3', WHITE = '#fffdf8';
  const SPEC = {
    piglet: { body: '#ffc4d2', dark: '#f59bb4', snout: '#ffa3ba', hole: '#b4566f' },
    penguin: { body: '#78a6e0', belly: WHITE, beak: '#ffb04a', feet: '#ffa23d' },
    chick: { body: '#ffe27a', wing: '#ffcf45', beak: '#ff9f43' },
    lamb: { wool: '#dccbfc', shade: '#c0aaf1', face: '#fff3e6', ear: '#ffc4d0', leg: '#8f7cc0' },
    fox: { body: '#ffac63', white: WHITE, tip: '#6e4637', feet: '#7d5040', inner: '#ffe2c6' },
    frog: { body: '#97dc7f', belly: '#e9fbd2', feet: '#86d06e' },
  };
  const TYPES = ['piglet', 'penguin', 'chick', 'lamb', 'fox', 'frog'];

  // ---------- small helpers ----------
  let LW = 2.5;   // the outline's width in the 100 box
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU); }
  function paint(g, fill, line) {
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (line !== false) { g.strokeStyle = INK; g.lineWidth = line || LW; g.stroke(); }
  }
  function blob(g, pts) { // a closed curve: pts is a list of [x, y] start, then [c1x, c1y, c2x, c2y, x, y] Bézier steps
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) { const p = pts[i]; g.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]); }
    g.closePath();
  }
  // the eyes for a face, at (x1, y) and (x2, y); r scales them
  function eyes(g, face, x1, x2, y, r) {
    r = r || 1;
    g.save();
    if (face === 'blink' || face === 'sleep') {
      const dip = face === 'sleep' ? 3 : 2.2;
      g.beginPath();
      for (const x of [x1, x2]) { g.moveTo(x - 3.6 * r, y + 0.4); g.quadraticCurveTo(x, y + 0.4 + dip * 2 * r, x + 3.6 * r, y + 0.4); }
      g.strokeStyle = INK; g.lineWidth = 2.3 * Math.max(0.85, r); g.stroke();
    } else if (face === 'happy') {
      g.beginPath();
      for (const x of [x1, x2]) { g.moveTo(x - 3.8 * r, y + 1.6 * r); g.quadraticCurveTo(x, y - 4.6 * r, x + 3.8 * r, y + 1.6 * r); }
      g.strokeStyle = INK; g.lineWidth = 2.5 * Math.max(0.85, r); g.stroke();
    } else {
      const big = face === 'wow' ? 1.22 : 1;
      for (const x of [x1, x2]) {
        ell(g, x, y, 3.4 * r * big, 4.3 * r * big); g.fillStyle = INK; g.fill();
        ell(g, x + 1.2 * r * big, y - 1.6 * r * big, 1.35 * r * big, 1.35 * r * big); g.fillStyle = '#fff'; g.fill();
        if (face === 'wow') { ell(g, x - 1.2 * r, y + 1.9 * r, 0.7 * r, 0.7 * r); g.fillStyle = '#fff'; g.fill(); }
      }
    }
    g.restore();
  }
  function cheeks(g, x1, x2, y, rx, ry, face) {
    g.save(); g.globalAlpha = face === 'happy' || face === 'wow' ? 0.85 : 0.7;
    ell(g, x1, y, rx, ry); g.fillStyle = BLUSH; g.fill();
    ell(g, x2, y, rx, ry); g.fill();
    g.restore();
  }
  // a small mouth under (x, y): a soft smile, an open laugh, a little "o", or a sleepy dot
  function mouth(g, face, x, y, w) {
    w = w || 1;
    g.save();
    if (face === 'happy') {
      g.beginPath(); g.moveTo(x - 4.6 * w, y - 0.6); g.quadraticCurveTo(x, y + 8.6 * w, x + 4.6 * w, y - 0.6); g.closePath();
      g.fillStyle = MOUTH; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.9; g.stroke();
      g.beginPath(); g.moveTo(x - 2.4 * w, y + 3.6 * w); g.quadraticCurveTo(x, y + 1.8 * w, x + 2.4 * w, y + 3.6 * w); g.quadraticCurveTo(x, y + 6 * w, x - 2.4 * w, y + 3.6 * w); g.closePath();
      g.fillStyle = TONGUE; g.fill();
    } else if (face === 'wow') {
      ell(g, x, y + 1.6, 2.5 * w, 3 * w); g.fillStyle = MOUTH; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.7; g.stroke();
    } else if (face === 'sleep') {
      ell(g, x, y + 0.8, 1.6 * w, 1.2 * w); g.fillStyle = MOUTH; g.globalAlpha = 0.8; g.fill();
    } else {
      g.beginPath(); g.moveTo(x - 3.2 * w, y); g.quadraticCurveTo(x, y + 3.4 * w, x + 3.2 * w, y);
      g.strokeStyle = INK; g.lineWidth = 2.1; g.stroke();
    }
    g.restore();
  }
  // a stubby arm: a little oval at the side; up raises it for a cheer
  function arm(g, side, x, y, fill, up) {
    const a = up ? -0.95 : 0.35;
    g.save(); g.translate(x, y); g.scale(side, 1); g.rotate(a);
    ell(g, 0, up ? -5 : 4.5, 5.2, 7.4); paint(g, fill);
    g.restore();
  }

  // ---------- the six animals ----------
  const DRAW = {
    piglet(g, face, o) {
      const K = SPEC.piglet;
      // feet and the curly tail behind the body
      ell(g, 38, 89.5, 6.4, 4.4); paint(g, K.dark);
      ell(g, 62, 89.5, 6.4, 4.4); paint(g, K.dark);
      g.beginPath(); g.moveTo(80, 73); g.bezierCurveTo(90, 74, 92, 64, 87, 62); g.bezierCurveTo(83, 60.5, 81, 66, 85.5, 67.5);
      g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
      // ears: soft triangles with a pink inside, the tips bending out
      for (const s of [1, -1]) {
        g.save(); g.translate(50, 0); g.scale(s, 1); g.translate(-50, 0);
        blob(g, [[23, 45], [19, 32, 19, 18, 25.5, 12.5], [32, 14, 41, 21, 46, 31]]); paint(g, K.body);
        blob(g, [[27, 37], [25, 29, 25.5, 22, 28.5, 19], [32.5, 21, 37, 25, 39.5, 30]]); paint(g, K.dark, false);
        g.restore();
      }
      // the body
      blob(g, [[50, 90.5], [29, 90.5, 15.5, 84, 15.5, 66.5], [15.5, 45, 30, 27, 50, 27], [70, 27, 84.5, 45, 84.5, 66.5], [84.5, 84, 71, 90.5, 50, 90.5]]);
      paint(g, K.body);
      // a soft shine on the head
      g.save(); g.globalAlpha = 0.55; ell(g, 34, 38, 7, 3.6, -0.5); g.fillStyle = '#fff'; g.fill(); g.restore();
      arm(g, 1, 19, 70, K.body, o.cheer); arm(g, -1, 81, 70, K.body, o.cheer);
      eyes(g, face, 35, 65, 52);
      cheeks(g, 26, 74, 62, 5.4, 3.2, face);
      // the snout and its nostrils
      ell(g, 50, 63.5, 10.5, 7.6); paint(g, K.snout);
      ell(g, 46, 63.5, 1.9, 2.9); g.fillStyle = K.hole; g.fill();
      ell(g, 54, 63.5, 1.9, 2.9); g.fill();
      mouth(g, face, 50, 75.5, 0.9);
    },
    penguin(g, face, o) {
      const K = SPEC.penguin;
      ell(g, 39, 90, 7.4, 3.8); paint(g, K.feet);
      ell(g, 61, 90, 7.4, 3.8); paint(g, K.feet);
      // flippers behind the body
      for (const s of [1, -1]) {
        g.save(); g.translate(50, 0); g.scale(s, 1); g.translate(-50, 0);
        if (o.cheer) blob(g, [[22, 56], [10, 50, 6, 36, 10, 32], [15, 34, 22, 44, 25, 51]]);
        else blob(g, [[21, 50], [10, 58, 8, 72, 12.5, 77], [17, 75, 23, 66, 24.5, 57]]);
        paint(g, K.body);
        g.restore();
      }
      // the body: a soft egg, with a white face and tummy
      blob(g, [[50, 17.5], [70, 17.5, 83, 35, 83, 59], [83, 80, 70, 90.5, 50, 90.5], [30, 90.5, 17, 80, 17, 59], [17, 35, 30, 17.5, 50, 17.5]]);
      paint(g, K.body);
      blob(g, [[50, 39], [44, 31.5, 29.5, 31.5, 27.5, 44], [25.5, 56, 33, 65, 33.5, 74], [36, 85, 64, 85, 66.5, 74], [67, 65, 74.5, 56, 72.5, 44], [70.5, 31.5, 56, 31.5, 50, 39]]);
      paint(g, K.belly, LW * 0.72);
      // a little curl of feathers on top
      g.beginPath(); g.moveTo(49, 18); g.bezierCurveTo(47, 11.5, 52, 8.5, 55.5, 11);
      g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
      g.save(); g.globalAlpha = 0.5; ell(g, 33, 30, 6.5, 3.2, -0.6); g.fillStyle = '#fff'; g.fill(); g.restore();
      eyes(g, face, 39.5, 60.5, 50);
      cheeks(g, 32, 68, 60, 4.8, 2.9, face);
      // the beak opens for a laugh or a gasp
      if (face === 'happy' || face === 'wow') {
        ell(g, 50, 60.5, 4.2, face === 'wow' ? 4 : 3.4); g.fillStyle = MOUTH; g.fill();
        g.beginPath(); g.moveTo(44.8, 55.6); g.lineTo(55.2, 55.6); g.lineTo(50, 59.2); g.closePath(); paint(g, K.beak, 1.8);
        g.beginPath(); g.moveTo(46.6, 62.6); g.lineTo(53.4, 62.6); g.lineTo(50, 66); g.closePath(); paint(g, K.beak, 1.8);
      } else {
        g.beginPath(); g.moveTo(44.6, 55.6); g.lineTo(55.4, 55.6); g.lineTo(50, 62.6); g.closePath(); paint(g, K.beak, 1.9);
        g.beginPath(); g.moveTo(46.5, 58.4); g.lineTo(53.5, 58.4); g.strokeStyle = '#d97a1f'; g.lineWidth = 1.2; g.stroke();
      }
    },
    chick(g, face, o) {
      const K = SPEC.chick;
      ell(g, 40, 90, 6.4, 3.6); paint(g, K.beak);
      ell(g, 60, 90, 6.4, 3.6); paint(g, K.beak);
      // the tuft on top
      blob(g, [[48.6, 26], [45.5, 20, 45.6, 14, 49.6, 9.6], [52, 14.6, 53, 20, 51.6, 26]]); paint(g, K.body);
      blob(g, [[51, 26.4], [54, 20.5, 58.8, 17.4, 64, 17.6], [61, 21.6, 57.4, 24.4, 53, 27.4]]); paint(g, K.body);
      blob(g, [[48, 27.4], [44.2, 22.4, 39.4, 20.4, 35.4, 21.2], [38.4, 24.4, 42.4, 26.4, 47, 28.4]]); paint(g, K.body);
      // the round body
      blob(g, [[50, 24.5], [71, 24.5, 85, 40, 85, 59.5], [85, 79, 70.5, 90.5, 50, 90.5], [29.5, 90.5, 15, 79, 15, 59.5], [15, 40, 29, 24.5, 50, 24.5]]);
      paint(g, K.body);
      g.save(); g.globalAlpha = 0.6; ell(g, 33, 36, 7, 3.6, -0.55); g.fillStyle = '#fff'; g.fill(); g.restore();
      // wings
      for (const s of [1, -1]) {
        g.save(); g.translate(50, 0); g.scale(s, 1); g.translate(-50, 0);
        if (o.cheer) ell(g, 16.5, 52, 5.6, 9, -0.75); else ell(g, 18.5, 66, 5.6, 9, 0.32);
        paint(g, K.wing);
        g.restore();
      }
      eyes(g, face, 37.5, 62.5, 54);
      cheeks(g, 29, 71, 64, 5, 3, face);
      // the beak: two little halves; they part for a laugh or a gasp
      const open = face === 'happy' ? 2.6 : face === 'wow' ? 3.4 : 0;
      if (open) { ell(g, 50, 62 + open / 2, 3.6, 1.6 + open / 2); g.fillStyle = MOUTH; g.fill(); }
      g.beginPath(); g.moveTo(45, 61.5); g.lineTo(50, 57); g.lineTo(55, 61.5); g.closePath(); paint(g, K.beak, 1.8);
      g.beginPath(); g.moveTo(45.6, 61.5 + open); g.lineTo(50, 65.5 + open); g.lineTo(54.4, 61.5 + open); g.closePath(); paint(g, K.beak, 1.8);
    },
    lamb(g, face, o) {
      const K = SPEC.lamb;
      ell(g, 39.5, 89.5, 5.6, 4.6); paint(g, K.leg);
      ell(g, 60.5, 89.5, 5.6, 4.6); paint(g, K.leg);
      // the wool: a round cloud of bumps
      const N = 11, R = 31, cx = 50, cy = 57.5;
      const pt = (a, r) => [cx + Math.cos(a) * r * 1.04, cy + Math.sin(a) * r];
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = -Math.PI / 2 + (i / N) * TAU, p = pt(a, R);
        if (i === 0) g.moveTo(p[0], p[1]);
        else { const c = pt(a - Math.PI / N, R * 1.3); g.quadraticCurveTo(c[0], c[1], p[0], p[1]); }
      }
      g.closePath(); paint(g, K.wool);
      // a few curls in the wool
      g.beginPath(); g.moveTo(27, 70); g.quadraticCurveTo(30, 66, 33.5, 70); g.moveTo(66.5, 70); g.quadraticCurveTo(70, 66, 73, 70);
      g.moveTo(37, 82); g.quadraticCurveTo(40.5, 78.5, 44, 82); g.moveTo(56, 82); g.quadraticCurveTo(59.5, 78.5, 63, 82);
      g.strokeStyle = K.shade; g.lineWidth = 2.2; g.stroke();
      // floppy ears, then the face
      for (const s of [1, -1]) {
        g.save(); g.translate(50, 0); g.scale(s, 1); g.translate(-50, 0);
        ell(g, 27.5, 52.5, 9.6, 4.6, o.cheer ? -0.5 : 0.42); paint(g, K.face);
        ell(g, 26.5, o.cheer ? 51.8 : 53, 5.4, 2, o.cheer ? -0.5 : 0.42); paint(g, K.ear, false);
        g.restore();
      }
      ell(g, 50, 58.5, 18.6, 16.6); paint(g, K.face);
      // a tuft of wool over the forehead: filled, then only its top edge drawn
      const tuft = () => { g.beginPath(); g.moveTo(35, 49); g.quadraticCurveTo(33, 40, 41.5, 40.5); g.quadraticCurveTo(45, 34, 51, 37); g.quadraticCurveTo(57, 33.5, 60, 40.5); g.quadraticCurveTo(68, 41, 65, 49.5); };
      tuft(); g.quadraticCurveTo(50, 44, 35, 49); g.closePath(); g.fillStyle = K.wool; g.fill();
      tuft(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
      g.save(); g.globalAlpha = 0.6; ell(g, 30, 36, 6, 3, -0.6); g.fillStyle = '#fff'; g.fill(); g.restore();
      eyes(g, face, 42.5, 57.5, 57, 0.9);
      cheeks(g, 36.5, 63.5, 64.5, 3.9, 2.3, face);
      // a little nose, and the mouth under it
      g.beginPath(); g.moveTo(47.6, 63.4); g.lineTo(52.4, 63.4); g.lineTo(50, 66); g.closePath(); g.fillStyle = '#c86b7c'; g.fill();
      if (face !== 'happy' && face !== 'wow') { g.beginPath(); g.moveTo(50, 66); g.lineTo(50, 67.4); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke(); }
      mouth(g, face, 50, 68, 0.72);
    },
    fox(g, face, o) {
      const K = SPEC.fox;
      ell(g, 39, 89.5, 6.2, 4.2); paint(g, K.feet);
      ell(g, 61, 89.5, 6.2, 4.2); paint(g, K.feet);
      // the bushy tail behind, with a white tip
      blob(g, [[74, 82], [90, 82, 99, 66, 93.5, 51], [91, 44, 84, 43.5, 82.5, 50], [81, 57, 83, 66, 72, 72]]); paint(g, K.body);
      g.save();
      blob(g, [[74, 82], [90, 82, 99, 66, 93.5, 51], [91, 44, 84, 43.5, 82.5, 50], [81, 57, 83, 66, 72, 72]]); g.clip();
      ell(g, 88.5, 47.5, 8, 7.5); g.fillStyle = K.white; g.fill();
      g.restore();
      blob(g, [[74, 82], [90, 82, 99, 66, 93.5, 51], [91, 44, 84, 43.5, 82.5, 50], [81, 57, 83, 66, 72, 72]]); paint(g, null);
      // tall ears with dark tips
      for (const s of [1, -1]) {
        g.save(); g.translate(50, 0); g.scale(s, 1); g.translate(-50, 0);
        const ear = () => blob(g, [[20.5, 50], [19, 36, 19.5, 22, 24.5, 11.5], [32, 15, 41, 22, 47, 32]]);
        ear(); g.fillStyle = K.body; g.fill();
        g.save(); ear(); g.clip();
        blob(g, [[26, 40], [25, 32, 25.5, 25, 27.5, 19.5], [32, 22, 36.5, 26, 39.5, 31]]); g.fillStyle = K.inner; g.fill();
        ell(g, 24.5, 11.5, 9, 8.5); g.fillStyle = K.tip; g.fill();
        g.restore();
        ear(); paint(g, null);
        g.restore();
      }
      // the body
      blob(g, [[50, 28], [70, 28, 84, 44, 84, 64], [84, 82, 70.5, 90.5, 50, 90.5], [29.5, 90.5, 16, 82, 16, 64], [16, 44, 30, 28, 50, 28]]);
      paint(g, K.body);
      // white cheeks and chest, clipped to the body
      g.save();
      blob(g, [[50, 28], [70, 28, 84, 44, 84, 64], [84, 82, 70.5, 90.5, 50, 90.5], [29.5, 90.5, 16, 82, 16, 64], [16, 44, 30, 28, 50, 28]]); g.clip();
      blob(g, [[14, 60], [24, 55, 38, 58, 50, 64.5], [62, 58, 76, 55, 86, 60], [88, 80, 72, 94, 50, 94], [28, 94, 12, 80, 14, 60]]);
      g.fillStyle = K.white; g.fill();
      g.restore();
      blob(g, [[50, 28], [70, 28, 84, 44, 84, 64], [84, 82, 70.5, 90.5, 50, 90.5], [29.5, 90.5, 16, 82, 16, 64], [16, 44, 30, 28, 50, 28]]); paint(g, null);
      g.save(); g.globalAlpha = 0.5; ell(g, 33, 39, 6.5, 3.3, -0.5); g.fillStyle = '#fff'; g.fill(); g.restore();
      arm(g, 1, 19.5, 70, K.body, o.cheer); arm(g, -1, 80.5, 70, K.body, o.cheer);
      eyes(g, face, 36, 64, 51.5);
      cheeks(g, 28, 72, 63.5, 4.8, 2.9, face);
      ell(g, 50, 63.5, 3.4, 2.5); g.fillStyle = INK; g.fill();
      if (face === 'happy' || face === 'wow') mouth(g, face, 50, 67.5, 0.85);
      else { g.beginPath(); g.moveTo(45.4, 67.2); g.quadraticCurveTo(47.7, 70.2, 50, 67.2); g.quadraticCurveTo(52.3, 70.2, 54.6, 67.2); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); }
    },
    frog(g, face, o) {
      const K = SPEC.frog;
      // eyes sit on two bumps on top
      ell(g, 33.5, 37, 12.4, 12); paint(g, K.body);
      ell(g, 66.5, 37, 12.4, 12); paint(g, K.body);
      // the wide body
      blob(g, [[50, 35], [74, 35, 88.5, 49, 88.5, 67], [88.5, 84, 72, 90.5, 50, 90.5], [28, 90.5, 11.5, 84, 11.5, 67], [11.5, 49, 26, 35, 50, 35]]);
      paint(g, K.body);
      // cover the lines where the bumps meet the body
      ell(g, 33.5, 41.5, 10, 8); g.fillStyle = K.body; g.fill();
      ell(g, 66.5, 41.5, 10, 8); g.fill();
      g.save(); g.globalAlpha = 0.5; ell(g, 28, 31, 5, 2.6, -0.6); g.fillStyle = '#fff'; g.fill(); ell(g, 61, 31, 5, 2.6, -0.6); g.fill(); g.restore();
      ell(g, 50, 77.5, 21, 11); g.fillStyle = K.belly; g.fill();
      for (const s of [1, -1]) {
        g.save(); g.translate(50, 0); g.scale(s, 1); g.translate(-50, 0);
        if (o.cheer) arm(g, 1, 15, 64, K.body, true);
        ell(g, 33, 89.5, 8.2, 4); paint(g, K.feet);
        g.restore();
      }
      eyes(g, face, 33.5, 66.5, 38);
      cheeks(g, 23, 77, 58, 5.2, 3.1, face);
      // a wide smile
      g.save();
      if (face === 'happy') {
        g.beginPath(); g.moveTo(37, 57); g.quadraticCurveTo(50, 73, 63, 57); g.quadraticCurveTo(50, 61.5, 37, 57); g.closePath();
        g.fillStyle = MOUTH; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.9; g.stroke();
        g.beginPath(); g.moveTo(45, 64.5); g.quadraticCurveTo(50, 62, 55, 64.5); g.quadraticCurveTo(50, 68, 45, 64.5); g.closePath(); g.fillStyle = TONGUE; g.fill();
      } else if (face === 'wow') {
        ell(g, 50, 61, 3.6, 4.2); g.fillStyle = MOUTH; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
      } else {
        g.beginPath(); g.moveTo(38, 57.5); g.quadraticCurveTo(50, face === 'sleep' ? 62 : 65, 62, 57.5);
        g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke();
      }
      g.restore();
      // two dots for a nose
      ell(g, 46.5, 49.5, 1.1, 1.1); g.fillStyle = INK; g.globalAlpha = 0.6; g.fill(); ell(g, 53.5, 49.5, 1.1, 1.1); g.fill(); g.globalAlpha = 1;
    },
  };

  // ---------- drawing ----------
  // paint animal tp with face (normal, blink, sleep, happy, wow) on g, in its 100 box; o: { cheer, lw (width factor), shadow }
  function draw(g, tp, face, o) {
    o = o || {};
    const keep = LW;
    LW = 2.5 * (o.lw || 1);
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (o.shadow !== false) { ell(g, 50, 92.5, 27, 4.2); g.fillStyle = o.shadow || 'rgba(70,45,40,.18)'; g.fill(); }
    (DRAW[tp] || DRAW.piglet)(g, face || 'normal', o);
    g.restore();
    LW = keep;
  }
  // the same as parts for art.js; o.x, o.y, o.s place the 100 box (default: as it is)
  function parts(tp, face, o) {
    o = o || {};
    const g = recorder();
    if (o.x || o.y) g.translate(o.x || 0, o.y || 0);
    if (o.s && o.s !== 1) g.scale(o.s, o.s);
    draw(g, tp, face, o);
    return g.parts;
  }
  G.MMCritters = { TYPES, SPEC, INK, draw, parts, recorder };
})(typeof window !== 'undefined' ? window : globalThis);
