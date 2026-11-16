#!/usr/bin/env python3
"""Inline the fonts, PeerJS, the shared avatars and table sounds, the rules, the bots and the UI into cipher/index.html (one file for GitHub Pages).
Shared with the other games: poker/src/art.js (avatars and icons), poker/src/peerjs.min.js, poker/src/keepalive.js, poker/src/nozoom.js,
poker/src/fonts/ (Fraunces, Manrope) and mahjong/src/sfx.js (recorded tile clicks).
The app is src/app/*.js joined in file-name order inside one function scope."""
import os, base64, glob
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, '..', '..', 'poker', 'src')
mj = os.path.join(here, '..', '..', 'mahjong', 'src')
rd = lambda *p: open(os.path.join(*p), encoding='utf-8').read()
def font(fam, path, weight, style='normal'):
    b = base64.b64encode(open(path, 'rb').read()).decode()
    return f'@font-face{{font-family:"{fam}";font-style:{style};font-weight:{weight};font-display:swap;src:url(data:font/woff2;base64,{b}) format("woff2")}}'
fonts = '\n'.join([
    '/* Ma Shan Zheng (subset) © The Ma Shan Zheng Project Authors; Fraunces © The Fraunces Project Authors; Manrope © The Manrope Project Authors. SIL Open Font License 1.1 */',
    font('CXBrush', os.path.join(here, 'fonts', 'cx-brush.woff2'), '400'),
    font('Fraunces', os.path.join(root, 'fonts', 'fraunces-latin-700-normal.woff2'), '600 900'),
    font('Fraunces', os.path.join(root, 'fonts', 'fraunces-latin-600-italic.woff2'), '400 900', 'italic'),
    font('Manrope', os.path.join(root, 'fonts', 'manrope-latin-500-normal.woff2'), '400 549'),
    font('Manrope', os.path.join(root, 'fonts', 'manrope-latin-700-normal.woff2'), '550 749'),
    font('Manrope', os.path.join(root, 'fonts', 'manrope-latin-800-normal.woff2'), '750 900'),
])
app = "(function () {\n'use strict';\n" + '\n'.join(rd(f) for f in sorted(glob.glob(os.path.join(here, 'app', '*.js')))) + '\n})();'
libs = '\n'.join(rd(here, f) for f in ('engine.js', 'ai.js', 'i18n.js', 'art.js', 'sound.js'))
src = rd(here, 'index.html')
subs = [('/*@@FONT@@*/', fonts), ('/*@@NOZOOM@@*/', rd(root, 'nozoom.js')), ('/*@@PEERJS@@*/', rd(root, 'peerjs.min.js') + '\n' + rd(root, 'keepalive.js')),
        ('/*@@AVATARS@@*/', rd(root, 'art.js')), ('/*@@SFX@@*/', rd(mj, 'sfx.js')), ('/*@@LIBS@@*/', libs), ('/*@@APP@@*/', app)]
for tag, body in subs:
    assert src.count(tag) == 1, tag
    src = src.replace(tag, body.replace('</script', '<\\/script'))
out = os.path.join(here, '..', 'index.html')
open(out, 'w', encoding='utf-8').write(src)
print('built', os.path.normpath(out), len(src))
