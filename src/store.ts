import Dexie, {type Table} from 'dexie';
import type {Review,Setting,Point} from './model';
export class VocabularyDB extends Dexie{
 reviews!:Table<Review,string>; settings!:Table<Setting,string>;
 constructor(name='cijian-v1'){super(name);this.version(1).stores({reviews:'id,pointId,day,owner',settings:'key'});}
}
export const db=new VocabularyDB();
export function isReview(x:unknown):x is Review{
 if(!x||typeof x!=='object')return false;const e=x as Review;
 return typeof e.id==='string'&&e.id.length>0&&typeof e.pointId==='string'&&e.pointId.length>0&&[1,2,3,4].includes(e.rating)&&typeof e.at==='string'&&Number.isFinite(Date.parse(e.at))&&typeof e.base==='string'&&typeof e.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.day);
}
export function isPoint(x:unknown):x is Point{if(!x||typeof x!=='object')return false;const p=x as Point;return ['id','word','meaning','example','translation'].every(k=>typeof (p as unknown as Record<string,unknown>)[k]==='string')&&p.id.length>0&&p.word.length>0&&Array.isArray(p.books)&&p.books.length>0&&p.books.every(b=>['cet6','postgraduate','ielts'].includes(b))&&['meaning','listening','spelling','context'].includes(p.ability)&&typeof p.reviewed==='boolean';}
function isSetting(x:unknown):x is Setting{
 if(!x||typeof x!=='object')return false;const s=x as Setting;
 if(s.key==='budget')return s.value===15||s.value===30;
 if(s.key==='points')return Array.isArray(s.value)&&s.value.every(isPoint);
 if(s.key==='favorites'||/^allocated:\d{4}-\d{2}-\d{2}$/.test(s.key))return Array.isArray(s.value)&&s.value.every(v=>typeof v==='string');
 return false;
}
export async function saveReview(review:Review){
 if(!isReview(review))throw new Error('作答格式不正确。');
 await db.transaction('rw',db.reviews,async()=>{if(!await db.reviews.get(review.id))await db.reviews.add({...review,pending:true});});
}
export async function exportBackup(){return db.transaction('r',db.reviews,db.settings,async()=>({format:'vocabulary-backup',version:1,createdAt:new Date().toISOString(),reviews:await db.reviews.toArray(),settings:(await db.settings.toArray()).filter(isSetting)}));}
export async function restoreBackup(input:unknown){
 const b=input as {format?:unknown;version?:unknown;reviews?:unknown;settings?:unknown};
 if(!b||b.format!=='vocabulary-backup'||b.version!==1||!Array.isArray(b.reviews)||!b.reviews.every(isReview)||!Array.isArray(b.settings)||!b.settings.every(isSetting))throw new Error('备份格式或内容无效，本机记录未改变。');
 const reviews=b.reviews as Review[],settings=b.settings as Setting[];
 await db.transaction('rw',db.reviews,db.settings,async()=>{
  for(const review of reviews)if(!await db.reviews.get(review.id))await db.reviews.add({...review,pending:true,owner:undefined});
  for(const setting of settings){const old=await db.settings.get(setting.key);if(setting.key.startsWith('allocated:')||setting.key==='favorites')await db.settings.put({key:setting.key,value:[...new Set([...(Array.isArray(old?.value)?old.value:[]),...(setting.value as string[])])]});else if(!old)await db.settings.put(setting);}
 });
}

