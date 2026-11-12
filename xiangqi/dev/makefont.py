#!/usr/bin/env python3
"""Build the two small CJK subsets the page inlines (Google Fonts is blocked in mainland China):
  src/fonts/xq-brush.woff2  Ma Shan Zheng: the title, the seal, the river, sheet headings, the big 将军/绝杀 and the result stamp
  src/fonts/xq-piece.woff2  Noto Serif SC 900: the fourteen piece characters and 一…九 for the file numbers
Usage: python3 dev/makefont.py <@fontsource/ma-shan-zheng files dir> <@fontsource/noto-serif-sc files dir>
The brush text is read from src/i18n.js (zh strings whose key starts with h + capital, fx or st + capital, plus titleA), so re-run after changing those."""
import sys, glob, os, json, subprocess
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger
here = os.path.dirname(os.path.abspath(__file__))
js = "globalThis.window=globalThis;require(process.argv[1]);const z=XQI18N.S.zh;console.log(JSON.stringify(Object.keys(z).filter(k=>/^(h[A-Z]|fx|st[A-Z]|titleA$)/.test(k)).map(k=>z[k]).join('')))"
auto = json.loads(subprocess.check_output(['node', '-e', js, os.path.join(here, '..', 'src', 'i18n.js')]))
BRUSH = '中国象棋楚汉河界' + auto + '0123456789！'
PIECE = '帥仕相馬車炮兵將士象砲卒帅马车将一二三四五六七八九'

def build(text, pattern, out):
    need = {ord(c) for c in text if not c.isspace()}
    parts = []
    for f in sorted(glob.glob(pattern)):
        t = TTFont(f)
        have = need & set(t.getBestCmap().keys())
        if not have: continue
        need -= have
        opts = subset.Options(); opts.flavor = None; opts.layout_features = ['*']; opts.notdef_outline = True
        sub = subset.Subsetter(opts); sub.populate(unicodes=have); sub.subset(t)
        p = os.path.join(here, '_part%d.ttf' % len(parts)); t.flavor = None; t.save(p); parts.append(p)
    print('missing:', ''.join(chr(c) for c in sorted(need)) or 'none', '| parts:', len(parts))
    m = Merger().merge(parts) if len(parts) > 1 else TTFont(parts[0])
    m.flavor = 'woff2'
    m.save(out)
    for p in parts: os.remove(p)
    print('wrote', os.path.normpath(out), os.path.getsize(out))

fonts = os.path.join(here, '..', 'src', 'fonts')
print('brush:', ''.join(sorted(set(BRUSH))))
build(BRUSH, os.path.join(sys.argv[1], '*-400-normal.woff2'), os.path.join(fonts, 'xq-brush.woff2'))
build(PIECE, os.path.join(sys.argv[2], '*-900-normal.woff2'), os.path.join(fonts, 'xq-piece.woff2'))
