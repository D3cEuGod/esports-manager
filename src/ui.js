// ================= 界面 =================
const UI = { view:'home', modal:null, match:null, evSel:null, mk:{region:'ALL',role:'ALL',q:'',sort:'rating',fa:false}, toast:null };
const SAVE_KEY='lolm_save_v1';
const $app = () => document.getElementById('app');
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){ console.warn(e); } }
function load(){ try{ const s=localStorage.getItem(SAVE_KEY); if(s){ S=JSON.parse(s); return true; } }catch(e){} return false; }
function toast(t){ UI.toast=t; render(); setTimeout(()=>{ if(UI.toast===t){UI.toast=null; render();} },2600); }
const teamTag = (k,cls='') => { const t=T(k); if(!t) return '—'; return `<span class="tt ${cls} ${k===S.user?'me':''}" title="${esc(t.name)}"><b>${esc(t.short)}</b><i>${t.region}</i></span>`; };
const champName = c => c? (CH[c]?CH[c].cn:c) : '';
const ovrBadge = v => `<b class="ovr ${v>=88?'s':v>=80?'a':v>=72?'b':'c'}">${Math.round(v)}</b>`;
const transferOpen = () => { const ev=curEvent(); return ev.type==='window'||ev.type==='off'||(ev.type==='lpl_s1'&&!ev.started); };

function render(){
  if(!S){ $app().innerHTML = startScreen(); return; }
  if(UI.match){ $app().innerHTML = matchScreen() + toastHtml(); return; }
  const me=T(S.user);
  const ev=curEvent();
  $app().innerHTML = `
  <header class="top">
    <div class="brand">峡谷经理人</div>
    <div class="hinfo"><div><small>战队</small>${teamTag(S.user)}</div><div><small>赛季</small><b>${S.year}</b></div><div><small>当前</small><b>${EVENT_INFO[ev.type].name}</b></div><div><small>预算</small><b>${fmtMoney(me.budget)}</b></div><div><small>战力</small>${ovrBadge(teamOvr(S.user))}</div></div>
  </header>
  <nav class="tabs">${[['home','主页'],['roster','阵容'],['market','转会'],['events','赛事'],['meta','版本'],['news','资讯'],['rules','规则'],['sys','存档']].map(([k,n])=>`<a data-a="view" data-v="${k}" class="${UI.view===k?'on':''}">${n}</a>`).join('')}</nav>
  <main>${VIEWS[UI.view]()}</main>
  ${UI.modal?`<div class="mask" data-a="closeModal"></div><div class="modal">${UI.modal()}</div>`:''}
  ${toastHtml()}`;
}
const toastHtml = () => UI.toast?`<div class="toast">${esc(UI.toast)}</div>`:'';

// ---------- 开始界面 ----------
function startScreen(){
  const has=!!localStorage.getItem(SAVE_KEY);
  const lpl=ROSTER.LPL.teams;
  // 临时计算战力
  const ovr = t => { const best={}; t.players.forEach(p=>{ if(!best[p.role]||best[p.role]<p.rating) best[p.role]=p.rating; }); return ROLES.reduce((s,r)=>s+(best[r]||45),0)/5; };
  return `<div class="start">
    <h1>峡谷经理人</h1><p class="sub">英雄联盟电竞经理 · 2026 赛季</p>
    ${has?`<button class="btn big" data-a="continue">继续存档</button>`:''}
    <h3>选择你要执掌的 LPL 战队</h3>
    <div class="tgrid">${lpl.map(t=>`<div class="tcard" data-a="newgame" data-k="${t.short}">
      <div class="tn">${esc(t.short)}</div><div class="tf">${esc(t.cn||t.name)}</div>
      <div class="tov">${Math.round(ovr(t))}<small>战力</small></div>
      <div class="tp">${t.players.filter(p=>!p.sub).map(p=>esc(p.id)).join(' · ')}</div></div>`).join('')}</div>
    <p class="note">选手名单整理自公开资料，部分队伍/能力值为估算，详见“赛制说明”。本游戏为粉丝向原创作品，界面与美术均为原创。</p>
  </div>`;
}

