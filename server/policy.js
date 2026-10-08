export function canView(p,facilityId){return p.registeredFacility===facilityId||p.referralFacilities.includes(facilityId);}
export function canTreat(p,facilityId){return !p.closure&&p.facility===facilityId&&p.transfer?.status!=='Departed';}
export function canAdvance(p,facilityId){if(p.closure||!p.transfer)return false;return p.transfer.status==='Acknowledged'?p.transfer.from===facilityId:p.transfer.to===facilityId;}
