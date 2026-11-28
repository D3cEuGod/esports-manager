// 峡谷经理人 · 模拟内核测试（纯 Node，无依赖）
// 用法：node tests/run.js            （默认固定随机种子，可复现）
//       SEED=123 node tests/run.js   （换一个种子）
// 先运行 python build_web.py 生成 src/data.js 与 src/traits.js
const { load } = require('./harness.js');

// 固定随机种子：替换 Math.random，保证每次结果可复现
const SEED = +(process.env.SEED || 20261124);
let _s = SEED >>> 0;
Math.random = () => { _s = (_s + 0x6D2B79F5) >>> 0; let t = _s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const run = load();
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗ ' + msg); } return cond; };
const section = t => console.log('\n■ ' + t);

run(`newGame('BLG')`);
const ks = run(`Object.keys(S.teams)`);
const pickPair = () => { const a = ks[Math.floor(Math.random() * ks.length)]; let b = a; while (b === a) b = ks[Math.floor(Math.random() * ks.length)]; return [a, b]; };

// ---------------------------------------------------------------- 1v1
section('1v1 SOLO：100 局');
{
  const reasons = {}; let maxT = 0, totalMs = 0;
  for (let i = 0; i < 100; i++) {
    const [a, b] = pickPair();
    const t0 = performance.now();
    const r = run(`simSolo1v1(${JSON.stringify(a)}, ${JSON.stringify(b)}, null, null, {record:true})`);
    totalMs += performance.now() - t0;
    ok(r.teamA === a && r.teamB === b, '1v1 返回 teamA/teamB');
    ok(r.winner === 'A' || r.winner === 'B', '1v1 winner 为 A/B');
    ok(typeof r.winReason === 'string' && r.winReason.length > 0, '1v1 有 winReason');
    ok(r.A && r.B && r.A.champ && r.B.champ, '1v1 有双方英雄');
    ok(r.rec && r.rec.f.length === r.dur - 90 + 1, `1v1 录像逐秒一帧（${r.rec && r.rec.f.length} vs ${r.dur - 89}）`);
    ok(Array.isArray(r.frames) && r.frames.length > 0, '1v1 frames 旧格式日志');
    ok(r.dur < 720, `1v1 在 12:00 前结束（${r.dur}s）`);
    const k = /缩圈|火圈|判定/.test(r.winReason) ? '火圈' : /一血|单杀|击杀/.test(r.winReason) ? '一血' : /补刀|百刀/.test(r.winReason) ? '100 补刀' : /塔/.test(r.winReason) ? '一塔' : r.winReason;
    reasons[k] = (reasons[k] || 0) + 1; maxT = Math.max(maxT, r.dur);
  }
  console.log('  胜因分布', JSON.stringify(reasons), '最长', maxT, 's  平均', (totalMs / 100).toFixed(2), 'ms/局');
  for (const k of ['一血', '100 补刀', '一塔', '火圈']) ok(reasons[k] > 0, `四种胜利条件都出现过：${k}`);
}

// ---------------------------------------------------------------- 5v5 不变量 + 性能
section('5v5：300 局不变量与性能');
{
  const N = 300; let ms = [], dur = 0, kills = 0, towers = 0;
  // 预热（JIT）
  for (let i = 0; i < 10; i++) { const [a, b] = pickPair(); run(`(()=>{const d=newDraft(${JSON.stringify(a)},${JSON.stringify(b)},'A',[]);autoDraftRest(d);playGame(d);})()`); }
  for (let i = 0; i < N; i++) {
    const [a, b] = pickPair();
    const blue = Math.random() < 0.5 ? 'A' : 'B';
    const res = run(`(()=>{ const d=newDraft(${JSON.stringify(a)},${JSON.stringify(b)},'${blue}',[]); autoDraftRest(d);
      const t0=performance.now(); const g=playGame(d); const t=performance.now()-t0; return {g, t}; })()`);
    const g = res.g; ms.push(res.t);
    for (const f of ['w', 'dur', 'kA', 'kB', 'turA', 'turB', 'dragA', 'dragB', 'baronA', 'baronB', 'goldDiff', 'mvp', 'mvpTag', 'pA', 'sa', 'sb', 'events', 'bans', 'picks', 'blue', 'first', 'impacts'])
      if (!ok(f in g, `playGame 返回字段 ${f}`)) break;
    const sum = (rows, k) => rows.reduce((s, x) => s + x[k], 0);
    ok(sum(g.sa, 'k') === g.kA, 'sum(sa.k) === kA');
    ok(sum(g.sb, 'k') === g.kB, 'sum(sb.k) === kB');
    ok(sum(g.sa, 'd') === g.kB, 'sum(sa.d) === kB');
    ok(sum(g.sb, 'd') === g.kA, 'sum(sb.d) === kA');
    for (const [rows, tk] of [[g.sa, g.kA], [g.sb, g.kB]])
      for (const x of rows) ok(x.a >= 0 && x.a <= tk - x.k, `助攻范围 0 ≤ a ≤ 队伍击杀 - k（${x.tag} ${x.k}/${x.d}/${x.a}，队伍 ${tk}）`);
    ok(g.sa.length === 5 && g.sb.length === 5, '双方各 5 名选手');
    ok(g.w === 'A' || g.w === 'B', '胜者为 A/B');
    ok(g.turA <= 11 && g.turB <= 11, '推塔数不超过 11');
    ok((g.w === 'A' ? g.turA : g.turB) >= 5, '胜方至少推掉 5 座塔（含两座门牙）');
    ok(g.dur >= 15 && g.dur <= 60, `时长在 15–60 分钟（${g.dur}）`);
    ok(g.dragA + g.dragB <= 7, '小龙 + 远古龙数量合理');
    ok(g.sa.concat(g.sb).every(x => x.cs >= 0 && x.gold > 0 && x.lvl >= 1 && x.lvl <= 18 && x.items.length <= 7), '补刀/经济/等级/装备合理');
    ok(g.sa.concat(g.sb).some(x => x.pid === g.mvp) && (g.w === 'A' ? g.sa : g.sb).some(x => x.pid === g.mvp), 'MVP 来自胜方');
    dur += g.dur; kills += g.kA + g.kB; towers += g.turA + g.turB;
    if (fails > 30) break;
  }
  ms.sort((a, b) => a - b);
  const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
  console.log(`  平均 ${avg.toFixed(2)} ms/局  中位 ${ms[ms.length >> 1].toFixed(2)}  P95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)}  · 平均时长 ${(dur / N).toFixed(1)} 分钟 · 击杀 ${(kills / N).toFixed(1)} · 推塔 ${(towers / N).toFixed(1)}`);
  ok(avg < 5, `快速模拟平均 < 5ms（${avg.toFixed(2)}ms）`);
}

// ---------------------------------------------------------------- 胜率校准
section('5v5：胜率与 evalDraft(d).pA 校准（500 局）');
{
  const N = 500; const rows = [];
  for (let i = 0; i < N; i++) {
    const [a, b] = pickPair();
    const r = run(`(()=>{ const d=newDraft(${JSON.stringify(a)},${JSON.stringify(b)},${Math.random() < 0.5 ? "'A'" : "'B'"},[]); autoDraftRest(d); const p=evalDraft(d).pA; const g=playGame(d); return [p, g.w==='A'?1:0]; })()`);
    rows.push(r);
  }
  // 按 pA 排序等分 5 组（每组 100 局），比较组内预测胜率与实际胜率
  rows.sort((x, y) => x[0] - y[0]);
  let wdev = 0; const out = [];
  for (let q = 0; q < 5; q++) {
    const seg = rows.slice(q * N / 5, (q + 1) * N / 5);
    const p = seg.reduce((s, x) => s + x[0], 0) / seg.length, w = seg.reduce((s, x) => s + x[1], 0) / seg.length;
    out.push(`${(p * 100).toFixed(0)}%→${(w * 100).toFixed(0)}%`); wdev += Math.abs(p - w) * seg.length;
  }
  wdev /= N;
  const meanP = rows.reduce((s, x) => s + x[0], 0) / N, meanW = rows.reduce((s, x) => s + x[1], 0) / N;
  console.log('  预测→实际（五分位）', out.join('  '), ` 平均偏差 ${(wdev * 100).toFixed(1)}%  总体 ${(meanP * 100).toFixed(1)}% vs ${(meanW * 100).toFixed(1)}%`);
  ok(wdev < 0.06, `校准偏差 < 6%（${(wdev * 100).toFixed(1)}%）`);
}

// ---------------------------------------------------------------- 状态 / 心态
section('状态与心态：五档、每局最多跨一档');
{
  const r = run(`(()=>{
    const errs=[]; const ps=Object.values(S.players).filter(p=>p.team).slice(0,200);
    const before=ps.map(p=>[formTier(p), mentalTier(p)]);
    for(let i=0;i<30;i++){ const [a,b]=[pick(Object.keys(S.teams)),pick(Object.keys(S.teams))]; if(a===b) continue; const d=newDraft(a,b,'A',[]); autoDraftRest(d);
      const pre={}; [a,b].forEach(k=>Object.values(T(k).lineup).forEach(id=>{ const p=P(id); if(p) pre[id]=formTier(p); }));
      playGame(d);
      for(const id in pre){ const t=formTier(P(id)); if(Math.abs(t-pre[id])>1) errs.push(id+':'+pre[id]+'→'+t); } }
    const tiers=new Set(Object.values(S.players).map(p=>formTier(p)));
    return {errs, tiers:[...tiers].sort(), labels:[FORM_TIERS.length, MENTAL_TIERS.length]};
  })()`);
  ok(r.errs.length === 0, '单局状态变化不跨档：' + r.errs.slice(0, 5).join(', '));
  ok(r.labels[0] === 5 && r.labels[1] === 5, '状态与心态各五档');
  ok(r.tiers.every(t => t >= -2 && t <= 2), '状态档位在 -2..2');
  const ctx = run(`(()=>{ const p=Object.values(S.players).find(p=>p.team); const base=matchRating(p,p.role,{}); p.mental=4; const hi=matchRating(p,p.role,{intl:true,ko:true,decider:true}); const lo0=matchRating(p,p.role,{}); p.mental=-4; const lo=matchRating(p,p.role,{intl:true,ko:true,decider:true}); p.mental=0; return [base,hi,lo0,lo]; })()`);
  ok(ctx[1] - ctx[3] > ctx[2] - ctx[0] + 3, '高压场合（国际赛淘汰赛决胜局）心态影响更大');
}

section('状态与心态：同队选手各不相同');
{
  const r = run(`(()=>{
    const keep=S;
    const sameShare=()=>{ let n=0, sf=0, sm=0;
      for(const t of Object.values(S.teams)){ const ps=Object.values(t.lineup).map(P).filter(Boolean); if(ps.length<5) continue; n++;
        if(new Set(ps.map(formTier)).size===1) sf++; if(new Set(ps.map(mentalTier)).size===1) sm++; }
      return [sf/n, sm/n]; };
    newGame('BLG');
    const fresh=sameShare();
    const off=Object.values(S.players).filter(p=>formTier(p)!==0 || mentalTier(p)!==0).length/Object.keys(S.players).length;
    const baseStable=Object.values(S.players).slice(0,50).every(p=>mentalBase(p)===mentalBase(p));
    // 一场系列赛后，同队首发的心态变化不应完全一样
    const m=mkMatch('BLG','TES',5,'测试'); const pre={}; Object.values(T('BLG').lineup).forEach(id=>pre[id]=P(id).mental);
    simSeries(m,false);
    const deltas=new Set(Object.keys(pre).map(id=>Math.round((P(id).mental-pre[id])*100)));
    // 旧档：全队数值一样的存档读取后被打散，且只处理一次
    const old=JSON.parse(JSON.stringify(S)); delete old.moodVer;
    Object.values(old.players).forEach(p=>{ p.form=0; p.mental=1.5; });
    S=migrateSave(old);
    const migrated=sameShare();
    const snap=JSON.stringify(Object.values(S.players).map(p=>[p.form,p.mental]));
    S=migrateSave(S);
    const once=S.moodVer===1 && snap===JSON.stringify(Object.values(S.players).map(p=>[p.form,p.mental]));
    // 实力够首发却坐板凳的替补，心态逐渐下滑
    const t=T('BLG'); const starter=P(t.lineup.MID);
    const bench={pid:'BenchTest', tag:'BenchTest', name:'BenchTest', role:'MID', nat:'CN', age:22, rating:starter.rating+2, team:'BLG', form:0, mental:0, champs:[], salary:10, contract:2028};
    S.players.BenchTest=bench; t.roster.push('BenchTest'); const bm0=bench.mental;
    for(let i=0;i<8;i++) settleSeriesMental(mkMatch('BLG','TES',3,'测试',{w:'BLG',l:'TES'}), []);
    const benchDrop=bench.mental < bm0 - 0.5;
    t.roster.pop(); delete S.players.BenchTest;
    S=keep;
    return {fresh, off, baseStable, deltaKinds:deltas.size, migrated, once, benchDrop};
  })()`);
  ok(r.fresh[0] < 0.2 && r.fresh[1] < 0.2, `新档同队五人状态/心态完全同档的队伍很少（${r.fresh.map(x => (x * 100).toFixed(0) + '%').join(' / ')}）`);
  ok(r.off > 0.35 && r.off < 0.8, `新档约一半选手不在平稳/平常（${(r.off * 100).toFixed(0)}%）`);
  ok(r.baseStable, '性格基线对同一选手固定');
  ok(r.deltaKinds >= 3, `系列赛后同队心态变化因人而异（${r.deltaKinds} 种）`);
  ok(r.migrated[0] < 0.4 && r.migrated[1] < 0.4, `旧档读取后同队数值被打散（${r.migrated.map(x => (x * 100).toFixed(0) + '%').join(' / ')}）`);
  ok(r.once, '旧档打散只执行一次');
  ok(r.benchDrop, '实力够首发却坐板凳的替补心态下滑');
}

// ---------------------------------------------------------------- 回放
section('回放：终局采样与装备事件');
{
  const r = run(`(()=>{
    const d = newDraft('BLG', 'TES', 'A', []);
    autoDraftRest(d);
    const endings = [12, 15].map(end => {
      const G = createGame5(d, {record:true});
      while(G.t < end - SIM5.DT) step5(G);
      const nexus = G.towers.find(tw => tw.side==='red' && tw.tier===6);
      for(const tw of G.towers){
        if(tw.side==='red' && (tw.tier===5 || tw.tier===4 && tw.lane==='mid')) tw.alive = false;
      }
      G.towerDirty = true;
      G.planT = Infinity;
      nexus.hp = 0.000001;
      const c = G.champs[0];
      c.x = nexus.x; c.y = nexus.y; c.cs = 321; c.tg = 4320;
      c.task = TK({k:'go', x:nexus.x, y:nexus.y});
      step5(G);
      const rec = recordOf(G);
      return {
        over: G.over && G.winner==='A' && rec.dur===end,
        frames: rec.f.length===end/3+1 && dec1(rec.f.at(-1),0)===Math.round(nexus.x/1000*63),
        stats: rec.st.length===Math.ceil(end/12)+1 && dec2(rec.st.at(-1),0)===321 && dec2(rec.st.at(-1),2)===432
      };
    });

    const timeout = createGame5(d, {record:true});
    timeout.t = 3597;
    step5(timeout);
    const timeoutFrames = timeout.over && timeout.t===3600 && timeout.frames.length===2 && timeout.stats.length===2;

    const G = createGame5(d, {record:true});
    const support = G.champs.find(c => c.side==='A' && c.role==='SUP');
    G.t = 600;
    support.tg = 1101;
    shop(G,support);
    const events = G.evs.filter(e => e[2]===support.i);
    const upgrade = events.filter(e => e[0]===600);
    const items = [];
    for(const [, kind, , value] of events){
      if(kind==='B') items.push(value);
      if(kind==='S') items.splice(value,1);
    }
    return {
      endings, timeoutFrames,
      upgrade: upgrade.length===2 && upgrade[0][1]==='S' && upgrade[0][3]===0 && upgrade[1][1]==='B' && upgrade[1][3]===support.build.sup,
      inventory: items.join(',')===support.items.join(',')
    };
  })()`);
  ok(r.endings.every(e => e.over && e.frames && e.stats), '整 12 秒和非整 12 秒破主水晶均只存一条终局位置和统计帧');
  ok(r.timeoutFrames, '超时终局只存一条位置和统计帧');
  ok(r.upgrade && r.inventory, '辅助装同秒先移除再买入，按原序能还原实时装备');
}

section('回放：最近 10 局、收藏 10 局、共 200 条');
{
  const r = run(`(()=>{
    S.replays = [];
    const sa = [{tag:'Bin',r:'TOP',c:'Jax',k:2,d:1,a:3}];
    const sb = [{tag:'369',r:'TOP',c:'Sion',k:1,d:2,a:1}];
    for(let i=0;i<202;i++){
      const id = pushReplay({id:'replay-'+i,w:'A',kA:2,kB:1,sa,sb,rec:i===0?null:{},solo:{}});
      if(i<10) toggleKeepReplay(id);
    }
    const newest = findReplay('replay-201');
    const over = toggleKeepReplay(newest.id);
    const kept = S.replays.filter(r => r.kept && (r.rec || r.solo)).length;
    const recent = S.replays.filter(r => !r.kept && (r.rec || r.solo)).length;
    const oldestKept = findReplay('replay-0');
    const summary = findReplay('replay-12');
    const beforeCancel = {
      kept, recent,
      rejectLive: !!newest.rec && !newest.kept && !over.ok && /上限/.test(over.msg),
      archives: S.replays.length===200 && !findReplay('replay-10') && !findReplay('replay-11') && !!oldestKept?.solo,
      summary: summary?.trimmed && !summary.rec && !summary.solo && summary.kA===2 && summary.kB===1 &&
        JSON.stringify([summary.sa, summary.sb])===JSON.stringify([sa, sb])
    };
    const cancel = toggleKeepReplay('replay-0');
    return {...beforeCancel, cancel: cancel.ok && oldestKept.trimmed && !oldestKept.solo && !!findReplay('replay-0')};
  })()`);
  ok(r.recent === 10, `只保留最近 10 局未收藏的完整回放（${r.recent}）`);
  ok(r.kept === 10 && r.rejectLive, '实际收藏 10 局，第 11 局仍有录像时触发收藏上限');
  ok(r.archives && r.summary, '200 条上限优先清理最旧未收藏摘要，裁剪录像时保留比分与 KDA');
  ok(r.cancel, '取消旧的 1v1 收藏时裁剪录像并保留摘要');
}

section('新档组队和存档兼容');
{
  const r = run(`(()=>{
    newGame('TES');
    const setup=curEvent(), team=T(S.user), initial={...team.lineup};
    const opens=isRosterSetup(setup) && eventInfo(setup).name==='重新启航（组队）' && transferWindowOpen() && !isMidSeasonWindow();
    const budget=team.budget;
    simUntilUser(true); advanceEvent();
    const waits=curEvent()===setup && !setup.started && !setup.done && !nextReadyMatch();
    delete team.lineup.TOP;
    const missingRejected=!finishRosterSetup().ok && curEvent()===setup;
    team.lineup.TOP=initial.MID;
    const duplicateRejected=!finishRosterSetup().ok && curEvent()===setup;
    team.lineup.TOP=T('BLG').lineup.TOP;
    const otherTeamRejected=!finishRosterSetup().ok && curEvent()===setup;
    team.lineup.TOP=initial.TOP;
    const check=starters(S.user).slice(0,3).map(p=>[p,p.nat]);
    for(const [p] of check) p.nat='KR';
    const importsRejected=!finishRosterSetup().ok && curEvent()===setup;
    for(const [p,nat] of check) p.nat=nat;
    const signing=freeAgents().find(p=>!isForeign(p));
    const signed=makeOffer(signing.pid,0).ok;
    team.lineup[signing.role]=signing.pid;
    S=migrateSave(JSON.parse(JSON.stringify(S)));
    const restored=isRosterSetup(curEvent()) && transferWindowOpen();
    const finished=finishRosterSetup().ok && S.events[0].done &&
      curEvent().type==='lpl_s1' && !curEvent().started && !transferWindowOpen() && T(S.user).budget===budget && !finishRosterSetup().ok;
    const old=JSON.parse(JSON.stringify(S));
    old.events.shift(); old.evIdx=0;
    S=migrateSave(old);
    const oldPreserved=curEvent().type==='lpl_s1' && !isRosterSetup(curEvent()) && transferWindowOpen();
    S.evIdx=S.events.findIndex(e=>e.type==='window');
    const signingPreserved=signed && P(signing.pid).team===S.user && T(S.user).lineup[signing.role]===signing.pid;
    return {opens, waits, missingRejected, duplicateRejected, otherTeamRejected, importsRejected, restored, finished, signingPreserved,
      oldPreserved, midSeason:transferWindowOpen() && isMidSeasonWindow()};
  })()`);
  ok(r.opens && r.waits && r.restored && r.signingPreserved, '新档等待组队确认，可签约、调整首发并存档续玩');
  ok(r.missingRejected && r.duplicateRejected && r.otherTeamRejected && r.importsRejected, '缺位、重复、其他队伍选手和超外援上限的阵容均无法完成组队');
  ok(r.finished && r.oldPreserved && r.midSeason, '确认后进入第一赛段，老档和季中转会规则保留');
}

// ---------------------------------------------------------------- 完整赛季
section('完整赛季：从 LPL 第一赛段到世界赛 + 休赛期');
{
  const t0 = performance.now();
  const r = run(`(()=>{
    newGame('BLG'); const log=[], champions={}; let guard=0;
    while(guard++<40){
      const ev=curEvent();
      if(isRosterSetup(ev)){ if(!finishRosterSetup().ok) throw new Error('组队失败'); log.push('setup'); continue; }
      if(ev.type==='off'){ finishOffseason(); log.push('off'); break; }
      if(ev.type==='window'){ ev.done=true; aiTransfers(4); advanceEvent(); log.push('window'); continue; }
      simUntilUser(true);
      if(!ev.done) throw new Error('赛事未完成：'+ev.type);
      champions[ev.type]=ev.res.champ;
      log.push(ev.type+':'+(ev.res.champ||'-'));
      advanceEvent();
    }
    const ser=JSON.stringify(S); const S2=migrateSave(JSON.parse(ser));
    const history=S.history[0];
    const historyOk=['fst','msi','ewc','worlds'].every(type=>champions[type] && history?.[type]===champions[type]);
    return {log, year:S.year, ok: !!S2 && S2.year===S.year, size: ser.length, historyOk, nextEvent:curEvent().type};
  })()`);
  console.log('  ', r.log.join(' → '), ` 用时 ${((performance.now() - t0) / 1000).toFixed(1)}s  存档 ${(r.size / 1024).toFixed(0)}KB`);
  ok(r.log.includes('off') && r.year === 2027 && r.nextEvent === 'lpl_s1', '赛季顺利结束，下一年保留原赛程');
  ok(r.historyOk, '插入组队事件后，国际赛冠军正确写入赛季历史');
  ok(r.ok, '存档序列化与迁移正常');
}

section('内核边界回归');
{
  const r = run(`(()=>{
    newGame('TES');
    const d = newDraft('BLG', 'TES', 'A', []);
    const oldRandom = Math.random;
    const fight = resolveFight;
    try {
      const sides = [];
      resolveFight = (G, a, b) => sides.push([a[0].side, b[0].side].join(''));
      Math.random = () => 0.2;
      for(const losingSide of ['A', 'B']){
        const G = createGame5(d);
        G.t = 100;
        for(const c of G.champs){
          c.alive = c.role === 'MID';
          if(!c.alive) continue;
          [c.x, c.y] = lanePt('mid', 0.5);
          c.hp = c.side === losingSide ? 0.1 : 1;
        }
        laneTrades(G);
      }
      resolveFight = fight;

      const G = createGame5(d);
      G.t = 300;
      objTimers(G);
      const [a, b] = [G.champs[0], G.champs[5]];
      [a.x, a.y] = [b.x, b.y] = MAP5.dragon;
      a.recall = 8;
      objectives(G);
      const activeTakes = G.obj.drag.by === 'B' && G.obj.drag.prog > 0;
      const progress = G.obj.drag.prog;
      [a.x, a.y] = MAP5.fountain.blue;
      b.recall = 8;
      objectives(G);
      const recallStops = G.obj.drag.prog === progress;

      const victim = G.champs[2];
      victim.pw = 8;
      applyKill(G, b, victim, []);
      const deathClearsPower = victim.pw === 0;
      const recalling = G.champs[1];
      [recalling.x, recalling.y] = [500, 200];
      recalling.hp = 0.2;
      recalling.pw = 8;
      tickChamp(G, recalling);
      const recallClearsPower = recalling.recall > 0 && recalling.pw === 0;

      Math.random = () => 0.05;
      const ring = createSolo('BLG', 'TES');
      ring.t = 599;
      ring.F.A.hp = 0.001;
      ring.F.B.hp = 0.01;
      ring.F.A.sum2 = ring.F.B.sum2 = 'bar';
      soloStep(ring);

      Math.random = () => 0.75;
      const tie = createSolo('BLG', 'TES');
      tie.t = 599;
      tie.F.A.hp = tie.F.B.hp = 0.001;
      soloStep(tie);

      Math.random = () => 0.999;
      const clock = createSolo('BLG', 'TES');
      clock.t = 599;
      while(!clock.over && clock.t < 720) soloStep(clock);

      const tiers = [[0, 2.999], [0, -2.999], [-1, 0.999]];
      return {
        sides, activeTakes, recallStops, deathClearsPower, recallClearsPower,
        ringDeath: ring.over && ring.winner === 'B' && !ring.fx,
        ringTie: tie.over && tie.winner === 'B' && tie.F.B.hp === 0,
        ringClock: clock.over && clock.t === 719,
        tiers: tiers.every(([a, b]) => Math.abs(tierOf(stepTier(a, b)) - tierOf(a)) <= 1),
        style: styleEdge('pick', 'poke') === 0.9 && styleEdge('poke', 'pick') === -0.9
      };
    } finally {
      Math.random = oldRandom;
      resolveFight = fight;
    }
  })()`);
  ok(r.sides.join(',') === 'AB,AB', '对线战斗按真实 A/B 阵营传入');
  ok(r.activeTakes && r.recallStops, '回城英雄不阻挡或推进中立资源');
  ok(r.deathClearsPower && r.recallClearsPower, '阵亡和回城立即清除当帧战力');
  ok(r.ringDeath && r.ringTie, '先结算火圈致死，同时致死也能判胜');
  ok(r.ringClock, '双方在 11:59 仍存活时直接判胜');
  ok(r.tiers, '舍入边界也最多跨一档');
  ok(r.style, '抓单克制消耗，交换阵容时克制分取反');
}

section('英雄机制克制与分路联动');
{
  const r = run(`(()=>{
    const pool = window.CHAMP_TACTICS;
    const fields = ['dash','escape','magic','autos','engage','range'];
    const covered = CHAMP_KEYS.length===Object.keys(pool).length &&
      CHAMP_KEYS.every(c=>fields.every(f=>[0,1,2].includes(pool[c]?.[f])));
    const mobile = {TOP:'Ambessa',JUG:'Lee Sin',MID:'Sylas',ADC:"Kai'Sa",SUP:'Rell'};
    const immune = {TOP:'Malphite',JUG:'Nocturne'};
    const artillery = {TOP:'Jayce',JUG:'Graves',MID:'Yasuo',ADC:'Jhin'};
    const magic = {TOP:'Rumble',JUG:'Karthus',MID:'Annie',ADC:'Ziggs'};
    const autos = {TOP:'Fiora',JUG:'Viego',MID:'Yone',ADC:'Jinx'};
    const score = (own,opponent={}) => draftTactics(own,opponent).score;
    const duo = {ADC:'Ashe',SUP:'Seraphine'};
    const engage = {TOP:'Malphite',JUG:'Nocturne',MID:'Lissandra',SUP:'Rell'};
    const addsDuo = (a, b) => score({...a,...b})>score(a)+score(b)+0.25;
    const notes = [];
    draftTactics(duo,engage,undefined,notes);

    newGame('TES');
    const d = newDraft('BLG','TES','A',[]);
    d.step = 18;
    d.picks.A = {TOP:'Gwen',JUG:'Lee Sin',MID:'Azir',ADC:'Ziggs'};
    d.picks.B = {TOP:'Camille',JUG:'Vi',MID:'Hwei',ADC:'Varus',SUP:'Rell'};
    const ai = aiChoose(d);
    const coach = coachSuggest(d,'A');
    const manual = draftAct(d,'Karma','SUP',false);
    const warning = evalDraft(d).a.comp.notes.some(n=>n.includes('炸弹人下路缺少硬辅'));
    d.step = 18;
    delete d.picks.A.ADC;
    const aiWithSoft = aiChoose(d);
    const fallback = draftBotPairFilter({ADC:'Ziggs'},new Set(HARD_SUPPORTS))('SUP','Karma');

    d.picks.A = {TOP:'Gwen',JUG:'Lee Sin',MID:'Azir',ADC:'Ezreal',SUP:'Karma'};
    const G = createGame5(d);
    const tactics = draftTactics;
    const draftWith = evalDraft(d);
    let draftWithout;
    try{
      draftTactics = () => ({early:0, mid:0, late:0, score:0});
      draftWithout = evalDraft(d);
    } finally {
      draftTactics = tactics;
    }
    return {
      covered,
      counters: score({SUP:'Poppy'},mobile)>score({SUP:'Poppy'},immune)+0.5 &&
        score({MID:'Galio'},magic)>score({MID:'Galio'},artillery)+0.45 &&
        score({TOP:'Jax'},autos)>score({TOP:'Jax'},magic)+0.4,
      duos: addsDuo({ADC:'Ezreal'},{SUP:'Karma'}) && addsDuo({MID:'Orianna'},{JUG:'Nocturne'}) &&
        addsDuo({MID:'Jayce'},{JUG:'Maokai'}) && score(duo)>0.4 && score(duo,engage)<0 && notes.some(n=>n.includes('怕连续先手')),
      bot: ai.role==='SUP' && HARD_SUPPORTS.has(ai.c) && coach.length>0 &&
        coach.every(p=>HARD_SUPPORTS.has(p.c)) && manual && warning && aiWithSoft.role==='ADC' && aiWithSoft.c!=='Ziggs' && fallback,
      game: G.ev.pA===draftWith.pA && draftWith.pA>draftWithout.pA &&
        Math.abs(phaseAdj(G,'A',0) - (draftWith.a.early+draftWith.blueEdge*0.3-G.avgSk.A)) < 1e-9
    };
  })()`);
  ok(r.covered, '全英雄拥有经过分级的技能机制');
  ok(r.counters, '波比、加里奥、贾克斯针对其对应机制取得优势');
  ok(r.duos, '下路和中野按分路联动，寒冰萨勒芬妮可被多开团压成劣势');
  ok(r.bot, '炸弹人走下时 AI 与教练优先硬辅，手选软辅可用且收到提示');
  ok(r.game, '阵容克制进入 BP 胜率与实战阶段战力');
}

section('BP 反制权重与阵容实战对照');
{
  const r = run(`(()=>{
    newGame('TES');
    for(const key of ['TES','BLG']) for(const player of starters(key)){
      player.rating=82; player.form=0; player.mental=0; player.champs=[];
    }
    for(const champ of CHAMP_KEYS) S.meta[champ]=0;
    const d=newDraft('TES','BLG','A',[]);
    d.picks.A={TOP:'Ornn',JUG:'Poppy',MID:'Azir',ADC:'Jinx',SUP:'Lulu'};
    d.picks.B={TOP:'Ambessa',JUG:'Vi',MID:'Ahri',ADC:"Kai'Sa",SUP:'Rakan'};
    d.step=20;
    const before=JSON.stringify(S), oldRandom=Math.random, weight=DRAFT_COUNTERS.Poppy[1];
    const strong=evalDraft(d).pA;
    let weak, wStrong=0, wWeak=0;
    try {
      DRAFT_COUNTERS.Poppy[1]=0;
      weak=evalDraft(d).pA;
      for(let seed=1;seed<=240;seed++){
        S=JSON.parse(before); Math.random=srand((seed*2654435761)>>>0); DRAFT_COUNTERS.Poppy[1]=0;
        wWeak+=playGame(d).w==='A'?1:0;
        S=JSON.parse(before); Math.random=srand((seed*2654435761)>>>0); DRAFT_COUNTERS.Poppy[1]=weight;
        wStrong+=playGame(d).w==='A'?1:0;
      }
    } finally { Math.random=oldRandom; DRAFT_COUNTERS.Poppy[1]=weight; S=JSON.parse(before); }
    const live=newDraft('TES','BLG','A',[]);
    const ban=draftFeedback(live,'Ahri');
    const banUnaffected=live.step===0 && !live.bans.A.length;
    live.step=19; live.picks=JSON.parse(JSON.stringify(d.picks)); delete live.picks.A.JUG;
    const cur=draftSide(live); cur.side==='B' && (live.first='B');
    const preview=draftFeedback(live,'Poppy','JUG');
    const profile=ids=>fightProfile(ids.map(c=>({combat:draftCombatProfile(c),hp:1,tags:new Set(CH[c].tags)})));
    const dive=profile(['Vi','Ambessa','Rakan',"Kai'Sa"]);
    const open=localFightBonus(dive,profile(['Jinx','Zoe','Karma']),'team',true);
    const defended=localFightBonus(dive,profile(['Poppy','Jinx','Lulu']),'team',true);
    return {strong,weak,wStrong,wWeak,ban:banUnaffected && !!ban.banReason && ban.last.kind==='ban',
      preview:preview.last?.champ==='Poppy' && !live.picks.A.JUG && preview.A.advantages.some(n=>n.includes('波比')),interact:defended<open};
  })()`);
  console.log('  波比对多突进，BP 胜率差', ((r.strong-r.weak)*100).toFixed(1)+' 个百分点，实战配对', `${r.wStrong}/240 vs ${r.wWeak}/240`);
  ok(r.strong-r.weak>=0.075 && r.wStrong>r.wWeak,'提高强反制的评分，并在同条件实战观察到胜率改善');
  ok(r.ban && r.preview && r.interact, '选禁预览无副作用，局部反开随实际参战英雄生效');
}

section('AI BP：对位预判与能力权重');
{
  const r=run(`(()=>{
    newGame('TES');
    for(const key of ['TES','BLG']) for(const p of starters(key)){
      p.rating=82; p.form=0; p.mental=0; p.champs=[];
    }
    for(const c of CHAMP_KEYS) S.meta[c]=0;
    const d=newDraft('TES','BLG','A',[]);
    d.step=18;
    d.picks.A={TOP:'Ornn',JUG:'Trundle',MID:'Azir',ADC:'Jinx'};
    d.picks.B={TOP:'Ambessa',JUG:'Vi',MID:'Ahri',ADC:"Kai'Sa"};
    const original=JSON.stringify(d), counters=aiChoose(d,{lookahead:true});
    const unchanged=JSON.stringify(d)===original;
    const ranged={...d,picks:{...d.picks,B:{TOP:'Kennen',JUG:'Karthus',MID:'Hwei',ADC:'Varus'}}};
    const antiMagic=aiChoose(ranged,{lookahead:true});
    const denied={...d,locked:['Poppy']}, eligible=aiChoose(denied,{lookahead:true});
    const opening=newDraft('TES','BLG','A',[]);
    opening.step=6;
    opening.bans={A:['Aurora','Pyke','Xin Zhao'],B:['Miss Fortune','Nidalee','Viego']};
    const immediate=aiDraftCandidates(opening,1,false)[0];
    const planned=aiChoose(opening,{lookahead:true});
    const afterReply=c=>{
      const next=draftAfterChoice(opening,c);
      return Math.min(...aiDraftCandidates(next,3,false).map(reply=>evalDraft(draftAfterChoice(next,reply)).diff));
    };
    const considersReply=planned.c!==immediate.c && afterReply(planned)>afterReply(immediate)+0.3;
    const initial=evalDraft(d).diff;
    for(const p of starters('TES')) p.rating+=10;
    const gain=evalDraft(d).diff-initial;
    const game=createGame5(d);
    const c=game.champs[0], context=d.ctx;
    const same=Math.abs(c.sk-draftPlayerRating(c.p,c.role,context)-champFit(c.p,c.c,c.role)*DRAFT_FIT_WEIGHT)<1e-9;
    return {counter:counters.c==='Poppy' && counters.role==='SUP',
      magic:antiMagic.c==='Galio' && antiMagic.role==='SUP',legal:eligible.c!=='Poppy' && !!draftAfterChoice(denied,eligible),unchanged,gain,same,considersReply};
  })()`);
  ok(r.counter && r.magic && r.legal && r.unchanged,'AI 响应不同阵容威胁并遵守当前禁选、位置和无畏锁定');
  ok(r.considersReply,'AI 在首抢时能避开对手可利用的回应');
  ok(Math.abs(r.gain-6.4)<0.05 && r.same,'全队能力升 10 分的净贡献为 6.4，比赛沿用同一权重');
}

section('对手 BP 难度：加权抽取与不选负收益');
{
  const r=run(`(()=>{
    newGame('TES');
    const keys=Object.keys(S.teams);
    let states=0, violations=0, mutated=0, hardSame=0, hardTotal=0, fallbackOk=true;
    const agree={easy:0,normal:0}, total={easy:0,normal:0}, distinct={easy:new Set(),normal:new Set()};
    for(let i=0;i<36;i++){
      const a=keys[i%keys.length], b=keys[(i*7+3)%keys.length]===a?keys[(i+1)%keys.length]:keys[(i*7+3)%keys.length];
      const d=newDraft(a,b,i%2?'A':'B',[]);
      const stop=i%20;
      while(d.step<stop){ const c=aiChoose(d); if(!c.c || !draftAct(d,c.c,c.role,c.offrole)) break; }
      if(!draftSide(d)) continue;
      states++;
      const before=JSON.stringify(d);
      const hard=aiChoose(d,{lookahead:true});
      hardTotal++; if(aiChooseLevel(d,'hard').c===hard.c) hardSame++;
      for(const level of ['easy','normal']){
        const {all,eligible}=aiDraftLevelOptions(d,level);
        const okSet=new Set(eligible.map(x=>x.choice.c+'|'+x.choice.role));
        for(let k=0;k<4;k++){
          const ch=aiChooseLevel(d,level);
          total[level]++; if(ch.c===hard.c) agree[level]++;
          distinct[level].add(i+':'+ch.c);
          if(eligible.length){ if(!okSet.has(ch.c+'|'+ch.role)) violations++; }
          else if(all.length && ch.c!==all[0].choice.c) fallbackOk=false;
          if(!draftAfterChoice(d,ch)) violations++;
        }
      }
      if(JSON.stringify(d)!==before) mutated++;
    }
    // 固定一个开局 Ban 位，验证权重和注入随机数
    const d=newDraft('TES','BLG','A',[]);
    const opts=aiDraftLevelOptions(d,'normal').eligible.map(x=>x.choice.c);
    const pickAt=v=>aiChooseLevel(d,'normal',()=>v).c;
    const stub=opts.length===3 && pickAt(0)===opts[0] && pickAt(0.59)===opts[0] && pickAt(0.61)===opts[1] && pickAt(0.86)===opts[2] && pickAt(0.999)===opts[2];
    let top=0; const N=600;
    for(let k=0;k<N;k++) if(aiChooseLevel(d,'normal').c===opts[0]) top++;
    const easyOpts=aiDraftLevelOptions(d,'easy').eligible;
    // 负收益剔除：构造“禁掉自己下一手首选”的禁用
    const own=newDraft('TES','BLG','A',[]); own.step=5;
    const me=draftSide(own).side;
    const firstPick=side=>{ for(let s=6;s<DRAFT_SEQ.length;s++){ const t=draftSide({...own,step:s}); if(t.kind==='pick' && t.side===side) return aiDraftCandidates({...own,step:s},3,false); } return []; };
    const ownTop=firstPick(me), enemyTop=firstPick(me==='A'?'B':'A');
    const ownBan=aiDraftAssess(own,[{c:ownTop[0].c,score:99}],false)[0];
    const banSelfNegative=ownTop.length>=2 && ownTop[0].score>ownTop[1].score && enemyTop[0]?.c!==ownTop[0].c ? ownBan.gain<0 : true;
    return {states,violations,mutated,hardSame,hardTotal,fallbackOk,stub,topShare:top/N,easyN:easyOpts.length,
      agreeEasy:agree.easy/total.easy, agreeNormal:agree.normal/total.normal,
      distinctEasy:distinct.easy.size, distinctNormal:distinct.normal.size, banSelfNegative,
      levels:AI_DRAFT_LEVELS.join(',')};
  })()`);
  console.log('  难度与最优解一致率  简单', r.agreeEasy.toFixed(2), '普通', r.agreeNormal.toFixed(2), ` (${r.states} 个 BP 局面)`);
  ok(r.levels==='easy,normal,hard','三档难度：easy / normal / hard');
  ok(r.hardSame===r.hardTotal,'困难档与原深思考选择完全一致');
  ok(r.violations===0 && r.fallbackOk,`简单 / 普通只从收益非负的候选里选（违规 ${r.violations}）`);
  ok(r.banSelfNegative,'禁掉己方下一手首选记为负收益');
  ok(r.mutated===0,'难度选择不修改当前 BP 状态');
  ok(r.stub,'普通档按 60 / 25 / 15 权重在前三名中抽取');
  ok(Math.abs(r.topShare-0.6)<0.07,`普通档首选占比约 60%（${r.topShare.toFixed(2)}）`);
  ok(r.easyN===5,'简单档在前 5 名中抽取');
  ok(r.agreeNormal<1 && r.agreeEasy<r.agreeNormal && r.distinctEasy>=r.distinctNormal,'难度越低越常偏离最优解');
}

section('职业英雄池、熟练度持久化与选手成长');
{
  const r=run(`(()=>{
    newGame('TES');
    const realistic=!!professionalPicks(P('Doran')).Jayce && P('Doran').champs.every(e=>e.c!=='Rengar') &&
      Object.values(S.players).find(p=>playerTag(p).toLowerCase()==='fengyue').champs.every(e=>e.c!=='Amumu') && (S.meta.Sona||0)<1;
    const pro={...P('Doran'),champs:[{c:'Rumble',p:95},{c:'Jayce',p:63}]};
    const unpracticed={pid:'test-learner',tag:'test-learner',role:'TOP',champs:[]};
    S.meta.Rumble=0; S.meta.Jayce=0;
    const signature=champFit(pro,'Rumble','TOP');
    const neutral=champFit(pro,'Jayce','TOP'), unknown=champFit(unpracticed,'Jayce','TOP');
    S.meta.Jayce=2;
    const metaFit=champFit(pro,'Jayce','TOP'), rookieFit=champFit(unpracticed,'Jayce','TOP');
    const version=signature>neutral && metaFit>signature && metaFit-neutral>rookieFit-unknown;
    const player=starters('TES')[0];
    player.champs=CHAMP_KEYS.slice(0,11).map(c=>({c,p:90}));
    const hero='Ornn';
    const g={w:'A',mvp:player.pid,sa:[{pid:player.pid,k:8,d:0,a:4,c:hero}],sb:[]};
    applyGameImpact(g,'TES','BLG');
    const first=champProfVal(player,hero);
    S=migrateSave(JSON.parse(JSON.stringify(S)));
    const saved=P(player.pid);
    applyGameImpact(g,'TES','BLG');
    const kept=first>0 && saved.champs.length===11 && g.masteryChanges[0].prev===first && champProfVal(saved,hero)>first;
    const initial=JSON.stringify(S), oldRandom=Math.random;
    let direct, skipped, once;
    try{
      const d=newDraft('TES','BLG','A',[]);
      Math.random=srand(18); autoDraftRest(d);
      Math.random=srand(635); direct=playGame(d);
      S=JSON.parse(initial);
      Math.random=srand(635); const recording=createGame5(d,{record:true});
      for(let i=0;i<10;i++) step5(recording);
      while(!recording.over) step5(recording);
      skipped=game5Result(recording);
      const snapshot=JSON.stringify(S.players);
      once=game5Result(recording)===skipped && JSON.stringify(S.players)===snapshot;
    } finally { Math.random=oldRandom; }
    const growth={pid:'test-growth',age:18,rating:62,pot:94,development:{games:14,performance:12}};
    const inactive={...growth,development:{games:0,performance:0}};
    settlePlayerDevelopment(growth); settlePlayerDevelopment(inactive);
    const same=initialPairBond('369','JackeyLove'), stranger=initialPairBond('369','Doran');
    return {realistic,version,kept,once,sameRun:JSON.stringify(direct.masteryChanges)===JSON.stringify(skipped.masteryChanges),
      grow:growth.rating>inactive.rating && growth.ratingDelta>0 && initialPotential(growth)===initialPotential({...growth,rating:91}),
      chemistry:same>stranger && same>40 && stranger>0};
  })()`);
  ok(r.realistic,'开档英雄池和 T0 避免用随机奇招充当招牌或职业常用英雄');
  ok(r.version,'合适的版本英雄能超过非版本招牌，新手无法取得相同的版本收益');
  ok(r.kept && r.once && r.sameRun,'满英雄池依然保留熟练度，快进与快模一致，一局只结算一次');
  ok(r.grow && r.chemistry, '潜力独立，实战出场加快成长，历史搭档有默契基础');
}

console.log(fails ? `\n✗ ${fails} 项失败` : '\n✓ 全部通过');
process.exit(fails ? 1 : 0);
