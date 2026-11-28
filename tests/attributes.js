
const assert=require('node:assert/strict');
const {load}=require('./harness.js');
const run=load();
const r=run(`(()=>{
  Math.random=srand(1610);
  newGame('TES');
  const coherent=p=>validAttrs(p.attrs) && ovrFromAttrs(p.attrs,p.role)===p.rating &&
    validAttrs(p.attrsYearStart) && ovrFromAttrs(p.attrsYearStart,p.role)===p.ratingYearStart;
  const fresh=Object.values(S.players).every(coherent) &&
    Object.values(ROSTER).every(r=>r.teams.every(t=>t.players.every(p=>T(t.short).roster.map(P).some(player=>player.tag===p.id && player.rating===p.rating)))) &&
    Object.values(ATTR_W).every(w=>Math.abs(Object.values(w).reduce((a,b)=>a+b,0)-1)<1e-9);
  const old=structuredClone(S);
  delete old.attrsVer;
  old.players.Bin.rating=88.7;
  for(const p of Object.values(old.players)){ delete p.attrs; delete p.attrsYearStart; delete p.attrFrac; }
  const ovr=Object.fromEntries(Object.values(old.players).map(p=>[p.pid,p.rating]));
  const migrated=migrateSave(old);
  const restored=migrated.attrsVer===1 && Object.values(migrated.players).every(p=>coherent(p)&&ovr[p.pid]===p.rating);
  const twice=JSON.stringify(migrateSave(structuredClone(migrated)).players)===JSON.stringify(migrated.players);
  S=migrated;
  const d=newDraft('TES','BLG','A',[]); autoDraftRest(d);
  const game=createGame5(d,{record:true,seed:831});
  const statsApplied=game.champs.some(c=>c.at.lane!==0) && game.champs.every(c=>c.at.lane===c.p.attrs.lane-c.p.rating);
  while(!game.over) step5(game);
  const g=game5Result(game);
  const fields=g.sa.every((a,i)=>a.gd14===-g.sb[i].gd14 && g.lane14.cs[a.r]===a.cs14-g.sb[i].cs14);
  const gold=g.rec.gs.find(row=>row[0]===840)?.[1];
  const attrFeed=g.rec.feed.filter(row=>row[5]);
  const playback=gold===g.lane14.gold && fields && attrFeed.length<=8 && attrFeed.every(row=>ATTR_KEYS.includes(row[5]));
  const early=createGame5(d,{seed:831});
  for(let i=0;i<100;i++) step5(early);
  endGame5(early,'A');
  const short=game5Result(early);
  const fallback=short.durSec<840 && [...short.sa,...short.sb].every(row=>row.cs===row.cs14);
  const career=(age,rating,pot)=>{
    const p={pid:'development-'+age,role:'TOP',age,rating,pot};
    openingAttrs(p);
    const start=developmentAttrs(p);
    let maxError=0, consistent=true;
    for(let year=0;year<5;year++,p.age++){
      const factor=p.age<=22?1:p.age<=26?.55:p.age<=29?.24:.10;
      const growth=(Math.max(0,pot-rating)*factor*.135+.6*factor*.80)*DEV_GROWTH_MUL;
      const aging=p.age<27?0:(p.age-26)*.13*.58;
      rating=clamp(Math.round((rating+clamp(growth-aging,-1.6,3.5))*10)/10,45,98);
      p.development={games:12,performance:7.2};
      settlePlayerDevelopment(p);
      consistent&&=coherent(p);
      maxError=Math.max(maxError,Math.abs(rating-p.rating));
    }
    const end=developmentAttrs(p);
    return {changes:Object.fromEntries(ATTR_KEYS.map(k=>[k,end[k]-start[k]])),maxError,consistent,segment:p.attrDelta};
  };
  return {fresh,restored,twice,statsApplied,playback,fallback,young:career(20,63,92),veteran:career(29,82,86)};
})()`);
for(const k of ['fresh','restored','twice','statsApplied','playback','fallback']) assert.ok(r[k],k);
for(const career of [r.young,r.veteran]){
  assert.ok(career.consistent && career.maxError<=.5,JSON.stringify(career));
}
assert.equal(r.young.changes.react,Math.max(...Object.values(r.young.changes)),JSON.stringify(r.young));
assert.ok(r.veteran.changes.react<0 && r.veteran.changes.macro>0 && r.veteran.segment.macro%1!==0,JSON.stringify(r.veteran));
console.log('PASS: integer attributes and OVR, legacy saves, replay and 14-minute stats, five-year development.');
const result=run(`(()=>{
 newGame('TES');
 const A='TES',B='BLG', left=starters(A),right=starters(B);
 Object.assign(S.meta,Object.fromEntries(CHAMP_KEYS.map(c=>[c,0])));
 const profiles=['lane','tf'].map(key=>Object.fromEntries(ROLES.map(role=>{
  const attr=Object.fromEntries(ATTR_KEYS.map(k=>[k,82]));
  attr[key]=90; attr[key==='lane'?'tf':'lane']=82-8*ATTR_W[role][key]/ATTR_W[role][key==='lane'?'tf':'lane'];
  return [role,integerAttrs(attr,ATTR_W[role],82)];
 })));
 const d=newDraft(A,B,'A',[]);
 const p1={TOP:'Ornn',JUG:'Poppy',MID:'Azir',ADC:'Jinx',SUP:'Lulu'};
 const p2={TOP:'Ambessa',JUG:'Vi',MID:'Ahri',ADC:"Kai'Sa",SUP:'Rakan'};
 const n=2000;
 const out=[{n:0,w:0,g:0,l:0,lw:0,early:0,earlyW:0,avg:0},{n:0,w:0,g:0,l:0,lw:0,early:0,earlyW:0,avg:0}];
 for(let i=0;i<n;i++){
  const side=i%2, z=out[side], lane=side===0?'A':'B';
  for(const [j,team] of [left,right].entries()) for(const p of team){
   Object.assign(p,{rating:82,form:0,mental:0,attrs:{...profiles[(j+side)%2][p.role]},champs:[],champPractice:{},champGames:{},development:{games:0,performance:0}});
  }
  const blue=(i&2)?'A':'B';
  d.blue=d.first=blue; d.picks=(i&4)?{A:p1,B:p2}:{A:p2,B:p1};
  const game=playGame(d,{seed:((i+1)*2654435761)>>>0});
  z.n++; z.w+=game.w===lane; z.g+=(lane==='A'?game.lane14.gold:-game.lane14.gold)>0; z.avg+=lane==='A'?game.lane14.gold:-game.lane14.gold;
  if(game.durSec>=1500){ z.l++; z.lw+=game.w!==lane; } else { z.early++; z.earlyW+=game.w===lane; }
 }
 return {profiles,out};
})()`);
const rows=result.out;
const late=rows.reduce((s,r)=>s+r.lw,0)/rows.reduce((s,r)=>s+r.l,0);
console.log('Lane overall %:',rows.map(r=>r.w/10),'lane ahead at 14 %:',rows.map(r=>r.g/10),'teamfight wins after 25 %:',(late*100).toFixed(1));
assert.ok(rows.every(r=>Math.abs(r.w/1000-.5)<=.03 && r.g/1000>.60));
assert.ok(late>=.53);
