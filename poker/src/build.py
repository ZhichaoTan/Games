#!/usr/bin/env python3
"""把字体、印章、peerjs、engine、art 内联进 index.html，输出 ../index.html（单文件，直接放到 GitHub Pages）"""
import os, base64, json
here = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(here, f), encoding='utf-8').read()
def font(fam, f, weight, style='normal'):
    b = base64.b64encode(open(os.path.join(here, 'fonts', f), 'rb').read()).decode()
    return f'@font-face{{font-family:"{fam}";font-style:{style};font-weight:{weight};font-display:swap;src:url(data:font/woff2;base64,{b}) format("woff2")}}'
fonts = '\n'.join([
    '/* Fraunces © The Fraunces Project Authors, Manrope © The Manrope Project Authors; SIL Open Font License 1.1 (src/fonts/*-OFL.txt) */',
    font('Fraunces', 'fraunces-latin-700-normal.woff2', '600 900'),
    font('Fraunces', 'fraunces-latin-600-italic.woff2', '400 900', 'italic'),
    font('Manrope', 'manrope-latin-500-normal.woff2', '400 549'),
    font('Manrope', 'manrope-latin-700-normal.woff2', '550 749'),
    font('Manrope', 'manrope-latin-800-normal.woff2', '750 900'),
])
src = rd('index.html')
subs = [('/*@@FONTS@@*/', fonts), ('/*@@NOZOOM@@*/', rd('nozoom.js')), ('/*@@PEERJS@@*/', rd('peerjs.min.js') + '\n' + rd('keepalive.js')), ('/*@@ENGINE@@*/', rd('engine.js')),
        ('/*@@ART@@*/', rd('art.js')), ("/*@@SEAL@@*/''", json.dumps(rd('seal.svg')))]
for tag, body in subs:
    assert src.count(tag) == 1, tag
    src = src.replace(tag, body.replace('</script', '<\\/script'))
out = os.path.join(here, '..', 'index.html')
open(out, 'w', encoding='utf-8').write(src)
print('built', out, len(src))
