const {app,BrowserWindow,ipcMain,Notification,session,shell} = require('electron');
const path=require('node:path'),fs=require('node:fs');
const {home,loginURL,isLegacyReturn,isPortalURL}=require('./portal.cjs');
const {createPortalReader}=require('./portal-reader.cjs');
const appId='io.github.fanyadeadline.Keqi';
const probeSource=fs.readFileSync(path.join(__dirname,'../web/probe.js'),'utf8');
const probe=probeSource+'()',catalogCheck=probeSource+"('connect')";
let dashboard,worker,reader,loginTimer,reuseCatalog=false,entries=[],sent=new Set();
function finishLogin(connected){
  if(!loginTimer)return;
  clearInterval(loginTimer);loginTimer=null;reuseCatalog=connected;worker.hide();
  if(dashboard && !dashboard.isDestroyed()){dashboard.show();dashboard.webContents.send('keqi:login-result',connected);}
}
function portal(){
  if(worker && !worker.isDestroyed())return worker;
  const win=new BrowserWindow({show:false,width:1020,height:780,title:'泛雅平台登录',autoHideMenuBar:true,webPreferences:{partition:'persist:keqi-portal',sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  reader=createPortalReader(win.webContents,probe);
  const guard=(event,url)=>{const target=event.url || url;if(isPortalURL(target))return;event.preventDefault();
    if(event.isMainFrame!==false && isLegacyReturn(target))reader.go(home);
  };
  win.webContents.on('will-navigate',guard);
  win.webContents.on('will-redirect',guard);
  win.webContents.setWindowOpenHandler(({url})=>{if(loginTimer && isPortalURL(url))reader.go(url);return {action:'deny'};});
  win.on('close',event=>{if(loginTimer){event.preventDefault();finishLogin(false);}});
  worker=win;return win;
}
function openLogin(){
  const win=portal();win.show();win.focus();if(loginTimer)return;
  let checking=false,candidate='',since=0,followed='';
  const timer=setInterval(async()=>{
    if(checking || win.isDestroyed())return;
    checking=true;try{
      const page=await reader.probe('courses',catalogCheck);
      if(loginTimer!==timer)return;
      if(page.type==='connected'){finishLogin(true);return;}
      if(page.type==='redirect' && page.url!==followed){
        if(page.url!==candidate){candidate=page.url;since=Date.now();}
        else if(Date.now()-since>=1500){followed=page.url;reader.go(page.url);}
      }else {candidate='';if(page.type==='login')followed='';}
    }catch{}finally{checking=false;}
  },500);
  loginTimer=timer;
  reader.go(loginURL);
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
    dashboard.on('closed',()=>{clearInterval(loginTimer);loginTimer=null;app.quit();});
    const handlers={
      login:openLogin,
      go:url=>{portal();if(loginTimer)throw Error('请先返回看板');const reuse=reuseCatalog && url===home;reuseCatalog=false;if(!reuse)reader.go(url);},
      probe:expected=>reader.probe(expected),
      notify:plan=>{entries=plan;sent=new Set([...sent].filter(id=>entries.some(entry=>entry.id===id)));tick();},permission:()=>Notification.isSupported()
    };
    for(const [name,handler] of Object.entries(handlers))ipcMain.handle('keqi:'+name,(event,...args)=>{if(event.sender!==dashboard.webContents || event.senderFrame!==dashboard.webContents.mainFrame)throw Error('无权限');return handler(...args);});
    dashboard.loadFile(path.join(__dirname,'../web/index.html'));setInterval(tick,15000).unref();
  });
}
