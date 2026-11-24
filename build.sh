#!/bin/bash
set -e
cd "$(dirname "$0")"
PY=$(command -v python3 || command -v python)
"$PY" -I build_data.py data src/data.js
mkdir -p dist
"$PY" -I - <<'PY'
import json,os
tp='data/traits/traits.json'
t=json.load(open(tp,encoding='utf-8')) if os.path.exists(tp) else {}
P={k:{f:v[f] for f in ('big','ko','stab','res','base','n') if f in v} for k,v in t.get('players',t).items()}
open('src/traits.js','w',encoding='utf-8').write('window.TRAITS='+json.dumps(P,ensure_ascii=False,separators=(',',':'))+';\n')
PY
"$PY" -I - <<'PY'
t=open('src/index.tpl.html',encoding='utf-8').read()
for k,f in [('CSS','style.css'),('DATA','data.js'),('TRAITS','traits.js'),('CHAMPS','champs.js'),('ENGINE','engine.js'),('SIM','sim.js'),('CLOUD','cloud.js'),('WATCH','watch.js'),('UI','ui.js')]:
    t=t.replace('/*%s*/'%k, open('src/'+f,encoding='utf-8').read().replace('</script>','<\\/script>'))
open('dist/index.html','w',encoding='utf-8').write(t)
PY
ls -la dist
