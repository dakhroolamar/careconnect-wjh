export const directorySource='https://meghealth.gov.in/health_centres/sc_wjh.pdf';
const groups=[
 ['Amlarem','Jarain','PHC','Moopyut'],['Amlarem','Nongtalang','CHC','Sohkha,Lamin'],['Amlarem','Pdengshakap','PHC','Syndai,Trangblang'],['Amlarem','Dawki','PHC','Darang,Muktapur,Pyrsadwar'],['Amlarem','Padu','SD','Nongbareh,Khonglah'],
 ['Thadlaskein','Ummulong','CHC','Nongkhroh,Bamkamar,Wahiajer,Mookyndur,Moodymmai,Sophohlamai'],['Thadlaskein','Namdong','CHC','Khanduli,Saitsama,Moobakhon,Sonaro'],['Thadlaskein','Nangbah','PHC','Mihmyntdu,Mupliang'],['Thadlaskein','Nartiang','PHC','Rakabah,Nongjngi,Thadbamon,Mynsngat,Mynkrem,Nonglatem'],['Thadlaskein','Khliehtyrshi','PHC','Sohmynting,Mustem,Mukhlawah'],
 ['Laskein','Laskein','CHC','Mookaiaw,Mootyrchiah,Raliang'],['Laskein','Shangpung','PHC','Mynska,Khliehryngnah,Pammanik'],['Laskein','Mynso','PHC','Kyndong Tuber,Phramer'],['Laskein','Sahsniang','PHC','Psiar,Mooshrot'],['Laskein','Iooksi','PHC','Nongryngkoh,Saphai'],['Laskein','Barato','PHC','Shilliangmyntang,Thangrain,Mukroh']
];
export const facilities=groups.flatMap(([block,name,type,children])=>[{id:`${name}-${type}`,name:`${name} ${type==='SD'?'State Dispensary':type}`,type,block,source:directorySource},...children.split(',').map(child=>({id:`${child}-SC`,name:`${child} SC`,type:'SC',block,parent:`${name}-${type}`,source:directorySource}))]).concat([
 {id:'Jowai-DH',name:'Jowai Civil Hospital',type:'DH',block:'Jowai',source:'https://westjaintiahills.gov.in/public-utility/jowai-civil-hospital/'},
 {id:'NEIGRIHMS-MC',name:'NEIGRIHMS, Shillong',type:'MC',block:'External · Shillong',external:true,source:'https://www.neigrihms.gov.in/ataglance.html'}
]);
export const facility=id=>facilities.find(f=>f.id===id);
export const stamp=iso=>new Date(iso).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
export function seed(){
 const now=Date.now();const time=minutes=>new Date(now-minutes*60000).toISOString();
 const event=(minutes,title,fac,owner,note)=>({id:crypto.randomUUID(),at:time(minutes),title,facility:fac,owner,note});
 return [
 {id:'WJH-DEMO-024',name:'Demo Patient 024',age:28,category:'Maternal care',urgency:'Routine',facility:'Jowai-DH',owner:'Demo specialist',updated:time(20),plan:'Record care plan and assign community follow-up.',events:[event(20,'Arrival confirmed','Jowai-DH','Demo specialist','Receiving clinician accepted responsibility.'),event(95,'Assessment recorded','Ummulong-CHC','Demo duty doctor','Specialist review requested.'),event(1450,'Initial assessment','Nartiang-PHC','Demo medical officer','Assessment and referral documented.'),event(1600,'Registered','Rakabah-SC','Demo ANM','Patient journey opened.')],tasks:[],transfer:null},
 {id:'WJH-DEMO-025',name:'Demo Patient 025',age:35,category:'General care',urgency:'Urgent',facility:'Nartiang-PHC',owner:'Demo medical officer',updated:time(75),plan:'Confirm receiving team and transport arrangements.',events:[event(75,'Transfer requested','Nartiang-PHC','Demo medical officer','Referral to Ummulong CHC. Arrival not yet confirmed.')],tasks:[],transfer:{to:'Ummulong-CHC',from:'Nartiang-PHC',reason:'Further assessment',owner:'Demo receiving doctor',sender:'Demo medical officer',status:'Sent',at:time(75),expected:time(15)}},
 {id:'WJH-DEMO-026',name:'Demo Patient 026',age:24,category:'Maternal care',urgency:'Routine',facility:'Nartiang-PHC',owner:'Demo medical officer',updated:time(40),plan:'Review results and document next appointment.',events:[event(40,'Consultation recorded','Nartiang-PHC','Demo medical officer','Routine review documented.'),event(130,'Registered','Rakabah-SC','Demo ANM','Patient journey opened.')],tasks:[],transfer:null},
 {id:'WJH-DEMO-027',name:'Demo Patient 027',age:52,category:'General care',urgency:'Routine',facility:'Ummulong-CHC',owner:'Demo duty doctor',updated:time(1440),plan:'Community follow-up after discharge.',events:[event(1440,'Discharge advice recorded','Ummulong-CHC','Demo duty doctor','Follow-up assigned to community worker.')],tasks:[{id:crypto.randomUUID(),title:'Confirm follow-up visit',owner:'Demo ASHA',due:time(60),done:false}],transfer:null}
 ];
}
