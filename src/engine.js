// ================= 基础工具 =================
const ROLES = ['TOP','JUG','MID','ADC','SUP'];
const ROLE_CN = {TOP:'上单',JUG:'打野',MID:'中单',ADC:'下路',SUP:'辅助'};
const REGIONS = ['LPL','LCK','LEC','LCS','CBLOL','LCP'];
const REGION_STR = {LCK:6,LPL:6,LEC:4,LCS:3,LCP:2,CBLOL:1};
const CH = {}; CHAMPS.forEach(([k,cn,roles,tags,dmg])=>CH[k]={k,cn,roles,tags,dmg});
const CHAMP_KEYS = Object.keys(CH);
const PRO_DATA = window.PRO_PLAYER_DATA || {players:{}, roles:{}, pairs:{}};
// 传奇选手（如 Uzi (2018)）与个别选手的手工英雄池，见 data/legends/legends.json
const LEGENDS = window.LEGENDS || {legends:[], champOverrides:{}};
const LEGEND_BY_PID = Object.fromEntries((LEGENDS.legends||[]).map(l=>[l.pid,l]));
function champOverride(p){ return p ? (p.legend ? LEGEND_BY_PID[p.pid] : LEGENDS.champOverrides?.[p.tag||p.pid]) || null : null; }
function topChamps(table,n){ return Object.keys(table||{}).filter(c=>CH[c]).sort((a,b)=>table[b]-table[a]).slice(0,n); }
const PROFESSIONAL_HEROES = Object.fromEntries(ROLES.map(r=>[r,CHAMP_KEYS.filter(c=>CH[c].roles.includes(r) && (PRO_DATA.roles[r]?.[c]||0)>=6)]));
const rnd = () => Math.random();
const randn = (random=rnd) => { let u=0,v=0; while(!u)u=random(); while(!v)v=random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const pick = a => a[Math.floor(rnd()*a.length)];
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
function hash(s){ let h=2166136261; for(const c of String(s)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619);} return h>>>0; }
function srand(seed){ let s=seed||1; return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }
const sigmoid = x => 1/(1+Math.exp(-x));
const playerTag = p => p ? (p.tag || p.pid) : '—';

const AGE_FIX = {"Faker": 30, "Ruler": 28, "Chovy": 25, "Canyon": 25, "Kiin": 27, "Keria": 24, "Oner": 24, "Peyz": 21, "Doran": 26, "Zeus": 22, "Gumayusi": 24, "Kanavi": 26, "Zeka": 24, "ShowMaker": 26, "Viper": 26, "Bin": 23, "knight": 26, "XUN": 24, "ON": 23, "Flandre": 28, "Tarzan": 27, "Shanks": 25, "369": 25, "Tian": 26, "JackeyLove": 26, "Creme": 23, "TheShy": 26, "Rookie": 29, "Wei": 23, "Meiko": 28, "Xiaohu": 28, "Elk": 25, "Jiejie": 25, "GALA": 25, "Caps": 27, "BrokenBlade": 26, "Hans Sama": 27, "CoreJJ": 32, "Inspired": 24, "Berserker": 23, "Scout": 28, "Lehends": 28, "Bdd": 27, "Aiming": 26, "Cuzz": 27, "Pyosik": 26, "Teddy": 28, "Kingen": 26, "Lucid": 22, "Delight": 24, "Mikyx": 28, "Upset": 26, "Razork": 26, "Elyoya": 26, "Wunder": 28, "Blaber": 26, "Zven": 29, "Impact": 31, "Missing": 25, "Kael": 24, "Hope": 24, "Rich": 29, "Clozer": 23, "deokdam": 26, "Fisher": 22, "Duro": 24, "Kellin": 25, "Clear": 24, "Raptor": 22, "BuLLDoG": 22, "Croco": 26, "Breathe": 24, "Leave": 25, "Assum": 26, "Carzzy": 24, "Labrov": 24, "Canna": 26, "Busio": 22, "Jojopyun": 21, "Josedeodo": 26}; // 部分知名选手2026年龄（按出生年估算）
let S = null; // 全局存档状态

// ================= 英雄熟练度五档体系（0~100 连续经验值） =================
// 0~24 生疏 | 25~44 略懂 | 45~64 熟练(✦) | 65~84 精通(◆) | 85~100 招牌(👑)
function profTier(val){
  const v = val || 0;
  if(v >= 85) return { tier:4, name:'招牌', icon:'👑', cls:'sig', bonus: 5.0 };
  if(v >= 65) return { tier:3, name:'精通', icon:'◆',  cls:'mas', bonus: 3.6 };
  if(v >= 45) return { tier:2, name:'熟练', icon:'✦',  cls:'pro', bonus: 2.2 };
  if(v >= 25) return { tier:1, name:'略懂', icon:'',   cls:'fam', bonus: 0.6 };
  return { tier:0, name:'生疏', icon:'', cls:'raw', bonus: -1.4 };
}
function migrateChampProf(rawP){
  if(typeof rawP !== 'number' || isNaN(rawP)) return 35;
  // 旧存档兼容：旧版 p 为 1~5 小整数档位，平滑映射到 0~100 连续值
  if(rawP <= 6){
    if(rawP >= 5) return 90;
    if(rawP >= 4) return 74;
    if(rawP >= 3) return 56;
    if(rawP >= 2) return 38;
    return 22;
  }
  return clamp(Math.round(rawP), 5, 100);
}

// ================= 存档向下兼容迁移 =================
function normalizeMetaQuota(meta, oldMeta){
  const out = {};
  CHAMP_KEYS.forEach(k => out[k] = 0);
  const pickedT0 = new Set(), pickedT1 = new Set();
  for(const role of ROLES){
    const primary = CHAMP_KEYS.filter(k => CH[k].roles[0] === role);
    const scored = primary.map(k => {
      const cur = meta && meta[k] != null ? meta[k] : 0;
      const prev = oldMeta && oldMeta[k] != null ? oldMeta[k] : 0;
      const keep = prev >= 2 ? 0.55 : prev >= 1 ? 0.35 : 0;
      return { k, s: (cur * 0.45) + keep + rnd() * 1.45 };
    }).sort((a,b) => b.s - a.s);
    const strong=scored.filter(x=>PROFESSIONAL_HEROES[role].includes(x.k));
    const viable=(strong.length>=5 ? strong : scored);
    viable.slice(0, 2).forEach(x => { out[x.k] = 2; pickedT0.add(x.k); });
    viable.slice(2, 5).forEach(x => { out[x.k] = 1; pickedT1.add(x.k); });
    scored.slice(-5).forEach(x => { if(!pickedT0.has(x.k) && !pickedT1.has(x.k) && rnd() < 0.72) out[x.k] = -1; });
  }
  return out;
}

function migrateSave(s){
  if(!s || typeof s!=='object') return s;
  s.ver = 4;
  s.meta = s.meta || {};
  const strongCnt = CHAMP_KEYS.filter(k => (s.meta[k]||0) >= 1).length;
  const missingCnt = CHAMP_KEYS.filter(k => s.meta[k]==null).length;
  const invalidMeta=CHAMP_KEYS.some(c=>(s.meta[c]||0)>0 && PROFESSIONAL_HEROES[CH[c].roles[0]].length>=5 && !PROFESSIONAL_HEROES[CH[c].roles[0]].includes(c));
  if(strongCnt > 27 || strongCnt < 16 || missingCnt > 0 || invalidMeta){
    s.meta = normalizeMetaQuota(s.meta, s.meta);
  }
  s.log = s.log || {};
  s.news = s.news || [];
  s.honors = s.honors || [];
  s.history = s.history || [];
  if(s.players){
    Object.values(s.players).forEach(p=>{
      if(!p.tag) p.tag = p.pid;
      if(typeof p.form!=='number' || isNaN(p.form)) p.form = 0;
      if(typeof p.mental!=='number' || isNaN(p.mental)) p.mental = 0;
      if(!Array.isArray(p.champs)) p.champs = [];
      p.champs = p.champs.filter(x=>x && CH[x.c]).map(x=>({ c:x.c, p:migrateChampProf(x.p) }));
      if(p.champPractice && typeof p.champPractice==='object') p.champPractice=Object.fromEntries(Object.entries(p.champPractice).filter(([c,v])=>CH[c] && Number.isFinite(v) && v>=15 && v<=100));
      if(!p.champs.length) genChampPool(p, srand(hash(p.pid)),s.meta);
      if(!s.playerDevelopment || !Number.isFinite(p.pot)) p.pot=initialPotential(p);
      if(!Number.isFinite(p.ratingYearStart)) p.ratingYearStart=p.rating;
      if(!Array.isArray(p.trainTargets)) p.trainTargets = [];
      if(p.dynTr && typeof p.dynTr !== 'object') delete p.dynTr;
    });
  }
  s.playerDevelopment=1;
  // 旧档一次性补上个人性格基线与偏移：保留全队的大方向（如连胜后的自信），让同队五人拉开差距
  if(!s.moodVer && s.players){
    Object.values(s.players).forEach(p=>{
      if(p.retired) return;
      p.form = Math.round(clamp(p.form + randn()*1.0, -5, 5)*100)/100;
      p.mental = Math.round(clamp(p.mental*0.7 + mentalBase(p)*0.6 + randn()*0.7, -5, 5)*100)/100;
    });
  }
  s.moodVer=1;
  // 旧档一次性补上传奇自由选手，并把手工英雄池的招牌英雄提到新熟练度（已练出的其他英雄保留）
  if(!s.legendsVer && s.players){
    const prevS = S; S = s;
    addLegends();
    Object.values(s.players).forEach(p=>{
      const ov = !p.legend && LEGENDS.champOverrides?.[p.tag||p.pid];
      if(!ov || p.retired) return;
      for(const [c,v] of Object.entries(ov.champs||{})) if(CH[c] && champProfVal(p,c) < v) rememberChampProf(p,c,v);
      p.champs.sort((a,b)=>b.p-a.p);
    });
    S = prevS;
  }
  s.legendsVer=1;
  if(!s.bonds || typeof s.bonds !== 'object'){
    s.bonds = {};
    const prevS = S; S = s;
    initTeamBonds();
    S = prevS;
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
  S = { ver:4, year:2026, user:userTeam, teams:{}, players:{}, events:[], evIdx:0,
        news:[], honors:[], history:[], points:{}, rr:{}, meta:{}, patchNo:1, uid:1, lplOrder:null,
        log:{}, bonds:{} };
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
          age, rating:p.rating||70, team:key, form:initialForm(baseId), mental:0, champs:[], sub:!!p.sub };
        rollStartMood(pl);
        pl.pot = initialPotential(pl);
        pl.ratingYearStart = pl.rating;
        pl.salary = fairSalary(pl);
        pl.contract = 2026 + Math.floor(r()*3);
        S.players[pid]=pl; S.teams[key].roster.push(pid);
      }
    }
  }
  S.playerDevelopment=1;
  S.moodVer=1;
  S.legendsVer=1;
  newPatch();
  addLegends();
  Object.values(S.players).forEach(p=>genChampPool(p,srand(hash(p.pid)),S.meta));
  for(let i=0;i<24;i++) genRookie(2026);
  Object.values(S.teams).forEach(t=>autoLineup(t.key));
  initTeamBonds();
  // LPL 2026 第一赛段分组（官方：按2025排名）
  S.lplOrder = ['BLG','AL','TES','IG','JDG','WBG','NIP','WE','EDG','TT','LGD','UP','LNG','OMG'].filter(k=>S.teams[k]);
  Object.values(S.teams).filter(t=>t.region==='LPL'&&!S.lplOrder.includes(t.key)).forEach(t=>S.lplOrder.push(t.key));
  buildSeason({rosterSetup:true});
  addNews(`欢迎来到 ${S.year} 赛季！你执掌 ${teamName(userTeam)}。目标：拿下LPL世界赛资格，问鼎全球总决赛。`);
}
function initialPotential(p){
  const r=srand(hash('potential:'+p.pid));
  const talent=(r()+r())*0.5;
  return Math.round(clamp(57 + talent*40 + (p.age<=21?7:p.age<=24?2:0),55,98));
}
const styleForPlayer=new Map();
function professionalPicks(p){ return champOverride(p)?.picks || PRO_DATA.players[String(playerTag(p)).toLowerCase()] || {}; }
// 传奇选手作为自由球员加入（只有玩家能签，AI 不会签约）；已存在则跳过
function addLegends(){
  for(const l of LEGENDS.legends||[]){
    if(S.players[l.pid]) continue;
    const pl = { pid:l.pid, tag:l.id, name:l.name||l.id, role:l.role, nat:l.nat||'CN', age:l.age||22, rating:l.rating||85,
      team:null, form:0, mental:0, champs:[], legend:true };
    pl.pot = l.pot || pl.rating;
    pl.ratingYearStart = pl.rating;
    pl.salary = fairSalary(pl);
    pl.contract = S.year;
    rollStartMood(pl);
    genChampPool(pl);
    S.players[pl.pid] = pl;
  }
}
function playerStyle(p){
  const id=playerTag(p).toLowerCase();
  if(!styleForPlayer.has(id)){
    const counts={};
    for(const [c,n] of Object.entries(professionalPicks(p))) for(const t of CH[c]?.tags||[]) counts[t]=(counts[t]||0)+n;
    styleForPlayer.set(id,Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).slice(0,2));
  }
  return styleForPlayer.get(id);
}
function proAffinity(p,c){
  const n=professionalPicks(p)[c]||0;
  if(n>=4) return 1;
  const style=playerStyle(p);
  return clamp(0.44 + n*0.09 + (CH[c]?.tags||[]).filter(t=>style.includes(t)).length*0.19,0.44,0.94);
}
function genChampPool(pl, r, meta=S?.meta||{}){
  r = r || rnd;
  const ov=champOverride(pl);
  if(ov?.champs){
    pl.champs = Object.entries(ov.champs).filter(([c])=>CH[c]).map(([c,p])=>({c,p})).sort((a,b)=>b.p-a.p);
    pl.trainTargets = pl.trainTargets || [];
    return;
  }
  const history=professionalPicks(pl);
  const pool = PROFESSIONAL_HEROES[pl.role]?.length ? PROFESSIONAL_HEROES[pl.role] : CHAMP_KEYS.filter(k=>CH[k].roles.includes(pl.role));
  const depth = (pl.rating||70)>=86 ? 8 : 7;
  const signatures=Object.keys(history).filter(c=>history[c]>=4 && CH[c]?.roles.includes(pl.role)).slice(0,2);
  const candidates=pool.filter(c=>!signatures.includes(c)).map(c=>({c,score:(meta[c]||0)*proAffinity(pl,c)*1.7 + Math.log1p(history[c]||0)*0.72 + proAffinity(pl,c) + r()})).sort((a,b)=>b.score-a.score);
  const baseVals = [79,72,66,60,55,48,42,37];
  pl.champs = signatures.map((c,i)=>({c,p:Math.round(clamp(86+Math.log2(history[c])*1.5-i*2,85,97))}));
  for(const {c} of candidates.slice(0,Math.max(0,depth-signatures.length))){
    const i=pl.champs.length-signatures.length;
    const affinity=proAffinity(pl,c);
    const value=(baseVals[i]||36) - (1-affinity)*13 + (r()-0.5)*6;
    pl.champs.push({c,p:Math.round(clamp(value,25,84))});
  }
  pl.trainTargets = pl.trainTargets || [];
}
const RK_A=['Shy','Lin','Kai','Ming','Zero','Neo','Hao','Yun','Feng','Bai','Leo','Qing','Ace','Mist','Ray','Tian','Sky','Jin','Rin','Sol','Xia','Lan','Mo','Chen','Yu','Nova','Rex','Hex','Ark','Vex'];
const RK_B=['','x','o','7','in','er','yu','ze','ki','an','99','ly','Q','zz','ra'];
function genRookie(year, forceRole, forceNat){
  let id; do{ id = pick(RK_A)+pick(RK_B); } while(S.players[id]);
  const role = forceRole || pick(ROLES); const age = 17+Math.floor(rnd()*3);
  const rating = Math.round(56+rnd()*12);
  const nat = forceNat || pick(['CN','CN','CN','KR']);
  const pl = { pid:id, tag:id, name:id+'（虚构新秀）', role, nat, age, rating, team:null, form:0, mental:0, champs:[], rookie:true, ratingYearStart:rating };
  pl.pot=initialPotential(pl);
  rollStartMood(pl);
  pl.salary = fairSalary(pl); pl.contract = year+2; genChampPool(pl);
  S.players[id]=pl; return pl;
}
// 生成版本更新详情（用于赛季末前瞻日志与新版本播报）
function describeChampBuff(k, isBuff){
  const ch = CH[k]; if(!ch) return isBuff ? '综合属性上调' : '基础数值回调';
  const tags = ch.tags || [], roles = ch.roles || [];
  if(isBuff){
    if(roles.includes('JUG') && tags.includes('early')) return '前期基础伤害与清野效率上调，野区入侵与控图节奏增强';
    if(roles.includes('ADC') && tags.includes('scale')) return '成长攻速与暴击收益提升，大后期团战接管能力显著强化';
    if(tags.includes('engage') && (roles.includes('SUP')||roles.includes('TOP'))) return '基础双抗与先手技能容错率提高，中期开团威胁上升';
    if(tags.includes('poke')) return '核心消耗技能冷却缩短且蓝耗降低，对线压制与团前消耗加强';
    if(tags.includes('pick')) return '爆发连招伤害系数优化，抓单与切入后排威慑力提升';
    if(tags.includes('split')) return '边带单挑与拆塔收益上调，单带牵制力大幅增强';
    if(tags.includes('protect')) return '护盾/治疗与反手保护数值提升，保核体系契合度提高';
    return '基础属性与核心技能成长加强，整体对局强度上升';
  } else {
    if(tags.includes('early')) return '前期基础伤害与换血能力下调，滚雪球难度增加';
    if(tags.includes('scale')) return '后期技能加成系数微调回落，成型期有所延后';
    if(tags.includes('engage')) return '大招冷却时间延长，连续开团频率降低';
    return '基础生命值与护甲微调下调，对线容错率降低';
  }
}

