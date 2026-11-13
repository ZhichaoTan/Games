# Chat-phrase clips (dev/voice_chat/*.mp3): open-source Kokoro TTS via sherpa-onnx (pip install sherpa-onnx soundfile).
# Models from github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models: kokoro-multi-lang-v1_1 (Chinese: zf sid 3, zm sid 90) and kokoro-multi-lang-v1_0 (English: af_heart 3, am_michael 16).
# Run in a folder holding both model folders, then: python3 dev/makechatvoice.py
import sherpa_onnx, soundfile as sf, subprocess, os
def mk(d, multi):
  k=dict(model=d+'model.onnx',voices=d+'voices.bin',tokens=d+'tokens.txt',data_dir=d+'espeak-ng-data',lexicon='kokoro-multi-lang-v1_1/lexicon-us-en.txt')
  extra={}
  if multi:
    k.update(dict_dir=d+'dict',lexicon=d+'lexicon-us-en.txt,'+d+'lexicon-zh.txt'); extra=dict(rule_fsts=d+'date-zh.fst,'+d+'phone-zh.fst,'+d+'number-zh.fst')
  return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(**k),num_threads=4),**extra))
ZH=['快点出牌呀', '等我想想', '这牌不错', '手气来了', '好险好险', '手下留情', '厉害厉害', '再来一局？']
EN=['Hurry up!', 'Let me think…', 'Nice hand!', "I'm on fire!", 'That was close', 'Go easy on me', 'Well played', 'One more round?']
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'voice_chat')+'/'
M=mk('kokoro-multi-lang-v1_1/',True); M10=mk('kokoro-multi-lang-v1_0/',True)
for lang,tts,ph,vo in [('zh',mk('kokoro-multi-lang-v1_1/',True),ZH,{'f':3,'m':90}),('en',None,EN,{'f':3,'m':16})]:
  for g,sid in vo.items():
    for i,t in enumerate(ph):
      a=(M if lang=='zh' else M10).generate(t.replace('…','...'),sid=sid,speed=(1.05 if lang=='zh' else 0.92))
      sf.write('tmp.wav',a.samples,a.sample_rate)
      subprocess.run(['ffmpeg','-y','-loglevel','error','-i','tmp.wav','-af','silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.06,areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.06,areverse,loudnorm=I=-16','-ac','1','-ar','24000','-b:a','40k',out+f'{lang}{i}{g}.mp3'],check=True)
print(sorted(os.listdir(out)))
