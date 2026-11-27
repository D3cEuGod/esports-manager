const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname,'../src/cloud.js'),'utf8');
const rowFor = (save, ms=Date.now()) => ({save_data:save,updated_at:new Date(ms).toISOString()});
const save = (revision, match) => ({
  user:'TES', year:2026, evIdx:0, match,
  _sync:{updatedAt:1000,device:'测试设备',revision}
});
const clone = data => JSON.parse(JSON.stringify(data));

function mockCloud(initial){
  return {
    row:initial, online:true, requests:[], race:null, refresh:null, staleAccess:false,
    async fetch(url, options){
      const {searchParams, pathname} = new URL(url);
      const {method} = options;
      this.requests.push([method,searchParams.get('select')]);
      if(!this.online) return {ok:false,status:503,json:async()=>({})};
      if(pathname.endsWith('/token')) return this.refresh;
      if(this.staleAccess && options.headers.Authorization==='Bearer test') return {ok:false,status:401,json:async()=>({code:'PGRST303'})};
      if(method==='GET'){
        const row = searchParams.get('select')==='updated_at' && this.row ? {updated_at:this.row.updated_at} : this.row;
        return {ok:true,json:async()=>row?[clone(row)]:[]};
      }
      if(this.race){ this.row = this.race; this.race = null; }
      const visibleRevision = searchParams.get('updated_at');
      if(method==='PATCH' && visibleRevision!=='eq.'+this.row?.updated_at || method==='POST' && this.row){
        return {ok:true,json:async()=>[]};
      }
      this.row = JSON.parse(options.body);
      return {ok:true,json:async()=>[{updated_at:this.row.updated_at}]};
    }
  };
}

function device(server, disk=new Map()){
  const events = new Map();
  let repeat, delay, renders=0, notices=0, dialogs=0;
  const context = vm.createContext({
    S:null, UI:{}, SAVE_KEY:'save',
    console:{warn(){}},
    localStorage:{
      getItem:key=>disk.get(key),
      setItem:(key,value)=>disk.set(key,value),
      removeItem:key=>disk.delete(key)
    },
    document:{visibilityState:'visible',addEventListener:(key,cb)=>events.set(key,cb)},
    addEventListener:(key,cb)=>events.set(key,cb),
    setInterval:(cb,ms)=>{repeat={cb,ms};},
    setTimeout:cb=>{delay=cb; return 1;},
    clearTimeout:()=>{delay=null;},
    fetch:server.fetch.bind(server),
    migrateSave:x=>x, render:()=>renders++,
    notifyCloudStatus:label=>{if(label==='待处理存档差异') notices++;}, openConflictModal:()=>dialogs++
  });
  context.window = context;
  const run = code => vm.runInContext(code,context);
  run(source);
  run("CloudSync.auth={access_token:'test',expires_at:Date.now()/1000+3600,user:{id:'same-user'}}");
  const sync = (interactive=false) => run('CloudSync.syncOnLaunch('+interactive+')');
  async function fire(key){
    const cb = key==='tick' ? repeat.cb : key==='save' ? delay : events.get(key);
    assert.equal(typeof cb,'function',key+' registered');
    cb();
    await run('CloudSync._syncJob?.promise');
  }
  function setLocal(data){
    context.S = data;
    disk.set('save',JSON.stringify(data));
  }
  return {run, sync, fire, setLocal, disk, context, interval:()=>repeat.ms, rendered:()=>renders, notices:()=>notices, dialogs:()=>dialogs};
}

