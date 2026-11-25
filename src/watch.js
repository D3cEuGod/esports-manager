// ================= 实时观战 / 回放（Canvas 召唤师峡谷小地图 + 1v1 中路对线） =================
// 依赖 sim.js（createGame5 / step5 / createSolo / soloStep …）与 ui.js（render、esc、teamTag、champName、champAvatar）
const Watch = (()=>{
  const SPEEDS = [1,2,4,8];
  const imgCache = {};
  function champImg(c){
    if(!c) return null;
    let it = imgCache[c];
    if(!it){
      const im = new Image(); im.decoding = 'async';
      it = imgCache[c] = {im, ok:false, bad:false};
      im.onload = ()=>{ it.ok = true; };
      im.onerror = ()=>{ it.bad = true; };
      im.src = champIconUrl(c);
    }
    return it;
  }
  const SPELL = {flash:'SummonerFlash', ig:'SummonerDot', bar:'SummonerBarrier'};
  const spellUrl = k => `https://ddragon.leagueoflegends.com/cdn/${window.DDRAGON_VER||'16.2.1'}/img/spell/${SPELL[k]}.png`;
  const BLUE = '#0ac8b9', RED = '#e84057', GOLD = '#c89b3c';
  const DRAKE_COLOR = {infernal:'#ff6a3d', ocean:'#3fb6ff', mountain:'#b98a52', cloud:'#cfe3f0', hextech:'#55e0ff', chemtech:'#8fe04a'};
  const DRAKE_CN = {}; DRAKES.forEach(([k,cn])=>DRAKE_CN[k]=cn.replace('亚龙',''));

  let W = null;          // 当前观战会话
  let raf = 0, lastTs = 0;

  // ---------------- 拟真召唤师峡谷底图（按原版地形比例精细绘制，只画一次） ----------------
  let bgCanvas = null;
  function mapBackground(){
    if(bgCanvas) return bgCanvas;
    const S0 = 1000;
    const cv = document.createElement('canvas'); cv.width = S0; cv.height = S0;
    const g = cv.getContext('2d');

    // 1. 峡谷底土与蓝红半区环境渐变
    const grd = g.createLinearGradient(0, S0, S0, 0);
    grd.addColorStop(0, '#122926');
    grd.addColorStop(0.38, '#17342b');
    grd.addColorStop(0.50, '#14322d');
    grd.addColorStop(0.62, '#242d22');
    grd.addColorStop(1, '#2d1f21');
    g.fillStyle = grd; g.fillRect(0, 0, S0, S0);

    // 细微草地纹理噪点（固定种子）
    const rr = srand(20260525);
    for(let i=0;i<220;i++){
      const x = rr()*S0, y = rr()*S0;
      g.fillStyle = rr()>0.5 ? 'rgba(120,185,110,0.045)' : 'rgba(5,16,12,0.08)';
      g.beginPath(); g.arc(x, y, 8+rr()*22, 0, Math.PI*2); g.fill();
    }

    // 2. 蓝/红基地高地石砖轮廓（左下蓝方高地、右上红方高地）
    const drawBase = (isBlue) => {
      g.save();
      g.beginPath();
      if(isBlue){
        g.moveTo(0, S0); g.lineTo(0, 685); g.quadraticCurveTo(185, 685, 260, 740); g.quadraticCurveTo(315, 815, 315, S0);
      } else {
        g.moveTo(S0, 0); g.lineTo(685, 0); g.quadraticCurveTo(685, 185, 740, 260); g.quadraticCurveTo(815, 315, S0, 315);
      }
      g.closePath();
      const rg = isBlue
        ? g.createRadialGradient(90, 910, 25, 120, 880, 280)
        : g.createRadialGradient(910, 90, 25, 880, 120, 280);
      rg.addColorStop(0, isBlue ? '#1c4469' : '#5c202c');
      rg.addColorStop(0.65, isBlue ? '#173046' : '#3a1d24');
      rg.addColorStop(1, isBlue ? '#132635' : '#2b191d');
      g.fillStyle = rg; g.fill();
      g.strokeStyle = isBlue ? 'rgba(90,190,220,0.45)' : 'rgba(232,90,110,0.42)';
      g.lineWidth = 6; g.stroke();
      // 泉水光晕
      const fx = isBlue ? 52 : 948, fy = isBlue ? 948 : 52;
      const fg = g.createRadialGradient(fx, fy, 4, fx, fy, 74);
      fg.addColorStop(0, isBlue ? 'rgba(56,220,255,0.55)' : 'rgba(255,95,120,0.5)');
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fg; g.beginPath(); g.arc(fx, fy, 74, 0, Math.PI*2); g.fill();
      g.restore();
    };
    drawBase(true); drawBase(false);

    // 3. 原版对角河道（深浅水层 + 河岸）
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(118, 122);
    g.bezierCurveTo(280, 270, 420, 415, 500, 500);
    g.bezierCurveTo(580, 585, 720, 730, 882, 878);
    g.strokeStyle = 'rgba(18,52,68,0.85)'; g.lineWidth = 86; g.stroke();
    g.strokeStyle = 'rgba(32,102,138,0.75)'; g.lineWidth = 64; g.stroke();
    g.strokeStyle = 'rgba(72,165,204,0.34)'; g.lineWidth = 28; g.stroke();
    g.restore();

    // 4. 大龙坑 & 小龙坑凹槽地形（原版半月形岩壁开口朝向河道）
    const drawPit = (pt, angle, rimCol, glowCol) => {
      g.save(); g.translate(pt[0], pt[1]);
      const pg = g.createRadialGradient(0, 0, 8, 0, 0, 56);
      pg.addColorStop(0, glowCol); pg.addColorStop(1, 'rgba(10,22,28,0.85)');
      g.fillStyle = pg; g.beginPath(); g.arc(0, 0, 50, 0, Math.PI*2); g.fill();
      g.strokeStyle = '#091412'; g.lineWidth = 14;
      g.beginPath(); g.arc(0, 0, 52, angle, angle + Math.PI*1.38); g.stroke();
      g.strokeStyle = rimCol; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 46, angle, angle + Math.PI*1.38); g.stroke();
      g.restore();
    };
    drawPit(MAP5.baron, Math.PI*0.65, 'rgba(170,110,255,0.55)', 'rgba(110,55,175,0.35)');
    drawPit(MAP5.dragon, -Math.PI*0.35, 'rgba(255,150,70,0.55)', 'rgba(195,95,35,0.32)');

    // 5. 三路兵线大道（暗边 + 石板路 + 淡金中线）
    for(const k of ['top','mid','bot']){
      const pts = MAP5.lanes[k];
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(6,14,12,0.72)'; g.lineWidth = 54;
      g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke();
      g.strokeStyle = '#544e3c'; g.lineWidth = 40; g.stroke();
      g.strokeStyle = '#686049'; g.lineWidth = 26; g.stroke();
      g.strokeStyle = 'rgba(220,190,130,0.22)'; g.lineWidth = 2; g.stroke();
    }

    // 6. 原版野区岩墙地形块（上下野区对称布局，留出清晰野区通道）
    const walls = [
      // 蓝方上半野区 & 蓝区
      [215, 455, 44, 24, -0.5], [270, 520, 32, 18, 0.3], [195, 585, 36, 20, -0.2], [350, 420, 26, 16, 0.7],
      // 蓝方下半野区 & 红区
      [445, 765, 44, 24, 0.45], [530, 705, 34, 20, -0.4], [585, 815, 36, 18, 0.2], [415, 650, 28, 16, -0.6],
      // 红方上半野区 & 红区
      [555, 235, 44, 24, 0.45], [470, 295, 34, 20, -0.4], [415, 185, 36, 18, 0.2], [585, 350, 28, 16, -0.6],
      // 红方下半野区 & 蓝区
      [785, 545, 44, 24, -0.5], [730, 480, 32, 18, 0.3], [805, 415, 36, 20, -0.2], [650, 580, 26, 16, 0.7],
      // 中路两侧河道短墙
      [395, 465, 24, 11, -0.75], [605, 535, 24, 11, -0.75],
      [465, 605, 24, 11, -0.75], [535, 395, 24, 11, -0.75],
    ];
    for(const [x,y,rx,ry,ang] of walls){
      g.save(); g.translate(x,y); g.rotate(ang);
      g.fillStyle = 'rgba(4,12,11,0.88)';
      g.beginPath(); g.ellipse(2, 4, rx+4, ry+4, 0, 0, Math.PI*2); g.fill();
      g.fillStyle = '#1b2c2a';
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2); g.fill();
      g.strokeStyle = 'rgba(130,170,150,0.22)'; g.lineWidth = 2; g.stroke();
      g.restore();
    }

    // 7. 关键战术草丛（河道点草、三角草、边路三草、中路边草、Buff 草丛）
    const bushes = [
      [345,345,14,10,0.7], [655,655,14,10,0.7],             // 河道点草
      [430,490,22,8,-0.75], [570,510,22,8,-0.75],           // 中路两侧长草
      [180,255,20,9,0.5], [820,745,20,9,0.5],               // 上下三角草
      [84,320,10,22,0], [84,210,10,22,0], [220,84,22,10,0], // 上路边草
      [916,680,10,22,0], [916,790,10,22,0], [780,916,22,10,0], // 下路边草
      [255,485,16,8,0.4], [485,745,16,8,-0.4],              // 蓝方野区草
      [745,515,16,8,0.4], [515,255,16,8,-0.4],              // 红方野区草
    ];
    for(const [x,y,rx,ry,ang] of bushes){
      g.save(); g.translate(x,y); g.rotate(ang);
      g.fillStyle = 'rgba(56,158,76,0.55)';
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2); g.fill();
      g.strokeStyle = 'rgba(128,230,132,0.35)'; g.lineWidth = 1.5; g.stroke();
      g.restore();
    }

    // 8. 外框海克斯金边
    g.strokeStyle = 'rgba(200,155,60,0.75)'; g.lineWidth = 6; g.strokeRect(3, 3, S0-6, S0-6);
    bgCanvas = cv; return cv;
  }

  // ---------------- 视图模型 ----------------
  // 实时：直接读模拟状态；回放：从关键帧重建
  function view5Live(G, frac){
    const champs = G.champs.map(c=>{
      const x = c.px + (c.x - c.px)*frac, y = c.py + (c.y - c.py)*frac;
      return { i:c.i, side:c.side, blue:c.blue, role:c.role, tag:c.tag, c:c.c, cn:c.cn, x, y, hp:c.hp, alive:c.alive, rt:Math.max(0,Math.ceil(c.rt)),
        lvl:c.lvl, k:c.k, d:c.d, a:c.a, cs:Math.round(c.cs), gold:Math.round(c.tg), cur:Math.round(Math.max(0,c.gold)), items:c.items, partial:c.partial>0?c.build.comp:null, recall:c.recall>0 };
    });
    return { t:G.t, champs, towers:G.towers.map(tw=>({x:tw.x,y:tw.y,side:tw.side,tier:tw.tier,alive:tw.alive,hp:tw.hp})),
      front:G.front, obj:G.obj, team:G.team, feed:G.feed, gs:G.gs, fx:G.fx, over:G.over, winner:G.winner, blueSide:G.d.blue };
  }
  // 回放：预先把事件按时间整理好，便于任意时刻定位
  function prepRec(rec){
    if(rec._prep) return rec._prep;
    const towers = buildTowers();
    const P0 = { towers, kills:[], items:[], towerEv:[], resp:[], obj:[], fights:[] };
    for(const e of rec.ev){
      const [t,k] = e;
      if(k==='K') P0.kills.push(e); else if(k==='B' || k==='S') P0.items.push(e);   // 买卖保持录像原顺序
      else if(k==='T') P0.towerEv.push(e); else if(k==='R') P0.resp.push(e); else if(k==='O') P0.obj.push(e); else if(k==='F') P0.fights.push(e);
    }
    rec._prep = P0; return P0;
  }
  function view5Rec(rec, t){
    const P0 = prepRec(rec);
    // 录像约定：f[k] 对应第 3k 秒（f[0] 为开局）；st[k] 对应第 12k 秒，最后一条为终局
    const fi = clamp(t/3, 0, rec.f.length-1);
    const i0 = Math.floor(fi), i1 = Math.min(rec.f.length-1, i0+1), fr = fi - i0;
    const f0 = rec.f[i0], f1 = rec.f[i1];
    const si = t >= rec.dur ? rec.st.length-1 : clamp(Math.floor(t/12), 0, rec.st.length-1), st = rec.st[si];
    const champs = rec.champs.map((c,i)=>{
      const x0 = dec1(f0,i*3)/63*1000, y0 = dec1(f0,i*3+1)/63*1000, h0 = dec1(f0,i*3+2)/63;
      const x1 = dec1(f1,i*3)/63*1000, y1 = dec1(f1,i*3+1)/63*1000;
      const o = i*7;
      return { i, side:c.side, blue:c.side===rec.blue, role:c.role, tag:c.tag, c:c.c, cn:CH[c.c]?CH[c.c].cn:c.role,
        x: x0+(x1-x0)*fr, y: y0+(y1-y0)*fr, hp:h0, alive:h0>0, rt:0, lvl:dec1(st,o+4), k:0, d:0, a:0,
        cs:dec2(st,o), gold:dec2(st,o+2)*10, cur:dec2(st,o+5)*10, items:[], partial:null, recall:false };
    });
    for(const e of P0.kills){ if(e[0] > t) break; champs[e[2]].k++; champs[e[3]].d++; e[4].forEach(a=>champs[a].a++); const v = champs[e[3]]; if(t < e[0]+e[5]) v.rt = Math.ceil(e[0]+e[5]-t); }
    for(const e of P0.items){
      if(e[0] > t) break;
      const its = champs[e[2]].items;
      if(e[1]==='S'){ its.splice(e[3],1); continue; }
      // 旧录像的辅助装升级没有记卖出：买入升级装时移除世界地图集
      if(ITEMS[e[3]] && ITEMS[e[3]][2]==='sup'){ const k = its.indexOf(3865); if(k>=0) its.splice(k,1); }
      its.push(e[3]);
    }
    const towers = P0.towers.map(tw=>({x:tw.x,y:tw.y,side:tw.side,tier:tw.tier,alive:true,hp:1}));
    const tev = P0.towerEv.concat(P0.resp).sort((a,b)=>a[0]-b[0]);
    for(const e of tev){ if(e[0] > t) break; towers[e[2]].alive = e[1]==='R'; }
    const team = {A:{drakes:[], barons:0, towers:0, kills:0, soul:null, baronT:0, elderT:0, name:teamName(rec.teams.A), blue:rec.blue==='A', color:rec.blue==='A'?'blue':'red'},
                  B:{drakes:[], barons:0, towers:0, kills:0, soul:null, baronT:0, elderT:0, name:teamName(rec.teams.B), blue:rec.blue==='B', color:rec.blue==='B'?'blue':'red'}};
    for(const e of P0.towerEv){ if(e[0] > t) break; if(towers[e[2]] && P0.towers[e[2]].tier!==4 && P0.towers[e[2]].tier!==6) team[e[3]].towers++; }
    for(const e of P0.obj){ if(e[0] > t) break; const tm = team[e[3]]; if(e[2]==='drag'){ tm.drakes.push(e[4]); if(tm.drakes.length>=4) tm.soul = e[4]; } else if(e[2]==='baron'){ tm.barons++; tm.baronT = e[0]+180; } else if(e[2]==='elder') tm.elderT = e[0]+150; }
    champs.forEach(c=>team[c.side].kills += c.k);
    const feed = []; for(const x of rec.feed){ if(x[0] > t) break; feed.push({t:fmtSec(x[0]), sec:x[0], side:x[1]||null, tag:x[2], text:x[3], hl:!!x[4]}); }
    const gs = rec.gs.filter(x=>x[0] <= t);
    const fx = P0.fights.filter(e=>e[0] <= t && e[0] > t-4).map(e=>({t:e[0], x:e[2], y:e[3], n:e[4]}));
    // 资源刷新状态（近似）：最近一次被拿的时间 + 刷新间隔
    const lastObj = k => { let l=null; for(const e of P0.obj){ if(e[0]>t) break; if(e[2]===k) l=e; } return l; };
    const ld = lastObj('drag'), lb = lastObj('baron'), le = lastObj('elder');
    const soulDone = team.A.drakes.length>=4 || team.B.drakes.length>=4;
    const obj = { drag:{up: !soulDone && (ld ? t>=ld[0]+300 : t>=300), next: soulDone?null:(ld?ld[0]+300:300), type:null},
      baron:{up: lb ? t>=lb[0]+360 : t>=1200, next: lb?lb[0]+360:1200}, elder:{up: soulDone && (le ? t>=le[0]+360 : false), next:null}, grubs:{up:false}, herald:{up:false} };
    return { t, champs, towers, front:null, obj, team, feed, gs, fx, over: t >= rec.dur, winner:null, blueSide:rec.blue };
  }

  // ---------------- 绘制小地图 ----------------
  function drawMap(cv, V){
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W0 = cv.clientWidth || 400;
    if(cv.width !== Math.round(W0*dpr)){ cv.width = Math.round(W0*dpr); cv.height = Math.round(W0*dpr); }
    const k = cv.width/1000;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(mapBackground(), 0, 0, cv.width, cv.height);
    ctx.setTransform(k,0,0,k,0,0);
    // 兵线
    if(V.front){
      for(const lane of ['top','mid','bot']){
        const [x,y] = lanePt(lane, V.front[lane]);
        const [xb,yb] = lanePt(lane, V.front[lane]-0.025), [xr,yr] = lanePt(lane, V.front[lane]+0.025);
        ctx.fillStyle = '#4aa3ff'; for(let i=0;i<3;i++){ ctx.fillRect(xb-6+i*5-4, yb-4+(i%2)*5, 6, 6); }
        ctx.fillStyle = '#ff5a6e'; for(let i=0;i<3;i++){ ctx.fillRect(xr-6+i*5-4, yr-4+(i%2)*5, 6, 6); }
        ctx.strokeStyle = 'rgba(255,230,160,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x,y,12,0,Math.PI*2); ctx.stroke();
      }
    }
    // 防御塔 / 水晶
    for(const tw of V.towers){
      const col = tw.side==='blue' ? BLUE : RED;
      ctx.save(); ctx.translate(tw.x, tw.y);
      if(tw.tier===6){
        ctx.beginPath(); for(let i=0;i<6;i++){ const a = Math.PI/3*i; ctx.lineTo(Math.cos(a)*26, Math.sin(a)*26); } ctx.closePath();
        ctx.fillStyle = tw.alive ? col : '#333'; ctx.globalAlpha = tw.alive?0.9:0.5; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke();
      } else if(tw.tier===4){
        ctx.rotate(Math.PI/4); ctx.fillStyle = tw.alive ? col : 'rgba(80,80,80,0.6)'; ctx.fillRect(-9,-9,18,18); ctx.strokeStyle = '#091428'; ctx.lineWidth = 2; ctx.strokeRect(-9,-9,18,18);
      } else {
        if(tw.alive){ ctx.fillStyle = '#091428'; ctx.fillRect(-11,-11,22,22); ctx.fillStyle = col; ctx.fillRect(-8,-8,16,16); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-8, 10, 16*Math.max(0,tw.hp), 3); }
        else { ctx.strokeStyle = 'rgba(160,160,160,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-7,-7); ctx.lineTo(7,7); ctx.moveTo(7,-7); ctx.lineTo(-7,7); ctx.stroke(); }
      }
      ctx.restore();
    }
    // 大小龙
    const drawObj = (pt, up, label, col, timer) => {
      ctx.save(); ctx.translate(pt[0], pt[1]);
      ctx.beginPath(); ctx.arc(0,0,24,0,Math.PI*2); ctx.fillStyle = up ? col : 'rgba(20,20,30,0.75)'; ctx.fill();
      ctx.strokeStyle = up ? '#fff' : 'rgba(200,155,60,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = up ? '#091428' : '#a09b8c'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(up ? label : (timer!=null ? fmtSec(timer) : '—'), 0, 1);
      ctx.restore();
    };
    const o = V.obj, t = V.t;
    if(o.elder && o.elder.up) drawObj(MAP5.dragon, true, '远古', '#d9c27a');
    else drawObj(MAP5.dragon, o.drag.up, '龙', DRAKE_COLOR[o.drag.type]||'#ff8a3d', o.drag.next!=null && o.drag.next>t ? o.drag.next-t : null);
    if(t < 840 && o.grubs && o.grubs.up) drawObj(MAP5.baron, true, '虫', '#b07cff');
    else if(o.herald && o.herald.up) drawObj(MAP5.baron, true, '先锋', '#b07cff');
    else drawObj(MAP5.baron, o.baron.up, '男爵', '#9b59ff', o.baron.next>t ? o.baron.next-t : null);
    // 团战特效
    for(const f of V.fx||[]){
      const age = clamp((t - f.t)/4, 0, 1);
      ctx.beginPath(); ctx.arc(f.x, f.y, 20 + age*60, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(255,${f.n>=3?80:200},60,${(1-age)*0.9})`; ctx.lineWidth = 6*(1-age)+1; ctx.stroke();
      if(f.n>0 && age < 0.6){ ctx.fillStyle = `rgba(255,220,120,${(0.6-age)})`; ctx.font = 'bold 26px sans-serif'; ctx.textAlign='center'; ctx.fillText('⚔', f.x, f.y+9); }
    }
    // 英雄头像
    const R = 24;
    for(const c of V.champs){
      if(!c.alive) continue;
      const col = c.blue ? BLUE : RED;
      ctx.save(); ctx.translate(c.x, c.y);
      ctx.beginPath(); ctx.arc(0,0,R+4,0,Math.PI*2); ctx.fillStyle = col; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.clip();
      const im = champImg(c.c);
      if(im && im.ok){ ctx.drawImage(im.im, -R, -R, R*2, R*2); }
      else { ctx.fillStyle = `hsl(${hash(c.c||c.role)%360},45%,28%)`; ctx.fillRect(-R,-R,R*2,R*2); ctx.fillStyle = '#f0e6d2'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText((c.cn||'').slice(0,2), 0, 1); }
      if(c.recall){ ctx.fillStyle = 'rgba(60,140,255,0.45)'; ctx.fillRect(-R,-R,R*2,R*2); }
      ctx.restore();
      // 血条 + 名字
      const bw = 58, by = -R-16;
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(-bw/2-1, by-1, bw+2, 9);
      ctx.fillStyle = c.hp>0.5 ? '#3ddc84' : c.hp>0.25 ? '#f5c542' : '#ff4d5e'; ctx.fillRect(-bw/2, by, bw*clamp(c.hp,0,1), 7);
      ctx.font = 'bold 17px "Noto Sans SC",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(c.tag, 0, by-3);
      ctx.fillStyle = c.blue ? '#bff6f0' : '#ffd0d6'; ctx.fillText(c.tag, 0, by-3);
      ctx.restore();
    }
  }
  function drawGold(cv, V){
    const ctx = cv.getContext('2d'); const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 300, h = cv.clientHeight || 70;
    if(cv.width !== Math.round(w*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    ctx.fillStyle = 'rgba(1,10,19,0.75)'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(200,155,60,0.35)'; ctx.beginPath(); ctx.moveTo(0,h/2); ctx.lineTo(w,h/2); ctx.stroke();
    const gs = V.gs; if(!gs.length) return;
    const blueIsA = V.blueSide==='A';
    const maxT = Math.max(900, V.t), maxG = Math.max(3000, ...gs.map(x=>Math.abs(x[1])));
    ctx.lineWidth = 2;
    ctx.beginPath();
    gs.forEach(([t,dv],i)=>{ const v = blueIsA ? dv : -dv; const x = t/maxT*w, y = h/2 - v/maxG*(h/2-6); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.strokeStyle = GOLD; ctx.stroke();
    const last = gs[gs.length-1][1]*(blueIsA?1:-1);
    ctx.font = 'bold 11px "Barlow Condensed",sans-serif'; ctx.fillStyle = last>=0 ? BLUE : RED; ctx.textAlign = 'right';
    ctx.fillText(`${last>=0?'蓝方':'红方'} +${(Math.abs(last)/1000).toFixed(1)}k`, w-6, 13);
    ctx.textAlign='left'; ctx.fillStyle = '#a09b8c'; ctx.fillText('经济差', 6, 13);
  }

  // ---------------- DOM 面板 ----------------
  const kfmt = g => (g/1000).toFixed(1)+'k';
  function itemsHtml(items, partial){
    const cells = [];
    for(let i=0;i<6;i++){ const id = items[i]; cells.push(id ? `<span class="it" title="${esc(ITEM_CN(id))}"><img src="${itemIconUrl(id)}" alt="" onerror="this.remove()"><em>${esc(ITEM_CN(id).slice(0,2))}</em></span>` : (i===items.length && partial ? `<span class="it part" title="合成中：${esc(ITEM_CN(partial))}"><img src="${itemIconUrl(partial)}" alt="" onerror="this.remove()"><em>${esc(ITEM_CN(partial).slice(0,2))}</em></span>` : '<span class="it empty"></span>')); }
    return cells.join('');
  }
  function scoreHtml(V){
    const L = V.blueSide, R = other(L);
    const tL = V.team[L], tR = V.team[R];
    const gL = V.champs.filter(c=>c.side===L).reduce((a,c)=>a+c.gold,0);
    const gR = V.champs.filter(c=>c.side===R).reduce((a,c)=>a+c.gold,0);
    const gDiff = gL - gR;
    const gPctL = clamp(Math.round(50 + clamp(gDiff / 14000, -0.36, 0.36) * 100), 14, 86);
    const icoFn = typeof ico === 'function' ? ico : () => '';
    const drk = tm => {
      const orbs = tm.drakes.map(d=>`<i class="dk" style="--c:${DRAKE_COLOR[d]||'#888'}" title="${esc(DRAKE_CN[d]||'')}"></i>`).join('');
      const slots = Math.max(0, 4 - tm.drakes.length);
      return orbs + '<i class="dk emp"></i>'.repeat(slots) + (tm.soul?`<b class="soul">龙魂</b>`:'');
    };
    const buff = tm => (tm.baronT>V.t?`<span class="bf bar">${icoFn('baron')}大龙 ${Math.ceil(tm.baronT-V.t)}s</span>`:'') + (tm.elderT>V.t?`<span class="bf eld">${icoFn('dragon')}远古 ${Math.ceil(tm.elderT-V.t)}s</span>`:'');
    const diffLead = Math.abs(gDiff) < 300
      ? `<span class="adv-chip even">经济均势</span>`
      : `<span class="adv-chip ${gDiff>0?'blue':'red'}">${gDiff>0?esc(tL.name):esc(tR.name)} 经济 +${kfmt(Math.abs(gDiff))}</span>`;
    const tDiff = tL.towers - tR.towers;
    const dDiff = tL.drakes.length - tR.drakes.length;
    const advTags = [
      diffLead,
      tDiff!==0 ? `<span class="adv-chip ${tDiff>0?'blue':'red'}">${icoFn('tower')} 推塔 ${tL.towers}:${tR.towers}</span>` : `<span class="adv-chip even">${icoFn('tower')} 推塔 ${tL.towers}:${tR.towers}</span>`,
      dDiff!==0 ? `<span class="adv-chip ${dDiff>0?'blue':'red'}">${icoFn('dragon')} 小龙 ${tL.drakes.length}:${tR.drakes.length}</span>` : `<span class="adv-chip even">${icoFn('dragon')} 小龙 ${tL.drakes.length}:${tR.drakes.length}</span>`,
      (tL.barons||tR.barons) ? `<span class="adv-chip ${(tL.barons-tR.barons)>=0?'blue':'red'}">${icoFn('baron')} 大龙 ${tL.barons}:${tR.barons}</span>` : ''
    ].filter(Boolean).join('');

    return `<div class="w5-ob-top">
      <div class="w5-tm blue">
        <b class="w5-tn">${esc(tL.name)}</b>
        <span class="w5-res">
          <span class="w5-st ${gDiff>800?'lead':''}" title="团队总经济">${icoFn('gold','c-gold')}<b>${kfmt(gL)}</b></span>
          <span class="w5-st ${tDiff>0?'lead':''}" title="摧毁防御塔">${icoFn('tower')}<b>${tL.towers}</b></span>
          <span class="w5-st ${tL.barons>tR.barons?'lead':''}" title="纳什男爵">${icoFn('baron','c-bar')}<b>${tL.barons}</b></span>
          <span class="w5-dk" title="元素亚龙">${icoFn('dragon','c-drk')}${drk(tL)}</span>
          ${buff(tL)}
        </span>
        <span class="w5-k">${tL.kills}</span>
      </div>
      <div class="w5-mid-hud">
        <div class="w5-clock">${fmtSec(V.t)}</div>
      </div>
      <div class="w5-tm red">
        <span class="w5-k">${tR.kills}</span>
        <span class="w5-res">
          ${buff(tR)}
          <span class="w5-dk" title="元素亚龙">${drk(tR)}${icoFn('dragon','c-drk')}</span>
          <span class="w5-st ${tR.barons>tL.barons?'lead':''}" title="纳什男爵">${icoFn('baron','c-bar')}<b>${tR.barons}</b></span>
          <span class="w5-st ${tDiff<0?'lead':''}" title="摧毁防御塔">${icoFn('tower')}<b>${tR.towers}</b></span>
          <span class="w5-st ${gDiff<-800?'lead':''}" title="团队总经济">${icoFn('gold','c-gold')}<b>${kfmt(gR)}</b></span>
        </span>
        <b class="w5-tn">${esc(tR.name)}</b>
      </div>
    </div>
    <div class="w5-ob-adv">
      <div class="w5-tug"><i class="bl" style="width:${gPctL}%"></i><i class="rd" style="width:${100-gPctL}%"></i></div>
      <div class="w5-adv-tags">${advTags}</div>
    </div>`;
  }
  function playersHtml(V){
    const col = s => V.champs.filter(c=>c.side===s).map(c=>`<div class="w5-p ${c.alive?'':'dead'}">
        <span class="w5-ava">${champAvatar(c.c,'xs')}<b class="lv">${c.lvl}</b>${!c.alive&&c.rt?`<b class="rt">${c.rt}</b>`:''}</span>
        <span class="w5-nm"><b>${esc(c.tag)}</b><small>${esc(c.cn||'')}</small><i class="hpb"><i style="width:${Math.round(clamp(c.hp,0,1)*100)}%"></i></i></span>
        <span class="w5-kda">${c.k}/${c.d}/${c.a}</span><span class="w5-cs">${c.cs}</span><span class="w5-g">${kfmt(c.gold)}</span></div>`).join('');
    const L = V.blueSide, R = other(L);
    return `<div class="w5-pcol blue"><div class="w5-ph"><span>选手</span><span>K/D/A</span><span>补刀</span><span>经济</span></div>${col(L)}</div>
      <div class="w5-pcol red"><div class="w5-ph"><span>选手</span><span>K/D/A</span><span>补刀</span><span>经济</span></div>${col(R)}</div>`;
  }
  function tabHtml(V){
    const row = c => `<tr class="${c.blue?'b':'r'}"><td class="tn">${champAvatar(c.c,'xs')}<b>${esc(c.tag)}</b></td><td>${c.lvl}</td><td>${c.k}/${c.d}/${c.a}</td><td>${c.cs}</td>
      <td class="items">${itemsHtml(c.items, c.partial)}</td><td class="gd"><b>${c.cur}</b><small>总 ${kfmt(c.gold)}</small></td></tr>`;
    const L = V.blueSide, R = other(L);
    return `<div class="w5-tab-hd"><b>装备与经济面板</b><small>PC 按住 Tab 键查看（松开关闭） · 点击按钮或触控可常驻开关</small></div>
      <table class="w5-tbl"><tr><th>选手</th><th>等级</th><th>K/D/A</th><th>补刀</th><th>装备</th><th>金币</th></tr>
      ${V.champs.filter(c=>c.side===L).map(row).join('')}<tr class="sep"><td colspan="6"></td></tr>${V.champs.filter(c=>c.side===R).map(row).join('')}</table>`;
  }
  function feedHtml(V){
    const list = V.feed.slice(-40).reverse();
    return list.map((f,i)=>`<div class="w5-fl ${f.hl?'hl':''} ${f.side?(f.side===V.blueSide?'b':'r'):''} ${i===0?'new':''}"><span class="t">${esc(f.t)}</span><span class="tg">${esc(f.tag)}</span><span class="tx">${esc(f.text)}</span></div>`).join('') || '<div class="w5-fl"><span class="tx">比赛即将开始，双方选手正在进入召唤师峡谷……</span></div>';
  }

  // ---------------- 外壳 HTML（由 ui.js 的 matchScreen 输出） ----------------
  function ctrlHtml(kind){
    const w = W; const sp = w ? w.speed : 1;
    const icoFn = typeof ico === 'function' ? ico : () => '';
    const tabOn = !!(w && (w.tabPin || w.tabHold));
    return `<div class="w-ctrl">
      ${SPEEDS.map(v=>`<button class="spd-btn ${sp===v&&!(w&&w.paused)?'on':''}" data-a="wSpeed" data-v="${v}">${v}x</button>`).join('')}
      <button class="spd-btn ${w&&w.paused?'on':''}" data-a="wPause">${icoFn(w&&w.paused?'play':'pause')} ${w&&w.paused?'继续':'暂停'}</button>
      <button class="spd-btn ${tabOn?'on':''}" data-a="wTab" title="鼠标点一下常驻开关；键盘按住 Tab 实时查看">${icoFn('tab')} 装备 Tab</button>
      ${w && w.replay ? `<input type="range" class="w-seek" id="w-seek" min="0" max="${Math.round(w.dur)}" value="${Math.round(w.t||0)}">
        <button class="spd-btn skip" data-a="wExit">退出回放</button>`
        : `<button class="spd-btn skip" data-a="wSkip">${icoFn('skip')} 跳过直看结算</button>`}
    </div>`;
  }
  function shell5(){
    const tabOn = !!(W && (W.tabPin || W.tabHold));
    return `<div class="watch5 pane-${W?W.pane:'feed'}" id="watch5">
      <div class="w5-score" id="w5-score"></div>
      <div class="w5-mtabs"><button data-a="wPane" data-v="feed" class="${W&&W.pane==='feed'?'on':''}">战报</button><button data-a="wPane" data-v="data" class="${W&&W.pane==='data'?'on':''}">数据</button></div>
      <div class="w5-main">
        <div class="w5-mapbox"><canvas id="w5-map"></canvas><canvas id="w5-gold" class="w5-goldcv"></canvas>
          <div class="w5-banner" id="w5-banner" style="display:none"></div></div>
        <div class="w5-side">
          <div class="w5-players" id="w5-players"></div>
          <div class="w5-feed-wrap">
            <div class="w5-feed-hd">实时事件播报</div>
            <div class="w5-feed" id="w5-feed"></div>
          </div>
        </div>
      </div>
      ${ctrlHtml('5')}
      <div class="w5-tab ${tabOn?'on':''}" id="w5-tab"></div>
    </div>`;
  }
  function shellSolo(){
    return `<div class="watch1" id="watch1">
      <div class="w1-cards" id="w1-cards"></div>
      <div class="w1-lanebox"><canvas id="w1-lane"></canvas><div class="w5-banner" id="w1-banner" style="display:none"></div></div>
      ${ctrlHtml('1')}
      <div class="w1-feed" id="w1-feed"></div>
      <div class="w5-tab ${W&&W.tab?'on':''}" id="w1-tab"></div>
    </div>`;
  }

  // ---------------- 1v1 视图 ----------------
  function viewSolo(){
    if(W.replay){
      const rec = W.rec; const idx = clamp(Math.floor(W.t), 0, rec.f.length-1);
      const fr = soloFrameAt(rec, idx), nx = soloFrameAt(rec, idx+1), k = W.t - Math.floor(W.t);
      const lerp = (a,b)=>a+(b-a)*k;
      const f = s => { const a = fr[s], b = nx[s]; return Object.assign({}, a, {s:lerp(a.s,b.s), hp:a.hp}); };
      const log = W.log.filter(x=>x.sec <= fr.t);
      return { t:fr.t, A:Object.assign(f('A'), W.meta.A, {items:W.meta.A.items.slice(0, Math.max(1, fr.A.nItems))}), B:Object.assign(f('B'), W.meta.B, {items:W.meta.B.items.slice(0, Math.max(1, fr.B.nItems))}), wave:fr.wave, twA:fr.twA, twB:fr.twB, fx:fr.fx, log, over: idx >= rec.f.length-1, winner: idx >= rec.f.length-1 ? W.winner : null };
    }
    const g = W.g, k = W.acc;
    const f = F => ({ s:F.s, hp:F.hp, mp:F.mp, lvl:F.lvl, cs:F.cs, gold:Math.max(0,Math.round(F.gold)), flash:F.flash, s2cd:F.s2cd, st:F.recall>0?1:F.away>0?2:0, tag:F.tag, champ:F.champ, cn:F.cn, sum2:F.sum2, items:F.items, role:F.role, dead:F.dead });
    return { t:g.t, A:f(g.F.A), B:f(g.F.B), wave:g.wave, twA:g.tw.A, twB:g.tw.B, fx: g.fxT>0 ? g.fx : null, log:g.log, over:g.over, winner:g.winner };
  }
  const spellImgs = {};
  function spellImg(k){ if(!spellImgs[k]){ const im = new Image(); spellImgs[k] = {im, ok:false}; im.onload=()=>spellImgs[k].ok=true; im.src = spellUrl(k); } return spellImgs[k]; }
  function drawSolo(cv, V){
    const ctx = cv.getContext('2d'); const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 600, h = cv.clientHeight || 220;
    if(cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    // 背景：中路 + 河道
    const bg = ctx.createLinearGradient(0,0,w,0); bg.addColorStop(0,'#0f2a33'); bg.addColorStop(0.5,'#142a2a'); bg.addColorStop(1,'#2b1d24');
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
    const ly = h*0.58, lh = h*0.36;
    ctx.fillStyle = '#4a4636'; ctx.fillRect(0, ly-lh/2, w, lh);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, ly-lh/2, w, 4); ctx.fillRect(0, ly+lh/2-4, w, 4);
    ctx.fillStyle = 'rgba(40,110,150,0.5)'; ctx.fillRect(w*0.47, 0, w*0.06, h);
    if(V.t >= 600){ const r = clamp((V.t-600)/120,0,1); ctx.fillStyle = `rgba(255,90,40,${0.12+0.2*r})`; ctx.fillRect(0,0,w*0.5*r*0.8,h); ctx.fillRect(w-w*0.5*r*0.8,0,w*0.5*r*0.8,h); }
    const X = s => s*w;
    // 防御塔
    const tower = (s, hp, col) => { const x = X(s); ctx.fillStyle = '#091428'; ctx.fillRect(x-14, ly-44, 28, 50); ctx.fillStyle = col; ctx.fillRect(x-10, ly-40, 20, 42);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x-22, ly-56, 44, 7); ctx.fillStyle = hp>0.5?'#3ddc84':hp>0.25?'#f5c542':'#ff4d5e'; ctx.fillRect(x-21, ly-55, 42*clamp(hp,0,1), 5); };
    tower(SOLO_TW.A, V.twA, BLUE); tower(SOLO_TW.B, V.twB, RED);
    // 兵线
    const wx = X(V.wave);
    ctx.fillStyle = '#4aa3ff'; for(let i=0;i<5;i++) ctx.fillRect(wx-30+i*5, ly-6+(i%2)*10, 7, 7);
    ctx.fillStyle = '#ff5a6e'; for(let i=0;i<5;i++) ctx.fillRect(wx+6+i*5, ly-6+((i+1)%2)*10, 7, 7);
    if(V.fx){ const x = X(V.fx.s); ctx.strokeStyle = V.fx.k==='allin' ? 'rgba(255,80,60,0.9)' : 'rgba(255,220,120,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, ly-4, V.fx.k==='allin'?44:28, 0, Math.PI*2); ctx.stroke(); }
    // 英雄
    const R = Math.min(30, h*0.15);
    for(const side of ['A','B']){
      const F = V[side]; if(F.st>0 && !V.over) continue;
      if(F.dead || (V.over && V.winner && V.winner!==side && F.hp<=0.01)) { ctx.globalAlpha = 0.35; }
      const x = X(F.s), y = ly - 6 + (side==='A'?-8:8);
      const col = side==='A' ? BLUE : RED;
      ctx.beginPath(); ctx.arc(x, y, R+4, 0, Math.PI*2); ctx.fillStyle = col; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2); ctx.clip();
      const im = champImg(F.champ);
      if(im && im.ok) ctx.drawImage(im.im, x-R, y-R, R*2, R*2); else { ctx.fillStyle = '#223'; ctx.fillRect(x-R,y-R,R*2,R*2); ctx.fillStyle='#f0e6d2'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText((F.cn||'').slice(0,2), x, y); }
      ctx.restore();
      const bw = 70, by = y - R - 22;
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x-bw/2-1, by-1, bw+2, 13);
      ctx.fillStyle = F.hp>0.5?'#3ddc84':F.hp>0.25?'#f5c542':'#ff4d5e'; ctx.fillRect(x-bw/2, by, bw*clamp(F.hp,0,1), 7);
      ctx.fillStyle = '#4aa3ff'; ctx.fillRect(x-bw/2, by+8, bw*clamp(F.mp,0,1), 3);
      ctx.fillStyle = GOLD; ctx.fillRect(x-bw/2-18, by-2, 16, 15); ctx.fillStyle = '#091428'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(F.lvl, x-bw/2-10, by+6);
      ctx.font = 'bold 13px "Noto Sans SC",sans-serif'; ctx.textBaseline='bottom'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.strokeText(F.tag, x, by-3); ctx.fillStyle = side==='A'?'#bff6f0':'#ffd0d6'; ctx.fillText(F.tag, x, by-3);
      ctx.globalAlpha = 1;
    }
    ctx.font = 'bold 12px "Barlow Condensed",sans-serif'; ctx.fillStyle = '#a09b8c'; ctx.textAlign = 'center'; ctx.textBaseline='top';
    ctx.fillText(V.t >= 600 ? '火圈收缩中' : '峡谷中路', w/2, 8);
  }
  function soloCardsHtml(V){
    const card = side => {
      const F = V[side], isL = side==='A';
      const tKey = side==='A' ? W.teamA : W.teamB;
      const cd = (k, t) => `<span class="sp ${t>0?'cd':''}" title="${k==='flash'?'闪现':k==='ig'?'点燃':'屏障'}"><img src="${spellUrl(k)}" alt="" onerror="this.remove()"><em>${k==='flash'?'闪':k==='ig'?'燃':'盾'}</em>${t>0?`<b>${Math.ceil(t)}</b>`:''}</span>`;
      const win = V.over && V.winner===side;
      return `<div class="w1-card ${isL?'left':'right'} ${win?'winner':''} ${V.over&&V.winner&&!win?'loser':''}">
        <div class="w1-top">${champAvatar(F.champ,'md')}<div><div>${teamTag(tKey)} ${side===W.me?'<em class="me-pill">我方</em>':''}</div><div class="w1-nm"><b>${esc(F.tag)}</b> · ${esc(champName(F.champ))} <small>Lv ${F.lvl}</small></div></div>
          <div class="w1-sp">${cd('flash',F.flash)}${cd(F.sum2||'ig',F.s2cd)}</div></div>
        <div class="w1-bars"><div class="sf-bar"><i class="hp ${F.hp>0.55?'hi':F.hp>0.28?'mid':'lo'}" style="width:${Math.round(clamp(F.hp,0,1)*100)}%"></i></div><div class="sf-bar mp"><i style="width:${Math.round(clamp(F.mp,0,1)*100)}%"></i></div></div>
        <div class="w1-stats"><span>🌾 <b>${F.cs}</b>/100</span><span>🏰 <b>${Math.round((side==='A'?V.twA:V.twB)*100)}%</b></span><span>💰 <b>${F.gold}</b></span>${F.st===1?'<span class="st">回城中</span>':F.st===2?'<span class="st">赶回线上</span>':''}</div>
      </div>`;
    };
    return `${card('A')}<div class="w1-clock"><div class="solo-time">${fmtSec(V.t)}</div><div class="solo-vs">1 v 1</div><div class="solo-event-pill">${esc((V.log[V.log.length-1]||{}).tag||'')}</div></div>${card('B')}`;
  }
  function soloTabHtml(V){
    const row = side => { const F = V[side]; return `<tr class="${side==='A'?'b':'r'}"><td class="tn">${champAvatar(F.champ,'xs')}<b>${esc(F.tag)}</b></td><td>${F.lvl}</td><td>${F.cs}</td><td class="items">${itemsHtml(F.items||[], null)}</td><td class="gd"><b>${F.gold}</b></td></tr>`; };
    return `<div class="w5-tab-hd"><b>装备与经济面板</b><small>PC 按住 Tab 键查看（松开关闭） · 点击按钮或触控可常驻开关</small></div><table class="w5-tbl"><tr><th>选手</th><th>等级</th><th>补刀</th><th>装备</th><th>金币</th></tr>${row('A')}${row('B')}</table>`;
  }

  // ---------------- 主循环 ----------------
  function stepOnce(){
    if(W.kind==='g5'){
      if(W.replay){ return; }
      step5(W.g);
    } else {
      if(W.replay) return;
      soloStep(W.g);
    }
  }
  function frame(ts){
    raf = 0;
    if(!W) return;
    const dt = lastTs ? Math.min(0.1, (ts - lastTs)/1000) : 0; lastTs = ts;
    if(!W.paused && !W.done){
      const rate = (W.kind==='g5' ? SIM_RATE5 : SIM_RATE1) * W.speed;
      if(W.replay){
        W.t = Math.min(W.dur, (W.t||0) + dt*rate);
        if(W.t >= W.dur) finish();
      } else {
        const unit = W.kind==='g5' ? SIM5.DT : 1;
        W.acc += dt*rate/unit;
        let guard = 0;
        while(W.acc >= 1 && guard++ < 40){ W.acc -= 1; stepOnce(); if(W.g.over){ W.acc = 1; break; } }
        if(W.g.over) finish();
      }
    }
    paint(false);
    raf = requestAnimationFrame(frame);
  }
  let _domT = 0;
  function paint(forceDom){
    if(!W) return;
    if(W.kind==='g5'){
      const V = W.replay ? view5Rec(W.rec, W.t) : view5Live(W.g, Math.min(1, W.acc));
      const cv = document.getElementById('w5-map'); if(cv) drawMap(cv, V);
      const now = performance.now();
      if(forceDom || now - _domT > 220){
        _domT = now;
        const gcv = document.getElementById('w5-gold'); if(gcv) drawGold(gcv, V);
        setHtml('w5-score', scoreHtml(V)); setHtml('w5-players', playersHtml(V)); setHtml('w5-feed', feedHtml(V));
        if(W.tab) setHtml('w5-tab', tabHtml(V));
        const sk = document.getElementById('w-seek'); if(sk && W.replay && !W.seeking) sk.value = Math.round(W.t);
      }
    } else {
      const V = viewSolo();
      const cv = document.getElementById('w1-lane'); if(cv) drawSolo(cv, V);
      const now = performance.now();
      if(forceDom || now - _domT > 200){
        _domT = now;
        setHtml('w1-cards', soloCardsHtml(V));
        setHtml('w1-feed', V.log.slice().reverse().slice(0,40).map((f,i)=>`<div class="solo-line ${i===0?'latest':''} ${f.side==='A'?'sa':f.side==='B'?'sb':''} ${f.hl?'hl':''}"><span class="sl-t">${esc(f.t)}</span><span class="sl-tag">${esc(f.tag)}</span><span class="sl-txt">${esc(f.text)}</span></div>`).join(''));
        if(W.tab) setHtml('w1-tab', soloTabHtml(V));
        const sk = document.getElementById('w-seek'); if(sk && W.replay && !W.seeking) sk.value = Math.round(W.t);
      }
    }
  }
  const _htmlCache = {};
  function setHtml(id, html){ const el = document.getElementById(id); if(!el) return; if(el._h === html) return; el._h = html; el.innerHTML = html; }
  function finish(){
    if(W.done) return;
    W.done = true;
    const ban = document.getElementById(W.kind==='g5'?'w5-banner':'w1-banner');
    if(W.replay){ if(ban){ ban.style.display='flex'; ban.innerHTML = '<b>回放结束</b>'; } return; }
    paint(true);
    if(ban){
      const wn = W.kind==='g5' ? W.g.team[W.g.winner].name : W.g.F[W.g.winner].tag;
      ban.style.display = 'flex';
      ban.innerHTML = `<b>${W.kind==='g5'?'VICTORY':'1v1 结束'}</b><span>${esc(wn)} ${W.kind==='g5'?'赢下本局':'赢得选边权'}</span>`;
    }
    const cb = W.onEnd;
    setTimeout(()=>{ if(W && W.done && !W.replay){ const w = W; stop(); cb && cb(w); } }, W.skipped ? 200 : 2200);
  }
  function start(opts){
    stop();
    W = Object.assign({ speed:1, paused:false, acc:0, t:0, tab:false, tabPin:false, tabHold:false, pane:'feed', done:false }, opts);
    lastTs = 0;
    if(!raf) raf = requestAnimationFrame(frame);
  }
  function syncTabState(){
    if(!W) return;
    W.tab = !!(W.tabPin || W.tabHold);
    const id = W.kind==='g5' ? 'w5-tab' : 'w1-tab';
    const el = document.getElementById(id);
    if(el){
      el.classList.toggle('on', W.tab);
      if(W.tab) paint(true);
    }
    const btn = document.querySelector('[data-a="wTab"]');
    if(btn) btn.classList.toggle('on', W.tab);
  }
  function stop(){ if(raf) cancelAnimationFrame(raf); raf = 0; W = null; }
  function active(){ return W; }
  function afterRender(){
    if(!W) return;
    _domT = 0;
    ['w5-score','w5-players','w5-feed','w5-tab','w1-cards','w1-feed','w1-tab'].forEach(id=>{ const el=document.getElementById(id); if(el) el._h=null; });
    paint(true);
    if(!raf) raf = requestAnimationFrame(frame);
  }
  // 跳过：把剩余模拟纯计算跑完
  function skip(){
    if(!W || W.replay) return;
    if(W.kind==='g5'){ while(!W.g.over) step5(W.g); } else { while(!W.g.over) soloStep(W.g); }
    W.skipped = true; finish();
  }
  function control(act, v){
    if(!W) return false;
    if(act==='speed'){ W.speed = +v || 1; W.paused = false; }
    else if(act==='pause'){ W.paused = !W.paused; }
    else if(act==='tab'){ W.tabPin = !W.tabPin; W.tabHold = false; syncTabState(); }
    else if(act==='pane'){ W.pane = v; }
    else if(act==='skip'){ skip(); return true; }
    else if(act==='seek'){ W.t = clamp(+v||0, 0, W.dur); W.done = false; const ban = document.getElementById(W.kind==='g5'?'w5-banner':'w1-banner'); if(ban) ban.style.display='none'; }
    return true;
  }
  // PC 键盘：按住 Tab 键持续显示，松开即隐藏；鼠标/触控点击「装备 Tab」按钮则常驻切换
  document.addEventListener('keydown', e=>{
    if(!W) return;
    if(e.key==='Tab'){
      e.preventDefault();
      if(!W.tabHold){ W.tabHold = true; syncTabState(); }
    }
    else if(e.key===' ' && e.target===document.body){ e.preventDefault(); W.paused = !W.paused; if(typeof render==='function') render(); }
  });
  document.addEventListener('keyup', e=>{
    if(!W) return;
    if(e.key==='Tab' && W.tabHold){
      e.preventDefault();
      W.tabHold = false;
      syncTabState();
    }
  });
  window.addEventListener('blur', ()=>{
    if(W && W.tabHold){ W.tabHold = false; syncTabState(); }
  });
  document.addEventListener('input', e=>{ if(e.target && e.target.id==='w-seek' && W && W.replay){ W.seeking = true; control('seek', e.target.value); paint(true); } });
  document.addEventListener('change', e=>{ if(e.target && e.target.id==='w-seek' && W){ W.seeking = false; } });
  return { start, stop, active, afterRender, control, shell5, shellSolo, ctrlHtml };
})();
