#!/usr/bin/env python3
"""Builds the Games home page, the root index.html: inlines the fonts, the zoom guard, the shared artwork
(poker/src/art.js and seal.svg), the four mahjong tile faces the page draws (from mahjong/src/tiles.js) and the
three xiangqi pieces (the piece font subset and three figurines from xiangqi/src/)."""
import base64, json, os, re
here = os.path.dirname(os.path.abspath(__file__))
pk = os.path.join(here, '..', 'poker', 'src')
mj = os.path.join(here, '..', 'mahjong', 'src')
xq = os.path.join(here, '..', 'xiangqi', 'src')
rd = lambda *p: open(os.path.join(*p), encoding='utf-8').read()
def font(fam, path, weight, style='normal'):
    b = base64.b64encode(open(path, 'rb').read()).decode()
    return f'@font-face{{font-family:"{fam}";font-style:{style};font-weight:{weight};font-display:swap;src:url(data:font/woff2;base64,{b}) format("woff2")}}'
fonts = '\n'.join([
    '/* Fraunces © The Fraunces Project Authors, Manrope © The Manrope Project Authors, Ma Shan Zheng (subset) © The Ma Shan Zheng Project Authors, Noto Serif SC (subset) © Google; SIL Open Font License 1.1 */',
    font('Fraunces', os.path.join(pk, 'fonts', 'fraunces-latin-700-normal.woff2'), '600 900'),
    font('Fraunces', os.path.join(pk, 'fonts', 'fraunces-latin-600-italic.woff2'), '400 900', 'italic'),
    font('Manrope', os.path.join(pk, 'fonts', 'manrope-latin-500-normal.woff2'), '400 549'),
    font('Manrope', os.path.join(pk, 'fonts', 'manrope-latin-700-normal.woff2'), '550 749'),
    font('Manrope', os.path.join(pk, 'fonts', 'manrope-latin-800-normal.woff2'), '750 900'),
    font('HubBrush', os.path.join(here, 'fonts', 'mashanzheng-hub.woff2'), '400'),
    font('HubPiece', os.path.join(xq, 'fonts', 'xq-piece.woff2'), '700 900'),
])
faces = re.findall(r"^'(.*)',?$", rd(mj, 'tiles.js'), re.M)
assert len(faces) == 27, len(faces)
tiles = ''.join(f'<symbol id="t{t}" viewBox="0 0 300 400">{faces[t]}</symbol>' for t in (4, 9, 13, 22))
# the xiangqi figurines (general, chariot, cannon) for the English card: the FIG list in xiangqi/src/art.js
xart = rd(xq, 'art.js')
cut, cuts = re.search(r"const CUT = '([^']*)', CUTS = '([^']*)'", xart).groups()
figs = re.findall(r"^    `(.*)`,?$", xart[xart.index('const FIG = ['):xart.index('];', xart.index('const FIG = ['))], re.M)
assert len(figs) == 7, len(figs)
xqfig = ''.join('<symbol id="xf%d" viewBox="0 0 24 24"><g fill="currentColor">%s</g></symbol>' % (i, figs[i].replace('${CUTS}', cuts).replace('${CUT}', cut)) for i in (0, 4, 5))
src = rd(here, 'index.html')
subs = [('/*@@FONTS@@*/', fonts), ('/*@@NOZOOM@@*/', rd(pk, 'nozoom.js')), ('/*@@ART@@*/', rd(pk, 'art.js')),
        ("/*@@SEAL@@*/''", json.dumps(rd(pk, 'seal.svg'))), ("/*@@TILES@@*/''", json.dumps(tiles)), ("/*@@XQFIG@@*/''", json.dumps(xqfig))]
for tag, body in subs:
    assert src.count(tag) == 1, tag
    src = src.replace(tag, body.replace('</script', '<\\/script'))
out = os.path.normpath(os.path.join(here, '..', 'index.html'))
open(out, 'w', encoding='utf-8').write(src)
print('built', out, len(src))
