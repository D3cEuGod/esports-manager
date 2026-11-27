// ================= 界面 =================
const UI = { view:'home', modal:null, match:null, evSel:null, mk:{region:'ALL',role:'ALL',q:'',sort:'rating',fa:false,hideLock:true}, offTab:'patch', trainPid:null, toast:null, hasSave:false, savePreview:null, authBusy:false, entry:'gate', authTab:'login', pickTeam:false, verifyEmail:null, resendCd:0, setTab:'replays', db:{region:null, team:null} };
let _resendTimer = null;
function startResendCd(sec){
  if(_resendTimer){ clearInterval(_resendTimer); _resendTimer=null; }
  UI.resendCd = sec;
  _resendTimer = setInterval(()=>{
    if(UI.resendCd > 0){
      UI.resendCd--;
      const btn = document.getElementById('btn-resend-otp');
      if(btn){ btn.textContent = UI.resendCd>0 ? `重新发送 (${UI.resendCd}s)` : '重新发送验证码'; btn.disabled = UI.resendCd>0 || UI.authBusy; }
    } else { clearInterval(_resendTimer); _resendTimer=null; }
  }, 1000);
}
const SAVE_KEY='lolm_save_v1';
const $app = () => document.getElementById('app');
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function save(){
  if(!S) return;
  try{
    S._sync = makeSyncStamp();
    const txt = JSON.stringify(S);
    UI.hasSave = true;
    UI.savePreview = makeSaveSummary(S);
    StorageBridge.writeSaveText(txt);
    CloudSync.schedulePush(S);
  }catch(e){ console.warn(e); }
}
async function load(){
  try{
    const txt = await StorageBridge.readSaveText();
    if(txt){ S = migrateSave(JSON.parse(txt)); UI.hasSave = true; UI.savePreview = makeSaveSummary(S); return true; }
  }catch(e){ console.warn(e); }
  return false;
}
function toast(t){ UI.toast=t; render(); setTimeout(()=>{ if(UI.toast===t){UI.toast=null; render();} },3000); }
const teamTag = (k,cls='') => { const t=T(k); if(!t) return '—'; return `<span class="tt ${cls} ${k===S.user?'me':''}" title="${esc(t.name)}"><b>${esc(t.short)}</b><i>${t.region}</i></span>`; };
const champName = c => c? (CH[c]?CH[c].cn:c) : '';
const ovrBadge = v => `<b class="ovr ${v>=88?'s':v>=80?'a':v>=72?'b':'c'}">${Math.round(v)}</b>`;

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

// 统一矢量 SVG 图标库（全站提示 / 对局资源 / 化学反应 / 赛事状态，替代生硬 emoji）
window.ICONS = {
  gold:     `<path fill="currentColor" d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.31 0 6 1.12 6 2s-2.69 2-6 2-6-1.12-6-2 2.69-2 6-2zm0 14c-3.31 0-6-1.12-6-2v-2.2c1.46.97 3.63 1.5 6 1.5s4.54-.53 6-1.5V17c0 .88-2.69 2-6 2zm0-5c-3.31 0-6-1.12-6-2V9.8c1.46.97 3.63 1.5 6 1.5s4.54-.53 6-1.5V12c0 .88-2.69 2-6 2z"/>`,
  tower:    `<path fill="currentColor" d="M5 3h3v3h2V3h4v3h2V3h3v6l-2 2v8h2v2H5v-2h2v-8L5 9V3zm5 16h4v-5h-4v5z"/>`,
  dragon:   `<path fill="currentColor" d="M21 5c-2.6.5-4.7 1.8-6.2 3.7L12 6l-2.8 2.7C7.7 6.8 5.6 5.5 3 5c.6 3.2 2.3 5.7 5 7.2L6.5 19l5.5-2.8L17.5 19 16 12.2c2.7-1.5 4.4-4 5-7.2z"/>`,
  baron:    `<path fill="currentColor" d="M4 17l-2-9 5 4 5-7 5 7 5-4-2 9H4zm2 2h12v2H6v-2z"/>`,
  grub:     `<path fill="currentColor" d="M12 3a4 4 0 0 1 4 4v1.5l3 1.5-1 2-2-.8v1.8l2.5 1.3-1 2L15 15.2A4 4 0 0 1 9 15.2l-2.5 1.1-1-2L8 13v-1.8l-2 .8-1-2 3-1.5V7a4 4 0 0 1 4-4z"/>`,
  sword:    `<path fill="currentColor" d="M19.5 3.5L20.5 4.5 13 12l2.5 2.5-1.5 1.5-2.5-2.5-3.2 3.2 1.2 1.2-1.5 1.5-2.2-2.2-1.8 1.8-1-1 1.8-1.8-2.2-2.2 1.5-1.5 1.2 1.2 3.2-3.2L7 8l1.5-1.5L11 9l7.5-7.5z"/>`,
  shield:   `<path fill="currentColor" d="M12 2L4 5v6c0 5.2 3.4 9.9 8 11 4.6-1.1 8-5.8 8-11V5l-8-3z"/>`,
  chem:     `<path fill="currentColor" d="M9.5 6A3.5 3.5 0 1 0 9.5 13a3.4 3.4 0 0 0 2.02-.67l1.82 1.82A3.4 3.4 0 0 0 12.5 16.5a3.5 3.5 0 1 0 3.5-3.5 3.4 3.4 0 0 0-1.45.32l-1.88-1.88A3.46 3.46 0 0 0 13 9.5a3.5 3.5 0 0 0-.32-1.45l2.3-2.3A2.5 2.5 0 1 0 13.7 4.4l-2.25 2.25A3.46 3.46 0 0 0 9.5 6zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>`,
  crown:    `<path fill="currentColor" d="M3 18h18v2H3v-2zm0-2L5 7l4.5 4L12 5l2.5 6L19 7l2 9H3z"/>`,
  flame:    `<path fill="currentColor" d="M13.5 2.5c.4 2.8-1.6 4.7-1.6 6.8 0 1.2.8 2.1 1.9 2.1 1.5 0 2.4-1.5 2.5-3.3 2.1 1.7 3.2 4.1 3.2 6.6A7.5 7.5 0 0 1 12 22a7.5 7.5 0 0 1-7.5-7.5c0-4.4 3.5-7.4 9-12z"/>`,
  bolt:     `<path fill="currentColor" d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>`,
  lock:     `<path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V7z"/>`,
  globe:    `<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-3.1a15 15 0 0 0-1.2-5 8 8 0 0 1 4.3 5zM12 4.1c1 1.3 1.8 3.6 2 6.9h-4c.2-3.3 1-5.6 2-6.9zM9.4 6A15 15 0 0 0 8.2 11H5.1a8 8 0 0 1 4.3-5zM5.1 13h3.1a15 15 0 0 0 1.2 5 8 8 0 0 1-4.3-5zm6.9 6.9c-1-1.3-1.8-3.6-2-6.9h4c-.2 3.3-1 5.6-2 6.9zm2.6-1.9a15 15 0 0 0 1.2-5h3.1a8 8 0 0 1-4.3 5z"/>`,
  transfer: `<path fill="currentColor" d="M7 7h10l-3-3 1.4-1.4L20.8 8l-5.4 5.4L14 12l3-3H7V7zm10 10H7l3 3-1.4 1.4L3.2 16l5.4-5.4L10 12l-3 3h10v2z"/>`,
  trophy:   `<path fill="currentColor" d="M18 4V2H6v2H2v4c0 2.5 1.8 4.6 4.2 5 .6 1.5 1.9 2.7 3.8 3v3H7v2h10v-2h-3v-3c1.9-.3 3.2-1.5 3.8-3 2.4-.4 4.2-2.5 4.2-5V4h-4zM4 8V6h2v4.8C4.8 10.4 4 9.3 4 8zm16 0c0 1.3-.8 2.4-2 2.8V6h2v2z"/>`,
  target:   `<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-13a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>`,
  patch:    `<path fill="currentColor" d="M19.4 7.3l-2.7-2.7-1.8 1.8L12 3.5 9.5 6l2.9 2.9-7.9 7.9 2.7 2.7 7.9-7.9L18 14.5l2.5-2.5-2.9-2.9 1.8-1.8z"/>`,
  news:     `<path fill="currentColor" d="M4 4h14v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4zm2 2v12h10V6H6zm2 2h6v2H8V8zm0 4h6v2H8v-2zm0 4h4v2H8v-2zm12-9h2v11a2 2 0 0 1-2 2v-13z"/>`,
  cloud:    `<path fill="currentColor" d="M19.3 10.1A7 7 0 0 0 6 8.2 5 5 0 0 0 6 18h13a4 4 0 0 0 .3-7.9z"/>`,
  update:   `<path fill="currentColor" d="M12 3v10l4-4 1.4 1.4L12 15.8 6.6 10.4 8 9l4 4V3h0zM5 18h14v2H5v-2z"/>`,
  warn:     `<path fill="currentColor" d="M12 3L2 20h20L12 3zm-1 6h2v5h-2V9zm0 7h2v2h-2v-2z"/>`,
  check:    `<path fill="currentColor" d="M9.5 16.6L4.8 12l1.4-1.4 3.3 3.2 8.3-8.3 1.4 1.4-9.7 9.7z"/>`,
  ban:      `<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 0 1 6.3 3.1L7.1 18.3A8 8 0 0 1 12 4zm0 16a8 8 0 0 1-6.3-3.1L16.9 5.7A8 8 0 0 1 12 20z"/>`,
  pick:     `<path fill="currentColor" d="M12 2l3.2 6.8L22 12l-6.8 3.2L12 22l-3.2-6.8L2 12l6.8-3.2L12 2z"/>`,
  chain:    `<path fill="currentColor" d="M10.6 13.4a3.5 3.5 0 0 1 0-5l2.5-2.5a3.5 3.5 0 0 1 5 5l-1.4 1.4-1.4-1.4 1.4-1.4a1.5 1.5 0 0 0-2.1-2.1L12 10a1.5 1.5 0 0 0 0 2.1l-1.4 1.3zm2.8-2.8a3.5 3.5 0 0 1 0 5l-2.5 2.5a3.5 3.5 0 0 1-5-5l1.4-1.4 1.4 1.4-1.4 1.4a1.5 1.5 0 0 0 2.1 2.1L12 14a1.5 1.5 0 0 0 0-2.1l1.4-1.3z"/>`,
  play:     `<path fill="currentColor" d="M8 5v14l11-7z"/>`,
  pause:    `<path fill="currentColor" d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/>`,
  skip:     `<path fill="currentColor" d="M4 5l9 7-9 7V5zm10 0l7 5.5V5h2v14h-2v-5.5L14 19V5z"/>`,
  tab:      `<path fill="currentColor" d="M3 4h18v16H3V4zm2 4v10h14V8H5zm2 2h4v2H7v-2zm6 0h4v2h-4v-2zm-6 4h4v2H7v-2zm6 0h4v2h-4v-2z"/>`,
  up:       `<path fill="currentColor" d="M12 4l7 7h-4v9H9v-9H5l7-7z"/>`,
  down:     `<path fill="currentColor" d="M12 20l-7-7h4V4h6v9h4l-7 7z"/>`,
  user:     `<path fill="currentColor" d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 10c4.4 0 8 2 8 4.5V20H4v-1.5C4 16 7.6 14 12 14z"/>`,
  clock:    `<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 11H8v-2h3V6h2v7z"/>`,
};
window.ico = (name, cls='') => ICONS[name] ? `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>` : '';

// LoL 原版风格独立过场动画层（直接挂载在 body，严格 1 秒后强制销毁，绝不因重绘卡住）
let _splashTimer = null;
function clearBpSplash(){
  if(_splashTimer){ clearTimeout(_splashTimer); _splashTimer = null; }
  if(typeof document !== 'undefined' && document.getElementById){
    const old = document.getElementById('bp-splash-layer');
    if(old && old.remove) old.remove();
  }
}
function triggerBpSplash(kind, phIdx){
  if(typeof document === 'undefined' || !document.body || !document.createElement) return;
  clearBpSplash();
  const isBan = kind === 'ban';
  const roundLbl = phIdx <= 1 ? '第一轮' : '第二轮';
  const el = document.createElement('div');
  el.id = 'bp-splash-layer';
  el.className = `bp-splash ${isBan ? 'ban' : 'pick'}`;
  el.innerHTML = `<div class="bps-slash"></div><div class="bps-beam"></div><div class="bps-core">
    <span class="bps-sub">${roundLbl} · ${isBan ? 'BAN PHASE' : 'PICK PHASE'}</span>
    <b>${ico(isBan ? 'ban' : 'pick', 'lg')} ${isBan ? '进入禁用阶段' : '进入英雄选择'}</b>
  </div>`;
  document.body.appendChild(el);
  _splashTimer = setTimeout(clearBpSplash, 1020);
}
// Ban / Pick 锁定瞬时打击感闪光（0.45 秒自动销毁）
function triggerLockFlash(kind, champKey){
  if(typeof document === 'undefined' || !document.body || !document.createElement) return;
  const old = document.getElementById('bp-lock-fx');
  if(old && old.remove) old.remove();
  const el = document.createElement('div');
  el.id = 'bp-lock-fx';
  el.className = `bp-lock-fx ${kind === 'ban' ? 'ban' : 'pick'}`;
  const cn = champName(champKey);
  el.innerHTML = `<div class="blf-ring"></div><div class="blf-tag">${ico(kind==='ban'?'ban':'pick')} ${kind==='ban'?'已禁用':'已锁定'} · ${esc(cn)}</div>`;
  document.body.appendChild(el);
  setTimeout(()=>{ if(el && el.remove) el.remove(); }, 460);
}

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

// BP 倒计时器：归零时自动采用已预选或教练推荐首选项，不再停在 00 秒
let _bpTimer = null;
function autoLockOnTimeout(M, boundDraft, boundStep){
  if(!M || M.phase!=='draft' || !M.draft || M.clockAi) return;
  if(boundDraft && (M.draft!==boundDraft || boundDraft.step!==boundStep)) return;
  const d = M.draft, cur = draftSide(d);
  if(!cur || cur.side !== M.me) return;
  const un = unavailable(d);
  let pickC = null, pickR = null, allowOff = false;
  if(M.sel && CH[M.sel] && !un.has(M.sel)){
    if(cur.kind === 'ban'){ pickC = M.sel; }
    else {
      const chk = canPickChamp(d, M.me, M.sel);
      if(chk.ok){
        pickC = M.sel; allowOff = chk.offrole;
        pickR = M.roleSel && chk.openRoles.includes(M.roleSel) ? M.roleSel : bestRoleFor(d, M.me, M.sel, allowOff);
      }
    }
  }
  if(!pickC){
    const sug = coachSuggest(d, M.me);
    if(sug && sug.length){
      pickC = sug[0].c; pickR = sug[0].role || null;
      allowOff = cur.kind==='pick' ? canPickChamp(d, M.me, pickC).offrole : false;
    } else {
      const ai = aiChoose(d);
      pickC = ai.c; pickR = ai.role || null; allowOff = !!ai.offrole;
    }
  }
  if(pickC && draftAct(d, pickC, pickR, allowOff)){
    M.sel = null; M.roleSel = null; M.swapFrom = null;
    triggerLockFlash(cur.kind, pickC);
    toast(`倒计时结束，已自动${cur.kind==='ban'?'禁用':'选择'}推荐英雄「${champName(pickC)}」`);
    queueAI();
    render();
  }
}
// 顶部时钟：玩家回合 30 秒（归零自动锁定）；对手回合显示 AI 思考倒计时（归零不做任何玩家操作）
// 绑定 match + draft + step：换步、换局、退出后旧时钟自行失效
function resetBpClock(sec, ai){
  if(_bpTimer){ clearInterval(_bpTimer); _bpTimer = null; }
  const M = UI.match;
  if(!M || M.phase!=='draft' || !M.draft) return;
  const d = M.draft, step = d.step;
  const total = typeof sec==='number' ? Math.max(0, sec) : 30;
  M.clock = total; M.clockMax = total || 1; M.clockAi = !!ai;
  if(total <= 0) return;
  const h = setInterval(()=>{
    if(UI.match!==M || M.phase!=='draft' || M.draft!==d || d.step!==step){ clearInterval(h); if(_bpTimer===h) _bpTimer=null; return; }
    if(M.clock > 0){
      M.clock--;
      const num = typeof document!=='undefined' && document.getElementById ? document.getElementById('bp-clock-num') : null;
      const bar = typeof document!=='undefined' && document.getElementById ? document.getElementById('bp-clock-fill') : null;
      if(num){ num.textContent = String(M.clock).padStart(2,'0'); num.classList.toggle('urgent', !ai && M.clock<=5); }
      if(bar){ bar.style.width = (M.clock/M.clockMax*100)+'%'; }
      if(M.clock === 0){
        clearInterval(h); if(_bpTimer===h) _bpTimer = null;
        if(!ai) autoLockOnTimeout(M, d, step);
      }
    }
  }, 1000);
  _bpTimer = h;
}
// 对手 BP 思考：每次禁用 / 选择各约 AI_DRAFT_WAIT_MS（引擎未提供时兜底 5000ms），到点用深思考选择锁定
const AI_DRAFT_WAIT_FALLBACK_MS = 5000;
function aiDraftWaitMs(){
  return (typeof AI_DRAFT_WAIT_MS==='number' && isFinite(AI_DRAFT_WAIT_MS) && AI_DRAFT_WAIT_MS>=0) ? AI_DRAFT_WAIT_MS : AI_DRAFT_WAIT_FALLBACK_MS;
}
let _aiDraftTimer = null, _aiDraftKey = null;
function cancelAiDraft(){
  if(_aiDraftTimer) clearTimeout(_aiDraftTimer);
  _aiDraftTimer = null; _aiDraftKey = null;
}
function stopBpClock(){ if(_bpTimer){ clearInterval(_bpTimer); _bpTimer=null; } cancelAiDraft(); clearBpSplash(); }

function cloudPillHtml(){
  const st = CloudSync.status;
  if(st==='reauth') return `<button class="cloud-pill guest" data-a="openAccount">${ico('cloud')} <b>重新登录</b><small>进度已存本地</small></button>`;
  if(CloudSync.isLoggedIn()){
    const label = CloudSync.conflict ? '待处理存档差异' : st==='offline' ? '离线(已存本地)' : '云端已同步';
    return `<button class="cloud-pill ${st}" data-a="openAccount" title="${esc(CloudSync.auth.user.email)} · ${label}">${ico('cloud')} <b>${esc(CloudSync.auth.user.email.split('@')[0])}</b><small data-cloud-status aria-live="polite">${label}</small></button>`;
  }
  return `<button class="cloud-pill guest" data-a="openAccount" title="登录账号以开启多平台进度云同步">${ico('user')} <b>游客模式</b><small>云同步</small></button>`;
}
function notifyCloudStatus(label){
  const status = document.querySelector('[data-cloud-status]');
  if(status && status.textContent!==label) status.textContent = label;
}
function updateBannerHtml(){
  const u = typeof AppUpdater !== 'undefined' && AppUpdater.available;
  if(!u || UI.hideUpdateBanner) return '';
  return `<div class="upd-banner">
    <span>${ico('update')} 发现云端新版本 <b>v${esc(u.version)}</b>${u.notes ? ` · ${esc(u.notes)}` : ''}</span>
    <div class="upd-acts">
      <a class="btn sm" href="${esc(u.url)}" target="_blank" rel="noopener">前往下载更新</a>
      <button class="btn sm ghost" data-a="dismissUpdate">稍后提醒</button>
    </div>
  </div>`;
}

