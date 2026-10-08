
import {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';


import {facilities,seed} from '../src/data.js';
import {advanceTransfer} from '../src/model.js';
import {canView,canTreat,canAdvance} from './policy.js';
import {outcomes,mayClose} from '../src/outcomes.js';

const DEMO_PASSWORD='DemoPilot!2026';
const DEMO_IDS=['Nartiang-PHC','Ummulong-CHC','Rakabah-SC','Jowai-DH','Jarain-PHC'];
function digest(token){return createHash('sha256').update(token).digest('hex');}
function hashPassword(password,salt=randomBytes(16).toString('hex')){return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
function checkPassword(password,hash){const [salt,key]=hash.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'));}
function fail(status,message){throw Object.assign(new Error(message),{status});}
function text(value,label,max=2000){if(typeof value!=='string'||!value.trim()||value.length>max)fail(400,`${label} is required (maximum ${max} characters).`);return value.trim();}
function date(value,label){const d=new Date(value);if(!Number.isFinite(d.getTime()))fail(400,`${label} must be a valid date.`);return d.toISOString();}
function list(value,label){if(!Array.isArray(value)||value.length>40)fail(400,`${label} must be a list of at most 40 entries.`);return [...new Set(value.map(v=>text(v,label,120)))];}

export function createApiCore({db,clock=()=>Date.now(),secureCookies=false}){
 db.exec(`CREATE TABLE IF NOT EXISTS facilities(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,facility_id TEXT NOT NULL,email TEXT NOT NULL,password TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,UNIQUE(facility_id,email));
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS patients(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,at TEXT NOT NULL,facility_id TEXT NOT NULL,user_id TEXT NOT NULL,action TEXT NOT NULL,patient_id TEXT);
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 const getFacility=id=>{const row=db.prepare('SELECT data FROM facilities WHERE id=?').get(id);return row?JSON.parse(row.data):null;};
 const putFacility=f=>db.prepare('INSERT OR REPLACE INTO facilities(id,data) VALUES(?,?)').run(f.id,JSON.stringify(f));
 const getPatient=id=>{const row=db.prepare('SELECT data FROM patients WHERE id=?').get(id);return row?JSON.parse(row.data):null;};
 const putPatient=p=>db.prepare('INSERT OR REPLACE INTO patients(id,data) VALUES(?,?)').run(p.id,JSON.stringify(p));
 const allFacilities=()=>db.prepare('SELECT data FROM facilities').all().map(r=>JSON.parse(r.data));
 const now=()=>new Date(clock()).toISOString();
 const audit=(user,action,patientId=null)=>db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(randomUUID(),now(),user.facility_id,user.id,action,patientId);
 function transaction(fn){if(db.transaction)return db.transaction(fn);db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 if(!db.prepare('SELECT value FROM meta WHERE key=?').get('seed-v2'))transaction(()=>{
  for(const f of facilities)putFacility({...f,registration:'Unclaimed',services:[],specialists:[],accepting:'Unknown',contact:'',profileUpdated:null});
  for(const id of DEMO_IDS){const f=getFacility(id);putFacility({...f,registration:'Demo active',services:['Demo consultation','Demo assessment'],specialists:[{id:randomUUID(),name:'Demo duty clinician',specialty:'General medicine',status:'Available',schedule:'Demo roster only',until:new Date(clock()+24*3600000).toISOString()}],accepting:'Accepting',contact:'Demo contact — not a real number',profileUpdated:now()});db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(randomUUID(),id,'staff@pilot.local',hashPassword(DEMO_PASSWORD),'Demo facility administrator','facility_admin');}
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(randomUUID(),'WJH-ADMIN','admin@pilot.local',hashPassword(DEMO_PASSWORD),'Demo district administrator','district_admin');
  const origins=['Rakabah-SC','Nartiang-PHC','Rakabah-SC','Ummulong-CHC'];const refs=[['Nartiang-PHC','Ummulong-CHC','Jowai-DH'],['Ummulong-CHC'],['Nartiang-PHC'],[]];
  seed().forEach((p,i)=>putPatient({...p,registeredFacility:origins[i],referralFacilities:refs[i],version:1,tasks:p.tasks.map(t=>({...t,facility:p.facility})),events:p.events.map(e=>({...e,actorName:e.owner,actorFacility:e.facility}))}));
  db.prepare('INSERT INTO meta VALUES(?,?)').run('seed-v2','1');
 });
 const attempts=new Map();
 function throttle(key){const prior=attempts.get(key);const entry=prior&&prior.reset>clock()?prior:{count:0,reset:clock()+60000};entry.count++;attempts.set(key,entry);if(attempts.size>1000)for(const [k,v]of attempts)if(v.reset<clock())attempts.delete(k);if(entry.count>12)fail(429,'Too many attempts. Wait a minute and try again.');}
 function session(req){const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('careconnect_session='))?.slice(20);if(!token)return null;const row=db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(digest(token),clock());return row||null;}
 const publicUser=u=>({id:u.id,name:u.name,email:u.email,facilityId:u.facility_id,role:u.role});
 const requireUser=req=>{const u=session(req);if(!u)fail(401,'Sign in to your facility account.');if(u.role!=='district_admin'){const f=getFacility(u.facility_id);if(!['Active','Demo active'].includes(f?.registration))fail(403,'Your facility registration is awaiting district approval.');}return u;};
 function viewable(u,id){const p=getPatient(id);if(!p||u.role==='district_admin'||!canView(p,u.facility_id))fail(404,'Patient record not available to this facility.');return p;}
 function emit(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body));}
 async function read(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>65536)fail(413,'Request is too large.');}try{return data?JSON.parse(data):{};}catch{fail(400,'Invalid JSON.');}}
 async function handler(req,res,next=()=>{res.statusCode=404;res.end();}){
  const pathname=new URL(req.url,'http://localhost').pathname;if(!pathname.startsWith('/api/'))return next();
  try{
   if(!['GET','POST','PUT'].includes(req.method))fail(405,'Method not allowed.');
   if(req.method!=='GET'){
    if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Use JSON requests.');
    const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)fail(403,'Cross-origin request rejected.');
   }
   if(pathname==='/api/bootstrap'&&req.method==='GET'){const u=session(req);const choices=allFacilities().map(({id,name,type,block,registration})=>({id,name,type,block,registration}));return emit(res,200,{user:u?publicUser(u):null,choices,demos:DEMO_IDS.map(id=>({id,name:getFacility(id).name})),demoEmail:'staff@pilot.local',demoPassword:DEMO_PASSWORD});}
   const body=req.method==='GET'?{}:await read(req);
   if(pathname==='/api/login'&&req.method==='POST'){
    throttle(`login:${req.socket.remoteAddress}`);const fid=text(body.facilityId,'Facility ID',100),email=text(body.email,'Email',160).toLowerCase(),password=text(body.password,'Password',200);
    const u=db.prepare('SELECT * FROM users WHERE facility_id=? AND email=?').get(fid,email);
    if(!u||!checkPassword(password,u.password))fail(401,'Facility ID, staff email or password is incorrect.');
    if(u.role!=='district_admin'&&!['Active','Demo active'].includes(getFacility(fid)?.registration))fail(403,'Registration submitted. District approval is required before sign in.');
    const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),u.id,clock()+8*3600000);res.setHeader('Set-Cookie',`careconnect_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookies?"; Secure":""}`);audit(u,'Signed in');return emit(res,200,{user:publicUser(u)});
   }
   if(pathname==='/api/register-facility'&&req.method==='POST'){
    throttle(`registration:${req.socket.remoteAddress}`);const email=text(body.email,'Administrator email',160).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid administrator email.');const password=text(body.password,'Password',200);if(password.length<12)fail(400,'Use a password of at least 12 characters.');
    const name=text(body.adminName,'Administrator name',100);const services=list(body.services,'Services');if(!services.length)fail(400,'Add at least one service.');const contact=text(body.contact,'Facility contact',160);
    let f;if(body.directoryId){f=getFacility(text(body.directoryId,'Directory facility',100));if(!f||f.registration!=='Unclaimed')fail(409,'This facility is already registered or awaiting approval.');}else{const type=text(body.type,'Facility level',10);if(!['SC','PHC','CHC','DH','MC','SD'].includes(type))fail(400,'Invalid facility level.');f={id:`WJH-${type}-${randomBytes(4).toString('hex').toUpperCase()}`,name:text(body.name,'Facility name',120),type,block:text(body.block,'Block / location',100),source:null,external:false};}
    transaction(()=>{putFacility({...f,registration:'Pending approval',services,contact,specialists:[],accepting:'Unknown',profileUpdated:now()});db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(randomUUID(),f.id,email,hashPassword(password),name,'facility_admin');});return emit(res,201,{facilityId:f.id,message:'Registration received. A district administrator must approve this facility before access is enabled.'});
   }
   if(pathname==='/api/logout'&&req.method==='POST'){const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('careconnect_session='))?.slice(20);if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));res.setHeader('Set-Cookie','careconnect_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(secureCookies?'; Secure':''));return emit(res,200,{ok:true});}
   const u=requireUser(req);
   if(pathname==='/api/workspace'&&req.method==='GET'){const patients=u.role==='district_admin'?[]:db.prepare('SELECT data FROM patients').all().map(r=>JSON.parse(r.data)).filter(p=>canView(p,u.facility_id));return emit(res,200,{user:publicUser(u),facilities:allFacilities(),patients,audit:db.prepare('SELECT at,action,patient_id AS patientId FROM audit WHERE facility_id=? ORDER BY at DESC LIMIT 100').all(u.facility_id)});}
   if(pathname==='/api/export'&&req.method==='GET'){if(u.role==='district_admin')fail(403,'District approval accounts cannot export patients.');const patients=db.prepare('SELECT data FROM patients').all().map(r=>JSON.parse(r.data)).filter(p=>canView(p,u.facility_id));audit(u,'Exported facility-scoped demo records');return emit(res,200,{exportedAt:now(),facilityId:u.facility_id,patients});}
   if(pathname==='/api/profile'&&req.method==='PUT'){
    if(u.role!=='facility_admin')fail(403,'Only facility administrators can edit this profile.');const f=getFacility(u.facility_id);const services=list(body.services,'Services');if(!Array.isArray(body.specialists)||body.specialists.length>30)fail(400,'At most 30 specialists are supported.');
    const specialists=body.specialists.map(s=>{const state=text(s.status,'Specialist availability',40);if(!['Available','On call','Unavailable'].includes(state))fail(400,'Invalid specialist availability.');return {id:s.id||randomUUID(),name:text(s.name,'Clinician name',100),specialty:text(s.specialty,'Specialty',100),status:state,schedule:text(s.schedule,'Schedule / hours',200),until:date(s.until,'Availability valid until')};});
    if(!['Accepting','Limited','Not accepting','Unknown'].includes(body.accepting))fail(400,'Invalid referral acceptance.');const contact=text(body.contact,'Contact',160);transaction(()=>{putFacility({...f,services,specialists,contact,accepting:body.accepting,profileUpdated:now()});audit(u,'Updated services and specialist roster');});return emit(res,200,{ok:true});
   }
   if(pathname==='/api/approve-facility'&&req.method==='POST'){
    if(u.role!=='district_admin')fail(403,'District approval account required.');const f=getFacility(body.facilityId);if(!f||f.registration!=='Pending approval')fail(409,'No pending registration for this facility.');transaction(()=>{putFacility({...f,registration:'Active',approvedAt:now(),approvedBy:u.id});audit(u,`Approved facility ${f.id}`);});return emit(res,200,{ok:true});
   }
   if(pathname==='/api/patients'&&req.method==='POST'){
    if(u.role==='district_admin')fail(403,'Choose a facility account to register a patient.');const name=text(body.name,'Patient name',100),owner=text(body.owner,'Responsible clinician',100);const age=Number(body.age);if(!Number.isInteger(age)||age<0||age>120)fail(400,'Age must be between 0 and 120.');if(!['Maternal care','General care','Child health'].includes(body.category))fail(400,'Invalid care category.');
    const at=now();const p={id:`WJH-DEMO-${randomBytes(6).toString('hex').toUpperCase()}`,name,age,category:body.category,owner,registeredFacility:u.facility_id,referralFacilities:[],facility:u.facility_id,updated:at,version:1,urgency:'Routine',plan:'Care plan pending.',tasks:[],transfer:null,events:[{id:randomUUID(),at,title:'Registered',facility:u.facility_id,owner,actorName:u.name,actorFacility:u.facility_id,note:'Registered at the signed-in facility.'}]};transaction(()=>{putPatient(p);audit(u,'Registered patient',p.id);});return emit(res,201,{patient:p});
   }
   const match=pathname.match(/^\/api\/patients\/([^/]+)(?:\/actions)?$/);
   if(match){let p=viewable(u,decodeURIComponent(match[1]));if(req.method==='GET')return emit(res,200,{patient:p});if(req.method!=='POST'||!pathname.endsWith('/actions'))fail(405,'Method not allowed.');if(body.version!==p.version)fail(409,'This record changed. Refresh before saving again.');
    const at=now(),kind=body.kind;const e=(title,note,owner)=>({id:randomUUID(),at,title,note,facility:u.facility_id,owner,actorName:u.name,actorFacility:u.facility_id});
    if(p.closure&&kind!=='reopen')fail(409,'This case is closed. Reopen it with a documented reason before making care updates.');
    if(kind==='close'){
     if(!mayClose(p,u.facility_id))fail(403,'Only the current care facility or sending facility can close this case.');
     const outcome=text(body.outcome,'Closure outcome',100);if(!outcomes.includes(outcome))fail(400,'Select a valid closure outcome.');
     if(outcome==='Referral not received'){
      if(!p.transfer||p.transfer.from!==u.facility_id)fail(403,'Only the sending facility can close an unresolved referral as not received.');
      if(Date.parse(p.transfer.expected)>=clock())fail(400,'Expected arrival has not passed. Keep the referral open and contact the receiving team.');
     }else if(p.facility!==u.facility_id)fail(403,'Only the current care facility can record this outcome.');
     if(outcome==='Treatment completed'&&p.transfer)fail(409,'Resolve the open referral before closing as treatment completed.');
     const reason=text(body.reason,'Outcome reason / summary');const owner=text(body.owner,'Responsible clinician',100);const occurredAt=date(body.occurredAt,'Outcome date');if(Date.parse(occurredAt)>clock())fail(400,'Outcome date cannot be in the future.');
     const openTasks=p.tasks.filter(t=>!t.done&&!t.cancelled);if((p.transfer||openTasks.length)&&body.acknowledgeOpenItems!==true)fail(400,'Confirm that unresolved referrals and follow-up tasks will be archived as unresolved, not completed.');
     const closure={outcome,reason,occurredAt,closedAt:at,owner,facilityId:u.facility_id,recordedBy:u.name,recordedById:u.id,unresolvedTransfer:p.transfer||null,unresolvedTaskCount:openTasks.length};
     p={...p,closure,transfer:null,tasks:p.tasks.map(t=>t.done||t.cancelled?t:{...t,cancelled:true,cancelledAt:at,cancellationReason:`Case closed: ${outcome}`}),events:[e(`Case closed: ${outcome}`,`${reason} · Outcome date: ${occurredAt}. ${openTasks.length} open follow-up task(s) archived as unresolved.`,owner),...p.events]};
    }else if(kind==='reopen'){
     if(!p.closure)fail(409,'This case is already open.');if(p.closure.facilityId!==u.facility_id)fail(403,'Only the facility that closed this case can reopen it.');const reason=text(body.reason,'Reopening reason');const owner=text(body.owner,'Responsible clinician',100);
     p={...p,closure:null,closureHistory:[...(p.closureHistory||[]),{...p.closure,reopenedAt:at,reopenedBy:u.name,reopenReason:reason}],events:[e('Case reopened',`${reason} · Prior outcome retained in history. Archived handovers and follow-up tasks are not automatically resumed.`,owner),...p.events]};
    }else if(kind==='advance'){
     if(!canAdvance(p,u.facility_id))fail(403,'Only the responsible sending or receiving facility can perform this step.');const actor=text(body.owner,'Responsible person',100);p=advanceTransfer(p,actor,at);p.events[0]={...p.events[0],facility:u.facility_id,actorName:u.name,actorFacility:u.facility_id};
    }else if(kind==='complete'){
     const task=p.tasks.find(t=>t.id===body.taskId);if(!task||task.facility!==u.facility_id)fail(403,'Only the assigned facility can complete this follow-up.');if(task.cancelled)fail(409,'Archived unresolved follow-ups cannot be completed. Create a new follow-up after reopening.');if(task.done)fail(409,'Follow-up is already completed.');p={...p,tasks:p.tasks.map(t=>t.id===task.id?{...t,done:true,completedAt:at,completedBy:u.name}:t),events:[e('Follow-up completed',task.title,task.owner),...p.events]};
    }else{
     if(!canTreat(p,u.facility_id))fail(403,'Only the current treating facility can record care or initiate a transfer.');const owner=text(body.owner,'Responsible person',100);
     if(kind==='service'){p={...p,events:[e(text(body.title,'Service',120),text(body.note,'Notes'),owner),...p.events]};}
     else if(kind==='plan'){const plan=text(body.plan,'Care plan');p={...p,plan,events:[e('Care plan updated',plan,owner),...p.events]};}
     else if(kind==='followup'){const target=body.taskFacility||u.facility_id;if(!canView(p,target))fail(403,'Follow-up must be assigned to a facility involved in this journey.');const task={id:randomUUID(),title:text(body.title,'Next action',160),owner,due:date(body.due,'Due date'),facility:target,done:false};p={...p,tasks:[...p.tasks,task],events:[e('Follow-up assigned',`${task.title}; assigned to ${getFacility(target)?.name}: ${owner}`,owner),...p.events]};}
     else if(kind==='transfer'){
      if(p.transfer)fail(409,'Finish or cancel the open handover first.');const target=getFacility(body.to);if(!target||!['Active','Demo active'].includes(target.registration)||target.id===u.facility_id)fail(400,'Choose another active facility.');if(target.accepting==='Not accepting')fail(409,'The destination is marked not accepting. Coordinate an alternative destination.');const expected=date(body.expected,'Expected arrival');if(Date.parse(expected)<=clock())fail(400,'Expected arrival must be in the future.');if(!['Routine','Urgent','Emergency'].includes(body.urgency))fail(400,'Invalid urgency.');const reason=text(body.reason,'Referral reason');
      p={...p,urgency:body.urgency,referralFacilities:[...new Set([...p.referralFacilities,target.id])],transfer:{id:randomUUID(),from:u.facility_id,to:target.id,status:'Sent',owner:text(body.receiver,'Receiving team',100),sender:owner,reason,at,expected},events:[e('Transfer requested',`${reason} · Destination: ${target.name}`,owner),...p.events]};
     }else if(kind==='cancel'){
      if(!p.transfer||p.transfer.from!==u.facility_id||p.transfer.status==='Departed')fail(403,'Only the sender may cancel before departure.');p={...p,transfer:null,events:[e('Transfer cancelled',text(body.reason,'Cancellation reason'),owner),...p.events]};
     }else fail(400,'Unknown action.');
    }
    p={...p,updated:at,version:p.version+1};transaction(()=>{putPatient(p);audit(u,kind,p.id);});return emit(res,200,{patient:p});
   }
   fail(404,'Endpoint not found.');
  }catch(error){if(!error.status)console.error('Pilot API error:',error.message);emit(res,error.status||500,{error:error.status?error.message:'The server could not complete this request.'});}
 }
 return {handler,close:()=>db.close()};
}


