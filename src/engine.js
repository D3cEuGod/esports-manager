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
const playerTag = p => p ? (p.tag || p.pid) : '—';

const AGE_FIX = {"Faker": 30, "Ruler": 28, "Chovy": 25, "Canyon": 25, "Kiin": 27, "Keria": 24, "Oner": 24, "Peyz": 21, "Doran": 26, "Zeus": 22, "Gumayusi": 24, "Kanavi": 26, "Zeka": 24, "ShowMaker": 26, "Viper": 26, "Bin": 23, "knight": 26, "XUN": 24, "ON": 23, "Flandre": 28, "Tarzan": 27, "Shanks": 25, "369": 25, "Tian": 26, "JackeyLove": 26, "Creme": 23, "TheShy": 26, "Rookie": 29, "Wei": 23, "Meiko": 28, "Xiaohu": 28, "Elk": 25, "Jiejie": 25, "GALA": 25, "Caps": 27, "BrokenBlade": 26, "Hans Sama": 27, "CoreJJ": 32, "Inspired": 24, "Berserker": 23, "Scout": 28, "Lehends": 28, "Bdd": 27, "Aiming": 26, "Cuzz": 27, "Pyosik": 26, "Teddy": 28, "Kingen": 26, "Lucid": 22, "Delight": 24, "Mikyx": 28, "Upset": 26, "Razork": 26, "Elyoya": 26, "Wunder": 28, "Blaber": 26, "Zven": 29, "Impact": 31, "Missing": 25, "Kael": 24, "Hope": 24, "Rich": 29, "Clozer": 23, "deokdam": 26, "Fisher": 22, "Duro": 24, "Kellin": 25, "Clear": 24, "Raptor": 22, "BuLLDoG": 22, "Croco": 26, "Breathe": 24, "Leave": 25, "Assum": 26, "Carzzy": 24, "Labrov": 24, "Canna": 26, "Busio": 22, "Jojopyun": 21, "Josedeodo": 26}; // 部分知名选手2026年龄（按出生年估算）
let S = null; // 全局存档状态