function openConflictModal(){
  if(!CloudSync.conflict) return;
  const { localSummary: L, cloudSummary: C } = CloudSync.conflict;
  UI.modal = () => `<h3>☁️ 检测到多端存档进度差异</h3>
    <p class="muted">账号 <b>${esc(CloudSync.auth&&CloudSync.auth.user?CloudSync.auth.user.email:'')}</b> 的本地存档与云端存档不一致，请选择要保留的一份（不会自动误覆盖）：</p>
    <div class="conflict-grid">
      <div class="cf-card">
        <div class="cf-hd">💻 当前设备本地存档</div>
        <div>战队：<b>${esc(L.team)}</b> · <b>${L.year}</b> 赛季</div>
        <div>进度：${esc(L.event||'进行中')}</div>
        <div><small>设备：${esc(L.device||'当前设备')}</small></div>
        <div><small>时间：${esc(fmtTime(L.updatedAt))}</small></div>
        <button class="btn" data-a="resolveConflict" data-c="local">使用本地并覆盖云端</button>
      </div>
      <div class="cf-card cloud">
        <div class="cf-hd">☁️ 云端最新存档</div>
        <div>战队：<b>${esc(C.team)}</b> · <b>${C.year}</b> 赛季</div>
        <div>进度：${esc(C.event||'进行中')}</div>
        <div><small>设备：${esc(C.device||'其他设备')}</small></div>
        <div><small>时间：${esc(fmtTime(C.updatedAt))}</small></div>
        <button class="btn big" data-a="resolveConflict" data-c="cloud">加载云端存档</button>
      </div>
    </div>`;
  render();
}

// 后台重绘（云同步状态、toast 等）时保住正在输入的表单焦点与光标，避免输入被打断
function focusKey(el){
  if(!el || el===document.body || !el.closest || !el.closest('#app')) return null;
  for(const a of ['o','f','d']) if(el.dataset && el.dataset[a]!=null) return `[data-${a}="${el.dataset[a]}"]`;
  return el.id ? '#'+CSS.escape(el.id) : null;
}
function render(){
  const ae=document.activeElement, fk=focusKey(ae);
  let sel=null; if(fk){ try{ sel=[ae.selectionStart, ae.selectionEnd]; }catch(x){} }
  const modalScroll = (document.querySelector('.modal')||{}).scrollTop||0;
  renderApp();
  const md=document.querySelector('.modal'); if(md && modalScroll) md.scrollTop=modalScroll;
  if(fk){ const el=document.querySelector(fk); if(el && el!==document.activeElement){ el.focus({preventScroll:true}); if(sel && sel[0]!=null){ try{ el.setSelectionRange(sel[0],sel[1]); }catch(x){} } } }
  if(typeof Celebrate!=='undefined') Celebrate.check();
}
function renderApp(){
  if(!S){ stopBpClock(); Watch.stop(); $app().innerHTML = startScreen() + (UI.modal?`<div class="mask" data-a="closeModal"></div><div class="modal">${UI.modal()}</div>`:'') + toastHtml(); return; }
  if(UI.replay){ $app().innerHTML = replayScreen() + toastHtml(); Watch.afterRender(); return; }
  if(UI.match){ $app().innerHTML = matchScreen() + toastHtml(); Watch.afterRender(); return; }
  stopBpClock(); Watch.stop();
  const me=T(S.user);
  const ev=curEvent();
  const chem = teamChemistry(S.user);
  $app().innerHTML = `
  <header class="top">
    <div class="brand">峡谷经理人</div>
    <div class="hinfo"><div><small>战队</small>${teamTag(S.user)}</div><div><small>赛季</small><b>${S.year}</b></div><div><small>当前</small><b>${esc((eventInfo(ev)||{}).name||'')}</b></div><div><small>默契</small><b class="chem-top ${chem.cls}">${ico('chem')} ${chem.score}</b></div><div><small>预算</small><b>${fmtMoney(me.budget)}</b></div>${cloudPillHtml()}</div>
  </header>
  ${updateBannerHtml()}
  <nav class="tabs">${[['home','主页'],['roster','阵容'],['market','转会'],['events','赛事'],['db','资料库'],['meta','版本'],['news','资讯'],['settings','设置']].map(([k,n])=>`<a data-a="view" data-v="${k}" class="${UI.view===k?'on':''}">${n}</a>`).join('')}</nav>
  <main>${(VIEWS[UI.view]||VIEWS.home)()}</main>
  ${UI.modal?`<div class="mask" data-a="closeModal"></div><div class="modal">${UI.modal()}</div>`:''}
  ${toastHtml()}`;
}
const toastHtml = () => UI.toast?`<div class="toast">${esc(UI.toast)}</div>`:'';

// ---------- 第 1 屏：登录 / 游客独立门户；第 2 屏：继续存档 / 选择战队 ----------
function startScreen(){
  const has = UI.hasSave || !!UI.savePreview;
  if(UI.entry === 'gate'){
    const isReg = UI.authTab === 'register';
    const logged = CloudSync.isLoggedIn();
    return `<div class="gate-wrap">
      <div class="gate-card">
        <div class="gate-brand">
          <span class="gate-eyebrow">2026 SEASON · ${esc(detectPlatformLabel())}</span>
          <h1>峡谷经理人</h1>
          <p class="gate-sub">英雄联盟职业电竞经理</p>
        </div>
        ${logged ? `
          <div class="gate-logged">
            <div class="gate-user-line">☁️ 已登录账号：<b>${esc(CloudSync.auth.user.email)}</b></div>
            <p class="gate-tip">${esc(CloudSync.statusText)}</p>
            <div class="gate-btns">
              <button class="gate-primary" data-a="enterLobby">进入游戏 ▶</button>
              <button class="gate-secondary" data-a="cloudSignOut">切换账号</button>
            </div>
          </div>`
        : UI.verifyEmail ? `
          <div class="gate-otp">
            <div class="otp-badge">📧 邮箱验证</div>
            <p class="gate-hint" style="margin-bottom:12px">验证码已发送至 <b>${esc(UI.verifyEmail)}</b><br>请直接在下方输入邮件中的数字验证码（无需跳转网页）</p>
            <div class="gate-form">
              <input id="auth-otp" class="otp-input" type="text" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="输入邮箱验证码">
              <button class="gate-primary" data-a="cloudVerifyOtp" ${UI.authBusy?'disabled':''}>${UI.authBusy?'验证中…':'验证并登录 ▶'}</button>
            </div>
            <div class="otp-actions">
              <button id="btn-resend-otp" class="gate-secondary" data-a="cloudResendOtp" ${UI.authBusy||UI.resendCd>0?'disabled':''}>${UI.resendCd>0?`重新发送 (${UI.resendCd}s)`:'重新发送验证码'}</button>
              <button class="gate-secondary" data-a="cancelOtp">← 返回修改邮箱</button>
            </div>
          </div>`
        : `
          <div class="gate-tabs">
            <button class="${!isReg?'on':''}" data-a="authTab" data-t="login">账号登录</button>
            <button class="${isReg?'on':''}" data-a="authTab" data-t="register">注册新账号</button>
          </div>
          <div class="gate-form">
            <input id="auth-email" type="email" autocomplete="username" placeholder="输入邮箱地址">
            <input id="auth-pass" type="password" autocomplete="${isReg?'new-password':'current-password'}" placeholder="${isReg?'设置密码（至少 6 位）':'输入密码'}">
            ${isReg?`<input id="auth-pass2" type="password" autocomplete="new-password" placeholder="再次输入密码以确认">`:''}
            <button class="gate-primary" data-a="${isReg?'cloudSignUp':'cloudSignIn'}" ${UI.authBusy?'disabled':''}>${UI.authBusy?'请稍候…':(isReg?'发送邮箱验证码并注册':'登录并同步云端进度')}</button>
            <p class="gate-hint">${isReg?'注册后可在 Windows、Mac 与手机端自动互通存档。':'同一账号在任意设备登录，进度自动无缝衔接。'}</p>
          </div>
          <div class="gate-div"><span>或</span></div>
          <button class="gate-guest" data-a="enterGuest">以游客模式游玩（仅存本地） ▶</button>
          <p class="gate-foot">游客模式可完全离线游玩，进入游戏后随时可登录账号绑定进度。</p>`}
      </div>
    </div>`;
  }

  // 第 2 屏：存档入口 / 14 支 LPL 战队选择
  const lpl = ROSTER.LPL.teams;
  const ovr = t => { const best={}; t.players.forEach(p=>{ if(!best[p.role]||best[p.role]<p.rating) best[p.role]=p.rating; }); return ROLES.reduce((s,r)=>s+(best[r]||45),0)/5; };
  const pv = UI.savePreview;
  const showTeamGrid = !has || UI.pickTeam;

  return `<div class="start">
    <div class="start-top">
      <div>
        <h1>峡谷经理人</h1>
        <p class="sub">${CloudSync.isLoggedIn()?`☁️ 账号：${esc(CloudSync.auth.user.email)}`:'👤 游客模式（本地存档）'} · ${esc(detectPlatformLabel())}</p>
      </div>
      <div class="btns" style="margin:0">
        <button class="btn ghost sm" data-a="backToGate">← 返回登录页</button>
      </div>
    </div>
    ${has && !UI.pickTeam ? `
      <section class="card resume-card">
        <div class="resume-info">
          <div class="resume-eyebrow">检测到已有进度</div>
          <h2>${pv?`${esc(pv.team)} · ${pv.year} 赛季`:'已保存的经理档案'}</h2>
          <p class="muted">${pv?`${esc(pv.event||'赛季进行中')} · 上次保存 ${esc(fmtTime(pv.updatedAt))}`:'点击下方按钮立即继续执教'}</p>
        </div>
        <div class="btns">
          <button class="btn big" data-a="continue">继续当前存档 ▶</button>
          <button class="btn ghost" data-a="showNewTeam">重新选择战队开新档</button>
        </div>
      </section>` : ''}
    ${showTeamGrid ? `
      <div class="pick-hd">
        <h3>选择你要执掌的 LPL 战队</h3>
        ${has?`<button class="btn sm ghost" data-a="cancelNewTeam">返回继续旧存档</button>`:''}
      </div>
      <div class="tgrid">${lpl.map(t=>`<div class="tcard" data-a="newgame" data-k="${t.short}">
        <div class="tn">${esc(t.short)}</div><div class="tf">${esc(t.cn||t.name)}</div>
        <div class="tov">${Math.round(ovr(t))}<small>战力</small></div>
        <div class="tp">${t.players.filter(p=>!p.sub).map(p=>esc(p.id)).join(' · ')}</div></div>`).join('')}</div>
      <p class="note">选手名单整理自公开资料，部分队伍/能力值为估算，详见“赛制说明”。本游戏为粉丝向原创作品。</p>` : ''}
  </div>`;
}

// ---------- 主页（随当前事件动态切换，单焦点清爽版） ----------
const VIEWS = {};

function renderOffseasonHome(){
  const np = ensureNextPatch();
  const me = T(S.user);
  const roster = me.roster.map(P).filter(Boolean).sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)||b.rating-a.rating);
  const exp = roster.filter(p=>p.contract<=S.year);
  const tab = UI.offTab || 'patch';
  const selPid = (UI.trainPid && P(UI.trainPid) && P(UI.trainPid).team===S.user) ? UI.trainPid : (roster[0] ? roster[0].pid : null);
  const selPl = selPid ? P(selPid) : null;

  let pane = '';
  if(tab === 'patch'){
    pane = `<div class="patch-preview">
      <div class="pp-intro">新赛季 <b>${esc(np.ver)}</b> 版本改动前瞻已公布！你可以根据下方英雄加强方向，切到「🎯 选手英雄池特训」定向安排冬训。</div>
      <div class="cols">
        <div class="pp-col buff">
          <h4>⬆️ 新版本重点加强英雄</h4>
          <ul class="pp-list">${np.buffs.map(b=>`<li>
            ${champAvatar(b.c,'xs')}
            <div class="pp-txt">
              <b>${esc(champName(b.c))}</b> <span class="pp-tag up">${b.to>=2?'晋升 T0 🔥':'晋升 T1 ↑'}</span> <small>${CH[b.c].roles.map(r=>ROLE_CN[r]).join('/')}</small>
              <div class="pp-desc">${esc(b.desc)}</div>
            </div>
          </li>`).join('')}</ul>
        </div>
        <div class="pp-col nerf">
          <h4>⬇️ 新版本回调削弱英雄</h4>
          <ul class="pp-list">${np.nerfs.map(n=>`<li>
            ${champAvatar(n.c,'xs')}
            <div class="pp-txt">
              <b>${esc(champName(n.c))}</b> <span class="pp-tag dn">强度下调</span> <small>${CH[n.c].roles.map(r=>ROLE_CN[r]).join('/')}</small>
              <div class="pp-desc">${esc(n.desc)}</div>
            </div>
          </li>`).join('')}</ul>
        </div>
      </div>
    </div>`;
  } else if(tab === 'train'){
    const targets = selPl ? (selPl.trainTargets || []) : [];
    const candChamps = selPl ? CHAMP_KEYS.slice().sort((a,b)=>{
      const ar = CH[a].roles.includes(selPl.role)?1:0, br = CH[b].roles.includes(selPl.role)?1:0;
      if(ar!==br) return br-ar;
      return (np.meta[b]||0) - (np.meta[a]||0);
    }) : [];
    pane = `<div class="train-panel">
      <p class="muted">为每位选手指定最多 <b>2 名</b> 休赛期重点练习英雄，开启新赛季时对应熟练度将大幅提升（标记 🔥/↑ 的为下版本加强英雄）。</p>
      <div class="train-layout">
        <div class="train-roster">${roster.map(p=>{
          const ts = p.trainTargets || [];
          return `<button class="tr-pl ${p.pid===selPid?'on':''}" data-a="selTrainPid" data-p="${esc(p.pid)}">
            <div><small>${ROLE_CN[p.role]}</small> <b>${esc(playerTag(p))}</b></div>
            <div class="tr-tags">${ts.length ? ts.map(c=>`<span>🎯 ${esc(champName(c))}</span>`).join('') : '<i class="muted">未指定</i>'}</div>
          </button>`;
        }).join('')}</div>
        ${selPl ? `<div class="train-picker">
          <div class="tp-hd">
            <b>${esc(playerTag(selPl))}（${ROLE_CN[selPl.role]}）当前英雄池：</b>
            <div class="pool">${(selPl.champs||[]).map(c=>{ const ti=proTier(selPl,c.c); return `<span class="pl-${ti.cls}">${ti.icon?ti.icon+' ':''}${esc(champName(c.c))}·${ti.name}</span>`; }).join('')}</div>
          </div>
          <div class="tp-sub">点选冬训目标英雄（已选 ${targets.length}/2）：</div>
          <div class="train-cgrid">${candChamps.slice(0, 42).map(k=>{
            const on = targets.includes(k);
            const m = np.meta[k]||0;
            const curP = champProfVal(selPl, k);
            const ti = curP>=25 ? proTier(selPl, k, curP) : null;
            return `<button class="tc-chip ${on?'on':''}" data-a="toggleTrain" data-p="${esc(selPl.pid)}" data-c="${esc(k)}">
              ${champAvatar(k,'xs')}
              <span>${esc(champName(k))}${m>=2?' 🔥':m>=1?' ↑':''}${ti?`<small>${ti.name}</small>`:''}</span>
            </button>`;
          }).join('')}</div>
        </div>` : ''}
      </div>
    </div>`;
  } else {
    pane = `<div class="off-contracts">
      <h4>合同到期选手（不续约将在新赛季开启时离队）</h4>
      ${exp.length?`<table class="tbl">${exp.map(p=>`<tr><td>${ROLE_CN[p.role]}</td><td><b>${esc(playerTag(p))}</b></td><td>${p.age}岁</td><td>${p.renewed?'✅ 已续约':`<button class="btn sm" data-a="renew" data-p="${esc(p.pid)}">续约2年（年薪约 ${fmtMoney(fairSalary(p)*1.1)}）</button>`}</td></tr>`).join('')}</table>`:'<p class="muted">本队没有合同到期的选手。</p>'}
      <hr class="sep">
      ${marketEmbedHtml(35)}
    </div>`;
  }

  return `<div class="off-hub">
    <div class="off-bar">
      <div class="off-tabs">
        <a class="${tab==='patch'?'on':''}" data-a="offTab" data-t="patch">${ico('patch')} 下版本更新日志 (${esc(np.ver)})</a>
        <a class="${tab==='train'?'on':''}" data-a="offTab" data-t="train">${ico('target')} 选手英雄池特训</a>
        <a class="${tab==='contract'?'on':''}" data-a="offTab" data-t="contract">${ico('transfer')} 续约与转会市场 ${exp.filter(p=>!p.renewed).length?`(${exp.filter(p=>!p.renewed).length})`:''}</a>
      </div>
      <button class="btn big" data-a="newSeason">完成休赛期，开启 ${S.year+1} 赛季 ${ico('play')}</button>
    </div>
    ${pane}
  </div>`;
}

