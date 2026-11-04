#!/usr/bin/env python3
"""Writes hub/fonts/mashanzheng-hub.woff2: the few brush characters the home page shows, cut from Ma Shan Zheng
(SIL OFL 1.1, the @fontsource/ma-shan-zheng split files). Add characters to TEXT when the page shows new brush text.

    npm pack @fontsource/ma-shan-zheng && tar xzf fontsource-ma-shan-zheng-*.tgz
    python3 -I hub/makefont.py package/files
"""
import glob, os, sys
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger

here = os.path.dirname(os.path.abspath(__file__))
TEXT = '今晚玩什么？四川麻将血战'
need = {ord(c) for c in TEXT}
parts = []
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*-400-normal.woff2'))):
    t = TTFont(f)
    have = need & set(t.getBestCmap().keys())
    if not have:
        continue
    need -= have
    opts = subset.Options(); opts.flavor = None; opts.layout_features = ['*']; opts.notdef_outline = True
    sub = subset.Subsetter(opts); sub.populate(unicodes=have); sub.subset(t)
    p = os.path.join(here, '_part%d.ttf' % len(parts)); t.flavor = None; t.save(p); parts.append(p)
print('missing:', ''.join(chr(c) for c in sorted(need)) or 'none', '| parts:', len(parts))
m = Merger().merge(parts)
m.flavor = 'woff2'
out = os.path.join(here, 'fonts', 'mashanzheng-hub.woff2')
m.save(out)
for p in parts:
    os.remove(p)
print('wrote', out, os.path.getsize(out))
