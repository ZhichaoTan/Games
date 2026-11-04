#!/usr/bin/env python3
"""Writes src/tiles.js: the 27 suit tile faces drawn in a 300 x 400 box.

The drawings are FluffyStuff's riichi-mahjong-tiles (https://github.com/FluffyStuff/riichi-mahjong-tiles), which the author
put in the public domain (CC0) in June 2024. The copies read here are the svgo-optimised ones shipped in the npm package
@johnmorrisdotca/jarajara 1.8.0 (MIT, (c) 2026 John Morris), file dist/designs/riichi.js. This script only recolours them
a little (brighter red, green and blue, so the suits read apart on a phone) and gives each id its own prefix.

    npm pack @johnmorrisdotca/jarajara@1.8.0 && tar xzf johnmorrisdotca-jarajara-1.8.0.tgz
    python3 -I dev/maketiles.py package/dist/designs/riichi.js
"""
import os, re, sys

here = os.path.dirname(os.path.abspath(__file__))
src = open(sys.argv[1], encoding='utf-8').read()
block = src[src.index('    faces: {'):src.index('    red: {')]            # leave out the red fives
faces = dict(re.findall(r"^\s{8}([a-zA-Z]): '(.*)',\s*$", block, re.M))
# jarajara's letters: a-i characters, j-r circles, s-A bamboo. Ours: 0-8 characters, 9-17 bamboo, 18-26 dots.
order = list('abcdefghi') + list('stuvwxyzA') + list('jklmnopqr')
PAL = {'#b93c3c': '#cc3328', '#004900': '#0f7543', '#000037': '#1b3784', '#000': '#1c1c1c', '#fff': '#fffdf8'}

def recolour(s):
    for a, b in PAL.items():
        s = re.sub(r'(?i)(["(:])' + re.escape(a) + r'(?=["); ])', lambda m: m.group(1) + b, s)
    # shapes with no fill are black by default
    s = re.sub(r'<(path|circle|ellipse|rect)(?![^>]*\sfill=)', lambda m: '<' + m.group(1) + ' fill="' + PAL['#000'] + '"', s)
    s = s.replace('xlink:href=', 'href=')
    s = re.sub(r'(id="|href="#)rr', r'\1mjt', s)
    return s

out = [recolour(faces[k]) for k in order]
assert len(out) == 27 and all(out)
head = ('// The 27 suit tiles (300 x 400): 1-9 characters, 1-9 bamboo, 1-9 dots. Written by dev/maketiles.py.\n'
        '// Drawings: FluffyStuff, riichi-mahjong-tiles, public domain (CC0), https://github.com/FluffyStuff/riichi-mahjong-tiles\n'
        '// Optimised copies from the npm package @johnmorrisdotca/jarajara (MIT, (c) 2026 John Morris); recoloured here.\n')
assert not any("'" in f or '\\' in f or '\n' in f for f in out)
body = "(function (G) { G.MJ_TILES = [\n" + ',\n'.join("'" + f + "'" for f in out) + "\n]; })(typeof window !== 'undefined' ? window : globalThis);\n"
dst = os.path.join(here, '..', 'src', 'tiles.js')
open(dst, 'w', encoding='utf-8').write(head + body)
print('wrote', os.path.normpath(dst), len(head + body))
