import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('Cloudflare SQLite runtime supports secure login, scoped care, closure and persistent restart',async t=>{
 const options={modules:true,bindings:{SEED_TEST_DATA:'true'},scriptPath:'.wrangler/bundle/worker.js',compatibilityDate:'2026-10-08',compatibilityFlags:['nodejs_compat'],durableObjects:{PILOT_DB:{className:'PilotDatabase',useSQLite:true}},durableObjectsPersist:`.pilot/worker-test-${crypto.randomUUID()}`,serviceBindings:{ASSETS:()=>new Response('assets')}};
 const runtimeOptions={...convertV4MiniflareOptions(options),resourcePersistencePath:options.durableObjectsPersist};let mf=new Miniflare(runtimeOptions);t.after(()=>mf.dispose());
 const request=async(path,body,cookie)=>mf.dispatchFetch('https://pilot.test/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 assert.equal((await request('/workspace')).status,401);
 const bootstrap=await (await request('/bootstrap')).json();assert.equal(bootstrap.choices.length,64);
 const login=async id=>{const r=await request('/login',{facilityId:id,email:'staff@pilot.local',password:'DemoPilot!2026'});assert.equal(r.status,200,await r.clone().text());assert.match(r.headers.get('set-cookie'),/Secure/);return r.headers.get('set-cookie').split(';')[0]};
 const session=await login('Nartiang-PHC');const outsider=await login('Jarain-PHC');
 assert.equal((await request('/patients/WJH-DEMO-026',null,outsider)).status,404);
 let r=await request('/patients',{name:'Demo Cloudflare Test',age:35,category:'General care',owner:'Demo clinician'},session);assert.equal(r.status,201);let p=(await r.json()).patient;
 r=await request(`/patients/${p.id}/actions`,{kind:'close',version:p.version,outcome:'Treatment completed',occurredAt:new Date(Date.now()-60000).toISOString(),owner:'Demo clinician',reason:'Fictional runtime verification.'},session);assert.equal(r.status,200,await r.clone().text());p=(await r.json()).patient;assert.equal(p.closure.outcome,'Treatment completed');
 assert.equal((await request(`/patients/${p.id}/actions`,{kind:'service',version:p.version,title:'Care',note:'Closed',owner:'Demo clinician'},session)).status,409);
 await mf.dispose();mf=new Miniflare(runtimeOptions);
 r=await request(`/patients/${p.id}`,null,session);assert.equal(r.status,200);assert.equal((await r.json()).patient.closure.reason,'Fictional runtime verification.');
});


