#!/usr/bin/env python3
"""Build the two small Chinese display fonts in src/fonts/ (Google Fonts is blocked in mainland China, so the page carries its own):
  tt-brush.woff2  Ma Shan Zheng, the brush hand of the lantern-mochi look ('mm')
  tt-round.woff2  ZCOOL KuaiLe, the round hand of the little-animals look ('pal', the default)
Each holds only the characters its look writes big: the title, the map and its stops, the sheet headings, the call-outs on the board
(火箭！, 不错！…) and the big messages. The text is read from src/i18n.js with each look's own words, so re-run after changing those.
Usage:  npm pack @fontsource/ma-shan-zheng @fontsource/zcool-kuaile && tar xzf fontsource-ma-shan-zheng-*.tgz -C a && tar xzf fontsource-zcool-kuaile-*.tgz -C b
        python3 -I dev/makefont.py a/package/files b/package/files"""
import sys, glob, os, json, subprocess
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger
here = os.path.dirname(os.path.abspath(__file__))
KEYS = ['titleA', 'titleB', 'map', 'chapters', 'levelN', 'menu', 'chat', 'rulesTitle', 'theme', 'paused', 'levelDone', 'outMoves', 'timeUp',
        'youWin', 'roundOver', 'draw', 'made', 'nice', 'comboCall', 'finale']
JS = r"""require(process.argv[1]); const I = globalThis.MMI18N; I.set('zh'); I.setTheme(process.argv[2]);
const f = x => typeof x === 'string' ? x.replace(/\{\w+\}/g, '') : Array.isArray(x) ? x.map(f).join('') : Object.values(x).map(f).join('');
console.log(JSON.stringify(%s.map(k => f(I.t(k))).join('') + '0123456789！'))""" % json.dumps(KEYS)

def text_of(theme):
    return json.loads(subprocess.check_output(['node', '-e', JS, os.path.join(here, '..', 'src', 'i18n.js'), theme]))

def build(files, theme, out):
    need = {ord(c) for c in text_of(theme) if not c.isspace()}
    print(out, ':', ''.join(chr(c) for c in sorted(need)))
    parts = []
    for f in sorted(glob.glob(os.path.join(files, '*-400-normal.woff2'))):
        t = TTFont(f)
        have = need & set(t.getBestCmap().keys())
        if not have: continue
        need -= have
        opts = subset.Options(); opts.flavor = None; opts.layout_features = ['*']; opts.notdef_outline = True
        sub = subset.Subsetter(opts); sub.populate(unicodes=have); sub.subset(t)
        p = os.path.join(here, '_part%d.ttf' % len(parts)); t.flavor = None; t.save(p); parts.append(p)
    print('  missing:', ''.join(chr(c) for c in sorted(need)) or 'none', '| parts:', len(parts))
    m = Merger().merge(parts) if len(parts) > 1 else TTFont(parts[0])
    m.flavor = 'woff2'
    dst = os.path.join(here, '..', 'src', 'fonts', out)
    m.save(dst)
    for p in parts: os.remove(p)
    print('  wrote', os.path.normpath(dst), os.path.getsize(dst))

build(sys.argv[1], 'mm', 'tt-brush.woff2')
build(sys.argv[2], 'pal', 'tt-round.woff2')
