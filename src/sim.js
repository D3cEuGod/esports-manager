// ================= 峡谷模拟内核（1v1 SOLO 对线 + 5v5 召唤师峡谷） =================
// 同一套代码两种跑法：极速后台（直接跑完）与实时观战（UI 按倍速逐秒 step）。
// 依赖 engine.js 的全局：CH、ROLES、P、lineupMap、champFit、matchRating、evalDraft、draftPower、
// compInfo、playerTag、teamName、rnd、randn、clamp、sigmoid、mentalTier、playerTraits、pressureOf
const SIM_VER = 1;
const SIM_RATE5 = 15;   // 5v5 观战 1x：1 秒 = 15 秒游戏时间
const SIM_RATE1 = 8;    // 1v1 观战 1x：1 秒 = 8 秒游戏时间

// ---------------- 装备库（Data Dragon 装备 id） ----------------
// [中文名, 价格, 类别]  类别：start 出门 / comp 小件 / boots 鞋 / core 成装 / sup 辅助任务装
const ITEMS = {
  1055:['多兰之刃',450,'start'], 1056:['多兰之戒',400,'start'], 1054:['多兰之盾',450,'start'],
  2003:['生命药水',50,'start'], 3865:['世界地图集',400,'start'],
  1101:['焰爪幼崽',450,'start'], 1102:['风行幼崽',450,'start'], 1103:['苔足幼崽',450,'start'],
  1036:['长剑',350,'comp'], 1052:['增幅典籍',400,'comp'], 1028:['红水晶',400,'comp'], 1004:['仙女护符',200,'comp'],
  1037:['十字镐',875,'comp'], 1058:['无用大棒',1200,'comp'], 1018:['灵巧披风',600,'comp'], 1001:['鞋子',300,'comp'],
  3006:['狂战士胫甲',1100,'boots'], 3020:['法师之靴',1100,'boots'], 3047:['铁板靴',1200,'boots'],
  3111:['水银之靴',1250,'boots'], 3158:['明朗之靴',900,'boots'], 3009:['轻灵之靴',1000,'boots'],
  // 射手
  3031:['无尽之刃',3450,'core'], 3087:['斯塔缇克电刃',2900,'core'], 6672:['海妖杀手',3000,'core'],
  3094:['疾射火炮',2650,'core'], 3036:['多米尼克领主的致意',3000,'core'], 3072:['饮血剑',3400,'core'],
  3046:['幻影之舞',2650,'core'], 3085:['卢安娜的飓风',2650,'core'], 6675:['纳沃利迅刃',2650,'core'],
  3508:['夺萃之镰',2900,'core'], 3026:['守护天使',3200,'core'], 6676:['收集者',3000,'core'], 3033:['凡性的提醒',3000,'core'],
  // 战士
  3078:['三相之力',3333,'core'], 6631:['挺进破坏者',3300,'core'], 3071:['黑色切割者',3000,'core'],
  3053:['斯特拉克的挑战护手',3200,'core'], 6333:['死亡之舞',3300,'core'], 3748:['巨型九头蛇',3300,'core'],
  3074:['贪欲九头蛇',3400,'core'], 3161:['朔极之矛',3100,'core'], 6694:['赛瑞尔达的怨恨',3000,'core'],
  3156:['玛莫提乌斯之噬',3100,'core'], 3065:['振奋盔甲',2900,'core'],
  // 刺客
  3142:['幽梦之灵',2800,'core'], 6692:['星蚀',2900,'core'], 6697:['狂妄',3000,'core'], 3814:['夜之锋刃',2800,'core'],
  6701:['机会',2700,'core'], 3179:['暗影阔剑',2400,'core'], 6696:['公理圆弧',3000,'core'],
  // 法师
  6655:['卢登的伙伴',2750,'core'], 3089:['灭世者的死亡之帽',3500,'core'], 3135:['虚空之杖',3000,'core'],
  4645:['影焰',3200,'core'], 3157:['中娅沙漏',3250,'core'], 3003:['大天使之杖',2900,'core'],
  6653:['兰德里的折磨',3000,'core'], 3165:['莫雷洛秘典',2950,'core'], 3102:['女妖面纱',3000,'core'],
  4646:['风暴狂涌',2900,'core'], 3116:['瑞莱的冰晶节杖',2600,'core'], 6657:['时光之杖',2600,'core'],
  3100:['巫妖之祸',2900,'core'], 4633:['峡谷制造者',3100,'core'], 3152:['海克斯科技火箭腰带',2600,'core'],
  // 坦克
  3068:['日炎圣盾',2700,'core'], 6665:['千变者贾修',3200,'core'], 3075:['荆棘之甲',2450,'core'],
  3143:['兰顿之兆',2700,'core'], 4401:['自然之力',2800,'core'], 3742:['亡者的板甲',2900,'core'],
  6662:['冰脉护手',2900,'core'], 3110:['冰霜之心',2500,'core'], 2502:['无终恨意',2800,'core'],
  8020:['深渊面具',2650,'core'], 3084:['心之钢',3000,'core'],
  // 辅助
  3870:['梦想制造者',400,'sup'], 3869:['天球对立',400,'sup'], 3877:['血之歌',400,'sup'], 3871:['扎扎克的世界尖刺',400,'sup'],
  3504:['炽热香炉',2200,'core'], 6617:['月石再生器',2200,'core'], 3107:['救赎',2300,'core'], 3222:['米凯尔的祝福',2300,'core'],
  6616:['流水法杖',2250,'core'], 2065:['舒瑞娅的战歌',2200,'core'], 3190:['钢铁烈阳之匣',2200,'core'],
  3050:['基克的聚合',2200,'core'], 3109:['骑士之誓',2300,'core'], 4005:['帝国指令',2250,'core'],
};
const ITEM_CN = id => ITEMS[id] ? ITEMS[id][0] : '';
const itemIconUrl = id => `https://ddragon.leagueoflegends.com/cdn/${window.DDRAGON_VER||'16.2.1'}/img/item/${id}.png`;

// 出装路线：start 出门、boots 鞋、core 成装顺序、comp 合成中显示的小件
const BUILDS = {
  adc:      {start:[1055,2003], boots:3006, comp:1036, core:[6672,3031,3036,3046,3072,3026]},
  adcrit:   {start:[1055,2003], boots:3006, comp:1036, core:[6675,3031,3046,3036,3072,3026]},
  apcarry:  {start:[1056,2003], boots:3020, comp:1052, core:[6655,4645,3089,3135,3157,3102]},
  apmage:   {start:[1056,2003], boots:3020, comp:1052, core:[6655,3157,3089,3135,4645,3102]},
  apburn:   {start:[1056,2003], boots:3020, comp:1052, core:[6653,3116,3089,3135,3157,3165]},
  apassn:   {start:[1056,2003], boots:3020, comp:1052, core:[4646,4645,3089,3135,3157,3100]},
  apfighter:{start:[1056,2003], boots:3111, comp:1052, core:[4633,6653,3157,3089,3135,3065]},
  adassn:   {start:[1055,2003], boots:3158, comp:1036, core:[3142,6697,3814,6694,6333,3156]},
  adfight:  {start:[1055,2003], boots:3047, comp:1037, core:[3078,3071,3053,6333,3065,3156]},
  adbrawl:  {start:[1054,2003], boots:3047, comp:1037, core:[6631,3071,3053,6333,3065,3748]},
  tank:     {start:[1054,2003], boots:3047, comp:1028, core:[3068,6665,3075,4401,3143,3742]},
  jugad:    {start:[1101], boots:3047, comp:1036, core:[3142,6692,6333,3053,3071,3156]},
  jugbr:    {start:[1101], boots:3047, comp:1037, core:[3078,3071,6333,3053,3065,3742]},
  jugtank:  {start:[1103], boots:3111, comp:1028, core:[3068,6665,4401,3075,3143,3742]},
  jugap:    {start:[1102], boots:3020, comp:1052, core:[6653,3157,3089,3135,3116,3102]},
  enchant:  {start:[3865,2003], boots:3158, comp:1004, sup:3870, core:[6617,3504,3107,3222,6616,2065]},
  tanksup:  {start:[3865,2003], boots:3047, comp:1028, sup:3869, core:[3190,3050,3109,3107,8020,6665]},
  adsup:    {start:[3865,2003], boots:3158, comp:1036, sup:3877, core:[3142,6697,3814,6694,6333,3156]},
  apsup:    {start:[3865,2003], boots:3020, comp:1052, sup:3871, core:[6653,4005,3116,3157,3165,3135]},
};
const MELEE_MID = new Set(['Yone','Yasuo','Akali','Sylas','Diana','Naafiri','Galio','Ambessa','Pantheon','Lissandra','Swain','Annie','Gragas','Rumble','Taliyah','Cho\'Gath','Neeko','LeBlanc','Twisted Fate']);
const RANGED_X = new Set(['Jayce','Kennen','Gnar','Vayne','Corki','Ezreal','Zoe','Twisted Fate','LeBlanc','Neeko','Taliyah','Swain','Annie','Lissandra','Nidalee','Karthus','Kindred','Graves','Zyra','Brand','Hwei','Mel','Ashe','Senna','Seraphine','Ziggs','Smolder','Lillia']);
function isRanged(c){
  const ch = CH[c]; if(!ch) return false;
  if(RANGED_X.has(c)) return true;
  if(ch.roles.includes('ADC')) return true;
  if(ch.dmg==='AP' && ch.roles.includes('MID') && !MELEE_MID.has(c)) return true;
  if(ch.roles[0]==='SUP' && ch.tags.includes('protect') && !ch.tags.includes('engage')) return true;
  return false;
}
function archetype(c, role){
  const ch = CH[c]; if(!ch) return 'adfight';
  const t = new Set(ch.tags), ap = ch.dmg==='AP', ad = ch.dmg==='AD';
  const tanky = (t.has('engage')||t.has('protect')) && !t.has('scale') && !t.has('split') && !t.has('pick') || ['Ornn','Sion','K\'Sante','Malphite','Cho\'Gath','Zac','Sejuani','Maokai','Skarner','Amumu','Rell','Alistar','Leona','Nautilus','Braum','Tahm Kench','Taric','Poppy'].includes(c);
  if(role==='SUP'){
    if(tanky || (t.has('engage') && !t.has('poke'))) return 'tanksup';
    if(ad && !ch.roles.includes('ADC')) return 'adsup';
    if(ch.tags.includes('poke') && !ch.tags.includes('protect')) return 'apsup';
    return 'enchant';
  }
  if(role==='JUG'){
    if(tanky) return 'jugtank';
    if(ap) return 'jugap';
    if(t.has('pick') && !t.has('engage')) return 'jugad';
    return 'jugbr';
  }
  if(role==='ADC'){
    if(ap) return 'apmage';
    if(c==='Yunara'||c==='Yasuo'||c==='Yone'||c==='Tristana'||c==='Nilah') return 'adcrit';
    return 'adc';
  }
  if(role==='MID'){
    if(ad){ if(c==='Yone'||c==='Yasuo') return 'adcrit'; if(ch.roles.includes('ADC')) return 'adc'; return t.has('pick')?'adassn':'adfight'; }
    if(tanky) return 'tank';
    if(MELEE_MID.has(c) && (t.has('pick')||t.has('early'))) return 'apassn';
    if(t.has('scale')) return 'apcarry';
    return 'apmage';
  }
  // TOP
  if(tanky) return 'tank';
  if(ap) return t.has('scale')||t.has('split') ? 'apfighter' : 'apburn';
  if(ch.roles.includes('ADC')) return 'adc';
  if(t.has('split')||t.has('pick')) return 'adfight';
  return 'adbrawl';
}

// ---------------- 紧凑编码（回放存储用） ----------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64I = (()=>{ const m={}; for(let i=0;i<64;i++) m[B64[i]]=i; return m; })();
const enc1 = v => B64[clamp(Math.round(v),0,63)];
const enc2 = v => { v = clamp(Math.round(v),0,4095); return B64[v>>6] + B64[v&63]; };
const dec1 = (s,i) => B64I[s[i]]||0;
const dec2 = (s,i) => ((B64I[s[i]]||0)<<6) | (B64I[s[i+1]]||0);
const hyp = (x,y) => Math.sqrt(x*x + y*y);   // 比 Math.hypot 快很多
const fmtSec = sec => { sec = Math.max(0, Math.floor(sec)); return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; };
function wpick(arr, wfn){
  let tot = 0; const w = arr.map(x=>{ const v=Math.max(0.0001, wfn(x)); tot+=v; return v; });
  let r = rnd()*tot;
  for(let i=0;i<arr.length;i++){ r-=w[i]; if(r<=0) return arr[i]; }
  return arr[arr.length-1];
}
const pickOne = a => a[Math.floor(rnd()*a.length)];

// =====================================================================
//                       1v1 SOLO 中路对线状态机
// =====================================================================
// 位置 s ∈ [0,1]：0 = A 方防御塔一侧，1 = B 方防御塔一侧；A 塔在 0.06，B 塔在 0.94
const SOLO_TW = {A:0.06, B:0.94};
const SOLO_LAST_TICK = 12*60 - 1;
const XP_LV = [0,0,280,660,1140,1720,2400,3180,4060,5040,6120,7300,8580,9960,11440,13020,14700,16480,18360];
const lvlOf = xp => { let l=1; while(l<18 && xp>=XP_LV[l+1]) l++; return l; };

