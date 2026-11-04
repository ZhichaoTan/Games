// ===== 麻将牌面和小图标：每张牌面是一个 symbol（viewBox 0 0 300 400），id = "t" + 种类(0..26) =====
(function (G) {
  'use strict';
  // 牌面是 FluffyStuff 的标准立直麻将牌（公有领域 CC0），见 tiles.js；颜色和缺门图标用同一套
  const RED = '#cc3328', GRN = '#0f7543', BLU = '#1b3784', INK = '#1c1c1c', IV = '#fffdf8';
  const face = t => (G.MJ_TILES && G.MJ_TILES[t]) || '';

  // 缺门标记：圆里一个字
  const QUE_COL = [RED, GRN, BLU];

  function sprite(glyphs) {
    glyphs = glyphs || G.MJ_GLYPHS;
    let sym = '';
    for (let t = 0; t < 27; t++) sym += `<symbol id="t${t}" viewBox="0 0 300 400">${face(t)}</symbol>`;
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
