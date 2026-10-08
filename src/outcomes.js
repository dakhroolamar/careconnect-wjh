export const outcomes=['Treatment completed','Died','Referral not received','Lost to follow-up','Patient declined care','Left against advice','Other'];
export function mayClose(p,id){return !p.closure&&(p.facility===id||p.transfer?.from===id);}
export function closureOutcomes(p,id){return outcomes.filter(o=>o==='Referral not received'?p.transfer?.from===id&&Date.parse(p.transfer.expected)<Date.now():p.facility===id&&(o!=='Treatment completed'||!p.transfer));}