function generatePatchData(oldMeta, nextVerLabel){
  // 严格分位置定额制：每条主路固定 2 名 T0 + 3 名 T1（全版本恒定 10 T0 / 15 T1），杜绝越玩越多
  const meta = normalizeMetaQuota(null, oldMeta);
  const buffs = [], nerfs = [];
  for(const k of CHAMP_KEYS){
    const prev = oldMeta && oldMeta[k]!=null ? oldMeta[k] : 0;
    const cur = meta[k];
    if(cur >= 1 && cur > prev) buffs.push({ c:k, to:cur, desc: describeChampBuff(k, true) });
    else if(cur <= 0 && prev >= 1 && cur < prev) nerfs.push({ c:k, to:cur, desc: describeChampBuff(k, false) });
  }
  buffs.sort((a,b)=>(b.to - a.to) || (rnd()-0.5));
  nerfs.sort((a,b)=>(a.to - b.to) || (rnd()-0.5));
  return {
    ver: nextVerLabel,
    meta,
    buffs: buffs.slice(0, 9),
    nerfs: nerfs.slice(0, 6)
  };
}

function newPatch(precomputed){
  if(precomputed && precomputed.meta){
    S.meta = Object.assign({}, precomputed.meta);
    S.lastPatchNotes = precomputed;
  } else {
    const pData = generatePatchData(S.meta, `${S.year%100}.${S.patchNo+1}`);
    S.meta = pData.meta;
    S.lastPatchNotes = pData;
  }
  S.patchNo++;
}
const teamName = k => { const t=S.teams[k]; return t? t.short : k; };
const T = k => S.teams[k];
const P = id => S.players[id];

// ================= 阵容与外援规则 =================
function isForeign(p){ return !p ? false : !['CN','TW','HK','MO'].includes(p.nat); }
function maxForeignFor(region){ return region==='LPL' ? 2 : 99; }
function effRating(p, role){ return p ? p.rating + formTier(p)*2 - (p.role!==role?8:0) : 45; }

// ================= 状态 / 心态 / 隐藏特质 =================
// 状态五档：低迷 欠佳 平稳 良好 火热（p.form -5~5）；心态五档：崩溃 紧张 平常 自信 无畏（p.mental -5~5）
const FORM_TIERS = ['低迷','欠佳','平稳','良好','火热'];
const MENTAL_TIERS = ['崩溃','紧张','平常','自信','无畏'];
const tierOf = v => { v = +v||0; return v<=-3?-2 : v<=-1?-1 : v<1?0 : v<3?1 : 2; };
const formTier = p => p ? tierOf(p.form) : 0;
const mentalTier = p => p ? tierOf(p.mental) : 0;
const TIER_LO = {'-2':-5, '-1':-2.9, '0':-0.9, '1':1, '2':3};
const TIER_HI = {'-2':-3, '-1':-1, '0':0.99, '1':2.99, '2':5};
// 开档状态：取选手近期（最近 20 局）相对生涯的表现基线
function initialForm(tag){
  const T0 = (typeof TRAITS!=='undefined' && TRAITS) ? TRAITS[tag] : null;
  return T0 && T0.base ? Math.round(T0.base*100)/100 : 0;
}
// 隐藏性格基线：有人天生自信、有人容易紧张；由抗压特质、年龄资历、能力和按选手固定的随机数决定，心态平时向它回归
function mentalBase(p){
  if(!p) return 0;
  const tr = playerTraits(p);
  const r = srand(hash('mood:'+(p.tag||p.pid)));
  r();
  const age = p.age||21;
  const exp = age>=25 ? 0.25 : age>=22 ? 0.1 : age<=18 ? -0.15 : 0;
  const star = clamp(((p.rating||70)-80)*0.03, -0.3, 0.35);
  const noise = (r()+r()+r()-1.5)*1.6;
  return Math.round(clamp(((tr.res||1)-1)*1.6 + exp + star + noise, -1.8, 1.8)*100)/100;
}
// 开档/新秀的个人起点：状态围绕历来表现基线、心态围绕性格基线随机散开，同队五人各不相同
function rollStartMood(p){
  p.form = Math.round(clamp((p.form||0) + randn()*1.15, -4, 4)*100)/100;
  p.mental = Math.round(clamp(mentalBase(p)*0.8 + randn()*0.9, -4, 4)*100)/100;
}
// 单局个人表现分（约 -1 ~ 1.6）：KDA 为主，MVP 额外加成
function gamePerf(row, isMvp){
  const kda = (row.k + row.a) / Math.max(1, row.d);
  return clamp((kda-3)/3, -1, 1) + (isMvp?0.6:0);
}
// 把数值变化限制在“最多跨一档”
function stepTier(oldV, newV){
  const ot = tierOf(oldV);
  const nv = Math.round(clamp(newV, -5, 5)*100)/100;
  const nt = tierOf(nv);
  if(nt > ot+1) return TIER_HI[String(ot+1)];
  if(nt < ot-1) return TIER_LO[String(ot-1)];
  return nv;
}
// ================= 团队化学反应（基于选手两两搭档磨合，支持双子星/铁三角/整队保留羁绊） =================
const REAL_CORES_2026 = [
  // [players, baseBond] 现实中合作多年的老搭档/双子星/核心班底
  [['Faker','Oner','Keria'], 92],
  [['Faker','Oner','Keria','Doran'], 74],
  [['Bin','knight','ON'], 88],
  [['Bin','knight','ON','XUN'], 82],
  [['Kiin','Canyon','Chovy'], 86],
  [['Kiin','Canyon','Chovy','Ruler','Duro'], 78],
  [['Flandre','Tarzan','Shanks','Kael','Hope'], 80],
  [['369','Creme','JackeyLove'], 84],
  [['Zeus','Zeka','Viper','Delight'], 76],
  [['Caps','BrokenBlade','Hans Sama'], 86],
  [['TheShy','Rookie'], 90],
  [['GALA','Meiko'], 74],
  [['Xiaohu','Crisp'], 78],
  [['Bdd','Cuzz'], 82],
  [['Lucid','ShowMaker'], 78],
  [['Elyoya','Myrwn','Alvaro','Supa'], 82],
  [['Inspired','Bwipo','Quad','Massu','Busio'], 78],
  [['CoreJJ','Impact','APA','Yeon'], 80],
  [['Blaber','Zven'], 76],
];
function pairKey(a, b){ return a < b ? a + '|' + b : b + '|' + a; }
const LANGUAGE_BY_NAT={CN:'zh',TW:'zh',HK:'zh',MO:'zh',KR:'ko',VN:'vi',BR:'pt',PT:'pt',JP:'ja',US:'en',CA:'en',GB:'en',UK:'en',AU:'en',NZ:'en',FR:'fr',DE:'de',AT:'de',ES:'es',MX:'es',AR:'es',CL:'es',PE:'es',DK:'da',SE:'sv',PL:'pl',TR:'tr',CZ:'cs'};
const KNOWN_PLAYER_LANGUAGES={corejj:['ko','en'],impact:['ko','en'],theshy:['ko','zh'],rookie:['ko','zh'],tarzan:['ko','zh']};
function initialPairBond(a,b){
  const x=P(a), y=P(b);
  if(!x || !y) return 0;
  const tx=playerTag(x).toLowerCase(), ty=playerTag(y).toLowerCase();
  const lx=KNOWN_PLAYER_LANGUAGES[tx] || [LANGUAGE_BY_NAT[x.nat]];
  const ly=KNOWN_PLAYER_LANGUAGES[ty] || [LANGUAGE_BY_NAT[y.nat]];
  const former=PRO_DATA.pairs[pairKey(tx,ty)]||0;
  const base=lx.some(l=>l && ly.includes(l))?40:27;
  return former>=5 ? Math.min(66,base+13+Math.round(Math.log2(former)*2)) : base;
}
function getBond(a, b){
  if(!S || !S.bonds || !a || !b || a===b) return 0;
  const stored=S.bonds[pairKey(a,b)];
  if(stored>=40) return stored;
  return Math.max(stored||0,initialPairBond(a,b));
}
function joiningBond(a,b){
  const familiarity=getBond(a,b);
  return familiarity>70 ? Math.min(76,Math.max(63,Math.round(familiarity*0.86))) : familiarity;
}
function setBond(a, b, v){
  if(!S || !a || !b || a===b) return;
  if(!S.bonds) S.bonds = {};
  const k = pairKey(a, b);
  const nv = Math.round(clamp(v, 0, 100) * 10) / 10;
  if(nv < 4) delete S.bonds[k]; else S.bonds[k] = nv;
}
function initTeamBonds(){
  if(!S) return;
  S.bonds = S.bonds || {};
  // 同队初始默契基线（新磨合队伍 40~52，强队默契略高）
  Object.values(S.teams).forEach(t=>{
    const ids = t.roster.filter(id => P(id));
    const base = t.tier <= 2 ? 52 : t.tier <= 5 ? 46 : 40;
    for(let i=0;i<ids.length;i++){
      for(let j=i+1;j<ids.length;j++){
        const r = srand(hash('bd:'+pairKey(ids[i], ids[j])));
        const isSub = P(ids[i]).sub || P(ids[j]).sub;
        const familiar=initialPairBond(ids[i],ids[j]);
        setBond(ids[i], ids[j], Math.max(base + (isSub ? -9 : 0),familiar+4) + (r()-0.5)*8);
      }
    }
  });
  // 注入现实中配合多年的双子星 / 铁三角 / 原班核（仅对真实在档案中的选手生效）
  const byTag = {};
  Object.values(S.players).forEach(p=>{ const k = (p.tag||p.pid).toLowerCase(); (byTag[k]=byTag[k]||[]).push(p); });
  REAL_CORES_2026.forEach(([tags, bond])=>{
    const matched = tags.map(tg => (byTag[tg.toLowerCase()]||[])[0]).filter(Boolean);
    for(let i=0;i<matched.length;i++){
      for(let j=i+1;j<matched.length;j++){
        const established=matched[i].team===matched[j].team?bond:Math.min(66,Math.round(bond*0.75));
        if(getBond(matched[i].pid, matched[j].pid) < established){
          setBond(matched[i].pid, matched[j].pid, established);
        }
      }
    }
  });
}
function chemTierInfo(score){
  if(score >= 86) return { tier:4, label:'心有灵犀', cls:'c4' };
  if(score >= 70) return { tier:3, label:'默契十足', cls:'c3' };
  if(score >= 52) return { tier:2, label:'配合娴熟', cls:'c2' };
  if(score >= 34) return { tier:1, label:'磨合之中', cls:'c1' };
  return { tier:0, label:'生疏拼凑', cls:'c0' };
}
function calcLineupChemistry(pids,bondFor=getBond){
  const list = (pids||[]).filter(Boolean);
  if(list.length < 2) return { score:0, ...chemTierInfo(0), bonus:0, cores:[], strongPairs:0 };
  let sum = 0, cnt = 0, strongPairs = 0;
  const adj = {};
  list.forEach(id => adj[id] = []);
  for(let i=0;i<list.length;i++){
    for(let j=i+1;j<list.length;j++){
      const b = bondFor(list[i], list[j]);
      sum += b; cnt++;
      if(b >= 72){ strongPairs++; adj[list[i]].push(list[j]); adj[list[j]].push(list[i]); }
    }
  }
  const score = Math.round(sum / cnt);
  // 找出高默契羁绊核心（整队/铁三角/双子星）
  const visited = new Set(), cores = [];
  for(const id of list){
    if(visited.has(id) || !adj[id].length) continue;
    const comp = [], q = [id]; visited.add(id);
    while(q.length){ const u = q.shift(); comp.push(u); for(const v of adj[u]) if(!visited.has(v)){ visited.add(v); q.push(v); } }
    if(comp.length >= 2){
      const lbl = comp.length >= 5 ? '原班五人组' : comp.length === 4 ? '四人铁核' : comp.length === 3 ? '铁三角' : '双子星';
      cores.push({ label:lbl, members:comp.map(x=>playerTag(P(x))) });
    }
  }
  // 轻中度战力影响：以 55 为中性线，满默契约 +2.0，全生疏约 -1.8（不盖过硬实力与 BP）
  const bonus = Math.round(clamp((score - 55) / 22, -1.8, 2.0) * 100) / 100;
  return { score, ...chemTierInfo(score), bonus, cores, strongPairs };
}
function teamChemistry(teamKey){
  const t = T(teamKey); if(!t) return calcLineupChemistry([]);
  return calcLineupChemistry(ROLES.map(r => t.lineup[r]).filter(Boolean));
}
function previewChemWith(teamKey, incomingPid, replaceRole){
  const t = T(teamKey); if(!t) return null;
  const before = teamChemistry(teamKey);
  const role = replaceRole || (P(incomingPid) && P(incomingPid).role);
  const pids = ROLES.map(r => r===role ? incomingPid : t.lineup[r]).filter(Boolean);
  const arriving=P(incomingPid)?.team!==teamKey;
  const read=(a,b)=>arriving && (a===incomingPid||b===incomingPid) ? joiningBond(a,b) : getBond(a,b);
  const after = calcLineupChemistry(pids,read);
  const keptFriends = pids.filter(id => id!==incomingPid && read(incomingPid, id)>=60).map(id => playerTag(P(id)));
  return { before, after, delta: after.score - before.score, keptFriends };
}
function playerTeamBond(p){
  if(!p || !p.team) return 0;
  const st = starters(p.team).filter(x => x.pid !== p.pid);
  if(!st.length) return 0;
  return Math.round(st.reduce((s,x)=>s+getBond(p.pid, x.pid), 0) / st.length);
}
function growSeriesBonds(m, games){
  if(!S || !m) return;
  const gCnt = Math.max(1, (games&&games.length) || 1);
  for(const [key, won] of [[m.w,true],[m.l,false]]){
    const t = T(key); if(!t) continue;
    const pids = ROLES.map(r => t.lineup[r]).filter(Boolean);
    const step = (won ? 0.85 : 0.45) * Math.min(3, gCnt * 0.55);
    for(let i=0;i<pids.length;i++){
      for(let j=i+1;j<pids.length;j++){
        const cur = getBond(pids[i], pids[j]);
        // 80 以上递减成长，需要多年并肩才可达到 95+
        const gain = step * Math.pow(clamp((100-cur)/46,0,1),2);
        setBond(pids[i], pids[j], cur + gain);
      }
    }
  }
}
function evolveTeamBonds(isOffseason){
  if(!S || !S.bonds) return;
  const sameTeamPairs = new Set();
  Object.values(S.teams).forEach(t=>{
    const ids = t.roster.filter(id => P(id));
    for(let i=0;i<ids.length;i++){
      for(let j=i+1;j<ids.length;j++){
        const pk = pairKey(ids[i], ids[j]);
        sameTeamPairs.add(pk);
        const cur = getBond(ids[i],ids[j]);
        const bothSt = Object.values(t.lineup).includes(ids[i]) && Object.values(t.lineup).includes(ids[j]);
        const room=clamp((100-cur)/48,0,1);
        const add = (isOffseason ? 7.5 : 5.0) * (bothSt ? 1 : 0.55) * room*room;
        setBond(ids[i], ids[j], cur + add);
      }
    }
  });
  // 已分道扬镳的旧搭档缓慢自然衰退（保留绝大部分旧羁绊，未来重聚仍能快速磨合）
  const decayRate = isOffseason ? 0.90 : 0.96;
  for(const pk of Object.keys(S.bonds)){
    if(!sameTeamPairs.has(pk)){
      const nv = Math.round(S.bonds[pk] * decayRate * 10) / 10;
      if(nv < 4) delete S.bonds[pk]; else S.bonds[pk] = nv;
    }
  }
}

