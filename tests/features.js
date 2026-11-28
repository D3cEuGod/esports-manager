// Play through the compiled app in a clean, offline Chromium profile. Node 22+.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const root=path.resolve(__dirname,'..');
const drivers=[process.env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean);
const executable=drivers.find(p=>fs.existsSync(p));
if(!executable) throw Error('Set CHROME_BIN to a local Chrome or Chromium executable.');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'rift-feature-test-'));
const browser=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking',
  '--remote-debugging-port=0',`--user-data-dir=${scratch}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const exited=new Promise(resolve=>browser.once('close',resolve));

async function connection(){
  const portFile=path.join(scratch,'DevToolsActivePort');
  for(let i=0;i<100 && !fs.existsSync(portFile);i++) await delay(100);
  const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];
  const list=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  const socket=new WebSocket(list.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    socket.addEventListener('open',resolve,{once:true});
    socket.addEventListener('error',reject,{once:true});
  });
  let id=0;
  const pending=new Map(), exceptions=[];
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    const task=pending.get(message.id);
    if(!task) return;
    pending.delete(message.id);
    if(message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    pending.set(++id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  });
  const run=async fn=>{
    const result=await send('Runtime.evaluate',{expression:`(${fn.toString()})()`,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  return {socket,send,run,exceptions};
}

async function main(){
  const {socket,send,run,exceptions}=await connection();
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs',{urls:['https://*','http://*']});
  const appUrl=pathToFileURL(path.join(root,'dist/index.html')).href;
  const waitForApp=async()=>{
    for(let attempt=0;attempt<80;attempt++){
      if(await run(()=>typeof ACT==='object' && !!document.querySelector('#app [data-a="enterGuest"]'))) return;
      await delay(80);
    }
    throw Error('Guest entry did not finish loading');
  };
  await send('Page.navigate',{url:appUrl});
  await waitForApp();
  const checks={};
  checks.entry=await run(()=>{
    Math.random=srand(12072026);
    const gate=!!document.querySelector('[data-a="enterGuest"]');
    ACT.enterGuest(); ACT.newgame({k:'TES'});
    const setup=isRosterSetup(curEvent()) && !!document.querySelector('[data-a="finishSetup"]');
    const lineup=T(S.user).lineup, top=lineup.TOP; delete lineup.TOP;
    ACT.finishSetup(); const blocked=isRosterSetup(curEvent()); lineup.TOP=top; render();
    return gate && setup && blocked;
  });
  checks.directory=await run(()=>{
    ACT.view({v:'db'});
    let count=0;
    for(const region of REGIONS){
      ACT.dbRegion({r:region});
      const teams=[...document.querySelectorAll('[data-a="dbTeam"]')];
      count+=teams.length;
      for(const {dataset} of teams){
        ACT.dbTeam({k:dataset.k});
        const visible=[...document.querySelectorAll('main [data-a="dbPlayer"]')].map(e=>e.dataset.p).sort();
        if(JSON.stringify(visible)!==JSON.stringify(T(dataset.k).roster.slice().sort())) return false;
        if(!document.querySelector('.db-ovr')?.textContent.includes(String(Math.round(teamOvr(dataset.k))))) return false;
      }
    }
    document.querySelector('main [data-a="dbPlayer"]').click();
    const details=document.querySelector('.modal').innerText;
    ACT.closeModal();
    return count===58 && /英雄池/.test(details) && /合同/.test(details);
  });
  const market=await run(()=>{
    ACT.view({v:'market'});
    const candidate=freeAgents().find(p=>p.role==='TOP' && !isForeign(p));
    document.querySelector('[data-f="fa"]').click();
    const cardLink=document.querySelector('[data-a="mkPlayer"][data-p="Uzi2018"]');
    cardLink?.click();
    const freeProfile=document.querySelector('.modal');
    const profile=!!cardLink && freeProfile?.textContent.includes('自由球员') &&
      freeProfile.textContent.includes('英雄池') && !!freeProfile.querySelector('[data-a="offer"]');
    ACT.closeModal();
    document.querySelector('[data-f="fa"]').click();
    ACT.mkPlayer({p:'Bin'});
    const regional=!!document.querySelector('.modal .rg-tag')?.textContent.includes('LEC');
    ACT.closeModal();
    ACT.offer({p:candidate.pid}); ACT.doOffer({p:candidate.pid});
    const landed=P(candidate.pid).team===S.user && T(S.user).roster.includes(candidate.pid);
    ACT.view({v:'roster'}); ACT.setStarter({p:candidate.pid,r:'TOP'});
    const started=T(S.user).lineup.TOP===candidate.pid;
    ACT.autoLineup();
    ACT.doRelease({p:candidate.pid});
    ACT.autoLineup();
    const paid=Object.values(S.players).find(p=>p.team && p.team!==S.user && !p.retired && p.rating>=76 && askPrice(p,S.user)*1.10<T(S.user).budget);
    const fee=Math.ceil(askPrice(paid,S.user)*1.10), wanted=String(fee);
    ACT.view({v:'market'}); ACT.offer({p:paid.pid});
    const input=document.querySelector('[data-o="cash"]'); input.focus(); input.value=wanted;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    const stable=document.activeElement===input && input.value===wanted && document.querySelector('[data-o="cash"]')===input;
    ACT.doOffer({p:paid.pid}); const purchase=P(paid.pid).team===S.user;
    const released=!P(candidate.pid).team;
    ACT.sell({p:paid.pid}); const bid=document.querySelector('[data-a="acceptBid"]');
    const buyer=bid?.dataset.t;
    if(bid) bid.click(); else ACT.closeModal();
    const sold=!!buyer && P(paid.pid).team===buyer;
    ACT.offer({p:candidate.pid}); ACT.doOffer({p:candidate.pid});
    const incoming=Object.values(S.players).find(p=>p.team && p.team!==S.user && p.role===candidate.role && p.rating>=74 && askPrice(p,S.user)*1.1<T(S.user).budget);
    const previousTeam=incoming.team, price=Math.ceil(askPrice(incoming,S.user)*1.1);
    ACT.offer({p:incoming.pid});
    const give=document.querySelector('[data-o="give"]'); give.value=candidate.pid; give.dispatchEvent(new Event('change',{bubbles:true}));
    const cash=document.querySelector('[data-o="cash"]'); cash.value=String(price); cash.dispatchEvent(new Event('input',{bubbles:true}));
    ACT.doOffer({p:incoming.pid});
    const exchanged=P(incoming.pid).team===S.user && P(candidate.pid).team===previousTeam;
    return {profile,regional,landed,started,released,legal:!lineupProblems(S.user).length,stable,purchase,sold,exchanged};
  });
  checks.market=Object.values(market).every(Boolean);
  assert.ok(checks.market,JSON.stringify(market));
  checks.rosterAndBp=await run(()=>{
    ACT.view({v:'roster'});
    return document.querySelectorAll('.rs-card.starter').length===5;
  });
  for(const width of [390,1280]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    const fits=await run(()=>{
      UI.match=null; UI.view='roster'; render();
      const card=document.querySelector('.rs-card.starter .rs-open'); card.click();
      const detail=document.querySelector('.modal').innerText.includes('潜力'); ACT.closeModal();
      return detail && document.documentElement.scrollWidth<=innerWidth+1;
    });
    checks[`width${width}`]=fits;
  }
  checks.matchAndReplay=await run(async()=>{
    ACT.finishSetup(); ACT.startEv(); const it=simUntilUser(false); beginUserMatch(it);
    const until=async predicate=>{
      for(let tries=0;tries<50 && !predicate();tries++) await new Promise(resolve=>setTimeout(resolve,25));
      if(!predicate()) throw Error('Expected match phase was not reached');
    };
    ACT.soloChamp({c:'Yasuo'});
    document.querySelector('[data-a="skipSolo"]').click();
    ACT.skipSolo();
    await until(()=>!!UI.match.solo);
    const solo=UI.match.solo[UI.match.me].champ==='Yasuo' && !!UI.match.pendingSolo &&
      UI.match.games.length===0 && !it.m.w;
    ACT.soloEnterDraft(); stopBpClock();
    const live=UI.match, d=live.draft;
    const turn=draftSide(d);
    if(turn.side===live.me){ live.sel='Poppy'; render(); }
    const feedback=!!document.querySelector('.bp-fb');
    ACT.dAuto(); ACT.playGame(); ACT.wSkip();
    await until(()=>live.phase==='result');
    const game=live.games[0];
    const results=live.phase==='result' && game.masteryChanges.length===5 && !!game.rid;
    const visible=document.querySelector('.match').innerText.includes('熟练度');
    ACT.autoSeries();
    const summary=it.m.gm.length>=2 && it.m.gm.every(g=>g.masteryChanges.length===5) && !!UI.modal;
    ACT.closeModal(); ACT.view({v:'settings'}); ACT.setTab({t:'replays'});
    ACT.keepReplay({id:game.rid}); const kept=findReplay(game.rid).kept;
    ACT.openReplay({id:game.rid}); const replay=!!document.querySelector('.replay-screen');
    ACT.wPause(); const paused=Watch.active().paused;
    Watch.control('seek',60); const seek=Watch.active().t===60;
    ACT.wExit();
    ACT.openReplay({id:game.rid,k:'solo'}); const soloReplay=UI.replay?.kind==='solo'; ACT.wExit();
    ACT.keepReplay({id:game.rid});
    return solo && feedback && results && visible && summary && kept && replay && paused && seek && soloReplay && !findReplay(game.rid).kept && !UI.replay;
  });
  checks.fastRegularSeason=await run(()=>{
    newGame('TES'); finishRosterSetup(); UI.view='home'; UI.modal=null;
    const item=simUntilUser(false);
    ACT.simStage();
    const round=!!item.m.w && item.m.gm.every(g=>g.masteryChanges.length===5);
    const ev=curEvent(), phase=ev.stages[ev.si];
    const pending=phase.matches.filter(m=>!m.w).length;
    document.querySelector('[data-a="simRegular"]').click();
    const regular=pending>0 && phase.matches.every(m=>m.w) && curEvent()===ev && !ev.done &&
      ev.stages[ev.si].kind!=='rr' && !!nextReadyMatch() && !nextReadyMatch().m.w &&
      !document.querySelector('[data-a="simRegular"]');
    ACT.simEvent(); const complete=curEvent().done && !!curEvent().res.champ;
    ACT.nextEvent();
    return round && regular && complete && curEvent().type==='fst';
  });
  checks.progressionViews=await run(()=>{
    const names=[['events','赛事'],['meta','版本'],['news','新闻'],['settings','账号与存档']];
    const available=names.slice(0,3).every(([id])=>{ ACT.view({v:id}); return !!document.querySelector('main section'); });
    ACT.view({v:'settings'}); ACT.setTab({t:'rules'}); const rules=document.querySelector('main').innerText.includes('赛制说明');
    document.querySelector('.cloud-pill').click(); const account=document.querySelector('main').innerText.includes('导出存档');
    return available && rules && account;
  });
  checks.saveAndUpdater=await run(async()=>{
    ACT.export(); const backup=document.querySelector('#expt').value; ACT.closeModal();
    const date=S.year; S.year=2035;
    const files=new DataTransfer(); files.items.add(new File([backup],'test.json',{type:'application/json'}));
    const input=document.querySelector('#imp'); input.files=files.files; input.dispatchEvent(new Event('change',{bubbles:true}));
    for(let i=0;i<30 && S.year!==date;i++) await new Promise(resolve=>setTimeout(resolve,25));
    const imported=S.year===date && S.user==='TES';
    await StorageBridge.writeSaveText(JSON.stringify(S)); S=null; const reopened=await load() && S.user==='TES';
    const original=window.fetch;
    window.fetch=async()=>new Response(JSON.stringify({version:'99.0.0',url:'https://example.test/release',notes:'测试更新'}),{status:200});
    try{
      const update=await AppUpdater.check(true); render();
      return imported && reopened && update.hasUpdate && document.querySelector('a[href="https://example.test/release"]')?.textContent.includes('更新');
    } finally { window.fetch=original; }
  });
  checks.offseason=await run(()=>{
    S.evIdx=S.events.findIndex(e=>e.type==='off'); UI.view='home'; UI.offTab='train'; render();
    const team=T(S.user), player=P(team.roster[0]); const hero=CHAMP_KEYS.find(c=>CH[c].roles.includes(player.role));
    ACT.toggleTrain({p:player.pid,c:hero}); const queued=player.trainTargets.includes(hero);
    ACT.offTab({t:'contract'}); ACT.renew({p:player.pid});
    return queued && player.renewed && player.contract>=S.year+2 && !!document.querySelector('[data-a="offTab"][data-t="contract"]');
  });
  checks.aiDraftClock=await run(async()=>{
    newGame('TES'); UI.modal=null; UI.match=null; UI.view='home';
    beginUserMatch({m:{a:'TES',b:'BLG',bo:3,label:'BP验收'}});
    setupDraft('B'); render();
    const M=UI.match, first=M.draft;
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const until=async predicate=>{
      for(let i=0;i<150 && !predicate();i++) await wait(50);
      if(!predicate()) throw Error('AI draft step timed out');
    };
    queueAI();
    const aiStarts=M.clock===5 && M.clockAi && !!document.querySelector('.ai-wait-pill');
    await wait(3900);
    const noEarlyLock=first.step===0;
    await until(()=>first.step===1);
    const playerClock=!M.clockAi && M.clock===30;
    setupDraft('B'); const skipped=M.draft, start=performance.now();
    ACT.dAuto();
    const noDelay=M.phase==='ready' && skipped.step===20 && performance.now()-start<1000;

    const pair=newDraft('TES','BLG','A',[]);
    while(pair.step<7){
      const c=aiChoose(pair);
      if(!draftAct(pair,c.c,c.role,c.offrole)) throw Error('Could not prepare consecutive AI turns');
    }
    M.draft=pair; M.phase='draft';
    queueAI(); queueAI(); render();
    const pairStart=performance.now();
    await until(()=>pair.step===8);
    const firstElapsed=performance.now()-pairStart;
    const restartedClock=M.clockAi && M.clock>=4;
    await until(()=>pair.step===9);
    const pairElapsed=performance.now()-pairStart;
    stopBpClock(); UI.match=null; render();
    return aiStarts && noEarlyLock && playerClock && noDelay && skipped.step===20 &&
      firstElapsed>=4800 && pairElapsed>=9800 && restartedClock;
  });
  checks.playerBpClock=await run(()=>{
    ACT.view({v:'settings'});
    document.querySelector('.set-tabs [data-t="game"]').click();
    const options=[...document.querySelectorAll('input[name="bp-turn-sec"]')];
    const defaults=options.map(input=>input.value).join(',')==='30,60,90' && options[0].checked;
    document.querySelector('#bp-turn-60').click();
    const originalSetInterval=window.setInterval;
    let tick=null;
    try{
      window.setInterval=(fn,ms)=>{
        if(ms===1000) tick=fn;
        return originalSetInterval(fn,ms);
      };
      beginUserMatch({m:{a:'TES',b:'BLG',bo:3,label:'玩家 BP 时限验收'}});
      setupDraft('A');
      const M=UI.match, d=M.draft;
      const banStarts=M.clock===60 && M.clockMax===60 && !M.clockAi;
      const ban=coachSuggest(d,M.me)[0].c;
      M.sel=ban;
      for(let i=0;i<59;i++) tick();
      const noEarlyLock=M.clock===1 && d.step===0;
      tick();
      const autoBan=d.step===1 && d.bans[M.me][0]===ban;
      stopBpClock();
      while(draftSide(d).kind==='ban'){
        const choice=aiChoose(d);
        if(!draftAct(d,choice.c,choice.role,choice.offrole)) throw Error('Could not prepare the first pick');
      }
      queueAI();
      const pickStarts=M.clock===60 && M.clockMax===60 && !M.clockAi;
      const pick=coachSuggest(d,M.me)[0];
      M.sel=pick.c; M.roleSel=pick.role;
      for(let i=0;i<60;i++) tick();
      const autoPick=d.step===7 && Object.values(d.picks[M.me]).includes(pick.c);
      return defaults && banStarts && noEarlyLock && autoBan && pickStarts && autoPick && M.clockAi && M.clock===5;
    } finally {
      window.setInterval=originalSetInterval;
      stopBpClock();
      UI.match=null; render();
      document.querySelector('#bp-turn-90').click();
    }
  });
  checks.aiBpLevel=await run(()=>{
    ACT.view({v:'settings'});
    document.querySelector('.set-tabs [data-t="game"]').click();
    const options=[...document.querySelectorAll('input[name="ai-bp-level"]')];
    const defaults=options.map(input=>input.value).join(',')==='easy,normal,hard' &&
      document.querySelector('#ai-bp-normal').checked && aiBpLevel()==='normal';
    let picked=null;
    const original=window.aiChooseLevel;
    try{
      window.aiChooseLevel=(d,level)=>{ picked=level; return original(d,level); };
      beginUserMatch({m:{a:'TES',b:'BLG',bo:3,label:'对手难度验收'}});
      setupDraft('B'); render();
      const M=UI.match, d=M.draft;
      const label=document.querySelector('[data-testid="bp-ai-level"]')?.textContent==='对手 · 普通';
      runAiDraftStep(M,d,d.step);
      const usedNormal=picked==='normal' && d.step===1;
      stopBpClock(); UI.match=null;
      ACT.view({v:'settings'}); document.querySelector('.set-tabs [data-t="game"]').click();
      document.querySelector('#ai-bp-hard').click();
      const stored=localStorage.getItem('em_ai_bp_level')==='hard' && document.querySelector('#ai-bp-hard').checked;
      return defaults && label && usedNormal && stored;
    } finally { window.aiChooseLevel=original; stopBpClock(); UI.match=null; render(); }
  });
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.reload');
  await waitForApp();
  checks.savedBpClock=await run(()=>{
    ACT.enterGuest(); ACT.newgame({k:'TES'});
    ACT.view({v:'settings'}); document.querySelector('.set-tabs [data-t="game"]').click();
    const options=document.querySelector('[data-testid="bp-turn-limit"]');
    const settingsFit=options.getBoundingClientRect().right<=390 &&
      options.querySelector('#bp-turn-90').checked;
    beginUserMatch({m:{a:'TES',b:'BLG',bo:3,label:'本地时限恢复验收'}});
    setupDraft('A'); render();
    const M=UI.match, clock=document.querySelector('#bp-clock-num');
    const saved=M.clock===90 && M.clockMax===90 && clock?.textContent==='90';
    stopBpClock(); UI.match=null; render();
    ACT.view({v:'settings'}); document.querySelector('.set-tabs [data-t="game"]').click();
    const levelBox=document.querySelector('[data-testid="ai-bp-level"]');
    const levelSaved=aiBpLevel()==='hard' && levelBox.querySelector('#ai-bp-hard').checked && levelBox.getBoundingClientRect().right<=390;
    beginUserMatch({m:{a:'TES',b:'BLG',bo:3,label:'本地难度恢复验收'}});
    setupDraft('B'); render();
    const hardLabel=document.querySelector('[data-testid="bp-ai-level"]')?.textContent==='对手 · 困难';
    stopBpClock(); UI.match=null; render();
    return settingsFit && saved && levelSaved && hardLabel;
  });
  for(const [name,passed] of Object.entries(checks)) assert.equal(passed,true,name);
  assert.deepEqual(exceptions,[],'unexpected app exceptions');
  console.log(JSON.stringify(checks));
  await send('Browser.close').catch(()=>{});
  socket.close();
}

const timeout=setTimeout(()=>{ process.exitCode=1; browser.kill(); console.error('Feature test timed out'); },45_000);
main().catch(error=>{ console.error(error); process.exitCode=1; }).finally(async()=>{
  clearTimeout(timeout);
  browser.kill();
  await exited;
  const temporaryRoot=fs.realpathSync(os.tmpdir());
  const actual=fs.realpathSync(scratch);
  if(path.dirname(actual)===temporaryRoot && path.basename(actual).startsWith('rift-feature-test-')){
    try{ fs.rmSync(actual,{recursive:true,force:true,maxRetries:2,retryDelay:100}); }catch{}
  }
});
