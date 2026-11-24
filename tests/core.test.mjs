import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseHTML} from 'linkedom';
import {deadline,sorted,mergeCourse,schedule,synchronize,fresh,HOUR} from '../web/core.mjs';
const now=Date.UTC(2026,0,1), course={name:'示例课程',key:'2:3',url:'https://mooc1.chaoxing.com/course'};
test('remaining, absolute (Shanghai), and unknown deadlines',()=>{
  assert.equal(deadline('剩余154小时14分钟',now).due,now+154*HOUR+840000);assert.equal(deadline('截止：2026-01-01 08:00',now).due,now);assert.equal(deadline('不限时',now).due,null);
});
test('stable identity, sorting and eligible notifications',()=>{
  const raw=[{id:'7',title:'练习',status:'未交',timer:'剩余2小时'}];const items=mergeCourse(course,raw,[],now);
  assert.equal(mergeCourse(course,raw,items,now+60000)[0].due,items[0].due);
  const unknown={...items[0],due:null}, expired={...items[0],due:now-1};
  assert.equal(sorted([unknown,...items,expired])[0],expired);assert.equal(sorted([unknown,...items],true).at(-1),unknown);
  const state={enabled:true,items:[unknown,...items,expired],hours:1};assert.equal(schedule(state,now)[0].at,now+HOUR);assert.equal(schedule(state,now).length,1);assert.equal(schedule({...state,enabled:false},now).length,0);
});
test('partial sync preserves stale courses but removes submitted work from successful courses',async()=>{
  const second={...course,key:'4:5',url:course.url+'2'};let page;const host={go:url=>{page=url;},probe:()=>page===course.url?{type:'work',items:[],issues:[]}:page===second.url?{type:'unsupported'}:{type:'courses',courses:[course,second]}};
  const state={...fresh(),items:[{key:'old',courseKey:course.key},{key:'keep',courseKey:second.key}]};const result=await synchronize(host,state,()=>{},async()=>{});assert.deepEqual(result.items,[{key:'keep',courseKey:second.key,stale:true}]);assert.equal(result.errors.length,1);
});
test('login expiry never replaces cache',async()=>{await assert.rejects(synchronize({go:()=>{},probe:()=>({type:'login'})},fresh(),()=>{},async()=>{}),/完成登录/);});
test('additional assignment pages are merged and overlapping rows deduplicated',async()=>{
  const raw=id=>({id,title:'练习',status:'未交',timer:'剩余2小时'});
  const queue=[{type:'courses',courses:[course]},{type:'work',items:[raw('1')],issues:[],more:true},{type:'work',items:[raw('1'),raw('2')],issues:[]}];
  const result=await synchronize({go:()=>{},probe:()=>queue.shift()},fresh(),()=>{},async()=>{});assert.equal(result.items.length,2);assert.deepEqual(result.errors,[]);
});
const probe=readFileSync(new URL('../web/probe.js',import.meta.url),'utf8')+'()';
function sample(body){const {document}=parseHTML(`<html><body>${body}</body></html>`);return runInNewContext(probe,{document,location:new URL('https://mooc1.chaoxing.com/mooc2/work/list'),URL});}
test('actual card structure: skip submitted, retain pending without a deadline',()=>{
  const card=(id,status,timer)=>`<li role="link" data="https://mooc1.chaoxing.com/work?workId=${id}"><div class="right-content"><p>周练</p><p class="status">${status}</p><div class="time">${timer}</div></div></li>`;
  const result=sample(`<div class="bottomList"><ul>${card(1,'未交','剩余4小时')}${card(2,'已完成','')}${card(3,'打回重做','')}</ul></div>`);assert.equal(result.type,'work');assert.deepEqual(Array.from(result.items,item=>item.id),['1','3']);
  assert.equal(sample('<p>加载中</p>').type,'waiting');assert.equal(sample('<p>暂无作业</p>').type,'work');
});
