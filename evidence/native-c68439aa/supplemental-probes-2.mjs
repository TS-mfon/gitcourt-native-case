import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createReceiver} from '/work/webhook.mjs';
const secret='supplemental-test-fixture';
const body=Buffer.from('{"action":"push"}');
const request=id=>({deliveryId:id,rawBody:body,signature:'sha256='+createHmac('sha256',secret).update(body).digest('hex')});
test('every missing required request field returns 400 without invoking the callback',async()=>{
 let calls=0;const handle=createReceiver({secret,onEvent:()=>calls++});
 for(const [name,value] of [['deliveryId',undefined],['deliveryId',''],['rawBody',undefined],['rawBody','not raw bytes'],['signature',undefined],['signature',''],['signature',null]]){
  const result=await handle({...request('missing-'+name),[name]:value});
  assert.equal(result.status,400,'Missing '+name+' must produce the agreed missing-field response');
 }
 assert.equal(calls,0);
});
test('capacity exhaustion with an in-flight delivery is retryable and never invokes a second callback',async()=>{
 let release;let calls=0;const handle=createReceiver({secret,maxDeliveries:1,onEvent:()=>{calls++;return calls===1?new Promise(resolve=>{release=resolve;}):undefined;}});
 const pending=handle(request('first'));
 assert.equal((await handle(request('second'))).status,503);assert.equal(calls,1);
 assert.equal((await handle(request('first'))).status,202);assert.equal(calls,1);
 release();await pending;assert.equal((await handle(request('second'))).status,200);assert.equal(calls,2);
});
