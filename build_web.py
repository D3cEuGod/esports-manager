import os, sys, json, glob, shutil

root = os.path.dirname(os.path.abspath(__file__))
os.chdir(root)

# 1. Merge data/*.json -> src/data.js
d = {}
for f in sorted(glob.glob(os.path.join('data', '*.json'))):
    j = json.load(open(f, encoding='utf-8'))
    d[j['region']] = {'teams': j['teams']}
# Legend free agents and hand-set champion pools (data/legends/legends.json)
lp = os.path.join('data', 'legends', 'legends.json')
lj = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
legends = {'legends': lj.get('legends', []), 'champOverrides': dict(lj.get('champOverrides', {}))}
# Starting champion pools for every rostered player (data/pools/build_pools.py). Hand-set overrides win.
pp = os.path.join('data', 'pools', 'pools.json')
if os.path.exists(pp):
    for tag, pool in json.load(open(pp, encoding='utf-8')).get('players', {}).items():
        legends['champOverrides'].setdefault(tag, {'picks': pool['picks'], 'champs': pool['champs'], 'generated': True})
ap = os.path.join('data', 'attrs', 'overrides.json')
attr_overrides = json.load(open(ap, encoding='utf-8'))
open(os.path.join('src', 'data.js'), 'w', encoding='utf-8').write(
    'window.ROSTER=' + json.dumps(d, ensure_ascii=False) + ';\n'
    + 'window.LEGENDS=' + json.dumps(legends, ensure_ascii=False) + ';\n'
    + 'window.ATTR_OVERRIDES=' + json.dumps(attr_overrides, ensure_ascii=False) + ';\n'
)

# 1b. Player traits (historical big-stage / knockout / stability / resilience research) -> src/traits.js
tp = os.path.join('data', 'traits', 'traits.json')
traits = json.load(open(tp, encoding='utf-8')) if os.path.exists(tp) else {}
open(os.path.join('src', 'traits.js'), 'w', encoding='utf-8').write(
    'window.TRAITS=' + json.dumps({k: {f: v[f] for f in ('big', 'ko', 'stab', 'res', 'base', 'n', 'regionEdge') if f in v}
                                   for k, v in traits.get('players', traits).items()},
                                  ensure_ascii=False, separators=(',', ':')) + ';\n'
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

# 3. Emit PWA manifest, icons & network-first Service Worker into dist/ (for GitHub Pages / mobile install)
icons_dir = os.path.join('src-tauri', 'icons')
if os.path.exists(os.path.join(icons_dir, 'icon.png')):
    shutil.copyfile(os.path.join(icons_dir, 'icon.png'), os.path.join('dist', 'icon-512.png'))
if os.path.exists(os.path.join(icons_dir, '128x128@2x.png')):
    shutil.copyfile(os.path.join(icons_dir, '128x128@2x.png'), os.path.join('dist', 'icon-192.png'))
    shutil.copyfile(os.path.join(icons_dir, '128x128@2x.png'), os.path.join('dist', 'apple-touch-icon.png'))
manifest = {
    "name": "峡谷经理人 · 英雄联盟电竞经理",
    "short_name": "峡谷经理人",
    "description": "英雄联盟职业电竞经理模拟游戏（支持多端云同步、BP与实时峡谷观战）",
    "start_url": "./index.html",
    "scope": "./",
    "display": "standalone",
    "orientation": "any",
    "background_color": "#010a13",
    "theme_color": "#091428",
    "icons": [
        {"src": "./icon-192.png", "sizes": "256x256", "type": "image/png", "purpose": "any"},
        {"src": "./icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
    ]
}
open(os.path.join('dist', 'manifest.webmanifest'), 'w', encoding='utf-8').write(
    json.dumps(manifest, ensure_ascii=False, indent=2)
)
sw_code = """const CACHE = 'rift-manager-v2.1.17';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(ch => ch.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
"""
open(os.path.join('dist', 'sw.js'), 'w', encoding='utf-8').write(sw_code)
print(f'Built {out_path} ({len(t.encode("utf-8"))} bytes) + PWA assets')
