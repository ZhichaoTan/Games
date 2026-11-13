// ===== 牌桌界面：布局、牌的移动动画、操作按钮、特效、结算面板 =====
// 每张牌是一个常驻的 .t 元素（按 id），每次刷新算出它该在哪，用 transform 过渡过去，动画就自然有了。
(function (G) {
  'use strict';
  const MJ = G.MJ, AI = G.MJAI, ART = G.MJArt, AV = G.Art, I18 = G.MJI18N;
  const SND = G.MJSound || { play() {}, say() {}, vib() {} };
  const { TY, SU } = MJ;
  const T = I18.t;
  const QCOL = ART.QUE_COL;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const div = (cls, html) => { const d = document.createElement('div'); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
  const face = t => (t >= 0 ? `<svg viewBox="0 0 60 80"><use href="#t${t}"/></svg>` : '');
  const mini = (t, cls) => `<span class="mt2${cls ? ' ' + cls : ''}">${t >= 0 ? face(t) : ''}</span>`;
  function avSvg(p, s) {
    if (!p) return '';
    if (p.bot) return `<svg viewBox="0 0 100 100" style="color:${AV.BOT_EYES[s % 4]}"><use href="#bq${clamp((p.lv || 2) - 1, 0, 3)}"/></svg>`;
    return `<svg viewBox="0 0 100 100"><use href="#av${clamp(p.av | 0, 0, AV.AVATARS.length - 1)}"/></svg>`;
  }
  const fmt = n => (n > 0 ? '+' + n : '' + n);
  const HOW = k => T('how')[k] || '';
  // 胡牌提示用的小图标：点炮 = 炸弹，自摸 = 自己摸上来的一张牌带金光
  const IC = {
    bomb: '<svg class="ic" viewBox="0 0 32 32"><path d="M21.5 9.5q2.6-4.6 6.3-3.4" fill="none" stroke="#d9b072" stroke-width="2" stroke-linecap="round"/><rect x="16.6" y="7.4" width="7.4" height="5.6" rx="1.4" transform="rotate(42 20.3 10.2)" fill="#5d666e" stroke="#15181b" stroke-width="1.2"/><circle cx="14" cy="19" r="10.2" fill="#2a2f35" stroke="#0e1013" stroke-width="1.5"/><ellipse cx="10.4" cy="15" rx="3.4" ry="2.4" transform="rotate(-35 10.4 15)" fill="#fff" opacity=".38"/><path d="M28.4 1.2l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1z" fill="#ffd34a"/><circle cx="28.4" cy="5.2" r="1.3" fill="#fff6c8"/></svg>',
    zimo: '<svg class="ic" viewBox="0 0 32 32"><rect x="5.5" y="9" width="15.5" height="20.5" rx="3.2" fill="#fffaf0" stroke="#7a4a0c" stroke-width="1.6"/><rect x="8.3" y="12" width="9.9" height="14.5" rx="1.6" fill="none" stroke="#e0a339" stroke-width="1.4"/><circle cx="13.25" cy="19.25" r="2.6" fill="#e0503f"/><path d="M24.6 .8l1.7 4.7 4.7 1.7-4.7 1.7-1.7 4.7-1.7-4.7-4.7-1.7 4.7-1.7z" fill="#ffd34a" stroke="#7a4a0c" stroke-width=".9" stroke-linejoin="round"/></svg>',
  };
  // 这把胡是不是别人放的（点炮、抢杠、点杠花），是的话返回放的人
  const feederOf = w => (w && w.from >= 0 && w.from !== w.s ? w.from : -1);

  // 安全区（刘海、底部横条）
  let probe = null;
  function safe() {
    if (!probe) {
      probe = div('');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.appendChild(probe);
    }
    const cs = getComputedStyle(probe);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  }

  function create(opt) {
    const root = opt.root;
    const onAct = opt.onAct || (() => {});
    const prefs = Object.assign({ hints: true }, opt.prefs || {});
    const els = new Map();          // key → { el, t, pose, tf, cls }
    const lastPos = new Map();      // key → 上一次的位置 {x,y,k,r}
    const leaving = new Set();      // 正在飞走、等会儿再删的
    let v = null, me = 0, Gm = null, lastEv = 0, roundKey = '', fresh = true;
    let sel = null, swapSel = [], swapFor = '', queRec = -1, hintCache = null, hintKey = '';
    let selfSkip = '', showWaits = false, drag = null, endTimer = 0, gotIds = new Set(), gotUntil = 0;
    let tsMode = false, tsTake = null, tsGive = null;   // 2v2：正在挑跟队友换的牌

    // ---------- 固定的元素 ----------
    root.innerHTML = '';
    const felt = div('felt-ring'); root.appendChild(felt);
    const compass = div('compass', '<div class="lt"></div><div class="lt"></div><div class="lt"></div><div class="lt"></div><div class="left"><b>0</b></div><div class="clock"></div>');
    root.appendChild(compass);
    const lights = [...compass.querySelectorAll('.lt')];
    const plates = [0, 1, 2, 3].map(() => { const d = div('seat'); root.appendChild(d); return d; });
    const ohands = [0, 1, 2, 3].map(rel => { const d = div('ohand ' + (rel === 2 ? 'top' : rel ? 'side' + (rel === 1 ? ' r' : '') : '')); root.appendChild(d); return d; });
    const stages = [0, 1, 2, 3].map(() => { const d = div('ohand down'); root.appendChild(d); return d; });
    const huLay = div('hulay'); huLay.hidden = true; root.appendChild(huLay);
    const acts = div('acts'); root.appendChild(acts);
    const gopts = div('gopts'); gopts.hidden = true; root.appendChild(gopts);
    const tip = div('tip'); tip.hidden = true; root.appendChild(tip);
    const banner = div('banner'); banner.hidden = true; root.appendChild(banner);
    const status = div('status'); status.hidden = true; root.appendChild(status);
    const tingChip = div('tingchip'); tingChip.hidden = true; root.appendChild(tingChip);
    const autoBar = div('autobar', '<span></span><button></button>'); autoBar.hidden = true; root.appendChild(autoBar);
    const turnGlow = div('turnglow'); turnGlow.hidden = true; root.appendChild(turnGlow);
    const tsPanel = div('tspanel'); tsPanel.hidden = true; root.appendChild(tsPanel);
    const mateTray = div('matetray'); mateTray.hidden = true; root.appendChild(mateTray);
    autoBar.querySelector('button').onclick = () => onAct({ k: '_auto', on: false });
    tingChip.onclick = () => { showWaits = !showWaits; renderTip(); };

    const relOf = s => (s - me + 4) % 4;
    const suitMark = q => I18.lang === 'en' ? `<svg class="qi"><use href="#q${q}"/></svg>` : T('suitS')[q];
    const seatOf = rel => (rel + me) % 4;
    const name = s => (v && v.seats[s] ? v.seats[s].name : '');

    // ======================= 几何 =======================
    // 牌河一行占多宽：牌本身 82 + 侧面厚度 11（60 宽的牌），再留一点缝，不然两行会叠在一起
    const RW = 1.6, RH = 1.6;
    function computeGeom(need) {
      const W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight;
      const sf = safe();
      const g = { W, H, sf };
      const port = H >= W * 1.05;
      // 电脑大屏：牌放大一点，左右两家往中间收，别把四家摊到屏幕四个角
      const big = !port && W >= 1000 && H >= 640;
      const side = big ? Math.max(0, (W - H * 1.2) / 2) : 0;
      const L = Math.max(6, sf.l + 4) + side, Rr = Math.max(6, sf.r + 4) + side;
      g.big = big;
      // 2v2：自己和队友的名字牌下面多一行"可换几次"，竖屏时给它让点地方
      const team = !!(v && v.rules && v.rules.team);
      g.port = port; g.L = L; g.Rr = Rr; g.team = team;
      g.tbH = sf.t + 44;
      g.A0 = clamp(Math.round(Math.min(W, H) * 0.1), 34, big ? 58 : 48);
      g.A = clamp(Math.round(Math.min(W, H) * 0.088), 30, big ? 52 : 44);
      const bot = H - Math.max(sf.b, 4) - 6;
      if (port) {
        g.hw = Math.min(54, (W - L - Rr) / 14.4);
        g.hh = g.hw * 82 / 60;
        g.handY = bot - g.hh / 2; g.handTop = bot - g.hh;
        g.handL = L; g.handR = W - Rr;
        g.plate0 = { x: L + g.A0 / 2 + 2, y: g.handTop - 18 - g.A0 / 2 - (team ? 16 : 0) };
        g.topY = g.tbH + 4 + g.A / 2;
        g.midTop = g.tbH + g.A + 14;
        g.midBot = g.plate0.y - g.A0 / 2 - 6;
      } else {
        g.hw = Math.min(big ? 62 : 50, (W - L - Rr - g.A0 - 90) / 14.4, (H * (big ? 0.12 : 0.13)) * 60 / 82);
        g.hh = g.hw * 82 / 60;
        g.handY = bot - g.hh / 2; g.handTop = bot - g.hh;
        g.handL = L + g.A0 + 84; g.handR = W - Rr;
        g.plate0 = { x: L + g.A0 / 2 + 2, y: g.handY - 6 };
        g.topY = g.tbH + g.A / 2 - 4;
        g.midTop = g.tbH + g.A / 2 + 18;
        g.midBot = g.handTop - 16;
      }
      g.hk = g.hw / 60;
      g.mw = g.hw * 0.78;                       // 自己碰杠的牌宽
      // 对手的牌
      g.tw = Math.min(g.hw * 0.62, port ? 21 : big ? 32 : 26);   // 对家立着的牌背
      g.colW = port ? Math.max(g.A, 34) + 4 : Math.max(g.A + 8, 56);
      g.colL = L + g.colW / 2; g.colR = W - Rr - g.colW / 2;
      if (port) {
        g.sidePlateY = g.topY + g.A + 44 + (team ? 6 : 0);
        g.stackTop = g.sidePlateY + g.A / 2 + 66;
      } else {
        // 横屏：左右两家的头像放在上面两个角，牌从头像下面往下排
        g.sidePlateY = g.tbH + g.A / 2 + 6;
        g.stackTop = g.sidePlateY + Math.max(g.A / 2, 27) + 14;   // 名字牌（头像旁边）下面
        const tw = g.tw, wMax = 14.5 * tw + 40;
        g.topRow = { l: W / 2 - wMax / 2, r: W / 2 + wMax / 2 };
      }
      // 矮屏横放：碰杠另起一列，靠里
      g.two = !port && g.midBot - g.stackTop < 330;
      g.innerW = g.two ? Math.round(Math.min(g.colW, 34)) : 0;
      // 中间：四家牌河 + 罗盘
      const cx0 = L + g.colW + g.innerW + 6, cx1 = W - Rr - g.colW - g.innerW - 6;
      const cy0 = g.midTop + 4, cy1 = g.midBot - 2;
      const Wc = cx1 - cx0, Hc = cy1 - cy0;
      need = need || { tb: [18, 18], sd: [18, 18] };
      let best = null;
      for (let pt = 5; pt <= 12; pt++) for (let ps = 5; ps <= 13; ps++) {
        const rB = Math.max(2, Math.ceil(need.tb[0] / pt)), rT = Math.max(2, Math.ceil(need.tb[1] / pt));
        const rL = Math.max(2, Math.ceil(need.sd[0] / ps)), rR = Math.max(2, Math.ceil(need.sd[1] / ps));
        const wPer = pt + (rL + rR) * RW + 0.6, hPer = ps + (rB + rT) * RH + 0.6;
        const rw = Math.min(Wc / wPer, Hc / hPer, port ? 30 : big ? 40 : 34);
        const sc = rw * (1 - 0.012 * Math.abs(pt - 6) - 0.004 * Math.abs(ps - 9));
        if (!best || sc > best.sc) best = { sc, rw, pt, ps, rB, rT, rL, rR };
      }
      const rw = g.rw = best.rw; g.pt = best.pt; g.ps = best.ps;
      g.rk = rw / 60;
      g.rowH = rw * RH; g.rowW = rw * RW;
      g.cap = { tb: [best.rB * best.pt, best.rT * best.pt], sd: [best.rL * best.ps, best.rR * best.ps] };
      const bw = best.pt * rw, bh = best.ps * rw;
      const usedW = bw + (best.rL + best.rR) * g.rowW, usedH = bh + (best.rB + best.rT) * g.rowH;
      const bx0 = cx0 + (Wc - usedW) / 2 + best.rL * g.rowW, by0 = cy0 + (Hc - usedH) / 2 + best.rT * g.rowH;
      g.box = { x0: bx0, y0: by0, x1: bx0 + bw, y1: by0 + bh, cx: bx0 + bw / 2, cy: by0 + bh / 2, w: bw, h: bh };
      g.gap = rw * 0.2;
      g.cs = clamp(Math.min(bw, bh) * 0.62, 54, 96);
      return g;
    }
    function riverNeed() {
      const R = v && v.R;
      const n = rel => (R ? R.river[seatOf(rel)].length : 0);
      return { tb: [Math.max(18, n(0)), Math.max(18, n(2))], sd: [Math.max(18, n(3)), Math.max(18, n(1))] };
    }
    function ensureGeom(force) {
      const need = riverNeed();
      const W = root.clientWidth, H = root.clientHeight;
      if (!force && Gm && Gm.W === W && Gm.H === H && Gm.team === !!(v && v.rules && v.rules.team) && need.tb[0] <= Gm.cap.tb[0] && need.tb[1] <= Gm.cap.tb[1] && need.sd[0] <= Gm.cap.sd[0] && need.sd[1] <= Gm.cap.sd[1]) return false;
      Gm = computeGeom(need);
      placeStatic();
      return true;
    }
    // 牌河里第 i 张的位置
    function riverPos(rel, i) {
      const g = Gm, b = g.box, rw = g.rw;
      if (rel === 0) { const r = Math.floor(i / g.pt), c = i % g.pt; return { x: b.x0 + (c + 0.5) * rw, y: b.y1 + g.gap + (r + 0.5) * g.rowH - rw * 0.06, r: 0, o: 0 }; }
      if (rel === 2) { const r = Math.floor(i / g.pt), c = i % g.pt; return { x: b.x1 - (c + 0.5) * rw, y: b.y0 - g.gap - (r + 0.5) * g.rowH, r: 0, o: 0 }; }
      if (rel === 1) { const r = Math.floor(i / g.ps), c = i % g.ps; return { x: b.x1 + g.gap + (r + 0.5) * g.rowW, y: b.y1 - (c + 0.5) * rw, r: -90, o: 1 }; }
      const r = Math.floor(i / g.ps), c = i % g.ps; return { x: b.x0 - g.gap - (r + 0.5) * g.rowW, y: b.y0 + (c + 0.5) * rw, r: 90, o: 3 };
    }
    // 各家的几个关键点
    function anchor(rel, what) {
      const g = Gm, b = g.box;
      if (what === 'plate') {
        if (rel === 0) return g.plate0;
        if (g.port) return rel === 2 ? { x: g.L + g.A / 2 + 2, y: g.topY } : { x: rel === 1 ? g.colR : g.colL, y: g.sidePlateY };
        if (rel === 2) return { x: g.topRow.l - 8 - Math.max(g.A, 56) / 2, y: g.topY };
        return { x: rel === 1 ? g.W - g.Rr - g.A / 2 - 2 : g.L + g.A / 2 + 2, y: g.sidePlateY };
      }
      if (what === 'hand') return rel === 0 ? { x: g.W / 2, y: g.handY } : rel === 2 ? { x: g.W / 2 + 20, y: g.topY } : { x: rel === 1 ? g.colR : g.colL, y: g.stackTop + 90 };
      if (what === 'call') return rel === 0 ? { x: b.cx, y: b.y1 + g.rowH * 1.3 } : rel === 2 ? { x: b.cx, y: b.y0 - g.rowH * 1.3 } : { x: rel === 1 ? b.x1 + g.rowW * 1.2 : b.x0 - g.rowW * 1.2, y: b.cy };
      if (what === 'stage') return rel === 0 ? { x: b.cx, y: b.y1 + g.gap + g.rowH * 0.5 } : rel === 2 ? { x: b.cx, y: b.y0 - g.gap - g.rowH * 0.5 } : { x: rel === 1 ? b.x1 + g.gap + g.rowW * 0.5 : b.x0 - g.gap - g.rowW * 0.5, y: b.cy };
      return { x: b.cx, y: b.cy };
    }
    function placeStatic() {
      const g = Gm, b = g.box;
      Object.assign(felt.style, { left: (b.x0 - g.rowW * 2.4) + 'px', top: (b.y0 - g.rowH * 2.4) + 'px', width: (b.w + g.rowW * 4.8) + 'px', height: (b.h + g.rowH * 4.8) + 'px' });
      const cs = g.cs;
      Object.assign(compass.style, { left: (b.cx - cs / 2) + 'px', top: (b.cy - cs / 2) + 'px', width: cs + 'px', height: cs + 'px' });
      const t = Math.max(4, cs * 0.07), Lg = cs * 0.52;
      const pos = [[(cs - Lg) / 2, cs - t - 3, Lg, t], [cs - t - 3, (cs - Lg) / 2, t, Lg], [(cs - Lg) / 2, 3, Lg, t], [3, (cs - Lg) / 2, t, Lg]];
      lights.forEach((l, i) => Object.assign(l.style, { left: pos[i][0] + 'px', top: pos[i][1] + 'px', width: pos[i][2] + 'px', height: pos[i][3] + 'px' }));
      compass.style.fontSize = (cs / 64) + 'em';
      root.style.setProperty('--a', g.A + 'px');
      root.style.setProperty('--a0', g.A0 + 'px');
    }

    // ======================= 牌 =======================
    function tileEl(key, t, pose) {
      const el = div('t');
      el.innerHTML = '<div class="b"></div><div class="f">' + face(pose === 'down' ? -1 : t) + '</div>';
      el.dataset.k = key;
      root.appendChild(el);
      return { el, t: pose === 'down' ? -1 : t, pose: '', tf: '', cls: '' };
    }
    const tfOf = p => `translate(${(p.x - 30).toFixed(1)}px,${(p.y - 41).toFixed(1)}px) rotate(${p.r || 0}deg) scale(${p.k.toFixed(4)})`;

    // 算出所有牌该在哪：返回 Map key → place
    function layoutTiles() {
      const R = v.R, g = Gm, P = new Map();
      if (!R) return P;
      const end = R.phase === 'end';
      const put = (key, t, p) => { p.t = t; P.set(key, p); };
      // 牌河
      for (let s = 0; s < 4; s++) {
        const rel = relOf(s), rv = R.river[s];
        rv.forEach((id, i) => {
          const q = riverPos(rel, i);
          let cls = '';
          if (R.lastDiscard && R.lastDiscard.id === id && i === rv.length - 1) cls += ' last';
          if (id === dropId && Date.now() < dropUntil) cls += ' drop';
          if (R.claimTile && R.claimTile.id === id) cls += ' hl';
          put(String(id), TY(id), { x: q.x, y: q.y, k: g.rk, r: q.r, pose: 'flat', o: q.o, z: 5 + (rel === 2 ? 30 - Math.floor(i / g.pt) : rel === 0 ? Math.floor(i / g.pt) : rel === 3 ? i % g.ps : g.ps - i % g.ps), cls });   // 两边：靠下的牌压住上面那张的厚边，左右才对称
        });
      }
      // 换三张：选好的三张扣在面前
      const stagedMine = R.phase === 'swap' && R.swapPick ? R.swapPick : null;
      if (stagedMine) {
        const a = anchor(0, 'stage');
        stagedMine.forEach((id, j) => put(String(id), TY(id), { x: a.x + (j - 1) * g.rw * 1.02, y: a.y, k: g.rk, r: 0, pose: 'down', o: 0, z: 9 }));
      }
      // 自己
      layoutMine(put, stagedMine);
      // 对手：碰杠、亮出来的牌、胡的牌
      for (let rel = 1; rel < 4; rel++) layoutOpp(rel, put);
      // 抢杠：补杠的那张先摆在碰的上面
      if (R.claimTile && R.claimTile.kind === 'rob') {
        const s = R.claimTile.from, id = R.claimTile.id, mp = P.get('mstack' + s + '_' + TY(id));
        if (mp) put(String(id), TY(id), Object.assign({}, mp, { cls: ' hl', z: mp.z + 2 }));
      }
      return P;
    }
    // 一组碰杠（自己）
    function meldTiles(m, s, basePos, put, o) {
      // o: { w 牌宽, rot, step:{dx,dy}, up:{dx,dy}, pose }
      const ids = m.ids && m.ids.length ? m.ids : null;
      const n = m.k === 'peng' ? 3 : 4;
      const own = s === me;
      for (let j = 0; j < n; j++) {
        const key = ids ? String(ids[j]) : `x${s}_${m.k}_${basePos.i}_${j}`;
        const t = m.t;
        let pose = 'flat';
        if (m.k === 'angang') pose = (j === 3 && (own || t >= 0) && t >= 0) ? 'flat' : 'down';
        const top = j === 3 && !o.line;   // o.line：两边的人杠了就四张排成一列，不叠着放（叠着看着像压住了别的牌）
        const x = basePos.x + (top ? 1 : j) * o.step.dx + (top ? o.up.dx : 0);
        const y = basePos.y + (top ? 1 : j) * o.step.dy + (top ? o.up.dy : 0);
        put(key, pose === 'down' ? -1 : t, { x, y, k: o.w / 60, r: o.rot, pose, o: o.ori, z: (o.z || 6) + (top ? 3 : 0) + (o.zStep ? j * o.zStep : 0) });
      }
      // 补杠/抢杠时，第四张要摆的位置
      const sj = o.line ? 3 : 1, su = o.line ? 0 : 1;
      put('mstack' + s + '_' + m.t, -2, { x: basePos.x + sj * o.step.dx + su * o.up.dx, y: basePos.y + sj * o.step.dy + su * o.up.dy, k: o.w / 60, r: o.rot, pose: 'flat', o: o.ori, z: (o.z || 6) + 3, virtual: true });
    }
    function myHandOrder() {
      const R = v.R, q = R.que[me];
      let ids = R.hand.slice();
      if (R.phase === 'swap' && R.swapPick) ids = ids.filter(id => !R.swapPick.includes(id));
      if (R.claimTile && R.claimTile.kind === 'rob' && R.claimTile.from === me) ids = ids.filter(id => id !== R.claimTile.id);
      const drawn = R.drawn != null && ids.includes(R.drawn) && ids.length % 3 === 2 ? R.drawn : null;
      const key = id => (q >= 0 && SU(TY(id)) === q ? 1000 : 0) + id;
      const rest = ids.filter(id => id !== drawn).sort((a, b) => key(a) - key(b));
      return { rest, drawn };
    }
    // 队友的手牌顺序（缺门放最后，刚摸的单独放右边）
    function mateOrder() {
      const R = v.R, s = R.mate, q = R.que[s];
      let ids = R.mateHand.slice();
      if (R.phase === 'swap' && R.mateSwapPick) ids = ids.filter(id => !R.mateSwapPick.includes(id));
      if (R.claimTile && R.claimTile.kind === 'rob' && R.claimTile.from === s) ids = ids.filter(id => id !== R.claimTile.id);
      const drawn = R.mateDrawn != null && ids.includes(R.mateDrawn) && ids.length % 3 === 2 ? R.mateDrawn : null;
      const key = id => (q >= 0 && SU(TY(id)) === q && R.phase === 'play' ? 1000 : 0) + id;
      const rest = ids.filter(id => id !== drawn).sort((a, b) => key(a) - key(b));
      return { rest, drawn };
    }
    function layoutMine(put, staged) {
      const R = v.R, g = Gm;
      const won = R.hu[me] > 0 || R.phase === 'end';
      const melds = R.melds[me];
      const mUnits = melds.reduce((a) => a + 3 * g.mw + g.hw * 0.22, 0);
      const H = won ? { rest: (R.shown[me] || R.hand).slice().sort((a, b) => a - b), drawn: null } : myHandOrder();
      const n = H.rest.length;
      const win = R.wins.find(w => w.s === me);
      const totalW = mUnits + (melds.length ? g.hw * 0.15 : 0) + (n + 1.35) * g.hw;
      let x0 = g.handL + Math.max(0, (g.handR - g.handL - totalW) / 2);
      // 碰杠
      let x = x0;
      const mY = g.handY + g.hh / 2 - (g.mw * 82 / 60) / 2;   // 底边对齐
      melds.forEach((m, i) => {
        meldTiles(m, me, { x: x + g.mw / 2, y: mY, i }, put, { w: g.mw, rot: 0, ori: 0, step: { dx: g.mw, dy: 0 }, up: { dx: 0, dy: -g.mw * 0.42 }, z: 8 });
        x += 3 * g.mw + g.hw * 0.22;
      });
      if (melds.length) x += g.hw * 0.15;
      const tingT = handHints();
      const hasQ = R.que[me] >= 0 && R.hand.some(id => SU(TY(id)) === R.que[me]);
      const myTurn = v.opt && v.opt.k === 'turn';
      const swapping = v.opt && v.opt.k === 'swap';
      const place = (id, cx, idx) => {
        const t = TY(id);
        let cls = '', y = g.handY;
        if (won) {
          put(String(id), t, { x: cx, y: g.handY + g.hh * 0.08, k: g.hk * 0.92, r: 0, pose: 'flat', o: 0, z: 10 + idx, cls });
          return;
        }
        if (R.que[me] >= 0 && SU(t) === R.que[me] && R.phase === 'play') cls += ' que';
        if (myTurn && v.opt.queLock && SU(t) !== R.que[me]) cls += ' dim';
        if (swapping && swapSel.includes(id)) { y -= g.hh * 0.3; cls += ' sel'; }
        if (!swapping && sel === id) { y -= g.hh * 0.3; cls += ' sel'; }
        // 2v2 换牌：我要给出去的、队友想要的
        const O = R.offer, ask = v.opt && v.opt.k === 'offer' ? v.opt : null;
        if ((tsMode && tsGive === id) || (O && O.from === me && O.give === id)) { y -= g.hh * 0.3; cls += ' sel give'; }
        if (ask && ask.take === id) { y -= g.hh * 0.3; cls += ' sel want'; }
        if (gotIds.has(id) && Date.now() < gotUntil) cls += ' got';
        if (myTurn && v.opt.hu && id === R.drawn && !v.opt.dg) cls += ' zmT';
        if (myTurn && prefs.hints && tingT && tingT.by[t] && !(hasQ && SU(t) !== R.que[me])) cls += tingT.best === t ? ' mkb' : ' mk';
        const p = { x: cx, y, k: g.hk, r: 0, pose: 'stand', o: 0, z: 10 + idx, cls, hand: true };
        if (Date.now() < dealUntil && !els.has(String(id))) p.delay = 80 + idx * 55;
        put(String(id), t, p);
      };
      H.rest.forEach((id, i) => place(id, x + (i + 0.5) * g.hw, i));
      g.myHandX = x; g.myHandN = n;
      if (H.drawn != null) place(H.drawn, x + (n + 0.35 + 0.5) * g.hw, n);
      if (win) {
        const wx = x + (n + 0.35 + 0.5) * g.hw;
        put('w' + me + '_' + win.id, win.t, { x: wx, y: g.handY + g.hh * 0.08, k: g.hk * 0.92, r: 0, pose: 'flat', o: 0, z: 30, cls: ' huT', src: String(win.id) });
      }
    }
    function layoutOpp(rel, put) {
      const R = v.R, g = Gm, s = seatOf(rel);
      const end = R.phase === 'end';
      const shown = R.shown[s];
      const melds = R.melds[s];
      const win = R.wins.find(w => w.s === s);
      const staged = R.phase === 'swap' && R.swapDone[s] ? 3 : 0;
      const hidden = shown ? 0 : Math.max(0, R.counts[s] - staged);
      const drawnGap = !shown && R.phase === 'play' && R.turn === s && (R.stage === 'discard' || R.stage === 'offer') && (R.counts[s] % 3 === 2);
      const oh = ohands[rel];
      oh.classList.toggle('won', !!(R.hu[s] && !shown));   // 胡了的人牌扣着，颜色压暗一点
      // 立着的牌背：用一个元素画一排
      if (rel === 2) {
        const tw = g.tw, th = tw * 1.3;
        let mwT = Math.min(g.rw * 0.95, tw * 1.08);
        const left = g.port ? g.L + g.A + 74 : g.topRow.l, right = g.port ? g.W - g.Rr : g.topRow.r;
        // 2v2：队友的牌亮着给我看，尽量放大一点
        const mh = !shown && R.mateHand && R.mate === s ? mateOrder() : null;
        const mhN = mh ? mh.rest.length + (mh.drawn != null ? 1.35 : 0) : 0;
        if (mh) mwT = clamp((right - left - 12 - (melds.length ? 6 + 4 * melds.length : 0)) / Math.max(1, mhN + 3 * melds.length + (win ? 1.4 : 0)), mwT, Math.min(g.rw * 1.1, g.port ? 26 : 32));
        const shownN = shown ? shown.length : 0;
        const handW = mh ? mhN * mwT : shown ? shownN * mwT : hidden * tw + (drawnGap ? tw * 0.4 : 0);
        const meldW = melds.length * (3 * mwT + 4);
        const winW = win ? mwT * 1.4 : 0;
        const tot = handW + meldW + winW + (melds.length ? 6 : 0);
        let x = left + Math.max(0, (right - left - tot) / 2);
        mateTray.hidden = !mh;
        if (mh) {
          const q = R.que[s], O = R.offer, ask = v.opt && v.opt.k === 'offer' ? v.opt : null;
          const cl = id => {
            let c = ' mate';
            if (q >= 0 && SU(TY(id)) === q && R.phase === 'play') c += ' que';
            if ((tsMode && tsTake === id) || (O && O.from === me && O.take === id)) c += ' want';
            if (ask && ask.give === id) c += ' give';
            if (gotIds.has(id) && Date.now() < gotUntil) c += ' got';
            return c;
          };
          const place = (id, cx, i) => put(String(id), TY(id), { x: cx, y: g.topY, k: mwT / 60, r: 0, pose: 'flat', o: 0, z: 6 + i, cls: cl(id), mate: true });
          mh.rest.forEach((id, i) => place(id, x + (i + 0.5) * mwT, i));
          if (mh.drawn != null) place(mh.drawn, x + (mh.rest.length + 0.35 + 0.5) * mwT, mh.rest.length);
          oh.hidden = true;
          const hT = mwT * 82 / 60;
          Object.assign(mateTray.style, { left: (x - 6) + 'px', top: (g.topY - hT / 2 - 5) + 'px', width: (handW + 12) + 'px', height: (hT + mwT * 0.2 + 10) + 'px' });
        } else if (shown) {
          shown.slice().sort((a, b) => a - b).forEach((id, i) => put(String(id), TY(id), { x: x + (i + 0.5) * mwT, y: g.topY, k: mwT / 60, r: 0, pose: 'flat', o: 0, z: 6 + i }));
          oh.hidden = true;
        } else {
          oh.hidden = hidden === 0;
          setHidden(oh, hidden, drawnGap, 'top', tw, th);
          Object.assign(oh.style, { left: x + 'px', top: (g.topY - th / 2) + 'px' });
        }
        g['oh' + rel] = { x: x + handW / 2, y: g.topY };
        x += handW + (melds.length ? 6 : 0);
        if (win) { put('w' + s + '_' + win.id, win.t, { x: x + mwT * 0.9, y: g.topY, k: mwT / 60, r: 0, pose: 'flat', o: 0, z: 20, cls: ' huT', src: String(win.id) }); x += winW; }
        melds.forEach((m, i) => { meldTiles(m, s, { x: x + mwT / 2, y: g.topY + 2, i }, put, { w: mwT, rot: 0, ori: 0, step: { dx: mwT, dy: 0 }, up: { dx: 0, dy: -mwT * 0.42 }, z: 6 }); x += 3 * mwT + 4; });
        return;
      }
      // 两边：竖着一列（头像在上，下面是牌，再下面碰杠）
      const cx = rel === 1 ? g.colR : g.colL;
      const two = g.two, avail = g.midBot - g.stackTop - 8;
      const sw = Math.min(g.colW * 0.5, g.tw * 0.85), sp = Math.min(g.tw * 0.86, two ? (avail - 6) / 14.4 : (avail - 32) / 22);
      // 亮出来的牌（推倒的手牌、胡的那张、碰杠）横着放，按这一列剩下的长度定大小
      const mU = melds.reduce((a, m) => a + (m.k === 'peng' ? 3 : 4), 0);
      const units = two ? Math.max(shown ? shown.length + (win ? 1 : 0) : 0, mU + (shown ? 0 : win ? 1 : 0))
        : (shown ? shown.length : 0) + mU + (win ? 1 : 0);
      const room = two ? avail - melds.length * 5 - 4
        : avail - (shown ? 0 : hidden * sp + (drawnGap ? sp * 0.45 : 0)) - melds.length * 5 - (win ? 4 : 0) - 6;
      const mwS = Math.max(Math.min(sp * 1.1, 14), Math.min(g.rw * 0.92, ((two ? g.innerW : g.colW) - 6) * 60 / 82, units ? room / units : 99));
      const cxIn = two ? cx + (rel === 1 ? -1 : 1) * (g.colW / 2 + g.innerW / 2) : cx;
      let y = g.stackTop;
      const rot = rel === 1 ? -90 : 90, ori = rel === 1 ? 1 : 3;
      if (shown) {
        const kk = mwS;
        shown.slice().sort((a, b) => a - b).forEach((id, i) => put(String(id), TY(id), { x: cx, y: y + (i + 0.5) * kk, k: kk / 60, r: rot, pose: 'flat', o: ori, z: 6 + i }));
        y += shown.length * kk;
        oh.hidden = true;
      } else {
        oh.hidden = hidden === 0;
        setHidden(oh, hidden, drawnGap, 'side', sw, sp);
        Object.assign(oh.style, { left: (cx - sw / 2) + 'px', top: y + 'px' });
        y += hidden * sp + (drawnGap ? sp * 0.45 : 0);
      }
      g['oh' + rel] = { x: cx, y: g.stackTop + Math.max(1, (y - g.stackTop)) / 2 };
      // 两列的时候：胡的那张跟着手牌（推倒了）或者放到里面一列的最上面
      if (two) y = shown ? y : g.stackTop;
      const wx = two && !shown ? cxIn : cx;
      if (win) { y += 4; put('w' + s + '_' + win.id, win.t, { x: wx, y: y + mwS / 2, k: mwS / 60, r: rot, pose: 'flat', o: ori, z: 20, cls: ' huT', src: String(win.id) }); y += mwS; }
      if (two) y = shown || !win ? g.stackTop : y;
      y += two ? 0 : 6;
      melds.forEach((m, i) => {
        meldTiles(m, s, { x: cxIn, y: y + mwS / 2, i }, put, { w: mwS, rot, ori, step: { dx: 0, dy: mwS }, up: { dx: 0, dy: 0 }, line: true, z: 6 });
        y += (m.k === 'peng' ? 3 : 4) * mwS + 5;
      });
    }
    function setHidden(oh, n, gap, kind, w, h) {
      const key = kind + n + (gap ? 'g' : '') + w.toFixed(1) + h.toFixed(1);
      if (oh._k === key) return;
      oh._k = key;
      let html = '';
      for (let i = 0; i < n; i++) {
        const off = i * (kind === 'top' ? w : h) + (gap && i === n - 1 ? (kind === 'top' ? w : h) * 0.4 : 0);
        html += kind === 'top'
          ? `<i style="left:${off.toFixed(1)}px;top:0;width:${(w - 1).toFixed(1)}px;height:${h.toFixed(1)}px"></i>`
          : `<i style="top:${off.toFixed(1)}px;left:0;width:${w.toFixed(1)}px;height:${(h - 1).toFixed(1)}px"></i>`;
      }
      oh.innerHTML = html;
    }
    function layoutStages() {
      const R = v.R, g = Gm;
      for (let rel = 0; rel < 4; rel++) {
        const st = stages[rel], s = seatOf(rel);
        const on = R && R.phase === 'swap' && R.swapDone[s] && rel !== 0;
        st.hidden = !on;
        if (!on) continue;
        const a = anchor(rel, 'stage');
        const side = rel === 1 || rel === 3;
        const w = side ? g.rw * 1.3 : g.rw, h = side ? g.rw : g.rw * 1.3;
        let html = '';
        for (let j = 0; j < 3; j++) html += `<i style="left:${side ? 0 : j * (w + 1)}px;top:${side ? j * (h + 1) : 0}px;width:${w}px;height:${h}px;border-radius:${g.rw * 0.12}px"></i>`;
        st.innerHTML = html;
        Object.assign(st.style, { left: (a.x - (side ? w : 3 * w + 2) / 2) + 'px', top: (a.y - (side ? 3 * h + 2 : h) / 2) + 'px' });
      }
    }

    // 应用位置
    function applyTiles(P, instant) {
      const created = [];
      // 删掉不在场上的
      for (const [key, rec] of els) {
        if (P.has(key) || leaving.has(key)) continue;
        els.delete(key);
        const el = rec.el;
        if (instant) el.remove();
        else { el.style.opacity = '0'; setTimeout(() => el.remove(), 260); }
      }
      for (const [key, p] of P) {
        if (p.virtual) continue;
        let rec = els.get(key);
        if (!rec) {
          rec = tileEl(key, p.t, p.pose);
          els.set(key, rec);
          // 从哪儿飞来
          const from = instant ? null : (p.src && lastPos.get(p.src)) || lastPos.get(key) || originFor(key, p);
          if (from) created.push([rec, from, p]);
        }
        if (rec.t !== (p.pose === 'down' ? -1 : p.t)) { rec.t = p.pose === 'down' ? -1 : p.t; rec.el.querySelector('.f').innerHTML = face(rec.t); }
      }
      if (created.length) {
        for (const [rec, from] of created) { rec.el.style.transition = 'none'; rec.el.style.transform = tfOf(from); rec.el.style.opacity = from.op == null ? '1' : from.op; }
        root.offsetWidth; // 先落在起点
        for (const [rec] of created) { rec.el.style.transition = ''; rec.el.style.opacity = ''; }
      }
      let d = 0;
      for (const [key, p] of P) {
        if (p.virtual) continue;
        const rec = els.get(key), el = rec.el;
        const cls = 't ' + p.pose + ' o' + (p.o || 0) + (p.cls || '');
        if (rec.cls !== cls) { el.className = cls; rec.cls = cls; }
        const tf = tfOf(p);
        const moved = rec.tf && rec.tf !== tf;
        if (rec.tf !== tf) {
          if (instant) { el.style.transition = 'none'; el.style.transform = tf; }
          else el.style.transform = tf;
          rec.tf = tf;
        }
        const far = moved && lastPos.get(key) && Math.hypot(lastPos.get(key).x - p.x, lastPos.get(key).y - p.y) > Gm.hw * 2.5;
        el.style.zIndex = far ? 40 : p.z;
        if (far) { clearTimeout(rec.zt); rec.zt = setTimeout(() => { el.style.zIndex = p.z; }, 380); }
        if (p.delay) { el.style.transitionDelay = p.delay + 'ms'; d = Math.max(d, p.delay); }
        lastPos.set(key, { x: p.x, y: p.y, k: p.k, r: p.r });
      }
      if (instant) { root.offsetWidth; for (const rec of els.values()) rec.el.style.transition = ''; }
      if (d) setTimeout(() => { for (const rec of els.values()) rec.el.style.transitionDelay = ''; }, d + 50);
    }
    function originFor(key, p) {
      // 新出现的牌从哪里来：牌河里的从那家手里，自己手里的从牌墙，碰杠的从那家手里
      const g = Gm;
      if (key.startsWith('w')) return null;
      const id = +key;
      if (!(id >= 0)) { const rel = relOf(+key.slice(1).split('_')[0] || 0); const a = g['oh' + rel] || anchor(rel, 'hand'); return { x: a.x, y: a.y, k: p.k, r: p.r }; }
      const R = v.R;
      for (let s = 0; s < 4; s++) {
        if (R.river[s].includes(id) || R.melds[s].some(m => m.ids.includes(id)) || (R.shown[s] && R.shown[s].includes(id))) {
          const rel = relOf(s);
          if (rel === 0) return { x: g.W / 2, y: g.handY, k: g.hk, r: 0 };
          const a = g['oh' + rel] || anchor(rel, 'hand');
          return { x: a.x, y: a.y, k: g.tw / 60, r: p.r };
        }
      }
      if (p.hand) {
        if (gotIds.has(id) && swapFrom >= 0) { const a = anchor(relOf(swapFrom), 'stage'); return { x: a.x, y: a.y, k: g.rk, r: 0, op: 0.4 }; }
        return { x: g.box.cx, y: g.box.cy, k: g.rk * 0.8, r: 0, op: 0 };
      }
      return { x: g.box.cx, y: g.box.cy, k: p.k, r: p.r, op: 0 };
    }
    let swapFrom = -1, queHold = 0, dropId = -1, dropUntil = 0, dealUntil = 0;

    // ======================= 听牌提示 =======================
    function handHints() {
      if (!v || !v.R || !v.R.hand || v.R.phase !== 'play' || v.R.hu[me]) return null;
      const k = v.evn + ':' + v.R.hand.join(',');
      if (hintKey === k) return hintCache;
      hintKey = k;
      let h = null;
      try { h = AI.tingHints(v); } catch (e) { h = null; }
      if (h && h.mode === 'discard') {
        let best = -1, bv = -1;
        for (const t in h.by) { const val = h.by[t].reduce((a, w) => a + w.left * Math.pow(2, w.fan), 0); if (val > bv) { bv = val; best = +t; } }
        h.best = best;
      }
      hintCache = h;
      return h;
    }
    function waitsHTML(list, lab) {
      if (!list || !list.length) return '';
      const tot = list.reduce((a, w) => a + w.left, 0);
      let h = `<span class="lab">${lab}</span>`;
      for (const w of list) h += `<span class="w"><span class="mt">${face(w.t)}</span><span><span class="n${w.left ? '' : ' z'}">${T('nLeft', { n: w.left })}</span><br><span class="fn">${T('nFanS', { n: w.fan })}</span></span></span>`;
      h += `<span class="sum">${T('nAll', { n: tot })}</span>`;
      return h;
    }
    function renderTip() {
      const g = Gm;
      if (!v || !v.R || !prefs.hints) { tip.hidden = true; tingChip.hidden = true; return; }
      const R = v.R, h = handHints();
      let html = '', ax = g.W / 2;
      if (h && h.mode === 'discard' && sel != null && v.opt && v.opt.k === 'turn' && h.by[TY(sel)]) {
        html = waitsHTML(h.by[TY(sel)], T('tipDiscard'));
        const p = lastPos.get(String(sel)); if (p) ax = p.x;
      } else if (h && h.mode === 'wait' && h.waits.length && showWaits) {
        html = waitsHTML(h.waits, T('tipWait'));
      }
      tingChip.hidden = !(h && h.mode === 'wait' && h.waits.length && !R.hu[me] && R.phase === 'play');
      tingChip.textContent = T('ting');
      if (!tingChip.hidden) Object.assign(tingChip.style, { left: (g.plate0.x + g.A0 / 2 + 70) + 'px', top: (g.plate0.y - 12) + 'px' });
      if (!html || !tsPanel.hidden) { tip.hidden = true; return; }
      tip.innerHTML = html; tip.hidden = false;
      const w = tip.offsetWidth, ht = tip.offsetHeight;
      Object.assign(tip.style, { left: clamp(ax - w / 2, 8, g.W - w - 8) + 'px', top: (g.port ? g.plate0.y - g.A0 / 2 - ht - 8 : g.handTop - g.hh * 0.42 - ht - 10) + 'px' });
    }

    // ======================= 座位、罗盘 =======================
    function renderPlates() {
      const R = v.R, g = Gm;
      for (let rel = 0; rel < 4; rel++) {
        const s = seatOf(rel), p = v.seats[s], el = plates[rel];
        if (!p) { el.hidden = true; continue; }
        el.hidden = false;
        const a = anchor(rel, 'plate');
        const A = rel === 0 ? g.A0 : g.A;
        const score = p.score + (R && R.phase !== 'end' ? R.deltas[s] : 0);
        const que = R ? R.que[s] : -1;
        let st = '';
        if (R) {
          const w = R.wins.find(x => x.s === s);
          if (R.hu[s]) {
            const fd = feederOf(w);
            st = fd >= 0 && v.seats[fd]
              ? `<span class="stat hu pao">${IC.bomb}<span class="fav">${avSvg(v.seats[fd], fd)}</span>${T('stWon')}</span>`
              : `<span class="stat hu zimo">${IC.zimo}${T(w && w.how === 'zimo' ? 'stZimo' : 'stWon')}</span>`;
          }
          else if (!p.conn && !p.bot) st = `<span class="stat">${T('stOff')}</span>`;
          else if (p.auto && !p.bot) st = `<span class="stat">${T('stAuto')}</span>`;
          else if (R.phase === 'swap') st = `<span class="stat">${T(R.swapDone[s] ? 'stPicked' : 'stPicking')}</span>`;
          else if (R.phase === 'que') st = `<span class="stat">${T(R.queDone[s] ? 'stQued' : 'stQuing')}</span>`;
          else if (R.offer && (R.offer.from === s || R.offer.to === s)) st = `<span class="stat ts">${T('stTs')}</span>`;
          else if (R.team && rel === 2) st = `<span class="stat mate">${T('mateTag')}</span>`;
        }
        const team = R && R.team ? (rel % 2 === 0 ? ' us' : ' them') : '';
        const turn = R && R.phase === 'play' && R.stage === 'discard' && R.turn === s && !R.hu[s];
        const vert = g.port ? rel === 1 || rel === 3 : rel === 2;
        const rev = !g.port && rel === 1;
        // 2v2：自己和队友这局还能换几次牌，一直写在名字牌上（有人胡了就不能再换）
        let tsl = '', tsn = -1;
        if (R && R.team && rel % 2 === 0 && R.phase !== 'end') {
          const inf = !v.rules.tswap, n = R.tsLeft ? R.tsLeft[s] : 0;
          tsn = R.hu[me] || R.hu[(me + 2) % 4] || !(n > 0) ? 0 : inf ? 99 : n;
          tsl = !tsn ? `<div class="tsl off">${T('tslNone')}</div>` : `<div class="tsl">${inf ? T('tslInf') : T('tslN', { n: `<b>${tsn}</b>` })}</div>`;
        }
        const key = [p.name, p.av, p.bot, p.lv, score, que, st, R && R.dealer === s, turn, A, vert, rev, tsl, I18.lang].join('|');
        el.className = 'seat' + (vert ? ' vert' : '') + (rev ? ' rev' : '') + (turn ? ' turn' : '') + (R && R.hu[s] ? ' won' : '') + team;
        el.style.setProperty('--a', A + 'px');
        if (el._k !== key) {
          el._k = key;
          // 次数刚少了一次：数字闪一下
          if (tsl && el._tsn > tsn && tsn > 0 && tsn < 99) tsl = tsl.replace('class="tsl"', 'class="tsl bump"');
          el.innerHTML = `<div class="av">${avSvg(p, s)}${R && R.dealer === s ? `<span class="badge zhuang">${T('dealerB')}</span>` : ''}${que >= 0 ? `<span class="badge que" style="background:${QCOL[que]}">${suitMark(que)}</span>` : ''}${st}</div>` +
            `<div class="info"><div class="nm">${esc(p.name)}${p.bot ? `<small>${T('lv')[p.lv] || ''}</small>` : ''}</div><div class="sc${score < 0 ? ' neg' : ''}">${score > 0 ? '+' : ''}${score}</div>${tsl}</div>`;
        }
        el._tsn = tsn;
        const w = el.offsetWidth, h = el.offsetHeight;
        if (vert) Object.assign(el.style, { left: clamp(a.x - w / 2, 2, g.W - w - 2) + 'px', top: (a.y - A / 2) + 'px' });
        else if (rev) Object.assign(el.style, { left: (a.x + A / 2 - w) + 'px', top: (a.y - A / 2) + 'px' });
        else Object.assign(el.style, { left: (a.x - A / 2) + 'px', top: (a.y - A / 2) + 'px' });
        el._h = h;
      }
    }
    function renderCompass() {
      const R = v.R;
      compass.querySelector('.left').innerHTML = `<b>${R ? R.wall : 0}</b>${T('wall')}`;
      lights.forEach((l, rel) => {
        const s = seatOf(rel);
        l.className = 'lt' + (R && R.hu[s] ? ' hu' : '') + (R && R.phase === 'play' && R.turn === s && !R.hu[s] ? ' on' : '');
      });
    }

    // ======================= 操作按钮、横幅 =======================
    function btn(cls, txt, fn, tile) {
      const b = document.createElement('button');
      b.className = 'abtn ' + cls;
      b.innerHTML = txt + (tile != null ? `<span class="mini">${face(tile)}</span>` : '');
      b.onclick = e => { e.stopPropagation(); SND.play('tap'); fn(); };
      return b;
    }
    function renderActs() {
      const g = Gm, o = v.opt, R = v.R;
      gopts.hidden = true;
      const key = o ? JSON.stringify(o) + v.evn + I18.lang + (tsMode ? 'ts' : '') : '';
      if (acts._k === key) return;
      acts._k = key;
      acts.innerHTML = '';
      if (!o || !R || R.phase !== 'play' || tsMode) { acts.hidden = true; return; }
      if (o.k === 'claim') {
        if (o.peng) acts.appendChild(btn('peng', T('bPeng'), () => onAct({ k: 'peng' }), o.hu || o.gang ? null : o.t));
        if (o.gang) acts.appendChild(btn('gang', T('bGang'), () => onAct({ k: 'gang' }), o.hu ? null : o.t));
        if (o.hu) acts.appendChild(huBadge(btn('hu pao', T('bHu'), () => onAct({ k: 'hu' }), o.t), 'pao', o.from != null ? o.from : R.claimTile ? R.claimTile.from : -1));
        acts.appendChild(btn('pass', T('bPass'), () => onAct({ k: 'pass' })));
        SND.vib(o.hu ? [40, 60, 40] : 30);
      } else if (o.k === 'turn') {
        const kongs = (o.an || []).map(t => ({ k: 'angang', t })).concat((o.bu || []).map(t => ({ k: 'bugang', t })));
        if ((o.hu || kongs.length) && selfSkip !== key) {
          if (kongs.length) acts.appendChild(btn('gang', T('bGang'), () => {
            if (kongs.length === 1) return onAct(kongs[0]);
            gopts.innerHTML = ''; gopts.hidden = false;
            for (const kk of kongs) { const b = document.createElement('button'); b.innerHTML = face(kk.t); b.onclick = e => { e.stopPropagation(); gopts.hidden = true; onAct(kk); }; gopts.appendChild(b); }
            const r = acts.getBoundingClientRect(), rr = root.getBoundingClientRect();
            Object.assign(gopts.style, { left: Math.max(8, r.right - rr.left - kongs.length * 42 - 16) + 'px', top: (r.top - rr.top - 62) + 'px' });
          }));
          if (o.hu) {
            const fed = o.dg && o.payers && o.payers.length === 1;
            acts.appendChild(huBadge(btn('hu ' + (fed ? 'pao' : 'zimo'), T('bHu'), () => onAct({ k: 'zimo' }), R.drawn != null ? TY(R.drawn) : null), fed ? 'pao' : 'zimo', fed ? o.payers[0] : -1));
          }
          acts.appendChild(btn('pass', T('bPass'), () => { selfSkip = key; acts._k = ''; renderActs(); }));
          if (o.hu) SND.vib([40, 60, 40]);
        }
        // 2v2：跟队友换一张
        if (o.ts && !tsMode) {
          const wins = prefs.hints ? tsWinTiles() : [];
          const b = btn('ts' + (wins.length ? ' can' : ''), T('bTs'), () => { tsMode = true; tsTake = wins.length === 1 ? tsTakeId(wins[0]) : null; tsGive = tsGiveFor(tsTake); sel = null; acts._k = ''; render(true); });
          if (v.rules.tswap) b.insertAdjacentHTML('beforeend', `<span class="cnt">${o.tsLeft}</span>`);
          if (wins.length) b.insertAdjacentHTML('beforeend', `<span class="tag">${T('tsCanWin')}</span>`);
          acts.insertBefore(b, acts.firstChild);
        }
      }
      acts.hidden = !acts.children.length;
      if (!acts.hidden) Object.assign(acts.style, { right: (g.Rr + 4) + 'px', bottom: (g.H - g.handTop + g.hh * 0.42 + 6) + 'px' });
    }
    // 胡按钮左上角的小牌子：点炮 = 放炮那家的头像 + 炸弹；自摸 = 金光的牌
    function huBadge(b, how, from) {
      const p = from >= 0 ? v.seats[from] : null;
      b.insertAdjacentHTML('beforeend', how === 'pao' && p
        ? `<span class="hsrc pao"><span class="av">${avSvg(p, from)}</span>${IC.bomb}</span>`
        : `<span class="hsrc zimo">${IC.zimo}</span>`);
      return b;
    }
    // 能胡的时候，从要给钱的人那里牵一条线到自己：点炮一条红线（引线 + 炸弹），自摸每家一条金线（金币往自己这边滚）
    function renderHuHint() {
      const o = v.opt, R = v.R, g = Gm;
      let src = null, how = '';
      if (o && R && R.phase === 'play' && !tsMode && o.hu && !acts.hidden && acts.querySelector('.abtn.hu')) {
        const cf = o.from != null ? o.from : R.claimTile ? R.claimTile.from : -1;
        if (o.k === 'claim' && cf >= 0) { src = [cf]; how = 'pao'; }
        else if (o.k === 'turn' && o.payers && o.payers.length) { src = o.payers.slice(); how = o.dg && src.length === 1 ? 'pao' : 'zimo'; }
      }
      plates.forEach((el, rel) => { const s = seatOf(rel); el.classList.toggle('hfeed', !!src && how === 'pao' && src.includes(s)); el.classList.toggle('hpay', !!src && how === 'zimo' && src.includes(s)); });
      const key = src ? [how, src.join(','), g.W, g.H, me].join('|') : '';
      if (huLay._k === key) return;
      huLay._k = key; huLay.innerHTML = '';
      huLay.hidden = !src;
      if (!src) return;
      const b = anchor(0, 'plate'), c = { x: g.box.cx, y: g.box.cy }, f = x => x.toFixed(1);
      let paths = '', icons = '';
      src.forEach((s, i) => {
        const rel = relOf(s); if (!rel) return;
        const a = anchor(rel, 'plate');
        const A = g.A;
        // 线从头像边上出发，往桌子中间弯一点，停在自己头像旁边
        const k = 0.55, mx = (a.x + b.x) / 2 + (c.x - (a.x + b.x) / 2) * k, my = (a.y + b.y) / 2 + (c.y - (a.y + b.y) / 2) * k;
        const sh = (p, q, d) => { const L = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: p.x + (q.x - p.x) / L * d, y: p.y + (q.y - p.y) / L * d }; };
        const p0 = sh(a, { x: mx, y: my }, A / 2 + 6), p1 = sh(b, { x: mx, y: my }, g.A0 / 2 + 8);
        const d = `M${f(p0.x)} ${f(p0.y)}Q${f(mx)} ${f(my)} ${f(p1.x)} ${f(p1.y)}`;
        paths += `<path class="glow" d="${d}"/><path class="ln" d="${d}"/>`;
        for (let j = 0; j < (how === 'pao' ? 1 : 2); j++)
          paths += `<g class="mover"><circle r="${how === 'pao' ? 5.5 : 5}"/><animateMotion dur="${how === 'pao' ? 0.9 : 1.5}s" begin="${(j * 0.75 + i * 0.22).toFixed(2)}s" repeatCount="indefinite" path="${d}"/></g>`;
        const ia = { x: a.x + (rel === 1 && !g.port ? -1 : 1) * A * 0.46, y: a.y - A * 0.46 };
        icons += `<span class="hico ${how}" style="left:${f(ia.x)}px;top:${f(ia.y)}px">${how === 'pao' ? IC.bomb : '<i class="cn"></i>'}</span>`;
      });
      huLay.className = 'hulay ' + how;
      huLay.innerHTML = `<svg width="${g.W}" height="${g.H}" viewBox="0 0 ${g.W} ${g.H}">${paths}</svg>${icons}`;
    }
    // 胡了：点炮是一颗炸弹从放炮的人那里飞过来炸开；自摸是自己这里一圈金光
    function bombFly(from, to, delay) {
      if (!Gm || from === to) return;
      const a = anchor(relOf(from), 'plate'), b = anchor(relOf(to), 'plate');
      const lift = Math.min(110, Math.hypot(b.x - a.x, b.y - a.y) * 0.4);
      setTimeout(() => {
        const pl = plates[relOf(from)];
        pl.classList.remove('hshake'); pl.offsetWidth; pl.classList.add('hshake');
        setTimeout(() => pl.classList.remove('hshake'), 700);
        fx('hpuff', '', a.x, a.y, 900);
        const d = div('hbomb', IC.bomb); root.appendChild(d);
        const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - lift;
        const an = d.animate([
          { transform: `translate(${a.x}px,${a.y}px) scale(.5) rotate(0deg)`, opacity: 0 },
          { transform: `translate(${a.x}px,${a.y - 10}px) scale(1.15) rotate(-20deg)`, opacity: 1, offset: 0.15 },
          { transform: `translate(${mx}px,${my}px) scale(1.25) rotate(160deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${b.x}px,${b.y}px) scale(.9) rotate(340deg)`, opacity: 1 },
        ], { duration: 620, easing: 'cubic-bezier(.4,.1,.6,1)' });
        const land = () => { d.remove(); fx('hboom', '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>', b.x, b.y, 900); };
        an.onfinish = land;
        setTimeout(() => { if (d.isConnected) land(); }, 900);
      }, delay || 0);
    }
    function zimoBurst(s, delay) {
      if (!Gm) return;
      const a = anchor(relOf(s), 'plate');
      setTimeout(() => fx('hstar', '<b></b><b></b>' + IC.zimo, a.x, a.y, 1500), delay || 0);
    }
    function renderBanner() {
      const R = v.R, o = v.opt, g = Gm;
      let html = '', k = '';
      if (R && R.phase === 'swap') {
        if (o && o.k === 'swap') {
          if (swapFor !== R.no + ':' + me) { swapFor = R.no + ':' + me; try { swapSel = AI.chooseSwap(R.hand, 3, Math.random).slice(); } catch (e) { swapSel = []; } }
          k = 'swap' + swapSel.join(',') + I18.lang;
          const ok = swapSel.length === 3;
          html = `<div class="h">${T('swapH')}</div><div class="s">${T('swapS')}</div><div class="row"><button class="btn gold sm" data-a="swap"${ok ? '' : ' disabled'}>${T('swapOk')}</button></div>`;
        } else { k = 'swapw' + I18.lang; html = `<div class="h">${T('swapH')}</div><div class="s">${T('waitOthers')}</div>`; }
      } else if (R && R.phase === 'que' && Date.now() < queHold) {
        html = '';
      } else if (R && R.phase === 'que') {
        if (o && o.k === 'que') {
          if (queRec < 0) { try { queRec = AI.chooseQue(R.hand, 3, Math.random); } catch (e) { queRec = 0; } }
          const c = [0, 0, 0]; for (const id of R.hand) c[SU(TY(id))]++;
          k = 'que' + c.join(',') + queRec + I18.lang;
          const en = I18.lang === 'en';
          html = `<div class="h">${T('queH')}</div><div class="s">${T('queS')}</div><div class="row">` +
            [0, 1, 2].map(s => `<button class="qbtn${s === queRec ? ' rec' : ''}" data-rec="${T('rec')}" data-a="que" data-s="${s}"><span class="q" style="color:${QCOL[s]}">${suitMark(s)}</span><span class="c">${en ? T('suit')[s] + '<br>' : ''}${T('nTiles', { n: c[s] })}</span></button>`).join('') + '</div>';
        } else { k = 'quew' + I18.lang; html = `<div class="h">${T('queH')}</div><div class="s">${T('waitOthers')}</div>`; }
      }
      if (!html) { banner.hidden = true; banner._k = ''; return; }
      banner.hidden = false;
      if (banner._k !== k) {
        banner._k = k; banner.innerHTML = html;
        banner.querySelectorAll('[data-a]').forEach(b => b.onclick = e => {
          e.stopPropagation(); SND.play('tap');
          if (b.dataset.a === 'swap') { if (swapSel.length === 3) onAct({ k: 'swap', ids: swapSel.slice() }); }
          else onAct({ k: 'que', s: +b.dataset.s });
        });
      }
      const ht = banner.offsetHeight;
      let top = g.box.cy - ht / 2;
      if (g.port) {
        // 竖屏：放在罗盘下面（这时候自己的牌河还是空的）；已经扣下三张的话放在那三张下面
        const below = g.box.cy + g.cs / 2 + 14, staged = R.phase === 'swap' && R.swapDone[me] ? anchor(0, 'stage').y + g.rw * 0.75 + 10 : 0;
        const lo = Math.max(below, staged), bottom = g.plate0.y - g.A0 / 2 - 10;
        if (lo + ht <= bottom) top = lo;
      }
      banner.style.top = clamp(top, g.midTop, g.handTop - ht - g.hh * 0.6) + 'px';
    }
    // ======================= 2v2：跟队友换牌 =======================
    let twKey = '', twCache = [];
    function tsWinTiles() {
      const R = v.R; if (!R || !R.mateHand) return [];
      const k = v.evn + ':' + R.hand.join(',') + '|' + R.mateHand.join(',');
      if (k !== twKey) { twKey = k; try { twCache = AI.tsWins(v); } catch (e) { twCache = []; } }
      return twCache;
    }
    const tsTakeId = t => { const h = v.R.mateHand; for (let i = h.length - 1; i >= 0; i--) if (TY(h[i]) === t) return h[i]; return null; };
    // 换来 take 能胡的话，挑一张给出去的（先挑刚摸的）
    function tsGiveFor(take) {
      const R = v.R; if (take == null) return null;
      const ids = R.drawn != null ? [R.drawn].concat(R.hand.filter(x => x !== R.drawn)) : R.hand.slice();
      for (const id of ids) { try { const pv = AI.tsPreview(v, 'me', TY(id), TY(take)); if (pv && pv.win) return id; } catch (e) { return null; } }
      return null;
    }
    const tmBtn = (id, cls) => `<button class="tm${cls || ''}" data-id="${id}">${face(TY(id))}</button>`;
    const tmTile = (t, cls) => `<span class="tm${cls || ''}">${face(t)}</span>`;
    function pvHTML(pv, asker) {
      if (!pv) return '';
      const one = (n, n0) => `<b class="${n < n0 ? 'up' : n > n0 ? 'dn' : ''}">${n < 0 ? T('tsWin') : n === 0 ? T('tsReady') : T('tsAway', { n })}</b>`;
      const mine = asker === 'me' ? one(pv.asker, pv.asker0) : one(pv.other, pv.other0);
      const mate = asker === 'me' ? one(pv.other, pv.other0) : one(pv.asker, pv.asker0);
      return T('tsAfter', { a: mine, b: mate });
    }
    function renderTs() {
      const R = v.R, o = v.opt, g = Gm;
      let html = '', k = '';
      const O = R && R.offer;
      if (!R || R.phase !== 'play' || !R.team) html = '';
      else if (o && o.k === 'offer') {
        // 队友来要牌：同意 / 不换
        let pv = null; try { pv = AI.tsPreview(v, 'mate', TY(o.give), TY(o.take)); } catch (e) {}
        const left = v.clock && v.clock.end && v.clock.seats && v.clock.seats.includes(me) ? Math.max(0, v.clock.end - Date.now()) : 0;
        k = 'ask' + o.give + ':' + o.take + I18.lang + ':' + Math.round(left / 1000);
        html = `<div class="h">${T('tsAskH')}</div><div class="swap2"><div><span class="lab">${T('tsGiveYou')}</span>${tmTile(TY(o.give), ' big')}</div><div class="arr">⇄</div><div><span class="lab">${T('tsWantYour')}</span>${tmTile(TY(o.take), ' big')}</div></div>` +
          `<div class="s">${pvHTML(pv, 'mate')}</div><div class="row"><button class="btn glass sm" data-a="tsno">${T('tsNo')}</button><button class="btn gold sm" data-a="tsyes">${T('tsYes')}</button></div>` +
          (left ? `<div class="tbar"><i style="animation-duration:${left}ms"></i></div>` : '');
      } else if (O && O.from === me && R.stage === 'offer' && O.give != null) {
        // 我在等队友回话
        k = 'wait' + O.give + ':' + O.take + I18.lang;
        html = `<div class="h">${T('tsWaitH')}</div><div class="swap2 sm"><div><span class="lab">${T('tsYouGive')}</span>${tmTile(TY(O.give))}</div><div class="arr">⇄</div><div><span class="lab">${T('tsYouTake')}</span>${tmTile(TY(O.take))}</div></div><div class="row"><button class="btn glass sm" data-a="tsback">${T('tsBack')}</button></div>`;
      } else if (tsMode && o && o.k === 'turn' && o.ts && R.mateHand) {
        // 挑牌：上面点队友的一张，下面点自己的一张
        const mh = mateOrder();
        const ids = mh.rest.concat(mh.drawn != null ? [mh.drawn] : []);
        const wins = prefs.hints ? tsWinTiles() : [];
        let s2;
        if (tsTake == null) s2 = T('tsPick1');
        else if (tsGive == null) s2 = T('tsPick2');
        else { let pv = null; try { pv = AI.tsPreview(v, 'me', TY(tsGive), TY(tsTake)); } catch (e) {} s2 = pvHTML(pv, 'me'); }
        k = 'pick' + ids.join(',') + ':' + tsTake + ':' + tsGive + I18.lang + wins.join(',');
        html = `<div class="h">${T('tsH')}${o.tsLeft < 99 ? `<small>${T('tsLeftN', { n: o.tsLeft })}</small>` : ''}</div>` +
          `<div class="mrow2">${ids.map(id => tmBtn(id, (id === tsTake ? ' on' : '') + (wins.includes(TY(id)) ? ' win' : ''))).join('')}</div>` +
          `<div class="s">${s2}</div><div class="row"><button class="btn glass sm" data-a="tsx">${T('cancel')}</button><button class="btn gold sm" data-a="tsgo"${tsTake != null && tsGive != null ? '' : ' disabled'}>${T('tsSend')}</button></div>`;
      }
      if (!html) { tsPanel.hidden = true; tsPanel._k = ''; return; }
      tsPanel.hidden = false;
      if (tsPanel._k !== k) {
        tsPanel._k = k; tsPanel.innerHTML = html;
        tsPanel.querySelectorAll('[data-id]').forEach(b => b.onclick = e => {
          e.stopPropagation();
          const id = +b.dataset.id;
          tsTake = tsTake === id ? null : id;
          if (tsTake != null && tsGive == null && tsWinTiles().includes(TY(tsTake))) tsGive = tsGiveFor(tsTake);
          SND.play('select'); render(true);
        });
        tsPanel.querySelectorAll('[data-a]').forEach(b => b.onclick = e => {
          e.stopPropagation(); SND.play('tap');
          const a = b.dataset.a;
          if (a === 'tsx') { tsMode = false; tsTake = tsGive = null; acts._k = ''; render(true); }
          else if (a === 'tsgo') { if (tsTake != null && tsGive != null) { const x = { k: 'tswap', give: tsGive, take: tsTake }; tsMode = false; tsTake = tsGive = null; onAct(x); } }
          else onAct({ k: a });
        });
      }
      // 放在自己手牌上面，不挡手牌（要点自己的牌）
      const ht = tsPanel.offsetHeight;
      const bottomY = g.port ? g.plate0.y - g.A0 / 2 - 10 : g.handTop - g.hh * 0.42 - 8;
      tsPanel.style.top = Math.max(g.port ? g.midTop - 24 : g.tbH + 2, bottomY - ht) + 'px';
    }
    // 对手看不到换了哪两张：两张牌背在两个人之间飞一下
    function flyBacks(ra, rb) {
      const g = Gm; if (!g) return;
      const pa = g['oh' + ra] || anchor(ra, 'hand'), pb = g['oh' + rb] || anchor(rb, 'hand');
      [[pa, pb], [pb, pa]].forEach(([a, b], i) => {
        const d = div('flyback'); root.appendChild(d);
        const mx = (a.x + b.x) / 2 + (i ? 16 : -16), my = (a.y + b.y) / 2;
        const an = d.animate([
          { transform: `translate(${a.x}px,${a.y}px) scale(.7)`, opacity: 0 },
          { transform: `translate(${mx}px,${my}px) scale(1.05)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${b.x}px,${b.y}px) scale(.7)`, opacity: 0 },
        ], { duration: 760, easing: 'cubic-bezier(.45,.05,.55,.95)' });
        an.onfinish = () => d.remove(); setTimeout(() => d.remove(), 1100);
      });
    }
    function renderStatus() {
      const R = v.R, g = Gm;
      let txt = '';
      if (R && R.phase === 'play') {
        if (R.hu[me]) txt = T('youWon');
        else if (v.opt && v.opt.k === 'turn' && v.opt.queLock) txt = T('queFirst', { s: T('suit')[R.que[me]] });
        else if (v.opt && v.opt.k === 'turn' && v.opt.que) txt = T('queLeft', { s: T('suit')[R.que[me]], n: R.hand.filter(id => SU(TY(id)) === R.que[me]).length });
        // 过手胡：放过了一手胡，自己摸牌之前只能胡番更大的
        else if (R.passHu && R.turn !== me) txt = R.passFan >= 99 || (v.rules.cap && R.passFan >= v.rules.cap) ? T('passHuAny') : T('passHuMore', { n: Math.max(0, R.passFan) });
      }
      const auto = v.seats[me] && v.seats[me].auto && R && R.phase !== 'end' && !R.hu[me];
      if (auto || !tip.hidden || !tsPanel.hidden) txt = '';
      status.hidden = !txt;
      status.classList.toggle('intb', !g.port);
      if (txt) { status.textContent = txt; Object.assign(status.style, { left: g.W / 2 + 'px', top: (g.port ? g.plate0.y - g.A0 / 2 - 24 : g.sf.t + 22) + 'px' }); }
      if (root.parentElement) root.parentElement.classList.toggle('tbmsg', !g.port && (!!txt || !!auto));
      autoBar.hidden = !auto;
      // 轮到自己出牌：手牌下面亮一道光
      const mine = !!(v.opt && v.opt.k === 'turn') && !auto;
      turnGlow.hidden = !mine;
      if (mine) Object.assign(turnGlow.style, { left: g.handL + 'px', width: (g.handR - g.handL) + 'px', top: (g.handTop - g.hh * 0.25) + 'px', height: (g.hh * 1.5) + 'px' });
      if (auto) { autoBar.firstChild.textContent = T('autoOn'); autoBar.lastChild.textContent = T('autoOff'); }
      autoBar.classList.toggle('intb', !g.port);
      if (auto) Object.assign(autoBar.style, g.port ? { bottom: (g.H - (g.plate0.y - g.A0 / 2) + 12) + 'px', top: '' } : { top: (g.sf.t + 4) + 'px', bottom: '' });
    }
    // 倒计时
    let clockT = 0;
    function renderClock() {
      const c = compass.querySelector('.clock');
      clearInterval(clockT);
      const ck = v.clock;
      if (!ck || !ck.end) { c.textContent = ''; return; }
      const tick = () => {
        const left = Math.max(0, Math.ceil((ck.end - Date.now()) / 1000));
        c.textContent = left ? left + '' : '';
        if (left && left <= 5 && ck.seats && ck.seats.includes(me) && left !== tick.l) { tick.l = left; SND.play('tick'); }
        if (!left) clearInterval(clockT);
      };
      tick(); clockT = setInterval(tick, 250);
    }

    // ======================= 特效 =======================
    function fx(cls, html, x, y, ms) {
      const d = div(cls, html);
      d.style.left = x + 'px'; d.style.top = y + 'px';
      root.appendChild(d);
      setTimeout(() => d.remove(), ms || 1400);
      return d;
    }
    function callout(rel, text, cls, sub, size) {
      const a = anchor(rel, 'call');
      const d = fx('callout ' + (size || 'mid') + ' ' + cls, esc(text) + (sub ? `<span class="sub">${esc(sub)}</span>` : ''), a.x, a.y, 1500);
      const w = d.offsetWidth;
      d.style.left = (w + 12 >= Gm.W ? Gm.W / 2 : clamp(a.x, w / 2 + 6, Gm.W - w / 2 - 6)) + 'px';
    }
    function flyMoney(s, amt, delay) {
      if (!amt) return;
      const rel = relOf(s), a = anchor(rel, 'plate');
      const A = rel === 0 ? Gm.A0 : Gm.A;
      setTimeout(() => {
        const x = rel === 0 || rel === 2 ? a.x + A / 2 + 30 : a.x;
        fx('fly ' + (amt > 0 ? 'p' : 'm'), fmt(amt), clamp(x, 24, Gm.W - 24), a.y - A / 2 - 6, 1700);
      }, delay || 0);
    }
    function bubble(s, text, emo) {
      if (!Gm || !v) return;
      const rel = relOf(s), a = anchor(rel, 'plate');
      const A = rel === 0 ? Gm.A0 : Gm.A;
      const d = fx('bubble' + (emo ? ' emo' : ''), esc(text), 0, 0, 2700);
      const w = d.offsetWidth, h = d.offsetHeight;
      let x = rel === 1 ? a.x - A / 2 - w - 6 : rel === 3 ? a.x + A / 2 + 6 : a.x + A / 2 + 6;
      let y = rel === 0 ? a.y - A / 2 - h - 8 : a.y - h / 2;
      if (rel === 0) x = a.x - A / 2;
      d.style.left = clamp(x, 4, Gm.W - w - 4) + 'px'; d.style.top = clamp(y, Gm.tbH, Gm.H - h - 4) + 'px';
    }
    // 金币从付钱的人飞到收钱的人
    function coins(from, to, n, delay) {
      if (!Gm || from === to || from == null || to == null) return;
      const ra = relOf(from), rb = relOf(to), a = anchor(ra, 'plate'), b = anchor(rb, 'plate');
      const lift = Math.min(90, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          const c = div('coin'); root.appendChild(c);
          const jx = (Math.random() - 0.5) * 18, jy = (Math.random() - 0.5) * 14;
          const mx = (a.x + b.x) / 2 + jx, my = Math.min(a.y, b.y) - lift + jy;
          const anim = c.animate([
            { transform: `translate(${a.x}px,${a.y}px) scale(.6)`, opacity: 0 },
            { transform: `translate(${a.x + jx}px,${a.y + jy}px) scale(1)`, opacity: 1, offset: 0.12 },
            { transform: `translate(${mx}px,${my}px) scale(1.1)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${b.x}px,${b.y}px) scale(.7)`, opacity: 0.2 },
          ], { duration: 760, easing: 'cubic-bezier(.45,.05,.55,.95)' });
          anim.onfinish = () => c.remove();
          setTimeout(() => c.remove(), 1200);
        }, (delay || 0) + i * 70);
      }
    }
    function dirFx(dir) {
      const g = Gm;
      const txt = T(dir === 2 ? 'dirAcross' : dir === 1 ? 'dirRight' : 'dirLeft');
      // 三段带箭头的弧绕着罗盘转：往右换（下家）逆时针，往左换（上家）顺时针；换对家是一横一竖两个双向箭头
      const P = a => [50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a)], f = x => x.toFixed(1);
      let art = '';
      if (dir === 2) art = '<path d="M50 22V78M40 32L50 22L60 32M40 68L50 78L60 68"/><path d="M22 50H78M32 40L22 50L32 60M68 40L78 50L68 60" opacity=".55"/>';
      else {
        const cw = dir === 3;
        for (let k = 0; k < 3; k++) {
          const a0 = (k * 120 - 70) * Math.PI / 180, a1 = a0 + 78 * Math.PI / 180;
          const [x0, y0] = P(a0), [x1, y1] = P(a1);
          art += `<path d="M${f(x0)} ${f(y0)}A40 40 0 0 1 ${f(x1)} ${f(y1)}"/>`;
          const ae = cw ? a1 : a0, [hx, hy] = P(ae);
          const tx = cw ? -Math.sin(ae) : Math.sin(ae), ty = cw ? Math.cos(ae) : -Math.cos(ae), nx = Math.cos(ae), ny = Math.sin(ae);
          const bx = hx - tx * 9, by = hy - ty * 9;
          art += `<path d="M${f(bx + nx * 6.5)} ${f(by + ny * 6.5)}L${f(hx)} ${f(hy)}L${f(bx - nx * 6.5)} ${f(by - ny * 6.5)}"/>`;
        }
      }
      const d = fx('dirfx', `<svg viewBox="0 0 100 100"><g fill="none" stroke="#ffd36b" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${art}</g></svg>`, g.box.cx, g.box.cy, 1600);
      const sz = g.cs + 84;
      Object.assign(d.style, { width: sz + 'px', height: sz + 'px', marginLeft: -sz / 2 + 'px', marginTop: -sz / 2 + 'px' });
      d.style.setProperty('--rot', dir === 2 ? '0deg' : dir === 3 ? '120deg' : '-120deg');
      callout(0, txt, 'c-wind', null, 'sm');
    }
    function effects(evs) {
      // 四川话开着就念四川话（中文界面），否则退回系统语音
      const sc = (k, d) => !!(SND.scReady && SND.scReady() && SND.scSay(k, d));
      const R = v.R;
      let delay = 0;
      for (const e of evs) {
        const rel = e.s != null ? relOf(e.s) : 0;
        switch (e.k) {
          case 'deal': SND.play('deal'); break;
          case 'swap': SND.play('swap'); dirFx(e.dir); break;
          case 'que': SND.play('que'); setTimeout(() => plates.forEach(p => { const b = p.querySelector('.badge.que'); if (b) { b.classList.remove('pop'); b.offsetWidth; b.classList.add('pop'); } }), 30); break;
          case 'discard': dropId = e.id; dropUntil = Date.now() + 700; SND.play('discard'); if (SND.scReady && SND.scReady()) SND.scSay('t' + TY(e.id)); else if (SND.prefs && SND.prefs.call) SND.say(I18.tile(TY(e.id)), 1.25); break;
          case 'draw': if (e.s === me) SND.play('draw'); break;
          case 'peng': SND.play('peng'); if (!sc('peng')) SND.say(T('vPeng')); callout(rel, T('cPeng'), 'c-peng'); break;
          case 'gang': {
            SND.play('gang'); if (!sc(e.kind === 'an' ? 'an' : e.kind === 'ming' ? 'ming' : 'gang')) SND.say(T('vGang'));
            callout(rel, T('cGang'), 'c-gang', T(e.kind === 'an' ? 'cRain' : 'cWind'));
            const mult = e.kind === 'bu' ? 1 : 2, base = v.rules.base;
            if (e.kind === 'ming') { flyMoney(e.s, base * 2); flyMoney(e.from, -base * 2); coins(e.from, e.s, 3, 150); }
            else { let n = 0; for (let s = 0; s < 4; s++) if (s !== e.s && !R.hu[s]) { flyMoney(s, -base * mult); coins(s, e.s, 3, 150); n++; } flyMoney(e.s, base * mult * n); }
            break;
          }
          case 'hu': {
            const title = T(e.how === 'zimo' ? (e.items.some(x => x[0] === '杠上开花') ? 'cBloom' : 'cZimo') : e.how === 'rob' ? 'cRob' : 'cHu');
            SND.play('hu', delay / 1000); if (!sc(e.items.some(x => x[0] === '杠上开花') ? 'bloom' : e.items.some(x => x[0] === '抢杠胡') ? 'rob' : e.items.some(x => x[0] === '杠上炮') ? 'pao' : e.how === 'zimo' ? 'zimo' : 'hu', delay / 1000)) SND.say(T(e.how === 'zimo' ? 'vZimo' : 'vHu'));
            setTimeout(() => callout(rel, title, 'c-hu', I18.fan(e.title) + (e.fan ? ' · ' + T('nFan', { n: e.fan }) : ''), 'big'), delay);
            if (feederOf(e) >= 0) bombFly(feederOf(e), e.s, delay); else zimoBurst(e.s, delay);
            const tot = e.amt * e.payers.length;
            flyMoney(e.s, tot, delay + 500);
            for (const p of e.payers) { flyMoney(p, -e.amt, delay + 500); coins(p, e.s, 5, delay + 250); }
            setTimeout(() => SND.play('coin'), delay + 600);
            if (e.s === me) SND.vib([60, 40, 120]);
            delay += 700;
            break;
          }
          case 'multi': sc(e.n === 3 ? 'multi3' : 'multi2'); setTimeout(() => callout(relOf(e.from), T(e.n === 3 ? 'cMulti3' : 'cMulti2'), 'c-hu', null, 'mid'), delay + 200); break;
          case 'tsAsk': if (e.to === me) { SND.play('turn'); SND.vib([30, 50, 30]); } break;
          case 'tswap':
            if (e.ok) {
              SND.play('swap');
              callout(relOf(e.s), T('cTs'), 'c-rain', null, 'sm');
              if (e.s !== me && e.to !== me) flyBacks(relOf(e.s), relOf(e.to));
            } else if (!e.back) {
              callout(relOf(e.to), T('cTsNo'), 'c-wind', null, 'sm');
              if (e.s === me) opt.toast && opt.toast(T('tsNoT'));
            }
            break;
          case 'zhuan': setTimeout(() => { callout(relOf(e.to), T('cZhuan'), 'c-rain', null, 'sm'); flyMoney(e.to, e.amt); flyMoney(e.from, -e.amt); coins(e.from, e.to, 3, 0); }, delay + 900); break;
          case 'end': {
            if (e.reason === 'wall') { SND.play('end'); callout(0, T(R.wins.length ? 'cWall' : 'cDraw'), 'c-wind', R.result && R.result.info.some(x => x && (x.hua || !x.ting)) ? T('cCha') : null, 'mid'); }
            break;
          }
        }
      }
    }

    // ======================= 手势：点选、滑动、上拖出牌 =======================
    function canDiscard(id) {
      const R = v.R, o = v.opt;
      if (!o || o.k !== 'turn' || !R.hand.includes(id) || tsMode) return false;
      if (o.queLock && SU(TY(id)) !== R.que[me]) return false;
      return true;
    }
    function doDiscard(id) {
      if (!canDiscard(id)) return false;
      sel = null; tip.hidden = true;
      onAct({ k: 'discard', id });
      return true;
    }
    function handIdAt(x, y) {
      // 按自己手牌的位置找最近的一张
      let best = null, bd = 1e9;
      for (const [key, rec] of els) {
        if (!rec.cls.includes('stand')) continue;
        const p = lastPos.get(key); if (!p) continue;
        const dx = Math.abs(p.x - x);
        if (dx < Gm.hw * 0.55 && y > p.y - Gm.hh * 1.1 && y < p.y + Gm.hh * 0.75 && dx < bd) { bd = dx; best = +key; }
      }
      return best;
    }
    function tapTile(id) {
      const R = v.R, o = v.opt;
      if (!o) return;
      if (tsMode && o.k === 'turn') { tsGive = tsGive === id ? null : id; SND.play('select'); render(true); return; }
      if (o.k === 'swap') {
        const su = SU(TY(id));
        const i = swapSel.indexOf(id);
        if (i >= 0) swapSel.splice(i, 1);
        else if (swapSel.length && SU(TY(swapSel[0])) !== su) swapSel = [id];
        else { if (swapSel.length >= 3) swapSel.shift(); swapSel.push(id); }
        SND.play('select');
        render(true);
        return;
      }
      if (o.k !== 'turn') { sel = sel === id ? null : id; SND.play('select'); render(true); return; }
      if (sel === id) { if (!doDiscard(id)) hintNoDiscard(id); return; }
      if (o.queLock && SU(TY(id)) !== R.que[me]) { hintNoDiscard(id); }
      sel = id; SND.play('select'); render(true);
    }
    function hintNoDiscard(id) {
      const R = v.R;
      if (v.opt && v.opt.queLock && SU(TY(id)) !== R.que[me]) opt.toast && opt.toast(T('toastQue', { s: T('suit')[R.que[me]] }));
    }
    root.addEventListener('pointerdown', e => {
      if (!v || !v.R || !Gm) return;
      const rr = root.getBoundingClientRect();
      const x = e.clientX - rr.left, y = e.clientY - rr.top;
      if (y < Gm.handTop - Gm.hh * 0.8) {
        // 挑换牌时，可以直接点上面队友的牌
        const te = tsMode && e.target.closest ? e.target.closest('.t.mate') : null;
        if (te) { const id = +te.dataset.k; tsTake = tsTake === id ? null : id; if (tsTake != null && tsGive == null && tsWinTiles().includes(TY(tsTake))) tsGive = tsGiveFor(tsTake); SND.play('select'); render(true); return; }
        if (e.target === root || e.target.classList.contains('t') || e.target.closest('.t')) { if (sel != null && v.opt && v.opt.k !== 'swap') { sel = null; render(true); } }
        return;
      }
      const id = handIdAt(x, y);
      if (id == null) return;
      drag = { id, x0: x, y0: y, x, y, moved: false, up: false, pid: e.pointerId, t0: Date.now(), start: id };
      try { root.setPointerCapture(e.pointerId); } catch (er) {}
    });
    root.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.pid) return;
      const rr = root.getBoundingClientRect();
      drag.x = e.clientX - rr.left; drag.y = e.clientY - rr.top;
      const dy = drag.y - drag.y0, dx = drag.x - drag.x0;
      if (!drag.up && dy < -Gm.hh * 0.45 && Math.abs(dy) > Math.abs(dx) && canDiscard(drag.id)) { drag.up = true; sel = drag.id; }
      if (drag.up) {
        const rec = els.get(String(drag.id)); if (!rec) return;
        const p = lastPos.get(String(drag.id));
        rec.el.style.transition = 'none';
        rec.el.style.transform = tfOf({ x: p.x + dx, y: p.y + dy, k: Gm.hk * 1.08, r: 0 });
        rec.el.style.zIndex = 50;
        return;
      }
      // 横着滑：选中手指下面那张
      if (Math.abs(dx) > 6) {
        drag.moved = true;
        const id = handIdAt(drag.x, Math.max(drag.y, Gm.handTop));
        if (id != null && id !== drag.id) { drag.id = id; if (v.opt && v.opt.k !== 'swap') { sel = id; SND.play('select'); render(true); } }
      }
    });
    const endDrag = e => {
      if (!drag || (e && e.pointerId !== drag.pid)) return;
      const d = drag; drag = null;
      if (d.up) {
        const rec = els.get(String(d.id));
        if (rec) { rec.el.style.transition = ''; rec.tf = ''; }
        if (d.y - d.y0 < -Gm.hh * 1.1 && doDiscard(d.id)) return;
        render(true);
        return;
      }
      if (d.moved) { if (v.opt && v.opt.k === 'swap') tapTile(d.id); return; }
      tapTile(d.id);
    };
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', () => { if (drag) { const rec = els.get(String(drag.id)); if (rec) { rec.el.style.transition = ''; rec.tf = ''; } drag = null; render(true); } });

    // ======================= 刷新 =======================
    function render(local) {
      if (!v) return;
      ensureGeom(false);
      const P = layoutTiles();
      applyTiles(P, fresh && !local);
      layoutStages();
      renderPlates();
      renderCompass();
      renderActs();
      renderHuHint();
      renderBanner();
      renderTs();
      renderTip();
      renderStatus();
      fresh = false;
    }
    function update(nv) {
      const prev = v;
      v = nv; me = nv.me;
      const R = v.R;
      if (!R) { clearTiles(); renderPlates && Gm && renderPlates(); return; }
      const rk = R.no + ':' + me;
      // 换了一张新牌桌（再来一场、换房间）事件编号会从头数：跟着从头数，不然这一场的特效全被当成看过的
      if (nv.evn != null && nv.evn < lastEv) lastEv = (R.ev && R.ev.length) ? Math.max(0, R.ev[0].n - 1) : 0;
      const evs = (R.ev || []).filter(e => e.n > lastEv);
      const gap = evs.length && evs[0].n > lastEv + 1 && lastEv > 0;
      if (rk !== roundKey) {
        // 新的一局：清掉上一局的牌
        clearTiles();
        roundKey = rk; sel = null; swapSel = []; swapFor = ''; queRec = -1; selfSkip = ''; showWaits = false; gotIds = new Set(); swapFrom = -1; tsMode = false; tsTake = tsGive = null;
        fresh = !evs.some(e => e.k === 'deal') || gap;
        if (!fresh) dealUntil = Date.now() + 300;
      } else if (gap && evs.length > 25) fresh = true;
      if (R.evn != null) {}
      // 换完三张：拿到的三张亮一下
      const sw = evs.find(e => e.k === 'swap');
      if (sw && evs.length < 30) { queHold = Date.now() + 1500; setTimeout(() => render(true), 1550); }
      if (sw && Gm) {
        // 另外三家扣着的三张飞给收牌的人
        for (let rel = 1; rel < 4; rel++) {
          const st = stages[rel]; if (st.hidden) continue;
          const toRel = relOf((seatOf(rel) + sw.dir) % 4), a = anchor(rel, 'stage');
          const b = toRel === 0 ? { x: Gm.W / 2, y: Gm.handY } : (Gm['oh' + toRel] || anchor(toRel, 'hand'));
          const c = st.cloneNode(true); c.style.zIndex = 39; root.appendChild(c);
          const an = c.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${(b.x - a.x).toFixed(1)}px,${(b.y - a.y).toFixed(1)}px) scale(.75)`, opacity: 0.1 }], { duration: 560, easing: 'cubic-bezier(.4,0,.6,1)' });
          an.onfinish = () => c.remove(); setTimeout(() => c.remove(), 900);
        }
      }
      if (sw && R.swapGot) {
        gotIds = new Set(R.swapGot); gotUntil = Date.now() + 2600;
        swapFrom = (me - sw.dir + 4) % 4;
        // 自己换出去的三张飞向对方
        if (prev && prev.R && prev.R.swapPick) {
          const to = relOf((me + sw.dir) % 4), a = Gm ? (Gm['oh' + to] || anchor(to, 'hand')) : null;
          for (const id of prev.R.swapPick) {
            const rec = els.get(String(id)); if (!rec || !a) continue;
            leaving.add(String(id));
            rec.el.style.zIndex = 40;
            rec.el.style.transform = tfOf({ x: a.x, y: a.y, k: Gm.rk * 0.8, r: 0 });
            rec.el.style.opacity = '0.2';
            setTimeout(() => { rec.el.remove(); els.delete(String(id)); leaving.delete(String(id)); lastPos.delete(String(id)); }, 420);
          }
        }
        setTimeout(() => render(true), 2700);
      }
      if (v.opt && v.opt.k === 'que' && queRec < 0) queRec = -1;
      // 2v2：不是我出牌（或者不能换了）就收起换牌；换完的两张亮一下
      if (!(v.opt && v.opt.k === 'turn' && v.opt.ts)) { tsMode = false; tsTake = tsGive = null; }
      if (tsTake != null && !(R.mateHand || []).includes(tsTake)) tsTake = null;
      if (tsGive != null && !(R.hand || []).includes(tsGive)) tsGive = null;
      const tsw = evs.find(e => e.k === 'tswap' && e.ok && (e.s === me || e.to === me));
      if (tsw && evs.length < 30) { gotIds = new Set([tsw.take, tsw.give]); gotUntil = Date.now() + 2600; swapFrom = -1; setTimeout(() => render(true), 2650); }
      if (sel != null && !(R.hand || []).includes(sel)) sel = null;
      if (!(v.opt && v.opt.k === 'turn')) { if (sel != null && R.phase === 'play' && !(v.opt && v.opt.k === 'turn')) sel = null; }
      // 摸到牌：如果没选，自动选中刚摸的那张？（不自动，留给玩家）
      lastEv = evs.length ? evs[evs.length - 1].n : lastEv;
      render(false);
      if (!fresh && evs.length && evs.length < 30) effects(evs);
      renderClock();
      // 一局结束：等动画演完再弹结算
      clearTimeout(endTimer);
      if (R.phase === 'end' && opt.onEnd) {
        const justEnded = evs.some(e => e.k === 'end');
        endTimer = setTimeout(() => opt.onEnd(v), justEnded ? (R.wins.length && evs.some(e => e.k === 'hu') ? 2600 : 1900) : 300);
      }
    }
    function clearTiles() {
      for (const rec of els.values()) rec.el.remove();
      els.clear(); lastPos.clear(); leaving.clear();
      for (const oh of ohands) { oh.innerHTML = ''; oh._k = ''; oh.hidden = true; }
      for (const st of stages) st.hidden = true;
      acts.innerHTML = ''; acts._k = ''; acts.hidden = true;
      banner.hidden = true; banner._k = ''; tip.hidden = true;
      tsPanel.hidden = true; tsPanel._k = ''; mateTray.hidden = true;
    }
    function relayout() {
      if (!v) return;
      Gm = null; ensureGeom(true);
      fresh = true; render(false);
    }
    let rT = 0;
    G.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(relayout, 120); });

    return {
      update, relayout, bubble,
      get view() { return v; },
      setPrefs(o) { Object.assign(prefs, o); if (v) render(true); },
      geom: () => Gm,
      clear() { clearTiles(); v = null; lastEv = 0; roundKey = ''; fresh = true; },
    };
  }

  // ======================= 结算面板（HTML） =======================
  function ledgerLines(v, s) {
    const R = v.R, me = v.me;
    const N = x => (x === me ? T('you') : (v.seats[x] ? v.seats[x].name : ''));
    const acc = new Map();
    const add = (k, a) => { if (!a) return; acc.set(k, (acc.get(k) || 0) + a); };
    for (const L of R.ledger || []) {
      const tot = L.from.reduce((a, f) => a + f.amt, 0);
      const mine = L.from.find(f => f.s === s);
      if (L.k === 'hu') {
        if (L.to === s) { const h = HOW(L.how); add(T(L.fan ? 'lHu' : 'lHu0', { h: h.charAt(0).toUpperCase() + h.slice(1), t: I18.fan(L.title), f: L.fan }) + (L.from.length > 1 ? T('lHuN', { n: L.from.length }) : ''), tot); }
        else if (mine) add(T(L.how === 'zimo' ? 'lPayZimo' : L.how === 'dgh' ? 'lPayDgh' : L.how === 'rob' ? 'lPayRob' : 'lPayPao', { n: N(L.to) }), -mine.amt);
      } else if (L.k === 'gang') {
        const w = T(L.kind === 'an' ? 'cRain' : 'cWind');
        if (L.to === s) add(T('lGang', { w, k: T(L.kind === 'an' ? 'kAn' : L.kind === 'bu' ? 'kBu' : 'kMing') }), tot);
        else if (mine) add(T('lGangPay', { n: N(L.to), w }), -mine.amt);
      } else if (L.k === 'zhuan') {
        if (L.to === s) add(T('lZhuan'), tot); else if (mine) add(T('lZhuanPay', { n: N(L.to) }), -mine.amt);
      } else if (L.k === 'pig') {
        if (L.to === s) add(T('lPig'), tot); else if (mine) add(T('lPigPay'), -mine.amt);
      } else if (L.k === 'cha') {
        if (L.to === s) add(T('lCha', { f: L.fan }), tot); else if (mine) add(T('lChaPay'), -mine.amt);
      } else if (L.k === 'tax') {
        if (L.to === s) add(T('lTax'), tot); else if (mine) add(T('lTaxPay'), -mine.amt);
      }
    }
    return [...acc.entries()];
  }
  function handHTML(v, s) {
    const R = v.R;
    let h = '';
    for (const m of R.melds[s]) {
      const n = m.k === 'peng' ? 3 : 4;
      for (let j = 0; j < n; j++) h += mini(m.k === 'angang' && j !== 3 ? -1 : m.t, (j === 0 ? 'gap' : '') + (m.k === 'angang' && j !== 3 ? ' back' : ''));
    }
    const hand = (R.hands ? R.hands[s] : R.shown[s] || []).slice().sort((a, b) => a - b);
    hand.forEach((id, i) => { h += mini(TY(id), i === 0 && R.melds[s].length ? 'gap' : ''); });
    const w = R.wins.find(x => x.s === s);
    if (w) h += mini(w.t, 'gap win');
    return h;
  }
  // 2v2：我方、对方各一行（头像、名字、合计）
  function teamsHTML(v, vals, big) {
    const me = v.me, us = [me, (me + 2) % 4], them = [(me + 1) % 4, (me + 3) % 4];
    const one = (arr, lab, cls) => {
      const d = arr.reduce((a, s) => a + (vals[s] || 0), 0);
      return `<div class="tmx ${cls}"><div class="avs">${arr.map(s => `<span class="av">${avSvg(v.seats[s], s)}</span>`).join('')}</div>` +
        `<div class="lb">${lab}<small>${arr.map(s => esc(s === me ? T('you') : (v.seats[s] ? v.seats[s].name : ''))).join(' · ')}</small></div><div class="d ${d > 0 ? 'p' : d < 0 ? 'm' : 'z'}">${fmt(d)}</div></div>`;
    };
    return `<div class="teams${big ? ' big' : ''}">${one(us, T('teamUs'), 'us')}${one(them, T('teamThem'), 'them')}</div>`;
  }
  function resultHTML(v) {
    const R = v.R, me = v.me, res = R.result;
    const order = v.rules.team ? [me, (me + 2) % 4, (me + 1) % 4, (me + 3) % 4] : [0, 1, 2, 3].map(k => (me + k) % 4);
    let h = `<div class="res-head"><span class="t1">${T(res.reason === 'wall' && !R.wins.length ? 'resDraw' : 'resEnd')}</span><span class="t2">${v.rules.rounds ? T('roundOf', { r: R.no, n: v.rules.rounds }) : T('roundN', { r: R.no })}${v.over ? ' · ' + T('resLast') : ''}</span></div>`;
    if (v.rules.team) h += teamsHTML(v, res.deltas);
    for (const s of order) {
      const p = v.seats[s]; if (!p) continue;
      const d = res.deltas[s];
      const w = R.wins.find(x => x.s === s);
      const inf = res.info[s];
      let sub = '';
      if (w) sub = T('winOrder', { o: T('ord')[w.order] || '', h: HOW(w.how) });
      else if (inf) sub = inf.hua ? T('hua') : inf.ting ? T('tingMax', { f: inf.max }) : T('noTing');
      if (R.dealer === s) sub = sub ? T('dealerP') + sub : T('dealerW');
      const lines = ledgerLines(v, s);
      const fd = feederOf(w);
      const hic = !w ? '' : fd >= 0 && v.seats[fd] ? `<span class="rhow pao">${IC.bomb}<span class="fav">${avSvg(v.seats[fd], fd)}</span></span>` : `<span class="rhow zimo">${IC.zimo}</span>`;
      h += `<div class="rp${s === me ? ' me' : ''}"><div class="top"><div class="av">${avSvg(p, s)}</div><div class="nm">${esc(p.name)}${s === me ? T('youS') : ''}<small>${hic}${esc(sub)}</small></div><div class="d ${d > 0 ? 'p' : d < 0 ? 'm' : 'z'}">${fmt(d)}</div></div>`;
      if (w) h += `<div class="fanbar">${w.items.map(x => `<i>${esc(I18.fan(x[0]))} ${x[1]}</i>`).join('')}</div>`;
      h += `<div class="hand">${handHTML(v, s)}</div>`;
      if (lines.length) h += `<div class="lines">${lines.map(([k, a]) => `<div><span>${esc(k)}</span><span class="a" style="color:${a > 0 ? '#ffd36b' : '#ff8c7c'}">${fmt(a)}</span></div>`).join('')}</div>`;
      h += '</div>';
    }
    h += `<div class="tot">${order.map(s => v.seats[s] ? `<div>${esc(s === me ? T('you') : v.seats[s].name)}<b style="color:${v.seats[s].score >= 0 ? '#ffd36b' : '#ff8c7c'}">${fmt(v.seats[s].score)}</b></div>` : '').join('')}</div>`;
    if (v.rules.team) {
      const sc = s => (v.seats[s] ? v.seats[s].score : 0), us = sc(me) + sc((me + 2) % 4), them = sc((me + 1) % 4) + sc((me + 3) % 4);
      h += `<div class="tot2">${T('teamTot', { a: fmt(us), b: fmt(them) })}</div>`;
    }
    return h;
  }
  function finalHTML(v) {
    const ss = v.seats.map((p, s) => p && { s, p }).filter(Boolean).sort((a, b) => b.p.score - a.p.score);
    const me = v.me;
    if (v.rules.team && me >= 0) {
      // 2v2：先说哪队赢了，再列两队和每个人
      const sc = v.seats.map(p => (p ? p.score : 0));
      const us = sc[me] + sc[(me + 2) % 4], them = sc[(me + 1) % 4] + sc[(me + 3) % 4];
      const r = us > them ? 'win' : us < them ? 'lose' : 'tie';
      let h = `<div class="res-head"><span class="t1">${T('final')}</span><span class="t2">${T('finalRounds', { n: v.roundNo })}</span></div>`;
      h += `<div class="tres ${r}">${T(r === 'win' ? 'teamWin' : r === 'lose' ? 'teamLose' : 'teamTie')}</div>` + teamsHTML(v, sc, true);
      ss.forEach((x, i) => {
        const wins = v.hist.reduce((a, rr) => a + rr.wins.filter(w => w.s === x.s).length, 0);
        const zm = v.hist.reduce((a, rr) => a + rr.wins.filter(w => w.s === x.s && w.how === 'zimo').length, 0);
        const big = v.hist.reduce((a, rr) => Math.max(a, ...rr.wins.filter(w => w.s === x.s).map(w => w.fan), 0), 0);
        const mine = x.s === me || x.s === (me + 2) % 4;
        h += `<div class="rp${x.s === me ? ' me' : ''}${mine ? ' us' : ''}"><div class="top"><div class="av">${avSvg(x.p, x.s)}</div><div class="nm">${esc(x.p.name)}${x.s === me ? T('youS') : x.s === (me + 2) % 4 ? ` · ${T('mateTag')}` : ''}<small>${T('finalLine', { w: wins, z: zm })}${big ? T('bigFan', { f: big }) : ''}</small></div><div class="d ${x.p.score > 0 ? 'p' : x.p.score < 0 ? 'm' : 'z'}">${fmt(x.p.score)}</div></div></div>`;
      });
      return h;
    }
    const pod = [ss[1], ss[0], ss[2]].filter(Boolean);
    const H = { 0: 92, 1: 66, 2: 46 };
    let h = `<div class="res-head"><span class="t1">${T('final')}</span><span class="t2">${T('finalRounds', { n: v.roundNo })}</span></div><div class="podium">`;
    for (const x of pod) {
      const rank = ss.indexOf(x);
      h += `<div class="pp"><div class="av">${avSvg(x.p, x.s)}</div><div class="s" style="color:${x.p.score >= 0 ? '#ffd36b' : '#ff8c7c'}">${fmt(x.p.score)}</div><div class="bar" style="height:${H[rank]}px">${rank + 1}</div></div>`;
    }
    h += '</div>';
    ss.forEach((x, i) => {
      const wins = v.hist.reduce((a, r) => a + r.wins.filter(w => w.s === x.s).length, 0);
      const zm = v.hist.reduce((a, r) => a + r.wins.filter(w => w.s === x.s && w.how === 'zimo').length, 0);
      const big = v.hist.reduce((a, r) => Math.max(a, ...r.wins.filter(w => w.s === x.s).map(w => w.fan), 0), 0);
      h += `<div class="rp${x.s === me ? ' me' : ''}"><div class="top"><div class="av">${avSvg(x.p, x.s)}</div><div class="nm">${i + 1}. ${esc(x.p.name)}${x.s === me ? T('youS') : ''}<small>${T('finalLine', { w: wins, z: zm })}${big ? T('bigFan', { f: big }) : ''}</small></div><div class="d ${x.p.score > 0 ? 'p' : x.p.score < 0 ? 'm' : 'z'}">${fmt(x.p.score)}</div></div></div>`;
    });
    return h;
  }

  G.MJUI = { create, resultHTML, finalHTML, ledgerLines, avSvg, face, mini, esc };
})(typeof window !== 'undefined' ? window : globalThis);
