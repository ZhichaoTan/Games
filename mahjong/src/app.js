// ===== 应用：大厅、房间、房主（权威牌桌 + 电脑 + 计时）、PeerJS 联网、菜单和结算 =====
(function () {
  'use strict';
  const W = window, MJ = W.MJ, AI = W.MJAI, UIM = W.MJUI, SND = W.MJSound, I18 = W.MJI18N, AV = W.Art, ART = W.MJArt;
  const T = I18.t;
  const $ = id => document.getElementById(id);
  const esc = UIM.esc;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('mh_' + k)); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem('mh_' + k); else localStorage.setItem('mh_' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const rid = n => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const PREFIX = 'yejumj-v1-';
  const qs = new URLSearchParams(location.search);
  const ICE = [
    { urls: 'stun:stun.miwifi.com:3478' }, { urls: 'stun:stun.qq.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ];
  function peerOpts() {
    const o = { config: { iceServers: ICE, iceCandidatePoolSize: 4 }, debug: 1 };
    const ph = qs.get('ph');
    if (ph) { const [h, p] = ph.split(':'); Object.assign(o, { host: h, port: +p || 9000, path: '/', secure: false, config: { iceServers: [] } }); }
    return o;
  }
  const EMOS = ['😂', '😭', '😡', '😎', '🤔', '👍', '🙏', '💰', '🔥', '😱', '🤡', '🥳'];

  // ---------------- 素材 ----------------
  $('sprite').innerHTML = AV.sprite('') + ART.sprite();
  (function noise() {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const x = c.getContext('2d'), d = x.createImageData(96, 96);
      for (let i = 0; i < d.data.length; i += 4) { const g = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = g; d.data[i + 3] = 22; }
      x.putImageData(d, 0, 0);
      document.documentElement.style.setProperty('--noise', `url(${c.toDataURL()})`);
    } catch (e) {}
  })();

  // ---------------- 身份和偏好（名字、头像、token 跟扑克共用） ----------------
  let token = store.get('token'); if (!token) { token = rid(16); store.set('token', token); }
  let myName = store.get('name') || '';
  let myAv = store.get('av'); if (myAv == null || !(myAv >= 0 && myAv < AV.AVATARS.length)) myAv = Math.floor(Math.random() * AV.AVATARS.length);
  const P = Object.assign({ hints: true, speed: 'normal', bot: 3, tab: 'solo', more: false }, store.get('mj_prefs') || {});
  P.rules = MJ.cleanRules(P.rules);
  const saveP = () => store.set('mj_prefs', P);

  // ---------------- 小工具：提示、遮罩、抽屉 ----------------
  let toastT = 0;
  function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.hidden = false; t.style.animation = 'none'; t.offsetWidth; t.style.animation = ''; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2400); }
  function overlay(html, btns) {
    const o = $('overlay'), c = $('ovCard');
    if (!html) { o.hidden = true; return; }
    c.innerHTML = html + (btns && btns.length ? '<div class="ovb"></div>' : '');
    if (btns) { const b = c.querySelector('.ovb'); for (const [txt, cls, fn] of btns) { const x = document.createElement('button'); x.className = 'btn sm ' + cls; x.textContent = txt; x.onclick = fn; b.appendChild(x); } }
    o.hidden = false;
  }
  let sheetOn = null, sheetLock = false;
  function sheet(html, opt) {
    opt = opt || {};
    const sh = $('sheet'), bg = $('sheetBg');
    sh.innerHTML = html;
    sheetOn = opt.id || 'x'; sheetLock = !!opt.lock;
    bg.hidden = false; requestAnimationFrame(() => { bg.classList.add('on'); sh.classList.add('on'); });
    sh.scrollTop = 0;
    sh.querySelectorAll('[data-close]').forEach(b => b.onclick = closeSheet);
    return sh;
  }
  function closeSheet() {
    const sh = $('sheet'), bg = $('sheetBg');
    sh.classList.remove('on'); bg.classList.remove('on');
    sheetOn = null; sheetLock = false;
    setTimeout(() => { if (!sheetOn) bg.hidden = true; }, 300);
  }
  $('sheetBg').onclick = () => { if (!sheetLock) closeSheet(); };
  const head = (title, x) => `<h3>${title}<span class="grow"></span>${x === false ? '' : '<button class="x" data-close><svg viewBox="0 0 24 24"><use href="#i-close"/></svg></button>'}</h3>`;
  function copyText(s) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).then(() => true, () => fallback());
    return Promise.resolve(fallback());
    function fallback() { const ta = document.createElement('textarea'); ta.value = s; ta.style.cssText = 'position:fixed;top:-100px'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok; }
  }
  const inviteUrl = code => location.origin + location.pathname + '#' + code;
  function invite(code, share) {
    const text = T('invite', { c: code, u: inviteUrl(code) });
    if (share && navigator.share) { navigator.share({ title: T('title'), text, url: inviteUrl(code) }).catch(() => {}); return; }
    copyText(text).then(ok => toast(ok ? T('copied') : text, 3200));
  }

  // ---------------- 屏幕 ----------------
  function show(id) { for (const x of ['lobby', 'room', 'game']) $(x).hidden = x !== id; if (id !== 'game') closeSheet(); }

  // =====================================================================
  //                                大厅
  // =====================================================================
  function applyStatic() {
    document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = T(el.dataset.t); });
    $('nick').placeholder = T('namePh');
    $('btnLang').querySelector('span').textContent = T('langBtn');
    document.title = T('title');
    paintFan();
  }
  // 标题上的一把牌。英文界面不放带汉字的万子（换成条、筒），跟主页一样每种语言的图案各自统一
  const FAN = { zh: [4, 9, 22, 0, 16], en: [13, 9, 22, 18, 16] };
  (function fan() {
    const f = $('fan');
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div');
      d.className = 'ft';
      d.style.transform = `rotate(${(i - 2) * 13}deg)`;
      d.style.animationDelay = (i * 90) + 'ms';
      d.innerHTML = '<i class="tb"></i><i class="tf"></i>';
      f.appendChild(d);
    }
  })();
  function paintFan() { // data-tile, not data-t: applyStatic fills every [data-t] with text
    const ts = FAN[I18.lang === 'zh' ? 'zh' : 'en'];
    $('fan').querySelectorAll('.ft .tf').forEach((el, i) => { if (el.dataset.tile !== String(ts[i])) { el.dataset.tile = ts[i]; el.innerHTML = UIM.face(ts[i]); } });
  }
  function paintMe() {
    $('meAv').innerHTML = `<svg viewBox="0 0 100 100"><use href="#av${myAv}"/></svg>`;
    const g = $('avs'); g.innerHTML = '';
    AV.AVATARS.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = i === myAv ? 'on' : '';
      b.setAttribute('aria-label', a.en);
      b.innerHTML = `<svg viewBox="0 0 100 100"><use href="#av${i}"/></svg>`;
      b.onclick = () => { myAv = i; store.set('av', i); paintMe(); SND.play('tap'); };
      g.appendChild(b);
    });
  }
  $('nick').value = myName;
  $('nick').addEventListener('input', () => { $('lobErr').textContent = ''; });
  function needName() {
    const n = $('nick').value.trim().slice(0, 10);
    if (!n) { $('lobErr').textContent = T('needName'); $('nick').focus(); return false; }
    myName = n; store.set('name', n); return true;
  }
  // 选项
  const OPT = {
    rounds: { lab: 'oRounds', vals: [4, 8, 12, 16, 0], txt: v => (v ? T('nRounds', { n: v }) : T('noLimit')) },
    cap: { lab: 'oCap', vals: [2, 3, 4, 5, 6, 0], txt: v => (v ? T('nFan', { n: v }) : T('noCap')) },
    zimo: { lab: 'oZimo', vals: ['di', 'fan'], txt: v => T(v === 'di' ? 'zDi' : 'zFan') },
    dgh: { lab: 'oDgh', vals: ['pao', 'zimo'], txt: v => T(v === 'pao' ? 'dPao' : 'dZimo') },
    swap: { lab: 'oSwap', vals: [true, false], txt: v => T(v ? 'on' : 'off') },
    base: { lab: 'oBase', vals: [1, 2, 5, 10], txt: v => String(v) },
    timer: { lab: 'oTimer', vals: [0, 15, 20, 30], txt: v => (v ? T('tSec', { n: v }) : T('tOff')) },
    team: { lab: 'oMode', vals: [false, true], txt: v => T(v ? 'mTeam' : 'mFree') },
    tswap: { lab: 'oTsw', vals: [1, 2, 3, 5, 0], txt: v => (v ? String(v) : T('noLimit')) },
    queFirst: { lab: 'oQue', vals: [false, true], txt: v => T(v ? 'qFirst' : 'qFree') },
  };
  const BOTV = [1, 2, 3, 4, 0];
  const botTxt = v => (v ? T('lv')[v] : T('lvMix'));
  function segRow(lab, vals, cur, txt, set) {
    const row = document.createDocumentFragment();
    const l = document.createElement('span'); l.textContent = lab; row.appendChild(l);
    const seg = document.createElement('div'); seg.className = 'seg';
    for (const v of vals) {
      const b = document.createElement('button');
      b.textContent = txt(v); b.className = v === cur ? 'on' : '';
      b.onclick = () => { set(v); SND.play('tap'); renderOpts(); };
      seg.appendChild(b);
    }
    row.appendChild(seg);
    return row;
  }
  function extrasRow() {
    const row = document.createDocumentFragment();
    const l = document.createElement('span'); l.textContent = T('oExtra'); row.appendChild(l);
    const seg = document.createElement('div'); seg.className = 'seg';
    for (const [k, lab] of [['yjjd', 'xYjjd'], ['mqzz', 'xMqzz'], ['tdh', 'xTdh']]) {
      const b = document.createElement('button');
      b.textContent = T(lab); b.className = P.rules[k] ? 'on' : '';
      b.onclick = () => { P.rules[k] = !P.rules[k]; saveP(); SND.play('tap'); renderOpts(); };
      seg.appendChild(b);
    }
    row.appendChild(seg);
    return row;
  }
  function renderOpts() {
    for (const [id, solo] of [['optsHost', false], ['optsSolo', true]]) {
      const box = $(id); box.innerHTML = '';
      const rule = k => segRow(T(OPT[k].lab), OPT[k].vals, P.rules[k], OPT[k].txt, v => { P.rules[k] = v; saveP(); });
      box.appendChild(segRow(T('oBots'), BOTV, P.bot, botTxt, v => { P.bot = v; saveP(); }));
      if (solo) box.appendChild(segRow(T('oSpeed'), ['fast', 'normal', 'slow'], P.speed, v => T(v === 'fast' ? 'spFast' : v === 'slow' ? 'spSlow' : 'spNormal'), v => { P.speed = v; saveP(); }));
      box.appendChild(rule('team'));
      if (P.rules.team) box.appendChild(rule('tswap'));
      box.appendChild(rule('rounds'));
      box.appendChild(rule('cap'));
      if (!solo) box.appendChild(rule('timer'));
      if (P.more) { box.appendChild(rule('zimo')); box.appendChild(rule('dgh')); box.appendChild(rule('swap')); box.appendChild(rule('queFirst')); box.appendChild(rule('base')); box.appendChild(extrasRow()); }
      const m = document.createElement('button'); m.className = 'more2'; m.textContent = P.more ? '−' : T('moreRules');
      m.onclick = () => { P.more = !P.more; saveP(); renderOpts(); };
      const sp = document.createElement('span'); box.appendChild(sp); box.appendChild(m);
    }
  }
  function setTab(k) {
    P.tab = k; saveP();
    const i = ['join', 'host', 'solo'].indexOf(k);
    $('tabs').querySelector('.pill').style.transform = `translateX(${i * 100}%)`;
    $('tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === k));
    $('paneJoin').hidden = k !== 'join'; $('paneHost').hidden = k !== 'host'; $('paneSolo').hidden = k !== 'solo';
    $('lobErr').textContent = '';
  }
  $('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { setTab(b.dataset.tab); SND.play('tap'); });
  $('joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
  $('btnJoin').onclick = () => {
    if (!needName()) return;
    const c = $('joinCode').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(c)) { $('lobErr').textContent = T('badCode'); return; }
    startClient(c);
  };
  $('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
  $('btnCreate').onclick = () => { if (!needName()) return; startHost({ solo: false }); };
  $('btnSolo').onclick = () => { if (!needName()) return; startHost({ solo: true }); };
  $('btnRules').onclick = () => showRules();
  $('btnLang').onclick = () => { I18.setLang(I18.lang === 'zh' ? 'en' : 'zh'); refreshLang(); SND.play('tap'); };
  function refreshLang() { applyStatic(); renderOpts(); renderResume(); if (S && S.view) onView(S.view, S.room, true); }
  function renderResume() {
    const box = $('resumeBox');
    const hs = store.get('mj_host'), ss = store.get('mj_solo'), cs = store.get('mj_client');
    const fresh = x => x && Date.now() - (x.at || 0) < 3 * 86400e3;
    let h = '';
    if (fresh(hs) && hs.T) h += `<div class="resume"><div class="tx">${T('resumeHost', { c: esc(hs.code), r: hs.T.roundNo || 1 })}</div><button class="btn gold sm" data-r="host">${T('resume')}</button><button class="btn glass sm" data-x="mj_host">${T('discard')}</button></div>`;
    if (fresh(ss) && ss.T) h += `<div class="resume"><div class="tx">${T('resumeSolo', { r: ss.T.roundNo || 1 })}</div><button class="btn gold sm" data-r="solo">${T('resume')}</button><button class="btn glass sm" data-x="mj_solo">${T('discard')}</button></div>`;
    if (fresh(cs) && cs.code && Date.now() - cs.at < 12 * 3600e3) h += `<div class="resume"><div class="tx">${T('resumeClient', { c: esc(cs.code) })}</div><button class="btn gold sm" data-r="client">${T('rejoin')}</button><button class="btn glass sm" data-x="mj_client">✕</button></div>`;
    box.innerHTML = h; box.hidden = !h;
    box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { store.set(b.dataset.x, null); renderResume(); });
    box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      if (!needName()) return;
      if (b.dataset.r === 'host') startHost({ solo: false, restore: hs });
      else if (b.dataset.r === 'solo') startHost({ solo: true, restore: ss });
      else startClient(cs.code);
    });
  }

  // =====================================================================
  //                       会话：练习 / 房主 / 客人
  // =====================================================================
  let S = null;
  const ui = UIM.create({ root: $('tbl'), onAct: a => S && S.act(a), toast, onEnd: v => showResult(v), prefs: { hints: P.hints } });

  // ---------- 房主（练习模式也是一个不联网的房主） ----------
  function startHost(o) {
    const solo = !!o.solo;
    const restore = o.restore || null;
    let code = restore ? restore.code : (solo ? 'SOLO' : rid(4));
    let T0;
    if (restore) { T0 = MJ.Table.fromJSON(restore.T); }
    else T0 = new MJ.Table({ rules: Object.assign({}, P.rules, solo ? { timer: 0 } : {}) });
    const tb = { T: T0 };
    const speedOf = () => P.speed;
    const host = T0.seats[0] || {};
    T0.seats[0] = Object.assign(host, { id: 'host', name: myName, av: myAv, bot: false, lv: 0, token, score: host.score || 0, conn: true, auto: !!host.auto });
    for (let s = 1; s < 4; s++) if (T0.seats[s] && !T0.seats[s].bot) T0.seats[s].conn = false;
    const conns = new Map(), seen = [0, 0, 0, 0];
    let started = !!(restore && restore.started), paused = false, peer = null, closing = false;
    const ready = [false, false, false, false];
    const timers = [null, null, null, null], deadline = [0, 0, 0, 0], timeouts = [0, 0, 0, 0];
    let autoStartT = 0, autoStartAt = 0, saveT = 0, syncQ = false;

    S = { mode: solo ? 'solo' : 'host', code, isHost: true, view: null, room: null };
    S.table = () => tb.T;   // 开发测试用：房主自己这台机器上的牌桌
    const usedNames = () => new Set(tb.T.seats.filter(Boolean).map(p => p.name));
    function botName() { const u = usedNames(); return T('botNames').find(n => !u.has(n)) || ('Bot ' + rid(2)); }
    function botLv() { return P.bot || (2 + Math.floor(Math.random() * 3)); }
    function addBot(s, lv) { tb.T.seats[s] = { id: 'b' + rid(5), name: botName(), av: 0, bot: true, lv: lv || botLv(), token: '', score: tb.T.seats[s] ? tb.T.seats[s].score : 0, conn: true, auto: false }; }
    function roomInfo(s) {
      const R = tb.T.R;
      let clock = null;
      if (R && R.phase !== 'end' && !paused) {
        const ps = tb.T.pending().filter(x => deadline[x] && !tb.T.seats[x].bot);
        if (ps.length) clock = { seats: ps, left: Math.max(0, Math.max(...ps.map(x => deadline[x])) - Date.now()) };
      }
      return { code, solo, started, paused, ready: ready.slice(), auto: autoStartAt ? Math.max(0, autoStartAt - Date.now()) : 0, clock, host: 0, me: s };
    }
    function sync() {
      if (syncQ) return; syncQ = true;
      Promise.resolve().then(() => {
        syncQ = false;
        if (closing) return;
        onView(tb.T.view(0), roomInfo(0));
        for (const [s, c] of conns) if (c.open) { try { c.send({ t: 'state', v: tb.T.view(s), room: roomInfo(s) }); } catch (e) {} }
      });
    }
    function save() {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        if (closing || !started) return;
        const data = { code, T: tb.T.toJSON(), at: Date.now(), started };
        if (tb.T.over && tb.T.R && tb.T.R.phase === 'end') { store.set(solo ? 'mj_solo' : 'mj_host', null); return; }
        store.set(solo ? 'mj_solo' : 'mj_host', data);
      }, 400);
    }
    function changed() { schedule(); sync(); save(); }
    // ----- 电脑和计时 -----
    function think(s) {
      const R = tb.T.R, sp = speedOf();
      const base = sp === 'fast' ? [250, 450] : sp === 'slow' ? [1100, 1800] : [600, 1050];
      let k = 1;
      if (R.phase === 'swap' || R.phase === 'que') k = 1.6;
      else if (R.stage === 'claim') k = 0.65;
      else if (R.stage === 'offer') k = 0.9;
      if (R.hu[0] && !solo === false) k *= 0.7;
      if (R.hu[0]) k *= 0.75;
      return (base[0] + Math.random() * (base[1] - base[0])) * k;
    }
    function clearTimer(s) { if (timers[s]) { clearTimeout(timers[s].id); timers[s] = null; } deadline[s] = 0; }
    function schedule() {
      const Tb = tb.T, R = Tb.R;
      if (!R || !started) return;
      if (paused) { for (let s = 0; s < 4; s++) clearTimer(s); return; }
      if (R.phase === 'end') { for (let s = 0; s < 4; s++) clearTimer(s); endReady(); return; }
      const pend = Tb.pending();
      for (let s = 0; s < 4; s++) if (!pend.includes(s)) clearTimer(s);
      for (const s of pend) {
        const p = Tb.seats[s], key = s + ':' + Tb.evn + ':' + R.phase + ':' + R.stage;
        if (timers[s] && timers[s].key === key) continue;
        clearTimer(s);
        if (p.bot || p.auto) timers[s] = { key, id: setTimeout(() => move(s, key, p.bot ? p.lv : 3, false), think(s)) };
        else if (!p.conn) timers[s] = { key, id: setTimeout(() => move(s, key, 3, false), 6000) };
        else if (R.stage === 'offer') {
          // 队友来要牌：20 秒不回就当不换
          const ms = 20000;
          deadline[s] = Date.now() + ms;
          timers[s] = { key, id: setTimeout(() => move(s, key, 3, 'offer'), ms + 300) };
        }
        else if (Tb.rules.timer > 0) {
          const ms = Tb.rules.timer * 1000 * (R.phase === 'play' ? 1 : 2);
          deadline[s] = Date.now() + ms;
          timers[s] = { key, id: setTimeout(() => move(s, key, 3, true), ms + 300) };
        }
      }
    }
    function move(s, key, lv, timedOut) {
      const Tb = tb.T, R = Tb.R;
      timers[s] = null; deadline[s] = 0;
      if (!R || paused || key !== s + ':' + Tb.evn + ':' + R.phase + ':' + R.stage) return;
      const v = Tb.view(s);
      let a = null;
      if (timedOut === 'offer') a = { k: 'tsno' };
      else try { a = AI.decide(v, lv, Math.random); } catch (e) { a = null; }
      let r = a ? Tb.act(s, a) : 'bad';
      if (r !== 'ok') r = fallback(s, v);
      if (timedOut === true) { timeouts[s]++; if (timeouts[s] >= 2 && !Tb.seats[s].auto) { Tb.seats[s].auto = true; } }
      changed();
    }
    function fallback(s, v) {
      const Tb = tb.T, o = v.opt; if (!o) return 'no';
      if (o.k === 'claim') return Tb.act(s, { k: o.hu ? 'hu' : 'pass' });
      if (o.k === 'offer') return Tb.act(s, { k: 'tsno' });
      if (o.k === 'swap') { const h = v.R.hand; for (let su = 0; su < 3; su++) { const ids = h.filter(id => MJ.SU(MJ.TY(id)) === su); if (ids.length >= 3) return Tb.act(s, { k: 'swap', ids: ids.slice(0, 3) }); } }
      if (o.k === 'que') return Tb.act(s, { k: 'que', s: 0 });
      if (o.k === 'turn') { const h = v.R.hand; const q = v.R.que[s]; const id = (o.que ? h.filter(x => MJ.SU(MJ.TY(x)) === q) : h).slice(-1)[0]; return Tb.act(s, { k: 'discard', id }); }
      return 'no';
    }
    // ----- 一局结束：等大家准备 -----
    function endReady() {
      const Tb = tb.T;
      for (let s = 0; s < 4; s++) { const p = Tb.seats[s]; if (p && (p.bot || p.auto || !p.conn) && s !== 0) ready[s] = true; }
      if (Tb.over) { clearTimeout(autoStartT); autoStartAt = 0; return; }
      if (ready.every(Boolean)) { clearTimeout(autoStartT); autoStartAt = 0; setTimeout(nextRound, 500); return; }
      if (!solo && !autoStartAt) { autoStartAt = Date.now() + 30000; autoStartT = setTimeout(nextRound, 30000); }
    }
    function nextRound() {
      const Tb = tb.T;
      if (closing || !Tb.R || Tb.R.phase !== 'end' || Tb.over) return;
      clearTimeout(autoStartT); autoStartAt = 0;
      ready.fill(false); timeouts.fill(0);
      Tb.startRound();
      changed();
    }
    function start() {
      const Tb = tb.T;
      for (let s = 1; s < 4; s++) if (!Tb.seats[s]) addBot(s);
      started = true;
      if (!Tb.R || Tb.R.phase === 'end') { if (!Tb.R) Tb.startRound(); }
      changed();
    }
    function again() {
      const old = tb.T;
      const N = new MJ.Table({ rules: old.rules });
      N.seats = old.seats.map(p => p && Object.assign({}, p, { score: 0 }));
      tb.T = N; ready.fill(false); timeouts.fill(0);
      N.startRound();
      changed();
    }
    // ----- 自己（房主）的操作 -----
    S.act = a => {
      if (!a) return;
      if (a.k === '_auto') { tb.T.seats[0].auto = !!a.on; changed(); return; }
      if (paused) { toast(T('paused')); return; }
      const r = tb.T.act(0, a);
      if (r === 'ok') { timeouts[0] = 0; changed(); }
      else if (r === 'que') toast(T('toastQue', { s: T('suit')[tb.T.R.que[0]] }));
    };
    S.ready = () => { ready[0] = true; endReady(); sync(); };
    S.again = () => again();
    S.chat = m => broadcastChat(0, m);
    S.setAuto = on => S.act({ k: '_auto', on });
    S.setBotLv = (s, lv) => { const p = tb.T.seats[s]; if (p && p.bot) { p.lv = lv; changed(); } };
    S.kick = s => kick(s);
    S.addBot = s => { if (!started && !tb.T.seats[s]) { addBot(s); changed(); } };
    // 2v2：开局前把某个人换到对家（成为房主的队友）
    S.makeMate = s => {
      const Tb = tb.T;
      if (started || !Tb.rules.team || (s !== 1 && s !== 3)) return;
      [Tb.seats[s], Tb.seats[2]] = [Tb.seats[2], Tb.seats[s]];
      [seen[s], seen[2]] = [seen[2], seen[s]];
      [ready[s], ready[2]] = [ready[2], ready[s]];
      const ca = conns.get(s), cb = conns.get(2);
      conns.delete(s); conns.delete(2);
      if (ca) { ca._s = 2; conns.set(2, ca); try { ca.send({ t: 'welcome', seat: 2 }); } catch (e) {} }
      if (cb) { cb._s = s; conns.set(s, cb); try { cb.send({ t: 'welcome', seat: s }); } catch (e) {} }
      changed();
    };
    S.start = () => start();
    S.togglePause = () => { paused = !paused; changed(); };
    S.setSpeed = sp => { P.speed = sp; saveP(); };
    S.leave = async kind => {
      closing = true;
      for (let s = 0; s < 4; s++) clearTimer(s);
      clearTimeout(autoStartT);
      if (solo) { if (started && !(tb.T.over && tb.T.R && tb.T.R.phase === 'end')) store.set('mj_solo', { code, T: tb.T.toJSON(), at: Date.now(), started }); return; }
      if (kind === 'save' && started) {
        store.set('mj_host', { code, T: tb.T.toJSON(), at: Date.now(), started });
        for (const c of conns.values()) if (c.open) try { c.send({ t: 'saved' }); } catch (e) {}
      } else {
        store.set('mj_host', null);
        for (const [s, c] of conns) if (c.open) try { c.send({ t: 'ended', v: tb.T.view(s) }); } catch (e) {}
      }
      await sleep(500);
      try { peer && peer.destroy(); } catch (e) {}
    };
    S.endGame = () => {
      // 结束：大家看最终战绩
      tb.T.over = true;
      const v0 = tb.T.view(0);
      S.leave('end');
      return v0;
    };
    function kick(s) {
      if (s === 0) return;
      const c = conns.get(s);
      if (c) { try { c.send({ t: 'kicked' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 300); conns.delete(s); }
      if (started) addBot(s, 3); else tb.T.seats[s] = null;
      changed();
    }
    // ----- 聊天 -----
    function broadcastChat(s, m) {
      const msg = cleanChat(m); if (!msg) return;
      ui.bubble(s, msg.emo || msg.text, !!msg.emo);
      for (const c of conns.values()) if (c.open) try { c.send({ t: 'chat', s, text: msg.text, emo: msg.emo }); } catch (e) {}
    }
    function notice(txt) { toast(txt, 2600); for (const c of conns.values()) if (c.open) try { c.send({ t: 'note', text: txt }); } catch (e) {} }

    // ----- 联网 -----
    function onData(conn, m) {
      if (!m || typeof m !== 'object') return;
      const Tb = tb.T;
      if (m.t === 'hello') {
        const name = String(m.name || '').trim().slice(0, 10) || 'Guest';
        const tk = String(m.token || '').slice(0, 40);
        const av = clamp(m.av | 0, 0, AV.AVATARS.length - 1);
        let s = Tb.seats.findIndex((p, i) => i > 0 && p && !p.bot && p.token === tk);
        if (s < 0) {
          if (!started) s = [1, 2, 3].find(i => !Tb.seats[i]);
          else s = [1, 2, 3].find(i => Tb.seats[i] && Tb.seats[i].bot);
          if (s == null || s < 0) { try { conn.send({ t: 'err', code: 'full' }); } catch (e) {} setTimeout(() => { try { conn.close(); } catch (e) {} }, 600); return; }
          const prev = Tb.seats[s];
          Tb.seats[s] = { id: 'p' + rid(6), name, av, bot: false, lv: 0, token: tk, score: prev ? prev.score : 0, conn: true, auto: false };
          notice(T(prev ? 'tookOver' : 'joined', { n: name }));
        } else {
          const p = Tb.seats[s]; const back = !p.conn;
          p.name = name; p.av = av; p.conn = true;
          if (back && started) notice(T('isBack', { n: name }));
        }
        // 先换上新连接再关旧的：旧连接的 close 可能马上触发，不能把人标成掉线
        const old = conns.get(s);
        conn._s = s; conns.set(s, conn); seen[s] = Date.now();
        if (old && old !== conn) { old._s = null; try { old.close(); } catch (e) {} }
        Tb.seats[s].conn = true;
        try { conn.send({ t: 'welcome', seat: s }); } catch (e) {}
        changed();
        return;
      }
      const s = conn._s; if (s == null || conns.get(s) !== conn) return;
      seen[s] = Date.now();
      if (m.t === 'ping') { try { conn.send({ t: 'pong' }); } catch (e) {} }
      else if (m.t === 'act' && m.a && typeof m.a === 'object') {
        if (m.a.k === '_auto') { Tb.seats[s].auto = !!m.a.on; changed(); return; }
        if (paused) { try { conn.send({ t: 'err', code: 'paused' }); } catch (e) {} return; }
        const a = { k: String(m.a.k) };
        if (m.a.id != null) a.id = m.a.id | 0;
        if (m.a.t != null) a.t = m.a.t | 0;
        if (m.a.s != null) a.s = m.a.s | 0;
        if (Array.isArray(m.a.ids)) a.ids = m.a.ids.slice(0, 3).map(x => x | 0);
        if (m.a.give != null) a.give = m.a.give | 0;
        if (m.a.take != null) a.take = m.a.take | 0;
        const r = Tb.act(s, a);
        if (r === 'ok') { timeouts[s] = 0; changed(); } else { try { conn.send({ t: 'err', code: r }); } catch (e) {} sync(); }
      }
      else if (m.t === 'ready') { ready[s] = true; endReady(); sync(); }
      else if (m.t === 'chat') broadcastChat(s, m);
      else if (m.t === 'leave') {
        const p = Tb.seats[s];
        conns.delete(s);
        try { conn.send({ t: 'bye' }); } catch (e) {}
        notice(T('leftRoom', { n: p ? p.name : '' }));
        if (started) addBot(s, 3); else Tb.seats[s] = null;
        changed();
      }
    }
    function onClose(conn) {
      const s = conn._s;
      if (s != null && conns.get(s) === conn) {
        conns.delete(s);
        const p = tb.T.seats[s];
        if (p && !p.bot) { p.conn = false; if (started && !closing) notice(T('dropped', { n: p.name })); }
        changed();
      }
    }
    let tries = 0;
    function openPeer(first) {
      if (closing) return;
      peer = new Peer(PREFIX + code, peerOpts());
      peer.on('open', () => { tries = 0; setNet(true); if (first) overlay(null); if (!started) sync(); });
      peer.on('connection', conn => {
        conn.on('data', m => onData(conn, m));
        conn.on('close', () => onClose(conn));
        conn.on('error', () => {});
      });
      peer.on('disconnected', () => { setNet(false); setTimeout(() => { if (peer && !peer.destroyed && !closing) { try { peer.reconnect(); } catch (e) {} } }, 1500); });
      peer.on('error', err => {
        if (closing) return;
        if (err.type === 'unavailable-id') {
          if (!restore && first && !started) { try { peer.destroy(); } catch (e) {} code = rid(4); S.code = code; openPeer(true); return; }
          if (++tries < 15) { setNet(false); try { peer.destroy(); } catch (e) {} setTimeout(() => openPeer(first), 3000); }
          else toast(T('idTaken'));
        } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
          setNet(false); setTimeout(() => { if (closing) return; if (peer.destroyed) openPeer(first); else if (peer.disconnected) try { peer.reconnect(); } catch (e) {} }, 3000);
        }
      });
    }
    // 掉线检测
    const hb = setInterval(() => {
      if (closing) { clearInterval(hb); return; }
      const now = Date.now();
      for (const [s, c] of [...conns]) if (now - seen[s] > 11000) { onClose(c); c._s = null; try { c.close(); } catch (e) {} }
      if (tb.T.rules.timer > 0 || autoStartAt) sync();
    }, 3000);

    if (solo) {
      for (let s = 1; s < 4; s++) if (!tb.T.seats[s]) addBot(s);
      started = true;
      if (!tb.T.R || (tb.T.R.phase === 'end' && !tb.T.over && !restore)) tb.T.startRound();
      changed();
    } else {
      overlay(`<div class="spin"></div><b>${T('opening')}</b>`);
      openPeer(true);
      changed();
    }
  }
  function cleanChat(m) {
    if (!m) return null;
    if (m.emo && EMOS.includes(m.emo)) return { emo: m.emo };
    const t = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return t ? { text: t } : null;
  }

  // ---------- 客人 ----------
  function startClient(code) {
    S = { mode: 'client', code, isHost: false, view: null, room: null };
    store.set('mj_client', { code, at: Date.now() });
    let peer = null, conn = null, lastMsg = 0, ever = false, dead = false, retryT = 0, fails = 0;
    overlay(`<div class="spin"></div><b>${T('connecting', { c: code })}</b>`, [[T('cancel'), 'glass', () => { dead = true; try { peer && peer.destroy(); } catch (e) {} goLobby(); }]]);
    const send = m => { if (conn && conn.open) { try { conn.send(m); return true; } catch (e) {} } toast(T('netBad')); return false; };
    S.act = a => send({ t: 'act', a });
    S.ready = () => send({ t: 'ready' });
    S.chat = m => send(Object.assign({ t: 'chat' }, m));
    S.setAuto = on => send({ t: 'act', a: { k: '_auto', on } });
    S.leave = () => new Promise(res => {
      dead = true;
      store.set('mj_client', null);
      if (!conn || !conn.open) { try { peer && peer.destroy(); } catch (e) {} return res(); }
      const done = () => { clearTimeout(tm); S.onBye = null; setTimeout(() => { try { peer && peer.destroy(); } catch (e) {} }, 100); res(); };
      const tm = setTimeout(done, 1200);
      S.onBye = done;
      try { conn.send({ t: 'leave' }); } catch (e) { done(); }
    });
    function connect() {
      if (dead) return;
      try { conn && conn.close(); } catch (e) {}
      if (!peer || peer.destroyed || peer.disconnected) {
        try { peer && peer.destroy(); } catch (e) {}
        peer = new Peer(peerOpts());
        peer.on('open', () => dial());
        peer.on('error', err => {
          if (dead) return;
          if (err.type === 'peer-unavailable') {
            if (ever) { setNet(false); overlayNet(T('hostGone')); retry(3000); }
            else { overlay(`<b>${esc(T('notFound', { c: code }))}</b>`, [[T('backLobby'), 'glass', () => { dead = true; try { peer.destroy(); } catch (e) {} goLobby(); }]]); retry(5000); }
          } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(err.type)) { setNet(false); retry(2500); }
        });
      } else dial();
    }
    function dial() {
      if (dead) return;
      conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const c = conn;
      const to = setTimeout(() => { if (c === conn && !c.open) { if (ever) overlayNet(T('slow')); if (++fails % 2 === 0) { try { peer && peer.destroy(); } catch (e) {} } retry(300); } }, 8000);
      c.on('open', () => { clearTimeout(to); fails = 0; lastMsg = Date.now(); c.send({ t: 'hello', name: myName, av: myAv, token }); });
      c.on('data', m => {
        lastMsg = Date.now();
        if (!m || (dead && m.t !== 'bye')) return;
        if (m.t === 'welcome') { ever = true; S.seat = m.seat; setNet(true); overlay(null); }
        else if (m.t === 'state') { setNet(true); if (!$('overlay').hidden && ever) overlay(null); onView(m.v, m.room); }
        else if (m.t === 'chat') ui.bubble(m.s, m.emo || m.text, !!m.emo);
        else if (m.t === 'note') toast(String(m.text || '').slice(0, 80), 2600);
        else if (m.t === 'err') {
          if (m.code === 'full') { dead = true; overlay(`<b>${T('full')}</b>`, [[T('backLobby'), 'glass', goLobby]]); store.set('mj_client', null); }
          else if (m.code === 'paused') toast(T('pausedBy'));
          else if (m.code === 'que' && S.view) toast(T('toastQue', { s: T('suit')[S.view.R.que[S.view.me]] }));
        }
        else if (m.t === 'bye') { if (S.onBye) S.onBye(); }
        else if (m.t === 'kicked') { dead = true; store.set('mj_client', null); overlay(`<b>${T('kicked')}</b>`, [[T('backLobby'), 'glass', goLobby]]); }
        else if (m.t === 'saved') { dead = true; overlay(`<b>${T('saved')}</b>`, [[T('backLobby'), 'glass', goLobby]]); }
        else if (m.t === 'ended') { dead = true; store.set('mj_client', null); if (m.v && m.v.seats) { m.v.over = true; showFinal(m.v); } else overlay(`<b>${T('ended')}</b>`, [[T('backLobby'), 'glass', goLobby]]); }
      });
      c.on('close', () => { if (c === conn && !dead) { setNet(false); retry(1500); } });
      c.on('error', () => {});
    }
    function overlayNet(txt) { if (S.view && S.room && S.room.started) toast(txt, 3000); else overlay(`<div class="spin"></div><b>${esc(txt)}</b>`, [[T('backLobby'), 'glass', () => { dead = true; try { peer && peer.destroy(); } catch (e) {} goLobby(); }]]); }
    function retry(ms) { clearTimeout(retryT); retryT = setTimeout(connect, ms); }
    const iv = setInterval(() => {
      if (dead) { clearInterval(iv); return; }
      if (conn && conn.open) { try { conn.send({ t: 'ping' }); } catch (e) {} }
      if (ever && Date.now() - lastMsg > 12000) { setNet(false); lastMsg = Date.now(); try { peer && peer.destroy(); } catch (e) {} connect(); }
    }, 4000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !dead && ever && (!conn || !conn.open || Date.now() - lastMsg > 6000)) { try { peer && peer.destroy(); } catch (e) {} connect(); }
    });
    connect();
  }
  function setNet(ok) { const d = $('netDot'); if (!d) return; d.hidden = !!ok || !S || S.mode === 'solo'; d.classList.toggle('bad', !ok); }
  function goLobby() {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    location.reload();
  }

  // =====================================================================
  //                         画面：房间、牌桌
  // =====================================================================
  function onView(v, room, force) {
    if (!S) return;
    S.view = v; S.room = room;
    if (!room.started) { renderRoom(v, room); return; }
    if ($('game').hidden) { show('game'); ui.relayout(); }
    const vv = Object.assign({}, v);
    if (room.clock) vv.clock = { seats: room.clock.seats, end: Date.now() + room.clock.left };
    ui.update(vv);
    renderInfo(v, room);
    // 新的一局开始：关掉结算
    if (v.R && v.R.phase !== 'end' && (sheetOn === 'result' || sheetOn === 'final')) closeSheet();
    if (v.R && v.R.phase === 'end' && sheetOn === 'result') refreshResultFoot(v, room);
    if (force && sheetOn === 'result' && v.R && v.R.phase === 'end') showResult(v);
  }
  function renderInfo(v, room) {
    const R = v.R;
    let h = '';
    if (R) h += `<span class="chip">${esc(v.rules.rounds ? T('roundOf', { r: R.no, n: v.rules.rounds }) : T('roundN', { r: R.no }))}</span>`;
    h += `<span class="chip">${esc(room.solo ? T('practice') : T('roomChip', { c: room.code }))}</span>`;
    if (room.paused) h += `<span class="chip warn">${T('paused')}</span>`;
    $('tbInfo').innerHTML = h;
  }
  function renderRoom(v, room) {
    show('room');
    overlay(null);
    $('roomCode').textContent = room.code;
    const g = $('seats4'); g.innerHTML = '';
    const isHost = S.isHost;
    // 2v2：我方一排（我和对家），对方一排
    const team = !!v.rules.team, me = v.me >= 0 ? v.me : 0;
    const order = team ? [me, (me + 2) % 4, (me + 1) % 4, (me + 3) % 4] : [0, 1, 2, 3];
    order.forEach((s, i) => {
      const p = v.seats[s];
      if (team && i % 2 === 0) { const l = document.createElement('div'); l.className = 'tlab ' + (i ? 'them' : 'us'); l.textContent = T(i ? 'teamThem' : 'teamUs'); g.appendChild(l); }
      const d = document.createElement('div');
      if (!p) {
        d.className = 'rs empty';
        d.innerHTML = `<div class="nm">${T('seatOpen')}</div><div class="sub">${T('seatWait')}</div>` + (isHost ? `<button class="btn glass sm" data-add="${s}"><svg class="ic" viewBox="0 0 24 24"><use href="#i-bot"/></svg>${T('addBot')}</button>` : '');
      } else {
        d.className = 'rs';
        const tags = (s === 0 ? `<span class="tag">${T('hostTag')}</span>` : '') + (s === v.me ? `<span class="tag me">${T('youTag')}</span>` : '');
        d.innerHTML = `${tags}<div class="av">${UIM.avSvg(p, s)}</div><div class="nm">${esc(p.name)}</div><div class="sub">${p.bot ? `<button class="lvb" data-lv="${s}">${T('lv')[p.lv]}</button>` : (p.conn ? '' : T('stOff'))}</div>` + (isHost && s !== 0 ? `<button class="x" data-kick="${s}"><svg viewBox="0 0 24 24"><use href="#i-close"/></svg></button>` : '')
          + (isHost && team && (s === 1 || s === 3) ? `<button class="btn glass sm mk" data-mate="${s}">${T('makeMate')}</button>` : '');
      }
      if (team) d.classList.add(i < 2 ? 'us' : 'them');
      g.appendChild(d);
    });
    g.classList.toggle('team', team);
    g.querySelectorAll('[data-mate]').forEach(b => b.onclick = () => { S.makeMate(+b.dataset.mate); SND.play('tap'); });
    g.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { S.addBot(+b.dataset.add); SND.play('tap'); });
    g.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { S.kick(+b.dataset.kick); SND.play('tap'); });
    g.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { if (!isHost) return; const s = +b.dataset.lv; const p = v.seats[s]; S.setBotLv(s, p.lv % 4 + 1); SND.play('tap'); });
    $('rulesSum').innerHTML = (team ? `<div class="tnote">${esc(T('teamNote'))}</div>` : '') + rulesSummary(v.rules);
    const a = $('roomActs'); a.innerHTML = '';
    if (isHost) {
      const empty = v.seats.filter(x => !x).length;
      const b = document.createElement('button'); b.className = 'btn gold'; b.textContent = empty ? T('startFill') : T('start');
      b.onclick = () => { SND.play('tap'); S.start(); };
      a.appendChild(b);
    } else {
      const w = document.createElement('div'); w.className = 'more'; w.innerHTML = `<div class="spin sm"></div>${T('waitHost')}`; a.appendChild(w);
    }
  }
  function rulesSummary(r) {
    return [r.team ? T('sumTeam') : '', r.team ? (r.tswap ? T('sumTsw', { n: r.tswap }) : T('sumTswInf')) : '', r.rounds ? T('sumRounds', { n: r.rounds }) : T('sumNoLimit'), r.cap ? T('sumCap', { n: r.cap }) : T('sumNoCap'), T(r.zimo === 'di' ? 'sumDi' : 'sumFan'), T(r.swap ? 'sumSwap' : 'sumNoSwap'), r.queFirst ? T('sumQueFirst') : '', r.base > 1 ? T('sumBase', { n: r.base }) : '', r.timer ? T('sumTimer', { n: r.timer }) : '']
      .filter(Boolean).map(esc).join(' · ');
  }
  $('roomBack').onclick = async () => { if (S && S.leave) await S.leave(); goLobby(); };
  $('roomRules').onclick = () => showRules();
  $('btnCopy').onclick = () => S && invite(S.room ? S.room.code : S.code, false);
  $('btnShare').onclick = () => S && invite(S.room ? S.room.code : S.code, true);

  // ---------- 结算 ----------
  function showResult(v) {
    if (!S || !v.R || v.R.phase !== 'end') return;
    if (v.over) { showFinal(v, true); return; }
    const sh = sheet(`${UIM.resultHTML(v)}<div class="resfoot" id="resFoot"></div>`, { id: 'result', lock: true });
    sh.classList.add('res');
    refreshResultFoot(v, S.room);
    SND.play(v.R.result.deltas[v.me] > 0 ? 'coin' : 'end');
  }
  let rfT = 0;
  function refreshResultFoot(v, room) {
    const f = $('resFoot'); if (!f) return;
    const me = v.me, rd = room.ready || [];
    const waiting = v.seats.map((p, s) => p && !rd[s] && s !== me && !p.bot ? p.name : null).filter(Boolean);
    let h = '';
    if (rd[me]) h += `<div class="more">${waiting.length ? esc(T('waitFor', { n: waiting.join('、') })) : T('readyMe')}</div>`;
    else h += `<button class="btn gold" id="btnNext">${T('next')}</button>`;
    if (room.auto) h += `<div class="more" id="autoCd"></div>`;
    h += `<button class="btn glass sm peek" id="btnPeek">${T('peek')}</button>`;
    f.innerHTML = h;
    const b = $('btnNext'); if (b) b.onclick = () => { SND.play('tap'); S.ready(); if (S.mode !== 'client') {} b.disabled = true; };
    $('btnPeek').onclick = () => { closeSheet(); showPeekBtn(); };
    clearInterval(rfT);
    if (room.auto) {
      const end = Date.now() + room.auto;
      const tick = () => { const el = $('autoCd'); if (!el) { clearInterval(rfT); return; } el.textContent = T('nextIn', { s: Math.max(0, Math.ceil((end - Date.now()) / 1000)) }); };
      tick(); rfT = setInterval(tick, 500);
    }
  }
  function showPeekBtn() {
    let b = $('peekBack');
    if (!b) { b = document.createElement('button'); b.id = 'peekBack'; b.className = 'btn gold sm floatbtn'; document.body.appendChild(b); }
    b.textContent = T('backRes'); b.hidden = false;
    b.onclick = () => { b.hidden = true; if (S && S.view) showResult(S.view); };
  }
  function showFinal(v, fromResult) {
    const sh = sheet(`${UIM.finalHTML(v)}<div class="resfoot" id="finFoot"></div>`, { id: 'final', lock: true });
    sh.classList.add('res');
    const f = $('finFoot');
    if (S && S.isHost && S.again && !S.ended) { const b = document.createElement('button'); b.className = 'btn gold'; b.textContent = T('again'); b.onclick = () => { closeSheet(); S.again(); }; f.appendChild(b); }
    const l = document.createElement('button'); l.className = 'btn glass'; l.textContent = T('backLobby');
    l.onclick = async () => { if (S && S.leave && !S.ended) await S.leave('end'); goLobby(); };
    f.appendChild(l);
    if (fromResult) {
      const r = document.createElement('button'); r.className = 'btn glass sm peek'; r.textContent = T('lastRound');
      r.onclick = () => { const v2 = Object.assign({}, v, { over: false }); const sh2 = sheet(`${UIM.resultHTML(v2)}<div class="resfoot"><button class="btn gold" id="btnFin">${T('final')}</button></div>`, { id: 'final', lock: true }); sh2.classList.add('res'); $('btnFin').onclick = () => showFinal(v, true); };
      f.appendChild(r);
    }
    SND.play('win');
  }

  // ---------- 菜单 ----------
  $('btnMenu').onclick = () => showMenu();
  $('btnChat').onclick = () => showChat();
  $('btnSound').onclick = () => { SND.set('on', !SND.prefs.on); paintSound(); if (SND.prefs.on) SND.play('tap'); };
  function paintSound() { $('btnSound').innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${SND.prefs.on ? 'sound' : 'mute'}"/></svg>`; }
  paintSound();
  function toggleRow(lab, on, fn, id) { return `<div class="mrow"><span class="grow">${lab}</span><button class="tog${on ? ' on' : ''}" data-tog="${id}"><i></i></button></div>`; }
  function showMenu() {
    if (!S || !S.view) return;
    const v = S.view, room = S.room || {}, me = v.me, host = S.isHost;
    let h = head(T('menu'));
    if (!room.solo) h += `<div class="mrow"><span class="grow">${T('mRoom', { c: esc(room.code) })}</span><button class="btn glass sm" id="mInv"><svg class="ic" viewBox="0 0 24 24"><use href="#i-share"/></svg>${T('mInvite')}</button></div>`;
    h += `<div class="mhd">${T('mPlayers')}</div>`;
    v.seats.forEach((p, s) => {
      if (!p) return;
      const sc = p.score + (v.R && v.R.phase !== 'end' ? v.R.deltas[s] : 0);
      let right = `<b class="${sc < 0 ? 'neg' : 'pos'}">${sc > 0 ? '+' : ''}${sc}</b>`;
      if (host && p.bot) right = `<button class="lvb" data-lv="${s}">${T('lv')[p.lv]}</button>` + right;
      if (host && s !== 0 && !p.bot && !room.solo) right = `<button class="btn glass sm" data-kick="${s}">${T('mKick')}</button>` + right;
      h += `<div class="mrow"><span class="av">${UIM.avSvg(p, s)}</span><span class="grow">${esc(p.name)}${s === me ? T('youS') : ''}${!p.bot && !p.conn ? ` · ${T('stOff')}` : p.auto && !p.bot ? ` · ${T('stAuto')}` : ''}</span>${right}</div>`;
    });
    h += `<div class="mhd">${T('mSettings')}</div>`;
    h += toggleRow(T('mAuto'), v.seats[me] && v.seats[me].auto, null, 'auto');
    h += toggleRow(T('mHints'), P.hints, null, 'hints');
    h += toggleRow(T('mSound'), SND.prefs.on, null, 'on');
    if (I18.lang === 'zh') h += toggleRow(T('mSc'), SND.prefs.sc, null, 'sc');
    if (I18.lang !== 'zh' || !SND.prefs.sc) { h += toggleRow(T('mVoice'), SND.prefs.voice, null, 'voice'); h += toggleRow(T('mCall'), SND.prefs.call, null, 'call'); }
    if ('vibrate' in navigator) h += toggleRow(T('mVib'), SND.prefs.vib, null, 'vib');
    h += `<div class="mrow"><span class="grow">${T('mLang')}</span><div class="seg"><button data-lang="en" class="${I18.lang === 'en' ? 'on' : ''}">English</button><button data-lang="zh" class="${I18.lang === 'zh' ? 'on' : ''}">中文</button></div></div>`;
    if (host) h += `<div class="mrow"><span class="grow">${T('mSpeed')}</span><div class="seg">${['fast', 'normal', 'slow'].map(x => `<button data-sp="${x}" class="${P.speed === x ? 'on' : ''}">${T(x === 'fast' ? 'spFast' : x === 'slow' ? 'spSlow' : 'spNormal')}</button>`).join('')}</div></div>`;
    h += '<div class="mgrid">';
    h += `<button class="btn glass" id="mRules"><svg class="ic" viewBox="0 0 24 24"><use href="#i-rule"/></svg>${T('rules')}</button>`;
    if (host && !room.solo) h += `<button class="btn glass" id="mPause"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${room.paused ? 'play' : 'pause'}"/></svg>${T(room.paused ? 'mResume' : 'mPause')}</button>`;
    h += '</div><div class="mgrid one">';
    if (room.solo) h += `<button class="btn red" id="mLeave">${T('mLeaveSolo')}</button>`;
    else if (host) h += `<button class="btn glass" id="mSave">${T('mSaveLeave')}</button><button class="btn red" id="mEnd">${T('mEnd')}</button>`;
    else h += `<button class="btn red" id="mLeave">${T('mLeave')}</button>`;
    h += '</div>';
    const sh = sheet(h, { id: 'menu' });
    sh.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => {
      const k = b.dataset.tog, on = !b.classList.contains('on');
      b.classList.toggle('on', on); SND.play('tap');
      if (k === 'auto') S.setAuto(on);
      else if (k === 'hints') { P.hints = on; saveP(); ui.setPrefs({ hints: on }); }
      else { SND.set(k, on); if (k === 'on') paintSound(); if (k === 'sc') { if (on) SND.scSay('t9'); setTimeout(showMenu, 50); } }
    });
    sh.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { I18.setLang(b.dataset.lang); refreshLang(); showMenu(); });
    sh.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { S.setSpeed(b.dataset.sp); showMenu(); });
    sh.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { const s = +b.dataset.lv; S.setBotLv(s, v.seats[s].lv % 4 + 1); setTimeout(showMenu, 50); });
    sh.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { S.kick(+b.dataset.kick); setTimeout(showMenu, 50); });
    const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
    on('mInv', () => invite(room.code, true));
    on('mRules', () => showRules());
    on('mPause', () => { S.togglePause(); closeSheet(); });
    on('mLeave', async () => {
      if (room.solo) { await S.leave(); goLobby(); return; }
      confirmBox(T('leaveQ'), async () => { await S.leave(); goLobby(); });
    });
    on('mSave', async () => { await S.leave('save'); goLobby(); });
    on('mEnd', () => confirmBox(T('endQ'), () => { const v0 = S.endGame(); S.ended = true; showFinal(v0); }));
  }
  function confirmBox(q, yes) {
    overlay(`<b>${esc(q)}</b>`, [[T('cancel'), 'glass', () => overlay(null)], [T('ok'), 'red', () => { overlay(null); yes(); }]]);
  }
  function showChat() {
    let h = head(T('chat'));
    h += `<div class="emos">${EMOS.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>`;
    h += `<div class="phr">${T('phrases').map(p => `<button data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>`;
    h += `<div class="code-row chatrow"><input class="inp" id="chatIn" maxlength="40" placeholder="${esc(T('chatPh'))}"><button class="btn gold" id="chatGo">${T('send')}</button></div>`;
    const sh = sheet(h, { id: 'chat' });
    sh.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { S.chat({ emo: b.dataset.e }); closeSheet(); });
    sh.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { S.chat({ text: b.dataset.p }); closeSheet(); });
    const go = () => { const t = $('chatIn').value.trim(); if (t) { S.chat({ text: t }); closeSheet(); } };
    $('chatGo').onclick = go;
    $('chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }
  function showRules() {
    let h = head(T('rulesTitle'));
    h += `<div class="rules-txt">${T('rulesHTML')}${T('rulesTeam')}<h4>${T('fanH')}</h4><table>${T('fanTable').map(([a, b]) => `<tr><td>${esc(a)}</td><td>${T('nFan', { n: b })}</td></tr>`).join('')}</table><p class="note">${T('fanNote')}</p></div>`;
    sheet(h, { id: 'rules' });
  }

  // =====================================================================
  //                                启动
  // =====================================================================
  if (/MicroMessenger/i.test(navigator.userAgent)) $('wxTip').hidden = false;
  applyStatic();
  paintMe();
  renderOpts();
  renderResume();
  const hc = (location.hash || '').replace('#', '').toUpperCase();
  if (/^[A-Z0-9]{4}$/.test(hc)) { setTab('join'); $('joinCode').value = hc; if (myName) setTimeout(() => $('btnJoin').click(), 200); }
  else setTab(P.tab || 'solo');
  show('lobby');
  // 调试：?auto=1 自动开练习（截图测试用）
  if (qs.get('team') != null) { P.rules.team = qs.get('team') === '1'; renderOpts(); }
  if (qs.get('autosolo')) { if (!myName) { myName = 'Me'; $('nick').value = myName; } startHost({ solo: true }); }
  W.MJAPP = { get S() { return S; }, ui, store };
})();
