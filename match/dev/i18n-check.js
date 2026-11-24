// Every string the page uses must exist in both languages, with the same shape, in both looks: node match/dev/i18n-check.js
// The little-animals look ('pal') only overrides some words; its English and Chinese overrides must match each other.
// It also checks that the two display fonts have every character drawn with them (needs python3 with fontTools).
const fs = require('fs'), path = require('path'), cp = require('child_process');
globalThis.window = globalThis; globalThis.localStorage = undefined; require('../src/i18n.js');
const I = MMI18N, S = I.S, PAL = I.PAL, src = path.join(__dirname, '..', 'src');
const used = new Set(), dyn = [];
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
for (const m of html.matchAll(/data-t(?:-[a-z]+)?="([\w]+)"/g)) used.add(m[1]);
for (const f of fs.readdirSync(path.join(src, 'app'))) {
  const js = fs.readFileSync(path.join(src, 'app', f), 'utf8');
  for (const m of js.matchAll(/\bT\(\s*'([\w]+)'/g)) used.add(m[1]);
  for (const m of js.matchAll(/\bT\(\s*([^'\s)][^,)]*)/g)) dyn.push(f + ': T(' + m[1] + ')');
  for (const m of js.matchAll(/data-t="([\w]+)"/g)) used.add(m[1]);
  for (const m of js.matchAll(/\?\s*'([\w]+)'\s*:\s*'([\w]+)'/g)) { if (S.en[m[1]] != null) used.add(m[1]); if (S.en[m[2]] != null) used.add(m[2]); }
  for (const m of js.matchAll(/(?:notice|say)\(\s*'([\w]+)'/g)) used.add(m[1]);
}
let bad = 0;
const fail = (...a) => { console.log(...a); bad++; };
function pair(A, B, tag) {
  for (const k of Object.keys(A)) if (B[k] == null) fail(tag, 'zh lacks', k);
  for (const k of Object.keys(B)) if (A[k] == null) fail(tag, 'en lacks', k);
  for (const k of Object.keys(A)) {
    const a = A[k], b = B[k];
    if (b == null) continue;
    if (typeof a != typeof b || Array.isArray(a) != Array.isArray(b) || (Array.isArray(a) && a.length != b.length)) fail(tag, 'shape differs', k);
    else if (a && typeof a == 'object' && !Array.isArray(a)) for (const j of Object.keys(a)) if (b[j] == null) fail(tag, 'zh lacks', k + '.' + j);
    const ph = s => JSON.stringify(s).match(/\{\w+\}/g) || [];
    if (JSON.stringify(ph(a).sort()) !== JSON.stringify(ph(b).sort())) fail(tag, 'placeholders differ', k, ph(a), ph(b));
    if (/[一-鿿]/.test(JSON.stringify(a)) && k !== 'langBtn') fail(tag, 'Chinese in en', k);
  }
}
pair(S.en, S.zh, 'mochi:');
pair(PAL.en, PAL.zh, 'animals:');
// an override has the same shape as the word it replaces
for (const l of ['en', 'zh']) for (const k of Object.keys(PAL[l])) {
  const a = S[l][k], b = PAL[l][k];
  if (a == null) fail('animals: override of a word that does not exist', l, k);
  else if (typeof a != typeof b || Array.isArray(a) != Array.isArray(b) || (Array.isArray(a) && a.length != b.length)) fail('animals: override shape differs', l, k);
}
for (const k of used) for (const l of ['en', 'zh']) if (S[l][k] == null) fail('missing', l, k);
// the mochi words must not leak into the animals look: no 团子 / 汤圆 / mochi in a string the page shows there
for (const l of ['en', 'zh']) {
  I.set(l); I.setTheme('pal');
  for (const k of used) {
    if (k === 'themes') continue;
    const s = JSON.stringify(I.t(k));
    if (/团子|汤圆|元宵|[Mm]ochi/.test(s)) fail('animals look shows a mochi word:', l, k, s.slice(0, 80));
  }
}
// the display fonts have every character they are asked to draw
const mk = fs.readFileSync(path.join(__dirname, 'makefont.py'), 'utf8');
const keys = JSON.parse(mk.match(/KEYS = (\[[^\]]*\])/s)[1].replace(/'/g, '"').replace(/\s+/g, ' '));
const flat = x => typeof x === 'string' ? x.replace(/\{\w+\}/g, '') : Array.isArray(x) ? x.map(flat).join('') : Object.values(x).map(flat).join('');
for (const [theme, file] of [['mm', 'tt-brush.woff2'], ['pal', 'tt-round.woff2']]) {
  I.set('zh'); I.setTheme(theme);
  const text = keys.map(k => flat(I.t(k))).join('') + '0123456789！';
  try {
    const have = cp.execFileSync('python3', ['-I', '-c', 'import sys,json;from fontTools.ttLib import TTFont;print(json.dumps(sorted(TTFont(sys.argv[1]).getBestCmap().keys())))', path.join(src, 'fonts', file)]).toString();
    const set = new Set(JSON.parse(have));
    const miss = [...new Set(text.replace(/\s/g, ''))].filter(c => !set.has(c.codePointAt(0)));
    if (miss.length) fail(file, 'lacks', miss.join(''), '(run dev/makefont.py)'); else console.log(file, 'covers', new Set(text.replace(/\s/g, '')).size, 'characters');
  } catch (e) { console.log('(' + file + ' not checked: python3 with fontTools is needed)'); }
}
const unused = Object.keys(S.en).filter(k => !used.has(k));
console.log('keys used:', used.size, '| defined:', Object.keys(S.en).length, '| problems:', bad);
console.log('not referenced by a literal key (check by hand):', unused.join(' '));
console.log('dynamic calls:\n  ' + [...new Set(dyn)].join('\n  '));
process.exit(bad ? 1 : 0);
