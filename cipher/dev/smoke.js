const L = require('./lib');
(async () => {
  const b = await L.launch();
  const p = await L.open(b, { lang: process.argv[2] || 'zh' });
  await L.shot(p, 'smoke-lobby');
  await L.click(p, 'btnSolo');
  await p.waitForTimeout(2500);
  await L.shot(p, 'smoke-game');
  L.report(p);
  await b.close();
})();
