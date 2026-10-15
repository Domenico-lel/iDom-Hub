// Electron treats app.asar as a virtual directory. Installation checks and
// backups must operate on the physical archive, including its exact bytes.
const nativeFs=process.versions.electron?require('original-fs'):require('node:fs');
const fs=nativeFs.promises;
// Scripts live INSIDE app.asar: read them through Electron's virtual filesystem.
// Keep original-fs for physical installation files and byte-identical backups.
const bundledFs=require('node:fs').promises;
const {createWriteStream}=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Readable,Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const {compareVersions}=require('./core.cjs');
const REPO='Domenico-lel/iDom-Hub';
const ASSETS={darwin:'iDom-Launcher-macOS.dmg',win32:'iDom-Launcher-Windows.exe'};
const readJson=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
const exists=async p=>fs.access(p).then(()=>true,()=>false);
async function atomicJson(file,data){await fs.writeFile(file+'.tmp',JSON.stringify(data),{mode:0o600});await fs.rename(file+'.tmp',file);}
function releaseInfo(release,current,platform){
  if(release.draft||release.prerelease)return {available:false};
  const comparison=compareVersions(release.tag_name,current);
  const asset=release.assets?.find(a=>a.name===ASSETS[platform]);
  return {available:comparison===1&&!!asset,latest:release.tag_name?.replace(/^v/,''),asset};
}
function validateAsset(asset){
  if(!asset||!/^sha256:[a-f0-9]{64}$/i.test(asset.digest||''))throw Error('L’aggiornamento non ha un checksum SHA-256 verificabile.');
  const u=new URL(asset.browser_download_url);
  if(u.origin!=='https://github.com'||!u.pathname.startsWith(`/${REPO}/releases/download/`))throw Error('Indirizzo dell’aggiornamento non valido.');
  if(!Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>1024*1024*1024)throw Error('Dimensione dell’aggiornamento non valida.');
}
async function downloadVerified(asset,file,{fetchImpl=fetch,signal,emit=()=>{}}={}){
  validateAsset(asset);
  const response=await fetchImpl(asset.browser_download_url,{signal});
  if(!response.ok||!response.body)throw Error(`Download dell’aggiornamento fallito (${response.status}).`);
  const hash=crypto.createHash('sha256');let count=0,last=-1;
  const counter=new Transform({transform(chunk,_encoding,callback){
    count+=chunk.length;if(count>asset.size){callback(Error('Il download supera la dimensione prevista.'));return;}
    hash.update(chunk);const percent=Math.floor(count/asset.size*100);if(percent!==last){last=percent;emit({phase:'Download',progress:percent});}callback(null,chunk);
  }});
  try{
    await pipeline(Readable.fromWeb(response.body),counter,createWriteStream(file,{flags:'wx',mode:0o600}),{signal});
    if(count!==asset.size)throw Error('Download dell’aggiornamento incompleto.');
    if(hash.digest('hex')!==asset.digest.slice(7).toLowerCase())throw Error('Il checksum dell’aggiornamento non corrisponde.');
  }catch(e){await fs.rm(file,{force:true});throw e;}
}
function powershellCommand(script,job){return Buffer.from(`& {\n${script}\n} '${job.replace(/'/g,"''")}'`,'utf16le').toString('base64');}
function powershellBootstrap(commandFile){
  // ShellExecute creates an independent hidden console that survives Electron.
  // DETACHED_PROCESS makes Windows PowerShell exit silently on some systems.
  const file=commandFile.replace(/'/g,"''");
  return Buffer.from(`$ErrorActionPreference='Stop'; $s=New-Object System.Diagnostics.ProcessStartInfo; $s.FileName=Join-Path $PSHOME 'powershell.exe'; $s.Arguments='-NoProfile -NonInteractive -EncodedCommand '+[IO.File]::ReadAllText('${file}'); $s.UseShellExecute=$true; $s.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden; [Diagnostics.Process]::Start($s) | Out-Null`,'utf16le').toString('base64');
}
class SelfUpdater{
  constructor({dataDir,version,platform=process.platform,packaged=false,execPath=process.execPath,pid=process.pid,bundleId='it.domenicolella.hub',emit=()=>{},fetchImpl=fetch,ackTimeout=90}){
    Object.assign(this,{dataDir,version,platform,packaged,execPath,pid,bundleId,emit,fetchImpl,ackTimeout});this.root=path.join(dataDir,'self-updates');this.busy=false;this.restarting=false;this.latest=null;
  }
  async check(){
    if(this.checking)return this.checking;
    this.checking=this.checkRelease().finally(()=>this.checking=null);return this.checking;
  }
  async checkRelease(){
    let result=null;try{result=await readJson(path.join(this.root,'last-result.json'));}catch{}
    const base={current:this.version,available:false,supported:this.packaged&&!!ASSETS[this.platform],result};
    try{
      const headers={'User-Agent':'iDom-Launcher','Accept':'application/vnd.github+json'};if(this.etag)headers['If-None-Match']=this.etag;
      const response=await this.fetchImpl(`https://api.github.com/repos/${REPO}/releases/latest`,{headers,signal:AbortSignal.timeout(20000)});
      if(response.status!==304){
        if(!response.ok)throw Error(response.status===403||response.status===429?'Limite GitHub raggiunto. Riprova tra qualche minuto.':`Controllo del launcher non riuscito (${response.status}).`);
        this.latest=await response.json();this.etag=response.headers?.get('etag');
      }
      if(!this.latest)throw Error('Nessuna release del launcher disponibile.');
      const info=releaseInfo(this.latest,this.version,this.platform);this.status={...base,...info,asset:undefined,notes:this.latest.body||''};return this.status;
    }catch(e){this.status={...base,error:e.message};return this.status;}
  }
  cancel(){if(this.busy&&!this.restarting)this.controller?.abort(Error('Aggiornamento del launcher annullato.'));}
  async confirmLaunch(args=process.argv){
    const argument=args.find(a=>a.startsWith('--idom-update-job='));if(!argument)return false;
    const job=path.resolve(argument.slice('--idom-update-job='.length));
    if(path.dirname(job)!==path.resolve(this.root)||!/^job-[a-f0-9-]{36}$/.test(path.basename(job)))return false;
    try{const m=await readJson(path.join(job,'manifest.json'));
      if(m.version!==this.version||m.token!==path.basename(job).slice(4))return false;
      const actual=this.platform==='darwin'?path.dirname(path.dirname(path.dirname(this.execPath))):this.execPath;
      if(path.resolve(m.target)!==path.resolve(actual))return false;
      await atomicJson(path.join(job,'ack.json'),{version:this.version,token:m.token});return true;
    }catch{return false;}
  }
  async prepare(){
    if(this.busy)throw Error('Un aggiornamento del launcher è già in corso.');
    if(!this.packaged||!ASSETS[this.platform])throw Error('Usa la versione installata del launcher per aggiornarlo.');
    this.busy=true;this.controller=new AbortController();let job,stage,mount;
    const notify=(phase,progress=0)=>this.emit({phase,progress});
    const checkAbort=()=>this.controller.signal.throwIfAborted();
    try{
      const status=await this.check();if(status.error)throw Error(status.error);if(!status.available)throw Error('Il launcher è già aggiornato.');
      const {asset}=releaseInfo(this.latest,this.version,this.platform);validateAsset(asset);
      const token=crypto.randomUUID();await fs.mkdir(this.root,{recursive:true,mode:0o700});job=path.join(this.root,'job-'+token);await fs.mkdir(job,{mode:0o700});
      const archive=path.join(job,asset.name);notify('Download');
      await downloadVerified(asset,archive,{fetchImpl:this.fetchImpl,signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(300000)]),emit:this.emit});checkAbort();notify('Verifica',100);
      let target,backup,parentStarted='';
      if(this.platform==='darwin'){
        target=path.dirname(path.dirname(path.dirname(this.execPath)));
        if(!target.endsWith('.app')||target.includes('/AppTranslocation/')||target.startsWith('/Volumes/'))throw Error('Sposta iDom Launcher in Applicazioni e riaprilo prima di aggiornarlo.');
        if((await fs.lstat(target)).isSymbolicLink())throw Error('Avvia il launcher dalla sua cartella originale per aggiornarlo.');
        const current=await this.bundleInfo(target);if(current.CFBundleIdentifier!==this.bundleId||compareVersions(current.CFBundleShortVersionString,this.version)!==0)throw Error('La copia del launcher da aggiornare non corrisponde.');
        await this.probe(path.dirname(target));
        mount=path.join(job,'mount');await fs.mkdir(mount);await run('/usr/bin/hdiutil',['attach','-readonly','-nobrowse','-mountpoint',mount,archive],{timeout:60000});checkAbort();
        const source=path.join(mount,'iDom Launcher.app');const info=await this.bundleInfo(source);
        if(info.CFBundleIdentifier!==this.bundleId||info.CFBundlePackageType!=='APPL'||compareVersions(info.CFBundleShortVersionString,status.latest)!==0)throw Error('Il pacchetto non contiene la versione prevista di iDom Launcher.');
        const {stdout:system}=await run('/usr/bin/sw_vers',['-productVersion']);if(compareVersions(system.trim(),info.LSMinimumSystemVersion||'13.0')<0)throw Error(`L’aggiornamento richiede macOS ${info.LSMinimumSystemVersion}.`);
        await run('/usr/bin/codesign',['--verify','--deep','--strict',source]);
        stage=path.join(path.dirname(target),`.iDom-Launcher-update-${token}.app`);backup=path.join(path.dirname(target),`.iDom-Launcher-backup-${token}.app`);
        notify('Preparazione',100);await run('/usr/bin/ditto',[source,stage],{timeout:120000});checkAbort();
        // Preserve the existing quarantine metadata; never clear Gatekeeper flags.
        let quarantine;try{quarantine=(await run('/usr/bin/xattr',['-p','com.apple.quarantine',target])).stdout.trim();}catch{}
        if(quarantine)await run('/usr/bin/xattr',['-w','com.apple.quarantine',quarantine,stage]);
        await run('/usr/bin/hdiutil',['detach',mount],{timeout:30000});mount=null;
        parentStarted=(await run('/bin/ps',['-p',String(this.pid),'-o','lstart='])).stdout.trim();
      }else{
        target=this.execPath;const dir=path.dirname(target);
        if(path.basename(target).toLowerCase()!=='idom launcher.exe'||!(await exists(path.join(dir,'resources','app.asar')))||!(await exists(path.join(dir,'Uninstall iDom Launcher.exe'))))throw Error('Installa il launcher con il suo installer Windows prima di aggiornarlo.');
        await this.probe(dir);backup=path.join(job,'backup');notify('Preparazione',100);await fs.cp(dir,backup,{recursive:true,dereference:false});checkAbort();
      }
      const plan={job,token,version:status.latest,bundleId:this.bundleId,target,stage,backup,archive,digest:asset.digest.slice(7).toLowerCase(),parentPid:this.pid,parentStarted,timeout:this.ackTimeout,result:path.join(this.root,'last-result.json')};
      await atomicJson(path.join(job,'manifest.json'),plan);checkAbort();notify('Pronto al riavvio',100);
      return plan;
    }catch(e){
      if(stage)await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});
      if(mount)await run('/usr/bin/hdiutil',['detach',mount],{timeout:30000}).catch(()=>{});
      if(job)await fs.rm(job,{recursive:true,force:true}).catch(()=>{});
      this.busy=false;throw e;
    }
  }
  async probe(dir){const file=path.join(dir,'.idom-write-'+crypto.randomUUID());try{await fs.writeFile(file,'',{flag:'wx',mode:0o600});await fs.rm(file);}catch{throw Error('Non puoi aggiornare questa cartella. Installa il launcher nella tua cartella Applicazioni o con l’installer per il tuo utente.');}}
  async bundleInfo(p){const {stdout}=await run('/usr/bin/plutil',['-convert','json','-o','-',path.join(p,'Contents','Info.plist')]);return JSON.parse(stdout);}
  async launchHelper(plan){
    let executable,args;
    if(this.platform==='darwin'){
      const helper=path.join(plan.job,'helper.sh');await fs.writeFile(helper,await bundledFs.readFile(path.join(__dirname,'update-helpers','mac.sh')),{mode:0o700});await fs.chmod(helper,0o700);executable='/bin/sh';args=[helper,plan.target,plan.stage,plan.backup,String(plan.parentPid),plan.parentStarted,plan.job,plan.version,plan.bundleId,String(plan.timeout),plan.token];
    }else{
      const script=await bundledFs.readFile(path.join(__dirname,'update-helpers','windows.ps1'),'utf8');
      const commandFile=path.join(plan.job,'helper-command.txt');await fs.writeFile(commandFile,powershellCommand(script,plan.job),{mode:0o600});
      executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');args=['-NoProfile','-NonInteractive','-EncodedCommand',powershellBootstrap(commandFile)];
    }
    const log=await fs.open(path.join(plan.job,'helper.log'),'a');
    let child;
    try{child=spawn(executable,args,{detached:this.platform!=='win32',stdio:['ignore',log.fd,log.fd],windowsHide:true});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});}catch(e){this.busy=false;await this.discard(plan);throw e;}finally{await log.close();}
    let failed=false;child.once('exit',code=>{failed=code!==0;});
    try{
      const deadline=Date.now()+15000;let ready=false;
      while(Date.now()<deadline){
        try{ready=(await readJson(path.join(plan.job,'ready.json'))).token===plan.token;}catch{}
        if(ready)break;
        if(failed)throw Error('Il processo di aggiornamento si è chiuso prima di essere pronto.');
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      if(!ready)throw Error('Il processo di aggiornamento non ha confermato l’avvio.');
    }catch(e){child.kill();this.busy=false;throw e;}
    child.unref();this.restarting=true;this.emit({phase:'Riavvio',progress:100});return true;
  }
  async discard(plan){if(plan.stage)await fs.rm(plan.stage,{recursive:true,force:true}).catch(()=>{});await fs.rm(plan.job,{recursive:true,force:true}).catch(()=>{});this.busy=false;}
}
module.exports={SelfUpdater,releaseInfo,validateAsset,downloadVerified,powershellCommand,powershellBootstrap,atomicJson};
