// ================= 基础工具 =================
const ROLES = ['TOP','JUG','MID','ADC','SUP'];
const ROLE_CN = {TOP:'上单',JUG:'打野',MID:'中单',ADC:'下路',SUP:'辅助'};
const REGIONS = ['LPL','LCK','LEC','LCS','CBLOL','LCP'];
const REGION_STR = {LCK:6,LPL:6,LEC:4,LCS:3,LCP:2,CBLOL:1};
const CH = {}; CHAMPS.forEach(([k,cn,roles,tags,dmg])=>CH[k]={k,cn,roles,tags,dmg});
const CHAMP_KEYS = Object.keys(CH);
const rnd = () => Math.random();
const randn = () => { let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const pick = a => a[Math.floor(rnd()*a.length)];
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
function hash(s){ let h=2166136261; for(const c of String(s)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619);} return h>>>0; }
function srand(seed){ let s=seed||1; return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }
const sigmoid = x => 1/(1+Math.exp(-x));

const AGE_FIX = {"Faker": 30, "Ruler": 28, "Chovy": 25, "Canyon": 25, "Kiin": 27, "Keria": 24, "Oner": 24, "Peyz": 21, "Doran": 26, "Zeus": 22, "Gumayusi": 24, "Kanavi": 26, "Zeka": 24, "ShowMaker": 26, "Viper": 26, "Bin": 23, "knight": 26, "XUN": 24, "ON": 23, "Flandre": 28, "Tarzan": 27, "Shanks": 25, "369": 25, "Tian": 26, "JackeyLove": 26, "Creme": 23, "TheShy": 26, "Rookie": 29, "Wei": 23, "Meiko": 28, "Xiaohu": 28, "Elk": 25, "Jiejie": 25, "GALA": 25, "Caps": 27, "BrokenBlade": 26, "Hans Sama": 27, "CoreJJ": 32, "Inspired": 24, "Berserker": 23, "Scout": 28, "Lehends": 28, "Bdd": 27, "Aiming": 26, "Cuzz": 27, "Pyosik": 26, "Teddy": 28, "Kingen": 26, "Lucid": 22, "Delight": 24, "Mikyx": 28, "Upset": 26, "Razork": 26, "Elyoya": 26, "Wunder": 28, "Blaber": 26, "Zven": 29, "Impact": 31, "Missing": 25, "Kael": 24, "Hope": 24, "Rich": 29, "Clozer": 23, "deokdam": 26, "Fisher": 22, "Duro": 24, "Kellin": 25, "Clear": 24, "Raptor": 22, "BuLLDoG": 22, "Croco": 26, "Breathe": 24, "Leave": 25, "Assum": 26, "Carzzy": 24, "Labrov": 24, "Canna": 26, "Busio": 22, "Jojopyun": 21, "Josedeodo": 26}; // 部分知名选手2026年龄（按出生年估算）
let S = null; // 全局存档状态

// ================= 身价/薪资 =================
function playerValue(p){
  let v = 30*Math.pow(1.15, p.rating-60);
  const a=p.age;
  const af = a<=19?1.35 : a<=21?1.2 : a<=24?1.05 : a<=27?0.9 : a<=29?0.7 : 0.5;
  v *= af;
  return Math.max(5, Math.round(v));
}
function fairSalary(p){ return Math.max(15, Math.round(playerValue(p)*0.18)); }
const fmtMoney = w => w>=10000 ? (w/10000).toFixed(2)+'亿' : Math.round(w)+'万';

// ================= 初始化 =================
function newGame(userTeam){
  S = { ver:1, year:2026, user:userTeam, teams:{}, players:{}, events:[], evIdx:0,
        news:[], honors:[], points:{}, rr:{}, meta:{}, patchNo:1, uid:1, lplOrder:null,
        log:{} };
  const order = ['LPL','LCK','LEC','LCS','CBLOL','LCP'];
  for(const reg of order){
    const d = ROSTER[reg]; if(!d) continue;
    for(const t of d.teams){
      let key=t.short; if(S.teams[key]) key=t.short+'_'+reg;
      const tier=t.tier||3;
      S.teams[key] = { key, short:t.short, name:t.name, cn:t.cn&&t.cn!==t.name?t.cn:'', region:reg, tier,
        budget: Math.round((reg==='LPL'||reg==='LCK'? 1:0.6)*[0,9000,6500,4500,3200,2400,2000,1800,1600,1500,1400][Math.min(tier,10)]),
        roster:[], lineup:{} };
      for(const p of t.players){
        const pid = String(p.id).trim();
        if(S.players[pid]) continue; // 去重
        const r = srand(hash(pid));
        const age = AGE_FIX[pid] || p.age || (18 + Math.floor(r()*9));
        const pl = { pid, name:p.name||pid, role:p.role, nat:p.nat||(reg==='LPL'?'CN':reg==='LCK'?'KR':'--'),
          age, rating:p.rating||70, team:key, form:0, champs:[], sub:!!p.sub };
        pl.pot = Math.round(clamp(pl.rating + Math.max(0,23-age)*1.6 + r()*4, pl.rating, 97));
        pl.salary = fairSalary(pl);
        pl.contract = 2026 + Math.floor(r()*3);
        genChampPool(pl, r);
        S.players[pid]=pl; S.teams[key].roster.push(pid);
      }
    }
  }
  for(let i=0;i<24;i++) genRookie(2026);
  Object.values(S.teams).forEach(t=>autoLineup(t.key));
  newPatch();
  // LPL 2026 第一赛段分组（官方：按2025排名）
  S.lplOrder = ['BLG','AL','TES','IG','JDG','WBG','NIP','WE','EDG','TT','LGD','UP','LNG','OMG'].filter(k=>S.teams[k]);
  Object.values(S.teams).filter(t=>t.region==='LPL'&&!S.lplOrder.includes(t.key)).forEach(t=>S.lplOrder.push(t.key));
  buildSeason();
  addNews(`欢迎来到 ${S.year} 赛季！你执掌 ${teamName(userTeam)}。目标：拿下LPL世界赛资格，问鼎全球总决赛。`);
}
function genChampPool(pl, r){
  r = r || rnd;
  const pool = CHAMP_KEYS.filter(k=>CH[k].roles.includes(pl.role));
  const sorted = pool.map(k=>[k, (CH[k].roles[0]===pl.role?0.3:0)+r()]).sort((a,b)=>b[1]-a[1]).slice(0,6);
  pl.champs = sorted.map(([c],i)=>({c, p: i<2?5:i<4?3:2}));
}
const RK_A=['Shy','Lin','Kai','Ming','Zero','Neo','Hao','Yun','Feng','Bai','Leo','Qing','Ace','Mist','Ray','Tian','Sky','Jin','Rin','Sol','Xia','Lan','Mo','Chen','Yu','Nova','Rex','Hex','Ark','Vex'];
const RK_B=['','x','o','7','in','er','yu','ze','ki','an','99','ly','Q','zz','ra'];
function genRookie(year){
  let id; do{ id = pick(RK_A)+pick(RK_B); } while(S.players[id]);
  const role = pick(ROLES); const age = 17+Math.floor(rnd()*3);
  const rating = Math.round(56+rnd()*12);
  const pl = { pid:id, name:id+'（虚构新秀）', role, nat:pick(['CN','CN','CN','KR']), age, rating, team:null, form:0, champs:[], rookie:true,
    pot: Math.round(clamp(rating+8+rnd()*18,rating,96)) };
  pl.salary = fairSalary(pl); pl.contract = year+2; genChampPool(pl);
  S.players[id]=pl; return pl;
}
function newPatch(){
  S.meta = {};
  for(const k of CHAMP_KEYS){ const x=rnd(); S.meta[k] = x<0.08?2 : x<0.25?1 : x<0.8?0 : -1; }
  S.patchNo++;
}
const teamName = k => { const t=S.teams[k]; return t? t.short : k; };
const T = k => S.teams[k];
const P = id => S.players[id];

