import {createHmac,createHash,timingSafeEqual} from 'node:crypto';

/** A process-local webhook receiver. Signing uses the exact raw request bytes. */
export function createReceiver({secret,onEvent,maxDeliveries=1000}) {
  if(typeof secret!=='string'||!secret.length||typeof onEvent!=='function'||!Number.isSafeInteger(maxDeliveries)||maxDeliveries<1)throw new TypeError('Invalid receiver options');
  const deliveries=new Map();
  return async function receive(request) {
    if(!request||typeof request!=='object')return {status:400,error:'deliveryId, signature and rawBody required'};
    const {deliveryId,signature,rawBody}=request;
    if(typeof deliveryId!=='string'||!deliveryId.length||!Buffer.isBuffer(rawBody)||signature===undefined||signature===null||signature==='')return {status:400,error:'deliveryId, signature and rawBody required'};
    if(typeof signature!=='string'||!/^sha256=[0-9a-f]{64}$/.test(signature))return {status:401,error:'invalid signature'};
    const expected=createHmac('sha256',secret).update(rawBody).digest();
    if(!timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex')))return {status:401,error:'invalid signature'};
    let event;try{event=JSON.parse(rawBody.toString('utf8'));}catch{return {status:400,error:'invalid JSON'};}
    const digest=createHash('sha256').update(rawBody).digest('hex');
    const previous=deliveries.get(deliveryId);
    if(previous){
      if(previous.digest!==digest)return {status:409,error:'delivery ID reused with different payload'};
      return previous.running ? {status:202,duplicate:true} : {status:200,duplicate:true};
    }
    if(deliveries.size>=maxDeliveries){
      const oldest=[...deliveries].find(([,value])=>!value.running);
      if(!oldest)return {status:503,error:'receiver at capacity'};
      deliveries.delete(oldest[0]);
    }
    deliveries.set(deliveryId,{digest,running:true});
    try{await onEvent(event);deliveries.set(deliveryId,{digest,running:false});return {status:200,duplicate:false};}
    catch{deliveries.delete(deliveryId);return {status:503,error:'processing failed; retry delivery'};}
  };
}
