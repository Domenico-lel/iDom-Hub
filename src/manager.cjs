const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const catalog=require('./catalog.cjs');
const {compareVersions,selectAsset,needsUpdate,verifyDigest,validateArchivePaths}=require('./core.cjs');
const {recover,swap}=require('./swap.cjs');
class Manager {
  constructor(dataDir, emit=()=>{}, platform=process.platform, installDirs=['/Applications',path.join(os.homedir(),'Applications')]) {this.dataDir=dataDir;this.emit=emit;this.platform=platform;this.installDirs=installDirs;this.releases=new Map();this.busy=false;}
  entry(id) {const e=catalog.find(x=>x.id===id);if(!e)throw new Error('Applicazione sconosciuta.');return e;}
  async records(){try{return JSON.parse(await fs.readFile(path.join(this.dataDir,'installed.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw new Error('Registro installazioni non leggibile.');}}
  async save(records){await fs.mkdir(this.dataDir,{recursive:true});const p=path.join(this.dataDir,'installed.json');await fs.writeFile(p+'.tmp',JSON.stringify(records,null,2));await fs.rename(p+'.tmp',p);}
  async bundleInfo(p){const {stdout}=await run('/usr/bin/plutil',['-convert','json','-o','-',path.join(p,'Contents/Info.plist')]);return JSON.parse(stdout);}
  async installed(entry){
    if(this.platform!=='darwin')return null;
    // Prefer the system copy, so an existing installation is upgraded in place.
    for(const p of this.installDirs.map(dir=>path.join(dir,entry.name+'.app'))){
      try{const info=await this.bundleInfo(p);if(info.CFBundleIdentifier===entry.bundleId)return {path:p,version:info.CFBundleShortVersionString};}catch{}
    }return null;
  }
  async refresh(){
    const records=await this.records();
    const apps=await Promise.all(catalog.map(async entry=>{
      const installed=await this.installed(entry);let error=null;this.releases.delete(entry.id);
      try {
        const response=await fetch(`https://api.github.com/repos/${entry.repo}/releases/latest`,{headers:{'User-Agent':'iDom-Launcher','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw new Error(response.status===403||response.status===429?'Limite GitHub raggiunto. Riprova tra qualche minuto.':response.status===404?'Nessuna release pubblicata.':`GitHub: errore ${response.status}.`);
        const release=await response.json();const asset=selectAsset(entry,release,this.platform);this.releases.set(entry.id,{...release,asset});
      } catch(e){error=e.message;}
      const r=this.releases.get(entry.id);
      // Check the actual macOS version, including the minor version (iVolume needs 14.2).
      let osCompatible=false;
      if(this.platform==='darwin'){const {stdout}=await run('/usr/bin/sw_vers',['-productVersion']);osCompatible=compareVersions(stdout.trim(),entry.minimum)>=0;}
      const update=r?.asset?needsUpdate(installed,r,records[entry.id]):false;
      const metadataAsset=r?selectAsset(entry,r,'darwin'):null;
      const known=entry.knownRelease?.digest===metadataAsset?.digest?entry.knownRelease:null;
      const latestVersion=/^v?\d+(?:\.\d+)*$/.test(r?.tag_name||'')?r.tag_name.replace(/^v/,''):known?.version||null;
      const architectures=known?.architectures||entry.architectures||(/Universale/i.test(metadataAsset?.name||'')?'Intel e Apple Silicon (universale)':null);
      const publishedNotes=(r?.body||'').trim();
      return {id:entry.id,name:entry.name,description:entry.description,category:entry.category,icon:entry.icon,minimum:entry.minimum,architectures,requiresRosetta:known?.requiresRosetta||false,latestVersion,notesSource:publishedNotes?'release':known?'catalog':'empty',installed,available:r?.asset?true:false,latest:r?.tag_name||null,notes:publishedNotes||(known?entry.releaseSummary:''),update,osCompatible,error};
    }));return {platform:this.platform,apps};
  }
  async running(entry){const {stdout}=await run('/bin/ps',['-axo','comm=']);return stdout.split('\n').some(x=>x.trim().includes(`/${entry.name}.app/Contents/MacOS/`));}
  async install(id){
    const entry=this.entry(id);if(this.busy)throw new Error('Attendi il completamento dell’installazione in corso.');
    if(this.platform!=='darwin')throw new Error('Questa applicazione è disponibile solo per macOS.');
    this.busy=true;let temp,mounted=false,mount;
    const notify=(phase,progress=0)=>this.emit({id,phase,progress});
    try {
      await this.refresh();const release=this.releases.get(id);if(!release?.asset)throw new Error('Nessun download compatibile disponibile.');
      const {stdout:system}=await run('/usr/bin/sw_vers',['-productVersion']);if(compareVersions(system.trim(),entry.minimum)<0)throw new Error(`È richiesto macOS ${entry.minimum} o successivo.`);
      if(await this.running(entry))throw new Error(`Chiudi ${entry.name} prima di aggiornarla, poi riprova.`);
      const asset=release.asset;const url=new URL(asset.browser_download_url);
      if(url.origin!=='https://github.com'||!url.pathname.startsWith(`/${entry.repo}/releases/download/`))throw new Error('Indirizzo download non valido.');
      temp=await fs.mkdtemp(path.join(os.tmpdir(),'domenico-hub-'));const archive=path.join(temp,'download'+path.extname(asset.name));
      notify('Download');const response=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw new Error(`Download fallito (${response.status}).`);
      const chunks=[];let count=0;const limit=512*1024*1024;
      for await(const chunk of response.body){count+=chunk.length;if(count>limit)throw new Error('Download troppo grande.');chunks.push(chunk);notify('Download',asset.size?Math.min(100,Math.round(count/asset.size*100)):0);}
      const buffer=Buffer.concat(chunks);if(count!==asset.size)throw new Error('Download incompleto.');verifyDigest(buffer,asset.digest);await fs.writeFile(archive,buffer);notify('Verifica',100);
      let source;
      if(path.extname(asset.name).toLowerCase()==='.dmg'){
        mount=path.join(temp,'mount');await fs.mkdir(mount);await run('/usr/bin/hdiutil',['attach','-readonly','-nobrowse','-mountpoint',mount,archive]);mounted=true;source=path.join(mount,entry.name+'.app');
      }else{
        const {stdout}=await run('/usr/bin/unzip',['-Z1',archive]);validateArchivePaths(stdout.trim().split('\n'));const unpack=path.join(temp,'unpack');await fs.mkdir(unpack);await run('/usr/bin/ditto',['-x','-k',archive,unpack]);source=path.join(unpack,entry.name+'.app');
      }
      const info=await this.bundleInfo(source);if(info.CFBundleIdentifier!==entry.bundleId || info.CFBundlePackageType!=='APPL')throw new Error('Il pacchetto non contiene l’app attesa.');
      if(compareVersions(system.trim(),info.LSMinimumSystemVersion||entry.minimum)<0)throw new Error(`Questa release richiede macOS ${info.LSMinimumSystemVersion}.`);
      await run('/usr/bin/codesign',['--verify','--deep','--strict',source]);
      for(const dir of this.installDirs)await recover(path.join(dir,entry.name+'.app'),path.join(dir,`.${entry.name}-hub-backup.app`));
      const current=await this.installed(entry);const target=current?.path||path.join(this.installDirs.at(-1),entry.name+'.app');const dir=path.dirname(target);await fs.mkdir(dir,{recursive:true});
      try{await fs.access(dir,require('node:fs').constants.W_OK);}catch{throw new Error('Non puoi scrivere nella cartella Applicazioni. Sposta l’app in ~/Applications e riprova.');}
      const stage=path.join(dir,`.${entry.name}-hub-new.app`),backup=path.join(dir,`.${entry.name}-hub-backup.app`);
      await fs.rm(stage,{recursive:true,force:true});notify('Installazione',100);await run('/usr/bin/ditto',[source,stage]);
      // Preserve Gatekeeper checks even for archive-based installs.
      const quarantine=`0081;${Math.floor(Date.now()/1000).toString(16)};iDom Launcher;`;
      await run('/usr/bin/xattr',['-w','com.apple.quarantine',quarantine,stage]);
      if(await this.running(entry))throw new Error(`Chiudi ${entry.name} e riprova.`);
      await swap(target,stage,backup,async()=>{
        const records=await this.records();records[id]={releaseId:release.id,assetId:asset.id,digest:asset.digest,version:info.CFBundleShortVersionString};await this.save(records);
      });notify('Completato',100);
    }finally{
      if(mounted)await run('/usr/bin/hdiutil',['detach',mount]).catch(()=>{});
      if(temp)await fs.rm(temp,{recursive:true,force:true}).catch(()=>{});
      this.busy=false;
    }
    return this.refresh();
  }
  async open(id){const e=this.entry(id);const installed=await this.installed(e);if(!installed)throw new Error('Installa prima l’app.');await run('/usr/bin/open',[installed.path]);}
}
module.exports={Manager};
