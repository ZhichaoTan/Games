// ===== Xiangqi art: animated mascots (the computer opponents), figurine pieces, extra icons =====
(function (G) {
  'use strict';
  // ---- mascots: hand-drawn SVG faces that blink, bob and change mood (happy / sad / think) ----
  const AVA = (() => {
    let uid = 0;
    const INK = "#2b1d14";
    // shared face: eyes (open/happy/sad), blush, mouth (normal/happy), tear
    function face(o) {
      const { cx = 50, y = 54, dx = 10, my = 66, light = false, mouth = "w", blush = true, rx = 3.4, ry = 4.2 } = o;
      const ec = light ? "#fff" : INK;
      let s = `<g class="e-open">`;
      for (const sx of [-1, 1]) {
        const x = cx + sx * dx;
        s += `<g class="eye"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${ec}"/>` +
          (light ? `<circle class="pup" cx="${x}" cy="${y + .6}" r="${rx * .62}" fill="${INK}"/>` : "") +
          `<circle cx="${x + 1.2}" cy="${y - 1.6}" r="${rx * .38}" fill="#fff"/><circle cx="${x - 1.1}" cy="${y + 1.5}" r="${rx * .18}" fill="#fff" opacity=".8"/></g>`;
      }
      s += `</g><g class="e-happy" fill="none" stroke="${ec}" stroke-width="2.4" stroke-linecap="round">`;
      for (const sx of [-1, 1]) { const x = cx + sx * dx; s += `<path d="M${x - 4} ${y + 1.5} Q${x} ${y - 4} ${x + 4} ${y + 1.5}"/>`; }
      s += `</g><g class="e-sad" fill="none" stroke="${ec}" stroke-width="2.3" stroke-linecap="round">`;
      for (const sx of [-1, 1]) { const x = cx + sx * dx; s += `<path d="M${x - 4} ${y - .5} Q${x} ${y + 3.5} ${x + 4} ${y - .5}"/><path d="M${x + sx * 4} ${y - 5.5} L${x - sx * 3} ${y - 8}" stroke-width="1.8"/>`; }
      s += `</g>`;
      if (blush) for (const sx of [-1, 1]) s += `<ellipse class="blush" cx="${cx + sx * (dx + 6.5)}" cy="${y + 7}" rx="5" ry="3" fill="#ff7f98" opacity=".5"/>`;
      if (mouth == "w") s += `<path class="m-norm" d="M${cx - 4.5} ${my} Q${cx - 2.2} ${my + 3} ${cx} ${my} Q${cx + 2.2} ${my + 3} ${cx + 4.5} ${my}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
      if (mouth == "smile") s += `<path class="m-norm" d="M${cx - 4} ${my} Q${cx} ${my + 4} ${cx + 4} ${my}" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`;
      if (mouth != "none") s += `<g class="m-happy"><path d="M${cx - 5} ${my - .5} Q${cx} ${my + 8} ${cx + 5} ${my - .5} Z" fill="#7a2a22"/><path d="M${cx - 2.6} ${my + 3.6} Q${cx} ${my + 1.8} ${cx + 2.6} ${my + 3.6} Q${cx} ${my + 6} ${cx - 2.6} ${my + 3.6}" fill="#ff8c8c"/></g>`;
      s += `<path class="tear" d="M${cx + dx + 4} ${y + 3} q-2.4 4 0 5.6 q2.4 -1.6 0 -5.6z" fill="#7cc4ff"/>`;
      return s;
    }
    const bg = (c1, c2) => { const id = "bg" + (++uid); return `<defs><radialGradient id="${id}" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs><rect width="100" height="100" fill="url(#${id})"/><ellipse cx="50" cy="92" rx="30" ry="5" fill="#000" opacity=".08"/>`; };
    const shine = (x, y, rx = 9, ry = 5) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".35" transform="rotate(-20 ${x} ${y})"/>`;

    const K = {
      chick() {
        return bg("#fff8d9", "#ffe7a1") + `<g class="chr">
          <path d="M47 31 q-3 -9 3 -12 q-1 6 2 7 q2 -7 7 -6 q-5 3 -3 10z" fill="#ffc21a"/>
          <ellipse cx="50" cy="58" rx="29" ry="27" fill="#ffd93f"/>
          <ellipse cx="50" cy="66" rx="18" ry="13" fill="#ffe98a"/>
          ${shine(37, 42)}
          <ellipse class="wing-l" cx="22.5" cy="62" rx="5.5" ry="9" fill="#ffc21a" transform="rotate(25 22.5 62)"/>
          <ellipse class="wing-r" cx="77.5" cy="62" rx="5.5" ry="9" fill="#ffc21a" transform="rotate(-25 77.5 62)"/>
          ${face({ y: 53, dx: 10, mouth: "none" })}
          <path d="M44.5 60 Q50 55 55.5 60 Q50 66.5 44.5 60Z" fill="#ff9a2f"/><path d="M44.5 60 Q50 61.5 55.5 60" stroke="#e07b18" stroke-width="1" fill="none"/>
          <path d="M17 80 l5.5 -6 5.5 6 5.5 -6 5.5 6 5.5 -6 5.5 6 5.5 -6 5.5 6 5.5 -6 5.5 6 5.5 -6 4.5 5 V100 H17Z" fill="#fffaf0" stroke="#eadcc2" stroke-width="1.2" stroke-linejoin="round"/>
        </g>`;
      },
      bunny() {
        return bg("#fff0f4", "#ffd3e0") + `<g class="chr">
          <g class="ear-l"><ellipse cx="38" cy="23" rx="7.5" ry="19" fill="#fff" stroke="#f3d7e0" stroke-width="1.2" transform="rotate(-12 38 23)"/><ellipse cx="38" cy="25" rx="3.8" ry="13" fill="#ffb3c8" transform="rotate(-12 38 25)"/></g>
          <g class="ear-r"><ellipse cx="62" cy="23" rx="7.5" ry="19" fill="#fff" stroke="#f3d7e0" stroke-width="1.2" transform="rotate(12 62 23)"/><ellipse cx="62" cy="25" rx="3.8" ry="13" fill="#ffb3c8" transform="rotate(12 62 25)"/></g>
          <ellipse cx="50" cy="60" rx="28" ry="26" fill="#fff" stroke="#f3d7e0" stroke-width="1.4"/>
          ${shine(38, 46)}
          ${face({ y: 57, dx: 10, my: 67 })}
          <path d="M47.6 62.6 L52.4 62.6 L50 65.2Z" fill="#ff8fb0" stroke="#ff8fb0" stroke-width="1.2" stroke-linejoin="round"/>
          <rect class="m-norm" x="47.6" y="68.6" width="4.8" height="4.2" rx="1" fill="#fff" stroke="#d9c4cc" stroke-width=".9"/><line class="m-norm" x1="50" y1="68.8" x2="50" y2="72.6" stroke="#d9c4cc" stroke-width=".8"/>
          <circle cx="70" cy="34" r="5" fill="#ff8fb0"/><circle cx="76" cy="31" r="4" fill="#ff8fb0"/><circle cx="73" cy="32.5" r="2" fill="#fff"/>
        </g>`;
      },
      shiba() {
        return bg("#fff1df", "#ffd6ad") + `<g class="chr">
          <g class="ear-l"><path d="M22 44 L27 17 L45 31Z" fill="#e8892f" stroke="#d27a28" stroke-width="1.2" stroke-linejoin="round"/><path d="M27 37 L29 24 L38 31Z" fill="#ffe0bd"/></g>
          <g class="ear-r"><path d="M78 44 L73 17 L55 31Z" fill="#e8892f" stroke="#d27a28" stroke-width="1.2" stroke-linejoin="round"/><path d="M73 37 L71 24 L62 31Z" fill="#ffe0bd"/></g>
          <ellipse cx="50" cy="57" rx="31" ry="27" fill="#f29a45"/>
          ${shine(36, 41)}
          <ellipse cx="36" cy="64" rx="12" ry="10" fill="#fff6ea"/><ellipse cx="64" cy="64" rx="12" ry="10" fill="#fff6ea"/><ellipse cx="50" cy="69" rx="14" ry="12" fill="#fff6ea"/>
          <ellipse cx="39.5" cy="45" rx="3.2" ry="2.2" fill="#fff6ea"/><ellipse cx="60.5" cy="45" rx="3.2" ry="2.2" fill="#fff6ea"/>
          ${face({ y: 54, dx: 11, my: 67 })}
          <ellipse cx="50" cy="62.5" rx="4.2" ry="3" fill="${INK}"/><ellipse cx="49" cy="61.6" rx="1.4" ry=".8" fill="#fff" opacity=".7"/>
          <path d="M27 82 Q50 93 73 82 L70 89 Q50 99 30 89Z" fill="#d8402f"/><circle cx="50" cy="91" r="3.4" fill="#f6c04a" stroke="#c8902a" stroke-width=".8"/>
        </g>`;
      },
      panda() {
        return bg("#eef8ea", "#cfe9c7") + `<g class="chr">
          <circle cx="27" cy="35" r="9.5" fill="#2e2a2a"/><circle cx="73" cy="35" r="9.5" fill="#2e2a2a"/><circle cx="27" cy="35" r="4.5" fill="#4a4444"/><circle cx="73" cy="35" r="4.5" fill="#4a4444"/>
          <ellipse cx="50" cy="58" rx="31" ry="28" fill="#fff" stroke="#e3ebe0" stroke-width="1.4"/>
          ${shine(37, 43)}
          <ellipse cx="39" cy="55" rx="7.5" ry="9.5" fill="#2e2a2a" transform="rotate(28 39 55)"/><ellipse cx="61" cy="55" rx="7.5" ry="9.5" fill="#2e2a2a" transform="rotate(-28 61 55)"/>
          ${face({ y: 54.5, dx: 11, my: 68, light: true, rx: 3, ry: 3.4 })}
          <ellipse cx="50" cy="63.5" rx="3.6" ry="2.6" fill="#2e2a2a"/>
          <path d="M60 27 q11 -14 25 -9 q-9 12 -25 9z" fill="#73c46e"/><path d="M60 27 q12 -6 24 -9" stroke="#4e9a49" stroke-width="1" fill="none"/><path d="M58 30 l3 -4" stroke="#4e9a49" stroke-width="1.6" stroke-linecap="round"/>
        </g>`;
      },
      fox() {
        return bg("#fff2e8", "#ffd9bf") + `<g class="chr">
          <g class="ear-l"><path d="M20 46 L24 15 L44 30Z" fill="#ee7a2e" stroke="#d96a22" stroke-width="1.2" stroke-linejoin="round"/><path d="M25 38 L27 23 L37 30Z" fill="#3b2a22"/></g>
          <g class="ear-r"><path d="M80 46 L76 15 L56 30Z" fill="#ee7a2e" stroke="#d96a22" stroke-width="1.2" stroke-linejoin="round"/><path d="M75 38 L73 23 L63 30Z" fill="#3b2a22"/></g>
          <path d="M18 52 Q20 29 50 29 Q80 29 82 52 Q82 72 50 85 Q18 72 18 52Z" fill="#f4873a"/>
          ${shine(35, 40)}
          <path d="M19 55 Q36 58 50 85 Q27 76 19 55Z" fill="#fff4ea"/><path d="M81 55 Q64 58 50 85 Q73 76 81 55Z" fill="#fff4ea"/>
          ${face({ y: 53, dx: 11, my: 72, rx: 3, ry: 3.8 })}
          <g fill="rgba(255,255,255,.28)" stroke="#5b3a22" stroke-width="1.7"><circle cx="39" cy="53" r="7.6"/><circle cx="61" cy="53" r="7.6"/></g><path d="M46.6 52 Q50 49.5 53.4 52" stroke="#5b3a22" stroke-width="1.7" fill="none"/>
          <ellipse cx="50" cy="67" rx="3.4" ry="2.5" fill="${INK}"/>
          <path d="M50 88 L39 82 L39 94Z M50 88 L61 82 L61 94Z" fill="#3570c4" stroke="#2a5aa0" stroke-width="1" stroke-linejoin="round"/><circle cx="50" cy="88" r="3" fill="#2a5aa0"/>
        </g>`;
      },
      tiger() {
        return bg("#fff6dc", "#ffe0a3") + `<g class="chr">
          <circle cx="27" cy="35" r="9.5" fill="#f5a03a"/><circle cx="27" cy="35" r="5" fill="#fff1d6"/><circle cx="73" cy="35" r="9.5" fill="#f5a03a"/><circle cx="73" cy="35" r="5" fill="#fff1d6"/>
          <ellipse cx="50" cy="58" rx="32" ry="28" fill="#f5a03a"/>
          ${shine(36, 42)}
          <g stroke="#5c3210" stroke-width="2.4" stroke-linecap="round" fill="none">
            <path d="M44 36 H56 M45 40.5 H55 M44 45 H56 M50 36 V45"/>
            <path d="M19 52 l8 1.5 M19.5 59 l7 0 M81 52 l-8 1.5 M80.5 59 l-7 0 M31 33 l3 5 M69 33 l-3 5"/>
          </g>
          <ellipse cx="38" cy="66" rx="11" ry="9" fill="#fff7ea"/><ellipse cx="62" cy="66" rx="11" ry="9" fill="#fff7ea"/><ellipse cx="50" cy="71" rx="10" ry="8" fill="#fff7ea"/>
          ${face({ y: 54, dx: 11.5, my: 68 })}
          <path d="M46.5 62 Q50 60.5 53.5 62 L50 65.6Z" fill="#c45a4a" stroke="#c45a4a" stroke-width="1" stroke-linejoin="round"/>
          <path d="M25 84 Q50 95 75 84 L73 90 Q50 100 27 90Z" fill="#c8302a"/><path d="M42 89 l8 6 8 -6" fill="none" stroke="#f3c552" stroke-width="2"/>
        </g>`;
      },
      dragon() {
        return bg("#e9fbf5", "#bfeadc") + `<g class="chr">
          <path d="M34 34 Q28 20 33 13 Q36 22 40 26Z" fill="#f2c14e" stroke="#d9a332" stroke-width="1" stroke-linejoin="round"/><path d="M66 34 Q72 20 67 13 Q64 22 60 26Z" fill="#f2c14e" stroke="#d9a332" stroke-width="1" stroke-linejoin="round"/>
          <path d="M44 33 l3 -7 3 6 3 -6 3 7Z" fill="#2f9c82"/>
          <ellipse cx="50" cy="58" rx="30" ry="27" fill="#4cc3a2"/>
          ${shine(37, 42)}
          <ellipse cx="50" cy="69" rx="19" ry="12.5" fill="#cdf3e2"/>
          ${face({ y: 52, dx: 11, my: 72 })}
          <ellipse cx="45.5" cy="66" rx="1.5" ry="1.1" fill="#2f7d6a"/><ellipse cx="54.5" cy="66" rx="1.5" ry="1.1" fill="#2f7d6a"/>
          <g fill="none" stroke="#2f7d6a" stroke-width="1.5" stroke-linecap="round"><path d="M31 67 q-8 1 -12 -4"/><path d="M69 67 q8 1 12 -4"/></g>
          <circle cx="78" cy="82" r="7" fill="#fffbe9" stroke="#f2c14e" stroke-width="1.5"/><circle cx="76" cy="80" r="2.2" fill="#fff"/>
        </g>`;
      },
      owl() {
        return bg("#eef3fb", "#cfdcf2") + `<g class="chr">
          <path d="M25 44 L27 28 L39 37Z M75 44 L73 28 L61 37Z" fill="#8a5d3b"/>
          <ellipse cx="50" cy="61" rx="29" ry="27" fill="#a87650"/>
          ${shine(36, 46)}
          <ellipse cx="50" cy="71" rx="17" ry="13" fill="#f3e2c7"/>
          <g fill="none" stroke="#c9a77f" stroke-width="1.3" stroke-linecap="round"><path d="M44 69 l2 2 2 -2 M52 69 l2 2 2 -2 M48 75 l2 2 2 -2"/></g>
          <circle cx="39.5" cy="54" r="10" fill="#fffaf0"/><circle cx="60.5" cy="54" r="10" fill="#fffaf0"/>
          ${face({ y: 54, dx: 10.5, mouth: "none", blush: true, rx: 3.6, ry: 4 })}
          <path d="M46.5 61 L53.5 61 L50 66.5Z" fill="#f5a03a" stroke="#e08a28" stroke-width="1" stroke-linejoin="round"/>
          <path d="M24 28 L50 18 L76 28 L50 38Z" fill="#33344a"/><path d="M36 33 V39 Q50 45 64 39 V33" fill="#2a2b3e"/>
          <path d="M50 28 Q66 30 70 38" fill="none" stroke="#f2c14e" stroke-width="1.6"/><circle cx="70.5" cy="40" r="2.6" fill="#f2c14e"/>
        </g>`;
      },
      // a chess piece mascot for human players
      piece(side, glyph) {
        const id = "pw" + (++uid), col = side ? "#2b1d14" : "#b3241a";
        return bg(side ? "#f3ece2" : "#fff0eb", side ? "#ddd1c1" : "#ffd3c8") + `<defs><radialGradient id="${id}" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#fff2d6"/><stop offset=".55" stop-color="#f0cd92"/><stop offset="1" stop-color="#c88f4a"/></radialGradient></defs>
          <g class="chr">
          <ellipse cx="50" cy="62" rx="33" ry="31" fill="#a46a32"/>
          <ellipse cx="50" cy="57" rx="33" ry="31" fill="url(#${id})"/>
          <ellipse cx="50" cy="57" rx="27" ry="25" fill="none" stroke="${col}" stroke-width="1.6" opacity=".75"/>
          ${shine(36, 40, 8, 4)}
          ${glyph(col)}
          ${face({ y: 64, dx: 9, my: 71, rx: 2.4, ry: 2.9 })}
          </g>`;
      }
    };
    const KINDS = ["chick", "bunny", "shiba", "panda", "fox", "tiger", "dragon"];
    return {
      KINDS,
      svg(kind, ...a) { return `<svg class="ava-svg k-${kind}" viewBox="5 7 90 90" aria-hidden="true">${K[kind](...a)}</svg>`; },
      level(lv) { return this.svg(KINDS[lv]); },
      player(side, fig) { return this.svg("piece", side, col => fig ? `<use href="#fg0" x="39" y="35" width="22" height="22" style="color:${col};--cut:#f3d9a8"/>` : `<text x="50" y="54" text-anchor="middle" font-family='XQPiece,"Songti SC","Noto Serif SC",serif' font-weight="900" font-size="22" fill="${col}">${side ? "將" : "帥"}</text>`); }
    };
  })();

  // ---- figurine pieces (viewBox 0 0 24 24, fill = currentColor, details cut out in the piece's ivory) ----
  // index = piece type: 0 general, 1 advisor, 2 elephant, 3 horse, 4 chariot, 5 cannon, 6 soldier
  const CUT = 'fill="var(--cut,#f7eedb)"', CUTS = 'fill="none" stroke="var(--cut,#f7eedb)" stroke-linecap="round" stroke-linejoin="round"';
  const FIG = [
    // general: a crown
    `<path d="M3.2 8.2l4.3 3.9L12 4.4l4.5 7.7 4.3-3.9-1.7 8.6H4.9z"/><rect x="4.9" y="17.9" width="14.2" height="2.6" rx="1.1"/><circle cx="12" cy="3.6" r="1.5"/><circle cx="3.1" cy="7.4" r="1.3"/><circle cx="20.9" cy="7.4" r="1.3"/><circle cx="12" cy="13.6" r="1.25" ${CUT}/>`,
    // advisor: a guard's shield
    `<path d="M12 2.6l7.6 2.6v5.9c0 4.6-3 8.3-7.6 10.4-4.6-2.1-7.6-5.8-7.6-10.4V5.2z"/><path d="M12 7.2v9.6M8 11.4h8" ${CUTS} stroke-width="2"/>`,
    // elephant: head on, big ears, trunk and tusks
    `<ellipse cx="5.4" cy="9.6" rx="4" ry="5.4"/><ellipse cx="18.6" cy="9.6" rx="4" ry="5.4"/><path d="M7.2 8.6C7.2 5.4 9.3 3.4 12 3.4s4.8 2 4.8 5.2v3.6c0 1.3-.9 2.2-2.2 2.5v3.6c0 1 .7 1.4 1.5 1.1l.7 1.5c-2 .9-4.6.2-4.9-2.4l-.5-3.6c-2-.1-4.2-1-4.2-3.1z"/><circle cx="9.9" cy="8.8" r=".95" ${CUT}/><circle cx="14.1" cy="8.8" r=".95" ${CUT}/><path d="M9.2 13.6l-.9 3.2M14.9 13.9l.8 2.6" ${CUTS} stroke-width="1.3"/>`,
    // horse: a knight's head
    `<path d="M6.3 21v-2.3c2.3-1.6 3.6-3.4 3.4-5.5l-2.6 1.9-2.9-1.9c.5-3 2.4-6.2 5.2-7.9L10.2 2.4l3 2.3c4.6 2 6.4 6.6 6.2 13.9V21z"/><circle cx="10.6" cy="8.6" r="1.05" ${CUT}/><path d="M14.6 7.6c1.8 2.3 2.4 5.3 2.2 9.4" ${CUTS} stroke-width="1.2"/>`,
    // chariot: a rook tower
    `<path d="M5.4 3.4h2.9v2.4h2.2V3.4h3v2.4h2.2V3.4h2.9v5.5l-2.1 2v5.6l2.1 2V21H5.4v-2.5l2.1-2v-5.6l-2.1-2z"/><path d="M8.2 11h7.6M8.2 16.4h7.6" ${CUTS} stroke-width="1.2"/>`,
    // cannon: a barrel on a wheel
    `<g transform="rotate(-24 11 11)"><rect x="2.2" y="7.4" width="18.6" height="6.6" rx="3.3"/><rect x="18.4" y="6.4" width="3.4" height="8.6" rx="1.4"/></g><circle cx="9.4" cy="16.4" r="4.9"/><circle cx="9.4" cy="16.4" r="3" ${CUT}/><circle cx="9.4" cy="16.4" r="1.5"/>`,
    // soldier: a pawn with a helmet
    `<circle cx="12" cy="6.9" r="3.9"/><path d="M7.6 11.2h8.8l-1.7 1.9c.5 2.5 1.6 4 3.3 5.2V21H6v-2.7c1.7-1.2 2.8-2.7 3.3-5.2z"/><path d="M12 1.6v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  ];

  function sprite() {
    let sym = '';
    FIG.forEach((d, i) => { sym += `<symbol id="fg${i}" viewBox="0 0 24 24"><g fill="currentColor">${d}</g></symbol>`; });
    const I = (id, d) => `<symbol id="i-${id}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</g></symbol>`;
    sym += I('rule', '<path d="M6 4.5h9.5L18 7v12.5H6z"/><path d="M9 10h6M9 13.5h6M9 17h3.5"/>');
    sym += I('gear', '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18"/>');
    sym += I('share', '<path d="M12 14.5V4.5M8.5 8L12 4.5 15.5 8"/><path d="M6 12.5v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5"/>');
    sym += I('undo', '<path d="M9 14 4.5 9.5 9 5"/><path d="M4.5 9.5h9.3a5.2 5.2 0 0 1 0 10.4H11"/>');
    sym += I('redo', '<path d="M15 14l4.5-4.5L15 5"/><path d="M19.5 9.5h-9.3a5.2 5.2 0 0 0 0 10.4H13"/>');
    sym += I('flip', '<path d="M7.5 4.5v15M7.5 19.5l-3-3M7.5 19.5l3-3M16.5 19.5v-15M16.5 4.5l-3 3M16.5 4.5l3 3"/>');
    sym += I('reset', '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4.5v4.6h4.6"/>');
    sym += I('branch', '<circle cx="6.5" cy="6" r="2.1"/><circle cx="17.5" cy="6" r="2.1"/><circle cx="12" cy="18.5" r="2.1"/><path d="M6.5 8.1v1.6a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3V8.1M12 12.7v3.7"/>');
    sym += I('hint', '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.6 1.2 1.5 1.2 2.5h4c0-1 .5-1.9 1.2-2.5A5.5 5.5 0 0 0 12 3.5z"/>');
    sym += I('hand', '<path d="M3.5 12.5l3.2-3.2 3.3 1.2 2-1.7 2.3.2 2.2 1.8 4 1.7"/><path d="M6.7 9.3L3.5 7M20.5 7l-3.6 2.6"/><path d="M8.2 14.2l2.4 2.4M10.8 12.8l3 3M13.6 12.2l2.6 2.6"/><path d="M5 14.2l5.2 4.3c.8.6 1.8.6 2.6 0l5.7-4.6"/>');
    sym += I('first', '<path d="M7 6v12M17 6l-6 6 6 6"/>');
    sym += I('home', '<path d="M4.5 11.5L12 5l7.5 6.5"/><path d="M6.5 10.5v8.5h11v-8.5"/>');
    sym += I('eye', '<path d="M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.6"/>');
    sym += I('trash', '<path d="M5 7h14M9.5 7V5h5v2M7 7l.8 12h8.4L17 7"/>');
    sym += I('door', '<path d="M13.5 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4"/><path d="M4.5 12h10M11 8.5l3.5 3.5-3.5 3.5"/>');
    return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${sym}</defs></svg>`;
  }
  G.XQArt = { AVA, FIG, sprite };
})(typeof window !== 'undefined' ? window : globalThis);
