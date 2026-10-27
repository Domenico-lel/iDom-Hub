const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../ui/app.js'),'utf8');
function ui(hub){
  const nodes=new Map();
  const context=vm.createContext({localStorage:{getItem:()=>null},window:{hub},document:{querySelector:selector=>{
    if(!nodes.has(selector))nodes.set(selector,{hidden:true,textContent:'',disabled:false,focus(){this.focused=true;},select(){this.selected=true;},scrollIntoView(){}});
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
  assert.equal(nodes.get('#launch-guide-permissions').hidden,true);
  assert.equal(nodes.get('#launch-guide-open').hidden,false);
  assert.equal(nodes.get('#launch-guide-settings').hidden,true);
  assert.equal(nodes.get('#launch-guide-retry').hidden,true);
});
test('authorization failure replaces raw error with guide and restores retry buttons',async()=>{
  const {run,nodes}=ui({open:async()=>({status:'authorization',message:'macOS richiede l’autorizzazione.'})});
  await run('openApp(app)');
  assert.equal(nodes.get('#launch-guide').hidden,false);
  assert.equal(nodes.get('#notice').hidden,true);
  assert.equal(nodes.get('#launch-guide-retry').disabled,false);
  assert.equal(nodes.get('#launch-guide-progress').textContent,'Passo 2 di 3');
  assert.equal(nodes.get('#launch-guide-settings').hidden,false);
  assert.equal(nodes.get('#launch-guide-open').hidden,true);
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

test('guide advances to retry only after opening settings, then completes on a running app',async()=>{
  let visits=0;
  const {run,nodes}=ui({privacySecurity:async()=>{visits++;},open:async()=>({status:'opened',running:true})});
  run('showLaunchGuide(app,"authorization")');
  await run('openGuideSettings()');assert.equal(visits,1);
  assert.equal(nodes.get('#launch-guide-progress').textContent,'Passo 3 di 3');
  assert.equal(nodes.get('#launch-guide-retry').hidden,false);
  assert.equal(nodes.get('#launch-guide-settings').hidden,true);
  await run('openApp(app)');
  assert.equal(nodes.get('#launch-guide-done').hidden,false);
  assert.equal(nodes.get('#launch-guide-retry').hidden,true);
  assert.equal(nodes.get('#launch-guide-permissions').hidden,false);
});
test('an unconfirmed launch does not claim the app is running',async()=>{
  const {run,nodes}=ui({open:async()=>({status:'opened',running:false})});
  run('showLaunchGuide(app)');await run('openApp(app)');
  assert.equal(nodes.get('#launch-guide-progress').textContent,'Passo 1 di 3');
  assert.match(nodes.get('#launch-guide-message').textContent,/Richiesta inviata/);
});
test('popover Escape hides actions and restores focus to its trigger',()=>{
  const {run,context}=ui({});
  context.trigger={isConnected:true,setAttribute(k,v){this[k]=v;},focus(){this.focused=true;}};
  context.panel={hidden:true,querySelector(){return {focus(){}};}};
  run('toggleActions(trigger,panel)');assert.equal(context.panel.hidden,false);
  run('handleShortcuts({key:"Escape",preventDefault(){}})');
  assert.equal(context.panel.hidden,true);assert.equal(context.trigger.focused,true);
  assert.equal(context.trigger['aria-expanded'],'false');
});
test('Cmd/Ctrl+F focuses and selects search without disturbing dialogs',()=>{
  const {run,nodes}=ui({});
  run('handleShortcuts({key:"f",metaKey:true,preventDefault(){}})');
  assert.equal(nodes.get('#search').focused,true);assert.equal(nodes.get('#search').selected,true);
  nodes.get('#search').focused=false;nodes.get('#details').open=true;
  run('handleShortcuts({key:"f",ctrlKey:true,preventDefault(){}})');assert.equal(nodes.get('#search').focused,false);
});
