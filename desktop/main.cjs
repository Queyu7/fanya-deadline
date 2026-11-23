const {app,BrowserWindow,ipcMain,Notification,session,shell} = require('electron');
const path=require('node:path'),fs=require('node:fs');
const {home,loginURL,isLegacyReturn}=require('./portal.cjs');
const appId='io.github.fanyadeadline.Keqi';
const probe=fs.readFileSync(path.join(__dirname,'../web/probe.js'),'utf8');
let dashboard,worker,login,entries=[],sent=new Set();
const safe=value=>{try{const url=new URL(value);return url.protocol==='https:' && /(^|\.)chaoxing\.com$/.test(url.hostname) && !url.username && !url.password;}catch{return false;}};
function portal(visible){
  const win=new BrowserWindow({show:visible,width:1020,height:780,title:'泛雅平台登录',autoHideMenuBar:true,webPreferences:{partition:'persist:keqi-portal',sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  const guard=(event,url)=>{const target=event.url || url;if(safe(target))return;event.preventDefault();
    if(visible && event.isMainFrame!==false && isLegacyReturn(target))win.loadURL(home).catch(()=>{});
  };
  win.webContents.on('will-navigate',guard);
  win.webContents.on('will-redirect',guard);
  win.webContents.setWindowOpenHandler(({url})=>{if(visible && safe(url))win.loadURL(url).catch(()=>{});return {action:'deny'};});
  return win;
}
function tick(){
  const now=Date.now();
  for(const entry of entries){if(entry.at>now||entry.due<=now||sent.has(entry.id))continue;
    const notification=new Notification({title:'课期 · 作业即将截止',body:`${entry.course} · ${entry.title}`});
    notification.on('click',()=>{dashboard?.show();dashboard?.focus();});notification.show();sent.add(entry.id);
  }
  const saved=JSON.stringify([...sent]);if(saved!==tick.last){fs.writeFileSync(path.join(app.getPath('userData'),'delivered.json'),saved);tick.last=saved;}
}
app.setName('课期');app.setAppUserModelId(appId);
if(!app.requestSingleInstanceLock())app.quit();else {
  app.on('second-instance',()=>{dashboard?.show();dashboard?.focus();});
  app.whenReady().then(()=>{
    if(process.platform==='win32' && app.isPackaged){
      const shortcut=path.join(app.getPath('appData'),'Microsoft/Windows/Start Menu/Programs/课期.lnk');
      shell.writeShortcutLink(shortcut,'create',{target:process.execPath,appUserModelId:appId,description:'课期作业看板'});
    }
    try{sent=new Set(JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'delivered.json'),'utf8')));}catch{}
    session.fromPartition('persist:keqi-portal').setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    dashboard=new BrowserWindow({width:1000,height:780,minWidth:360,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
    dashboard.webContents.on('will-navigate',event=>event.preventDefault());dashboard.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    dashboard.on('closed',()=>app.quit());
    const handlers={
      login:()=>{if(!login||login.isDestroyed()){login=portal(true);login.loadURL(loginURL).catch(()=>{});}else login.show();},
      go:async url=>{if(!safe(url))throw Error('不支持的课程域名');if(!worker||worker.isDestroyed())worker=portal(false);
        const loading=worker.loadURL(url);let timer;try{await Promise.race([loading,new Promise((_,reject)=>{timer=setTimeout(()=>{worker.webContents.stop();reject(Error('连接平台超时'));},22000);})]);}finally{clearTimeout(timer);}},
      probe:async()=>safe(worker?.webContents.getURL())?worker.webContents.executeJavaScript(probe):{type:'waiting'},
      notify:plan=>{entries=plan;sent=new Set([...sent].filter(id=>entries.some(entry=>entry.id===id)));tick();},permission:()=>Notification.isSupported()
    };
    for(const [name,handler] of Object.entries(handlers))ipcMain.handle('keqi:'+name,(event,...args)=>{if(event.sender!==dashboard.webContents || event.senderFrame!==dashboard.webContents.mainFrame)throw Error('无权限');return handler(...args);});
    dashboard.loadFile(path.join(__dirname,'../web/index.html'));setInterval(tick,15000).unref();
  });
}
