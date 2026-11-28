import json,glob,sys,os
src=sys.argv[1]; out=sys.argv[2]
d={}
for f in sorted(glob.glob(os.path.join(src,'*.json'))):
    j=json.load(open(f,encoding='utf-8')); d[j['region']]={'teams':j['teams']}
lp=os.path.join(src,'legends','legends.json')
L=json.load(open(lp,encoding='utf-8')) if os.path.exists(lp) else {}
L={'legends':L.get('legends',[]),'champOverrides':L.get('champOverrides',{})}
open(out,'w',encoding='utf-8').write('window.ROSTER='+json.dumps(d,ensure_ascii=False)+';\n'+'window.LEGENDS='+json.dumps(L,ensure_ascii=False)+';\n')