function soloFighter(side, pl, c, role){
  const ch = CH[c];
  const mr = (pl ? matchRating(pl, pl.role, {}) : 70) + champFit(pl, c, pl?pl.role:role)*0.8;
  const tags = new Set(ch.tags);
  const ranged = isRanged(c);
  const arche = archetype(c, ranged && role!=='SUP' ? (ch.roles.includes('ADC')?'ADC':'MID') : (role==='SUP'?'MID':role));
  const b = BUILDS[arche] || BUILDS.adfight;
  const start = b.start[0] >= 1101 && b.start[0] <= 1103 ? (ch.dmg==='AP'?1056:1055) : (b.start[0]===3865 ? (ch.dmg==='AP'?1056:1055) : b.start[0]);
  const tr = playerTraits(pl);
  return {
    side, pid: pl?pl.pid:null, tag: playerTag(pl), role: pl?pl.role:role, champ:c, cn: ch.cn, mr, ranged, tags, arche, build:b, tr,
    mental: mentalTier(pl),
    s: side==='A'?0.38:0.62, hp:1, mp:1, lvl:1, xp:0, cs:0, gold:500-ITEMS[start][1]-50*2, items:[start], pots:2, potT:0,
    flash:0, sum2: (tags.has('early')||tags.has('pick')) ? 'ig' : (ranged ? 'bar' : 'ig'), s2cd:0,
    recall:0, away:0, trd: 4+rnd()*4, comboCd:0, invested: ITEMS[start][1], dead:false, mood:0
  };
}
function soloMaxHp(f){ return 560 + 92*(f.lvl-1) + (f.items.includes(1054)?110:f.items.includes(1055)?80:f.items.includes(1056)?70:0) + (f.invested>1200?150:0); }
// 单位时间伤害（相对数值）：等级 + 装备 + 发挥 + 英雄前期强度
function soloDps(f){
  const early = (f.tags.has('early')?0.12:0) + (f.tags.has('pick')?0.06:0) - (f.tags.has('scale')?0.05:0);
  return (55 + 9*f.lvl) * (1 + f.invested/3200) * Math.exp((f.mr-80)/38) * (1+early) * (f.lvl>=6 ? 1.12 : 1);
}

function simSolo1v1(teamA, teamB, pickA, pickB, opts){
  const game = createSolo(teamA, teamB, pickA, pickB, opts);
  while(!game.over) soloStep(game);
  return soloResult(game);
}
function createSolo(teamA, teamB, pickA, pickB, opts){
  const luA = lineupMap(teamA), luB = lineupMap(teamB);
  const pa = pickA || defaultSoloPick(teamA);
  const pb = pickB || defaultSoloPick(teamB);
  const plA = (pa.pid && P(pa.pid)) || luA[pa.role] || Object.values(luA)[0];
  const plB = (pb.pid && P(pb.pid)) || luB[pb.role] || Object.values(luB)[0];
  const cA = pa.champ && CH[pa.champ] ? pa.champ : defaultSoloPick(teamA).champ;
  const cB = pb.champ && CH[pb.champ] ? pb.champ : defaultSoloPick(teamB).champ;
  const g = {
    kind:'solo', teamA, teamB, t:90, over:false, winner:null, winReason:'',
    F:{A:soloFighter('A', plA, cA, pa.role), B:soloFighter('B', plB, cB, pb.role)},
    wave:0.5, waveT:0, waveN:0, tw:{A:1, B:1}, ring:0, log:[], fx:null, fxT:0,
    first:{lv2:null, lv6:null},
    rec: opts && opts.record ? [] : null
  };
  g.F.A.maxhp = soloMaxHp(g.F.A); g.F.B.maxhp = soloMaxHp(g.F.B);
  soloLog(g, null, '对线开始', `双方中路碰面！${teamName(teamA)} ${g.F.A.tag}（${g.F.A.cn}）对阵 ${teamName(teamB)} ${g.F.B.tag}（${g.F.B.cn}），谁能拿下选边权？`);
  if(g.rec) soloRecord(g);
  return g;
}
function soloLog(g, side, tag, text, hl){ g.log.push({t:fmtSec(g.t), sec:g.t, side, tag, text, hl:!!hl}); }
const oppSide = s => s==='A'?'B':'A';

