import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseHTML} from 'linkedom';
import {fresh,HOME,synchronize} from '../web/core.mjs';

const script=readFileSync(new URL('../web/probe.js',import.meta.url),'utf8');
const directory='https://mooc2-ans.chaoxing.com/mooc2-ans/visit/interaction';
const course='https://mooc1.chaoxing.com/visit/stucoursemiddle?courseid=11&clazzid=22';
const room='https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/stu';
const work='https://mooc1.chaoxing.com/mooc2/work/list';
function page(url,html){
  const {document}=parseHTML(`<html><body>${html}</body></html>`);
  return {document,probe:(mode='read')=>runInNewContext(script+`(${JSON.stringify(mode)})`,{location:new URL(url),document,URL})};
}
const hidden='<div hidden><input type="password"></div>';
test('sync follows the official space → directory → course → assignment pages, ignoring unrelated password fields',async()=>{
  const space=page(HOME,hidden+`<a id="zne_kc_icon">课程</a><iframe id="frame_content" src="${directory}"></iframe>`);
  const index=page(directory,hidden+`<div id="stuNormalCourseListDiv"><h3><a href="${course}">示例课</a></h3></div>`);
  const lesson=page(room,hidden+'<a id="work">作业</a>');
  lesson.document.querySelector('#work').addEventListener('click',()=>{lesson.document.body.insertAdjacentHTML('beforeend',`<iframe id="frame_content-zy" src="${work}"></iframe>`);});
  const assignments=page(work,'<div class="bottomList"><ul><li data="/work/view?workId=33"><div class="right-content"><p>单元练习</p><p class="status">未交</p><div class="time">剩余3小时</div></div></li></ul></div>');
  const fixtures=new Map([[HOME,space],[directory,index],[course,lesson],[work,assignments]]),visits=[];let current;
  const result=await synchronize({go:url=>{visits.push(url);current=fixtures.get(url);assert.ok(current);},probe:()=>current.probe()},fresh(),()=>{},async()=>{});
  assert.deepEqual(visits,[HOME,directory,course,work]);assert.deepEqual(result.errors,[]);assert.equal(result.count,1);assert.equal(result.items[0].key,'11:22:33');
});
test('waits for an actual course frame and does not navigate back to the same home URL',()=>{
  for(const src of ['', 'about:blank', HOME]){
    assert.equal(page(HOME,`<a id="zne_kc_icon">课程</a><iframe id="frame_content" src="${src}"></iframe>`).probe().type,'waiting');
  }
});
test('only the actual passport login page ends the sync, not an intermediate SSO redirect',()=>{
  assert.equal(page('https://passport2.chaoxing.com/login','<h3>用户登录</h3>').probe().type,'login');
  assert.equal(page('https://passport2.chaoxing.com/redirect','').probe().type,'waiting');
});
test('collects enrolled course links independent of heading markup, preserving class identity',()=>{
  const html='<div id="stuNormalCourseListDiv"><a href="//mooc1.chaoxing.com/visit/stucoursemiddle?courseId=1&clazzId=2">课一</a><a href="/settings">设置</a></div>';
  const result=page(directory,html).probe();assert.equal(result.type,'courses');assert.equal(result.courses[0].key,'1:2');assert.equal(result.courses.length,1);
});
test('login handoff requires a readable directory and never turns the first page',()=>{
  const shell=page(HOME,`<a id="zne_kc_icon">课程</a><iframe id="frame_content" src="${directory}"></iframe>`);
  assert.equal(shell.probe('connect').type,'redirect');
  assert.equal(page(directory,'<div id="stuNormalCourseListDiv">加载中</div>').probe('connect').type,'waiting');
  const catalog=page(directory,`<div id="stuNormalCourseListDiv"><a href="${course}">课程</a><button>下一页</button></div>`);
  assert.equal(catalog.probe('connect').type,'connected');
  assert.equal(catalog.document.documentElement.dataset.keqiLast,undefined);
  assert.equal(page(directory,'<div id="stuNormalCourseListDiv">暂无课程</div>').probe('connect').type,'connected');
});
test('checks the official directory once when the space returns the login page',async()=>{
  let url;const visits=[];
  const host={go:value=>{url=value;visits.push(url);},probe:()=>url===HOME?{type:'login'}:{type:'courses',courses:[]}};
  const result=await synchronize(host,fresh(),()=>{},async()=>{});
  assert.deepEqual(visits,[HOME,directory]);assert.equal(result.readCount,0);assert.deepEqual(result.errors,[]);
});
test('all unreadable course rooms leave the last successful snapshot intact',async()=>{
  const state={...fresh(),items:[{key:'old'}],synced:123,count:1};let url;
  const host={go:value=>{url=value;},probe:()=>url===HOME?{type:'courses',courses:[{key:'11:22',name:'测试',url:course}]}:{type:'network',code:503}};
  await assert.rejects(synchronize(host,state,()=>{},async()=>{}),/未能读取任何作业列表.*503/);
  assert.equal(state.synced,123);assert.deepEqual(state.items,[{key:'old'}]);
});
