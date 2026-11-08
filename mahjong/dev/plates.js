// 2v2 名字牌上的换牌次数：自己和队友一直显示还能换几次，换成功少一次，队里有人胡了显示不能再换，对手那队没有；
// 名字牌不压到手牌、对手头像、提示条和出牌提示点（飞行中的牌不算）
// node plates.js 'http://127.0.0.1:8765/mahjong/?autosolo=1&team=1' outprefix W H [lang] [每局换牌次数，0 = 不限]
const { chromium } = require('playwright');
(async () => {
  const [url, out, W, H, lang, tswap] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, hasTouch: true, isMobile: +W < 1000 });
  const errs = [], fails = [];
  const check = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(([lang, tswap]) => { try { localStorage.setItem('mh_name', JSON.stringify('Tester')); localStorage.setItem('mh_lang', JSON.stringify(lang)); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast', rules: { team: true, tswap: +tswap, rounds: 2 } })); } catch (e) {} }, [lang || 'zh', tswap || 3]);
  await p.goto(url);
  await p.waitForTimeout(900);
  const snap = () => p.evaluate(() => {
    const v = MJAPP.ui.view; if (!v || !v.R) return null;
    const R = v.R, me = v.me, mate = (me + 2) % 4;
    const plates = [...document.querySelectorAll('.seat')].filter(e => !e.hidden);
    const us = plates.filter(e => e.classList.contains('us')), them = plates.filter(e => e.classList.contains('them'));
    const txt = e => { const x = e.querySelector('.tsl'); return x ? x.textContent : null; };
    const nm = e => e.querySelector('.nm').firstChild.textContent;
    const myP = us.find(e => nm(e) === v.seats[me].name), mateP = us.find(e => nm(e) === v.seats[mate].name);
    // 名字牌有没有压到队友的牌（竖屏队友牌在名字牌右边）
    const tray = document.querySelector('.matetray');
    let overlap = 0;
    if (tray && !tray.hidden && mateP) { const a = mateP.querySelector('.info').getBoundingClientRect(), t = tray.getBoundingClientRect(); overlap = Math.max(0, Math.min(a.right, t.right) - Math.max(a.left, t.left)) * (Math.min(a.bottom, t.bottom) > Math.max(a.top, t.top) ? 1 : 0); }
    // 自己队的名字牌有没有压到别的东西：自己的手牌、对手的头像/名字牌、提示条、换牌提示点
    const R2 = e => e.getBoundingClientRect();
    const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const others = [...document.querySelectorAll('.t.stand, .seat.them .av, .seat.them .badge, .seat.them .info, .seat.them .stat')].filter(e => !e.getAnimations().length).concat([...document.querySelectorAll('.status, .tingchip')].filter(e => !e.hidden));
    const dots = [...document.querySelectorAll('.t.stand.mk, .t.stand.mkb')].map(e => { const r = R2(e); return { left: r.left + r.width * 0.3, right: r.right - r.width * 0.3, top: r.top - r.width * 0.55, bottom: r.top - r.width * 0.1 }; });
    const hits = [];
    const hitInfo = [];
    for (const pl of us) { const a = R2(pl.querySelector('.info')); for (const o of others) if (hit(a, R2(o))) { hits.push(o.className); const r = R2(o); hitInfo.push({ c: o.className, k: o.dataset.k, r: [r.left, r.top, r.right, r.bottom].map(Math.round), tf: o.style.transform, anim: o.getAnimations().length }); } for (const d of dots) if (hit(a, d)) hits.push('dot'); }
    const box = e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); };
    return { phase: R.phase, k: v.opt && v.opt.k, ts: v.opt && v.opt.ts, turn: R.turn, me, left: R.tsLeft.slice(), hu: R.hu.slice(), offer: !!R.offer,
      mine: myP ? txt(myP) : 'noplate', mates: mateP ? txt(mateP) : 'noplate', them: them.map(txt), overlap, myBox: myP && box(myP), mateBox: mateP && box(mateP), H: innerHeight, W: innerWidth,
      hits, hitInfo, bump: !!document.querySelector('.tsl.bump'), btn: (() => { const e = document.querySelector('.acts .abtn.ts'); if (!e) return 'nobtn'; const c = e.querySelector('.cnt'); return c ? c.textContent : null; })(), inf: !v.rules.tswap };
  });
  let hitN = 0;
  let shots = {}, swaps = 0, seenBump = false, seenOver = false, bad = 0, checks = 0, lastLeft = null, rounds = 0;
  const shot = async (name) => { if (shots[name]) return; shots[name] = 1; await p.screenshot({ path: `${out}-${name}.png` }); };
  for (let i = 0; i < 1500; i++) {
    await p.waitForTimeout(110);
    const st = await snap(); if (!st) continue;
    if (st.phase === 'end') { if (await p.$('#btnNext:not([disabled])')) { rounds++; if (rounds >= 2) break; await p.click('#btnNext'); } continue; }
    const over = st.hu[st.me] || st.hu[(st.me + 2) % 4];
    const want = n => over || n <= 0 ? 'none' : n >= 99 ? 'inf' : String(n);
    const got = t => t == null ? 'missing' : /不能再换|Swaps 0/.test(t) ? 'none' : /不限|∞/.test(t) ? 'inf' : (t.match(/\d+/) || ['?'])[0];
    checks++;
    const okMine = got(st.mine) === want(st.left[st.me]), okMate = got(st.mates) === want(st.left[(st.me + 2) % 4]);
    const okBtn = st.btn === 'nobtn' || (st.inf ? st.btn == null : st.btn === String(st.left[st.me]));
    if (!okBtn) { bad++; console.log('BADBTN', JSON.stringify(st)); }
    if (st.hits.length) { hitN++; if (hitN < 5) console.log('HIT', st.phase, st.hits.join(','), JSON.stringify(st.hitInfo)); if (hitN === 1) await p.screenshot({ path: out + '-hit.png' }); }
    if (!okMine || !okMate || st.them.some(x => x != null) || st.overlap > 0.5 || (st.myBox && st.myBox[3] > st.H) ) { bad++; if (bad < 6) console.log('BAD', JSON.stringify(st)); }
    if (st.bump) seenBump = true;
    if (over) { seenOver = true; await shot('over'); }
    if (st.phase === 'play' && st.k === 'turn' && st.ts) await shot('turn');
    if (st.phase === 'play' && !st.k && st.turn !== st.me && !st.offer) await shot('other');
    if (lastLeft && st.left[st.me] < lastLeft[st.me]) { swaps++; await p.waitForTimeout(150); await shot('afterswap'); }
    if (lastLeft && st.left[(st.me + 2) % 4] < lastLeft[(st.me + 2) % 4]) { await p.waitForTimeout(150); await shot('mateswap'); }
    lastLeft = st.left;
    if (st.k) await p.evaluate(() => {
      const v = MJAPP.ui.view; let d = MJAI.decide(v, 3, Math.random);
      // 测试：能换就换（找一张让自己变好的）
      if (v.opt.k === 'turn' && v.opt.ts && d.k !== 'zimo') { const sw = MJAI.chooseTSwap(Object.assign({}, v, { opt: Object.assign({}, v.opt, { tsLeft: 99 }) }), 4); if (sw) d = { k: 'tswap', give: sw.give, take: sw.take }; }
      MJAPP.S.act(d);
    });
  }
  check(checks > 50 && bad === 0, `每一刻名字牌上的次数都对（${checks} 次检查，${bad} 次不对）`);
  check(hitN === 0, `名字牌没压到别的东西（${hitN} 次压到）`);
  if (+tswap) check(swaps > 0, `我换成功过 ${swaps} 次，次数跟着少`);
  check(seenOver, '队里有人胡了以后显示不能再换');
  console.log('bump seen', seenBump, 'rounds', rounds);
  check(errs.length === 0, '没有报错 ' + errs.join(' | '));
  await b.close();
  console.log(fails.length ? fails.length + ' FAILED' : 'all ok');
})();
