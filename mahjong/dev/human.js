// 像真人一样玩练习模式：点按钮、点两下出牌、上拖出牌、横滑选牌，每种场面截一张图
// node human.js url outprefix W H [lang] [maxSteps]
const { chromium } = require('playwright');
(async () => {
  const [url, out, W, H, lang, maxSteps] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DSF || 1), hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript((lang) => { try { localStorage.setItem('mh_name', JSON.stringify('Tester')); localStorage.setItem('mh_lang', JSON.stringify(lang)); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast' })); } catch (e) {} }, lang || 'en');
  await p.goto(url);
  await p.waitForTimeout(900);
  const shots = new Set();
  const shot = async name => { if (shots.has(name)) return; shots.add(name); await p.screenshot({ path: `${out}-${name}.png` }); };
  const box = async sel => { const e = await p.$(sel); return e ? e.boundingBox() : null; };
  const tileBox = id => box(`.t.stand[data-k="${id}"]`);
  const log = [];
  let n = 0, discards = 0, rounds = 0, lastEvn = -1, stuck = 0;
  while (n++ < (+maxSteps || 400)) {
    await p.waitForTimeout(220);
    const st = await p.evaluate(() => {
      const v = MJAPP.ui.view; if (!v) return null;
      const R = v.R;
      const sh = document.getElementById('sheet');
      return {
        phase: R && R.phase, opt: v.opt, evn: v.evn, hand: R && R.hand,
        dec: v.opt ? MJAI.decide(v, 3, Math.random) : null,
        sheet: sh && !sh.hidden && sh.classList.contains('open') ? (sh.dataset.id || 'open') : '',
        next: !!document.getElementById('btnNext') && !document.getElementById('btnNext').disabled,
        over: !!v.over, fin: !!document.getElementById('finFoot'),
      };
    });
    if (!st) continue;
    if (st.fin) { await shot('final'); log.push('final'); break; }
    if (st.next) { await shot('result' + rounds); rounds++; log.push('result'); await p.click('#btnNext'); if (rounds >= 2) break; continue; }
    if (!st.opt) { stuck = st.evn === lastEvn ? stuck + 1 : 0; lastEvn = st.evn; if (stuck > 120) { log.push('stuck'); break; } continue; }
    stuck = 0;
    const o = st.opt, d = st.dec;
    if (o.k === 'swap') {
      await p.waitForTimeout(500);
      await shot('swap');
      // 换一张：点掉第一张预选的，再点回来
      const bt = await box('.banner [data-a="swap"]');
      if (bt) { await p.touchscreen.tap(bt.x + bt.width / 2, bt.y + bt.height / 2); log.push('swap'); }
      continue;
    }
    if (o.k === 'que') {
      await p.waitForTimeout(400);
      await shot('que');
      const bt = await box('.banner .qbtn.rec');
      if (bt) { await p.touchscreen.tap(bt.x + bt.width / 2, bt.y + bt.height / 2); log.push('que'); }
      continue;
    }
    if (o.k === 'claim') {
      await shot('claim-' + (o.hu ? 'hu' : o.gang ? 'gang' : 'peng'));
      const k = d && d.k || 'pass';
      const bt = await box(`.acts .abtn.${k}`) || await box('.acts .abtn.pass');
      if (bt) { await p.touchscreen.tap(bt.x + bt.width / 2, bt.y + bt.height / 2); log.push('claim:' + k); }
      await p.waitForTimeout(300);
      continue;
    }
    if (o.k === 'turn') {
      if (!d) continue;
      if (d.k === 'zimo' || d.k === 'angang' || d.k === 'bugang') {
        await shot('turn-' + d.k);
        const bt = await box(d.k === 'zimo' ? '.acts .abtn.hu' : '.acts .abtn.gang');
        if (bt) {
          await p.touchscreen.tap(bt.x + bt.width / 2, bt.y + bt.height / 2);
          await p.waitForTimeout(250);
          const g = await box('.gopts:not([hidden]) button');
          if (g) await p.touchscreen.tap(g.x + g.width / 2, g.y + g.height / 2);
          log.push(d.k);
        }
        continue;
      }
      if (d.k === 'discard') {
        const tb = await tileBox(d.id);
        if (!tb) { log.push('notile'); continue; }
        const x = tb.x + tb.width / 2, y = tb.y + tb.height / 2;
        const mode = discards % 3;
        if (mode === 0) {
          // 点一下选中（看提示），再点一下打出去
          await p.touchscreen.tap(x, y); await p.waitForTimeout(260);
          if (discards < 6) await shot('select' + discards);
          const tb2 = await tileBox(d.id);
          if (tb2) await p.touchscreen.tap(tb2.x + tb2.width / 2, tb2.y + tb2.height / 2);
        } else if (mode === 1) {
          // 往上拖出去
          await p.mouse.move(x, y); await p.mouse.down();
          for (let i = 1; i <= 8; i++) { await p.mouse.move(x + i, y - i * 14); await p.waitForTimeout(16); }
          if (discards < 6) await shot('drag' + discards);
          await p.mouse.up();
        } else {
          // 从别的牌横滑过来再松手（选中），再点一下打出
          const hb = await p.$$eval('.t.stand', els => els.map(e => { const r = e.getBoundingClientRect(); return { k: e.dataset.k, x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
          const start = hb[0];
          await p.mouse.move(start.x, start.y); await p.mouse.down();
          const steps = 8;
          for (let i = 1; i <= steps; i++) { await p.mouse.move(start.x + (x - start.x) * i / steps, y); await p.waitForTimeout(16); }
          await p.mouse.up(); await p.waitForTimeout(200);
          const tb2 = await tileBox(d.id);
          if (tb2) await p.touchscreen.tap(tb2.x + tb2.width / 2, tb2.y + tb2.height / 2);
        }
        discards++;
        await p.waitForTimeout(250);
        continue;
      }
    }
  }
  console.log(log.join(' '));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