// ---------- 主页 / 赛程 ----------
const VIEWS = {};
VIEWS.home = () => {
  const ev=curEvent(), info=EVENT_INFO[ev.type];
  let body='';
  if(ev.type==='window'){
    body=`<p>转会窗口开启中。你可以前往 <a data-a="view" data-v="market">转会市场</a> 买入/交换选手，或在 <a data-a="view" data-v="roster">阵容</a> 中出售选手。</p>
      <button class="btn big" data-a="endWindow">结束转会窗口，继续赛程 ▶</button>`;
  } else if(ev.type==='off'){
    const exp=T(S.user).roster.map(P).filter(p=>p.contract<=S.year);
    body=`<p>${S.year} 赛季结束。处理合同、转会后开始新赛季。</p>
      ${exp.length?`<h4>合同到期选手（不续约将离队）</h4><table class="tbl">${exp.map(p=>`<tr><td>${ROLE_CN[p.role]}</td><td><b>${esc(p.pid)}</b></td><td>${ovrBadge(p.rating)}</td><td>${p.age}岁</td><td>${p.renewed?'✅ 已续约':`<button class="btn sm" data-a="renew" data-p="${esc(p.pid)}">续约2年（年薪约 ${fmtMoney(fairSalary(p)*1.1)}）</button>`}</td></tr>`).join('')}</table>`:'<p>没有合同到期的选手。</p>'}
      <button class="btn big" data-a="newSeason">开始 ${S.year+1} 赛季 ▶</button>`;
  } else if(!ev.started){
    body = `<p>赛事即将开始。${ev.type==='lpl_s1'?'开赛前转会窗口仍然开放，可以先去调整阵容和转会。':''}</p>${probs()}
      <div class="btns"><button class="btn big" data-a="startEv">开始赛事 ▶</button><button class="btn ghost" data-a="simEvent">快速模拟整项赛事（含我的比赛）</button></div>`;
  } else {
    const nxt = nextReadyMatch();
    const myNext = findMyNext();
    if(ev.done){
      body = `<div class="done">✅ 赛事已结束 ${ev.res.champ?`· 冠军 ${teamTag(ev.res.champ)}`:''}</div>${eventSummary(ev)}
        <button class="btn big" data-a="nextEvent">进入下一项赛事 ▶</button>`;
    } else {
      const inEvent = eventHasUser(ev);
      body = `<div class="stage">当前阶段：<b>${esc(ev.stages[ev.si]?ev.stages[ev.si].name:'')}</b></div>
       ${myNext?`<div class="nextm"><div class="lbl">下一场 · ${esc(myNext.m.label)} · BO${myNext.m.bo}</div>
          <div class="vs"><div class="side">${teamTag(myNext.m.a,'big')}<span>战力 ${Math.round(teamOvr(myNext.m.a))}</span></div><em>VS</em><div class="side">${teamTag(myNext.m.b,'big')}<span>战力 ${Math.round(teamOvr(myNext.m.b))}</span></div></div></div>`:
         `<p class="muted">${inEvent?'等待其他比赛结果…':'你的战队没有参加本项赛事（或已被淘汰），可以直接模拟观看结果。'}</p>`}
       <div class="btns">
         ${myNext?`<button class="btn big" data-a="toMyMatch">${nxt&&userInvolved(nxt.m)?'进入比赛（BP）':'模拟至我的比赛'} ▶</button>`:''}
         <button class="btn" data-a="simStage">模拟本阶段</button>
         <button class="btn ghost" data-a="simEvent">快速模拟整项赛事（含我的比赛）</button>
       </div>
       ${probs()}`;
    }
  }
  return `<section class="card evcard"><div class="evh"><h2>${info.name}</h2><span>${info.date} ${info.loc?'· '+info.loc:''}</span></div>
    <details class="fmtd"><summary>赛制</summary><p class="fmt">${esc(info.fmt)}</p></details>${body}</section>
    <div class="cols"><section class="card">${seasonTimeline()}</section><section class="card"><h3>LPL 积分榜（世界赛资格）</h3>${pointsTable()}</section></div>
    <section class="card"><h3>最新动态</h3><ul class="news">${S.news.slice(0,8).map(n=>`<li>${esc(n.t)}</li>`).join('')}</ul></section>`;
};
function probs(){ const p=lineupProblems(S.user); return p.length?`<p class="warn">⚠️ ${p.join('；')} —— 请到“阵容”调整</p>`:''; }
function eventHasUser(ev){ return ev.stages.some(st=>st.matches.some(m=>userInvolved(m)&&!m.w)) || ev.stages.some(st=>(st.teams||[]).includes(S.user)&&st.kind==='swiss'&&st.rec[S.user][0]<3&&st.rec[S.user][1]<3) || (ev.stages[ev.si]&&ev.stages[ev.si].kind==='rr'&&Object.values(ev.stages[ev.si].groups).some(g=>g.includes(S.user))); }
function findMyNext(){ const ev=curEvent(); if(!ev.started||ev.done) return null; for(const st of ev.stages){ if(st.kind==='br') resolveBR(st); const m=st.matches.find(m=>!m.w&&userInvolved(m)&&m.a&&m.b); if(m) return {m,st}; } return null; }
function seasonTimeline(){
  return `<h3>${S.year} 赛季日程</h3><ol class="tl">${S.events.map((e,i)=>{ const inf=EVENT_INFO[e.type];
    const st = i<S.evIdx||e.done?'past':i===S.evIdx?'now':'';
    return `<li class="${st}"><b>${inf.name}</b> <small>${inf.date}</small> ${e.res&&e.res.champ?`· 冠军 ${teamTag(e.res.champ)}`:''}</li>`; }).join('')}</ol>`;
}
function pointsTable(){
  const rows=S.lplOrder.slice().sort((a,b)=>(S.points[b]||0)-(S.points[a]||0));
  return `<table class="tbl"><tr><th>#</th><th>战队</th><th>积分</th><th>战力</th></tr>${rows.map((k,i)=>`<tr class="${k===S.user?'me':''}"><td>${i+1}</td><td>${teamTag(k)}</td><td>${S.points[k]||0}</td><td>${ovrBadge(teamOvr(k))}</td></tr>`).join('')}</table>`;
}
function eventSummary(ev){
  const r=ev.res; let h='';
  if(r.champ) h+=`<p>🏆 冠军：${teamTag(r.champ)}</p>`;
  if(r.final) h+=`<p>最终排名：${r.final.slice(0,8).map((t,i)=>`${i+1}. ${teamTag(t)}`).join(' ')}</p>`;
  if(r.seeds && Array.isArray(r.seeds)) h+=`<p>LPL世界赛代表：${r.seeds.map((t,i)=>`${i+1}号种子 ${teamTag(t)}`).join(' ')}</p>`;
  if(r.runner) h+=`<p>亚军：${teamTag(r.runner)}</p>`;
  return h;
}