VIEWS.home = () => {
  const ev=curEvent(), info=eventInfo(ev);
  const strip = `<div class="season-strip">${S.events.map((e,i)=>{
    const cls = i<S.evIdx||e.done?'past':i===S.evIdx?'now':'';
    return `<span class="ss-item ${cls}">${esc(((eventInfo(e)||{}).name||'').replace(/LPL |全球总决赛 |MSI |电竞世界杯 /g,''))}</span>`;
  }).join('')}</div>`;

  // 1. 转会窗口（新档开局组队 / 年中转会窗）：直接将转会操作与首发概览放到主页
  if(ev.type === 'window'){
    const me = T(S.user);
    const setup = isRosterSetup(ev);
    return `<section class="card evcard">
      ${strip}
      <div class="evh"><h2>${esc(info.name)}</h2><span>预算 ${fmtMoney(me.budget)} · 首发外援 ${starters(S.user).filter(isForeign).length}/2</span></div>
      ${setup?`<p class="muted">${esc(info.fmt)}</p>`:''}
      <div class="win-lineup-bar">
        ${ROLES.map(r=>{ const p=P(me.lineup[r]); return `<span class="wl-slot"><small>${ROLE_CN[r]}</small><b>${p?esc(playerTag(p)):'空缺'}</b></span>`; }).join('')}
        <a class="wl-link" data-a="view" data-v="roster">调整首发/出售 →</a>
        ${setup?'':`<button class="btn big" style="margin-left:auto" data-a="endWindow">结束转会窗，继续赛程 ▶</button>`}
      </div>
      ${probs()}
      ${setup?`<div class="btns"><button class="btn big" data-a="finishSetup">完成组队，进入第一赛段 ▶</button></div>`:''}
    </section>
    <section class="card">${marketEmbedHtml(45)}</section>`;
  }

  // 2. 年底休赛期：版本更新日志 + 选手英雄池特训 + 续约引援一站式清爽标签页
  if(ev.type === 'off'){
    return `<section class="card evcard">
      ${strip}
      <div class="evh"><h2>${S.year} 休赛期与新赛季筹备</h2><span>预算 ${fmtMoney(T(S.user).budget)}</span></div>
      ${renderOffseasonHome()}
    </section>`;
  }

  // 3. 各项赛事阶段（LPL赛段 / 先锋赛 / MSI / EWC / 世界赛）：直接把当前赛事的实时赛程/积分/对阵图放到主页！
  let topBody = '';
  let stageCard = '';
  if(!ev.started){
    topBody = `<p class="muted">${ev.type==='lpl_s1'&&transferWindowOpen()?'开赛前转会窗仍开放，确认首发无误后即可开赛。':esc(info.fmt)}</p>${probs()}
      <div class="btns"><button class="btn big" data-a="startEv">开始 ${esc(info.name)} ▶</button><button class="btn ghost" data-a="simEvent">快速模拟整项赛事</button></div>`;
  } else if(ev.done){
    topBody = `<div class="done">${ico('check','g')} ${esc(info.name)}已结束 ${ev.res.champ?`· ${ico('trophy','gold')} 冠军 ${teamTag(ev.res.champ)}`:''}</div>${eventSummary(ev)}
      <div class="btns"><button class="btn big" data-a="nextEvent">进入下一阶段 ${ico('play')}</button></div>`;
    // 赛段结束后干净展示积分（LPL赛段显示全年积分榜，国际赛可折叠回顾对阵）
    stageCard = /^lpl_s/.test(ev.type)
      ? `<section class="card"><h3>LPL 全年世界赛积分榜</h3>${pointsTable()}</section>`
      : (ev.stages.length ? `<section class="card">${stageView(ev.stages[ev.stages.length-1])}</section>` : '');
  } else {
    const nxt = nextReadyMatch();
    const myNext = findMyNext();
    const inEvent = eventHasUser(ev);
    topBody = `<div class="stage">当前阶段：<b>${esc(ev.stages[ev.si]?ev.stages[ev.si].name:'')}</b></div>
      ${myNext?`<div class="nextm"><div class="lbl">${esc(myNext.m.label)} · BO${myNext.m.bo}</div>
         <div class="vs"><div class="side">${teamTag(myNext.m.a,'big')}</div><em>VS</em><div class="side">${teamTag(myNext.m.b,'big')}</div></div></div>`:
        `<p class="muted">${inEvent?'等待本轮其他比赛结果…':'本队未参加此项赛事（或已止步），可模拟观看赛果。'}</p>`}
      <div class="btns">
        ${myNext?`<button class="btn big" data-a="toMyMatch">${ico('play')} ${nxt&&userInvolved(nxt.m)?'进入比赛':'模拟至我的比赛'}</button>`:''}
        <button class="btn" data-a="simStage">${ico('skip')} 模拟本轮</button>
        <button class="btn ghost" data-a="simEvent">模拟整项赛事</button>
      </div>
      ${probs()}`;
    // 直接把当前赛事正在打的小组赛/瑞士轮/淘汰赛对阵放到主页下方
    const activeIdxs = ev.parallel && ev.si<=Math.max(...ev.parallel) ? ev.parallel : [ev.si];
    stageCard = `<section class="card">${activeIdxs.map(idx=>ev.stages[idx]?stageView(ev.stages[idx]):'').join('')}</section>`;
  }

  return `
    <section class="card evcard">
      ${strip}
      <div class="evh"><h2>${info.name}</h2><span>${info.date}${info.loc?' · '+info.loc:''}</span></div>
      ${topBody}
    </section>
    ${stageCard}
    ${S.news.length?`<section class="card compact-news"><h4>${ico('news')} 最新赛场动态</h4><ul class="news">${S.news.slice(0,5).map(n=>`<li>${esc(n.t)}</li>`).join('')}</ul></section>`:''}`;
};
function probs(){ const p=lineupProblems(S.user); return p.length?`<p class="warn">${ico('warn')} ${p.join('；')} —— 请到“阵容”调整后方可参赛</p>`:''; }
function eventHasUser(ev){ return ev.stages.some(st=>st.matches.some(m=>userInvolved(m)&&!m.w)) || ev.stages.some(st=>(st.teams||[]).includes(S.user)&&st.kind==='swiss'&&st.rec[S.user][0]<3&&st.rec[S.user][1]<3) || (ev.stages[ev.si]&&ev.stages[ev.si].kind==='rr'&&Object.values(ev.stages[ev.si].groups).some(g=>g.includes(S.user))); }
function findMyNext(){ const ev=curEvent(); if(!ev.started||ev.done) return null; for(const st of ev.stages){ if(st.kind==='br') resolveBR(st); const m=st.matches.find(m=>!m.w&&userInvolved(m)&&m.a&&m.b); if(m) return {m,st}; } return null; }
function seasonTimeline(){
  return `<ol class="tl">${S.events.map((e,i)=>{ const inf=eventInfo(e)||{};
    const st = i<S.evIdx||e.done?'past':i===S.evIdx?'now':'';
    return `<li class="${st}"><b>${inf.name}</b> <small>${inf.date}</small> ${e.res&&e.res.champ?`· 冠军 ${teamTag(e.res.champ)}`:''}</li>`; }).join('')}</ol>`;
}
function pointsTable(){
  const rows=S.lplOrder.slice().sort((a,b)=>(S.points[b]||0)-(S.points[a]||0));
  return `<table class="tbl"><tr><th>#</th><th>战队</th><th>积分</th></tr>${rows.map((k,i)=>`<tr class="${k===S.user?'me':''}"><td>${i+1}</td><td>${teamTag(k)}</td><td><b>${S.points[k]||0}</b></td></tr>`).join('')}</table>`;
}
function eventSummary(ev){
  const r=ev.res || {};
  const lines = [];
  if(r.champ) lines.push(`<li><span class="eb-lbl">${ico('trophy','gold')} 冠军</span><span class="eb-val">${teamTag(r.champ)}</span></li>`);
  if(r.runner) lines.push(`<li><span class="eb-lbl">${ico('shield')} 亚军</span><span class="eb-val">${teamTag(r.runner)}</span></li>`);
  if(r.seeds && Array.isArray(r.seeds)){
    r.seeds.forEach((t,i)=>lines.push(`<li><span class="eb-lbl">${ico('globe')} LPL ${i+1}号种子</span><span class="eb-val">${teamTag(t)}</span></li>`));
  }
  if(r.final && r.final.length){
    r.final.slice(0,8).forEach((t,i)=>lines.push(`<li><span class="eb-lbl">第 ${i+1} 名</span><span class="eb-val">${teamTag(t)}</span></li>`));
  }
  return lines.length ? `<ul class="ev-bulletin">${lines.join('')}</ul>` : '';
}

// ---------- 阵容 ----------
VIEWS.roster = () => {
  const t=T(S.user); const ps=(t.roster||[]).map(P).filter(Boolean);
  const sal=ps.reduce((s,p)=>s+(p.salary||0),0);
  const chem = teamChemistry(S.user);
  const coresHtml = chem.cores.length
    ? chem.cores.map(c=>`<span class="chem-core">${ico('chem')} ${c.label}：${c.members.map(esc).join(' · ')}</span>`).join('')
    : '<span class="muted">暂无长期老搭档核心，多赛段同队出战将逐步形成羁绊</span>';
  const win = transferWindowOpen();
  const { slots, subs } = dbSquad(t);
  return `<section class="card roster-view"><h2>${esc(t.name)} ${t.cn?`<small>${esc(t.cn)}</small>`:''}</h2>
   <p>战力 ${ovrBadge(teamOvr(S.user))} · 团队化学反应 <span class="chem-pill ${chem.cls}">${ico('chem')} <b>${chem.score}</b> ${chem.label}</span> · 预算 ${fmtMoney(t.budget)} · 年薪总额 ${fmtMoney(sal)} · 首发外援 ${starters(S.user).filter(isForeign).length}/2</p>
   <div class="chem-bar-row">${coresHtml}</div>
   <p class="rs-note muted">${ico('chem')} 默契：选手与当前其余首发队友的平均羁绊（<span class="bd-val hi">72+</span> 高 · <span class="bd-val mid">50–71</span> 中 · <span class="bd-val lo">&lt;50</span> 低），同队出战越久越高，并影响团队化学反应。</p>
   ${probs()}
   <div class="rs-head"><h3>首发</h3><button class="btn sm ghost" data-a="autoLineup">自动最佳合规阵容</button></div>
   <div class="rs-grid">${slots.map(({r,p})=>p ? rosterCard(p, r, win)
     : `<div class="rs-card empty"><div class="rs-top"><span class="rs-role">${ROLE_SVG[r]} 首发·${ROLE_CN[r]}</span></div><div class="rs-empty">空缺</div></div>`).join('')}</div>
   <div class="rs-head"><h3>替补 <small>${subs.length} 人</small></h3></div>
   ${subs.length ? `<div class="rs-grid">${subs.map(p=>rosterCard(p, null, win)).join('')}</div>` : '<p class="muted">暂无替补。</p>'}
   ${win?'':'<p class="muted">转会窗口关闭中（季后/休赛期与赛段之间开放），目前只能调整首发。</p>'}</section>`;
};
function rosterActsHtml(p, slot, win, inCard){
  return `${slot?(inCard?'':`<span class="tagon">首发·${ROLE_CN[slot]}</span>`):`<button class="btn sm" data-a="setStarter" data-p="${esc(p.pid)}" data-r="${p.role}">设为${ROLE_CN[p.role]||''}首发</button>`}
    ${win?`<button class="btn sm ghost" data-a="sell" data-p="${esc(p.pid)}">出售</button><button class="btn sm ghost" data-a="release" data-p="${esc(p.pid)}">解约</button>`:''}`;
}
function rosterCard(p, slot, win){
  const bd = playerTeamBond(p);
  const off = slot && p.role!==slot;
  const tr = traitChips(p);
  const dl = ratingDeltaHtml(p);
  const acts = rosterActsHtml(p, slot, win, true);
  return `<div class="rs-card ${slot?'starter':'sub'}">
    <div class="rs-top"><span class="rs-role">${ROLE_SVG[slot||p.role]||''} ${slot?`首发·${ROLE_CN[slot]}`:`替补·${ROLE_CN[p.role]||esc(p.role||'')}`}</span>${off?'<em class="rs-off">非本位</em>':''}${isForeign(p)?'<small class="fx">外援</small>':''}</div>
    <button class="rs-open" data-a="rsPlayer" data-p="${esc(p.pid)}" title="查看选手详情">
      <span class="rs-name"><b>${esc(playerTag(p))}</b><small>${esc(p.name||'')}</small></span>
      <span class="rs-more muted">详情 ›</span>
    </button>
    <div class="rs-rt">${ovrBadge(p.rating||0)}${slot?`<small class="rs-eff" title="含状态与位置修正的出场能力">出场 ${Math.round(effRating(p,slot))}</small>`:''}</div>
    ${dl?`<div class="rs-dl">${dl}</div>`:''}
    <div class="rs-chips">${formChip(p,true)}${mentalChip(p,true)}<span class="rs-bd" title="默契：与其余首发队友的平均羁绊">默契 <span class="bd-val ${bondCls(bd)}">${bd}</span></span></div>
    ${tr?`<div class="rs-trs">${tr}</div>`:''}
    <div class="pool rs-pool">${poolChipsHtml(p,{limit:4})||'<small class="muted">英雄池 —</small>'}</div>
    <div class="rs-meta">${esc(p.nat||'—')} · ${p.age!=null?p.age+' 岁':'—'} · 潜力 ${p.pot!=null?p.pot:'—'}<br>身价 ${fmtMoney(playerValue(p))} · 年薪 ${fmtMoney(p.salary||0)} · 合同至 ${p.contract!=null?p.contract:'—'}</div>
    ${acts.trim()?`<div class="rs-act">${acts}</div>`:''}
  </div>`;
}

