export type Book = 'cet6' | 'postgraduate' | 'ielts';
export type Ability = 'meaning' | 'listening' | 'spelling' | 'context';
export type Rating = 1 | 2 | 3 | 4;
export interface Point { id:string; word:string; meaning:string; example:string; translation:string; books:Book[]; ability:Ability; reviewed:boolean; phonetic?:string; source?:string; }
export interface Review { id:string; pointId:string; rating:Rating; at:string; base:string; day:string; pending?:boolean; owner?:string; }
export interface Setting {key:string;value:unknown;}
export const bookNames:Record<Book,string>={cet6:'六级提分',postgraduate:'考研强化',ielts:'雅思补充'};
export const abilityNames:Record<Ability,string>={meaning:'认义',listening:'听辨',spelling:'拼写',context:'语境'};
