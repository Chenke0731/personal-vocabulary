import 'fake-indexeddb/auto';
import {it,expect,vi,afterEach} from 'vitest';
const fixture=vi.hoisted(()=>({tables:new Map<string,{user_id:string;id:string;payload:unknown;sequence:number}[]>(),onUpload:null as null|(()=>Promise<void>)}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'test-user'}},error:null})},from:(table:string)=>({upsert:async(rows:{user_id:string;id:string;payload:unknown}[])=>{if(fixture.onUpload){const callback=fixture.onUpload;fixture.onUpload=null;await callback();}const values=fixture.tables.get(table)??[];for(const row of rows)if(!values.some(v=>v.id===row.id))values.push({...row,sequence:values.length+1});fixture.tables.set(table,values);return {error:null};},select:()=>({eq:(_key:string,owner:string)=>({gt:(_field:string,cursor:number)=>({order:()=>({limit:async(limit:number)=>({data:(fixture.tables.get(table)??[]).filter(r=>r.user_id===owner&&r.sequence>cursor).slice(0,limit),error:null})})})})})})})}));
afterEach(()=>{vi.unstubAllEnvs();fixture.tables.clear();fixture.onUpload=null;});
it('automatically reruns the public cloud sync when another request arrives during upload',async()=>{
 vi.stubEnv('VITE_SUPABASE_URL','https://example.invalid');vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','test-publishable-placeholder');
 const {synchronizeCloud}=await import('../src/cloud');const {db,saveSetting}=await import('../src/store');
 try{
  await saveSetting({key:'budget',value:15});let second:Promise<number>|undefined;
  fixture.onUpload=async()=>{await saveSetting({key:'budget',value:30});second=synchronizeCloud();};
  await synchronizeCloud();await second;
  expect((await db.settings.get('budget'))?.value).toBe(30);expect((await db.changes.toArray()).every(c=>!c.pending)).toBe(true);
  const rows=fixture.tables.get('private_metadata')??[];expect((rows.at(-1)?.payload as {value:unknown}).value).toBe(30);
 }finally{await db.delete();}
});
