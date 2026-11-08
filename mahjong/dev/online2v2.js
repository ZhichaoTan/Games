// 2v2 联机测试（先开本地 PeerServer：npx -p peer peerjs --port 9000 --host 127.0.0.1）
// 房主开 2v2 房间，三个朋友进来，房主把 Ann 设为队友；开局后房主真的点「换」跟 Ann 要一张牌，Ann 在自己手机上点「换」同意；
// 然后 Ann 掉线再回来（座位跟着人走），打完这一局看结算里的两队合计
// node online2v2.js http://127.0.0.1:8765/mahjong/ outprefix
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/mahjong/';
const OUT = process.argv[3] || 'tv';
const PH = '?ph=127.0.0.1:9000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async (name, lang, size) => {
    const ctx = await b.newContext({ viewport: size || { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: !size });
    await ctx.addInitScript(([n, l]) => { try { if (!localStorage.getItem('mh_name')) { localStorage.setItem('mh_name', JSON.stringify(n)); localStorage.setItem('mh_lang', JSON.stringify(l)); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast' })); } } catch (e) {} }, [name, lang]);
    const u = { ctx, name };
    u.open = async (hash) => {
      u.p = await ctx.newPage();
      u.p.on('pageerror', e => errs.push(name + ' pageerror: ' + e.message));
      u.p.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_|net::/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
      await u.p.goto(BASE + PH + (hash ? '#' + hash : ''));
      await u.p.waitForTimeout(700);
    };
    return u;
  };
  const tap = async (u, sel) => { const e = await u.p.$(sel); if (!e) return false; const bb = await e.boundingBox(); if (!bb) return false; await u.p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
  const view = u => u.p.evaluate(() => { const v = MJAPP.ui.view || (MJAPP.S && MJAPP.S.view); return v ? { me: v.me, phase: v.R && v.R.phase, stage: v.R && v.R.stage, team: v.rules.team, seats: v.seats.map(p => p && p.name), mate: v.R && v.R.mate, mateN: v.R && v.R.mateHand && v.R.mateHand.length, opt: v.opt && v.opt.k } : null; });
  // 名字牌上的换牌次数：自己队两个人都有、跟 tsLeft 一致；对手那队没有
  const plates = u => u.p.evaluate(() => {
    const v = MJAPP.ui.view, R = v.R, me = v.me, zh = document.documentElement.lang !== 'en';
    const over = R.hu[me] || R.hu[(me + 2) % 4];
    return [...document.querySelectorAll('.seat')].filter(e => !e.hidden).map(e => {
      const nm = e.querySelector('.nm').firstChild.textContent, s = v.seats.findIndex(p => p && p.name === nm);
      const t = e.querySelector('.tsl'), txt = t ? t.textContent : null, n = R.tsLeft[s];
      const want = (s !== me && s !== (me + 2) % 4) || R.phase === 'end' ? null : over || n <= 0 ? (zh ? '不能再换' : 'Swaps 0') : !v.rules.tswap ? (zh ? '换牌不限' : 'Swaps ∞') : (zh ? `可换${n}次` : `Swaps ${n}`);
      return { nm, txt, want };
    });
  });
  const checkPlates = async (label, us) => {
    for (const u of us) {
      const ps = await plates(u), bad = ps.filter(x => x.txt !== x.want);
      console.log(`plates ${label} ${u.name}: ${bad.length ? 'BAD ' + JSON.stringify(bad) : 'ok'} ${ps.map(x => x.nm + '=' + x.txt).join(' ')}`);
    }
  };
  const H = await mk('Host', 'zh');
  await H.open();
  await H.p.click('#tabs [data-tab="host"]');
  // 玩法选 2v2
  await H.p.evaluate(() => { const row = [...document.querySelectorAll('#optsHost .seg')][1]; row.querySelectorAll('button')[1].click(); });
  await H.p.waitForTimeout(200);
  await H.p.screenshot({ path: OUT + '-lobby.png' });
  await H.p.click('#btnCreate');
  await H.p.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('roomCode').textContent.trim()), null, { timeout: 15000 });
  const code = (await H.p.textContent('#roomCode')).trim();
  console.log('room', code);
  const A = await mk('Ann', 'zh'); await A.open(code);
  await sleep(800);
  const B = await mk('Ben', 'en'); await B.open(code);
  await sleep(800);
  const C = await mk('Cat', 'en'); await C.open(code);
  await H.p.waitForFunction(() => document.querySelectorAll('#seats4 .rs:not(.empty)').length === 4, null, { timeout: 20000 });
  console.log('seats before', JSON.stringify((await view(H)).seats));
  await H.p.screenshot({ path: OUT + '-room-before.png' });
  // Ann 在 1 号位（对手），设为队友 → 换到 2 号位
  await H.p.click('#seats4 [data-mate="1"]');
  await sleep(1200);
  const hv = await view(H), av = await view(A), bv = await view(B);
  console.log('seats after', JSON.stringify(hv.seats), 'Ann me=' + av.me, 'Ben me=' + bv.me);
  await H.p.screenshot({ path: OUT + '-room-host.png' });
  await A.p.screenshot({ path: OUT + '-room-ann.png' });
  await H.p.click('#roomActs .btn.gold');
  await A.p.waitForFunction(() => MJAPP.ui.view && MJAPP.ui.view.R, null, { timeout: 15000 });
  for (const u of [B, C]) await u.p.evaluate(() => MJAPP.S.setAuto(true));
  // 换三张、定缺：房主和 Ann 自己点推荐
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    for (const u of [H, A]) { await tap(u, '.banner [data-a="swap"]'); await tap(u, '.banner .qbtn.rec'); }
    const v = await view(H); if (v.phase === 'play') break;
  }
  console.log('Ann sees mate', JSON.stringify(await view(A)));
  // 打到房主可以换牌（房主出牌用电脑的选择，Ann 也一样）
  let done = false, swapped = false;
  for (let i = 0; i < 160 && !done; i++) {
    await sleep(300);
    for (const u of [H, A]) {
      const st = await u.p.evaluate(() => { const v = MJAPP.ui.view; if (!v || !v.opt) return null; const d = MJAI.decide(v, 3, Math.random); return { k: v.opt.k, ts: !!v.opt.ts, d, phase: v.R.phase }; });
      if (!st) continue;
      if (u === H && st.k === 'turn' && st.ts && !swapped) {
        // 房主：点「换」，挑队友第一张不同种类的牌，给出自己最右边的一张
        await tap(H, '.acts .abtn.ts');
        await sleep(300);
        const pick = await H.p.evaluate(() => { const v = MJAPP.ui.view; const h = v.R.hand, m = v.R.mateHand; const give = v.R.drawn != null ? v.R.drawn : h[h.length - 1]; const take = m.find(x => (x >> 2) !== (give >> 2)); return { give, take }; });
        await tap(H, `.tspanel .tm[data-id="${pick.take}"]`); await sleep(150);
        await tap(H, `.t.stand[data-k="${pick.give}"]`); await sleep(250);
        await H.p.screenshot({ path: OUT + '-host-pick.png' });
        await tap(H, '.tspanel [data-a="tsgo"]');
        await A.p.waitForFunction(() => MJAPP.ui.view && MJAPP.ui.view.opt && MJAPP.ui.view.opt.k === 'offer', null, { timeout: 8000 });
        await sleep(400);
        await A.p.screenshot({ path: OUT + '-ann-offer.png' });
        await H.p.screenshot({ path: OUT + '-host-wait.png' });
        await tap(A, '.tspanel [data-a="tsyes"]');
        await sleep(900);
        const ok = await H.p.evaluate(p => { const v = MJAPP.ui.view; return v.R.hand.includes(p.take) && !v.R.hand.includes(p.give) && v.R.mateHand.includes(p.give); }, pick);
        const okA = await A.p.evaluate(p => { const v = MJAPP.ui.view; return v.R.hand.includes(p.give) && v.R.mateHand.includes(p.take); }, pick);
        console.log('swap done on host:', ok, 'on Ann:', okA);
        await H.p.screenshot({ path: OUT + '-host-after.png' });
        await A.p.screenshot({ path: OUT + '-ann-after.png' });
        await checkPlates('after swap', [H, A, B, C]);
        swapped = true;
        continue;
      }
      if (st.k === 'offer') { await tap(u, '.tspanel [data-a="' + (st.d && st.d.k === 'tsyes' ? 'tsyes' : 'tsno') + '"]'); continue; }
      if (st.phase !== 'play') continue;
      if (swapped) { done = true; break; }
      // 其他情况：直接用电脑的选择
      await u.p.evaluate(() => { const v = MJAPP.ui.view; const d = MJAI.decide(v, 3, Math.random); if (d.k === 'tswap') { const x = MJAI.chooseDiscard(v, 3, Math.random); MJAPP.S.act({ k: 'discard', id: x }); } else MJAPP.S.act(d); });
    }
  }
  console.log('swapped:', swapped);
  // Ann 掉线再回来
  await A.p.close();
  await sleep(4000);
  await A.open(code);
  await A.p.waitForFunction(() => MJAPP.ui.view && MJAPP.ui.view.R, null, { timeout: 20000 });
  const av2 = await view(A);
  console.log('Ann back: me=' + av2.me + ' mate=' + av2.mate + ' mateN=' + av2.mateN);
  await sleep(600);
  await checkPlates('Ann back', [A, H]);
  for (const u of [H, A]) await u.p.evaluate(() => MJAPP.S.setAuto(true));
  let ended = false;
  for (let i = 0; i < 90 && !ended; i++) {
    await sleep(1000);
    for (const u of [H, A, B, C]) {
      const nx = await u.p.$('#btnNext:not([disabled])');
      if (nx) { if (!ended) { await sleep(600); await H.p.screenshot({ path: OUT + '-result-host.png' }); await B.p.screenshot({ path: OUT + '-result-ben.png' }); } ended = true; }
    }
  }
  console.log('round ended:', ended);
  const tot = await H.p.evaluate(() => { const v = MJAPP.ui.view; const d = v.R.result ? v.R.result.deltas : null; return d; });
  console.log('deltas', JSON.stringify(tot));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