// ---------- 转会市场（含季中建队非卖品过滤） ----------
function marketEmbedHtml(limit){
  const f=UI.mk;
  const midWin = isMidSeasonWindow();
  let ps=Object.values(S.players).filter(p=>!p.retired && p.team!==S.user);
  if(f.fa) ps=ps.filter(p=>!p.team); else ps=ps.filter(p=>p.team);
  if(midWin && !f.fa && f.hideLock) ps=ps.filter(p=>!isUntouchable(p));
  if(f.region!=='ALL') ps=ps.filter(p=>p.team&&T(p.team).region===f.region);
  if(f.role!=='ALL') ps=ps.filter(p=>p.role===f.role);
  if(f.q) ps=ps.filter(p=>(playerTag(p)+p.name+(p.team||'')).toLowerCase().includes(f.q.toLowerCase()));
  const key={rating:p=>-p.rating, value:p=>-playerValue(p), age:p=>p.age, pot:p=>-p.pot}[f.sort];
  ps.sort((a,b)=>key(a)-key(b));
  const open=transferWindowOpen();
  const maxShow = limit || 120;
  return `<div class="mk-wrap">
  <div class="mk-hd"><h3>转会市场 ${open?'<span class="on">窗口开放</span>':'<span class="off">窗口关闭</span>'}</h3><span class="muted">我的预算 <b>${fmtMoney(T(S.user).budget)}</b></span></div>
  ${open?'':'<p class="warn">当前不在转会窗口内，仅可浏览名单。窗口在第一赛段开赛前、先锋赛后、EWC后及休赛期开放。</p>'}
  <div class="filters">
    <select data-f="region">${['ALL',...REGIONS].map(r=>`<option ${f.region===r?'selected':''} value="${r}">${r==='ALL'?'全部赛区':r}</option>`).join('')}</select>
    <select data-f="role">${['ALL',...ROLES].map(r=>`<option ${f.role===r?'selected':''} value="${r}">${r==='ALL'?'全部位置':ROLE_CN[r]}</option>`).join('')}</select>
    <select data-f="sort">${[['rating','按能力'],['value','按身价'],['pot','按潜力'],['age','按年龄']].map(([k,n])=>`<option ${f.sort===k?'selected':''} value="${k}">${n}</option>`).join('')}</select>
    <label><input type="checkbox" data-f="fa" ${f.fa?'checked':''}> 只看自由球员/新秀</label>
    ${midWin&&!f.fa?`<label><input type="checkbox" data-f="hideLock" ${f.hideLock?'checked':''}> 隐藏季中非卖核心</label>`:''}
    <input data-f="q" placeholder="搜索选手/战队" value="${esc(f.q)}">
  </div>
  <table class="tbl"><tr><th>选手</th><th>战队</th><th>位置</th><th>年龄</th><th>能力</th><th>潜力</th><th>身价</th><th>要价</th><th>合同至</th><th></th></tr>
  ${ps.slice(0,maxShow).map(p=>{
    const locked = isUntouchable(p);
    const crossMid = midWin && isCrossRegionFor(p, S.user);
    return `<tr><td><b>${esc(playerTag(p))}</b>${isForeign(p)?'<small class="fx">外援</small>':''}${crossMid?`<small class="cr-tag" title="跨赛区年中极难离队">${ico('globe')}跨区极难</small>`:''}</td><td>${p.team?teamTag(p.team):'<i>自由球员</i>'}</td><td>${ROLE_CN[p.role]}</td><td>${p.age}</td><td>${ovrBadge(p.rating)}</td><td>${p.pot}</td><td>${fmtMoney(playerValue(p))}</td><td>${locked?'<span class="muted">非卖品</span>':p.team?fmtMoney(askPrice(p, S.user)):'—'}</td><td>${p.contract}</td>
    <td>${!open?'':locked?`<span class="nft-tag">${ico('lock')} 季中非卖</span>`:`<button class="btn sm" data-a="offer" data-p="${esc(p.pid)}">${p.team?'报价':'签约'}</button>`}</td></tr>`;
  }).join('')}</table>
  ${ps.length>maxShow?`<p class="muted">共 ${ps.length} 人，当前显示前 ${maxShow} 人，请使用上方筛选缩小范围。</p>`:''}
  </div>`;
}
VIEWS.market = () => `<section class="card">${marketEmbedHtml(150)}</section>`;
// 报价评估区：输入转会费/切换交换选手时只局部刷新这一块，避免整页重绘把输入框重置（“回溯”）
function offerEvalHtml(pid, cash, give){
  const p=P(pid); if(!p||!p.team) return '';
  const e = evaluateOffer(pid,cash,give||null);
  const verdict = e.crossMid
    ? (e.ratio>=1.45?'<b class="y">高额溢价下有一定机会</b>':'<b class="r">季中跨赛区极难挖角，大概率拒绝</b>')
    : e.ratio>=1.05?'<b class="g">对方大概率接受</b>':e.ratio>=0.9?'<b class="y">有机会，对方在犹豫</b>':'<b class="r">对方很可能拒绝</b>';
  return `评估：${verdict}（报价价值 ${fmtMoney(e.offerVal)}）`;
}
const offerCashNow = p => UI.offerCash!=null?UI.offerCash:(p.team?askPrice(p, S.user):0);
function refreshOfferEval(pid){
  const box=document.getElementById('offer-eval'); if(!box) return;
  box.innerHTML = offerEvalHtml(pid, offerCashNow(P(pid)), UI.offerGive||'');
}
function offerModal(pid){
  return () => { const p=P(pid); const me=T(S.user);
    const cash = offerCashNow(p); const give=UI.offerGive||'';
    const cashTxt = UI.offerCashRaw!=null ? UI.offerCashRaw : String(cash);
    const e = p.team? evaluateOffer(pid,cash,give||null):null;
    const chemPv = previewChemWith(S.user, pid, p.role);
    return `<h3>${ico('transfer')} ${p.team?'报价':'签约'}：${esc(playerTag(p))} <small>${ROLE_CN[p.role]} · ${p.team?teamTag(p.team):'自由球员'}</small></h3>
     <p>能力 ${ovrBadge(p.rating)} · 潜力 ${p.pot} · ${p.age}岁 · 身价 ${fmtMoney(playerValue(p))} · 预计年薪 ${fmtMoney(Math.max(p.salary,fairSalary(p)))}</p>
     ${chemPv?`<div class="chem-pv">${ico('chem')} 化学反应预计：<b>${chemPv.before.score}</b> → <b class="${chemPv.delta>=0?'g':'r'}">${chemPv.after.score}（${chemPv.delta>=0?'+':''}${chemPv.delta}）</b>${chemPv.keptFriends.length?` · <span class="g">保留老搭档羁绊：${chemPv.keptFriends.map(esc).join(' / ')}</span>`:''}</div>`:''}
     ${e&&e.crossMid?`<p class="warn">${ico('globe')} 当前为年中转会窗，跨赛区俱乐部几乎不愿中途放人，仅极高溢价才有小概率放行；建议等到年底休赛期再运作跨区引援。</p>`:''}
     ${p.team?`<label>转会费（万）：<input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-o="cash" data-p="${esc(pid)}" value="${esc(cashTxt)}"></label>
     <label>附加交换选手：<select data-o="give" data-p="${esc(pid)}"><option value="">（不交换）</option>${me.roster.map(P).filter(Boolean).map(x=>`<option value="${esc(x.pid)}" ${give===x.pid?'selected':''}>${esc(playerTag(x))} · ${ROLE_CN[x.role]} · ${x.rating.toFixed(0)} · 身价${fmtMoney(playerValue(x))}</option>`).join('')}</select></label>
     <p id="offer-eval">${offerEvalHtml(pid,cash,give)}</p>`:'<p>自由球员可直接签约，无需转会费。</p>'}
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
  return `<section class="card"><div class="evtabs">${evs.map(([e,k])=>`<a data-a="evSel" data-i="${k}" class="${k===i?'on':''}">${esc((eventInfo(e)||{}).name||'')}</a>`).join('')}</div>
   ${!ev||['window','off'].includes(ev.type)?'<p>请选择赛事</p>': !ev.started?'<p class="muted">赛事尚未开始。</p><p class="fmt">'+esc((eventInfo(ev)||{}).fmt||'')+'</p>' :
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
       ${g.rid && findReplay(g.rid) && findReplay(g.rid).rec ? ` <button class="btn sm" data-a="openReplay" data-id="${esc(g.rid)}">▶ 观看回放</button>` : ''}
       <div class="gp"><div>${teamTag(m.a)} ${ROLES.map(r=>champName(g.picks.A[r])).join(' / ')}<br><small>禁用：${g.bans.A.map(champName).join(' ')}</small></div>
       <div>${teamTag(m.b)} ${ROLES.map(r=>champName(g.picks.B[r])).join(' / ')}<br><small>禁用：${g.bans.B.map(champName).join(' ')}</small></div></div>
       ${masteryChipsHtml(g.masteryChanges)}
       ${g.events&&g.events.length?`<ul class="evlog-sm">${g.events.map(ev=>`<li><b>${esc(ev.t)}</b> ${esc(ev.text)}</li>`).join('')}</ul>`:''}
     </div>`).join('')}
     <button class="btn ghost" data-a="closeModal">关闭</button>`; };
}

// ---------- 版本 ----------
VIEWS.meta = () => {
  const strong=CHAMP_KEYS.filter(k=>S.meta[k]>=1).sort((a,b)=>S.meta[b]-S.meta[a]);
  const t0Cnt = strong.filter(k=>S.meta[k]>=2).length, t1Cnt = strong.length - t0Cnt;
  const st=Object.entries(S.log).map(([c,v])=>({c,...v})).sort((a,b)=>(b.p+b.b)-(a.p+a.b)).slice(0,30);
  return `<section class="card"><h2>${ico('patch')} 当前版本 ${S.year%100}.${S.patchNo} <small>T0 ${t0Cnt} 名 · T1 ${t1Cnt} 名（分位置严格定额）</small></h2><p>版本强势英雄（${ico('flame','c-t0')} T0，${ico('up','c-t1')} T1）：</p>
   <div class="chips">${strong.map(k=>`<span class="chip ${S.meta[k]>=2?'t0':'t1'}">${S.meta[k]>=2?ico('flame','c-t0'):ico('up','c-t1')} ${CH[k].cn} <small>${CH[k].roles.map(r=>ROLE_CN[r]).join('/')}</small></span>`).join('')}</div>
   <h3>本赛季英雄数据（全部赛区）</h3><table class="tbl"><tr><th>英雄</th><th>登场</th><th>禁用</th><th>胜率</th></tr>${st.map(x=>`<tr><td>${CH[x.c]?CH[x.c].cn:x.c}</td><td>${x.p}</td><td>${x.b}</td><td>${x.p?Math.round(x.w/x.p*100)+'%':'-'}</td></tr>`).join('')}</table></section>`;
};
VIEWS.news = () => `<section class="card"><h2>新闻</h2><ul class="news">${S.news.map(n=>`<li><small>${n.y} · ${esc(n.ev)}</small> ${esc(n.t)}</li>`).join('')}</ul>
  <h3>历届冠军</h3><table class="tbl"><tr><th>年份</th><th>LPL S1/S2/S3</th><th>先锋赛</th><th>MSI</th><th>EWC</th><th>世界赛</th></tr>${(S.history||[]).map(h=>`<tr><td>${h.year}</td><td>${h.lpl.map(teamTag).join(' ')}</td><td>${teamTag(h.fst)}</td><td>${teamTag(h.msi)}</td><td>${teamTag(h.ewc)}</td><td>${teamTag(h.worlds)}</td></tr>`).join('')}</table></section>`;
VIEWS.rules = () => `<section class="card"><h2>赛制说明（2026）</h2><p>✅ = 已从拳头官方/主流媒体核实；⚠️ = 未查到官方细则，游戏内为推测或简化。</p>
  ${['lpl_s1','fst','lpl_s2','msi','ewc','lpl_s3','lpl_rf','worlds'].map(k=>`<h3>${EVENT_INFO[k].name} <small>${EVENT_INFO[k].date} · ${EVENT_INFO[k].loc}</small></h3><p class="fmt">${esc(EVENT_INFO[k].fmt)}</p>`).join('')}
  <h3>BP与选边规则</h3><p class="fmt">标准职业BP：禁3-选3（1-2-2-1）-禁2-选2。✅ 经典蓝先红后制：蓝色方永远为 BP 先手（一楼先抢），红色方永远为 BP 后手（拥有五楼康特位）。✅ 选边规则：系列赛首局开赛前进行峡谷 1v1 SOLO 赛（一血 / 百刀 / 一塔定胜负，10 分钟后火圈收缩、12 分钟前必分胜负），胜者战队获得首局选边权；BO3 与 BO5 从第二局起每一局均由上一局败者直接选边。✅ 全程无畏征召：同一系列赛中任一方用过的英雄，双方都不能再选。✅ 支持选人阶段与赛前摇摆换位，并支持法核下路、长手上路等战术奇招（非合理跨位则有轻度胜率惩罚）。✅ 英雄熟练度分五档（招牌/精通/熟练/略懂/生疏），随比赛与休赛期特训动态成长或自然衰退。</p>
  <h3>其他说明</h3><p class="fmt">✅ LPL首发外援上限2人（赛前强制校验，AI 战队同样遵守）。✅ EWC卫冕冠军：Gen.G（EWC 2025冠军），之后赛季为上届冠军。⚠️ 其他赛区不进行逐场模拟，按战力+随机生成各赛段排名。⚠️ 选手能力值、潜力、身价均为游戏估算。✅ 选手状态/心态各分五档；大赛、淘汰赛、稳定性、抗压特质依据 Leaguepedia 2023 年以来的职业比赛数据统计得出（样本不足的选手不打标签）。</p></section>`;
function accountPanelHtml(){
  const logged = CloudSync.isLoggedIn();
  const isReg = UI.authTab === 'register';
  return `<div class="acct-box">
    <h3>☁️ 账号与多平台云同步</h3>
    <p class="muted">同步状态：<b>${esc(CloudSync.statusText)}</b>${CloudSync.lastSyncAt?` · 上次同步 ${esc(fmtTime(CloudSync.lastSyncAt))}`:''}</p>
    ${logged ? `
      <div class="acct-user">
        <div>当前账号：<b>${esc(CloudSync.auth.user.email)}</b> <small>（${esc(detectPlatformLabel())}）</small></div>
        <div class="btns">
          <button class="btn" data-a="cloudSyncNow" ${UI.authBusy?'disabled':''}>${CloudSync.conflict?'处理存档差异':'立即同步云端'}</button>
          ${S?`<button class="btn ghost" data-a="cloudPushNow" ${UI.authBusy?'disabled':''}>上传本地进度到云端</button>`:''}
          <button class="btn ghost" data-a="cloudSignOut" ${UI.authBusy?'disabled':''}>退出登录</button>
        </div>
      </div>`
    : UI.verifyEmail ? `<div class="acct-form">
        <p>验证码已发送至 <b>${esc(UI.verifyEmail)}</b>，请输入邮件中的数字验证码完成绑定：</p>
        <div class="form-row">
          <input id="auth-otp" class="otp-input light" type="text" inputmode="numeric" maxlength="8" placeholder="输入邮箱验证码">
        </div>
        <div class="btns">
          <button class="btn big" data-a="cloudVerifyOtp" ${UI.authBusy?'disabled':''}>${UI.authBusy?'验证中…':'验证并绑定当前进度'}</button>
          <button id="btn-resend-otp" class="btn ghost" data-a="cloudResendOtp" ${UI.authBusy||UI.resendCd>0?'disabled':''}>${UI.resendCd>0?`重新发送 (${UI.resendCd}s)`:'重新发送验证码'}</button>
          <button class="btn ghost" data-a="cancelOtp">返回修改</button>
        </div>
      </div>`
    : `<div class="acct-form">
        <p class="muted">当前为游客模式（进度仅保存在本设备）。登录或注册账号后，当前进度将自动绑定云端，在 Windows、Mac 与手机间无缝同步。</p>
        <div class="acct-subtabs">
          <a class="${!isReg?'on':''}" data-a="authTab" data-t="login">账号登录</a>
          <a class="${isReg?'on':''}" data-a="authTab" data-t="register">注册新账号</a>
        </div>
        <div class="form-row">
          <input id="auth-email" type="email" placeholder="邮箱地址">
          <input id="auth-pass" type="password" placeholder="${isReg?'设置密码（至少 6 位）':'密码'}">
          ${isReg?`<input id="auth-pass2" type="password" placeholder="再次输入密码以确认">`:''}
        </div>
        <div class="btns">
          <button class="btn big" data-a="${isReg?'cloudSignUp':'cloudSignIn'}" ${UI.authBusy?'disabled':''}>${UI.authBusy?'请稍候…':(isReg?'发送验证码并注册':'登录并同步云端')}</button>
        </div>
      </div>`}
  </div>`;
}

VIEWS.sys = () => {
  const upd = typeof AppUpdater !== 'undefined' ? AppUpdater : null;
  return `<section class="card">
  ${accountPanelHtml()}
  <hr class="sep">
  <h3>${ico('update')} 云端版本自动更新</h3>
  <p>当前客户端版本：<b>v${esc(upd ? upd.currentVersion : '2.1.4')}</b> · 状态：<b>${esc(upd ? upd.statusText : '已是最新版本')}</b></p>
  <div class="btns">
    <button class="btn" data-a="checkAppUpdate">${ico('update')} 立即检查云端更新</button>
    ${upd && upd.available ? `<a class="btn big" href="${esc(upd.available.url)}" target="_blank" rel="noopener">下载最新版本 v${esc(upd.available.version)}</a>` : ''}
  </div>
  <hr class="sep">
  <h3>${ico('shield')} 本地存档管理</h3>
  <p>存储方式：<b>${StorageBridge.mode==='tauri-file'?'独立软件本地文件存档（不随浏览器缓存清理丢失）':'浏览器本地存储'}</b>${StorageBridge.savePath?`<br><small>路径：${esc(StorageBridge.savePath)}</small>`:''}</p>
  <div class="btns"><button class="btn" data-a="export">导出存档 JSON</button><label class="btn ghost">导入存档<input type="file" id="imp" hidden></label><button class="btn ghost" data-a="reset">删除本地存档并重新开始</button></div>
</section>`;
};

// ================= 赛前情报：状态 / 心态 / 历史特质 =================
const TIER_CLS = t => t>=2?'t2':t===1?'t1':t===0?'t0':t===-1?'tn1':'tn2';
function formChip(p, short){ if(!p) return ''; const t = formTier(p); return `<span class="tchip ${TIER_CLS(t)}" title="状态：${FORM_TIERS[t+2]}">${short?'':'状态 '}<b>${FORM_TIERS[t+2]}</b></span>`; }
function mentalChip(p, short){ if(!p) return ''; const t = mentalTier(p); return `<span class="tchip m ${TIER_CLS(t)}" title="心态：${MENTAL_TIERS[t+2]}">${short?'':'心态 '}<b>${MENTAL_TIERS[t+2]}</b></span>`; }
function traitChips(p){ if(!p) return ''; return playerTraits(p).tags.map(x=>`<span class="trchip ${x.c}">${esc(x.t)}</span>`).join(''); }
// 熟练度显示档位：优先用后端 playerProfTier（未经职业出场验证的旧随机高熟练不会被标成招牌）
function proTier(p, c, v){
  const val = v!=null ? v : champProfVal(p, c);
  if(p && typeof playerProfTier==='function'){ try{ return playerProfTier(p, c, val); }catch(e){} }
  return profTier(val);
}
function poolChipsHtml(p, opts={}){
  const list = (p && Array.isArray(p.champs) ? p.champs : []).filter(e=>e && e.c);
  const shown = opts.limit ? list.slice(0, opts.limit) : list;
  const html = shown.map(e=>{ const v = champProfVal(p, e.c); const ti = proTier(p, e.c, v);
    return `<span class="pl-${ti.cls}" title="${esc(ti.name)} ${Math.round(v)}/100">${ti.icon?ti.icon+' ':''}${esc(champName(e.c))}${opts.val?' '+Math.round(v):''}</span>`; }).join('');
  return html + (opts.limit && list.length>opts.limit ? `<span class="pl-more">+${list.length-opts.limit}</span>` : '');
}
// 能力变化：本赛段 p.ratingDelta 与相对赛季初 p.ratingYearStart（旧档可能缺省）
const fmtDelta = v => { const r = Math.round(v*10)/10; return r>0 ? `+${r}` : r<0 ? `${r}` : '±0'; };
function ratingDeltaHtml(p){
  if(!p) return '';
  const out = [];
  const seg = Number(p.ratingDelta);
  if(p.ratingDelta!=null && Number.isFinite(seg)) out.push(`<span class="rt-d ${seg>=0.05?'up':seg<=-0.05?'dn':''}" title="本赛段能力变化">本赛段 ${fmtDelta(seg)}</span>`);
  const ys = Number(p.ratingYearStart);
  if(p.ratingYearStart!=null && Number.isFinite(ys) && Number.isFinite(Number(p.rating))){
    const yd = Number(p.rating) - ys;
    out.push(`<span class="rt-d ${yd>=0.05?'up':yd<=-0.05?'dn':''}" title="相对赛季初（${Math.round(ys*10)/10}）">赛季 ${fmtDelta(yd)}</span>`);
  }
  return out.join('');
}
const bondCls = bd => bd>=72?'hi':bd>=50?'mid':'lo';
// 熟练度变化（g.masteryChanges，仅玩家队伍）：实际增加量，已满 100 显示“满级”
function masteryChipsHtml(list){
  const rows = (Array.isArray(list) ? list : []).filter(x=>x && x.champ);
  if(!rows.length) return '';
  return `<div class="mastery-box"><span class="mb-lbl">英雄熟练度</span>${rows.map(x=>{
    const gain = Math.max(0, Math.round(Number(x.gain)||0));
    const next = Math.round(Number(x.next)||0), prev = Math.round(Number(x.prev)||0);
    const p = P(x.pid);
    let up = '';
    if(p && gain>0){ const a = proTier(p, x.champ, prev), b = proTier(p, x.champ, next); if(b.tier>a.tier && b.tier>=2) up = ` <em>晋升${esc(b.name)}</em>`; }
    const val = gain>0 ? `<b>+${gain}</b><small>${next}/100</small>` : next>=100 ? '<b class="full">满级</b>' : '<b class="full">+0</b>';
    return `<span class="ms-chip ${gain>0?'':'max'}">${esc(x.tag||(p?playerTag(p):x.pid||''))} · ${esc(champName(x.champ))} ${val}${up}</span>`;
  }).join('')}</div>`;
}
// impacts 中的熟练度条目与 masteryChanges 重复时剔除，避免叠加
function impactsWithoutMastery(g){
  const imp = Array.isArray(g && g.impacts) ? g.impacts : [];
  return (g && Array.isArray(g.masteryChanges) && g.masteryChanges.length) ? imp.filter(s=>!/熟练度/.test(String(s))) : imp;
}
function intelPanel(M){
  const m = M.item.m, ctx = matchCtx(M);
  const col = (key, side) => {
    const lu = lineupMap(key);
    return `<div class="intel-col ${side===M.me?'me':''}">
      <div class="intel-hd">${teamTag(key)} ${side===M.me?'<em class="me-pill">我方</em>':''}</div>
      ${ROLES.map(r=>{ const p = lu[r]; if(!p) return ''; return `<div class="intel-row">
        <span class="ir-role">${ROLE_SVG[r]}</span><b class="ir-nm">${esc(playerTag(p))}</b>
        <span class="ir-chips">${formChip(p,true)}${mentalChip(p,true)}</span>
        <span class="ir-tags">${traitChips(p)}</span></div>`; }).join('')}
    </div>`;
  };
  return `<div class="intel-panel">
    <div class="intel-title"><b>赛前情报</b><span class="intel-ctx">${esc(ctxLabel(ctx))}</span><small>左为状态，右为心态；国际赛、淘汰赛、决胜局压力越大，心态影响越明显</small></div>
    <div class="intel-cols">${col(m.a,'A')}${col(m.b,'B')}</div>
  </div>`;
}

// ================= 回放 =================
function startReplayWatch(r, kind){
  if(kind==='solo' && r.solo){
    const so = r.solo;
    Watch.start({ kind:'solo', replay:true, rec:so.rec, dur:so.rec.f.length-1, meta:so.meta, log:so.log, winner:so.winner, teamA:so.teamA, teamB:so.teamB, me: r.a===S.user?'A':'B' });
  } else if(r.rec){
    Watch.start({ kind:'g5', replay:true, rec:r.rec, dur:r.rec.dur, me: r.a===S.user?'A':'B' });
  }
}
function replayScreen(){
  const R = UI.replay, r = findReplay(R.id);
  if(!r){ UI.replay = null; Watch.stop(); return ''; }
  const sw = (k, lb) => `<button class="hex-btn sm ${R.kind===k?'':'ghost'}" data-a="replayKind" data-k="${k}">${lb}</button>`;
  return `<div class="match hex mode-live replay-screen">
    <header class="rp-head">
      <div class="rp-t"><span class="hex-eyebrow">回放 · ${esc(String(r.y))} ${esc(r.label||'')}</span>
        <h2>${teamTag(r.a)} <b>${r.kA}</b> : <b>${r.kB}</b> ${teamTag(r.b)} <small>第 ${r.gi} 局 · ${r.dur} 分钟 · 胜者 ${teamName(r.w==='A'?r.a:r.b)}</small></h2></div>
      <div class="rp-btns">${r.solo&&r.rec?sw('solo','1v1 选边赛')+sw('g5','5v5 正赛'):''}
        <button class="hex-btn sm ${r.kept?'':'ghost'}" data-a="keepReplay" data-id="${esc(r.id)}">${r.kept?'★ 已永久保留':'☆ 永久保留'}</button></div>
    </header>
    ${R.kind==='solo' ? `<div class="hex-panel solo-watch-panel">${Watch.shellSolo()}</div>` : Watch.shell5()}
  </div>`;
}
function replayKdaHtml(r){
  if(!r.pl || !(r.pl.A||[]).length) return '';
  const side = rows => rows.map(([tag,c,k,d,a])=>`<div class="rp-pl"><span class="rp-tag">${esc(tag)}</span><span class="rp-ch">${esc(CH[c]?CH[c].cn:(c||''))}</span><b>${k}/${d}/${a}</b></div>`).join('');
  return `<details class="rp-kda"><summary>选手数据</summary><div class="rp-sides"><div>${side(r.pl.A)}</div><div>${side(r.pl.B)}</div></div></details>`;
}
VIEWS.replays = () => {
  const list = (S.replays||[]);
  const kept = list.filter(r=>r.kept).length;
  const row = r => `<tr class="${r.kept?'kept':''}">
    <td>${esc(String(r.y))}<br><small>${esc(r.label||'')}</small></td>
    <td>${teamTag(r.a)} <b>${r.kA}:${r.kB}</b> ${teamTag(r.b)}<br><small>第 ${r.gi} 局 · ${r.dur} 分钟 · MVP ${esc(r.mvpTag||'')}</small>${replayKdaHtml(r)}</td>
    <td>${(r.w==='A'?r.a:r.b)===S.user?'<span class="tagon">胜</span>':'<span class="tagoff">负</span>'}</td>
    <td class="act">${r.rec?`<button class="btn sm" data-a="openReplay" data-id="${esc(r.id)}">▶ 观看</button>${r.solo?`<button class="btn sm ghost" data-a="openReplay" data-id="${esc(r.id)}" data-k="solo">1v1 回放</button>`:''}
      <button class="btn sm ${r.kept?'':'ghost'}" data-a="keepReplay" data-id="${esc(r.id)}">${r.kept?'★ 取消保留':'☆ 永久保留'}</button>`:'<small class="muted">仅保留比分与数据</small>'}</td></tr>`;
  return `<section class="card"><h2>比赛回放</h2>
    <p class="muted">自动保存你最近 10 局比赛的完整回放；另可永久保留最多 ${REPLAY_MAX_KEPT} 局（已保留 ${kept} 局）。更早的比赛只保留比分和选手 KDA，最多保留 200 条记录。</p>
    ${list.length?`<table class="tbl replays"><tr><th>赛事</th><th>对局</th><th>结果</th><th></th></tr>${list.map(row).join('')}</table>`:'<p>还没有比赛回放。打一场你自己战队的比赛后，这里会自动出现。</p>'}
  </section>`;
};

// ---------- 设置（回放 / 规则 / 账号与存档 合并入口） ----------
const SET_TABS = [['replays','回放'],['rules','规则'],['sys','账号与存档']];
VIEWS.settings = () => {
  const tab = SET_TABS.some(([k])=>k===UI.setTab) ? UI.setTab : 'replays';
  return `<nav class="off-tabs set-tabs">${SET_TABS.map(([k,n])=>`<a data-a="setTab" data-t="${k}" class="${tab===k?'on':''}">${n}</a>`).join('')}</nav>
  ${VIEWS[tab]()}`;
};

// ---------- 资料库（只读：赛区 → 战队 → 首发 / 替补 → 选手详情，始终读取当前存档） ----------
function dbState(){
  const st = UI.db || (UI.db = {region:null, team:null});
  const myT = T(S.user);
  const region = REGIONS.includes(st.region) ? st.region : (myT && REGIONS.includes(myT.region) ? myT.region : REGIONS[0]);
  const teams = Object.values(S.teams||{}).filter(t=>t && t.region===region);
  const team = teams.find(t=>t.key===st.team) || teams.find(t=>t.key===S.user) || teams[0] || null;
  return { region, teams, team };
}
function dbSquad(t){
  const ids = (t.roster||[]).filter(id=>P(id));
  const lu = t.lineup || {};
  const used = new Set();
  const slots = ROLES.map(r=>{ const id=lu[r]; const p = id && ids.includes(id) && !used.has(id) ? P(id) : null; if(p) used.add(id); return { r, p }; });
  const subs = ids.filter(id=>!used.has(id)).map(P).sort((a,b)=>{ const ia=ROLES.indexOf(a.role), ib=ROLES.indexOf(b.role); return (ia<0?9:ia)-(ib<0?9:ib) || (b.rating||0)-(a.rating||0); });
  return { slots, subs };
}
function dbRow(p, roleLbl, off){
  return `<tr class="db-row" data-a="dbPlayer" data-p="${esc(p.pid)}">
    <td>${roleLbl}</td><td><b>${esc(playerTag(p))}</b>${off?' <em class="muted">非本位</em>':''}<br><small>${esc(p.name||'')}</small></td>
    <td>${ovrBadge(p.rating||0)}</td><td>${formChip(p,true)}${mentalChip(p,true)}</td><td class="act"><span class="muted">详情 ›</span></td></tr>`;
}
VIEWS.db = () => {
  const { region, teams, team } = dbState();
  const regionNav = `<nav class="off-tabs db-sel">${REGIONS.map(r=>`<a data-a="dbRegion" data-r="${r}" class="${r===region?'on':''}">${r}</a>`).join('')}</nav>`;
  const teamNav = teams.length
    ? `<nav class="off-tabs db-sel">${teams.map(t=>`<a data-a="dbTeam" data-k="${esc(t.key)}" class="${team&&t.key===team.key?'on':''}">${esc(t.short||t.key)}</a>`).join('')}</nav>`
    : '<p class="muted">该赛区暂无战队。</p>';
  let body = '';
  if(team){
    const { slots, subs } = dbSquad(team);
    const head = '<tr><th>位置</th><th>选手</th><th>能力</th><th>状态/心态</th><th></th></tr>';
    body = `<h3>${esc(team.name||team.short||team.key)} ${team.cn?`<small>${esc(team.cn)}</small>`:''}</h3>
      <h4>首发</h4>
      <table class="tbl db-tbl">${head}${slots.map(({r,p})=>p
        ? dbRow(p, `<span class="tagon">首发·${ROLE_CN[r]}</span>`, p.role!==r)
        : `<tr><td><span class="tagon">首发·${ROLE_CN[r]}</span></td><td colspan="4"><em class="muted">空缺</em></td></tr>`).join('')}</table>
      <h4>替补</h4>
      ${subs.length ? `<table class="tbl db-tbl">${head}${subs.map(p=>dbRow(p, `<span class="tagoff">替补</span> ${ROLE_CN[p.role]||esc(p.role||'')}`, false)).join('')}</table>` : '<p class="muted">暂无替补。</p>'}`;
  }
  return `<section class="card"><h2>资料库</h2>${regionNav}${teamNav}${body}</section>`;
};
function dbPlayerModal(pid, opts={}){
  return () => {
    const p = P(pid);
    const t = p && p.team ? T(p.team) : null;
    if(!p || !t || !(t.roster||[]).includes(pid)) return `<h3>资料库</h3><p class="muted">该选手已不在此战队名单中。</p><div class="btns"><button class="btn ghost" data-a="closeModal">关闭</button></div>`;
    const slot = ROLES.find(r=>(t.lineup||{})[r]===pid);
    const bd = playerTeamBond(p);
    const kv = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    const pool = poolChipsHtml(p, {val:true});
    const dl = ratingDeltaHtml(p);
    const manage = opts.manage && t.key===S.user;
    return `<h3>${esc(playerTag(p))} <small>${esc(p.name||'')}</small></h3>
      <p>${teamTag(t.key)} ${slot?`<span class="tagon">首发·${ROLE_CN[slot]}</span>`:'<span class="tagoff">替补</span>'}${slot&&p.role!==slot?' <em class="muted">非本位</em>':''}</p>
      <table class="tbl db-kv">
        ${kv('位置', ROLE_CN[p.role]||esc(p.role||''))}
        ${kv('国籍', esc(p.nat||'—')+(isForeign(p)?'<small class="fx">外援</small>':''))}
        ${kv('年龄', p.age!=null?p.age:'—')}
        ${kv('能力', ovrBadge(p.rating||0)+(dl?` <span class="rs-dl">${dl}</span>`:''))}
        ${kv('潜力', p.pot!=null?p.pot:'—')}
        ${kv('状态', formChip(p,true))}
        ${kv('心态', mentalChip(p,true))}
        ${kv('特质', traitChips(p)||'<small class="muted">—</small>')}
        ${kv('默契', `<span class="bd-val ${bondCls(bd)}">${bd}</span> <small class="muted">与其余首发队友的平均羁绊</small>`)}
        ${kv('身价', fmtMoney(playerValue(p)))}
        ${kv('年薪', fmtMoney(p.salary||0))}
        ${kv('合同至', p.contract!=null?p.contract:'—')}
        ${kv('英雄池', pool?`<span class="pool">${pool}</span>`:'<small class="muted">—</small>')}
      </table>
      <div class="btns">${manage?rosterActsHtml(p, slot, transferWindowOpen()):''}<button class="btn ghost" data-a="closeModal">关闭</button></div>`;
  };
}

// ================= 比赛（1v1 选边赛 + LoL 海克斯风格 BP）界面 =================
function needsSolo1v1(M){
  // 仅在每个系列赛首局开赛前打 1v1 决定选边；之后 BO3/BO5 每打完一把均由上一局输方直接选边
  return M.games.length === 0;
}
function enterNextGamePhase(M){
  const m = M.item.m, me = M.me, op = me==='A'?'B':'A';
  stopBpClock();
  M.draft = null; M.sel = null; M.roleSel = null; M.swapFrom = null;
  M.solo = null; M.soloAiBlue = null; Watch.stop();
  if(needsSolo1v1(M)){
    const myTeamKey = m[me==='A'?'a':'b'];
    const def = defaultSoloPick(myTeamKey);
    M.soloMyRole = def.role;
    M.soloMyChamp = def.champ;
    M.phase = 'solo_pick';
    return;
  }
  // 非 1v1 局：由上一局败者直接选边（蓝色方固定 BP 先手，红色方固定 BP 后手）
  if(M.chooser === me){
    M.phase = 'choose';
  } else {
    const opSide = aiChooseSide(m[op==='A'?'a':'b'], m[me==='A'?'a':'b'], M.locked);
    const blue = opSide === 'blue' ? op : me;
    setupDraft(blue);
    toast(`对手拥有选边权，选择了${opSide==='blue'?'蓝色方（BP先手）':'红色方（BP后手）'}，本局你位于${blue===me?'蓝色方（BP先手）':'红色方（BP后手）'}`);
  }
}
function beginUserMatch(item){
  const m=item.m; const me = m.a===S.user?'A':'B';
  UI.match = {
    item, me, wa:0, wb:0, games:[], locked:[],
    chooser: null,
    phase:'solo_pick', draft:null,
    solo:null, pendingSolo:null, soloMyRole:null, soloMyChamp:null, soloAiBlue:null,
    sel:null, roleSel:null, swapFrom:null,
    filter:'ALL', q:'', onlyAvail:false, showLocked:false, clock:30
  };
  enterNextGamePhase(UI.match);
  render();
}
// 本局比赛场合：国际赛 / 淘汰赛 / 决胜局（影响选手心态发挥）
function matchCtx(M){
  const m = M.item.m;
  if(!m.ctx) m.ctx = findMatchCtx(m) || {intl:false, ko:false};
  const need = Math.ceil(m.bo/2);
  return Object.assign({}, m.ctx, {decider: m.bo>1 && M.wa===need-1 && M.wb===need-1});
}
function setDraftCtx(M, d){ d.ctx = matchCtx(M); return d; }
// 回放：1v1 录像在下一局 5v5 时一起存
function soloReplayData(res){
  if(!res || !res.rec) return null;
  const meta = s => ({ tag:res[s].tag, champ:res[s].champ, cn:CH[res[s].champ]?CH[res[s].champ].cn:'', role:res[s].role, sum2:res[s].sum2, items:res[s].items.slice() });
  return { rec:res.rec, meta:{A:meta('A'), B:meta('B')}, log:res.log.map(x=>({t:x.t, sec:x.sec, side:x.side, tag:x.tag, text:x.text, hl:x.hl})), winner:res.winner, winReason:res.winReason, teamA:res.teamA, teamB:res.teamB };
}
function storeUserReplay(M, g){
  const m = M.item.m;
  const entry = { y:S.year, ev:(curEvent()||{}).type||'', label:m.label, a:m.a, b:m.b, gi:M.games.length+1, w:g.w, kA:g.kA, kB:g.kB, dur:g.dur,
    mvpTag:g.mvpTag, blue:g.blue, rec:g.rec||null, solo:M.pendingSolo||null, kept:false,
    // 录像被裁剪后仍保留：每名选手 [选手, 英雄, 击杀, 死亡, 助攻]
    pl:{A:(g.sa||[]).map(x=>[x.tag, x.c, x.k, x.d, x.a]), B:(g.sb||[]).map(x=>[x.tag, x.c, x.k, x.d, x.a])} };
  g.rid = pushReplay(entry);
  delete g.rec;
  M.pendingSolo = null;
}
function setupDraft(blue){
  const M=UI.match;
  Watch.stop();
  clearBpSplash();
  M.draft = newDraft(M.item.m.a, M.item.m.b, blue, M.locked);
  setDraftCtx(M, M.draft);
  M.phase = 'draft'; M.sel = null; M.roleSel = null; M.swapFrom = null; M._lastPh = -1;
  cancelAiDraft();
  queueAI();
}

// 英雄角标含义解析（用于桌面端悬停浮层 & 手机端点击详情，不带括号数字）
const TAG_CN = {engage:'开团',poke:'消耗',pick:'抓单',scale:'后期',protect:'保护',split:'分推',early:'前期'};
const DMG_CN = {AD:'物理伤害',AP:'法术伤害',MIX:'混合伤害'};
function champBadgeInfo(d, M, k){
  const ch = CH[k]; if(!ch) return { badges:[], metaText:'' };
  const opp = M.me==='A'?'B':'A';
  const myLu = lineupMap(d[M.me]), oppLu = lineupMap(d[opp]);
  const badges = [];
  if((S.meta[k]||0) >= 2) badges.push({ icon:ico('flame','c-t0'), cls:'t0', text:'版本 T0 强势英雄，当前版本强度极高' });
  else if((S.meta[k]||0) === 1) badges.push({ icon:ico('up','c-t1'), cls:'t1', text:'版本 T1 热门英雄，版本契合度良好' });
  for(const r of ROLES){
    if(d.picks[M.me][r]) continue;
    const p = myLu[r]; if(!p) continue;
    const ti = proTier(p, k);
    if(ti.tier >= 2){
      const pIco = ti.tier>=4 ? ico('crown','c-gold') : ti.tier===3 ? ico('pick','c-teal') : ico('bolt','c-ice');
      badges.push({ icon: pIco, cls:'mine', text:`我方 ${ROLE_CN[r]} ${playerTag(p)} · ${ti.name}英雄` });
    }
  }
  for(const r of ROLES){
    if(d.picks[opp][r]) continue;
    const p = oppLu[r]; if(!p) continue;
    const pv = champProfVal(p, k);
    const ti = proTier(p, k, pv);
    if(ti.tier >= 4 || (ti.tier >= 3 && pv >= 80)){
      badges.push({ icon:ico('warn','c-red'), cls:'opp', text:`对手 ${ROLE_CN[r]} ${playerTag(p)} 的${ti.tier>=4?'招牌':'拿手'}英雄，建议针对` });
    }
  }
  const metaText = `${ch.roles.map(r=>ROLE_CN[r]).join(' / ')} · ${DMG_CN[ch.dmg]||ch.dmg} · ${ch.tags.map(t=>TAG_CN[t]||t).join(' / ')}`;
  return { badges, metaText };
}
// 推进 BP：玩家回合开 30 秒时钟；对手回合排一个绑定 match + draft + step 的思考计时，同一步重复调用只保留一个
function queueAI(){
  const M=UI.match; if(!M||M.phase!=='draft'||!M.draft){ cancelAiDraft(); return; }
  const d=M.draft, cur=draftSide(d);
  if(!cur){ stopBpClock(); M.phase='ready'; M.sel=null; render(); return; }
  if(cur.side===M.me){ cancelAiDraft(); resetBpClock(); return; }
  const k=_aiDraftKey;
  if(_aiDraftTimer && k && k.M===M && k.d===d && k.step===d.step) return;
  cancelAiDraft();
  const step=d.step, ms=aiDraftWaitMs();
  resetBpClock(Math.ceil(ms/1000), true);
  const key={M, d, step};
  _aiDraftKey=key;
  _aiDraftTimer=setTimeout(()=>{
    if(_aiDraftKey!==key) return;
    _aiDraftTimer=null; _aiDraftKey=null;
    runAiDraftStep(M, d, step);
  }, ms);
}
function aiDraftChoice(d, deep){
  if(deep){ try{ const ch=aiChoose(d, {lookahead:true}); if(ch && ch.c) return ch; }catch(e){ if(typeof console!=='undefined') console.warn('[BP] 深思考选择失败，改用常规选择', e); } }
  return aiChoose(d);
}
function runAiDraftStep(M, d, step){
  if(UI.match!==M || M.phase!=='draft' || M.draft!==d || d.step!==step) return;
  const cur=draftSide(d);
  if(!cur || cur.side===M.me) return;
  let ch=aiDraftChoice(d, true);
  let ok=!!(ch && ch.c) && draftAct(d, ch.c, ch.role, ch.offrole);
  if(!ok){ ch=aiDraftChoice(d, false); ok=!!(ch && ch.c) && draftAct(d, ch.c, ch.role, ch.offrole); }
  if(!ok){ if(typeof console!=='undefined') console.warn('[BP] 对手无法完成本步', step); return; }
  if(cur.kind==='pick') optimizeAiFlex(d, cur.side);
  triggerLockFlash(cur.kind, ch.c);
  queueAI();
  render();
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
    const pv = c ? champProfVal(p, c) : 0;
    const ti = c ? proTier(p, c, pv) : null;
    const offRole = c && !CH[c].roles.includes(r);
    const okKind = offRole ? offRoleKind(c, r).kind : 'native';
    const fitTag = !c ? '' : offRole
      ? (okKind!=='mismatch' ? `<span class="fit-badge flex">奇招·${ti.name}</span>` : `<span class="fit-badge bad">跨位·${ti.name}</span>`)
      : `<span class="fit-badge ${ti.tier>=4?'sig':ti.tier>=2?'ok':ti.tier===1?'fam':'low'}">${ti.name}</span>`;
    const swapAttr = canSwap && (c || M.swapFrom) ? `data-a="dSwap" data-r="${r}"` : '';
    const fT = p ? formTier(p) : 0, mT = p ? mentalTier(p) : 0;
    const trList = p ? playerTraits(p).tags.map(x=>x.t) : [];
    const hoverInfo = p ? `${playerTag(p)} · 状态:${FORM_TIERS[fT+2]} · 心态:${MENTAL_TIERS[mT+2]}${trList.length?' · 特质:'+trList.join('/'):''}${canSwap?'（点击可摇摆换位）':''}` : '';
    // BP 内选手槽位极简状态提示（仅高/低异常状态显示小圆点，完整状态/心态/特质悬停可见，避免堆叠冗杂）
    const miniDot = !p ? '' : fT>=2 ? `<i class="st-dot hot" title="${esc(hoverInfo)}"></i>` : fT<=-2 ? `<i class="st-dot cold" title="${esc(hoverInfo)}"></i>` : mT<=-2 ? `<i class="st-dot tilt" title="${esc(hoverInfo)}"></i>` : '';

    return `<div class="pk-slot ${c?'locked':''} ${isPreview?'picking':''} ${isSwapSrc?'swap-src':''} ${isSwapTarget?'swap-dst':''} ${canSwap&&(c||M.swapFrom)?'swappable':''}" ${swapAttr} title="${esc(hoverInfo)}">
      <div class="pk-ava-wrap">
        ${c ? champAvatar(c,'sm')
            : (isPreview && isMe && M.sel) ? `${champAvatar(M.sel,'sm preview')}<span class="preview-tag">预选</span>`
            : `<div class="c-ava empty sm"><span class="role-ico">${ROLE_SVG[r]}</span></div>`}
      </div>
      <div class="pk-meta">
        <div class="pk-top">
          <span class="pk-role">${ROLE_SVG[r]}</span>
          <b class="pk-player">${p?esc(playerTag(p)):'—'}</b>
          ${miniDot}
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
  const chem = teamChemistry(key);
  const totalDmg = Math.max(1, ci.ad + ci.ap);
  const adPct = pickedList.length ? Math.round(ci.ad/totalDmg*100) : 50;
  const apPct = 100 - adPct;

  return `<aside class="hex-side ${isBlue?'blue':'red'} ${cur&&cur.side===side?(cur.kind==='ban'?'active-ban':'active-pick'):''}">
    <div class="side-head">
      <div class="side-id">
        <span class="side-badge ${isBlue?'blue':'red'}">${isBlue?'蓝方':'红方'}</span>
        <span class="ord-badge">${d.first===side?'先手':'后手'}</span>
        <span class="chem-mini ${chem.cls}" title="团队化学反应：${chem.label}">${ico('chem')}${chem.score}</span>
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
        ${pickedList.length?`<span class="style-chip">${STYLE_CN[ci.style]}阵</span>`:''}
        ${ci.notes.slice(0,2).map(n=>`<span class="note-chip ${/缺乏|纯/.test(n)?'warn':''}">${esc(n)}</span>`).join('')}
      </div>
      ${canSwap?`<div class="swap-hint">${M.swapFrom?`已选中 <b>${ROLE_CN[M.swapFrom]}</b>，点另一槽位互换`:`${ico('transfer')} 点己方槽位可摇摆换位`}</div>`:''}
    </div>
  </aside>`;
}

// BP 实时面板：只展示后端 draftFeedback 的结论（胜率 / 最近一步变化 / 双方关键优劣），UI 不自行算分
function bpFeedbackData(M, d, cur){
  if(!d || typeof draftFeedback!=='function') return null;
  const myTurn = cur && cur.side===M.me;
  let fb = null, preview = false;
  try{
    if(myTurn && M.sel && CH[M.sel] && !unavailable(d).has(M.sel)){
      let role = null, ok = true;
      if(cur.kind==='pick'){
        const chk = canPickChamp(d, M.me, M.sel);
        ok = chk.ok;
        // 与「确认选择」落位规则一致：手动指定位置优先，否则按最佳位置
        if(ok) role = (M.roleSel && chk.openRoles.includes(M.roleSel)) ? M.roleSel : bestRoleFor(d, M.me, M.sel, chk.offrole);
      }
      if(ok){
        fb = draftFeedback(d, M.sel, role);
        preview = !!(fb && fb.last && fb.last.champ===M.sel && fb.last.kind===cur.kind && fb.last.side===cur.side);
        if(!preview) fb = null;
      }
    }
    if(!fb) fb = draftFeedback(d);
  }catch(e){ return null; }
  if(!fb || !Number.isFinite(Number(fb.pA))) return null;
  return { fb, preview };
}
function fbNotes(side){
  const s = side || {};
  return { adv:(Array.isArray(s.advantages)?s.advantages:[]).filter(Boolean), risk:(Array.isArray(s.risks)?s.risks:[]).filter(Boolean) };
}
function bpFeedbackHtml(M, d, cur, leftSide){
  const res = bpFeedbackData(M, d, cur); if(!res) return '';
  const { fb, preview } = res;
  const rightSide = leftSide==='A' ? 'B' : 'A';
  const pA = clamp(Number(fb.pA), 0, 1);
  const leftP = Math.round((leftSide==='A' ? pA : 1-pA)*100), rightP = 100-leftP;
  const myD = (Number(fb.deltaA)||0) * (M.me==='A' ? 1 : -1) * 100;
  const last = fb.last && fb.last.champ ? fb.last : null;
  const who = s => s===M.me ? '我方' : '对手';
  const act = k => k==='ban' ? '禁用' : '选择';
  let lastTxt, dTxt = '';
  if(last){
    lastTxt = preview ? `若${act(last.kind)}「${esc(champName(last.champ))}」` : `${who(last.side)}${act(last.kind)}「${esc(champName(last.champ))}」`;
    if(Math.abs(myD) < 0.05) dTxt = `<span class="fb-d flat">胜率无变化${last.kind==='ban' && fb.banReason ? ` · ${esc(fb.banReason)}` : ''}</span>`;
    else dTxt = `<span class="fb-d ${myD>0?'up':'dn'}">我方胜率 ${myD>0?'+':''}${myD.toFixed(1)}%</span>`;
  } else lastTxt = '尚未选禁：按双方首发与先手的初始预测';
  const sideHtml = (side, isBlue) => {
    const n = fbNotes(fb[side]);
    const chips = [...n.adv.slice(0,3).map(t=>`<span class="fb-chip adv">${esc(t)}</span>`), ...n.risk.slice(0,2).map(t=>`<span class="fb-chip risk">${esc(t)}</span>`)];
    return `<div class="fb-side ${isBlue?'blue':'red'}"><b>${isBlue?'蓝方':'红方'} ${esc((T(d[side])||{}).short||d[side]||'')}${side===M.me?' <em>我方</em>':''}</b>${chips.length?chips.join(''):'<span class="fb-none">暂无明显优劣</span>'}</div>`;
  };
  return `<div class="bp-fb ${preview?'is-preview':''}">
    <div class="fb-hd">
      <span class="fb-st ${preview?'pv':'now'}">${preview?'选择预览':'实时'}</span>
      <span class="fb-st ${fb.partial?'est':'fin'}" title="${fb.partial?'阵容未完成，胜率为暂估':'阵容已完整'}">${fb.partial?'暂估':'阵容完整'}</span>
      <span class="fb-last">${lastTxt}</span>${dTxt}
      <span class="fb-prob" title="${fb.partial?'暂估':'预测'}胜率（左蓝右红）"><b class="bl">${leftP}%</b><span class="prob-track"><span class="bl" style="width:${leftP}%"></span><span class="rd" style="width:${rightP}%"></span></span><b class="rd">${rightP}%</b></span>
    </div>
    <div class="fb-cols">${sideHtml(leftSide, true)}${sideHtml(rightSide, false)}</div>
  </div>`;
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
      ${d&&M.phase!=='live'?`<div class="ph-track">${stepPills}</div>`:''}
      <div class="fearless-row">
        <button class="fl-btn ${M.showLocked?'on':''}" data-a="toggleLocked">${ico('chain')} 无畏征召已锁 <b>${M.locked.length}</b> 名英雄 ${M.locked.length?(M.showLocked?'▲':'▼'):''}</button>
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

  // -------- 阶段 0A：赛前峡谷 1v1 SOLO 选边出战配置 --------
  if(M.phase==='solo_pick'){
    const myKey = m[M.me==='A'?'a':'b'], oppKey = m[opp==='A'?'a':'b'];
    const myLu = lineupMap(myKey);
    const curPl = myLu[M.soloMyRole] || Object.values(myLu)[0];
    // 推荐列表：当前选手招牌英雄 + 该位置常见 SOLO 英雄
    const sigs = (curPl && curPl.champs ? curPl.champs.slice().sort((a,b)=>b.p-a.p).map(x=>x.c) : []);
    const roleChamps = CHAMP_KEYS.filter(k=>CH[k].roles.includes(M.soloMyRole) && !sigs.includes(k)).slice(0, 12);
    const soloChamps = [...sigs, ...roleChamps];

    return `<div class="match hex mode-choose">${head}
      <div class="hex-panel solo-panel">
        <div class="hex-eyebrow">系列赛首局选边战 · 峡谷 1v1 SOLO</div>
        <h2>派出你的单挑王争夺选边权</h2>
        <p class="hex-sub">规则：中路 1v1 单挑，率先拿到 <b>一血</b>、<b>100 补刀</b> 或 <b>推掉一塔</b> 的选手获胜；10 分钟后火圈收缩，12 分钟前必分胜负，所在战队获得本局蓝/红方选边权（蓝色方永远为 BP 先手）。</p>
        <div class="solo-setup">
          <div class="solo-box">
            <h4>1. 选择出战选手（${teamName(myKey)}）</h4>
            <div class="solo-players">${ROLES.map(r=>{
              const p = myLu[r]; if(!p) return '';
              const on = M.soloMyRole===r;
              return `<button class="sp-btn ${on?'on':''}" data-a="soloRole" data-r="${r}">
                <span class="sp-r">${ROLE_SVG[r]}${ROLE_CN[r]}</span>
                <b>${esc(playerTag(p))}</b>
              </button>`;
            }).join('')}</div>
          </div>
          <div class="solo-box">
            <h4>2. 选择出战英雄（已自动推荐招牌）</h4>
            <div class="solo-champs">${soloChamps.map(c=>{
              const isSig = sigs.includes(c);
              const on = M.soloMyChamp===c;
              return `<button class="sc-btn ${on?'on':''}" data-a="soloChamp" data-c="${esc(c)}">
                ${champAvatar(c,'xs')}
                <span>${esc(champName(c))}${isSig?' 👑':''}</span>
              </button>`;
            }).join('')}</div>
          </div>
        </div>
        <div class="solo-go-row">
          <button class="lock-btn is-pick big-go" data-a="startSolo">⚔ 开始峡谷 1v1 选边赛</button>
          <button class="hex-btn ghost" data-a="autoSeries">跳过，自动模拟剩余系列赛</button>
        </div>
        ${intelPanel(M)}
      </div>
    </div>`;
  }

  // -------- 阶段 0B：峡谷 1v1 SOLO 实时观战（Canvas 中路对线，1x/2x/4x/8x、暂停、跳过） --------
  if(M.phase==='solo_watch' && !M.solo){
    return `<div class="match hex mode-choose mode-live">${head}
      <div class="hex-panel solo-watch-panel">
        <div class="solo-watch-hd"><span class="hex-eyebrow">⚔ 峡谷 1v1 SOLO 选边赛 · 观战直播</span><span class="w-rules">一血 · 100 补刀 · 一塔 · 10 分钟后火圈收缩</span></div>
        ${Watch.shellSolo()}
      </div>
    </div>`;
  }
  // -------- 阶段 0C：1v1 结果 + 选边 --------
  if(M.phase==='solo_watch' && M.solo){
    const s = M.solo;
    const myWon = s.winner === M.me;
    const card = side => {
      const f = s[side], tKey = side==='A' ? s.teamA : s.teamB, isWin = s.winner===side;
      return `<div class="solo-fighter ${side==='A'?'left':'right'} ${isWin?'winner':'loser'}">
        <div class="sf-top">${champAvatar(f.champ,'md')}
          <div class="sf-id"><div class="sf-team">${teamTag(tKey)} ${side===M.me?'<em class="me-pill">我方</em>':''}</div>
            <div class="sf-name"><b>${esc(f.tag)}</b> · ${esc(champName(f.champ))}</div><div class="sf-role">${ROLE_CN[f.role]||''} · ${f.lvl} 级</div></div></div>
        <div class="sf-substats"><span>🌾 补刀 <b>${f.cs}</b></span><span>${isWin?'🏆 胜者':'败者'}</span></div>
      </div>`;
    };
    return `<div class="match hex ${myWon?'mode-pick':'mode-ban'}">${head}
      <div class="hex-panel solo-watch-panel">
        <div class="solo-watch-hd"><span class="hex-eyebrow">⚔ 峡谷 1v1 SOLO 选边赛</span><span class="solo-done-tag">已完赛 · ${esc(s.winReason)} · ${fmtSec(s.dur)}</span></div>
        <div class="solo-arena">${card('A')}<div class="solo-clock-box"><div class="solo-time">${fmtSec(s.dur)}</div><div class="solo-vs">1 v 1</div><div class="solo-event-pill">${esc(s.winReason)}</div></div>${card('B')}</div>
        <div class="solo-result-bar">
          <h3>🏆 ${esc(s[s.winner].tag)}（${esc(champName(s[s.winner].champ))}）通过「${esc(s.winReason)}」获胜！${teamTag(s.winner==='A'?s.teamA:s.teamB)} 赢得本局选边权</h3>
          ${myWon ? `
            <p class="hex-sub">请你选择本局阵营（蓝色方永远为 BP 先手，红色方永远为 BP 后手）：</p>
            <div class="choose-cards single">
              <button class="hex-choice blue" data-a="chooseSideOnly" data-c="blue"><b>选择 蓝色方</b><small>BP 先手 · 一楼优先抢版本强势英雄</small></button>
              <button class="hex-choice red" data-a="chooseSideOnly" data-c="red"><b>选择 红色方</b><small>BP 后手 · 掌控五楼康特 Counter 位</small></button>
            </div>`
          : `
            <p class="hex-sub">对手已选择 <b>${M.soloAiBlue===opp?'蓝色方（BP 先手）':'红色方（BP 后手）'}</b>，本局你将位于 <b>${M.soloAiBlue===M.me?'蓝色方（BP 先手）':'红色方（BP 后手）'}</b>。</p>
            <button class="lock-btn is-pick" data-a="soloEnterDraft">进入 BP 阶段 ▶</button>`}
        </div>
        ${intelPanel(M)}
        <details class="solo-log"><summary>对线全过程</summary><div class="solo-feed">${s.log.slice().reverse().map(f=>`<div class="solo-line ${f.side==='A'?'sa':f.side==='B'?'sb':''} ${f.hl?'hl':''}"><span class="sl-t">${esc(f.t)}</span><span class="sl-tag">${esc(f.tag)}</span><span class="sl-txt">${esc(f.text)}</span></div>`).join('')}</div></details>
      </div>
    </div>`;
  }

  // -------- 阶段 L：5v5 召唤师峡谷实时观战 --------
  if(M.phase==='live'){
    return `<div class="match hex mode-live">${head}${Watch.shell5()}</div>`;
  }

  // -------- 阶段 1：经典蓝先红后选边（仅在第 2–4 局我方为上一局败者时显示） --------
  if(M.phase==='choose'){
    return `<div class="match hex ${modeCls}">${head}
      <div class="hex-panel choose-panel">
        <div class="hex-eyebrow">经典职业选边规则 · 败者选边</div>
        <h2>你拥有本局选边权</h2>
        <p class="hex-sub">请选择本局地图阵营：<b>蓝色方固定为 BP 先手</b>，<b>红色方固定为 BP 后手（五楼康特位）</b>。</p>
        <div class="choose-cards single">
          <button class="hex-choice blue" data-a="chooseSideOnly" data-c="blue"><b>选择 蓝色方</b><small>BP 先手 · 一楼先抢核心英雄</small></button>
          <button class="hex-choice red" data-a="chooseSideOnly" data-c="red"><b>选择 红色方</b><small>BP 后手 · 握有五楼康特位</small></button>
        </div>
        <div class="choose-foot">
          <button class="hex-btn ghost" data-a="autoSeries">跳过，自动模拟剩余系列赛</button>
        </div>
        ${intelPanel(M)}
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
        <span class="pb-tag">${isBan?`${ico('ban')} 禁用阶段 · BAN`:`${ico('pick')} 选择阶段 · PICK`}</span>
        <b class="pb-msg">${myTurn ? (isBan?'轮到你禁用一名英雄':'轮到你选择一名英雄') : (isBan?`${teamName(d[cur.side])} 正在禁用…`:`${teamName(d[cur.side])} 正在选人…`)}</b>
      </div>
      <div class="pb-clock">
        <span id="bp-clock-num" class="${!M.clockAi && M.clock<=5?'urgent':''}">${String(M.clock).padStart(2,'0')}</span>
        <div class="pb-clock-bar"><i id="bp-clock-fill" style="width:${M.clock/(M.clockMax||30)*100}%"></i></div>
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

    // 选中英雄详情与锁定台（手机/触控轻点英雄即展示全部角标原因，再点右侧独立确认按键锁定）
    let selInfoHtml = `<div class="dock-empty">${myTurn ? (isBan?'轻点上方英雄查看详情，再点右侧「确认禁用」':'轻点上方英雄查看详情，再点右侧「确认选择」') : '等待对手完成本步操作…'}</div>`;
    if(myTurn && M.sel && CH[M.sel]){
      const ch = CH[M.sel];
      const info = champBadgeInfo(d, M, M.sel);
      const rolePickHtml = !isBan ? roleChooser(d, M.me, M.sel) : '';
      let fitLine = '';
      if(isBan){
        const oppMatches = openRolesFor(d, opp).filter(r=>ch.roles.includes(r));
        const threat = oppMatches.map(r=>({r, p:oppLu[r], f:champFit(oppLu[r],M.sel,r)})).sort((a,b)=>b.f-a.f)[0];
        fitLine = threat ? `敌方威胁：${ROLE_CN[threat.r]} ${esc(playerTag(threat.p))} · ${threat.f>=4.5?'招牌绝活':threat.f>=1.5?'熟练':'一般'}` : '对手该位置已锁定或非常规选位';
      } else {
        const chk = canPickChamp(d, M.me, M.sel);
        const r = (M.roleSel && chk.openRoles.includes(M.roleSel)) ? M.roleSel : bestRoleFor(d, M.me, M.sel, true);
        const ti = r ? proTier(myLu[r], M.sel) : null;
        const ok = r ? offRoleKind(M.sel, r).kind : 'native';
        const offDesc = !r || ch.roles.includes(r) ? ''
          : ok==='apc_bot' ? ' · ✨ 法核下路奇招（菜刀队补法伤可获胜率加成）'
          : ok==='ranged_top' ? ' · ✨ 长手上路奇招（对阵笨重短手前排可获对线压制加成）'
          : ok!=='mismatch' ? ' · ✨ 战术摇摆选位' : ' · ⚠️ 非常规跨位（存在轻度胜率惩罚）';
        fitLine = r ? `分配给 ${ROLE_CN[r]} ${esc(playerTag(myLu[r]))} · 熟练档位：${ti.icon?ti.icon+' ':''}${ti.name}${offDesc}` : '';
      }
      selInfoHtml = `<div class="dock-sel">
        ${champAvatar(M.sel,'sm')}
        <div class="dock-meta">
          <div class="dock-name"><b>${esc(ch.cn)}</b> <small>${esc(info.metaText)}</small></div>
          <div class="dock-fit">${fitLine}</div>
          ${info.badges.length?`<div class="dock-badges">${info.badges.map(b=>`<span class="dbadge ${b.cls}">${b.icon} ${esc(b.text)}</span>`).join('')}</div>`:''}
          ${rolePickHtml}
        </div>
      </div>`;
    }

    center = `<section class="hex-center ${isBan?'stage-ban':'stage-pick'}">
      ${bpFeedbackHtml(M, d, cur, leftSide)}
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
        // 计算我方未选位置选手对该英雄的最高熟练度档位（同时展示 👑招牌 / ◆精通 / ✦熟练）
        let bestMyTier = 0, bestMyIcon = '', bestMyCls = '';
        for(const r of ROLES){
          if(d.picks[M.me][r] || !myLu[r]) continue;
          const ti = proTier(myLu[r], k);
          if(ti.tier > bestMyTier){ bestMyTier = ti.tier; bestMyIcon = ti.icon; bestMyCls = ti.cls; }
        }
        const oppSig = ROLES.find(r=>{ if(d.picks[opp][r] || !oppLu[r]) return false; const v = champProfVal(oppLu[r], k); if(v < 80) return false; return proTier(oppLu[r], k, v).tier>=3; });
        const stamp = isLocked ? `<span class="c-stamp fl">无畏锁</span>`
                    : isBanned ? `<span class="c-stamp bn">已禁</span>`
                    : isPicked ? `<span class="c-stamp pk">已选</span>` : '';
        return `<div class="ch-card ${dis?'dis':''} ${bestMyTier>=2&&!dis?'my-prof':''} ${sel?(isBan?'sel-ban':'sel-pick'):''}" data-ch="${esc(k)}" ${dis||!myTurn?'':`data-a="dSel" data-c="${esc(k)}"`}>
          <div class="ch-thumb">
            ${champAvatar(k,'grid')}
            ${S.meta[k]>=2?`<span class="meta-dot t0">${ico('flame')}</span>`:S.meta[k]>=1?`<span class="meta-dot t1">${ico('up')}</span>`:''}
            ${bestMyTier>=2?`<span class="sig-dot mine ${bestMyCls}">${bestMyTier>=4?ico('crown'):bestMyTier===3?ico('pick'):ico('bolt')}</span>`:''}
            ${oppSig?`<span class="sig-dot opp ${bestMyTier>=2?'shift':''}">${ico('warn')}</span>`:''}
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
            ${isBan ? (M.sel?`${ico('ban')} 确认禁用 · ${esc(champName(M.sel))}`:`${ico('ban')} 确认禁用`)
                    : (M.sel?`${ico('pick')} 确认选择 · ${esc(champName(M.sel))}`:`${ico('pick')} 确认选择`)}
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
    const rfb = bpFeedbackData(M, d, null);
    const rcNotes = (side, E) => {
      const n = rfb ? fbNotes(rfb.fb[side]) : null;
      if(n && (n.adv.length || n.risk.length)) return `<div class="rc-chips">${n.adv.map(t=>`<span class="fb-chip adv">${esc(t)}</span>`).join('')}${n.risk.map(t=>`<span class="fb-chip risk">${esc(t)}</span>`).join('')}</div>`;
      return `<p>${E.comp.notes.length?E.comp.notes.map(esc).join(' · '):'均衡常规阵'}</p>`;
    };
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
          ${rcNotes(leftSide, leftE)}
        </div>
        <div class="rc-vs">${se>0?'◀ 体系克制':se<0?'体系克制 ▶':'体系均势'}</div>
        <div class="rc-card red">
          <h4>${teamName(rightTeam)} · ${STYLE_CN[rightE.comp.style]}阵</h4>
          ${rcNotes(rightSide, rightE)}
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
          <tr><th>位置</th><th>选手</th><th>英雄</th><th>K/D/A</th><th>补刀</th><th>经济</th><th>参团</th></tr>
          ${rows.map(x=>{
            const kp = Math.min(100, Math.round((x.k+x.a)/totK*100));
            return `<tr class="${x.pid===g.mvp?'is-mvp':''}">
              <td>${ROLE_CN[x.r]}</td>
              <td><b>${esc(x.tag||x.pid||'')}</b>${x.pid===g.mvp?' <span class="mvp-b">MVP</span>':''}</td>
              <td class="td-ch">${champAvatar(x.c,'xs')}<span>${esc(champName(x.c))}</span></td>
              <td class="td-kda">${x.k}/${x.d}/${x.a}</td>
              <td>${x.cs!=null?x.cs:'-'}</td>
              <td>${x.gold!=null?(x.gold/1000).toFixed(1)+'k':'-'}</td>
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

      ${masteryChipsHtml(g.masteryChanges)}
      ${impactsWithoutMastery(g).length ? `<div class="impact-box">
        ${impactsWithoutMastery(g).map(s=>`<span class="imp-chip">✦ ${esc(s)}</span>`).join('')}
      </div>` : ''}

      <div class="ready-actions">
        ${g.rid && findReplay(g.rid) && findReplay(g.rid).rec ? `<button class="hex-btn ghost" data-a="openReplay" data-id="${esc(g.rid)}">▶ 观看本局回放</button>` : ''}
        ${fin
          ? `<div class="series-fin">系列赛结束：${teamTag(m.a)} <b>${M.wa} : ${M.wb}</b> ${teamTag(m.b)}</div>
             <button class="lock-btn is-pick" data-a="finishSeries">确认赛果并返回 ▶</button>`
          : `<button class="lock-btn is-pick" data-a="nextGame">进入第 ${M.games.length+1} 局（无畏征召累计锁定 ${M.locked.length} 人）▶</button>`}
      </div>
    </section>`;
  }

  // 阶段切换（Ban <-> Pick）触发独立瞬态过场动画层（挂载于 body，严格 1 秒自动消失，绝不因重绘残留）
  if(M.phase === 'draft' && cur && phIdx >= 0 && phIdx <= 3){
    if(M._lastPh !== phIdx){
      M._lastPh = phIdx;
      triggerBpSplash(cur.kind, phIdx);
    }
  }

  return `<div class="match hex bp-fit ${modeCls}">
    ${head}
    ${banBar}
    <div class="draft-lol">
      ${renderSideColumn(M, d, leftSide, cur, true)}
      ${center}
      ${renderSideColumn(M, d, rightSide, cur, false)}
    </div>
    <div id="ch-tip" class="ch-tip" style="display:none"></div>
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
  view:d=>{ if(['replays','rules','sys'].includes(d.v)){ UI.setTab=d.v; UI.view='settings'; } else UI.view=d.v; UI.evSel=null; render(); },
  setTab:d=>{ UI.setTab=d.t; render(); },
  dbRegion:d=>{ UI.db={region:d.r, team:null}; render(); },
  dbTeam:d=>{ const t=T(d.k); UI.db={region:t?t.region:(UI.db||{}).region, team:d.k}; render(); },
  dbPlayer:d=>{ UI.modal=dbPlayerModal(d.p); render(); },
  rsPlayer:d=>{ UI.modal=dbPlayerModal(d.p,{manage:true}); render(); },
  authTab:d=>{ UI.authTab=d.t; UI.verifyEmail=null; render(); },
  cancelOtp:()=>{ UI.verifyEmail=null; render(); },
  enterGuest:()=>{ UI.entry='lobby'; UI.pickTeam=false; UI.verifyEmail=null; render(); },
  enterLobby:()=>{ UI.entry='lobby'; UI.pickTeam=false; render(); },
  backToGate:()=>{ UI.entry='gate'; UI.pickTeam=false; render(); },
  showNewTeam:()=>{ UI.pickTeam=true; render(); },
  cancelNewTeam:()=>{ UI.pickTeam=false; render(); },
  newgame:d=>{ newGame(d.k); save(); UI.view='home'; UI.pickTeam=false; render(); },
  continue:async()=>{ if(await load()){ render(); if(CloudSync.isLoggedIn()) CloudSync.syncOnLaunch(false); } else toast('未找到本地存档'); },
  openAccount:()=>{ if(S){ UI.view='settings'; UI.setTab='sys'; UI.modal=null; render(); } else { UI.entry='gate'; render(); } },
  cloudSignIn:async()=>{
    const email = (document.getElementById('auth-email')||{}).value || '';
    const pass = (document.getElementById('auth-pass')||{}).value || '';
    const prevS = S;
    UI.authBusy = true; render();
    if(!S && UI.hasSave) await load();
    const res = await CloudSync.signIn(email, pass);
    UI.authBusy = false;
    if(!res.ok){
      S = prevS;
      if(res.unconfirmed && res.email){
        UI.verifyEmail = res.email;
      }
    } else {
      UI.verifyEmail = null;
      if(!S && !CloudSync.conflict){ UI.entry = 'lobby'; UI.pickTeam = false; }
      else if(S){ UI.savePreview = makeSaveSummary(S); }
    }
    toast(res.msg); render();
  },
  cloudSignUp:async()=>{
    const email = (document.getElementById('auth-email')||{}).value || '';
    const pass = (document.getElementById('auth-pass')||{}).value || '';
    const pass2 = (document.getElementById('auth-pass2')||{}).value || '';
    if(!pass || pass.length < 6){ toast('密码长度至少需要 6 位'); return; }
    if(pass !== pass2){ toast('两次输入的密码不一致，请重新核对'); return; }
    const prevS = S;
    UI.authBusy = true; render();
    if(!S && UI.hasSave) await load();
    const res = await CloudSync.signUp(email, pass);
    UI.authBusy = false;
    if(!res.ok){
      S = prevS;
    } else if(res.needConfirm){
      S = prevS;
      UI.verifyEmail = res.email || email.trim();
      startResendCd(60);
    } else {
      UI.verifyEmail = null;
      if(!S && !CloudSync.conflict){ UI.entry = 'lobby'; UI.pickTeam = false; }
      else if(S){ UI.savePreview = makeSaveSummary(S); }
    }
    toast(res.msg); render();
  },
  cloudVerifyOtp:async()=>{
    const token = (document.getElementById('auth-otp')||{}).value || '';
    const email = UI.verifyEmail;
    const prevS = S;
    UI.authBusy = true; render();
    if(!S && UI.hasSave) await load();
    const res = await CloudSync.verifySignupOtp(email, token);
    UI.authBusy = false;
    if(!res.ok){
      S = prevS;
    } else {
      UI.verifyEmail = null;
      if(!S && !CloudSync.conflict){ UI.entry = 'lobby'; UI.pickTeam = false; }
      else if(S){ UI.savePreview = makeSaveSummary(S); }
    }
    toast(res.msg); render();
  },
  cloudResendOtp:async()=>{
    if(!UI.verifyEmail || UI.resendCd > 0) return;
    UI.authBusy = true; render();
    const res = await CloudSync.resendSignupOtp(UI.verifyEmail);
    UI.authBusy = false;
    if(res.ok) startResendCd(60);
    toast(res.msg); render();
  },
  cloudSignOut:async()=>{
    UI.authBusy = true; render();
    await CloudSync.signOut();
    UI.authBusy = false;
    if(!S){ UI.entry = 'gate'; }
    toast('已退出登录，当前为游客模式'); render();
  },
  cloudSyncNow:async()=>{
    UI.authBusy = true; render();
    const res = await CloudSync.syncOnLaunch(true);
    UI.authBusy = false;
    toast(res.msg || '同步完成'); render();
  },
  resolveConflict:async d=>{
    const res = await CloudSync.resolveConflict(d.c);
    if(S) UI.savePreview = makeSaveSummary(S);
    toast(res.msg || '同步完成');
  },
  cloudPushNow:async()=>{
    if(!S) return;
    UI.authBusy = true; render();
    const res = await CloudSync.syncOnLaunch(true,{preferLocal:true});
    UI.authBusy = false;
    toast(res.msg || '同步完成'); render();
  },
  offTab:d=>{ UI.offTab=d.t; render(); },
  selTrainPid:d=>{ UI.trainPid=d.p; render(); },
  toggleTrain:d=>{ toggleTrainChamp(d.p, d.c); save(); render(); },
  closeModal:()=>{ UI.modal=null; UI.offerCash=null; UI.offerCashRaw=null; UI.offerGive=null; render(); },
  endWindow:()=>{ if(isRosterSetup(curEvent())) return ACT.finishSetup(); curEvent().done=true; aiTransfers(4); advanceEvent(); save(); render(); },
  finishSetup:()=>{ const r=finishRosterSetup(); if(r.ok) save(); toast(r.msg); },
  nextEvent:()=>{ advanceEvent(); save(); render(); },
  renew:d=>{ renewPlayer(d.p); save(); render(); },
  newSeason:()=>{ finishOffseason(); save(); render(); toast(`${S.year} 赛季开始！`); },
  toMyMatch:()=>{
    const ps = lineupProblems(S.user);
    if(ps.length){ toast('无法开赛：'+ps.join('；')); return; }
    const it=simUntilUser(false); save(); if(it && userInvolved(it.m)) beginUserMatch(it); else render();
  },
  dismissUpdate:()=>{ UI.hideUpdateBanner=true; render(); },
  checkAppUpdate:async()=>{
    if(typeof AppUpdater === 'undefined') return;
    toast('正在检查云端版本…');
    const r = await AppUpdater.check(true);
    UI.hideUpdateBanner = false;
    toast(r.hasUpdate ? `发现新版本 v${r.version}！` : r.msg || '当前已是最新版本');
    render();
  },
  simStage:()=>{
    const ps = lineupProblems(S.user);
    if(ps.length){ toast('请先修复阵容问题：'+ps.join('；')); return; }
    const res = simCurrentRound();
    save(); render();
    if(res.userMatches && res.userMatches.length){
      const u = res.userMatches[res.userMatches.length - 1];
      toast(`本轮模拟完毕：${u.won?'胜':'负'} ${teamName(u.a)} ${u.s[0]}:${u.s[1]} ${teamName(u.b)}（共 ${res.played} 场）`);
    } else if(res.played > 0){
      toast(`本轮 ${res.played} 场比赛模拟完毕`);
    }
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
  offer:d=>{ clearTimeout(UI._t); UI.offerCash=null; UI.offerCashRaw=null; UI.offerGive=null; UI.modal=offerModal(d.p); render(); },
  doOffer:d=>{ const p=P(d.p); const cash=p.team?offerCashNow(p):0; const r=makeOffer(d.p,cash,UI.offerGive||null); if(r.ok){ UI.modal=null; UI.offerCash=null; UI.offerCashRaw=null; UI.offerGive=null; save(); } toast(r.msg); render(); },
  export:()=>{ UI.modal=()=>`<h3>导出存档</h3><p>复制下面的文本保存到本地文件（.json），以后可用“导入存档”恢复。</p><textarea id="expt" readonly style="width:100%;height:200px">${esc(JSON.stringify(S))}</textarea><div class="btns"><button class="btn" data-a="copyExp">复制</button><button class="btn ghost" data-a="dlExp">下载文件</button><button class="btn ghost" data-a="closeModal">关闭</button></div>`; render(); },
  copyExp:()=>{ const t=document.getElementById('expt'); navigator.clipboard.writeText(t.value).then(()=>toast('已复制'),()=>{ t.select(); toast('请手动复制选中的文本'); }); },
  dlExp:()=>{ try{ const b=new Blob([JSON.stringify(S)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`lol-manager-${S.year}.json`; a.click(); }catch(e){ toast('当前环境不支持下载，请用复制'); } },
  reset:()=>{ UI.modal=()=>`<h3>确定删除存档并重新开始？</h3><div class="btns"><button class="btn" data-a="doReset">确定删除</button><button class="btn ghost" data-a="closeModal">取消</button></div>`; render(); },
  doReset:async()=>{ await StorageBridge.deleteSave(); UI.hasSave=false; UI.savePreview=null; S=null; UI.modal=null; UI.entry='lobby'; UI.pickTeam=true; render(); },
  // ---- 比赛 / 1v1 / BP 交互 ----
  toggleLocked:()=>{ if(UI.match){ UI.match.showLocked=!UI.match.showLocked; render(); } },
  soloRole:d=>{
    const M=UI.match; if(!M) return;
    M.soloMyRole = d.r;
    const myLu = lineupMap(M.item.m[M.me==='A'?'a':'b']);
    const p = myLu[d.r];
    M.soloMyChamp = (p && p.champs && p.champs.length) ? p.champs.slice().sort((a,b)=>b.p-a.p)[0].c : (CHAMP_KEYS.find(k=>CH[k].roles.includes(d.r)) || CHAMP_KEYS[0]);
    render();
  },
  soloChamp:d=>{ if(UI.match){ UI.match.soloMyChamp = d.c; render(); } },
  startSolo:()=>{
    const M=UI.match, m=M.item.m, me=M.me, op=me==='A'?'B':'A';
    const myTeamKey = m[me==='A'?'a':'b'], oppTeamKey = m[op==='A'?'a':'b'];
    const myLu = lineupMap(myTeamKey);
    const myPl = myLu[M.soloMyRole];
    const myPick = { role: M.soloMyRole, pid: myPl?myPl.pid:null, champ: M.soloMyChamp };
    const oppPick = defaultSoloPick(oppTeamKey);
    const g = me==='A' ? createSolo(m.a, m.b, myPick, oppPick, {record:true}) : createSolo(m.a, m.b, oppPick, myPick, {record:true});
    M.solo = null;
    M.phase = 'solo_watch';
    Watch.start({ kind:'solo', g, teamA:m.a, teamB:m.b, me, onEnd: w=>{
      if(UI.match!==M) return;
      const res = soloResult(w.g);
      M.solo = res;
      M.chooser = res.winner;
      M.pendingSolo = soloReplayData(res);
      if(M.chooser !== me){
        const opSide = aiChooseSide(oppTeamKey, myTeamKey, M.locked);
        M.soloAiBlue = opSide === 'blue' ? op : me;
      }
      render();
    }});
    render();
  },
  wSpeed:d=>{ Watch.control('speed', d.v); render(); },
  wPause:()=>{ Watch.control('pause'); render(); },
  wTab:()=>{ Watch.control('tab'); render(); },
  wPane:d=>{ Watch.control('pane', d.v); render(); },
  wSkip:()=>{ Watch.control('skip'); },
  wExit:()=>{ Watch.stop(); UI.replay=null; render(); },
  openReplay:d=>{
    const r = findReplay(d.id);
    if(!r || !(r.rec || r.solo)){ toast('这局只保留了比分数据，没有回放'); return; }
    UI.modal = null;
    UI.replay = { id:r.id, kind: d.k==='solo' || !r.rec ? 'solo' : 'g5' };
    startReplayWatch(r, UI.replay.kind);
    render();
  },
  replayKind:d=>{ const r = UI.replay && findReplay(UI.replay.id); if(!r) return; UI.replay.kind = d.k; startReplayWatch(r, d.k); render(); },
  keepReplay:d=>{ const res = toggleKeepReplay(d.id); toast(res.msg); if(res.ok) save(); render(); },
  soloEnterDraft:()=>{
    const M=UI.match; if(!M) return;
    const blue = M.soloAiBlue || (M.me==='A'?'B':'A');
    setupDraft(blue);
    render();
  },
  chooseSideOnly:d=>{
    const M=UI.match, me=M.me, op=me==='A'?'B':'A';
    const blue = d.c==='blue' ? me : op;
    setupDraft(blue);
    render();
  },
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
      const lockedC = M.sel;
      M.sel=null; M.roleSel=null; M.swapFrom=null;
      triggerLockFlash(cur.kind, lockedC);
      queueAI(); render();
    } else toast('该英雄无法选择（没有空余对应位置）');
  },
  dAuto:()=>{ const M=UI.match; stopBpClock(); autoDraftRest(M.draft); M.phase='ready'; M.sel=null; M.swapFrom=null; render(); },
  playGame:()=>{
    const M=UI.match; if(!M||!M.draft) return;
    stopBpClock();
    const G = createGame5(M.draft, {record:true});
    M.phase = 'live';
    Watch.start({ kind:'g5', g:G, me:M.me, onEnd: w=>{
      if(UI.match!==M) return;
      const g = game5Result(w.g);
      storeUserReplay(M, g);
      endUserGame(g);
      render();
    }});
    render();
  },
  nextGame:()=>{ const M=UI.match; enterNextGamePhase(M); render(); },
  autoSeries:()=>{
    const M=UI.match; const m=M.item.m; const need=Math.ceil(m.bo/2);
    stopBpClock(); Watch.stop();
    const play = d => { const g = playGame(d, {record:true}); storeUserReplay(M, g); endUserGame(g); };
    if(M.phase==='draft'||M.phase==='ready'){ autoDraftRest(M.draft); play(M.draft); }
    while(M.wa<need&&M.wb<need){
      if(!M.chooser){ const r = simSolo1v1(m.a, m.b, null, null, {record:true}); M.chooser = r.winner; M.pendingSolo = soloReplayData(r); }
      const other = M.chooser==='A'?'B':'A';
      const sidePick = aiChooseSide(m[M.chooser==='A'?'a':'b'], m[other==='A'?'a':'b'], M.locked);
      const blue = sidePick==='blue' ? M.chooser : other;
      const d=newDraft(m.a,m.b,blue,M.locked); setDraftCtx(M, d); autoDraftRest(d); play(d);
    }
    ACT.finishSeries();
    // 自动模拟结算：直接打开本系列赛详情，展示每局实际熟练度增加量
    if(m.id && Array.isArray(m.gm) && m.gm.some(g=>g && Array.isArray(g.masteryChanges) && g.masteryChanges.length)){ UI.modal = matchDetail(m.id); render(); }
  },
  finishSeries:()=>{
    const M=UI.match; const m=M.item.m;
    stopBpClock(); Watch.stop();
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
  if(el.dataset.o==='give'){ UI.offerGive=el.value; refreshOfferEval(el.dataset.p); }
  if(el.id==='imp' && el.files[0]){ el.files[0].text().then(t=>{ try{ S=migrateSave(JSON.parse(t)); save(); render(); toast('导入成功'); }catch(x){ toast('存档格式错误'); } }); }
});
document.addEventListener('input', e=>{
  const el=e.target;
  if(el.dataset.f==='q'){
    UI.mk.q=el.value;
    clearTimeout(UI._t);
    UI._t=setTimeout(()=>{
      if(UI.modal) return;
      render();
      const input = document.querySelector('[data-f=q]');
      if(input){ input.focus(); input.setSelectionRange(input.value.length,input.value.length); }
    },300);
  }
  if(el.dataset.d==='q' && UI.match){ UI.match.q=el.value; clearTimeout(UI._t); UI._t=setTimeout(()=>{ render(); const i=document.querySelector('[data-d=q]'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length);} },220); }
  if(el.dataset.o==='cash'){
    // 只保留数字；不重绘整个弹窗，只刷新评估文字，输入框内容与光标保持原样
    const digits=el.value.replace(/[^0-9]/g,'');
    if(digits!==el.value){ const pos=Math.max(0,(el.selectionStart||digits.length)-(el.value.length-digits.length)); el.value=digits; try{ el.setSelectionRange(pos,pos); }catch(x){} }
    UI.offerCashRaw=digits; UI.offerCash=digits===''?0:Math.max(0,parseInt(digits,10)||0);
    refreshOfferEval(el.dataset.p);
  }
});
// ================= 夺冠庆祝（全屏庆祝层：光芒 / 奖杯 / 烟花彩带 / 合成音效 / 振动） =================
// 挂在 body 上独立于 #app，不受 render() 整页重绘影响；每个冠军只庆祝一次（记录在 S.titlesSeen）
const Celebrate = (()=>{
  const INFO = {
    lpl_s1:{name:'LPL 第一赛段', cat:'lpl', short:' LPL ', tier:1},
    lpl_s2:{name:'LPL 第二赛段', cat:'lpl', short:' LPL ', tier:1},
    lpl_s3:{name:'LPL 第三赛段', cat:'lpl', short:' LPL ', tier:1},
    fst:{name:'全球先锋赛', cat:'fst', short:'先锋赛', tier:2},
    msi:{name:'MSI 季中冠军赛', cat:'msi', short:' MSI ', tier:2},
    ewc:{name:'电竞世界杯 EWC', cat:'ewc', short:' EWC ', tier:2},
    worlds:{name:'英雄联盟全球总决赛', cat:'worlds', short:' S 赛', tier:3},
  };
  const MUTE_KEY = 'em_celebrate_mute';
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let open = false, raf = 0, actx = null, timers = [];
  const keyOf = (ev, i) => `${S.year}-${i}-${ev.type}`;
  const isMuted = () => { try{ return localStorage.getItem(MUTE_KEY)==='1'; }catch(e){ return false; } };

  function wonKeys(){
    const out = [];
    (S.events||[]).forEach((ev,i)=>{ if(ev && ev.done && INFO[ev.type] && ev.res && ev.res.champ===S.user) out.push([keyOf(ev,i), ev]); });
    return out;
  }
  // 按赛事分别统计队史冠军数（历年存档 + 本赛季已完成赛事）
  function titleCount(cat){
    let n = 0;
    for(const h of (S.history||[])){
      if(h.year === S.year) continue;
      if(cat==='lpl') n += (h.lpl||[]).filter(k=>k===S.user).length;
      else if(h[cat]===S.user) n++;
    }
    for(const ev of (S.events||[])) if(ev.done && INFO[ev.type] && INFO[ev.type].cat===cat && ev.res && ev.res.champ===S.user) n++;
    return Math.max(1, n);
  }
  function finalMatch(ev){
    let last = null;
    for(const st of (ev.stages||[])) for(const m of (st.matches||[])) if(m && m.w && (m.a===S.user || m.b===S.user)) last = m;
    return last && last.w===S.user ? last : null;
  }

  function check(){
    if(!S || open || UI.match || UI.replay) return;
    const won = wonKeys();
    if(!Array.isArray(S.titlesSeen)){ S.titlesSeen = won.map(x=>x[0]); return; }   // 老存档：已拿过的冠军不补放
    const nxt = won.find(([k])=>!S.titlesSeen.includes(k));
    if(!nxt) return;
    S.titlesSeen.push(nxt[0]);
    const inf = INFO[nxt[1].type], n = titleCount(inf.cat);
    try{ addNews(`🏆 ${teamName(S.user)} 夺得 ${S.year} ${inf.name}冠军！队史第 ${n} 个${inf.short}冠军`); }catch(e){}
    save();
    setTimeout(()=>show(nxt[1], n), 60);
  }

  const TROPHY = `<svg viewBox="0 0 120 140" class="cb-cup" aria-hidden="true"><defs>
    <linearGradient id="cbg" x1="0" x2="1"><stop offset="0" stop-color="#8a6420"/><stop offset=".35" stop-color="#ffe7a3"/><stop offset=".6" stop-color="#e2b24c"/><stop offset="1" stop-color="#7a561a"/></linearGradient>
    <linearGradient id="cbg2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f7d57e"/><stop offset="1" stop-color="#8a6420"/></linearGradient></defs>
    <path d="M30 14h60v26c0 22-12 38-30 42-18-4-30-20-30-42z" fill="url(#cbg)" stroke="#5c4012" stroke-width="2"/>
    <path d="M30 22H14c0 20 8 30 20 32M90 22h16c0 20-8 30-20 32" fill="none" stroke="url(#cbg)" stroke-width="7" stroke-linecap="round"/>
    <rect x="53" y="82" width="14" height="20" fill="url(#cbg2)"/><path d="M36 102h48l6 14H30z" fill="url(#cbg)" stroke="#5c4012" stroke-width="2"/>
    <rect x="26" y="116" width="68" height="14" rx="2" fill="#3b2a10" stroke="#c89b3c" stroke-width="2"/>
    <path d="M60 30l5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1z" fill="#fff6d6" opacity=".9"/>
    <path d="M38 20c2 18 6 30 14 38" stroke="#fff" stroke-opacity=".55" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

  function show(ev, n){
    const inf = INFO[ev.type]; const tier = inf.tier; const me = T(S.user) || {};
    const fm = finalMatch(ev);
    const opp = fm ? (fm.a===S.user ? fm.b : fm.a) : (ev.res.runner||null);
    const sc = fm && fm.s ? (fm.a===S.user ? `${fm.s[0]} : ${fm.s[1]}` : `${fm.s[1]} : ${fm.s[0]}`) : '';
    const roster = starters(S.user);
    const head = tier===3 ? '世界冠军！' : tier===2 ? '国际赛冠军！' : '冠军！';
    const sub = tier===3 ? `${esc(me.name||me.short||'')} 站上世界之巅` : `${esc(me.name||me.short||'')} 捧起 ${esc(inf.name)}冠军奖杯`;
    open = true;
    const el = document.createElement('div');
    el.id = 'celebrate'; el.className = `cb-wrap tier${tier}`;
    el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label', `${inf.name}冠军`);
    el.innerHTML = `<div class="cb-flash"></div><div class="cb-rays"></div><div class="cb-glow"></div><canvas class="cb-fx"></canvas>
      <button class="cb-mute" type="button" title="音效开关">${isMuted()?'🔇':'🔊'}</button>
      <div class="cb-card">
        <div class="cb-eyebrow">${S.year} · ${esc(inf.name)}</div>
        <div class="cb-cupwrap">${TROPHY}<i class="cb-shine"></i></div>
        <h1 class="cb-title">${head}</h1>
        <div class="cb-team">${esc(me.short||'')}</div>
        <p class="cb-sub">${sub}</p>
        <div class="cb-count">队史第 <b>${n}</b> 个${esc(inf.short)}冠军</div>
        ${opp ? `<div class="cb-final">决赛 ${sc?`<b>${esc(sc)}</b> `:''}击败 ${esc((T(opp)||{}).short||opp)}</div>` : ''}
        ${roster.length ? `<div class="cb-roster">${roster.map((p,i)=>`<span style="--d:${(0.9+i*0.12).toFixed(2)}s"><small>${ROLE_CN[p.role]||''}</small><b>${esc(playerTag(p))}</b></span>`).join('')}</div>` : ''}
        <button class="cb-go" type="button">继续 ▶</button>
      </div>`;
    document.body.appendChild(el);
    document.body.classList.add('cb-lock');
    const close = () => {
      if(!open) return; open = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = [];
      document.removeEventListener('keydown', onKey);
      el.classList.add('out'); document.body.classList.remove('cb-lock');
      setTimeout(()=>{ el.remove(); check(); }, 380);
    };
    const onKey = e => { if(e.key==='Escape' || e.key==='Enter'){ e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey);
    el.querySelector('.cb-go').addEventListener('click', close);
    el.querySelector('.cb-mute').addEventListener('click', e=>{
      const m = !isMuted(); try{ localStorage.setItem(MUTE_KEY, m?'1':'0'); }catch(x){}
      e.currentTarget.textContent = m?'🔇':'🔊'; if(m && actx){ try{ actx.suspend(); }catch(x){} } else if(!m){ if(actx) actx.resume(); else fanfare(tier); }
    });
    setTimeout(()=>{ const b = el.querySelector('.cb-go'); if(b) b.focus({preventScroll:true}); }, 50);
    try{ if(navigator.vibrate) navigator.vibrate(tier===3?[180,80,180,80,500]:[120,60,120,60,300]); }catch(e){}
    if(!isMuted()) fanfare(tier);
    if(!reduced()) fireworks(el.querySelector('.cb-fx'), tier);
  }

  // ---------- 粒子：彩带 + 烟花 ----------
  function fireworks(cv, tier){
    const ctx = cv.getContext('2d'); const dpr = Math.min(2, window.devicePixelRatio||1);
    let w = 0, h = 0;
    const fit = () => { w = cv.clientWidth; h = cv.clientHeight; cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); };
    fit();
    const COLS = ['#ffd76a','#c89b3c','#fff3c4','#0ac8b9','#4aa3ff','#ff5a6e','#ffffff','#f7a8ff'];
    const parts = [], rockets = [];
    const rnd = (a,b)=>a+Math.random()*(b-a);
    const confetti = (count, x0, spread) => { for(let i=0;i<count;i++){ parts.push({k:'c', x:x0!=null?x0:rnd(0,w), y:x0!=null?h*0.62:rnd(-h*0.4,-10), vx:x0!=null?rnd(-spread,spread):rnd(-1,1), vy:x0!=null?rnd(-15,-8):rnd(1,3), r:rnd(0,6.28), vr:rnd(-0.25,0.25), sw:rnd(5,10), sh:rnd(8,15), c:COLS[i%COLS.length], life:1, fade:0 }); } };
    const burst = (x,y,col) => { const N = tier===3?90:tier===2?70:55; const sp = tier===3?7.5:6;
      for(let i=0;i<N;i++){ const a = Math.PI*2*i/N + rnd(-0.05,0.05), v = rnd(sp*0.45, sp); parts.push({k:'s', x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, c: Math.random()<0.75?col:'#fff6d6', life:1, fade:rnd(0.010,0.018), tr:[]}); }
      if(!isMuted()) boom(); };
    const launch = () => { const col = COLS[Math.floor(Math.random()*COLS.length)]; rockets.push({x:rnd(w*0.12,w*0.88), y:h+10, vx:rnd(-1,1), vy:-rnd(h*0.017+7, h*0.02+9), ty:rnd(h*0.12,h*0.42), c:col}); };
    // 开场：两侧彩带炮 + 顶部彩带雨
    confetti(tier===3?140:90, w*0.04, 9); confetti(tier===3?140:90, w*0.96, 9); confetti(tier===3?160:100);
    const total = tier===3?14000:tier===2?10000:7500; const t0 = performance.now();
    let nextRocket = 300;
    let last = t0;
    const loop = now => {
      if(!cv.isConnected) return;
      if(cv.clientWidth !== w || cv.clientHeight !== h) fit();
      const dt = Math.min(2.5, (now-last)/16.7); last = now; const el = now - t0;
      if(el > nextRocket && el < total){ launch(); if(tier>=2 && Math.random()<0.45) launch(); nextRocket = el + rnd(tier===3?260:380, tier===3?620:900); }
      if(el < total && Math.random() < (tier===3?0.5:0.3)*dt) confetti(1);
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
      for(let i=rockets.length-1;i>=0;i--){ const r = rockets[i]; r.x += r.vx*dt; r.y += r.vy*dt; r.vy += 0.12*dt;
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(r.x, r.y, 2.4, 0, 6.28); ctx.fill();
        ctx.fillStyle = 'rgba(255,215,106,.35)'; ctx.fillRect(r.x-1, r.y, 2, 16);
        if(r.y <= r.ty || r.vy >= 0){ burst(r.x, r.y, r.c); rockets.splice(i,1); } }
      ctx.globalCompositeOperation = 'lighter';
      for(let i=parts.length-1;i>=0;i--){ const p = parts[i];
        if(p.k==='s'){ p.vx *= Math.pow(0.975,dt); p.vy = p.vy*Math.pow(0.975,dt) + 0.06*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.life -= p.fade*dt;
          if(p.life<=0){ parts.splice(i,1); continue; }
          ctx.globalAlpha = Math.max(0,p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 6.28); ctx.fill(); }
      }
      ctx.globalCompositeOperation = 'source-over';
      for(let i=parts.length-1;i>=0;i--){ const p = parts[i]; if(p.k!=='c') continue;
        p.vx = p.vx*Math.pow(0.985,dt) + Math.sin((now/400)+p.sw)*0.03*dt; p.vy = Math.min(p.vy + 0.22*dt, 3.2); p.x += p.vx*dt; p.y += p.vy*dt; p.r += p.vr*dt;
        if(p.y > h+30){ parts.splice(i,1); continue; }
        ctx.globalAlpha = 1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(now/180+p.sw));
        ctx.fillStyle = p.c; ctx.fillRect(-p.sw/2, -p.sh/2, p.sw, p.sh); ctx.restore(); }
      ctx.globalAlpha = 1;
      if(el < total || parts.length || rockets.length) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  // ---------- 合成音效：号角 + 礼炮（Web Audio，无音频文件） ----------
  function audio(){
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
    if(!actx) actx = new AC(); if(actx.state==='suspended') actx.resume(); return actx;
  }
  function horn(ac, freq, t, dur, vol){
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = freq; o2.frequency.value = freq*1.003;
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2600, t+0.08); f.frequency.linearRampToValueAtTime(1500, t+dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t+0.04); g.gain.setValueAtTime(vol, t+dur*0.7); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination);
    o1.start(t); o2.start(t); o1.stop(t+dur+0.05); o2.stop(t+dur+0.05);
  }
  function fanfare(tier){
    const ac = audio(); if(!ac) return; const t = ac.currentTime + 0.05;
    const N = [523.25, 659.25, 783.99, 1046.5];   // C5 E5 G5 C6
    const seq = [[0,0,0.14],[1,0.16,0.14],[2,0.32,0.14],[3,0.5,0.9]];
    const v = tier===3 ? 0.11 : 0.085;
    seq.forEach(([i,dt,d])=>{ horn(ac, N[i], t+dt, d, v); horn(ac, N[i]/2, t+dt, d, v*0.6); });
    if(tier>=2){ horn(ac, 783.99, t+1.5, 0.14, v); horn(ac, 1046.5, t+1.66, 1.0, v); horn(ac, 1318.5, t+1.66, 1.0, v*0.7); horn(ac, 523.25, t+1.66, 1.0, v*0.6); }
  }
  function boom(){
    const ac = audio(); if(!ac) return; const t = ac.currentTime;
    const len = Math.floor(ac.sampleRate*0.6), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 3);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = 700 + Math.random()*900; g.gain.value = 0.22;
    s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t);
  }

  return { check, show, _info: INFO };
})();

