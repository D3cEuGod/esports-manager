// ================= 界面 =================
const UI = { view:'home', modal:null, match:null, evSel:null, mk:{region:'ALL',role:'ALL',q:'',sort:'rating',fa:false}, toast:null };
const SAVE_KEY='lolm_save_v1';
const $app = () => document.getElementById('app');
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){ console.warn(e); } }
function load(){ try{ const s=localStorage.getItem(SAVE_KEY); if(s){ S=migrateSave(JSON.parse(s)); return true; } }catch(e){} return false; }
function toast(t){ UI.toast=t; render(); setTimeout(()=>{ if(UI.toast===t){UI.toast=null; render();} },2800); }
const teamTag = (k,cls='') => { const t=T(k); if(!t) return '—'; return `<span class="tt ${cls} ${k===S.user?'me':''}" title="${esc(t.name)}"><b>${esc(t.short)}</b><i>${t.region}</i></span>`; };
const champName = c => c? (CH[c]?CH[c].cn:c) : '';
const ovrBadge = v => `<b class="ovr ${v>=88?'s':v>=80?'a':v>=72?'b':'c'}">${Math.round(v)}</b>`;
const transferOpen = () => { const ev=curEvent(); return ev.type==='window'||ev.type==='off'||(ev.type==='lpl_s1'&&!ev.started); };

// 后台尝试拉取最新 Data Dragon 版本号（失败/离线静默沿用内置 16.2.1）
(function refreshDDragon(){
  try{
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r=>r.ok?r.json():null)
      .then(v=>{ if(Array.isArray(v)&&v[0]){ window.DDRAGON_VER=v[0]; if(UI.match) render(); } })
      .catch(()=>{});
  }catch(e){}
})();

// LoL 风格位置 SVG 图标
const ROLE_SVG = {
  ALL:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>`,
  TOP:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h12l-3 3H7v6l-3 3V4z"/><path fill="currentColor" opacity=".35" d="M20 20H8l3-3h6v-6l3-3v12z"/></svg>`,
  JUG:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c2 4 3 7 1 11 2-2 4-4 6-6-1 5-3 9-7 13-4-4-6-8-7-13 2 2 4 4 6 6-2-4-1-7 1-11z"/></svg>`,
  MID:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.5 3.5 20.5 5.5 5.5 20.5 3.5 18.5z"/><path fill="currentColor" opacity=".32" d="M4 4h7L4 11V4zm16 16h-7l7-7v7z"/></svg>`,
  ADC:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" opacity=".35" d="M4 4h12l-3 3H7v6l-3 3V4z"/><path fill="currentColor" d="M20 20H8l3-3h6v-6l3-3v12z"/></svg>`,
  SUP:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4 15 9h5l-4 4 1.5 5L12 15.5 6.5 18 8 13 4 9h5z"/></svg>`
};

// 英雄头像（Riot Data Dragon CDN + 离线/失败无缝降级为海克斯首字徽章）
function champAvatar(c, cls=''){
  if(!c || !CH[c]) return `<div class="c-ava empty ${cls}"><span>?</span></div>`;
  const ch = CH[c];
  const hue = hash(c) % 360;
  const mono = ch.cn.slice(0,2);
  return `<div class="c-ava ${cls}" style="--h:${hue}">
    <img src="${champIconUrl(c)}" alt="${esc(ch.cn)}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <span class="c-fb" style="display:none">${esc(mono)}</span>
  </div>`;
}

// BP 视觉倒计时器（氛围用，不强制超时乱选）
let _bpTimer = null;
function resetBpClock(){
  if(_bpTimer){ clearInterval(_bpTimer); _bpTimer = null; }
  const M = UI.match;
  if(!M || M.phase!=='draft') return;
  M.clock = 30;
  _bpTimer = setInterval(()=>{
    if(!UI.match || UI.match!==M || M.phase!=='draft'){ clearInterval(_bpTimer); _bpTimer=null; return; }
    if(M.clock > 0){
      M.clock--;
      const num = document.getElementById('bp-clock-num');
      const bar = document.getElementById('bp-clock-fill');
      if(num){ num.textContent = String(M.clock).padStart(2,'0'); num.classList.toggle('urgent', M.clock<=5); }
      if(bar){ bar.style.width = (M.clock/30*100)+'%'; }
    }
  }, 1000);
}
function stopBpClock(){ if(_bpTimer){ clearInterval(_bpTimer); _bpTimer=null; } }

