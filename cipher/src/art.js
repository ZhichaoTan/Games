// ===== Cipher artwork: the key and keyhole on the tiles, the icons, and the faint drawing behind the table. All vector, all original =====
(function (G) {
  'use strict';
  // the key: a ring, a collar and a bit, standing upright so it fills a tall tile face
  const KEY = '<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="9.6" r="5.9"/><path d="M12 15.5V35.2"/><path d="M8.7 18.6h6.6"/><path d="M12 27.4h5.2v3.3h-2.5M12 33.1h4.4"/></g>' +
    '<circle cx="12" cy="9.6" r="2" fill="currentColor"/>';
  // the keyhole on a tile's back
  const HOLE = '<path d="M12 7.2a5.2 5.2 0 0 1 2.9 9.5l1.9 13.1H7.2l1.9-13.1A5.2 5.2 0 0 1 12 7.2z" fill="currentColor"/>';
  // a page from an inventor's notebook: compass circles, a square, a few construction lines and ticks
  function drafting() {
    let ticks = '';
    for (let i = 0; i < 72; i++) {
      const a = i * Math.PI / 36, r1 = 182, r2 = i % 6 ? 189 : 198;
      ticks += `M${(250 + r1 * Math.cos(a)).toFixed(1)} ${(250 + r1 * Math.sin(a)).toFixed(1)}L${(250 + r2 * Math.cos(a)).toFixed(1)} ${(250 + r2 * Math.sin(a)).toFixed(1)}`;
    }
    return '<g fill="none" stroke="currentColor" stroke-width="1.1">' +
      '<circle cx="250" cy="250" r="182"/><circle cx="250" cy="250" r="128" stroke-dasharray="2 6"/><circle cx="250" cy="250" r="236" stroke-width=".7"/>' +
      '<rect x="121" y="121" width="258" height="258" transform="rotate(12 250 250)"/>' +
      '<path d="M10 250H490M250 10V490M80 80L420 420M420 80L80 420" stroke-width=".55" stroke-dasharray="1 7"/>' +
      `<path d="${ticks}" stroke-width=".9"/>` +
      '<circle cx="250" cy="250" r="3.5" fill="currentColor"/>' +
      '<path d="M250 250L379 130" stroke-width=".8"/><circle cx="379" cy="130" r="5"/>' +
      '</g>';
  }
  function sprite() {
    const I = (id, d) => `<symbol id="i-${id}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</g></symbol>`;
    let s = `<symbol id="cx-key" viewBox="0 0 24 40">${KEY}</symbol><symbol id="cx-hole" viewBox="0 0 24 40">${HOLE}</symbol>`;
    s += `<symbol id="cx-draft" viewBox="0 0 500 500">${drafting()}</symbol>`;
    s += I('key', '<circle cx="7.5" cy="12" r="3.6"/><path d="M11.1 12H20.5M17.2 12v3.2M20.2 12v2.6"/>');
    s += I('eye', '<path d="M2.5 12s3.6-6.3 9.5-6.3 9.5 6.3 9.5 6.3-3.6 6.3-9.5 6.3S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>');
    s += I('rule', '<path d="M5.5 5.8A2.3 2.3 0 0 1 7.8 3.5H18.5v14H7.8a2.3 2.3 0 0 0-2.3 2.3z"/><path d="M5.5 19.8a2.3 2.3 0 0 0 2.3 1.7H18.5v-4"/><path d="M9.5 8h5"/>');
    s += I('gear', '<path d="M4 7h9.5M17.5 7H20M4 17h3M11 17h9"/><circle cx="15.5" cy="7" r="2.1"/><circle cx="9" cy="17" r="2.1"/>');
    s += I('share', '<path d="M12 14.5V4M7.8 8.2L12 4l4.2 4.2"/><path d="M5.5 12.5v6A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5v-6"/>');
    s += I('check', '<path d="M5 12.6l4.4 4.4L19 7.4"/>');
    s += I('crown', '<path d="M4.4 17.2L3.4 8.2l4.8 3.9L12 5.6l3.8 6.5 4.8-3.9-1 9z"/><path d="M5.2 20h13.6"/>');
    s += I('plus', '<path d="M12 5.5v13M5.5 12h13"/>');
    s += I('hint', '<path d="M9.4 17.6h5.2M10.3 20.6h3.4"/><path d="M12 3.4a5.8 5.8 0 0 0-3.4 10.5c.6.5 1 1.1 1 1.9h4.8c0-.8.4-1.4 1-1.9A5.8 5.8 0 0 0 12 3.4z"/>');
    s += I('door', '<path d="M10 4.5H6.8A1.6 1.6 0 0 0 5.2 6.1v11.8a1.6 1.6 0 0 0 1.6 1.6H10"/><path d="M14 8l4 4-4 4M18 12H9.5"/>');
    s += I('hand', '<path d="M8.5 12.5V6.2a1.4 1.4 0 0 1 2.8 0v5"/><path d="M11.3 10.8V4.9a1.4 1.4 0 0 1 2.8 0v5.9"/><path d="M14.1 10.9V6.4a1.4 1.4 0 0 1 2.8 0v7.2c0 3.9-2.4 6.9-5.9 6.9-2.4 0-3.9-1.1-5.3-3.3l-2-3.3a1.35 1.35 0 0 1 2.2-1.6l1.6 1.9"/>');
    s += I('people', '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.8 14.3c1.6.7 2.6 2.3 2.8 4.7"/>');
    return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${s}</svg>`;
  }
  G.CXArt = { sprite, KEY, HOLE };
})(typeof window !== 'undefined' ? window : globalThis);