// ================= 阵容 =================
function isForeign(p){ return !['CN','TW','HK','MO'].includes(p.nat); }
function autoLineup(key){
  const t=T(key); t.lineup={};
  for(const r of ROLES){
    const c = t.roster.map(P).filter(p=>p.role===r).sort((a,b)=>b.rating-a.rating)[0];
    if(c) t.lineup[r]=c.pid;
  }
  // 补位：缺位用其他位置替补
  for(const r of ROLES) if(!t.lineup[r]){
    const used=new Set(Object.values(t.lineup));
    const c=t.roster.map(P).filter(p=>!used.has(p.pid)).sort((a,b)=>b.rating-a.rating)[0];
    if(c) t.lineup[r]=c.pid;
  }
}
function starters(key){ const t=T(key); return ROLES.map(r=>P(t.lineup[r])).filter(Boolean); }
function teamOvr(key){
  const t=T(key); let s=0;
  for(const r of ROLES){ const p=P(t.lineup[r]); s += p ? p.rating+(p.form||0)-(p.role!==r?8:0) : 45; }
  return s/5;
}
function lineupProblems(key){
  const t=T(key), probs=[];
  for(const r of ROLES) if(!t.lineup[r]) probs.push(`缺少${ROLE_CN[r]}首发`);
  if(t.region==='LPL'){
    const f = starters(key).filter(isForeign).length;
    if(f>2) probs.push(`首发外援${f}人，超过LPL上限2人（规则为推测）`);
  }
  return probs;
}
function ensureRoster(key){
  // AI球队缺位时签自由球员
  const t=T(key);
  for(const r of ROLES){
    if(t.roster.some(id=>P(id).role===r)) continue;
    let fa = freeAgents().filter(p=>p.role===r).sort((a,b)=>b.rating-a.rating)[0];
    if(!fa){ fa=genRookie(S.year); fa.role=r; genChampPool(fa); }
    signPlayer(fa.pid, key, fa.salary, S.year+1);
  }
  if(key!==S.user) autoLineup(key);
}
function freeAgents(){ return Object.values(S.players).filter(p=>!p.team && !p.retired); }
function signPlayer(pid,key,salary,contract){
  const p=P(pid); if(p.team){ const o=T(p.team); o.roster=o.roster.filter(x=>x!==pid); for(const r of ROLES) if(o.lineup[r]===pid) delete o.lineup[r]; }
  p.team=key; p.salary=salary; p.contract=contract; p.rookie=false;
  T(key).roster.push(pid);
}

// ================= BP / 比赛模拟 =================
function champFit(p, c){
  if(!p) return -6;
  const e=p.champs.find(x=>x.c===c);
  let f = e? e.p : -1.5;
  f += (S.meta[c]||0)*0.9;
  if(!CH[c].roles.includes(p.role)) f -= 4;
  return f;
}
function compInfo(champs){
  const tags={}; let ad=0,ap=0;
  champs.forEach(c=>{ CH[c].tags.forEach(t=>tags[t]=(tags[t]||0)+1); if(CH[c].dmg==='AD')ad++; else if(CH[c].dmg==='AP')ap++; else {ad+=.5;ap+=.5;} });
  let score=0, notes=[];
  if((tags.engage||0)>=2){score+=1.2; notes.push('开团充足');}
  if((tags.engage||0)===0 && champs.length===5){score-=1; notes.push('缺乏开团');}
  if((tags.scale||0)>=2 && (tags.protect||0)>=1){score+=1.2; notes.push('保后期');}
  if((tags.poke||0)>=3){score+=1; notes.push('消耗阵');}
  if((tags.early||0)>=3){score+=1; notes.push('前期压制');}
  if((tags.pick||0)>=3){score+=0.8; notes.push('抓单阵');}
  if(champs.length===5 && (ad>=4.5||ap>=4.5)){score-=1.5; notes.push('伤害类型单一');}
  const style = ['engage','poke','scale','pick','early'].sort((a,b)=>(tags[b]||0)-(tags[a]||0))[0];
  return {score, notes, style, tags};
}
const STYLE_CN={engage:'开团',poke:'消耗',scale:'后期',pick:'抓单',early:'前期'};
// 克制：开团>消耗>后期>开团；前期>后期；抓单>消耗
function styleEdge(a,b){
  const beats={engage:['poke'],poke:['scale','pick'],scale:['engage'],early:['scale'],pick:['poke']};
  if((beats[a]||[]).includes(b)) return 0.8;
  if((beats[b]||[]).includes(a)) return -0.8;
  return 0;
}
// draft: {A,B (team keys), first:'A'|'B', blue:'A'|'B', locked:Set-like array, bans:{A:[],B:[]}, picks:{A:{role:champ},B:{}}, step}
const DRAFT_SEQ = [ // F=先选方 S=后选方
  ['ban','F'],['ban','S'],['ban','F'],['ban','S'],['ban','F'],['ban','S'],
  ['pick','F'],['pick','S'],['pick','S'],['pick','F'],['pick','F'],['pick','S'],
  ['ban','S'],['ban','F'],['ban','S'],['ban','F'],
  ['pick','S'],['pick','F'],['pick','F'],['pick','S']];
function newDraft(A,B,first,blue,locked){
  return {A,B,first,blue,locked:locked||[],bans:{A:[],B:[]},picks:{A:{},B:{}},step:0};
}
function draftSide(d){ if(d.step>=DRAFT_SEQ.length) return null; const [kind,w]=DRAFT_SEQ[d.step]; const side = w==='F'? d.first : (d.first==='A'?'B':'A'); return {kind,side}; }
function unavailable(d){ const u=new Set(d.locked); ['A','B'].forEach(s=>{ d.bans[s].forEach(c=>u.add(c)); Object.values(d.picks[s]).forEach(c=>u.add(c)); }); return u; }
function lineupMap(key){ const t=T(key), m={}; ROLES.forEach(r=>m[r]=P(t.lineup[r])); return m; }
function bestRoleFor(d, side, c){
  const team=d[side], lu=lineupMap(team), open=ROLES.filter(r=>!d.picks[side][r] && CH[c].roles.includes(r));
  if(!open.length) return null;
  return open.sort((a,b)=>champFit(lu[b],c)-champFit(lu[a],c))[0];
}
function draftAct(d, c, role){
  const cur=draftSide(d); if(!cur) return false;
  if(unavailable(d).has(c)) return false;
  if(cur.kind==='ban'){ d.bans[cur.side].push(c); }
  else { role = role || bestRoleFor(d,cur.side,c); if(!role) return false; d.picks[cur.side][role]=c; }
  d.step++; return true;
}
function aiChoose(d){
  const cur=draftSide(d); const un=unavailable(d);
  const me=cur.side, opp= me==='A'?'B':'A';
  let best=null,bs=-1e9;
  if(cur.kind==='ban'){
    const lu=lineupMap(d[opp]);
    for(const c of CHAMP_KEYS){ if(un.has(c)) continue;
      const open=ROLES.filter(r=>!d.picks[opp][r] && CH[c].roles.includes(r)); if(!open.length) continue;
      const s=Math.max(...open.map(r=>champFit(lu[r],c)))+rnd()*2.2;
      if(s>bs){bs=s;best=c;} }
    if(!best) best = CHAMP_KEYS.find(c=>!un.has(c));
    return {c:best};
  }
  const lu=lineupMap(d[me]); const mine=Object.values(d.picks[me]);
  const base=compInfo(mine).score;
  let br=null;
  for(const c of CHAMP_KEYS){ if(un.has(c)) continue;
    for(const r of ROLES){ if(d.picks[me][r]||!CH[c].roles.includes(r)) continue;
      const s=champFit(lu[r],c) + (compInfo(mine.concat(c)).score-base)*0.8 + rnd()*1.8;
      if(s>bs){bs=s;best=c;br=r;} } }
  return {c:best, role:br};
}
function autoDraftRest(d){ while(draftSide(d)){ const ch=aiChoose(d); if(!ch.c){ break; } if(!draftAct(d,ch.c,ch.role)) break; } }
function draftPower(d, side){
  const team=d[side], lu=lineupMap(team), picks=d.picks[side];
  let s=0, det=[];
  for(const r of ROLES){ const p=lu[r], c=picks[r];
    const base = p? p.rating+(p.form||0)-(p.role!==r?8:0) : 45;
    const fit = c? champFit(p,c):0;
    s += base + fit*0.8; det.push({r,p,c,fit}); }
  const ci = compInfo(Object.values(picks));
  return {power:s/5 + ci.score, comp:ci, det};
}
function evalDraft(d){
  const a=draftPower(d,'A'), b=draftPower(d,'B');
  let diff = a.power - b.power + styleEdge(a.comp.style,b.comp.style) + (d.blue==='A'?0.3:-0.3);
  return {a,b,diff,pA: sigmoid(diff/4)};
}
function playGame(d){
  const ev=evalDraft(d);
  const winA = rnd() < sigmoid((ev.diff + randn()*2.8)/5.2);
  const dur = Math.round(24+rnd()*14 + (Math.abs(ev.diff)<2?4:0));
  const wk = 10+Math.floor(rnd()*14), lk = 3+Math.floor(rnd()*(wk-2));
  const stats = side => { const win = (side==='A')===winA; const tk = win?wk:lk, td = win?lk:wk;
    const lu=lineupMap(d[side]); const w={TOP:.18,JUG:.2,MID:.26,ADC:.3,SUP:.06};
    return ROLES.map(r=>{ const k=Math.round(tk*w[r]*(0.5+rnd())); const de=Math.round(td*0.2*(0.4+rnd()*1.2)); const a=Math.round(tk*(r==='SUP'?.7:r==='JUG'?.6:.45)*(0.6+rnd()*0.6));
      return {pid:lu[r]&&lu[r].pid, r, c:d.picks[side][r], k, d:de, a}; }); };
  const sa=stats('A'), sb=stats('B');
  const pool = winA? sa:sb;
  const mvp = pool.slice().sort((x,y)=>(y.k*2+y.a-y.d*1.5+ rnd()*4)-(x.k*2+x.a-x.d*1.5+rnd()*4))[0].pid;
  return { w: winA?'A':'B', dur, kA: winA?wk:lk, kB: winA?lk:wk, mvp, pA:ev.pA, sa, sb,
    bans:{A:d.bans.A.slice(),B:d.bans.B.slice()}, picks:{A:{...d.picks.A},B:{...d.picks.B}}, blue:d.blue, first:d.first,
    styleA:ev.a.comp.style, styleB:ev.b.comp.style };
}
// 系列赛（AI 自动）
function simSeries(m, keepGames){
  const need=Math.ceil(m.bo/2); let wa=0,wb=0; const games=[]; let locked=[];
  let chooser = rnd()<0.5?'A':'B';
  if(m.hiSeed) chooser = m.hiSeed;
  while(wa<need && wb<need){
    // 先手选择：chooser 选择先选权，对方拿蓝色方（AI默认）
    const first = chooser, blue = chooser==='A'?'B':'A';
    const d=newDraft(m.a,m.b,first,blue,locked);
    autoDraftRest(d);
    const g=playGame(d); games.push(g);
    if(g.w==='A')wa++; else wb++;
    locked = locked.concat(Object.values(g.picks.A), Object.values(g.picks.B)); // 无畏征召
    chooser = g.w==='A'?'B':'A'; // 败者获得先手选择权
  }
  return finishSeries(m, wa, wb, games, keepGames);
}
function finishSeries(m, wa, wb, games, keep){
  m.s=[wa,wb]; m.w = wa>wb? m.a : m.b; m.l = wa>wb? m.b : m.a;
  if(keep) m.gm = games.map(g=>({w:g.w,dur:g.dur,kA:g.kA,kB:g.kB,mvp:g.mvp,picks:g.picks,bans:g.bans,blue:g.blue}));
  // 英雄统计
  for(const g of games){ for(const s of ['A','B']) Object.values(g.picks[s]).forEach(c=>{ S.log[c]=S.log[c]||{p:0,w:0,b:0}; S.log[c].p++; if(g.w===s)S.log[c].w++; }); [...g.bans.A,...g.bans.B].forEach(c=>{S.log[c]=S.log[c]||{p:0,w:0,b:0};S.log[c].b++;}); }
  return m;
}

