// ================= 跨平台存储抽象层（StorageBridge）与 Supabase 云同步 =================
// 架构说明：
// - Tauri v2（Windows / macOS / iOS / Android）：通过原生 Rust 命令读写系统 AppData 目录下的独立 JSON 文件
// - 浏览器单文件模式：平滑降级为 localStorage
// - 云端同步：使用零依赖标准 fetch 对接 Supabase Auth + PostgREST（支持多端账号进度互联）

const CLOUD_DEFAULT_CFG = {
  // 开发者一次性内置的公开 Supabase 配置（数据安全由数据库 RLS 策略保证）
  url: 'https://uhrrohofkuqanlafgapn.supabase.co',
  anonKey: 'sb_publishable_kwNYtASApUqbeBY0PL9snA_kltcGMBP'
};

const CLOUD_AUTH_KEY = 'lolm_cloud_auth_v1';

function isTauriApp(){
  return typeof window !== 'undefined' && !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
}
async function tauriInvoke(cmd, args){
  if(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke){
    return window.__TAURI__.core.invoke(cmd, args || {});
  }
  if(window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function'){
    return window.__TAURI_INTERNALS__.invoke(cmd, args || {});
  }
  throw new Error('Tauri runtime unavailable');
}
function detectPlatformLabel(){
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
  const prefix = isTauriApp() ? '客户端' : '网页版';
  if(/Windows/i.test(ua)) return `${prefix} · Windows`;
  if(/Macintosh|Mac OS/i.test(ua)) return `${prefix} · macOS`;
  if(/Android/i.test(ua)) return `${prefix} · Android`;
  if(/iPhone|iPad|iPod/i.test(ua)) return `${prefix} · iOS`;
  return prefix;
}

const StorageBridge = {
  mode: isTauriApp() ? 'tauri-file' : 'browser-local',
  savePath: '',
  _saveWrite: Promise.resolve(),
  async init(){
    if(isTauriApp()){
      try{
        this.savePath = await tauriInvoke('get_save_path');
      }catch(e){ console.warn('get_save_path failed:', e); }
    }
  },
  async readSaveText(){
    if(isTauriApp()){
      try{
        const txt = await tauriInvoke('load_local_save');
        if(txt) return txt;
      }catch(e){ console.warn('load_local_save failed:', e); }
    }
    try{ return localStorage.getItem(SAVE_KEY); }catch(e){ return null; }
  },
  async writeSaveText(text){
    try{ localStorage.setItem(SAVE_KEY, text); }catch(e){}
    if(isTauriApp()){
      this._saveWrite = this._saveWrite.then(async ()=>{
        try{ await tauriInvoke('write_local_save', { content: text }); }catch(e){ console.warn('write_local_save failed:', e); }
      });
      await this._saveWrite;
    }
  },
  async deleteSave(){
    try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
    if(isTauriApp()){
      await this._saveWrite;
      try{ await tauriInvoke('delete_local_save'); }catch(e){}
    }
  },
  async readMeta(key){
    if(isTauriApp()){
      try{
        const txt = await tauriInvoke('load_meta_file', { name: key });
        if(txt) return JSON.parse(txt);
      }catch(e){}
    }
    try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; }catch(e){ return null; }
  },
  async writeMeta(key, obj){
    const text = obj ? JSON.stringify(obj) : '';
    try{
      if(obj) localStorage.setItem(key, text);
      else localStorage.removeItem(key);
    }catch(e){}
    if(isTauriApp()){
      try{ await tauriInvoke('write_meta_file', { name: key, content: text }); }catch(e){}
    }
  }
};

function makeSaveSummary(saveObj){
  if(!saveObj) return null;
  const ev = saveObj.events && saveObj.events[saveObj.evIdx];
  const evName = typeof eventInfo === 'function' ? eventInfo(ev)?.name || '' : '';
  const team = saveObj.teams && saveObj.teams[saveObj.user] ? saveObj.teams[saveObj.user].short : (saveObj.user || '—');
  return {
    team,
    year: saveObj.year || 2026,
    event: evName,
    updatedAt: (saveObj._sync && saveObj._sync.updatedAt) || Date.now(),
    device: (saveObj._sync && saveObj._sync.device) || detectPlatformLabel()
  };
}

