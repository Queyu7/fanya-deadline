import {fresh,sorted,schedule,synchronize,HOUR} from './core.mjs';
const byId = id=>document.getElementById(id);
const android = !!window.KeqiAndroid;
const host = window.keqi || (android ? {
  go:url=>KeqiAndroid.go(url), probe:()=>new Promise(resolve=>{window.keqiProbe=value=>resolve(value || {type:'waiting'});KeqiAndroid.probe();}),
  login:()=>KeqiAndroid.login(), notify:entries=>KeqiAndroid.plan(JSON.stringify(entries)), permission:()=>KeqiAndroid.permission()
}:null);
let state=fresh(), busy=false, signingIn=false, notice='', lastAttempt=0;
try { Object.assign(state,JSON.parse(localStorage.getItem('keqi-v1')||'{}')); } catch {}
const save=()=>localStorage.setItem('keqi-v1',JSON.stringify(state));
const node=(tag,content,cls)=>{const element=document.createElement(tag);element.textContent=content;if(cls)element.className=cls;return element;};
const format=(time,options)=>new Intl.DateTimeFormat('zh-CN',{...options,timeZone:'Asia/Shanghai',hour12:false}).format(time);
function render(){
  const now=Date.now(), ready=Boolean(state.synced), expired=item=>item.expired || (item.due!==null && item.due<=now);
  byId('total').textContent=ready?state.items.length:'—';byId('urgent').textContent=ready?state.items.filter(item=>!expired(item)&&item.due>now&&item.due<=now+24*HOUR).length:'—';byId('late').textContent=ready?state.items.filter(expired).length:'—';
  byId('status').textContent=notice || (ready?`最近同步 ${format(state.synced,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} · 已读取 ${state.readCount??state.count}/${state.count} 门课程${state.errors.length?' · 有未完成项，请查看详情':' · 北京时间'}`:'还没有同步记录');
  const issues=byId('issues');issues.hidden=!state.errors.length;issues.querySelector('ul').replaceChildren(...state.errors.map(text=>node('li',text)));
  const list=byId('list');list.replaceChildren();
  for(const item of sorted(state.items,byId('order').value==='desc')){
    const line=node('article','','item'),date=node('div',item.due?format(item.due,{month:'2-digit',day:'2-digit'}):'待确认','date');
    date.append(node('small',item.due?(item.approx?'约 ':'')+format(item.due,{year:'numeric',hour:'2-digit',minute:'2-digit'}):'无明确时间'));
    const detail=node('div',item.title,'detail');detail.append(node('small',item.course+(item.stale?' · 上次记录':'')));
    const hot=item.due && item.due-now<=24*HOUR;line.append(date,detail,node('span',expired(item)?'已截止':hot?'即将截止':item.status,'badge '+(expired(item)?'over':hot?'hot':'')));list.append(line);
  }
  if(!state.items.length){const empty=node('div','','empty');empty.append(node('strong',!ready?'先连接你的课程':state.errors.length?'暂无可确认的作业':'当前没有待处理作业'),node('span',!ready?'在「平台登录」进入泛雅，再同步全部课程。':state.errors.length?'部分课程未读取，请查看同步详情。':'新作业会在下次同步时出现。'));list.append(empty);}
  byId('enabled').checked=state.enabled;byId('hours').value=String(state.hours);byId('login').disabled=busy;byId('sync').disabled=busy||signingIn;
  byId('hint').textContent=android?'已同步的提醒由系统调度，省电模式可能延迟。':'桌面端请保持应用运行；最小化后仍会提醒。';
}
const plan=()=>host?.notify(schedule(state));
async function sync(){if(busy||signingIn||!host)return;busy=true;lastAttempt=Date.now();try{Object.assign(state,await synchronize(host,state,message=>{notice=message;render();}));save();await plan();notice='';}catch(error){notice='同步未完成，已保留原清单：'+error.message;}finally{busy=false;render();}}
window.keqiLoginResult=connected=>{signingIn=false;notice=connected?'已连接泛雅，开始同步…':'已返回看板。若已完成登录，可点「同步全部课程」。';render();if(connected)sync();};
host?.onLoginResult?.(window.keqiLoginResult);
byId('sync').onclick=sync;byId('login').onclick=async()=>{if(!host)return;signingIn=true;notice='等待泛雅返回课程首页，连接后将自动同步…';render();try{await host.login();}catch{window.keqiLoginResult(false);}};byId('order').onchange=render;
byId('hours').onchange=()=>{state.hours=Number(byId('hours').value);save();plan();};
byId('enabled').onchange=async()=>{state.enabled=byId('enabled').checked;if(state.enabled && host && !(await host.permission())){state.enabled=false;notice='请在系统中允许通知后，再启用提醒。';}save();plan();render();};
if(!host)notice='浏览器预览 · 请使用客户端登录、同步和接收通知';
render();plan();setInterval(render,60000);setInterval(()=>{if(state.synced && !document.hidden && Date.now()-Math.max(state.synced,lastAttempt)>=30*60000)sync();},60000);
