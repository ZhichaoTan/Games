// ===== engines: the built-in one (a web worker running engine.js) and Pikafish (WebAssembly, an optional download) =====
const Bridge = {
  worker: null, id: 0, pending: {}, local: null,
  init() {
    try {
      const src = '(' + EngineFactory.toString() + ')(true);';
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const w = new Worker(url);
      w.onmessage = e => { const m = e.data, p = this.pending[m.id]; if (!p) return; delete this.pending[m.id]; p.res(m.type == 'error' ? this.runLocal(p.msg) : m); };
      w.onerror = () => { this.worker = null; const ps = this.pending; this.pending = {}; Object.values(ps).forEach(p => setTimeout(() => p.res(this.runLocal(p.msg)), 20)); };
      this.worker = w;
    } catch (e) { this.worker = null; }
  },
  runLocal(m) {
    if (!this.local) { const p = new E.Position(); this.local = { p, s: new E.Search(p) }; }
    const { p, s } = this.local;
    p.fromMoves(m.moves);
    if (m.type == 'ai') { const r = E.aiMove(s, m.level); return { type: 'ai', id: m.id, mv: r.mv, vl: r.vl, pv: r.pv }; }
    if (p.isMate()) return { type: 'analyze', id: m.id, mv: 0, vl: -MATE, pv: [], depth: 0 };
    const r = s.think({ timeMs: m.timeMs }); return { type: 'analyze', id: m.id, mv: r.mv, vl: r.vl, pv: r.pv, depth: r.depth };
  },
  ask(msg) {
    return new Promise(res => {
      msg.id = ++this.id;
      if (this.worker) { this.pending[msg.id] = { msg, res }; this.worker.postMessage(msg); }
      else setTimeout(() => res(this.runLocal(msg)), 30);
    });
  },
  cancel() {
    if (this.worker) { this.worker.terminate(); this.worker = null; const ps = this.pending; this.pending = {}; Object.values(ps).forEach(p => p.res(null)); this.init(); }
  }
};
Bridge.init();

