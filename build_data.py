import json,glob,sys,os
src=sys.argv[1]; out=sys.argv[2]
d={}
for f in sorted(glob.glob(os.path.join(src,'*.json'))):
    j=json.load(open(f,encoding='utf-8')); d[j['region']]={'teams':j['teams']}
open(out,'w',encoding='utf-8').write('window.ROSTER='+json.dumps(d,ensure_ascii=False)+';\n')
