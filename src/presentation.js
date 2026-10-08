export const patientLabel=id=>id.replace(/^WJH-DEMO-/,'WJH-');
// Presentation only: stable record IDs and the original audit history stay intact.
export function presentWorkspace(value,key=''){
 if(Array.isArray(value))return value.map(v=>presentWorkspace(v,key));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,presentWorkspace(v,k)]));
 if(typeof value!=='string'||/(?:^id$|Id$|Facility$|Facilities$|^facility$|^email$|^password$|^role$|^source$|At$|^at$|^due$|^expected$|^until$)/i.test(key))return value;
 if(value==='Demo active')return 'Active';
 return value.replace(/\bdemo\b/gi,'Sample').replace(/\bpilot\b/gi,'CareConnect');
}