// ================= 赛事结构：循环赛 / 对阵图 / 瑞士轮 =================
function mkMatch(a,b,bo,label,extra){ return Object.assign({id:'m'+(S.uid++), a, b, bo, label, w:null, s:null}, extra||{}); }
function rrRounds(teams){
  const t=teams.slice(); if(t.length%2) t.push(null);
  const n=t.length, rounds=[];
  for(let r=0;r<n-1;r++){ const pr=[]; for(let i=0;i<n/2;i++){ const a=t[i], b=t[n-1-i]; if(a&&b) pr.push(r%2?[b,a]:[a,b]); } rounds.push(pr); t.splice(1,0,t.pop()); }
  return rounds;
}
function mkRR(name, groups, bo, doubleFor){
  // groups: {组名:[teams]}, doubleFor: {组名:true}
  const st={kind:'rr', name, groups, bo, matches:[]};
  const perGroup={};
  for(const g in groups){ let rs=rrRounds(groups[g]); if(doubleFor[g]) rs=rs.concat(rs.map(r=>r.map(([a,b])=>[b,a]))); perGroup[g]=rs; }
  const maxR=Math.max(...Object.values(perGroup).map(r=>r.length));
  for(let i=0;i<maxR;i++) for(const g in perGroup){ const r=perGroup[g][i]; if(r) r.forEach(([a,b])=>st.matches.push(mkMatch(a,b,bo,`${g} 第${i+1}轮`,{g}))); }
  return st;
}
function rrTable(st, g){
  const rows={}; st.groups[g].forEach(t=>rows[t]={t,w:0,l:0,gw:0,gl:0});
  st.matches.filter(m=>m.g===g&&m.w).forEach(m=>{ rows[m.w].w++; rows[m.l].l++;
    rows[m.a].gw+=m.s[0]; rows[m.a].gl+=m.s[1]; rows[m.b].gw+=m.s[1]; rows[m.b].gl+=m.s[0]; });
  return Object.values(rows).sort((x,y)=> (y.w-x.w) || ((y.gw-y.gl)-(x.gw-x.gl)) || (y.gw-x.gw) || (teamOvr(y.t)-teamOvr(x.t)));
}
// 对阵图节点：a/b 可为队伍key 或 {w:节点id} / {l:节点id}
function mkBR(name, nodes, places){
  const st={kind:'br', name, matches:[], places};
  for(const n of nodes) st.matches.push(Object.assign(mkMatch(null,null,n.bo,n.label),{nid:n.id, ra:n.a, rb:n.b, col:n.col||0, row:n.row||0, hiSeed:'A'}));
  resolveBR(st); return st;
}
function refTeam(st, r){
  if(typeof r==='string') return r;
  const m=st.matches.find(x=>x.nid===(r.w||r.l)); if(!m||!m.w) return null;
  return r.w? m.w : m.l;
}
function resolveBR(st){ for(const m of st.matches){ if(!m.a) m.a=refTeam(st,m.ra); if(!m.b) m.b=refTeam(st,m.rb); } }
function brPlaces(st){ return st.places.map(r=>refTeam(st,r)); }
function de8Nodes(s, bo){
  return [
    {id:'U1',a:s[0],b:s[7],bo,label:'胜者组第一轮',col:0,row:0},{id:'U2',a:s[3],b:s[4],bo,label:'胜者组第一轮',col:0,row:1},
    {id:'U3',a:s[1],b:s[6],bo,label:'胜者组第一轮',col:0,row:2},{id:'U4',a:s[2],b:s[5],bo,label:'胜者组第一轮',col:0,row:3},
    {id:'L1',a:{l:'U1'},b:{l:'U2'},bo,label:'败者组第一轮',col:1,row:4},{id:'L2',a:{l:'U3'},b:{l:'U4'},bo,label:'败者组第一轮',col:1,row:5},
    {id:'U5',a:{w:'U1'},b:{w:'U2'},bo,label:'胜者组半决赛',col:1,row:0},{id:'U6',a:{w:'U3'},b:{w:'U4'},bo,label:'胜者组半决赛',col:1,row:1},
    {id:'L3',a:{w:'L1'},b:{l:'U6'},bo,label:'败者组第二轮',col:2,row:4},{id:'L4',a:{w:'L2'},b:{l:'U5'},bo,label:'败者组第二轮',col:2,row:5},
    {id:'U7',a:{w:'U5'},b:{w:'U6'},bo,label:'胜者组决赛',col:2,row:0},
    {id:'L5',a:{w:'L3'},b:{w:'L4'},bo,label:'败者组第三轮',col:3,row:4},
    {id:'L6',a:{w:'L5'},b:{l:'U7'},bo,label:'败者组决赛',col:4,row:4},
    {id:'GF',a:{w:'U7'},b:{w:'L6'},bo,label:'总决赛',col:5,row:0}];
}
const DE8_PLACES=[{w:'GF'},{l:'GF'},{l:'L6'},{l:'L5'},{l:'L3'},{l:'L4'},{l:'L1'},{l:'L2'}];
function gslNodes(t, mode, bo, boElim){ // t[4]，mode 'top2'（前二晋级）或 'top1'（4队双败，1队晋级）
  const e=boElim||bo;
  const n=[{id:'M1',a:t[0],b:t[3],bo,label:'首轮',col:0,row:0},{id:'M2',a:t[1],b:t[2],bo,label:'首轮',col:0,row:1},
    {id:'WM',a:{w:'M1'},b:{w:'M2'},bo,label:'胜者组',col:1,row:0},{id:'LM',a:{l:'M1'},b:{l:'M2'},bo:e,label:'败者组（淘汰赛）',col:1,row:1}];
  if(mode==='top2'){ n.push({id:'DM',a:{l:'WM'},b:{w:'LM'},bo:e,label:'晋级战（淘汰赛）',col:2,row:1}); return {nodes:n, places:[{w:'WM'},{w:'DM'},{l:'DM'},{l:'LM'}]}; }
  n.push({id:'LF',a:{l:'WM'},b:{w:'LM'},bo:e,label:'败者组决赛',col:2,row:1});
  n.push({id:'GF',a:{w:'WM'},b:{w:'LF'},bo:e,label:'决赛',col:3,row:0});
  return {nodes:n, places:[{w:'GF'},{l:'GF'},{l:'LF'},{l:'LM'}]};
}
function seNodes(t, bo, finalBo, pre){ // 4 或 8 队单败
  pre=pre||''; const n=[]; let ids=[];
  let col=0;
  if(t.length===8){ for(let i=0;i<4;i++){ n.push({id:'Q'+i,a:t[i*2],b:t[i*2+1],bo,label:'八强赛',col,row:i}); } ids=['Q0','Q1','Q2','Q3']; col++;
    n.push({id:'S0',a:{w:'Q0'},b:{w:'Q1'},bo,label:'半决赛',col,row:0},{id:'S1',a:{w:'Q2'},b:{w:'Q3'},bo,label:'半决赛',col,row:1}); }
  else { n.push({id:'S0',a:t[0],b:t[1],bo,label:'半决赛',col,row:0},{id:'S1',a:t[2],b:t[3],bo,label:'半决赛',col,row:1}); }
  col++;
  n.push({id:'F',a:{w:'S0'},b:{w:'S1'},bo:finalBo||bo,label:'决赛',col,row:0});
  const places=[{w:'F'},{l:'F'},{l:'S0'},{l:'S1'}]; if(t.length===8) places.push({l:'Q0'},{l:'Q1'},{l:'Q2'},{l:'Q3'});
  return {nodes:n, places};
}
// 瑞士轮：3胜晋级 3负淘汰；晋级/淘汰关键局 BO3，其余 BO1（参照2025世界赛，2026细节为推测）
function mkSwiss(name, teams){
  const st={kind:'swiss', name, teams, rec:{}, met:{}, round:0, matches:[]};
  teams.forEach(t=>{st.rec[t]=[0,0]; st.met[t]=[];});
  swissNextRound(st); return st;
}
function swissNextRound(st){
  const active = st.teams.filter(t=>st.rec[t][0]<3 && st.rec[t][1]<3);
  if(!active.length) return false;
  st.round++;
  const groups={};
  active.forEach(t=>{const k=st.rec[t].join('-'); (groups[k]=groups[k]||[]).push(t);});
  for(const k in groups){
    let best=null, bestBad=1e9;
    for(let tries=0;tries<80;tries++){
      const g=shuffle(groups[k]); let bad=0; const pr=[];
      for(let i=0;i<g.length;i+=2){ const a=g[i],b=g[i+1]; if(!b) continue; if(st.met[a].includes(b)) bad+=10; if(st.round===1&&T(a).region===T(b).region) bad+=5; pr.push([a,b]); }
      if(bad<bestBad){bestBad=bad;best=pr;} if(!bad) break;
    }
    const [w,l]=k.split('-').map(Number);
    for(const [a,b] of best){ const decisive = (w===2||l===2); st.matches.push(mkMatch(a,b,decisive?3:1,`第${st.round}轮（${k}）`,{rnd:st.round})); }
  }
  return true;
}
function swissReport(st, m){ st.rec[m.w][0]++; st.rec[m.l][1]++; st.met[m.a].push(m.b); st.met[m.b].push(m.a); }