function render(){
  if(!S){ stopBpClock(); $app().innerHTML = startScreen(); return; }
  if(UI.match){ $app().innerHTML = matchScreen() + toastHtml(); return; }
  stopBpClock();
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
  const ovr = t => { const best={}; t.players.forEach(p=>{ if(!best[p.role]||best[p.role]<p.rating) best[p.role]=p.rating; }); return ROLES.reduce((s,r)=>s+(best[r]||45),0)/5; };
  return `<div class="start">
    <h1>峡谷经理人</h1><p class="sub">英雄联盟电竞经理 · 2026 赛季</p>
    ${has?`<button class="btn big" data-a="continue">继续存档</button>`:''}
    <h3>选择你要执掌的 LPL 战队</h3>
    <div class="tgrid">${lpl.map(t=>`<div class="tcard" data-a="newgame" data-k="${t.short}">
      <div class="tn">${esc(t.short)}</div><div class="tf">${esc(t.cn||t.name)}</div>
      <div class="tov">${Math.round(ovr(t))}<small>战力</small></div>
      <div class="tp">${t.players.filter(p=>!p.sub).map(p=>esc(p.id)).join(' · ')}</div></div>`).join('')}</div>
    <p class="note">选手名单整理自公开资料，部分队伍/能力值为估算，详见“赛制说明”。本游戏为粉丝向原创作品。</p>
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
    const exp=T(S.user).roster.map(P).filter(p=>p&&p.contract<=S.year);
    body=`<p>${S.year} 赛季结束。处理合同、转会后开始新赛季。</p>
      ${exp.length?`<h4>合同到期选手（不续约将离队）</h4><table class="tbl">${exp.map(p=>`<tr><td>${ROLE_CN[p.role]}</td><td><b>${esc(playerTag(p))}</b></td><td>${ovrBadge(p.rating)}</td><td>${p.age}岁</td><td>${p.renewed?'✅ 已续约':`<button class="btn sm" data-a="renew" data-p="${esc(p.pid)}">续约2年（年薪约 ${fmtMoney(fairSalary(p)*1.1)}）</button>`}</td></tr>`).join('')}</table>`:'<p>没有合同到期的选手。</p>'}
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
function probs(){ const p=lineupProblems(S.user); return p.length?`<p class="warn">⚠️ ${p.join('；')} —— 请到“阵容”调整后方可参赛</p>`:''; }
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
  const t=T(S.user); const ps=t.roster.map(P).filter(Boolean).sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)||b.rating-a.rating);
  const sal=ps.reduce((s,p)=>s+p.salary,0);
  return `<section class="card"><h2>${esc(t.name)} ${t.cn?`<small>${esc(t.cn)}</small>`:''}</h2>
   <p>战力 ${ovrBadge(teamOvr(S.user))} · 预算 ${fmtMoney(t.budget)} · 年薪总额 ${fmtMoney(sal)} · 首发外援 ${starters(S.user).filter(isForeign).length}/2</p>
   ${probs()}
   <div class="lineup">${ROLES.map(r=>{ const p=P(t.lineup[r]); return `<div class="slot"><div class="r">${ROLE_CN[r]}</div>${p?`<b>${esc(playerTag(p))}</b>${ovrBadge(p.rating+(p.form||0))}${p.role!==r?'<em>非本位</em>':''}`:'<em>空缺</em>'}</div>`; }).join('')}</div>
   <button class="btn sm ghost" data-a="autoLineup">自动最佳合规阵容</button>
   <table class="tbl roster"><tr><th>位置</th><th>选手</th><th>国籍</th><th>年龄</th><th>能力</th><th>状态</th><th>潜力</th><th>身价</th><th>年薪</th><th>合同至</th><th>英雄池</th><th></th></tr>
   ${ps.map(p=>{ const st=Object.entries(t.lineup).find(([r,id])=>id===p.pid); return `<tr>
     <td>${ROLE_CN[p.role]}</td><td><b>${esc(playerTag(p))}</b><br><small>${esc(p.name)}</small></td><td>${esc(p.nat)}${isForeign(p)?'<small class="fx">外援</small>':''}</td><td>${p.age}</td>
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
  if(f.q) ps=ps.filter(p=>(playerTag(p)+p.name+(p.team||'')).toLowerCase().includes(f.q.toLowerCase()));
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
  ${ps.slice(0,150).map(p=>`<tr><td><b>${esc(playerTag(p))}</b><br><small>${esc(p.name)}</small></td><td>${p.team?teamTag(p.team):'<i>自由球员</i>'}</td><td>${ROLE_CN[p.role]}</td><td>${esc(p.nat)}</td><td>${p.age}</td><td>${ovrBadge(p.rating)}</td><td>${p.pot}</td><td>${fmtMoney(playerValue(p))}</td><td>${p.team?fmtMoney(askPrice(p)):'—'}</td><td>${p.contract}</td>
   <td>${open?`<button class="btn sm" data-a="offer" data-p="${esc(p.pid)}">${p.team?'报价':'签约'}</button>`:''}</td></tr>`).join('')}</table>
   ${ps.length>150?'<p class="muted">仅显示前150人，请使用筛选。</p>':''}</section>`;
};
function offerModal(pid){
  return () => { const p=P(pid); const me=T(S.user);
    const cash = UI.offerCash!=null?UI.offerCash:(p.team?askPrice(p):0); const give=UI.offerGive||'';
    const e = p.team? evaluateOffer(pid,cash,give||null):null;
    const verdict = !e? '' : e.ratio>=1.05?'<b class="g">对方大概率接受</b>':e.ratio>=0.9?'<b class="y">有机会，对方在犹豫</b>':'<b class="r">对方很可能拒绝</b>';
    return `<h3>${p.team?'报价':'签约'}：${esc(playerTag(p))} <small>${ROLE_CN[p.role]} · ${p.team?teamTag(p.team):'自由球员'}</small></h3>
     <p>能力 ${ovrBadge(p.rating)} · 潜力 ${p.pot} · ${p.age}岁 · 身价 ${fmtMoney(playerValue(p))} · 预计年薪 ${fmtMoney(Math.max(p.salary,fairSalary(p)))}</p>
     ${p.team?`<label>转会费（万）：<input type="number" min="0" step="10" data-o="cash" value="${cash}"></label>
     <label>附加交换选手：<select data-o="give"><option value="">（不交换）</option>${me.roster.map(P).filter(Boolean).map(x=>`<option value="${esc(x.pid)}" ${give===x.pid?'selected':''}>${esc(playerTag(x))} · ${ROLE_CN[x.role]} · ${x.rating.toFixed(0)} · 身价${fmtMoney(playerValue(x))}</option>`).join('')}</select></label>
     <p>评估：${verdict}（报价价值 ${fmtMoney(e.offerVal)}）</p>`:'<p>自由球员可直接签约，无需转会费。</p>'}
     <div class="btns"><button class="btn" data-a="doOffer" data-p="${esc(pid)}">${p.team?'提交报价':'签约'}</button><button class="btn ghost" data-a="closeModal">取消</button></div>`; };
}
function sellModal(pid, bids){
  return () => `<h3>出售 ${esc(playerTag(P(pid)))}</h3>${bids.length?`<p>收到以下报价：</p><table class="tbl">${bids.map(b=>`<tr><td>${teamTag(b.t)}</td><td>${fmtMoney(b.price)}</td><td><button class="btn sm" data-a="acceptBid" data-p="${esc(pid)}" data-t="${b.t}" data-price="${b.price}">接受</button></td></tr>`).join('')}</table>`:'<p>暂时没有球队有能力或意愿报价。</p>'}
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
     ${m.gm.map((g,i)=>`<div class="gd"><b>第${i+1}局</b> 胜者 ${teamTag(g.w==='A'?m.a:m.b)} · ${g.dur}分钟 · 击杀 ${g.kA}:${g.kB}
       ${g.turA!=null?` · 推塔 ${g.turA}:${g.turB} · 小龙 ${g.dragA}:${g.dragB} · 大龙 ${g.baronA}:${g.baronB}`:''}
       · MVP ${esc(g.mvpTag||g.mvp||'')} · 蓝色方 ${teamTag(g.blue==='A'?m.a:m.b)}
       <div class="gp"><div>${teamTag(m.a)} ${ROLES.map(r=>champName(g.picks.A[r])).join(' / ')}<br><small>禁用：${g.bans.A.map(champName).join(' ')}</small></div>
       <div>${teamTag(m.b)} ${ROLES.map(r=>champName(g.picks.B[r])).join(' / ')}<br><small>禁用：${g.bans.B.map(champName).join(' ')}</small></div></div>
       ${g.events&&g.events.length?`<ul class="evlog-sm">${g.events.map(ev=>`<li><b>${esc(ev.t)}</b> ${esc(ev.text)}</li>`).join('')}</ul>`:''}
     </div>`).join('')}
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
  <h3>BP规则</h3><p class="fmt">标准职业BP：禁3-选3（1-2-2-1）-禁2-选2。✅ 2026新规“先手选择权”：拥有选择权的一方选择蓝/红方或BP先后手，另一方获得剩余选项；系列赛中输掉上一局的一方获得下一局选择权。✅ 全程无畏征召：同一系列赛中任一方用过的英雄，双方都不能再选。✅ 支持选人阶段与赛前点击己方槽位进行摇摆位互换。</p>
  <h3>其他说明</h3><p class="fmt">✅ LPL首发外援上限2人（赛前强制校验，AI 战队同样遵守）。✅ EWC卫冕冠军：Gen.G（EWC 2025冠军），之后赛季为上届冠军。⚠️ 其他赛区不进行逐场模拟，按战力+随机生成各赛段排名。⚠️ 选手能力值、潜力、身价均为游戏估算。</p></section>`;
VIEWS.sys = () => `<section class="card"><h2>存档</h2><p>游戏会在每场比赛后自动保存在浏览器本地。</p>
  <div class="btns"><button class="btn" data-a="export">导出存档</button><label class="btn ghost">导入存档<input type="file" id="imp" hidden></label><button class="btn ghost" data-a="reset">删除存档并重新开始</button></div></section>`;

// ================= 比赛（LoL 海克斯风格 BP）界面 =================
function beginUserMatch(item){
  const m=item.m; const me = m.a===S.user?'A':'B';
  UI.match = {
    item, me, wa:0, wb:0, games:[], locked:[],
    chooser: m.hiSeed? m.hiSeed : (rnd()<0.5?'A':'B'),
    phase:'choose', aiDec:null, draft:null,
    sel:null, roleSel:null, swapFrom:null,
    filter:'ALL', q:'', onlyAvail:false, showLocked:false, clock:30
  };
  if(UI.match.chooser!==me) aiFirstChoice();
  render();
}
function aiFirstChoice(){
  const M=UI.match, m=M.item.m, opp=M.me==='A'?'B':'A';
  M.aiDec = aiFirstDecision(m[opp==='A'?'a':'b'], m[M.me==='A'?'a':'b'], M.locked);
  M.phase='choose';
}
function setupDraft(first, blue){
  const M=UI.match;
  M.draft = newDraft(M.item.m.a, M.item.m.b, first, blue, M.locked);
  M.phase = 'draft'; M.sel = null; M.roleSel = null; M.swapFrom = null;
  resetBpClock();
  queueAI();
}
function queueAI(){
  const M=UI.match; if(!M||M.phase!=='draft') return;
  const cur=draftSide(M.draft);
  if(!cur){ stopBpClock(); M.phase='ready'; M.sel=null; render(); return; }
  resetBpClock();
  if(cur.side!==M.me){
    setTimeout(()=>{
      if(UI.match!==M||M.phase!=='draft') return;
      const nowCur = draftSide(M.draft);
      if(!nowCur || nowCur.side===M.me) return;
      const ch=aiChoose(M.draft);
      draftAct(M.draft, ch.c, ch.role, ch.offrole);
      if(nowCur.kind==='pick') optimizeAiFlex(M.draft, nowCur.side);
      render();
      queueAI();
    }, 520);
  }
}

// 计算当前 4 阶段索引（0=Ban1, 1=Pick1, 2=Ban2, 3=Pick2, 4=Done）
function draftPhaseIndex(step){
  if(step<6) return 0;
  if(step<12) return 1;
  if(step<16) return 2;
  if(step<20) return 3;
  return 4;
}

// 渲染单侧（蓝方左 / 红方右）5 个独立 Ban 槽（按 3 + 2 分组）
function renderBanRow(d, side, cur, isBlue){
  const bans = d.bans[side];
  const isMyBanTurn = cur && cur.kind==='ban' && cur.side===side;
  const activeIdx = isMyBanTurn ? bans.length : -1;
  const slotHtml = i => {
    const c = bans[i];
    const active = i === activeIdx;
    return `<div class="ban-slot ${c?'filled':''} ${active?'pulsing':''}" title="${c?esc(champName(c)):'待禁用'}">
      ${c ? `${champAvatar(c,'sm')}<div class="ban-slash"></div><span class="ban-lbl">${esc(champName(c))}</span>`
          : `<span class="ban-empty">${active?'BAN':(i+1)}</span>`}
    </div>`;
  };
  const group1 = `<div class="ban-grp">${[0,1,2].map(slotHtml).join('')}</div>`;
  const group2 = `<div class="ban-grp">${[3,4].map(slotHtml).join('')}</div>`;
  // 蓝方从左到右 1-2-3 | 4-5；红方镜像 5-4 | 3-2-1 贴近 LoL 原生对称
  return `<div class="ban-side ${isBlue?'blue':'red'} ${isMyBanTurn?'turn-ban':''}">
    ${isBlue ? `${group1}<i class="ban-sep"></i>${group2}` : `<div class="ban-grp">${[4,3].map(slotHtml).join('')}</div><i class="ban-sep"></i><div class="ban-grp">${[2,1,0].map(slotHtml).join('')}</div>`}
  </div>`;
}

// 渲染单侧（蓝方左 / 红方右）5 个大号 Pick 槽位 + 实时阵容情报
function renderSideColumn(M, d, side, cur, isBlue){
  const key = d[side];
  const lu = lineupMap(key);
  const isMe = side === M.me;
  const isMyPickTurn = cur && cur.kind==='pick' && cur.side===side;
  const canSwap = isMe && (M.phase==='draft' || M.phase==='ready') && Object.keys(d.picks[side]).length>=1;

  // 若轮到我 Pick 且已选中英雄，提前算出将落入哪个目标槽位做实时预览！
  let previewRole = null;
  if(isMe && isMyPickTurn && M.sel){
    const chk = canPickChamp(d, side, M.sel);
    if(chk.ok){
      previewRole = (M.roleSel && chk.openRoles.includes(M.roleSel)) ? M.roleSel : bestRoleFor(d, side, M.sel, chk.offrole);
    }
  } else if(isMyPickTurn){
    // 对手或未选中时，高亮第一个空缺位置作为视觉提示
    previewRole = openRolesFor(d, side)[0] || null;
  }

  const slotsHtml = ROLES.map(r=>{
    const p = lu[r];
    const c = d.picks[side][r];
    const isPreview = !c && isMyPickTurn && r===previewRole;
    const isSwapSrc = isMe && M.swapFrom===r;
    const isSwapTarget = isMe && M.swapFrom && M.swapFrom!==r;
    const fit = c ? champFit(p, c, r) : null;
    const offRole = c && !CH[c].roles.includes(r);
    const fitTag = !c ? '' : offRole
      ? `<span class="fit-badge bad">非本位</span>`
      : fit>=4.5 ? `<span class="fit-badge sig">招牌</span>`
      : fit>=1.5 ? `<span class="fit-badge ok">熟练</span>`
      : `<span class="fit-badge low">生疏</span>`;
    const swapAttr = canSwap && (c || M.swapFrom) ? `data-a="dSwap" data-r="${r}"` : '';

    return `<div class="pk-slot ${c?'locked':''} ${isPreview?'picking':''} ${isSwapSrc?'swap-src':''} ${isSwapTarget?'swap-dst':''} ${canSwap&&(c||M.swapFrom)?'swappable':''}" ${swapAttr} title="${canSwap?'点击可与同队其他位置互换摇摆位':''}">
      <div class="pk-ava-wrap">
        ${c ? champAvatar(c,'md')
            : (isPreview && isMe && M.sel) ? `${champAvatar(M.sel,'md preview')}<span class="preview-tag">待锁定</span>`
            : `<div class="c-ava empty md"><span class="role-ico">${ROLE_SVG[r]}</span></div>`}
      </div>
      <div class="pk-meta">
        <div class="pk-top">
          <span class="pk-role">${ROLE_SVG[r]}${ROLE_CN[r]}</span>
          <b class="pk-player">${p?esc(playerTag(p)):'—'}</b>
          ${p?`<span class="pk-ovr">${Math.round(effRating(p,r))}</span>`:''}
        </div>
        <div class="pk-bot">
          ${c ? `<span class="pk-champ">${esc(champName(c))}</span>${fitTag}`
              : (isPreview && isMe && M.sel) ? `<span class="pk-champ preview-txt">${esc(champName(M.sel))}...</span>`
              : isPreview ? `<span class="pk-waiting">正在选择…</span>`
              : `<span class="pk-idle">等待选人</span>`}
        </div>
      </div>
      ${isSwapSrc?'<span class="swap-pill">换位中</span>':''}
    </div>`;
  }).join('');

  // 实时阵容构成情报
  const pickedList = Object.values(d.picks[side]).filter(Boolean);
  const ci = compInfo(pickedList);
  const totalDmg = Math.max(1, ci.ad + ci.ap);
  const adPct = pickedList.length ? Math.round(ci.ad/totalDmg*100) : 50;
  const apPct = 100 - adPct;

  return `<aside class="hex-side ${isBlue?'blue':'red'} ${cur&&cur.side===side?(cur.kind==='ban'?'active-ban':'active-pick'):''}">
    <div class="side-head">
      <div class="side-id">
        <span class="side-badge ${isBlue?'blue':'red'}">${isBlue?'蓝色方 BLUE':'红色方 RED'}</span>
        <span class="ord-badge">${d.first===side?'BP先手':'BP后手'}</span>
      </div>
      <div class="side-team">${teamTag(key)} ${isMe?'<em class="me-pill">我方</em>':''}</div>
    </div>
    <div class="pk-list">${slotsHtml}</div>
    <div class="side-intel">
      <div class="intel-row">
        <span>伤害分布</span>
        <span><b class="c-ad">AD ${adPct}%</b> / <b class="c-ap">AP ${apPct}%</b></span>
      </div>
      <div class="dmg-bar"><i class="ad" style="width:${adPct}%"></i><i class="ap" style="width:${apPct}%"></i></div>
      <div class="intel-tags">
        ${pickedList.length?`<span class="style-chip">${STYLE_CN[ci.style]}体系</span>`:''}
        ${ci.notes.slice(0,2).map(n=>`<span class="note-chip ${/缺乏|纯/.test(n)?'warn':''}">${esc(n)}</span>`).join('')}
      </div>
      ${canSwap?`<div class="swap-hint">${M.swapFrom?`已选中 <b>${ROLE_CN[M.swapFrom]}</b>，点另一槽位互换（再点取消）`:'💡 点击己方槽位可摇摆换位'}</div>`:''}
    </div>
  </aside>`;
}

function matchScreen(){
  const M=UI.match, m=M.item.m; const opp = M.me==='A'?'B':'A';
  const d = M.draft;
  const cur = d ? draftSide(d) : null;

  // 永远保证蓝色方在左、红色方在右！（在选边阶段尚未确定蓝红时，先按 A 左 B 右显示）
  const leftSide  = d ? d.blue : 'A';
  const rightSide = leftSide==='A' ? 'B' : 'A';
  const leftTeam  = m[leftSide==='A'?'a':'b'];
  const rightTeam = m[rightSide==='A'?'a':'b'];
  const leftScore = leftSide==='A' ? M.wa : M.wb;
  const rightScore = rightSide==='A' ? M.wa : M.wb;

  const modeCls = M.phase==='draft' && cur
    ? (cur.kind==='ban' ? 'mode-ban' : 'mode-pick')
    : M.phase==='ready' ? 'mode-ready'
    : M.phase==='result' ? 'mode-result' : 'mode-choose';

  const phIdx = d ? draftPhaseIndex(d.step) : -1;
  const stepPills = ['禁用 Ⅰ','选择 Ⅰ','禁用 Ⅱ','选择 Ⅱ'].map((lb,idx)=>
    `<span class="ph-step ${idx<phIdx?'done':idx===phIdx?'cur':''} ${idx%2===0?'is-ban':'is-pick'}">${lb}</span>`
  ).join('');

  // 顶部职业转播 + 海克斯大屏顶栏
  const head = `<header class="mh-lol">
    <div class="mh-team left ${d?'is-blue':''}">
      <div class="mh-tmeta">${teamTag(leftTeam,'big')}${d?`<span class="side-mini blue">蓝色方 · ${d.first===leftSide?'先手':'后手'}</span>`:''}</div>
      <div class="mh-score">${leftScore}</div>
    </div>
    <div class="mh-center">
      <div class="mh-title">${esc(m.label)} · BO${m.bo} · 第 ${M.phase==='result'?M.games.length:M.games.length+1} 局</div>
      ${d?`<div class="ph-track">${stepPills}</div>`:''}
      <div class="fearless-row">
        <button class="fl-btn ${M.showLocked?'on':''}" data-a="toggleLocked">⛓ 无畏征召已锁 <b>${M.locked.length}</b> 名英雄 ${M.locked.length?(M.showLocked?'▲':'▼'):''}</button>
      </div>
    </div>
    <div class="mh-team right ${d?'is-red':''}">
      <div class="mh-score">${rightScore}</div>
      <div class="mh-tmeta">${teamTag(rightTeam,'big')}${d?`<span class="side-mini red">红色方 · ${d.first===rightSide?'先手':'后手'}</span>`:''}</div>
    </div>
  </header>
  ${M.showLocked && M.locked.length ? `<div class="fl-drawer">
    <div class="fl-drawer-hd">本系列赛无畏征召全局锁定池（双方均不可再选）：</div>
    <div class="fl-chips">${M.locked.map(c=>`<span class="fl-chip">${champAvatar(c,'xs')}<span>${esc(champName(c))}</span></span>`).join('')}</div>
  </div>` : ''}`;

  // -------- 阶段 1：2026 先手选择权 --------
  if(M.phase==='choose'){
    const mine = M.chooser===M.me;
    const dec = M.aiDec || {kind:'first', value:'first'};
    return `<div class="match hex ${modeCls}">${head}
      <div class="hex-panel choose-panel">
        <div class="hex-eyebrow">2026 职业赛事新规 · 先手选择权</div>
        ${mine ? `
          <h2>你拥有本局先手选择权</h2>
          <p class="hex-sub">你可以优先选择 <b>地图阵营</b> 或 <b>BP 顺位</b> 其中一项，对手将自动获得另一项的选择权。</p>
          <div class="choose-grid">
            <div class="choose-group">
              <h4>选择阵营（对手选 BP 先后手）</h4>
              <div class="choose-cards">
                <button class="hex-choice blue" data-a="choose" data-c="blue"><b>蓝色方</b><small>地图地形与视野略占优</small></button>
                <button class="hex-choice red" data-a="choose" data-c="red"><b>红色方</b><small>将 BP 顺位交由对手决定</small></button>
              </div>
            </div>
            <div class="choose-group">
              <h4>选择 BP 顺位（对手选蓝/红方）</h4>
              <div class="choose-cards">
                <button class="hex-choice gold" data-a="choose" data-c="first"><b>BP 先手</b><small>一楼抢版本 T0 核心英雄</small></button>
                <button class="hex-choice dark" data-a="choose" data-c="second"><b>BP 后手</b><small>拥有五楼康特 Counter 位</small></button>
              </div>
            </div>
          </div>`
        : dec.kind==='first' ? `
          <h2>对手拥有先手选择权，已抢占「BP 先手」</h2>
          <p class="hex-sub">请你选择本局的地图阵营：</p>
          <div class="choose-cards single">
            <button class="hex-choice blue" data-a="chooseSide" data-c="blue"><b>选择 蓝色方</b><small>拥有地图先手地形优势（推荐）</small></button>
            <button class="hex-choice red" data-a="chooseSide" data-c="red"><b>选择 红色方</b><small>在红方迎战对手一楼先抢</small></button>
          </div>`
        : `
          <h2>对手拥有先手选择权，已抢占「蓝色方」</h2>
          <p class="hex-sub">请你选择本局的 BP 顺位：</p>
          <div class="choose-cards single">
            <button class="hex-choice gold" data-a="chooseOrder" data-c="first"><b>选择 BP 先手</b><small>在红色方一楼抢下版本 T0</small></button>
            <button class="hex-choice dark" data-a="chooseOrder" data-c="second"><b>选择 BP 后手</b><small>拿到双选节奏与五楼康特位</small></button>
          </div>`}
        <div class="choose-foot">
          <button class="hex-btn ghost" data-a="autoSeries">跳过，自动模拟剩余系列赛</button>
        </div>
      </div>
    </div>`;
  }

  // -------- 顶部独立 Ban 栏 + 中央阶段横幅（固定左蓝右红） --------
  const myTurn = cur && cur.side===M.me;
  const actingIsBlue = cur && cur.side===leftSide;
  let bannerHtml = '';
  if(M.phase==='draft' && cur){
    const isBan = cur.kind==='ban';
    bannerHtml = `<div class="phase-banner ${isBan?'is-ban':'is-pick'} ${myTurn?'my-turn':'opp-turn'}">
      <div class="pb-dir ${actingIsBlue?'left':'right'}">${actingIsBlue?'◀ 蓝色方行动':'红色方行动 ▶'}</div>
      <div class="pb-main">
        <span class="pb-tag">${isBan?'⚔ 禁用阶段 · BAN':'✦ 选择阶段 · PICK'}</span>
        <b class="pb-msg">${myTurn ? (isBan?'轮到你禁用一名英雄':'轮到你选择一名英雄') : (isBan?`${teamName(d[cur.side])} 正在禁用…`:`${teamName(d[cur.side])} 正在选人…`)}</b>
      </div>
      <div class="pb-clock">
        <span id="bp-clock-num" class="${M.clock<=5?'urgent':''}">${String(M.clock).padStart(2,'0')}</span>
        <div class="pb-clock-bar"><i id="bp-clock-fill" style="width:${M.clock/30*100}%"></i></div>
      </div>
    </div>`;
  } else if(M.phase==='ready'){
    bannerHtml = `<div class="phase-banner is-ready">
      <div class="pb-main"><span class="pb-tag">✓ 阵容锁定完毕</span><b class="pb-msg">可点击两侧己方位置互换摇摆位，确认后进入召唤师峡谷</b></div>
    </div>`;
  } else {
    const g = M.games[M.games.length-1];
    const won = g && g.w===M.me;
    bannerHtml = `<div class="phase-banner is-result ${won?'win':'lose'}">
      <div class="pb-main"><span class="pb-tag">${won?'🏆 VICTORY':'💀 DEFEAT'}</span><b class="pb-msg">第 ${M.games.length} 局结束 · ${g?`${g.dur}分钟 · 击杀 ${leftSide==='A'?g.kA:g.kB} : ${leftSide==='A'?g.kB:g.kA}`:''}</b></div>
    </div>`;
  }

  const banBar = `<section class="ban-bar">
    ${renderBanRow(d, leftSide, cur, true)}
    ${bannerHtml}
    ${renderBanRow(d, rightSide, cur, false)}
  </section>`;

  // -------- 中央主舞台（BP英雄池 / Ready赛前分析 / Result战报） --------
  let center = '';
  const un = unavailable(d);
  const bannedSet = new Set([...d.bans.A, ...d.bans.B]);
  const pickedSet = new Set([...Object.values(d.picks.A), ...Object.values(d.picks.B)].filter(Boolean));
  const lockedSet = new Set(M.locked);

  if(M.phase==='draft'){
    const isBan = cur && cur.kind==='ban';
    const myLu = lineupMap(d[M.me]), oppLu = lineupMap(d[opp]);
    const suggestions = myTurn ? coachSuggest(d, M.me) : [];
    const offroleFallback = myTurn && !isBan && !hasAnyOnRoleChamp(d, M.me);

    const list = CHAMP_KEYS.filter(k=>{
      if(M.filter!=='ALL' && !CH[k].roles.includes(M.filter)) return false;
      if(M.q && !(k+CH[k].cn).toLowerCase().includes(M.q.toLowerCase())) return false;
      if(M.onlyAvail){
        if(un.has(k)) return false;
        if(myTurn && !isBan && !canPickChamp(d, M.me, k).ok) return false;
      }
      return true;
    }).sort((a,b)=>{
      // 可用排前、版本强势略靠前
      const da = un.has(a)?1:0, db = un.has(b)?1:0;
      if(da!==db) return da-db;
      return (S.meta[b]||0) - (S.meta[a]||0);
    });

    // 选中英雄详情与锁定台
    let selInfoHtml = `<div class="dock-empty">${myTurn ? (isBan?'请在上方英雄池点击一名英雄以禁用':'请在上方英雄池点击一名英雄以选择') : '等待对手完成本步操作…'}</div>`;
    if(myTurn && M.sel && CH[M.sel]){
      const ch = CH[M.sel];
      const rolePickHtml = !isBan ? roleChooser(d, M.me, M.sel) : '';
      let fitLine = '';
      if(isBan){
        const oppMatches = openRolesFor(d, opp).filter(r=>ch.roles.includes(r));
        const threat = oppMatches.map(r=>({r, p:oppLu[r], f:champFit(oppLu[r],M.sel,r)})).sort((a,b)=>b.f-a.f)[0];
        fitLine = threat ? `敌方威胁：${ROLE_CN[threat.r]} ${esc(playerTag(threat.p))}（${threat.f>=4.5?'招牌':threat.f>=1.5?'熟练':'一般'}）` : '对手该位置已锁定或非常规选位';
      } else {
        const chk = canPickChamp(d, M.me, M.sel);
        const r = (M.roleSel && chk.openRoles.includes(M.roleSel)) ? M.roleSel : bestRoleFor(d, M.me, M.sel, chk.offrole);
        const f = r ? champFit(myLu[r], M.sel, r) : -4;
        fitLine = r ? `分配给 ${ROLE_CN[r]} ${esc(playerTag(myLu[r]))} · ${!ch.roles.includes(r)?'⚠️ 跨位强选':f>=4.5?'★ 招牌英雄':f>=1.5?'熟练度良好':'较生疏'}` : '';
      }
      selInfoHtml = `<div class="dock-sel">
        ${champAvatar(M.sel,'sm')}
        <div class="dock-meta">
          <div class="dock-name"><b>${esc(ch.cn)}</b> <small>${esc(ch.k)} · ${ch.dmg} · ${ch.roles.map(r=>ROLE_CN[r]).join('/')}</small></div>
          <div class="dock-fit">${fitLine}</div>
          ${rolePickHtml}
        </div>
      </div>`;
    }

    center = `<section class="hex-center ${isBan?'stage-ban':'stage-pick'}">
      ${myTurn && suggestions.length ? `<div class="coach-bar">
        <span class="coach-lbl">${isBan?'教练建议禁用':'教练建议选择'}</span>
        <div class="coach-list">${suggestions.map(s=>`<button class="coach-chip ${M.sel===s.c?'sel':''}" data-a="dSel" data-c="${esc(s.c)}" ${s.role?`data-r="${s.role}"`:''}>
          ${champAvatar(s.c,'xs')}<span><b>${esc(champName(s.c))}</b><small>${esc(s.reason)}</small></span>
        </button>`).join('')}</div>
      </div>` : ''}

      <div class="pool-tools">
        <div class="role-tabs">${['ALL',...ROLES].map(r=>`<button class="rtab ${M.filter===r?'on':''}" data-a="dFilter" data-r="${r}" title="${r==='ALL'?'全部位置':ROLE_CN[r]}">${ROLE_SVG[r]}<span>${r==='ALL'?'全部':ROLE_CN[r]}</span></button>`).join('')}</div>
        <div class="pool-search">
          <label class="avail-chk"><input type="checkbox" data-d="avail" ${M.onlyAvail?'checked':''}> 只看可选</label>
          <input data-d="q" placeholder="搜索英雄中/英文…" value="${esc(M.q)}">
        </div>
      </div>

      ${offroleFallback?`<div class="fallback-tip">⚠️ 本位置常规英雄已在无畏征召中耗尽，已自动解锁跨位强选保底！</div>`:''}

      <div class="cgrid-lol">${list.map(k=>{
        const isLocked = lockedSet.has(k);
        const isBanned = bannedSet.has(k);
        const isPicked = pickedSet.has(k);
        const unavail = un.has(k);
        const cantPick = myTurn && !isBan && !canPickChamp(d, M.me, k).ok;
        const dis = unavail || cantPick;
        const sel = M.sel === k;
        const mineSig = ROLES.find(r=>!d.picks[M.me][r] && myLu[r] && myLu[r].champs.some(x=>x.c===k && x.p>=4));
        const oppSig  = ROLES.find(r=>!d.picks[opp][r] && oppLu[r] && oppLu[r].champs.some(x=>x.c===k && x.p>=5));
        const stamp = isLocked ? `<span class="c-stamp fl">无畏锁</span>`
                    : isBanned ? `<span class="c-stamp bn">已禁</span>`
                    : isPicked ? `<span class="c-stamp pk">已选</span>` : '';
        return `<div class="ch-card ${dis?'dis':''} ${sel?(isBan?'sel-ban':'sel-pick'):''}" ${dis||!myTurn?'':`data-a="dSel" data-c="${esc(k)}"`} title="${esc(CH[k].cn)} (${esc(k)}) · ${CH[k].roles.map(r=>ROLE_CN[r]).join('/')}">
          <div class="ch-thumb">
            ${champAvatar(k,'grid')}
            ${S.meta[k]>=2?'<span class="meta-dot t0" title="版本T0">🔥</span>':S.meta[k]>=1?'<span class="meta-dot t1" title="版本T1">↑</span>':''}
            ${mineSig?`<span class="sig-dot mine" title="我方 ${esc(playerTag(myLu[mineSig]))} 招牌">★</span>`:''}
            ${oppSig?`<span class="sig-dot opp" title="敌方 ${esc(playerTag(oppLu[oppSig]))} 招牌">⚠</span>`:''}
            ${stamp}
            ${sel && isBan ? '<div class="sel-overlay ban"><span>BAN</span></div>' : ''}
            ${sel && !isBan ? '<div class="sel-overlay pick"><span>PICK</span></div>' : ''}
          </div>
          <div class="ch-name">${esc(CH[k].cn)}</div>
        </div>`;
      }).join('')}</div>

      <div class="lock-dock">
        ${selInfoHtml}
        <div class="dock-actions">
          ${myTurn ? `<button class="lock-btn ${isBan?'is-ban':'is-pick'}" data-a="dLock" ${M.sel?'':'disabled'}>
            ${isBan ? (M.sel?`🚫 锁定禁用 · ${esc(champName(M.sel))}`:'请选择要禁用的英雄')
                    : (M.sel?`✓ 锁定选择 · ${esc(champName(M.sel))}`:'请选择要锁定的英雄')}
          </button>` : `<div class="ai-wait-pill">对手思考中…</div>`}
          <div class="dock-sub-btns">
            <button class="hex-btn sm ghost" data-a="dAuto">自动完成本局BP</button>
            <button class="hex-btn sm ghost" data-a="autoSeries">自动模拟剩余系列赛</button>
          </div>
        </div>
      </div>
    </section>`;

  } else if(M.phase==='ready'){
    const e = evalDraft(d);
    const leftE  = leftSide==='A' ? e.a : e.b;
    const rightE = rightSide==='A' ? e.a : e.b;
    const leftP  = Math.round((leftSide==='A' ? e.pA : 1-e.pA)*100);
    const rightP = 100 - leftP;
    const se = styleEdge(leftE.comp.style, rightE.comp.style);
    const curveBar = (label, lv, rv) => {
      const p = clamp(Math.round(sigmoid((lv-rv)/3.5)*100), 15, 85);
      return `<div class="curve-row"><span>${label}</span><div class="curve-bar"><i class="bl" style="width:${p}%"></i><i class="rd" style="width:${100-p}%"></i></div><span>${p}% / ${100-p}%</span></div>`;
    };
    center = `<section class="hex-center ready-stage">
      <h3>赛前阵容评估</h3>
      <div class="prob-box">
        <div class="prob-lbls"><span class="bl">${teamName(leftTeam)} <b>${leftP}%</b></span><small>预测胜率</small><span class="rd"><b>${rightP}%</b> ${teamName(rightTeam)}</span></div>
        <div class="prob-track"><div class="bl" style="width:${leftP}%"></div><div class="rd" style="width:${rightP}%"></div></div>
      </div>
      <div class="ready-compare">
        <div class="rc-card blue">
          <h4>${teamName(leftTeam)} · ${STYLE_CN[leftE.comp.style]}阵</h4>
          <p>${leftE.comp.notes.length?leftE.comp.notes.join(' · '):'均衡常规阵'}</p>
        </div>
        <div class="rc-vs">${se>0?'◀ 体系克制':se<0?'体系克制 ▶':'体系均势'}</div>
        <div class="rc-card red">
          <h4>${teamName(rightTeam)} · ${STYLE_CN[rightE.comp.style]}阵</h4>
          <p>${rightE.comp.notes.length?rightE.comp.notes.join(' · '):'均衡常规阵'}</p>
        </div>
      </div>
      <div class="curve-box">
        ${curveBar('前期对线 (0-14m)', leftE.early, rightE.early)}
        ${curveBar('中期资源 (14-24m)', leftE.mid, rightE.mid)}
        ${curveBar('后期团战 (25m+)', leftE.late, rightE.late)}
      </div>
      <p class="hex-sub">提示：开赛前仍可在侧栏点击己方两个槽位进行摇摆换位，胜率与熟练度将实时重算。</p>
      <div class="ready-actions">
        <button class="lock-btn is-pick big-go" data-a="playGame">⚔ 进入召唤师峡谷 · 开始对局</button>
      </div>
    </section>`;

  } else if(M.phase==='result'){
    const g = M.games[M.games.length-1];
    const won = g.w === M.me;
    const fin = Math.max(M.wa, M.wb) >= Math.ceil(m.bo/2);
    const lK = leftSide==='A'?g.kA:g.kB, rK = rightSide==='A'?g.kA:g.kB;
    const lTur = leftSide==='A'?g.turA:g.turB, rTur = rightSide==='A'?g.turA:g.turB;
    const lDrg = leftSide==='A'?g.dragA:g.dragB, rDrg = rightSide==='A'?g.dragA:g.dragB;
    const lBar = leftSide==='A'?g.baronA:g.baronB, rBar = rightSide==='A'?g.baronA:g.baronB;
    const gDiff = leftSide==='A' ? g.goldDiff : -g.goldDiff;

    const box = (side, isBlue) => {
      const rows = side==='A'?g.sa:g.sb;
      const totK = Math.max(1, side==='A'?g.kA:g.kB);
      return `<div class="res-team ${isBlue?'blue':'red'}">
        <div class="res-th">${teamTag(d[side])} <span>${g.w===side?'VICTORY':'DEFEAT'}</span></div>
        <table class="hex-tbl">
          <tr><th>位置</th><th>选手</th><th>英雄</th><th>K/D/A</th><th>参团</th></tr>
          ${rows.map(x=>{
            const kp = Math.min(100, Math.round((x.k+x.a)/totK*100));
            return `<tr class="${x.pid===g.mvp?'is-mvp':''}">
              <td>${ROLE_CN[x.r]}</td>
              <td><b>${esc(x.tag||x.pid||'')}</b>${x.pid===g.mvp?' <span class="mvp-b">MVP</span>':''}</td>
              <td class="td-ch">${champAvatar(x.c,'xs')}<span>${esc(champName(x.c))}</span></td>
              <td class="td-kda">${x.k}/${x.d}/${x.a}</td>
              <td>${kp}%</td>
            </tr>`;
          }).join('')}
        </table>
      </div>`;
    };

    center = `<section class="hex-center result-stage">
      <div class="res-hero ${won?'win':'lose'}">
        <h2>${won?'VICTORY · 胜利':'DEFEAT · 失利'}</h2>
        <div class="res-objs">
          <span>⏱ ${g.dur} 分钟</span>
          <span>⚔ 击杀 ${lK} : ${rK}</span>
          <span>🏰 防御塔 ${lTur} : ${rTur}</span>
          <span>🐉 小龙 ${lDrg} : ${rDrg}</span>
          <span>👾 大龙 ${lBar} : ${rBar}</span>
          <span>💰 经济差 ${gDiff>=0?teamName(leftTeam):teamName(rightTeam)} +${Math.abs(gDiff).toFixed(1)}k</span>
        </div>
      </div>

      <div class="res-tables">
        ${box(leftSide, true)}
        ${box(rightSide, false)}
      </div>

      ${g.events&&g.events.length ? `<div class="timeline-box">
        <h4>对局关键时间轴</h4>
        <ul class="ev-timeline">${g.events.map(ev=>`<li class="${ev.side===leftSide?'blue':'red'}">
          <span class="ev-t">${esc(ev.t)}</span>
          <span class="ev-tag">${esc(ev.tag||'事件')}</span>
          <span class="ev-txt">${esc(ev.text)}</span>
        </li>`).join('')}</ul>
      </div>` : ''}

      ${g.impacts&&g.impacts.length ? `<div class="impact-box">
        ${g.impacts.map(s=>`<span class="imp-chip">✦ ${esc(s)}</span>`).join('')}
      </div>` : ''}

      <div class="ready-actions">
        ${fin
          ? `<div class="series-fin">系列赛结束：${teamTag(m.a)} <b>${M.wa} : ${M.wb}</b> ${teamTag(m.b)}</div>
             <button class="lock-btn is-pick" data-a="finishSeries">确认赛果并返回 ▶</button>`
          : `<button class="lock-btn is-pick" data-a="nextGame">进入第 ${M.games.length+1} 局（无畏征召累计锁定 ${M.locked.length} 人）▶</button>`}
      </div>
    </section>`;
  }

  return `<div class="match hex ${modeCls}">
    ${head}
    ${banBar}
    <div class="draft-lol">
      ${renderSideColumn(M, d, leftSide, cur, true)}
      ${center}
      ${renderSideColumn(M, d, rightSide, cur, false)}
    </div>
  </div>`;
}

function roleChooser(d, side, c){
  const chk = canPickChamp(d, side, c);
  const open = chk.openRoles;
  if(open.length<=1) return '';
  const M=UI.match;
  const cur = M.roleSel && open.includes(M.roleSel) ? M.roleSel : bestRoleFor(d, side, c, chk.offrole);
  return `<div class="rolesel-lol"><span>分配位置：</span>${open.map(r=>`<button class="rs-btn ${r===cur?'on':''}" data-a="dRole" data-r="${r}">${ROLE_CN[r]}</button>`).join('')}</div>`;
}

function endUserGame(g){
  const M=UI.match; M.games.push(g); if(g.w==='A')M.wa++; else M.wb++;
  M.locked = M.locked.concat(Object.values(g.picks.A),Object.values(g.picks.B)).filter(Boolean);
  M.chooser = g.w==='A'?'B':'A'; M.phase='result'; M.swapFrom=null;
  stopBpClock();
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
  toMyMatch:()=>{
    const ps = lineupProblems(S.user);
    if(ps.length){ toast('无法开赛：'+ps.join('；')); return; }
    const it=simUntilUser(false); save(); if(it && userInvolved(it.m)) beginUserMatch(it); else render();
  },
  simStage:()=>{
    const ps = lineupProblems(S.user);
    if(ps.length){ toast('请先修复阵容问题：'+ps.join('；')); return; }
    startEvent(); const ev=curEvent(); const si=ev.si; let n=0;
    while(!ev.done && ev.si===si && n++<500){ const it=nextReadyMatch(); if(!it) break; if(userInvolved(it.m)){ simSeries(it.m,true); afterMatch(it.st,it.m);} else playAI(it); }
    save(); render();
  },
  simEvent:()=>{
    const ps = lineupProblems(S.user);
    if(ps.length){ toast('请先修复阵容问题：'+ps.join('；')); return; }
    simUntilUser(true); save(); render();
  },
  evSel:d=>{ UI.evSel=+d.i; render(); },
  showMatch:d=>{ UI.modal=matchDetail(d.m); render(); },
  autoLineup:()=>{ autoLineup(S.user); save(); render(); },
  setStarter:d=>{ T(S.user).lineup[d.r]=d.p; save(); render(); },
  sell:d=>{ UI.modal=sellModal(d.p,bidsFor(d.p)); render(); },
  acceptBid:d=>{ sellPlayer(d.p,d.t,+d.price); UI.modal=null; save(); render(); toast('出售成功'); },
  release:d=>{ UI.modal=()=>`<h3>确定与 ${esc(playerTag(P(d.p)))} 解约？</h3><p>需支付半年薪违约金（${fmtMoney(P(d.p).salary*0.5)}），选手将成为自由球员。</p><div class="btns"><button class="btn" data-a="doRelease" data-p="${esc(d.p)}">确定解约</button><button class="btn ghost" data-a="closeModal">取消</button></div>`; render(); },
  doRelease:d=>{ releasePlayer(d.p); UI.modal=null; save(); render(); },
  startEv:()=>{ startEvent(); save(); render(); },
  offer:d=>{ UI.offerCash=null; UI.offerGive=null; UI.modal=offerModal(d.p); render(); },
  doOffer:d=>{ const p=P(d.p); const cash=p.team?(UI.offerCash!=null?UI.offerCash:askPrice(p)):0; const r=makeOffer(d.p,cash,UI.offerGive||null); if(r.ok){ UI.modal=null; save(); } toast(r.msg); render(); },
  export:()=>{ UI.modal=()=>`<h3>导出存档</h3><p>复制下面的文本保存到本地文件（.json），以后可用“导入存档”恢复。</p><textarea id="expt" readonly style="width:100%;height:200px">${esc(JSON.stringify(S))}</textarea><div class="btns"><button class="btn" data-a="copyExp">复制</button><button class="btn ghost" data-a="dlExp">下载文件</button><button class="btn ghost" data-a="closeModal">关闭</button></div>`; render(); },
  copyExp:()=>{ const t=document.getElementById('expt'); navigator.clipboard.writeText(t.value).then(()=>toast('已复制'),()=>{ t.select(); toast('请手动复制选中的文本'); }); },
  dlExp:()=>{ try{ const b=new Blob([JSON.stringify(S)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`lol-manager-${S.year}.json`; a.click(); }catch(e){ toast('当前环境不支持下载，请用复制'); } },
  reset:()=>{ UI.modal=()=>`<h3>确定删除存档并重新开始？</h3><div class="btns"><button class="btn" data-a="doReset">确定删除</button><button class="btn ghost" data-a="closeModal">取消</button></div>`; render(); },
  doReset:()=>{ localStorage.removeItem(SAVE_KEY); S=null; UI.modal=null; render(); },
  // ---- 比赛 / BP 交互 ----
  toggleLocked:()=>{ if(UI.match){ UI.match.showLocked=!UI.match.showLocked; render(); } },
  choose:d=>{
    const M=UI.match, m=M.item.m, me=M.me, op=me==='A'?'B':'A';
    const opKey = m[op==='A'?'a':'b'], meKey = m[me==='A'?'a':'b'];
    if(d.c==='blue'||d.c==='red'){
      const blue = d.c==='blue'?me:op;
      const aiOrd = aiSecondDecision(opKey, meKey, 'side', M.locked);
      const first = aiOrd==='first' ? op : me;
      toast(`对手选择了 ${aiOrd==='first'?'BP先手':'BP后手'}`);
      setupDraft(first, blue);
    } else {
      const first = d.c==='first'?me:op;
      const aiSide = aiSecondDecision(opKey, meKey, 'first', M.locked);
      const blue = aiSide==='blue' ? op : me;
      toast(`对手选择了 ${aiSide==='blue'?'蓝色方':'红色方'}`);
      setupDraft(first, blue);
    }
    render();
  },
  chooseSide:d=>{ const M=UI.match, me=M.me, op=me==='A'?'B':'A'; setupDraft(op, d.c==='blue'?me:op); render(); },
  chooseOrder:d=>{ const M=UI.match, me=M.me, op=me==='A'?'B':'A'; setupDraft(d.c==='first'?me:op, op); render(); },
  dFilter:d=>{ UI.match.filter=d.r; render(); },
  dSel:d=>{ UI.match.sel=d.c; UI.match.roleSel=d.r||null; render(); },
  dRole:d=>{ UI.match.roleSel=d.r; render(); },
  dSwap:d=>{
    const M=UI.match; if(!M||!M.draft) return;
    if(!M.swapFrom){
      if(!M.draft.picks[M.me][d.r]) return;
      M.swapFrom = d.r; render(); return;
    }
    if(M.swapFrom === d.r){ M.swapFrom = null; render(); return; }
    if(swapDraftRoles(M.draft, M.me, M.swapFrom, d.r)){
      toast(`已交换 ${ROLE_CN[M.swapFrom]} 与 ${ROLE_CN[d.r]} 英雄`);
    }
    M.swapFrom = null; render();
  },
  dLock:()=>{
    const M=UI.match; if(!M||!M.sel) return;
    const cur=draftSide(M.draft); if(!cur || cur.side!==M.me) return;
    let role=null, allowOff=false;
    if(cur.kind==='pick'){
      const chk = canPickChamp(M.draft, M.me, M.sel);
      allowOff = chk.offrole;
      role = M.roleSel && chk.openRoles.includes(M.roleSel) ? M.roleSel : null;
    }
    if(draftAct(M.draft, M.sel, role, allowOff)){
      M.sel=null; M.roleSel=null; M.swapFrom=null;
      render(); queueAI();
    } else toast('该英雄无法选择（没有空余对应位置）');
  },
  dAuto:()=>{ const M=UI.match; stopBpClock(); autoDraftRest(M.draft); M.phase='ready'; M.sel=null; M.swapFrom=null; render(); },
  playGame:()=>{ const g=playGame(UI.match.draft); endUserGame(g); render(); },
  nextGame:()=>{ const M=UI.match; M.phase='choose'; M.draft=null; M.sel=null; M.swapFrom=null; M.aiDec=null; if(M.chooser!==M.me) aiFirstChoice(); render(); },
  autoSeries:()=>{
    const M=UI.match; const m=M.item.m; const need=Math.ceil(m.bo/2);
    stopBpClock();
    if(M.phase==='draft'||M.phase==='ready'){ autoDraftRest(M.draft); endUserGame(playGame(M.draft)); }
    while(M.wa<need&&M.wb<need){
      const other = M.chooser==='A'?'B':'A';
      const dec = aiFirstDecision(m[M.chooser==='A'?'a':'b'], m[other==='A'?'a':'b'], M.locked);
      const first = dec.kind==='first' ? M.chooser : other;
      const blue  = dec.kind==='side'  ? M.chooser : other;
      const d=newDraft(m.a,m.b,first,blue,M.locked); autoDraftRest(d); endUserGame(playGame(d));
    }
    ACT.finishSeries();
  },
  finishSeries:()=>{
    const M=UI.match; const m=M.item.m;
    stopBpClock();
    finishSeries(m,M.wa,M.wb,M.games,true); afterMatch(M.item.st,m);
    const won=m.w===S.user; addNews(`${won?'✅':'❌'} ${teamName(m.a)} ${M.wa}:${M.wb} ${teamName(m.b)}（${m.label}）`);
    UI.match=null; save(); render(); toast(won?'系列赛获胜！':'系列赛失利');
  },
};
document.addEventListener('click', e=>{ const el=e.target.closest('[data-a]'); if(!el) return; const f=ACT[el.dataset.a]; if(f){ e.preventDefault(); f(el.dataset); } });
document.addEventListener('change', e=>{
  const el=e.target;
  if(el.dataset.f){ UI.mk[el.dataset.f] = el.type==='checkbox'? el.checked : el.value; render(); }
  if(el.dataset.d==='avail' && UI.match){ UI.match.onlyAvail = el.checked; render(); }
  if(el.dataset.o==='give'){ UI.offerGive=el.value; render(); }
  if(el.id==='imp' && el.files[0]){ el.files[0].text().then(t=>{ try{ S=migrateSave(JSON.parse(t)); save(); render(); toast('导入成功'); }catch(x){ toast('存档格式错误'); } }); }
});
document.addEventListener('input', e=>{
  const el=e.target;
  if(el.dataset.f==='q'){ UI.mk.q=el.value; clearTimeout(UI._t); UI._t=setTimeout(()=>{ render(); const i=document.querySelector('[data-f=q]'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length);} },300); }
  if(el.dataset.d==='q' && UI.match){ UI.match.q=el.value; clearTimeout(UI._t); UI._t=setTimeout(()=>{ render(); const i=document.querySelector('[data-d=q]'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length);} },220); }
  if(el.dataset.o==='cash'){ UI.offerCash=Math.max(0,+el.value||0); clearTimeout(UI._t); UI._t=setTimeout(()=>{ render(); const i=document.querySelector('[data-o=cash]'); if(i){ i.focus(); } },500); }
});
window.addEventListener('load', render);