async function main(){
  const first = rowFor(save('first',1),10000);
  const server = mockCloud(first);
  const a = device(server);
  const b = device(server);
  await a.sync();
  await b.sync();
  b.run('CloudSync.startAutoSync()');
  assert.equal(b.interval(),15000);

  a.setLocal(save('second',2));
  a.run('CloudSync.schedulePush(S)');
  await a.fire('save');
  assert.equal(server.row.save_data.match,2);
  assert.equal(a.rendered(),1);

  b.context.UI.match = {};
  await b.fire('tick');
  assert.equal(b.context.S.match,1);
  assert.equal(b.rendered(),1);
  assert.deepEqual(server.requests.at(-1),['GET','updated_at']);
  b.context.UI.match = null;
  b.context.document.activeElement = {matches:()=>true};
  await b.fire('focus');
  assert.equal(b.context.S.match,1);
  b.context.document.activeElement = null;
  await b.fire('visibilitychange');
  assert.equal(b.context.S.match,2);
  assert.equal(b.rendered(),2);
  await b.fire('tick');
  assert.deepEqual(server.requests.at(-1),['GET','updated_at']);
  assert.equal(b.rendered(),2);

  b.setLocal(save('offline',3));
  server.online = false;
  assert.equal((await b.sync()).ok,false);
  assert.equal(JSON.parse(b.disk.get('save')).match,3);
  server.online = true;
  const restarted = device(server,b.disk);
  restarted.run('CloudSync.startAutoSync()');
  await restarted.fire('online');
  assert.equal(server.row.save_data.match,3);
  assert.equal(restarted.rendered(),0);

  // 同步基线相同，两台设备分别修改。自动发现冲突时只提示，保留两份。
  await a.sync();
  a.setLocal(save('device-a',4));
  restarted.setLocal(save('device-b',5));
  await a.sync();
  await restarted.fire('tick');
  assert.equal(restarted.context.S.match,5);
  assert.equal(server.row.save_data.match,4);
  assert.equal(restarted.notices(),1);
  assert.equal(restarted.dialogs(),0);
  await restarted.sync(true);
  assert.equal(restarted.dialogs(),1);
  assert.equal((await restarted.run("CloudSync.resolveConflict('cloud')")).ok,true);
  assert.equal(restarted.context.S.match,4);

  restarted.setLocal(save('race-local',6));
  server.race = rowFor(save('race-cloud',7),Date.parse(server.row.updated_at)+50);
  await restarted.sync();
  assert.equal(server.row.save_data.match,7);
  assert.equal(restarted.context.S.match,6);
  assert.equal(restarted.run('CloudSync.conflict.cloudSave.match'),7);

  const manualCloud = mockCloud(rowFor(save('manual-base',1)));
  const manualDevice = device(manualCloud);
  await manualDevice.sync();
  manualCloud.row = rowFor(save('manual-remote',2),Date.parse(manualCloud.row.updated_at)+50);
  await manualDevice.run('CloudSync.syncOnLaunch(true,{preferLocal:true})');
  assert.equal(manualDevice.context.S.match,1);
  assert.equal(manualDevice.dialogs(),1);
  assert.equal(manualCloud.row.save_data.match,2);

  // 未升级的两个不同旧档相差不足 5 秒，仍能识别场次改动。
  const older = save(undefined,1);
  const newer = save(undefined,2);
  newer._sync.updatedAt += 4000;
  const legacyServer = mockCloud(rowFor(newer));
  const legacy = device(legacyServer,new Map([['save',JSON.stringify(older)]]));
  const result = await legacy.sync();
  assert.match(result.msg,/差异/);
  assert.equal(JSON.parse(legacy.disk.get('save')).match,1);
  assert.equal(legacy.run('CloudSync.conflict.cloudSave.match'),2);

  const emptyCloud = mockCloud(null);
  const cleanStart = device(emptyCloud,new Map([['save',JSON.stringify(save('local-only',8))]]));
  cleanStart.run('CloudSync.startAutoSync()');
  emptyCloud.online = false;
  assert.equal((await cleanStart.sync()).ok,false);
  assert.equal(emptyCloud.row,null);
  emptyCloud.online = true;
  await cleanStart.fire('tick');
  assert.equal(emptyCloud.row.save_data.match,8);

  const authCloud = mockCloud(rowFor(save('cloud-session',9)));
  authCloud.staleAccess = true;
  authCloud.refresh = {
    ok:true,status:200,
    json:async()=>({access_token:'refreshed',refresh_token:'rotated',expires_in:3600})
  };
  const authDevice = device(authCloud);
  authDevice.run("CloudSync.auth.refresh_token='fake-refresh'");
  assert.equal((await authDevice.sync()).ok,true);
  assert.equal(authDevice.context.S.match,9);
  assert.equal(authDevice.run('CloudSync.auth.access_token'),'refreshed');

  const expired = mockCloud(null);
  expired.refresh = {
    ok:false,status:400,json:async()=>({error_code:'refresh_token_not_found'})
  };
  const expiredDevice = device(expired,new Map([['save',JSON.stringify(save('protected',10))]]));
  expiredDevice.run("CloudSync.auth.expires_at=1; CloudSync.auth.refresh_token='fake-revoked'");
  assert.match((await expiredDevice.sync()).msg,/重新登录/);
  assert.equal(expiredDevice.run('CloudSync.isLoggedIn()'),false);
  assert.equal(JSON.parse(expiredDevice.disk.get('save')).match,10);
  assert.equal(expired.requests.length,1);
  console.log('✓ 云同步：静默轮询、操作中延后、离线重试、并发保护和会话过期');

  const accounts=mockCloud(null), defaultFetch=accounts.fetch.bind(accounts);
  const session={access_token:'fictional-session',refresh_token:'fictional-refresh',user:{id:'test-user',email:'test@example.invalid'}};
  const seenAuth=[];
  accounts.fetch=async(url,options)=>{
    const {pathname,searchParams}=new URL(url);
    if(!pathname.includes('/auth/v1/')) return defaultFetch(url,options);
    const action=pathname.split('/').at(-1);
    seenAuth.push(action);
    const input=options.body?JSON.parse(options.body):{};
    if(action==='verify' && input.token!=='123456') return {ok:false,status:400,json:async()=>({message:'invalid code'})};
    if(action==='token') assert.equal(searchParams.get('grant_type'),'password');
    if(action==='logout') assert.equal(searchParams.get('scope'),'local');
    return {ok:true,status:200,json:async()=>action==='verify'||action==='token'?session:{}};
  };
  const login=device(accounts);
  login.run('CloudSync.auth=null');
  assert.equal((await login.run("CloudSync.signUp('invalid','short')")).ok,false);
  assert.equal((await login.run("CloudSync.signUp('test@example.invalid','fictional-pass')")).needConfirm,true);
  assert.equal((await login.run("CloudSync.resendSignupOtp('test@example.invalid')")).ok,true);
  assert.equal((await login.run("CloudSync.verifySignupOtp('test@example.invalid','654321')")).ok,false);
  assert.equal((await login.run("CloudSync.verifySignupOtp('test@example.invalid','123456')")).ok,true);
  assert.equal(login.run('CloudSync.isLoggedIn()'),true);
  login.setLocal(save('logout-keeps-local',11));
  await login.run('CloudSync.signOut()');
  assert.equal(login.run('CloudSync.isLoggedIn()'),false);
  assert.equal(JSON.parse(login.disk.get('save')).match,11);
  assert.equal((await login.run("CloudSync.signIn('test@example.invalid','fictional-pass')")).ok,true);
  assert.deepEqual(seenAuth,['signup','resend','verify','verify','logout','token']);

  const app=device(mockCloud(null));
  const nativeFiles=new Map();
  app.context.__TAURI__={core:{invoke:async(name,args)=>{
    if(name==='get_save_path') return 'test-fixture/save.json';
    if(name==='write_local_save'){ nativeFiles.set('save',args.content); return; }
    if(name==='load_local_save') return nativeFiles.get('save');
    if(name==='delete_local_save'){ nativeFiles.delete('save'); return; }
    throw Error(name);
  }}};
  await app.run('StorageBridge.init()');
  assert.equal(app.run('StorageBridge.savePath'),'test-fixture/save.json');
  await app.run("StorageBridge.writeSaveText('{\"a\":1}')");
  assert.equal(await app.run('StorageBridge.readSaveText()'),'{"a":1}');
  await app.run('StorageBridge.deleteSave()');
  assert.equal(nativeFiles.has('save'),false);
  assert.equal(app.disk.has('save'),false);
  console.log('✓ 测试账号：注册、验证码、登录、退出、本地保留及桌面存储桥接');
}

main().catch(err=>{
  console.error(err);
  process.exitCode = 1;
});