// 隐藏特质：stab 稳定性（波动倍率，越低越稳）、big 大赛系数、ko 淘汰赛系数（能力点）、res 抗压（心态韧性倍率）、base 历来表现基线
// 开档沿用 Leaguepedia 现实数据，随后根据游戏内多年夺冠/高光或长期低迷缓慢演化
const _trCache = {};
function invalidateTraitCache(p){ if(p){ delete _trCache[p.pid]; delete _trCache[p.tag||p.pid]; } }
function playerTraits(p){
  if(!p) return {stab:1,big:0,ko:0,res:1,base:0,tags:[],src:'none'};
  const dyn = p.dynTr;
  const ver = dyn ? (dyn.v || 0) : 0;
  const cacheKey = p.pid;
  const hit = _trCache[cacheKey];
  if(hit && hit._v === ver) return hit;
  const tagKey = p.tag || p.pid;
  const hist=(typeof TRAITS!=='undefined' && TRAITS) ? (TRAITS[tagKey] || TRAITS[String(tagKey).toLowerCase()]) : null;
  const T0=hist?.stab!=null ? hist : p.legend ? LEGEND_BY_PID[p.pid]?.traits : null;
  let tr;
  if(T0){ tr = {stab:T0.stab, big:T0.big, ko:T0.ko, res:T0.res, base:T0.base||0, n:T0.n||0, src:'data'}; }
  else {
    // 数据不足：按年龄与能力给保守默认值（不同选手仍略有差异，但不打标签）
    const r = srand(hash('tr:'+tagKey));
    const age = p.age||21;
    tr = { stab: Math.round((1.08 - Math.min(6,Math.max(0,age-18))*0.025 + (r()-0.5)*0.1)*100)/100,
           big: 0, ko: 0, res: Math.round((0.95 + Math.min(6,Math.max(0,age-18))*0.015 + (r()-0.5)*0.1)*100)/100,
           base: 0, n:0, src:'default' };
  }
  if(dyn){
    tr.big  = Math.round(clamp(tr.big  + (dyn.dBig||0),  -2.6, 2.8)*100)/100;
    tr.ko   = Math.round(clamp(tr.ko   + (dyn.dKo||0),   -2.6, 2.8)*100)/100;
    tr.stab = Math.round(clamp(tr.stab + (dyn.dStab||0),  0.62, 1.42)*100)/100;
    tr.res  = Math.round(clamp(tr.res  + (dyn.dRes||0),   0.65, 1.45)*100)/100;
    if(tr.src !== 'data' && ((dyn.koG||0) >= 16 || (dyn.intlG||0) >= 10 || (dyn.titles||0) >= 2 || (dyn.bigTitles||0) >= 1 || (dyn.flops||0) >= 3)){
      tr.src = 'data';
    }
  }
  tr.tags = traitTags(tr);
  tr._v = ver;
  _trCache[cacheKey] = tr;
  return tr;
}
function ensureDynTr(p){
  if(!p.dynTr) p.dynTr = { v:0, koG:0, koW:0, intlG:0, intlW:0, titles:0, bigTitles:0, flops:0, dBig:0, dKo:0, dStab:0, dRes:0 };
  return p.dynTr;
}
function commitTraitDelta(p, reason){
  if(!p || !p.dynTr) return;
  const before = playerTraits(p).tags.map(x=>x.t);
  p.dynTr.v = (p.dynTr.v || 0) + 1;
  invalidateTraitCache(p);
  const after = playerTraits(p).tags.map(x=>x.t);
  const gained = after.filter(t => !before.includes(t));
  const lost = before.filter(t => !after.includes(t));
  if((gained.length || lost.length) && (p.team === S.user || p.rating >= 84)){
    const msg = gained.length ? `获得「${gained.join(' / ')}」标签` : `褪去「${lost.join(' / ')}」标签`;
    addNews(`特质演变：${playerTag(p)}${p.team?`（${teamName(p.team)}）`:''}${reason?reason+'，':''}${msg}。`);
  }
}
function updateTraitsFromSeries(m, games){
  const ctx = m.ctx || findMatchCtx(m) || {};
  if(!ctx.ko && !ctx.intl) return;
  const gCnt = Math.max(1, (games&&games.length) || 1);
  for(const [key, won] of [[m.w,true],[m.l,false]]){
    const t = T(key); if(!t) continue;
    for(const pid of Object.values(t.lineup)){
      const p = P(pid); if(!p) continue;
      const d = ensureDynTr(p);
      // 检查本系列赛个人 MVP 与稳定性表现
      let mvpCnt = 0, goodG = 0, badG = 0;
      for(const g of (games||[])){
        if(g.mvp === pid) mvpCnt++;
        const row = [...(g.sa||[]), ...(g.sb||[])].find(x=>x.pid===pid);
        if(row){
          const kda = (row.k + row.a * 0.7) / Math.max(1, row.d);
          if(kda >= 4.2) goodG++; else if(kda <= 1.2) badG++;
        }
      }
      const perf = (mvpCnt * 0.03) + (goodG - badG) * 0.012;
      if(ctx.ko){
        d.koG += gCnt; if(won) d.koW += gCnt;
        // 慢速演化：单次 BO5 仅变动 ±0.05~0.10，需跨赛段多次硬仗才改变标签
        d.dKo = clamp(d.dKo + (won ? 0.055 : -0.045) + perf, -1.8, 1.8);
      }
      if(ctx.intl){
        d.intlG += gCnt; if(won) d.intlW += gCnt;
        d.dBig = clamp(d.dBig + (won ? 0.065 : -0.05) + perf, -1.8, 1.8);
      }
      if(goodG >= 2 && badG === 0) d.dStab = clamp(d.dStab - 0.015, -0.28, 0.28);
      else if(badG >= 2) d.dStab = clamp(d.dStab + 0.018, -0.28, 0.28);
      if(won && gCnt >= 5) d.dRes = clamp(d.dRes + 0.025, -0.28, 0.28);
      else if(!won && gCnt >= 5) d.dRes = clamp(d.dRes - 0.015, -0.28, 0.28);
      commitTraitDelta(p, ctx.intl ? '凭借长期国际赛征战积累' : '历经多场淘汰赛硬仗洗礼');
    }
  }
}
function awardEventTraits(kind, champKey, lowKeys){
  if(champKey && T(champKey)){
    const isMajor = kind === 'worlds' || kind === 'msi';
    const reason = kind==='worlds'?'夺得全球总决赛冠军':kind==='msi'?'捧起 MSI 冠军奖杯':'屡次夺得重磅赛事冠军';
    for(const pid of Object.values(T(champKey).lineup)){
      const p = P(pid); if(!p) continue;
      const d = ensureDynTr(p);
      if(isMajor){
        d.bigTitles++;
        d.dBig = clamp(d.dBig + (kind==='worlds'?0.42:0.30), -1.8, 2.0);
        d.dKo  = clamp(d.dKo  + (kind==='worlds'?0.34:0.24), -1.8, 2.0);
        d.dRes = clamp(d.dRes + 0.06, -0.28, 0.30);
      } else {
        d.titles++;
        d.dBig = clamp(d.dBig + 0.14, -1.8, 2.0);
        d.dKo  = clamp(d.dKo  + 0.16, -1.8, 2.0);
        d.dRes = clamp(d.dRes + 0.03, -0.28, 0.30);
      }
      commitTraitDelta(p, reason);
    }
  }
  for(const k of (lowKeys||[])){
    if(!k || !T(k)) continue;
    for(const pid of Object.values(T(k).lineup)){
      const p = P(pid); if(!p) continue;
      const d = ensureDynTr(p);
      d.flops++;
      // 只有多次低排名/早早出局才会逐步削弱声望（单次低谷不变脸）
      if(d.flops >= 2){
        d.dBig = clamp(d.dBig - 0.16, -1.8, 2.0);
        d.dKo  = clamp(d.dKo  - 0.14, -1.8, 2.0);
        d.dRes = clamp(d.dRes - 0.035, -0.28, 0.30);
        commitTraitDelta(p, '因连续多个赛段战绩低迷');
      }
    }
  }
}
function traitTags(tr){
  if(!tr || tr.src!=='data') return [];
  const out = [];
  if(tr.big >= 1.2) out.push({t:'大赛爆发', c:'up'}); else if(tr.big <= -1.2) out.push({t:'大赛软脚', c:'down'});
  if(tr.ko >= 1.2) out.push({t:'大心脏', c:'up'}); else if(tr.ko <= -1.2) out.push({t:'关键局手软', c:'down'});
  if(tr.stab <= 0.8) out.push({t:'稳定输出', c:'up'}); else if(tr.stab >= 1.22) out.push({t:'起伏较大', c:'down'});
  if(tr.res >= 1.22) out.push({t:'抗压强', c:'up'}); else if(tr.res <= 0.8) out.push({t:'容易上头', c:'down'});
  return out;
}

