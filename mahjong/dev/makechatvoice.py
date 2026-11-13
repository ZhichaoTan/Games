#!/usr/bin/env python3
"""Pack dev/voice_chat/*.mp3 (quick-chat phrases) into src/voice_chat.js as window.MJ_VOICE_CHAT.
Names: <lang><phrase index><f|m>, e.g. zh0f = 快点出牌呀 in the female voice. Made with dev/gen_chat_tts.py (Kokoro, open source)."""
import os, base64, json
here = os.path.dirname(os.path.abspath(__file__))
d = os.path.join(here, 'voice_chat')
out = {f[:-4]: base64.b64encode(open(os.path.join(d, f), 'rb').read()).decode() for f in sorted(os.listdir(d)) if f.endswith('.mp3')}
js = '// 聊天快捷语的录音（开源 Kokoro TTS 生成，dev/makechatvoice.py 打包）\nwindow.MJ_VOICE_CHAT = ' + json.dumps(out, separators=(',', ':')) + ';\n'
open(os.path.join(here, '..', 'src', 'voice_chat.js'), 'w').write(js)
print(len(out), 'clips', len(js), 'bytes')