// ---------- 阵容 ----------
VIEWS.roster = () => {
  const t=T(S.user); const ps=t.roster.map(P).sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)||b.rating-a.rating);
  const sal=ps.reduce((s,p)=>s+p.salary,0);
  return `<section class="card"><h2>${esc(t.name)} ${t.cn?`<small>${esc(t.cn)}</small>`:''}</h2>
   <p>战力 ${ovrBadge(teamOvr(S.user))} · 预算 ${fmtMoney(t.budget)} · 年薪总额 ${fmtMoney(sal)} · 首发外援 ${starters(S.user).filter(isForeign).length}/2</p>
   ${probs()}
   <div class="lineup">${ROLES.map(r=>{ const p=P(t.lineup[r]); return `<div class="slot"><div class="r">${ROLE_CN[r]}</div>${p?`<b>${esc(p.pid)}</b>${ovrBadge(p.rating+(p.form||0))}${p.role!==r?'<em>非本位</em>':''}`:'<em>空缺</em>'}</div>`; }).join('')}</div>
   <button class="btn sm ghost" data-a="autoLineup">自动最佳阵容</button>
   <table class="tbl roster"><tr><th>位置</th><th>选手</th><th>国籍</th><th>年龄</th><th>能力</th><th>状态</th><th>潜力</th><th>身价</th><th>年薪</th><th>合同至</th><th>英雄池</th><th></th></tr>
   ${ps.map(p=>{ const st=Object.entries(t.lineup).find(([r,id])=>id===p.pid); return `<tr>
     <td>${ROLE_CN[p.role]}</td><td><b>${esc(p.pid)}</b><br><small>${esc(p.name)}</small></td><td>${esc(p.nat)}${isForeign(p)?'<small class="fx">外援</small>':''}</td><td>${p.age}</td>
     <td>${ovrBadge(p.rating)}</td><td>${p.form>0?'+':''}${p.form||0}</td><td>${p.pot}</td><td>${fmtMoney(playerValue(p))}</td><td>${fmtMoney(p.salary)}</td><td>${p.contract}</td>
     <td class="pool">${p.champs.map(c=>`<span class="${c.p>=5?'sig':''}">${champName(c.c)}</span>`).join('')}</td>
     <td class="act">${st?`<span class="tagon">首发·${ROLE_CN[st[0]]}</span>`:`<button class="btn sm" data-a="setStarter" data-p="${esc(p.pid)}" data-r="${p.role}">设为${ROLE_CN[p.role]}首发</button>`}
       ${transferOpen()?`<button class="btn sm ghost" data-a="sell" data-p="${esc(p.pid)}">出售</button><button class="btn sm ghost" data-a="release" data-p="${esc(p.pid)}">解约</button>`:''}</td></tr>`; }).join('')}
   </table>${transferOpen()?'':'<p class="muted">转会窗口关闭中（季后/休赛期与赛段之间开放），目前只能调整首发。</p>'}</section>`;
};

// ---------- 转会市场 ----------
VIEWS.market = () => {
  const f=UI.mk;
  let ps=Object.values(S.players).filter(p=>!p.retired && p.team!==S.user);
  if(f.fa) ps=ps.filter(p=>!p.team); else ps=ps.filter(p=>p.team);
  if(f.region!=='ALL') ps=ps.filter(p=>p.team&&T(p.team).region===f.region);
  if(f.role!=='ALL') ps=ps.filter(p=>p.role===f.role);
  if(f.q) ps=ps.filter(p=>(p.pid+p.name+(p.team||'')).toLowerCase().includes(f.q.toLowerCase()));
  const key={rating:p=>-p.rating, value:p=>-playerValue(p), age:p=>p.age, pot:p=>-p.pot}[f.sort];
  ps.sort((a,b)=>key(a)-key(b));
  const open=transferOpen();
  return `<section class="card"><h2>转会市场 ${open?'<span class="on">窗口开放</span>':'<span class="off">窗口关闭</span>'}</h2>
  ${open?'':'<p class="warn">当前不在转会窗口内，可以浏览，但无法报价。窗口在第一赛段开赛前、先锋赛后、EWC后以及休赛期开放。</p>'}
  <div class="filters">
    <select data-f="region">${['ALL',...REGIONS].map(r=>`<option ${f.region===r?'selected':''} value="${r}">${r==='ALL'?'全部赛区':r}</option>`).join('')}</select>
    <select data-f="role">${['ALL',...ROLES].map(r=>`<option ${f.role===r?'selected':''} value="${r}">${r==='ALL'?'全部位置':ROLE_CN[r]}</option>`).join('')}</select>
    <select data-f="sort">${[['rating','按能力'],['value','按身价'],['pot','按潜力'],['age','按年龄']].map(([k,n])=>`<option ${f.sort===k?'selected':''} value="${k}">${n}</option>`).join('')}</select>
    <label><input type="checkbox" data-f="fa" ${f.fa?'checked':''}> 只看自由球员/新秀</label>
    <input data-f="q" placeholder="搜索选手/战队" value="${esc(f.q)}">
    <span class="muted">共 ${ps.length} 人 · 我的预算 ${fmtMoney(T(S.user).budget)}</span>
  </div>
  <table class="tbl"><tr><th>选手</th><th>战队</th><th>位置</th><th>国籍</th><th>年龄</th><th>能力</th><th>潜力</th><th>身价</th><th>要价</th><th>合同至</th><th></th></tr>
  ${ps.slice(0,150).map(p=>`<tr><td><b>${esc(p.pid)}</b><br><small>${esc(p.name)}</small></td><td>${p.team?teamTag(p.team):'<i>自由球员</i>'}</td><td>${ROLE_CN[p.role]}</td><td>${esc(p.nat)}</td><td>${p.age}</td><td>${ovrBadge(p.rating)}</td><td>${p.pot}</td><td>${fmtMoney(playerValue(p))}</td><td>${p.team?fmtMoney(askPrice(p)):'—'}</td><td>${p.contract}</td>
   <td>${open?`<button class="btn sm" data-a="offer" data-p="${esc(p.pid)}">${p.team?'报价':'签约'}</button>`:''}</td></tr>`).join('')}</table>
   ${ps.length>150?'<p class="muted">仅显示前150人，请使用筛选。</p>':''}</section>`;
};
function offerModal(pid){
  return () => { const p=P(pid); const me=T(S.user);
    const cash = UI.offerCash!=null?UI.offerCash:(p.team?askPrice(p):0); const give=UI.offerGive||'';
    const e = p.team? evaluateOffer(pid,cash,give||null):null;
    const verdict = !e? '' : e.ratio>=1.05?'<b class="g">对方大概率接受</b>':e.ratio>=0.9?'<b class="y">有机会，对方在犹豫</b>':'<b class="r">对方很可能拒绝</b>';
    return `<h3>${p.team?'报价':'签约'}：${esc(p.pid)} <small>${ROLE_CN[p.role]} · ${p.team?teamTag(p.team):'自由球员'}</small></h3>
     <p>能力 ${ovrBadge(p.rating)} · 潜力 ${p.pot} · ${p.age}岁 · 身价 ${fmtMoney(playerValue(p))} · 预计年薪 ${fmtMoney(Math.max(p.salary,fairSalary(p)))}</p>
     ${p.team?`<label>转会费（万）：<input type="number" min="0" step="10" data-o="cash" value="${cash}"></label>
     <label>附加交换选手：<select data-o="give"><option value="">（不交换）</option>${me.roster.map(P).map(x=>`<option value="${esc(x.pid)}" ${give===x.pid?'selected':''}>${esc(x.pid)} · ${ROLE_CN[x.role]} · ${x.rating.toFixed(0)} · 身价${fmtMoney(playerValue(x))}</option>`).join('')}</select></label>
     <p>评估：${verdict}（报价价值 ${fmtMoney(e.offerVal)}）</p>`:'<p>自由球员可直接签约，无需转会费。</p>'}
     <div class="btns"><button class="btn" data-a="doOffer" data-p="${esc(pid)}">${p.team?'提交报价':'签约'}</button><button class="btn ghost" data-a="closeModal">取消</button></div>`; };
}
function sellModal(pid, bids){
  return () => `<h3>出售 ${esc(pid)}</h3>${bids.length?`<p>收到以下报价：</p><table class="tbl">${bids.map(b=>`<tr><td>${teamTag(b.t)}</td><td>${fmtMoney(b.price)}</td><td><button class="btn sm" data-a="acceptBid" data-p="${esc(pid)}" data-t="${b.t}" data-price="${b.price}">接受</button></td></tr>`).join('')}</table>`:'<p>暂时没有球队有能力或意愿报价。</p>'}
   <button class="btn ghost" data-a="closeModal">关闭</button>`;
}