function playerRegionalTags(p){
  if(!p || typeof TRAITS==='undefined') return [];
  const id=String(playerTag(p));
  return ((TRAITS[id] || TRAITS[id.toLowerCase()])?.regionEdge || []).map(([region,games,edge])=>({
    region, games, edge, label:region+' 杀手'
  }));
}
// 比赛场合：intl 国际赛、ko 淘汰赛、decider 决胜局
function pressureOf(ctx){
  if(!ctx) return 0.15;
  return clamp(0.15 + (ctx.ko?0.35:0) + (ctx.intl?0.3:0) + (ctx.decider?0.25:0), 0, 1);
}
function ctxLabel(ctx){
  if(!ctx) return '常规赛';
  const a = [];
  a.push(ctx.intl ? '国际赛' : '联赛');
  a.push(ctx.ko ? '淘汰赛' : '小组赛/常规赛');
  if(ctx.decider) a.push('决胜局');
  return a.join(' · ');
}
// 本场实际发挥能力：基础 + 状态 + 心态×高压程度 + 大赛/淘汰赛特质
function matchRating(p, role, ctx){
  if(!p) return 45;
  const tr = playerTraits(p);
  const pr = pressureOf(ctx);
  // 特质与心态按半权计入：全量计入时最强阵容的国际赛优势被放大，冠军过于集中
  let v = effRating(p, role) + mentalTier(p)*2.0*pr;
  if(ctx && ctx.intl) v += tr.big*0.5;
  if(ctx && ctx.ko) v += tr.ko*0.5;
  return v;
}

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
  const used=new Set();
  for(const r of ROLES){
    const p=P(t.lineup[r]);
    if(!p || p.retired || p.team!==key || !t.roster.includes(p.pid)) probs.push(`缺少${ROLE_CN[r]}首发`);
    else if(used.has(p.pid)) probs.push(`${ROLE_CN[r]}首发与其他位置重复`);
    else used.add(p.pid);
  }
  const maxF = maxForeignFor(t.region);
  if(maxF < 5){
    const f = [...used].filter(pid=>isForeign(P(pid))).length;
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
function freeAgents(){ return Object.values(S.players).filter(p=>!p.team && !p.retired && !p.legend); }
function signPlayer(pid,key,salary,contract){
  const p=P(pid); if(!p) return;
  const transferred=p.team!==key;
  if(p.team){ const o=T(p.team); if(o){ o.roster=o.roster.filter(x=>x!==pid); for(const r of ROLES) if(o.lineup[r]===pid) delete o.lineup[r]; } }
  p.team=key; p.salary=salary; p.contract=contract; p.rookie=false;
  if(!T(key).roster.includes(pid)) T(key).roster.push(pid);
  if(transferred) for(const id of T(key).roster){
    if(id!==pid) setBond(pid,id,joiningBond(pid,id));
  }
}

// ================= BP / 阵容分析 / 非本位奇招平衡 =================
const IMMOBILE_MELEE_TOPS = new Set(['Sion','Ornn',"K'Sante","Cho'Gath",'Mordekaiser','Malphite','Maokai','Udyr','Volibear','Zac','Poppy','Skarner','Trundle','Tahm Kench','Sion','Shen']);
const RANGED_TOP_FLEX = new Set(['Lucian','Tristana','Kalista','Ezreal','Varus','Caitlyn','Smolder','Ashe','Draven','Ryze','Cassiopeia','Viktor','Azir','Neeko']);
const MID_FLEX_POOL = new Set(['Lucian','Ezreal','Varus','Caitlyn','Renekton',"K'Sante",'Sion','Ornn','Sejuani','Maokai','Gwen','Camille','Jax','Riven']);

function offRoleKind(c, assignedRole){
  const ch = CH[c]; if(!ch) return { kind:'mismatch', basePen:-2.3 };
  if(ch.roles.includes(assignedRole)) return { kind:'native', basePen:0 };
  if(assignedRole==='ADC' && ch.dmg==='AP' && (ch.roles.includes('MID') || ch.tags.includes('poke') || ch.tags.includes('scale'))){
    return { kind:'apc_bot', basePen:-0.75 };
  }
  if(assignedRole==='TOP' && (RANGED_TOP_FLEX.has(c) || ch.roles.includes('ADC'))){
    return { kind:'ranged_top', basePen:-1.05 };
  }
  if(assignedRole==='MID' && MID_FLEX_POOL.has(c)){
    return { kind:'flex_mid', basePen:-0.95 };
  }
  if(assignedRole==='SUP' && (ch.tags.includes('engage') || ch.tags.includes('pick') || ch.tags.includes('poke'))){
    return { kind:'flex_sup', basePen:-1.2 };
  }
  if(assignedRole==='JUG' && (ch.tags.includes('engage') || ch.roles.includes('TOP'))){
    return { kind:'flex_jug', basePen:-1.6 };
  }
  return { kind:'mismatch', basePen:-2.3 };
}

function champProfVal(p, c){
  if(!p) return 0;
  const e = p.champs?.find(x=>x.c===c);
  return e ? migrateChampProf(e.p) : p.champPractice?.[c]||0;
}

function playerProfTier(p,c,value=champProfVal(p,c)){
  if(value>=85 && (professionalPicks(p)[c]||0)<4 && (p?.champGames?.[c]||0)<6) return profTier(84);
  return profTier(value);
}
function rememberChampProf(p,c,value){
  const list=p.champs || (p.champs=[]);
  const existing=list.find(e=>e.c===c);
  if(existing){ existing.p=value; return; }
  if(list.length<11){
    list.push({c,p:value});
    if(p.champPractice) delete p.champPractice[c];
    return;
  }
  const weakest=list.reduce((a,b)=>a.p<=b.p?a:b);
  p.champPractice ||= {};
  if(value>weakest.p){
    p.champPractice[weakest.c]=weakest.p;
    weakest.c=c; weakest.p=value;
    delete p.champPractice[c];
  } else p.champPractice[c]=value;
}

function champFit(p, c, assignedRole){
  if(!p || !c || !CH[c]) return -5;
  const pv = champProfVal(p, c);
  let f = playerProfTier(p,c,pv).bonus*0.53;
  // 同档位内部微调（让熟练度经验增长也能平滑体现细微收益）
  if(pv >= 25) f += ((pv - 25) / 75) * 0.27;
  const meta=S.meta[c]||0;
  f += meta>0 ? meta*2.18*clamp(proAffinity(p,c)*0.64 + pv*0.0045,0.34,1) : meta*1.15;
  const r = assignedRole || p.role;
  const off = offRoleKind(c, r);
  f += off.basePen;
  if(p.role !== r) f -= 1.5;
  return f;
}
function compInfo(champs){
  const list = champs.filter(c=>c && CH[c]);
  const tags={}; let ad=0,ap=0;
  let frontline=0, control=0;
  list.forEach(c=>{ CH[c].tags.forEach(t=>tags[t]=(tags[t]||0)+1); if(CH[c].dmg==='AD')ad++; else if(CH[c].dmg==='AP')ap++; else {ad+=.5;ap+=.5;} });
  for(const c of list){ const kit=draftCombatProfile(c); frontline+=kit.frontline; control+=kit.control; }
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
  if(frontline>=1.6){ score+=0.64; notes.push('前排可承伤'); }
  if(control>=2.3){ score+=0.52; notes.push('控制能连续衔接'); }
  if((tags.scale||0)>0 && list.some(c=>PEEL_CHAMPS.has(c))) notes.push('有反开和后排保护');
  if(list.length===5 && frontline<0.55){score-=0.84; notes.push('前排薄，容易被强开');}
  if(list.length===5 && control<0.9){score-=0.68; notes.push('硬控不足，难留人');}
  const style = ['engage','poke','scale','pick','early'].sort((a,b)=>(tags[b]||0)-(tags[a]||0))[0];
  // 三阶段曲线分（供分阶段模拟与情报面板使用）
  const early = (tags.early||0)*1.15 + (tags.pick||0)*0.45 - (tags.scale||0)*0.35;
  const mid   = (tags.engage||0)*0.75 + (tags.poke||0)*0.7 + (tags.pick||0)*0.6 + (tags.split||0)*0.45;
  const late  = (tags.scale||0)*1.25 + (tags.protect||0)*0.85 + (tags.engage||0)*0.35 - (tags.early||0)*0.25;
  return {score, notes, style, tags, ad, ap, early, mid, late, frontline, control};
}
const STYLE_CN={engage:'开团',poke:'消耗',scale:'后期',pick:'抓单',early:'前期'};
// 克制：开团>消耗>后期>开团；前期>后期；抓单>消耗
function styleEdge(a,b){
  const beats={engage:['poke'],poke:['scale'],scale:['engage'],early:['scale'],pick:['poke']};
  if((beats[a]||[]).includes(b)) return 0.9;
  if((beats[b]||[]).includes(a)) return -0.9;
  return 0;
}

// ---------- 英雄机制克制与分路联动 ----------
const HARD_SUPPORTS = new Set(['Alistar','Amumu','Braum','Blitzcrank','Galio','Gragas','Leona','Malphite','Maokai','Nautilus','Poppy','Rakan','Rell','Tahm Kench','Taric','Thresh','Zac']);
const PEEL_CHAMPS = new Set(['Braum','Gragas','Janna','Lulu','Milio','Poppy','Renata Glasc','Tahm Kench','Taric','Thresh']);
const PROJECTILE_PRESSURE = new Set(['Ahri','Ashe','Caitlyn','Corki','Ezreal','Jhin','Jinx','Kai\'Sa','Kalista','Kennen','Lucian','Miss Fortune','Nidalee','Sivir','Taliyah','Varus','Xayah','Zoe']);
const FRONTLINE_CHAMPS = new Set(['Alistar','Braum','Dr. Mundo','Galio','Gragas','K\'Sante','Leona','Malphite','Maokai','Nautilus','Ornn','Poppy','Rell','Sejuani','Shen','Sion','Skarner','Tahm Kench','Taric','Zac']);
const RELIABLE_CONTROL = new Set(['Alistar','Annie','Camille','Galio','Leona','Lissandra','Malzahar','Maokai','Nautilus','Ornn','Pantheon','Poppy','Rakan','Rell','Renekton','Sejuani','Skarner','Twisted Fate','Vi','Zac']);
const COMBAT_PROFILES = Object.fromEntries(CHAMP_KEYS.map(c=>{
  const kit=window.CHAMP_TACTICS[c], tags=CH[c].tags;
  return [c,{frontline:FRONTLINE_CHAMPS.has(c)?1:tags.includes('tank')?0.5:0,
    control:RELIABLE_CONTROL.has(c)?1:tags.includes('engage')||tags.includes('pick')?0.45:0,
    engage:(kit?.engage||0)*0.5, dash:(kit?.dash||0)*0.5, protect:PEEL_CHAMPS.has(c)?1:tags.includes('protect')?0.55:0,
    sustained:(kit?.autos||0)*0.5, escape:(kit?.escape||0)*0.5, antiDash:c==='Poppy'?1:c==='Taliyah'||c==='Cassiopeia'?0.65:0,
    magic:(kit?.magic||0)*0.5, antiMagic:c==='Galio'?1:0, antiAuto:c==='Jax'||c==='Nilah'?1:c==='Malphite'?0.55:0,
    projectile:PROJECTILE_PRESSURE.has(c)?1:0, guardProjectile:['Braum','Yasuo','Samira','Mel'].includes(c)?1:0}];
}));
const EMPTY_COMBAT_PROFILE = {frontline:0,control:0,engage:0,dash:0,protect:0,sustained:0,escape:0,antiDash:0,magic:0,antiMagic:0,antiAuto:0,projectile:0,guardProjectile:0};
function draftCombatProfile(c){ return COMBAT_PROFILES[c] || EMPTY_COMBAT_PROFILE; }
// [机制, 权重, 提示]：提示里的 {x} 换成对面真正吃这套机制的英雄。
// 克制只看对手高出常规阵容的部分（见 draftThreats 的 z 值），普通阵容不会触发。
const DRAFT_COUNTERS = {
  Poppy: ['dash',0.22,'打断{x}的进场位移'],
  Taliyah: ['dash',0.14,'用岩墙限制{x}的进场'],
  Cassiopeia: ['dash',0.13,'缚地限制{x}的位移'],
  Galio: ['magic',0.17,'抵挡{x}的魔法伤害'],
  Jax: ['autos',0.21,'反击{x}的普攻'],
  Nilah: ['autos',0.19,'规避{x}的普攻'],
  Malphite: ['autos',0.12,'降低{x}的攻速'],
  Braum: ['projectiles',0.15,'格挡{x}的弹道'],
  Mel: ['projectiles',0.13,'反射{x}的弹道'],
  Samira: ['projectiles',0.12,'拦截{x}的弹道'],
  Yasuo: ['projectiles',0.14,'用风墙拦截{x}的弹道']
};
const COUNTER_Z_FLOOR = 0.25;   // 对手超出常规水平多少个标准差才开始算克制
const COUNTER_SCALE = 2.6;
const COUNTER_CAP = 1.0;        // 与一组优秀的下路联动相当
// ADC / 辅助类型：进攻型 ADC 要硬辅开团，后期核心要保护，消耗型 ADC 配远程控制辅。
const ADC_STYLE = {
  "Draven":'aggro', "Kai'Sa":'aggro', "Kalista":'aggro', "Samira":'aggro', "Nilah":'aggro',
  "Lucian":'aggro', "Tristana":'aggro', "Miss Fortune":'aggro',
  "Jinx":'hyper', "Kog'Maw":'hyper', "Aphelios":'hyper', "Zeri":'hyper', "Twitch":'hyper',
  "Vayne":'hyper', "Smolder":'hyper', "Yunara":'hyper', "Xayah":'hyper', "Sivir":'hyper',
  "Ezreal":'poke', "Caitlyn":'poke', "Varus":'poke', "Jhin":'poke', "Ashe":'poke',
  "Corki":'poke', "Senna":'poke', "Seraphine":'poke'
};
const SUP_STYLE = {
  "Leona":'engage', "Nautilus":'engage', "Rell":'engage', "Alistar":'engage', "Rakan":'engage',
  "Blitzcrank":'engage', "Thresh":'engage', "Pyke":'engage', "Amumu":'engage', "Maokai":'engage',
  "Zac":'engage', "Gragas":'engage', "Malphite":'engage', "Galio":'engage', "Neeko":'engage', "Pantheon":'engage',
  "Braum":'warden', "Taric":'warden', "Tahm Kench":'warden', "Poppy":'warden',
  "Lulu":'enchanter', "Janna":'enchanter', "Milio":'enchanter', "Nami":'enchanter', "Soraka":'enchanter',
  "Yuumi":'enchanter', "Sona":'enchanter', "Renata Glasc":'enchanter',
  "Karma":'mage', "Zyra":'mage', "Brand":'mage', "Hwei":'mage', "Morgana":'mage', "Swain":'mage',
  "Seraphine":'mage', "Senna":'mage', "Ashe":'mage', "Bard":'mage'
};
const ADC_STYLE_CN = {aggro:'进攻型', hyper:'后期核心', poke:'消耗型'};
const SUP_STYLE_CN = {engage:'硬开辅', warden:'护卫辅', enchanter:'软辅', mage:'法师辅'};
// [对线, 团战]：没有专属组合时按类型给下路配合。
const BOT_STYLE_SYNERGY = {
  aggro: {engage:[0.40,0.40], warden:[0.10,0.12], enchanter:[-0.18,-0.24], mage:[0.05,-0.12]},
  hyper: {engage:[0.00,0.08], warden:[0.10,0.32], enchanter:[0.12,0.42], mage:[-0.06,-0.04]},
  poke:  {engage:[0.00,0.04], warden:[0.00,0.06], enchanter:[0.14,0.08], mage:[0.34,0.24]}
};
// 开团＋跟进：可靠的先手开团配上范围大招跟进。
const ENGAGE_STARTERS = new Set(['Alistar','Amumu','Diana','Galio','Gragas','Hecarim','Jarvan IV','Leona','Lissandra','Malphite','Maokai','Nautilus','Nocturne','Ornn','Rakan','Rell','Sejuani','Skarner','Vi','Wukong','Zac','Annie']);
const AOE_FOLLOWUPS = new Set(['Orianna','Miss Fortune','Kennen','Yasuo','Yone','Diana','Rumble','Seraphine','Sona','Samira','Wukong','Galio','Azir']);
const BOT_DUOS = {
  'Ezreal+Karma': [0.56,0.36,'EZ＋卡尔玛的远程换血'],
  'Ashe+Seraphine': [0.46,0.52,'寒冰减速衔接萨勒芬妮控制'],
  'Xayah+Rakan': [0.42,0.65,'霞洛的专属技能联动'],
  'Lucian+Nami': [0.66,0.32,'卢锡安＋娜美的换血爆发'],
  'Lucian+Milio': [0.46,0.35,'米利欧强化卢锡安的输出窗口'],
  'Kog\'Maw+Lulu': [0.31,0.65,'璐璐强化并保护大嘴输出'],
  'Caitlyn+Morgana': [0.64,0.30,'莫甘娜禁锢接女警夹子'],
  'Kalista+Nautilus': [0.45,0.52,'滑板鞋大招送泰坦近身开团'],
  'Nilah+Taric': [0.33,0.56,'尼菈与宝石的近身保护联动'],
  'Nilah+Soraka': [0.38,0.41,'尼菈放大星妈治疗']
};
const MID_JUNGLE_DUOS = {
  'Orianna+Nocturne': [0.22,0.68,'梦魇带球进场接发条大招'],
  'Jayce+Maokai': [0.39,0.53,'大树先手为杰斯远程火力留空间'],
  'Yasuo+Diana': [0.32,0.62,'皎月聚拢敌人后亚索接大'],
  'Galio+Jarvan IV': [0.26,0.63,'皇子困住目标后加里奥进场'],
  'Ahri+Vi': [0.31,0.53,'蔚锁定目标后阿狸接控制'],
  'Twisted Fate+Nocturne': [0.26,0.45,'卡牌与梦魇的边线联动']
};
const TOP_JUNGLE_DUOS = {
  'Renekton+Nidalee': [0.58,0.25,'鳄鱼点控帮助豹女命中标枪']
};
const TACTIC_DAMAGE_SHARE = {TOP:0.9,JUG:0.85,MID:1.05,ADC:1.15,SUP:0.3};

const THREAT_KEYS = ['dash','magic','autos','engage','projectiles'];
function champThreat(role, c){
  const kit = window.CHAMP_TACTICS[c];
  if(!kit) return null;
  const share = TACTIC_DAMAGE_SHARE[role];
  return {dash:kit.dash, magic:kit.magic*share, autos:kit.autos*share*(1 - kit.range*kit.escape*0.10),
    engage:kit.engage, projectiles:PROJECTILE_PRESSURE.has(c) ? share : 0};
}
// 每个位置本位英雄池的平均威胁与方差，作为“常规阵容”的基准。
const THREAT_BASE = Object.fromEntries(ROLES.map(role=>{
  const rows = CHAMP_KEYS.filter(c=>CH[c].roles.includes(role)).map(c=>champThreat(role,c)).filter(Boolean);
  const base = {};
  for(const k of THREAT_KEYS){
    const vals = rows.map(t=>t[k]), mean = vals.reduce((s,v)=>s+v,0)/Math.max(1,vals.length);
    base[k] = {mean, v: vals.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,vals.length)};
  }
  return [role, base];
}));
function draftThreats(picks){
  const out = {dash:0, magic:0, autos:0, engage:0, projectiles:0, z:{}};
  const mean = {}, v = {};
  for(const k of THREAT_KEYS){ mean[k]=0; v[k]=0; }
  for(const role of ROLES){
    const t = champThreat(role, picks[role]);
    if(!t) continue;
    for(const k of THREAT_KEYS){ out[k] += t[k]; mean[k] += THREAT_BASE[role][k].mean; v[k] += THREAT_BASE[role][k].v; }
  }
  for(const k of THREAT_KEYS) out.z[k] = v[k]>0 ? (out[k]-mean[k])/Math.sqrt(v[k]) : 0;
  return out;
}
function counterStrength(rule, threats){
  const [key, weight] = rule;
  return Math.min(COUNTER_CAP, weight * COUNTER_SCALE * Math.max(0, (threats.z?.[key]||0) - COUNTER_Z_FLOOR));
}
// 对面最吃这套机制的英雄（用于提示文字）
function counterVictims(key, enemy){
  const min = {dash:2, magic:1.6, autos:1.6, projectiles:0.85}[key] || 1;
  const rows = ROLES.map(role=>({c:enemy[role], t:champThreat(role, enemy[role])})).filter(x=>x.t && x.t[key]>0)
    .sort((a,b)=>b.t[key]-a.t[key]);
  const hit = rows.filter(x=>x.t[key]>=min);
  return (hit.length ? hit.slice(0,3) : rows.slice(0,2)).map(x=>CH[x.c].cn);
}

function laneTacticEdge(champ, enemy){
  const own = window.CHAMP_TACTICS[champ], opp = window.CHAMP_TACTICS[enemy];
  if(!own || !opp) return 0;
  let edge = 0.10 * Math.max(0, own.range-opp.range) * (2-opp.escape);
  const rule = DRAFT_COUNTERS[champ];
  if(rule){
    const [key, weight] = rule;
    const threat = key==='projectiles' ? Number(PROJECTILE_PRESSURE.has(enemy))*2 : opp[key];
    edge += 0.68 * weight * threat;
  }
  return edge;
}

function draftTactics(picks, enemy, threats=draftThreats(enemy), notes=null, risks=null){
  let lane = 0, fight = 0, peel = 0, vulnerable = 0;
  for(const role of ROLES){
    const c = picks[role], kit = window.CHAMP_TACTICS[c];
    if(!kit) continue;
    const rule = DRAFT_COUNTERS[c];
    if(rule){
      const strength = counterStrength(rule, threats);
      fight += strength;
      if(notes && strength>=0.30){
        const victims = counterVictims(rule[0], enemy);
        notes.push(CH[c].cn + rule[2].replace('{x}', victims.length ? victims.join('、') : '对手'));
      }
    }
    if(role==='TOP' || role==='MID'){
      const edge=laneTacticEdge(c,enemy[role]);
      lane+=edge;
      if(notes && edge>=0.37) notes.push(`${ROLE_CN[role]} ${CH[c].cn} 有对位压制`);
    }
    if(role==='ADC' || role==='SUP'){
      lane += 0.35 * (laneTacticEdge(c,enemy.ADC) + laneTacticEdge(c,enemy.SUP));
    }
    if(PEEL_CHAMPS.has(c)) peel++;
    if((role==='MID' || role==='ADC' || role==='SUP') && kit.range>0) vulnerable += (2-kit.escape)/2;
  }

  const dive = Math.max(0, threats.engage-2)*0.5;
  const exposed = dive / (1+0.45*peel);
  fight -= 0.34 * vulnerable * exposed;
  if((risks||notes) && vulnerable*exposed>=1.4) (risks||notes).push('后排缺位移，容易被对方开团');

  const bot = BOT_DUOS[picks.ADC + '+' + picks.SUP];
  const mid = MID_JUNGLE_DUOS[picks.MID + '+' + picks.JUG];
  const top = TOP_JUNGLE_DUOS[picks.TOP + '+' + picks.JUG];
  for(const duo of [bot,mid,top]){
    if(!duo) continue;
    lane += duo[0]*1.33;
    fight += duo[1]*1.42;
    if(notes) notes.push(duo[2]);
  }
  // 没有专属组合时，按 ADC / 辅助类型判断下路配合
  const adcStyle = ADC_STYLE[picks.ADC], supStyle = SUP_STYLE[picks.SUP];
  if(!bot && adcStyle && supStyle && picks.ADC!=='Ziggs' && picks.ADC!==picks.SUP){
    const [bl, bf] = BOT_STYLE_SYNERGY[adcStyle][supStyle];
    lane += bl*1.33;
    fight += bf*1.42;
    const pair = `${CH[picks.ADC].cn}＋${CH[picks.SUP].cn}`;
    if(notes && bl+bf>=0.5){
      notes.push(adcStyle==='aggro' ? `${pair}：硬辅先手，进攻型 ADC 打出击杀线`
        : adcStyle==='hyper' ? `${pair}：辅助保护后期核心输出`
        : `${pair}：下路远程消耗压制`);
    }
    if((risks||notes) && bl+bf<=-0.3) (risks||notes).push(`${pair}：进攻型 ADC 缺少硬辅开团`);
  }
  // 开团＋跟进：有可靠先手时，范围大招英雄能接上团战
  const team = ROLES.map(r=>picks[r]).filter(Boolean);
  const starters = team.filter(c=>ENGAGE_STARTERS.has(c));
  const followers = team.filter(c=>AOE_FOLLOWUPS.has(c) && starters.some(s=>s!==c));
  if(followers.length){
    fight += 0.22*Math.min(2, followers.length);
    if(notes){
      const lead = starters.find(s=>!followers.includes(s)) || starters.find(s=>s!==followers[0]);
      notes.push(`${CH[lead].cn}先手开团，${followers.filter(c=>c!==lead).slice(0,2).map(c=>CH[c].cn).join('、')}范围大招跟进`);
    }
  } else if(!starters.length && team.length>=4 && team.filter(c=>AOE_FOLLOWUPS.has(c)).length>=2){
    fight -= 0.25;
    if(risks||notes) (risks||notes).push('跟进型英雄多，但缺少先手开团');
  }
  if(picks.ADC==='Ashe' && picks.SUP==='Seraphine'){
    lane -= 0.39 * exposed;
    fight -= 1.14 * exposed;
    if((risks||notes) && exposed>=0.7) (risks||notes).push('寒冰＋萨勒芬妮怕连续先手');
  }
  if(picks.ADC==='Ziggs' && picks.SUP){
    const hard = HARD_SUPPORTS.has(picks.SUP);
    lane += hard ? 0.56 : -0.58;
    fight += hard ? 0.42 : -0.45;
    if(hard && notes) notes.push('硬辅定身配合炸弹人输出');
    if(!hard && (risks||notes)) (risks||notes).push('炸弹人下路缺少硬辅留人与保护');
  }

  const early = clamp(lane*1.25 + fight*0.28,-2.7,2.7);
  const midgame = clamp(lane*0.34 + fight,-3.35,3.35);
  const late = clamp(lane*0.18 + fight*0.92,-3.08,3.08);
  return {early, mid:midgame, late, score:early*0.30 + midgame*0.35 + late*0.35};
}

// 只评估已亮出的英雄和位置。新增英雄也可能让对方的反制更有效。
function draftTacticGain(own, enemy){
  const threats = draftThreats(enemy);
  const base = draftTactics(own,enemy,threats).score - draftTactics(enemy,own).score;
  const next = {...own};
  return (role, champ) => {
    next[role] = champ;
    const gain = draftTactics(next,enemy,threats).score - draftTactics(enemy,next).score - base;
    delete next[role];
    return gain;
  };
}

function ziggsBotPairConflict(adc, sup){
  return adc==='Ziggs' && sup && !HARD_SUPPORTS.has(sup);
}

