// 测试用：在 Node 中加载游戏内核（data / traits / champs / engine / sim），与浏览器同一全局作用域
const fs=require('fs'),path=require('path');
function load(){
  const R=path.join(__dirname,'..','src')+'/';
  globalThis.window=globalThis;
  const files=['data.js','traits.js','champs.js','engine.js','sim.js'].filter(f=>fs.existsSync(R+f));
  const src=files.map(f=>fs.readFileSync(R+f,'utf8')).join('\n;\n');
  (0,eval)(src+'\n;globalThis.__run=function(code){ return eval(code); };');
  return globalThis.__run;
}
module.exports={load};
