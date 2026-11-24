// ===== 萌宠消消乐 Puffy Pals / 团团圆圆 Mochi Moon · artwork: the six mochi and their faces (the little animals are in
// critters.js), the specials, frost, cages, gift boxes, ingots, the lobby pictures, the home page's card and the icons.
// Everything is drawn as vector parts in a 100×100 box; the same parts become SVG for the page and Path2D on the board's
// canvas, so a piece looks the same everywhere. No image files.
(function (G) {
  'use strict';
  const INK = '#2b1d2e', BLUSH = '#ff8fa3', MOUTH = '#8a2f3c', TONGUE = '#ff7f95';
  // the six mochi: body light / main / edge, the inner ear, and a strong colour for goal counters and sparks
  //   0 bunny (white)  1 piglet (pink)  2 chick (yellow)  3 frog (green)  4 kitty (purple)  5 elephant (blue)
  const COL = [
    { c: '#ffffff', a: '#f7f2ff', b: '#c9bfe2', ear: '#ffb3c6', k: '#eae4ff', key: 'bunny' },
    { c: '#ffe3ec', a: '#ffa3c0', b: '#df6690', ear: '#ff7fa6', k: '#ff8fb4', key: 'piglet' },
    { c: '#fff7cc', a: '#ffd84f', b: '#e1a51b', ear: '#ff9a3c', k: '#ffd23d', key: 'chick' },
    { c: '#e4ffd4', a: '#94e27c', b: '#4aa851', ear: '#ff9fb0', k: '#7fdc6a', key: 'frog' },
    { c: '#f2e6ff', a: '#c19bff', b: '#8656d8', ear: '#ffb0d4', k: '#b78cff', key: 'kitty' },
    { c: '#e0f3ff', a: '#7fc6ff', b: '#3d84d4', ear: '#ffb6c8', k: '#6dbaff', key: 'elephant' },
  ];
  const PC = ['#ffb35c', '#6fd0c4', '#b79bff', '#ff8fb1'];   // player colours, seat by seat
  // ---------- themes: 'pal' (the default) is six little animals (critters.js) in a sunny meadow; 'mm' is the lantern-fair mochi ----------
  // each animal's colours: light / main / edge, and a strong colour for goal counters and sparks
  //   0 piglet (pink)  1 penguin (blue)  2 chick (yellow)  3 lamb (purple)  4 fox (orange)  5 frog (green)
  const PALC = [
    { c: '#fff1f5', a: '#ffc6d5', b: '#ef8daa', k: '#ff94b4', key: 'piglet' },
    { c: '#eff7ff', a: '#bcdcfa', b: '#6aa3dc', k: '#6eaeee', key: 'penguin' },
    { c: '#fffbe2', a: '#ffe88f', b: '#e2b23a', k: '#ffcd2e', key: 'chick' },
    { c: '#f8f3ff', a: '#dacbfd', b: '#9a7fdf', k: '#a98cf2', key: 'lamb' },
    { c: '#fff3e6', a: '#ffd0a0', b: '#e08c4c', k: '#f79a4e', key: 'fox' },
    { c: '#effcef', a: '#c2ecbc', b: '#5fb85a', k: '#5fc95a', key: 'frog' },
  ];
  let theme = 'pal';
  const CR = G.MMCritters;

  // ---------- the parts language: { d: path, f: fill, s: stroke, w: stroke width, o: opacity, j: round joins } ----------
  // A fill or stroke is a colour or a gradient: { r: [cx, cy, r], st: [[0, colour], …] } or { l: [x1, y1, x2, y2], st: […] }.
  const E = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
  const C = (cx, cy, r) => E(cx, cy, r, r);
  const RR = (x, y, w, h, r) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
  // an ellipse turned by deg degrees, as a path (so it needs no transform)
  function ER(cx, cy, rx, ry, deg) {
    const t = deg * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t);
    const p = (a, b) => [cx + a * ct - b * st, cy + a * st + b * ct].map(v => +v.toFixed(2)).join(' ');
    return `M${p(-rx, 0)}A${rx} ${ry} ${deg} 1 0 ${p(rx, 0)}A${rx} ${ry} ${deg} 1 0 ${p(-rx, 0)}z`;
  }
  const star = (cx, cy, r, k) => { k = k || 0.42; let d = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * k : r; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2); } return d + 'z'; };
  // the mochi's body: a soft dome with a flat-ish bottom, centre (50, 57), 80 wide, 68 high
  const BODY = 'M50 91C83.6 91 90 80.1 90 62.4C90 36.6 74 23 50 23C26 23 10 36.6 10 62.4C10 80.1 16.4 91 50 91z';
  const bodyFill = c => ({ r: [38, 36, 62], st: [[0, c.c], [0.45, c.a], [1, c.b]] });

  // ---------- faces ----------
  // the face parts for an expression; eyes at (ex ± dx, ey), mouth at my. o.mouth: false (the snout or trunk hides it), 'beak'
  function face(f, o) {
    o = o || {};
    const dx = o.dx || 13, ey = o.ey || 56, my = o.my || 66, P = [];
    const L = 50 - dx, Rr = 50 + dx;
    if (o.frog) {
      // frog eyes sit in the bumps on top: white eyeballs drawn with the body, pupils here
      const fy = 28;
      if (f === 'blink' || f === 'sleep') P.push({ d: `M${L - 5} ${fy}q5 ${f === 'sleep' ? 4 : 2.5} 10 0M${Rr - 5} ${fy}q5 ${f === 'sleep' ? 4 : 2.5} 10 0`, s: INK, w: 2.6 });
      else if (f === 'happy') P.push({ d: `M${L - 5} ${fy + 2}q5 -7 10 0M${Rr - 5} ${fy + 2}q5 -7 10 0`, s: INK, w: 2.8 });
      else { const r = f === 'wow' ? 5.6 : 4.4; P.push({ d: C(L, fy + 0.5, r) + C(Rr, fy + 0.5, r), f: INK }, { d: C(L + 1.6, fy - 1.4, f === 'wow' ? 2.1 : 1.6) + C(Rr + 1.6, fy - 1.4, f === 'wow' ? 2.1 : 1.6), f: '#fff' }); }
    } else if (f === 'blink') P.push({ d: `M${L - 4} ${ey + 1}q4 2.6 8 0M${Rr - 4} ${ey + 1}q4 2.6 8 0`, s: INK, w: 2.5 });
    else if (f === 'sleep') P.push({ d: `M${L - 4.4} ${ey}q4.4 3.8 8.8 0M${Rr - 4.4} ${ey}q4.4 3.8 8.8 0`, s: INK, w: 2.4, o: 0.85 });
    else if (f === 'happy') P.push({ d: `M${L - 4.6} ${ey + 2}q4.6 -7 9.2 0M${Rr - 4.6} ${ey + 2}q4.6 -7 9.2 0`, s: INK, w: 2.8 });
    else if (f === 'wow') P.push({ d: E(L, ey, 5.4, 6.4) + E(Rr, ey, 5.4, 6.4), f: INK }, { d: C(L + 2, ey - 2.4, 2.2) + C(Rr + 2, ey - 2.4, 2.2) + C(L - 1.8, ey + 2.6, 1) + C(Rr - 1.8, ey + 2.6, 1), f: '#fff' });
    else P.push({ d: E(L, ey, 4.3, 5.3) + E(Rr, ey, 4.3, 5.3), f: INK }, { d: C(L + 1.6, ey - 2, 1.7) + C(Rr + 1.6, ey - 2, 1.7), f: '#fff' });
    // cheeks
    P.push({ d: E(50 - dx - 9.5, my - 1, 6, 3.6) + E(50 + dx + 9.5, my - 1, 6, 3.6), f: BLUSH, o: f === 'happy' || f === 'wow' ? 0.75 : 0.55 });
    if (o.mouth === false) return P;
    if (o.mouth === 'beak') {
      if (f === 'happy' || f === 'wow') P.push({ d: `M44.5 ${my - 3}L50 ${my - 7.5}L55.5 ${my - 3}z`, f: '#ff9a3c', s: '#d9701c', w: 1.2, j: 1 }, { d: `M45.5 ${my - 1}L50 ${my + (f === 'wow' ? 6 : 4)}L54.5 ${my - 1}z`, f: '#f07f22', s: '#d9701c', w: 1.2, j: 1 }, { d: `M46 ${my - 2.6}h8`, s: MOUTH, w: 1.6 });
      else P.push({ d: `M44.5 ${my - 2.5}L50 ${my - 7}L55.5 ${my - 2.5}L50 ${my + 1.5}z`, f: '#ff9a3c', s: '#d9701c', w: 1.2, j: 1 }, { d: `M45.5 ${my - 2.5}h9`, s: '#c4621a', w: 1.1, o: 0.8 });
      return P;
    }
    if (f === 'happy') P.push({ d: `M43.5 ${my - 1.5}q6.5 11 13 0z`, f: MOUTH, s: MOUTH, w: 1.4, j: 1 }, { d: `M46.6 ${my + 2.8}q3.4 3.2 6.8 0q-3.4-2-6.8 0z`, f: TONGUE });
    else if (f === 'wow') P.push({ d: E(50, my + 1, 3.3, 4), f: MOUTH });
    else if (f === 'sleep') P.push({ d: E(50, my, 1.8, 1.5), f: MOUTH, o: 0.8 });
    else if (o.cat) P.push({ d: `M44 ${my - 1}q3 3.6 6 0q3 3.6 6 0`, s: INK, w: 2 });
    else P.push({ d: `M45.5 ${my - 1}q4.5 4.2 9 0`, s: INK, w: 2.2 });
    return P;
  }

  // ---------- the six mochi ----------
  function mochi(c, f) {
    const K = COL[c], body = bodyFill(K), P = [];
    const shade = { d: E(50, 92.5, 30, 4.2), f: '#000', o: 0.2 };
    const gloss = [{ d: ER(33, 37, 11, 6, -28), f: '#fff', o: 0.62 }, { d: C(46, 31, 2.4), f: '#fff', o: 0.5 }];
    const rim = { d: BODY, s: K.b, w: 1.6, o: 0.55 };
    P.push(shade);
    if (c === 0) {
      // bunny: two long ears, the right one bent a little
      P.push({ d: ER(36, 22, 7.8, 18, -14), f: body, s: K.b, w: 1.2 }, { d: ER(36.4, 23.5, 3.6, 12.5, -14), f: K.ear, o: 0.85 },
        { d: 'M58 30C57 18 60 9 66 5.5C71 3 74 7 72.5 13C71.5 17 67 21 66.5 31z', f: body, s: K.b, w: 1.2, j: 1 },
        { d: 'M61.5 28.5C61 20 63 13 66.5 10C69 8.5 70 11 69 14C68 17 65.5 20.5 65 28.5z', f: K.ear, o: 0.85 });
      P.push({ d: BODY, f: body }, rim, ...gloss);
      P.push(...face(f, {}));
      P.push({ d: E(50, 63.5, 2.2, 1.6), f: '#ff9db3' });
    } else if (c === 1) {
      // piglet: folded ears and a snout
      P.push({ d: BODY, f: body }, rim, ...gloss);
      // floppy ears folded forward over the top corners
      P.push({ d: 'M31 29C25 18 12 16 7 23.5C3.5 30 8.5 39.5 18 40.5C24 41 29 36.5 31 29z', f: body, s: K.b, w: 1.6, j: 1 }, { d: 'M27 30C22.5 23.5 14.5 22.5 11.8 26.6C9.8 30.2 12.8 35.6 18.4 36.1C22.4 36.4 25.5 33.6 27 30z', f: K.ear, o: 0.9 },
        { d: 'M69 29C75 18 88 16 93 23.5C96.5 30 91.5 39.5 82 40.5C76 41 71 36.5 69 29z', f: body, s: K.b, w: 1.6, j: 1 }, { d: 'M73 30C77.5 23.5 85.5 22.5 88.2 26.6C90.2 30.2 87.2 35.6 81.6 36.1C77.6 36.4 74.5 33.6 73 30z', f: K.ear, o: 0.9 });
      P.push(...face(f, { ey: 52, my: 66, mouth: false }));
      P.push({ d: E(50, 66.5, 10.5, 7.4), f: { r: [47, 62, 14], st: [[0, '#ffc9d8'], [1, '#f07ea1']] }, s: '#d95d86', w: 1.4 },
        { d: E(46.2, 66.8, 1.9, 2.8) + E(53.8, 66.8, 1.9, 2.8), f: '#a2405e' });
      if (f === 'happy') P.push({ d: 'M45 76q5 6 10 0z', f: MOUTH, s: MOUTH, w: 1.2, j: 1 });
      else if (f === 'wow') P.push({ d: E(50, 78.5, 2.4, 2.8), f: MOUTH });
    } else if (c === 2) {
      // chick: a tuft on top, little wings, a beak
      P.push({ d: 'M48.5 25C45 19 45.5 12.5 49 9.5C50.5 15 51.5 19 50.5 25z', f: '#ffcf3a', s: K.b, w: 1.1, j: 1 },
        { d: 'M50 25C51 18 55 13.5 60 13C57.5 18 55 21.5 51.5 25.5z', f: '#ffcf3a', s: K.b, w: 1.1, j: 1 },
        { d: 'M48.5 25.5C45 21.5 41 19.5 37 20.5C40.5 23 43 25 47 26.5z', f: '#ffcf3a', s: K.b, w: 1.1, j: 1 });
      P.push({ d: BODY, f: body }, rim, ...gloss);
      P.push({ d: ER(13.5, 66, 6, 10, 22), f: K.a, s: K.b, w: 1.4 }, { d: ER(86.5, 66, 6, 10, -22), f: K.a, s: K.b, w: 1.4 });
      P.push(...face(f, { ey: 55, my: 67, mouth: 'beak' }));
    } else if (c === 3) {
      // frog: eyes on two bumps, a wide smile
      P.push({ d: C(36, 29, 12.5) + C(64, 29, 12.5), f: body, s: K.b, w: 1.4 });
      P.push({ d: BODY, f: body }, rim, { d: ER(30, 40, 9, 4.8, -24), f: '#fff', o: 0.5 });
      P.push({ d: C(36, 28.5, 8.6) + C(64, 28.5, 8.6), f: '#fff', s: '#3d8f45', w: 1.2 });
      P.push(...face(f, { frog: true, dx: 14, my: 66, mouth: false }));
      if (f === 'happy') P.push({ d: 'M34 59q16 18 32 0q-16 6-32 0z', f: MOUTH, s: MOUTH, w: 1.5, j: 1 }, { d: 'M44 66q6 4 12 0q-6-2.4-12 0z', f: TONGUE });
      else if (f === 'wow') P.push({ d: E(50, 64, 4.4, 5), f: MOUTH });
      else if (f === 'sleep') P.push({ d: 'M40 63q10 4 20 0', s: INK, w: 2.2, o: 0.8 });
      else P.push({ d: 'M35 60q15 11 30 0', s: INK, w: 2.4 });
      P.push({ d: C(43, 49, 1.3) + C(57, 49, 1.3), f: '#3d8f45', o: 0.7 });
    } else if (c === 4) {
      // kitty: pointed ears, whiskers, a "w" mouth
      P.push({ d: 'M15.5 45L19 11.5L44 27z', f: body, s: K.b, w: 1.6, j: 1 }, { d: 'M21 36L23 19L36.5 28z', f: K.ear },
        { d: 'M84.5 45L81 11.5L56 27z', f: body, s: K.b, w: 1.6, j: 1 }, { d: 'M79 36L77 19L63.5 28z', f: K.ear });
      P.push({ d: BODY, f: body }, rim, ...gloss);
      P.push({ d: 'M44 33q1 4 0 7M50 31.5v7.5M56 33q-1 4 0 7', s: K.b, w: 2.4, o: 0.7 });
      P.push(...face(f, { ey: 55, my: 67, cat: true }));
      P.push({ d: 'M47.4 61.5h5.2l-2.6 3z', f: '#ff86a8', s: '#ff86a8', w: 1.4, j: 1 },
        { d: 'M25 63L10 60M25 68L10 69.5M75 63L90 60M75 68L90 69.5', s: INK, w: 1.3, o: 0.5 });
    } else {
      // elephant: big round ears and a little trunk
      P.push({ d: ER(15.5, 54, 13.5, 17.5, -8), f: body, s: K.b, w: 1.6 }, { d: ER(16.5, 55, 8, 11.5, -8), f: K.ear, o: 0.8 },
        { d: ER(84.5, 54, 13.5, 17.5, 8), f: body, s: K.b, w: 1.6 }, { d: ER(83.5, 55, 8, 11.5, 8), f: K.ear, o: 0.8 });
      P.push({ d: BODY, f: body }, rim, ...gloss);
      P.push(...face(f, { ey: 53, my: 66, dx: 14, mouth: false }));
      const up = f === 'happy' || f === 'wow';
      P.push({ d: up ? 'M50 59C50 67 51 74 56.5 76C61 77.5 63.5 73 61 70' : 'M50 59C50 68 50.5 75 55 78.5C58.5 81 62 78.5 60.5 75', s: K.b, w: 9.6 },
        { d: up ? 'M50 59C50 67 51 74 56.5 76C61 77.5 63.5 73 61 70' : 'M50 59C50 68 50.5 75 55 78.5C58.5 81 62 78.5 60.5 75', s: K.a, w: 7 },
        { d: up ? 'M47.8 66h4.4M48.6 70.5h4.4' : 'M47.8 66h4.4M48 71h4.4', s: K.b, w: 1.2, o: 0.7 });
    }
    return P;
  }

  // ---------- the specials (no colour: tap them, or swap them with anything) ----------
  const RED = { l: [0, 38, 0, 62], st: [[0, '#ff8a6e'], [0.45, '#ec3f34'], [1, '#b0221f']] };
  const GOLD = { l: [0, 20, 0, 80], st: [[0, '#fff2b5'], [0.5, '#ffcb3d'], [1, '#d48b14']] };
  function rocket() {
    // a two-way rocket: a red tube with a gold cone at each end and sparks; drawn lying down (it clears its row)
    return [
      { d: E(50, 74, 34, 3.6), f: '#000', o: 0.18 },
      { d: 'M4 50L17 39.5V60.5z', f: GOLD, s: '#c27d12', w: 1.3, j: 1 }, { d: 'M96 50L83 39.5V60.5z', f: GOLD, s: '#c27d12', w: 1.3, j: 1 },
      { d: RR(16, 38, 68, 24, 9), f: RED, s: '#9c1d1b', w: 1.4 },
      { d: 'M30 38v24M70 38v24', s: '#ffd255', w: 4.4 }, { d: 'M30 38v24M70 38v24', s: '#fff3c0', w: 1.2, o: 0.8 },
      { d: RR(21, 41.5, 58, 5, 2.5), f: '#fff', o: 0.42 },
      { d: 'M42 50h16M53 45.5l5 4.5-5 4.5M47 45.5l-5 4.5 5 4.5', s: '#fff', w: 2.4, o: 0.9, j: 1 },
      { d: star(9, 30, 4.6) + star(91, 70, 4.6) + star(86, 31, 3), f: '#fff3b0', o: 0.95 },
    ];
  }
  function cracker() {
    // a bundle of three firecrackers tied with gold, the fuse lit
    const stick = (x, y, h) => [{ d: RR(x, y, 15, h, 4.5), f: { l: [x, 0, x + 15, 0], st: [[0, '#ff8a6e'], [0.5, '#e8382f'], [1, '#a81f1d']] }, s: '#8e1a18', w: 1.2 },
      { d: RR(x - 0.5, y - 2.5, 16, 6, 3), f: GOLD, s: '#b8770f', w: 1 }, { d: `M${x + 3.5} ${y + 7}v${h - 12}`, s: '#fff', w: 2, o: 0.35 }];
    return [
      { d: E(50, 90, 26, 3.6), f: '#000', o: 0.2 },
      ...stick(22, 40, 46), ...stick(63, 40, 46), ...stick(42.5, 33, 54),
      { d: RR(19, 58, 62, 10, 4), f: GOLD, s: '#b8770f', w: 1.2 }, { d: 'M27 63h46', s: '#c8102e', w: 2, o: 0.8 },
      { d: 'M50 31C50 22 56 20 58 15', s: '#6b4a2a', w: 2.4 },
      { d: star(60, 12, 9, 0.38), f: '#ffd84d' }, { d: star(60, 12, 5, 0.4), f: '#fff' },
      { d: C(69, 8, 1.6) + C(67, 20, 1.3) + C(52, 8, 1.2), f: '#ffe28a' },
    ];
  }
  function lantern() {
    // a paper sky lantern, glowing, with a little flame under it
    return [
      { d: C(50, 50, 44), f: { r: [50, 50, 44], st: [[0, 'rgba(255,214,120,.55)'], [0.6, 'rgba(255,170,80,.18)'], [1, 'rgba(255,150,60,0)']] } },
      { d: 'M28 22C36 15 64 15 72 22L77 70C64 78 36 78 23 70z', f: { l: [0, 16, 0, 76], st: [[0, '#ff7a3d'], [0.45, '#ffb04a'], [1, '#ffe39a']] }, s: '#c4521f', w: 1.6, j: 1 },
      { d: 'M40 17.5L36 74M60 17.5L64 74M50 16v61', s: '#d8692a', w: 1.2, o: 0.55 },
      { d: 'M27 31C40 36 60 36 73 31', s: '#d8692a', w: 1.1, o: 0.4 },
      { d: E(50, 72.5, 26.5, 5.4), f: '#ffe7a8', s: '#c4521f', w: 1.3 },
      { d: E(50, 72.5, 15, 3), f: '#fff6d6' },
      { d: 'M50 76C46 80 46.5 85 50 89C53.5 85 54 80 50 76z', f: '#ffd34d' }, { d: 'M50 80C48.2 82 48.4 85 50 87C51.6 85 51.8 82 50 80z', f: '#fff' },
      { d: ER(38, 33, 6, 11, 12), f: '#fff', o: 0.45 },
    ];
  }
  function firework() {
    // a firework shell: a dark ball with all six colours bursting on it
    const P = [{ d: E(50, 92, 28, 3.6), f: '#000', o: 0.2 },
      { d: C(50, 55, 35), f: { r: [40, 42, 44], st: [[0, '#5a4f9e'], [0.55, '#2c2463'], [1, '#14103a']] }, s: '#0d0a26', w: 1.6 }];
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + 0.26, c = COL[i % 6].k, r1 = 9, r2 = i % 2 ? 24 : 29;
      P.push({ d: `M${(50 + r1 * Math.cos(a)).toFixed(2)} ${(55 + r1 * Math.sin(a)).toFixed(2)}L${(50 + r2 * Math.cos(a)).toFixed(2)} ${(55 + r2 * Math.sin(a)).toFixed(2)}`, s: c, w: 3.4 },
        { d: C(50 + (r2 + 3.5) * Math.cos(a), 55 + (r2 + 3.5) * Math.sin(a), i % 2 ? 1.8 : 2.4), f: c });
    }
    P.push({ d: star(50, 55, 8, 0.45), f: '#fff8d8' }, { d: ER(36, 37, 10, 5.5, -30), f: '#fff', o: 0.32 },
      { d: RR(44, 14, 12, 8, 2.5), f: GOLD, s: '#b8770f', w: 1 }, { d: 'M50 14C50 9 54 7 56 4', s: '#6b4a2a', w: 2 }, { d: star(57, 4, 5, 0.4), f: '#ffe28a' });
    return P;
  }
  function ingot() {
    // a gold ingot (yuanbao): a little boat with a dome
    return [
      { d: E(50, 86, 34, 4), f: '#000', o: 0.22 },
      { d: E(50, 52, 20, 17), f: { r: [44, 42, 22], st: [[0, '#fff6c4'], [0.5, '#ffd24a'], [1, '#c98612']] }, s: '#a86c0c', w: 1.4 },
      { d: 'M8 50C14 58 26 62 50 62C74 62 86 58 92 50C90 70 74 84 50 84C26 84 10 70 8 50z', f: { l: [0, 50, 0, 84], st: [[0, '#ffe680'], [0.45, '#ffc62e'], [1, '#c27c0e']] }, s: '#a86c0c', w: 1.6, j: 1 },
      { d: 'M14 55C24 62 76 62 86 55', s: '#fff4b8', w: 2, o: 0.8 },
      { d: ER(42, 45, 6, 3.6, -25), f: '#fff', o: 0.75 }, { d: ER(28, 70, 8, 3, 15), f: '#fff', o: 0.4 },
      { d: star(80, 26, 6), f: '#fffbe0' },
    ];
  }
  // ---------- obstacles ----------
  function frost(n) {
    // sugar frost on the floor of a cell: one layer is thin, two are thick and crusty
    // on the light meadow floor the ice is a deeper blue, so it still shows
    const pal = theme === 'pal';
    const P = [{ d: RR(3, 3, 94, 94, 16), f: pal ? (n > 1 ? 'rgba(104,176,236,.62)' : 'rgba(140,200,246,.42)') : (n > 1 ? 'rgba(214,236,255,.62)' : 'rgba(214,236,255,.34)'), s: n > 1 ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.55)', w: n > 1 ? 3.4 : 2 }];
    if (n > 1) P.push({ d: 'M14 30L30 14M14 54L54 14M14 78L78 14M26 90L90 26M50 90L90 50M74 90L90 74', s: '#fff', w: 2.2, o: 0.45 });
    P.push({ d: star(24, 24, 7, 0.3) + star(76, 72, 5.5, 0.3), f: '#fff', o: n > 1 ? 0.95 : 0.75 });
    return P;
  }
  function cage() {
    // a bamboo cage over a mochi: three green stalks with joints, tied top and bottom
    const P = [], stalk = x => [{ d: RR(x - 5, 3, 10, 94, 5), f: { l: [x - 5, 0, x + 5, 0], st: [[0, '#a8e07a'], [0.5, '#6cbf4a'], [1, '#3f8a2f']] }, s: '#2f6e24', w: 1.2 },
      { d: `M${x - 5} 34h10M${x - 5} 66h10`, s: '#2f6e24', w: 2.4 }, { d: `M${x - 2} 8v22M${x - 2} 38v24M${x - 2} 70v22`, s: '#e2ffc8', w: 1.4, o: 0.55 }];
    P.push(...stalk(22), ...stalk(50), ...stalk(78));
    P.push({ d: RR(6, 15, 88, 8, 4), f: '#d9b06a', s: '#8a6430', w: 1.2 }, { d: RR(6, 77, 88, 8, 4), f: '#d9b06a', s: '#8a6430', w: 1.2 },
      { d: 'M14 19h72M14 81h72', s: '#fff1c8', w: 1.2, o: 0.6 });
    return P;
  }
  // a gift box: 3 layers is wrapped in red with a bow, 2 is gold with a red ribbon, 1 is the plain box with a string
  function box(n) {
    const col = n >= 3 ? ['#ff7a6a', '#e0382f', '#a51f1c'] : n === 2 ? ['#ffe08a', '#f5b13d', '#c47a12'] : ['#fff1d6', '#e9cfa0', '#b8925a'];
    const rib = n >= 3 ? ['#ffe27a', '#d9a31f'] : n === 2 ? ['#ff6a5a', '#b9241c'] : ['#a0754a', '#7a5432'];
    const P = [{ d: RR(5, 22, 90, 72, 10), f: { l: [0, 22, 0, 94], st: [[0, col[0]], [0.4, col[1]], [1, col[2]]] }, s: col[2], w: 1.6 }];
    if (n >= 2) P.push({ d: RR(2, 16, 96, 20, 7), f: { l: [0, 16, 0, 36], st: [[0, col[0]], [1, col[1]]] }, s: col[2], w: 1.6 });
    P.push({ d: `M43 ${n >= 2 ? 16 : 22}h14v78h-14z`, f: rib[0], s: rib[1], w: 1.1 });
    if (n >= 2) P.push({ d: 'M5 56h90v12h-90z', f: rib[0], s: rib[1], w: 1.1 });
    else P.push({ d: 'M5 58h90', s: rib[0], w: 3.4 }, { d: 'M50 58m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0', f: rib[1] });
    if (n >= 3) P.push({ d: 'M50 17C40 3 22 5 27 14C30 19 41 18 50 17z', f: rib[0], s: rib[1], w: 1.4, j: 1 }, { d: 'M50 17C60 3 78 5 73 14C70 19 59 18 50 17z', f: rib[0], s: rib[1], w: 1.4, j: 1 },
      { d: C(50, 16.5, 5), f: rib[1] });
    P.push({ d: RR(10, n >= 2 ? 19 : 26, 26, 6, 3), f: '#fff', o: 0.38 });
    return P;
  }

  // ---------- rendering the parts ----------
  // as SVG markup for a 100×100 box (gradient ids get the prefix p and a running number)
  let gid = 0;
  function toSvg(parts, p) {
    p = p || 'mm';
    let defs = '', body = '';
    const paint = v => {
      if (!v || typeof v === 'string') return v || 'none';
      const id = `${p}g${(gid++).toString(36)}`;
      const st = v.st.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
      defs += v.r ? `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${v.r[0]}" cy="${v.r[1]}" r="${v.r[2]}">${st}</radialGradient>`
        : `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${v.l[0]}" y1="${v.l[1]}" x2="${v.l[2]}" y2="${v.l[3]}">${st}</linearGradient>`;
      return `url(#${id})`;
    };
    const clips = new Map();
    const clipOf = d => { let id = clips.get(d); if (!id) { id = `${p}c${(gid++).toString(36)}`; clips.set(d, id); defs += `<clipPath id="${id}"><path d="${d}"/></clipPath>`; } return id; };
    for (const q of parts) {
      body += `<path d="${q.d}"` + (q.cl ? ` clip-path="url(#${clipOf(q.cl)})"` : '') + ` fill="${q.f ? paint(q.f) : 'none'}"` + (q.s ? ` stroke="${paint(q.s)}" stroke-width="${q.w || 1}" stroke-linecap="round"${q.j || !q.f ? ' stroke-linejoin="round"' : ''}` : '') + (q.o != null && q.o < 1 ? ` opacity="${q.o}"` : '') + '/>';
    }
    return (defs ? `<defs>${defs}</defs>` : '') + body;
  }
  // on a canvas, into the square (x, y, s); rot turns the drawing by 90° (a standing rocket)
  const pathCache = new Map();
  const P2 = d => { let p = pathCache.get(d); if (!p) { p = new Path2D(d); pathCache.set(d, p); } return p; };
  function draw(x, parts, px, py, s, rot) {
    x.save();
    x.translate(px, py); x.scale(s / 100, s / 100);
    if (rot) { x.translate(50, 50); x.rotate(rot * Math.PI / 2); x.translate(-50, -50); }
    x.lineCap = 'round';
    const paint = v => {
      if (typeof v === 'string') return v;
      const g = v.r ? x.createRadialGradient(v.r[0], v.r[1], 0, v.r[0], v.r[1], v.r[2]) : x.createLinearGradient(v.l[0], v.l[1], v.l[2], v.l[3]);
      for (const [o, c] of v.st) g.addColorStop(o, c);
      return g;
    };
    for (const q of parts) {
      const p = P2(q.d);
      if (q.cl) { x.save(); x.clip(P2(q.cl)); }
      x.globalAlpha = q.o != null ? q.o : 1;
      if (q.f) { x.fillStyle = paint(q.f); x.fill(p); }
      if (q.s) { x.strokeStyle = paint(q.s); x.lineWidth = q.w || 1; x.lineJoin = q.j || !q.f ? 'round' : 'miter'; x.stroke(p); }
      if (q.cl) x.restore();
    }
    x.restore();
  }

  // what a board piece looks like: k is the engine's kind (0 a plain mochi, 1 row rocket, 2 column rocket, 3 firecracker,
  // 4 sky lantern, 5 firework, 6 ingot), c its colour, f the face
  const partCache = new Map();
  function partsOf(k, c, f) {
    const key = k + ':' + c + ':' + (f || '');
    let p = partCache.get(key);
    if (p) return p;
    if (k === 0) p = theme === 'pal' ? critter(c, f || 'idle') : mochi(c, f || 'idle');
    else if (k === 1 || k === 2) p = rocket();
    else if (k === 3) p = cracker();
    else if (k === 4) p = lantern();
    else if (k === 5) p = firework();
    else if (k === 6) p = ingot();
    else if (k === 'frost') p = frost(c);
    else if (k === 'cage') p = cage();
    else if (k === 'box') p = box(c);
    else p = [];
    partCache.set(key, p);
    return p;
  }
  // a little animal, as big as a mochi; it raises its arms when it's happy
  const PFACE = { idle: 'normal', blink: 'blink', happy: 'happy', wow: 'wow', sleep: 'sleep' };
  const critter = (c, f) => CR.parts(CR.TYPES[c], PFACE[f] || 'normal', { lw: 1.1, cheer: f === 'happy' });
  function setTheme(t) {
    t = t === 'mm' ? 'mm' : 'pal';
    if (t === theme) return;
    theme = t; partCache.clear(); imgCache.clear();
  }
  // a cached picture of a piece, px device pixels square, with a margin so ears and glows aren't cut off
  const imgCache = new Map();
  const PAD = 0.14;
  function img(k, c, f, px) {
    const key = k + ':' + c + ':' + (f || '') + ':' + px;
    let cv = imgCache.get(key);
    if (cv) return cv;
    if (imgCache.size > 260) imgCache.clear();
    const full = Math.ceil(px * (1 + 2 * PAD));
    cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(full, full) : Object.assign(document.createElement('canvas'), { width: full, height: full });
    draw(cv.getContext('2d'), partsOf(k, c, f), px * PAD, px * PAD, px, k === 2 ? 1 : 0);
    imgCache.set(key, cv);
    return cv;
  }
  // a piece as an <svg> for the page (goals, rules, the level map, the hub card)
  function svg(k, c, f, p, cls) {
    return `<svg class="${cls || 'pc'}" viewBox="-6 -6 112 112" aria-hidden="true">` + (k === 2 ? `<g transform="rotate(90 50 50)">${toSvg(partsOf(k, c, f), p)}</g>` : toSvg(partsOf(k, c, f), p)) + '</svg>';
  }

  // ---------- the lobby picture: a lantern-fair night, the full moon, a bowl of mochi and one hopping out ----------
  let scene = function (p) {
    p = p || 'sc';
    const at = (parts, x, y, s, extra) => `<g transform="translate(${x} ${y}) scale(${s / 100})"${extra || ''}>${toSvg(parts, p)}</g>`;
    const stars = [[22, 30, 1.2], [70, 14, 0.9], [128, 40, 1.1], [168, 12, 1.3], [206, 50, 0.8], [238, 20, 1], [18, 92, 0.9], [342, 128, 1.1], [328, 96, 0.8], [112, 82, 0.8]]
      .map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.4 + (i % 3) * 0.18}"${i % 2 ? ' class="tw"' : ''}/>`).join('');
    const moon = `<circle cx="292" cy="62" r="54" fill="url(#${p}-mglow)"/><circle cx="292" cy="62" r="34" fill="url(#${p}-moon)"/>` +
      `<circle cx="281" cy="52" r="6" fill="#e9d29c" opacity=".55"/><circle cx="302" cy="74" r="8.5" fill="#e9d29c" opacity=".45"/><circle cx="306" cy="48" r="3.6" fill="#e9d29c" opacity=".5"/>`;
    // a string of round red lanterns across the top
    const rope = 'M-6 8Q90 40 180 30T366 18';
    const lamp = (x, y, s, d) => `<g class="sway" style="animation-delay:${d}s" transform="translate(${x} ${y})"><g transform="scale(${s})">` +
      `<path d="M0 -6v6" stroke="#5b3a2a" stroke-width="1.4"/><rect x="-5" y="0" width="10" height="4" rx="1.5" fill="#f7c64a"/>` +
      `<ellipse cx="0" cy="17" rx="15" ry="13.5" fill="url(#${p}-lamp)"/><path d="M-6 4.6Q-10 17-6 29.4M6 4.6Q10 17 6 29.4M0 3.5v27" stroke="#9e1d18" stroke-width="1" fill="none" opacity=".55"/>` +
      `<rect x="-5" y="28.5" width="10" height="4" rx="1.5" fill="#f7c64a"/><path d="M-2 33v9M0 33v11M2 33v9" stroke="#f7c64a" stroke-width="1.2" stroke-linecap="round"/>` +
      `<ellipse cx="-5" cy="12" rx="3.4" ry="5.5" fill="#fff" opacity=".28"/></g></g>`;
    const lamps = lamp(30, 18, 0.9, -0.4) + lamp(98, 31, 0.78, -1.3) + lamp(166, 31, 0.86, -0.8) + lamp(232, 26, 0.74, -2.1);
    // a sky lantern drifting up on the left
    const kl = `<g class="drift">${at(partsOf(4, 0), 40, 52, 46)}</g>`;
    // the bowl: mochi sitting in the soup, the bowl's front over them, steam rising
    const bx = 180, by = 168;
    const inBowl = at(partsOf(0, 1, 'idle'), bx - 82, by - 40, 50) + at(partsOf(0, 5, 'blink'), bx - 34, by - 46, 52) + at(partsOf(0, 4, 'happy'), bx + 12, by - 44, 50) + at(partsOf(0, 3, 'idle'), bx + 50, by - 38, 46);
    const bowl = `<ellipse cx="${bx}" cy="${by}" rx="104" ry="15" fill="url(#${p}-soup)"/>` + inBowl +
      `<path d="M${bx - 108} ${by}C${bx - 104} ${by + 46} ${bx - 60} ${by + 62} ${bx} ${by + 62}C${bx + 60} ${by + 62} ${bx + 104} ${by + 46} ${bx + 108} ${by}C${bx + 70} ${by + 16} ${bx - 70} ${by + 16} ${bx - 108} ${by}z" fill="url(#${p}-bowl)"/>` +
      `<path d="M${bx - 94} ${by + 22}C${bx - 64} ${by + 34} ${bx + 64} ${by + 34} ${bx + 94} ${by + 22}" stroke="#4f78c9" stroke-width="3" fill="none" opacity=".75"/>` +
      `<path d="M${bx - 80} ${by + 36}q10-7 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0" stroke="#4f78c9" stroke-width="2.2" fill="none" opacity=".6"/>` +
      `<path d="M${bx - 108} ${by}C${bx - 70} ${by + 16} ${bx + 70} ${by + 16} ${bx + 108} ${by}" stroke="#fff" stroke-width="3" fill="none" opacity=".9"/>` +
      `<ellipse cx="${bx}" cy="${by + 64}" rx="40" ry="5" fill="#000" opacity=".25"/><path d="M${bx - 34} ${by + 58}h68l-6 8h-56z" fill="#d9dcef"/>` +
      `<path d="M${bx - 92} ${by + 12}C${bx - 88} ${by + 36} ${bx - 66} ${by + 48} ${bx - 40} ${by + 54}" stroke="#fff" stroke-width="5" fill="none" opacity=".35" stroke-linecap="round"/>`;
    const steam = `<g class="steam" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".22"><path d="M${bx - 30} ${by - 52}c-8-10 8-16 0-28"/><path class="s2" d="M${bx + 8} ${by - 56}c-8-10 8-16 0-28"/><path d="M${bx + 44} ${by - 48}c-8-10 8-16 0-26"/></g>`;
    // the bunny hopping out of the bowl and the chick on the rim
    const hop = `<g class="hop"><path d="M${bx - 128} ${by - 4}q8-16 22-8" stroke="#fff" stroke-width="2" fill="none" opacity=".3" stroke-dasharray="3 4"/>${at(partsOf(0, 0, 'happy'), bx - 150, by - 64, 54)}</g>`;
    const chick = `<g class="peck">${at(partsOf(0, 2, 'wow'), bx + 82, by - 52, 44)}</g>`;
    const kk = `<g class="kk" fill="#fff3b0"><path d="${star(70, 120, 5)}"/><path d="${star(330, 158, 4.4)}"/><path d="${star(256, 112, 3.4)}"/></g>`;
    return `<svg class="scene" viewBox="0 0 360 240" aria-hidden="true"><defs>` +
      `<radialGradient id="${p}-mglow"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".5"/><stop offset=".55" stop-color="#ffd27a" stop-opacity=".12"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="${p}-moon" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#fffbe6"/><stop offset=".6" stop-color="#ffeab0"/><stop offset="1" stop-color="#f0cc78"/></radialGradient>` +
      `<radialGradient id="${p}-lamp" cx="38%" cy="35%" r="75%"><stop offset="0" stop-color="#ff8a6a"/><stop offset=".55" stop-color="#e63a2c"/><stop offset="1" stop-color="#a11d18"/></radialGradient>` +
      `<linearGradient id="${p}-bowl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eef0fb"/><stop offset="1" stop-color="#c9cee8"/></linearGradient>` +
      `<radialGradient id="${p}-soup" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff4dc"/><stop offset="1" stop-color="#f0d9ae"/></radialGradient>` +
      `</defs>${stars}${moon}<path d="${rope}" stroke="#5b3a2a" stroke-width="1.6" fill="none" opacity=".85"/>${lamps}${kl}${steam}${bowl}${hop}${chick}${kk}</svg>`;
  }
  // ---------- the little animals' lobby picture: a picnic in a sunny meadow ----------
  function palScene(p) {
    const at = (parts, x, y, sz, cls, flip) => `<g${cls ? ` class="${cls}"` : ''}><g transform="translate(${x} ${y}) scale(${(flip ? -sz : sz) / 100} ${sz / 100})${flip ? ' translate(-100 0)' : ''}">${toSvg(parts, p)}</g></g>`;
    const CRF = (c, f) => CR.parts(CR.TYPES[c], f, { lw: 1.1, cheer: f === 'happy' });
    const cloud = (x, y, s, d) => `<g class="drift" style="animation-delay:${d}s"><g transform="translate(${x} ${y}) scale(${s})" fill="#fff"><circle cx="-14" cy="2" r="12"/><circle cx="4" cy="-6" r="16"/><circle cx="22" cy="3" r="10.5"/><rect x="-26" y="1" width="58" height="12.5" rx="6.25"/></g></g>`;
    const flower = (x, y, c, s, d) => `<g class="sway" style="animation-delay:${d}s" transform="translate(${x} ${y}) scale(${s})"><path d="M0 0v14" stroke="#5fae4f" stroke-width="1.8" stroke-linecap="round"/>` +
      [0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-4.6" rx="3.2" ry="4.4" fill="${c}" transform="rotate(${a})"/>`).join('') + `<circle r="2.6" fill="#ffd84d"/></g>`;
    const sun = `<circle cx="300" cy="44" r="46" fill="url(#${p}-sun)"/><circle cx="300" cy="44" r="21" fill="#ffe27a"/><circle cx="300" cy="44" r="21" fill="none" stroke="#ffc94a" stroke-width="2.5"/>` +
      `<g class="tw" stroke="#ffd25a" stroke-width="3" stroke-linecap="round">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4, c = Math.cos(a), s2 = Math.sin(a); return `<path d="M${(300 + 28 * c).toFixed(1)} ${(44 + 28 * s2).toFixed(1)}L${(300 + 35 * c).toFixed(1)} ${(44 + 35 * s2).toFixed(1)}"/>`; }).join('')}</g>`;
    // the meadow fades out at the sides and the bottom, into the page
    const hills = `<g mask="url(#${p}-mv)"><g mask="url(#${p}-mh)"><path d="M-10 142C40 110 96 104 150 120C200 134 250 104 300 96C330 92 352 98 370 106V250H-10z" fill="#bfe7a2"/>` +
      `<path d="M-10 162C60 138 120 142 180 154C240 166 300 142 370 138V250H-10z" fill="#a6dc85"/></g></g>`;
    // the blanket: red and white checks, seen from the front
    const bl = 'M62 226L104 158H262L306 226z';
    let checks = '';
    for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6; if (i % 2) continue; const xa = 104 + (62 - 104) * 0, xb = 262; checks += `<path d="M${(104 - 42 * t0 + (xa - 104)).toFixed(1)} ${(158 + 68 * t0).toFixed(1)}L${(262 + 44 * t0 + (xb - 262)).toFixed(1)} ${(158 + 68 * t0).toFixed(1)}L${(262 + 44 * t1).toFixed(1)} ${(158 + 68 * t1).toFixed(1)}L${(104 - 42 * t1).toFixed(1)} ${(158 + 68 * t1).toFixed(1)}z" fill="#ff8f8f" opacity=".55"/>`; }
    for (let j = 0; j < 8; j++) { if (j % 2) continue; const a = j / 8, b = (j + 1) / 8; checks += `<path d="M${(104 + 158 * a).toFixed(1)} 158L${(104 + 158 * b).toFixed(1)} 158L${(62 + 244 * b).toFixed(1)} 226L${(62 + 244 * a).toFixed(1)} 226z" fill="#ff8f8f" opacity=".55"/>`; }
    const blanket = `<path d="${bl}" fill="#fff6ee"/><g clip-path="url(#${p}-bl)">${checks}</g><path d="${bl}" fill="none" stroke="#e86f6f" stroke-width="2" stroke-linejoin="round"/>`;
    // a basket and a plate of berries
    const basket = `<g transform="translate(248 140)"><path d="M-22 8h44l-6 22h-32z" fill="#e0a25a" stroke="#9b6532" stroke-width="2" stroke-linejoin="round"/><path d="M-17 15h34M-15 22h30" stroke="#b97a3e" stroke-width="1.6"/><path d="M-16 8c0-18 32-18 32 0" fill="none" stroke="#9b6532" stroke-width="3"/><circle cx="-6" cy="6" r="4.2" fill="#ff6b6b"/><circle cx="3" cy="5" r="4.2" fill="#ff8a5b"/><circle cx="10" cy="7" r="3.6" fill="#ffd25a"/></g>`;
    const sparkles = `<g class="kk" fill="#fff"><path d="${star(64, 64, 4.4)}"/><path d="${star(208, 34, 3.6)}"/><path d="${star(344, 120, 3.4)}"/></g>`;
    const pals = at(CRF(3, 'idle'), 92, 116, 58) + at(CRF(1, 'happy'), 148, 102, 64) + at(CRF(4, 'blink'), 204, 110, 60, '', true) +
      at(CRF(0, 'happy'), 104, 156, 62, 'peck') + at(CRF(5, 'idle'), 176, 160, 60) +
      `<g class="hop">${at(CRF(2, 'wow'), 286, 140, 50)}</g>`;
    return `<svg class="scene" viewBox="0 0 360 240" aria-hidden="true"><defs>` +
      `<radialGradient id="${p}-sun"><stop offset="0" stop-color="#fff2b0" stop-opacity=".9"/><stop offset=".6" stop-color="#ffe9a0" stop-opacity=".25"/><stop offset="1" stop-color="#ffe9a0" stop-opacity="0"/></radialGradient>` +
      `<clipPath id="${p}-bl"><path d="${bl}"/></clipPath>` +
      `<linearGradient id="${p}-fh" gradientUnits="userSpaceOnUse" x1="-6" y1="0" x2="366" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".09" stop-color="#fff"/><stop offset=".91" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
      `<linearGradient id="${p}-fv" gradientUnits="userSpaceOnUse" x1="0" y1="196" x2="0" y2="242"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
      `<mask id="${p}-mh" maskUnits="userSpaceOnUse" x="-20" y="-20" width="400" height="280"><rect x="-20" y="-20" width="400" height="280" fill="url(#${p}-fh)"/></mask>` +
      `<mask id="${p}-mv" maskUnits="userSpaceOnUse" x="-20" y="-20" width="400" height="280"><rect x="-20" y="-20" width="400" height="280" fill="url(#${p}-fv)"/></mask></defs>` +
      `${sun}${cloud(70, 40, 0.9, -1)}${cloud(196, 62, 0.62, -3)}${hills}` +
      `${flower(30, 176, '#ff9fc0', 1, -0.5)}${flower(48, 194, '#ffffff', 0.85, -2)}${flower(326, 168, '#b9a3ff', 1, -1.4)}${flower(340, 190, '#ff9fc0', 0.8, -2.6)}${flower(22, 150, '#ffd25a', 0.75, -3)}` +
      `${blanket}${basket}${pals}${sparkles}</svg>`;
  }
  const mmScene = scene;
  scene = p => (theme === 'pal' ? palScene(p) : mmScene(p));

  // ---------- the home page's card (hub/build.py): a little board at night, three chicks lined up to pop, the piglet
  // peeking over the top as the friend does in the game. Always the little animals, whatever the look is set to. ----------
  function hub(p) {
    p = p || 'hub';
    const CRF = (c, f) => CR.parts(CR.TYPES[c], f, { lw: 1.1, cheer: f === 'happy' });
    const at = (parts, x, y, sz, cls) => `<g${cls ? ` class="${cls}"` : ''}><g transform="translate(${x} ${y}) scale(${sz / 100})">${toSvg(parts, p)}</g></g>`;
    const S = 40, X0 = 60, Y0 = 70;                    // a cell, and the grid's top left corner
    // what sits where (-1 a rocket) and the faces; the middle row's three chicks are the match
    const K = [[5, 1, 3, 4, 0], [4, 2, 2, 2, 1], [3, 0, -1, 5, 3]];
    const F = [['idle', 'blink', 'idle', 'idle', 'wow'], ['idle', 'happy', 'happy', 'happy', 'idle'], ['blink', 'idle', '', 'idle', 'idle']];
    const bx = X0 - 7, by = Y0 - 7, bw = 5 * S + 14, bh = 3 * S + 14;
    let cells = '', pieces = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const x = X0 + c * S, y = Y0 + r * S, sz = S * 0.94, o = (S - sz) / 2, k = K[r][c];
      cells += `<rect x="${x + 1.4}" y="${y + 1.4}" width="${S - 2.8}" height="${S - 2.8}" rx="7.5" fill="${(r + c) % 2 ? '#f5e3c6' : '#fffdf6'}"/>`;
      pieces += k < 0 ? at(partsOf(1, 0), x + o, y + o, sz) : at(CRF(k, F[r][c]), x + o, y + o, sz, r === 1 && c >= 1 && c <= 3 ? `j j${c}` : '');
    }
    const hl = `<rect class="hl" x="${X0 + S - 2}" y="${Y0 + S - 2}" width="${3 * S + 4}" height="${S + 4}" rx="12" fill="url(#${p}-hl)" stroke="#ffc53d" stroke-width="2"/>`;
    const board = `<rect x="${bx}" y="${by + 7}" width="${bw}" height="${bh}" rx="18" fill="#12040c" opacity=".55" filter="url(#${p}-blur)"/>` +
      `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="18" fill="#fff7e6" stroke="#fff" stroke-width="3"/>`;
    // the piglet behind the board's top edge, cheering
    const bud = `<g class="bud">${at(CRF(0, 'happy'), bx + bw * 0.74 - 37, by - 50, 74)}</g>`;
    const moon = `<circle cx="34" cy="30" r="24" fill="url(#${p}-mg)"/><path transform="translate(19 15) scale(.3)" d="M62 14A38 38 0 1 0 86 62A30 30 0 1 1 62 14Z" fill="#f6e3b4"/>`;
    const stars = [[78, 22, 1.1], [124, 40, 0.8], [292, 30, 1.2], [300, 92, 0.9], [16, 112, 0.9], [44, 64, 0.7]]
      .map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.45 + (i % 3) * 0.15}"${i % 2 ? ' class="tw"' : ''}/>`).join('');
    const kk = `<g class="kk"><path d="${star(X0 + S - 6, Y0 + S - 8, 7, 0.3)}" fill="#fff6c4"/><path d="${star(X0 + 4 * S + 8, Y0 + 2 * S - 4, 6, 0.3)}" fill="#fff"/></g>` +
      `<g class="kk k2"><path d="${star(X0 + 2.6 * S, Y0 + S - 12, 4.5, 0.3)}" fill="#fff"/><path d="${star(X0 - 14, Y0 + 1.6 * S, 5, 0.3)}" fill="#ffe27a"/></g>`;
    return `<svg class="scene" viewBox="0 0 320 200" aria-hidden="true"><defs>` +
      `<radialGradient id="${p}-mg"><stop offset="0" stop-color="#f6e3b4" stop-opacity=".35"/><stop offset="1" stop-color="#f6e3b4" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="${p}-hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7c9"/><stop offset="1" stop-color="#ffdc6e"/></linearGradient>` +
      `<filter id="${p}-blur" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="7"/></filter></defs>` +
      `${moon}${stars}${bud}<g transform="rotate(-3 160 ${Y0 + 1.5 * S})">${board}${cells}${hl}${pieces}</g>${kk}</svg>`;
  }

  // ---------- icons (24×24, the line style the other games use) ----------
  function icons() {
    const I = (id, d) => `<symbol id="i-${id}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</g></symbol>`;
    return I('rule', '<path d="M6 4.5h9.5L18 7v12.5H6z"/><path d="M9 10h6M9 13.5h6M9 17h3.5"/>') +
      I('share', '<circle cx="17" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.7 10.8l6.1-3.5M8.7 13.2l6.1 3.5"/>') +
      I('again', '<path d="M5 12a7 7 0 0 1 12-4.9L19 9"/><path d="M19 4.5V9h-4.5"/><path d="M19 12a7 7 0 0 1-12 4.9L5 15"/><path d="M5 19.5V15h4.5"/>') +
      I('trophy', '<path d="M8 4.5h8v4a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6h2.5a2.5 2.5 0 0 1-2.6 3.4M12 12.5v3.5M8.5 19.5h7M9.5 16h5v3.5h-5z"/>') +
      I('timer', '<circle cx="12" cy="13.5" r="6.5"/><path d="M12 10v3.5l2 1.5M10 3.5h4M12 3.5V7"/>') +
      I('target', '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>') +
      I('star', '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>') +
      I('moves', '<path d="M7 7.5h10M17 7.5l-3-3M17 7.5l-3 3"/><path d="M17 16.5H7M7 16.5l3-3M7 16.5l3 3"/>') +
      I('hammer', '<path d="M13.5 5.5l5 5M11 8l5 5M9.5 6.5l4-3 7 7-3 4"/><path d="M12.5 11.5L5 19a1.6 1.6 0 0 1-2.2-2.2l7.5-7.5"/>') +
      I('swap', '<rect x="3.5" y="8" width="7" height="8" rx="2.5"/><rect x="13.5" y="8" width="7" height="8" rx="2.5"/><path d="M7 5.5q5-3.5 10 0M15.5 4l1.5 1.5-1.8 1.2M17 18.5q-5 3.5-10 0M8.5 20L7 18.5l1.8-1.2"/>') +
      I('shuffle', '<path d="M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.7 0 2.7-1.4 3.6-3.2M13 10.2c.9-1.8 1.9-3.2 3.6-3.2H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>') +
      I('bulb', '<path d="M9 17.5h6M10 20.5h4M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.8.6 1.3 1.6 1.3 2.6h4c0-1 .5-2 1.3-2.6A5.5 5.5 0 0 0 12 3.5z"/>') +
      I('map', '<path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z"/><path d="M9 4.5v13M15 6.5v13"/>') +
      I('bolt', '<path d="M13 3 5.5 13.5H12L10.5 21 18.5 10H12z"/>') +
      I('music', '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.8" cy="17.5" r="2.2"/><circle cx="16.8" cy="15.5" r="2.2"/>') +
      I('vib', '<rect x="8" y="4.5" width="8" height="15" rx="2"/><path d="M4.5 9v6M19.5 9v6"/>') +
      I('eye', '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>') +
      I('room', '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M9 5v14M4 12h5"/>') +
      I('cage', '<rect x="4.5" y="4" width="15" height="16" rx="2"/><path d="M9.5 4v16M14.5 4v16M4.5 9h15M4.5 15h15"/>') +
      I('touch', '<path d="M9.5 11V5.8a1.8 1.8 0 0 1 3.6 0V10l3.6.6a2.4 2.4 0 0 1 2 2.6l-.5 4.3a3.5 3.5 0 0 1-3.5 3h-2.5a4 4 0 0 1-3.2-1.6l-2.8-3.8a1.6 1.6 0 0 1 2.4-2.1z"/>') +
      I('moon', '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>') +
      I('check', '<path d="M5 12.5l4.5 4.5L19 7.5"/>') +
      I('theme', '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 2-.8 2-1.8 0-1.2-1-1.6-1-2.7 0-1 .8-1.6 1.8-1.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.1-3.8-7.4-8.5-7.4z"/><circle cx="7.6" cy="11.2" r="1.1"/><circle cx="10.4" cy="7.6" r="1.1"/><circle cx="15" cy="7.9" r="1.1"/>');
  }

  G.MMArt = {
    get COL() { return theme === 'pal' ? PALC : COL; }, get theme() { return theme; }, setTheme, PALC, MMC: COL,
    PC, INK, partsOf, toSvg, draw, img, svg, PAD, scene, hub, icons, star, RR, E, C,
  };
})(typeof window !== 'undefined' ? window : globalThis);