function soloStep(g){
  if(g.over) return;
  g.t += 1;
  const A = g.F.A, B = g.F.B;
  // 兵线：每 30 秒一波，cs/经验结算；兵线推进看双方清线能力与谁在线上
  g.waveT += 1;
  for(const f of [A,B]){
    if(f.flash>0) f.flash--; if(f.s2cd>0) f.s2cd--; if(f.trd>0) f.trd--; if(f.comboCd>0) f.comboCd--;
    if(f.potT>0){ f.potT--; f.hp = Math.min(1, f.hp + 8/f.maxhp*1); }
    if(f.recall>0){ f.recall--; if(f.recall===0){ soloBase(g, f); } }
    else if(f.away>0){ f.away--; if(f.away===0){ f.s = f.side==='A'?0.3:0.7; soloLog(g, f.side, '回到线上', `${f.tag} 补给完毕重新回到中路${f.items.length>2?`，身上多了 ${ITEM_CN(f.items[f.items.length-1])}`:''}。`); } }
    // 回蓝回血
    if(f.recall===0 && f.away===0) { f.mp = Math.min(1, f.mp + 0.012); f.hp = Math.min(1, f.hp + 0.0018); }
  }
  const presA = A.recall===0 && A.away===0, presB = B.recall===0 && B.away===0;
  if(g.waveT >= 25){
    g.waveT = 0; g.waveN++;
    const cannon = g.waveN % 3 === 0;
    const minions = 6 + (cannon?1:0);
    for(const [f,o,pres] of [[A,B,presA],[B,A,presB]]){
      if(!pres){ continue; }
      const harass = clamp((o.hp - f.hp)*0.25 + (o.ranged && !f.ranged ? 0.06 : 0), -0.05, 0.25);
      const eff = clamp(0.74 + (f.mr-78)/70 - harass + randn()*0.04 - (f.mental<0 && g.t>400 ? 0.04 : 0), 0.45, 0.99);
      let got = 0; for(let i=0;i<minions;i++) if(rnd()<eff) got++;
      f.cs += got; f.gold += got*21 + 1; f.xp += 250 + (cannon?90:0);
    }
    if(!presA && presB){ g.tw.A = Math.max(0, g.tw.A - 0.2 - (B.lvl>=6?0.04:0)); g.wave = 0.12; soloLog(g, 'B', '推线磨塔', `${B.tag} 趁 ${A.tag} 不在线上把兵线推进塔下，猛点防御塔，剩余 ${Math.round(g.tw.A*100)}%。`); }
    else if(!presB && presA){ g.tw.B = Math.max(0, g.tw.B - 0.2 - (A.lvl>=6?0.04:0)); g.wave = 0.88; soloLog(g, 'A', '推线磨塔', `${A.tag} 趁 ${B.tag} 不在线上把兵线推进塔下，猛点防御塔，剩余 ${Math.round(g.tw.B*100)}%。`); }
    else if(presA && presB){
      const pushA = (A.ranged?1.15:1) * (A.tags.has('poke')?1.1:1) * Math.exp((A.mr-B.mr)/60) * (0.5+A.hp) ;
      const pushB = (B.ranged?1.15:1) * (B.tags.has('poke')?1.1:1) * (0.5+B.hp);
      g.wave = clamp(g.wave + (pushA-pushB)*0.16 + randn()*0.07, 0.2, 0.8);
      if(g.wave>=0.72){ g.tw.B = Math.max(0, g.tw.B - 0.055); if(g.tw.B>0 && rnd()<0.5) soloLog(g, 'A', '兵线压制', `${A.tag} 把兵线压进塔下，防御塔剩余 ${Math.round(g.tw.B*100)}%。`); }
      if(g.wave<=0.28){ g.tw.A = Math.max(0, g.tw.A - 0.055); if(g.tw.A>0 && rnd()<0.5) soloLog(g, 'B', '兵线压制', `${B.tag} 把兵线压进塔下，防御塔剩余 ${Math.round(g.tw.A*100)}%。`); }
    }
    // 升级与抢 2 / 抢 6
    for(const f of [A,B]){
      const nl = lvlOf(f.xp);
      if(nl !== f.lvl){
        const old = f.lvl; f.lvl = nl; const hpAbs = f.hp*f.maxhp; f.maxhp = soloMaxHp(f); f.hp = Math.min(1, (hpAbs + (nl-old)*92)/f.maxhp);
        if(nl>=2 && !g.first.lv2){ g.first.lv2 = f.side; f.mood = 6; soloLog(g, f.side, '抢二', `${f.tag} 率先升到 2 级，掌握换血主动权！`); }
        if(nl>=6 && !g.first.lv6){ g.first.lv6 = f.side; f.mood = 8; soloLog(g, f.side, '抢六', `${f.tag} 抢先拿到 6 级大招，${oppSide(f.side)==='A'?A.tag:B.tag} 必须小心了！`, true); }
      }
    }
    if(A.cs>=100 || B.cs>=100){
      const w = A.cs===B.cs ? (A.hp>=B.hp?'A':'B') : (A.cs>B.cs?'A':'B');
      return soloEnd(g, w, '率先百刀', `🌾 ${g.F[w].tag} 率先达成 100 补刀，稳健运营拿下 1v1 选边赛！`);
    }
    if(g.tw.A<=0) return soloEnd(g, 'B', '推平一塔', `🏰 ${B.tag} 持续压制点破中路一塔，赢下 1v1 选边赛！`);
    if(g.tw.B<=0) return soloEnd(g, 'A', '推平一塔', `🏰 ${A.tag} 持续压制点破中路一塔，赢下 1v1 选边赛！`);
  }
  // 位置：围绕兵线来回拉扯；远程站位更靠后
  for(const f of [A,B]){
    if(f.recall>0 || f.away>0) continue;
    const dir = f.side==='A' ? -1 : 1;
    const want = g.wave + dir*(f.ranged?0.09:0.05) + dir*(f.hp<0.4?0.06:0) - dir*(f.mood>0?0.03:0);
    f.s += clamp(want - f.s, -0.04, 0.04) + randn()*0.006;
    f.s = clamp(f.s, SOLO_TW.A+0.02, SOLO_TW.B-0.02);
    if(f.mood>0) f.mood--;
  }
  // 缩圈：10:00 之后双方被迫贴脸，并持续掉血
  if(g.t >= 600){
    if(g.ring===0){ g.ring=1; soloLog(g, null, '缩圈', '⏳ 10 分钟到！火圈开始收缩，双方被迫贴身肉搏！', true); }
    const elapsed = g.t - 600;
    for(const f of [A,B]){
      f.recall = 0; f.away = 0;
      f.s += (0.5 - f.s)*0.2;
      f.hp -= 0.004 + elapsed*0.00006;
    }
    if(A.hp<=0 || B.hp<=0 || g.t>=SOLO_LAST_TICK){
      const w = A.hp===B.hp ? (rnd()<0.5?'A':'B') : (A.hp>B.hp?'A':'B');
      g.F[w].hp = Math.max(0, g.F[w].hp);
      return soloEnd(g, w, '决死缩圈击杀', `🔥 火圈收缩终极一战！${g.F[w].tag} 顶住压力完成终结，为 ${teamName(w==='A'?g.teamA:g.teamB)} 赢下选边权！`);
    }
    // 火圈越小越容易爆发决战：10:00 刚开始缩圈时以拉扯为主，越接近 12:00 越可能强开
    if(g.t % 5 === 0 && rnd() < 0.1 + elapsed/140){
      if(soloAllIn(g, A.hp*rnd() > B.hp*rnd() ? 'A' : 'B', true)) return;
    }
  }
  if(presA && presB && g.ring===0){
    // 双方都在线：各自判断换血 / 抢级 All-in / 控线
    const order = rnd()<0.5 ? [A,B] : [B,A];
    for(const f of order){
      if(g.over) break;
      const o = g.F[oppSide(f.side)];
      if(f.recall||o.recall) continue;
      // 回城判断
      if(f.hp < 0.36 && (o.hp > f.hp + 0.2 || (f.pots===0 && f.potT===0)) && rnd() < 0.7 + f.mental*0.05){ f.recall = 8; soloLog(g, f.side, '回城补给', `${f.tag} 血量见底只能交出线权回城，${o.tag} 获得推线磨塔的机会。`); continue; }
      if(f.hp < 0.55 && f.pots>0 && f.potT===0){ f.pots--; f.potT = 15; }
      if(f.gold >= 1100 && g.wave > 0.6 === (f.side==='A') && f.hp<0.8 && rnd()<0.08){ f.recall = 8; soloLog(g, f.side, '回城出装', `${f.tag} 推完兵线果断回城，准备把 ${f.gold} 金币换成装备。`); continue; }
      // All-in 判定（击杀线）
      const killLine = soloDps(f)*3.1*(f.lvl>=6?1.35:1) + (f.sum2==='ig'&&f.s2cd===0 ? 0.14*o.maxhp : 0);
      const oHp = o.hp*o.maxhp + (o.sum2==='bar'&&o.s2cd===0 ? 140 : 0);
      const lvAdv = f.lvl - o.lvl + (f.mood>0?0.8:0);
      const aggr = 1 + (f.tags.has('early')?0.25:0) + (f.tags.has('pick')?0.15:0) + f.mental*0.06;
      if(f.comboCd===0 && (o.hp < 0.42 || (f.mood>0 && o.hp<0.6)) && oHp < killLine*aggr*(1+lvAdv*0.15) && f.hp > o.hp + 0.12 && f.mp>0.35){
        if(soloAllIn(g, f.side, false)) return;
        continue;
      }
      // 换血
      if(f.trd<=0 && f.mp > 0.25){
        const edge = (soloDps(f)/f.maxhp*o.maxhp)/(soloDps(o)) ;
        const want = sigmoid((edge-1)*3 + (f.ranged&&!o.ranged?0.5:0) + (f.tags.has('poke')?0.4:0) + lvAdv*0.4 + (f.hp-o.hp)*1.5 + f.mental*0.08 + randn()*0.6);
        if(rnd() < want*0.45){ soloTrade(g, f, o); }
        f.trd = 6 + Math.floor(rnd()*7);
      }
    }
  }
  if(!g.over && g.rec && (g.t%1===0)) soloRecord(g);
}
function soloBase(g, f){
  // 回到泉水：回满状态并购买装备
  f.hp = 1; f.mp = 1; f.pots = Math.max(f.pots, 1);
  const b = f.build;
  const buys = [];
  const tryBuy = (id) => { const c = ITEMS[id][1]; if(f.gold >= c){ f.gold -= c; f.invested += c; f.items.push(id); buys.push(ITEM_CN(id)); return true; } return false; };
  if(!f.items.some(id=>ITEMS[id][2]==='boots'||id===1001)) tryBuy(1001);
  while(f.gold >= 350 && f.items.length < 6){ if(!tryBuy(b.comp)) break; }
  f.maxhp = soloMaxHp(f);
  f.away = 16;
  if(buys.length) soloLog(g, f.side, '购买装备', `${f.tag} 购买了 ${buys.join('、')}。`);
}
function soloTrade(g, f, o){
  const dodge = clamp(0.18 + (o.mr - f.mr)/90 + (o.ranged?0.04:0), 0.05, 0.45);
  const hit = rnd() > dodge;
  const rel = soloDps(f)/Math.max(1,soloDps(o));
  const dmgF = hit ? 0.085*Math.pow(rel,0.8)*(0.6+rnd()*0.9) : 0.03;
  const retF = 0.085*Math.pow(1/rel,0.8)*(o.ranged&&!f.ranged ? 0.75 : f.ranged&&!o.ranged ? 0.4 : 0.6)*(0.5+rnd()*0.9);
  const dmg = dmgF*o.maxhp;
  o.hp = Math.max(0.04, o.hp - dmgF);
  f.hp = Math.max(0.04, f.hp - retF);
  f.mp = Math.max(0, f.mp - 0.18 - rnd()*0.1); o.mp = Math.max(0, o.mp - 0.06);
  g.wave = clamp(g.wave + (f.side==='A'?0.05:-0.05), 0.15, 0.85);
  g.fx = {k:'trade', s:(f.s+o.s)/2, side:f.side}; g.fxT = 2;
  const big = dmg/o.maxhp > 0.25;
  soloLog(g, f.side, hit?(big?'精准连招':'拉扯换血'):'技能落空',
    hit ? `${f.tag} ${pickOne(['抓住技能空档','卡住补刀时机','绕到兵线侧面','用一套技能'])}${big?'打出完整连招':'主动换血'}，${o.tag} 血量掉到 ${Math.round(o.hp*100)}%。`
        : `${f.tag} 的关键技能被 ${o.tag} 侧身躲开，反手被 ${o.tag} 消耗了一口。`);
}
// 全力 All-in：比较双方击杀所需时间，闪现 / 点燃 / 屏障 / 防御塔都会改变结局
function soloAllIn(g, side, forced){
  const f = g.F[side], o = g.F[oppSide(side)];
  const fDps = soloDps(f)*(f.lvl>=6?1.25:1), oDps = soloDps(o)*(o.lvl>=6?1.25:1);
  let fHp = f.hp*f.maxhp, oHp = o.hp*o.maxhp;
  const notes = [];
  if(f.sum2==='ig' && f.s2cd===0){ oHp -= 0.13*o.maxhp; f.s2cd = 180; notes.push('点燃'); }
  if(o.sum2==='bar' && o.s2cd===0){ oHp += 140; o.s2cd = 180; notes.push(`${o.tag} 交出屏障`); }
  if(o.sum2==='ig' && o.s2cd===0 && !forced){ fHp -= 0.13*f.maxhp; o.s2cd = 180; }
  // 塔下：靠近守方防御塔时进攻方会吃塔伤
  const nearTower = side==='A' ? f.s > 0.8 : f.s < 0.2;
  if(nearTower) fHp -= 180 + 20*f.lvl;
  const skill = (f.mr - o.mr)/14 + (f.mental - o.mental)*0.12*(0.5+pressureOf(null));
  const tf = oHp/Math.max(1,fDps) * Math.exp(-(randn()*0.32 + skill*0.12));
  const to = fHp/Math.max(1,oDps) * Math.exp(randn()*0.32);
  f.comboCd = 22; f.mp = Math.max(0, f.mp-0.4);
  g.fx = {k:'allin', s:(f.s+o.s)/2, side}; g.fxT = 3;
  // 势均力敌：双方交完技能各自后撤
  const ratio = to/Math.max(0.01, tf);
  if(!forced && ratio > 0.7 && ratio < 1.45 && rnd() < 0.5){
    f.hp = Math.max(0.06, f.hp - 0.18 - rnd()*0.12); o.hp = Math.max(0.06, o.hp - 0.18 - rnd()*0.12);
    soloLog(g, side, '激烈对拼', `${f.tag} 与 ${o.tag} 打出一波激烈对拼，双方都只剩 ${Math.round(Math.min(f.hp,o.hp)*100)}% 左右血量，各自后撤！`, true);
    return false;
  }
  if(tf < to){
    // 守方闪现逃生的机会
    if(o.flash===0 && !forced && tf > to*0.55 && rnd()<0.7){
      o.flash = 300; o.hp = Math.max(0.05, (o.hp*o.maxhp*0.25)/o.maxhp); f.hp = Math.max(0.08, f.hp - (oDps*tf*0.6)/f.maxhp);
      soloLog(g, side, '闪现逃生', `${f.tag} ${notes.length?notes.join('、')+'，':''}强开 All-in，${o.tag} 残血交闪现极限逃生！`, true);
      return false;
    }
    f.hp = clamp((fHp - oDps*tf*0.85)/f.maxhp, 0.03, 1);
    if(f.flash===0 && tf > to*0.8){ f.flash = 300; notes.unshift('闪现补伤害'); }
    soloEnd(g, side, forced?'决死缩圈击杀':'一血单杀', `💥 ${f.tag}（${f.cn}）${notes.length?notes.join('、')+'，':''}${forced?'在火圈中':''}打满爆发完成单杀！击倒 ${o.tag} 拿下一血！`);
    return true;
  } else {
    // 反杀
    if(f.flash===0 && to > tf*0.72 && rnd()<0.6 && !forced){
      f.flash = 300; f.hp = Math.max(0.05, f.hp*0.3); o.hp = Math.max(0.08, o.hp - (fDps*to*0.5)/o.maxhp);
      soloLog(g, side, '闪现撤退', `${f.tag} 主动开团却没打出伤害，及时交闪现撤离，血量只剩 ${Math.round(f.hp*100)}%。`, true);
      return false;
    }
    o.hp = clamp((oHp - fDps*to*0.85)/o.maxhp, 0.03, 1);
    soloEnd(g, o.side, forced?'决死缩圈击杀':'一血单杀', `🔁 ${f.tag} 强开反被 ${o.tag}（${o.cn}）${nearTower?'借助防御塔':'极限走位'}完成反杀！${o.tag} 拿下一血！`);
    return true;
  }
}
function soloEnd(g, w, reason, text){
  g.over = true; g.winner = w; g.winReason = reason;
  const l = g.F[oppSide(w)];
  if(/击杀|单杀/.test(reason)) { l.hp = 0; l.dead = true; }
  soloLog(g, w, reason, text, true);
  if(g.rec) soloRecord(g);
}
// 每秒一帧：位置/血/蓝/等级/补刀/金币/闪现/第二召唤师 + 兵线 + 塔血 + 特效
function soloRecord(g){
  const fr = [];
  for(const f of [g.F.A, g.F.B]) fr.push(enc1(f.s*63)+enc1(f.hp*63)+enc1(f.mp*63)+enc1(f.lvl)+enc2(f.cs)+enc2(Math.max(0,f.gold)/2)+enc1(Math.ceil(f.flash/5))+enc1(Math.ceil(f.s2cd/5))+enc1(f.recall>0?1:f.away>0?2:0)+enc1(f.items.length));
  fr.push(enc1(g.wave*63)+enc1(g.tw.A*63)+enc1(g.tw.B*63)+(g.fxT>0&&g.fx?enc1(g.fx.s*63)+(g.fx.k==='allin'?'b':'a')+g.fx.side:'...'));
  if(g.fxT>0) g.fxT--;
  g.rec.push(fr.join(''));
}
function soloResult(g){
  const A=g.F.A, B=g.F.B;
  const pub = f => ({ pid:f.pid, tag:f.tag, role:f.role, champ:f.champ, items:f.items.slice(), sum2:f.sum2, cs:f.cs, lvl:f.lvl });
  const res = {
    teamA:g.teamA, teamB:g.teamB, A:pub(A), B:pub(B), winner:g.winner, winReason:g.winReason,
    dur:g.t, frames:g.log.map(x=>({t:x.t, side:x.side, tag:x.tag, text:x.text})), log:g.log
  };
  if(g.rec) res.rec = { v:SIM_VER, start:90, f:g.rec, items:{A:A.items.slice(), B:B.items.slice()}, sum2:{A:A.sum2,B:B.sum2} };
  return res;
}
// 从录像解码某一秒的 1v1 画面
function soloFrameAt(rec, idx){
  const s = rec.f[clamp(idx,0,rec.f.length-1)];
  const f = o => ({ s:dec1(s,o)/63, hp:dec1(s,o+1)/63, mp:dec1(s,o+2)/63, lvl:dec1(s,o+3), cs:dec2(s,o+4), gold:dec2(s,o+6)*2, flash:dec1(s,o+8)*5, s2cd:dec1(s,o+9)*5, st:dec1(s,o+10), nItems:dec1(s,o+11) });
  const fx = s[27]!=='.' ? {s:dec1(s,27)/63, k:s[28]==='b'?'allin':'trade', side:s[29]} : null;
  return { t: rec.start + clamp(idx,0,rec.f.length-1), A:f(0), B:f(12), wave:dec1(s,24)/63, twA:dec1(s,25)/63, twB:dec1(s,26)/63, fx };
}

// =====================================================================
//                      5v5 召唤师峡谷分阶段模拟
// =====================================================================
// 坐标 0~1000（画布同比例），蓝色方基地左下，红色方基地右上；红方坐标 = 蓝方点对称 (1000-x, 1000-y)
const MAP5 = {
  lanes: {
    top: [[118,882],[92,640],[80,330],[96,140],[140,96],[330,80],[640,92],[882,118]],
    mid: [[118,882],[500,500],[882,118]],
    bot: [[118,882],[360,920],[670,908],[860,860],[908,670],[920,360],[882,118]],
  },
  fountain: {blue:[38,962], red:[962,38]},
  nexus: {blue:[112,888], red:[888,112]},
  nexusT: {blue:[[150,812],[188,850]], red:[[850,188],[812,150]]},
  dragon: [668,700], baron: [332,300],
  camps: {blue:[[252,468],[150,425],[258,560],[478,640],[522,742],[570,822]], red:[[748,532],[850,575],[742,440],[522,360],[478,258],[430,178]]},
  towerS: {outer:0.37, inner:0.25, inhibT:0.14, inhib:0.10},
};
(function prepLanes(){
  MAP5.laneLen = {};
  for(const k in MAP5.lanes){
    const pts = MAP5.lanes[k]; const cum=[0];
    for(let i=1;i<pts.length;i++){ const dx=pts[i][0]-pts[i-1][0], dy=pts[i][1]-pts[i-1][1]; cum.push(cum[i-1]+hyp(dx,dy)); }
    MAP5.laneLen[k] = cum;
  }
})();
function lanePt(lane, s){
  const pts = MAP5.lanes[lane], cum = MAP5.laneLen[lane];
  const L = cum[cum.length-1]*clamp(s,0,1);
  for(let i=1;i<pts.length;i++){
    if(L <= cum[i]){ const f=(L-cum[i-1])/Math.max(1e-6,cum[i]-cum[i-1]); return [pts[i-1][0]+(pts[i][0]-pts[i-1][0])*f, pts[i-1][1]+(pts[i][1]-pts[i-1][1])*f]; }
  }
  return pts[pts.length-1].slice();
}
const LANE_OF = {TOP:'top', JUG:null, MID:'mid', ADC:'bot', SUP:'bot'};
const LANES3 = ['top','mid','bot'];
const DRAKES = [['infernal','炼狱亚龙'],['ocean','海洋亚龙'],['mountain','山脉亚龙'],['cloud','云端亚龙'],['hextech','海克斯科技亚龙'],['chemtech','化学科技亚龙']];
const BRW = [10,10,12,12,14,16,20,25,28,32.5,35,37.5,40,42.5,45,47.5,50,52.5];
const SIM5 = { TD:0.0075, FN:0.5, SK:90, IT:9000, LV:0.07, SPD:27, ENC:80, DT:3 };   // 战斗强度刻度（校准用）
const dist = (a,b) => hyp(a.x-b.x, a.y-b.y);

