const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const catalog=require('../src/catalog.cjs');
const {Manager}=require('../src/manager.cjs');

test('web apps stay available without release requests, installation or update',async t=>{
  const requested=[];
  t.mock.method(globalThis,'fetch',async url=>{requested.push(url);return {ok:false,status:404};});
  const manager=new Manager('unused',()=>{},'win32');
  manager.records=async()=>({});
  const visited=[];
  manager.installed=async entry=>{visited.push(entry.id);return null;};
  const state=await manager.refresh();
  const web=state.apps.find(a=>a.id==='prompt-builder');
  assert.equal(web.url,'https://prompt-builder-cyan.vercel.app');
  assert.equal(web.type,'web');
  assert.equal(web.available,true);
  assert.equal(web.osCompatible,true);
  assert.equal(web.update,false);
  assert.equal(web.installed,null);
  assert.equal(web.error,null);
  assert.equal(requested.some(url=>url.includes('prompt-builder')),false);
  assert.equal(visited.includes('prompt-builder'),false);
  for(const platform of ['darwin','win32']){
    manager.platform=platform;
    await assert.rejects(manager.install(web.id),/non richiede installazione/);
    assert.equal(manager.busy,false);
  }
});

test('web app action opens directly and labels do not suggest installation',async()=>{
  const opened=[];
  const context=vm.createContext({localStorage:{getItem:()=>null},window:{hub:{open:async id=>opened.push(id)}},document:{createElement:()=>({addEventListener(_event,fn){this.click=fn;}})}});
  const source=fs.readFileSync(require.resolve('../ui/app.js'),'utf8');
  vm.runInContext(source.slice(0,source.indexOf("$('#launcher-update-button').addEventListener")),context);
  context.web={...catalog.find(a=>a.type==='web'),available:true,osCompatible:true,installed:null,update:false};
  for(const platform of ['win32','darwin']){
    vm.runInContext(`state={platform:'${platform}'};`,context);
    assert.equal(vm.runInContext('actionLabel(web)',context),'Apri sito');
    assert.equal(vm.runInContext('appStatus(web).text',context),'App web · pronta all’uso');
    assert.equal(vm.runInContext('inFilter(web,"available")',context),false);
    assert.equal(vm.runInContext('inFilter(web,"updates")',context),false);
    assert.equal(vm.runInContext('inFilter(web,"all")',context),true);
    assert.equal(vm.runInContext('compatibilityLabel(web)',context),'Browser web · macOS e Windows');
    assert.equal(vm.runInContext('primary(web).disabled',context),false);
    await vm.runInContext('primary(web).click()',context);
  }
  assert.deepEqual(opened,['prompt-builder','prompt-builder']);
});
