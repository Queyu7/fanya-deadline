const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {app,session,WebContentsView}=require('electron');
const {createPortalReader}=require('../desktop/portal-reader.cjs');
const {home,loginURL}=require('../desktop/portal.cjs');

const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'keqi-test-'));
app.setPath('userData',temporary);
app.setPath('sessionData',temporary);
app.dock?.hide();
const directory='https://mooc2-ans.chaoxing.com/mooc2-ans/visit/interaction';
const room='https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/stu';
const entry='https://mooc1.chaoxing.com/visit/stucoursemiddle';
const work='https://mooc1.chaoxing.com/mooc2/work/list';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const html=body=>new Response(`<!doctype html><meta charset="utf-8"><body>${body}</body>`,{headers:{'Content-Type':'text/html; charset=utf-8'}});
function fixture(request){
  const url=new URL(request.url),group=url.searchParams.get('clazzid');
  switch(url.origin+url.pathname){
    case loginURL.split('?')[0]:return html('<h3>用户登录</h3>');
    case home:return html(`<a id="zne_kc_icon">课程</a><iframe name="frame_content" id="frame_content" src="${directory}"></iframe>`);
    case directory:return html(`<div id="stuNormalCourseListDiv"><div hidden><input type="password"></div><a href="${entry}?courseid=11&clazzid=22">示例甲</a><a href="${entry}?courseid=11&clazzid=23">示例乙</a></div>`);
    case entry:return Response.redirect(`${room}${url.search}`,302);
    case room:return html(`<a id="assignments" href="#list">作业</a><iframe id="frame_content-zy" name="frame_content-zy"></iframe><script>document.querySelector('a').onclick=event=>{event.preventDefault();document.querySelector('iframe').src='${work}?clazzid=${group}';}</script>`);
    case work:return group==='23'?html('<p>暂无作业</p>'):html('<div class="bottomList"><ul><li data="/work?workId=33"><div class="right-content"><p>示例练习</p><p class="status">未交</p><div class="time">剩余3小时</div></div></li><li data="/work?workId=34"><p class="status">已完成</p></li></ul></div>');
    default:return new Response('No fixture',{status:404});
  }
}
async function run(){
  const {fresh,synchronize}=await import('../web/core.mjs');
  const isolated=session.fromPartition('keqi-regression',{cache:false});
  isolated.protocol.handle('https',fixture);
  isolated.protocol.handle('http',()=>new Response('Not supported',{status:403}));
  const view=new WebContentsView({webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  const source=fs.readFileSync(path.join(__dirname,'../web/probe.js'),'utf8');
  const reader=createPortalReader(view.webContents,source+'()');
  async function waitFor(type){
    const until=Date.now()+7000;
    while(Date.now()<until){
      const page=await reader.probe('courses',source+"('connect')");
      if(page.type===type)return;
      await pause(50);
    }
    throw Error('未识别测试页面：'+type);
  }
  try{
    reader.go(loginURL);await waitFor('login');
    reader.go(home);await waitFor('connected');
    assert.equal(view.webContents.mainFrame.url,home);
    const handoff=await reader.probe('courses');
    assert.equal(handoff.courses.length,2);
    let reuse=true;
    const host={probe:reader.probe,go:url=>{if(reuse){assert.equal(url,home);reuse=false;}else reader.go(url);}};
    const state=await synchronize(host,fresh(),()=>{},()=>pause(80));
    assert.deepEqual(state.errors,[]);assert.equal(state.readCount,2);assert.equal(state.count,2);
    assert.deepEqual(state.items.map(item=>item.key),['11:22:33']);
    const refreshed=await synchronize(reader,state,()=>{},()=>pause(80));
    assert.deepEqual(refreshed.items,state.items);assert.equal(refreshed.readCount,2);
    console.log('PASS · isolated Electron: login → embedded directory → 2/2 courses → 1 pending assignment → repeat sync');
  }finally{view.webContents.close();}
}
const timeout=setTimeout(()=>{console.error('Desktop sync test timed out');app.exit(1);},40000);
app.whenReady().then(run).then(()=>{clearTimeout(timeout);app.quit();},error=>{clearTimeout(timeout);console.error(error);app.exit(1);});
app.on('quit',()=>fs.rmSync(temporary,{recursive:true,force:true}));