function buildTowers(){
  const out = [];
  for(const side of ['blue','red']){
    for(const lane of LANES3){
      [['outer',1],['inner',2],['inhibT',3],['inhib',4]].forEach(([k,tier])=>{
        const s0 = MAP5.towerS[k]; const s = side==='blue'? s0 : 1-s0;
        const [x,y] = lanePt(lane, s);
        out.push({id:out.length, side, lane, tier, s, x, y, hp:1, alive:true, plates: tier===1?5:0, resp:0});
      });
    }
    MAP5.nexusT[side].forEach(([x,y])=>out.push({id:out.length, side, lane:null, tier:5, x, y, hp:1, alive:true, plates:0, resp:0}));
    const [nx,ny] = MAP5.nexus[side];
    out.push({id:out.length, side, lane:null, tier:6, x:nx, y:ny, hp:1, alive:true, plates:0, resp:0});
  }
  return out;
}

// 创建一局 5v5 模拟：opts.record=true 时记录关键帧（观战回放用）
function createGame5(d, opts){
  opts = opts || {};
  const ev = evalDraft(d);
  const G = {
    kind:'g5', d, ev, t:0, over:false, winner:null, rec: !!opts.record,
    champs:[], towers: buildTowers(), front:{top:0.5, mid:0.5, bot:0.5},
    obj:{ drag:{next:300, up:false, prog:0, by:null, type:null, mapType:null, n:0}, grubs:{next:360, up:false, wave:0, prog:0},
          herald:{next:900, up:false, prog:0, until:1185}, baron:{next:1200, up:false, prog:0}, elder:{next:null, up:false, prog:0} },
    team:{}, feed:[], key:[], evs:[], frames:[], stats:[], gs:[], fx:[],
    firstBlood:null, firstTower:null, lastKill:{}, laneT:{top:20, mid:18, bot:22}, planT:0,
    stance:{A:opts.stanceA||'auto', B:opts.stanceB||'auto'}   // 预留：全队倾向（战术指令接口）
  };
  for(const side of ['A','B']){
    const blue = d.blue===side;
    const lu = lineupMap(d[side]);
    const dp = side==='A' ? ev.a : ev.b;
    G.team[side] = { side, blue, color: blue?'blue':'red', key:d[side], name:teamName(d[side]), dp,
      drakes:[], soul:null, baronT:0, elderT:0, heraldT:0, grubs:0, kills:0, towers:0, barons:0, gankT: 150 + rnd()*40, roamT: 300 + rnd()*120,
      split: null, focus:null, comp: dp.comp, tags: dp.comp.tags, calmT:0,
      // 临场发挥：本局浮动 + 系列赛共享浮动（见 engine.js FORM_SWING），叠加在全队阶段强度上
      dayForm: randn()*FORM_SWING.game + ((d.ctx && d.ctx.sform && d.ctx.sform[side]) || 0) };
    ROLES.forEach(r=>{
      const p = lu[r], c = d.picks[side][r];
      const sk = draftPlayerRating(p,r,d.ctx) + (c ? champFit(p,c,r)*DRAFT_FIT_WEIGHT : 0);
      const arche = c ? archetype(c, r) : 'adfight';
      const b = BUILDS[arche];
      const start = b.start.slice();
      const ch = c ? CH[c] : null;
      const [fx,fy] = MAP5.fountain[blue?'blue':'red'];
      const cm = {
        i: G.champs.length, side, blue, role:r, p, pid:p?p.pid:null, tag:playerTag(p), c, cn: ch?ch.cn:r,
        sk, mental: mentalTier(p), arche, build:b, tags: new Set(ch?ch.tags:[]), ranged: c?isRanged(c):false, combat:draftCombatProfile(c),
        x:fx, y:fy, px:fx, py:fy, hp:1, alive:true, rt:0, lvl:1, xp:0, gold:500, tg:500, cs:0, k:0, d:0, a:0,
        items:[], invest:0, coreIdx:0, bootsDone:false, supDone:false, streak:0,
        task:TK({k: r==='JUG'?'jungle':'lane', lane:LANE_OF[r]}), recall:0, lastBack:0, fightCd:0, camp:0, campT:0, pw:0, partial:0,
        powerLevel:0, powerInvest:0, powerBase:0
      };
      for(const id of start){ cm.gold -= ITEMS[id][1]; cm.invest += ITEMS[id][1]; cm.items.push(id); }
      G.champs.push(cm);
    });
  }
  G.rosters={A:G.champs.slice(0,5),B:G.champs.slice(5)};
  G.avgSk = {A: G.champs.filter(c=>c.side==='A').reduce((s,c)=>s+c.sk,0)/5, B: G.champs.filter(c=>c.side==='B').reduce((s,c)=>s+c.sk,0)/5};
  if(G.rec){ G.champs.forEach(c=>c.items.forEach(id=>G.evs.push([0,'B',c.i,id]))); recFrame5(G); recStats5(G); }
  return G;
}
const other = s => s==='A'?'B':'A';
const teamChamps = (G, side) => G.rosters[side];
// 阵容阶段强度：与 evalDraft 的 earlyDiff / midDiff / lateDiff 严格同源，再加选手个体差异
function phaseAdj(G, side, t){
  const dp = G.team[side].dp, m = t/60;
  const ev = G.ev;
  const blueE = ev.blueEdge * (side==='A'?1:-1) * 0.5;
  const se = ev.se * (side==='A'?1:-1) * 0.5;
  const e = dp.early + blueE*0.6, mi = dp.mid + se*0.6 + blueE*0.4, la = dp.late + se*0.8;
  let v;
  if(m < 12) v = e;
  else if(m < 17) v = e + (mi-e)*(m-12)/5;
  else if(m < 24) v = mi;
  else if(m < 31) v = mi + (la-mi)*(m-24)/7;
  else v = la;
  return v - G.avgSk[side] + (G.team[side].dayForm || 0);
}
function champPow(G, c, pressure){
  if(!c.alive) return 0;
  const tm = G.team[c.side];
  if(c.powerLevel!==c.lvl || c.powerInvest!==c.invest){
    c.powerLevel=c.lvl;
    c.powerInvest=c.invest;
    c.powerBase=Math.exp((c.sk-80)/SIM5.SK + SIM5.LV*c.lvl + c.invest/SIM5.IT);
  }
  const phase=G.phasePower ? G.phasePower[c.side] : Math.exp(phaseAdj(G,c.side,G.t)/SIM5.SK);
  let p = c.powerBase * phase * (0.3 + 0.7*c.hp);
  if(pressure && c.mental) p*=Math.exp(c.mental*1.4*pressure*DRAFT_RATING_WEIGHT/SIM5.SK);
  if(tm.baronT > G.t) p *= 1.22;
  if(tm.elderT > G.t) p *= 1.35;
  p *= 1 + tm.drakes.length*0.025 + (tm.soul?0.07:0);
  return p;
}
function teamPow(G, side){ let s=0; for(const c of G.champs) if(c.side===side) s += c.pw||0; return s; }
function aliveN(G, side){ let n=0; for(const c of G.champs) if(c.side===side && c.alive) n++; return n; }

function feed(G, side, tag, text, hl){ G.feed.push({t:fmtSec(G.t), sec:G.t, side, tag, text, hl:!!hl}); if(hl) G.key.push({t:fmtSec(G.t), side, tag, text}); }
const cname = c => `${c.tag}（${c.cn}）`;

// ---------------- 每秒推进 ----------------
function step5(G){
  if(G.over) return;
  const DT = SIM5.DT;
  G.t += DT;
  const t = G.t;
  objTimers(G);
  // 每秒缓存：战斗强度、各路线上人数
  const adj = G.adj || (G.adj = {A:0, B:0});
  adj.A = phaseAdj(G,'A',t); adj.B = phaseAdj(G,'B',t);
  const power=G.phasePower||(G.phasePower={A:1,B:1});
  power.A=Math.exp(adj.A/SIM5.SK); power.B=Math.exp(adj.B/SIM5.SK);
  const crowd = G.crowd || (G.crowd = {A:{top:0,mid:0,bot:0}, B:{top:0,mid:0,bot:0}});
  crowd.A.top = crowd.A.mid = crowd.A.bot = crowd.B.top = crowd.B.mid = crowd.B.bot = 0;
  for(const c of G.champs){
    c.pw = c.alive && c.recall===0 ? champPow(G, c, 0) : 0;
    const k = c.task.k;
    if(c.alive && c.role!=='SUP' && c.task.lane && (k==='lane'||k==='push'||k==='split')) crowd[c.side][c.task.lane]++;
  }
  if(t >= G.planT){ G.planT = t + 4; plan5(G, 'A'); plan5(G, 'B'); }
  for(const c of G.champs) tickChamp(G, c);
  laneTrades(G);
  encounters(G);
  objectives(G);
  lanesAndTowers(G);
  if(t%21===0){ const gA = G.champs.filter(c=>c.side==='A').reduce((s,c)=>s+c.tg,0), gB = G.champs.filter(c=>c.side==='B').reduce((s,c)=>s+c.tg,0); G.gs.push([t, Math.round(gA-gB)]); }
  if(G.fx.length && G.fx[0].t < t-4) G.fx = G.fx.filter(f=>f.t>=t-4);
  if(t >= 3600 && !G.over){ // 安全阀：极端拉锯时由经济领先方终结
    const gA = G.champs.filter(c=>c.side==='A').reduce((s,c)=>s+c.tg,0), gB = G.champs.filter(c=>c.side==='B').reduce((s,c)=>s+c.tg,0);
    endGame5(G, gA>=gB?'A':'B');
  }
  if(G.rec){
    recFrame5(G);
    if(t%12===0 || G.over) recStats5(G);
  }
}

function objTimers(G){
  const o = G.obj, t = G.t;
  if(!o.drag.up && o.drag.next!=null && t >= o.drag.next){
    o.drag.up = true; o.drag.prog = 0;
    if(!o.drag.type){
      const used = new Set(G.drakeSeen||[]);
      const cands = DRAKES.filter(x=>!used.has(x[0]));
      const nTaken = G.team.A.drakes.length + G.team.B.drakes.length;
      if(nTaken >= 2 && o.drag.mapType) o.drag.type = o.drag.mapType;
      else o.drag.type = pickOne(cands.length?cands:DRAKES)[0];
      if(nTaken === 1 && !o.drag.mapType){ o.drag.mapType = pickOne(DRAKES.filter(x=>x[0]!==o.drag.type && !used.has(x[0])))[0]; }
    }
  }
  if(!o.grubs.up && o.grubs.next!=null && t >= o.grubs.next && t < 840){ o.grubs.up = true; o.grubs.prog = 0; }
  if(o.grubs.up && t >= 840){ o.grubs.up = false; o.grubs.next = null; }
  if(!o.herald.up && o.herald.next!=null && t >= o.herald.next){ o.herald.up = true; o.herald.prog = 0; }
  if(o.herald.up && t >= o.herald.until){ o.herald.up = false; o.herald.next = null; }
  if(!o.baron.up && t >= o.baron.next){ o.baron.up = true; o.baron.prog = 0; if(t===1200) feed(G, null, '大龙刷新', '👾 20 分钟，纳什男爵在峡谷上方苏醒！'); }
  if(o.elder.next!=null && !o.elder.up && t >= o.elder.next){ o.elder.up = true; o.elder.prog = 0; feed(G, null, '远古龙', '🐲 远古巨龙降临峡谷，下一波团战将决定比赛走向！', true); }
  // 水晶（召唤水晶）重生
  for(const tw of G.towers) if(!tw.alive && tw.tier===4 && tw.resp && t >= tw.resp){ tw.alive = true; tw.hp = 1; tw.resp = 0; G.towerDirty = true; if(G.rec) G.evs.push([t,'R',tw.id]); }
}

function campPos(G, c){ const camps = MAP5.camps[c.blue?'blue':'red']; return camps[c.camp % camps.length]; }
function lanePos(G, c, lane, off){
  const dir = c.blue ? 1 : -1;
  const s = clamp(G.front[lane] - dir*(off==null?0.03:off), 0.05, 0.95);
  return lanePt(lane, s);
}

