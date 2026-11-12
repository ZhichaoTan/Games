// ===== lobby: name and avatar, join / host / practice, records, save code, settings, rules =====
function applyStatic() {
  document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = T(el.dataset.t); });
  $('nick').placeholder = T('namePh');
  $('btnLang').querySelector('span').textContent = T('langBtn');
  document.title = T('title');
  paintHero();
}
// the three pieces above the title
function paintHero() {
  const h = $('hart');
  h.querySelectorAll('.hp').forEach(x => x.remove());
  [20, 8, 13].forEach((pc, i) => { h.insertAdjacentHTML('beforeend', pcHTML(pc, 'hp h' + i)); });
}
function paintMe() {
  $('meAv').innerHTML = avSvg(myAv);
  const g = $('avs'); g.innerHTML = '';
  AV.AVATARS.forEach((a, i) => {
    const b = document.createElement('button');
    b.className = i === myAv ? 'on' : '';
    b.setAttribute('aria-label', a.en);
    b.innerHTML = avSvg(i);
    b.onclick = () => { myAv = i; store.set('av', i); paintMe(); AU.select(); };
    g.appendChild(b);
  });
}
$('nick').value = myName;
$('nick').addEventListener('input', () => { $('lobErr').textContent = ''; myName = $('nick').value.trim().slice(0, 10); store.set('name', myName || null); });
function needName() {
  const n = $('nick').value.trim().slice(0, 10);
  if (!n) { $('lobErr').textContent = T('needName'); $('nick').focus(); return false; }
  myName = n; store.set('name', n); return true;
}
function segRow(box, lab, items, cur, set) {
  const l = document.createElement('span'); l.textContent = lab; box.appendChild(l);
  const seg = document.createElement('div'); seg.className = 'seg';
  for (const [v, txt] of items) {
    const b = document.createElement('button');
    b.innerHTML = txt; b.className = v === cur ? 'on' : '';
    b.onclick = () => { set(v); AU.select(); };
    seg.appendChild(b);
  }
  box.appendChild(seg);
}
const sideItems = () => [['red', sideDot(0) + T('oRed')], ['black', sideDot(1) + T('oBlack')], ['rand', T('oRand')]];
const clockItems = () => [0, 10, 20, 30].map(v => [v, v ? T('oMin', { n: v }) : T('oNoClock')]);
function renderOpts() {
  const st = DB.settings;
  let box = $('optsHost'); box.innerHTML = '';
  segRow(box, T('oHostSide'), sideItems(), st.hostSide, v => { st.hostSide = v; save(); renderOpts(); });
  segRow(box, T('oClock'), clockItems(), st.hostClock, v => { st.hostClock = v; save(); renderOpts(); });
  box = $('optsAi'); box.innerHTML = '';
  segRow(box, T('oSide'), [[0, sideDot(0) + T('oRed')], [1, sideDot(1) + T('oBlack')], [2, T('oRand')]], st.side, v => { st.side = v; save(); renderOpts(); });
  segRow(box, T('oEngine'), [['muyi', T('engMuyi')], ['pf', T('engPf')]], st.engine, v => { st.engine = v; save(); if (v == 'pf') PF.load(); renderHome(); });
}
function setTab(k) {
  DB.settings.tab = k; save();
  const i = ['join', 'host', 'solo'].indexOf(k);
  $('tabs').querySelector('.pill').style.transform = `translateX(${i * 100}%)`;
  $('tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === k));
  $('paneJoin').hidden = k !== 'join'; $('paneHost').hidden = k !== 'host'; $('paneSolo').hidden = k !== 'solo';
  $('lobErr').textContent = '';
}
$('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { setTab(b.dataset.tab); AU.select(); });
$('joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); $('lobErr').textContent = ''; });
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
$('btnJoin').onclick = () => {
  if (!needName()) return;
  const c = $('joinCode').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(c)) { $('lobErr').textContent = T('badCode'); return; }
  startClient(c);
};
$('btnCreate').onclick = () => { if (!needName()) return; startHost({}); };
$('btnRules').onclick = () => showRules();
$('btnLang').onclick = () => { I18.setLang(zh() ? 'en' : 'zh'); refreshLang(); AU.select(); };

// ---- practice: the computer opponent ----
const lvLadder = $('ladder');
function statOf(lv, eng) { return DB.stats[statKey(lv, eng)] || { w: 0, d: 0, l: 0 }; }
function renderEngineNote() {
  const st = DB.settings, n = $('engNote'), pfOpp = st.engine == 'pf';
  $('advTgl').querySelector('.sw').classList.toggle('on', !!st.advPf || pfOpp);
  $('advTgl').disabled = pfOpp;
  if (!Eng.wantPf()) n.innerHTML = '';
  else if (PF.state == 'ready') n.innerHTML = `<b>● ${T('pfReady')}</b>`;
  else if (PF.state == 'loading') n.innerHTML = `<span>${T(PF.cached ? 'pfStarting' : 'pfLoading')} ${Math.round(PF.progress * 100)}%</span><span class="bar"><i style="width:${PF.progress * 100}%"></i></span>`;
  else if (PF.state == 'error') n.innerHTML = `<span class="bad">${T('pfFailed')}${esc(PF.err)}</span><button class="linkbtn" id="pfRetry">${T('retryLoad')}</button>`;
  else n.innerHTML = T('pfWait');
  const r = $('pfRetry'); if (r) r.onclick = () => { PF.set('off'); PF.load(); };
}
PF.subs.push(() => { renderEngineNote(); updateEngChips(); });
function renderHome() {
  const st = DB.settings;
  if (st.mode != 'pvp') st.mode = 'ai';
  const mode = st.mode, lv = st.level;
  $('modeSeg').querySelector('.pill').style.transform = `translateX(${mode == 'pvp' ? 100 : 0}%)`;
  $('modeSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mode == mode));
  $('paneAi').hidden = mode != 'ai'; $('panePvp').hidden = mode != 'pvp';
  if ($('homeAva').dataset.lv != lv) { $('homeAva').firstElementChild.innerHTML = AVA.level(lv); $('homeAva').dataset.lv = lv; }
  if (!lvLadder.children.length || lvLadder.dataset.lang != I18.lang) {
    lvLadder.innerHTML = E.LEVELS.map((L, i) => `<button data-lv="${i}"><i>${AVA.level(i)}</i>${lvName(i)}</button>`).join(''); lvLadder.dataset.lang = I18.lang;
  }
  $('lvName').textContent = lvName(lv); $('lvWho').textContent = T('lvLine', { w: lvWho(lv), n: lv + 1 });
  $('lvDesc').textContent = T(st.engine == 'pf' ? 'lvDescPf' : 'lvDesc')[lv];
  $('lvPrev').disabled = lv == 0; $('lvNext').disabled = lv == 6;
  lvLadder.querySelectorAll('button').forEach((b, i) => { b.classList.toggle('on', i == lv); b.classList.toggle('past', i < lv); });
  const s = statOf(lv), n = s.w + s.d + s.l;
  $('record').innerHTML = `<div><b>${s.w}</b><small>${T('recW')}</small></div><div><b>${s.d}</b><small>${T('recD')}</small></div><div><b>${s.l}</b><small>${T('recL')}</small></div><div><b>${n ? Math.round(s.w / n * 100) + '%' : '—'}</b><small>${T('recRate')}</small></div>`;
  $('duoR').firstElementChild.innerHTML = mascot(0); $('duoB').firstElementChild.innerHTML = mascot(1);
  $('facingTgl').querySelector('.sw').classList.toggle('on', !!st.facing);
  renderOpts(); renderEngineNote(); renderResume();
}
function setLevel(lv) {
  DB.settings.level = clamp(lv, 0, 6); save(); renderHome(); AU.select();
  const a = $('homeAva'); a.classList.remove('happy'); a.offsetWidth; a.classList.add('happy'); clearTimeout(setLevel.t); setLevel.t = setTimeout(() => a.classList.remove('happy'), 1100);
}
$('lvPrev').onclick = () => setLevel(DB.settings.level - 1);
$('lvNext').onclick = () => setLevel(DB.settings.level + 1);
lvLadder.onclick = e => { const b = e.target.closest('button'); if (b) setLevel(+b.dataset.lv); };
$('modeSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; DB.settings.mode = b.dataset.mode; save(); renderHome(); AU.select(); };
$('advTgl').onclick = () => { DB.settings.advPf = !DB.settings.advPf; save(); if (DB.settings.advPf) PF.load(); renderHome(); AU.select(); };
$('facingTgl').onclick = () => { DB.settings.facing = !DB.settings.facing; save(); renderHome(); AU.select(); };
$('btnSolo').onclick = () => { const s = DB.settings.side; startGame({ mode: 'ai', level: DB.settings.level, side: s == 2 ? (Math.random() < .5 ? 0 : 1) : s, moves: [] }); };
$('btnPvp').onclick = () => startGame({ mode: 'pvp', moves: [] });
$('histBtn').onclick = () => { AU.select(); openHistory(); };
$('setBtn').onclick = () => { AU.select(); openSettings(); };
$('codeBtn').onclick = () => { AU.select(); openCode(); };

// ---- unfinished games and rooms ----
function renderResume() {
  const box = $('resumeBox'), cur = DB.current;
  const hs = store.get('xq_host'), cs = store.get('xq_client');
  const fresh = (x, h) => x && Date.now() - (x.at || 0) < h * 3600e3;
  let h = '';
  if (cur && cur.moves) {
    const tx = cur.mode == 'pvp' ? T('resumePvp', { n: cur.moves.length }) : T('resumeAi', { w: lvWho(cur.level), l: lvName(cur.level), n: cur.moves.length });
    h += `<div class="resume"><div class="tx">${tx}</div><button class="btn gold sm" data-r="cur">${T('resume')}</button><button class="btn glass sm" data-x="cur">✕</button></div>`;
  }
  if (fresh(hs, 72) && hs.room) h += `<div class="resume"><div class="tx">${T('resumeHost', { c: esc(hs.code) })}</div><button class="btn gold sm" data-r="host">${T('resume')}</button><button class="btn glass sm" data-x="xq_host">✕</button></div>`;
  if (fresh(cs, 12) && cs.code) h += `<div class="resume"><div class="tx">${T('resumeClient', { c: esc(cs.code) })}</div><button class="btn gold sm" data-r="client">${T('rejoin')}</button><button class="btn glass sm" data-x="xq_client">✕</button></div>`;
  box.innerHTML = h; box.hidden = !h;
  box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { if (b.dataset.x == 'cur') { DB.current = null; save(); } else store.set(b.dataset.x, null); renderResume(); });
  box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    const k = b.dataset.r;
    if (k == 'cur') { startGame(Object.assign({}, cur, { resume: true })); return; }
    if (!needName()) return;
    if (k == 'host') startHost({ restore: hs }); else startClient(cs.code);
  });
}

// ---- records ----
const REASON_OLD = { '绝杀': 'mate', '困毙': 'stale', '长将判负': 'perp', '三次重复局面': 'rep', '六十回合未吃子': 'sixty', '双方均无进攻子力': 'nomat', '认输': 'resign', '红方认输': 'resign', '黑方认输': 'resign' };
const reasonTxt = r => { const m = T('reasons'); return m[r] || m[REASON_OLD[r]] || ''; };
const resTxt = r => T(r == 'win' ? 'resWin' : r == 'loss' ? 'resLoss' : 'resDraw');
const winTxt = w => w == -1 ? T('resDraw') : T('sideWon', { s: SIDE(w) });
function recTitle(h) {
  if (h.mode == 'pvp') return `${T('modePvp')} · ${winTxt(h.winner)}`;
  if (h.mode == 'net') return T('recNet', { n: esc(h.opp && h.opp.name || '?'), s: SIDE(h.side) });
  return T('recAi', { n: lvName(h.level), s: SIDE(h.side) }) + (h.engine == 'pf' ? ` · ${T('engPf')}` : '');
}
const recFace = h => h.mode == 'pvp' ? mascot(0) : h.mode == 'net' ? avSvg(h.opp && h.opp.av) : AVA.level(h.level);
function openHistory() {
  const items = DB.history.map((h, i) => `<button class="item" data-i="${i}"><div class="avatar"><span>${recFace(h)}</span></div>
    <div class="grow"><b>${recTitle(h)}</b><small>${fmtDate(h.t)} · ${T('nRounds', { n: rounds(h.moves.length) })} · ${reasonTxt(h.reason)}${h.analysis && h.analysis.length > h.moves.length ? ' · ' + T('analysed') : ''}</small></div>
    ${h.mode == 'pvp' ? '' : `<span class="res-tag ${h.result}">${resTxt(h.result)}</span>`}</button>`).join('');
  const sh = sheet(head(T('hHistory')) + `<div class="list">${items || `<p class="note">${T('noHistory')}</p>`}</div>`, { id: 'history' });
  sh.querySelectorAll('.item').forEach(b => b.onclick = () => { closeSheet(); openReview(DB.history[+b.dataset.i]); });
}

// ---- save code: everything (settings, records, the game in progress) as text to copy and paste back.
// Storage in in-app browsers such as WeChat can be wiped, so this is how progress is carried over.
// The format is the one the earlier stand-alone version of this game wrote, so its codes still load.
const CODE_TAG = 'MYXQ';
const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = t => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function zipBytes(u8, inflate) {
  const cs = inflate ? new DecompressionStream('deflate-raw') : new CompressionStream('deflate-raw');
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer());
}
// moves travel as one string of 4-letter coordinates; analysis is left out (it is recomputed in review)
function packSave() {
  const g = r => { const o = Object.assign({}, r); delete o.analysis; delete o.anaEngine; delete o.deep; o.moves = mvStr(r.moves); return o; };
  return { v: 1, g: 2, t: Date.now(), settings: DB.settings, stats: DB.stats, history: DB.history.map(g), current: DB.current ? g(DB.current) : null };
}
async function makeCode() {
  const raw = new TextEncoder().encode(JSON.stringify(packSave()));
  try { if (typeof CompressionStream != 'undefined') return CODE_TAG + '1.' + b64u(await zipBytes(raw)); } catch (e) {}
  return CODE_TAG + '0.' + b64u(raw);
}
async function readCode(text) {
  const t = (text || '').replace(/\s+/g, ''), m = t.match(/MYXQ([01])\.([A-Za-z0-9_-]+)/);
  if (!m) throw new Error(T('codeBad'));
  if (m[1] == '1' && typeof DecompressionStream == 'undefined') throw new Error(T('codeOld'));
  let d;
  try { let u8 = unb64u(m[2]); if (m[1] == '1') u8 = await zipBytes(u8, true); d = JSON.parse(new TextDecoder().decode(u8)); } catch (e) { d = null; }
  if (!d || d.v != 1 || !Array.isArray(d.history)) throw new Error(T('codeCut'));
  const g = r => Object.assign({}, r, { moves: strMv(r.moves), reason: REASON_OLD[r.reason] || r.reason });
  const ok = r => { const p = new E.Position(); p.startpos(); for (const mv of r.moves) { if (p.legalMoves().indexOf(mv) < 0) return false; p.makeMove(mv); } return true; };
  const hist = d.history.map(g).filter(ok), cur = d.current ? g(d.current) : null;
  // a code from the earlier version: keep its play settings, not its engine choice (that would start a 48 MB download)
  const s = d.settings || {}, keep = d.g == 2 ? s : { level: s.level, side: s.side, sound: s.sound, voice: s.voice, facing: s.facing, pvBoth: s.pvBoth };
  for (const k in keep) if (keep[k] == null) delete keep[k];
  return { t: d.t, settings: keep, stats: d.stats || {}, history: hist, current: cur && ok(cur) ? cur : null };
}
function openCode() {
  const n = DB.history.length, st = Object.values(DB.stats).reduce((a, x) => a + (x.w || 0) + (x.d || 0) + (x.l || 0), 0);
  const sh = sheet(head(T('hCode')) + `<p class="note">${T('codeIntro', { g: st, n })}</p>
    <div class="code-sec"><b>${T('codeBackup')}</b><textarea class="code-box" id="codeOut" readonly placeholder="${esc(T('codeMaking'))}"></textarea>
      <div class="btns"><button class="btn gold" id="codeCopy">${T('codeCopy')}</button></div></div>
    <div class="code-sec"><b>${T('codeRestore')}</b><textarea class="code-box" id="codeIn" placeholder="${esc(T('codePh'))}" autocomplete="off" spellcheck="false"></textarea>
      <div class="btns"><button class="btn glass" id="codeLoad">${T('codeLoad')}</button></div></div>`, { id: 'code' });
  const out = $('codeOut'), inp = $('codeIn');
  let code = '';
  makeCode().then(c => { code = c; out.value = c; }).catch(() => { out.placeholder = T('codeFail'); });
  out.onclick = () => { out.select(); };
  $('codeCopy').onclick = async () => { if (!code) return; toast(await copyText(code) ? T('codeCopied', { n: code.length }) : T('codeCopyFail'), 2600); };
  $('codeLoad').onclick = async () => {
    let d; try { d = await readCode(inp.value); } catch (e) { toast(esc(e.message || T('codeCut')), 2600); return; }
    confirmBox(T('codeLoad'), T('codeConfirm', { t: fmtDate(d.t), n: d.history.length }), T('codeDo'), () => {
      closeSheet(); Eng.cancel();
      Object.assign(DB.settings, d.settings); DB.stats = d.stats; DB.history = d.history.slice(0, 40); DB.current = d.current;
      save(); if (Eng.wantPf()) PF.load(); renderHome(); toast(T('codeDone'), 2200);
    }, 'gold');
  };
}

