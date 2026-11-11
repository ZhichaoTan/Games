#!/usr/bin/env python3
"""Pack dev/voice_sc/*.mp3 (Sichuan-dialect callouts) into src/voice_sc.js as window.MJ_VOICE_SC.
Clips were made with the open-source CosyVoice2-0.5B model (instruct mode, "用四川话说这句话"), one male prompt voice.
Names: t0..t26 = tile types (万 0-8, 条 9-17, 筒 18-26); peng/gang/hu/zimo have variants peng1, peng2 ... (packed as peng_1 ...)."""
import os, re, base64, json
here = os.path.dirname(os.path.abspath(__file__))
d = os.path.join(here, 'voice_sc')
out = {}
for f in sorted(os.listdir(d)):
    if not f.endswith('.mp3'): continue
    k = f[:-4]
    m = re.fullmatch(r'(peng|gang|hu|zimo)(\d)', k)
    if m: k = m.group(1) + '_' + m.group(2)
    out[k] = base64.b64encode(open(os.path.join(d, f), 'rb').read()).decode()
js = '// 四川话播报录音（CosyVoice2 开源模型生成，dev/makevoice.py 打包）\nwindow.MJ_VOICE_SC = ' + json.dumps(out, separators=(',', ':')) + ';\n'
open(os.path.join(here, '..', 'src', 'voice_sc.js'), 'w').write(js)
print(len(out), 'clips', len(js), 'bytes')
