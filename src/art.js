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
    { key: 'croc', en: 'Crocodile', zh: '鳄鱼', bg: ['#e9905c', '#a24a2a'], draw: () => {
      const g = '#5fae5a', d = '#3f8a43', l = '#cfe8a0';
      return BODY(d, 106, 34, 24) +
        `<ellipse cx="50" cy="58" rx="27" ry="21" fill="${g}"/>` +
        `<circle cx="36" cy="40" r="10.5" fill="${g}"/><circle cx="64" cy="40" r="10.5" fill="${g}"/>` +
        `<path d="M24 64C24 58 32 56 50 56C68 56 76 58 76 64C76 76 66 83 50 83C34 83 24 76 24 64Z" fill="${g}"/>` +
        `<path d="M27 70Q50 78 73 70" stroke="${d}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
        `<path d="M33 71.6l2.4 3.4 2.4-2.6M43 73.6l2.2 3.4 2.2-3M52.6 73.6l2.2 3.4 2.2-3.4M62.2 72.4l2.4 3 2.4-3.4" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/>` +
        `<ellipse cx="50" cy="78.5" rx="14" ry="3.6" fill="${l}" opacity=".7"/>` +
        `<ellipse cx="43.5" cy="61" rx="2.2" ry="1.5" fill="${d}"/><ellipse cx="56.5" cy="61" rx="2.2" ry="1.5" fill="${d}"/>` +
        `<path d="M40 48l3-3 3 3 3-3 3 3 3-3 3 3" stroke="${d}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>` +
        `<circle cx="36" cy="39.5" r="7" fill="#fff6c8"/><circle cx="64" cy="39.5" r="7" fill="#fff6c8"/>` +
        `<ellipse cx="36.8" cy="40" rx="2.6" ry="5" fill="#1f2a1a"/><ellipse cx="63.2" cy="40" rx="2.6" ry="5" fill="#1f2a1a"/>` +
        `<circle cx="38" cy="37.6" r="1.4" fill="#fff"/><circle cx="64.4" cy="37.6" r="1.4" fill="#fff"/>` +
        SHEEN(32, 33, 5, 2.2) + SHEEN(60, 33, 5, 2.2) + BLUSH(66, 22, '#ff8a7a', .3);
    } },
    { key: 'kitten', en: 'Kitten', zh: '小猫', bg: ['#f2a7c3', '#b45a82'], draw: () => {
      const f = '#b9bec8', d = '#8d93a0', w = '#fbfbfd', p = '#f6a6b8';
      return BODY(d, 106, 30, 22) +
        `<path d="M25 50L26 24L45 36Z" fill="${f}" stroke="${f}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M75 50L74 24L55 36Z" fill="${f}" stroke="${f}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M30 43L30.5 30L39 37Z" fill="${p}"/><path d="M70 43L69.5 30L61 37Z" fill="${p}"/>` +
        `<circle cx="50" cy="60" r="27" fill="${f}"/>` +
        `<path d="M44 34.5q1 3.4 0 6.6M50 33.6v7.6M56 34.5q-1 3.4 0 6.6" stroke="${d}" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
        `<path d="M30 63C30 54 40 52 50 58C60 52 70 54 70 63C70 76 60 84 50 84C40 84 30 76 30 63Z" fill="${w}"/>` +
        SHEEN(39, 44, 8, 3.2) +
        EYE(39, 58, 5.2, 6.2, '#2c2430') + EYE(61, 58, 5.2, 6.2, '#2c2430') +
        `<circle cx="37.6" cy="60.6" r="1.2" fill="#fff" opacity=".8"/><circle cx="59.6" cy="60.6" r="1.2" fill="#fff" opacity=".8"/>` +
        BLUSH(67, 19, '#ff7f9c', .45) +
        `<path d="M47.6 65h4.8l-2.4 2.8z" fill="#ef7c95" stroke="#ef7c95" stroke-width="1.2" stroke-linejoin="round"/>` + MOUTH(68, '#8a5a66', 1.3) +
        `<path d="M36 69l-13-2M36 72l-12 2.4M64 69l13-2M64 72l12 2.4" stroke="${d}" stroke-width="1" opacity=".8" stroke-linecap="round"/>` +
        `<g transform="translate(4 7)"><path d="M60 27q4-6 9-2q-3 5-9 2zM60 27q-1-7 5-8q1 6-5 8z" fill="#ff8fb1"/><circle cx="60.5" cy="27" r="2" fill="#ffd0de"/></g>`;
    } },
  ];

  // 机器人：几种配色
  // ---- 机器人：四个智商档各有一副样子；眼睛用 currentColor，同一档的几个靠眼睛颜色区分 ----
  const BOT_EYES = ['#5ef0d2', '#ffb84d', '#7cc9ff', '#ff7aa2'];
  const SHOULDERS = (s, n) => `<ellipse cx="50" cy="106" rx="32" ry="24" fill="${s}"/><rect x="38" y="79" width="24" height="10" rx="4" fill="${n}"/>`;
  const EARS = (c, y = 50, h = 16) => `<rect x="17" y="${y}" width="8" height="${h}" rx="4" fill="${c}"/><rect x="75" y="${y}" width="8" height="${h}" rx="4" fill="${c}"/>`;
  const BOT_LV = [
    { iq: 70, bg: ['#5b7a50', '#1d2a1a'], draw: () => {                 // 新手：头顶冒芽、贴着创可贴、冒汗
      const m = '#e7efe3', s = '#bccab9';
      return SHOULDERS(s, '#a3b2a0') + `<g transform="rotate(-6 50 58)">` +
        `<path d="M50 34C50 28 44.5 27 46.5 20.5" stroke="${s}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        `<path d="M46.5 20.5c-7.5-.5-11-5.5-10-10.5 6.5.2 10 4.4 10 10.5z" fill="#79c76a"/><path d="M46.5 20.5c2.6-6.4 8.6-8.8 13.4-6.7-1.2 5.2-6.4 8.4-13.4 6.7z" fill="#9fe07f"/>` +
        `<path d="M46 19.5c-2.6-2.4-4.6-4.6-6-7.2M47.4 19.4c2.8-2 5.6-3.6 8.8-4.4" stroke="#4f9a49" stroke-width=".9" fill="none" stroke-linecap="round"/>` +
        EARS(s, 52, 15) +
        `<rect x="22.5" y="33" width="55" height="47" rx="21" fill="${m}"/>` +
        `<path d="M29 40q7-4.5 18-4.6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75" fill="none"/>` +
        `<g transform="rotate(-24 66 39)"><rect x="57.5" y="35.5" width="17" height="7" rx="3.5" fill="#f2c590"/><rect x="63.5" y="35.5" width="5" height="7" fill="#e3a868"/>` +
        `<circle cx="60.4" cy="38" r=".6" fill="#c58a4f"/><circle cx="60.4" cy="40.2" r=".6" fill="#c58a4f"/><circle cx="71.6" cy="38" r=".6" fill="#c58a4f"/><circle cx="71.6" cy="40.2" r=".6" fill="#c58a4f"/></g>` +
        `<rect x="29.5" y="45" width="41" height="27" rx="12" fill="#1b2029"/>` +
        `<circle cx="40" cy="56" r="4.8" fill="currentColor"/><circle cx="41.6" cy="54.3" r="1.5" fill="#fff" opacity=".85"/>` +
        `<circle cx="59.5" cy="57" r="3.7" fill="currentColor"/><circle cx="60.7" cy="55.7" r="1.2" fill="#fff" opacity=".85"/>` +
        `<path d="M44.5 66.2q2.75-2.2 5.5 0t5.5 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>` +
        `<path d="M81 38.5c2.3 3.4 3.4 5.6 3.4 7.2a3.4 3.4 0 0 1-6.8 0c0-1.6 1.1-3.8 3.4-7.2z" fill="#a6e0ff" opacity=".92"/><circle cx="80" cy="45" r=".9" fill="#fff" opacity=".9"/>`;
    } },
    { iq: 100, bg: ['#3d4656', '#1d222b'], draw: () => {                // 普通：标准款
      const m = '#dfe5ee', s = '#b8c1cf';
      return SHOULDERS(s, '#9aa5b6') +
        `<path d="M50 30V20" stroke="${s}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="18" r="4.6" fill="currentColor"/><circle cx="48.6" cy="16.6" r="1.4" fill="#fff" opacity=".8"/>` +
        EARS(s) +
        `<rect x="22" y="30" width="56" height="50" rx="17" fill="${m}"/>` +
        `<path d="M28 36q8-4 22-4" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7" fill="none"/>` +
        `<rect x="29" y="41" width="42" height="28" rx="11" fill="#1b2029"/>` +
        `<rect x="36" y="49" width="8" height="10" rx="4" fill="currentColor"/><rect x="56" y="49" width="8" height="10" rx="4" fill="currentColor"/>` +
        `<path d="M45 63.5q5 3 10 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    } },
    { iq: 130, bg: ['#21506e', '#0a1620'], draw: () => {                // 高手：鲨鱼鳍、墨镜、坏笑
      const m = '#d3dce8', s = '#a5b2c3';
      return SHOULDERS('#2a3442', '#7d8a9c') + `<path d="M36 82l14 14 14-14" fill="#e9edf3"/><path d="M47 84h6l-1 10h-4z" fill="#0f1a26"/>` +
        `<path d="M43 31.5C45 22 51.5 13.5 61.5 10c-3.6 7.6-3.8 14.6-1.4 21.5z" fill="#7b8ea8"/><path d="M47.5 29c1.6-6.4 5-11.4 10-14.8" stroke="#a9bad0" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
        EARS(s) +
        `<rect x="22" y="30" width="56" height="50" rx="17" fill="${m}"/>` +
        `<path d="M28 36q8-4 22-4" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6" fill="none"/>` +
        `<path d="M25.5 60q2.2 2.6 0 5.2M25.5 66.5q2.2 2.6 0 5.2" stroke="#93a2b6" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
        `<rect x="29" y="41" width="42" height="29" rx="11" fill="#1b2029"/>` +
        `<rect x="25.5" y="45.5" width="49" height="13" rx="6.5" fill="#05070a" stroke="#38455a" stroke-width="1.2"/>` +
        `<path d="M29.5 49.5h9" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".32"/><path d="M60 56.5l7-8" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".13"/>` +
        `<rect x="33" y="51" width="11" height="2.8" rx="1.4" fill="currentColor"/><rect x="56" y="51" width="11" height="2.8" rx="1.4" fill="currentColor"/>` +
        `<path d="M43 64.5q7 3.2 14-2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    } },
    { iq: 160, bg: ['#61407a', '#1f1229'], draw: () => {                // 大师：玻璃脑壳、单片眼镜、礼服领结
      const m = '#ebe6f2', gold = '#e6c17a';
      return SHOULDERS('#2d2338', '#c9b98f') + `<path d="M37 81l13 15 13-15z" fill="#f6f2ea"/><path d="M50 84.5l-8-4.4v8.8zM50 84.5l8-4.4v8.8z" fill="#c33641"/><circle cx="50" cy="84.5" r="2.2" fill="#9e2430"/>` +
        EARS('#cdb37a', 55, 14) +
        `<path d="M24 52a26 26 0 0 1 52 0z" fill="#bfe3ff" opacity=".2"/>` +
        `<path d="M32.5 50.5c-3.6-5.4-.4-12.6 6.4-12.8 1.6-4.6 8.8-6 12.2-2.4 4.2-3.4 11.6-1.2 12.4 4.2 5.6.6 7.6 6.6 4.6 11z" fill="#f4a9c4"/>` +
        `<path d="M40 38.5q3 4-1 7.5M51 35.5q-2.5 5 2 8.5M62 40q-4 2.6-1.6 6.6M45 47.5q4-1.8 7 .6M35.5 46q2.4-.4 4 1.6" stroke="#d6799e" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
        `<path d="M24 52a26 26 0 0 1 52 0" fill="none" stroke="#e4f3ff" stroke-width="1.6" opacity=".75"/><path d="M30.5 41a21 21 0 0 1 11-11.5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>` +
        `<path d="M22 54.5h56V67a14 14 0 0 1-14 14H36a14 14 0 0 1-14-14z" fill="${m}"/>` +
        `<rect x="20.5" y="50" width="59" height="6.5" rx="3.25" fill="${gold}"/><rect x="20.5" y="50" width="59" height="2.4" rx="1.2" fill="#fff3d4" opacity=".55"/>` +
        `<rect x="28.5" y="59.5" width="43" height="17" rx="7.5" fill="#1b2029"/>` +
        `<rect x="35.5" y="63.5" width="7" height="7.5" rx="3.5" fill="currentColor"/>` +
        `<circle cx="59.5" cy="67.2" r="6.6" fill="#ffffff" fill-opacity=".08" stroke="${gold}" stroke-width="2"/><circle cx="59.5" cy="67.2" r="3.2" fill="currentColor"/>` +
        `<path d="M65.6 69.8q6.4 6.4 2.6 14.6" stroke="${gold}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
        `<path d="M46.5 73.4q3.5 1.8 7 0" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
    } },
  ];

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
    BOT_LV.forEach((b, i) => {
      defs += gradient('bqg' + i, b.bg);
      sym += `<symbol id="bq${i}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="url(#bqg${i})"/><g clip-path="url(#avclip)">${b.draw()}</g></symbol>`;
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
    sym += I('pct', '<circle cx="7.5" cy="7.5" r="2.6"/><circle cx="16.5" cy="16.5" r="2.6"/><path d="M18.5 5.5l-13 13"/>');
    sym += I('gift', '<rect x="4" y="9.5" width="16" height="10.5" rx="2"/><path d="M4 13.5h16M12 9.5V20"/><path d="M12 9.5C10.6 6 6.5 5.4 6.5 7.6c0 1.6 2.6 1.9 5.5 1.9zM12 9.5c1.4-3.5 5.5-4.1 5.5-1.9 0 1.6-2.6 1.9-5.5 1.9z"/>');
    sym += I('inf', '<path d="M7.6 15.4C5.6 15.4 4 13.9 4 12s1.6-3.4 3.6-3.4c3.6 0 5.2 6.8 8.8 6.8 2 0 3.6-1.5 3.6-3.4s-1.6-3.4-3.6-3.4c-3.6 0-5.2 6.8-8.8 6.8z"/>');
    sym += I('next', '<path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5"/>');
    sym += I('save', '<path d="M7.5 4.5h9a1.5 1.5 0 0 1 1.5 1.5v14l-6-4-6 4V6a1.5 1.5 0 0 1 1.5-1.5z"/>');
    sym += I('flag', '<path d="M6 20.5V4.5"/><path d="M6 5h11.5l-2.6 4 2.6 4H6"/>');
    // 合集切换用的两个小图标：扑克牌、麻将牌
    sym += `<symbol id="g-holdem" viewBox="0 0 24 24"><rect x="4.6" y="2.9" width="14.8" height="18.2" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path transform="translate(7 7) scale(.1)" fill="currentColor" d="${SUITS.s.match(/d="([^"]+)"/)[1]}"/></symbol>`;
    sym += '<symbol id="g-mahjong" viewBox="0 0 24 24"><rect x="5" y="2.6" width="14" height="18.8" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.9" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></symbol>';
    sym += I('history', '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/><path d="M12 8.5V12l2.5 2"/>');
    return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>${defs}</defs>${sym}</svg>`;
  }

  G.Art = { SUITS, AVATARS, BOT_EYES, BOT_LV, sprite };
})(typeof window !== 'undefined' ? window : globalThis);
