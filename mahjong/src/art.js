// ===== 麻将牌面（全部矢量）：万子用毛笔字，筒子、条子、幺鸡手画 =====
// 每张牌面是一个 symbol（viewBox 0 0 60 80），id = "t" + 种类(0..26)
(function (G) {
  'use strict';
  const RED = '#c4312f', GRN = '#17784c', BLU = '#1d4f8f', INK = '#1d2b4f', IV = '#fbf8f0';

  // ---- 万：上面数字，下面红色“万” ----
  function wan(r, glyphs) {
    const NUMS = '一二三四五六七八九';
    const num = glyphs[NUMS[r - 1]], wan = glyphs['万'];
    // 字形 1000 单位：数字放在上半（高 34），万放在下半（高 36）
    const fit = (g, y0, h, col, wmax) => {
      const [x0, y1, x1, y2] = g.box; const gw = x1 - x0, gh = y2 - y1;
      const s = Math.min(h / gh, wmax / gw);
      const tx = 30 - (x0 + gw / 2) * s, ty = y0 + h / 2 - (y1 + gh / 2) * s;
      return `<path d="${g.d}" fill="${col}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})"/>`;
    };
    const tall = [1, 2].includes(r) ? 0.8 : 1;
    return fit(num, 5 + (1 - tall) * 12, 30 * tall, INK, 46) + fit(wan, 41, 35, RED, 44);
  }

  // ---- 筒：同心圆点 ----
  function dot(cx, cy, r, col) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${(r * 0.74).toFixed(2)}" fill="${IV}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${(r * 0.56).toFixed(2)}" fill="${col}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${(r * 0.2).toFixed(2)}" fill="${IV}"/>`;
  }
  function bigDot() {
    let s = `<circle cx="30" cy="40" r="23" fill="${GRN}"/><circle cx="30" cy="40" r="20.3" fill="${IV}"/>`;
    // 一圈花瓣
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, x = 30 + Math.cos(a) * 15.6, y = 40 + Math.sin(a) * 15.6;
      s += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="2.5" ry="3.9" transform="rotate(${(i * 22.5 + 90).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${BLU}"/>`;
    }
    s += `<circle cx="30" cy="40" r="11" fill="${RED}"/><circle cx="30" cy="40" r="8" fill="${IV}"/><circle cx="30" cy="40" r="5.6" fill="${RED}"/>`;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; s += `<circle cx="${(30 + Math.cos(a) * 6.9).toFixed(2)}" cy="${(40 + Math.sin(a) * 6.9).toFixed(2)}" r=".9" fill="${RED}"/>`; }
    s += `<circle cx="30" cy="40" r="1.8" fill="${IV}"/>`;
    return s;
  }
  function tong(r) {
    if (r === 1) return bigDot();
    const L = {
      2: [[30, 22, 11.5, GRN], [30, 58, 11.5, BLU]],
      3: [[15, 17, 9.6, BLU], [30, 40, 9.6, RED], [45, 63, 9.6, GRN]],
      4: [[17, 23, 10.4, BLU], [43, 23, 10.4, GRN], [17, 57, 10.4, GRN], [43, 57, 10.4, BLU]],
      5: [[16, 17, 9, BLU], [44, 17, 9, GRN], [30, 40, 9, RED], [16, 63, 9, GRN], [44, 63, 9, BLU]],
      6: [[17, 14, 8.4, GRN], [43, 14, 8.4, GRN], [17, 43, 8.4, RED], [43, 43, 8.4, RED], [17, 66, 8.4, RED], [43, 66, 8.4, RED]],
      7: [[13, 11, 7.6, GRN], [30, 20.5, 7.6, GRN], [47, 30, 7.6, GRN], [17, 51, 7.6, RED], [43, 51, 7.6, RED], [17, 69, 7.6, RED], [43, 69, 7.6, RED]],
      8: [[17, 12, 7.9, BLU], [43, 12, 7.9, BLU], [17, 30.7, 7.9, BLU], [43, 30.7, 7.9, BLU], [17, 49.3, 7.9, BLU], [43, 49.3, 7.9, BLU], [17, 68, 7.9, BLU], [43, 68, 7.9, BLU]],
      9: [[12, 15, 7.7, BLU], [30, 15, 7.7, BLU], [48, 15, 7.7, BLU], [12, 40, 7.7, RED], [30, 40, 7.7, RED], [48, 40, 7.7, RED], [12, 65, 7.7, GRN], [30, 65, 7.7, GRN], [48, 65, 7.7, GRN]],
    }[r];
    return L.map(([x, y, rr, c]) => dot(x, y, rr, c)).join('');
  }

  // ---- 条：竹节 ----
  function stick(cx, cy, h, col, rot, w) {
    w = w || 8.4;
    const x = -w / 2, y = -h / 2, rr = w * 0.46;
    const tr = `translate(${cx} ${cy})` + (rot ? ` rotate(${rot})` : '');
    return `<g transform="${tr}">` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}" fill="${col}"/>` +
      // 竹节：中间鼓一圈，两头各一道
      `<rect x="${x - 0.9}" y="-1.6" width="${w + 1.8}" height="3.2" rx="1.6" fill="${col}"/>` +
      `<path d="M${x + 1.1} -.1h${w - 2.2}" stroke="${IV}" stroke-width="1.1" stroke-linecap="round"/>` +
      `<path d="M${x + 1.2} ${y + 2.8}h${w - 2.4}M${x + 1.2} ${-y - 2.8}h${w - 2.4}" stroke="${IV}" stroke-width="1" stroke-linecap="round" opacity=".85"/>` +
      // 高光
      `<path d="M${x + 2.3} ${y + 4.6}V-3.2M${x + 2.3} 3.2V${-y - 4.6}" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".35"/>` +
      `</g>`;
  }
  // 幺鸡：一只站在枝头的小鸟
  function bird() {
    return `<g>` +
      // 尾羽
      `<path d="M33 47C40 38 44 24 51 12" stroke="${RED}" stroke-width="4.6" fill="none" stroke-linecap="round"/>` +
      `<path d="M35 50C43 44 49 34 56 27" stroke="${BLU}" stroke-width="4.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M35 53C44 51 50 46 56 41" stroke="${GRN}" stroke-width="4.2" fill="none" stroke-linecap="round"/>` +
      `<circle cx="51" cy="12" r="3.2" fill="${RED}"/><circle cx="51" cy="12" r="1.3" fill="${IV}"/>` +
      `<circle cx="56" cy="27" r="3" fill="${BLU}"/><circle cx="56" cy="27" r="1.2" fill="${IV}"/>` +
      `<circle cx="56" cy="41" r="2.8" fill="${GRN}"/><circle cx="56" cy="41" r="1.1" fill="${IV}"/>` +
      // 身体
      `<path d="M14 40C14 31 22 27 28 31C34 35 41 43 38 52C35 61 22 62 17 55C13 50 14 45 14 40Z" fill="${GRN}"/>` +
      `<path d="M17 47C19 55 27 58 33 54C29 58 21 58 18 53Z" fill="#7fc69a" opacity=".9"/>` +
      // 翅膀
      `<path d="M22 40C27 37 34 41 36 48C31 47 26 48 22 52C21 47 20 43 22 40Z" fill="${BLU}"/>` +
      `<path d="M25 44C28 43 31 44 33 47M24 48C27 47 30 47.5 32 50" stroke="${IV}" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".8"/>` +
      // 头
      `<circle cx="17.5" cy="29" r="7.6" fill="${GRN}"/>` +
      `<path d="M13 22.5C13.5 18.5 16 17 17.5 19.5C18.5 16.2 21.5 16.6 21.6 20C23.3 18.5 25.2 19.8 24 23Z" fill="${RED}"/>` +
      `<path d="M10.6 28.4L4.6 30.6L10.8 32.4Z" fill="#e0912f"/>` +
      `<circle cx="15.6" cy="28" r="2.2" fill="${IV}"/><circle cx="15.3" cy="28" r="1.35" fill="#111"/><circle cx="14.9" cy="27.5" r=".45" fill="#fff"/>` +
      // 腿和树枝
      `<path d="M24 60L22.5 68M29 60.5L30 68" stroke="#d27a2a" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M8 69.5C20 67.5 34 68 50 70.5" stroke="#8a5a2b" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M40 69.4C43 66 46 65.6 49 66.4" stroke="${GRN}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
      `</g>`;
  }
  function tiao(r) {
    if (r === 1) return bird();
    const S = (x, y, c, rot, h, w) => stick(x, y, h || 31, c, rot, w);
    switch (r) {
      case 2: return S(30, 21, GRN) + S(30, 59, BLU);
      case 3: return S(30, 21, BLU) + S(17, 59, GRN) + S(43, 59, GRN);
      case 4: return S(17, 21, GRN) + S(43, 21, BLU) + S(17, 59, BLU) + S(43, 59, GRN);
      case 5: return S(12.5, 21, GRN, 0, 31, 7.8) + S(47.5, 21, BLU, 0, 31, 7.8) + S(30, 40, RED, 0, 31, 7.8) + S(12.5, 59, BLU, 0, 31, 7.8) + S(47.5, 59, GRN, 0, 31, 7.8);
      case 6: return S(12, 21, GRN, 0, 31, 8) + S(30, 21, GRN, 0, 31, 8) + S(48, 21, GRN, 0, 31, 8) + S(12, 59, BLU, 0, 31, 8) + S(30, 59, BLU, 0, 31, 8) + S(48, 59, BLU, 0, 31, 8);
      case 7: return S(30, 11.5, RED, 0, 20, 7.6) + S(12, 39.5, GRN, 0, 21, 7.6) + S(30, 39.5, GRN, 0, 21, 7.6) + S(48, 39.5, GRN, 0, 21, 7.6) + S(12, 66.5, BLU, 0, 21, 7.6) + S(30, 66.5, BLU, 0, 21, 7.6) + S(48, 66.5, BLU, 0, 21, 7.6);
      case 8: return S(7.5, 21, GRN, 0, 30, 7) + S(23, 20, GRN, 21, 30, 7) + S(37, 20, GRN, -21, 30, 7) + S(52.5, 21, GRN, 0, 30, 7) + S(7.5, 59, BLU, 0, 30, 7) + S(23, 60, BLU, -21, 30, 7) + S(37, 60, BLU, 21, 30, 7) + S(52.5, 59, BLU, 0, 30, 7);
      case 9: return [12.5, 40, 67.5].map((y, i) => S(12, y, i === 1 ? BLU : GRN, 0, 22, 7.8) + S(30, y, RED, 0, 22, 7.8) + S(48, y, i === 1 ? BLU : GRN, 0, 22, 7.8)).join('');
    }
    return '';
  }

  function face(t, glyphs) {
    const s = (t / 9) | 0, r = t % 9 + 1;
    if (s === 0) return wan(r, glyphs);
    if (s === 1) return tiao(r);
    return tong(r);
  }

  // 缺门标记：圆里一个字
  const QUE_COL = ['#c4312f', '#17784c', '#1d4f8f'];

  function sprite(glyphs) {
    glyphs = glyphs || G.MJ_GLYPHS;
    let sym = '';
    for (let t = 0; t < 27; t++) sym += `<symbol id="t${t}" viewBox="0 0 60 80">${face(t, glyphs)}</symbol>`;
    // 缺门小图标（英文界面用）：万字、一根竹子、一个筒
    const wg = glyphs['万'];
    if (wg) {
      const [x0, y1, x1, y2] = wg.box, sc = Math.min(17 / (x1 - x0), 17 / (y2 - y1));
      sym += `<symbol id="q0" viewBox="0 0 24 24"><path d="${wg.d}" fill="currentColor" transform="translate(${(12 - (x0 + x1) / 2 * sc).toFixed(2)} ${(12 - (y1 + y2) / 2 * sc).toFixed(2)}) scale(${sc.toFixed(4)})"/></symbol>`;
    }
    sym += '<symbol id="q1" viewBox="0 0 24 24"><g fill="currentColor"><rect x="9.4" y="2.6" width="5.2" height="8.2" rx="2.4"/><rect x="9.4" y="13.2" width="5.2" height="8.2" rx="2.4"/><rect x="8.2" y="10.6" width="7.6" height="2.8" rx="1.4"/></g></symbol>';
    sym += '<symbol id="q2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></symbol>';
    // 牌背花纹
    sym += `<symbol id="tback" viewBox="0 0 60 80"><path d="M30 18L42 40L30 62L18 40Z" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2"/><path d="M30 28L36 40L30 52L24 40Z" fill="rgba(255,255,255,.16)"/></symbol>`;
    const I = (id, d, extra = '') => `<symbol id="i-${id}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</g></symbol>`;
    sym += I('rule', '<path d="M6 4.5h9.5L18 7v12.5H6z"/><path d="M9 10h6M9 13.5h6M9 17h3.5"/>');
    sym += I('auto', '<rect x="5" y="8" width="14" height="11" rx="3.5"/><path d="M12 8V5"/><path d="M9.5 13h.01M14.5 13h.01" stroke-width="2.6"/><path d="M3 13v2M21 13v2"/>');
    sym += I('hint', '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.6 1.2 1.5 1.2 2.5h4c0-1 .5-1.9 1.2-2.5A5.5 5.5 0 0 0 12 3.5z"/>');
    sym += I('share', '<circle cx="17" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.7 10.8l6.1-3.5M8.7 13.2l6.1 3.5"/>');
    sym += I('eye', '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>');
    sym += I('cards', '<rect x="4" y="6" width="8" height="12" rx="1.6"/><rect x="12" y="6" width="8" height="12" rx="1.6"/>');
    sym += I('swap', '<path d="M5 8.5h12.5L14.5 5.5M19 15.5H6.5l3 3"/>');
    sym += I('trophy', '<path d="M8 4.5h8v4a4 4 0 0 1-8 0z"/><path d="M8 6.5H5.5a2.5 2.5 0 0 0 2.5 3.5M16 6.5h2.5a2.5 2.5 0 0 1-2.5 3.5"/><path d="M12 12.5V16M9 19.5h6M10 16h4v3.5h-4z"/>');
    sym += I('vib', '<rect x="8" y="4.5" width="8" height="15" rx="2"/><path d="M4.5 9v6M19.5 9v6M2.5 10.5v3M21.5 10.5v3"/>');
    return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${sym}</svg>`;
  }

  G.MJArt = { sprite, face, QUE_COL, RED, GRN, BLU, INK, IV };
})(typeof window !== 'undefined' ? window : globalThis);
