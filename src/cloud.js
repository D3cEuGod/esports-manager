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
      try{ await tauriInvoke('write_local_save', { content: text }); }catch(e){ console.warn('write_local_save failed:', e); }
    }
  },
  async deleteSave(){
    try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
    if(isTauriApp()){
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
  const evName = ev && typeof EVENT_INFO !== 'undefined' && EVENT_INFO[ev.type] ? EVENT_INFO[ev.type].name : '';
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

const CloudSync = {
  cfg: { url: CLOUD_DEFAULT_CFG.url, anonKey: CLOUD_DEFAULT_CFG.anonKey },
  auth: null, // { access_token, refresh_token, expires_at, user:{id, email} }
  status: 'guest', // guest | syncing | synced | offline | unconfigured | error
  statusText: '本地游客模式',
  lastSyncAt: null,
  conflict: null, // { localSave, localSummary, cloudSave, cloudSummary }
  _pushTimer: null,

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
    await this.ensureValidToken();
    if(this.isLoggedIn()){
      await this.syncOnLaunch(false);
    }
  },

  async ensureValidToken(){
    if(!this.isLoggedIn() || !this.isConfigured()) return false;
    const now = Math.floor(Date.now() / 1000);
    if(this.auth.expires_at && this.auth.expires_at - now > 90) return true;
    if(!this.auth.refresh_token) return true;
    try{
      const r = await fetch(`${this.baseUrl()}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: this.headers(false),
        body: JSON.stringify({ refresh_token: this.auth.refresh_token })
      });
      if(!r.ok) throw new Error('refresh failed');
      const d = await r.json();
      this.auth = {
        access_token: d.access_token,
        refresh_token: d.refresh_token || this.auth.refresh_token,
        expires_at: Math.floor(Date.now()/1000) + (d.expires_in || 3600),
        user: d.user || this.auth.user
      };
      await StorageBridge.writeMeta(CLOUD_AUTH_KEY, this.auth);
      return true;
    }catch(e){
      this.status = 'offline';
      this.statusText = '离线（令牌待刷新）';
      return false;
    }
  },

  async signUp(email, password){
    if(!this.isConfigured()) return { ok:false, msg:'请先填写 Supabase URL 和 Anon Key' };
    if(!email || !password || password.length < 6) return { ok:false, msg:'请输入有效邮箱和至少 6 位密码' };
    try{
      const r = await fetch(`${this.baseUrl()}/auth/v1/signup`, {
        method: 'POST',
        headers: this.headers(false),
        body: JSON.stringify({ email: email.trim(), password })
      });
      const d = await r.json().catch(()=>({}));
      if(!r.ok) return { ok:false, msg: d.msg || d.error_description || d.message || `注册失败 (${r.status})` };
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
      return { ok:true, needConfirm:true, msg:'注册成功！请前往邮箱点击验证链接后再登录（或在 Supabase 关闭 Email Confirm）。' };
    }catch(e){
      return { ok:false, msg:'无法连接云端，请检查网络与 Supabase URL' };
    }
  },

  async signIn(email, password){
    if(!this.isConfigured()) return { ok:false, msg:'请先填写 Supabase URL 和 Anon Key' };
    if(!email || !password) return { ok:false, msg:'请输入邮箱和密码' };
    try{
      const r = await fetch(`${this.baseUrl()}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: this.headers(false),
        body: JSON.stringify({ email: email.trim(), password })
      });
      const d = await r.json().catch(()=>({}));
      if(!r.ok) return { ok:false, msg: d.error_description || d.msg || d.message || `登录失败 (${r.status})` };
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
    if(this.isConfigured() && this.isLoggedIn()){
      try{
        await fetch(`${this.baseUrl()}/auth/v1/logout`, { method:'POST', headers: this.headers(true) });
      }catch(e){}
    }
    this.auth = null;
    this.conflict = null;
    this.status = this.isConfigured() ? 'guest' : 'unconfigured';
    this.statusText = '已退出（本地游客模式）';
    await StorageBridge.writeMeta(CLOUD_AUTH_KEY, null);
    if(typeof render === 'function') render();
  },

  async fetchCloudSave(){
    if(!this.isConfigured() || !this.isLoggedIn()) return null;
    await this.ensureValidToken();
    const uid = encodeURIComponent(this.auth.user.id);
    const r = await fetch(`${this.baseUrl()}/rest/v1/user_saves?user_id=eq.${uid}&select=save_data,summary,updated_at`, {
      method: 'GET',
      headers: this.headers(true)
    });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  },

  async pushSave(saveObj){
    if(!saveObj || !this.isConfigured() || !this.isLoggedIn()) return false;
    this.status = 'syncing';
    this.statusText = '正在同步云端…';
    if(typeof render === 'function') render();
    try{
      await this.ensureValidToken();
      const summary = makeSaveSummary(saveObj);
      const body = {
        user_id: this.auth.user.id,
        save_data: saveObj,
        summary,
        updated_at: new Date(summary.updatedAt).toISOString()
      };
      const r = await fetch(`${this.baseUrl()}/rest/v1/user_saves?on_conflict=user_id`, {
        method: 'POST',
        headers: Object.assign({}, this.headers(true), { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(body)
      });
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      this.status = 'synced';
      this.lastSyncAt = Date.now();
      this.statusText = '云端已同步';
      if(typeof render === 'function') render();
      return true;
    }catch(e){
      console.warn('Cloud push failed:', e);
      this.status = 'offline';
      this.statusText = '离线（已存本地）';
      if(typeof render === 'function') render();
      return false;
    }
  },

  schedulePush(saveObj){
    if(!saveObj || !this.isConfigured() || !this.isLoggedIn()) return;
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(()=>{ this.pushSave(saveObj); }, 1400);
  },

  async syncOnLaunch(interactive){
    if(!this.isConfigured() || !this.isLoggedIn()) return { ok:false };
    this.status = 'syncing';
    this.statusText = '检查云端进度…';
    if(typeof render === 'function') render();
    try{
      const row = await this.fetchCloudSave();
      const hasLocal = !!S;
      const hasCloud = !!(row && row.save_data);

      if(!hasLocal && hasCloud){
        S = migrateSave(row.save_data);
        await StorageBridge.writeSaveText(JSON.stringify(S));
        this.status = 'synced';
        this.lastSyncAt = Date.now();
        this.statusText = '已从云端恢复';
        if(typeof render === 'function') render();
        return { ok:true, msg:'已自动加载云端存档！' };
      }
      if(hasLocal && !hasCloud){
        await this.pushSave(S);
        return { ok:true, msg:'已将当前本地进度绑定并上传至云端！' };
      }
      if(hasLocal && hasCloud){
        const localTs = (S._sync && S._sync.updatedAt) || 0;
        const cloudTs = (row.save_data._sync && row.save_data._sync.updatedAt) || Date.parse(row.updated_at || '') || 0;
        const sameProgress = Math.abs(localTs - cloudTs) <= 5000 && S.user === row.save_data.user && S.year === row.save_data.year && S.evIdx === row.save_data.evIdx;
        if(sameProgress){
          this.status = 'synced';
          this.lastSyncAt = Date.now();
          this.statusText = '云端已同步';
          if(typeof render === 'function') render();
          return { ok:true, msg:'本地与云端进度一致！' };
        }
        // 两端存在实质差异：弹出冲突对比框，绝不悄悄覆盖！
        this.conflict = {
          localSave: S,
          localSummary: makeSaveSummary(S),
          cloudSave: migrateSave(row.save_data),
          cloudSummary: Object.assign(makeSaveSummary(row.save_data), row.summary || {}, { updatedAt: cloudTs })
        };
        this.status = 'synced';
        this.statusText = '检测到多端进度差异';
        if(typeof openConflictModal === 'function') openConflictModal();
        else if(typeof render === 'function') render();
        return { ok:true, msg:'检测到云端与本地存档不同，请选择保留哪一份' };
      }
      this.status = 'synced';
      this.statusText = '云端已连接';
      if(typeof render === 'function') render();
      return { ok:true };
    }catch(e){
      console.warn('syncOnLaunch failed:', e);
      this.status = 'offline';
      this.statusText = '离线模式（本地可用）';
      if(typeof render === 'function') render();
      return { ok:false, msg:'暂无法连接云端，已使用本地存档' };
    }
  },

  async resolveConflict(choice){
    if(!this.conflict) return;
    if(choice === 'cloud'){
      S = migrateSave(this.conflict.cloudSave);
      await StorageBridge.writeSaveText(JSON.stringify(S));
      this.status = 'synced';
      this.lastSyncAt = Date.now();
      this.statusText = '已加载云端进度';
    } else if(choice === 'local'){
      S = this.conflict.localSave;
      S._sync = { updatedAt: Date.now(), device: detectPlatformLabel() };
      await StorageBridge.writeSaveText(JSON.stringify(S));
      await this.pushSave(S);
    }
    this.conflict = null;
    if(typeof UI !== 'undefined'){ UI.modal = null; }
    if(typeof render === 'function') render();
  }
};
