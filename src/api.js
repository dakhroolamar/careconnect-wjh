export async function api(path,options={}){
 const response=await fetch(`/api${path}`,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers},body:options.body?JSON.stringify(options.body):undefined});
 const data=await response.json();if(!response.ok){const error=new Error((data.error||'Request failed.').replace(/\bPilot\b/gi,'CareConnect'));error.status=response.status;throw error;}return data;
}