function fmtTime(ts){
  if(!ts) return '未知时间';
  const d = new Date(ts);
  if(isNaN(d.getTime())) return String(ts);
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

let syncStampNo = 0;
function makeSyncStamp(){
  const updatedAt = Date.now();
  const randomId = typeof crypto!=='undefined' && typeof crypto.randomUUID==='function'
    ? crypto.randomUUID() : updatedAt.toString(36) + '-' + (++syncStampNo).toString(36) + '-' + Math.random().toString(36).slice(2);
  return {updatedAt, device:detectPlatformLabel(), revision:randomId};
}

function saveSyncVersion(save){
  if(!save) return null;
  if(save._sync?.revision) return save._sync.revision;
  // PostgREST 的 JSONB 会重排键。旧存档按内容识别，不依赖设备时钟或赛事索引。
  const json = JSON.stringify(save, (_,v) => v && typeof v==='object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
  let h1 = 2166136261, h2 = 5381;
  for(let i=0;i<json.length;i++){
    const ch = json.charCodeAt(i);
    h1 = Math.imul(h1^ch,16777619);
    h2 = Math.imul(h2,33)^ch;
  }
  return 'legacy-' + json.length + '-' + (h1>>>0) + '-' + (h2>>>0);
}

function canApplyCloudSave(){
  if(typeof UI!=='undefined' && (UI.match || UI.replay || UI.modal || UI.authBusy)) return false;
  return typeof document==='undefined' || !document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]');
}

const CloudSync = {
  cfg: { url: CLOUD_DEFAULT_CFG.url, anonKey: CLOUD_DEFAULT_CFG.anonKey },
  auth: null, // { access_token, refresh_token, expires_at, user:{id, email} }
  status: 'guest', // guest | synced | offline | reauth | unconfigured
  statusText: '本地游客模式',
  lastSyncAt: null,
  conflict: null, // { localSave, localSummary, cloudSave, cloudSummary }
  _pushTimer: null,
  _syncJob: null,

  isConfigured(){
    return !!(this.cfg && this.cfg.url && this.cfg.anonKey);
  },
  isLoggedIn(){
    return !!(this.auth && this.auth.access_token && this.auth.user && this.auth.user.id);
  },
  baseUrl(){
    return String(this.cfg.url || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  },
  headers(withAuth){
    const h = {
      'apikey': this.cfg.anonKey.trim(),
      'Content-Type': 'application/json'
    };
    if(withAuth && this.auth && this.auth.access_token){
      h['Authorization'] = 'Bearer ' + this.auth.access_token;
    }
    return h;
  },

  async init(){
    this.cfg = { url: CLOUD_DEFAULT_CFG.url, anonKey: CLOUD_DEFAULT_CFG.anonKey };
    const savedAuth = await StorageBridge.readMeta(CLOUD_AUTH_KEY);
    if(savedAuth && savedAuth.access_token && savedAuth.user){
      this.auth = savedAuth;
    }
    if(!this.isConfigured()){
      this.status = 'unconfigured';
      this.statusText = '云服务暂未开放（本地模式）';
      return;
    }
    if(!this.isLoggedIn()){
      this.status = 'guest';
      this.statusText = '游客模式（仅存本地）';
      return;
    }
    await this.syncOnLaunch(false);
  },

  async requireNewLogin(auth){
    if(this.auth!==auth) return;
    this.auth = null;
    this.conflict = null;
    this.status = 'reauth';
    this.statusText = '登录已失效，请重新登录，进度已存本地';
    if(typeof notifyCloudStatus==='function') notifyCloudStatus('登录失效，请重新登录');
    await StorageBridge.writeMeta(CLOUD_AUTH_KEY,null);
  },

  async ensureValidToken(force=false){
    if(!this.isLoggedIn() || !this.isConfigured()) return false;
    const auth = this.auth;
    const now = Math.floor(Date.now() / 1000);
    if(!force && auth.expires_at && auth.expires_at - now > 90) return true;
    if(!auth.refresh_token){
      if(force || (auth.expires_at && auth.expires_at<=now)){
        await this.requireNewLogin(auth);
        return false;
      }
      return true;
    }
    try{
      const r = await fetch(`${this.baseUrl()}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: this.headers(false),
        body: JSON.stringify({ refresh_token: auth.refresh_token }),
        signal: typeof AbortSignal!=='undefined' ? AbortSignal.timeout?.(12000) : undefined
      });
      const d = await r.json().catch(()=>({}));
      if(this.auth!==auth) return false;
      if(!r.ok || !d.access_token){
        const code = d.error_code || d.code || d.error;
        if(['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired','invalid_grant'].includes(code) || r.status===401 || r.status===403){
          await this.requireNewLogin(auth);
          return false;
        }
        throw new Error('HTTP ' + r.status);
      }
      this.auth = {
        access_token: d.access_token,
        refresh_token: d.refresh_token || this.auth.refresh_token,
        expires_at: Math.floor(Date.now()/1000) + (d.expires_in || 3600),
        user: d.user || this.auth.user
      };
      await StorageBridge.writeMeta(CLOUD_AUTH_KEY, this.auth);
      return true;
    }catch(e){
      if(this.auth!==auth) return false;
      this.status = 'offline';
      this.statusText = '离线（令牌待刷新）';
      return false;
    }
  },

  async signUp(email, password){
    if(!this.isConfigured()) return { ok:false, msg:'云服务尚未就绪，请先使用游客模式' };
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { ok:false, msg:'请输入有效的邮箱地址' };
    if(!password || password.length < 6) return { ok:false, msg:'密码长度至少需要 6 位' };
    try{
      const r = await fetch(`${this.baseUrl()}/auth/v1/signup`, {
        method: 'POST',
        headers: this.headers(false),
        body: JSON.stringify({ email: email.trim(), password })
      });
      const d = await r.json().catch(()=>({}));
      if(!r.ok){
        const raw = d.msg || d.error_description || d.message || '';
        const cn = /already registered/i.test(raw) ? '该邮箱已注册，请直接切换至「账号登录」' : (raw || `注册失败 (${r.status})`);
        return { ok:false, msg: cn };
      }
      if(d.access_token && d.user){
        this.auth = {
          access_token: d.access_token,
          refresh_token: d.refresh_token,
          expires_at: Math.floor(Date.now()/1000) + (d.expires_in || 3600),
          user: { id: d.user.id, email: d.user.email }
        };
        await StorageBridge.writeMeta(CLOUD_AUTH_KEY, this.auth);
        await this.syncOnLaunch(true);
        return { ok:true, msg:'注册并登录成功！' };
      }
      return { ok:true, needConfirm:true, email: email.trim(), msg:'验证码已发送至你的邮箱，请在下方输入验证码完成注册！' };
    }catch(e){
      return { ok:false, msg:'无法连接云端，请检查网络状态' };
    }
  },

  async verifySignupOtp(email, token){
    const code = String(token || '').replace(/\s+/g, '');
    if(!email) return { ok:false, msg:'缺少待验证的邮箱地址' };
    if(!/^\d{6,8}$/.test(code)) return { ok:false, msg:'请输入邮箱收到的数字验证码' };
    try{
      const r = await fetch(`${this.baseUrl()}/auth/v1/verify`, {
        method: 'POST',
        headers: this.headers(false),
        body: JSON.stringify({ type: 'signup', email: email.trim(), token: code })
      });
      const d = await r.json().catch(()=>({}));
      if(!r.ok){
        const raw = d.msg || d.error_description || d.message || '';
        const cn = /expired|invalid/i.test(raw) ? '验证码错误或已过期，请核对后重试或点击重新发送' : (raw || `验证失败 (${r.status})`);
        return { ok:false, msg: cn };
      }
      if(d.access_token && d.user){
        this.auth = {
          access_token: d.access_token,
          refresh_token: d.refresh_token,
          expires_at: Math.floor(Date.now()/1000) + (d.expires_in || 3600),
          user: { id: d.user.id, email: d.user.email }
        };
        await StorageBridge.writeMeta(CLOUD_AUTH_KEY, this.auth);
        const res = await this.syncOnLaunch(true);
        return { ok:true, msg: res && res.msg ? `邮箱验证成功！${res.msg}` : '邮箱验证成功，已自动登录！' };
      }
      return { ok:true, msg:'邮箱验证成功！请使用邮箱和密码登录。' };
    }catch(e){
      return { ok:false, msg:'网络连接失败，请稍后重试' };
    }
  },

  async resendSignupOtp(email){
    if(!email) return { ok:false, msg:'缺少邮箱地址' };
    try{
      const r = await fetch(`${this.baseUrl()}/auth/v1/resend`, {
        method: 'POST',
        headers: this.headers(false),
        body: JSON.stringify({ type: 'signup', email: email.trim() })
      });
      const d = await r.json().catch(()=>({}));
      if(!r.ok){
        const raw = d.msg || d.error_description || d.message || '';
        const cn = /rate limit|too many|seconds/i.test(raw) ? '发送过于频繁，请稍等片刻再试' : (raw || `重发失败 (${r.status})`);
        return { ok:false, msg: cn };
      }
      return { ok:true, msg:'新的验证码已发送至邮箱，请查收（注意垃圾箱）' };
    }catch(e){
      return { ok:false, msg:'网络连接失败，请稍后重试' };
    }
  },

  async signIn(email, password){
    if(!this.isConfigured()) return { ok:false, msg:'云服务尚未就绪，请先使用游客模式' };
    if(!email || !password) return { ok:false, msg:'请输入邮箱和密码' };
    try{
      const r = await fetch(`${this.baseUrl()}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: this.headers(false),
        body: JSON.stringify({ email: email.trim(), password })
      });
      const d = await r.json().catch(()=>({}));
      if(!r.ok){
        const raw = d.error_description || d.msg || d.message || '';
        if(/not confirmed/i.test(raw)){
          return { ok:false, unconfirmed:true, email: email.trim(), msg:'该邮箱尚未完成验证，请输入验证码（或点击重新发送）' };
        }
        const cn = /invalid login credentials/i.test(raw) ? '邮箱或密码错误，请重新核对' : (raw || `登录失败 (${r.status})`);
        return { ok:false, msg: cn };
      }
      this.auth = {
        access_token: d.access_token,
        refresh_token: d.refresh_token,
        expires_at: Math.floor(Date.now()/1000) + (d.expires_in || 3600),
        user: { id: d.user.id, email: d.user.email }
      };
      await StorageBridge.writeMeta(CLOUD_AUTH_KEY, this.auth);
      const res = await this.syncOnLaunch(true);
      return { ok:true, msg: res && res.msg ? res.msg : `欢迎回来，${this.auth.user.email}！` };
    }catch(e){
      return { ok:false, msg:'网络连接失败，当前仍可离线游玩' };
    }
  },

  async signOut(){
    clearTimeout(this._pushTimer);
    this._pushTimer = null;
    if(this.isConfigured() && this.isLoggedIn()){
      try{
        await fetch(`${this.baseUrl()}/auth/v1/logout?scope=local`, { method:'POST', headers: this.headers(true) });
      }catch(e){}
    }
    this.auth = null;
    this.conflict = null;
    this.status = this.isConfigured() ? 'guest' : 'unconfigured';
    this.statusText = '已退出（本地游客模式）';
    await StorageBridge.writeMeta(CLOUD_AUTH_KEY, null);
    if(typeof render === 'function') render();
  },

  async requestSaveRows(uid, path, options){
    if(!await this.ensureValidToken() || this.auth?.user?.id!==uid) throw new Error('会话待刷新');
    const send = () => fetch(this.baseUrl()+path,{
      ...options,
      headers:{...this.headers(true), ...options.headers},
      signal:typeof AbortSignal!=='undefined' ? AbortSignal.timeout?.(12000) : undefined
    });
    let r = await send();
    let body = r.ok ? null : await r.json().catch(()=>({}));
    if(r.status===401 && body?.code!=='42501' && await this.ensureValidToken(true) && this.auth?.user?.id===uid){
      r = await send();
      body = r.ok ? null : await r.json().catch(()=>({}));
    }
    if(!r.ok){
      const error = new Error('云存档 HTTP ' + r.status);
      error.code = body?.code;
      throw error;
    }
    return r.json();
  },

  async fetchCloudSave(uid, metadataOnly=false){
    const fields = metadataOnly ? 'updated_at' : 'save_data,summary,updated_at';
    const rows = await this.requestSaveRows(uid,'/rest/v1/user_saves?user_id=eq.' + encodeURIComponent(uid) + '&select=' + fields,{
      method:'GET'
    });
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  },

  async writeCloudSave(uid, save, observed){
    const updated = Date.parse(observed?.updated_at) || 0;
    const updatedAt = new Date(Math.max(Date.now(),updated+1)).toISOString();
    const body = JSON.stringify({user_id:uid, save_data:save, summary:makeSaveSummary(save), updated_at:updatedAt});
    const path = '/rest/v1/user_saves?select=updated_at&';
    const where = observed
      ? 'user_id=eq.' + encodeURIComponent(uid) + '&updated_at=eq.' + encodeURIComponent(observed.updated_at)
      : 'on_conflict=user_id';
    const prefer = observed ? 'return=representation' : 'resolution=ignore-duplicates,return=representation';
    const rows = await this.requestSaveRows(uid,path+where,{
      method:observed?'PATCH':'POST',
      headers:{Prefer:prefer},
      body
    });
    return rows[0]?.updated_at || null;
  },

  schedulePush(saveObj){
    if(!saveObj || !this.isConfigured() || !this.isLoggedIn()) return;
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(()=>{
      this._pushTimer = null;
      this.syncOnLaunch(false);
    }, 1400);
  },

  async localCloudSave(){
    if(S) return S;
    const raw = await StorageBridge.readSaveText();
    if(S) return S;
    try{ return raw ? JSON.parse(raw) : null; }
    catch(e){ return null; }
  },

  async markCloudBase(uid, localVersion, cloudTime, label){
    if(this.auth?.user?.id!==uid) return;
    await StorageBridge.writeMeta('rift-sync-v2-'+uid,{localVersion,cloudTime});
    if(this.auth?.user?.id!==uid) return;
    this.conflict = null;
    this.markCloudSynced(label);
  },

  markCloudSynced(label){
    this.status = 'synced';
    this.lastSyncAt = Date.now();
    this.statusText = label;
    if(typeof notifyCloudStatus==='function') notifyCloudStatus('云端已同步');
  },

  async applyCloudSave(uid, row){
    if(this.auth?.user?.id!==uid) return {ok:false};
    S = migrateSave(row.save_data);
    const version = saveSyncVersion(S);
    const stored = StorageBridge.writeSaveText(JSON.stringify(S));
    this.conflict = null;
    this.markCloudSynced('已同步云端最新进度');
    if(typeof UI!=='undefined'){
      UI.hasSave = true;
      UI.savePreview = makeSaveSummary(S);
    }
    if(typeof render==='function') render();
    await stored;
    await this.markCloudBase(uid,version,row.updated_at,'已同步云端最新进度');
    return {ok:true, msg:'已同步云端最新进度'};
  },

  async reconcileCloud(uid, interactive, preferLocal, retry=true){
    const base = await StorageBridge.readMeta('rift-sync-v2-'+uid);
    let row = await this.fetchCloudSave(uid,!!base);
    const remoteUnchanged = !!(base && row && row.updated_at===base.cloudTime);
    let local = await this.localCloudSave();
    if(row && base && (!remoteUnchanged || !local)){
      if(!interactive && !canApplyCloudSave()) return {ok:true,deferred:true,msg:'将在当前操作结束后同步'};
      row = await this.fetchCloudSave(uid);
      local = await this.localCloudSave();
    }
    if(this.auth?.user?.id!==uid) return {ok:false};
    const version = saveSyncVersion(local);

    if(!row && !local){
      this.markCloudSynced('云端已连接');
      return {ok:true, msg:'云端已连接'};
    }
    if(row && row.save_data && version===saveSyncVersion(row.save_data)){
      await this.markCloudBase(uid,version,row.updated_at,'云端已同步');
      return {ok:true, msg:'本地与云端进度一致'};
    }
    if(local && remoteUnchanged && row?.updated_at===base.cloudTime && version===base.localVersion){
      this.markCloudSynced('云端已同步');
      return {ok:true, msg:'本地与云端进度一致'};
    }
    if(local && (!row || (remoteUnchanged && row.updated_at===base.cloudTime))){
      const time = await this.writeCloudSave(uid,local,row);
      if(!time){
        return retry ? this.reconcileCloud(uid,interactive,preferLocal,false) : {ok:false,msg:'云端刚有更新，将自动重试'};
      }
      await this.markCloudBase(uid,version,time,'云端已同步');
      return {ok:true, msg:'已自动上传本地进度'};
    }

    if(!interactive && !canApplyCloudSave()) return {ok:true,deferred:true,msg:'将在当前操作结束后同步'};
    if(!local || (!preferLocal && base && version===base.localVersion)){
      return this.applyCloudSave(uid,row);
    }

    const alreadyReported = this.conflict?.cloudTime===row.updated_at;
    this.conflict = {
      localSave:local, localSummary:makeSaveSummary(local),
      cloudSave:row.save_data, cloudTime:row.updated_at,
      cloudSummary:{...makeSaveSummary(row.save_data), ...(row.summary||{})}
    };
    this.statusText = '检测到多端进度差异';
    if(interactive && typeof openConflictModal==='function') openConflictModal();
    else if(!alreadyReported && typeof notifyCloudStatus==='function') notifyCloudStatus('待处理存档差异');
    return {ok:true,msg:'检测到多端进度差异，请选择要保留的存档'};
  },

  async syncOnLaunch(interactive, {preferLocal=false}={}){
    if(!this.isConfigured() || !this.isLoggedIn()) return {ok:false,msg:this.status==='reauth' ? this.statusText : '请先登录云存档账号'};
    if(this._resolving) return {ok:false,msg:'正在处理存档差异'};
    const uid = this.auth.user.id;
    if(this._syncJob){
      const job = this._syncJob;
      const result = await job.promise;
      if(job.uid!==uid || preferLocal || (interactive && result.deferred)) return this.syncOnLaunch(interactive,{preferLocal});
      if(interactive && this.conflict && typeof openConflictModal==='function') openConflictModal();
      return result;
    }
    const job = {uid};
    this._syncJob = job;
    job.promise = this.reconcileCloud(uid,interactive,preferLocal).catch(e=>{
      if(this.status==='reauth' && !this.isLoggedIn()) return {ok:false,msg:this.statusText};
      const msg = ['42501','PGRST205','42P01'].includes(e.code)
        ? '云端存档接口不可用，进度已存本地'
        : '暂无法连接云端，将自动重试';
      if(this.auth?.user?.id===uid){
        console.warn('Cloud sync failed:', e);
        this.status = 'offline';
        this.statusText = msg;
        if(typeof notifyCloudStatus==='function') notifyCloudStatus('离线(已存本地)');
      }
      return {ok:false,msg};
    }).finally(()=>{
      if(this._syncJob===job) this._syncJob = null;
    });
    return job.promise;
  },

  async resolveConflict(choice){
    if(!this.conflict || !this.isLoggedIn() || this._resolving) return {ok:false,msg:'没有待处理的存档差异'};
    this._resolving = true;
    const uid = this.auth.user.id;
    let advanced = false;
    try{
      if(this._syncJob) await this._syncJob.promise;
      if(this.auth?.user?.id!==uid) return {ok:false,msg:'账号状态已变化'};
      const pending = this.conflict;
      if(!pending) return {ok:true,msg:'本地与云端已同步'};
      const remote = await this.fetchCloudSave(uid,true);
      if(remote?.updated_at!==pending.cloudTime){
        advanced = true;
      } else if(choice==='cloud'){
        if(typeof UI!=='undefined') UI.modal = null;
        return await this.applyCloudSave(uid,{save_data:pending.cloudSave,updated_at:pending.cloudTime});
      } else if(choice==='local'){
        const save = await this.localCloudSave();
        const version = saveSyncVersion(save);
        const time = await this.writeCloudSave(uid,save,remote);
        if(time){
          await this.markCloudBase(uid,version,time,'已用本地进度更新云端');
          if(typeof UI!=='undefined') UI.modal = null;
          if(typeof render==='function') render();
          return {ok:true,msg:'已用本地进度更新云端'};
        }
        advanced = true;
      }
    }catch(e){
      return {ok:false,msg:'暂无法连接云端，请稍后重试'};
    }finally{
      this._resolving = false;
    }
    if(advanced){
      this.conflict = null;
      if(typeof UI!=='undefined') UI.modal = null;
      return this.syncOnLaunch(true);
    }
    return {ok:false,msg:'请选择要保留的存档'};
  },

  _autoStarted: false,
  _autoTimer: null,
  startAutoSync(){
    if(this._autoStarted) return;
    this._autoStarted = true;
    const trySync = () => {
      if(typeof document!=='undefined' && document.visibilityState==='hidden') return;
      if(this.isLoggedIn()) this.syncOnLaunch(false);
    };
    if(typeof document!=='undefined' && document.addEventListener){
      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='hidden'){
          if(this._pushTimer){
            clearTimeout(this._pushTimer);
            this._pushTimer = null;
            this.syncOnLaunch(false);
          }
        } else trySync();
      });
    }
    if(typeof window!=='undefined' && window.addEventListener){
      window.addEventListener('focus',trySync);
      window.addEventListener('online',()=>{
        if(this.isLoggedIn()) this.syncOnLaunch(false);
      });
    }
    this._autoTimer = setInterval(trySync,15000);
  }
};

