import os, sys, json, glob

root = os.path.dirname(os.path.abspath(__file__))
os.chdir(root)

# 1. Merge data/*.json -> src/data.js
d = {}
for f in sorted(glob.glob(os.path.join('data', '*.json'))):
    j = json.load(open(f, encoding='utf-8'))
    d[j['region']] = {'teams': j['teams']}
open(os.path.join('src', 'data.js'), 'w', encoding='utf-8').write(
    'window.ROSTER=' + json.dumps(d, ensure_ascii=False) + ';\n'
)

# 1b. Player traits (historical big-stage / knockout / stability / resilience research) -> src/traits.js
tp = os.path.join('data', 'traits', 'traits.json')
traits = json.load(open(tp, encoding='utf-8')) if os.path.exists(tp) else {}
open(os.path.join('src', 'traits.js'), 'w', encoding='utf-8').write(
    'window.TRAITS=' + json.dumps(traits.get('players', traits), ensure_ascii=False) + ';\n'
)

# 2. Bundle single-file dist/index.html
os.makedirs('dist', exist_ok=True)
t = open(os.path.join('src', 'index.tpl.html'), encoding='utf-8').read()
for k, f in [
    ('CSS', 'style.css'),
    ('DATA', 'data.js'),
    ('TRAITS', 'traits.js'),
    ('CHAMPS', 'champs.js'),
    ('ENGINE', 'engine.js'),
    ('SIM', 'sim.js'),
    ('CLOUD', 'cloud.js'),
    ('WATCH', 'watch.js'),
    ('UI', 'ui.js'),
]:
    content = open(os.path.join('src', f), encoding='utf-8').read().replace('</script>', '<\\/script>')
    t = t.replace('/*%s*/' % k, content)

out_path = os.path.join('dist', 'index.html')
open(out_path, 'w', encoding='utf-8').write(t)
print(f'Built {out_path} ({len(t.encode("utf-8"))} bytes)')
