#!/usr/bin/env python3
"""Inline fonts, PeerJS, the shared avatars, the rules engine, the bots and the UI into mahjong/index.html (one file for GitHub Pages).
Shared with the poker game at the repo root: src/art.js (avatars), src/peerjs.min.js, src/fonts/ (Fraunces, Manrope)."""
import os, base64
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, '..', '..', 'src')
rd = lambda *p: open(os.path.join(*p), encoding='utf-8').read()
def font(fam, path, weight, style='normal', rng=None):
    b = base64.b64encode(open(path, 'rb').read()).decode()
    ur = f';unicode-range:{rng}' if rng else ''
    return f'@font-face{{font-family:"{fam}";font-style:{style};font-weight:{weight};font-display:swap;src:url(data:font/woff2;base64,{b}) format("woff2"){ur}}}'
fonts = '\n'.join([
    '/* Ma Shan Zheng (subset) © The Ma Shan Zheng Project Authors; Fraunces © The Fraunces Project Authors; Manrope © The Manrope Project Authors. SIL Open Font License 1.1 */',
    font('MJBrush', os.path.join(here, 'fonts', 'mashanzheng-sub.woff2'), '400'),
    font('Fraunces', os.path.join(root, 'fonts', 'fraunces-latin-700-normal.woff2'), '600 900'),
    font('Fraunces', os.path.join(root, 'fonts', 'fraunces-latin-600-italic.woff2'), '400 900', 'italic'),
    font('Manrope', os.path.join(root, 'fonts', 'manrope-latin-500-normal.woff2'), '400 549'),
    font('Manrope', os.path.join(root, 'fonts', 'manrope-latin-700-normal.woff2'), '550 749'),
    font('Manrope', os.path.join(root, 'fonts', 'manrope-latin-800-normal.woff2'), '750 900'),
])
src = rd(here, 'index.html')
subs = [('/*@@FONT@@*/', fonts), ('/*@@PEERJS@@*/', rd(root, 'peerjs.min.js')), ('/*@@AVATARS@@*/', rd(root, 'art.js')),
        ('/*@@GLYPHS@@*/', rd(here, 'glyphs.js')), ('/*@@ART@@*/', rd(here, 'art.js')), ('/*@@ENGINE@@*/', rd(here, 'engine.js')),
        ('/*@@AI@@*/', rd(here, 'ai.js')), ('/*@@I18N@@*/', rd(here, 'i18n.js')), ('/*@@SOUND@@*/', rd(here, 'sound.js')),
        ('/*@@UI@@*/', rd(here, 'ui.js')), ('/*@@APP@@*/', rd(here, 'app.js'))]
for tag, body in subs:
    assert src.count(tag) == 1, tag
    src = src.replace(tag, body.replace('</script', '<\\/script'))
out = os.path.join(here, '..', 'index.html')
open(out, 'w', encoding='utf-8').write(src)
print('built', os.path.normpath(out), len(src))
