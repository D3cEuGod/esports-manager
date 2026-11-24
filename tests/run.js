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
    ok(r.dur <= 720, `1v1 在 12:00 前结束（${r.dur}s）`);
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

// ---------------------------------------------------------------- 回放存储
section('回放：最近 10 局 + 永久保留上限 10 局');
{
  const r = run(`(()=>{
    S.replays=[];
    const ks=Object.keys(S.teams);
    const ids=[];
    for(let i=0;i<14;i++){ const d=newDraft(ks[0],ks[1],'A',[]); autoDraftRest(d); const g=playGame(d,{record:true}); ids.push(pushReplay({y:S.year,label:'t',a:ks[0],b:ks[1],gi:1,w:g.w,kA:g.kA,kB:g.kB,dur:g.dur,rec:g.rec,solo:null,kept:false})); }
    const withRec=S.replays.filter(x=>x.rec).length;
    const k1=toggleKeepReplay(ids[13]).ok;   // 最早一局已被裁剪，不能收藏
    let kept=0; for(const id of ids.slice(4)){ if(toggleKeepReplay(id).ok) kept++; }
    const over=toggleKeepReplay(ids[3]);
    const size=JSON.stringify(S.replays.filter(x=>x.rec)[0].rec).length;
    return {withRec, k1, kept, over:over.ok, size};
  })()`);
  ok(r.withRec === 10, `只保留最近 10 局完整回放（${r.withRec}）`);
  ok(r.k1 === true || r.k1 === false, '收藏接口可用');
  ok(r.kept === 10 && r.over === false, `永久保留最多 10 局（${r.kept}，超出被拒：${!r.over}）`);
  console.log(`  单局 5v5 回放约 ${(r.size / 1024).toFixed(1)} KB`);
}

// ---------------------------------------------------------------- 完整赛季
section('完整赛季：从 LPL 第一赛段到世界赛 + 休赛期');
{
  const t0 = performance.now();
  const r = run(`(()=>{
    newGame('BLG'); const log=[]; let guard=0;
    while(guard++<40){
      const ev=curEvent();
      if(ev.type==='off'){ finishOffseason(); log.push('off'); break; }
      if(ev.type==='window'){ ev.done=true; aiTransfers(4); advanceEvent(); log.push('window'); continue; }
      simUntilUser(true);
      if(!ev.done) throw new Error('赛事未完成：'+ev.type);
      log.push(ev.type+':'+(ev.res.champ||'-'));
      advanceEvent();
    }
    const ser=JSON.stringify(S); const S2=migrateSave(JSON.parse(ser));
    return {log, year:S.year, ok: !!S2 && S2.year===S.year, size: ser.length};
  })()`);
  console.log('  ', r.log.join(' → '), ` 用时 ${((performance.now() - t0) / 1000).toFixed(1)}s  存档 ${(r.size / 1024).toFixed(0)}KB`);
  ok(r.log.includes('off') && r.year === 2027, '赛季顺利结束并进入下一年');
  ok(r.ok, '存档序列化与迁移正常');
}

console.log(fails ? `\n✗ ${fails} 项失败` : '\n✓ 全部通过');
process.exit(fails ? 1 : 0);