// ================= 赛季日程 =================
const EVENT_INFO = {
  lpl_s1:{name:'LPL 第一赛段', date:'1月14日 - 3月8日', loc:'中国',
    fmt:'✅ 14队按上赛季排名分三组：登峰组6队、坚毅组4队、涅槃组4队，组内双循环BO3（双边无畏征召）。✅ 登峰组前4直通季后赛；登峰组5-6、坚毅组全部、涅槃组前2进入“骑士之路”BO5单败；涅槃组后2淘汰。✅ 季后赛8队双败BO5。✅ 冠军80分、亚军50分，前两名出战全球先锋赛。⚠️ 3-8名积分为推测值。'},
  fst:{name:'全球先锋赛 First Stand', date:'3月16日 - 22日', loc:'巴西 圣保罗',
    fmt:'✅ 8队：LCK 2、LPL 2、LEC/LCS/CBLOL/LCP 各1。✅ 全程BO5无畏征召，小组赛+淘汰赛。✅ 冠军赛区获得MSI额外直通名额。⚠️ 小组赛具体结构为推测：两组各4队双败（GSL），各组前2进半决赛。'},
  lpl_s2:{name:'LPL 第二赛段', date:'3月下旬 - 6月', loc:'中国',
    fmt:'✅ 第一赛段季后赛8队进登峰组（双循环BO3），其余6队进涅槃组（单循环BO3）。✅ 登峰组前2直通季后赛；涅槃组后2淘汰（无缘第三赛段）；其余队伍跨组BO5单败“骑士之路”。✅ 季后赛8队双败，前二出战MSI。⚠️ 骑士之路对阵细节、积分值为推测；冠军代表LPL参加EWC为推测。'},
  msi:{name:'MSI 季中冠军赛', date:'6月28日 - 7月12日', loc:'韩国 大田',
    fmt:'✅ 11队：LCK/LPL/LEC/LCS/LCP 各2、CBLOL 1。✅ 各赛区一号种子 + 先锋赛冠军赛区二号种子直通对阵图（7队）。✅ 入围赛4队双败，1队晋级。✅ 对阵图8队双败，全程BO5无畏征召。✅ 冠军与亚军赛区各获得一个额外世界赛名额。'},
  ewc:{name:'电竞世界杯 EWC', date:'7月15日 - 19日', loc:'法国 巴黎',
    fmt:'✅ 16队：卫冕冠军（Gen.G）+ 六大赛区冠军 + 9支线上预选赛队伍。✅ 4个GSL双败小组，前2晋级；小组赛BO1，淘汰局BO3。✅ 淘汰赛单败BO3，决赛BO5。⚠️ 9个预选赛名额按各赛区实力分配为简化处理。'},
  lpl_s3:{name:'LPL 第三赛段', date:'7月22日 - 9月', loc:'中国 · 五大城市主场',
    fmt:'✅ 12队：第二赛段季后赛8队进登峰组，其余4队进涅槃组，组内双循环BO3。✅ 登峰组前6直通季后赛；登峰组7-8与涅槃组前2进行BO5单败骑士之路，争夺最后2席。✅ 季后赛8队。✅ 冠军为LPL一号种子出战世界赛。⚠️ 积分值为推测。'},
  lpl_rf:{name:'LPL 世界赛资格赛', date:'9月', loc:'中国',
    fmt:'⚠️ 未能查到2026官方细则，按往年惯例简化：第三赛段冠军为一号种子；其余名额按全年积分排名，最后一个名额由积分排名紧随其后的两队BO5决出。'},
  worlds:{name:'全球总决赛 Worlds', date:'10月15日 - 11月14日', loc:'美国 洛杉矶 / 德州艾伦 / 纽约',
    fmt:'✅ 19队：LCK/LPL/LEC/LCS/LCP 各3、CBLOL 2，另MSI冠军与亚军赛区各+1。✅ 入围赛4队双败BO5，1队晋级。✅ 瑞士轮16队（德州艾伦）→ 淘汰赛8队 → 决赛（纽约巴克莱中心）。⚠️ 入围赛参赛队伍、瑞士轮BO数（BO1/关键局BO3）、淘汰赛BO5沿用2025规则，为推测。'},
  window:{name:'转会窗口', date:'', loc:'', fmt:'转会窗口开启：可以买卖、交换选手，签约自由球员。'},
  off:{name:'休赛期', date:'11月 - 次年1月', loc:'', fmt:'合同到期、续约、转会期。选手年龄+1，能力成长或衰退。'},
};
function buildSeason(){
  S.events = ['lpl_s1','fst','window','lpl_s2','msi','ewc','window','lpl_s3','lpl_rf','worlds','off'].map(type=>({type, stages:[], si:0, done:false, started:false, res:{}}));
  S.evIdx=0; S.points={}; S.lplOrder.forEach(k=>S.points[k]=0);
  S.rr={}; S.log={};
}
const curEvent = () => S.events[S.evIdx];
function regionRank(region, split){
  S.rr[region]=S.rr[region]||{};
  if(!S.rr[region][split]){
    const ts=Object.values(S.teams).filter(t=>t.region===region).map(t=>[t.key, teamOvr(t.key)+randn()*2.2]);
    S.rr[region][split]=ts.sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  }
  return S.rr[region][split];
}
function addPoints(order, table){ order.forEach((k,i)=>{ if(k && table[i]) S.points[k]=(S.points[k]||0)+table[i]; }); }

