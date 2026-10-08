import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createApiCore} from './api-core.js';
export function createApi({dbPath=resolve('.pilot/careconnect.sqlite'),clock=()=>Date.now(),seedData=false}={}){
 if(dbPath!==':memory:')mkdirSync(resolve(dbPath,'..'),{recursive:true});
 const db=new DatabaseSync(dbPath);db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
 return createApiCore({db,clock,seedData});
}