// ---- settings ----
function settingsHTML() {
  const st = DB.settings;
  return `<div class="list">${toggleHTML('sound', T('sSound'), T('sSoundSub'), st.sound)}${toggleHTML('voice', T('sVoice'), T('sVoiceSub'), st.voice)}
    <div class="item"><span class="grow">${T('sPieces')}</span>${segHTML('pieces', [['auto', T('sAuto')], ['han', T('sHan')], ['fig', T('sFig')]], st.pieces)}</div>
    <div class="item"><span class="grow">${T('sBoard')}</span>${segHTML('board', [['night', T('sNight')], ['wood', T('sWood')]], st.board)}</div>
    <div class="item"><span class="grow">${T('sLang')}</span>${segHTML('lang', [['en', 'English'], ['zh', '中文']], I18.lang)}</div></div>`;
}
function bindSettings(sh, again) {
  sh.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => {
    const k = b.dataset.tog; if (!(k in DB.settings)) return;
    DB.settings[k] = !DB.settings[k]; save(); b.querySelector('.sw').classList.toggle('on', DB.settings[k]); paintSound(); AU.select();
    if (k == 'facing') $('gBoard').classList.toggle('facing', G.mode == 'pvp' && !!DB.settings.facing);
  });
  sh.querySelectorAll('[data-seg] button').forEach(b => b.onclick = () => {
    const k = b.parentElement.dataset.seg, v = b.dataset.v;
    if (k == 'lang') I18.setLang(v); else { DB.settings[k] = v; save(); }
    AU.select(); refreshLang(); again();
  });
}
function openSettings() {
  const sh = sheet(head(T('hSettings')) + settingsHTML() + `<div class="list" style="margin-top:8px"><button class="item danger" id="setClear"><svg class="ic" viewBox="0 0 24 24"><use href="#i-trash"/></svg><span class="grow">${T('sClear')}</span></button></div>
    <p class="note dim" style="margin-top:14px">${T('credits')}</p>`, { id: 'settings' });
  bindSettings(sh, openSettings);
  $('setClear').onclick = () => confirmBox(T('sClear'), T('sClearQ'), T('sClearDo'), () => { DB.stats = {}; DB.history = []; save(); renderHome(); closeSheet(); toast(T('sCleared')); });
}