const EV = {}; // 每类赛事：init(ev) 开始, next(ev) 当前阶段结束后调用
// ---------- LPL S1 ----------
EV.lpl_s1 = {
  init(ev){ const o=S.lplOrder; ev.stages.push(mkRR('常规赛（组内赛）',{登峰组:o.slice(0,6),坚毅组:o.slice(6,10),涅槃组:o.slice(10,14)},3,{登峰组:1,坚毅组:1,涅槃组:1})); },
  next(ev){
    const st=ev.stages[ev.si];
    if(ev.si===0){
      const A=rrTable(st,'登峰组').map(r=>r.t), P_=rrTable(st,'坚毅组').map(r=>r.t), N=rrTable(st,'涅槃组').map(r=>r.t);
      ev.res.A=A; ev.res.P=P_; ev.res.N=N;
      ev.stages.push(mkBR('骑士之路（第一轮）',[
        {id:'K1',a:A[4],b:P_[1],bo:5,label:'登峰5 vs 坚毅2'},{id:'K2',a:A[5],b:P_[0],bo:5,label:'登峰6 vs 坚毅1'},
        {id:'K3',a:P_[2],b:N[1],bo:5,label:'坚毅3 vs 涅槃2'},{id:'K4',a:P_[3],b:N[0],bo:5,label:'坚毅4 vs 涅槃1'}],[]));
    } else if(ev.si===1){
      const g=k=>st.matches.find(m=>m.nid===k);
      const seedOrd=[...ev.res.A,...ev.res.P,...ev.res.N];
      ev.res.adv56=[g('K1').w,g('K2').w].sort((a,b)=>seedOrd.indexOf(a)-seedOrd.indexOf(b));
      const r3=[g('K1').l,g('K2').l,g('K3').w,g('K4').w].sort((a,b)=>seedOrd.indexOf(a)-seedOrd.indexOf(b));
      ev.stages.push(mkBR('骑士之路（第二轮）',[{id:'K5',a:r3[0],b:r3[3],bo:5,label:'决胜轮'},{id:'K6',a:r3[1],b:r3[2],bo:5,label:'决胜轮'}],[]));
    } else if(ev.si===2){
      const g=k=>st.matches.find(m=>m.nid===k);
      const seeds=[...ev.res.A.slice(0,4), ...ev.res.adv56, g('K5').w, g('K6').w];
      ev.stages.push(mkBR('季后赛',de8Nodes(seeds,5),DE8_PLACES));
    } else {
      const top8=brPlaces(st); const rest=[...ev.res.A,...ev.res.P,...ev.res.N].filter(t=>!top8.includes(t));
      ev.res.final=[...top8,...rest];
      addPoints(ev.res.final,[80,50,30,30,20,20,10,10]);
      S.lplOrder=ev.res.final; ev.done=true;
      ev.res.champ=top8[0];
      addNews(`🏆 ${teamName(top8[0])} 夺得LPL第一赛段冠军！${teamName(top8[0])}、${teamName(top8[1])} 将代表LPL出战全球先锋赛。`);
      splitEnd('s1', ev.res.final);
    }
  }
};
// ---------- LPL S2 ----------
EV.lpl_s2 = {
  init(ev){ const o=S.lplOrder; ev.stages.push(mkRR('常规赛（组内赛）',{登峰组:o.slice(0,8),涅槃组:o.slice(8,14)},3,{登峰组:1})); },
  next(ev){
    const st=ev.stages[ev.si]; const g=k=>st.matches.find(m=>m.nid===k);
    if(ev.si===0){
      const A=rrTable(st,'登峰组').map(r=>r.t), N=rrTable(st,'涅槃组').map(r=>r.t);
      ev.res.A=A; ev.res.N=N; ev.res.out=N.slice(4);
      ev.stages.push(mkBR('骑士之路（第一轮）',[{id:'K1',a:N[0],b:N[3],bo:5,label:'涅槃1 vs 涅槃4'},{id:'K2',a:N[1],b:N[2],bo:5,label:'涅槃2 vs 涅槃3'}],[]));
    } else if(ev.si===1){
      const A=ev.res.A;
      ev.res.out = ev.res.out.concat([g('K1').l,g('K2').l]);
      ev.stages.push(mkBR('骑士之路（第二轮）',[
        {id:'K3',a:A[2],b:g('K2').w,bo:5,label:'登峰3 vs 涅槃晋级者'},{id:'K4',a:A[3],b:g('K1').w,bo:5,label:'登峰4 vs 涅槃晋级者'},
        {id:'K5',a:A[4],b:A[7],bo:5,label:'登峰5 vs 登峰8'},{id:'K6',a:A[5],b:A[6],bo:5,label:'登峰6 vs 登峰7'}],[]));
    } else if(ev.si===2){
      const ord=[...ev.res.A,...ev.res.N];
      ev.res.adv=['K3','K4','K5','K6'].map(k=>g(k).w).sort((a,b)=>ord.indexOf(a)-ord.indexOf(b));
      const r3=['K3','K4','K5','K6'].map(k=>g(k).l).sort((a,b)=>ord.indexOf(a)-ord.indexOf(b));
      ev.stages.push(mkBR('骑士之路（决胜轮）',[{id:'K7',a:r3[0],b:r3[3],bo:5,label:'决胜轮'},{id:'K8',a:r3[1],b:r3[2],bo:5,label:'决胜轮'}],[]));
    } else if(ev.si===3){
      const seeds=[...ev.res.A.slice(0,2),...ev.res.adv,g('K7').w,g('K8').w];
      ev.stages.push(mkBR('季后赛',de8Nodes(seeds,5),DE8_PLACES));
    } else {
      // 被淘汰的两支涅槃组队伍 = 第一轮骑士之路的输家？官方：涅槃组后2淘汰 → 无缘第三赛段
      const top8=brPlaces(st); const ord=[...ev.res.A,...ev.res.N];
      const out2 = ev.res.N.slice(4);
      const rest = ord.filter(t=>!top8.includes(t) && !out2.includes(t));
      ev.res.final=[...top8,...rest,...out2]; ev.res.s3teams=[...top8,...rest];
      addPoints(ev.res.final,[100,70,50,40,30,30,20,20]);
      S.lplOrder=ev.res.final; ev.done=true; ev.res.champ=top8[0];
      addNews(`🏆 ${teamName(top8[0])} 夺得LPL第二赛段冠军！${teamName(top8[0])}、${teamName(top8[1])} 出战MSI。${out2.map(teamName).join('、')} 无缘第三赛段。`);
      splitEnd('s2', ev.res.final);
    }
  }
};
// ---------- LPL S3 ----------
EV.lpl_s3 = {
  init(ev){ const s2=S.events.find(e=>e.type==='lpl_s2').res; const t=s2.s3teams; ev.stages.push(mkRR('常规赛（组内赛）',{登峰组:t.slice(0,8),涅槃组:t.slice(8)},3,{登峰组:1,涅槃组:1})); },
  next(ev){
    const st=ev.stages[ev.si]; const g=k=>st.matches.find(m=>m.nid===k);
    if(ev.si===0){
      const A=rrTable(st,'登峰组').map(r=>r.t), N=rrTable(st,'涅槃组').map(r=>r.t); ev.res.A=A; ev.res.N=N;
      ev.stages.push(mkBR('骑士之路',[{id:'K1',a:A[6],b:N[1],bo:5,label:'登峰7 vs 涅槃2'},{id:'K2',a:A[7],b:N[0],bo:5,label:'登峰8 vs 涅槃1'}],[]));
    } else if(ev.si===1){
      ev.stages.push(mkBR('季后赛',de8Nodes([...ev.res.A.slice(0,6),g('K1').w,g('K2').w],5),DE8_PLACES));
    } else {
      const top8=brPlaces(st); const ord=[...ev.res.A,...ev.res.N];
      const s2=S.events.find(e=>e.type==='lpl_s2').res;
      ev.res.final=[...top8, ...ord.filter(t=>!top8.includes(t)), ...s2.final.filter(t=>!ord.includes(t))];
      addPoints(ev.res.final.slice(1),[90,70,50,30,30,20,20]);
      S.lplOrder=ev.res.final; ev.done=true; ev.res.champ=top8[0];
      addNews(`🏆 ${teamName(top8[0])} 夺得LPL第三赛段冠军，锁定LPL一号种子出战全球总决赛！`);
      splitEnd('s3', ev.res.final);
    }
  }
};
// ---------- LPL 世界赛资格赛 ----------
function worldsSlots(){
  const slots={LPL:3,LCK:3,LEC:3,LCS:3,LCP:3,CBLOL:2};
  const msi=S.events.find(e=>e.type==='msi');
  if(msi&&msi.done){ slots[T(msi.res.champ).region]++; slots[T(msi.res.runner).region]++; }
  return slots;
}
EV.lpl_rf = {
  init(ev){
    const champ=S.events.find(e=>e.type==='lpl_s3').res.champ;
    const n=worldsSlots().LPL;
    const rest=S.lplOrder.filter(t=>t!==champ).sort((a,b)=>(S.points[b]||0)-(S.points[a]||0));
    ev.res.slots=n; ev.res.seeds=[champ, ...rest.slice(0,n-2)];
    ev.res.cands=[rest[n-2],rest[n-1]];
    ev.stages.push(mkBR('最后一个世界赛名额',[{id:'Q',a:rest[n-2],b:rest[n-1],bo:5,label:`争夺LPL${n}号种子`}],[{w:'Q'}]));
  },
  next(ev){ const w=brPlaces(ev.stages[0])[0]; ev.res.seeds.push(w); ev.done=true;
    addNews(`🌍 LPL世界赛代表确定：${ev.res.seeds.map((t,i)=>`${i+1}号种子 ${teamName(t)}`).join('，')}。`); }
};
// ---------- 先锋赛 ----------
EV.fst = {
  init(ev){
    const lpl=S.events.find(e=>e.type==='lpl_s1').res.final;
    const lck=regionRank('LCK','s1');
    const others=['LEC','LCS','CBLOL','LCP'].map(r=>regionRank(r,'s1')[0]);
    const o=shuffle(others);
    const flip=rnd()<0.5;
    const gA=[flip?lck[0]:lpl[0], o[0], flip?lpl[1]:lck[1], o[1]];
    const gB=[flip?lpl[0]:lck[0], o[2], flip?lck[1]:lpl[1], o[3]];
    ev.res.teams=[...gA,...gB];
    const a=gslNodes(gA,'top2',5), b=gslNodes(gB,'top2',5);
    ev.stages.push(mkBR('小组赛 A组',a.nodes,a.places)); ev.stages.push(mkBR('小组赛 B组',b.nodes,b.places));
    ev.parallel=[0,1];
  },
  next(ev){
    if(ev.si<=1){ if(ev.si===0){ return 'wait'; }
      const A=brPlaces(ev.stages[0]), B=brPlaces(ev.stages[1]);
      const k=seNodes([A[0],B[1],B[0],A[1]],5,5);
      ev.stages.push(mkBR('淘汰赛',k.nodes,k.places));
    } else { const pl=brPlaces(ev.stages[2]); ev.res.champ=pl[0]; ev.res.runner=pl[1]; ev.done=true;
      addNews(`🏆 ${teamName(pl[0])}（${T(pl[0]).region}）夺得全球先锋赛冠军！${T(pl[0]).region}赛区获得MSI额外直通名额。`);
      intlPrize(pl,[600,300,150,150]); }
  }
};
// ---------- MSI ----------
EV.msi = {
  init(ev){
    const lpl=S.events.find(e=>e.type==='lpl_s2').res.final;
    const fstReg = T(S.events.find(e=>e.type==='fst').res.champ).region;
    const seeds={LPL:lpl.slice(0,2)}; ['LCK','LEC','LCS','LCP'].forEach(r=>seeds[r]=regionRank(r,'s2').slice(0,2)); seeds.CBLOL=[regionRank('CBLOL','s2')[0]];
    const bye=REGIONS.map(r=>seeds[r][0]); bye.push(seeds[fstReg][1]);
    const playin=[]; REGIONS.forEach(r=>{ if(seeds[r][1] && r!==fstReg) playin.push(seeds[r][1]); });
    ev.res.bye=bye; ev.res.playin=playin; ev.res.fstReg=fstReg;
    playin.sort((a,b)=>REGION_STR[T(b).region]-REGION_STR[T(a).region]);
    const g=gslNodes(playin,'top1',5);
    ev.stages.push(mkBR('入围赛',g.nodes,g.places));
  },
  next(ev){
    if(ev.si===0){
      const win=brPlaces(ev.stages[0])[0];
      const all=[...ev.res.bye, win].sort((a,b)=>(REGION_STR[T(b).region]-REGION_STR[T(a).region]) || (ev.res.bye.indexOf(a)-ev.res.bye.indexOf(b)));
      // 档位抽签：1档对4档、2档对3档，同赛区分开半区
      const tiers=[all.slice(0,2),all.slice(2,4),all.slice(4,6),all.slice(6,8)].map(shuffle);
      let s=[tiers[0][0],tiers[0][1],tiers[1][0],tiers[1][1],tiers[2][1],tiers[2][0],tiers[3][1],tiers[3][0]];
      // s 顺序映射 de8: U1 s0-s7, U2 s3-s4, U3 s1-s6, U4 s2-s5 ；半区1={s0,s7,s3,s4} 半区2={s1,s6,s2,s5}
      for(let t=0;t<30;t++){ const h1=[s[0],s[7],s[3],s[4]].map(x=>T(x).region), h2=[s[1],s[6],s[2],s[5]].map(x=>T(x).region);
        if(new Set(h1).size===4 && new Set(h2).size===4) break; const i=pick([2,3,4,5,6,7]), j=pick([2,3,4,5,6,7]); [s[i],s[j]]=[s[j],s[i]]; }
      ev.stages.push(mkBR('对阵图阶段',de8Nodes(s,5),DE8_PLACES));
    } else { const pl=brPlaces(ev.stages[1]); ev.res.champ=pl[0]; ev.res.runner=pl[1]; ev.done=true;
      addNews(`🏆 ${teamName(pl[0])} 夺得MSI冠军！${T(pl[0]).region}与${T(pl[1]).region}赛区获得额外世界赛名额。`);
      intlPrize(pl,[1000,500,250,200,100,100,60,60]); }
  }
};
// ---------- EWC ----------
const EWC_DEFENDING = 'GEN'; // EWC 2025 冠军：Gen.G（已核实）；之后赛季为上届EWC冠军
EV.ewc = {
  init(ev){
    const champs=[S.events.find(e=>e.type==='lpl_s2').res.champ, ...['LCK','LEC','LCS','LCP','CBLOL'].map(r=>regionRank(r,'s2')[0])];
    const set=new Set(champs);
    const dfd=S.ewcDefending||EWC_DEFENDING; if(T(dfd)) set.add(dfd); ev.res.defending=dfd;
    const lpl=S.events.find(e=>e.type==='lpl_s2').res.final;
    const quota={LCK:3,LPL:2,LEC:2,LCS:1,LCP:1,CBLOL:1};
    const pools={LPL:lpl}; ['LCK','LEC','LCS','LCP','CBLOL'].forEach(r=>pools[r]=regionRank(r,'s2'));
    for(const r of ['LCK','LPL','LEC','LCS','LCP','CBLOL']){ let n=0; for(const t of pools[r]){ if(set.size>=16||n>=quota[r]) break; if(!set.has(t)){set.add(t);n++;} } }
    const all=[...set].slice(0,16).sort((a,b)=>teamOvr(b)-teamOvr(a));
    // 蛇形分组
    const G=[[],[],[],[]]; all.forEach((t,i)=>{ const row=Math.floor(i/4), c=i%4; G[row%2?3-c:c].push(t); });
    ev.res.teams=all;
    'ABCD'.split('').forEach((n,i)=>{ const g=gslNodes([G[i][0],G[i][1],G[i][2],G[i][3]],'top2',1,3); ev.stages.push(mkBR(`小组赛 ${n}组`,g.nodes,g.places)); });
    ev.parallel=[0,1,2,3];
  },
  next(ev){
    if(ev.si<=3){ if(ev.si<3) return 'wait';
      const p=[0,1,2,3].map(i=>brPlaces(ev.stages[i]));
      const k=seNodes([p[0][0],p[1][1],p[1][0],p[0][1],p[2][0],p[3][1],p[3][0],p[2][1]],3,5);
      ev.stages.push(mkBR('淘汰赛',k.nodes,k.places));
    } else { const pl=brPlaces(ev.stages[4]); ev.res.champ=pl[0]; ev.done=true; S.ewcDefending=pl[0];
      addNews(`🏆 ${teamName(pl[0])} 夺得电竞世界杯（EWC）英雄联盟项目冠军！`);
      intlPrize(pl,[1200,600,300,300,150,150,150,150]); }
  }
};
// ---------- 全球总决赛 ----------
EV.worlds = {
  init(ev){
    const slots=worldsSlots(); ev.res.slots=slots;
    const seeds={LPL:S.events.find(e=>e.type==='lpl_rf').res.seeds};
    REGIONS.filter(r=>r!=='LPL').forEach(r=>seeds[r]=regionRank(r,'s3').slice(0,slots[r]));
    ev.res.seeds=seeds;
    // 入围赛：额外名额的末位种子 + LCP末位 + CBLOL末位（推测）
    const playin=[];
    const base={LPL:3,LCK:3,LEC:3,LCS:3,LCP:3,CBLOL:2};
    REGIONS.forEach(r=>{ for(let i=base[r];i<slots[r];i++) playin.push(seeds[r][i]); });
    for(const [r,i] of [['LCP',2],['CBLOL',1],['LCS',2],['LEC',2]]){ if(playin.length>=4) break; if(!playin.includes(seeds[r][i])) playin.push(seeds[r][i]); }
    ev.res.playin=playin.slice(0,4);
    ev.res.direct=REGIONS.flatMap(r=>seeds[r]).filter(t=>!ev.res.playin.includes(t));
    const g=gslNodes(ev.res.playin.sort((a,b)=>teamOvr(b)-teamOvr(a)),'top1',5);
    ev.stages.push(mkBR('入围赛（洛杉矶）',g.nodes,g.places));
  },
  next(ev){
    if(ev.si===0){ const w=brPlaces(ev.stages[0])[0]; ev.stages.push(mkSwiss('瑞士轮（德州艾伦）',[...ev.res.direct,w])); }
    else if(ev.si===1){
      const st=ev.stages[1]; const adv=st.teams.filter(t=>st.rec[t][0]===3).sort((a,b)=>st.rec[a][1]-st.rec[b][1]);
      // 高战绩对低战绩，尽量避开同赛区
      let hi=adv.slice(0,4), lo=adv.slice(4).reverse(), pairs=[];
      for(let t=0;t<40;t++){ const L=t?shuffle(lo):lo; if(hi.every((h,i)=>T(h).region!==T(L[i]).region)){lo=L;break;} }
      hi.forEach((h,i)=>pairs.push(h,lo[i]));
      // 同一半区避开第1、2名
      const k=seNodes([pairs[0],pairs[1],pairs[4],pairs[5],pairs[2],pairs[3],pairs[6],pairs[7]],5,5);
      ev.stages.push(mkBR('淘汰赛（八强-决赛）',k.nodes,k.places));
    } else { const pl=brPlaces(ev.stages[2]); ev.res.champ=pl[0]; ev.res.runner=pl[1]; ev.done=true;
      addNews(`🏆🏆 ${teamName(pl[0])} 在纽约巴克莱中心捧起召唤师杯，成为${S.year}全球总决赛冠军！`);
      intlPrize(pl,[3000,1500,700,700,350,350,350,350]);
      S.honors.push({year:S.year, worlds:pl[0], runner:pl[1]}); }
  }
};
EV.window={ init(ev){ ev.done=false; }, next(){} };
EV.off={ init(ev){}, next(){} };