// ---------- 赛事浏览 ----------
VIEWS.events = () => {
  const i = UI.evSel==null? S.evIdx : UI.evSel;
  const evs=S.events.map((e,k)=>[e,k]).filter(([e])=>!['window','off'].includes(e.type));
  const ev=S.events[i];
  return `<section class="card"><div class="evtabs">${evs.map(([e,k])=>`<a data-a="evSel" data-i="${k}" class="${k===i?'on':''}">${EVENT_INFO[e.type].name}</a>`).join('')}</div>
   ${!ev||['window','off'].includes(ev.type)?'<p>请选择赛事</p>': !ev.started?'<p class="muted">赛事尚未开始。</p><p class="fmt">'+esc(EVENT_INFO[ev.type].fmt)+'</p>' :
     ev.stages.map(st=>stageView(st)).join('') + eventSummary(ev)}</section>`;
};
function matchCell(m){
  const sc = m.w? `${m.s[0]}:${m.s[1]}` : 'BO'+m.bo;
  return `<div class="mc ${userInvolved(m)?'me':''}" ${m.gm?`data-a="showMatch" data-m="${m.id}"`:''}>
    <div class="${m.w&&m.w===m.a?'win':''}">${m.a?teamTag(m.a):'<i>待定</i>'}<b>${m.w?m.s[0]:''}</b></div>
    <div class="${m.w&&m.w===m.b?'win':''}">${m.b?teamTag(m.b):'<i>待定</i>'}<b>${m.w?m.s[1]:''}</b></div>
    <small>${esc(m.label)} · BO${m.bo}${m.gm?' · 🔍':''}</small></div>`;
}
function stageView(st){
  if(st.kind==='rr'){
    return `<h3>${esc(st.name)}</h3><div class="cols">${Object.keys(st.groups).map(g=>`<div><h4>${g}</h4><table class="tbl"><tr><th>#</th><th>战队</th><th>胜</th><th>负</th><th>小局</th></tr>${rrTable(st,g).map((r,i)=>`<tr class="${r.t===S.user?'me':''}"><td>${i+1}</td><td>${teamTag(r.t)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.gw}-${r.gl}</td></tr>`).join('')}</table></div>`).join('')}</div>
     <details><summary>全部比赛（${st.matches.filter(m=>m.w).length}/${st.matches.length}）</summary><div class="mlist">${st.matches.map(matchCell).join('')}</div></details>`;
  }
  if(st.kind==='swiss'){
    const rows=st.teams.slice().sort((a,b)=>(st.rec[b][0]-st.rec[b][1])-(st.rec[a][0]-st.rec[a][1]));
    return `<h3>${esc(st.name)}</h3><table class="tbl"><tr><th>战队</th><th>战绩</th><th>状态</th></tr>${rows.map(t=>`<tr class="${t===S.user?'me':''}"><td>${teamTag(t)}</td><td>${st.rec[t][0]}-${st.rec[t][1]}</td><td>${st.rec[t][0]>=3?'✅ 晋级':st.rec[t][1]>=3?'❌ 淘汰':'进行中'}</td></tr>`).join('')}</table>
     <details><summary>全部比赛</summary><div class="mlist">${st.matches.map(matchCell).join('')}</div></details>`;
  }
  const cols={}; st.matches.forEach(m=>(cols[m.col]=cols[m.col]||[]).push(m));
  return `<h3>${esc(st.name)}</h3><div class="bracket">${Object.keys(cols).sort((a,b)=>a-b).map(c=>`<div class="bcol">${cols[c].sort((a,b)=>a.row-b.row).map(matchCell).join('')}</div>`).join('')}</div>`;
}
function matchDetail(mid){
  return () => { let m=null; S.events.forEach(e=>e.stages.forEach(st=>st.matches.forEach(x=>{ if(x.id===mid) m=x; })));
    if(!m) return '无数据';
    return `<h3>${teamTag(m.a)} ${m.s[0]} : ${m.s[1]} ${teamTag(m.b)} <small>${esc(m.label)}</small></h3>
     ${m.gm.map((g,i)=>`<div class="gd"><b>第${i+1}局</b> 胜者 ${teamTag(g.w==='A'?m.a:m.b)} · ${g.dur}分钟 · 击杀 ${g.kA}:${g.kB} · MVP ${esc(g.mvp||'')} · 蓝色方 ${teamTag(g.blue==='A'?m.a:m.b)}
       <div class="gp"><div>${teamTag(m.a)} ${ROLES.map(r=>champName(g.picks.A[r])).join(' / ')}<br><small>禁用：${g.bans.A.map(champName).join(' ')}</small></div>
       <div>${teamTag(m.b)} ${ROLES.map(r=>champName(g.picks.B[r])).join(' / ')}<br><small>禁用：${g.bans.B.map(champName).join(' ')}</small></div></div></div>`).join('')}
     <button class="btn ghost" data-a="closeModal">关闭</button>`; };
}

// ---------- 版本 ----------
VIEWS.meta = () => {
  const strong=CHAMP_KEYS.filter(k=>S.meta[k]>=1).sort((a,b)=>S.meta[b]-S.meta[a]);
  const st=Object.entries(S.log).map(([c,v])=>({c,...v})).sort((a,b)=>(b.p+b.b)-(a.p+a.b)).slice(0,30);
  return `<section class="card"><h2>当前版本 ${S.year%100}.${S.patchNo}</h2><p>版本强势英雄（🔥=T0，↑=T1）：</p>
   <div class="chips">${strong.map(k=>`<span class="chip">${S.meta[k]>=2?'🔥':'↑'} ${CH[k].cn} <small>${CH[k].roles.map(r=>ROLE_CN[r]).join('/')}</small></span>`).join('')}</div>
   <h3>本赛季英雄数据（全部赛区）</h3><table class="tbl"><tr><th>英雄</th><th>登场</th><th>禁用</th><th>胜率</th></tr>${st.map(x=>`<tr><td>${CH[x.c]?CH[x.c].cn:x.c}</td><td>${x.p}</td><td>${x.b}</td><td>${x.p?Math.round(x.w/x.p*100)+'%':'-'}</td></tr>`).join('')}</table></section>`;
};
VIEWS.news = () => `<section class="card"><h2>新闻</h2><ul class="news">${S.news.map(n=>`<li><small>${n.y} · ${esc(n.ev)}</small> ${esc(n.t)}</li>`).join('')}</ul>
  <h3>历届冠军</h3><table class="tbl"><tr><th>年份</th><th>LPL S1/S2/S3</th><th>先锋赛</th><th>MSI</th><th>EWC</th><th>世界赛</th></tr>${(S.history||[]).map(h=>`<tr><td>${h.year}</td><td>${h.lpl.map(teamTag).join(' ')}</td><td>${teamTag(h.fst)}</td><td>${teamTag(h.msi)}</td><td>${teamTag(h.ewc)}</td><td>${teamTag(h.worlds)}</td></tr>`).join('')}</table></section>`;
VIEWS.rules = () => `<section class="card"><h2>赛制说明（2026）</h2><p>✅ = 已从拳头官方/主流媒体核实；⚠️ = 未查到官方细则，游戏内为推测或简化。</p>
  ${['lpl_s1','fst','lpl_s2','msi','ewc','lpl_s3','lpl_rf','worlds'].map(k=>`<h3>${EVENT_INFO[k].name} <small>${EVENT_INFO[k].date} · ${EVENT_INFO[k].loc}</small></h3><p class="fmt">${esc(EVENT_INFO[k].fmt)}</p>`).join('')}
  <h3>BP规则</h3><p class="fmt">标准职业BP：禁3-选3（1-2-2-1）-禁2-选2。✅ 2026新规“先手选择权”：拥有选择权的一方选择蓝/红方或BP先后手，另一方获得剩余选项；系列赛中输掉上一局的一方获得下一局选择权。✅ 全程无畏征召：同一系列赛中任一方用过的英雄，双方都不能再选。</p>
  <h3>其他说明</h3><p class="fmt">⚠️ LPL首发外援上限2人为沿用往年规则的推测。✅ EWC卫冕冠军：Gen.G（EWC 2025冠军），之后赛季为上届冠军。⚠️ 其他赛区不进行逐场模拟，按战力+随机生成各赛段排名。⚠️ 选手能力值、潜力、身价均为游戏估算；部分小赛区名单（LCP、CBLOL）可信度较低，部分选手年龄为随机生成。虚构新秀为游戏生成的原创角色。</p></section>`;
VIEWS.sys = () => `<section class="card"><h2>存档</h2><p>游戏会在每场比赛后自动保存在浏览器本地。</p>
  <div class="btns"><button class="btn" data-a="export">导出存档</button><label class="btn ghost">导入存档<input type="file" id="imp" hidden></label><button class="btn ghost" data-a="reset">删除存档并重新开始</button></div></section>`;

// ================= 比赛（BP）界面 =================
function beginUserMatch(item){
  const m=item.m; const me = m.a===S.user?'A':'B';
  UI.match = { item, me, wa:0, wb:0, games:[], locked:[], chooser: m.hiSeed? m.hiSeed : (rnd()<0.5?'A':'B'), phase:'choose', draft:null, sel:null, roleSel:null, filter:'ALL', q:'' };
  if(UI.match.chooser!==me){ aiFirstChoice(); }
  render();
}
function aiFirstChoice(){ const M=UI.match; M.aiTook='first'; M.phase='choose'; }
function setupDraft(first, blue){ const M=UI.match; M.draft=newDraft(M.item.m.a, M.item.m.b, first, blue, M.locked); M.phase='draft'; M.sel=null; queueAI(); }
function queueAI(){ const M=UI.match; if(!M||M.phase!=='draft') return; const cur=draftSide(M.draft);
  if(!cur){ M.phase='ready'; render(); return; }
  if(cur.side!==M.me){ setTimeout(()=>{ if(UI.match!==M||M.phase!=='draft') return; const ch=aiChoose(M.draft); draftAct(M.draft,ch.c,ch.role); render(); queueAI(); }, 380); }
}
function matchScreen(){
  const M=UI.match, m=M.item.m; const opp = M.me==='A'?'B':'A';
  const head = `<div class="mh"><div>${teamTag(m.a,'big')} <span class="sc">${M.wa}</span></div><div class="mid">${esc(m.label)} · BO${m.bo}<br><small>第 ${M.games.length+1} 局 · 无畏征召已锁定 ${M.locked.length} 名英雄</small></div><div><span class="sc">${M.wb}</span> ${teamTag(m.b,'big')}</div></div>`;
  if(M.phase==='choose'){
    const mine = M.chooser===M.me;
    return `<div class="match">${head}<div class="card center">
      ${mine?`<h3>你拥有本局“先手选择权”</h3><p>选择阵营或BP顺序之一，对手获得剩余选项。</p>
        <div class="btns"><button class="btn" data-a="choose" data-c="blue">选择 蓝色方</button><button class="btn" data-a="choose" data-c="red">选择 红色方</button><button class="btn" data-a="choose" data-c="first">选择 BP先手</button><button class="btn" data-a="choose" data-c="second">选择 BP后手</button></div>`
      :`<h3>对手拥有先手选择权，已选择 BP先手</h3><p>请你选择阵营：</p><div class="btns"><button class="btn" data-a="chooseSide" data-c="blue">蓝色方</button><button class="btn" data-a="chooseSide" data-c="red">红色方</button></div>`}
      <div class="btns"><button class="btn ghost" data-a="autoSeries">自动模拟剩余系列赛</button></div></div></div>`;
  }
  const d=M.draft; const cur=draftSide(d); const un=unavailable(d);
  const side = s => { const key=d[s]; const lu=lineupMap(key); const isBlue=d.blue===s;
    return `<div class="dside ${isBlue?'blue':'red'} ${cur&&cur.side===s?'active':''}"><div class="dh">${teamTag(key)} ${isBlue?'蓝色方':'红色方'} · ${d.first===s?'BP先手':'BP后手'}</div>
      <div class="bans">${[0,1,2,3,4].map(i=>`<span class="ban">${d.bans[s][i]?champName(d.bans[s][i]):'禁'}</span>`).join('')}</div>
      ${ROLES.map(r=>{ const c=d.picks[s][r]; const p=lu[r]; const fit=c?champFit(p,c):null; return `<div class="pk ${c?'f':''}"><span class="r">${ROLE_CN[r]}</span><b>${p?esc(p.pid):'—'}</b><span class="c">${c?champName(c):''}${c?`<i class="${fit>=4?'g':fit>=1?'y':'r'}">${fit>=4?'招牌':fit>=1?'熟练':'生疏'}</i>`:''}</span></div>`; }).join('')}</div>`; };
  let center='';
  if(M.phase==='draft'){
    const myTurn = cur && cur.side===M.me;
    const mylu=lineupMap(d[M.me]); const opplu=lineupMap(d[opp]);
    const list=CHAMP_KEYS.filter(k=>(M.filter==='ALL'||CH[k].roles.includes(M.filter)) && (!M.q || (k+CH[k].cn).toLowerCase().includes(M.q.toLowerCase())));
    const hint = k => { const mine=ROLES.find(r=>mylu[r]&&mylu[r].champs.some(x=>x.c===k&&x.p>=3)); const theirs=ROLES.find(r=>opplu[r]&&opplu[r].champs.some(x=>x.c===k&&x.p>=5));
      return (mine?`<i class="hm">★${esc(mylu[mine].pid)}</i>`:'')+(theirs?`<i class="ho">⚠${esc(opplu[theirs].pid)}</i>`:''); };
    center = `<div class="dcenter"><div class="turn">${cur?`第 ${d.step+1}/20 步：${myTurn?'<b>轮到你</b>':'对手'}${cur.kind==='ban'?'禁用':'选择'}英雄`:''}</div>
      <div class="filters">${['ALL',...ROLES].map(r=>`<a class="${M.filter===r?'on':''}" data-a="dFilter" data-r="${r}">${r==='ALL'?'全部':ROLE_CN[r]}</a>`).join('')}<input data-d="q" placeholder="搜索英雄" value="${esc(M.q)}"></div>
      <div class="cgrid">${list.map(k=>{ const dis=un.has(k) || (myTurn && cur.kind==='pick' && !ROLES.some(r=>!d.picks[M.me][r]&&CH[k].roles.includes(r))); const locked=M.locked.includes(k); return `<div class="ch ${dis?'dis':''} ${M.sel===k?'sel':''}" ${dis||!myTurn?'':`data-a="dSel" data-c="${esc(k)}"`}>
        <div class="cn">${CH[k].cn}${S.meta[k]>=2?'🔥':S.meta[k]>=1?'↑':''}</div><small>${esc(k)}</small>${locked?'<em>无畏锁定</em>':''}${hint(k)}</div>`; }).join('')}</div>
      <div class="btns">${myTurn&&M.sel?`<button class="btn big" data-a="dLock">${cur.kind==='ban'?'确认禁用':'确认选择'}：${champName(M.sel)}</button>`:''}
        ${myTurn&&M.sel&&cur.kind==='pick'?roleChooser(d,M.me,M.sel):''}
        <button class="btn ghost" data-a="dAuto">自动完成本局BP</button><button class="btn ghost" data-a="autoSeries">自动模拟剩余系列赛</button></div></div>`;
  } else if(M.phase==='ready'){
    const e=evalDraft(d); const meP = M.me==='A'?e.pA:1-e.pA; const a=M.me==='A'?e.a:e.b, b=M.me==='A'?e.b:e.a;
    center = `<div class="dcenter center"><h3>BP完成</h3><p>我方阵容：<b>${STYLE_CN[a.comp.style]}</b> ${a.comp.notes.join('、')}；对方阵容：<b>${STYLE_CN[b.comp.style]}</b> ${b.comp.notes.join('、')}</p>
      <div class="prob"><div style="width:${Math.round(meP*100)}%"></div></div><p>赛前预测胜率：<b>${Math.round(meP*100)}%</b></p>
      <button class="btn big" data-a="playGame">开始对局 ▶</button></div>`;
  } else if(M.phase==='result'){
    const g=M.games[M.games.length-1]; const won=(g.w===M.me);
    const fin = Math.max(M.wa,M.wb)>=Math.ceil(m.bo/2);
    const box = s => `<table class="tbl"><tr><th></th><th>选手</th><th>英雄</th><th>K/D/A</th></tr>${(s==='A'?g.sa:g.sb).map(x=>`<tr><td>${ROLE_CN[x.r]}</td><td>${esc(x.pid||'')}${x.pid===g.mvp?' 🏅':''}</td><td>${champName(x.c)}</td><td>${x.k}/${x.d}/${x.a}</td></tr>`).join('')}</table>`;
    center = `<div class="dcenter center"><h2 class="${won?'g':'r'}">${won?'胜利！':'失败'}</h2><p>${g.dur}分钟 · 击杀 ${g.kA}:${g.kB} · MVP ${esc(g.mvp||'')}</p>
      <div class="cols">${box('A')}${box('B')}</div>
      ${fin?`<h3>系列赛结束：${teamTag(m.a)} ${M.wa}:${M.wb} ${teamTag(m.b)}</h3><button class="btn big" data-a="finishSeries">返回 ▶</button>`:`<button class="btn big" data-a="nextGame">下一局 ▶</button>`}</div>`;
  }
  return `<div class="match">${head}<div class="draft">${side('A')}${center}${side('B')}</div></div>`;
}
function roleChooser(d,side,c){
  const open=ROLES.filter(r=>!d.picks[side][r]&&CH[c].roles.includes(r)); if(open.length<=1) return '';
  const M=UI.match; const cur=M.roleSel&&open.includes(M.roleSel)?M.roleSel:bestRoleFor(d,side,c);
  return `<span class="rolesel">位置：${open.map(r=>`<a class="${r===cur?'on':''}" data-a="dRole" data-r="${r}">${ROLE_CN[r]}</a>`).join('')}</span>`;
}
function endUserGame(g){
  const M=UI.match; M.games.push(g); if(g.w==='A')M.wa++; else M.wb++;
  M.locked = M.locked.concat(Object.values(g.picks.A),Object.values(g.picks.B));
  M.chooser = g.w==='A'?'B':'A'; M.phase='result';
}

// ================= 交互 =================
const ACT = {
  view:d=>{ UI.view=d.v; UI.evSel=null; render(); },
  newgame:d=>{ newGame(d.k); save(); UI.view='home'; render(); },
  continue:()=>{ load(); render(); },
  closeModal:()=>{ UI.modal=null; UI.offerCash=null; UI.offerGive=null; render(); },
  endWindow:()=>{ curEvent().done=true; aiTransfers(4); advanceEvent(); save(); render(); },
  nextEvent:()=>{ advanceEvent(); save(); render(); },
  renew:d=>{ renewPlayer(d.p); save(); render(); },
  newSeason:()=>{ finishOffseason(); save(); render(); toast(`${S.year} 赛季开始！`); },
  toMyMatch:()=>{ if(lineupProblems(S.user).some(x=>x.startsWith('缺少'))){ toast('首发阵容不完整'); return; }
    const it=simUntilUser(false); save(); if(it && userInvolved(it.m)) beginUserMatch(it); else render(); },
  simStage:()=>{ startEvent(); const ev=curEvent(); const si=ev.si; let n=0; while(!ev.done && ev.si===si && n++<500){ const it=nextReadyMatch(); if(!it) break; if(userInvolved(it.m)){ simSeries(it.m,true); afterMatch(it.st,it.m);} else playAI(it); } save(); render(); },
  simEvent:()=>{ simUntilUser(true); save(); render(); },
  evSel:d=>{ UI.evSel=+d.i; render(); },
  showMatch:d=>{ UI.modal=matchDetail(d.m); render(); },
  autoLineup:()=>{ autoLineup(S.user); save(); render(); },
  setStarter:d=>{ T(S.user).lineup[d.r]=d.p; save(); render(); },
  sell:d=>{ UI.modal=sellModal(d.p,bidsFor(d.p)); render(); },
  acceptBid:d=>{ sellPlayer(d.p,d.t,+d.price); UI.modal=null; save(); render(); toast('出售成功'); },
  release:d=>{ UI.modal=()=>`<h3>确定与 ${esc(d.p)} 解约？</h3><p>需支付半年薪违约金（${fmtMoney(P(d.p).salary*0.5)}），选手将成为自由球员。</p><div class="btns"><button class="btn" data-a="doRelease" data-p="${esc(d.p)}">确定解约</button><button class="btn ghost" data-a="closeModal">取消</button></div>`; render(); },
  doRelease:d=>{ releasePlayer(d.p); UI.modal=null; save(); render(); },
  startEv:()=>{ startEvent(); save(); render(); },
  offer:d=>{ UI.offerCash=null; UI.offerGive=null; UI.modal=offerModal(d.p); render(); },
  doOffer:d=>{ const p=P(d.p); const cash=p.team?(UI.offerCash!=null?UI.offerCash:askPrice(p)):0; const r=makeOffer(d.p,cash,UI.offerGive||null); if(r.ok){ UI.modal=null; save(); } toast(r.msg); render(); },
  export:()=>{ UI.modal=()=>`<h3>导出存档</h3><p>复制下面的文本保存到本地文件（.json），以后可用“导入存档”恢复。</p><textarea id="expt" readonly style="width:100%;height:200px">${esc(JSON.stringify(S))}</textarea><div class="btns"><button class="btn" data-a="copyExp">复制</button><button class="btn ghost" data-a="dlExp">下载文件</button><button class="btn ghost" data-a="closeModal">关闭</button></div>`; render(); },
  copyExp:()=>{ const t=document.getElementById('expt'); navigator.clipboard.writeText(t.value).then(()=>toast('已复制'),()=>{ t.select(); toast('请手动复制选中的文本'); }); },
  dlExp:()=>{ try{ const b=new Blob([JSON.stringify(S)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`lol-manager-${S.year}.json`; a.click(); }catch(e){ toast('当前环境不支持下载，请用复制'); } },
  reset:()=>{ UI.modal=()=>`<h3>确定删除存档并重新开始？</h3><div class="btns"><button class="btn" data-a="doReset">确定删除</button><button class="btn ghost" data-a="closeModal">取消</button></div>`; render(); },
  doReset:()=>{ localStorage.removeItem(SAVE_KEY); S=null; UI.modal=null; render(); },
  // 比赛
  choose:d=>{ const M=UI.match, me=M.me, op=me==='A'?'B':'A';
    if(d.c==='blue'||d.c==='red'){ const blue = d.c==='blue'?me:op; setupDraft(op, blue); } // 对手选BP先手
    else { const first = d.c==='first'?me:op; setupDraft(first, op); } // 对手选蓝色方
    render(); },
  chooseSide:d=>{ const M=UI.match, me=M.me, op=me==='A'?'B':'A'; setupDraft(op, d.c==='blue'?me:op); render(); },
  dFilter:d=>{ UI.match.filter=d.r; render(); },
  dSel:d=>{ UI.match.sel=d.c; UI.match.roleSel=null; render(); },
  dRole:d=>{ UI.match.roleSel=d.r; render(); },
  dLock:()=>{ const M=UI.match; const cur=draftSide(M.draft); let role=null; if(cur.kind==='pick'){ const open=ROLES.filter(r=>!M.draft.picks[M.me][r]&&CH[M.sel].roles.includes(r)); role = M.roleSel&&open.includes(M.roleSel)?M.roleSel:null; }
    if(draftAct(M.draft,M.sel,role)){ M.sel=null; M.roleSel=null; render(); queueAI(); } else toast('该英雄无法选择（没有空余对应位置）'); },
  dAuto:()=>{ const M=UI.match; autoDraftRest(M.draft); M.phase='ready'; render(); },
  playGame:()=>{ const g=playGame(UI.match.draft); endUserGame(g); render(); },
  nextGame:()=>{ const M=UI.match; M.phase='choose'; M.draft=null; if(M.chooser!==M.me) aiFirstChoice(); render(); },
  autoSeries:()=>{ const M=UI.match; const m=M.item.m; const need=Math.ceil(m.bo/2);
    if(M.phase==='draft'||M.phase==='ready'){ autoDraftRest(M.draft); endUserGame(playGame(M.draft)); }
    while(M.wa<need&&M.wb<need){ const first=M.chooser, blue=first==='A'?'B':'A'; const d=newDraft(m.a,m.b,first,blue,M.locked); autoDraftRest(d); endUserGame(playGame(d)); }
    ACT.finishSeries(); },
  finishSeries:()=>{ const M=UI.match; const m=M.item.m; finishSeries(m,M.wa,M.wb,M.games,true); afterMatch(M.item.st,m);
    const won=m.w===S.user; addNews(`${won?'✅':'❌'} ${teamName(m.a)} ${M.wa}:${M.wb} ${teamName(m.b)}（${m.label}）`);
    UI.match=null; save(); render(); toast(won?'系列赛获胜！':'系列赛失利'); },
};
document.addEventListener('click', e=>{ const el=e.target.closest('[data-a]'); if(!el) return; const f=ACT[el.dataset.a]; if(f){ e.preventDefault(); f(el.dataset); } });
document.addEventListener('change', e=>{
  const el=e.target;
  if(el.dataset.f){ UI.mk[el.dataset.f] = el.type==='checkbox'? el.checked : el.value; render(); }
  if(el.dataset.o==='give'){ UI.offerGive=el.value; render(); }
  if(el.id==='imp' && el.files[0]){ el.files[0].text().then(t=>{ try{ S=JSON.parse(t); save(); render(); toast('导入成功'); }catch(x){ toast('存档格式错误'); } }); }
});
document.addEventListener('input', e=>{
  const el=e.target;
  if(el.dataset.f==='q'){ UI.mk.q=el.value; clearTimeout(UI._t); UI._t=setTimeout(()=>{ render(); const i=document.querySelector('[data-f=q]'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length);} },300); }
  if(el.dataset.d==='q'){ UI.match.q=el.value; clearTimeout(UI._t); UI._t=setTimeout(()=>{ render(); const i=document.querySelector('[data-d=q]'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length);} },250); }
  if(el.dataset.o==='cash'){ UI.offerCash=Math.max(0,+el.value||0); clearTimeout(UI._t); UI._t=setTimeout(()=>{ render(); const i=document.querySelector('[data-o=cash]'); if(i){ i.focus(); } },500); }
});
window.addEventListener('load', render);