// ---- rules ----
function showRules() {
  const ps = T('rulesPieces');
  const rows = ps.map((x, i) => `<div class="rp"><div class="pcs">${pcHTML(8 + i)}</div><div><b>${x[0]}</b> ${x[1]}</div></div>`).join('');
  sheet(head(T('hRules')) + `<div class="rules-txt">${T('rulesIntro')}${rows}${T('rulesMore')}</div>`, { id: 'rules' });
}

// language, piece style or board colour changed: repaint whatever is on screen
function refreshLang() {
  applyStatic(); renderHome(); paintSound();
  BOARDS.forEach(b => b.restyle());
  const s = screen();
  if (s == 'room' && S && S.room) renderRoom(S.room, S.me);
  if (s == 'game') { setPlates(); setTicker(-1); if (G.ex) renderEx(false); else renderGame(false); }
  if (s == 'review') { paintReviewHead(); LX.gen++; LX.cache = {}; R.preview = null; renderReview(false); updateProgress(); }
  if (s == 'explore') { LX.gen++; LX.cache = {}; renderExplore(false, true); }
}
function paintSound() { $('btnSound').innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${DB.settings.sound ? 'sound' : 'mute'}"/></svg>`; }
$('btnSound').onclick = () => { DB.settings.sound = !DB.settings.sound; save(); paintSound(); AU.select(); };
