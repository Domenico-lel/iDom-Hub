// Real PowerShell must outlive Electron; a successful spawn alone is insufficient.
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {powershellCommand,powershellBootstrap}=require('../src/self-updater.cjs');
async function waitFor(file){
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){try{return await fs.readFile(file,'utf8');}catch{}await new Promise(r=>setTimeout(r,100));}
  throw Error('Missing helper signal: '+file);
}
if(process.platform!=='win32')process.exit(0);
if(process.versions.electron){
  const {app}=require('electron');
  app.whenReady().then(async()=>{
    const root=process.argv[2],command=path.join(root,'command.txt');
    const script="param([string]$Job)\n[IO.File]::WriteAllText((Join-Path $Job 'ready'),'ready'); [Threading.Thread]::Sleep(1500); [IO.File]::WriteAllText((Join-Path $Job 'survived'),'survived')";
    await fs.writeFile(command,powershellCommand(script,root));
    const child=spawn(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',powershellBootstrap(command)],{detached:false,stdio:'ignore',windowsHide:true});
    await waitFor(path.join(root,'ready'));child.unref();app.exit(0);
  }).catch(e=>{console.error(e);app.exit(1);});
}else{
  (async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),"idom-helper's [lifecycle]-"));
    try{
      const child=spawn(require('electron'),[__filename,root],{stdio:'inherit',windowsHide:true});
      const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
      assert.equal(code,0);
      assert.equal(await waitFor(path.join(root,'survived')),'survived');
      console.log('PASS hidden PowerShell survives Electron exit, including apostrophes and brackets in paths.');
    }finally{await fs.rm(root,{recursive:true,force:true});}
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
