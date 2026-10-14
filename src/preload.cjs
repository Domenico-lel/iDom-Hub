const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hub',{
  catalog:()=>ipcRenderer.invoke('catalog'), install:id=>ipcRenderer.invoke('install',id),
  open:id=>ipcRenderer.invoke('open',id),repository:id=>ipcRenderer.invoke('repository',id),
  project:()=>ipcRenderer.invoke('project'),
  info:()=>ipcRenderer.invoke('info'),
  applications:()=>ipcRenderer.invoke('applications'),
  onProgress:callback=>{const listener=(_e,data)=>callback(data);ipcRenderer.on('progress',listener);return ()=>ipcRenderer.removeListener('progress',listener);}
});
