// Drive a real packaged launcher through its renderer button and production IPC.
// Only fixture bundles are re-signed/instrumented; no installed app or user data is changed.
const fs=require('node:fs/promises');
const path=require('node:path');const os=require('node:os');const crypto=require('node:crypto');
const {createReadStream}=require('node:fs');const {spawn,execFile}=require('node:child_process');
const run=require('node:util').promisify(execFile);const assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const asar=require(require.resolve('@electron/asar',{paths:[require.resolve('electron-builder')]}));
if(process.platform!=='darwin'){console.log('SKIP packaged Mac update on other platforms');process.exit(0);}
(async()=>{
 const source=path.resolve(process.argv[2]||'dist/mac-universal/iDom Launcher.app');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"idom packaged user's update-"));
 const target=path.join(root,'installed','iDom Launcher.app'),newApp=path.join(root,'image','iDom Launcher.app');
 const data=path.join(root,'data'),report=path.join(root,'report.jsonl'),image=path.join(root,'update.dmg'),releaseFile=path.join(root,'release.json');
 const current=require('../package.json').version;const parts=current.split('.').map(Number);parts[2]++;const next=parts.join('.');
 let parent,pids=[];
 try{
  await fs.mkdir(data,{recursive:true});
  const bootstrap=`const {app,BrowserWindow}=require('electron');const fs=require('node:fs');const path=require('node:path');const {Readable}=require('node:stream');
const data=${JSON.stringify(data)},report=${JSON.stringify(report)},releaseFile=${JSON.stringify(releaseFile)},image=${JSON.stringify(image)};
function log(event,extra={}){fs.appendFileSync(report,JSON.stringify({event,pid:process.pid,version:require('./package.json').version,...extra})+'\\n');}
const setPath=app.setPath.bind(app);app.setPath=(key,value)=>setPath(key,key==='userData'?data:value);app.setPath('userData',data);
global.fetch=async url=>{const release=JSON.parse(fs.readFileSync(releaseFile,'utf8'));if(String(url).endsWith('/iDom-Hub/releases/latest'))return new Response(JSON.stringify(release));if(String(url)===release.assets[0].browser_download_url)return new Response(Readable.toWeb(fs.createReadStream(image)));return new Response('{}',{status:404});};
log('boot');
app.on('browser-window-created',(_event,win)=>{win.webContents.on('did-finish-load',()=>{log('renderer-ready');if(require('./package.json').version===${JSON.stringify(current)}){const timer=setInterval(async()=>{if(win.isDestroyed())return clearInterval(timer);try{const clicked=await win.webContents.executeJavaScript('(function(){const b=document.querySelector("#launcher-update-button");if(!b||b.disabled||document.querySelector("#launcher-update-banner").hidden)return false;b.click();return true;})()');if(clicked){clearInterval(timer);log('button-clicked');}}catch(e){log('error',{message:e.message});}},100);}});});
require('./src/main.cjs');`;
  for(const [bundle,version] of [[target,current],[newApp,next]]){
   await fs.mkdir(path.dirname(bundle),{recursive:true});await run('/usr/bin/ditto',[source,bundle]);
   const archive=path.join(bundle,'Contents/Resources/app.asar');const unpack=path.join(root,'unpack-'+version);asar.extractAll(archive,unpack);
   const pkg=JSON.parse(await fs.readFile(path.join(unpack,'package.json'),'utf8'));pkg.version=version;pkg.main='test-bootstrap.cjs';
   await fs.writeFile(path.join(unpack,'package.json'),JSON.stringify(pkg));await fs.writeFile(path.join(unpack,'test-bootstrap.cjs'),bootstrap);
   await fs.rm(archive);await asar.createPackage(unpack,archive);await fs.rm(unpack,{recursive:true,force:true});
   const plist=path.join(bundle,'Contents/Info.plist');await run('/usr/bin/plutil',['-replace','CFBundleShortVersionString','-string',version,plist]);
   await run('/usr/bin/plutil',['-remove','ElectronAsarIntegrity',plist]).catch(()=>{});
   await run('/usr/bin/codesign',['--force','--deep','--sign','-',bundle]);await run('/usr/bin/codesign',['--verify','--deep','--strict',bundle]);
  }
  await run('/usr/bin/hdiutil',['create','-quiet','-volname','iDom Update Test','-srcfolder',path.dirname(newApp),'-format','UDZO',image],{timeout:180000});
  const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(image))hash.update(chunk);
  await fs.writeFile(releaseFile,JSON.stringify({tag_name:'v'+next,assets:[{name:'iDom-Launcher-macOS.dmg',size:(await fs.stat(image)).size,digest:'sha256:'+hash.digest('hex'),browser_download_url:`https://github.com/Domenico-lel/iDom-Hub/releases/download/v${next}/iDom-Launcher-macOS.dmg`}]}));
  parent=spawn(path.join(target,'Contents/MacOS/iDom Launcher'),[],{stdio:'ignore'});pids.push(parent.pid);
  const deadline=Date.now()+180000;let outcome;
  while(Date.now()<deadline){
   try{outcome=JSON.parse(await fs.readFile(path.join(data,'self-updates/last-result.json'),'utf8'));break;}catch{}
   await delay(250);
  }
  const events=(await fs.readFile(report,'utf8')).trim().split('\n').map(l=>JSON.parse(l));pids.push(...events.map(e=>e.pid));
  console.log(JSON.stringify(events));
  if(!outcome||!outcome.success){for(const job of await fs.readdir(path.join(data,'self-updates')).catch(()=>[])){if(job.startsWith('job-'))console.error(await fs.readFile(path.join(data,'self-updates',job,'helper.log'),'utf8').catch(()=>''));}}
  assert.ok(events.some(e=>e.event==='button-clicked'&&e.version===current),'Production update button was clicked');
  assert.ok(outcome?.success,'Packaged update must install successfully');assert.equal(outcome.version,next);
  assert.ok(events.some(e=>e.event==='renderer-ready'&&e.version===next),'New packaged renderer must load');
  assert.notEqual(parent.exitCode,null,'Old packaged app must exit');
  asar.uncache(path.join(target,'Contents/Resources/app.asar'));
  const installed=JSON.parse(asar.extractFile(path.join(target,'Contents/Resources/app.asar'),'package.json').toString());assert.equal(installed.version,next);
  const job=path.join(data,'self-updates','job-'+outcome.token);const ack=JSON.parse(await fs.readFile(path.join(job,'ack.json'),'utf8'));assert.equal(ack.version,next);
  for(let i=0;i<100;i++){if(!(await fs.readdir(path.dirname(target))).some(n=>n.includes('-backup-')||n.includes('-update-')))break;await delay(100);}
  const remaining=await fs.readdir(path.dirname(target));assert.ok(!remaining.some(n=>n.includes('-backup-')||n.includes('-update-')),'Staged bundle and backup are cleaned');
  console.log(`PASS packaged macOS ${current} -> ${next}: real renderer button, production IPC, verified DMG, physical helper, parent exit, replacement, relaunch and startup acknowledgement.`);
 }finally{
  try{const events=(await fs.readFile(report,'utf8')).trim().split('\n').map(l=>JSON.parse(l));pids.push(...events.map(e=>e.pid));}catch{}
  for(const pid of new Set(pids)){try{const {stdout}=await run('/bin/ps',['-p',String(pid),'-o','comm=']);if(stdout.includes(target+'/Contents/MacOS/'))process.kill(pid,'SIGTERM');}catch{}}
  await delay(1000);await fs.rm(root,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
