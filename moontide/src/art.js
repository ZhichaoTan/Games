// ===== 沉岛 Moontide · artwork: every piece is drawn here in SVG, in hex units (a hex is 20 wide, 17.3 tall, centred on 0,0) =====
(function (G) {
  'use strict';
  // the four players' colours, by seat
  const PC = [
    { a: '#ff8a73', b: '#e5492f', ink: '#3a120a', name: 'coral' },
    { a: '#ffe08a', b: '#f2a91c', ink: '#3b2604', name: 'gold' },
    { a: '#cdb9ff', b: '#8a63f0', ink: '#20124a', name: 'lilac' },
    { a: '#ffffff', b: '#cfd8de', ink: '#1d2a33', name: 'snow' },
  ];
  const f = n => +n.toFixed(2);
  const hexPts = (s, x = 0, y = 0) => { let p = ''; for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; p += f(x + s * Math.cos(a)) + ',' + f(y + s * Math.sin(a)) + ' '; } return p.trim(); };

  // ---------- shared gradients and filters ----------
  function defs() {
    const pc = PC.map((c, i) => `<radialGradient id="pc${i}" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="${c.a}"/><stop offset="1" stop-color="${c.b}"/></radialGradient>`).join('');
    return `<defs>${pc}
<radialGradient id="gSea" cx="64%" cy="22%" r="85%"><stop offset="0" stop-color="#1f6f7d"/><stop offset=".45" stop-color="#0f4b5c"/><stop offset="1" stop-color="#062634"/></radialGradient>
<radialGradient id="gMoonGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3cf" stop-opacity=".22"/><stop offset="1" stop-color="#fff3cf" stop-opacity="0"/></radialGradient>
<linearGradient id="gSand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1deac"/><stop offset="1" stop-color="#d9bd80"/></linearGradient>
<linearGradient id="gGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fae6a"/><stop offset="1" stop-color="#3b8452"/></linearGradient>
<linearGradient id="gHill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa58a"/><stop offset="1" stop-color="#6f7d68"/></linearGradient>
<linearGradient id="gReef" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d9a98"/><stop offset="1" stop-color="#1c7a7d"/></linearGradient>
<linearGradient id="gWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a4b"/><stop offset=".55" stop-color="#9c5f2d"/><stop offset="1" stop-color="#6e3f1b"/></linearGradient>
<linearGradient id="gFin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5d7383"/><stop offset=".6" stop-color="#3a4d5b"/><stop offset="1" stop-color="#263540"/></linearGradient>
<radialGradient id="gOct" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#f29ad6"/><stop offset=".55" stop-color="#c04fa4"/><stop offset="1" stop-color="#7c2a74"/></radialGradient>
<radialGradient id="gCrab" cx="40%" cy="32%" r="80%"><stop offset="0" stop-color="#ff9a5c"/><stop offset=".6" stop-color="#e2502b"/><stop offset="1" stop-color="#a5301a"/></radialGradient>
<linearGradient id="gTower" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e4e8ec"/><stop offset="1" stop-color="#b7c2cb"/></linearGradient>
<linearGradient id="gBand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f0584a"/><stop offset=".7" stop-color="#cc3528"/><stop offset="1" stop-color="#9b2219"/></linearGradient>
<radialGradient id="gLamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff7d6" stop-opacity=".95"/><stop offset=".35" stop-color="#ffd76a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>
<linearGradient id="gBeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2b8" stop-opacity=".4"/><stop offset="1" stop-color="#fff2b8" stop-opacity="0"/></linearGradient>
<radialGradient id="gRock" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#8d8f86"/><stop offset="1" stop-color="#4e524c"/></radialGradient>
<linearGradient id="gBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27466e"/><stop offset="1" stop-color="#162a47"/></linearGradient>
<radialGradient id="gDolphin" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#b5d3e6"/><stop offset="1" stop-color="#5e8aa6"/></radialGradient>
<pattern id="pWave" width="24" height="15" patternUnits="userSpaceOnUse"><path d="M1 5 Q4 3.4 7 5 T13 5" fill="none" stroke="#bfe9ef" stroke-opacity=".08" stroke-width=".55" stroke-linecap="round"/><path d="M13 12 Q16 10.4 19 12 T25 12" fill="none" stroke="#bfe9ef" stroke-opacity=".06" stroke-width=".5" stroke-linecap="round"/></pattern>
<pattern id="pSand" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.5" r=".28" fill="#b8975d" fill-opacity=".35"/><circle cx="4.1" cy="4.2" r=".22" fill="#fff6dc" fill-opacity=".5"/></pattern>
<filter id="fSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation=".8"/></filter>
</defs>`;
  }

  // ---------- islanders ----------
  // a glossy token in the player's colour; your own show their pearls, everyone else's a little figure
  function token(seat, num, r) {
    r = r || 3.1;
    const c = PC[seat] || PC[3];
    const mid = num
      ? `<text y="${f(r * 0.36)}" font-size="${f(r * 1.2)}" font-weight="800" text-anchor="middle" fill="${c.ink}" font-family="Manrope,system-ui,sans-serif">${num}</text>`
      : `<g fill="${c.ink}" fill-opacity=".5"><circle cy="${f(-r * 0.27)}" r="${f(r * 0.27)}"/><path d="M${f(-r * 0.5)} ${f(r * 0.5)}a${f(r * 0.5)} ${f(r * 0.43)} 0 0 1 ${f(r)} 0z"/></g>`;
    return `<circle r="${r}" fill="url(#pc${seat})" stroke="rgba(10,14,20,.85)" stroke-width="${f(r * 0.15)}"/>` +
      `<ellipse cx="${f(-r * 0.3)}" cy="${f(-r * 0.42)}" rx="${f(r * 0.42)}" ry="${f(r * 0.22)}" fill="#fff" fill-opacity=".5"/>` + mid;
  }
  // an islander on land or in a boat: the token on a soft shadow
  const islander = (seat, num) => `<ellipse cy="2.3" rx="2.8" ry="1" fill="#000" fill-opacity=".28"/>${token(seat, num)}`;
  // a swimmer: half under water, with rings round it
  function swimmer(seat, num) {
    return `<ellipse rx="4.3" ry="1.7" cy="1.25" fill="#9fe3ef" fill-opacity=".14" stroke="#d9f6fb" stroke-opacity=".7" stroke-width=".38"/>` +
      `<g class="bob">${token(seat, num, 2.8)}</g>` +
      `<path d="M-3.4 1.35 Q-1.7 .55 0 1.35 T3.4 1.35 L3.4 3.2 L-3.4 3.2Z" fill="#0f4b5c" fill-opacity=".62"/>` +
      `<path d="M-3.6 1.35 Q-1.8 .45 0 1.35 T3.6 1.35" fill="none" stroke="#e6fbff" stroke-opacity=".85" stroke-width=".42" stroke-linecap="round"/>`;
  }

  // ---------- boats ----------
  // a wooden sampan, bow to the right (the board turns it to face where it last went); seats at x = -3.6, 0, 3.6
  const SEATS = [-4.1, 0, 4.1];
  function boat() {
    return `<ellipse cy="1.9" rx="9" ry="3.6" fill="#03141c" fill-opacity=".38"/>` +
      `<path d="M-8.4 .1 C-7.4 -3.9 5.2 -4.4 8.8 0 C5.2 4.4 -7.4 3.9 -8.4 .1Z" fill="url(#gWood)" stroke="#3b220e" stroke-width=".55"/>` +
      `<path d="M-7 .1 C-6.1 -2.75 4.4 -3.15 7.2 0 C4.4 3.15 -6.1 2.75 -7 .1Z" fill="#5b3415"/>` +
      `<path d="M-6.8 -.5 C-5.6 -2.3 4.2 -2.6 6.8 -.5" fill="none" stroke="#f0c48c" stroke-opacity=".3" stroke-width=".4"/>` +
      SEATS.map(x => `<rect x="${x - 0.5}" y="-2.75" width="1" height="5.5" rx=".35" fill="#c48a51" stroke="#7a4a22" stroke-width=".2"/>`).join('') +
      `<path d="M8.8 0 L7.4 -.9 L7.4 .9Z" fill="#e8c38f" fill-opacity=".55"/>` +
      `<g class="wake"><path d="M-9 .2 Q-11 -.8 -12.6 .2 M-8.8 1.6 Q-10.6 2 -12 3.2" fill="none" stroke="#e6fbff" stroke-opacity=".45" stroke-width=".45" stroke-linecap="round"/></g>`;
  }

  // ---------- creatures ----------
  function shark() {
    return `<path d="M-7.6 1.6 C-4.8 -.2 2.6 -.4 5.4 1.2 C6.6 .3 7.6 -.6 8.4 -1 C8 .4 7.9 1.4 8.4 3 C7.4 2.5 6.4 2.1 5.4 2 C2.6 3.4 -4.8 3.4 -7.6 1.6Z" fill="#05202a" fill-opacity=".55"/>` +
      `<path d="M-3.4 1.7 C-2.2 -.4 -.2 -3.6 2.6 -6.2 C1.9 -3.4 2 -1.2 3.6 1.7Z" fill="url(#gFin)" stroke="#0c141a" stroke-width=".4" stroke-linejoin="round"/>` +
      `<path d="M-1.8 .2 C-.8 -1.6 .6 -3.4 2 -4.8" fill="none" stroke="#9fb6c4" stroke-opacity=".6" stroke-width=".35" stroke-linecap="round"/>` +
      `<path d="M-5.4 1.8 Q-3.6 .9 -1.8 1.8 T1.8 1.8 T5.4 1.8" fill="none" stroke="#e6fbff" stroke-opacity=".8" stroke-width=".45" stroke-linecap="round"/>`;
  }
  function octopus() {
    const arms = [[-6.2, 2.2, -7.6, -.6], [-4.4, 4.4, -6.6, 5.4], [-1.4, 5.4, -2.6, 7.4], [1.6, 5.4, 2.8, 7.4], [4.6, 4.4, 6.8, 5.2], [6.2, 2, 7.6, -.8]];
    return `<ellipse cy="2.8" rx="7.2" ry="3.4" fill="#05202a" fill-opacity=".35"/>` +
      arms.map(([x1, y1, x2, y2]) => `<path d="M${f(x1 * 0.32)} ${f(y1 * 0.2)} Q${x1} ${y1} ${x2} ${y2}" fill="none" stroke="#a63f8e" stroke-width="1.5" stroke-linecap="round"/>` +
        `<circle cx="${x2}" cy="${y2}" r=".55" fill="#a63f8e"/>`).join('') +
      arms.map(([x1, y1]) => `<circle cx="${f(x1 * 0.7)}" cy="${f(y1 * 0.6)}" r=".3" fill="#f7c1e6" fill-opacity=".8"/>`).join('') +
      `<path d="M-3.6 1.6 C-4 -2.6 -2.4 -5 0 -5 C2.4 -5 4 -2.6 3.6 1.6 C2.4 2.4 -2.4 2.4 -3.6 1.6Z" fill="url(#gOct)" stroke="#5c1f57" stroke-width=".45"/>` +
      `<ellipse cx="-1.25" cy="-.6" rx=".95" ry="1.1" fill="#fff"/><ellipse cx="1.25" cy="-.6" rx=".95" ry="1.1" fill="#fff"/>` +
      `<circle cx="-1.05" cy="-.4" r=".5" fill="#26102a"/><circle cx="1.45" cy="-.4" r=".5" fill="#26102a"/>` +
      `<ellipse cx="-1.2" cy="-3.4" rx="1.1" ry=".55" fill="#fff" fill-opacity=".4"/>`;
  }
  function crab() {
    const legs = [-1, 1].map(sx => [0, 1, 2].map(k => `<path d="M${sx * 2.6} ${f(-0.6 + k * 1.2)} q${sx * 2} ${f(-0.6 + k * 0.5)} ${sx * 3.2} ${f(0.8 + k * 0.7)}" fill="none" stroke="#b5391f" stroke-width=".75" stroke-linecap="round"/>`).join('')).join('');
    const claw = sx => `<path d="M${sx * 2.2} -1.8 Q${sx * 3.4} -3.8 ${sx * 3.6} -4.8" fill="none" stroke="#c4421f" stroke-width="1" stroke-linecap="round"/>` +
      `<path d="M${sx * 3.6} -4.6 C${sx * 5.6} -4.8 ${sx * 6.2} -7.2 ${sx * 4.6} -8 C${sx * 4.8} -6.8 ${sx * 4.2} -6.2 ${sx * 3.4} -6.4 C${sx * 2.6} -6.8 ${sx * 2.6} -5 ${sx * 3.6} -4.6Z" fill="url(#gCrab)" stroke="#7a2311" stroke-width=".35"/>`;
    return `<ellipse cy="2.6" rx="6" ry="1.9" fill="#000" fill-opacity=".3"/>` + legs + claw(-1) + claw(1) +
      `<ellipse rx="3.8" ry="2.9" fill="url(#gCrab)" stroke="#7a2311" stroke-width=".45"/>` +
      `<path d="M-2.4 -.6 Q0 -1.8 2.4 -.6" fill="none" stroke="#ffd0b0" stroke-opacity=".55" stroke-width=".4"/>` +
      `<path d="M-1.1 -2.6 V-3.8 M1.1 -2.6 V-3.8" stroke="#7a2311" stroke-width=".45"/>` +
      `<circle cx="-1.1" cy="-4" r=".75" fill="#fff"/><circle cx="1.1" cy="-4" r=".75" fill="#fff"/><circle cx="-1" cy="-4" r=".38" fill="#20100a"/><circle cx="1.2" cy="-4" r=".38" fill="#20100a"/>`;
  }
  function dolphin() {
    return `<path d="M-6 2.6 C-4.6 -2.6 1.2 -5 5.6 -2.4 C6.6 -2.8 7.4 -3.4 7.8 -4.2 C7.8 -3 7.4 -2 6.6 -1.4 C7 -.4 6.8 .6 6.2 1.2 C5.6 .2 4.8 -.4 3.8 -.6 C1.6 -1.6 -1.8 -.4 -3.6 2.8Z" fill="url(#gDolphin)" stroke="#2a4a5e" stroke-width=".4"/>` +
      `<path d="M-.4 -2.6 L1 -5 L1.8 -2.9Z" fill="#6f98b2" stroke="#2a4a5e" stroke-width=".3"/><circle cx="4.4" cy="-1.9" r=".38" fill="#14222c"/>` +
      `<path d="M-7.4 3 Q-5.6 2 -3.8 3 T-.2 3" fill="none" stroke="#e6fbff" stroke-opacity=".8" stroke-width=".42" stroke-linecap="round"/>`;
  }

  // ---------- terrain ----------
  function palm(x, y, s, rot) {
    s = s || 1;
    const fr = [[-3.4, -.3], [-2.4, -2.6], [0, -3.4], [2.4, -2.6], [3.4, -.3]];
    return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})${rot ? ` rotate(${rot})` : ''}">` +
      `<ellipse cy="1.9" rx="2.6" ry=".8" fill="#123a24" fill-opacity=".45"/>` +
      `<path d="M.1 1.9 C.3 .4 .1 -1.1 -.4 -2.4" fill="none" stroke="#7a5532" stroke-width=".8" stroke-linecap="round"/>` +
      fr.map(([dx, dy]) => `<path d="M-.4 -2.4 Q${f(dx * 0.6)} ${f(dy * 0.9 - 2.6)} ${f(dx - 0.4)} ${f(dy - 1.4)}" fill="none" stroke="#2f7d3f" stroke-width="1.05" stroke-linecap="round"/>`).join('') +
      fr.map(([dx, dy]) => `<path d="M-.4 -2.4 Q${f(dx * 0.6)} ${f(dy * 0.9 - 2.7)} ${f(dx - 0.4)} ${f(dy - 1.5)}" fill="none" stroke="#8fd685" stroke-opacity=".55" stroke-width=".35" stroke-linecap="round"/>`).join('') +
      `<circle cx="-.6" cy="-2.2" r=".45" fill="#5b3a1c"/><circle cx="-.1" cy="-2.1" r=".42" fill="#6b4422"/></g>`;
  }
  function rock(x, y, s) {
    s = s || 1;
    return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})">` +
      `<ellipse cy="1.5" rx="4.2" ry="1.1" fill="#232a22" fill-opacity=".4"/>` +
      `<path d="M-4 1.5 L-2.2 -1.8 L-.8 -1 L.8 -4 L3 -.6 L4.2 1.5Z" fill="url(#gRock)" stroke="#3a3d38" stroke-width=".35" stroke-linejoin="round"/>` +
      `<path d="M.8 -4 L.2 -1.2 L-.8 -1 M.8 -4 L1.6 -1.6" fill="none" stroke="#c9ccbf" stroke-opacity=".55" stroke-width=".3"/>` +
      `<path d="M.8 -4 L1.6 -2.4 L.9 -2.2Z" fill="#f2f4ee" fill-opacity=".7"/></g>`;
  }
  function shell(x, y) { return `<path transform="translate(${f(x)} ${f(y)})" d="M-.7 .4 Q0 -1 .7 .4Z" fill="#fff3e3" fill-opacity=".8" stroke="#c9a47a" stroke-width=".18"/>`; }
  function coral(x, y, c) { return `<path transform="translate(${f(x)} ${f(y)})" d="M0 1.4 V-.2 M0 .4 L-1 -.8 M0 -.2 L.9 -1.3 M-1 -.8 V-1.6 M.9 -1.3 L1.4 -2" fill="none" stroke="${c}" stroke-width=".55" stroke-linecap="round"/>`; }

  // a land tile: its colour band and a few things on it, placed by a seed so the same tile always looks the same
  function tile(el, seed) {
    let r = seed * 9301 + 49297;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    const fill = el === 2 ? 'url(#gHill)' : el === 1 ? 'url(#gGrass)' : 'url(#gSand)';
    let h = `<polygon points="${hexPts(10.25)}" fill="${fill}" stroke="${el === 2 ? '#5b6754' : el === 1 ? '#2f6f42' : '#c4a56a'}" stroke-width=".45"/>`;
    if (el === 0) {
      h += `<polygon points="${hexPts(10.25)}" fill="url(#pSand)"/>`;
      for (let k = 0; k < 2; k++) h += shell(-5 + rnd() * 10, -4 + rnd() * 8);
      if (rnd() < 0.35) h += palm(-2 + rnd() * 4, -1 + rnd() * 2, 0.72, -8 + rnd() * 16);
    } else if (el === 1) {
      h += `<circle cx="${f(-3 + rnd() * 6)}" cy="${f(-2 + rnd() * 4)}" r="3.4" fill="#7fc477" fill-opacity=".16"/>`;
      h += palm(-3.6 + rnd() * 1.6, 0.4 + rnd() * 2.2, 0.92, -6 + rnd() * 12);
      h += palm(1.8 + rnd() * 2, -1.6 + rnd() * 2, 0.78, -6 + rnd() * 12);
    } else {
      h += rock(-1 + rnd() * 2, 0.4 + rnd() * 1.4, 1.05);
      h += `<circle cx="${f(-4.5 + rnd() * 2)}" cy="${f(2 + rnd() * 2)}" r=".7" fill="#596154"/><circle cx="${f(3.5 + rnd() * 2)}" cy="${f(1.5 + rnd() * 2)}" r=".55" fill="#596154"/>`;
    }
    return h;
  }
  function reef(seed) {
    let r = seed * 7907 + 1;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    let h = `<polygon points="${hexPts(9.4)}" fill="url(#gReef)" fill-opacity=".85" stroke="#7fe0d2" stroke-opacity=".45" stroke-width=".4" stroke-dasharray="1.2 1"/>`;
    const cs = ['#ff8f8f', '#ffb36b', '#f7d36b', '#ff7fb0'];
    for (let k = 0; k < 5; k++) h += coral(-5.5 + rnd() * 11, -3.6 + rnd() * 7.2, cs[k % 4]);
    h += `<circle cx="${f(-3 + rnd() * 6)}" cy="${f(-3 + rnd() * 6)}" r=".9" fill="#e4f7d2" fill-opacity=".5"/>`;
    return h;
  }

  // ---------- lighthouse (standing on its rock), drawn at the corner cell ----------
  function lighthouse() {
    return `<ellipse cy="3.2" rx="9.6" ry="4.6" fill="#e6fbff" fill-opacity=".14"/>` +
      `<path d="M-8.4 3.4 C-8 -.4 -4 -2 0 -1.8 C4.4 -2 8.2 -.2 8.4 3.4 C5 5.6 -5 5.6 -8.4 3.4Z" fill="url(#gRock)" stroke="#2c302b" stroke-width=".45"/>` +
      `<path d="M-6 1 C-3 -.6 2 -.8 5.4 .6" fill="none" stroke="#bfc4b8" stroke-opacity=".4" stroke-width=".4"/>` +
      `<path d="M-2.4 1.2 L-1.6 -10.4 L1.6 -10.4 L2.4 1.2Z" fill="url(#gTower)" stroke="#5d6871" stroke-width=".35"/>` +
      `<path d="M-2.18 -1.9 L-1.97 -4.7 L1.97 -4.7 L2.18 -1.9Z M-1.84 -6.6 L-1.68 -9 L1.68 -9 L1.84 -6.6Z" fill="url(#gBand)"/>` +
      `<rect x="-2.3" y="-11.6" width="4.6" height="1.3" rx=".3" fill="#2e3b46"/>` +
      `<rect x="-1.5" y="-14" width="3" height="2.5" rx=".4" fill="#ffe9a6" stroke="#2e3b46" stroke-width=".35"/>` +
      `<path d="M-2.1 -14 L0 -16.2 L2.1 -14Z" fill="#cc3528" stroke="#7d1e17" stroke-width=".3"/>` +
      `<rect x="-.6" y="-2" width="1.2" height="2" rx=".3" fill="#3a2a1e"/>`;
  }

  // ---------- tile undersides (shown as a tile flips over), the die faces and small icons ----------
  function backIcon(k) {
    switch (k) {
      case 'boat': return `<g transform="scale(.62)">${boat()}</g>`;
      case 'shark': return `<g transform="scale(.72) translate(0 1.4)">${shark()}</g>`;
      case 'oct': return `<g transform="scale(.66) translate(0 -.4)">${octopus()}</g>`;
      case 'crab': return `<g transform="scale(.62) translate(0 1.6)">${crab()}</g>`;
      case 'reef': return `<g>${coral(-2.6, 1, '#ff8f8f')}${coral(0, -.4, '#ffb36b')}${coral(2.6, 1.2, '#ff7fb0')}<path d="M-5 2.6 H5" stroke="#7fe0d2" stroke-width=".5" stroke-linecap="round"/></g>`;
      case 'dolphin': return `<g transform="scale(.66)">${dolphin()}</g>`;
      case 'buoy': return buoy();
      case 'tail': return wind();
      case 'moon': return moon(4.6);
      default: return `<g fill="none" stroke="#bfe9ef" stroke-linecap="round"><ellipse rx="5" ry="2" stroke-opacity=".5" stroke-width=".5"/><ellipse rx="2.6" ry="1" stroke-opacity=".8" stroke-width=".5"/></g>`;
    }
  }
  function buoy() {
    return `<circle r="4.2" fill="none" stroke="#fff" stroke-width="2.1"/>` +
      [0, 1, 2, 3].map(k => `<path d="M${f(4.2 * Math.cos(k * Math.PI / 2 + 0.35))} ${f(4.2 * Math.sin(k * Math.PI / 2 + 0.35))} A4.2 4.2 0 0 1 ${f(4.2 * Math.cos(k * Math.PI / 2 + 1.2))} ${f(4.2 * Math.sin(k * Math.PI / 2 + 1.2))}" fill="none" stroke="#e5452f" stroke-width="2.1"/>`).join('') +
      `<circle r="5.25" fill="none" stroke="#5b1a12" stroke-opacity=".5" stroke-width=".3"/><circle r="3.15" fill="none" stroke="#5b1a12" stroke-opacity=".5" stroke-width=".3"/>`;
  }
  function wind() {
    return `<g fill="none" stroke="#e7f6ff" stroke-linecap="round" stroke-width=".9">` +
      `<path d="M-5.4 -2.2 H1.6 A1.8 1.8 0 1 0 -.2 -4"/><path d="M-5.8 .4 H4 A2.1 2.1 0 1 1 2 2.6"/><path d="M-4.6 3 H-.4"/></g>` +
      `<path d="M2.8 -5.4 L5.8 -1.4 L2.8 -.8Z" fill="#ffd76a" stroke="#8a5d10" stroke-width=".3"/>`;
  }
  function moon(r) {
    r = r || 5;
    return `<circle r="${f(r * 1.5)}" fill="url(#gMoonGlow)"/>` +
      `<path d="M${f(r * 0.28)} ${f(-r)} A${r} ${r} 0 1 0 ${f(r * 0.98)} ${f(r * 0.32)} A${f(r * 0.8)} ${f(r * 0.8)} 0 1 1 ${f(r * 0.28)} ${f(-r)}Z" fill="#fde9b4" stroke="#c99a4a" stroke-width="${f(r * 0.05)}"/>` +
      `<circle cx="${f(-r * 0.35)}" cy="${f(r * 0.2)}" r="${f(r * 0.12)}" fill="#e8c983"/><circle cx="${f(-r * 0.05)}" cy="${f(r * 0.55)}" r="${f(r * 0.08)}" fill="#e8c983"/>`;
  }
  // one face of the tide die, for the dock and the rules (a standalone svg)
  function dieFace(k, cls) {
    const inner = k === 'shark' ? `<g transform="translate(0 2) scale(.95)">${shark()}</g>` : k === 'oct' ? `<g transform="scale(.82) translate(0 .4)">${octopus()}</g>` : k === 'crab' ? `<g transform="scale(.8) translate(0 2.4)">${crab()}</g>` : moon(5.4);
    return `<svg class="${cls || 'die'}" viewBox="-11 -11 22 22" aria-hidden="true"><rect x="-10" y="-10" width="20" height="20" rx="5" fill="#fbf6ea" stroke="#d5c7a6" stroke-width=".8"/><rect x="-10" y="-10" width="20" height="20" rx="5" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width=".5" transform="translate(.4 .4) scale(.96)"/><g transform="scale(.82)">${inner}</g></svg>`;
  }
  // a piece on its own (rules sheet, result sheet, notes)
  function piece(k, seat, num, cls) {
    const vb = { isl: '-5 -5 10 10', swim: '-5 -4 10 9', boat: '-12 -6 24 12', shark: '-9 -7 18 12', oct: '-9 -7 18 16', crab: '-8 -9 16 13', lh: '-10 -17 20 23', dolphin: '-8 -6 17 10', buoy: '-6 -6 12 12', tail: '-7 -6 14 12', reef: '-7 -4 14 8', moon: '-8 -8 16 16', none: '-6 -4 12 8' }[k] || '-10 -10 20 20';
    const body = k === 'isl' ? token(seat, num) : k === 'swim' ? swimmer(seat, num) : k === 'boat' ? boat() : k === 'shark' ? shark() : k === 'oct' ? octopus() : k === 'crab' ? crab() : k === 'lh' ? lighthouse() : k === 'dolphin' ? dolphin() : backIcon(k);
    return `<svg class="${cls || 'pc'}" viewBox="${vb}" aria-hidden="true">${body}</svg>`;
  }
  // terrain swatches for the rules
  function swatch(el) { return `<svg class="sw" viewBox="-11 -10 22 20" aria-hidden="true">${defsMini()}${tile(el, 3 + el)}</svg>`; }
  const defsMini = () => '';

  // the lobby picture (and the home page card): a corner of a moonlit board, with no words in it so it suits both languages
  function scene() {
    const S = 10, H = Math.sqrt(3) * S;
    const xy = (q, r) => ({ x: 1.5 * S * q, y: H * (r + q / 2) });
    const at = (q, r, body, cls, dy) => { const p = xy(q, r); return `<g transform="translate(${p.x.toFixed(2)} ${(p.y + (dy || 0)).toFixed(2)})"${cls ? ` class="${cls}"` : ''}>${body}</g>`; };
    let sea = '';
    for (let q = -6; q <= 6; q++) for (let r = -6; r <= 6; r++) {
      const p = xy(q, r);
      if (p.y < -40 || p.y > 46 || Math.abs(p.x) > 96) continue;
      const fade = Math.max(0, 1 - Math.hypot(p.x / 100, (p.y - 3) / 48));
      sea += `<polygon points="${hexPts(9.55, p.x, p.y)}" fill="none" stroke="#c8f0f4" stroke-opacity="${(0.13 * fade).toFixed(3)}" stroke-width=".45"/>`;
    }
    const land = [[-1, 0, 2], [0, 0, 1], [-2, 1, 1], [-1, 1, 0], [0, -1, 0], [-2, 0, 0], [1, -1, 0], [0, 1, 0], [-1, -1, 1], [-3, 1, 0]];
    let shallow = '', tiles = '';
    for (const [q, r, el] of land) { const p = xy(q, r); shallow += `<polygon points="${hexPts(13.6, p.x, p.y)}"/>`; tiles += at(q, r, tile(el, q * 7 + r * 3 + 11)); }
    const lh = xy(4, -2);
    const beam = `<g transform="translate(${lh.x} ${lh.y + 2 - 12.8})"><g class="beam"><path d="M0 0 L34 -6 L34 6Z" fill="url(#gBeam)"/><path d="M0 0 L34 -6 L34 6Z" fill="url(#gBeam)" opacity=".7" transform="scale(-1 1)"/></g></g>`;
    const boatAt = xy(2, 0);
    const crew = [0, 2].map((s, k) => `<g transform="translate(${SEATS[k * 2]} -.6)"><g class="bob${k ? '2' : ''}">${islander(s, 0)}</g></g>`).join('');
    return `<svg class="scene" viewBox="-92 -44 184 94" aria-hidden="true">` +
      `<defs><radialGradient id="scSea" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#1b6676" stop-opacity=".55"/><stop offset="1" stop-color="#0b3343" stop-opacity="0"/></radialGradient></defs>` +
      `<ellipse cx="0" cy="2" rx="96" ry="40" fill="url(#scSea)"/>${sea}` +
      `<g transform="translate(-62 -30)">${moon(7)}</g>` +
      `<g fill="#3fb3b0" fill-opacity=".16">${shallow}</g>${tiles}` +
      at(-1, 0, `<g transform="translate(0 -1)">${crab()}</g>`) +
      at(0, -1, `<g transform="translate(0 .8)">${islander(1, 0)}</g>`) +
      at(-2, 1, `<g transform="translate(1.5 .6)">${islander(3, 0)}</g>`) +
      beam + at(4, -2, lighthouse() + `<circle cx="0" cy="-12.8" r="5.6" fill="url(#gLamp)"/>`, '', 2) +
      `<g transform="translate(${boatAt.x + 2} ${boatAt.y + 1.4}) rotate(-24)"><g class="row">${boat()}${crew}</g></g>` +
      at(2, 1, `<g class="bob">${swimmer(0, 0)}</g>`, '', 1) +
      at(1, 2, `<g class="fin"><g transform="translate(-4 2) scale(.95)">${shark()}</g></g>`) +
      at(-4, 2, `<g transform="scale(.9)">${octopus()}</g>`, '', 2) +
      `</svg>`;
  }

  G.MTArt = { PC, defs, scene, token, islander, swimmer, boat, SEATS, shark, octopus, crab, dolphin, palm, rock, tile, reef, lighthouse, backIcon, buoy, wind, moon, dieFace, piece, swatch, hexPts };
})(typeof window !== 'undefined' ? window : globalThis);
