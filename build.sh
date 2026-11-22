#!/bin/bash
set -e
cd "$(dirname "$0")"
python3 -I build_data.py data src/data.js
mkdir -p dist
python3 -I - <<'PY'
t=open('src/index.tpl.html').read()
for k,f in [('CSS','style.css'),('DATA','data.js'),('CHAMPS','champs.js'),('ENGINE','engine.js'),('UI','ui.js')]:
    t=t.replace('/*%s*/'%k, open('src/'+f).read().replace('</script>','<\\/script>'))
open('dist/index.html','w').write(t)
PY
ls -la dist
