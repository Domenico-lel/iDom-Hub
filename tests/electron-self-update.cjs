// Run inside Electron: plain Node does not reproduce ASAR filesystem behavior.
const {app}=require('electron');
const fs=require('original-fs').promises;
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {SelfUpdater}=require('../src/self-updater.cjs');

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
    console.log('PASS Electron: installed Windows launcher accepted, ASAR backup byte-identical, invalid installation rejected and cleaned.');
  }catch(error){console.error(error);process.exitCode=1;}
  finally{
    try{if(root)await fs.rm(root,{recursive:true,force:true});}
    catch(error){console.error('Fixture cleanup failed:',error.message);process.exitCode=1;}
    finally{app.exit(process.exitCode||0);}
  }
});