// ================= 云端版本检测与更新 =================
// - Windows 安装版 / macOS：Tauri updater 应用内下载、验签、安装并重启
// - Windows 绿色版：直接下载最新 Portable.exe（便携版无法原地自更新）
// - Android：下载最新 APK（固定签名，可覆盖安装）
// - 在线网页 / PWA：网页本身已是最新，刷新即可；离线单文件版：下载最新 Web-Offline.html
const RELEASES_PAGE = 'https://github.com/D3cEuGod/esports-manager/releases/latest';

function isAndroidShell(){
  return typeof location!=='undefined' && /appassets\.androidplatform\.net/i.test(location.hostname);
}

// 外链统一出口：Tauri 交给系统浏览器，安卓壳走原生 Intent，网页开新标签。
async function openExternal(url){
  if(!url) return false;
  if(isTauriApp()){
    try{ await tauriInvoke('plugin:opener|open_url', { url }); return true; }
    catch(e){ console.warn('open_url failed:', e); return false; }
  }
  if(isAndroidShell()){ location.href = url; return true; }
  const w = window.open(url, '_blank', 'noopener');
  if(!w) location.href = url;
  return true;
}

// Tauri 默认拦截新窗口，target=_blank 的链接点了没反应。这里统一接管。
if(typeof document!=='undefined' && isTauriApp()){
  document.addEventListener('click', e=>{
    const a = e.target.closest && e.target.closest('a[href]');
    if(!a) return;
    const href = a.getAttribute('href') || '';
    if(!/^https?:\/\//i.test(href)) return;
    e.preventDefault();
    openExternal(href);
  }, true);
}

window.AppUpdater = {
  currentVersion: '2.1.17',
  manifestUrl: 'https://raw.githubusercontent.com/D3cEuGod/esports-manager/main/version.json',
  releasesApi: 'https://api.github.com/repos/D3cEuGod/esports-manager/releases/latest',
  available: null, // { version, notes, url, assetUrl, mode }
  statusText: '尚未检查',
  lastCheckedAt: 0,
  busy: false,
  progress: null,
  _kind: null,

  isNewer(remote, local){
    const a = String(remote||'').replace(/^v/i,'').split('.').map(n=>parseInt(n,10)||0);
    const b = String(local||'').replace(/^v/i,'').split('.').map(n=>parseInt(n,10)||0);
    for(let i=0;i<Math.max(a.length,b.length);i++){
      if((a[i]||0) > (b[i]||0)) return true;
      if((a[i]||0) < (b[i]||0)) return false;
    }
    return false;
  },

  // tauri-installed | tauri-portable | tauri-mac | android | web-online | web-file
  async platform(){
    if(this._kind) return this._kind;
    const ua = (typeof navigator!=='undefined' && navigator.userAgent) || '';
    if(isTauriApp()){
      if(/Macintosh|Mac OS/i.test(ua)) this._kind = 'tauri-mac';
      else {
        let kind = 'portable';
        try{ kind = await tauriInvoke('install_kind'); }catch(e){}
        this._kind = kind==='installed' ? 'tauri-installed' : 'tauri-portable';
      }
    } else if(isAndroidShell()) this._kind = 'android';
    else if(typeof location!=='undefined' && /^https?:$/.test(location.protocol)) this._kind = 'web-online';
    else this._kind = 'web-file';
    return this._kind;
  },

  pickAsset(assets, kind){
    const list = Array.isArray(assets) ? assets : [];
    const re = {
      'tauri-installed': /Windows-Setup\.exe$/i,
      'tauri-portable': /Windows-Portable\.exe$/i,
      'tauri-mac': /macOS.*\.dmg$/i,
      'android': /Android\.apk$/i,
      'web-file': /Web-Offline\.html$/i
    }[kind];
    const a = re && list.find(x=>re.test(x.name||''));
    return a ? a.browser_download_url : null;
  },

  async fetchLatest(kind){
    // 以 GitHub 最新 Release 为准：安装包都编译上传完才会出现，不会提前提示更新。
    try{
      const r = await fetch(this.releasesApi, { headers:{ Accept:'application/vnd.github+json' }, cache:'no-store' });
      if(r.ok){
        const j = await r.json();
        if(j && j.tag_name && !j.draft && !j.prerelease){
          return {
            version: String(j.tag_name).replace(/^v/i,''),
            notes: String(j.name||'').slice(0,80),
            url: j.html_url || RELEASES_PAGE,
            assetUrl: this.pickAsset(j.assets, kind)
          };
        }
      }
    }catch(e){}
    // API 被限流时退回 version.json（只给发布页链接）
    const r2 = await fetch(`${this.manifestUrl}?t=${Date.now()}`, { cache:'no-store' });
    if(!r2.ok) throw new Error('HTTP ' + r2.status);
    const j2 = await r2.json();
    if(!j2 || !j2.version) return null;
    return { version:String(j2.version), notes:j2.notes||'', url:RELEASES_PAGE, assetUrl:null };
  },

  async check(manual){
    if(this.busy) return { hasUpdate: !!this.available, msg:'正在更新…' };
    if(!manual && Date.now() - this.lastCheckedAt < 300000) return { hasUpdate: !!this.available };
    this.lastCheckedAt = Date.now();
    this.statusText = '正在检查云端版本…';
    try{
      const kind = await this.platform();
      const info = await this.fetchLatest(kind);
      if(info && this.isNewer(info.version, this.currentVersion)){
        info.mode = 'download';
        if(kind==='web-online') info.mode = 'reload';
        if(kind==='tauri-installed' || kind==='tauri-mac'){
          try{
            const u = await tauriInvoke('check_app_update');
            if(u && u.version) info.mode = 'inapp';
          }catch(e){ console.warn('check_app_update failed:', e); }
        }
        this.available = info;
        this.statusText = `发现新版本 v${info.version}`;
        return { hasUpdate:true, version:info.version, info };
      }
      this.available = null;
      this.statusText = `已是最新版本（v${this.currentVersion}）`;
      return { hasUpdate:false, msg: this.statusText };
    }catch(e){
      this.statusText = '离线模式（暂无法检测版本）';
      return { hasUpdate:false, msg:'网络暂不可用，稍后再试' };
    }
  },

  actionLabel(){
    const u = this.available;
    if(!u) return '';
    if(this.busy) return this.progress!=null ? `正在下载更新 ${this.progress}%` : '正在更新…';
    if(u.mode==='inapp') return `一键更新到 v${u.version}`;
    if(u.mode==='reload') return `刷新到新版本 v${u.version}`;
    return `下载最新版本 v${u.version}`;
  },

  // 返回给界面提示的文字
  async run(){
    const u = this.available;
    if(!u || this.busy) return '';
    if(u.mode==='reload'){
      try{
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if(reg) await reg.update();
      }catch(e){}
      location.reload();
      return '正在刷新…';
    }
    if(u.mode==='inapp'){
      this.busy = true; this.progress = null;
      let unlisten = null;
      try{
        const ev = window.__TAURI__ && window.__TAURI__.event;
        if(ev && ev.listen){
          unlisten = await ev.listen('app-update-progress', ({payload})=>{
            if(payload && payload.total){
              this.progress = Math.min(100, Math.round(payload.downloaded*100/payload.total));
              if(typeof render==='function') render();
            }
          });
        }
        if(typeof render==='function') render();
        if(typeof StorageBridge!=='undefined') await StorageBridge._saveWrite;
        await tauriInvoke('install_app_update'); // 成功会直接重启
        return '已是最新版本';
      }catch(e){
        console.warn('install_app_update failed:', e);
        u.mode = 'download';
        const url = u.assetUrl || u.url;
        await openExternal(url);
        return '应用内更新失败，已改为在浏览器中下载安装包';
      }finally{
        this.busy = false; this.progress = null;
        if(unlisten) try{ unlisten(); }catch(e){}
        if(typeof render==='function') render();
      }
    }
    const ok = await openExternal(u.assetUrl || u.url);
    if(!ok) return '无法打开浏览器，请手动前往 GitHub Releases 下载';
    if(this._kind==='android') return '下载完成后点开 APK 覆盖安装即可';
    return u.assetUrl ? '已开始下载最新安装包' : '已打开下载页面';
  }
};
