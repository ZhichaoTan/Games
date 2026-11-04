#!/usr/bin/env python3
"""从 @fontsource/ma-shan-zheng 的分片字体里挑出毛笔字要用的字，合成一个小 woff2：src/fonts/mashanzheng-sub.woff2
用法：python3 dev/makefont.py <fontsource 的 files 目录>"""
import sys, glob, os, io
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger
here = os.path.dirname(os.path.abspath(__file__))
# 只有这些地方用毛笔字：标题、印章、大字特效、操作按钮、横幅、缺门徽章、结算标题、抽屉标题
TEXT = ('四川麻将血战到底换三张定缺碰杠胡过自摸刮风下雨杠上花抢一炮双响三响呼叫转移流局查叫'
        '本局结束最终战绩万条筒对家互换逆时针顺给下上打这听菜单聊天怎么玩规则设置看牌桌结算'
        '完了0123456789·'
        '跟队友想你等回话…不我方获胜！平')   # 2v2：换牌面板标题、不换、我方获胜
src = sys.argv[1]
files = sorted(glob.glob(os.path.join(src, '*-400-normal.woff2')))
need = {ord(c) for c in TEXT}
parts = []
for f in files:
    t = TTFont(f)
    have = need & set(t.getBestCmap().keys())
    if not have: continue
    need -= have
    opts = subset.Options(); opts.flavor = None; opts.layout_features = ['*']; opts.notdef_outline = True
    sub = subset.Subsetter(opts); sub.populate(unicodes=have); sub.subset(t)
    p = os.path.join(here, '_part%d.ttf' % len(parts)); t.flavor = None; t.save(p); parts.append(p)
print('missing:', ''.join(chr(c) for c in sorted(need)) or 'none', '| parts:', len(parts))
m = Merger().merge(parts)
m.flavor = 'woff2'
out = os.path.join(here, '..', 'src', 'fonts', 'mashanzheng-sub.woff2')
m.save(out)
for p in parts: os.remove(p)
print('wrote', out, os.path.getsize(out))
