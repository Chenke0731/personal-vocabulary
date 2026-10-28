export function checkSpelling(answer:string,expected:string){return answer.trim().toLocaleLowerCase('en-US')===expected.trim().toLocaleLowerCase('en-US');}
export function cloze(example:string,word:string){const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return example.replace(new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`,'gi'),'_____');}
import type {Point,Ability} from './model';
export function makeExercise(point:Point,ability:Ability):Point{return {...point,id:point.id.split('::')[0]+(ability==='meaning'?'':'::'+ability),ability};}
