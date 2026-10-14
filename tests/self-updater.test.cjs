const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {SelfUpdater,releaseInfo,validateAsset,downloadVerified,powershellCommand}=require('../src/self-updater.cjs');
const data=Buffer.from('verified installer');
const asset={name:'iDom-Launcher-macOS.dmg',size:data.length,digest:'sha256:'+crypto.createHash('sha256').update(data).digest('hex'),browser_download_url:'https://github.com/Domenico-lel/iDom-Hub/releases/download/v0.4.0/iDom-Launcher-macOS.dmg'};
const release={tag_name:'v0.4.0',assets:[asset]};
test('Only newer stable releases for the correct platform are offered',()=>{
 assert.equal(releaseInfo(release,'0.3.0','darwin').available,true);
 for(const r of [{...release,prerelease:true},{...release,draft:true},{...release,tag_name:'v0.3.0'},{...release,tag_name:'v0.2.0'},{...release,tag_name:'latest'}])assert.equal(releaseInfo(r,'0.3.0','darwin').available,false);
 assert.equal(releaseInfo(release,'0.3.0','win32').available,false);
});
test('Installer must have its own repository URL, bounded size and SHA256',()=>{
 validateAsset(asset);
 for(const a of [{...asset,digest:null},{...asset,size:0},{...asset,size:2**31},{...asset,browser_download_url:'https://github.com/other/repo/releases/download/v1/a'},{...asset,browser_download_url:'https://github.com.evil.example/Domenico-lel/iDom-Hub/releases/download/a'}])assert.throws(()=>validateAsset(a));
});
test('Verified downloads reject corrupt, short and oversized bytes and remove partial files',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'idom-download-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'installer');
 await downloadVerified(asset,file,{fetchImpl:async()=>new Response(data)});assert.deepEqual(await fs.readFile(file),data);await fs.rm(file);
 for(const bytes of [Buffer.alloc(data.length),data.subarray(1),Buffer.concat([data,Buffer.from('x')])]){
  await assert.rejects(downloadVerified(asset,file,{fetchImpl:async()=>new Response(bytes)}));await assert.rejects(fs.access(file));
 }
});
test('Cancellation interrupts download and removes partial installer',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'idom-cancel-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'installer');const c=new AbortController();c.abort();
 await assert.rejects(downloadVerified(asset,file,{signal:c.signal,fetchImpl:async()=>new Response(data)}));await assert.rejects(fs.access(file));
});
test('Startup acknowledgement requires matching private job, version and actual application',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'idom-ack-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const u=new SelfUpdater({dataDir:dir,version:'0.4.0',platform:'darwin',execPath:'/tmp/iDom Launcher.app/Contents/MacOS/iDom Launcher'});
 const token=crypto.randomUUID(),job=path.join(u.root,'job-'+token);await fs.mkdir(job,{recursive:true});const m={token,version:'0.4.0',target:'/tmp/iDom Launcher.app'};
 const args=['--idom-update-job='+job];
 for(const invalid of [{...m,version:'0.3.0'},{...m,target:'/tmp/Other.app'},{...m,token:'other'}]){await fs.writeFile(path.join(job,'manifest.json'),JSON.stringify(invalid));assert.equal(await u.confirmLaunch(args),false);}
 await fs.writeFile(path.join(job,'manifest.json'),JSON.stringify(m));assert.equal(await u.confirmLaunch(args),true);assert.deepEqual(JSON.parse(await fs.readFile(path.join(job,'ack.json'),'utf8')),{version:m.version,token});
 assert.equal(await u.confirmLaunch(['--idom-update-job=/tmp/job-'+token]),false);
});
test('Concurrent checks share a request and preserve cached release on 304',async()=>{
 let calls=0;const u=new SelfUpdater({dataDir:os.tmpdir(),version:'0.3.0',platform:'darwin',packaged:true,fetchImpl:async()=>{calls++;await new Promise(r=>setTimeout(r,10));return calls===1?new Response(JSON.stringify(release),{headers:{etag:'one'}}):new Response(null,{status:304});}});
 const results=await Promise.all([u.check(),u.check()]);assert.equal(calls,1);assert.equal(results[0].available,true);assert.equal((await u.check()).available,true);assert.equal(calls,2);
});
test('Development launcher cannot modify itself and PowerShell job paths are literal',async()=>{
 const u=new SelfUpdater({dataDir:os.tmpdir(),version:'0.3.0'});await assert.rejects(u.prepare(),/versione installata/);assert.equal(u.busy,false);
 assert.equal(Buffer.from(powershellCommand('param([string]$Job)',"C:\\User's Folder"),'base64').toString('utf16le'),"& {\nparam([string]$Job)\n} 'C:\\User''s Folder'");
});
