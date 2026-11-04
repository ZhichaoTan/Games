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

    // ---------- 固定的元素 ----------
    root.innerHTML = '';
    const felt = div('felt-ring'); root.appendChild(felt);
    const compass = div('compass', '<div class="lt"></div><div class="lt"></div><div class="lt"></div><div class="lt"></div><div class="left"><b>0</b></div><div class="clock"></div>');
    root.appendChild(compass);
    const lights = [...compass.querySelectorAll('.lt')];
    const plates = [0, 1, 2, 3].map(() => { const d = div('seat'); root.appendChild(d); return d; });
    const ohands = [0, 1, 2, 3].map(rel => { const d = div('ohand ' + (rel === 2 ? 'top' : rel ? 'side' + (rel === 1 ? ' r' : '') : '')); root.appendChild(d); return d; });
    const stages = [0, 1, 2, 3].map(() => { const d = div('ohand down'); root.appendChild(d); return d; });
    const acts = div('acts'); root.appendChild(acts);
    const gopts = div('gopts'); gopts.hidden = true; root.appendChild(gopts);
    const tip = div('tip'); tip.hidden = true; root.appendChild(tip);
    const banner = div('banner'); banner.hidden = true; root.appendChild(banner);
    const status = div('status'); status.hidden = true; root.appendChild(status);
    const tingChip = div('tingchip'); tingChip.hidden = true; root.appendChild(tingChip);
    const autoBar = div('autobar', '<span></span><button></button>'); autoBar.hidden = true; root.appendChild(autoBar);
    autoBar.querySelector('button').onclick = () => onAct({ k: '_auto', on: false });
    tingChip.onclick = () => { showWaits = !showWaits; renderTip(); };

    const relOf = s => (s - me + 4) % 4;
    const suitMark = q => I18.lang === 'en' ? `<svg class="qi"><use href="#q${q}"/></svg>` : T('suitS')[q];
    const seatOf = rel => (rel + me) % 4;
    const name = s => (v && v.seats[s] ? v.seats[s].name : '');

    // ======================= 几何 =======================
    function computeGeom(need) {
      const W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight;
      const sf = safe();
      const g = { W, H, sf };
      const L = Math.max(6, sf.l + 4), Rr = Math.max(6, sf.r + 4);
      const port = H >= W * 1.05;
      g.port = port; g.L = L; g.Rr = Rr;
      g.tbH = sf.t + 44;
      g.A0 = clamp(Math.round(Math.min(W, H) * 0.1), 34, 48);
      g.A = clamp(Math.round(Math.min(W, H) * 0.088), 30, 44);
      const bot = H - Math.max(sf.b, 4) - 6;
      if (port) {
        g.hw = Math.min(54, (W - L - Rr) / 14.4);
        g.hh = g.hw * 82 / 60;
        g.handY = bot - g.hh / 2; g.handTop = bot - g.hh;
        g.handL = L; g.handR = W - Rr;
        g.plate0 = { x: L + g.A0 / 2 + 2, y: g.handTop - 18 - g.A0 / 2 };
        g.topY = g.tbH + 4 + g.A / 2;
        g.midTop = g.tbH + g.A + 14;
        g.midBot = g.plate0.y - g.A0 / 2 - 6;
      } else {
        g.hw = Math.min(50, (W - L - Rr - g.A0 - 90) / 14.4, (H * 0.13) * 60 / 82);
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
      g.tw = Math.min(g.hw * 0.62, port ? 21 : 26);   // 对家立着的牌背
      g.colW = port ? Math.max(g.A, 34) + 4 : Math.max(g.A + 8, 56);
      g.colL = L + g.colW / 2; g.colR = W - Rr - g.colW / 2;
      if (port) {
        g.sidePlateY = g.topY + g.A + 44;
        g.stackTop = g.sidePlateY + g.A / 2 + 60;
      } else {
        // 横屏：左右两家的头像放在上面两个角，牌从头像下面往下排
        g.sidePlateY = g.tbH + g.A / 2 + 6;
        g.stackTop = g.tbH + g.A + 16;
        const tw = Math.min(g.hw * 0.62, 26), wMax = 14.5 * tw + 40;
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
      for (let pt = 6; pt <= 12; pt++) for (let ps = 5; ps <= 13; ps++) {
        const rB = Math.max(2, Math.ceil(need.tb[0] / pt)), rT = Math.max(2, Math.ceil(need.tb[1] / pt));
        const rL = Math.max(2, Math.ceil(need.sd[0] / ps)), rR = Math.max(2, Math.ceil(need.sd[1] / ps));
        const wPer = pt + (rL + rR) * 1.42 + 0.6, hPer = ps + (rB + rT) * 1.5 + 0.6;
        const rw = Math.min(Wc / wPer, Hc / hPer, port ? 30 : 34);
        const sc = rw * (1 - 0.012 * Math.abs(pt - 6) - 0.004 * Math.abs(ps - 9));
        if (!best || sc > best.sc) best = { sc, rw, pt, ps, rB, rT, rL, rR };
      }
      const rw = g.rw = best.rw; g.pt = best.pt; g.ps = best.ps;
      g.rk = rw / 60;
      g.rowH = rw * 1.5; g.rowW = rw * 1.42;
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
      if (!force && Gm && Gm.W === W && Gm.H === H && need.tb[0] <= Gm.cap.tb[0] && need.tb[1] <= Gm.cap.tb[1] && need.sd[0] <= Gm.cap.sd[0] && need.sd[1] <= Gm.cap.sd[1]) return false;
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
          if (R.claimTile && R.claimTile.id === id) cls += ' hl';
          put(String(id), TY(id), { x: q.x, y: q.y, k: g.rk, r: q.r, pose: 'flat', o: q.o, z: 5 + (rel === 2 ? 30 - Math.floor(i / g.pt) : rel === 0 ? Math.floor(i / g.pt) : 0), cls });
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
        const top = j === 3;
        const x = basePos.x + (top ? 1 : j) * o.step.dx + (top ? o.up.dx : 0);
        const y = basePos.y + (top ? 1 : j) * o.step.dy + (top ? o.up.dy : 0);
        put(key, pose === 'down' ? -1 : t, { x, y, k: o.w / 60, r: o.rot, pose, o: o.ori, z: (o.z || 6) + (top ? 3 : 0) + (o.zStep ? j * o.zStep : 0) });
      }
      // 补杠/抢杠时，第四张要摆的位置
      put('mstack' + s + '_' + m.t, -2, { x: basePos.x + o.step.dx + o.up.dx, y: basePos.y + o.step.dy + o.up.dy, k: o.w / 60, r: o.rot, pose: 'flat', o: o.ori, z: (o.z || 6) + 3, virtual: true });
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
        if (myTurn && hasQ && SU(t) !== R.que[me]) cls += ' dim';
        if (swapping && swapSel.includes(id)) { y -= g.hh * 0.3; cls += ' sel'; }
        if (!swapping && sel === id) { y -= g.hh * 0.3; cls += ' sel'; }
        if (gotIds.has(id) && Date.now() < gotUntil) cls += ' got';
        if (myTurn && prefs.hints && tingT && tingT.by[t] && !(hasQ && SU(t) !== R.que[me])) cls += tingT.best === t ? ' mkb' : ' mk';
        put(String(id), t, { x: cx, y, k: g.hk, r: 0, pose: 'stand', o: 0, z: 10 + idx, cls, hand: true });
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
      const drawnGap = !shown && R.phase === 'play' && R.turn === s && R.stage === 'discard' && (R.counts[s] % 3 === 2);
      const oh = ohands[rel];
      // 立着的牌背：用一个元素画一排
      if (rel === 2) {
        const tw = g.tw, th = tw * 1.3, mwT = Math.min(g.rw * 0.95, tw * 1.08);
        const shownN = shown ? shown.length : 0;
        const handW = shown ? shownN * mwT : hidden * tw + (drawnGap ? tw * 0.4 : 0);
        const meldW = melds.length * (3 * mwT + 4);
        const winW = win ? mwT * 1.4 : 0;
        const left = g.port ? g.L + g.A + 74 : g.topRow.l, right = g.port ? g.W - g.Rr : g.topRow.r;
        const tot = handW + meldW + winW + (melds.length ? 6 : 0);
        let x = left + Math.max(0, (right - left - tot) / 2);
        if (shown) {
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
      const units = two ? Math.max(shown ? shown.length + (win ? 1 : 0) : 0, 3 * melds.length + (shown ? 0 : win ? 1 : 0))
        : (shown ? shown.length : 0) + 3 * melds.length + (win ? 1 : 0);
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
        meldTiles(m, s, { x: cxIn, y: y + mwS / 2, i }, put, { w: mwS, rot, ori, step: { dx: 0, dy: mwS }, up: { dx: rel === 1 ? -mwS * 0.35 : mwS * 0.35, dy: 0 }, z: 6 });
        y += 3 * mwS + 5;
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
    let swapFrom = -1, queHold = 0;

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
      if (!html) { tip.hidden = true; return; }
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
          if (R.hu[s]) st = `<span class="stat hu">${T(w && w.how === 'zimo' ? 'stZimo' : 'stWon')}</span>`;
          else if (!p.conn && !p.bot) st = `<span class="stat">${T('stOff')}</span>`;
          else if (p.auto && !p.bot) st = `<span class="stat">${T('stAuto')}</span>`;
          else if (R.phase === 'swap') st = `<span class="stat">${T(R.swapDone[s] ? 'stPicked' : 'stPicking')}</span>`;
          else if (R.phase === 'que') st = `<span class="stat">${T(R.queDone[s] ? 'stQued' : 'stQuing')}</span>`;
        }
        const turn = R && R.phase === 'play' && R.stage === 'discard' && R.turn === s && !R.hu[s];
        const vert = g.port ? rel === 1 || rel === 3 : rel === 2;
        const rev = !g.port && rel === 1;
        const key = [p.name, p.av, p.bot, p.lv, score, que, st, R && R.dealer === s, turn, A, vert, rev, I18.lang].join('|');
        el.className = 'seat' + (vert ? ' vert' : '') + (rev ? ' rev' : '') + (turn ? ' turn' : '') + (R && R.hu[s] ? ' won' : '');
        el.style.setProperty('--a', A + 'px');
        if (el._k !== key) {
          el._k = key;
          el.innerHTML = `<div class="av">${avSvg(p, s)}${R && R.dealer === s ? `<span class="badge zhuang">${T('dealerB')}</span>` : ''}${que >= 0 ? `<span class="badge que" style="background:${QCOL[que]}">${suitMark(que)}</span>` : ''}${st}</div>` +
            `<div class="info"><div class="nm">${esc(p.name)}${p.bot ? `<small>${T('lv')[p.lv] || ''}</small>` : ''}</div><div class="sc${score < 0 ? ' neg' : ''}">${score > 0 ? '+' : ''}${score}</div></div>`;
        }
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
      const key = o ? JSON.stringify(o) + v.evn + I18.lang : '';
      if (acts._k === key) return;
      acts._k = key;
      acts.innerHTML = '';
      if (!o || !R || R.phase !== 'play') { acts.hidden = true; return; }
      if (o.k === 'claim') {
        if (o.peng) acts.appendChild(btn('peng', T('bPeng'), () => onAct({ k: 'peng' })));
        if (o.gang) acts.appendChild(btn('gang', T('bGang'), () => onAct({ k: 'gang' })));
        if (o.hu) acts.appendChild(btn('hu', T('bHu'), () => onAct({ k: 'hu' }), o.t));
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
          if (o.hu) acts.appendChild(btn('hu', T('bHu'), () => onAct({ k: 'zimo' })));
          acts.appendChild(btn('pass', T('bPass'), () => { selfSkip = key; acts._k = ''; renderActs(); }));
          if (o.hu) SND.vib([40, 60, 40]);
        }
      }
      acts.hidden = !acts.children.length;
      if (!acts.hidden) Object.assign(acts.style, { right: (g.Rr + 4) + 'px', bottom: (g.H - g.handTop + g.hh * 0.42 + 6) + 'px' });
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
      const top = R.phase === 'swap' && o && o.k === 'swap' ? g.box.cy - ht / 2 : g.box.cy - ht / 2;
      banner.style.top = clamp(top, g.midTop, g.handTop - ht - g.hh * 0.6) + 'px';
    }
    function renderStatus() {
      const R = v.R, g = Gm;
      let txt = '';
      if (R && R.phase === 'play') {
        if (R.hu[me]) txt = T('youWon');
        else if (v.opt && v.opt.k === 'turn' && v.opt.que) txt = T('queFirst', { s: T('suit')[R.que[me]] });
      }
      const auto = v.seats[me] && v.seats[me].auto && R && R.phase !== 'end' && !R.hu[me];
      if (auto || !tip.hidden) txt = '';
      status.hidden = !txt;
      status.classList.toggle('intb', !g.port);
      if (txt) { status.textContent = txt; Object.assign(status.style, { left: g.W / 2 + 'px', top: (g.port ? g.plate0.y - g.A0 / 2 - 24 : g.sf.t + 22) + 'px' }); }
      if (root.parentElement) root.parentElement.classList.toggle('tbmsg', !g.port && (!!txt || !!auto));
      autoBar.hidden = !auto;
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
    function dirFx(dir) {
      const g = Gm;
      const txt = T(dir === 2 ? 'dirAcross' : dir === 1 ? 'dirRight' : 'dirLeft');
      const rot = dir === 1 ? '-180deg' : dir === 3 ? '180deg' : '0deg';
      const d = fx('dirfx', `<svg viewBox="0 0 100 100"><g fill="none" stroke="#ffd36b" stroke-width="5" stroke-linecap="round">${dir === 2
        ? '<path d="M50 16V84"/><path d="M38 28L50 16L62 28M38 72L50 84L62 72"/>'
        : `<path d="M50 14A36 36 0 1 ${dir === 3 ? 1 : 0} 86 50" /><path d="${dir === 3 ? 'M78 40L86 52L94 40' : 'M14 40L22 52L30 40'}" transform="${dir === 3 ? '' : 'translate(64 0) scale(-1 1) translate(-36 0)'}"/>`}</g></svg>`, g.box.cx, g.box.cy, 1500);
      d.style.setProperty('--rot', rot);
      callout(0, txt, 'c-wind', null, 'sm');
    }
    function effects(evs) {
      const R = v.R;
      let delay = 0;
      for (const e of evs) {
        const rel = e.s != null ? relOf(e.s) : 0;
        switch (e.k) {
          case 'deal': SND.play('deal'); break;
          case 'swap': SND.play('swap'); dirFx(e.dir); break;
          case 'que': SND.play('que'); setTimeout(() => plates.forEach(p => { const b = p.querySelector('.badge.que'); if (b) { b.classList.remove('pop'); b.offsetWidth; b.classList.add('pop'); } }), 30); break;
          case 'discard': SND.play('discard'); if (SND.prefs && SND.prefs.call) SND.say(I18.tile(TY(e.id)), 1.25); break;
          case 'draw': if (e.s === me) SND.play('draw'); break;
          case 'peng': SND.play('peng'); SND.say(T('vPeng')); callout(rel, T('cPeng'), 'c-peng'); break;
          case 'gang': {
            SND.play('gang'); SND.say(T('vGang'));
            callout(rel, T('cGang'), 'c-gang', T(e.kind === 'an' ? 'cRain' : 'cWind'));
            const mult = e.kind === 'bu' ? 1 : 2, base = v.rules.base;
            if (e.kind === 'ming') { flyMoney(e.s, base * 2); flyMoney(e.from, -base * 2); }
            else { let n = 0; for (let s = 0; s < 4; s++) if (s !== e.s && !R.hu[s]) { flyMoney(s, -base * mult); n++; } flyMoney(e.s, base * mult * n); }
            break;
          }
          case 'hu': {
            const title = T(e.how === 'zimo' ? (e.items.some(x => x[0] === '杠上开花') ? 'cBloom' : 'cZimo') : e.how === 'rob' ? 'cRob' : 'cHu');
            SND.play('hu', delay / 1000); SND.say(T(e.how === 'zimo' ? 'vZimo' : 'vHu'));
            setTimeout(() => callout(rel, title, 'c-hu', `${I18.fan(e.title)} · ${T('nFan', { n: e.fan })}`, 'big'), delay);
            const tot = e.amt * e.payers.length;
            flyMoney(e.s, tot, delay + 500);
            for (const p of e.payers) flyMoney(p, -e.amt, delay + 500);
            setTimeout(() => SND.play('coin'), delay + 600);
            if (e.s === me) SND.vib([60, 40, 120]);
            delay += 700;
            break;
          }
          case 'multi': setTimeout(() => callout(relOf(e.from), T(e.n === 3 ? 'cMulti3' : 'cMulti2'), 'c-hu', null, 'mid'), delay + 200); break;
          case 'zhuan': setTimeout(() => { callout(relOf(e.to), T('cZhuan'), 'c-rain', null, 'sm'); flyMoney(e.to, e.amt); flyMoney(e.from, -e.amt); }, delay + 900); break;
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
      if (!o || o.k !== 'turn' || !R.hand.includes(id)) return false;
      if (o.que && SU(TY(id)) !== R.que[me]) return false;
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
      if (o.que && SU(TY(id)) !== R.que[me]) { hintNoDiscard(id); }
      sel = id; SND.play('select'); render(true);
    }
    function hintNoDiscard(id) {
      const R = v.R;
      if (v.opt && v.opt.que && SU(TY(id)) !== R.que[me]) opt.toast && opt.toast(T('toastQue', { s: T('suit')[R.que[me]] }));
    }
    root.addEventListener('pointerdown', e => {
      if (!v || !v.R || !Gm) return;
      const rr = root.getBoundingClientRect();
      const x = e.clientX - rr.left, y = e.clientY - rr.top;
      if (y < Gm.handTop - Gm.hh * 0.8) {
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
      renderBanner();
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
      const evs = (R.ev || []).filter(e => e.n > lastEv);
      const gap = evs.length && evs[0].n > lastEv + 1 && lastEv > 0;
      if (rk !== roundKey) {
        // 新的一局：清掉上一局的牌
        clearTiles();
        roundKey = rk; sel = null; swapSel = []; swapFor = ''; queRec = -1; selfSkip = ''; showWaits = false; gotIds = new Set(); swapFrom = -1;
        fresh = !evs.some(e => e.k === 'deal') || gap;
      } else if (gap && evs.length > 25) fresh = true;
      if (R.evn != null) {}
      // 换完三张：拿到的三张亮一下
      const sw = evs.find(e => e.k === 'swap');
      if (sw && evs.length < 30) { queHold = Date.now() + 1500; setTimeout(() => render(true), 1550); }
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
        if (L.to === s) { const h = HOW(L.how); add(T('lHu', { h: h.charAt(0).toUpperCase() + h.slice(1), t: I18.fan(L.title), f: L.fan }) + (L.from.length > 1 ? T('lHuN', { n: L.from.length }) : ''), tot); }
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
  function resultHTML(v) {
    const R = v.R, me = v.me, res = R.result;
    const order = [0, 1, 2, 3].map(k => (me + k) % 4);
    let h = `<div class="res-head"><span class="t1">${T(res.reason === 'wall' && !R.wins.length ? 'resDraw' : 'resEnd')}</span><span class="t2">${v.rules.rounds ? T('roundOf', { r: R.no, n: v.rules.rounds }) : T('roundN', { r: R.no })}${v.over ? ' · ' + T('resLast') : ''}</span></div>`;
    for (const s of order) {
      const p = v.seats[s]; if (!p) continue;
      const d = res.deltas[s];
      const w = R.wins.find(x => x.s === s);
      const inf = res.info[s];
      let sub = '';
      if (w) sub = T('winOrder', { o: T('ord')[w.order] || '', h: HOW(w.how) });
      else if (inf) sub = inf.hua ? T('hua') : inf.ting ? T('tingMax', { f: inf.max }) : T('noTing');
      if (R.dealer === s) sub = T('dealerP') + sub;
      const lines = ledgerLines(v, s);
      h += `<div class="rp${s === me ? ' me' : ''}"><div class="top"><div class="av">${avSvg(p, s)}</div><div class="nm">${esc(p.name)}${s === me ? T('youS') : ''}<small>${esc(sub)}</small></div><div class="d ${d > 0 ? 'p' : d < 0 ? 'm' : 'z'}">${fmt(d)}</div></div>`;
      if (w) h += `<div class="fanbar">${w.items.map(x => `<i>${esc(I18.fan(x[0]))} ${x[1]}</i>`).join('')}</div>`;
      h += `<div class="hand">${handHTML(v, s)}</div>`;
      if (lines.length) h += `<div class="lines">${lines.map(([k, a]) => `<div><span>${esc(k)}</span><span class="a" style="color:${a > 0 ? '#ffd36b' : '#ff8c7c'}">${fmt(a)}</span></div>`).join('')}</div>`;
      h += '</div>';
    }
    h += `<div class="tot">${order.map(s => v.seats[s] ? `<div>${esc(s === me ? T('you') : v.seats[s].name)}<b style="color:${v.seats[s].score >= 0 ? '#ffd36b' : '#ff8c7c'}">${fmt(v.seats[s].score)}</b></div>` : '').join('')}</div>`;
    return h;
  }
  function finalHTML(v) {
    const ss = v.seats.map((p, s) => p && { s, p }).filter(Boolean).sort((a, b) => b.p.score - a.p.score);
    const me = v.me;
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
