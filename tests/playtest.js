// Optional DeepSeek test player. It loads only the game kernel and creates fresh, in-memory saves.
const { parseArgs } = require('node:util');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { load } = require('./harness.js');

const MAX_CALLS = 5000;
const { values: flags } = parseArgs({ options: {
  live: { type: 'boolean' }, series: { type: 'string' }, 'max-calls': { type: 'string' },
  team: { type: 'string' }, seed: { type: 'string' }, years: { type: 'string' }, verify: { type: 'boolean' }
} });

function positiveInteger(value, fallback, max, flag){
  const n = Number(value ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error(`${flag} must be an integer from 1 to ${max}`);
  return n;
}

class CallLimit extends Error {}

function makeProvider(live, limit){
  const token = live ? process.env.DEEPSEEK_API_KEY : '';
  if (live && !token) throw new Error('DEEPSEEK_API_KEY is required for --live');
  const model = live ? process.env.DEEPSEEK_MODEL || 'deepseek-flash' : 'mock';
  const usage = { requests:0, inputTokens:0, outputTokens:0, fallbacks:0 };
  async function ask(task, situation, choices){
    if (usage.requests >= limit) throw new CallLimit('Reached the call limit');
    usage.requests++;
    if (!live) return choices ? {id:choices[0].id,reason:'模拟响应'} : {suggestions:['模拟响应，只验证工作流程。']};
    const answer = choices ? '{"id":"legal option id","reason":"简短理由"}' : '{"suggestions":["可用对照局验证的改进建议"]}';
    const result = await fetch('https://api.deepseek.com/chat/completions', {
      method:'POST', signal:AbortSignal.timeout(45_000),
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({model, thinking:{type:'disabled'}, max_tokens:choices?450:1200, response_format:{type:'json_object'}, messages:[
        {role:'system',content:`你是资深英雄联盟职业比赛教练和游戏测试玩家。只用提供的游戏内可见信息，遵循预算、位置、无畏选禁和赛制。输出 JSON，格式 ${answer}。复盘请具体说明现象和验证方法。`},
        {role:'user',content:JSON.stringify({task,situation,choices})}
      ]})
    });
    if (!result.ok) throw new Error(`DeepSeek returned HTTP ${result.status}`);
    const payload = await result.json();
    usage.inputTokens += payload.usage?.prompt_tokens || 0;
    usage.outputTokens += payload.usage?.completion_tokens || 0;
    try { return JSON.parse(payload.choices?.[0]?.message?.content || ''); }
    catch { return {}; }
  }
  return { model, usage, ask };
}

function randomFor(seed){
  let value=seed>>>0;
  return ()=>{
    value=(value+0x6D2B79F5)>>>0;
    let bits=value;
    bits=Math.imul(bits^(bits>>>15),bits|1);
    bits^=bits+Math.imul(bits^(bits>>>7),bits|61);
    return ((bits^(bits>>>14))>>>0)/4294967296;
  };
}

function gameRunner(run){
  return (fn,...args)=>run(`(${fn.toString()})(${args.map(x=>JSON.stringify(x)).join(',')})`);
}

async function choose(provider, task, situation, choices, log){
  const answer=await provider.ask(task,situation,choices);
  let selection=choices.find(option=>option.id===answer?.id);
  if(!selection){ selection=choices[0]; provider.usage.fallbacks++; }
  log.push({task,id:selection.id,reason:typeof answer?.reason==='string'?answer.reason.slice(0,400):''});
  return selection;
}

async function playSeries(call, user, seed, provider, scheduled=false){
  Math.random=randomFor(seed);
  const log=[];
  if(!scheduled){
    call(k=>{ newGame(k); if(T(k)?.region!=='LPL') throw Error('The playtest team must belong to the LPL'); },user);
    await manageWindow(call,provider,'setup',log);
  }
  const schedule=call((ready)=>{
    if(!ready){
      if(lineupProblems(S.user).length) autoLineup(S.user);
      if(!finishRosterSetup().ok) throw Error('Starting lineup is not legal');
    }
    const item=ready?globalThis.__scheduledMatch:simUntilUser(false);
    if(!item) throw Error('Could not find a playable series');
    const m=item.m;
    globalThis.__playtest={item,locked:[],games:[],wa:0,wb:0,chooser:simSolo1v1(m.a,m.b).winner};
    return {a:m.a,b:m.b,bo:m.bo,side:m.a===S.user?'A':'B',label:m.label};
  },scheduled);
  let finished=false, index=0;
  while(!finished){
    index++;
    Math.random=randomFor((seed ^ Math.imul(index,0x9E3779B1))>>>0);
    const chosen=call(()=>{
      const {item, locked, chooser}=__playtest, {a,b}=item.m;
      const opp=chooser==='A'?'B':'A';
      const guess=aiChooseSide(chooser==='A'?a:b,chooser==='A'?b:a,locked);
      return {chooser,opp,guess,locked};
    });
    let side=chosen.guess;
    if(provider && chosen.chooser===schedule.side) side=(await choose(provider,'选边',{schedule,locked:chosen.locked},[{id:'blue'},{id:'red'}],log)).id;
    call((pick,own,enemy)=>{
      const p=__playtest,m=p.item.m;
      p.draft=newDraft(m.a,m.b,pick==='blue'?own:enemy,p.locked);
      const need=Math.ceil(m.bo/2);
      p.draft.ctx={...(m.ctx||{}),decider:m.bo>1 && p.wa===need-1 && p.wb===need-1};
    },side,chosen.chooser,chosen.opp);

    for(let turn=0;turn<20;turn++){
      const view=call((me,usingModel)=>{
        const d=__playtest.draft, active=draftSide(d);
        if(!usingModel || active.side!==me){
          const ai=aiChoose(d);
          if(!draftAct(d,ai.c,ai.role,ai.offrole)) throw Error('AI could not complete a legal BP step');
          if(active.kind==='pick') optimizeAiFlex(d,active.side);
          return null;
        }
        const locked=unavailable(d), own=lineupMap(d[me]);
        const advice=coachSuggest(d,me);
        const heroes=CHAMP_KEYS.filter(c=>!locked.has(c)).map(c=>{
          const candidate={id:c,hero:CH[c].cn,tier:S.meta[c]||0};
          if(active.kind==='pick'){
            const chk=canPickChamp(d,me,c);
            const positions=chk.openRoles.filter(r=>chk.offrole || CH[c].roles.includes(r));
            candidate.positions=positions.map(r=>[r,champProfVal(own[r],c),CH[c].roles.includes(r)?1:0]);
          }
          return candidate;
        });
        return {action:active.kind,view:draftFeedback(d),picks:d.picks,bans:d.bans,advice,heroes};
      },schedule.side,!!provider);
      if(!view) continue;
      const {heroes,...context}=view;
      const fallback=context.advice[0]?.c;
      heroes.sort((a,b)=>Number(b.id===fallback)-Number(a.id===fallback));
      const legal=heroes.flatMap(h=>h.positions?h.positions.map(([role,mastery,natural])=>({id:`${h.id}:${role}`,champ:h.id,role,mastery,tier:h.tier,natural})): [h]);
      const action=await choose(provider,view.action==='ban'?'BP 禁用':'BP 选择',{...context,side:schedule.side},legal,log);
      call((hero,role)=>{
        const d=__playtest.draft, step=draftSide(d);
        const offrole=step.kind==='pick' && canPickChamp(d,step.side,hero).offrole;
        if(!draftAct(d,hero,role,offrole)) throw Error('Test player action failed validation');
      },action.champ||action.id,action.role||null);
    }
    Math.random=randomFor((seed ^ Math.imul(index,0x9E3779B1) ^ 0xC91EC7)>>>0);
    const state=call(()=>{
      const p=__playtest,d=p.draft;
      if(draftSide(d)) throw Error('Incomplete draft');
      const g=playGame(d);
      p.games.push(g);
      p.locked.push(...ROLES.map(r=>g.picks.A[r]),...ROLES.map(r=>g.picks.B[r]));
      if(g.w==='A') p.wa++; else p.wb++;
      p.chooser=g.w==='A'?'B':'A';
      const need=Math.ceil(p.item.m.bo/2);
      return p.wa===need || p.wb===need;
    });
    finished=state;
  }
  const result=call(()=>{
    const {item,wa,wb,games}=__playtest;
    finishSeries(item.m,wa,wb,games,true); afterMatch(item.st,item.m);
    return {score:[wa,wb],winner:item.m.w,games:games.map(g=>({w:g.w,pA:g.pA,dur:g.dur,kills:[g.kA,g.kB],
      towers:[g.turA,g.turB],drakes:[g.dragA,g.dragB],picks:g.picks,bans:g.bans,events:g.events.slice(0,8)}))};
  });
  return {...schedule,...result,log};
}

async function manageWindow(call, provider, kind, activity){
  const snapshot=call(()=>{
    const club=T(S.user);
    const players=club.roster.map(P).filter(Boolean);
    const scout=p=>({tag:playerTag(p),role:p.role,rating:p.rating,potential:p.pot,nat:p.nat,contract:p.contract,training:p.trainTargets||[]});
    const free=freeAgents().sort((a,b)=>b.rating-a.rating).slice(0,5);
    const paid=Object.values(S.players).filter(p=>p.team && p.team!==S.user && !p.retired && !isUntouchable(p) && askPrice(p,S.user)*1.08<=club.budget)
      .sort((a,b)=>b.rating-a.rating).slice(0,8);
    return {year:S.year,budget:club.budget,roster:players.map(scout),event:eventInfo(curEvent()).name,
      sign:[...free,...paid].map(p=>({id:`sign:${p.pid}`,pid:p.pid,fee:p.team?Math.ceil(askPrice(p,S.user)*1.08):0,...scout(p)})),
      renewal:players.filter(p=>p.contract<=S.year).map(p=>({id:`renew:${p.pid}`,pid:p.pid,...scout(p)})),
      outgoing:players.filter(p=>!Object.values(club.lineup).includes(p.pid)).map(p=>({id:`sell:${p.pid}`,pid:p.pid,...scout(p)}))};
  });
  const keep={id:'keep',label:'保持当前方案'};
  const offers=[keep,...snapshot.sign,...snapshot.outgoing];
  const choice=provider ? await choose(provider,'转会与预算',{year:snapshot.year,event:snapshot.event,budget:snapshot.budget,roster:snapshot.roster},offers,activity) : keep;
  const transfer=call((id,pid,fee)=>{
    if(id==='keep') return null;
    if(id.startsWith('sign:')) return {...makeOffer(pid,fee),kind:fee?'buy':'free'};
    const bid=bidsFor(pid)[0];
    if(!bid) return {kind:'sell',ok:false,msg:'无合规报价'};
    sellPlayer(pid,bid.t,bid.price);
    return {kind:'sell',ok:true};
  },choice.id,choice.pid||null,choice.fee||0);
  if(transfer) activity.push(transfer);
  const candidates=call(()=>{
    const club=T(S.user);
    const current={...club.lineup};
    const result=[];
    for(const p of club.roster.map(P).filter(Boolean)){
      if(current[p.role]===p.pid) continue;
      club.lineup[p.role]=p.pid;
      if(!lineupProblems(S.user).length) result.push({id:p.pid,role:p.role,tag:playerTag(p),rating:p.rating,potential:p.pot,chemistry:playerTeamBond(p)});
      club.lineup={...current};
    }
    return result;
  });
  const arrangement=provider ? await choose(provider,'首发与轮换',{year:snapshot.year,event:snapshot.event,roster:snapshot.roster},[keep,{id:'auto',label:'自动合规首发'},...candidates],activity) : keep;
  call((id,role)=>{
    if(id==='auto') autoLineup(S.user);
    else if(role) T(S.user).lineup[role]=id;
  },arrangement.id,arrangement.role||null);
  if(kind!=='off') return;

  if(snapshot.renewal.length){
    const renewal=provider ? await choose(provider,'合同续约',{year:snapshot.year,budget:snapshot.budget},[{id:'key-starters',label:'续约到期首发'},...snapshot.renewal,keep],activity) : {id:'key-starters'};
    const renewed=call((id,pid)=>{
      const targets=id==='key-starters'?starters(S.user).filter(p=>p.contract<=S.year):pid?[P(pid)]:[];
      for(const p of targets) renewPlayer(p.pid);
      return targets.map(playerTag);
    },renewal.id,renewal.pid||null);
    activity.push({kind:'renew',players:renewed});
  }
  const training=call(()=>{
    const patch=ensureNextPatch();
    return starters(S.user).flatMap(p=>CHAMP_KEYS.filter(c=>CH[c].roles.includes(p.role) && (patch.meta[c]||0)>=1)
      .map(c=>({id:`${p.pid}:${c}`,pid:p.pid,champ:c,player:playerTag(p),role:p.role,meta:patch.meta[c],mastery:champProfVal(p,c)})));
  });
  if(training.length){
    const target=provider ? await choose(provider,'休赛期英雄特训',{year:snapshot.year,roster:snapshot.roster},[...training,keep],activity) : training[0];
    if(target.pid) activity.push(call((pid,c)=>({kind:'training',pid,champ:c,...toggleTrainChamp(pid,c)}),target.pid,target.champ));
  }
}

async function playCareer(call, user, seed, provider, years){
  Math.random=randomFor(seed);
  const initial=call(k=>{ newGame(k); if(T(k)?.region!=='LPL') throw Error('The playtest team must belong to the LPL'); return S.year; },user);
  const report={seasons:[],skipped:0,played:0,maps:0,activities:[],series:[],budgetFallbacks:0};
  const active=provider && {...provider, ask:async(task,situation,choices)=>{
    try { return await provider.ask(task,situation,choices); }
    catch(error){
      if(!(error instanceof CallLimit)) throw error;
      report.budgetFallbacks++;
      return choices ? {id:choices[0].id,reason:'请求上限已到，采用本地可执行选项'} : {suggestions:[]};
    }
  }};
  let finishedYears=0, lastYearPlayed=null;
  const skippedYears=new Set();
  while(finishedYears<years){
    const e=call(()=>{const ev=curEvent(); return {type:ev.type,done:ev.done,setup:isRosterSetup(ev),year:S.year};});
    if(e.setup || e.type==='window'||e.type==='off'){
      await manageWindow(call,active,e.type,report.activities);
      if(e.setup){
        call(()=>{if(lineupProblems(S.user).length) autoLineup(S.user); if(!finishRosterSetup().ok) throw Error('Setup could not be completed');});
        continue;
      }
      if(e.type==='off'){
        const season=call(()=>{
          const stats=Object.fromEntries(S.events.filter(e=>e.res?.champ).map(e=>[e.type,e.res.champ]));
          const team=T(S.user), rosterBefore=team.roster.map(P).map(p=>({id:p.pid,rating:p.rating,change:p.ratingDelta||0,potential:p.pot}));
          const overview={year:S.year,budget:team.budget,points:S.points[S.user],champions:stats,chemistry:teamChemistry(S.user).score,roster:rosterBefore};
          finishOffseason(); autoLineup(S.user);
          const size=JSON.stringify(S).length; S=migrateSave(JSON.parse(JSON.stringify(S)));
          if(S.year!==overview.year+1 || S.history.at(-1)?.year!==overview.year || lineupProblems(S.user).length) throw Error('Year rollover or save restore failed');
          return {...overview,restoredYear:S.year,saveBytes:size,trainingSatisfies:S.news.some(x=>x.y===S.year && x.t.includes('冬训成果'))};
        });
        report.seasons.push(season); finishedYears++;
        continue;
      }
      call(()=>{curEvent().done=true; aiTransfers(4); advanceEvent();});
      continue;
    }
    if(e.done){ call(()=>advanceEvent()); continue; }
    const info=call(()=>{
      const item=simUntilUser(false);
      globalThis.__scheduledMatch=item;
      if(!item) return null;
      const {m,st}=item;
      return {a:m.a,b:m.b,bo:m.bo,label:m.label,regular:st.kind==='rr' && /^lpl_s/.test(curEvent().type),event:eventInfo(curEvent()).name};
    });
    if(!info){
      if(!call(()=>curEvent().done)) throw Error(`Could not advance unfinished event ${e.type}`);
      continue;
    }
    const maySkip=info.regular && lastYearPlayed===e.year;
    const seriesSeed=(seed ^ Math.imul(report.series.length+1,0x9E3779B1))>>>0;
    let mode='play';
    if(maySkip && !skippedYears.has(e.year)){
      mode='skip';
      report.activities.push({task:'常规赛跳过结算验收',year:e.year,match:info.label});
    } else if(maySkip && active){
      const options=[{id:'skip',label:'跳过常规赛，快速模拟'},{id:'play',label:'逐手 BP 并比赛'}];
      mode=(await choose(active,'常规赛推进方式',{year:e.year,...info},options,report.activities)).id;
    } else if(maySkip && !provider && report.series.length%3===0) mode='skip';
    if(mode==='skip'){
      Math.random=randomFor(seriesSeed);
      const skipped=call(()=>{
        const {m,st}=__scheduledMatch;
        const gamesBefore=starters(S.user).reduce((n,p)=>n+(p.development?.games||0),0);
        simSeries(m,true); afterMatch(st,m);
        const games=m.gm.length;
        const gains=m.gm.reduce((count,g)=>count+g.masteryChanges.filter(delta=>delta.gain>0).length,0);
        const gamesAfter=starters(S.user).reduce((n,p)=>n+(p.development?.games||0),0);
        return {score:m.s,winner:m.w,games,gains,records:m.gm.every(g=>g.masteryChanges.length===5),activityDelta:gamesAfter-gamesBefore};
      });
      if(!skipped.records || skipped.activityDelta!==skipped.games*5) throw Error('Regular stage skip missed mastery or development settlement');
      skippedYears.add(e.year);
      report.skipped++; report.maps+=skipped.games;
      report.series.push({year:e.year,event:e.type,mode,seed:seriesSeed,...info,...skipped});
    } else {
      const result=await playSeries(call,user,seriesSeed,active,true);
      if(info.regular) lastYearPlayed=e.year;
      report.played++; report.maps+=result.games.length;
      report.series.push({year:e.year,event:e.type,mode,seed:seriesSeed,...info,...result});
    }
  }
  if(report.seasons.length!==years || report.seasons[0].year!==initial || report.skipped===0) throw Error('Career coverage did not include the requested seasons and a regular stage skip');
  return report;
}

function verifyFeatures(){
  return ['run.js','features.js','cloud.js'].map(file=>{
    const r=spawnSync(process.execPath,[path.join(__dirname,file)],{encoding:'utf8',timeout:120_000,windowsHide:true});
    return {file,ok:r.status===0,report:[r.stdout,r.stderr,r.error?.message].filter(Boolean).join('\n').slice(-5000)};
  });
}

async function main(){
  const limit=positiveInteger(flags['max-calls'],MAX_CALLS,MAX_CALLS,'--max-calls');
  if(flags.series && flags.years) throw new Error('Choose --series or --years');
  const count=flags.series ? positiveInteger(flags.series,2,1000,'--series') : 0;
  const years=count ? 0 : positiveInteger(flags.years,2,2,'--years');
  const startSeed=positiveInteger(flags.seed,20261126,0xffffffff,'--seed');
  const team=flags.team||'TES';
  const provider=makeProvider(!!flags.live,limit);
  const call=gameRunner(load());
  const report={team,model:provider.model,limit,complete:0,trials:[],usage:provider.usage};
  if(flags.verify){
    report.checks=verifyFeatures();
    if(report.checks.some(check=>!check.ok)) process.exitCode=1;
  }
  const random=Math.random;
  try {
    if(years){
      report.baseline=await playCareer(call,team,startSeed,null,years);
      report.player=await playCareer(call,team,startSeed,provider,years);
      const summarize=r=>({seasons:r.seasons,played:r.played,skipped:r.skipped,maps:r.maps,activities:r.activities,
        skippedExamples:r.series.filter(s=>s.mode==='skip').slice(0,5),playedExamples:r.series.filter(s=>s.mode==='play').slice(0,2)});
      try{
        const feedback=await provider.ask('以玩家视角复盘两年。分别评价玩法是否可玩、是否好玩、有哪些操作负担，引用具体例子并给可验证建议',
          {baseline:summarize(report.baseline),player:summarize(report.player),
            specializedChecks:report.checks?.map(c=>({file:c.file,ok:c.ok,results:c.ok?c.report:undefined}))});
        report.suggestions=Array.isArray(feedback?.suggestions)?feedback.suggestions.filter(x=>typeof x==='string').slice(0,8):[];
      } catch(error){ if(!(error instanceof CallLimit)) throw error; report.stop='request_limit'; }
      report.complete=years;
    }
    for(let offset=0;offset<count;offset++){
      const seed=(startSeed+offset)>>>0;
      const baseline=await playSeries(call,team,seed,null);
      const player=await playSeries(call,team,seed,provider);
      const feedback=await provider.ask('复盘与改进建议',{seed,baseline,player});
      report.trials.push({seed,baseline,player,suggestions:Array.isArray(feedback?.suggestions)?feedback.suggestions.filter(x=>typeof x==='string').slice(0,6):[]});
      report.complete++;
      if(provider.usage.requests>=limit) break;
    }
  } catch(error){
    if (error instanceof CallLimit) report.stop='request_limit';
    else {
      report.stop='error';
      report.error=error.message;
      process.exitCode=1;
    }
  } finally { Math.random=random; }
  console.log(JSON.stringify(report,null,2));
}

main().catch(error=>{ console.error(error.message); process.exitCode=1; });
