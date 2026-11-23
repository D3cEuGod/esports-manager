#!/bin/bash
set -e
cd "$(dirname "$0")"
PY=$(command -v python3 || command -v python)
"$PY" -I build_data.py data src/data.js
mkdir -p dist
"$PY" -I - <<'PY'
t=open('src/index.tpl.html',encoding='utf-8').read()
for k,f in [('CSS','style.css'),('DATA','data.js'),('CHAMPS','champs.js'),('ENGINE','engine.js'),('CLOUD','cloud.js'),('UI','ui.js')]:
    t=t.replace('/*%s*/'%k, open('src/'+f,encoding='utf-8').read().replace('</script>','<\\/script>'))
open('dist/index.html','w',encoding='utf-8').write(t)
PY
ls -la dist