// 选手个体行为：移动、发育、回城、复活
function tickChamp(G, c){
  const t = G.t;
  c.px = c.x; c.py = c.y;
  const DT = SIM5.DT;
  if(c.fightCd>0) c.fightCd -= DT;
  // 被动收入
  if(t > 65){ c.gold += 2.04*DT; c.tg += 2.04*DT; }
  if(!c.alive){
    c.rt -= DT;
    if(c.rt <= 0){ c.alive = true; c.hp = 1; const [fx,fy] = MAP5.fountain[c.blue?'blue':'red']; c.x=fx; c.y=fy; c.px=fx; c.py=fy; shop(G, c); }
    return;
  }
  if(c.recall>0){
    c.recall -= DT;
    if(c.recall<=0){ c.recall = 0; const [fx,fy] = MAP5.fountain[c.blue?'blue':'red']; c.x=fx; c.y=fy; c.px=fx; c.py=fy; c.hp=1; c.lastBack=t; shop(G, c); }
    return;
  }
  // 泉水回血
  const fz = MAP5.fountain[c.blue?'blue':'red'];
  if(Math.abs(c.x-fz[0]) + Math.abs(c.y-fz[1]) < 120) c.hp = Math.min(1, c.hp+0.08*DT);
  else c.hp = Math.min(1, c.hp + 0.0025*DT);
  // 目标点
  const tk = c.task;
  let tx = c.x, ty = c.y;
  if(tk.k==='lane' || tk.k==='split'){ [tx,ty] = lanePos(G, c, tk.lane, tk.k==='split' ? -0.01 : (c.role==='SUP'?0.045:c.ranged?0.04:0.025)); }
  else if(tk.k==='jungle'){
    const [cx,cy] = campPos(G, c); tx=cx; ty=cy;
    if(Math.abs(c.x-cx) + Math.abs(c.y-cy) < 35){ c.campT += DT; if(c.campT >= 9){ c.campT=0; c.camp = (c.camp+1+(rnd()<0.3?1:0)) % 6; } }
  }
  else if(tk.k==='go' || tk.k==='obj' || tk.k==='gank' || tk.k==='push' || tk.k==='defend'){
    if(tk.lane && (tk.k==='push'||tk.k==='defend')) [tx,ty] = lanePos(G, c, tk.lane, tk.k==='push' ? 0.0 : 0.05);
    else { tx = tk.x; ty = tk.y; }
    if(tk.k==='gank' && t > tk.until){ c.task = TK({k: c.role==='JUG'?'jungle':'lane', lane: LANE_OF[c.role]}); }
  }
  else if(tk.k==='base'){ tx = fz[0]; ty = fz[1]; }
  // 视野判断：前方敌人明显更强且不是在守塔/抢资源时，原地后撤等待队友
  if(tk.k!=='base' && t > 120){
    let ep = 0, ap = c.pw||0;
    const group=G.champs, x=c.x, y=c.y, side=c.side;
    for(let i=0;i<group.length;i++){
      const o=group[i];
      if(!o.pw || !o.alive || o===c || Math.abs(o.x-x)+Math.abs(o.y-y)>300) continue;
      if(o.side===side) ap+=o.pw; else ep+=o.pw;
    }
    if(ep > ap*(tk.k==='defend'?2.3:1.7) && !(tk.k==='lane' && t<840 && ep < ap*2.6)){
      const back = MAP5.fountain[c.blue?'blue':'red'];
      const bx = back[0]-c.x, by = back[1]-c.y, bd = hyp(bx,by)||1;
      tx = c.x + bx/bd*60*DT; ty = c.y + by/bd*60*DT;
    }
  }
  const dx = tx-c.x, dy = ty-c.y, dd = hyp(dx,dy);
  const spd = SIM5.SPD * (c.bootsDone?1.12:1) * (G.team[c.side].baronT>t?1.1:1);
  if(dd > 1){ const m = Math.min(dd, spd*DT); c.x += dx/dd*m + (rnd()-0.5)*3; c.y += dy/dd*m + (rnd()-0.5)*3; }
  // 发育
  const inLane = (tk.k==='lane'||tk.k==='split'||tk.k==='push') && tk.lane && dd < 110;
  const m = t/60;
  if(inLane && t>90){
    const solo = c.role!=='ADC' && c.role!=='SUP';
    const share = c.role==='SUP' ? 0.04 : 1;
    const crowd = Math.max(0, G.crowd[c.side][tk.lane] - (c.role==='SUP'?0:1));
    const farm = clamp(0.8 + (c.sk-78)/60 + (c.hp-0.6)*0.15, 0.5, 1.15) * share / (1 + crowd*0.6);
    const csr = (0.132 + Math.min(0.03, m*0.0012)) * farm;
    c.cs += csr*DT; const gg = csr*DT*(20 + Math.min(14, m*0.45)); c.gold += gg; c.tg += gg;
    c.xp += (solo ? 7.4 : 5.0) * (1 + m*0.025) / (1 + crowd*0.4) * DT;
    if(c.role==='SUP'){ c.gold += 0.25*DT; c.tg += 0.25*DT; }
  } else if(tk.k==='jungle' && t>85){
    const csr = 0.085 * clamp(0.85 + (c.sk-78)/60, 0.6, 1.1);
    c.cs += csr*DT; const gg = csr*DT*(32 + Math.min(12, m*0.4)); c.gold += gg; c.tg += gg;
    c.xp += 6.6 * (1 + m*0.02) * DT;
  } else if(t > 90){
    // 抱团/转线途中也会顺手清兵、刷野
    c.xp += 4.2 * (1 + m*0.03) * DT;
    const gg = (c.role==='SUP' ? 1.0 : 2.0) * Math.min(1, m/14) * DT; c.gold += gg; c.tg += gg; c.cs += (c.role==='SUP'?0:0.06*Math.min(1,m/14))*DT;
  }
  while(c.lvl < 18 && c.xp >= XP_LV[c.lvl+1]) c.lvl++;
  // 回城：残血或者钱够了
  const lowHp = c.hp < (t<840 && c.task.k==='lane' ? 0.36 : 0.3);
  const rich = t-c.lastBack>140 && (tk.k==='lane'||tk.k==='jungle'||tk.k==='split') && G.front[tk.lane||'mid']!==undefined && c.gold>=nextItemCost(c);
  if((lowHp || (rich && rnd()<0.06*DT)) && tk.k!=='obj' && tk.k!=='defend' && !nearEnemy(G, c, 160)){
    startRecall5(c);
  }
}
function startRecall5(c){
  c.recall = 8;
  c.pw = 0;
}
function nearEnemy(G, c, radius){
  const limit=radius*radius;
  for(const o of G.rosters[other(c.side)]){
    if(!o.alive) continue;
    const x=o.x-c.x,y=o.y-c.y;
    if(x*x+y*y<limit) return true;
  }
  return false;
}
function nextItemCost(c){
  const b = c.build;
  if(b.sup && !c.supDone) return 0;
  if(!c.bootsDone && c.coreIdx>=1) return ITEMS[b.boots][1];
  const id = b.core[c.coreIdx]; return id ? ITEMS[id][1] - (c.partial||0) : 99999;
}
// 回到泉水购物：按出装路线买成装，钱不够就先投资“合成中”的小件
function shop(G, c){
  const b = c.build;
  const buy = id => { c.items.push(id); if(G.rec) G.evs.push([G.t,'B',c.i,id]); };
  const remove = slot => { c.items.splice(slot,1); if(G.rec) G.evs.push([G.t,'S',c.i,slot]); };
  if(b.sup && !c.supDone && c.tg > 1100){
    c.supDone = true;
    const mapSlot = c.items.indexOf(3865);
    if(mapSlot>=0) remove(mapSlot);
    buy(b.sup);
  }
  let guard = 0;
  while(guard++ < 4){
    if(!c.bootsDone && c.coreIdx>=1){
      const cost = ITEMS[b.boots][1];
      if(c.gold >= cost){ c.gold -= cost; c.invest += cost; c.bootsDone = true; buy(b.boots); continue; }
      break;
    }
    const id = b.core[c.coreIdx]; if(!id) break;
    const cost = ITEMS[id][1] - (c.partial||0);
    if(c.gold >= cost){
      c.gold -= cost; c.invest += cost; c.partial = 0; c.coreIdx++;
      // 6 格满时卖掉出门装
      if(c.items.length >= 6){ const s = c.items.findIndex(x=>ITEMS[x][2]==='start'); if(s>=0) remove(s); }
      buy(id);
      if(c.coreIdx===2 && (c.role==='MID'||c.role==='ADC') ) feed(G, c.side, '装备成型', `${cname(c)} 两件套成型，输出能力大幅提升。`);
      continue;
    }
    // 先买小件：把一部分钱投入下一件成装
    const part = Math.floor(Math.min(c.gold, cost-1) / 50) * 50;
    if(part >= 300){ c.gold -= part; c.invest += part; c.partial = (c.partial||0) + part; }
    break;
  }
  // 药水
  if(c.items.indexOf(2003)<0 && G.t < 900 && c.gold>=50 && c.items.length<6){ c.gold -= 50; }
}

// ---------------- 团队宏观决策 ----------------
function TK(o){ return {k:o.k, lane:o.lane||null, x:o.x||0, y:o.y||0, o:o.o||null, until:o.until||0}; }
function setTask(c, task){ c.task = TK(task); }
function lanePriority(G, side, lane){
  const direction=G.team[side].blue?1:-1;
  let value=(G.front[lane]-0.5)*direction*2;
  for(const c of G.champs){
    if(LANE_OF[c.role]!==lane || !c.alive || c.recall>0 || c.task.k!=='lane') continue;
    value+=(c.side===side?1:-1)*(c.hp*0.21 + (c.tags.has('early')?0.07:0));
  }
  return clamp(value,-1,1);
}
function riverPriority(G, side, lane){ return lanePriority(G,side,lane)*0.64 + lanePriority(G,side,'mid')*0.36; }
function plan5(G, side){
  const t = G.t, tm = G.team[side], en = other(side);
  const mine = teamChamps(G, side);
  const R = (teamPow(G, side)+1) / (teamPow(G, en)+1);
  const enAlive = aliveN(G, en), myAlive = aliveN(G, side);
  const o = G.obj;
  const blue = tm.blue;
  const stance = G.stance[side];
  const enemyAt = (pt, range) => {
    let count=0;
    for(const c of G.rosters[en]){
      const dx=c.x-pt[0],dy=c.y-pt[1];
      if(c.alive && dx*dx+dy*dy < range*range) count++;
    }
    return count;
  };
  const goObj = (list, pt, kind) => list.forEach(c=>{ if(c.alive) setTask(c, {k:'obj', x:pt[0]+(rnd()-0.5)*30, y:pt[1]+(rnd()-0.5)*30, o:kind}); });

  if(t < 840){
    // ===== 对线期 =====
    for(const c of mine){
      if((c.task.k==='gank' && t<=c.task.until) || (c.task.k==='obj' && objUp(G,c.task.o))) continue;
      const kind=c.role==='JUG'?'jungle':'lane', lane=LANE_OF[c.role];
      if(c.task.k!==kind || c.task.lane!==lane) setTask(c,{k:kind,lane});
    }
    const jg = mine.find(c=>c.role==='JUG');
    // 打野 Gank
    if(jg && jg.alive && jg.recall===0 && t >= tm.gankT && jg.task.k==='jungle'){
      const early = (tm.tags.early||0) + (tm.tags.pick||0)*0.6;
      let best=null, bs=-1e9;
      for(const lane of LANES3){
        const foes = G.champs.filter(x=>x.side===en && x.alive && x.task.k==='lane' && x.task.lane===lane);
        if(!foes.length) continue;
        const allies = mine.filter(x=>x.alive && x.task.k==='lane' && x.task.lane===lane);
        const over = blue ? (0.5 - G.front[lane]) : (G.front[lane]-0.5); // 敌方压线越深越好抓
        const setup=allies.reduce((s,a)=>s+a.combat.control*a.hp,0);
        const escape=foes.reduce((s,f)=>s+f.combat.escape,0);
        const sc = foes.reduce((s,f)=>s+(1-f.hp),0)*1.4 + over*3 + allies.reduce((s,a)=>s+a.hp,0)*0.4 + setup*0.35 - escape*0.22 + (lane==='bot'&&t>300?0.3:0) + rnd()*0.9;
        if(sc > bs){ bs = sc; best = lane; }
      }
      if(best){
        const [gx,gy] = lanePt(best, clamp(G.front[best] + (blue?0.02:-0.02), 0.08, 0.92));
        setTask(jg, {k:'gank', lane:best, x:gx, y:gy, until: t+38});
        tm.gankT = t + 150 + rnd()*80 - early*14;
      } else tm.gankT = t + 30;
    }
    // 辅助游走
    const sup = mine.find(c=>c.role==='SUP');
    if(sup && sup.alive && t >= tm.roamT && sup.task.k==='lane' && lanePriority(G,side,'bot')>-0.15 && (sup.tags.has('engage')||sup.tags.has('pick'))){
      const [gx,gy] = lanePt('mid', clamp(G.front.mid + (blue?0.03:-0.03), 0.1, 0.9));
      setTask(sup, {k:'gank', lane:'mid', x:gx, y:gy, until:t+30});
      tm.roamT = t + 200 + rnd()*120;
    }
    // 小龙
    if(o.drag.up || (o.drag.next!=null && o.drag.next - t < 25 && o.drag.next - t > 0)){
      const grp = mine.filter(c=>['JUG','SUP','ADC'].includes(c.role) && c.alive && c.recall===0);
      const prioBot = riverPriority(G,side,'bot');
      const enAtPit = enemyAt(MAP5.dragon, 220);
      const ourAtPit = mine.filter(c=>c.task.k==='obj' && c.task.o==='drag').length;
      const want = grp.some(c=>c.role==='JUG') && grp.length>=2 && grp.every(c=>c.hp>0.45) && (prioBot>0.05 || enAtPit>0 || R>1.15) && (enAtPit===0 || R + prioBot*0.10 > 0.8);
      if(want || ourAtPit){ goObj(grp, MAP5.dragon, 'drag'); const md = mine.find(c=>c.role==='MID'); if(md && md.alive && md.recall===0 && md.hp>0.5 && (enAtPit>=2 || (lanePriority(G,side,'mid')>-0.1 && rnd()<0.4))) goObj([md], MAP5.dragon, 'drag'); }
    }
    // 巢虫
    if(o.grubs.up){
      const grp = mine.filter(c=>['JUG','TOP'].includes(c.role) && c.alive && c.recall===0);
      const prioTop = riverPriority(G,side,'top');
      const enAtPit = enemyAt(MAP5.baron, 220);
      if(grp.length && grp.every(c=>c.hp>0.5) && (prioTop>0 || R>1.1 || enAtPit) && (enAtPit===0 || R + prioTop*0.10>0.85)) goObj(grp, MAP5.baron, 'grubs');
    }
    return;
  }

  // ===== 中后期：抱团、拿资源、分推、推进 =====
  const late = t >= 1500;
  // 分推手：带 split 标签的上/中单，否则无
  if(tm.split===null){
    let sp=null;
    for(const c of mine){
      if(c.tags.has('split') && (c.role==='TOP'||c.role==='MID') && (!sp || c.sk>sp.sk)) sp=c;
    }
    tm.split = sp ? sp.i : -1;
  }
  const splitter = tm.split>=0 ? G.champs[tm.split] : null;
  // 资源目标
  let focus = null;
  const objOK = (key, pt, need) => {
    const ob = o[key];
    const soon = ob.up || (ob.next!=null && ob.next - t < 30 && ob.next - t > 0);
    if(!soon) return false;
    const enAtPit = enemyAt(pt, 260);
    return R >= need || enAlive <= myAlive-2 || (enAtPit>0 && R>=need*0.85);
  };
  if(o.elder.up && objOK('elder', MAP5.dragon, 0.85)) focus = {k:'obj', o:'elder', pt:MAP5.dragon};
  else if(o.baron.up && objOK('baron', MAP5.baron, late?1.05:1.2)) focus = {k:'obj', o:'baron', pt:MAP5.baron};
  else if(o.drag.next!=null && objOK('drag', MAP5.dragon, tm.drakes.length>=3||G.team[en].drakes.length>=3 ? 0.8 : 0.95)) focus = {k:'obj', o:'drag', pt:MAP5.dragon};
  else if(o.herald.up && objOK('herald', MAP5.baron, 1.0)) focus = {k:'obj', o:'herald', pt:MAP5.baron};
  // 推进 / 防守
  let siege = null, defend = null;
  // 敌方在推我方塔？
  for(const lane of LANES3){
    const tw = firstAlive(G, tm.color, lane);
    if(!tw) continue;
    const attackers = enemyAt([tw.x,tw.y],160);
    if(attackers>=2 && (!defend || attackers > defend.n)) defend = {lane, n:attackers, tw};
  }
  const aggro = stance==='push' ? 0.85 : stance==='safe' ? 1.25 : 1;
  if(!focus){
    if(R >= 1.06*aggro || enAlive <= myAlive-1 || (late && R>=0.94*aggro && rnd()<0.6)){
      // 选最容易推的路：敌方该路第一座存活建筑层级越低越好、兵线越深越好
      let best=null, bs=-1e9;
      for(const lane of LANES3){
        const tw = firstAlive(G, G.team[en].color, lane) || null;
        const tier = tw ? tw.tier : 7;
        const depth = blue ? G.front[lane] : 1-G.front[lane];
        const sc = depth*2 - (tier>=5?0:tier*0.3) + (lane==='mid'?0.4:0) + rnd()*0.5 + (tw&&tw.tier===4?0.8:0);
        if(sc>bs){ bs=sc; best=lane; }
      }
      siege = best;
      // 敌方所有路的水晶都破了 → 直取主基地
      const nexT = G.towers.find(x=>x.side===G.team[en].color && x.tier>=5 && x.alive);
      const inhibDown = G.towers.some(x=>x.side===G.team[en].color && x.tier===4 && !x.alive);
      if(inhibDown && (enAlive <= 2 || R > 1.6)) { focus = {k:'go', pt: nexT ? [nexT.x,nexT.y] : MAP5.nexus[G.team[en].color], o:'nexus'}; }
    }
  }
  if(defend && !focus && R >= 0.85) focus = {k:'defend', lane:defend.lane};
  const grouped = [];
  for(const c of mine){
    if(c.task.k==='gank' && t <= c.task.until) continue;
    if(splitter && c===splitter && (!focus || focus.o!=='baron' && focus.o!=='elder' || R < 0.9) && t < 2400){
      const sideLane = focus && focus.pt && focus.pt[1] < 500 ? 'bot' : 'top';
      setTask(c, {k:'split', lane: c.role==='TOP' ? (focus&&focus.o==='baron'?'bot':'top') : sideLane});
      continue;
    }
    grouped.push(c);
  }
  if(focus && focus.k==='obj') goObj(grouped, focus.pt, focus.o);
  else if(focus && focus.k==='go') grouped.forEach(c=>setTask(c, {k:'go', x:focus.pt[0]+(rnd()-0.5)*40, y:focus.pt[1]+(rnd()-0.5)*40}));
  else if(focus && focus.k==='defend') grouped.forEach(c=>setTask(c, {k:'defend', lane:focus.lane}));
  else if(siege) grouped.forEach(c=>setTask(c, {k:'push', lane:siege}));
  else {
    // 均势或落后：分线发育，打野刷野；中期 ADC/辅助常常转中路
    for(const c of grouped){
      let lane = LANE_OF[c.role];
      if(c.role==='JUG'){ setTask(c, {k:'jungle'}); continue; }
      if(!late && (c.role==='ADC'||c.role==='SUP') && t>960) lane = 'mid';
      if(late && c.role!=='TOP') lane = 'mid';
      setTask(c, {k:'lane', lane});
    }
    // 中期抓单：有抓单英雄且敌方分推手孤立时，派人包夹
    const enSplit = G.team[en].split>=0 ? G.champs[G.team[en].split] : null;
    if(enSplit && enSplit.alive && enSplit.task.k==='split' && (tm.tags.pick||0) + (tm.tags.engage||0) >= 2 && rnd()<0.35){
      const lonely = !G.champs.some(x=>x.side===en && x!==enSplit && x.alive && hyp(x.x-enSplit.x,x.y-enSplit.y)<300);
      if(lonely){
        const hunters = mine.filter(c=>c.alive && c!==splitter && (c.role==='JUG' || c.tags.has('pick') || c.tags.has('engage'))).slice(0,3);
        hunters.forEach(h=>setTask(h, {k:'gank', lane:enSplit.task.lane, x:enSplit.x, y:enSplit.y, until:t+30}));
      }
    }
  }
}
function objUp(G, k){ const ob = G.obj[k]; return ob && (ob.up || (ob.next!=null && ob.next - G.t < 30 && ob.next > G.t)); }
function firstAlive(G, color, lane){
  if(!G.towerDirty && G.first) return G.first[color][lane] || null;
  let best = null;
  for(const tw of G.towers) if(tw.side===color && tw.lane===lane && tw.alive && (!best || tw.tier < best.tier)) best = tw;
  return best;
}

