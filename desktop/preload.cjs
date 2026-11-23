const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('keqi',Object.fromEntries(['go','probe','login','notify','permission'].map(name=>[name,(...args)=>ipcRenderer.invoke('keqi:'+name,...args)])));
