// every string key the page uses must exist in both languages: node dev/i18n-check.js
const fs = require('fs'), path = require('path');
globalThis.window = globalThis; require('../src/i18n.js');
const S = CXI18N.S, src = path.join(__dirname, '..', 'src');
const used = new Set();
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
for (const m of html.matchAll(/data-t(?:-[a-z]+)?="([\w]+)"/g)) used.add(m[1]);
const dyn = [];
for (const f of fs.readdirSync(path.join(src, 'app'))) {
  const js = fs.readFileSync(path.join(src, 'app', f), 'utf8');
  for (const m of js.matchAll(/\bT\(\s*'([\w]+)'/g)) used.add(m[1]);
  for (const m of js.matchAll(/\bT\(\s*([^'\s)][^,)]*)/g)) dyn.push(f + ': T(' + m[1] + ')');
  for (const m of js.matchAll(/data-t="([\w]+)"/g)) used.add(m[1]);
}
let bad = 0;
for (const k of used) for (const l of ['en', 'zh']) if (S[l][k] == null) { console.log('missing', l, k); bad++; }
for (const k of Object.keys(S.en)) if (S.zh[k] == null) { console.log('zh lacks', k); bad++; }
for (const k of Object.keys(S.zh)) if (S.en[k] == null) { console.log('en lacks', k); bad++; }
for (const k of Object.keys(S.en)) {
  const a = S.en[k], b = S.zh[k]; if (b == null) continue;
  if (typeof a != typeof b || Array.isArray(a) != Array.isArray(b) || (Array.isArray(a) && a.length != b.length)) { console.log('shape differs', k); bad++; }
}
const unused = Object.keys(S.en).filter(k => !used.has(k));
console.log('keys used:', used.size, '| defined:', Object.keys(S.en).length, '| problems:', bad);
console.log('not referenced by a literal key (check by hand):', unused.join(' '));
console.log('dynamic calls:\n  ' + [...new Set(dyn)].join('\n  '));
process.exit(bad ? 1 : 0);