// ---------------- 对线换血（对线期每条线定时结算） ----------------
function laneTrades(G){
  const t = G.t;
  for(const lane of LANES3){
    if(t < G.laneT[lane]) continue;
    G.laneT[lane] = t + (t<840 ? 22 + rnd()*16 : 30 + rnd()*20);
    const [x,y]=lanePt(lane,G.front[lane]);
    const near = (c) => c.alive && c.recall===0 && c.task.lane===lane && (c.task.k==='lane'||c.task.k==='split') && hyp(c.x-x,c.y-y) < 120;
    const a = G.champs.filter(c=>c.side==='A' && near(c)), b = G.champs.filter(c=>c.side==='B' && near(c));
    if(!a.length || !b.length) continue;
    const pa = a.reduce((s,c)=>s+champPow(G,c,0)*(1+(c.tags.has('early')?0.12:0)+(c.tags.has('poke')?0.08:0)),0);
    const pb = b.reduce((s,c)=>s+champPow(G,c,0)*(1+(c.tags.has('early')?0.12:0)+(c.tags.has('poke')?0.08:0)),0);
    const pA = pa*pa/(pa*pa+pb*pb);
    const aWin = rnd() < pA;
    const [W,L] = aWin ? [a,b] : [b,a];
    const marg = Math.abs(pA-0.5)*2;
    L.forEach(c=>c.hp = Math.max(0.05, c.hp - (0.07 + rnd()*0.12 + marg*0.08)));
    W.forEach(c=>c.hp = Math.max(0.08, c.hp - (0.02 + rnd()*0.08)));
    G.front[lane] = clamp(G.front[lane] + ((W[0].blue)?1:-1)*0.035, 0.12, 0.88);
    // 残血被击杀：单杀 / 二打二
    const dying = L.filter(c=>c.hp < 0.2);
    if(dying.length && rnd() < 0.2 + marg*0.25){
      resolveFight(G, a, b, 'lane', true);
    }
  }
}

// ---------------- 遭遇检测 → 团战 / 抓人 ----------------
function encounters(G){
  const cs = G.champs, R = SIM5.ENC, early = G.t < 840;
  const used = G._used || (G._used = new Array(10));
  for(let i=0;i<10;i++) used[i] = false;
  for(let i=0;i<10;i++){
    const c = cs[i]; if(!c.alive || c.recall>0 || c.fightCd>0 || used[i]) continue;
    for(let j=i+1;j<10;j++){
      const o = cs[j]; if(o.side===c.side || !o.alive || o.recall>0 || o.fightCd>0 || used[j]) continue;
      const dx = o.x-c.x, dy = o.y-c.y;
      if(dx > R || dx < -R || dy > R || dy < -R || dx*dx+dy*dy > R*R) continue;
      // 对线期：线上对峙由 laneTrades 处理，只有 Gank / 资源争夺 / 入侵才会爆发遭遇战
      {
        const ck = c.task.k, ok = o.task.k;
        const act = ck==='gank'||ck==='obj'||ok==='gank'||ok==='obj'||ck==='push'||ok==='push'||ck==='defend'||ok==='defend'||ck==='go'||ok==='go';
        const calm = G.team.A.calmT > G.t && G.team.B.calmT > G.t;
        if(calm){ const hot = ck==='obj'||ok==='obj'; if(rnd() < (hot ? 0.75 : 0.9)) continue; }
        if(!act){
          if(early){ if(!(ck==='jungle' && ok==='jungle' && rnd() < 0.04)) continue; }
          else if((ck==='lane'||ck==='split') && (ok==='lane'||ok==='split') && c.task.lane===o.task.lane) continue;
          else if(rnd() > 0.35) continue;
        }
      }
      const cx = (c.x+o.x)/2, cy = (c.y+o.y)/2;
      const A = [], B = [];
      let pa = 0, pb = 0;
      for(let k=0;k<10;k++){
        const x = cs[k];
        if(!x.alive || x.recall>0 || x.fightCd>0 || used[k]) continue;
        if(Math.abs(x.x-cx) > 150 || Math.abs(x.y-cy) > 150) continue;
        if(x.side==='A'){ A.push(x); pa += x.pw; } else { B.push(x); pb += x.pw; }
      }
      if(!A.length || !B.length) continue;
      for(const x of A) used[x.i] = true; for(const x of B) used[x.i] = true;
      // 弱势方可能拉扯脱离
      const weak = pa < pb ? A : B, ratio = Math.min(pa,pb)/Math.max(pa,pb,1e-9);
      const defending = weak.some(x=>x.task.k==='defend');
      const n = A.length + B.length;
      const escape = ratio < 0.7 ? (defending ? (ratio < 0.55 ? 0.55 : 0) : 0.7 + (weak.some(x=>x.tags.has('protect'))?0.08:0) - (n>=7?0.15:0)) : 0;
      if(rnd() < escape){
        for(const x of weak){ x.fightCd = 8; x.hp = Math.max(0.1, x.hp-0.1); if(x.hp<0.45) startRecall5(x); else setTask(x, {k:'base'}); }
        break;
      }
      const kind = n >= 6 ? 'team' : (A.length===1||B.length===1) && n>=3 ? 'gank' : 'skirm';
      resolveFight(G, A, B, kind, false);
      break;
    }
  }
}

