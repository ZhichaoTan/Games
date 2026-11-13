#!/usr/bin/env python3
"""Inline fonts, PeerJS, the shared avatars, the rules engine and the UI into xiangqi/index.html (one file for GitHub Pages).
Shared with the Hold'em game: poker/src/art.js (avatars), poker/src/peerjs.min.js, poker/src/nozoom.js, poker/src/fonts/ (Fraunces, Manrope).
The app is src/app/*.js joined in file-name order inside one function scope. The Pikafish engine (../pf/) is not inlined: it is fetched on demand."""
import os, base64, glob
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, '..', '..', 'poker', 'src')
rd = lambda *p: open(os.path.join(*p), encoding='utf-8').read()
def font(fam, path, weight, style='normal'):
    b = base64.b64encode(open(path, 'rb').read()).decode()
    return f'@font-face{{font-family:"{fam}";font-style:{style};font-weight:{weight};font-display:swap;src:url(data:font/woff2;base64,{b}) format("woff2")}}'
fonts = '\n'.join([
    '/* Ma Shan Zheng (subset) © The Ma Shan Zheng Project Authors; Noto Serif SC (subset) © Google; Fraunces © The Fraunces Project Authors; Manrope © The Manrope Project Authors. SIL Open Font License 1.1 */',
    font('XQBrush', os.path.join(here, 'fonts', 'xq-brush.woff2'), '400'),
    font('XQPiece', os.path.join(here, 'fonts', 'xq-piece.woff2'), '700 900'),
    font('Fraunces', os.path.join(root, 'fonts', 'fraunces-latin-700-normal.woff2'), '600 900'),
    font('Fraunces', os.path.join(root, 'fonts', 'fraunces-latin-600-italic.woff2'), '400 900', 'italic'),
    font('Manrope', os.path.join(root, 'fonts', 'manrope-latin-500-normal.woff2'), '400 549'),
    font('Manrope', os.path.join(root, 'fonts', 'manrope-latin-700-normal.woff2'), '550 749'),
    font('Manrope', os.path.join(root, 'fonts', 'manrope-latin-800-normal.woff2'), '750 900'),
])
app = "(function () {\n'use strict';\n" + '\n'.join(rd(f) for f in sorted(glob.glob(os.path.join(here, 'app', '*.js')))) + '\n})();'
src = rd(here, 'index.html')
subs = [('/*@@FONT@@*/', fonts), ('/*@@NOZOOM@@*/', rd(root, 'nozoom.js')), ('/*@@PEERJS@@*/', rd(root, 'peerjs.min.js') + '\n' + rd(root, 'keepalive.js')), ('/*@@AVATARS@@*/', rd(root, 'art.js')),
        ('/*@@ENGINE@@*/', rd(here, 'engine.js')), ('/*@@ART@@*/', rd(here, 'art.js')), ('/*@@I18N@@*/', rd(here, 'i18n.js')), ('/*@@APP@@*/', app)]
for tag, body in subs:
    assert src.count(tag) == 1, tag
    src = src.replace(tag, body.replace('</script', '<\\/script'))
out = os.path.join(here, '..', 'index.html')
open(out, 'w', encoding='utf-8').write(src)
print('built', os.path.normpath(out), len(src))
