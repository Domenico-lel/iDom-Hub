// Run inside Electron: plain Node does not reproduce ASAR filesystem behavior.
const {app}=require('electron');
const fs=require('original-fs').promises;
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const archiveArgument=process.argv.find(arg=>arg.startsWith('--archive='));
const moduleRoot=archiveArgument?path.resolve(archiveArgument.slice('--archive='.length)):path.join(__dirname,'..');
const {SelfUpdater,atomicJson}=require(path.join(moduleRoot,'src/self-updater.cjs'));

app.whenReady().then(async()=>{
  let root;
  try{
    root=await fs.mkdtemp(path.join(os.tmpdir(),'idom-electron-update-'));
    const installed=path.join(root,"User's [apps]",'iDom Launcher');
    await fs.mkdir(path.join(installed,'resources'),{recursive:true});
    const archive=path.join(installed,'resources','app.asar');
    await fs.copyFile(path.join(process.resourcesPath,'default_app.asar'),archive);
    await fs.writeFile(path.join(installed,'iDom Launcher.exe'),'isolated test executable');
    await fs.writeFile(path.join(installed,'Uninstall iDom Launcher.exe'),'isolated test uninstaller');
    const bytes=Buffer.from('verified fixture installer');
    const asset={name:'iDom-Launcher-Windows.exe',size:bytes.length,digest:'sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'),browser_download_url:'https://github.com/Domenico-lel/iDom-Hub/releases/download/v1.0.2/iDom-Launcher-Windows.exe'};
    const release={tag_name:'v1.0.2',assets:[asset]};
    const options={dataDir:path.join(root,'data'),version:'1.0.1',platform:'win32',packaged:true,execPath:path.join(installed,'iDom Launcher.exe'),fetchImpl:async url=>new Response(url.includes('api.github.com')?JSON.stringify(release):bytes)};
    const updater=new SelfUpdater(options);
    const plan=await updater.prepare();
    assert.equal(plan.target,options.execPath);
    assert.deepEqual(await fs.readFile(path.join(plan.backup,'resources','app.asar')),await fs.readFile(archive),'Backup must preserve the physical ASAR bytes');
    assert.equal((await fs.stat(path.join(plan.backup,'resources','app.asar'))).isFile(),true);
    assert.equal((await fs.stat(path.join(installed,'resources','app.asar'))).isFile(),true);
    await updater.discard(plan);
    await fs.unlink(path.join(installed,'Uninstall iDom Launcher.exe'));
    const invalid=new SelfUpdater(options);
    await assert.rejects(invalid.prepare(),/installer Windows/);
    assert.equal(invalid.busy,false);
    assert.deepEqual(await fs.readdir(invalid.root),[],'Failed preparation must clean the job');
    // Exercise the real helper from the shipped ASAR, without touching an installed app.
    // Deliberately invalid payload forces the safe failure path before replacement.
    const resourcesPath=archiveArgument?path.dirname(moduleRoot):path.join(moduleRoot,'src');
    const helperUpdater=new SelfUpdater({...options,platform:process.platform,resourcesPath});
    const token=crypto.randomUUID(),job=path.join(helperUpdater.root,'job-'+token);
    await fs.mkdir(job,{recursive:true});
    const payload=path.join(job,'invalid-installer');await fs.writeFile(payload,'not an installer');
    const result=path.join(helperUpdater.root,'last-result.json');
    const helperPlan={job,token,version:'1.0.3',bundleId:'it.domenicolella.hub',target:path.join(root,'nonexistent','iDom Launcher.app'),stage:path.join(root,'missing-stage.app'),backup:path.join(root,'missing-backup'),archive:payload,digest:'0'.repeat(64),parentPid:2147483647,parentStarted:'',timeout:2,result};
    await atomicJson(path.join(job,'manifest.json'),helperPlan);
    await helperUpdater.launchHelper(helperPlan);
    assert.equal(helperUpdater.restarting,true);
    const deadline=Date.now()+20000;
    let outcome;
    while(Date.now()<deadline){
      try{outcome=JSON.parse((await fs.readFile(result,'utf8')).replace(/^\uFEFF/,''));break;}catch{}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!outcome)console.error(await fs.readFile(path.join(job,'helper.log'),'utf8'));
    assert.ok(outcome,'The real helper must execute and report a result');
    assert.equal(outcome.token,token);
    assert.equal(outcome.success,false,'Invalid payload must never be installed');
    assert.equal((await fs.stat(path.join(job,'helper.log'))).isFile(),true);
    console.log(`PASS helper executed from ${archiveArgument?'packaged ASAR':'source'} and refused invalid update safely.`);
    console.log('PASS Electron: installed Windows launcher accepted, ASAR backup byte-identical, invalid installation rejected and cleaned.');
  }catch(error){console.error(error);process.exitCode=1;}
  finally{
    try{if(root)await fs.rm(root,{recursive:true,force:true});}
    catch(error){console.error('Fixture cleanup failed:',error.message);process.exitCode=1;}
    finally{app.exit(process.exitCode||0);}
  }
});