function draftBotPairFilter(picks, unavailableChamps){
  const canPickHard = !picks.SUP && CHAMP_KEYS.some(c => HARD_SUPPORTS.has(c) && CH[c].roles.includes('SUP') && !unavailableChamps.has(c));
  const hasOtherAdc = !picks.ADC && CHAMP_KEYS.some(c => c!=='Ziggs' && CH[c].roles.includes('ADC') && !unavailableChamps.has(c));
  const canPairZiggs = picks.SUP ? HARD_SUPPORTS.has(picks.SUP) : canPickHard;
  return (r,c) => {
    if(r==='SUP' && canPickHard && ziggsBotPairConflict(picks.ADC,c)) return false;
    if(r==='ADC' && c==='Ziggs' && !canPairZiggs && hasOtherAdc) return false;
    return true;
  };
}

// 经典职业选边 AI 决策（蓝色方 = 固定 BP 先手；红色方 = 固定 BP 后手拿五楼康特位）
function aiChooseSide(meKey, oppKey, locked, gameSeed){
  const un = new Set(locked||[]);
  const t0Left = CHAMP_KEYS.filter(c=>!un.has(c) && (S.meta[c]||0)>=2);
  const lu = lineupMap(meKey);
  let t0Fit = 0;
  for(const c of t0Left){
    for(const r of ROLES){ if(CH[c].roles.includes(r) && champFit(lu[r],c,r)>=4.5){ t0Fit++; break; } }
  }
  // 版本强势多或常规情况下绝大多数选蓝色方先手，少数情况选红色方抢五楼康特
  const pBlue = clamp(0.68 + t0Fit*0.06, 0.62, 0.88);
  const random=gameSeed==null ? rnd : srand(hash(gameSeed+':side'));
  return random() < pBlue ? 'blue' : 'red';
}

// 赛前峡谷 1v1 SOLO 选边赛：默认推选本队最佳 SOLO 选手与英雄
function defaultSoloPick(teamKey){
  const lu = lineupMap(teamKey);
  // 优先中上/ADC 等操作位 + 能力最高者
  const roleBias = {MID:1.8, TOP:1.5, ADC:1.0, JUG:0.6, SUP:-3.0};
  let bestR = 'MID', bestScore = -1e9;
  for(const r of ROLES){
    const p = lu[r]; if(!p) continue;
    const sc = effRating(p, r) + (roleBias[r]||0);
    if(sc > bestScore){ bestScore = sc; bestR = r; }
  }
  const p = lu[bestR];
  const sig = p && p.champs && p.champs.length ? p.champs.slice().sort((a,b)=>b.p-a.p)[0].c : CHAMP_KEYS.find(k=>CH[k].roles.includes(bestR)) || CHAMP_KEYS[0];
  return { role: bestR, pid: p ? p.pid : null, champ: sig };
}

// 赛前峡谷 1v1 SOLO 选边模拟引擎：见 sim.js（simSolo1v1 / createSolo）

// draft: {A,B (team keys), first:'A'|'B', blue:'A'|'B', locked:[], bans:{A:[],B:[]}, picks:{A:{role:champ},B:{}}, pickOrder:{A:[],B:[]}, step}
const DRAFT_SEQ = [ // F=先选方 S=后选方
  ['ban','F'],['ban','S'],['ban','F'],['ban','S'],['ban','F'],['ban','S'],
  ['pick','F'],['pick','S'],['pick','S'],['pick','F'],['pick','F'],['pick','S'],
  ['ban','S'],['ban','F'],['ban','S'],['ban','F'],
  ['pick','S'],['pick','F'],['pick','F'],['pick','S']];
const AI_DRAFT_WAIT_MS = 5000;
const DRAFT_RATING_WEIGHT = 0.64;
const DRAFT_COMPOSITION_WEIGHT = 1.20;
const DRAFT_FIT_WEIGHT = 0.95;
const DRAFT_WIN_SCALE = 5.7;   // v2.1.10：加入临场发挥浮动后重新拟合（原 4.3），让 BP 预测胜率与实战一致
function draftPlayerRating(p, role, ctx){
  return 80 + (matchRating(p,role,ctx)-80)*DRAFT_RATING_WEIGHT;
}
function newDraft(A,B,blue,locked){
  // 经典职业规则：蓝色方固定为 BP 先手（first === blue）
  return {A,B,first:blue,blue,locked:(locked||[]).slice(),bans:{A:[],B:[]},picks:{A:{},B:{}},pickOrder:{A:[],B:[]},step:0};
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
  if(!CH[c] || un.has(c)) return {ok:false, offrole:false, openRoles:[]};
  const open = openRolesFor(d, side);
  if(!open.length) return {ok:false, offrole:false, openRoles:[]};
  const onRole = open.filter(r=>CH[c].roles.includes(r));
  const otherRole = open.filter(r=>!CH[c].roles.includes(r));
  // 允许玩家自由选择非本位英雄（奇招/摇摆），默认优先推原生位置，同时保留其余空位置供切换
  return {ok:true, offrole: onRole.length===0, openRoles: [...onRole, ...otherRole]};
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
  const enemy = d.picks[side==='A' ? 'B' : 'A'];
  const threats = draftThreats(enemy);
  const next = {};
  let bestPerm = null, bestScore = curScore + 1.6*draftTactics(d.picks[side],enemy,threats).score + 0.35;
  function permute(arr, start){
    if(start===arr.length){
      let sc = 0;
      for(let i=0;i<arr.length;i++){
        next[roles[i]] = arr[i];
        if(!CH[arr[i]].roles.includes(roles[i])) sc -= 3;
        sc += champFit(lu[roles[i]], arr[i], roles[i]);
      }
      if(sc < curScore-2 || ziggsBotPairConflict(next.ADC,next.SUP)) return;
      sc += 1.6*draftTactics(next,enemy,threats).score;
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
    if(role && (!ROLES.includes(role) || d.picks[cur.side][role])) role = null;
    if(role && !CH[c].roles.includes(role) && !offOk) role = null;
    role = role || bestRoleFor(d, cur.side, c, offOk);
    if(!role) return false;
    d.picks[cur.side][role]=c;
    if(d.pickOrder) d.pickOrder[cur.side].push({r:role, c, step:d.step});
  }
  d.step++; return true;
}

function draftSimulationRandom(d){
  return d.ctx?.gameSeed==null ? rnd : srand(hash(d.ctx.gameSeed+':bp:'+d.step));
}
function aiDraftCandidates(d, limit=1, varied=true){
  const random=varied ? draftSimulationRandom(d) : rnd;
  const cur=draftSide(d); if(!cur) return [];
  const un=unavailable(d);
  const me=cur.side, opp= me==='A'?'B':'A';
  const myLu=lineupMap(d[me]), oppLu=lineupMap(d[opp]);
  const myPicks=Object.values(d.picks[me]).filter(Boolean);
  const oppPicks=Object.values(d.picks[opp]).filter(Boolean);
  const ranked=[];
  function consider(c, score, role=null){
    if(ranked.length===limit && score<=ranked[limit-1].score) return;
    const prior=ranked.findIndex(x=>x.c===c);
    if(prior>=0){
      if(ranked[prior].score>=score) return;
      ranked.splice(prior,1);
    }
    const at=ranked.findIndex(x=>x.score<score);
    ranked.splice(at<0?ranked.length:at,0,{c,role,offrole:!!role && !CH[c].roles.includes(role),score});
    if(ranked.length>limit) ranked.pop();
  }

  if(cur.kind==='ban'){
    const oppOpen = openRolesFor(d, opp);
    const myOpen = openRolesFor(d, me);
    const oppComp = compInfo(oppPicks);
    const isRound2 = d.step >= 12;
    const tacticGain = isRound2 ? draftTacticGain(d.picks[opp],d.picks[me]) : null;
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
        s += Math.max(0, ...validOppRoles.map(r=>tacticGain(r,c))) * 1.6;
      }
      // 避免把己方立刻能抢到的强势招牌给 Ban 了
      if(nextIsMyPick){
        const myMatch = myOpen.filter(r=>CH[c].roles.includes(r));
        if(myMatch.length && Math.max(...myMatch.map(r=>champFit(myLu[r],c,r)))>=5) s -= 2.5;
      }
      if(varied) s += random()*1.05;
      consider(c,s);
    }
    if(!ranked.length){
      const fallback=CHAMP_KEYS.find(c=>!un.has(c));
      if(fallback) consider(fallback,0);
    }
    return ranked;
  }

  // Pick 阶段
  const baseComp = compInfo(myPicks);
  const oppComp = compInfo(oppPicks);
  const myOpen = openRolesFor(d, me);
  const earlyPhase = myPicks.length < 3;
  const allowOff = !hasAnyOnRoleChamp(d, me);
  const tacticGain = draftTacticGain(d.picks[me],d.picks[opp]);
  const allowsPair = draftBotPairFilter(d.picks[me],un);

  for(const c of CHAMP_KEYS){
    if(un.has(c)) continue;
    // AI 默认选本位，或在伤害极度单一需要法核下路时考虑合理奇招
    let candRoles = allowOff ? myOpen : myOpen.filter(r=>CH[c].roles.includes(r));
    if(!allowOff && myPicks.length>=3 && baseComp.ad>=3 && myOpen.includes('ADC') && !candRoles.includes('ADC') && offRoleKind(c,'ADC').kind==='apc_bot'){
      candRoles = candRoles.concat('ADC');
    }
    if(!candRoles.length) continue;
    const nextComp = compInfo(myPicks.concat(c));
    for(const r of candRoles){
      if(!allowsPair(r,c)) continue;
      let s = champFit(myLu[r], c, r);
      s += (nextComp.score - baseComp.score) * 1.15;
      s += 3.0 * tacticGain(r,c);
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
      if(varied) s += random()*1.05;
      consider(c,s,r);
    }
  }
  return ranked;
}

function draftAfterChoice(d, choice){
  const next={...d,pickOrder:null,bans:{A:d.bans.A.slice(),B:d.bans.B.slice()},picks:{A:{...d.picks.A},B:{...d.picks.B}}};
  return draftAct(next,choice.c,choice.role,choice.offrole)?next:null;
}

// 为候选打分：value 为决策分（lookahead=true 时含一步推演），gain 为这一手对己方的预估收益。
// 选人 gain = 选后 − 选前的 BP 胜率估算分差（evalDraft.diff，己方视角，与胜率单调）；
// 禁人不改变胜率估算，gain = 0.9×对手损失 − 0.85×己方损失（禁掉自己下一手的首选为负）。
function aiDraftAssess(d, ranked, lookahead){
  const cur=draftSide(d), mine=cur.side, enemy=mine==='A'?'B':'A';
  const margin=state=>evalDraft(state).diff*(mine==='A'?1:-1);
  if(cur.kind==='ban'){
    const prospects=side=>{
      for(let step=d.step+1;step<DRAFT_SEQ.length;step++){
        const future={...d,step}, turn=draftSide(future);
        if(turn.kind==='pick' && turn.side===side) return aiDraftCandidates(future,3,false);
      }
      return [];
    };
    const ours=prospects(mine), theirs=prospects(enemy);
    const loss=(rank,champ)=>rank.length>=2 && rank[0].c===champ?Math.max(0,rank[0].score-rank[1].score):0;
    return ranked.map(choice=>{
      const gain=0.9*loss(theirs,choice.c) - 0.85*loss(ours,choice.c);
      return {choice, gain, value: lookahead ? choice.score + gain : choice.score};
    });
  }
  const before=margin(d);
  return ranked.map(choice=>{
    const next=draftAfterChoice(d,choice);
    if(!next) return {choice, gain:-Infinity, value:-Infinity};
    const now=margin(next), gain=now-before;
    if(!lookahead) return {choice, gain, value:choice.score};
    const turn=draftSide(next);
    if(turn?.kind!=='pick') return {choice, gain, value:choice.score*0.62 + now};
    const responses=aiDraftCandidates(next,3,false).map(reply=>draftAfterChoice(next,reply)).filter(Boolean).map(margin);
    const reaction=responses.length?(turn.side===mine?Math.max(...responses):Math.min(...responses)):now;
    return {choice, gain, value:choice.score*0.62 + now + (reaction-now)*0.65};
  });
}

function aiChoose(d,{lookahead=false}={}){
  const ranked=aiDraftCandidates(d,lookahead?6:1,!lookahead);
  if(!ranked.length) return {c:null};
  if(!lookahead || ranked.length===1) return ranked[0];
  let winner=ranked[0], best=-Infinity;
  for(const {choice,value} of aiDraftAssess(d,ranked,true)){ if(value>best){ winner=choice; best=value; } }
  return winner;
}

// 对手 BP 难度（仅玩家亲自 BP 时的对手使用）：
// hard   = aiChoose 深思考，始终最优；
// normal = 深思考后在前 3 名里按 60/25/15 加权抽取；
// easy   = 不推演，在前 5 名里按分数 softmax（温度 1.5）加权抽取。
// 普通 / 简单 都先剔除 gain < 0 的候选（会降低己方预估胜率的选人、伤自己多于伤对手的禁人）；
// 全部为负时退回决策分最高的一手。rand 可注入，便于测试。
const AI_DRAFT_LEVELS = ['easy','normal','hard'];
const AI_DRAFT_LEVEL_RULES = {
  easy:   {pool:8, take:5, lookahead:false, temp:1.5},
  normal: {pool:6, take:3, lookahead:true,  weights:[0.6,0.25,0.15]},
};
function aiDraftLevelOptions(d, level){
  const rule=AI_DRAFT_LEVEL_RULES[level];
  if(!rule || !draftSide(d)) return {rule, all:[], eligible:[]};
  const ranked=aiDraftCandidates(d,rule.pool,false);
  const all=aiDraftAssess(d,ranked,rule.lookahead).sort((x,y)=>y.value-x.value);
  const eligible=all.filter(x=>x.gain>=0 && x.value>-Infinity).slice(0,rule.take);
  return {rule, all, eligible};
}
function aiChooseLevel(d, level='normal', rand=draftSimulationRandom(d)){
  if(!AI_DRAFT_LEVEL_RULES[level]) return aiChoose(d,{lookahead:true});
  const {rule, all, eligible}=aiDraftLevelOptions(d, level);
  if(!all.length) return {c:null};
  if(!eligible.length) return all[0].choice;
  const weights = rule.weights
    ? eligible.map((_,i)=>rule.weights[i]||0)
    : eligible.map(x=>Math.exp((x.value-eligible[0].value)/rule.temp));
  const total=weights.reduce((s,w)=>s+w,0);
  let r=rand()*total;
  for(let i=0;i<eligible.length;i++){ r-=weights[i]; if(r<0) return eligible[i].choice; }
  return eligible[eligible.length-1].choice;
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
    const tacticGain = d.step>=12 ? draftTacticGain(d.picks[opp],d.picks[side]) : null;
    for(const c of CHAMP_KEYS){
      if(un.has(c)) continue;
      const roles = oppOpen.filter(r=>CH[c].roles.includes(r));
      if(!roles.length) continue;
      let bestR = roles[0], bestF = -99;
      for(const r of roles){ const f=champFit(oppLu[r],c,r); if(f>bestF){bestF=f;bestR=r;} }
      let s = bestF*1.1 + ((S.meta[c]||0)>=2?2.2:0);
      let reason = playerProfTier(oppLu[bestR],c).tier===4 ? `针对 ${playerTag(oppLu[bestR])} 招牌` : (S.meta[c]||0)>=2 ? '版本T0威胁' : `限制对方${ROLE_CN[bestR]}`;
      if(tacticGain){
        const gain = Math.max(0, ...roles.map(r=>tacticGain(r,c)));
        s += 1.6*gain;
        if(gain>=0.4) reason = '拆解对手技能联动或关键克制';
      }
      out.push({c, score:s, reason});
    }
  } else {
    const allowOff = !hasAnyOnRoleChamp(d, side);
    const tacticGain = draftTacticGain(d.picks[side],d.picks[opp]);
    const allowsPair = draftBotPairFilter(d.picks[side],un);
    for(const c of CHAMP_KEYS){
      if(un.has(c)) continue;
      const roles = (allowOff ? myOpen : myOpen.filter(r=>CH[c].roles.includes(r))).filter(r=>allowsPair(r,c));
      if(!roles.length) continue;
      let bestR = roles[0], bestS = -99, bestReason = '';
      const nextComp = compInfo(myPicks.concat(c));
      const compGain = nextComp.score - baseComp.score;
      for(const r of roles){
        const fit = champFit(myLu[r],c,r);
        const gain = tacticGain(r,c);
        let s = fit + compGain*1.1 + 2.4*gain + ((S.meta[c]||0)>=2?1.0:0);
        if(myPicks.length>=3 && baseComp.ad>=3 && CH[c].dmg==='AP') s+=1.2;
        if(myPicks.length>=3 && baseComp.ap>=3 && CH[c].dmg==='AD') s+=1.2;
        if(s > bestS){
          bestS = s; bestR = r;
          bestReason = fit>=5.5 ? `${playerTag(myLu[r])} 招牌` : (S.meta[c]||0)>=2 ? '版本T0强抢' : compGain>=0.8 ? '极佳阵容搭配' : (CH[c].roles.length>=2&&myPicks.length<3?'优质摇摆位':`适配${ROLE_CN[r]}`);
          if(gain>=0.28) bestReason = '有利的英雄克制或分路联动';
        }
      }
      out.push({c, role:bestR, score:bestS, reason:bestReason});
    }
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,3);
}

