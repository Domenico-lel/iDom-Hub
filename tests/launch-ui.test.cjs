const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../ui/app.js'),'utf8');
function ui(hub){
  const nodes=new Map();
  const context=vm.createContext({localStorage:{getItem:()=>null},window:{hub},document:{querySelector:selector=>{
    if(!nodes.has(selector))nodes.set(selector,{hidden:true,textContent:'',disabled:false,focus(){this.focused=true;},scrollIntoView(){}});
    return nodes.get(selector);
  }}});
  vm.runInContext(source.slice(0,source.indexOf("$('#launcher-update-button').addEventListener")),context);
  vm.runInContext("render=()=>{}; state={platform:'darwin',apps:[],launcher:{}};",context);
  context.app={id:'ivolume',name:'iVolume',installed:{version:'0.10.0'}};
  return {context,nodes,run:code=>vm.runInContext(code,context)};
}
test('install or reinstall automatically opens the app-specific guide',async()=>{
  const {run,nodes}=ui({install:async()=>({platform:'darwin',apps:[{id:'ivolume',name:'iVolume',installed:{version:'0.10.0'}}]})});
  await run('installApps([app])');
  assert.equal(nodes.get('#launch-guide').hidden,false);
  assert.match(nodes.get('#launch-guide-title').textContent,/iVolume è installata/);
  assert.equal(nodes.get('#launch-guide-permissions').hidden,false);
});
test('authorization failure replaces raw error with guide and restores retry buttons',async()=>{
  const {run,nodes}=ui({open:async()=>({status:'authorization',message:'macOS richiede l’autorizzazione.'})});
  await run('openApp(app)');
  assert.equal(nodes.get('#launch-guide').hidden,false);
  assert.equal(nodes.get('#notice').hidden,true);
  assert.equal(nodes.get('#launch-guide-retry').disabled,false);
  assert.match(nodes.get('#launch-guide-title').textContent,/Autorizza iVolume/);
});
test('unknown IPC failure is readable and contains no internal command',async()=>{
  const {run,nodes}=ui({open:async()=>{throw Error("Error invoking remote method 'open': /usr/bin/open ... -128");}});
  await run('openApp(app)');
  assert.match(nodes.get('#notice').textContent,/Non è stato possibile aprire iVolume/);
  assert.doesNotMatch(nodes.get('#notice').textContent,/invoking|\/usr\/bin|-128/);
});
test('damaged app hides authorization instructions',async()=>{
  const {run,nodes}=ui({open:async()=>({status:'damaged',message:'Il pacchetto risulta danneggiato.'})});
  run('showLaunchGuide(app)');await run('openApp(app)');
  assert.equal(nodes.get('#launch-guide').hidden,true);
  assert.match(nodes.get('#notice').textContent,/danneggiato/);
});
