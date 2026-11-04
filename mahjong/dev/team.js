// 2v2 练习：像真人一样点（换牌按钮、挑牌、同意/不换），每种场面截一张图
// node team.js url outprefix W H [lang] [maxSteps]
const { chromium } = require('playwright');
(async () => {
  const [url, out, W, H, lang, maxSteps] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DSF || 1), hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript((lang) => { try { localStorage.setItem('mh_name', JSON.stringify('Tester')); localStorage.setItem('mh_lang', JSON.stringify(lang)); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast', rules: { team: true, tswap: 3, rounds: 2 } })); } catch (e) {} }, lang || 'en');
  await p.goto(url);
  await p.waitForTimeout(900);
  const shots = new Set();
  const shot = async name => { if (shots.has(name)) return; shots.add(name); await p.screenshot({ path: `${out}-${name}.png` }); };
  const box = async sel => { const e = await p.$(sel); return e ? e.boundingBox() : null; };
  const tap = async sel => { const bb = await box(sel); if (!bb) return false; await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
  const log = [];
  let n = 0, rounds = 0, lastEvn = -1, stuck = 0, asked = 0, answered = 0, waited = 0;
  while (n++ < (+maxSteps || 600)) {
    await p.waitForTimeout(200);
    const st = await p.evaluate(() => {
      const v = MJAPP.ui.view; if (!v) return null;
      const R = v.R;
      let dec = null;
      if (v.opt) {
        dec = MJAI.decide(v, 3, Math.random);
        // 有机会就换（测试界面）：挑一张能让自己变好的
        if (v.opt.k === 'turn' && v.opt.ts && dec.k !== 'tswap' && dec.k !== 'zimo') {
          const sw = MJAI.chooseTSwap(Object.assign({}, v, { opt: Object.assign({}, v.opt, { tsLeft: 99 }) }), 4);
          if (sw) dec = { k: 'tswap', give: sw.give, take: sw.take };
        }
      }
      return {
        phase: R && R.phase, stage: R && R.stage, opt: v.opt, evn: v.evn, dec,
        waiting: !!(R && R.offer && R.offer.from === v.me),
        next: !!document.getElementById('btnNext') && !document.getElementById('btnNext').disabled,
        fin: !!document.getElementById('finFoot'),
        mateRow: document.querySelectorAll('.t.mate').length,
      };
    });
    if (!st) continue;
    if (st.mateRow && st.phase === 'play') await shot('table');
    if (st.fin) { await p.waitForTimeout(500); await shot('final'); log.push('final'); break; }
    if (st.next) { await p.waitForTimeout(400); await shot('result' + rounds); rounds++; log.push('result'); await tap('#btnNext'); continue; }
    if (st.waiting) { waited++; await shot('waiting'); continue; }
    if (!st.opt) { stuck = st.evn === lastEvn ? stuck + 1 : 0; lastEvn = st.evn; if (stuck > 150) { log.push('stuck'); break; } continue; }
    stuck = 0;
    const o = st.opt, d = st.dec;
    if (o.k === 'swap') { await p.waitForTimeout(400); await shot('swap3'); if (await tap('.banner [data-a="swap"]')) log.push('swap3'); continue; }
    if (o.k === 'que') { await p.waitForTimeout(400); if (await tap('.banner .qbtn.rec')) log.push('que'); continue; }
    if (o.k === 'offer') {
      await p.waitForTimeout(500);
      await shot('offer');
      const k = d && d.k === 'tsyes' ? 'tsyes' : 'tsno';
      if (await tap(`.tspanel [data-a="${k}"]`)) { answered++; log.push('offer:' + k); }
      await p.waitForTimeout(300);
      continue;
    }
    if (o.k === 'claim') {
      const k = d && d.k || 'pass';
      if (!(await tap(`.acts .abtn.${k}`))) await tap('.acts .abtn.pass');
      log.push('claim:' + k);
      await p.waitForTimeout(300);
      continue;
    }
    if (o.k === 'turn' && d) {
      if (d.k === 'tswap') {
        await shot('turn-ts');
        if (!(await tap('.acts .abtn.ts'))) { log.push('no-ts-btn'); }
        await p.waitForTimeout(300);
        await shot('panel');
        const taken = await p.evaluate(() => { const b = document.querySelector('.tspanel .tm.on'); return b ? +b.dataset.id : null; });
        if (taken !== d.take) await tap(`.tspanel .tm[data-id="${d.take}"]`);
        await p.waitForTimeout(200);
        const given = await p.evaluate(() => { const e = document.querySelector('.t.stand.give'); return e ? +e.dataset.k : null; });
        if (given !== d.give) await tap(`.t.stand[data-k="${d.give}"]`);
        await p.waitForTimeout(250);
        await shot('panel-ready');
        if (await tap('.tspanel [data-a="tsgo"]')) { asked++; log.push('tswap'); }
        await p.waitForTimeout(300);
        continue;
      }
      if (d.k === 'zimo' || d.k === 'angang' || d.k === 'bugang') {
        await tap(d.k === 'zimo' ? '.acts .abtn.hu' : '.acts .abtn.gang');
        await p.waitForTimeout(250);
        await tap('.gopts:not([hidden]) button');
        log.push(d.k); continue;
      }
      if (d.k === 'discard') {
        const bb = await box(`.t.stand[data-k="${d.id}"]`);
        if (!bb) { log.push('notile'); continue; }
        await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(200);
        const b2 = await box(`.t.stand[data-k="${d.id}"]`);
        if (b2) await p.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height / 2);
        await p.waitForTimeout(220);
        continue;
      }
    }
  }
  console.log(log.join(' '));
  console.log(`asked ${asked} answered ${answered} waitTicks ${waited} rounds ${rounds}`);
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