function intlPrize(pl, table){ pl.forEach((t,i)=>{ if(t&&table[i]) T(t).budget+=table[i]; }); const u=pl.indexOf(S.user); if(u>=0&&table[u]) addNews(`💰 ${teamName(S.user)} 获得奖金 ${fmtMoney(table[u])}。`); }
function splitEnd(split, order){
  // 其他赛区本赛段排名
  REGIONS.filter(r=>r!=='LPL').forEach(r=>regionRank(r,split));
  // 财务：LPL奖金+赞助 − 1/3年薪
  order.forEach((k,i)=>{ const t=T(k); const income = 300 + [500,300,200,150,100,100,80,80][i]||40; t.budget += income;
    const pay = t.roster.map(P).reduce((s,p)=>s+p.salary,0)/3; t.budget -= Math.round(pay);
    if(k===S.user) addNews(`💼 赛段结算：收入 ${fmtMoney(income)}，支付薪资 ${fmtMoney(pay)}，余额 ${fmtMoney(t.budget)}。`); });
  Object.values(S.teams).filter(t=>t.region!=='LPL').forEach(t=>{ t.budget += 400 - Math.round(t.roster.map(P).reduce((s,p)=>s+p.salary,0)/3*0.6); });
  // 成长与状态
  Object.values(S.players).forEach(p=>{ if(p.retired) return;
    let d = p.age<=22 ? (p.pot-p.rating)*0.1+randn()*0.7 : p.age<=26 ? randn()*0.7 : -0.35+randn()*0.7;
    p.rating = clamp(Math.round((p.rating+d)*10)/10, 45, 97); p.form = Math.round(randn()*1.5*10)/10; });
  newPatch();
  addNews(`🔧 新版本 ${S.year%100}.${S.patchNo} 上线，英雄强度发生变化。`);
}