function fightProfile(group){
  const sum={...EMPTY_COMBAT_PROFILE,poke:0};
  for(const c of group){
    const k=c.combat, ready=0.45+0.55*c.hp;
    for(const key in k) sum[key]+=k[key]*ready;
    if(c.tags.has('poke')) sum.poke+=ready;
  }
  return sum;
}
function localFightBonus(own, enemy, kind, river){
  const chain=Math.min(2.4,own.control)*(0.014 + Math.min(1.8,own.engage)*0.009);
  const opening=own.engage/(1+0.35*enemy.protect+0.30*enemy.antiDash*own.dash);
  const zoning=own.antiDash*Math.min(2.2,enemy.dash)*0.023;
  const defense=own.antiMagic*Math.min(2.8,enemy.magic)*0.013 + own.antiAuto*Math.min(2.3,enemy.sustained)*0.017 + own.guardProjectile*Math.min(2.4,enemy.projectile)*0.015;
  if(kind!=='team') return clamp(chain + opening*0.019 + zoning + defense - enemy.escape*0.009,-0.05,0.12);
  const screen=Math.min(2.2,own.frontline)*Math.min(2.4,own.sustained)*0.016;
  const peel=Math.min(2,own.protect)*Math.min(2.4,enemy.engage)*0.016;
  return clamp(chain + opening*0.019 + zoning + defense + screen + peel + own.poke*(river?0.014:0.008),0,0.19);
}
// 团战/抓人结算：集火、击杀、助攻（严格对账），存活者状态
function resolveFight(G, A, B, kind, laneFight){
  const t = G.t;
  const near = (pt, r) => hyp(A[0].x-pt[0], A[0].y-pt[1]) < r;
  const atBaron = near(MAP5.baron, 200), atDragon = near(MAP5.dragon, 200);
  const big = (atBaron && (G.obj.baron.up)) || (atDragon && (G.obj.elder.up || (G.team.A.drakes.length>=3||G.team.B.drakes.length>=3)));
  let goldA=0,goldB=0;
  for(const champ of G.champs){ if(champ.side==='A') goldA+=champ.tg; else goldB+=champ.tg; }
  const pressSide = s => {
    let p = big ? 0.8 : kind==='team' ? 0.35 : 0.15;
    const behind = s==='A' ? goldB-goldA : goldA-goldB;
    if(behind > 4000) p += 0.35;
    return p + pressureOf(G.d.ctx)*0.5;
  };
  const profileA=fightProfile(A), profileB=fightProfile(B);
  const sidePow = (L, s, own, enemy) => {
    let p = 0;
    const pressure=pressSide(s);
    for(const c of L) p += champPow(G, c, pressure);
    // 塔下防守优势
    const myColor = G.team[s].color;
    for(const tw of G.towers){ if(tw.side===myColor && tw.alive && Math.abs(tw.x-L[0].x)+Math.abs(tw.y-L[0].y) < 170){ p *= tw.tier===1 ? 1.1 : 1.18; break; } }
    return p * (1+localFightBonus(own,enemy,kind,atBaron||atDragon));
  };
  const pa = sidePow(A,'A',profileA,profileB)*Math.exp(randn()*SIM5.FN), pb = sidePow(B,'B',profileB,profileA)*Math.exp(randn()*SIM5.FN);
  const pAwin = pa*pa/(pa*pa+pb*pb);
  const aWin = rnd() < pAwin;
  const W = aWin ? A : B, L = aWin ? B : A;
  const margin = Math.abs(pa*pa-pb*pb)/(pa*pa+pb*pb);
  const plBase = laneFight ? 0.2 : kind==='gank' ? 0.12 : kind==='team' ? 0.11 : 0.13;
  const deathsL = [], deathsW = [];
  const lossProfile=aWin?profileB:profileA, winProfile=aWin?profileA:profileB;
  for(const c of L){
    let pl = plBase + margin*0.5 + (1-c.hp)*0.2 - (c.tags.has('protect')?0.04:0) + (c.mental<=-2?0.06:0);
    if(!laneFight) pl += Math.min(2,winProfile.control)*0.017 - c.combat.frontline*0.034 - c.combat.escape*0.026 - Math.min(2,lossProfile.protect)*0.013;
    if(laneFight && c.hp < 0.2) pl += 0.5;
    if(rnd() < clamp(pl, 0.05, 0.95)) deathsL.push(c);
  }
  for(const c of W){
    const pw = laneFight ? 0.02 : 0.03 + 0.22*(1-margin)*(kind==='team'?1:0.5) + (1-c.hp)*0.08;
    if(rnd() < clamp(pw, 0.01, 0.4)) deathsW.push(c);
  }
  if(!deathsL.length && !laneFight && kind!=='skirm' && rnd() < 0.55){ deathsL.push(wpick(L, c=>1.5-c.hp)); }
  if(laneFight && !deathsL.length){ const lo = L.slice().sort((x,y)=>x.hp-y.hp)[0]; if(lo.hp<0.2) deathsL.push(lo); }
  const fx = (A[0].x+B[0].x)/2, fy = (A[0].y+B[0].y)/2;
  G.fx.push({t, x:fx, y:fy, n: deathsL.length+deathsW.length});
  if(G.rec) G.evs.push([t,'F',Math.round(fx),Math.round(fy),deathsL.length+deathsW.length]);
  const killW = {TOP:1, JUG:1.1, MID:1.35, ADC:1.6, SUP:0.3};
  const doKill = (victim, killers, allies) => {
    const alive = killers.filter(c=>c.alive);
    const pool = alive.length ? alive : killers;
    const killer = wpick(pool, c=>killW[c.role]*champPow(G,c,0)*(c.tags.has('pick')?1.15:1)+0.01);
    const assists = allies.filter(c=>c!==killer && rnd() < (kind==='team'?0.82:0.7));
    applyKill(G, killer, victim, assists);
  };
  // 交错结算：败方阵亡与胜方阵亡按顺序穿插
  const order = [];
  deathsL.forEach(v=>order.push([v, W]));
  deathsW.forEach(v=>order.splice(Math.floor(rnd()*(order.length+1)), 0, [v, L]));
  let killsBy = {A:0, B:0};
  for(const [v, ks] of order){ if(!v.alive) continue; const kset = ks; doKill(v, kset, kset); killsBy[v.side==='A'?'B':'A']++; }
  // 存活者状态
  for(const c of L) if(c.alive){ c.hp = Math.max(0.06, c.hp*(0.35+rnd()*0.3)); c.fightCd = 15; if(c.hp < 0.45){ setTask(c, {k:'base'}); startRecall5(c); } }
  for(const c of W) if(c.alive){ c.hp = Math.max(0.1, c.hp*(0.55+rnd()*0.35)); c.fightCd = 9; }
  if(!laneFight){ G.planT = t; if(kind!=='gank'){ G.team.A.calmT = t + 75; G.team.B.calmT = t + 75; } }
  // 团灭 / 团战播报
  const lSide = L[0].side;
  if(kind==='team' && deathsL.length>=3){
    const aced = aliveN(G, lSide)===0;
    feed(G, W[0].side, aced?'团灭':'团战胜利', aced ? `☠️ ${G.team[W[0].side].name} 打出一波团灭！${G.team[lSide].name} 全员阵亡！` : `⚔️ ${G.team[W[0].side].name} 团战 ${killsBy[W[0].side]} 换 ${killsBy[lSide]} 大获全胜！`, true);
  } else if(kind==='team' && (deathsL.length||deathsW.length)){
    feed(G, W[0].side, '团战', `${G.team[W[0].side].name} 在${atBaron?'大龙坑':atDragon?'小龙坑':'野区'}附近打出 ${killsBy[W[0].side]} 换 ${killsBy[lSide]} 的交换。`);
  }
  // 抢龙：团战败方的打野在资源快被拿下时惩戒抢走
  for(const key of ['baron','drag','elder']){
    const ob = G.obj[key];
    if(!ob.up || ob.prog < 0.55) continue;
    const pit = key==='baron' ? MAP5.baron : MAP5.dragon;
    if(hyp(fx-pit[0], fy-pit[1]) > 220) continue;
    const jg = G.champs.find(c=>c.side===lSide && c.role==='JUG' && c.alive && c.recall===0 && hyp(c.x-pit[0],c.y-pit[1])<200);
    const defendingJg=W.some(c=>c.role==='JUG' && c.alive && c.recall===0);
    if(jg && ob.by===W[0].side && rnd() < (defendingJg?0.14:0.28)){ takeObj(G, key, lSide, true); }
  }
}

function applyKill(G, killer, victim, assists){
  const t = G.t;
  victim.alive = false; victim.hp = 0; victim.d++;
  victim.pw = 0;
  const rt = BRW[victim.lvl-1] * (1 + Math.max(0, t/60-15)*0.018);
  victim.rt = Math.round(rt); victim.recall = 0;
  victim.task = TK({k: victim.role==='JUG'?'jungle':'lane', lane: LANE_OF[victim.role]});
  killer.k++; killer.streak++;
  assists.forEach(a=>a.a++);
  const shut = victim.streak >= 3 ? Math.min(700, 150*(victim.streak-2)) : 0;
  victim.streak = 0;
  let gold = 300 + shut + (G.firstBlood ? 0 : 100);
  killer.gold += gold; killer.tg += gold;
  if(assists.length){ const share = gold*0.5/assists.length; assists.forEach(a=>{ a.gold += share; a.tg += share; }); }
  const xp = 140 + victim.lvl*28; killer.xp += xp*0.6; assists.forEach(a=>a.xp += xp*0.4/assists.length);
  G.team[killer.side].kills++;
  if(G.rec) G.evs.push([t,'K',killer.i,victim.i,assists.map(a=>a.i),victim.rt]);
  // 战报
  const lk = G.lastKill[killer.i];
  let multi = 1;
  if(lk && t - lk.t <= 10){ multi = lk.n + 1; }
  G.lastKill[killer.i] = {t, n:multi};
  const MULTI = {2:'双杀',3:'三杀',4:'四杀',5:'五杀'};
  if(!G.firstBlood){
    G.firstBlood = killer.side;
    feed(G, killer.side, '一血', `🩸 ${cname(killer)}${assists.length?` 配合 ${assists.map(cname).join('、')}`:''} 击杀 ${cname(victim)}，${G.team[killer.side].name} 拿下一血！`, true);
  } else if(multi >= 3){
    feed(G, killer.side, MULTI[multi], `🔥 ${cname(killer)} 拿下${MULTI[multi]}！${multi===5?'五杀！！全场沸腾！':'收割全场！'}`, true);
  } else if(multi === 2){
    feed(G, killer.side, '双杀', `${cname(killer)} 连续击杀拿下双杀！`);
  } else if(!assists.length){
    feed(G, killer.side, '单杀', `💥 ${cname(killer)} 单杀 ${cname(victim)}！`, G.t < 1200);
  } else {
    feed(G, killer.side, shut?'终结':'击杀', `${cname(killer)}${shut?` 终结了 ${cname(victim)} 的连杀，拿下 ${shut} 赏金`:` 击杀 ${cname(victim)}`}${assists.length?`，助攻：${assists.map(a=>a.tag).join('、')}`:''}。`, !!shut);
  }
}

// ---------------- 资源争夺 ----------------
function objectives(G){
  const t = G.t, o = G.obj;
  const check = (key, pt, need) => {
    const ob = o[key]; if(!ob.up) return;
    const groups={A:[],B:[]}, near={A:false,B:false};
    for(const c of G.champs){
      if(!c.alive || c.recall!==0) continue;
      const dx=c.x-pt[0],dy=c.y-pt[1],distance=dx*dx+dy*dy;
      if(distance<22500) near[c.side]=true;
      if(distance<5625) groups[c.side].push(c);
    }
    let side = null, grp = null;
    if(groups.A.length && !near.B){ side='A'; grp=groups.A; }
    else if(groups.B.length && !near.A){ side='B'; grp=groups.B; }
    if(!side){ return; }
    if(ob.by && ob.by!==side) ob.prog = 0;
    ob.by = side;
    const rate = grp.reduce((s,c)=>s + Math.exp(SIM5.LV*c.lvl + c.invest/SIM5.IT)*(1+c.combat.sustained*0.10)*(c.role==='JUG'?1.12:1), 0) / need;
    ob.prog += rate*SIM5.DT;
    if(ob.prog >= 1) takeObj(G, key, side, false);
  };
  check('drag', MAP5.dragon, 22 + t/60*1.8);
  check('elder', MAP5.dragon, 40);
  check('grubs', MAP5.baron, 16);
  check('herald', MAP5.baron, 26);
  check('baron', MAP5.baron, 34 + Math.max(0,(t-1200)/60)*1.2);
}
function takeObj(G, key, side, steal){
  const t = G.t, o = G.obj[key], tm = G.team[side];
  o.up = false; o.prog = 0; o.by = null;
  const nm = tm.name;
  const jg = G.champs.find(c=>c.side===side && c.role==='JUG');
  if(key==='drag'){
    const dk = DRAKES.find(x=>x[0]===o.type) || DRAKES[0];
    tm.drakes.push(o.type);
    G.drakeSeen = (G.drakeSeen||[]).concat(o.type);
    const total = G.team.A.drakes.length + G.team.B.drakes.length;
    if(total===1 && !o.mapType) o.mapType = pickOne(DRAKES.filter(x=>x[0]!==o.type))[0];
    if(total>=2) o.type = o.mapType; else o.type = null;
    if(tm.drakes.length >= 4){
      tm.soul = o.mapType || dk[0];
      o.next = null; G.obj.elder.next = t + 360;
      feed(G, side, '龙魂', `🐉 ${nm} 拿下第四条小龙，获得${(DRAKES.find(x=>x[0]===tm.soul)||dk)[1].replace('亚龙','')}龙魂！`, true);
    } else {
      o.next = t + 300;
      feed(G, side, steal?'抢龙':'小龙', steal ? `😱 ${jg?cname(jg):nm} 惩戒抢下${dk[1]}！` : `${nm} 拿下${dk[1]}（第 ${tm.drakes.length} 条）。`, steal || tm.drakes.length>=3);
    }
  } else if(key==='elder'){
    tm.elderT = t + 150; o.next = t + 360;
    feed(G, side, steal?'抢远古龙':'远古龙', steal ? `😱 ${jg?cname(jg):nm} 神级惩戒抢下远古巨龙！` : `🐲 ${nm} 拿下远古巨龙，获得斩杀之力！`, true);
  } else if(key==='baron'){
    tm.baronT = t + 180; tm.barons++; o.next = t + 360;
    G.champs.filter(c=>c.side===side && c.alive).forEach(c=>{ c.gold += 300; c.tg += 300; });
    feed(G, side, steal?'抢大龙':'大龙', steal ? `😱 ${jg?cname(jg):nm} 惩戒抢下大龙！局势瞬间逆转！` : `👾 ${nm} 拿下纳什男爵，带着大龙 Buff 准备推进！`, true);
  } else if(key==='grubs'){
    tm.grubs += 3; o.up = false;
    if(o.wave===0 && t < 600){ o.wave = 1; o.next = t + 240; } else o.next = null;
    G.champs.filter(c=>c.side===side && c.alive).forEach(c=>{ c.gold += 25; c.tg += 25; });
    feed(G, side, '巢虫', `${nm} 拿下 3 只虚空巢虫，推塔能力提升。`);
  } else if(key==='herald'){
    tm.heraldT = t + 240; o.next = null;
    feed(G, side, '峡谷先锋', `${nm} 拿下峡谷先锋，准备撞塔。`);
  }
  if(G.rec) G.evs.push([t,'O',key,side,key==='drag'?(tm.drakes[tm.drakes.length-1]||''):'', steal?1:0]);
  // 资源到手后回到常规决策
  G.champs.filter(c=>c.side===side && c.task.k==='obj' && c.task.o===key).forEach(c=>{ c.task = TK({k: c.role==='JUG'?'jungle':'lane', lane: LANE_OF[c.role]}); });
  G.planT = t;
}