// ================= 存档向下兼容迁移 =================
function migrateSave(s){
  if(!s || typeof s!=='object') return s;
  s.ver = 2;
  s.meta = s.meta || {};
  for(const k of CHAMP_KEYS){
    if(s.meta[k]==null){ const x=rnd(); s.meta[k] = x<0.08?2 : x<0.25?1 : x<0.8?0 : -1; }
  }
  s.log = s.log || {};
  s.news = s.news || [];
  s.honors = s.honors || [];
  s.history = s.history || [];
  if(s.players){
    Object.values(s.players).forEach(p=>{
      if(!p.tag) p.tag = p.pid;
      if(typeof p.form!=='number' || isNaN(p.form)) p.form = 0;
      if(!Array.isArray(p.champs)) p.champs = [];
      p.champs = p.champs.filter(x=>x && CH[x.c]);
      if(!p.champs.length) genChampPool(p, srand(hash(p.pid)));
    });
  }
  return s;
}

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
  S = { ver:2, year:2026, user:userTeam, teams:{}, players:{}, events:[], evIdx:0,
        news:[], honors:[], history:[], points:{}, rr:{}, meta:{}, patchNo:1, uid:1, lplOrder:null,
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
        const baseId = String(p.id).trim();
        let pid = baseId;
        if(S.players[pid]){
          // 同名不同选手：附带队伍后缀保留，避免静默吞掉
          if(S.players[pid].team === key) continue;
          pid = baseId + '_' + key;
          let n = 2; while(S.players[pid]) pid = baseId + '_' + key + (n++);
        }
        const r = srand(hash(pid));
        const age = AGE_FIX[baseId] || p.age || (18 + Math.floor(r()*9));
        const pl = { pid, tag:baseId, name:p.name||baseId, role:p.role, nat:p.nat||(reg==='LPL'?'CN':reg==='LCK'?'KR':'--'),
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
  const sorted = pool.map(k=>[k, (CH[k].roles[0]===pl.role?0.35:0)+r()]).sort((a,b)=>b[1]-a[1]).slice(0,6);
  pl.champs = sorted.map(([c],i)=>({c, p: i<2?5:i<4?3:2}));
}
const RK_A=['Shy','Lin','Kai','Ming','Zero','Neo','Hao','Yun','Feng','Bai','Leo','Qing','Ace','Mist','Ray','Tian','Sky','Jin','Rin','Sol','Xia','Lan','Mo','Chen','Yu','Nova','Rex','Hex','Ark','Vex'];
const RK_B=['','x','o','7','in','er','yu','ze','ki','an','99','ly','Q','zz','ra'];
function genRookie(year, forceRole, forceNat){
  let id; do{ id = pick(RK_A)+pick(RK_B); } while(S.players[id]);
  const role = forceRole || pick(ROLES); const age = 17+Math.floor(rnd()*3);
  const rating = Math.round(56+rnd()*12);
  const nat = forceNat || pick(['CN','CN','CN','KR']);
  const pl = { pid:id, tag:id, name:id+'（虚构新秀）', role, nat, age, rating, team:null, form:0, champs:[], rookie:true,
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

// ================= 阵容与外援规则 =================
function isForeign(p){ return !p ? false : !['CN','TW','HK','MO'].includes(p.nat); }
function maxForeignFor(region){ return region==='LPL' ? 2 : 99; }
function effRating(p, role){ return p ? p.rating + (p.form||0) - (p.role!==role?8:0) : 45; }

function autoLineup(key){
  const t=T(key); if(!t) return;
  const maxF = maxForeignFor(t.region);
  const roster = t.roster.map(P).filter(Boolean);
  if(roster.length===0){ t.lineup={}; return; }
  if(maxF < 5){
    // 针对有外援限制的赛区（LPL）：为每个位置取候选并搜出合规的最强5人
    const cands = ROLES.map(r=>{
      const onRole = roster.filter(p=>p.role===r).sort((a,b)=>effRating(b,r)-effRating(a,r));
      const others = roster.filter(p=>p.role!==r).sort((a,b)=>effRating(b,r)-effRating(a,r));
      const list = [];
      // 保留前2本土 + 前2外援，保证既能冲战力也能凑合规阵容
      const addTop = (arr, limit) => { for(const p of arr){ if(list.length>=limit) break; if(!list.includes(p)) list.push(p); } };
      addTop(onRole.filter(p=>!isForeign(p)), 2);
      addTop(onRole.filter(isForeign), 4);
      addTop(others.filter(p=>!isForeign(p)), 6);
      addTop(others, 7);
      return list.length ? list : [null];
    });
    let best=null, bestScore=-1e9, minF=99;
    const used = new Set();
    const cur = new Array(5);
    function dfs(idx, fCount, score){
      if(idx===5){
        const valid = fCount<=maxF;
        const bestValid = minF<=maxF;
        if((valid && !bestValid) || (valid===bestValid && (valid ? score>bestScore : (fCount<minF || (fCount===minF && score>bestScore))))){
          minF=fCount; bestScore=score; best=cur.slice();
        }
        return;
      }
      for(const p of cands[idx]){
        if(p && used.has(p.pid)) continue;
        if(p) used.add(p.pid);
        cur[idx]=p;
        dfs(idx+1, fCount+(p&&isForeign(p)?1:0), score+effRating(p, ROLES[idx]));
        if(p) used.delete(p.pid);
      }
    }
    dfs(0,0,0);
    t.lineup={};
    if(best) ROLES.forEach((r,i)=>{ if(best[i]) t.lineup[r]=best[i].pid; });
    return;
  }
  t.lineup={};
  for(const r of ROLES){
    const c = roster.filter(p=>p.role===r).sort((a,b)=>effRating(b,r)-effRating(a,r))[0];
    if(c) t.lineup[r]=c.pid;
  }
  for(const r of ROLES) if(!t.lineup[r]){
    const used=new Set(Object.values(t.lineup));
    const c=roster.filter(p=>!used.has(p.pid)).sort((a,b)=>effRating(b,r)-effRating(a,r))[0];
    if(c) t.lineup[r]=c.pid;
  }
}
function starters(key){ const t=T(key); return t ? ROLES.map(r=>P(t.lineup[r])).filter(Boolean) : []; }
function teamOvr(key){
  const t=T(key); if(!t) return 45;
  let s=0;
  for(const r of ROLES){ s += effRating(P(t.lineup[r]), r); }
  return s/5;
}
function lineupProblems(key){
  const t=T(key), probs=[];
  if(!t) return probs;
  for(const r of ROLES) if(!t.lineup[r]) probs.push(`缺少${ROLE_CN[r]}首发`);
  const maxF = maxForeignFor(t.region);
  if(maxF < 5){
    const f = starters(key).filter(isForeign).length;
    if(f>maxF) probs.push(`首发外援${f}人，超过${t.region}上限${maxF}人`);
  }
  return probs;
}
function ensureRoster(key){
  // AI球队缺位或外援无法凑齐合规阵容时签自由球员
  const t=T(key); if(!t) return;
  const maxF = maxForeignFor(t.region);
  const curForeignCount = () => t.roster.map(P).filter(isForeign).length;
  const needDomestic = () => maxF < 5 && (t.roster.map(P).filter(p=>p&&!isForeign(p)).length < 3 || curForeignCount() >= maxF);
  for(const r of ROLES){
    if(t.roster.some(id=>P(id)&&P(id).role===r)) continue;
    let pool = freeAgents().filter(p=>p.role===r);
    if(needDomestic()){
      const dom = pool.filter(p=>!isForeign(p));
      if(dom.length) pool = dom;
    }
    let fa = pool.sort((a,b)=>b.rating-a.rating)[0];
    if(!fa){ fa=genRookie(S.year, r, needDomestic()?'CN':null); }
    signPlayer(fa.pid, key, fa.salary, S.year+1);
  }
  // LPL 额外检查：若本土人数不足 3 人，补签本土自由人避免无法合规首发
  if(maxF < 5 && key !== S.user){
    while(t.roster.map(P).filter(p=>p&&!isForeign(p)).length < 3){
      const missingRole = ROLES.find(r=>!t.roster.some(id=>P(id)&&P(id).role===r&&!isForeign(P(id)))) || pick(ROLES);
      let fa = freeAgents().filter(p=>!isForeign(p) && p.role===missingRole).sort((a,b)=>b.rating-a.rating)[0]
            || freeAgents().filter(p=>!isForeign(p)).sort((a,b)=>b.rating-a.rating)[0]
            || genRookie(S.year, missingRole, 'CN');
      signPlayer(fa.pid, key, fa.salary, S.year+1);
    }
  }
  if(key!==S.user) autoLineup(key);
}
function freeAgents(){ return Object.values(S.players).filter(p=>!p.team && !p.retired); }
function signPlayer(pid,key,salary,contract){
  const p=P(pid); if(!p) return;
  if(p.team){ const o=T(p.team); if(o){ o.roster=o.roster.filter(x=>x!==pid); for(const r of ROLES) if(o.lineup[r]===pid) delete o.lineup[r]; } }
  p.team=key; p.salary=salary; p.contract=contract; p.rookie=false;
  if(!T(key).roster.includes(pid)) T(key).roster.push(pid);
}

// ================= BP / 阵容分析 / 比赛模拟 =================
function champFit(p, c, assignedRole){
  if(!p || !c || !CH[c]) return -6;
  const e=p.champs.find(x=>x.c===c);
  let f = e? e.p : -1.5;
  f += (S.meta[c]||0)*0.95;
  const r = assignedRole || p.role;
  if(!CH[c].roles.includes(r)) f -= 4.5;
  if(p.role !== r) f -= 2.0;
  return f;
}
function compInfo(champs){
  const list = champs.filter(c=>c && CH[c]);
  const tags={}; let ad=0,ap=0;
  list.forEach(c=>{ CH[c].tags.forEach(t=>tags[t]=(tags[t]||0)+1); if(CH[c].dmg==='AD')ad++; else if(CH[c].dmg==='AP')ap++; else {ad+=.5;ap+=.5;} });
  let score=0, notes=[];
  if((tags.engage||0)>=2){score+=1.3; notes.push('开团充足');}
  if((tags.engage||0)===0 && list.length===5){score-=1.2; notes.push('缺乏开团');}
  if((tags.scale||0)>=2 && (tags.protect||0)>=1){score+=1.3; notes.push('保后期');}
  if((tags.poke||0)>=3){score+=1.1; notes.push('消耗阵');}
  if((tags.early||0)>=3){score+=1.1; notes.push('前期压制');}
  if((tags.pick||0)>=3){score+=0.9; notes.push('抓单阵');}
  if((tags.split||0)>=2){score+=0.5; notes.push('边带分推');}
  if(list.length===5 && (ad>=4.5||ap>=4.5)){score-=1.6; notes.push(ad>=4.5?'纯AD易出护甲':'纯AP易出魔抗');}
  else if(list.length===5 && ad>=1.5 && ap>=1.5){score+=0.4; notes.push('伤害均衡');}
  const style = ['engage','poke','scale','pick','early'].sort((a,b)=>(tags[b]||0)-(tags[a]||0))[0];
  // 三阶段曲线分（供分阶段模拟与情报面板使用）
  const early = (tags.early||0)*1.15 + (tags.pick||0)*0.45 - (tags.scale||0)*0.35;
  const mid   = (tags.engage||0)*0.75 + (tags.poke||0)*0.7 + (tags.pick||0)*0.6 + (tags.split||0)*0.45;
  const late  = (tags.scale||0)*1.25 + (tags.protect||0)*0.85 + (tags.engage||0)*0.35 - (tags.early||0)*0.25;
  return {score, notes, style, tags, ad, ap, early, mid, late};
}
const STYLE_CN={engage:'开团',poke:'消耗',scale:'后期',pick:'抓单',early:'前期'};
// 克制：开团>消耗>后期>开团；前期>后期；抓单>消耗
function styleEdge(a,b){
  const beats={engage:['poke'],poke:['scale','pick'],scale:['engage'],early:['scale'],pick:['poke']};
  if((beats[a]||[]).includes(b)) return 0.9;
  if((beats[b]||[]).includes(a)) return -0.9;
  return 0;
}

// 2026 先手选择权 AI 决策
function aiFirstDecision(meKey, oppKey, locked){
  const un = new Set(locked||[]);
  const t0Left = CHAMP_KEYS.filter(c=>!un.has(c) && (S.meta[c]||0)>=2);
  const lu = lineupMap(meKey);
  let t0Fit = 0;
  for(const c of t0Left){
    for(const r of ROLES){ if(CH[c].roles.includes(r) && champFit(lu[r],c,r)>=4.5){ t0Fit++; break; } }
  }
  // 剩余 T0 且我方绝活多 -> 更偏向抢 BP 先手；否则有一定概率直接抢蓝色方
  const pFirst = clamp(0.42 + t0Fit*0.09, 0.35, 0.78);
  return rnd() < pFirst ? {kind:'first', value:'first'} : {kind:'side', value:'blue'};
}
function aiSecondDecision(meKey, oppKey, oppKind, locked){
  // 对手选了蓝/红方 -> 我选 BP 先手或后手
  if(oppKind==='side'){
    const un = new Set(locked||[]);
    const t0Left = CHAMP_KEYS.filter(c=>!un.has(c) && (S.meta[c]||0)>=2).length;
    return rnd() < (t0Left>=3 ? 0.8 : 0.65) ? 'first' : 'second';
  }
  // 对手选了 BP 先后手 -> 我选蓝/红方（蓝色方有小幅胜率优势，85% 选蓝）
  return rnd() < 0.85 ? 'blue' : 'red';
}

// draft: {A,B (team keys), first:'A'|'B', blue:'A'|'B', locked:[], bans:{A:[],B:[]}, picks:{A:{role:champ},B:{}}, pickOrder:{A:[],B:[]}, step}
const DRAFT_SEQ = [ // F=先选方 S=后选方
  ['ban','F'],['ban','S'],['ban','F'],['ban','S'],['ban','F'],['ban','S'],
  ['pick','F'],['pick','S'],['pick','S'],['pick','F'],['pick','F'],['pick','S'],
  ['ban','S'],['ban','F'],['ban','S'],['ban','F'],
  ['pick','S'],['pick','F'],['pick','F'],['pick','S']];
function newDraft(A,B,first,blue,locked){
  return {A,B,first,blue,locked:(locked||[]).slice(),bans:{A:[],B:[]},picks:{A:{},B:{}},pickOrder:{A:[],B:[]},step:0};
}
function draftSide(d){ if(!d || d.step>=DRAFT_SEQ.length) return null; const [kind,w]=DRAFT_SEQ[d.step]; const side = w==='F'? d.first : (d.first==='A'?'B':'A'); return {kind,side}; }
function unavailable(d){ const u=new Set(d.locked); ['A','B'].forEach(s=>{ d.bans[s].forEach(c=>u.add(c)); Object.values(d.picks[s]).forEach(c=>u.add(c)); }); return u; }
function lineupMap(key){ const t=T(key), m={}; if(t) ROLES.forEach(r=>m[r]=P(t.lineup[r])); return m; }

function openRolesFor(d, side){ return ROLES.filter(r=>!d.picks[side][r]); }
function hasAnyOnRoleChamp(d, side){
  const un = unavailable(d);
  const open = openRolesFor(d, side);
  return CHAMP_KEYS.some(c=>!un.has(c) && open.some(r=>CH[c].roles.includes(r)));
}
function bestRoleFor(d, side, c, allowOffrole){
  const team=d[side], lu=lineupMap(team);
  const openOn=ROLES.filter(r=>!d.picks[side][r] && CH[c].roles.includes(r));
  if(openOn.length) return openOn.sort((a,b)=>champFit(lu[b],c,b)-champFit(lu[a],c,a))[0];
  if(!allowOffrole) return null;
  const openAny = openRolesFor(d, side);
  if(!openAny.length) return null;
  return openAny.sort((a,b)=>champFit(lu[b],c,b)-champFit(lu[a],c,a))[0];
}
function canPickChamp(d, side, c){
  const un = unavailable(d);
  if(un.has(c)) return {ok:false, offrole:false, openRoles:[]};
  const open = openRolesFor(d, side);
  if(!open.length) return {ok:false, offrole:false, openRoles:[]};
  const onRole = open.filter(r=>CH[c].roles.includes(r));
  if(onRole.length) return {ok:true, offrole:false, openRoles:onRole};
  // 无畏征召第5局极端兜底：当剩余英雄中已没有任何符合空缺位置的英雄时，允许跨位强选
  if(!hasAnyOnRoleChamp(d, side)) return {ok:true, offrole:true, openRoles:open};
  return {ok:false, offrole:false, openRoles:[]};
}

// 摇摆位互换（允许同队任意两位置互换，包括将已选英雄挪到空位）
function swapDraftRoles(d, side, r1, r2){
  if(!d || !ROLES.includes(r1) || !ROLES.includes(r2) || r1===r2) return false;
  const c1 = d.picks[side][r1], c2 = d.picks[side][r2];
  if(!c1 && !c2) return false;
  if(c2) d.picks[side][r1] = c2; else delete d.picks[side][r1];
  if(c1) d.picks[side][r2] = c1; else delete d.picks[side][r2];
  return true;
}

// AI 摇摆优化：寻找让已选英雄分配给最合适位置的排列
function optimizeAiFlex(d, side){
  const entries = Object.entries(d.picks[side]).filter(([,c])=>c);
  if(entries.length < 2) return;
  const lu = lineupMap(d[side]);
  const champs = entries.map(([,c])=>c);
  const roles = entries.map(([r])=>r);
  const curScore = entries.reduce((s,[r,c])=>s+champFit(lu[r],c,r), 0);
  let bestPerm = null, bestScore = curScore + 0.35;
  function permute(arr, start){
    if(start===arr.length){
      let sc = 0;
      for(let i=0;i<arr.length;i++){
        if(!CH[arr[i]].roles.includes(roles[i])) sc -= 3;
        sc += champFit(lu[roles[i]], arr[i], roles[i]);
      }
      if(sc > bestScore){ bestScore = sc; bestPerm = arr.slice(); }
      return;
    }
    for(let i=start;i<arr.length;i++){
      [arr[start],arr[i]]=[arr[i],arr[start]];
      permute(arr, start+1);
      [arr[start],arr[i]]=[arr[i],arr[start]];
    }
  }
  permute(champs.slice(), 0);
  if(bestPerm){
    roles.forEach((r,i)=>{ d.picks[side][r] = bestPerm[i]; });
  }
}

function draftAct(d, c, role, allowOffrole){
  const cur=draftSide(d); if(!cur || !c || !CH[c]) return false;
  if(unavailable(d).has(c)) return false;
  if(cur.kind==='ban'){
    d.bans[cur.side].push(c);
  } else {
    const chk = canPickChamp(d, cur.side, c);
    const offOk = allowOffrole || chk.offrole;
    if(role && d.picks[cur.side][role]) role = null;
    if(role && !CH[c].roles.includes(role) && !offOk) role = null;
    role = role || bestRoleFor(d, cur.side, c, offOk);
    if(!role) return false;
    d.picks[cur.side][role]=c;
    if(d.pickOrder) d.pickOrder[cur.side].push({r:role, c, step:d.step});
  }
  d.step++; return true;
}

function aiChoose(d){
  const cur=draftSide(d); if(!cur) return {c:null};
  const un=unavailable(d);
  const me=cur.side, opp= me==='A'?'B':'A';
  const myLu=lineupMap(d[me]), oppLu=lineupMap(d[opp]);
  const myPicks=Object.values(d.picks[me]).filter(Boolean);
  const oppPicks=Object.values(d.picks[opp]).filter(Boolean);
  let best=null, bs=-1e9;

  if(cur.kind==='ban'){
    const oppOpen = openRolesFor(d, opp);
    const myOpen = openRolesFor(d, me);
    const oppComp = compInfo(oppPicks);
    const isRound2 = d.step >= 12;
    // 判断下一手是否由我方先选（首轮 Ban 尽量少 Ban 自己下一手就能抢的绝活 T0）
    const nextIsMyPick = d.step===5 && d.first===me;
    for(const c of CHAMP_KEYS){
      if(un.has(c)) continue;
      const validOppRoles = oppOpen.filter(r=>CH[c].roles.includes(r));
      if(!validOppRoles.length) continue;
      let s = Math.max(...validOppRoles.map(r=>champFit(oppLu[r],c,r))) * 1.15;
      if((S.meta[c]||0)>=2) s += 2.2;
      else if((S.meta[c]||0)>=1) s += 0.8;
      // 二轮针对：看是否极大增强对手已有体系
      if(isRound2 && oppPicks.length>=3){
        const gain = compInfo(oppPicks.concat(c)).score - oppComp.score;
        s += Math.max(0, gain) * 1.1;
      }
      // 避免把己方立刻能抢到的强势招牌给 Ban 了
      if(nextIsMyPick){
        const myMatch = myOpen.filter(r=>CH[c].roles.includes(r));
        if(myMatch.length && Math.max(...myMatch.map(r=>champFit(myLu[r],c,r)))>=5) s -= 2.5;
      }
      s += rnd()*1.35;
      if(s>bs){ bs=s; best=c; }
    }
    if(!best) best = CHAMP_KEYS.find(c=>!un.has(c));
    return {c:best};
  }

  // Pick 阶段
  const baseComp = compInfo(myPicks);
  const oppComp = compInfo(oppPicks);
  const myOpen = openRolesFor(d, me);
  const earlyPhase = myPicks.length < 3;
  let br=null;
  const allowOff = !hasAnyOnRoleChamp(d, me);

  for(const c of CHAMP_KEYS){
    if(un.has(c)) continue;
    const candRoles = allowOff ? myOpen : myOpen.filter(r=>CH[c].roles.includes(r));
    for(const r of candRoles){
      const nextList = myPicks.concat(c);
      const nextComp = compInfo(nextList);
      let s = champFit(myLu[r], c, r);
      s += (nextComp.score - baseComp.score) * 1.15;
      // 克制对手已亮阵容风格
      if(oppPicks.length>=2){
        s += (styleEdge(nextComp.style, oppComp.style) - styleEdge(baseComp.style, oppComp.style)) * 0.9;
      }
      // 伤害平衡：第 4/5 手如果伤害严重失衡，强力倾向补另一类型伤害
      if(myPicks.length>=3){
        if(baseComp.ad>=3 && CH[c].dmg==='AP') s += 1.4;
        if(baseComp.ap>=3 && CH[c].dmg==='AD') s += 1.4;
      }
      // 前三手摇摆位伪装加分
      if(earlyPhase && CH[c].roles.length>=2) s += 0.55;
      // 版本 T0 优先级
      if((S.meta[c]||0)>=2) s += 1.1;
      s += rnd()*1.25;
      if(s>bs){ bs=s; best=c; br=r; }
    }
  }
  return {c:best, role:br, offrole:allowOff};
}

function autoDraftRest(d){
  let guard=0;
  while(draftSide(d) && guard++<30){
    const cur=draftSide(d);
    const ch=aiChoose(d);
    if(!ch.c) break;
    if(!draftAct(d,ch.c,ch.role,ch.offrole)) break;
    if(cur.kind==='pick') optimizeAiFlex(d, cur.side);
  }
}

// 教练组推荐（给玩家的实时 BP 建议）
function coachSuggest(d, side){
  const cur = draftSide(d);
  if(!cur || cur.side!==side) return [];
  const un = unavailable(d);
  const opp = side==='A'?'B':'A';
  const myLu = lineupMap(d[side]), oppLu = lineupMap(d[opp]);
  const oppOpen = openRolesFor(d, opp), myOpen = openRolesFor(d, side);
  const myPicks = Object.values(d.picks[side]).filter(Boolean);
  const baseComp = compInfo(myPicks);
  const out = [];

  if(cur.kind==='ban'){
    for(const c of CHAMP_KEYS){
      if(un.has(c)) continue;
      const roles = oppOpen.filter(r=>CH[c].roles.includes(r));
      if(!roles.length) continue;
      let bestR = roles[0], bestF = -99;
      for(const r of roles){ const f=champFit(oppLu[r],c,r); if(f>bestF){bestF=f;bestR=r;} }
      let s = bestF*1.1 + ((S.meta[c]||0)>=2?2.2:0);
      let reason = bestF>=5.5 ? `针对 ${playerTag(oppLu[bestR])} 招牌` : (S.meta[c]||0)>=2 ? '版本T0威胁' : `限制对方${ROLE_CN[bestR]}`;
      out.push({c, score:s, reason});
    }
  } else {
    const allowOff = !hasAnyOnRoleChamp(d, side);
    for(const c of CHAMP_KEYS){
      if(un.has(c)) continue;
      const roles = allowOff ? myOpen : myOpen.filter(r=>CH[c].roles.includes(r));
      if(!roles.length) continue;
      let bestR = roles[0], bestS = -99, bestReason = '';
      for(const r of roles){
        const fit = champFit(myLu[r],c,r);
        const nextComp = compInfo(myPicks.concat(c));
        const compGain = nextComp.score - baseComp.score;
        let s = fit + compGain*1.1 + ((S.meta[c]||0)>=2?1.0:0);
        if(myPicks.length>=3 && baseComp.ad>=3 && CH[c].dmg==='AP') s+=1.2;
        if(myPicks.length>=3 && baseComp.ap>=3 && CH[c].dmg==='AD') s+=1.2;
        if(s > bestS){
          bestS = s; bestR = r;
          bestReason = fit>=5.5 ? `${playerTag(myLu[r])} 招牌` : (S.meta[c]||0)>=2 ? '版本T0强抢' : compGain>=0.8 ? '极佳阵容搭配' : (CH[c].roles.length>=2&&myPicks.length<3?'优质摇摆位':`适配${ROLE_CN[r]}`);
        }
      }
      out.push({c, role:bestR, score:bestS, reason:bestReason});
    }
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,3);
}

function draftPower(d, side){
  const team=d[side], lu=lineupMap(team), picks=d.picks[side];
  let s=0, det=[];
  let earlyP=0, midP=0, lateP=0;
  for(const r of ROLES){
    const p=lu[r], c=picks[r];
    const base = effRating(p, r);
    const fit = c? champFit(p,c,r) : 0;
    const total = base + fit*0.85;
    s += total;
    // 位置对前中后期权重差异：野/辅偏前期，中/上偏中期，AD/中偏后期
    earlyP += total * ({TOP:.20,JUG:.28,MID:.20,ADC:.14,SUP:.18}[r]);
    midP   += total * ({TOP:.22,JUG:.22,MID:.24,ADC:.18,SUP:.14}[r]);
    lateP  += total * ({TOP:.18,JUG:.14,MID:.24,ADC:.30,SUP:.14}[r]);
    det.push({r,p,c,fit,base});
  }
  const ci = compInfo(Object.values(picks).filter(Boolean));
  return {
    power: s/5 + ci.score,
    early: earlyP + ci.early*1.1,
    mid:   midP   + ci.mid*1.0 + ci.score*0.6,
    late:  lateP  + ci.late*1.15 + ci.score*0.7,
    comp: ci, det
  };
}

function evalDraft(d){
  const a=draftPower(d,'A'), b=draftPower(d,'B');
  const se = styleEdge(a.comp.style, b.comp.style);
  const blueEdge = d.blue==='A' ? 0.35 : -0.35;
  // 与分阶段模拟严格一致的综合优势指标（1分差≈+4.8%胜率，保留职业赛场合理爆冷空间）
  const earlyDiff = (a.early - b.early) + blueEdge*0.6;
  const midDiff   = (a.mid   - b.mid)   + se*0.6 + blueEdge*0.4;
  const lateDiff  = (a.late  - b.late)  + se*0.8;
  const diff = earlyDiff*0.30 + midDiff*0.35 + lateDiff*0.35;
  return {a, b, se, blueEdge, earlyDiff, midDiff, lateDiff, diff, pA: sigmoid(diff/5.2)};
}

// 严格按权重将整数 total 分配为 weights.length 个非负整数（保证总和 === total）
function distributeInt(total, weights){
  const n = weights.length;
  const res = new Array(n).fill(0);
  if(total <= 0) return res;
  const clean = weights.map(w=>Math.max(0.05, w));
  const sumW = clean.reduce((a,b)=>a+b, 0);
  for(let i=0;i<total;i++){
    let r = rnd()*sumW, acc = 0, chosen = n-1;
    for(let j=0;j<n;j++){ acc+=clean[j]; if(r<=acc){ chosen=j; break; } }
    res[chosen]++;
  }
  return res;
}

function fmtClock(minFloat){
  const sec = Math.max(60, Math.round(minFloat*60));
  const m = Math.floor(sec/60), s = sec%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function playGame(d){
  const ev = evalDraft(d);
  const luA = lineupMap(d.A), luB = lineupMap(d.B);
  const nameOf = (side, r) => {
    const lu = side==='A'?luA:luB;
    const c = d.picks[side][r];
    return `${playerTag(lu[r])}（${c&&CH[c]?CH[c].cn:r}）`;
  };
  const tName = side => teamName(d[side]);
  const events = [];

  // ---- 阶段 1：对线期与前期节奏（0~14分钟） ----
  const earlyRoll = ev.earlyDiff + randn()*5.2;
  const fbSide = rnd() < sigmoid(earlyRoll/4.6) ? 'A' : 'B';
  const fbOpp = fbSide==='A' ? 'B' : 'A';
  const fbRole = pick(['JUG','MID','ADC','TOP']);
  const fbAssist = pick(ROLES.filter(r=>r!==fbRole));
  const fbVictim = fbRole==='JUG' ? pick(['TOP','MID','ADC']) : fbRole;
  events.push({
    t: fmtClock(3.5 + rnd()*4.5), side: fbSide, tag:'一血',
    text: `${nameOf(fbSide, fbRole)} 配合 ${nameOf(fbSide, fbAssist)} 击杀 ${nameOf(fbOpp, fbVictim)}，${tName(fbSide)} 拿下一血！`
  });

  const grubSide = rnd() < sigmoid(earlyRoll/4.5) ? 'A' : 'B';
  const g14 = clamp((earlyRoll * 0.36) + (fbSide==='A'?0.45:-0.45) + (grubSide==='A'?0.35:-0.35) + randn()*0.85, -6.5, 6.5);
  events.push({
    t: fmtClock(9.5 + rnd()*4.0), side: grubSide, tag:'前期资源',
    text: `${tName(grubSide)} 控下峡谷巢虫与先锋节奏，14分钟${Math.abs(g14)<0.8 ? '双方经济基本持平' : `${tName(g14>0?'A':'B')} 领先 ${Math.abs(g14).toFixed(1)}k 经济`}。`
  });

  // ---- 阶段 2：中期小龙与转线团战（14~24分钟） ----
  const midRoll = ev.midDiff + g14*0.45 + randn()*5.4;
  const midWin = midRoll >= 0 ? 'A' : 'B';
  const midStar = pick(['JUG','MID','SUP','TOP']);
  let dragA = 0, dragB = 0;
  for(let i=0;i<3;i++){
    if(rnd() < sigmoid((midRoll*0.7 + earlyRoll*0.3)/5.0)) dragA++; else dragB++;
  }
  const g24 = clamp(g14*0.66 + midRoll*0.42 + randn()*1.1, -10.5, 10.5);
  events.push({
    t: fmtClock(16.5 + rnd()*4.5), side: midWin, tag:'中期团战',
    text: `小龙河道爆发关键团战，${nameOf(midWin, midStar)} 进场撕开阵型，${tName(midWin)} 打出优势并推进外塔！`
  });

  // ---- 阶段 3：后期大龙/龙魂与决胜（24分钟~结束） ----
  const stomp = Math.abs(g24) >= 5.8 && rnd() < 0.45;
  let winA, dur, baronA=0, baronB=0, goldDiff;
  if(stomp){
    winA = g24 > 0;
    const wSide = winA ? 'A' : 'B';
    dur = Math.round(23 + rnd()*5);
    if(winA){ baronA = 1; if(dragA<3) dragA++; } else { baronB = 1; if(dragB<3) dragB++; }
    goldDiff = (winA?1:-1) * Math.round((Math.abs(g24) + 2.5 + rnd()*3.5)*10)/10;
    events.push({
      t: fmtClock(dur - 2.5), side: wSide, tag:'滚雪球终结',
      text: `${tName(wSide)} 凭借巨大经济差控下大龙，中路抱团一波平推高地，${dur} 分钟速胜！`
    });
  } else {
    const lateRoll = ev.lateDiff*0.42 + g24*0.52 + ev.diff*0.32 + randn()*8.2;
    winA = lateRoll >= 0;
    const wSide = winA ? 'A' : 'B';
    const lSide = winA ? 'B' : 'A';
    const carryRole = pick(['ADC','MID','TOP']);
    dur = Math.round(29 + rnd()*11 + (Math.abs(ev.diff)<1.8 ? 3 : 0));
    if(winA){
      baronA = 1 + (dur>=36 && rnd()<0.55 ? 1 : 0);
      baronB = dur>=34 && rnd()<0.35 ? 1 : 0;
      dragA = Math.min(4, dragA + (rnd()<0.75?1:0) + (dur>=35?1:0));
      dragB = Math.min(3, dragB + (rnd()<0.35?1:0));
    } else {
      baronB = 1 + (dur>=36 && rnd()<0.55 ? 1 : 0);
      baronA = dur>=34 && rnd()<0.35 ? 1 : 0;
      dragB = Math.min(4, dragB + (rnd()<0.75?1:0) + (dur>=35?1:0));
      dragA = Math.min(3, dragA + (rnd()<0.35?1:0));
    }
    const comeback = (winA && g24 < -2.0) || (!winA && g24 > 2.0);
    events.push({
      t: fmtClock(dur - 4.5), side: wSide, tag: comeback ? '绝境翻盘' : '大龙决胜',
      text: comeback
        ? `${tName(lSide)} 推进失误，${nameOf(wSide, carryRole)} 团战输出拉满完成团灭，${tName(wSide)} 抢下大龙逆转局势！`
        : `${tName(wSide)} 拿下关键大龙并掌控视野，${nameOf(wSide, carryRole)} 接管团战锁定胜局！`
    });
    events.push({
      t: fmtClock(dur - 0.5), side: wSide, tag:'推平水晶',
      text: `${tName(wSide)} 携兵线攻破敌方主水晶，结束本局较量。`
    });
    goldDiff = (winA?1:-1) * Math.round((2.4 + Math.max(0, (winA?g24:-g24)*0.45) + rnd()*4.8)*10)/10;
  }

  // 防御塔统计
  const turW = 8 + Math.floor(rnd()*4); // 8~11
  const turL = clamp(Math.floor(rnd()*5) + (dur>=34?2:0) - (stomp?2:0), 0, 7);
  const turA = winA ? turW : turL, turB = winA ? turL : turW;

  // ---- 严格对账的 K/D/A 分配 ----
  const tempo = ((ev.a.comp.tags.early||0)+(ev.b.comp.tags.early||0)+(ev.a.comp.tags.pick||0)+(ev.b.comp.tags.pick||0))*0.7;
  const wk = clamp(Math.round(11 + tempo + (dur-25)*0.22 + rnd()*9), 8, 32);
  const lk = clamp(Math.round(wk*(stomp ? (0.2+rnd()*0.28) : (0.38+rnd()*0.44))), 2, Math.max(3, wk-1));
  const kA = winA ? wk : lk, kB = winA ? lk : wk;

  function buildStats(side, teamKills, teamDeaths){
    const lu = side==='A'?luA:luB;
    const isWin = (side==='A')===winA;
    const kBaseW = {TOP:0.17, JUG:0.20, MID:0.26, ADC:0.31, SUP:0.06};
    const dBaseW = {TOP:0.20, JUG:0.22, MID:0.18, ADC:0.16, SUP:0.24};
    const aProb  = {TOP:0.46, JUG:0.64, MID:0.54, ADC:0.48, SUP:0.78};

    const kWeights = ROLES.map(r=>{
      const p=lu[r], c=d.picks[side][r];
      const skill = p ? clamp((p.rating-65)/25, -0.3, 0.7) : 0;
      const fit = c ? clamp(champFit(p,c,r)/15, -0.25, 0.35) : 0;
      return kBaseW[r] * (1 + skill*0.35 + fit*0.3 + rnd()*0.55);
    });
    const dWeights = ROLES.map(r=>{
      const p=lu[r];
      const skill = p ? clamp((82-p.rating)/30, -0.25, 0.45) : 0.2;
      return dBaseW[r] * (1 + skill*0.3 + rnd()*0.55);
    });

    const ks = distributeInt(teamKills, kWeights);
    const ds = distributeInt(teamDeaths, dWeights);
    const as = new Array(5).fill(0);
    // 按每次击杀独立分配队友助攻，严格保证 a_i <= teamKills - k_i
    for(let i=0;i<5;i++){
      for(let n=0;n<ks[i];n++){
        for(let j=0;j<5;j++){
          if(j===i) continue;
          const prob = aProb[ROLES[j]] * (isWin ? 1.0 : 0.88);
          if(rnd() < prob) as[j]++;
        }
      }
    }
    return ROLES.map((r,i)=>({
      pid: lu[r]&&lu[r].pid,
      tag: playerTag(lu[r]),
      r, c: d.picks[side][r],
      k: ks[i], d: ds[i], a: as[i]
    }));
  }

  const sa = buildStats('A', kA, kB);
  const sb = buildStats('B', kB, kA);
  const winStats = winA ? sa : sb;
  const winTotalK = Math.max(1, winA ? kA : kB);
  const mvpRow = winStats.slice().sort((x,y)=>{
    const sx = x.k*2.4 + x.a*1.2 - x.d*1.6 + ((x.k+x.a)/winTotalK)*4 + rnd()*0.8;
    const sy = y.k*2.4 + y.a*1.2 - y.d*1.6 + ((y.k+y.a)/winTotalK)*4 + rnd()*0.8;
    return sy - sx;
  })[0];

  const game = {
    w: winA?'A':'B', dur, kA, kB,
    turA, turB, dragA, dragB, baronA, baronB, goldDiff,
    mvp: mvpRow ? mvpRow.pid : null,
    mvpTag: mvpRow ? mvpRow.tag : '',
    pA: ev.pA, sa, sb, events,
    bans: {A:d.bans.A.slice(), B:d.bans.B.slice()},
    picks: {A:{...d.picks.A}, B:{...d.picks.B}},
    blue: d.blue, first: d.first,
    styleA: ev.a.comp.style, styleB: ev.b.comp.style
  };
  game.impacts = applyGameImpact(game, d.A, d.B);
  return game;
}

// 赛后联动：选手状态 form 波动 & 英雄熟练度成长
function applyGameImpact(g, teamA, teamB){
  const impacts = [];
  const handleSide = (side, stats) => {
    const won = g.w === side;
    const isUserTeam = (side==='A'?teamA:teamB) === S.user;
    for(const row of stats){
      const p = P(row.pid); if(!p) continue;
      const isMvp = row.pid === g.mvp;
      const kda = (row.k + row.a) / Math.max(1, row.d);
      // 状态变化
      let df = won ? (0.25 + (kda>=4?0.3:0) + (isMvp?0.45:0)) : (-0.35 + (kda>=3?0.2:0));
      p.form = Math.round(clamp((p.form||0) + df, -5, 5)*10)/10;
      // 英雄熟练度积累（获胜或高 KDA 更易成长）
      if(row.c && CH[row.c] && CH[row.c].roles.includes(p.role)){
        const entry = p.champs.find(x=>x.c===row.c);
        const learnChance = won ? (isMvp?0.55:0.28) : 0.08;
        if(entry && entry.p < 5 && rnd() < learnChance){
          entry.p = Math.min(5, entry.p + 1);
          if(isUserTeam) impacts.push(`${playerTag(p)} 的 ${CH[row.c].cn} 熟练度提升至 ${entry.p>=5?'招牌':'熟练'}！`);
        } else if(!entry && won && kda>=2.5 && rnd() < 0.35){
          p.champs.push({c:row.c, p:2});
          if(p.champs.length > 8) p.champs.sort((a,b)=>b.p-a.p).length = 8;
          if(isUserTeam) impacts.push(`${playerTag(p)} 扩充英雄池，习得 ${CH[row.c].cn}！`);
        }
      }
      if(isUserTeam && isMvp) impacts.push(`${playerTag(p)} 斩获 MVP，手感火热（状态 ${p.form>0?'+':''}${p.form}）`);
    }
  };
  handleSide('A', g.sa);
  handleSide('B', g.sb);
  return impacts;
}

// 系列赛（AI 自动）
function simSeries(m, keepGames){
  const need=Math.ceil(m.bo/2); let wa=0,wb=0; const games=[]; let locked=[];
  let chooser = rnd()<0.5?'A':'B';
  if(m.hiSeed) chooser = m.hiSeed;
  while(wa<need && wb<need){
    const other = chooser==='A'?'B':'A';
    const dec = aiFirstDecision(m[chooser==='A'?'a':'b'], m[other==='A'?'a':'b'], locked);
    let first, blue;
    if(dec.kind==='first'){
      first = chooser;
      const othSide = aiSecondDecision(m[other==='A'?'a':'b'], m[chooser==='A'?'a':'b'], 'first', locked);
      blue = othSide==='blue' ? other : chooser;
    } else {
      blue = chooser;
      const othOrd = aiSecondDecision(m[other==='A'?'a':'b'], m[chooser==='A'?'a':'b'], 'side', locked);
      first = othOrd==='first' ? other : chooser;
    }
    const d=newDraft(m.a,m.b,first,blue,locked);
    autoDraftRest(d);
    const g=playGame(d); games.push(g);
    if(g.w==='A')wa++; else wb++;
    locked = locked.concat(Object.values(g.picks.A), Object.values(g.picks.B)).filter(Boolean); // 无畏征召
    chooser = g.w==='A'?'B':'A'; // 败者获得先手选择权
  }
  return finishSeries(m, wa, wb, games, keepGames);
}
function finishSeries(m, wa, wb, games, keep){
  m.s=[wa,wb]; m.w = wa>wb? m.a : m.b; m.l = wa>wb? m.b : m.a;
  if(keep) m.gm = games.map(g=>({
    w:g.w, dur:g.dur, kA:g.kA, kB:g.kB,
    turA:g.turA, turB:g.turB, dragA:g.dragA, dragB:g.dragB, baronA:g.baronA, baronB:g.baronB, goldDiff:g.goldDiff,
    mvp:g.mvp, mvpTag:g.mvpTag, picks:g.picks, bans:g.bans, blue:g.blue, events:g.events
  }));
  // 英雄统计
  for(const g of games){
    for(const s of ['A','B']) Object.values(g.picks[s]).filter(Boolean).forEach(c=>{ S.log[c]=S.log[c]||{p:0,w:0,b:0}; S.log[c].p++; if(g.w===s)S.log[c].w++; });
    [...g.bans.A,...g.bans.B].filter(Boolean).forEach(c=>{S.log[c]=S.log[c]||{p:0,w:0,b:0};S.log[c].b++;});
  }
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
  for(let i=0;i<maxR;i++) for(const g in perGroup){ const r=perGroup[g][i]; if(r) r.forEach(([a,b])=>st.matches.push(mkMatch(a,b,bo,`${g} 第${i+1}轮`,{g, rnd:i+1}))); }
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
  pre=pre||''; const n=[]; let col=0;
  if(t.length===8){ for(let i=0;i<4;i++){ n.push({id:'Q'+i,a:t[i*2],b:t[i*2+1],bo,label:'八强赛',col,row:i}); } col++;
    n.push({id:'S0',a:{w:'Q0'},b:{w:'Q1'},bo,label:'半决赛',col,row:0},{id:'S1',a:{w:'Q2'},b:{w:'Q3'},bo,label:'半决赛',col,row:1}); }
  else { n.push({id:'S0',a:t[0],b:t[1],bo,label:'半决赛',col,row:0},{id:'S1',a:t[2],b:t[3],bo,label:'半决赛',col,row:1}); }
  col++;
  n.push({id:'F',a:{w:'S0'},b:{w:'S1'},bo:finalBo||bo,label:'决赛',col,row:0});
  const places=[{w:'F'},{l:'F'},{l:'S0'},{l:'S1'}]; if(t.length===8) places.push({l:'Q0'},{l:'Q1'},{l:'Q2'},{l:'Q3'});
  return {nodes:n, places};
}
// 瑞士轮：3胜晋级 3负淘汰；晋级/淘汰关键局 BO3，其余 BO1
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
    fmt:'✅ 11队：LCK/LPL/LEC/LCS/LCP 各2、CBLOL 1。✅ 各赛区一号种子 + 先锋赛冠军赛区二号种子直通对阵图（7队）。✅ 入围赛4队双败，1队晋级。✅ 对阵图8队双败，全程BO5无畏征召。✅ 冠军与次优赛区各获得一个额外世界赛名额。'},
  ewc:{name:'电竞世界杯 EWC', date:'7月15日 - 19日', loc:'法国 巴黎',
    fmt:'✅ 16队：卫冕冠军（Gen.G）+ 六大赛区冠军 + 9支线上预选赛队伍。✅ 4个GSL双败小组，前2晋级；小组赛BO1，淘汰局BO3。✅ 淘汰赛单败BO3，决赛BO5。⚠️ 9个预选赛名额按各赛区实力分配为简化处理。'},
  lpl_s3:{name:'LPL 第三赛段', date:'7月22日 - 9月', loc:'中国 · 五大城市主场',
    fmt:'✅ 12队：第二赛段季后赛8队进登峰组，其余4队进涅槃组，组内双循环BO3。✅ 登峰组前6直通季后赛；登峰组7-8与涅槃组前2进行BO5单败骑士之路，争夺最后2席。✅ 季后赛8队。✅ 冠军为LPL一号种子出战世界赛。⚠️ 积分值为推测。'},
  lpl_rf:{name:'LPL 世界赛资格赛', date:'9月', loc:'中国',
    fmt:'⚠️ 未能查到2026官方细则，按往年惯例简化：第三赛段冠军为一号种子；其余名额按全年积分排名，最后一个名额由积分排名紧随其后的两队BO5决出。'},
  worlds:{name:'全球总决赛 Worlds', date:'10月15日 - 11月14日', loc:'美国 洛杉矶 / 德州艾伦 / 纽约',
    fmt:'✅ 19队：LCK/LPL/LEC/LCS/LCP 各3、CBLOL 2，另MSI冠军与次优赛区各+1。✅ 入围赛4队双败BO5，1队晋级。✅ 瑞士轮16队（德州艾伦）→ 淘汰赛8队 → 决赛（纽约巴克莱中心）。⚠️ 入围赛参赛队伍、瑞士轮BO数（BO1/关键局BO3）、淘汰赛BO5沿用2025规则，为推测。'},
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
      ev.res.A=A; ev.res.N=N;
      ev.stages.push(mkBR('骑士之路（第一轮）',[{id:'K1',a:N[0],b:N[3],bo:5,label:'涅槃1 vs 涅槃4'},{id:'K2',a:N[1],b:N[2],bo:5,label:'涅槃2 vs 涅槃3'}],[]));
    } else if(ev.si===1){
      const A=ev.res.A;
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
  if(msi && msi.done && msi.res.champ){
    const r1 = T(msi.res.champ).region;
    slots[r1]++;
    // 次优名额归属 MSI 排名最高的不同赛区（防止同赛区冠亚军重复+2）
    const order = (msi.res.order && msi.res.order.length) ? msi.res.order : [msi.res.champ, msi.res.runner].filter(Boolean);
    const secondTeam = order.find(t=>t && T(t) && T(t).region !== r1);
    const r2 = secondTeam ? T(secondTeam).region : (r1==='LCK'?'LPL':'LCK');
    slots[r2]++;
  }
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
    const bye=REGIONS.map(r=>seeds[r][0]); bye.push(seeds[fstReg][1] || seeds.LCK[1]);
    const playin=[]; REGIONS.forEach(r=>{ if(seeds[r][1] && !bye.includes(seeds[r][1])) playin.push(seeds[r][1]); });
    ev.res.bye=bye; ev.res.playin=playin; ev.res.fstReg=fstReg;
    playin.sort((a,b)=>REGION_STR[T(b).region]-REGION_STR[T(a).region]);
    const g=gslNodes(playin,'top1',5);
    ev.stages.push(mkBR('入围赛',g.nodes,g.places));
  },
  next(ev){
    if(ev.si===0){
      const win=brPlaces(ev.stages[0])[0];
      const all=[...ev.res.bye, win].sort((a,b)=>(REGION_STR[T(b).region]-REGION_STR[T(a).region]) || (ev.res.bye.indexOf(a)-ev.res.bye.indexOf(b)));
      const tiers=[all.slice(0,2),all.slice(2,4),all.slice(4,6),all.slice(6,8)].map(shuffle);
      let s=[tiers[0][0],tiers[0][1],tiers[1][0],tiers[1][1],tiers[2][1],tiers[2][0],tiers[3][1],tiers[3][0]];
      for(let t=0;t<30;t++){ const h1=[s[0],s[7],s[3],s[4]].map(x=>T(x).region), h2=[s[1],s[6],s[2],s[5]].map(x=>T(x).region);
        if(new Set(h1).size===4 && new Set(h2).size===4) break; const i=pick([2,3,4,5,6,7]), j=pick([2,3,4,5,6,7]); [s[i],s[j]]=[s[j],s[i]]; }
      ev.stages.push(mkBR('对阵图阶段',de8Nodes(s,5),DE8_PLACES));
    } else { const pl=brPlaces(ev.stages[1]); ev.res.champ=pl[0]; ev.res.runner=pl[1]; ev.res.order=pl; ev.done=true;
      const r1=T(pl[0]).region; const r2Team=pl.find(t=>t&&T(t).region!==r1); const r2=r2Team?T(r2Team).region:(r1==='LCK'?'LPL':'LCK');
      addNews(`🏆 ${teamName(pl[0])} 夺得MSI冠军！${r1}与${r2}赛区获得额外世界赛名额。`);
      intlPrize(pl,[1000,500,250,200,100,100,60,60]); }
  }
};
// ---------- EWC ----------
const EWC_DEFENDING = 'GEN';
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
    const playin=[];
    const base={LPL:3,LCK:3,LEC:3,LCS:3,LCP:3,CBLOL:2};
    REGIONS.forEach(r=>{ for(let i=base[r];i<slots[r];i++){ const t=seeds[r][i]; if(t && !playin.includes(t)) playin.push(t); } });
    for(const [r,i] of [['LCP',2],['CBLOL',1],['LCS',2],['LEC',2],['LPL',2],['LCK',2]]){
      if(playin.length>=4) break;
      const t = seeds[r] && seeds[r][i];
      if(t && !playin.includes(t)) playin.push(t);
    }
    ev.res.playin=playin.slice(0,4);
    ev.res.direct=REGIONS.flatMap(r=>seeds[r]).filter(t=>t && !ev.res.playin.includes(t));
    const g=gslNodes(ev.res.playin.slice().sort((a,b)=>teamOvr(b)-teamOvr(a)),'top1',5);
    ev.stages.push(mkBR('入围赛（洛杉矶）',g.nodes,g.places));
  },
  next(ev){
    if(ev.si===0){ const w=brPlaces(ev.stages[0])[0]; ev.stages.push(mkSwiss('瑞士轮（德州艾伦）',[...ev.res.direct,w])); }
    else if(ev.si===1){
      const st=ev.stages[1]; const adv=st.teams.filter(t=>st.rec[t][0]===3).sort((a,b)=>st.rec[a][1]-st.rec[b][1]);
      let hi=adv.slice(0,4), lo=adv.slice(4).reverse(), pairs=[];
      for(let t=0;t<40;t++){ const L=t?shuffle(lo):lo; if(hi.every((h,i)=>T(h).region!==T(L[i]).region)){lo=L;break;} }
      hi.forEach((h,i)=>pairs.push(h,lo[i]));
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
  REGIONS.filter(r=>r!=='LPL').forEach(r=>regionRank(r,split));
  // 财务：修复优先级 Bug（9-14名正确拿到 300 + 40 = 340 万）
  const prizeTable = [500,300,200,150,100,100,80,80];
  order.forEach((k,i)=>{ const t=T(k); if(!t) return;
    const prize = prizeTable[i]!=null ? prizeTable[i] : 40;
    const income = 300 + prize;
    t.budget += income;
    const pay = t.roster.map(P).filter(Boolean).reduce((s,p)=>s+p.salary,0)/3; t.budget -= Math.round(pay);
    if(k===S.user) addNews(`💼 赛段结算：收入 ${fmtMoney(income)}，支付薪资 ${fmtMoney(pay)}，余额 ${fmtMoney(t.budget)}。`); });
  Object.values(S.teams).filter(t=>t.region!=='LPL').forEach(t=>{ t.budget += 400 - Math.round(t.roster.map(P).filter(Boolean).reduce((s,p)=>s+p.salary,0)/3*0.6); });
  // 成长与状态回正
  Object.values(S.players).forEach(p=>{ if(p.retired) return;
    let d = p.age<=22 ? (p.pot-p.rating)*0.1+randn()*0.7 : p.age<=26 ? randn()*0.7 : -0.35+randn()*0.7;
    p.rating = clamp(Math.round((p.rating+d)*10)/10, 45, 97);
    p.form = Math.round(clamp((p.form||0)*0.45 + randn()*1.2, -5, 5)*10)/10; });
  newPatch();
  addNews(`🔧 新版本 ${S.year%100}.${S.patchNo} 上线，英雄强度发生变化。`);
}

// ---------- 推进逻辑 ----------
function stageMatches(ev){ // 当前可进行的比赛（含并行小组；循环赛严格按最早未完成轮次）
  const idxs = ev.parallel && ev.si<=Math.max(...ev.parallel) ? ev.parallel : [ev.si];
  const out=[];
  for(const i of idxs){
    const st=ev.stages[i]; if(!st) continue;
    if(st.kind==='br') resolveBR(st);
    let pending = st.matches.filter(m=>!m.w && m.a && m.b);
    if(st.kind==='rr' && pending.length && pending.some(m=>m.rnd!=null)){
      const minR = Math.min(...pending.filter(m=>m.rnd!=null).map(m=>m.rnd));
      pending = pending.filter(m=>m.rnd===minR);
    }
    for(const m of pending) out.push({m,st});
  }
  return out;
}
function nextReadyMatch(){ const ev=curEvent(); if(!ev||ev.done) return null; const a=stageMatches(ev); return a[0]||null; }
function stageDone(st){ if(st.kind==='br') resolveBR(st); return st.matches.every(m=>m.w); }
function startEvent(){ const ev=curEvent(); if(!ev.started){ ev.started=true; EV[ev.type].init(ev); } }
function afterMatch(st, m){
  if(st.kind==='swiss') swissReport(st,m);
  if(st.kind==='br') resolveBR(st);
  const ev=curEvent();
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
function canTeamFitForeign(team, incomingPlayer){
  const maxF = maxForeignFor(team.region);
  if(maxF >= 5 || !isForeign(incomingPlayer)) return true;
  const curAtRole = P(team.lineup[incomingPlayer.role]);
  const curF = starters(team.key).filter(isForeign).length;
  // 若替下的是外援则名额不变；否则需未达上限
  return (curAtRole && isForeign(curAtRole)) ? curF <= maxF : curF < maxF;
}
function evaluateOffer(pid, cash, givePid){
  const p=P(pid); const ask=askPrice(p);
  let offerVal=cash; let gp=null;
  if(givePid){ gp=P(givePid); offerVal += playerValue(gp)*(gp.role===p.role?0.95:0.7); }
  const ratio=offerVal/ask;
  return {ask, offerVal, ratio, accept: ratio>=1, chance: clamp((ratio-0.85)/0.3,0,1)};
}
function makeOffer(pid, cash, givePid){
  const p=P(pid), me=T(S.user);
  if(cash>me.budget) return {ok:false,msg:'预算不足'};
  if(!p.team){
    signPlayer(pid,S.user,Math.round(p.salary*1.1),S.year+2); me.budget-=cash;
    addNews(`✍️ ${teamName(S.user)} 签下自由球员 ${playerTag(p)}（${ROLE_CN[p.role]}）。`); return {ok:true,msg:`签约成功！${playerTag(p)} 加盟。`};
  }
  const e=evaluateOffer(pid,cash,givePid);
  const accept = e.ratio>=1.05 || (e.ratio>=0.9 && rnd()<e.chance);
  if(!accept) return {ok:false,msg:`${teamName(p.team)} 拒绝了报价（对方心理价位约 ${fmtMoney(e.ask)}）。`};
  const seller=p.team;
  me.budget-=cash; T(seller).budget+=cash;
  signPlayer(pid,S.user,Math.max(p.salary,Math.round(fairSalary(p)*1.05)),S.year+2);
  if(givePid){ signPlayer(givePid,seller,P(givePid).salary,P(givePid).contract); }
  ensureRoster(seller);
  addNews(`🔁 转会：${playerTag(p)} 从 ${teamName(seller)} 加盟 ${teamName(S.user)}${cash?`，转会费 ${fmtMoney(cash)}`:''}${givePid?`，${playerTag(P(givePid))} 反向加盟 ${teamName(seller)}`:''}。`);
  return {ok:true,msg:'交易达成！'};
}
function bidsFor(pid){
  const p=P(pid), v=playerValue(p);
  return Object.values(S.teams).filter(t=>t.key!==S.user && t.budget>v*0.8 && canTeamFitForeign(t, p))
    .map(t=>{ const cur=P(t.lineup[p.role]); const need = cur? (p.rating-cur.rating) : 10; return {t:t.key, need, price: Math.round(v*(0.75+rnd()*0.35+Math.max(0,need)*0.02))}; })
    .filter(b=>b.need>-2 && b.price<=T(b.t).budget).sort((a,b)=>b.price-a.price).slice(0,3);
}
function sellPlayer(pid, buyer, price){
  const p=P(pid); const me=T(S.user);
  me.budget+=price; T(buyer).budget-=price;
  signPlayer(pid,buyer,p.salary,Math.max(p.contract,S.year+1)); autoLineup(buyer);
  addNews(`💸 ${teamName(S.user)} 将 ${playerTag(p)} 以 ${fmtMoney(price)} 出售给 ${teamName(buyer)}。`);
}
function releasePlayer(pid){ const p=P(pid); const t=T(p.team); const pay=Math.round(p.salary*0.5); t.budget-=pay; t.roster=t.roster.filter(x=>x!==pid); for(const r of ROLES) if(t.lineup[r]===pid) delete t.lineup[r]; p.team=null; addNews(`📤 ${teamName(S.user)} 与 ${playerTag(p)} 解约（支付违约金 ${fmtMoney(pay)}）。`); }
function aiTransfers(n){
  const ts=Object.values(S.teams).filter(t=>t.key!==S.user);
  for(let i=0;i<n;i++){
    const buyer=pick(ts); const role=pick(ROLES); const cur=P(buyer.lineup[role]); if(!cur) continue;
    const cands=Object.values(S.players).filter(p=>p.role===role && p.team && p.team!==buyer.key && p.team!==S.user && p.rating>cur.rating+2 && askPrice(p)<buyer.budget*0.6 && canTeamFitForeign(buyer, p));
    if(!cands.length) continue;
    const p=pick(cands.slice(0,40)); const price=askPrice(p); const from=p.team;
    buyer.budget-=price; T(from).budget+=price;
    signPlayer(p.pid,buyer.key,fairSalary(p),S.year+2);
    autoLineup(buyer.key); ensureRoster(from);
    addNews(`🔁 ${playerTag(p)} 以 ${fmtMoney(price)} 从 ${teamName(from)} 转会至 ${teamName(buyer.key)}。`);
  }
}
// ================= 休赛期 / 新赛季 =================
function finishOffseason(){
  const y=S.year;
  Object.values(S.players).forEach(p=>{ if(!p.team || p.contract>y) return;
    if(p.team===S.user){ if(!p.renewed){ const t=T(p.team); t.roster=t.roster.filter(x=>x!==p.pid); for(const r of ROLES) if(t.lineup[r]===p.pid) delete t.lineup[r]; p.team=null; addNews(`📤 ${playerTag(p)} 合同到期离队，成为自由球员。`);} }
    else if(rnd()<0.8 || T(p.team).roster.length<=5){ p.contract=y+1+Math.floor(rnd()*2); p.salary=fairSalary(p); }
    else { const t=T(p.team); t.roster=t.roster.filter(x=>x!==p.pid); for(const r of ROLES) if(t.lineup[r]===p.pid) delete t.lineup[r]; p.team=null; }
    p.renewed=false; });
  Object.values(S.players).forEach(p=>{ if(!p.team && !p.retired && p.age>=29 && rnd()<0.5){ p.retired=true; } p.age++; });
  for(let i=0;i<20;i++) genRookie(y+1);
  Object.values(S.teams).forEach(t=>ensureRoster(t.key));
  aiTransfers(12);
  Object.values(S.teams).forEach(t=>{ if(t.key!==S.user) autoLineup(t.key); else { for(const r of ROLES) if(t.lineup[r] && (!P(t.lineup[r]) || P(t.lineup[r]).team!==t.key)) delete t.lineup[r]; } });
  ensureRoster(S.user);
  const s3=S.events.find(e=>e.type==='lpl_s3').res.final;
  const ranked=s3.slice(0,8).concat(S.lplOrder.filter(t=>!s3.slice(0,8).includes(t)).sort((a,b)=>(S.points[b]||0)-(S.points[a]||0)));
  S.history = S.history||[]; S.history.push({year:y, points:{...S.points}, lpl:S.events.filter(e=>/lpl_s/.test(e.type)).map(e=>e.res.champ), fst:S.events[1].res.champ, msi:S.events[4].res.champ, ewc:S.events[5].res.champ, worlds:S.events[9].res.champ});
  S.year=y+1; S.lplOrder=ranked;
  buildSeason();
  addNews(`🎆 ${S.year} 赛季开始！`);
}
function renewPlayer(pid){ const p=P(pid); const s=Math.round(fairSalary(p)*1.1); p.salary=s; p.contract=S.year+2; p.renewed=true; addNews(`✍️ ${teamName(S.user)} 与 ${playerTag(p)} 续约两年，年薪 ${fmtMoney(s)}。`); return s; }
