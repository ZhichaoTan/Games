#!/usr/bin/env python3
"""Build src/fonts/sb-brush.woff2: the few Ma Shan Zheng characters the page writes with a brush (Google Fonts is blocked in mainland China):
the title and its seal, the sheet headings, the clear call-outs (双消, T 旋…) and the big messages on the well.
Usage:  npm pack @fontsource/ma-shan-zheng && tar xzf fontsource-ma-shan-zheng-*.tgz
        python3 -I dev/makefont.py package/files
The text is read from src/i18n.js (the zh strings listed in KEYS), so re-run after changing those."""
import sys, glob, os, json, subprocess
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger
here = os.path.dirname(os.path.abspath(__file__))
KEYS = ['titleA', 'titleB', 'menu', 'chat', 'rulesTitle', 'paused', 'over', 'youOut', 'youWin', 'roundOver', 'draw', 'clr', 'tw', 'twMini', 'twN', 'pc']
js = "require(process.argv[1]);const z=globalThis.SBI18N.S.zh,f=x=>typeof x==='string'?x:Object.values(x).join('');console.log(JSON.stringify(%s.map(k=>f(z[k])).join('')))" % json.dumps(KEYS)
text = json.loads(subprocess.check_output(['node', '-e', js, os.path.join(here, '..', 'src', 'i18n.js')])) + '！'
need = {ord(c) for c in text if not c.isspace()}
print('brush:', ''.join(chr(c) for c in sorted(need)))
parts = []
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*-400-normal.woff2'))):
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
out = os.path.join(here, '..', 'src', 'fonts', 'sb-brush.woff2')
m.save(out)
for p in parts: os.remove(p)
print('wrote', os.path.normpath(out), os.path.getsize(out))
