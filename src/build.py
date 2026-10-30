#!/usr/bin/env python3
"""把 peerjs.min.js 和 engine.js 内联进 index.html，输出 ../index.html（单文件，可直接放到 GitHub Pages）"""
import os
here=os.path.dirname(os.path.abspath(__file__))
rd=lambda f: open(os.path.join(here,f),encoding='utf-8').read()
src=rd('index.html')
for tag,f in [('/*@@PEERJS@@*/','peerjs.min.js'),('/*@@ENGINE@@*/','engine.js')]:
    assert src.count(tag)==1, tag
    src=src.replace(tag, rd(f).replace('</script','<\\/script'))
out=os.path.join(here,'..','index.html')
open(out,'w',encoding='utf-8').write(src)
print('built',out,len(src))
