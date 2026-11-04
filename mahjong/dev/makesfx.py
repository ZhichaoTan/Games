#!/usr/bin/env python3
"""Writes src/sfx.js: the recorded table sounds, as base64 AAC (.m4a), for sound.js.

The recordings are from Kenney's Casino Audio pack (https://kenney.nl/assets/casino-audio, CC0 1.0): clay chips laid down,
stacked, knocked together and handled, which click like mahjong tiles. The short cuts used here are the ones shipped in the
npm package @johnmorrisdotca/jarajara 1.8.0 (MIT, (c) 2026 John Morris), file dist/sounds.js.

    npm pack @johnmorrisdotca/jarajara@1.8.0 && tar xzf johnmorrisdotca-jarajara-1.8.0.tgz
    python3 -I dev/makesfx.py package/dist/sounds.js
"""
import os, re, sys

here = os.path.dirname(os.path.abspath(__file__))
src = open(sys.argv[1], encoding='utf-8').read()
have = dict(re.findall(r'"([a-z]+-\d)":\s*"([A-Za-z0-9+/=]+)"', src))
KEEP = ['place-1', 'place-2', 'place-3', 'pick-1', 'pick-2', 'pair-1', 'pair-2', 'pair-3', 'flip-1', 'shuffle-1', 'shuffle-2', 'win-1', 'win-2']
missing = [k for k in KEEP if k not in have]
assert not missing, missing
head = ('// Recorded table sounds, base64 AAC (.m4a). Written by dev/makesfx.py.\n'
        '// Kenney, Casino Audio, CC0 1.0 (https://kenney.nl/assets/casino-audio); cuts from the npm package @johnmorrisdotca/jarajara (MIT).\n')
body = '(function (G) { G.MJ_SFX = {\n' + ',\n'.join(f"  '{k}': '{have[k]}'" for k in KEEP) + "\n}; })(typeof window !== 'undefined' ? window : globalThis);\n"
dst = os.path.join(here, '..', 'src', 'sfx.js')
open(dst, 'w', encoding='utf-8').write(head + body)
print('wrote', os.path.normpath(dst), len(head + body))