function draftPower(d, side){
  const opp = side==='A' ? 'B' : 'A';
  const team=d[side], lu=lineupMap(team), picks=d.picks[side], oppPicks=d.picks[opp]||{};
  let s=0, det=[];
  let earlyP=0, midP=0, lateP=0;
  const ci = compInfo(Object.values(picks).filter(Boolean));
  let tacBonus = 0, tacEarly = 0;

  for(const r of ROLES){
    const p=lu[r], c=picks[r];
    const base = draftPlayerRating(p, r, d.ctx);
    let fit = c? champFit(p,c,r) : 0;
    // 战术奇招情境判定：法核下路补齐 AP、长手上路压制短手坦克等
    if(c && CH[c] && !CH[c].roles.includes(r)){
      const ok = offRoleKind(c, r);
      const otherList = ROLES.filter(x=>x!==r).map(x=>picks[x]).filter(Boolean);
      const otherCi = compInfo(otherList);
      if(ok.kind === 'apc_bot' && otherCi.ad >= 2.5){
        tacBonus += 1.65;
        if(!ci.notes.includes('法核下路奇招')) ci.notes.unshift('法核下路奇招');
      } else if(ok.kind === 'ranged_top'){
        const oppTop = oppPicks.TOP;
        if(oppTop && IMMOBILE_MELEE_TOPS.has(oppTop)){
          tacBonus += 1.85; tacEarly += 0.9;
          if(!ci.notes.includes('长手上路压制')) ci.notes.unshift('长手上路压制');
        } else if((ci.tags.engage||0) >= 1){
          tacBonus += 0.7;
        }
      } else if(ok.kind === 'flex_mid' && CH[c].dmg==='AD' && otherCi.ap >= 2.0){
        tacBonus += 1.25;
        if(!ci.notes.includes('中路摇摆奇招')) ci.notes.unshift('中路摇摆奇招');
      }
    }
    const total = base + fit*DRAFT_FIT_WEIGHT;
    s += total;
    earlyP += total * ({TOP:.20,JUG:.28,MID:.20,ADC:.14,SUP:.18}[r]);
    midP   += total * ({TOP:.22,JUG:.22,MID:.24,ADC:.18,SUP:.14}[r]);
    lateP  += total * ({TOP:.18,JUG:.14,MID:.24,ADC:.30,SUP:.14}[r]);
    det.push({r,p,c,fit,base});
  }
  const tacShare = tacBonus * 0.85 / 5;
  const notes = [], risks=[];
  const tactics = draftTactics(picks,oppPicks,undefined,notes,risks);
  ci.notes.unshift(...notes,...risks);
  const chem = teamChemistry(team);
  const chemB = chem.bonus; // 团队化学反应轻中度加成（满默契约 +2.0，生疏拼凑约 -1.8）
  return {
    power: s/5 + (ci.score + tacShare + tactics.score)*DRAFT_COMPOSITION_WEIGHT + chemB,
    early: earlyP + (ci.early*1.1 + tacShare + tacEarly + tactics.early)*DRAFT_COMPOSITION_WEIGHT + chemB*0.85,
    mid:   midP   + (ci.mid + ci.score*0.6 + tacShare + tactics.mid)*DRAFT_COMPOSITION_WEIGHT + chemB*1.05,
    late:  lateP  + (ci.late*1.15 + ci.score*0.7 + tacShare*0.8 + tactics.late)*DRAFT_COMPOSITION_WEIGHT + chemB*1.1,
    comp: ci, chem, det, tactics:{notes,risks}
  };
}

function evalDraft(d){
  const a=draftPower(d,'A'), b=draftPower(d,'B');
  const se = styleEdge(a.comp.style, b.comp.style);
  const blueEdge = d.blue==='A' ? 0.35 : -0.35;
  // 三阶段分差使用与比赛相同的权重，再将分差换算为胜率。
  const earlyDiff = (a.early - b.early) + blueEdge*0.6;
  const midDiff   = (a.mid   - b.mid)   + se*0.6 + blueEdge*0.4;
  const lateDiff  = (a.late  - b.late)  + se*0.8;
  const diff = earlyDiff*0.30 + midDiff*0.35 + lateDiff*0.35;
  return {a, b, se, blueEdge, earlyDiff, midDiff, lateDiff, diff, pA: sigmoid(diff/DRAFT_WIN_SCALE)};
}

function draftFeedback(d, champ, role){
  const copy=()=>({...d, picks:{A:{...d.picks.A},B:{...d.picks.B}}, bans:{A:d.bans.A.slice(),B:d.bans.B.slice()},pickOrder:null});
  const before=evalDraft(d);
  let shown=before, last=null, prospective=false;
  const step=draftSide(d);
  if(champ && step){
    const next=copy();
    const forcedOffrole=step.kind==='pick' && canPickChamp(d,step.side,champ).offrole;
    if(draftAct(next,champ,role,forcedOffrole)){
      shown=evalDraft(next);
      last={...step,champ};
      prospective=true;
    }
  }
  let base=before;
  if(!last && d.step>0){
    const previous=copy(); previous.step--;
    const action=draftSide(previous);
    if(action.kind==='ban') last={...action,champ:previous.bans[action.side].pop()};
    else {
      const pick=d.pickOrder?.[action.side].at(-1);
      if(pick){
        const slot=ROLES.find(r=>previous.picks[action.side][r]===pick.c);
        if(slot){ delete previous.picks[action.side][slot]; last={...action,champ:pick.c}; }
      }
    }
    if(last) base=evalDraft(previous);
  }
  const sideNotes=draftNotesSplit;
  let banReason='';
  if(last?.kind==='ban' && last.champ){
    const c=last.champ, opponent=last.side==='A'?'B':'A';
    const opponents=lineupMap(d[opponent]);
    const roles=openRolesFor(d,opponent).filter(r=>CH[c].roles.includes(r));
    const specialist=roles.map(r=>opponents[r]).find(p=>playerProfTier(p,c).tier===4);
    if(specialist) banReason=`封锁 ${playerTag(specialist)} 的招牌`;
    else if((S.meta[c]||0)>=1) banReason='封锁当前强势版本英雄';
    else if(roles.length) banReason=`限制对手${roles.map(r=>ROLE_CN[r]).join('、')}可用英雄`;
    else banReason='减少对手可用英雄';
  }
  return {pA:shown.pA, deltaA:shown.pA-base.pA, partial:d.step+(prospective?1:0)<DRAFT_SEQ.length,
    last,banReason,A:sideNotes(shown.a),B:sideNotes(shown.b)};
}

function draftNotesSplit(power){
  const risky=x=>power.tactics.risks.includes(x) || /缺乏|易出|不足|前排薄/.test(x);
  return {advantages:power.comp.notes.filter(x=>!risky(x)), risks:power.comp.notes.filter(risky)};
}

// ---------- BP 复盘 ----------
// 按 DRAFT_SEQ 还原每一步：禁用依次对应 bans 数组，选人按 pickOrder.step 定位，位置取最终落位（含摇摆换位）。
function draftTimeline(d){
  const out=[], bi={A:0,B:0};
  for(let s=0;s<Math.min(d.step,DRAFT_SEQ.length);s++){
    const t=draftSide({...d,step:s});
    if(t.kind==='ban'){ out.push({step:s,kind:'ban',side:t.side,champ:d.bans[t.side][bi[t.side]++]||null}); continue; }
    const po=(d.pickOrder?.[t.side]||[]).find(x=>x.step===s);
    const role=po ? (ROLES.find(r=>d.picks[t.side][r]===po.c) || po.r) : null;
    out.push({step:s,kind:'pick',side:t.side,champ:po?po.c:null,role});
  }
  return out;
}
function draftStateAt(d, line, s){
  const st={...d,step:s,pickOrder:null,bans:{A:[],B:[]},picks:{A:{},B:{}}};
  for(const a of line){
    if(a.step>=s) break;
    if(!a.champ) continue;
    if(a.kind==='ban') st.bans[a.side].push(a.champ); else st.picks[a.side][a.role]=a.champ;
  }
  return st;
}
const sideP=(st,side)=>{ const p=evalDraft(st).pA; return side==='A'?p:1-p; };
function nextPickState(st, who){
  for(let s=st.step+1;s<DRAFT_SEQ.length;s++){
    const f={...st,step:s}, t=draftSide(f);
    if(t.kind==='pick' && t.side===who) return f;
  }
  return null;
}
// 某方在 f 这一手的几个好选择及选后胜率（含 extra，便于衡量禁掉它的影响）
function draftPickOutcomes(f, who, extra, limit=6){
  if(!f) return [];
  const ranked=aiDraftCandidates(f,limit,false);
  if(extra && CH[extra] && !ranked.some(x=>x.c===extra) && !unavailable(f).has(extra)){
    const role=bestRoleFor(f,who,extra,false);
    if(role) ranked.push({c:extra,role,offrole:false});
  }
  return ranked.map(ch=>{
    const next=draftAfterChoice(f,ch);
    return next ? {c:ch.c, role:ch.role, p:sideP(next,who), next} : null;
  }).filter(Boolean);
}
// 禁掉 c 让该方这一手的最好结果下降多少
// （取前三个好选择的平均，避免“只要还有一个替代就算零影响”）
function draftDenied(c, outcomes){
  const top=list=>{ const v=list.map(o=>o.p).sort((a,b)=>b-a).slice(0,3); return v.length ? v.reduce((s,x)=>s+x,0)/v.length : 0; };
  const rest=outcomes.filter(o=>o.c!==c);
  return outcomes.length && rest.length ? Math.max(0, top(outcomes)-top(rest)) : 0;
}
// 这一手选人的理由：熟练度、版本、位置、对位、以及阵容提示的增减
function draftPickReasons(before, after, side, champ, role){
  const opp=side==='A'?'B':'A';
  const pros=[], cons=[];
  const p=lineupMap(before[side])[role];
  if(p){
    const tier=playerProfTier(p,champ).tier;
    if(tier>=4) pros.push(`${playerTag(p)} 的招牌英雄`);
    else if(tier===3) pros.push(`${playerTag(p)} 精通该英雄`);
    else if(tier===1) cons.push(`${playerTag(p)} 只是略懂该英雄`);
    else if(tier===0) cons.push(`${playerTag(p)} 对该英雄生疏`);
  }
  const meta=S.meta[champ]||0;
  if(meta>=2) pros.push('版本 T0 英雄');
  else if(meta>=1) pros.push('版本强势英雄');
  else if(meta<0) cons.push('版本弱势英雄');
  if(!CH[champ].roles.includes(role)) cons.push(`非本位英雄（打${ROLE_CN[role]}）`);
  const foe=before.picks[opp][role];
  if(foe && CH[foe]){
    const edge=laneTacticEdge(champ,foe)-laneTacticEdge(foe,champ);
    if(edge>=0.2) pros.push(`对位${CH[foe].cn}占优`);
    else if(edge<=-0.2) cons.push(`对位被${CH[foe].cn}压制`);
  }
  const n0=draftNotesSplit(draftPower(before,side)), n1=draftNotesSplit(draftPower(after,side));
  n1.advantages.filter(x=>!n0.advantages.includes(x)).forEach(x=>pros.push(x));
  n0.risks.filter(x=>!n1.risks.includes(x)).forEach(x=>pros.push('补上短板：'+x));
  n1.risks.filter(x=>!n0.risks.includes(x)).forEach(x=>cons.push(x));
  const o0=draftNotesSplit(draftPower(before,opp)), o1=draftNotesSplit(draftPower(after,opp));
  o0.advantages.filter(x=>!o1.advantages.includes(x)).forEach(x=>pros.push('化解对手：'+x));
  o1.advantages.filter(x=>!o0.advantages.includes(x)).forEach(x=>cons.push('让对手受益：'+x));
  return {pros:pros.slice(0,4), cons:cons.slice(0,3)};
}
const REVIEW_GOOD_GAP = 0.01, REVIEW_BAD_GAP = 0.035, REVIEW_BETTER_GAP = 0.02;
function reviewGrade(gap){ return gap<=REVIEW_GOOD_GAP ? 'good' : gap>=REVIEW_BAD_GAP ? 'bad' : 'ok'; }

// laterOwn：我方之后仍会拿到的英雄，不算作“更好的选择”（只是顺序不同）
function reviewPickStep(before, act, laterOwn=new Set()){
  const side=act.side;
  const p0=sideP(before,side);
  const after=draftAfterChoice(before,{c:act.champ,role:act.role,offrole:!CH[act.champ].roles.includes(act.role)});
  if(!after) return null;
  const p1=sideP(after,side);
  const alts=draftPickOutcomes(before,side,null,8).filter(o=>o.c!==act.champ && !laterOwn.has(o.c));
  const best=alts.reduce((a,b)=>!a||b.p>a.p?b:a,null);
  const gap=best?Math.max(0,best.p-p1):0;
  const edge=alts.length ? p1-alts.reduce((s,o)=>s+o.p,0)/alts.length : 0;
  const why=draftPickReasons(before,after,side,act.champ,act.role);
  let better=null;
  if(best && gap>=REVIEW_BETTER_GAP){
    const bw=draftPickReasons(before,best.next,side,best.c,best.role);
    better={champ:best.c, role:best.role, gain:gap, pros:bw.pros.slice(0,2)};
  }
  return {...act, pBefore:p0, pAfter:p1, delta:p1-p0, edge, gap, grade:reviewGrade(gap), ...why, better};
}

function reviewBanStep(before, act){
  const side=act.side, opp=side==='A'?'B':'A', c=act.champ;
  const theirTurn=nextPickState(before,opp);
  const theirs=draftPickOutcomes(theirTurn,opp,c);
  const ours=draftPickOutcomes(nextPickState(before,side),side,c);
  const value=x=>draftDenied(x,theirs)-draftDenied(x,ours);
  const v=value(c), denied=draftDenied(c,theirs), cost=draftDenied(c,ours);
  let best=null;
  for(const o of theirs){ if(o.c===c) continue; const s=value(o.c); if(!best || s>best.s) best={c:o.c,role:o.role,s}; }
  const gap=best?Math.max(0,best.s-v):0;
  const pros=[], cons=[];
  const oppLu=lineupMap(before[opp]);
  const roles=openRolesFor(before,opp).filter(r=>CH[c].roles.includes(r));
  const specialist=roles.map(r=>oppLu[r]).find(p=>p && playerProfTier(p,c).tier===4);
  if(specialist) pros.push(`封锁 ${playerTag(specialist)} 的招牌`);
  const meta=S.meta[c]||0;
  if(meta>=2) pros.push('封掉版本 T0 英雄'); else if(meta>=1) pros.push('封掉版本强势英雄');
  if(denied>=0.008) pros.push(`对手少了一手好牌（约 ${(denied*100).toFixed(1)}%）`);
  const theirPick=theirs.find(o=>o.c===c);
  if(theirPick && denied>=0.004){
    const n0=draftNotesSplit(draftPower(theirTurn,opp)).advantages, n1=draftNotesSplit(draftPower(theirPick.next,opp)).advantages;
    const gained=n1.find(x=>!n0.includes(x));
    if(gained) pros.push('阻止对手：'+gained);
  }
  if(!roles.length) cons.push('对手已经没有能用它的空位');
  else if(denied<0.003) cons.push(pros.length ? '但对手还有同等强度的替代选择' : '对手下一手不太会选它，影响很小');
  if(cost>=0.008) cons.push(`它也是我方下一手的好选择，禁掉损失约 ${(cost*100).toFixed(1)}%`);
  let better=null;
  if(best && gap>=REVIEW_BETTER_GAP) better={champ:best.c, role:best.role, gain:gap, pros:[`对手下一手很可能拿它打${ROLE_CN[best.role]}`]};
  // 禁用没有实际削弱对手时最多算“一般”
  const grade=denied<0.003 && gap<REVIEW_BAD_GAP ? 'ok' : reviewGrade(gap);
  return {...act, value:v, denied, cost, gap, grade, pros:pros.slice(0,4), cons:cons.slice(0,3), better};
}