// ---------- 推进逻辑 ----------
function stageMatches(ev){ // 当前可进行的比赛（含并行小组）
  const idxs = ev.parallel && ev.si<=Math.max(...ev.parallel) ? ev.parallel : [ev.si];
  const out=[];
  for(const i of idxs){ const st=ev.stages[i]; if(!st) continue; if(st.kind==='br') resolveBR(st);
    for(const m of st.matches) if(!m.w && m.a && m.b) out.push({m,st}); }
  // 循环赛按轮次：只给出最早轮次
  return out;
}
function nextReadyMatch(){ const ev=curEvent(); if(!ev||ev.done) return null; const a=stageMatches(ev); return a[0]||null; }
function stageDone(st){ if(st.kind==='br') resolveBR(st); return st.matches.every(m=>m.w); }
function startEvent(){ const ev=curEvent(); if(!ev.started){ ev.started=true; EV[ev.type].init(ev); } }
function afterMatch(st, m){
  if(st.kind==='swiss') swissReport(st,m);
  if(st.kind==='br') resolveBR(st);
  const ev=curEvent();
  // 阶段推进
  let guard=0;
  while(!ev.done && guard++<10){
    const idxs = ev.parallel && ev.si<=Math.max(...ev.parallel) ? ev.parallel : [ev.si];
    const cur=ev.stages[ev.si];
    if(cur.kind==='swiss'){ if(cur.matches.every(x=>x.w)){ if(swissNextRound(cur)) break; } else break; }
    if(!idxs.every(i=>stageDone(ev.stages[i]))) break;
    if(ev.parallel && idxs.length>1){ ev.si=Math.max(...idxs); EV[ev.type].next(ev); ev.si++; delete ev.parallel; continue; }
    EV[ev.type].next(ev); if(!ev.done) ev.si++;
  }
  if(ev.parallel && ev.si>Math.max(...ev.parallel)) delete ev.parallel;
}
// 修正并行逻辑：对 FST/EWC，next 在 si = 最后一个小组时执行
function playAI(item){ simSeries(item.m, isBig(item.st,item.m)); afterMatch(item.st,item.m); }
function isBig(st,m){ return m.a===S.user||m.b===S.user||/决赛/.test(m.label); }
function userInvolved(m){ return m.a===S.user||m.b===S.user; }
function simUntilUser(limitAll){
  startEvent();
  let n=0;
  while(true){ const it=nextReadyMatch(); if(!it) break;
    if(userInvolved(it.m) && !limitAll) return it;
    if(userInvolved(it.m) && limitAll){ simSeries(it.m,true); afterMatch(it.st,it.m); n++; continue; }
    playAI(it); n++; if(n>2000) break; }
  return null;
}
function advanceEvent(){
  const ev=curEvent(); if(!ev.done) return;
  S.evIdx++;
  if(S.evIdx>=S.events.length){ S.evIdx=S.events.length-1; }
}
function addNews(t){ S.news.unshift({y:S.year, ev:curEvent()?EVENT_INFO[curEvent().type].name:'', t}); if(S.news.length>300) S.news.length=300; }

