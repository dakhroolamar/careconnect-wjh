import {DurableObject} from 'cloudflare:workers';
import {createApiCore} from '../server/api-core.js';

// One serialized care database; preserves the existing SQL and policies.
export class PilotDatabase extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);
  const sql=ctx.storage.sql;
  const db={
   exec:query=>sql.exec(query),
   prepare:query=>({
    get:(...args)=>sql.exec(query,...args).toArray()[0],
    all:(...args)=>sql.exec(query,...args).toArray(),
    run:(...args)=>{sql.exec(query,...args).toArray();},
   }),
   transaction:fn=>ctx.storage.transactionSync(fn),
   close:()=>{},
  };
  this.api=createApiCore({db,secureCookies:true,seedData:env.SEED_TEST_DATA==='true'});
 }
 async fetch(request){
  const headers=Object.fromEntries(request.headers);
  headers.host=new URL(request.url).host;
  const req={url:request.url,method:request.method,headers,socket:{remoteAddress:headers['cf-connecting-ip']||'unknown'},async *[Symbol.asyncIterator](){
   if(request.body){const reader=request.body.getReader();const decoder=new TextDecoder();try{while(true){const {done,value}=await reader.read();if(done)break;yield decoder.decode(value,{stream:true});}yield decoder.decode();}finally{reader.releaseLock();}}
  }};
  return this.ctx.blockConcurrencyWhile(async()=>{
   const responseHeaders=new Headers();let body='',status=200;
   const res={get statusCode(){return status},set statusCode(v){status=v},setHeader:(k,v)=>responseHeaders.set(k,v),end:value=>{body=value||'';}};
   await this.api.handler(req,res);
   return new Response(body,{status,headers:responseHeaders});
  });
 }
}
export default {
 async fetch(request,env){
  if(new URL(request.url).pathname.startsWith('/api/'))return env.PILOT_DB.get(env.PILOT_DB.idFromName('wjh-pilot-v1')).fetch(request);
  return env.ASSETS.fetch(request);
 }
};
