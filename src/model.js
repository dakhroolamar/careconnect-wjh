export function status(p,now=Date.now()){
 if(p.closure)return 'Closed';
 if(p.transfer)return p.transfer.status==='Departed'?'In transit':'Transfer pending';
 if(p.tasks.some(t=>!t.done&&!t.cancelled&&Date.parse(t.due)<now))return 'Follow-up due';
 return 'Active';
}
export function advanceTransfer(p,actor,at=new Date().toISOString()){
 if(p.closure)throw new Error('Closed cases cannot advance a transfer.');
 if(!actor?.trim())throw new Error('A responsible person is required.');
 if(!p.transfer)throw new Error('No active transfer.');
 const t=p.transfer;const next={Sent:'Acknowledged',Acknowledged:'Departed',Departed:'Arrived'}[t.status];
 if(!next)throw new Error('Invalid transfer state.');
 const arrival=next==='Arrived';
 const event={id:crypto.randomUUID(),at,title:arrival?'Arrival confirmed':`Transfer ${next.toLowerCase()}`,facility:arrival?t.to:t.from,owner:actor,note:arrival?`Care responsibility accepted at ${t.to}.`:`Handover to ${t.to}; last confirmed facility unchanged.`};
 return {...p,updated:at,facility:arrival?t.to:p.facility,owner:arrival?actor:p.owner,transfer:arrival?null:{...t,status:next},events:[event,...p.events]};
}