// ================= 转会 =================
function askPrice(p){
  const t=T(p.team); let f=1.0;
  if(t && Object.values(t.lineup).includes(p.pid)) f+=0.35;
  if(t && t.tier<=2) f+=0.15;
  if(p.contract<=S.year) f*=0.7;
  return Math.round(playerValue(p)*f);
}
function evaluateOffer(pid, cash, givePid){
  const p=P(pid), seller=T(p.team); const ask=askPrice(p);
  let offerVal=cash; let gp=null;
  if(givePid){ gp=P(givePid); offerVal += playerValue(gp)*(gp.role===p.role?0.95:0.7); }
  const ratio=offerVal/ask;
  return {ask, offerVal, ratio, accept: ratio>=1, chance: clamp((ratio-0.85)/0.3,0,1)};
}
function makeOffer(pid, cash, givePid){
  const p=P(pid), me=T(S.user);
  if(cash>me.budget) return {ok:false,msg:'预算不足'};
  if(!p.team){ // 自由球员
    signPlayer(pid,S.user,Math.round(p.salary*1.1),S.year+2); me.budget-=cash;
    addNews(`✍️ ${teamName(S.user)} 签下自由球员 ${p.pid}（${ROLE_CN[p.role]}）。`); return {ok:true,msg:`签约成功！${p.pid} 加盟。`};
  }
  const e=evaluateOffer(pid,cash,givePid);
  const accept = e.ratio>=1.05 || (e.ratio>=0.9 && rnd()<e.chance);
  if(!accept) return {ok:false,msg:`${teamName(p.team)} 拒绝了报价（对方心理价位约 ${fmtMoney(e.ask)}）。`};
  const seller=p.team;
  me.budget-=cash; T(seller).budget+=cash;
  signPlayer(pid,S.user,Math.max(p.salary,Math.round(fairSalary(p)*1.05)),S.year+2);
  if(givePid){ signPlayer(givePid,seller,P(givePid).salary,P(givePid).contract); }
  ensureRoster(seller);
  addNews(`🔁 转会：${p.pid} 从 ${teamName(seller)} 加盟 ${teamName(S.user)}${cash?`，转会费 ${fmtMoney(cash)}`:''}${givePid?`，${givePid} 反向加盟 ${teamName(seller)}`:''}。`);
  return {ok:true,msg:'交易达成！'};
}
function bidsFor(pid){
  const p=P(pid), v=playerValue(p);
  return Object.values(S.teams).filter(t=>t.key!==S.user && t.budget>v*0.8)
    .map(t=>{ const cur=P(t.lineup[p.role]); const need = cur? (p.rating-cur.rating) : 10; return {t:t.key, need, price: Math.round(v*(0.75+rnd()*0.35+Math.max(0,need)*0.02))}; })
    .filter(b=>b.need>-2 && b.price<=T(b.t).budget).sort((a,b)=>b.price-a.price).slice(0,3);
}
function sellPlayer(pid, buyer, price){
  const p=P(pid); const me=T(S.user);
  me.budget+=price; T(buyer).budget-=price;
  signPlayer(pid,buyer,p.salary,Math.max(p.contract,S.year+1)); autoLineup(buyer);
  addNews(`💸 ${teamName(S.user)} 将 ${pid} 以 ${fmtMoney(price)} 出售给 ${teamName(buyer)}。`);
}
function releasePlayer(pid){ const p=P(pid); const t=T(p.team); const pay=Math.round(p.salary*0.5); t.budget-=pay; t.roster=t.roster.filter(x=>x!==pid); for(const r of ROLES) if(t.lineup[r]===pid) delete t.lineup[r]; p.team=null; addNews(`📤 ${teamName(S.user)} 与 ${pid} 解约（支付违约金 ${fmtMoney(pay)}）。`); }
function aiTransfers(n){
  // AI 球队之间的转会
  const ts=Object.values(S.teams).filter(t=>t.key!==S.user);
  for(let i=0;i<n;i++){
    const buyer=pick(ts); const role=pick(ROLES); const cur=P(buyer.lineup[role]); if(!cur) continue;
    const cands=Object.values(S.players).filter(p=>p.role===role && p.team && p.team!==buyer.key && p.team!==S.user && p.rating>cur.rating+2 && askPrice(p)<buyer.budget*0.6);
    if(!cands.length) continue;
    const p=pick(cands.slice(0,40)); const price=askPrice(p); const from=p.team;
    buyer.budget-=price; T(from).budget+=price;
    signPlayer(p.pid,buyer.key,fairSalary(p),S.year+2);
    // 原首发转去对方 or 成为替补
    autoLineup(buyer.key); ensureRoster(from);
    addNews(`🔁 ${p.pid} 以 ${fmtMoney(price)} 从 ${teamName(from)} 转会至 ${teamName(buyer.key)}。`);
  }
}
// ================= 休赛期 / 新赛季 =================
function finishOffseason(){
  const y=S.year;
  // 合同到期：AI 自动续约(80%)；用户未续约的成为自由球员
  Object.values(S.players).forEach(p=>{ if(!p.team || p.contract>y) return;
    if(p.team===S.user){ if(!p.renewed){ const t=T(p.team); t.roster=t.roster.filter(x=>x!==p.pid); for(const r of ROLES) if(t.lineup[r]===p.pid) delete t.lineup[r]; p.team=null; addNews(`📤 ${p.pid} 合同到期离队，成为自由球员。`);} }
    else if(rnd()<0.8 || T(p.team).roster.length<=5){ p.contract=y+1+Math.floor(rnd()*2); p.salary=fairSalary(p); }
    else { const t=T(p.team); t.roster=t.roster.filter(x=>x!==p.pid); for(const r of ROLES) if(t.lineup[r]===p.pid) delete t.lineup[r]; p.team=null; }
    p.renewed=false; });
  // 退役
  Object.values(S.players).forEach(p=>{ if(!p.team && !p.retired && p.age>=29 && rnd()<0.5){ p.retired=true; } p.age++; });
  for(let i=0;i<20;i++) genRookie(y+1);
  Object.values(S.teams).forEach(t=>ensureRoster(t.key));
  aiTransfers(12);
  Object.values(S.teams).forEach(t=>{ if(t.key!==S.user) autoLineup(t.key); else { for(const r of ROLES) if(t.lineup[r] && P(t.lineup[r]).team!==t.key) delete t.lineup[r]; } });
  // 用户队伍保底
  ensureRoster(S.user);
  // 新赛季
  const s3=S.events.find(e=>e.type==='lpl_s3').res.final;
  const ranked=s3.slice(0,8).concat(S.lplOrder.filter(t=>!s3.slice(0,8).includes(t)).sort((a,b)=>(S.points[b]||0)-(S.points[a]||0)));
  S.history = S.history||[]; S.history.push({year:y, points:{...S.points}, lpl:S.events.filter(e=>/lpl_s/.test(e.type)).map(e=>e.res.champ), fst:S.events[1].res.champ, msi:S.events[4].res.champ, ewc:S.events[5].res.champ, worlds:S.events[9].res.champ});
  S.year=y+1; S.lplOrder=ranked;
  buildSeason();
  addNews(`🎆 ${S.year} 赛季开始！`);
}
function renewPlayer(pid){ const p=P(pid); const s=Math.round(fairSalary(p)*1.1); p.salary=s; p.contract=S.year+2; p.renewed=true; addNews(`✍️ ${teamName(S.user)} 与 ${pid} 续约两年，年薪 ${fmtMoney(s)}。`); return s; }
