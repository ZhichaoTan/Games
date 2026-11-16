// ===== 沉岛 Moontide · the board: one SVG kept alive between updates; pieces glide to their new places, events add effects =====
(function (G) {
  'use strict';
  const MT = G.MT, A = G.MTArt;
  const S = 10, H = Math.sqrt(3) * S, NS = 'http://www.w3.org/2000/svg';
  const XY = MT.CELLS.map(c => ({ x: 1.5 * S * c.q, y: H * (c.r + c.q / 2) }));
  const f = n => +n.toFixed(2);
  const hexPath = (s, x, y) => { let d = ''; for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; d += (k ? 'L' : 'M') + f(x + s * Math.cos(a)) + ' ' + f(y + s * Math.sin(a)); } return d + 'Z'; };
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // where things sit inside a hex
  const LAND_SLOTS = { 1: [[0, 0.6]], 2: [[-3.8, 0.9], [3.8, 0.9]], 3: [[-4, 2.2], [4, 2.2], [0, -3.4]] };
  const SWIM_ALONE = { 1: [[0, 0]], 2: [[-3.7, 0.4], [3.7, 0.4]], 3: [[-4, 2], [4, 2], [0, -3.4]], 4: [[-4, -2.6], [4, -2.6], [-4, 3], [4, 3]], 5: [[-4.4, -2.6], [4.4, -2.6], [-4.4, 3], [4.4, 3], [0, 0]], 6: [[-5, -2.4], [0, -4], [5, -2.4], [-5, 3], [0, 4.4], [5, 3]] };
  const SAFE_SLOTS = [[-4.3, 1.4], [4.3, 1.4], [-6.3, 2.5], [6.3, 2.5], [-3, 3.5], [3, 3.5], [-7.8, 3.9], [7.8, 3.9], [-5, 4.6], [5, 4.6], [0, 4.4]];
  const SWIM_BOAT = [[-5.2, -5.2], [5.2, -5.2], [0, -6.4], [-7.6, -1.2], [7.6, -1.2], [-6, 5.8], [6, 5.8]];

  function create(host, o) {
    o = o || {};
    const wrap = document.createElement('div'); wrap.className = 'bwrap';
    const zoomer = document.createElement('div'); zoomer.className = 'bzoom';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-101 -118 202 232'); svg.setAttribute('class', 'board'); svg.setAttribute('aria-label', 'board');
    zoomer.appendChild(svg); wrap.appendChild(zoomer); host.appendChild(wrap);
    svg.innerHTML = A.defs() + ['sea', 'shallow', 'tiles', 'reefs', 'lh', 'hl', 'boats', 'cr', 'isl', 'sel', 'fx'].map(k => `<g class="L-${k}"></g>`).join('');
    const L = {}; for (const k of ['sea', 'shallow', 'tiles', 'reefs', 'lh', 'hl', 'boats', 'cr', 'isl', 'sel', 'fx']) L[k] = svg.querySelector('.L-' + k);
    const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
    const place = (el, x, y, extra) => { el.style.transform = `translate(${f(x)}px, ${f(y)}px)${extra || ''}`; };

    // ---------- the sea, the grid and the lighthouses (drawn once) ----------
    let seaD = '', gridD = '';
    for (let i = 0; i < MT.N; i++) { seaD += hexPath(10.4, XY[i].x, XY[i].y); gridD += hexPath(9.55, XY[i].x, XY[i].y); }
    L.sea.innerHTML = `<path d="${seaD}" fill="url(#gSea)"/><path d="${seaD}" fill="url(#pWave)"/>` +
      `<ellipse cx="40" cy="-70" rx="70" ry="48" fill="url(#gMoonGlow)"/>` +
      `<path class="grid" d="${gridD}" fill="none" stroke="#c8f0f4" stroke-opacity=".075" stroke-width=".45"/>` +
      `<g class="glints">${[[-60, -40], [52, 30], [-20, 70], [70, -20], [-75, 40], [18, -88], [-40, 92], [84, 60]].map(([x, y], k) => `<path d="M${x - 2.2} ${y} h4.4" stroke="#e8fbff" stroke-opacity=".5" stroke-width=".5" stroke-linecap="round" style="animation-delay:-${k * 0.9}s"/>`).join('')}</g>`;
    L.lh.innerHTML = MT.CORNERS.map((c, k) => {
      const p = XY[c];
      const ang = Math.atan2(-p.y, -p.x) * 180 / Math.PI;
      return `<g class="lhs" style="transform:translate(${p.x}px,${p.y + 2}px)">` +
        `<g transform="translate(0 -12.8)"><g class="beam" style="animation-delay:-${k * 1.7}s"><path d="M0 0 L27 -5.2 L27 5.2Z" fill="url(#gBeam)"/><path d="M0 0 L27 -5.2 L27 5.2Z" fill="url(#gBeam)" opacity=".7" transform="scale(-1 1)"/></g></g>` +
        A.lighthouse() + `<circle class="lamp" cx="0" cy="-12.8" r="5.6" fill="url(#gLamp)"/>` +
        `<g class="lhdir" data-a="${f(ang)}"></g></g>`;
    }).join('');

    // ---------- live pieces ----------
    const els = { tiles: new Map(), reefs: new Map(), boats: new Map(), isl: new Map(), cr: new Map() };
    const heading = new Map();   // boat id → degrees, from its last move
    let V = null, lastN = -1, ghosts = 0;
    const lateIds = new Set();   // pieces that just came out from under a tile: they appear once the tile has flipped

    function tileEl(i, el) {
      const g = mk('g', { class: 'tile', 'data-c': i }, L.tiles);
      g.innerHTML = `<g class="face">${A.tile(el, i)}</g>`;
      place(g, XY[i].x, XY[i].y);
      return g;
    }
    function boatPos(v, b) {
      if (!b.dock) return { x: XY[b.at].x, y: XY[b.at].y + 1.4, s: 1 };
      // tied up at a lighthouse: small, beside the rock
      const docked = v.boats.filter(y => y.dock && y.at === b.at).sort((a, c) => a.id - c.id);
      const k = docked.indexOf(b), p = XY[b.at];
      const inward = Math.atan2(-p.y, -p.x);
      const a = inward + (k % 2 ? -1 : 1) * (1.15 + 0.42 * (k >> 1));
      return { x: p.x + 10.5 * Math.cos(a), y: p.y + 3 + 8 * Math.sin(a), s: 0.55 };
    }
    // where each islander goes
    function islPos(v) {
      const out = new Map(), by = new Map();
      const add = (key, x) => { if (!by.has(key)) by.set(key, []); by.get(key).push(x); };
      for (const x of v.isl) {
        if (x.st === 'land') add('L' + x.at, x);
        else if (x.st === 'boat') add('B' + x.b, x);
        else if (x.st === 'swim') add('W' + x.at, x);
        else if (x.st === 'safe') add('H' + x.at, x);
      }
      for (const [key, xs] of by) {
        xs.sort((a, b) => a.id - b.id);
        const t = key[0], id = +key.slice(1);
        if (t === 'L') { const sl = LAND_SLOTS[Math.min(3, xs.length)] || LAND_SLOTS[3]; xs.forEach((x, k) => { const s = sl[k % sl.length]; out.set(x.id, { x: XY[id].x + s[0], y: XY[id].y + s[1], m: 'land' }); }); }
        else if (t === 'B') {
          const b = v.boats.find(y => y.id === id); if (!b) continue;
          const p = boatPos(v, b), h = (heading.get(b.id) || 0) * Math.PI / 180;
          xs.forEach((x, k) => { const sx = A.SEATS[k] * p.s; out.set(x.id, { x: p.x + sx * Math.cos(h), y: p.y - 0.6 + sx * Math.sin(h), m: 'boat' }); });
        } else if (t === 'W') {
          const hasBoat = v.boats.some(b => !b.dock && b.at === id);
          const sl = hasBoat ? SWIM_BOAT : (SWIM_ALONE[xs.length] || SWIM_ALONE[6]);
          xs.forEach((x, k) => { const s = sl[k % sl.length]; out.set(x.id, { x: XY[id].x + s[0], y: XY[id].y + s[1], m: 'swim' }); });
        } else {
          // safe in a lighthouse: standing on its rock, either side of the tower
          const p = XY[id];
          xs.forEach((x, k) => { const s = SAFE_SLOTS[Math.min(k, SAFE_SLOTS.length - 1)]; out.set(x.id, { x: p.x + s[0], y: p.y + 2 + s[1], m: 'safe' }); });
        }
      }
      return out;
    }
    function crPos(v, c) {
      const p = XY[c.at];
      if (c.k === 'crab') return { x: p.x, y: p.y };
      const others = v.cr.filter(y => y.at === c.at && y.k !== 'crab').sort((a, b) => a.id - b.id);
      const busy = v.boats.some(b => !b.dock && b.at === c.at) || v.isl.some(x => x.st === 'swim' && x.at === c.at);
      const k = others.indexOf(c);
      if (others.length === 1 && !busy) return { x: p.x, y: p.y };
      const sl = busy ? [[0, 5.4], [-6.4, 4.6], [6.4, 4.6]] : [[-4, 0], [4, 0.6], [0, -4]];
      const s = sl[k % sl.length];
      return { x: p.x + s[0], y: p.y + s[1], sm: busy };
    }

    function render(v, ui) {
      ui = ui || {};
      const prev = V; V = v;
      const me = v.me;
      // tiles
      for (let i = 0; i < MT.N; i++) {
        const land = v.k[i] === 'L';
        const e = els.tiles.get(i);
        if (land && !e) els.tiles.set(i, tileEl(i, v.el[i]));
        else if (!land && e) { e.remove(); els.tiles.delete(i); }
      }
      // the shallows and surf round the island
      const landKey = v.k.join('');
      if (render.landKey !== landKey) {
        render.landKey = landKey;
        let sh = '', fo = '';
        for (let i = 0; i < MT.N; i++) if (v.k[i] === 'L') { sh += hexPath(14.2, XY[i].x, XY[i].y); fo += hexPath(11.7, XY[i].x, XY[i].y); }
        L.shallow.innerHTML = sh ? `<path d="${sh}" fill="#3fb3b0" fill-opacity=".16"/><path d="${fo}" fill="#e9fbff" fill-opacity=".34" class="surf"/>` : '';
      }
      // reefs
      for (let i = 0; i < MT.N; i++) {
        const isR = v.k[i] === 'F', e = els.reefs.get(i);
        if (isR && !e) { const g = mk('g', { class: 'reef' + (lateIds.has('r' + i) ? ' late' : '') }, L.reefs); g.innerHTML = A.reef(i); place(g, XY[i].x, XY[i].y); els.reefs.set(i, g); }
        else if (!isR && e) { e.remove(); els.reefs.delete(i); }
      }
      // boats
      const bIds = new Set(v.boats.map(b => b.id));
      for (const [id, e] of els.boats) if (!bIds.has(id) && !e.ghost) { e.g.remove(); els.boats.delete(id); }
      for (const b of v.boats) {
        let e = els.boats.get(b.id);
        if (!e) {
          const g = mk('g', { class: 'boat' + (lateIds.has('b' + b.id) ? ' late' : prev ? ' pop' : '') }, L.boats);
          const inner = mk('g', { class: 'hull' }, g); inner.innerHTML = A.boat();
          e = { g, inner }; els.boats.set(b.id, e);
          if (!heading.has(b.id)) heading.set(b.id, b.dock ? 0 : (b.id * 47) % 360 > 180 ? 180 : 0);
        }
        const p = boatPos(v, b);
        place(e.g, p.x, p.y, ` scale(${p.s})`);
        e.inner.style.transform = `rotate(${heading.get(b.id) || 0}deg)`;
        e.g.classList.toggle('docked', !!b.dock);
      }
      // creatures
      const cIds = new Set(v.cr.map(c => c.id));
      for (const [id, e] of els.cr) if (!cIds.has(id) && !e.ghost) { e.g.remove(); els.cr.delete(id); }
      for (const c of v.cr) {
        let e = els.cr.get(c.id);
        if (!e) {
          const g = mk('g', { class: 'cr cr-' + c.k + (lateIds.has('c' + c.id) ? ' late' : prev ? ' pop' : '') }, L.cr);
          const inner = mk('g', { class: 'body' }, g);
          inner.innerHTML = c.k === 'shark' ? A.shark() : c.k === 'oct' ? A.octopus() : A.crab();
          e = { g, inner }; els.cr.set(c.id, e);
        }
        const p = crPos(v, c);
        if (!e.anim) place(e.g, p.x, p.y, p.sm ? ' scale(.82)' : '');
        e.g.classList.toggle('dim', !!(ui.glow && ui.glow.c && ui.glow.c.length && !ui.glow.c.includes(c.id)));
      }
      // islanders
      const pos = islPos(v);
      for (const [id, e] of els.isl) if (!pos.has(id) && !e.ghost) { e.g.remove(); els.isl.delete(id); }
      for (const x of v.isl) {
        const p = pos.get(x.id); if (!p) continue;
        let e = els.isl.get(x.id);
        const num = x.v || 0;
        const look = p.m === 'swim' ? 'swim' : 'tok';
        if (!e) { const g = mk('g', { class: 'isl s' + x.s + (prev ? ' pop' : '') }, L.isl); e = { g, look: '', num: -1 }; els.isl.set(x.id, e); }
        if (e.look !== look || e.num !== num) {
          e.g.innerHTML = look === 'swim' ? A.swimmer(x.s, num) : A.islander(x.s, num);
          e.look = look; e.num = num;
        }
        if (!e.anim) place(e.g, p.x, p.y, p.m === 'safe' ? ' scale(.7)' : p.m === 'boat' ? ' scale(.92)' : '');
        e.g.classList.toggle('mine', x.s === me);
        e.g.classList.toggle('safe', p.m === 'safe');
      }
      lateIds.clear();
      // highlights: where the selected piece can go, which tiles can sink
      let hl = '';
      if (ui.sinkable) for (const i of ui.sinkable) hl += `<path class="hl-sink${ui.pick === i ? ' on' : ''}" d="${hexPath(9.2, XY[i].x, XY[i].y)}"/>`;
      if (ui.targets) for (const t of ui.targets) {
        const i = typeof t === 'number' ? t : t.c, k = typeof t === 'number' ? '' : t.k || '';
        hl += `<g class="hl-tgt ${k}" style="transform:translate(${XY[i].x}px,${XY[i].y}px)"><path d="${hexPath(8.8, 0, 0)}"/><circle r="1.7"/></g>`;
      }
      if (ui.place) for (const i of ui.place) hl += `<g class="hl-place" style="transform:translate(${XY[i].x}px,${XY[i].y}px)"><path d="${hexPath(8.6, 0, 0)}"/></g>`;
      // pieces you can pick up now glow softly
      if (ui.glow) {
        for (const id of ui.glow.i || []) { const p = pos.get(id); if (p) hl += `<circle class="hl-glow" cx="${f(p.x)}" cy="${f(p.y)}" r="4.9"/>`; }
        for (const id of ui.glow.b || []) { const b = v.boats.find(y => y.id === id); if (b) { const p = boatPos(v, b); hl += `<ellipse class="hl-glow" cx="${f(p.x)}" cy="${f(p.y)}" rx="${f(10 * p.s)}" ry="${f(5.4 * p.s)}"/>`; } }
        for (const id of ui.glow.c || []) { const c = v.cr.find(y => y.id === id); if (c) { const p = crPos(v, c); hl += `<circle class="hl-glow cr" cx="${f(p.x)}" cy="${f(p.y)}" r="8.2"/>`; } }
      }
      L.hl.innerHTML = hl;
      // the selected piece: a ring that follows it
      let sel = '';
      if (ui.sel) {
        let p = null;
        if (ui.sel.p === 'i') p = pos.get(ui.sel.id);
        else if (ui.sel.p === 'b') { const b = v.boats.find(y => y.id === ui.sel.id); if (b) p = boatPos(v, b); }
        else if (ui.sel.p === 'c') { const c = v.cr.find(y => y.id === ui.sel.id); if (c) p = crPos(v, c); }
        if (p) sel = `<g class="selring ${ui.sel.p}" style="transform:translate(${f(p.x)}px,${f(p.y)}px)"><circle r="${ui.sel.p === 'i' ? 4.6 : 8.4}"/></g>`;
      }
      L.sel.innerHTML = sel;
    }

    // ---------- effects ----------
    const fxQ = [];
    function fxEl(html, x, y, cls, ms) {
      const g = mk('g', { class: 'fx ' + (cls || '') }, L.fx);
      g.innerHTML = html; place(g, x, y);
      setTimeout(() => g.remove(), ms || 1400);
      return g;
    }
    const splash = (x, y, big) => fxEl(`<circle r="2" class="ring"/><circle r="2" class="ring r2"/>${[0, 1, 2, 3, 4].map(k => `<circle class="drop" r=".55" style="--a:${k * 72 + 20}deg"/>`).join('')}`, x, y, 'splash' + (big ? ' big' : ''), 1100);
    const sparkle = (x, y) => fxEl(`${[0, 1, 2, 3, 4, 5].map(k => `<path class="ray" d="M0 -2.6 L.5 -.5 L2.6 0 L.5 .5 L0 2.6 L-.5 .5 L-2.6 0 L-.5 -.5Z" style="--a:${k * 60}deg"/>`).join('')}`, x, y, 'sparkle', 1200);
    function label(text, x, y, tone) {
      if (!text) return;
      fxEl(`<g class="lab ${tone || ''}"><rect x="${-text.length * 1.75 - 3}" y="-4.4" width="${text.length * 3.5 + 6}" height="7.6" rx="3.8"/><text y="1.4" text-anchor="middle">${text.replace(/[<&]/g, '')}</text></g>`, x, y - 9, 'float', 1900);
    }
    function animPath(el, path, ms, extra, done) {
      if (!el || path.length < 2 || reduced()) { if (done) done(); return; }
      const frames = path.map(i => ({ transform: `translate(${XY[i].x}px, ${XY[i].y}px)${extra || ''}` }));
      el.anim = true;
      try {
        const an = el.g.animate(frames, { duration: ms * (path.length - 1), easing: 'ease-in-out' });
        an.onfinish = () => { el.anim = false; if (done) done(); if (V) render(V, last.ui); };
      } catch (e) { el.anim = false; if (done) done(); }
    }
    // before the new state is drawn: take hold of anything that's about to vanish so it can go out in style
    function pre(e) {
      if (e.k === 'sink') {
        const t = els.tiles.get(e.at);
        if (t) { els.tiles.delete(e.at); ghostTile(t, e); }
        if (e.boat) lateIds.add('b' + e.boat);
        if (e.cr) lateIds.add('c' + e.cr);
        if (e.back === 'reef') lateIds.add('r' + e.at);
      } else if (e.k === 'cr' && e.grab) {
        const b = els.boats.get(e.grab);
        if (b) { b.ghost = true; els.boats.delete(e.grab); setTimeout(() => { b.g.classList.add('sunk'); }, 420); setTimeout(() => b.g.remove(), 1500); }
      } else if (e.k === 'cr' && e.eat && e.eat.length) {
        for (const id of e.eat) { const x = els.isl.get(id); if (x) { x.ghost = true; els.isl.delete(id); const d = SPEED_MS * Math.max(1, e.path.length - 1); setTimeout(() => x.g.classList.add('eaten'), d); setTimeout(() => x.g.remove(), d + 900); } }
      } else if (e.k === 'step' && e.p === 'b') {
        const a = XY[e.from], b = XY[e.to];
        let deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        const old = heading.get(e.id) || 0;
        while (deg - old > 180) deg -= 360; while (deg - old < -180) deg += 360;
        heading.set(e.id, deg);
      }
    }
    const SPEED_MS = 300;
    function post(e, v) {
      const xy = i => XY[i];
      if (e.k === 'sink') {
        const p = xy(e.at);
        setTimeout(() => splash(p.x, p.y, true), 900);
        if (o.onSound) o.onSound('sink', e);
      } else if (e.k === 'step') {
        const p = xy(e.to);
        if (e.res === 'swim') splash(p.x, p.y);
        if (e.res === 'safe' || e.res === 'dock') { setTimeout(() => sparkle(p.x, p.y - 6), 250); flashLamp(e.to); }
      } else if (e.k === 'cr') {
        const el = els.cr.get(e.id), end = xy(e.path[e.path.length - 1]);
        const extra = '';
        animPath(el, e.path, SPEED_MS, extra, () => {
          if (e.eat && e.eat.length) { fxEl(jaws(), end.x, end.y - 1, 'chomp', 900); splash(end.x, end.y, true); }
          if (e.spared && e.spared.length) fxEl(`<g transform="scale(.6)">${A.buoy()}</g>`, end.x, end.y - 6, 'pop-fx', 1300);
          if (e.grab) { const g = xy(e.gat); fxEl(tentacles(), g.x, g.y, 'grab', 1300); setTimeout(() => splash(g.x, g.y, true), 500); }
          if (e.pushed && e.pushed.length) { const pp = xy(e.push); setTimeout(() => splash(pp.x, pp.y, true), 250); fxEl(`<g class="dust">${[0, 1, 2, 3].map(k => `<circle r="1.4" style="--a:${k * 90 + 45}deg"/>`).join('')}</g>`, end.x, end.y + 2, 'puff', 900); }
        });
      } else if (e.k === 'dol') {
        const x = els.isl.get(e.id);
        if (x && e.path.length > 1) {
          animPath(x, e.path, 280, '');
          const d = fxEl(`<g class="dolph">${A.dolphin()}</g>`, xy(e.path[0]).x, xy(e.path[0]).y + 2, 'dolfx', 280 * e.path.length + 400);
          try { d.animate(e.path.map(i => ({ transform: `translate(${xy(i).x}px, ${xy(i).y + 2.5}px)` })), { duration: 280 * (e.path.length - 1), easing: 'ease-in-out', fill: 'forwards' }); } catch (er) {}
        }
        const end = xy(e.path[e.path.length - 1]);
        if (e.res === 'safe') { setTimeout(() => sparkle(end.x, end.y - 6), 280 * e.path.length); flashLamp(e.path[e.path.length - 1]); }
      } else if (e.k === 'place' || e.k === 'boat') {
        const p = xy(e.at); splash(p.x, p.y);
      }
    }
    function flashLamp(cell) {
      const k = MT.CORNERS.indexOf(cell); if (k < 0) return;
      const g = L.lh.children[k]; if (!g) return;
      g.classList.remove('flash'); void g.getBBox; g.classList.add('flash');
      setTimeout(() => g.classList.remove('flash'), 1300);
    }
    const jaws = () => `<g class="jaws"><path d="M-6 -1 Q0 -7 6 -1 L4.6 -1.6 L3.4 -.2 L2.2 -1.8 L1 -.2 L-.2 -1.9 L-1.4 -.2 L-2.6 -1.8 L-3.8 -.2 L-4.8 -1.6Z" fill="#f4f7f9" stroke="#1b2a33" stroke-width=".4"/><path d="M-6 1 Q0 7 6 1 L4.6 1.6 L3.4 .2 L2.2 1.8 L1 .2 L-.2 1.9 L-1.4 .2 L-2.6 1.8 L-3.8 .2 L-4.8 1.6Z" fill="#f4f7f9" stroke="#1b2a33" stroke-width=".4"/></g>`;
    const tentacles = () => `<g class="tent">${[-1, 1].map(sx => [0, 1].map(k => `<path d="M${sx * (3 + k * 3)} 6 C${sx * (5 + k * 3)} 1 ${sx * (1 + k * 2)} -3 ${sx * (4 + k * 2)} -7" fill="none" stroke="#b5479a" stroke-width="${1.8 - k * 0.4}" stroke-linecap="round"/>`).join('')).join('')}</g>`;
    function ghostTile(t, e) {
      ghosts++;
      t.classList.add('ghost');
      L.fx.appendChild(t);   // above the pieces while it flips
      const face = t.querySelector('.face');
      const back = mk('g', { class: 'back' }, t);
      back.innerHTML = `<polygon points="${A.hexPts(10)}" fill="url(#gBack)" stroke="#d3ac63" stroke-width=".6"/><polygon points="${A.hexPts(8.4)}" fill="none" stroke="#d3ac63" stroke-opacity=".35" stroke-width=".35"/><g transform="scale(.82)">${A.backIcon(e.back || 'none')}</g>`;
      back.style.opacity = '0';
      const quick = reduced();
      const p = XY[e.at];
      if (quick) { setTimeout(() => t.remove(), 300); return; }
      try {
        t.animate([{ transform: `translate(${p.x}px,${p.y}px)` }, { transform: `translate(${p.x - 0.7}px,${p.y}px)` }, { transform: `translate(${p.x + 0.7}px,${p.y}px)` }, { transform: `translate(${p.x - 0.5}px,${p.y}px)` }, { transform: `translate(${p.x}px,${p.y}px)` }], { duration: 260 });
        setTimeout(() => {
          const a = t.animate([{ transform: `translate(${p.x}px,${p.y}px) scale(1,1)` }, { transform: `translate(${p.x}px,${p.y - 3}px) scale(0.02,1.08)` }], { duration: 230, easing: 'ease-in', fill: 'forwards' });
          a.onfinish = () => {
            face.style.opacity = '0'; back.style.opacity = '1';
            t.animate([{ transform: `translate(${p.x}px,${p.y - 3}px) scale(0.02,1.08)` }, { transform: `translate(${p.x}px,${p.y - 3}px) scale(1.12,1.12)` }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
            if (o.label) label(o.label(e.back), p.x, p.y - 3, e.back);
          };
        }, 260);
        setTimeout(() => {
          t.animate([{ transform: `translate(${p.x}px,${p.y - 3}px) scale(1.12,1.12)`, opacity: 1 }, { transform: `translate(${p.x}px,${p.y + 1}px) scale(.55,.55)`, opacity: 0 }], { duration: 520, easing: 'ease-in', fill: 'forwards' });
        }, 1400);
      } catch (er) { /* no Web Animations: just drop it */ }
      setTimeout(() => { t.remove(); ghosts--; }, 1950);
    }

    // ---------- updates from the app ----------
    const last = { ui: null };
    function update(v, ui) {
      last.ui = ui;
      const fresh = (v.ev || []).filter(e => e.n > lastN);
      const animate = lastN >= 0 && fresh.length && fresh.length <= 10 && (fresh[0].n === lastN + 1 || fresh.length <= 3);
      if (animate) for (const e of fresh) pre(e);
      render(v, ui);
      if (animate) for (const e of fresh) post(e, v);
      if (v.ev && v.ev.length) lastN = Math.max(lastN, v.ev[v.ev.length - 1].n);
      else if (lastN < 0) lastN = 0;
    }
    function reset() {
      for (const m of Object.values(els)) { for (const e of m.values()) (e.g || e).remove(); m.clear(); }
      L.fx.innerHTML = ''; L.hl.innerHTML = ''; L.sel.innerHTML = ''; heading.clear(); lastN = -1; V = null; render.landKey = '';
    }

    // ---------- taps, pinch to zoom, drag to pan ----------
    let zs = 1, zx = 0, zy = 0;
    const applyZoom = () => { zoomer.style.transform = `translate(${f(zx)}px, ${f(zy)}px) scale(${f(zs)})`; wrap.classList.toggle('zoomed', zs > 1.02); if (o.onZoom) o.onZoom(zs); };
    function clampPan() {
      const r = wrap.getBoundingClientRect(), w = r.width, h = r.height;
      zx = Math.min(0, Math.max(w - w * zs, zx)); zy = Math.min(0, Math.max(h - h * zs, zy));
    }
    function zoomAt(px, py, ns) {
      ns = Math.max(1, Math.min(2.6, ns));
      zx = px - (px - zx) * ns / zs; zy = py - (py - zy) * ns / zs; zs = ns;
      clampPan(); applyZoom();
    }
    const pts = new Map();
    let down = null, pinch = null, moved = false;
    wrap.addEventListener('pointerdown', ev => {
      wrap.setPointerCapture && wrap.setPointerCapture(ev.pointerId);
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size === 1) { down = { x: ev.clientX, y: ev.clientY, zx, zy, t: Date.now() }; moved = false; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], r = wrap.getBoundingClientRect();
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: zs, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
        moved = true;
      }
    });
    wrap.addEventListener('pointermove', ev => {
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        zoomAt(pinch.cx, pinch.cy, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d));
      } else if (down && pts.size === 1) {
        const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
        if (Math.hypot(dx, dy) > 9) moved = true;
        if (moved && zs > 1.02) { zx = down.zx + dx; zy = down.zy + dy; clampPan(); applyZoom(); }
      }
    });
    const up = ev => {
      if (!pts.has(ev.pointerId)) return;
      pts.delete(ev.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        if (down && !moved && ev.type === 'pointerup') tapAt(ev.clientX, ev.clientY);
        down = null;
      }
    };
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
    wrap.addEventListener('wheel', ev => { if (!ev.ctrlKey && Math.abs(ev.deltaY) < 30) return; ev.preventDefault(); const r = wrap.getBoundingClientRect(); zoomAt(ev.clientX - r.left, ev.clientY - r.top, zs * (ev.deltaY < 0 ? 1.18 : 1 / 1.18)); }, { passive: false });
    function cellFromClient(cx, cy) {
      const m = svg.getScreenCTM(); if (!m) return -1;
      const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
      const p = pt.matrixTransform(m.inverse());
      const q = (2 / 3 * p.x) / S, r = (-1 / 3 * p.x + Math.sqrt(3) / 3 * p.y) / S;
      let rq = Math.round(q), rr = Math.round(r), rs = Math.round(-q - r);
      const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs + q + r);
      if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
      return MT.cellAt(rq, rr);
    }
    function tapAt(cx, cy) { const c = cellFromClient(cx, cy); if (c >= 0 && o.onTap) o.onTap(c); }
    // where a cell is on screen (tests, and pointing things out)
    function clientXY(i) {
      const m = svg.getScreenCTM(); const pt = svg.createSVGPoint(); pt.x = XY[i].x; pt.y = XY[i].y;
      const p = pt.matrixTransform(m); return { x: p.x, y: p.y };
    }
    return {
      update, reset, svg, wrap, clientXY, cellFromClient, XY,
      zoomIn() { const r = wrap.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, zs > 1.5 ? 1 : 1.8); },
      zoomOut() { zs = 1; zx = 0; zy = 0; applyZoom(); },
      focus(i) {   // pan so a cell is in view when zoomed
        if (zs <= 1.02) return;
        const r = wrap.getBoundingClientRect(), p = clientXY(i);
        const lx = p.x - r.left, ly = p.y - r.top;
        if (lx > 30 && lx < r.width - 30 && ly > 30 && ly < r.height - 30) return;
        zx += r.width / 2 - lx; zy += r.height / 2 - ly; clampPan(); applyZoom();
      },
      get zoom() { return zs; },
    };
  }
  G.MTBoard = { create, XY };
})(typeof window !== 'undefined' ? window : globalThis);
