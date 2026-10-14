const {app,BrowserWindow,ipcMain,shell,session}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {Manager}=require('./manager.cjs');
const {SelfUpdater}=require('./self-updater.cjs');
let win,manager,updater;
// Keep existing installation records when the displayed launcher name changes.
if(app.isPackaged)app.setPath('userData',path.join(app.getPath('appData'),'iDom Hub'));
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{win?.show();win?.focus();});
  app.whenReady().then(()=>{
    session.defaultSession.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
    manager=new Manager(app.getPath('userData'),event=>{if(win&&!win.isDestroyed())win.webContents.send('progress',event);});
    updater=new SelfUpdater({dataDir:app.getPath('userData'),version:require('../package.json').version,packaged:app.isPackaged,emit:event=>{if(win&&!win.isDestroyed())win.webContents.send('launcher-progress',event);}});
    const local=pathToFileURL(path.join(__dirname,'../ui/index.html')).href;
    function create(){
      win=new BrowserWindow({width:1180,height:760,minWidth:760,minHeight:500,title:'iDom Launcher',icon:path.join(__dirname,'../ui/assets/hub.png'),backgroundColor:'#121316',titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',trafficLightPosition:{x:14,y:17},webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
      win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      win.webContents.on('will-navigate',e=>e.preventDefault());win.loadURL(local);
      win.on('close',e=>{if(updater.busy&&!updater.restarting)e.preventDefault();});
    }
    function handle(channel,fn){ipcMain.handle(channel,async(e,...args)=>{
      if(e.sender!==win?.webContents||e.senderFrame!==win.webContents.mainFrame||e.senderFrame.url!==local)throw new Error('Richiesta non autorizzata.');
      return fn(...args);
    });}
    handle('catalog',async()=>{const [catalog,launcher]=await Promise.all([manager.refresh(),updater.check()]);return {...catalog,launcher};});
    handle('install',id=>{if(updater.busy)throw Error('Attendi l’aggiornamento del launcher.');return manager.install(id);});handle('open',id=>manager.open(id));
    handle('launcher-update',async()=>{
      if(manager.busy)throw Error('Attendi il completamento dell’aggiornamento dell’app.');
      const plan=await updater.prepare();
      try{await updater.launchHelper(plan);}catch(e){await updater.discard(plan);throw e;}
      setTimeout(()=>app.quit(),250);return {restarting:true};
    });
    handle('launcher-cancel',()=>{updater.cancel();return true;});
    handle('ready',()=>updater.confirmLaunch());
    handle('repository',id=>shell.openExternal(`https://github.com/${manager.entry(id).repo}`));
    handle('external',url=>{if(typeof url!=='string'||url.length>4096)throw Error('Link non valido.');const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error('Link non valido.');return shell.openExternal(u.href);});
    handle('project',()=>shell.openExternal('https://github.com/Domenico-lel/iDom-Hub'));
    handle('info',()=>({version:require('../package.json').version}));
    handle('applications',()=>shell.openPath(path.join(require('node:os').homedir(),'Applications')));
    create();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)create();});
  });
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
  app.on('before-quit',e=>{if(manager?.busy||updater?.busy&&!updater.restarting)e.preventDefault();});
}