// 赛前 BP 复盘：逐条评估 side 方的禁用和选择，并找出对手最伤我方的选择。
function draftReview(d, side){
  const line=draftTimeline(d), opp=side==='A'?'B':'A';
  const steps=[], hurt=[];
  let nb=0, np=0;
  for(const act of line){
    if(!act.champ || !CH[act.champ]) continue;
    const before=draftStateAt(d,line,act.step);
    if(act.side===side){
      const laterOwn=new Set(line.filter(x=>x.side===side && x.kind==='pick' && x.step>act.step).map(x=>x.champ));
      const r=act.kind==='ban' ? reviewBanStep(before,act) : reviewPickStep(before,act,laterOwn);
      if(!r) continue;
      r.label=act.kind==='ban' ? `禁用 ${++nb}` : `选择 ${++np}`;
      steps.push(r);
    } else if(act.kind==='pick'){
      const after=draftAfterChoice(before,{c:act.champ,role:act.role,offrole:!CH[act.champ].roles.includes(act.role)});
      if(!after) continue;
      const alts=draftPickOutcomes(before,opp,null,5).filter(o=>o.c!==act.champ);
      if(!alts.length) continue;
      const impact=sideP(after,opp)-alts.reduce((s,o)=>s+o.p,0)/alts.length;
      if(impact<0.01) continue;
      hurt.push({...act, impact, pros:draftPickReasons(before,after,opp,act.champ,act.role).pros.slice(0,3)});
    }
  }
  hurt.sort((a,b)=>b.impact-a.impact);
  const good=steps.filter(s=>s.grade==='good' && s.pros.length)
    .sort((a,b)=>(b.kind==='ban'?b.denied:b.edge)-(a.kind==='ban'?a.denied:a.edge)).slice(0,2);
  const bad=steps.filter(s=>s.gap>=REVIEW_BETTER_GAP).sort((a,b)=>b.gap-a.gap).slice(0,2);
  return {side, pFinal:sideP(d,side), steps, hurt:hurt.slice(0,2), good, bad};
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

// 5v5 对局模拟：见 sim.js（playGame / createGame5 / step5）

// 赛后联动：选手状态 form 波动 & 英雄熟练度成长
function applyGameImpact(g, teamA, teamB, random=rnd){
  const impacts = [];
  g.masteryChanges=[];
  const handleSide = (side, stats) => {
    const won = g.w === side;
    const isUserTeam = (side==='A'?teamA:teamB) === S.user;
    for(const row of stats){
      const p = P(row.pid); if(!p) continue;
      const isMvp = row.pid === g.mvp;
      const kda = (row.k + row.a) / Math.max(1, row.d);
      // 状态变化：近期个人表现为主，向个人历来表现基线回归，幅度乘以稳定性，噪声很小
      const tr = playerTraits(p);
      const perf = (won?0.45:-0.45) + clamp((kda-3)/3, -1, 1)*0.55 + (isMvp?0.5:0);
      const development=p.development||(p.development={games:0,performance:0});
      development.games++;
      development.performance+=perf;
      const f0 = p.form||0;
      p.form = stepTier(f0, f0 + perf*0.9*tr.stab + (tr.base - f0)*0.18 + randn(random)*0.3*tr.stab);
      // 小局对心态的即时影响：胜负只占一部分，个人发挥（被打爆还是carry）同样关键，并向个人性格基线回归
      const m0 = p.mental||0;
      const ind = gamePerf(row, isMvp);
      const dTeam = won ? 0.14*tr.res : -0.2/tr.res;
      const dInd = ind >= 0 ? ind*0.32*tr.res : ind*0.38/tr.res;
      p.mental = stepTier(m0, m0 + dTeam + dInd + (mentalBase(p) - m0)*0.08 + randn(random)*0.15);
      // 英雄熟练度经验累积（每次出场累积熟练度数值，跨过档位线时晋升档位）
      if(row.c && CH[row.c]){
        const prev=champProfVal(p,row.c);
        const gain = Math.round(3 + (won?3:1) + clamp((kda-2)*0.9, 0, 3) + (isMvp?2:0));
        const next=prev>0?Math.min(100,prev+gain):clamp(16+gain+(CH[row.c].roles.includes(p.role)?6:0),18,42);
        const oldTier=playerProfTier(p,row.c,prev).tier;
        p.champGames ||= {};
        p.champGames[row.c]=(p.champGames[row.c]||0)+1;
        rememberChampProf(p,row.c,next);
        if(isUserTeam){
          const newInfo=playerProfTier(p,row.c,next);
          const suffix=newInfo.tier>oldTier && newInfo.tier>=2 ? `，晋升为「${newInfo.name}」` : '';
          g.masteryChanges.push({pid:p.pid,tag:playerTag(p),champ:row.c,prev,next,gain:next-prev});
          if(next>prev) impacts.push(`${playerTag(p)} · ${CH[row.c].cn} 熟练度 +${next-prev}（${next}/100）${suffix}`);
        }
      }
      if(isUserTeam && isMvp) impacts.push(`${playerTag(p)} 斩获 MVP，状态 ${FORM_TIERS[formTier(p)+2]}`);
    }
  };
  handleSide('A', g.sa);
  handleSide('B', g.sb);
  return impacts;
}

// 临场发挥（v2.1.10）：每队每局一个隐藏的整体发挥浮动，外加整个系列赛共享的一个较小浮动，
// 单位与阵容强度（draftPower 各阶段）相同。用来制造合理的爆冷：
// 队伍均分差 5 分时，强队单局胜率约 65%、BO5 约 78%；实力接近的对局仍约五五开。
const FORM_SWING = { game:6, series:2.5 };
const REGION_RANK_NOISE = 3;     // 非 LPL 赛区按战力 + 噪声排名
const DEV_GROWTH_MUL = 1.5;
function ensureSeriesForm(ctx){
  if(!ctx) return ctx;
  if(ctx.simSeed==null) ctx.simSeed=rnd()*0x100000000>>>0;
  if(!ctx.sform){
    const random=srand(seriesSimulationSeed(ctx,-2));
    ctx.sform={A:randn(random)*FORM_SWING.series,B:randn(random)*FORM_SWING.series};
  }
  return ctx;
}
function seriesSimulationSeed(ctx,gameIndex){ return hash(ctx.simSeed+':game:'+gameIndex); }

// 系列赛（AI 自动）
function simSeries(m, keepGames){
  const need=Math.ceil(m.bo/2); let wa=0,wb=0; const games=[]; let locked=[];
  const baseCtx = m.ctx || findMatchCtx(m) || {intl:false, ko:false};
  m.ctx = baseCtx;
  ensureSeriesForm(baseCtx);
  // 仅首局通过 1v1 决定选边权；此后 BO3/BO5 每打一把一律由上一局输方选边
  let chooser = simSolo1v1(m.a, m.b,null,null,{seed:seriesSimulationSeed(baseCtx,-1)}).winner;
  while(wa<need && wb<need){
    const other = chooser==='A'?'B':'A';
    const gameSeed=seriesSimulationSeed(baseCtx,games.length);
    const sidePick = aiChooseSide(m[chooser==='A'?'a':'b'], m[other==='A'?'a':'b'], locked,gameSeed);
    const blue = sidePick==='blue' ? chooser : other;
    const d=newDraft(m.a,m.b,blue,locked);
    d.ctx = Object.assign({}, baseCtx, {decider: wa===need-1 && wb===need-1 && m.bo>1,gameSeed});
    autoDraftRest(d);
    const g=playGame(d); games.push(g);
    if(g.w==='A')wa++; else wb++;
    locked = locked.concat(Object.values(g.picks.A), Object.values(g.picks.B)).filter(Boolean); // 无畏征召
    chooser = g.w==='A'?'B':'A'; // 每局败者获得下一局选边权
  }
  return finishSeries(m, wa, wb, games, keepGames);
}
function finishSeries(m, wa, wb, games, keep){
  m.s=[wa,wb]; m.w = wa>wb? m.a : m.b; m.l = wa>wb? m.b : m.a;
  settleSeriesMental(m, games);
  growSeriesBonds(m, games);
  updateTraitsFromSeries(m, games);
  if(keep) m.gm = games.map(g=>({
    w:g.w, dur:g.dur, kA:g.kA, kB:g.kB,
    turA:g.turA, turB:g.turB, dragA:g.dragA, dragB:g.dragB, baronA:g.baronA, baronB:g.baronB, goldDiff:g.goldDiff,
    mvp:g.mvp, mvpTag:g.mvpTag, picks:g.picks, bans:g.bans, blue:g.blue, events:g.events,
    sa:g.sa, sb:g.sb, rid:g.rid||null, masteryChanges:g.masteryChanges||[]
  }));
  // 英雄统计
  for(const g of games){
    for(const s of ['A','B']) Object.values(g.picks[s]).filter(Boolean).forEach(c=>{ S.log[c]=S.log[c]||{p:0,w:0,b:0}; S.log[c].p++; if(g.w===s)S.log[c].w++; });
    [...g.bans.A,...g.bans.B].filter(Boolean).forEach(c=>{S.log[c]=S.log[c]||{p:0,w:0,b:0};S.log[c].b++;});
  }
  return m;
}

// 系列赛结束：心态结算（连胜连败、淘汰赛与国际赛放大、夺冠/出局带动全队），幅度乘以抗压
function settleSeriesMental(m, games){
  const ctx = m.ctx || findMatchCtx(m) || {};
  const random=ctx.simSeed==null ? rnd : srand(seriesSimulationSeed(ctx,-3));
  const amp = 1 + (ctx.ko?0.6:0) + (ctx.intl?0.4:0);
  const isFinal = ctx.ko && /总决赛|决赛/.test(m.label||'') && !/半决赛|败者组决赛|胜者组决赛/.test(m.label||'');
  for(const [key, won] of [[m.w,true],[m.l,false]]){
    const t = T(key); if(!t) continue;
    t.streak = won ? Math.max(1,(t.streak||0)+1) : Math.min(-1,(t.streak||0)-1);
    const streakAmp = 1 + Math.min(2, Math.abs(t.streak)-1)*0.15;
    const starters = Object.values(t.lineup);
    for(const pid of starters){
      const p = P(pid); if(!p) continue;
      const tr = playerTraits(p);
      const m0 = p.mental||0;
      // 本系列赛个人表现：每局 KDA 与 MVP 的平均
      let indSum = 0, indN = 0;
      for(const g of games||[]){
        const row = (g.sa||[]).concat(g.sb||[]).find(x=>x.pid===pid);
        if(row){ indSum += gamePerf(row, g.mvp===pid); indN++; }
      }
      const ind = indN ? indSum/indN : 0;
      // 胜负对心态的冲击基本对称；抗压强的人输了掉得少；个人发挥决定同队之间的差别
      let dm = won ? 0.4*amp*streakAmp*(0.85+0.15*tr.res) : -0.4*amp*streakAmp/tr.res;
      dm *= clamp(1 + (won?1:-1)*ind*0.35, 0.55, 1.45);
      dm += ind >= 0 ? ind*0.45*tr.res : ind*0.5/tr.res;
      if(isFinal) dm += won ? 1.0 : -0.5/tr.res;
      // 越接近顶点/谷底越难再推：同队一路夺冠时，能否到「无畏」取决于个人发挥与性格
      if(dm*m0 > 0) dm *= Math.max(0.25, 1 - Math.abs(m0)/6.5);
      dm += (mentalBase(p) - m0) * 0.3 * tr.res;
      p.mental = stepTier(m0, m0 + dm + randn(random)*0.25);
    }
    // 替补：没有比赛的选手状态在基线附近漂移；实力够首发却坐板凳的人心态慢慢下滑
    for(const pid of t.roster){
      if(starters.includes(pid)) continue;
      const p = P(pid); if(!p || p.retired) continue;
      const tr = playerTraits(p);
      const f0 = p.form||0, m0 = p.mental||0;
      p.form = stepTier(f0, f0 + (tr.base - f0)*0.12 + randn(random)*0.22*tr.stab);
      const cur = P(t.lineup[p.role]);
      const deserves = cur && p.rating >= cur.rating - 1;
      const mb = mentalBase(p);
      const dm = deserves && m0 > mb - 3 ? -0.28/tr.res : 0;
      p.mental = stepTier(m0, m0 + dm + (mb - m0)*(deserves?0.03:0.1) + randn(random)*0.12);
    }
  }
}
// 根据当前赛事与阶段推断比赛场合（国际赛 / 淘汰赛）
function findMatchCtx(m){
  if(!S || !S.events) return null;
  const INTL_EV = {fst:1, msi:1, ewc:1, worlds:1};
  for(const ev of S.events){
    for(const st of ev.stages){
      if(!st.matches.includes(m)) continue;
      const ko = st.kind==='br' && !/小组赛|入围赛/.test(st.name) || ev.type==='lpl_rf';
      return { intl: !!INTL_EV[ev.type], ko: !!ko };
    }
  }
  return null;
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
const ROSTER_SETUP_INFO = {name:'重新启航（组队）', date:'赛季开始前', loc:'', fmt:'调整首发阵容、转会引援或签约自由选手。确认组队完成后进入第一赛段。'};
function isRosterSetup(ev){ return ev?.type==='window' && ev.rosterSetup===true; }
function eventInfo(ev){ return isRosterSetup(ev) ? ROSTER_SETUP_INFO : EVENT_INFO[ev?.type]; }
function buildSeason({rosterSetup=false}={}){
  S.events = ['lpl_s1','fst','window','lpl_s2','msi','ewc','window','lpl_s3','lpl_rf','worlds','off'].map(type=>({type, stages:[], si:0, done:false, started:false, res:{}}));
  if(rosterSetup) S.events.unshift({type:'window', rosterSetup:true, stages:[], si:0, done:false, started:false, res:{}});
  S.evIdx=0; S.points={}; S.lplOrder.forEach(k=>S.points[k]=0);
  S.rr={}; S.log={};
}
const curEvent = () => S.events[S.evIdx];
function regionRank(region, split){
  S.rr[region]=S.rr[region]||{};
  if(!S.rr[region][split]){
    const ts=Object.values(S.teams).filter(t=>t.region===region).map(t=>[t.key, teamOvr(t.key)+randn()*REGION_RANK_NOISE]);
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
      awardEventTraits('fst', pl[0], []);
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
      awardEventTraits('msi', pl[0], pl.slice(-2));
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
      awardEventTraits('ewc', pl[0], []);
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
      awardEventTraits('worlds', pl[0], []);
      intlPrize(pl,[3000,1500,700,700,350,350,350,350]);
      S.honors.push({year:S.year, worlds:pl[0], runner:pl[1]}); }
  }
};
EV.window={ init(ev){ ev.done=false; }, next(){} };
EV.off={
  init(ev){
    // 进入休赛期时生成下赛季首个大版本的更新日志，供玩家定向安排选手冬训英雄池
    if(!S.nextPatch || S.nextPatch.forYear !== S.year+1){
      const np = generatePatchData(S.meta, `${(S.year+1)%100}.1`);
      np.forYear = S.year + 1;
      S.nextPatch = np;
    }
  },
  next(){}
};

function ensureNextPatch(){
  if(!S.nextPatch || S.nextPatch.forYear !== S.year+1){
    const np = generatePatchData(S.meta, `${(S.year+1)%100}.1`);
    np.forYear = S.year + 1;
    S.nextPatch = np;
  }
  return S.nextPatch;
}

function toggleTrainChamp(pid, champKey){
  const p = P(pid); if(!p || !CH[champKey]) return {ok:false};
  p.trainTargets = Array.isArray(p.trainTargets) ? p.trainTargets : [];
  const idx = p.trainTargets.indexOf(champKey);
  if(idx >= 0){
    p.trainTargets.splice(idx, 1);
    return {ok:true, removed:true};
  }
  if(p.trainTargets.length >= 2){
    p.trainTargets.shift();
  }
  p.trainTargets.push(champKey);
  return {ok:true, added:true};
}

function evolveChampPool(p, metaTable, isOffseason){
  p.champs = Array.isArray(p.champs) ? p.champs : [];
  // 1. 自然遗忘衰减（老英雄长期不练会缓慢流失熟练度）
  const baseDecay = isOffseason ? 8 : 3;
  const history=professionalPicks(p);
  const ov=champOverride(p);
  const signatures=ov?.champs ? topChamps(ov.champs,2) : Object.keys(history).filter(c=>history[c]>=4).slice(0,2);
  p.champs.forEach(e=>{
    const d = Math.round(baseDecay + rnd() * (isOffseason ? 6 : 2));
    const prev=migrateChampProf(e.p);
    e.p = Math.max(signatures.includes(e.c)?Math.min(prev,78):0,prev-d);
  });
  p.champs = p.champs.filter(e=>e.p >= 15);
  for(const c of Object.keys(p.champPractice||{})){
    p.champPractice[c]-=Math.floor(baseDecay*0.5);
    if(p.champPractice[c]<15) delete p.champPractice[c];
  }

  // 2. 自动适应新版本：自发练习 1~2 个本位置英雄（倾向版本加强英雄）
  const rolePool=PROFESSIONAL_HEROES[p.role]||[];
  if(rolePool.length){
    const nLearn = isOffseason ? (p.age<=22 ? 2 : 1 + (rnd()<0.5?1:0)) : 1;
    const weighted = rolePool.map(c=>({c,w:(metaTable[c]||0)*1.6*proAffinity(p,c)+proAffinity(p,c)+rnd()*1.2})).sort((a,b)=>b.w-a.w);
    for(let i=0;i<nLearn && i<weighted.length;i++){
      const c = weighted[i].c;
      const gain = Math.round((isOffseason ? 18 : 8) + rnd() * (isOffseason ? 14 : 6));
      const prev=champProfVal(p,c);
      rememberChampProf(p,c,prev?clamp(prev+gain,15,98):clamp(22+gain,25,68));
    }
  }

  // 3. 休赛期定向英雄池特训结算
  const trainedNames = [];
  if(isOffseason){
    let targets = Array.isArray(p.trainTargets) ? p.trainTargets.slice(0,2) : [];
    // AI 选手也会自动定向特训 1 个下版本强势英雄
    if(p.team !== S.user && !targets.length && rolePool.length){
      const strong = rolePool.filter(k=>(metaTable[k]||0)>=1).sort((a,b)=>proAffinity(p,b)-proAffinity(p,a)).slice(0,3);
      if(strong.length) targets = [pick(strong)];
    }
    for(const c of targets){
      if(!CH[c]) continue;
      const gain = Math.round(28 + (p.age<=22?6:0) + rnd()*10);
      const prev=champProfVal(p,c);
      const value=prev?clamp(prev+gain,30,99):clamp(24+gain,46,72);
      rememberChampProf(p,c,value);
      trainedNames.push(`${CH[c].cn}（${playerProfTier(p,c,value).name}）`);
    }
    p.trainTargets = [];
  }

  p.champs.sort((a,b)=>b.p - a.p);
  if(!p.champs.length) genChampPool(p);
  return trainedNames;
}

function intlPrize(pl, table){ pl.forEach((t,i)=>{ if(t&&table[i]) T(t).budget+=table[i]; }); const u=pl.indexOf(S.user); if(u>=0&&table[u]) addNews(`💰 ${teamName(S.user)} 获得奖金 ${fmtMoney(table[u])}。`); }
function settlePlayerDevelopment(p){
  const games=p.development?.games||0;
  const team=p.team?T(p.team):null;
  const regionalStarter=team && team.region!=='LPL' && Object.values(team.lineup).includes(p.pid);
  const reps=Math.min(1,(games+(regionalStarter?5:0))/12);
  const quality=games?clamp(p.development.performance/games,-0.8,1.2):0;
  const ageFactor=p.age<=22?1:p.age<=26?0.55:p.age<=29?0.24:0.10;
  const room=Math.max(0,p.pot-p.rating);
  // 年度成长整体 ×1.5（v2.1.10：原先一年涨得太少）；90+ 选手不额外削减
  const growth=(room*ageFactor*(0.035+reps*0.10)+quality*reps*ageFactor*0.80)*DEV_GROWTH_MUL;
  const aging=p.age<27?0:(p.age-26)*0.13*(1-reps*0.42);
  const next=clamp(Math.round((p.rating+clamp(growth-aging,-1.6,3.5))*10)/10,45,98);
  p.ratingDelta=Math.round((next-p.rating)*10)/10;
  p.rating=next;
  p.development={games:0,performance:0};
}
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
  evolveTeamBonds(false);
  awardEventTraits('lpl', order[0], order.slice(-4));
  newPatch();
  // 成长、状态回正与赛段间英雄池小幅流转
  Object.values(S.players).forEach(p=>{ if(p.retired) return;
    settlePlayerDevelopment(p);
    const tr = playerTraits(p); p.form = Math.round(clamp((p.form||0)*0.4 + tr.base*0.6 + randn()*0.8*tr.stab, -5, 5)*100)/100; p.mental = Math.round(clamp((p.mental||0)*0.35 + mentalBase(p)*0.65 + randn()*0.6, -5, 5)*100)/100;
    evolveChampPool(p, S.meta, false);
  });
  addNews(`🔧 新版本 ${S.year%100}.${S.patchNo} 上线，英雄强度与选手日常英雄池随之变化。`);
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
function startEvent(){ const ev=curEvent(); if(ev && !ev.started && !isRosterSetup(ev)){ ev.started=true; EV[ev.type].init(ev); } }
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
function canSimRegularSeason(){
  const ev=curEvent();
  return !!ev && !ev.done && /^lpl_s[123]$/.test(ev.type) &&
    (!ev.started || ev.stages[ev.si]?.kind==='rr');
}
function simRegularSeason(){
  const result={played:0, userMatches:[]};
  if(!canSimRegularSeason()) return result;
  startEvent();
  const ev=curEvent(), stage=ev.stages[ev.si];
  while(canSimRegularSeason() && ev.stages[ev.si]===stage){
    const it=nextReadyMatch();
    if(!it || it.st!==stage) break;
    playPhaseMatch(it, result);
  }
  return result;
}
function playPhaseMatch(it, result){
  playAI(it);
  result.played++;
  const m=it.m;
  if(!userInvolved(m)) return;
  const won=m.w===S.user;
  addNews(`${won?'胜':'负'}：${teamName(m.a)} ${m.s[0]}:${m.s[1]} ${teamName(m.b)}（${m.label}）`);
  result.userMatches.push({a:m.a,b:m.b,s:m.s.slice(),won,label:m.label});
}
// 模拟当前单轮（常规赛仅推完本轮、瑞士轮仅推完本轮、淘汰赛仅推完本轮对阵），包含玩家本轮的比赛，本轮打完即止
function simCurrentRound(){
  startEvent();
  const ev = curEvent();
  if(!ev || ev.done) return { played:0, userMatches:[] };
  const startSi = ev.si;
  const firstPool = stageMatches(ev);
  if(!firstPool.length) return { played:0, userMatches:[] };
  const st0 = firstPool[0].st;
  const targetRnd = st0.kind==='rr' ? firstPool[0].m.rnd : st0.kind==='swiss' ? st0.round : null;
  const targetCol = st0.kind==='br' ? Math.min(...firstPool.map(x => x.m.col != null ? x.m.col : 0)) : null;

  let guard = 0;
  const result={played:0,userMatches:[]};
  while(!ev.done && ev.si === startSi && guard++ < 200){
    const pool = stageMatches(ev).filter(({m, st}) => {
      if(st.kind==='rr') return m.rnd === targetRnd;
      if(st.kind==='swiss') return st.round === targetRnd;
      if(st.kind==='br') return (m.col != null ? m.col : 0) === targetCol;
      return true;
    });
    if(!pool.length) break;
    playPhaseMatch(pool[0], result);
  }
  return result;
}
function advanceEvent(){
  const ev=curEvent(); if(!ev.done) return;
  S.evIdx++;
  if(S.evIdx>=S.events.length){ S.evIdx=S.events.length-1; }
  const nxt=curEvent();
  if(nxt && nxt.type==='off') EV.off.init(nxt);
}
function finishRosterSetup(){
  const ev=curEvent();
  if(!isRosterSetup(ev)) return {ok:false, msg:'当前不在组队阶段。'};
  const probs=lineupProblems(S.user);
  if(probs.length) return {ok:false, msg:`请先调整首发阵容：${probs.join('；')}`};
  ev.started=true;
  ev.done=true;
  advanceEvent();
  return {ok:true, msg:'组队完成，已进入第一赛段。'};
}
function addNews(t){ S.news.unshift({y:S.year, ev:eventInfo(curEvent())?.name||'', t}); if(S.news.length>300) S.news.length=300; }

// ================= 转会（含季中建队非卖品保护、化学反应成本、跨赛区年内极稀有机制） =================
function isMidSeasonWindow(){
  const ev = curEvent();
  return !!(ev && ev.type === 'window' && !isRosterSetup(ev));
}
function transferWindowOpen(){
  const ev=curEvent();
  return !!(ev && (ev.type==='window' || ev.type==='off' ||
    (ev.type==='lpl_s1' && !ev.started && !isRosterSetup(S.events[S.evIdx-1]))));
}
function isOffseasonWindow(){
  const ev = curEvent();
  return !!(ev && ev.type === 'off');
}
function isCrossRegionFor(p, buyerKey){
  if(!p || !p.team || !buyerKey) return false;
  const fromT = T(p.team), toT = T(buyerKey);
  return !!(fromT && toT && fromT.region !== toT.region);
}
// 季中转会窗口期间：各队顶级明星（>=86）、合同未到期的队内头号核心、以及高默契原班主力（默契>=72且>=80分）不轻易挂牌
function isUntouchable(p){
  if(!p || !p.team || !isMidSeasonWindow()) return false;
  const t = T(p.team); if(!t) return false;
  const isStarter = Object.values(t.lineup).includes(p.pid);
  if(!isStarter) return false;
  if(p.rating >= 86) return true;
  if(p.contract > S.year && p.rating >= 81){
    const topStarter = starters(t.key).slice().sort((a,b)=>b.rating - a.rating)[0];
    if(topStarter && topStarter.pid === p.pid) return true;
  }
  if(p.contract > S.year && p.rating >= 80 && playerTeamBond(p) >= 72) return true;
  return false;
}

function askPrice(p, buyerKey){
  const t=T(p.team); let f=1.0;
  if(t && Object.values(t.lineup).includes(p.pid)) f+=0.35;
  if(t && t.tier<=2) f+=0.15;
  if(p.rating>=88) f+=0.25;
  if(p.contract<=S.year) f*=0.72;
  // 队内高默契核心拆队溢价
  if(t && playerTeamBond(p) >= 68) f += 0.18;
  // 年中转会打乱化学反应，所有在约选手身价上浮；跨赛区年中挖人更需天价溢价
  const buyer = buyerKey || S.user;
  const cross = isCrossRegionFor(p, buyer);
  if(isMidSeasonWindow()){
    f *= cross ? 1.85 : 1.32;
  } else if(cross){
    f *= 1.18;
  }
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
  const p=P(pid); const ask=askPrice(p, S.user);
  let offerVal=cash; let gp=null;
  if(givePid){ gp=P(givePid); offerVal += playerValue(gp)*(gp.role===p.role?0.95:0.7); }
  const ratio=offerVal/ask;
  const crossMid = isMidSeasonWindow() && isCrossRegionFor(p, S.user);
  // 年中跨赛区转会极度稀有：必须给出极高溢价才存在成交可能
  const chance = crossMid
    ? clamp((ratio - 1.18) / 0.45, 0, 0.55)
    : clamp((ratio - 0.85) / 0.3, 0, 1);
  return {ask, offerVal, ratio, crossMid, accept: crossMid ? ratio>=1.35 : ratio>=1, chance};
}
function makeOffer(pid, cash, givePid){
  const p=P(pid), me=T(S.user);
  if(cash>me.budget) return {ok:false,msg:'预算不足'};
  if(!p.team){
    signPlayer(pid,S.user,Math.round(p.salary*1.1),S.year+2); me.budget-=cash;
    addNews(`签约：${teamName(S.user)} 签下自由球员 ${playerTag(p)}（${ROLE_CN[p.role]}）。`); return {ok:true,msg:`签约成功！${playerTag(p)} 加盟。`};
  }
  if(isUntouchable(p)) return {ok:false,msg:`${teamName(p.team)} 将 ${playerTag(p)} 视为季中非卖核心，拒绝在赛段间拆散默契班底。`};
  const e=evaluateOffer(pid,cash,givePid);
  const accept = e.crossMid
    ? (e.ratio >= 1.45 || (e.ratio >= 1.2 && rnd() < e.chance))
    : (e.ratio >= 1.05 || (e.ratio >= 0.9 && rnd() < e.chance));
  if(!accept){
    return {ok:false, msg: e.crossMid
      ? `${teamName(p.team)} 拒绝了季中跨赛区挖角（跨区转会通常仅在年底休赛期发生，心理底价约 ${fmtMoney(e.ask)}）。`
      : `${teamName(p.team)} 拒绝了报价（对方心理价位约 ${fmtMoney(e.ask)}）。`};
  }
  const seller=p.team;
  me.budget-=cash; T(seller).budget+=cash;
  signPlayer(pid,S.user,Math.max(p.salary,Math.round(fairSalary(p)*1.05)),S.year+2);
  if(givePid){ signPlayer(givePid,seller,P(givePid).salary,P(givePid).contract); }
  ensureRoster(seller);
  addNews(`转会：${playerTag(p)} 从 ${teamName(seller)} 加盟 ${teamName(S.user)}${cash?`，转会费 ${fmtMoney(cash)}`:''}${givePid?`，${playerTag(P(givePid))} 反向加盟 ${teamName(seller)}`:''}。`);
  return {ok:true,msg:'交易达成！'};
}
function bidsFor(pid){
  const p=P(pid), v=playerValue(p);
  const mid = isMidSeasonWindow();
  return Object.values(S.teams).filter(t=>{
    if(t.key===S.user || t.budget<=v*0.8 || !canTeamFitForeign(t, p)) return false;
    // 年中窗口外赛区几乎不主动报价求购
    if(mid && t.region !== T(S.user).region && rnd() > 0.08) return false;
    return true;
  })
    .map(t=>{ const cur=P(t.lineup[p.role]); const need = cur? (p.rating-cur.rating) : 10; return {t:t.key, need, price: Math.round(v*(0.75+rnd()*0.35+Math.max(0,need)*0.02))}; })
    .filter(b=>b.need>-2 && b.price<=T(b.t).budget).sort((a,b)=>b.price-a.price).slice(0,3);
}
function sellPlayer(pid, buyer, price){
  const p=P(pid); const me=T(S.user);
  me.budget+=price; T(buyer).budget-=price;
  signPlayer(pid,buyer,p.salary,Math.max(p.contract,S.year+1)); autoLineup(buyer);
  addNews(`转会：${teamName(S.user)} 将 ${playerTag(p)} 以 ${fmtMoney(price)} 出售给 ${teamName(buyer)}。`);
}
function releasePlayer(pid){ const p=P(pid); const t=T(p.team); const pay=Math.round(p.salary*0.5); t.budget-=pay; t.roster=t.roster.filter(x=>x!==pid); for(const r of ROLES) if(t.lineup[r]===pid) delete t.lineup[r]; p.team=null; addNews(`解约：${teamName(S.user)} 与 ${playerTag(p)} 解约（支付违约金 ${fmtMoney(pay)}）。`); }
function aiTransfers(n){
  const mid = isMidSeasonWindow();
  // 年中转会窗：AI 几乎不主动拆队（避免破坏化学反应），仅极少次数补强短板
  const attempts = mid ? (rnd() < 0.35 ? 1 : 0) : n;
  const ts=Object.values(S.teams).filter(t=>t.key!==S.user);
  for(let i=0;i<attempts;i++){
    const buyer=pick(ts); const role=pick(ROLES); const cur=P(buyer.lineup[role]); if(!cur) continue;
    const curBond = playerTeamBond(cur);
    // 队内默契高时不轻易换人（除非升级幅度显著）
    const minGain = mid ? (curBond >= 60 ? 6 : 4) : (curBond >= 72 ? 4 : 2.5);
    const allowCross = mid ? (rnd() < 0.03) : (rnd() < 0.16);
    const cands=Object.values(S.players).filter(p=>{
      if(p.role!==role || !p.team || p.team===buyer.key || p.team===S.user) return false;
      if(isUntouchable(p)) return false;
      const cross = T(p.team).region !== buyer.region;
      if(cross && !allowCross) return false;
      return p.rating > cur.rating + minGain && askPrice(p, buyer.key) < buyer.budget*0.55 && canTeamFitForeign(buyer, p);
    });
    if(!cands.length) continue;
    const p=pick(cands.slice(0,30)); const price=askPrice(p, buyer.key); const from=p.team;
    const crossTag = T(from).region !== buyer.region ? '【重磅跨赛区转会】' : '';
    buyer.budget-=price; T(from).budget+=price;
    signPlayer(p.pid,buyer.key,fairSalary(p),S.year+2);
    autoLineup(buyer.key); ensureRoster(from);
    addNews(`${crossTag}${playerTag(p)} 以 ${fmtMoney(price)} 从 ${teamName(from)} 转会至 ${teamName(buyer.key)}。`);
  }
}
// ================= 休赛期 / 新赛季 =================
function finishOffseason(){
  const y=S.year;
  const np = ensureNextPatch();
  Object.values(S.players).forEach(p=>{ if(!p.team || p.contract>y) return;
    if(p.team===S.user){ if(!p.renewed){ const t=T(p.team); t.roster=t.roster.filter(x=>x!==p.pid); for(const r of ROLES) if(t.lineup[r]===p.pid) delete t.lineup[r]; p.team=null; addNews(`离队：${playerTag(p)} 合同到期离队，成为自由球员。`);} }
    else if(rnd()<0.8 || T(p.team).roster.length<=5){ p.contract=y+1+Math.floor(rnd()*2); p.salary=fairSalary(p); }
    else { const t=T(p.team); t.roster=t.roster.filter(x=>x!==p.pid); for(const r of ROLES) if(t.lineup[r]===p.pid) delete t.lineup[r]; p.team=null; }
    p.renewed=false; });
  Object.values(S.players).forEach(p=>{ if(!p.team && !p.retired && p.age>=29 && rnd()<0.5){ p.retired=true; } p.age++; });
  // 兑现新赛季版本 & 结算全员年度英雄池流转、定向冬训与团队化学反应
  S.year = y + 1;
  Object.values(S.players).forEach(p=>{ p.ratingYearStart=p.rating; p.ratingDelta=0; });
  S.patchNo = 0;
  newPatch(np);
  S.nextPatch = null;
  evolveTeamBonds(true);
  const userTrainLogs = [];
  Object.values(S.players).forEach(p=>{
    if(p.retired) return;
    const trained = evolveChampPool(p, S.meta, true);
    if(p.team===S.user && trained.length) userTrainLogs.push(`${playerTag(p)} → ${trained.join('、')}`);
  });
  for(let i=0;i<20;i++) genRookie(S.year);
  Object.values(S.teams).forEach(t=>ensureRoster(t.key));
  aiTransfers(12);
  Object.values(S.teams).forEach(t=>{ if(t.key!==S.user) autoLineup(t.key); else { for(const r of ROLES) if(t.lineup[r] && (!P(t.lineup[r]) || P(t.lineup[r]).team!==t.key)) delete t.lineup[r]; } });
  ensureRoster(S.user);
  const s3=S.events.find(e=>e.type==='lpl_s3').res.final;
  const ranked=s3.slice(0,8).concat(S.lplOrder.filter(t=>!s3.slice(0,8).includes(t)).sort((a,b)=>(S.points[b]||0)-(S.points[a]||0)));
  const championOf=type=>S.events.find(e=>e.type===type).res.champ;
  S.history = S.history||[]; S.history.push({year:y, points:{...S.points}, lpl:S.events.filter(e=>/lpl_s/.test(e.type)).map(e=>e.res.champ), fst:championOf('fst'), msi:championOf('msi'), ewc:championOf('ewc'), worlds:championOf('worlds')});
  S.lplOrder=ranked;
  buildSeason();
  if(userTrainLogs.length) addNews(`🎯 冬训成果：${userTrainLogs.join('；')}。`);
  addNews(`🎆 ${S.year} 赛季正式开启！版本 ${np.ver} 实装上线。`);
}
function renewPlayer(pid){ const p=P(pid); const s=Math.round(fairSalary(p)*1.1); p.salary=s; p.contract=S.year+2; p.renewed=true; addNews(`✍️ ${teamName(S.user)} 与 ${playerTag(p)} 续约两年，年薪 ${fmtMoney(s)}。`); return s; }
