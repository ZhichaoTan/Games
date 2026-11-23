// ===== 快乐柴柴 Shiba Stack · artwork: the shiba, the blocks with faces, the lobby picture, icons =====
// All drawn here (SVG for the page, canvas for the well), no image files. Colours are this game's own.
(function (G) {
  'use strict';
  // block colours: a main colour, a darker edge and a light top. 1 I matcha, 2 O shiba orange, 3 T sakura, 4 S sky, 5 Z grape, 6 J butter, 7 L coral, 8 bubble rows
  const COL = [null,
    { a: '#86d69a', b: '#4b9f68', c: '#d6f7dc' },
    { a: '#f7a54f', b: '#cf7326', c: '#ffdcad' },
    { a: '#f59abf', b: '#cc5f8b', c: '#ffd9e8' },
    { a: '#72bff2', b: '#3d86c6', c: '#d2ecff' },
    { a: '#b096f5', b: '#7a5cd0', c: '#e6ddff' },
    { a: '#ffd664', b: '#d9a22a', c: '#fff3c4' },
    { a: '#f77f6b', b: '#cc4a3b', c: '#ffcdc3' },
    { a: '#a3aec6', b: '#6c7894', c: '#eef2f9' },
  ];
  const INK = '#2a1c1a', BLUSH = '#ff8f86', FUR = '#f29a45', FUR2 = '#d67a2c', CREAM = '#fff3df', EARIN = '#f7c2a4';

  // ---------- the shiba (viewBox 0 0 120 120); every face it can pull is a group switched on by mood() ----------
  function shiba(id) {
    const p = id || 'sh';
    return `<svg class="shiba" viewBox="0 0 120 120" aria-hidden="true"><defs>` +
      `<radialGradient id="${p}-fur" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#f8b468"/><stop offset=".6" stop-color="${FUR}"/><stop offset="1" stop-color="${FUR2}"/></radialGradient>` +
      `<radialGradient id="${p}-cr" cx="50%" cy="20%" r="90%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#f6e2c4"/></radialGradient></defs>` +
      `<ellipse class="shadow" cx="60" cy="114.5" rx="34" ry="4.5" fill="#000" opacity=".22"/>` +
      // the tail curls up behind, on the right
      `<g class="tail"><path d="M83 96c10 2 20-4 21-15 1-10-7-17-15-15-6 1-9 7-6 11 2 3 6 2 6-1" fill="none" stroke="url(#${p}-fur)" stroke-width="11" stroke-linecap="round"/>` +
      `<path d="M89 72c5-1 9 3 8 8" fill="none" stroke="${CREAM}" stroke-width="3.2" stroke-linecap="round" opacity=".9"/></g>` +
      `<g class="bod">` +
      `<path d="M29 113C28 88 41 71 60 71s32 17 31 42z" fill="url(#${p}-fur)"/>` +
      `<path d="M45 113c0-17 6-29 15-29s15 12 15 29z" fill="url(#${p}-cr)"/>` +
      `<ellipse cx="48" cy="112" rx="8.6" ry="5.4" fill="${CREAM}"/><ellipse cx="72" cy="112" rx="8.6" ry="5.4" fill="${CREAM}"/>` +
      `<path d="M46 110v3.4M50 110v3.4M70 110v3.4M74 110v3.4" stroke="#e2c6a2" stroke-width="1.2" stroke-linecap="round"/>` +
      `</g>` +
      `<g class="head">` +
      `<g class="ear el"><path d="M28.5 33.5 33 9.5 51.5 24z" fill="url(#${p}-fur)" stroke="${FUR}" stroke-width="4.5" stroke-linejoin="round"/><path d="M34.5 28 36.4 16.2 45.4 24z" fill="${EARIN}"/></g>` +
      `<g class="ear er"><path d="M91.5 33.5 87 9.5 68.5 24z" fill="url(#${p}-fur)" stroke="${FUR}" stroke-width="4.5" stroke-linejoin="round"/><path d="M85.5 28 83.6 16.2 74.6 24z" fill="${EARIN}"/></g>` +
      `<ellipse cx="60" cy="52" rx="35" ry="29.5" fill="url(#${p}-fur)"/>` +
      // the cream mask on the cheeks and muzzle, and the two eyebrow dots shibas have
      `<path d="M26.5 57c2.5 14 16 23 33.5 23s31-9 33.5-23c-5 4.5-12.5 5-18-1.5-3.6-4.2-9.8-5.6-15.5-5.6s-11.9 1.4-15.5 5.6C39 62 31.5 61.5 26.5 57z" fill="url(#${p}-cr)"/>` +
      `<ellipse cx="47" cy="39.5" rx="4.4" ry="2.7" fill="${CREAM}" opacity=".95"/><ellipse cx="73" cy="39.5" rx="4.4" ry="2.7" fill="${CREAM}" opacity=".95"/>` +
      `<ellipse cx="49" cy="33" rx="13" ry="5" fill="#fff" opacity=".13"/>` +
      `<ellipse class="blush" cx="38.5" cy="62" rx="6" ry="3.4" fill="${BLUSH}" opacity=".5"/><ellipse class="blush" cx="81.5" cy="62" rx="6" ry="3.4" fill="${BLUSH}" opacity=".5"/>` +
      // eyes
      `<g class="v v-eo"><g class="blink"><ellipse cx="47" cy="50" rx="4.3" ry="5.4" fill="${INK}"/><ellipse cx="73" cy="50" rx="4.3" ry="5.4" fill="${INK}"/>` +
      `<circle cx="48.6" cy="48" r="1.7" fill="#fff"/><circle cx="74.6" cy="48" r="1.7" fill="#fff"/></g></g>` +
      `<g class="v v-eh" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"><path d="M41.5 51.5q5.5-7 11 0M67.5 51.5q5.5-7 11 0"/></g>` +
      `<g class="v v-ec" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"><path d="M41.5 48.5q5.5 5.5 11 0M67.5 48.5q5.5 5.5 11 0"/></g>` +
      `<g class="v v-ew"><circle cx="47" cy="49.5" r="6.4" fill="${INK}"/><circle cx="73" cy="49.5" r="6.4" fill="${INK}"/>` +
      `<circle cx="49.2" cy="47" r="2.4" fill="#fff"/><circle cx="75.2" cy="47" r="2.4" fill="#fff"/><circle cx="45" cy="52.4" r="1.2" fill="#fff"/><circle cx="71" cy="52.4" r="1.2" fill="#fff"/></g>` +
      `<g class="v v-es"><circle cx="47" cy="49.5" r="5.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="73" cy="49.5" r="5.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/>` +
      `<circle cx="47" cy="50" r="2.3" fill="${INK}"/><circle cx="73" cy="50" r="2.3" fill="${INK}"/></g>` +
      `<g class="v v-ex" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"><path d="M42.5 45.5l9 9M51.5 45.5l-9 9M68.5 45.5l9 9M77.5 45.5l-9 9"/></g>` +
      `<g class="v v-ey" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"><path d="M41 47.5q6 3.5 12 1.5M67 49q6 2 12-1.5"/><path d="M42 41.5l8 3M78 41.5l-8 3" stroke-width="2"/></g>` +
      // nose and mouths
      `<path d="M55 58.2q5-2 10 0-1.6 5.2-5 5.4-3.4-.2-5-5.4z" fill="${INK}"/><ellipse cx="58.3" cy="58.4" rx="1.6" ry=".9" fill="#fff" opacity=".45"/>` +
      `<g class="v v-mw" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"><path d="M60 63.5q-2.8 4.4-6.6 2.2M60 63.5q2.8 4.4 6.6 2.2"/></g>` +
      `<g class="v v-mo"><path d="M52.5 64q7.5 13 15 0-7.5 2.6-15 0z" fill="#7c2a2e"/><path d="M55.6 68.5q4.4 4.8 8.8 0-4.4-2.2-8.8 0z" fill="#ff7f95"/><path d="M60 63.5q-2.8 2-6.6 1M60 63.5q2.8 2 6.6 1" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/></g>` +
      `<g class="v v-mr"><ellipse cx="60" cy="68" rx="3.4" ry="4.2" fill="#7c2a2e"/></g>` +
      `<g class="v v-mf" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"><path d="M53.5 67.5q3.2-2.6 6.5 0t6.5 0"/></g>` +
      `<g class="v v-mt"><path d="M60 63.5q-2.8 4.4-6.6 2.2M60 63.5q2.8 4.4 6.6 2.2" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/><path d="M57 66.6h6v3.2a3 3 0 0 1-6 0z" fill="#ff7f95"/></g>` +
      `</g>` +
      // extras: a sweat drop, sleep marks, sparkles, a little heart
      `<g class="v v-xs"><path d="M93 24c3 4.6 4.5 7.4 4.5 9.4a4.5 4.5 0 0 1-9 0c0-2 1.5-4.8 4.5-9.4z" fill="#9fd8ff"/><circle cx="91.6" cy="33" r="1.2" fill="#fff" opacity=".9"/></g>` +
      `<g class="v v-xz" fill="none" stroke="#e8e2ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path class="z1" d="M90 30h7l-7 8h7"/><path class="z2" d="M99 16h5l-5 6h5" stroke-width="1.8"/></g>` +
      `<g class="v v-xk" fill="#fff3b0"><path class="k1" d="M17 30l1.8 4.6 4.6 1.8-4.6 1.8L17 42.8l-1.8-4.6-4.6-1.8 4.6-1.8z"/><path class="k2" d="M101 18l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z"/><path class="k3" d="M104 50l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z"/></g>` +
      `<g class="v v-xh"><path class="hrt" d="M98 30c-3-4.5-10-2.8-9.4 2.6.4 3.8 5.4 6.8 9.4 9.4 4-2.6 9-5.6 9.4-9.4.6-5.4-6.4-7.1-9.4-2.6z" fill="#ff7f95"/></g>` +
      `</svg>`;
  }
  // which groups each mood shows; the app sets data-mood on the svg for the motion
  const MOODS = {
    idle: ['eo', 'mw'], happy: ['eh', 'mo', 'xk'], wow: ['ew', 'mo', 'xk'], love: ['eh', 'mt', 'xh'],
    worry: ['eo', 'mf', 'xs'], shock: ['es', 'mr', 'xs'], ko: ['ex', 'mf'], sleep: ['ec', 'mw', 'xz'], proud: ['ec', 'mt'], sad: ['ey', 'mf'],
  };
  function mood(svg, m) {
    if (!svg) return;
    const on = new Set(MOODS[m] || MOODS.idle);
    svg.querySelectorAll('.v').forEach(g => { const k = g.getAttribute('class').split(' ').find(c => c.startsWith('v-')).slice(2); g.style.display = on.has(k) ? '' : 'none'; });
    svg.setAttribute('data-mood', m);
  }

  // ---------- a block cell in SVG (for the lobby picture, the rules and the hub card) ----------
  function defs(p) {
    p = p || 'sb';
    return COL.map((c, i) => c ? `<linearGradient id="${p}-g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.c}"/><stop offset=".26" stop-color="${c.a}"/><stop offset="1" stop-color="${c.b}"/></linearGradient>` : '').join('');
  }
  // one cell at (x, y), size s; face: 'awake', 'sleep' or none; ears: the two little ears on top (only on a face)
  function cell(t, x, y, s, o) {
    o = o || {};
    const c = COL[t], p = o.p || 'sb', r = s * 0.27, k = s * 0.045;
    let h = `<g transform="translate(${x} ${y})">`;
    if (o.ears) h += ears(t, s);
    h += `<rect x="${k}" y="${k}" width="${s - 2 * k}" height="${s - 2 * k}" rx="${r}" fill="url(#${p}-g${t})"/>` +
      `<rect x="${k + s * 0.02}" y="${k + s * 0.02}" width="${s - 2 * k - s * 0.04}" height="${s - 2 * k - s * 0.04}" rx="${r * 0.92}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="${s * 0.03}"/>` +
      `<ellipse cx="${s * 0.4}" cy="${s * 0.25}" rx="${s * 0.25}" ry="${s * 0.09}" fill="#fff" opacity=".42"/>`;
    if (t === 8) h += `<circle cx="${s * 0.68}" cy="${s * 0.62}" r="${s * 0.12}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="${s * 0.035}"/><circle cx="${s * 0.36}" cy="${s * 0.7}" r="${s * 0.07}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="${s * 0.03}"/>`;
    if (o.face) h += faceSvg(s, o.face, o.look || 0);
    return h + '</g>';
  }
  function ears(t, s) {
    const c = COL[t];
    const one = m => `<path d="M${s / 2 + m * s * 0.1} ${s * 0.18} Q${s / 2 + m * s * 0.28} ${-s * 0.24} ${s / 2 + m * s * 0.36} ${-s * 0.14} Q${s / 2 + m * s * 0.46} ${s * 0.02} ${s / 2 + m * s * 0.45} ${s * 0.22}Z" fill="${c.a}" stroke="${c.b}" stroke-width="${s * 0.05}" stroke-linejoin="round"/>` +
      `<path d="M${s / 2 + m * s * 0.19} ${s * 0.13} Q${s / 2 + m * s * 0.3} ${-s * 0.1} ${s / 2 + m * s * 0.35} ${-s * 0.05} Q${s / 2 + m * s * 0.4} ${s * 0.05} ${s / 2 + m * s * 0.39} ${s * 0.15}Z" fill="${EARIN}"/>`;
    return one(-1) + one(1);
  }
  function faceSvg(s, f, look) {
    const ex = s * 0.19, ey = s * 0.47, lx = look * s * 0.035;
    let h = `<ellipse cx="${s * 0.5 - ex}" cy="${s * 0.33}" rx="${s * 0.06}" ry="${s * 0.035}" fill="#fff" opacity=".75"/><ellipse cx="${s * 0.5 + ex}" cy="${s * 0.33}" rx="${s * 0.06}" ry="${s * 0.035}" fill="#fff" opacity=".75"/>`;
    if (f === 'sleep') h += `<path d="M${s * 0.5 - ex - s * 0.08} ${ey} q${s * 0.08} ${s * 0.07} ${s * 0.16} 0M${s * 0.5 + ex - s * 0.08} ${ey} q${s * 0.08} ${s * 0.07} ${s * 0.16} 0" fill="none" stroke="${INK}" stroke-width="${s * 0.045}" stroke-linecap="round" opacity=".8"/>`;
    else h += `<ellipse cx="${s * 0.5 - ex + lx}" cy="${ey}" rx="${s * 0.058}" ry="${s * 0.075}" fill="${INK}"/><ellipse cx="${s * 0.5 + ex + lx}" cy="${ey}" rx="${s * 0.058}" ry="${s * 0.075}" fill="${INK}"/>` +
      `<circle cx="${s * 0.5 - ex + lx + s * 0.02}" cy="${ey - s * 0.03}" r="${s * 0.022}" fill="#fff"/><circle cx="${s * 0.5 + ex + lx + s * 0.02}" cy="${ey - s * 0.03}" r="${s * 0.022}" fill="#fff"/>`;
    h += `<ellipse cx="${s * 0.25}" cy="${s * 0.62}" rx="${s * 0.075}" ry="${s * 0.045}" fill="${BLUSH}" opacity=".55"/><ellipse cx="${s * 0.75}" cy="${s * 0.62}" rx="${s * 0.075}" ry="${s * 0.045}" fill="${BLUSH}" opacity=".55"/>` +
      `<ellipse cx="${s * 0.5}" cy="${s * 0.585}" rx="${s * 0.05}" ry="${s * 0.035}" fill="${INK}"/>` +
      `<path d="M${s * 0.5} ${s * 0.61} q-${s * 0.04} ${s * 0.07} -${s * 0.09} ${s * 0.03}M${s * 0.5} ${s * 0.61} q${s * 0.04} ${s * 0.07} ${s * 0.09} ${s * 0.03}" fill="none" stroke="${INK}" stroke-width="${s * 0.035}" stroke-linecap="round" opacity=".85"/>`;
    return h;
  }
  // a whole block (type t, turn r) in SVG with its cells' top-left at (x, y); face: 'awake' or 'sleep'
  function block(t, x, y, s, o) {
    o = o || {};
    const SB = G.SB, r = o.r || 0, cs = SB.CELLS[t][r], fi = SB.SHAPES[t].face;
    const minx = Math.min(...cs.map(c => c[0])), miny = Math.min(...cs.map(c => c[1]));
    const own = new Set(cs.map(c => c.join()));
    let h = '';
    // the face cell last, so its ears sit on top
    const order = cs.map((c, i) => i).sort((a, b) => (a === fi) - (b === fi));
    for (const i of order) {
      const [cx, cy] = cs[i], isF = i === fi && o.face;
      h += cell(t, x + (cx - minx) * s, y + (cy - miny) * s, s, { p: o.p, face: isF ? o.face : null, ears: isF && o.face === 'awake' && !own.has(cx + ',' + (cy - 1)), look: o.look });
    }
    return h;
  }

  // ---------- the lobby picture: a night garden, a tower of sleeping blocks, one falling, and the shiba watching ----------
  function scene(p) {
    p = p || 'sc';
    const s = 24, gx = 44, gy = 202;   // cells; the ground line
    const B = (t, cx, cy, o) => block(t, gx + cx * s, gy - (cy + 1) * s, s, Object.assign({ p }, o));
    const C = (t, cx, cy, o) => cell(t, gx + cx * s, gy - (cy + 1) * s, s, Object.assign({ p }, o));
    let blocks = '';
    // a little stack, three rows high, with a gap where the T will go
    blocks += C(8, 0, 0) + C(8, 1, 0) + C(8, 2, 0) + C(1, 3, 0) + C(1, 4, 0) + C(1, 5, 0) + C(1, 6, 0, { face: 'sleep' });
    blocks += C(2, 0, 1) + C(2, 1, 1, { face: 'sleep' }) + C(2, 0, 2) + C(2, 1, 2) + C(4, 4, 1) + C(4, 5, 1, { face: 'sleep' }) + C(4, 5, 2) + C(4, 6, 2);
    blocks += C(6, 6, 1) + C(7, 2, 1) + C(7, 2, 2, { face: 'sleep' });
    const gh = (cx, cy) => `<rect x="${gx + cx * s + 2.5}" y="${gy - (cy + 1) * s + 2.5}" width="${s - 5}" height="${s - 5}" rx="7" fill="rgba(245,154,191,.12)" stroke="#f59abf" stroke-opacity=".7" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    const ghost = gh(3, 1) + gh(3, 2) + gh(3, 3) + gh(4, 2);
    const fall = `<g class="fall">${block(3, gx + 3 * s, gy - 7.75 * s, s, { p, r: 1, face: 'awake', look: 0 })}` +
      `<path d="M${gx + 3.25 * s} ${gy - 8 * s}v-${s * 0.45}M${gx + 3.6 * s} ${gy - 8.05 * s}v-${s * 0.3}" stroke="#ffd9e8" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/></g>`;
    const stars = [[300, 26, 1.4], [252, 14, 1], [342, 62, 1.1], [16, 70, .9], [200, 40, .8], [120, 18, 1.2], [176, 8, .9]].map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${.35 + (i % 3) * .15}"${i % 2 ? ' class="tw"' : ''}/>`).join('');
    const moon = `<path d="M31 20a16 16 0 1 0 19 22 13 13 0 1 1-19-22z" fill="#f6e3b4" opacity=".92"/>`;
    const grass = `<path d="M0 ${gy + 1}h360" stroke="rgba(255,236,200,.16)" stroke-width="1.5"/><ellipse cx="170" cy="${gy + 6}" rx="170" ry="7" fill="#000" opacity=".18"/>`;
    const paws = [[214, 212], [196, 216], [178, 212]].map(([x, y]) => `<g transform="translate(${x} ${y}) scale(.8)" fill="rgba(255,236,200,.13)"><ellipse cx="0" cy="3" rx="4.4" ry="3.6"/><circle cx="-4.6" cy="-2.4" r="1.7"/><circle cx="-1.6" cy="-4.6" r="1.7"/><circle cx="1.8" cy="-4.6" r="1.7"/><circle cx="4.8" cy="-2.4" r="1.7"/></g>`).join('');
    return `<svg class="scene" viewBox="0 0 360 222" aria-hidden="true"><defs>${defs(p)}</defs>${stars}${moon}${grass}${paws}<g class="stack">${ghost}${blocks}</g>${fall}` +
      `<g class="pup" transform="translate(222 84)">${shiba(p + 'd').replace('<svg class="shiba" viewBox="0 0 120 120" aria-hidden="true">', '<svg class="shiba" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" data-mood="happy">')}</g>` +
      `<g class="kk" fill="#fff3b0" opacity=".9"><path d="M206 64l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"/><path d="M344 120l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z"/></g></svg>`;
  }
  // the picture with the shiba's moods set (the lobby shows the happy face; the hub can't run scripts on it, so it is baked in)
  function sceneBaked(p) {
    const s = scene(p);
    const on = new Set(MOODS.happy);
    return s.replace(/<g class="v v-(\w+)"/g, (m, k) => (on.has(k) ? m : m + ' style="display:none"'));
  }

  // ---------- icons (24×24, drawn with the line style the other games use) ----------
  function icons() {
    const I = (id, d) => `<symbol id="i-${id}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</g></symbol>`;
    return I('rule', '<path d="M6 4.5h9.5L18 7v12.5H6z"/><path d="M9 10h6M9 13.5h6M9 17h3.5"/>') +
      I('share', '<circle cx="17" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.7 10.8l6.1-3.5M8.7 13.2l6.1 3.5"/>') +
      I('cw', '<path d="M18.5 12a6.5 6.5 0 1 1-2.2-4.9"/><path d="M17.2 3.6v4h-4"/>') +
      I('ccw', '<path d="M5.5 12a6.5 6.5 0 1 0 2.2-4.9"/><path d="M6.8 3.6v4h4"/>') +
      I('drop', '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M6 19.5h12"/>') +
      I('hold', '<rect x="4.5" y="7" width="15" height="12" rx="2.5"/><path d="M8.5 7V5.5h7V7M9 13h6"/>') +
      I('left', '<path d="M14.5 6 8.5 12l6 6"/>') +
      I('right', '<path d="M9.5 6l6 6-6 6"/>') +
      I('down', '<path d="M6 9.5l6 6 6-6"/>') +
      I('trophy', '<path d="M8 4.5h8v4a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6h2.5a2.5 2.5 0 0 1-2.6 3.4M12 12.5v3.5M8.5 19.5h7M9.5 16h5v3.5h-5z"/>') +
      I('timer', '<circle cx="12" cy="13.5" r="6.5"/><path d="M12 10v3.5l2 1.5M10 3.5h4M12 3.5V7"/>') +
      I('target', '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>') +
      I('touch', '<path d="M9.5 11V5.8a1.8 1.8 0 0 1 3.6 0V10l3.6.6a2.4 2.4 0 0 1 2 2.6l-.5 4.3a3.5 3.5 0 0 1-3.5 3h-2.5a4 4 0 0 1-3.2-1.6l-2.8-3.8a1.6 1.6 0 0 1 2.4-2.1z"/>') +
      I('pad', '<rect x="3" y="7" width="18" height="10" rx="5"/><path d="M7.5 10.5v3M6 12h3"/><circle cx="15.5" cy="11" r=".6" fill="currentColor"/><circle cx="17.5" cy="13" r=".6" fill="currentColor"/>') +
      I('paw', '<ellipse cx="12" cy="15.5" rx="4" ry="3.4"/><circle cx="6.8" cy="10.6" r="1.6"/><circle cx="10" cy="7.6" r="1.6"/><circle cx="14" cy="7.6" r="1.6"/><circle cx="17.2" cy="10.6" r="1.6"/>') +
      I('music', '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.8" cy="17.5" r="2.2"/><circle cx="16.8" cy="15.5" r="2.2"/>') +
      I('vib', '<rect x="8" y="4.5" width="8" height="15" rx="2"/><path d="M4.5 9v6M19.5 9v6"/>') +
      I('ghost', '<rect x="5" y="5" width="6" height="6" rx="1.6" stroke-dasharray="2.2 1.8"/><rect x="13" y="5" width="6" height="6" rx="1.6" stroke-dasharray="2.2 1.8"/><rect x="13" y="13" width="6" height="6" rx="1.6" stroke-dasharray="2.2 1.8"/>') +
      I('again', '<path d="M5 12a7 7 0 0 1 12-4.9L19 9"/><path d="M19 4.5V9h-4.5"/><path d="M19 12a7 7 0 0 1-12 4.9L5 15"/><path d="M5 19.5V15h4.5"/>') +
      I('eye', '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>') +
      I('room', '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M9 5v14M4 12h5"/>');
  }

  // ---------- drawing on a canvas: one cached image per colour and size, faces drawn over them ----------
  const cache = new Map();
  function rr(x, c, y, w, h, r) { x.beginPath(); x.moveTo(c + r, y); x.arcTo(c + w, y, c + w, y + h, r); x.arcTo(c + w, y + h, c, y + h, r); x.arcTo(c, y + h, c, y, r); x.arcTo(c, y, c + w, y, r); x.closePath(); }
  function cellImg(t, px, dim) {
    const key = t + ':' + px + (dim ? 'd' : '');
    let cv = cache.get(key);
    if (cv) return cv;
    if (cache.size > 120) cache.clear();
    cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(px, px) : Object.assign(document.createElement('canvas'), { width: px, height: px });
    const x = cv.getContext('2d'), c = COL[t], k = Math.max(1, px * 0.045), r = px * 0.27, s = px;
    const g = x.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, c.c); g.addColorStop(0.26, c.a); g.addColorStop(1, c.b);
    rr(x, k, k, s - 2 * k, s - 2 * k, r); x.fillStyle = g; x.fill();
    x.lineWidth = Math.max(1, s * 0.03); x.strokeStyle = 'rgba(255,255,255,.35)';
    rr(x, k + s * 0.02, k + s * 0.02, s - 2 * k - s * 0.04, s - 2 * k - s * 0.04, r * 0.92); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.42)'; x.beginPath(); x.ellipse(s * 0.4, s * 0.25, s * 0.25, s * 0.09, 0, 0, Math.PI * 2); x.fill();
    if (t === 8) {
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = Math.max(1, s * 0.035);
      x.beginPath(); x.arc(s * 0.68, s * 0.62, s * 0.12, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = Math.max(1, s * 0.03);
      x.beginPath(); x.arc(s * 0.36, s * 0.7, s * 0.07, 0, Math.PI * 2); x.stroke();
    }
    if (dim) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(30,22,40,.55)'; x.fillRect(0, 0, s, s); }
    cache.set(key, cv);
    return cv;
  }
  // a face on a cell at (x, y) of size s (canvas pixels). f: 'awake', 'sleep', 'squish', 'worry'; look: -1..1 sideways
  function face(x, cx, cy, s, f, look) {
    const ex = s * 0.19, ey = cy + s * 0.47, lx = (look || 0) * s * 0.035, mid = cx + s / 2;
    x.save();
    x.fillStyle = 'rgba(255,255,255,.75)';
    x.beginPath(); x.ellipse(mid - ex, cy + s * 0.33, s * 0.06, s * 0.035, 0, 0, 7); x.ellipse(mid + ex, cy + s * 0.33, s * 0.06, s * 0.035, 0, 0, 7); x.fill();
    x.strokeStyle = INK; x.fillStyle = INK; x.lineCap = 'round';
    if (f === 'sleep') {
      x.globalAlpha = 0.78; x.lineWidth = Math.max(1, s * 0.045);
      x.beginPath(); x.moveTo(mid - ex - s * 0.08, ey); x.quadraticCurveTo(mid - ex, ey + s * 0.07, mid - ex + s * 0.08, ey);
      x.moveTo(mid + ex - s * 0.08, ey); x.quadraticCurveTo(mid + ex, ey + s * 0.07, mid + ex + s * 0.08, ey); x.stroke();
      x.globalAlpha = 1;
    } else if (f === 'squish') {
      x.lineWidth = Math.max(1, s * 0.05);
      x.beginPath(); x.moveTo(mid - ex - s * 0.07, ey - s * 0.06); x.lineTo(mid - ex + s * 0.05, ey); x.lineTo(mid - ex - s * 0.07, ey + s * 0.06);
      x.moveTo(mid + ex + s * 0.07, ey - s * 0.06); x.lineTo(mid + ex - s * 0.05, ey); x.lineTo(mid + ex + s * 0.07, ey + s * 0.06); x.stroke();
    } else {
      const ry = f === 'worry' ? s * 0.085 : s * 0.075;
      x.beginPath(); x.ellipse(mid - ex + lx, ey, s * 0.058, ry, 0, 0, 7); x.ellipse(mid + ex + lx, ey, s * 0.058, ry, 0, 0, 7); x.fill();
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(mid - ex + lx + s * 0.02, ey - s * 0.03, Math.max(0.6, s * 0.022), 0, 7); x.arc(mid + ex + lx + s * 0.02, ey - s * 0.03, Math.max(0.6, s * 0.022), 0, 7); x.fill();
    }
    x.fillStyle = BLUSH; x.globalAlpha = 0.55;
    x.beginPath(); x.ellipse(cx + s * 0.25, cy + s * 0.62, s * 0.075, s * 0.045, 0, 0, 7); x.ellipse(cx + s * 0.75, cy + s * 0.62, s * 0.075, s * 0.045, 0, 0, 7); x.fill();
    x.globalAlpha = 1; x.fillStyle = INK;
    x.beginPath(); x.ellipse(mid, cy + s * 0.585, s * 0.05, s * 0.035, 0, 0, 7); x.fill();
    x.globalAlpha = 0.85; x.lineWidth = Math.max(0.8, s * 0.035);
    x.beginPath();
    if (f === 'worry') { x.moveTo(mid - s * 0.08, cy + s * 0.68); x.quadraticCurveTo(mid - s * 0.04, cy + s * 0.64, mid, cy + s * 0.68); x.quadraticCurveTo(mid + s * 0.04, cy + s * 0.72, mid + s * 0.08, cy + s * 0.68); }
    else { x.moveTo(mid, cy + s * 0.61); x.quadraticCurveTo(mid - s * 0.04, cy + s * 0.68, mid - s * 0.09, cy + s * 0.64); x.moveTo(mid, cy + s * 0.61); x.quadraticCurveTo(mid + s * 0.04, cy + s * 0.68, mid + s * 0.09, cy + s * 0.64); }
    x.stroke();
    x.restore();
  }
  function earsC(x, t, cx, cy, s, perk) {
    const c = COL[t], mid = cx + s / 2, k = (perk == null ? 1 : perk);
    x.save(); x.lineJoin = 'round';
    for (const m of [-1, 1]) {
      x.beginPath(); x.moveTo(mid + m * s * 0.1, cy + s * 0.18);
      x.quadraticCurveTo(mid + m * s * 0.28, cy - s * 0.24 * k, mid + m * s * 0.36, cy - s * 0.14 * k);
      x.quadraticCurveTo(mid + m * s * 0.46, cy + s * 0.02, mid + m * s * 0.45, cy + s * 0.22); x.closePath();
      x.fillStyle = c.a; x.strokeStyle = c.b; x.lineWidth = Math.max(1, s * 0.05); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(mid + m * s * 0.19, cy + s * 0.13);
      x.quadraticCurveTo(mid + m * s * 0.3, cy - s * 0.1 * k, mid + m * s * 0.35, cy - s * 0.05 * k);
      x.quadraticCurveTo(mid + m * s * 0.4, cy + s * 0.05, mid + m * s * 0.39, cy + s * 0.15); x.closePath();
      x.fillStyle = EARIN; x.fill();
    }
    x.restore();
  }
  const PC = ['#ffb35c', '#6fd0c4', '#b79bff', '#ff8fb1'];   // player colours, seat by seat
  G.SBArt = { COL, PC, shiba, MOODS, mood, defs, cell, block, scene, sceneBaked, icons, cellImg, face, ears: earsC, rr };
})(typeof window !== 'undefined' ? window : globalThis);
