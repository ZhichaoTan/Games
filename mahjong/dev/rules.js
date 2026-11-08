// 规则在界面上对不对：缺门牌随时打（默认）和必须先打两种房间、过水提示、大厅里的"缺门牌"选项
// node rules.js [base] [outprefix] [lang]，需要本地静态服务器（比如 python3 -m http.server 8765）
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/mahjong/';
const OUT = process.argv[3] || 'rules';
const LANG = process.argv[4] || 'zh';

(async () => {
  const b = await chromium.launch();
  const fails = [];
  const check = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
  const box = async (p, sel) => { const e = await p.$(sel); return e ? e.boundingBox() : null; };
  const tap = async (p, sel) => { const bb = await box(p, sel); if (!bb) return false; await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
  const tapTile = async (p, id) => {
    const bb = await box(p, `.t.stand[data-k="${id}"]`); if (!bb) return false;
    await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(250);
    const b2 = await box(p, `.t.stand[data-k="${id}"]`); if (b2) await p.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await p.waitForTimeout(400);
    return true;
  };
  async function open(rules) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: +(process.env.DSF || 1), hasTouch: true, isMobile: true });
    p.errs = [];
    p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
    await p.addInitScript(([lang, rules]) => {
      try { localStorage.setItem('mh_name', JSON.stringify('Tester')); localStorage.setItem('mh_lang', JSON.stringify(lang)); localStorage.setItem('mh_mj_prefs', JSON.stringify({ speed: 'fast', rules })); } catch (e) {}
    }, [LANG, rules]);
    await p.goto(BASE + (rules ? '?autosolo=1' : ''));
    await p.waitForTimeout(900);
    return p;
  }
  const state = p => p.evaluate(() => {
    const v = MJAPP.ui.view; if (!v || !v.R) return null;
    const R = v.R, q = R.que[v.me];
    return { k: v.opt && v.opt.k, que: v.opt && v.opt.que, lock: v.opt && v.opt.queLock, phase: R.phase, turn: R.turn, me: v.me,
      hand: R.hand, q, river: R.river[v.me].slice(), dim: document.querySelectorAll('.t.dim').length,
      status: (() => { const e = document.querySelector('.status'); return e && !e.hidden ? e.textContent : ''; })(),
      toast: (() => { const e = document.getElementById('toast'); return e && !e.hidden ? e.textContent : ''; })() };
  });
  // 换三张点确定；定缺故意选手里最多的那门（保证轮到自己时手里有缺门）；别人的牌能碰就过；打到轮到自己出牌
  async function untilMyTurn(p) {
    for (let i = 0; i < 600; i++) {
      await p.waitForTimeout(120);
      const st = await state(p); if (!st) continue;
      if (st.k === 'swap') { await tap(p, '.banner [data-a="swap"]'); continue; }
      if (st.k === 'que') {
        const c = [0, 0, 0]; for (const id of st.hand) c[(id >> 2) / 9 | 0]++;
        const s = c.indexOf(Math.max(...c));
        await p.waitForTimeout(300); await tap(p, `.banner .qbtn[data-s="${s}"]`); continue;
      }
      if (st.k === 'claim') { await tap(p, '.acts .abtn.pass'); continue; }
      if (st.k === 'turn' && st.phase === 'play') return st;
    }
    return null;
  }
  const SU = id => (id >> 2) / 9 | 0;

  // ---------- 1. 默认：缺门牌随时打 ----------
  {
    const p = await open({ swap: true, rounds: 4 });
    const st = await untilMyTurn(p);
    check(st && st.que && !st.lock, '默认房间：轮到我，手里有缺门，没锁');
    if (st) {
      check(st.dim === 0, '别的牌没有变暗');
      check(/打完才能胡|can’t win until/.test(st.status), '提示还剩几张缺门：' + st.status);
      await p.screenshot({ path: `${OUT}-free.png` });
      const other = st.hand.find(id => SU(id) !== st.q);
      await tapTile(p, other);
      const st2 = await state(p);
      check(st2 && st2.river.includes(other), '留着缺门，先打了别的牌');
      // 过水提示：直接在牌桌上记下"放过了一手 1 番的胡"，等下一个动作刷新画面
      await p.evaluate(() => { const T = MJAPP.S.table(); T.R.passHu[0] = true; T.R.passFan[0] = 1; });
      let seen = '';
      for (let i = 0; i < 60 && !seen; i++) { await p.waitForTimeout(100); const s3 = await state(p); if (s3 && /过水|passed a win/.test(s3.status)) seen = s3.status; }
      check(!!seen, '过水提示：' + seen);
      if (seen) await p.screenshot({ path: `${OUT}-pass.png` });
    }
    check(p.errs.length === 0, '没有报错 ' + p.errs.join(' | '));
    await p.close();
  }

  // ---------- 2. 房间设成缺门必须先打 ----------
  {
    const p = await open({ swap: true, rounds: 4, queFirst: true });
    const st = await untilMyTurn(p);
    check(st && st.que && st.lock, '先打缺门的房间：锁住');
    if (st) {
      check(st.dim > 0, '别的牌变暗');
      check(/先把缺的|first/.test(st.status), '提示先打缺门：' + st.status);
      await p.screenshot({ path: `${OUT}-lock.png` });
      const other = st.hand.find(id => SU(id) !== st.q);
      await tapTile(p, other);
      const st2 = await state(p);
      check(st2 && !st2.river.includes(other) && st2.hand.includes(other), '别的牌打不出去');
      check(/先打缺门|void suit first/.test(st2 ? st2.toast : ''), '弹出提示：' + (st2 && st2.toast));
      const q = st.hand.find(id => SU(id) === st.q);
      await tapTile(p, q);
      const st3 = await state(p);
      check(st3 && st3.river.includes(q), '缺门牌能打');
    }
    check(p.errs.length === 0, '没有报错 ' + p.errs.join(' | '));
    await p.close();
  }

  // ---------- 3. 大厅：更多规则里有"缺门牌"，默认随时打 ----------
  {
    const p = await open(null);
    await tap(p, '#tabs [data-tab="host"]'); await p.waitForTimeout(300);
    const more = await p.$('#optsHost .more2');
    if (more && (await more.textContent()) !== '−') { await more.click(); await p.waitForTimeout(300); }
    const row = await p.evaluate(() => {
      const box = document.getElementById('optsHost'); const spans = [...box.querySelectorAll(':scope > span')];
      const l = spans.find(s => /缺门牌|Void tiles/.test(s.textContent)); if (!l) return null;
      const seg = l.nextElementSibling; return [...seg.querySelectorAll('button')].map(x => x.textContent + (x.classList.contains('on') ? '*' : ''));
    });
    check(!!row && row.length === 2 && row[0].endsWith('*'), '大厅有缺门牌选项，默认随时打：' + JSON.stringify(row));
    await p.evaluate(() => { const box = document.getElementById('optsHost'); const l = [...box.querySelectorAll(':scope > span')].find(s => /缺门牌|Void tiles/.test(s.textContent)); l.nextElementSibling.querySelectorAll('button')[1].click(); });
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('mh_mj_prefs')).rules.queFirst);
    check(saved === true, '点"必须先打"会记住');
    await p.screenshot({ path: `${OUT}-lobby.png`, fullPage: true });
    check(p.errs.length === 0, '没有报错 ' + p.errs.join(' | '));
    await p.close();
  }
  await b.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'all ok');
  process.exit(fails.length ? 1 : 0);
})();
