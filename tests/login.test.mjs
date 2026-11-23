import {test} from 'node:test';
import assert from 'node:assert/strict';
import portal from '../desktop/portal.cjs';
test('official login carries an HTTPS return address',()=>{
  const url=new URL(portal.loginURL);
  assert.equal(url.origin,'https://passport2.chaoxing.com');assert.equal(url.searchParams.get('refer'),portal.home);
});
test('legacy callback upgrades only the exact official homepage',()=>{
  assert.equal(portal.isLegacyReturn('http://i.mooc.chaoxing.com/space/index?null'),true);
  for(const url of ['http://i.mooc.chaoxing.com.example.org/space/index','http://i.mooc.chaoxing.com/other','http://user@i.mooc.chaoxing.com/space/index','http://i.mooc.chaoxing.com:81/space/index']) assert.equal(portal.isLegacyReturn(url),false);
});
