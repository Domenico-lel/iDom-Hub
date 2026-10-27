const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hub',{
  catalog:()=>ipcRenderer.invoke('catalog'), install:id=>ipcRenderer.invoke('install',id),
  open:id=>ipcRenderer.invoke('open',id),repository:id=>ipcRenderer.invoke('repository',id),
  external:url=>ipcRenderer.invoke('external',url),
  project:()=>ipcRenderer.invoke('project'),
  info:()=>ipcRenderer.invoke('info'),
  updateLauncher:()=>ipcRenderer.invoke('launcher-update'),
  cancelLauncherUpdate:()=>ipcRenderer.invoke('launcher-cancel'),
  ready:()=>ipcRenderer.invoke('ready'),
  applications:()=>ipcRenderer.invoke('applications'),
  privacySecurity:()=>ipcRenderer.invoke('privacy-security'),
  onProgress:callback=>{const listener=(_e,data)=>callback(data);ipcRenderer.on('progress',listener);return ()=>ipcRenderer.removeListener('progress',listener);},
  onLauncherProgress:callback=>{const listener=(_e,data)=>callback(data);ipcRenderer.on('launcher-progress',listener);return ()=>ipcRenderer.removeListener('launcher-progress',listener);}
});
