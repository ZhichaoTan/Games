// Every string the page uses must exist in both languages, with the same shape: node shiba/dev/i18n-check.js
// It also checks that the brush font subset has every character of the Chinese text drawn with it (needs python3 with fontTools).
const fs = require('fs'), path = require('path'), cp = require('child_process');
globalThis.window = globalThis; require('../src/i18n.js');
const S = SBI18N.S, src = path.join(__dirname, '..', 'src');
const used = new Set(), dyn = [];
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
for (const m of html.matchAll(/data-t(?:-[a-z]+)?="([\w]+)"/g)) used.add(m[1]);
for (const f of fs.readdirSync(path.join(src, 'app'))) {
  const js = fs.readFileSync(path.join(src, 'app', f), 'utf8');
  for (const m of js.matchAll(/\bT\(\s*'([\w]+)'/g)) used.add(m[1]);
  for (const m of js.matchAll(/\bT\(\s*([^'\s)][^,)]*)/g)) dyn.push(f + ': T(' + m[1] + ')');
  for (const m of js.matchAll(/data-t="([\w]+)"/g)) used.add(m[1]);
  // keys picked at run time: T(x ? 'a' : 'b') and notes sent by key
  for (const m of js.matchAll(/\?\s*'([\w]+)'\s*:\s*'([\w]+)'/g)) { if (S.en[m[1]] != null) used.add(m[1]); if (S.en[m[2]] != null) used.add(m[2]); }
  for (const m of js.matchAll(/notice\(\s*'([\w]+)'/g)) used.add(m[1]);
}
let bad = 0;
for (const k of used) for (const l of ['en', 'zh']) if (S[l][k] == null) { console.log('missing', l, k); bad++; }
for (const k of Object.keys(S.en)) if (S.zh[k] == null) { console.log('zh lacks', k); bad++; }
for (const k of Object.keys(S.zh)) if (S.en[k] == null) { console.log('en lacks', k); bad++; }
for (const k of Object.keys(S.en)) {
  const a = S.en[k], b = S.zh[k];
  if (b == null) continue;
  if (typeof a != typeof b || Array.isArray(a) != Array.isArray(b) || (Array.isArray(a) && a.length != b.length)) { console.log('shape differs', k); bad++; }
  else if (a && typeof a == 'object' && !Array.isArray(a)) for (const j of Object.keys(a)) if (b[j] == null) { console.log('zh lacks', k + '.' + j); bad++; }
  // the same {placeholders} in both
  const ph = s => JSON.stringify(s).match(/\{\w+\}/g) || [];
  if (JSON.stringify(ph(a).sort()) !== JSON.stringify(ph(b).sort())) { console.log('placeholders differ', k, ph(a), ph(b)); bad++; }
}
// no Chinese characters in the English strings (the language button names the other language)
for (const k of Object.keys(S.en)) if (/[一-鿿]/.test(JSON.stringify(S.en[k])) && k !== 'langBtn') { console.log('Chinese in en', k); bad++; }
// the brush font has every character it is asked to draw
const mk = fs.readFileSync(path.join(__dirname, 'makefont.py'), 'utf8');
const keys = JSON.parse(mk.match(/KEYS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
const flat = x => typeof x === 'string' ? x : Object.values(x).join('');
const text = keys.map(k => flat(S.zh[k])).join('') + '！';
try {
  const have = cp.execFileSync('python3', ['-I', '-c', 'import sys,json;from fontTools.ttLib import TTFont;print(json.dumps(sorted(TTFont(sys.argv[1]).getBestCmap().keys())))', path.join(src, 'fonts', 'sb-brush.woff2')]).toString();
  const set = new Set(JSON.parse(have));
  const miss = [...new Set(text.replace(/\s/g, ''))].filter(c => !set.has(c.codePointAt(0)));
  if (miss.length) { console.log('brush font lacks', miss.join(''), '(run dev/makefont.py)'); bad++; } else console.log('brush font covers', new Set(text.replace(/\s/g, '')).size, 'characters');
} catch (e) { console.log('(brush font not checked: python3 with fontTools is needed)'); }
const unused = Object.keys(S.en).filter(k => !used.has(k));
console.log('keys used:', used.size, '| defined:', Object.keys(S.en).length, '| problems:', bad);
console.log('not referenced by a literal key (check by hand):', unused.join(' '));
console.log('dynamic calls:\n  ' + [...new Set(dyn)].join('\n  '));
process.exit(bad ? 1 : 0);
