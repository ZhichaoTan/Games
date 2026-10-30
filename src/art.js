// ===== 美术素材：花色、头像、筹码、印章（全部是矢量，组成一个全局 SVG sprite） =====
(function (G) {
  'use strict';

  // ---- 花色（viewBox 0 0 100 100，fill=currentColor） ----
  const SUITS = {
    s: '<path d="M50 5C50 5 91 35 91 59C91 73 81 81 69.5 81C61.5 81 55.5 77 52.5 70.5C53.5 80.5 57.5 88.5 65 95H35C42.5 88.5 46.5 80.5 47.5 70.5C44.5 77 38.5 81 30.5 81C19 81 9 73 9 59C9 35 50 5 50 5Z"/>',
    h: '<path d="M50 91C50 91 7 63 7 35.5C7 19 19 8.5 32.5 8.5C41.5 8.5 47.5 13.5 50 20.5C52.5 13.5 58.5 8.5 67.5 8.5C81 8.5 93 19 93 35.5C93 63 50 91 50 91Z"/>',
    d: '<path d="M50 3C59.5 21.5 73.5 37.5 92 50C73.5 62.5 59.5 78.5 50 97C40.5 78.5 26.5 62.5 8 50C26.5 37.5 40.5 21.5 50 3Z"/>',
    c: '<circle cx="50" cy="29" r="19"/><circle cx="28" cy="57" r="19"/><circle cx="72" cy="57" r="19"/><path d="M40 38H60L63 60H37Z"/><path d="M46.5 55C46.5 75 42 86 33 95H67C58 86 53.5 75 53.5 55Z"/>',
  };

  // ---- 头像 ----
  // 每个头像：圆形底（渐变）+ 胸像。坐标都在 100x100 里，最后整体被圆形裁切。
  const EYE = (x, y, rx = 3.7, ry = 4.6, c = '#231c1a') =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}"/><circle cx="${x + rx * 0.35}" cy="${y - ry * 0.38}" r="${Math.max(1, rx * 0.36)}" fill="#fff"/>`;
  const BLUSH = (y = 67, dx = 19, c = '#ff7b7b', o = 0.32) =>
    `<ellipse cx="${50 - dx}" cy="${y}" rx="5.2" ry="3" fill="${c}" opacity="${o}"/><ellipse cx="${50 + dx}" cy="${y}" rx="5.2" ry="3" fill="${c}" opacity="${o}"/>`;
  const MOUTH = (y = 66, c = '#5a3a30', w = 1.5) =>
    `<path d="M50 ${y}q-2.6 3.6-5.4 1.6M50 ${y}q2.6 3.6 5.4 1.6" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const SHEEN = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".16"/>`;
  // 身体 + 头下方一点阴影，让头和身体分开
  const BODY = (c, y = 104, rx = 33, ry = 24) => `<ellipse cx="50" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}"/><ellipse cx="50" cy="${y - ry + 5}" rx="${rx * 0.62}" ry="6" fill="#000" opacity=".18"/>`;

  const AVATARS = [
    { key: 'cat', en: 'Cat', zh: '猫', bg: ['#3fb3a5', '#1f6f69'], draw: () => {
      const f = '#f2a85e', d = '#d9843f', m = '#fde7cb';
      return BODY(d) +
        `<path d="M23 47L28 17L47 33Z" fill="${f}" stroke="${f}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M77 47L72 17L53 33Z" fill="${f}" stroke="${f}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M29 39L31 25L40 33Z" fill="#f5aea0"/><path d="M71 39L69 25L60 33Z" fill="#f5aea0"/>` +
        `<ellipse cx="50" cy="59" rx="29" ry="25" fill="${f}"/>` +
        `<path d="M44 35.5q.8 4 0 7.5M50 34.5v8.5M56 35.5q-.8 4 0 7.5" stroke="${d}" stroke-width="3" stroke-linecap="round" fill="none"/>` +
        `<path d="M21.5 57h6M21.5 62h5.5M78.5 57h-6M78.5 62h-5.5" stroke="${d}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<ellipse cx="44.5" cy="68" rx="8" ry="6.5" fill="${m}"/><ellipse cx="55.5" cy="68" rx="8" ry="6.5" fill="${m}"/>` +
        SHEEN(38, 44, 9, 4) + EYE(39.5, 56.5) + EYE(60.5, 56.5) + BLUSH(64.5, 21) +
        `<path d="M47 62.6h6l-3 3.4z" fill="#e8737b" stroke="#e8737b" stroke-width="1.4" stroke-linejoin="round"/>` + MOUTH(66, '#7a4a35') +
        `<path d="M38 68l-14-2M38 71l-13 2.5M62 68l14-2M62 71l13 2.5" stroke="#fff" stroke-width="1" opacity=".75" stroke-linecap="round"/>`;
    } },
    { key: 'fox', en: 'Fox', zh: '狐狸', bg: ['#9b5fae', '#4e2a5c'], draw: () => {
      const f = '#ec7a3c', w = '#fff5ea', k = '#3b2620';
      return BODY('#d9652d') +
        `<path d="M20 50L25 13L47 32Z" fill="${f}" stroke="${f}" stroke-width="4" stroke-linejoin="round"/><path d="M80 50L75 13L53 32Z" fill="${f}" stroke="${f}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M25 13L22.5 31L31 24Z" fill="${k}"/><path d="M75 13L77.5 31L69 24Z" fill="${k}"/>` +
        `<path d="M27.5 38L28.5 23.5L40 32.5Z" fill="#ffd9b8"/><path d="M72.5 38L71.5 23.5L60 32.5Z" fill="#ffd9b8"/>` +
        `<path d="M18 52C18 38 32 31 50 31C68 31 82 38 82 52C82 66 64 79 50 86C36 79 18 66 18 52Z" fill="${f}"/>` +
        `<path d="M18.5 54C30 55 42 62 50 86C58 62 70 55 81.5 54C80 68 63 80 50 87C37 80 20 68 18.5 54Z" fill="${w}"/>` +
        `<path d="M50 47C47 52 46 57 50 61C54 57 53 52 50 47Z" fill="${w}" opacity=".9"/>` +
        SHEEN(36, 41, 9, 3.6) +
        `<path d="M33.5 54.5q5.5-4.6 10.5 .4q-5 3.4-10.5-.4z" fill="${k}"/><path d="M66.5 54.5q-5.5-4.6-10.5 .4q5 3.4 10.5-.4z" fill="${k}"/>` +
        `<circle cx="41.4" cy="53.6" r="1.1" fill="#fff"/><circle cx="58.6" cy="53.6" r="1.1" fill="#fff"/>` +
        `<ellipse cx="50" cy="74.5" rx="4" ry="3" fill="${k}"/>` + BLUSH(66, 20, '#ff8f7a', .3) +
        `<path d="M50 77.5v2.6" stroke="${k}" stroke-width="1.3" stroke-linecap="round"/>`;
    } },
    { key: 'rabbit', en: 'Rabbit', zh: '兔子', bg: ['#e2708f', '#9c3354'], draw: () => {
      const f = '#f8f3ec', p = '#f5b3c0', s = '#e7ddd2';
      return BODY(s) +
        `<ellipse cx="39" cy="27" rx="8" ry="22" transform="rotate(-12 39 27)" fill="${f}"/><ellipse cx="61" cy="27" rx="8" ry="22" transform="rotate(12 61 27)" fill="${f}"/>` +
        `<ellipse cx="39" cy="28" rx="3.6" ry="16" transform="rotate(-12 39 28)" fill="${p}"/><ellipse cx="61" cy="28" rx="3.6" ry="16" transform="rotate(12 61 28)" fill="${p}"/>` +
        `<ellipse cx="50" cy="62" rx="27" ry="23" fill="${f}"/>` +
        `<path d="M27 70C33 82 67 82 73 70C68 79 32 79 27 70Z" fill="${s}"/>` +
        SHEEN(39, 49, 8, 3.4) + EYE(40, 59, 3.8, 4.8) + EYE(60, 59, 3.8, 4.8) + BLUSH(67, 20, '#ff6f8f', .35) +
        `<ellipse cx="50" cy="66" rx="3" ry="2.2" fill="#f08c9e"/>` + MOUTH(67.5, '#8a5a5a', 1.3) +
        `<rect x="48" y="70.4" width="4" height="4" rx="1" fill="#fff" stroke="#e0d3c8" stroke-width=".6"/><path d="M50 70.6v3.6" stroke="#e0d3c8" stroke-width=".6"/>`;
    } },
    { key: 'panda', en: 'Panda', zh: '熊猫', bg: ['#6fb57a', '#2f6a42'], draw: () => {
      const w = '#fbfbf7', k = '#24252b';
      return BODY(k, 106, 34, 25) + `<path d="M36 84q14 8 28 0" stroke="${w}" stroke-width="10" fill="none" opacity=".0"/>` +
        `<circle cx="27" cy="38" r="10.5" fill="${k}"/><circle cx="73" cy="38" r="10.5" fill="${k}"/>` +
        `<ellipse cx="50" cy="60" rx="29" ry="25" fill="${w}"/>` +
        `<ellipse cx="38.5" cy="58.5" rx="7.4" ry="9.6" transform="rotate(32 38.5 58.5)" fill="${k}"/><ellipse cx="61.5" cy="58.5" rx="7.4" ry="9.6" transform="rotate(-32 61.5 58.5)" fill="${k}"/>` +
        `<circle cx="39.6" cy="57.4" r="2.6" fill="#fff"/><circle cx="60.4" cy="57.4" r="2.6" fill="#fff"/><circle cx="40" cy="57.8" r="1.4" fill="${k}"/><circle cx="60" cy="57.8" r="1.4" fill="${k}"/>` +
        SHEEN(40, 44, 9, 3.4) + `<ellipse cx="50" cy="67" rx="4.6" ry="3.2" fill="${k}"/>` + MOUTH(70, k, 1.4) + BLUSH(70, 21, '#ff8a8a', .3);
    } },
    { key: 'bear', en: 'Bear', zh: '熊', bg: ['#5f84d1', '#2c4a8a'], draw: () => {
      const f = '#9a6644', l = '#d8ab84', d = '#7c4f33';
      return BODY(d) +
        `<circle cx="28" cy="37" r="11" fill="${f}"/><circle cx="72" cy="37" r="11" fill="${f}"/><circle cx="28" cy="37" r="5.6" fill="${l}"/><circle cx="72" cy="37" r="5.6" fill="${l}"/>` +
        `<ellipse cx="50" cy="60" rx="28.5" ry="25" fill="${f}"/>` + SHEEN(39, 44, 9, 3.6) +
        `<ellipse cx="50" cy="69" rx="12.5" ry="9.5" fill="${l}"/>` + EYE(39, 56.5) + EYE(61, 56.5) +
        `<ellipse cx="50" cy="65.2" rx="4.6" ry="3.3" fill="#2a1a12"/>` + MOUTH(68.6, '#2a1a12', 1.4) + BLUSH(65, 22, '#ff7b6b', .28);
    } },
    { key: 'shiba', en: 'Shiba', zh: '柴犬', bg: ['#4cb2e3', '#22709c'], draw: () => {
      const f = '#e69a50', c = '#fff2df', d = '#c97b35';
      return BODY(d) +
        `<path d="M22 47L27 20L45 33Z" fill="${f}" stroke="${f}" stroke-width="5" stroke-linejoin="round"/><path d="M78 47L73 20L55 33Z" fill="${f}" stroke="${f}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M28 39L30 27L38 33Z" fill="${c}"/><path d="M72 39L70 27L62 33Z" fill="${c}"/>` +
        `<ellipse cx="50" cy="59" rx="29" ry="25" fill="${f}"/>` +
        `<path d="M21.5 62C24 52 34 56 42 60C46 62 54 62 58 60C66 56 76 52 78.5 62C76 76 64 84 50 84C36 84 24 76 21.5 62Z" fill="${c}"/>` +
        `<ellipse cx="39" cy="48.5" rx="3.6" ry="2.2" fill="${c}"/><ellipse cx="61" cy="48.5" rx="3.6" ry="2.2" fill="${c}"/>` +
        SHEEN(38, 42, 8, 3.2) + EYE(39, 55.6, 3.4, 4.2) + EYE(61, 55.6, 3.4, 4.2) +
        `<ellipse cx="50" cy="64.2" rx="4.4" ry="3.2" fill="#2a1d18"/>` + MOUTH(67.6, '#2a1d18', 1.4) + BLUSH(66, 20, '#ff7b6b', .32);
    } },
    { key: 'penguin', en: 'Penguin', zh: '企鹅', bg: ['#5a66c9', '#2b3383'], draw: () => {
      const k = '#23262f', w = '#fbfbf8', o = '#f6a93b';
      return BODY(k, 104, 35, 26) + `<ellipse cx="50" cy="104" rx="20" ry="20" fill="${w}"/>` +
        `<ellipse cx="50" cy="57" rx="31" ry="29" fill="${k}"/>` + SHEEN(38, 37, 10, 3.6) +
        `<path d="M50 50C46 42 30 40 26 54C23 66 34 80 50 80C66 80 77 66 74 54C70 40 54 42 50 50Z" fill="${w}"/>` +
        EYE(40, 58, 3.5, 4.3) + EYE(60, 58, 3.5, 4.3) +
        `<path d="M44.5 64.5Q50 61 55.5 64.5Q50 71 44.5 64.5Z" fill="${o}" stroke="${o}" stroke-width="1" stroke-linejoin="round"/>` + BLUSH(67, 18.5, '#ff7b8a', .38);
    } },
    { key: 'tiger', en: 'Tiger', zh: '老虎', bg: ['#33507e', '#16263f'], draw: () => {
      const f = '#f39130', w = '#fff6ea', k = '#2b1d17';
      return BODY('#d9761f') +
        `<circle cx="27.5" cy="37" r="10" fill="${f}"/><circle cx="72.5" cy="37" r="10" fill="${f}"/><circle cx="27.5" cy="37" r="5" fill="${w}"/><circle cx="72.5" cy="37" r="5" fill="${w}"/>` +
        `<ellipse cx="50" cy="59" rx="29.5" ry="25.5" fill="${f}"/>` +
        `<path d="M43.5 38.5h13M44.5 43.2h11M50 37v12" stroke="${k}" stroke-width="2.7" stroke-linecap="round"/>` +
        `<path d="M20.6 52L30 55.5L21 58.5Z M20.8 61L29 63L21.6 65.6Z M79.4 52L70 55.5L79 58.5Z M79.2 61L71 63L78.4 65.6Z" fill="${k}" stroke="${k}" stroke-width="1.2" stroke-linejoin="round"/>` +
        `<ellipse cx="43.5" cy="69" rx="9" ry="7.4" fill="${w}"/><ellipse cx="56.5" cy="69" rx="9" ry="7.4" fill="${w}"/><ellipse cx="50" cy="75" rx="6" ry="4" fill="${w}"/>` +
        SHEEN(37, 45, 7, 3) + EYE(39.5, 56, 3.5, 4.4) + EYE(60.5, 56, 3.5, 4.4) +
        `<path d="M46.6 63.2h6.8l-3.4 3.6z" fill="#d9636d" stroke="#d9636d" stroke-width="1.4" stroke-linejoin="round"/>` + MOUTH(67, '#7a3f2a', 1.4);
    } },
    { key: 'frog', en: 'Frog', zh: '青蛙', bg: ['#9d86e0', '#5a4199'], draw: () => {
      const g = '#86c96f', d = '#5ea64f', l = '#d6f0a6';
      return BODY(d, 106, 34, 24) +
        `<circle cx="33" cy="41" r="12.5" fill="${g}"/><circle cx="67" cy="41" r="12.5" fill="${g}"/>` +
        `<ellipse cx="50" cy="63" rx="32" ry="21" fill="${g}"/>` +
        `<ellipse cx="50" cy="74" rx="20" ry="8" fill="${l}" opacity=".8"/>` +
        `<circle cx="33" cy="40" r="8.2" fill="#fff"/><circle cx="67" cy="40" r="8.2" fill="#fff"/>` +
        `<circle cx="34.4" cy="41" r="4.6" fill="#1e2a1c"/><circle cx="65.6" cy="41" r="4.6" fill="#1e2a1c"/><circle cx="35.8" cy="39.4" r="1.5" fill="#fff"/><circle cx="67" cy="39.4" r="1.5" fill="#fff"/>` +
        SHEEN(30, 33, 5, 2.4) + `<circle cx="46" cy="58" r="1.1" fill="#3d6b33"/><circle cx="54" cy="58" r="1.1" fill="#3d6b33"/>` +
        `<path d="M33 64Q50 77 67 64" stroke="#3d6b33" stroke-width="2.3" fill="none" stroke-linecap="round"/>` + BLUSH(64, 25, '#ff7f7f', .35);
    } },
    { key: 'owl', en: 'Owl', zh: '猫头鹰', bg: ['#eaa944', '#a8641a'], draw: () => {
      const f = '#7a5442', d = '#5e3e30', c = '#f6e6cb', o = '#f0a43a';
      return BODY(d, 104, 34, 26) +
        `<path d="M22 44L23 18L41 33Z" fill="${f}" stroke="${f}" stroke-width="4" stroke-linejoin="round"/><path d="M78 44L77 18L59 33Z" fill="${f}" stroke="${f}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M21 52C21 36 33 30 50 30C67 30 79 36 79 52C79 72 66 84 50 84C34 84 21 72 21 52Z" fill="${f}"/>` + SHEEN(36, 38, 9, 3.4) +
        `<circle cx="38.5" cy="55" r="12.5" fill="${c}"/><circle cx="61.5" cy="55" r="12.5" fill="${c}"/>` +
        `<circle cx="38.5" cy="55" r="6.6" fill="#2a1c16"/><circle cx="61.5" cy="55" r="6.6" fill="#2a1c16"/><circle cx="40.6" cy="52.6" r="2.2" fill="#fff"/><circle cx="63.6" cy="52.6" r="2.2" fill="#fff"/>` +
        `<path d="M46.5 63H53.5L50 70Z" fill="${o}" stroke="${o}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<path d="M40 77l3 2.6 3-2.6M47 79l3 2.6 3-2.6M54 77l3 2.6 3-2.6" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>`;
    } },
    { key: 'deer', en: 'Deer', zh: '小鹿', bg: ['#e3825c', '#a2452a'], draw: () => {
      const f = '#c98d5a', l = '#f5e0c4', a = '#7a5230';
      return BODY('#ad7444') +
        `<path d="M40 35L35 22L29 17M35 22L40 15M34.5 26L27 25" stroke="${a}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M60 35L65 22L71 17M65 22L60 15M65.5 26L73 25" stroke="${a}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<ellipse cx="24" cy="47" rx="11" ry="5.6" transform="rotate(-24 24 47)" fill="${f}"/><ellipse cx="76" cy="47" rx="11" ry="5.6" transform="rotate(24 76 47)" fill="${f}"/>` +
        `<ellipse cx="24.5" cy="47" rx="6" ry="2.6" transform="rotate(-24 24.5 47)" fill="#f2b9a5"/><ellipse cx="75.5" cy="47" rx="6" ry="2.6" transform="rotate(24 75.5 47)" fill="#f2b9a5"/>` +
        `<path d="M27 54C27 41 37 35 50 35C63 35 73 41 73 54C73 70 63 84 50 84C37 84 27 70 27 54Z" fill="${f}"/>` + SHEEN(41, 42, 7, 3) +
        `<ellipse cx="50" cy="73" rx="12" ry="9.5" fill="${l}"/>` +
        `<circle cx="44" cy="44" r="1.7" fill="${l}"/><circle cx="56.5" cy="45.5" r="1.5" fill="${l}"/><circle cx="50.5" cy="41" r="1.3" fill="${l}"/>` +
        EYE(40.5, 57, 3.6, 4.5) + EYE(59.5, 57, 3.6, 4.5) +
        `<ellipse cx="50" cy="69.2" rx="4" ry="2.9" fill="#2d1d14"/>` + MOUTH(72.2, '#2d1d14', 1.3) + BLUSH(65, 18, '#ff7b6b', .32);
    } },
    { key: 'raccoon', en: 'Raccoon', zh: '浣熊', bg: ['#e4c654', '#9c7f17'], draw: () => {
      const f = '#9aa0ab', d = '#3a3d46', l = '#eef0f3', e = '#6d727e';
      return BODY(e) +
        `<path d="M22 46L25 20L44 33Z" fill="${f}" stroke="${f}" stroke-width="5" stroke-linejoin="round"/><path d="M78 46L75 20L56 33Z" fill="${f}" stroke="${f}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M27.5 39L29 27L38 33Z" fill="${d}"/><path d="M72.5 39L71 27L62 33Z" fill="${d}"/>` +
        `<ellipse cx="50" cy="59" rx="29" ry="25" fill="${f}"/>` + SHEEN(38, 43, 8, 3.2) +
        `<path d="M50 38C46 44 46 50 50 54C54 50 54 44 50 38Z" fill="${l}"/>` +
        `<path d="M22 57C26 49 37 49 44 55C47 57.5 53 57.5 56 55C63 49 74 49 78 57C74 64 64 64 57 61C53 59.5 47 59.5 43 61C36 64 26 64 22 57Z" fill="${d}"/>` +
        `<ellipse cx="50" cy="70" rx="14" ry="10" fill="${l}"/>` +
        `<circle cx="38.5" cy="56.4" r="3.1" fill="#fff"/><circle cx="61.5" cy="56.4" r="3.1" fill="#fff"/><circle cx="39" cy="56.8" r="1.8" fill="#151619"/><circle cx="61" cy="56.8" r="1.8" fill="#151619"/>` +
        `<ellipse cx="50" cy="65.6" rx="4.2" ry="3" fill="#1d1f24"/>` + MOUTH(68.8, '#1d1f24', 1.4) + BLUSH(68, 21, '#ff7b8a', .3);
    } },
  ];

  // 机器人：几种配色
  const BOT_TINTS = [
    { bg: ['#3d4656', '#1d222b'], eye: '#5ef0d2' },
    { bg: ['#4b3f5c', '#221b2c'], eye: '#ffb84d' },
    { bg: ['#2f4f57', '#14262b'], eye: '#7cc9ff' },
    { bg: ['#573d3d', '#2a1a1a'], eye: '#ff7aa2' },
  ];
  function drawBot(t) {
    const m = '#dfe5ee', s = '#b8c1cf';
    return `<ellipse cx="50" cy="106" rx="32" ry="24" fill="${s}"/><rect x="38" y="80" width="24" height="10" rx="4" fill="#9aa5b6"/>` +
      `<path d="M50 30V20" stroke="${s}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="18" r="4.6" fill="${t.eye}"/><circle cx="48.6" cy="16.6" r="1.4" fill="#fff" opacity=".8"/>` +
      `<rect x="17" y="50" width="8" height="16" rx="4" fill="${s}"/><rect x="75" y="50" width="8" height="16" rx="4" fill="${s}"/>` +
      `<rect x="22" y="30" width="56" height="50" rx="17" fill="${m}"/>` +
      `<path d="M28 36q8-4 22-4" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7" fill="none"/>` +
      `<rect x="29" y="41" width="42" height="28" rx="11" fill="#1b2029"/>` +
      `<rect x="36" y="49" width="8" height="10" rx="4" fill="${t.eye}"/><rect x="56" y="49" width="8" height="10" rx="4" fill="${t.eye}"/>` +
      `<rect x="36" y="49" width="8" height="10" rx="4" fill="${t.eye}" opacity=".35" transform="translate(-1.5 -1.5) scale(1.0)"/>` +
      `<path d="M45 63.5q5 3 10 0" stroke="${t.eye}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }

  function gradient(id, c) {
    return `<radialGradient id="${id}" cx="32%" cy="26%" r="85%"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></radialGradient>`;
  }

  // 筹码（一个，fill 用 currentColor）
  const CHIP = '<circle cx="50" cy="50" r="46" fill="currentColor"/>' +
    '<circle cx="50" cy="50" r="40" fill="none" stroke="#fff" stroke-width="11" stroke-dasharray="12.6 8.34" opacity=".92"/>' +
    '<circle cx="50" cy="50" r="27" fill="currentColor" stroke="rgba(255,255,255,.55)" stroke-width="2.4" stroke-dasharray="3 3"/>' +
    '<circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/>';

  // 月亮（牌背和桌面的徽记）
  const MOON = '<path d="M62 14A38 38 0 1 0 86 62A30 30 0 1 1 62 14Z" fill="currentColor"/>';

  // 生成全局 sprite，挂进 body
  function sprite(sealPaths) {
    let defs = '<clipPath id="avclip"><circle cx="50" cy="50" r="50"/></clipPath>';
    let sym = '';
    for (const k in SUITS) sym += `<symbol id="suit-${k}" viewBox="0 0 100 100">${SUITS[k]}</symbol>`;
    AVATARS.forEach((a, i) => {
      defs += gradient('avg' + i, a.bg);
      sym += `<symbol id="av${i}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="url(#avg${i})"/><g clip-path="url(#avclip)">${a.draw()}</g></symbol>`;
    });
    BOT_TINTS.forEach((t, i) => {
      defs += gradient('botg' + i, t.bg);
      sym += `<symbol id="bot${i}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="url(#botg${i})"/><g clip-path="url(#avclip)">${drawBot(t)}</g></symbol>`;
    });
    sym += `<symbol id="chip" viewBox="0 0 100 100">${CHIP}</symbol>`;
    sym += `<symbol id="moon" viewBox="0 0 100 100">${MOON}</symbol>`;
    if (sealPaths) sym += `<symbol id="seal" viewBox="0 0 60 104">${sealPaths}</symbol>`;
    // 线性图标
    const I = (id, d, extra = '') => `<symbol id="i-${id}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</g></symbol>`;
    sym += I('close', '<path d="M6 6l12 12M18 6L6 18"/>');
    sym += I('menu', '<path d="M4 7h16M4 12h16M4 17h10"/>');
    sym += I('chat', '<path d="M5 18.5V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6a2.5 2.5 0 0 1-2.5 2.5H9z"/><path d="M9 10.5h6"/>');
    sym += I('copy', '<rect x="8" y="8" width="11" height="11" rx="2.5"/><path d="M5 15.5V6.5A1.5 1.5 0 0 1 6.5 5h9"/>');
    sym += I('lock', '<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>');
    sym += I('unlock', '<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2"/>');
    sym += I('bot', '<rect x="5" y="8" width="14" height="11" rx="3.5"/><path d="M12 8V5"/><path d="M9.5 13h.01M14.5 13h.01" stroke-width="2.6"/>');
    sym += I('pause', '<path d="M9 6v12M15 6v12"/>');
    sym += I('play', '<path d="M8 5.5v13l10.5-6.5z"/>');
    sym += I('sound', '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>');
    sym += I('mute', '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>');
    sym += I('globe', '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.6 3.6 5.3 3.6 8s-1.1 5.4-3.6 8c-2.5-2.6-3.6-5.3-3.6-8S9.5 6.6 12 4z"/>');
    sym += I('back', '<path d="M14.5 6L8.5 12l6 6"/>');
    sym += I('kick', '<path d="M15 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 4 17.5V19"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M17 9l4 4M21 9l-4 4"/>');
    sym += I('history', '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/><path d="M12 8.5V12l2.5 2"/>');
    return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>${defs}</defs>${sym}</svg>`;
  }

  G.Art = { SUITS, AVATARS, BOT_TINTS, sprite };
})(typeof window !== 'undefined' ? window : globalThis);