// ---------------- 兵线与防御塔 ----------------
function towerDamageable(G, tw){
  if(!tw.alive) return false;
  if(tw.tier<=4){
    if(tw.tier===1) return true;
    return !G.towers.some(x=>x.side===tw.side && x.lane===tw.lane && x.tier===tw.tier-1 && x.alive);
  }
  if(tw.tier===5) return G.towers.some(x=>x.side===tw.side && x.tier===4 && !x.alive);
  return !G.towers.some(x=>x.side===tw.side && x.tier===5 && x.alive);
}
function refreshTowers(G){
  // 缓存：每条路第一座存活建筑、各建筑是否可被攻击
  const first = {blue:{}, red:{}};
  for(const tw of G.towers){ if(tw.alive && tw.lane){ const f = first[tw.side][tw.lane]; if(!f || tw.tier < f.tier) first[tw.side][tw.lane] = tw; } }
  G.first = first;
  const inhibDown = {blue:false, red:false}, ntAlive = {blue:0, red:0};
  for(const tw of G.towers){ if(tw.tier===4 && !tw.alive) inhibDown[tw.side] = true; if(tw.tier===5 && tw.alive) ntAlive[tw.side]++; }
  G.inhibDown = inhibDown;
  G.supLane = {blue:{}, red:{}};
  for(const tw of G.towers) if(tw.tier===4 && !tw.alive) G.supLane[tw.side][tw.lane] = true;
  for(const tw of G.towers){
    tw.dmgable = tw.alive && (tw.lane ? first[tw.side][tw.lane]===tw : tw.tier===5 ? inhibDown[tw.side] : ntAlive[tw.side]===0);
  }
  G.towerDirty = false;
}
function towerDamageable(G, tw){ if(G.towerDirty || !G.first) refreshTowers(G); return tw.dmgable; }
function lanesAndTowers(G){
  const t = G.t, DT = SIM5.DT;
  if(G.towerDirty || !G.first) refreshTowers(G);
  const norm = Math.exp(SIM5.LV*Math.max(1, Math.min(18, 1+t/110)) + Math.min(18000, t*8)/SIM5.IT);
  const champs = G.champs;
  const alive=G.aliveN||(G.aliveN={blue:0,red:0});
  alive.blue=alive.red=0;
  for(const c of champs) if(c.alive) alive[c.blue?'blue':'red']++;
  for(let li=0; li<3; li++){
    const lane = LANES3[li];
    const fp = lanePt(lane, G.front[lane]);
    const fx = fp[0], fy = fp[1];
    let pB = 0, pR = 0;
    for(let i=0;i<10;i++){
      const c = champs[i];
      if(!c.pw) continue;
      if(Math.abs(c.x-fx) > 130 || Math.abs(c.y-fy) > 130) continue;
      if(c.blue) pB += c.pw; else pR += c.pw;
    }
    const supB = G.supLane.red[lane] ? 1.6 : 0, supR = G.supLane.blue[lane] ? 1.6 : 0;
    const fb = pB/norm + 0.6 + supB, fr = pR/norm + 0.6 + supR;
    let v = 0.008 * DT * (fb - fr) / (fb + fr);
    if(pB===0 && pR===0 && !supB && !supR) v += (0.0012*(G.aliveN.blue - G.aliveN.red)/5 + (0.5 - G.front[lane]) * 0.0004 + randn()*0.002) * DT;
    const rT = G.first.red[lane], bT = G.first.blue[lane];
    const maxS = rT ? rT.s - 0.012 : 0.93, minS = bT ? bT.s + 0.012 : 0.07;
    let nf = G.front[lane] + v;
    nf = nf < minS ? minS : nf > maxS ? maxS : nf;
    G.front[lane] = nf;
    for(let k=0;k<2;k++){
      const tw = k===0 ? rT : bT, pw = k===0 ? pB : pR, atkColor = k===0 ? 'blue' : 'red';
      if(!tw || !tw.dmgable) continue;
      if(atkColor==='blue' ? nf < tw.s - 0.02 : nf > tw.s + 0.02) continue;
      const atkSide = G.team.A.color===atkColor ? 'A' : 'B';
      const tm = G.team[atkSide];
      let dmg = (0.0006 + Math.min(1, t/1800)*0.0022 + (pw/norm) * SIM5.TD * (1 + tm.grubs*0.04)) * DT;
      if(tm.baronT > t) dmg *= 2.2;
      if(tm.heraldT > t && tw.tier<=2 && pw>0 && rnd()<0.05*DT){ dmg += 0.3; tm.heraldT = 0; feed(G, atkSide, '先锋撞塔', `${tm.name} 放出峡谷先锋撞向${laneCN(lane)}防御塔！`); }
      if(tw.tier===1 && t < 300) dmg *= 0.3;
      if(t > 3000) dmg *= 2.5;
      tw.hp -= dmg;
      if(tw.tier===1 && t < 840 && tw.plates > 0 && tw.hp <= tw.plates*0.2 - 0.2 + 0.0001){
        tw.plates--;
        const atk = champs.filter(c=>c.side===atkSide && c.alive && Math.abs(c.x-tw.x)+Math.abs(c.y-tw.y)<200);
        atk.forEach(c=>{ const g = 150/Math.max(1,atk.length); c.gold += g; c.tg += g; });
      }
      if(pw>0){ const hit = (tw.tier===1&&t<840?0.006:0.0035)*DT; for(const c of champs){ if(c.side===atkSide && c.alive && Math.abs(c.x-tw.x)+Math.abs(c.y-tw.y)<140) c.hp = Math.max(0.05, c.hp - hit); } }
      if(tw.hp <= 0) destroyTower(G, tw, atkSide);
    }
  }
  if(!G.inhibDown.blue && !G.inhibDown.red) return;
  for(const tw of G.towers){
    if(tw.tier < 5 || !tw.dmgable) continue;
    const atkSide = (tw.side==='blue') === (G.team.A.color==='red') ? 'A' : 'B';
    let p = 0;
    for(const c of champs){ if(c.side===atkSide && c.pw && Math.abs(c.x-tw.x)+Math.abs(c.y-tw.y)<160) p += c.pw; }
    if(!p) continue;
    let dmg = p/norm * 0.006 * DT;
    if(G.team[atkSide].baronT > t) dmg *= 1.8;
    if(t > 3000) dmg *= 2;
    tw.hp -= dmg;
    if(tw.hp <= 0) destroyTower(G, tw, atkSide);
    if(G.over) return;
  }
}
const laneCN = l => ({top:'上路',mid:'中路',bot:'下路'}[l]||'');
const TIER_CN = {1:'一塔',2:'二塔',3:'高地塔',4:'召唤水晶',5:'门牙塔',6:'主水晶'};
function destroyTower(G, tw, side){
  const t = G.t, tm = G.team[side];
  tw.alive = false; tw.hp = 0; G.towerDirty = true;
  if(G.rec) G.evs.push([t,'T',tw.id,side]);
  if(tw.tier===6){ endGame5(G, side); return; }
  if(tw.tier===4){ tw.resp = t + 300; feed(G, side, '破水晶', `💎 ${tm.name} 攻破${laneCN(tw.lane)}召唤水晶，超级兵即将出动！`, true); return; }
  tm.towers++;
  const near = G.champs.filter(c=>c.side===side && c.alive && hyp(c.x-tw.x,c.y-tw.y)<220);
  G.champs.filter(c=>c.side===side).forEach(c=>{ const g = 50 + (near.includes(c) ? 200/Math.max(1,near.length) : 0); c.gold += g; c.tg += g; });
  if(!G.firstTower){ G.firstTower = side; feed(G, side, '一塔', `🏰 ${tm.name} 推掉${laneCN(tw.lane)}一塔，拿下首座防御塔！`, true); }
  else if(tw.tier===5) feed(G, side, '门牙塔', `${tm.name} 推掉门牙塔，主水晶岌岌可危！`, true);
  else feed(G, side, '推塔', `${tm.name} 推掉${laneCN(tw.lane)}${TIER_CN[tw.tier]}。`, tw.tier===3);
}
function endGame5(G, side){
  if(G.over) return;
  G.over = true; G.winner = side;
  feed(G, side, '推平水晶', `🏆 ${G.team[side].name} 攻破主水晶，赢下本局比赛！`, true);
}

// ---------------- 录像 ----------------
function recFrame5(G){
  let s = '';
  for(const c of G.champs){ s += enc1(c.x/1000*63) + enc1(c.y/1000*63) + enc1(c.alive ? Math.max(1, c.hp*63) : 0); }
  G.frames.push(s);
}
function recStats5(G){
  let s = '';
  for(const c of G.champs){ s += enc2(c.cs) + enc2(c.tg/10) + enc1(c.lvl) + enc2(Math.max(0,c.gold)/10); }
  G.stats.push(s);
}

// ---------------- 结算（兼容旧 playGame 结构） ----------------
function game5Result(G){
  if(G.result) return G.result;
  const d = G.d, ev = G.ev;
  const winA = G.winner==='A';
  const rows = side => G.champs.filter(c=>c.side===side).map(c=>({
    pid:c.pid, tag:c.tag, r:c.role, c:c.c, k:c.k, d:c.d, a:c.a, cs:Math.round(c.cs), gold:Math.round(c.tg), lvl:c.lvl, items:c.items.slice()
  }));
  const sa = rows('A'), sb = rows('B');
  const kA = sa.reduce((s,x)=>s+x.k,0), kB = sb.reduce((s,x)=>s+x.k,0);
  const gA = sa.reduce((s,x)=>s+x.gold,0), gB = sb.reduce((s,x)=>s+x.gold,0);
  const winStats = winA ? sa : sb;
  const winTotalK = Math.max(1, winA ? kA : kB);
  const mvpRow = winStats.slice().sort((x,y)=>{
    const sx = x.k*2.4 + x.a*1.2 - x.d*1.6 + ((x.k+x.a)/winTotalK)*4 + x.gold/4000 + rnd()*0.5;
    const sy = y.k*2.4 + y.a*1.2 - y.d*1.6 + ((y.k+y.a)/winTotalK)*4 + y.gold/4000 + rnd()*0.5;
    return sy - sx;
  })[0];
  const game = {
    w: G.winner, dur: Math.max(15, Math.round(G.t/60)), durSec: G.t, kA, kB,
    turA: G.team.A.towers, turB: G.team.B.towers,
    dragA: G.team.A.drakes.length, dragB: G.team.B.drakes.length, baronA: G.team.A.barons, baronB: G.team.B.barons,
    goldDiff: Math.round((gA-gB)/100)/10,
    mvp: mvpRow ? mvpRow.pid : null, mvpTag: mvpRow ? mvpRow.tag : '',
    pA: ev.pA, sa, sb, events: G.key.slice(0, 40),
    bans: {A:d.bans.A.slice(), B:d.bans.B.slice()}, picks: {A:{...d.picks.A}, B:{...d.picks.B}},
    blue: d.blue, first: d.first, styleA: ev.a.comp.style, styleB: ev.b.comp.style
  };
  if(G.rec) game.rec = recordOf(G);
  game.impacts = G.over ? applyGameImpact(game, d.A, d.B) : [];
  if(G.over) G.result=game;
  return game;
}
function recordOf(G){
  return {
    v: SIM_VER, dur: G.t, blue: G.d.blue,
    champs: G.champs.map(c=>({side:c.side, role:c.role, tag:c.tag, c:c.c, pid:c.pid})),
    teams: {A:G.d.A, B:G.d.B},
    f: G.frames, st: G.stats, ev: G.evs, feed: G.feed.map(x=>[x.sec, x.side||'', x.tag, x.text, x.hl?1:0]), gs: G.gs
  };
}
function playGame(d, opts){
  const G = createGame5(d, opts);
  while(!G.over) step5(G);
  return game5Result(G);
}

// ================= 回放存档：最多 200 条，最近 10 局 + 最多 10 局永久收藏 =================
const REPLAY_MAX_RECENT = 10, REPLAY_MAX_KEPT = 10, REPLAY_MAX_ENTRIES = 200;
function replayStore(){ if(!S.replays) S.replays = []; return S.replays; }
function pushReplay(entry){
  const list = replayStore();
  entry.id = entry.id || ('r' + Date.now().toString(36) + Math.floor(rnd()*1e4).toString(36));
  list.unshift(entry);
  pushReplayTrim();
  return entry.id;
}
function findReplay(id){ return (S.replays||[]).find(r=>r.id===id) || null; }
function toggleKeepReplay(id){
  const r = findReplay(id); if(!r) return {ok:false, msg:'回放不存在'};
  if(r.kept){ r.kept = false; pushReplayTrim(); return {ok:true, msg:'已取消永久保留'}; }
  if(!r.rec && !r.solo) return {ok:false, msg:'这局只剩比分数据，无法收藏'};
  const kept = (S.replays||[]).filter(x=>x.kept).length;
  if(kept >= REPLAY_MAX_KEPT) return {ok:false, msg:`永久保留已达上限 ${REPLAY_MAX_KEPT} 局，请先取消一局`};
  r.kept = true; return {ok:true, msg:'已永久保留这局回放'};
}
function pushReplayTrim(){
  const list = S.replays || [];
  let recent = 0;
  for(const r of list){
    if(r.kept || (!r.rec && !r.solo)) continue;
    if(++recent <= REPLAY_MAX_RECENT) continue;
    r.rec = null; r.solo = null; r.trimmed = true;
  }
  for(let i=list.length-1; i>=0 && list.length>REPLAY_MAX_ENTRIES; i--){
    const r = list[i];
    if(!r.kept && !r.rec && !r.solo) list.splice(i,1);
  }
}
