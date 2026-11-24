export const HOME = 'https://i.mooc.chaoxing.com/space/index';
const DIRECTORY = 'https://mooc2-ans.chaoxing.com/mooc2-ans/visit/interaction';
const stages={'space':'课程首页','course-list':'课程目录','course-room':'课程内的作业入口','work-list':'作业列表'};
class LoginRequired extends Error {}
export const HOUR = 3600000;
export function deadline(timer, now) {
  const absolute = timer.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (absolute) {
    const [,year,month,day,hour,minute,second='0'] = absolute;
    return {due:Date.UTC(+year,+month-1,+day,+hour-8,+minute,+second),approx:false};
  }
  if (/剩余|还剩/.test(timer)) {
    const units = [...timer.matchAll(/(\d+)\s*(天|小时|分钟|分|秒)/g)];
    if (units.length) return {due:Math.floor(now / 60000)*60000 + units.reduce((total,[,count,unit])=> total + Number(count)*({天:86400000,小时:HOUR,分钟:60000,分:60000,秒:1000}[unit]),0),approx:true};
  }
  return {due:null,approx:false};
}
export function mergeCourse(course, raw, previous, now) {
  return raw.map(item=>{
    const key = course.key + ':' + item.id;
    let {due,approx} = deadline(item.timer,now);
    const prior = previous.find(entry=>entry.key===key);
    if (approx && prior?.approx && Math.abs(prior.due-due)<=120000) due=prior.due;
    if (due===null && prior?.due && /已截止|已结束/.test(item.timer) && prior.due<=now) { due=prior.due; approx=prior.approx; }
    return {key,courseKey:course.key,course:course.name,title:item.title,status:item.status,due,approx,expired:/已截止|已结束|已过期/.test(item.timer+' '+item.status),stale:false};
  });
}
export function sorted(items, descending=false) {
  return [...items].sort((left,right)=>left.due===null ? (right.due===null ? left.title.localeCompare(right.title,'zh') : 1) : right.due===null ? -1 : (left.due-right.due)*(descending?-1:1));
}
export function schedule(state, now=Date.now()) {
  if (!state.enabled) return [];
  return state.items.filter(item=>item.due>now && !item.expired).map(item=>({id:`${item.key}@${item.due}:${state.hours}`,at:item.due-state.hours*HOUR,due:item.due,title:item.title,course:item.course}));
}
export const fresh = () => ({items:[], synced:0, count:0, errors:[], enabled:false, hours:24});
export async function synchronize(host, state, report, pause = ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
  async function read(url, expected) {
    if(url) await host.go(url);
    let loginChecks=0, stage=expected==='courses'?'课程目录':'课程作业';
    const redirects=new Set(url?[url]:[]);
    for (let step=0;step<50;step++) {
      await pause(450);
      const page = await host.probe(expected);
      if (page.type===expected) return page;
      if (stages[page.stage]) stage=stages[page.stage];
      if (page.type==='redirect' && page.url && !redirects.has(page.url)) {redirects.add(page.url);await host.go(page.url);}
      loginChecks=page.type==='login'?loginChecks+1:0;
      if (loginChecks>=4) throw new LoginRequired(`${stage}：超星返回了登录页，请在课期的「平台登录」中完成登录`);
      if (page.type==='network') throw new Error(`${stage}：平台连接失败${Number.isInteger(page.code)?'（'+page.code+'）':''}`);
      if (page.type==='unsupported') throw new Error('平台跳转到了不支持的域名');
    }
    throw new Error(`${stage}加载超时或页面未能识别`);
  }
  async function pages(url,type){
    const first=await read(url,type),result={...first};let page=first;
    const field=type==='courses'?'courses':'items';result[field]=[...first[field]];
    for(let index=1;page.more && !page.stuck && index<50;index++){
      try{page=await read(null,type);}catch(error){if(error instanceof LoginRequired)throw error;break;}
      result[field].push(...page[field]);if(result.issues)result.issues.push(...page.issues);
    }
    result.more=!!page.more;if(result.issues && result.more)result.issues.push('平台还有未读取的分页');return result;
  }
  report('读取我学的课程…');
  let index;
  try {index=await pages(HOME,'courses');} catch {
    report('课程首页未能读取，正在核对官方课程目录…');
    index=await pages(DIRECTORY,'courses');
  }
  const courses = [...new Map(index.courses.map(course=>[course.key,course])).values()];
  const items=[], errors=index.more?['课程目录有未读取的分页']:[];
  let readCount=0;
  for (const [position,course] of courses.entries()) {
    report(`${position+1}/${courses.length} · ${course.name}`);
    const prior = state.items.filter(item=>item.courseKey===course.key);
    try {
      const page = await pages(course.url,'work');
      const updated = mergeCourse(course,page.items,prior,Date.now());
      items.push(...updated);
      readCount++;
      if (page.issues.length) {
        errors.push(`${course.name}：${page.issues.join('、')}`);
        items.push(...prior.filter(item=>!updated.some(entry=>entry.key===item.key)).map(item=>({...item,stale:true})));
      }
    } catch (error) {
      if (error instanceof LoginRequired) throw error;
      errors.push(course.name+'：'+error.message); items.push(...prior.map(item=>({...item,stale:true})));
    }
  }
  if (courses.length && !readCount) throw new Error(`已找到 ${courses.length} 门课，但未能读取任何作业列表。${errors[errors.length-1]}`);
  if (index.more) items.push(...state.items.filter(item=>!courses.some(course=>course.key===item.courseKey)).map(item=>({...item,stale:true})));
  return {items:[...new Map(items.map(item=>[item.key,item])).values()],count:courses.length,readCount,errors,synced:Date.now()};
}