async function bootApp(){
  await StorageBridge.init();
  const raw = await StorageBridge.readSaveText();
  if(raw){
    try{
      const parsed = migrateSave(JSON.parse(raw));
      UI.hasSave = true;
      UI.savePreview = makeSaveSummary(parsed);
    }catch(e){ UI.hasSave = false; }
  }
  await CloudSync.init();
  if(typeof CloudSync.startAutoSync === 'function') CloudSync.startAutoSync();
  if(CloudSync.isLoggedIn()){
    // 已记住上次登录：若有云端恢复的档或本地档，直接进入第2屏（或已在主页）
    if(S) UI.savePreview = makeSaveSummary(S);
    UI.entry = 'lobby';
  } else {
    // 未登录：始终先展示第 1 屏（登录 / 游客独立门户），绝不与战队混在一起
    UI.entry = 'gate';
  }
  render();
  if(typeof AppUpdater !== 'undefined') AppUpdater.check(false).then(r=>{ if(r && r.hasUpdate) render(); });
}
document.addEventListener('keydown', e=>{
  if(e.key==='Enter'){
    if(e.target.id==='auth-otp'){ e.preventDefault(); ACT.cloudVerifyOtp(); }
    else if(e.target.id==='auth-email' || e.target.id==='auth-pass' || e.target.id==='auth-pass2'){
      e.preventDefault();
      (UI.authTab==='register' ? ACT.cloudSignUp : ACT.cloudSignIn)();
    }
  }
});
// 桌面端鼠标悬停英雄卡片弹出海克斯情报浮层（解释 🔥 / ↑ / 👑 / ⚠，无括号数字）
document.addEventListener('mouseover', e=>{
  const card = e.target.closest('.ch-card[data-ch]');
  const tip = document.getElementById('ch-tip');
  if(!tip) return;
  if(!card || !UI.match || !UI.match.draft){ tip.style.display='none'; return; }
  const k = card.dataset.ch;
  const ch = CH[k]; if(!ch){ tip.style.display='none'; return; }
  const info = champBadgeInfo(UI.match.draft, UI.match, k);
  tip.innerHTML = `<div class="ct-hd"><b>${esc(ch.cn)}</b><small>${esc(ch.k)}</small></div>
    <div class="ct-meta">${esc(info.metaText)}</div>
    ${info.badges.length ? `<ul class="ct-list">${info.badges.map(b=>`<li class="${b.cls}"><span>${b.icon}</span>${esc(b.text)}</li>`).join('')}</ul>`
      : `<div class="ct-none">常规可用英雄，无特殊版本或招牌标记</div>`}`;
  tip.style.display = 'block';
  const r = card.getBoundingClientRect();
  const tw = tip.offsetWidth || 240, th = tip.offsetHeight || 90;
  let left = r.left + r.width/2 - tw/2;
  left = Math.max(10, Math.min(window.innerWidth - tw - 10, left));
  let top = r.top - th - 10;
  if(top < 10) top = r.bottom + 10;
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
});
document.addEventListener('mouseout', e=>{
  if(e.target.closest('.ch-card[data-ch]') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.ch-card[data-ch]'))){
    const tip = document.getElementById('ch-tip');
    if(tip) tip.style.display='none';
  }
});
window.addEventListener('load', bootApp);