// ---------------- Pikafish ----------------
// pf/pikafish.js is a single-threaded WebAssembly build of Pikafish (GPLv3; see pf/README.md for the source
// and the build). Its network (48 MB) is fetched in four parts and kept in IndexedDB.
const NET_PARTS = 4, NET_BYTES = 49982985, NET_KEY = 'pikafish-nnue-6b74ac7b';
const IDB = {
  open() { return new Promise((res, rej) => { try { const r = indexedDB.open('xq-pikafish', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('files').objectStore('files').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async put(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
};
const PF_GLUE = `
var __lines=[],__M=null,__pending=[];
function __cmd(c){__M.ccall('pf_command',null,['string'],[c]);}
function __handle(d){
  try{
    if(d.t==='net'){
      __M.FS.writeFile('/pikafish.nnue',new Uint8Array(d.buf));__lines=[];
      __cmd('setoption name EvalFile value /pikafish.nnue');__cmd('setoption name UCI_ShowWDL value true');__cmd('setoption name Hash value 32');__cmd('isready');
      try{__M.FS.unlink('/pikafish.nnue');}catch(e){}
      var bad=__lines.some(function(l){return /ERROR/.test(l);});
      postMessage(bad?{t:'neterr',msg:__lines.join('\\n')}:{t:'netok'});
    }else if(d.t==='cmd'){__lines=[];for(var i=0;i<d.cmds.length;i++)__cmd(d.cmds[i]);postMessage({t:'done',lines:__lines});}
  }catch(e){postMessage({t:'dead',msg:String(e&&e.message||e)});}
}
onmessage=function(e){if(!__M)__pending.push(e.data);else __handle(e.data);};
Pikafish({print:function(l){__lines.push(l);},printErr:function(l){__lines.push(l);}}).then(function(M){__M=M;M.ccall('pf_init','number',[],[]);var p=__pending;__pending=[];p.forEach(__handle);});
`;
const PF = {
  state: 'off', progress: 0, err: '', js: null, net: null, worker: null, q: [], cur: null, subs: [], cached: false,
  set(st, extra) { this.state = st; Object.assign(this, extra || {}); this.subs.forEach(f => { try { f(); } catch (e) {} }); },
  ready() { return this.state == 'ready'; },
  async load() {
    if (this.state == 'loading' || this.state == 'ready') return;
    this.set('loading', { progress: 0, err: '', cached: false });
    try {
      if (!this.js) { const r = await fetch('pf/pikafish.js'); if (!r.ok) throw new Error(T('pfErrJs', { n: r.status })); this.js = await r.text(); }
      if (!this.net) this.net = await this.fetchNet();
      await this.boot();
      this.set('ready');
    } catch (e) { this.set('error', { err: String(e && e.message || e) }); }
  },
  async fetchNet() {
    try { const c = await IDB.get(NET_KEY); if (c && c.byteLength == NET_BYTES) { this.set('loading', { progress: 1, cached: true }); return c; } } catch (e) {}
    let got = 0; const parts = [];
    for (let i = 0; i < NET_PARTS; i++) {
      const r = await fetch('pf/net-' + i + '.bin');
      if (!r.ok) throw new Error(T('pfErrNet', { n: r.status }));
      if (r.body && r.body.getReader) {
        const rd = r.body.getReader();
        for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; this.set('loading', { progress: Math.min(1, got / NET_BYTES) }); }
      } else { const b = new Uint8Array(await r.arrayBuffer()); parts.push(b); got += b.length; this.set('loading', { progress: got / NET_BYTES }); }
    }
    const buf = await new Blob(parts).arrayBuffer();
    if (buf.byteLength != NET_BYTES) throw new Error(T('pfErrCut'));
    IDB.put(NET_KEY, buf).catch(() => {});
    return buf;
  },
  boot() {
    return new Promise((res, rej) => {
      let w;
      try { w = new Worker(URL.createObjectURL(new Blob([this.js, '\n', PF_GLUE], { type: 'text/javascript' }))); }
      catch (e) { rej(new Error(T('pfErrWorker'))); return; }
      this.worker = w; this.q = []; this.cur = null;
      const to = setTimeout(() => rej(new Error(T('pfErrSlow'))), 60000);
      w.onmessage = e => {
        const d = e.data;
        if (d.t == 'netok') { clearTimeout(to); res(); }
        else if (d.t == 'neterr') { clearTimeout(to); rej(new Error(T('pfErrCut'))); }
        else if (d.t == 'done') { const j = this.cur; this.cur = null; j && j.res(d.lines); this.pump(); }
        else if (d.t == 'dead') { clearTimeout(to); this.crash(d.msg); rej(new Error(T('pfErrBoot'))); }
      };
      w.onerror = () => { clearTimeout(to); this.crash('worker error'); rej(new Error(T('pfErrBoot'))); };
      w.postMessage({ t: 'net', buf: this.net });
    });
  },
  crash() {
    try { this.worker && this.worker.terminate(); } catch (e) {}
    this.worker = null; const j = this.cur; this.cur = null; j && j.res(null); this.flush();
    if (this.state == 'ready') { this.set('off'); toast(T('pfCrash'), 2600); setTimeout(() => this.load(), 500); }
  },
  run(cmds) { return new Promise(res => { if (!this.worker) return res(null); this.q.push({ cmds, res }); this.pump(); }); },
  pump() { if (this.cur || !this.q.length || !this.worker) return; this.cur = this.q.shift(); this.worker.postMessage({ t: 'cmd', cmds: this.cur.cmds }); },
  flush() { const q = this.q; this.q = []; q.forEach(j => j.res(null)); },
  posCmd(moves) { return 'position startpos' + (moves.length ? ' moves ' + moves.map(mv2uci).join(' ') : ''); },
  parse(lines) {
    const by = {}; let best = null;
    for (const l of lines || []) {
      if (l.startsWith('info ') && l.indexOf(' pv ') > 0) {
        const sc = l.match(/score (cp|mate) (-?\d+)/); if (!sc) continue;
        const k = +((l.match(/multipv (\d+)/) || [0, 1])[1]);
        const bound = /(lowerbound|upperbound)/.test(l);
        const wdl = l.match(/wdl (\d+) (\d+) (\d+)/);
        const depth = +((l.match(/ depth (\d+)/) || [0, 0])[1]);
        const pv = l.split(' pv ')[1].trim().split(/\s+/).map(uci2mv);
        let vl, w = null;
        if (sc[1] == 'cp') vl = +sc[2];
        else { const n = +sc[2]; vl = n > 0 ? MATE - (2 * n - 1) : -MATE + (-2 * n); w = n > 0 ? 1 : 0; }
        if (wdl && w == null) w = (+wdl[1] + (+wdl[2]) / 2) / 1000;
        if (!by[k] || !bound || by[k].bound || depth > by[k].depth) by[k] = { vl, w, pv, mv: pv[0], depth, bound };
      }
      if (l.startsWith('bestmove')) { const b = l.split(/\s+/)[1]; if (b && b != '(none)') best = uci2mv(b); }
    }
    const list = Object.keys(by).sort((a, b) => a - b).map(k => by[k]);
    return { list, best };
  },
  async analyze(moves, ms, multi = 1, only) {
    const lines = await this.run(['setoption name MultiPV value ' + multi, this.posCmd(moves), 'go movetime ' + ms + (only && only.length ? ' searchmoves ' + only.map(mv2uci).join(' ') : '')]);
    if (!lines) return null;
    const { list, best } = this.parse(lines);
    if (!list.length && !best) return null;
    const top = list[0] || { vl: 0, w: 0.5, pv: [best], mv: best, depth: 0 };
    return { mv: best || top.mv, vl: top.vl, w: top.w, pv: top.pv, depth: top.depth, lines: list, eng: 'pf' };
  },
  // weakened play. Weak levels search to a fixed depth (the same strength on any device) with several
  // candidate lines, then pick among the moves that lose at most `cap` cp, favouring the better ones
  // (softmax with temperature `temp`). With probability `slip` they make a real oversight instead: a
  // move that loses more than `cap` but at most `slipCap`. Strong levels search the whole time.
  // Tuned so the average loss per move (judged by a depth-12 search) is about 125, 90, 55, 37, 22, 9 cp
  // and a piece-losing move (300+ cp) happens on about 12%, 6%, 2.5%, 0.5%, 0.1%, 0% of moves.
  LEVELS: [
    { depth: 1, multi: 30, temp: 130, cap: 300, slip: .14, slipCap: 1200, mate: .5 },
    { depth: 1, multi: 24, temp: 90, cap: 200, slip: .08, slipCap: 900, mate: .8 },
    { depth: 2, multi: 16, temp: 60, cap: 140, slip: .045, slipCap: 600, mate: .95 },
    { depth: 3, multi: 10, temp: 40, cap: 100, slip: .025, slipCap: 400, mate: 1 },
    { depth: 5, multi: 6, temp: 28, cap: 70, slip: .015, slipCap: 300, mate: 1 },
    { depth: 8, multi: 4, temp: 8, cap: 20, slip: .003, slipCap: 150, mate: 1 },
    { time: 4000 }],
  pickWeak(list, L) {
    const cl = v => Math.max(-3000, Math.min(3000, v)), top = cl(list[0].vl);
    // a forced mate is found by every level except, sometimes, the weakest ones
    if (list[0].vl > WIN && Math.random() < L.mate) return list[0];
    const loss = e => top - cl(e.vl);
    let pool = list.filter(e => loss(e) <= L.cap), w = e => Math.exp(-loss(e) / L.temp);
    if (L.slip && Math.random() < L.slip) {
      const bad = list.filter(e => loss(e) > L.cap && loss(e) <= L.slipCap);
      if (bad.length) { pool = bad; w = () => 1; }
    }
    if (!pool.length) return list[0];
    let tot = 0; pool.forEach(e => tot += w(e));
    let r = Math.random() * tot;
    for (const e of pool) { r -= w(e); if (r <= 0) return e; }
    return pool[0];
  },
  async ai(moves, level) {
    const L = this.LEVELS[level];
    if (level >= 1 && moves.length < 14) { const p = new E.Position(); p.fromMoves(moves); const bm = E.bookMove(p); if (bm) return { mv: bm }; }
    const lines = await this.run(['setoption name MultiPV value ' + (L.multi || 1), this.posCmd(moves), L.time ? 'go movetime ' + L.time : 'go depth ' + L.depth]);
    if (!lines) return null;
    const { list, best } = this.parse(lines);
    if (!L.temp || list.length < 2) return { mv: best || (list[0] && list[0].mv), vl: list[0] && list[0].vl };
    const pick = this.pickWeak(list, L);
    return { mv: pick.mv, vl: pick.vl };
  }
};
// one front for both engines
const Eng = {
  pf() { return DB.settings.engine == 'pf' && PF.ready(); },
  name() { return this.pf() ? 'pf' : 'muyi'; },
  // hints, review and explore use the strongest engine available
  advPf() { return (DB.settings.advPf || DB.settings.engine == 'pf') && PF.ready(); },
  adv() { return this.advPf() ? 'pf' : 'muyi'; },
  wantPf() { return DB.settings.advPf || DB.settings.engine == 'pf'; },
  async ai(moves, level) {
    if (this.pf()) { const r = await PF.ai(moves, level); if (r && r.mv) return r; }
    return Bridge.ask({ type: 'ai', moves, level });
  },
  async analyze(moves, ms, multi = 1) {
    const p = new E.Position(); p.fromMoves(moves);
    if (p.isMate()) return { mv: 0, vl: -MATE, w: 0, pv: [], depth: 0, lines: [], eng: this.adv() };
    if (this.advPf()) { const r = await PF.analyze(moves, ms, multi); if (r) return r; }
    // the built-in engine gets more time so its advice stays sensible
    const r = await Bridge.ask({ type: 'analyze', moves, timeMs: Math.max(ms, Math.min(2500, ms * 2)) });
    if (!r) return null;
    return { mv: r.mv, vl: r.vl, w: null, pv: r.pv || [], depth: r.depth, lines: [{ mv: r.mv, vl: r.vl, w: null, pv: r.pv || [] }], eng: 'muyi' };
  },
  cancel() { Bridge.cancel(); PF.flush(); }
};
function updateEngChips() {
  document.querySelectorAll('.eng-chip').forEach(x => {
    const n = x.dataset.e == 'opp' ? Eng.name() : Eng.adv();
    x.textContent = engName(n); x.classList.toggle('pf', n == 'pf');
  });
}
