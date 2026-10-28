import {useState} from 'react';
import type {Point} from './model';
import {bookNames,abilityNames} from './model';
import {checkSpelling,cloze} from './exercises';
export default function StudyCard({point,reveal,onReveal,favorite,onFavorite,speak}:{point:Point;reveal:boolean;onReveal:()=>void;favorite:boolean;onFavorite:()=>void;speak:()=>void}){
 const[answer,setAnswer]=useState('');const objective=point.ability!=='meaning';
 return <div className="study-card"><div className="tags">{point.books.map(b=><span key={b}>{bookNames[b]}</span>)}<span>{abilityNames[point.ability]}</span></div><button className={`favorite ${favorite?'selected':''}`} aria-label={favorite?'取消收藏':'收藏单词'} onClick={onFavorite}>☆</button>
 <h1 lang={point.ability==='meaning'||reveal?'en':'zh-CN'}>{reveal||point.ability==='meaning'?point.word:point.ability==='listening'?'听音回忆':point.ability==='spelling'?'拼写回忆':'语境填词'}</h1>
 {(point.ability==='meaning'||point.ability==='listening'||reveal)&&<button className="pronounce" onClick={speak} aria-label="朗读单词">◖)) 听发音</button>}
 <p className="recall-hint">{point.ability==='meaning'?'先在心里回忆它的意思，再查看答案。':point.ability==='listening'?'点击听发音，再写出听到的单词。':point.ability==='spelling'?point.meaning:cloze(point.example,point.word)}</p>
 {objective&&!reveal&&<label className="exercise-input">你的答案<input autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="你的答案" value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onReveal();}}/></label>}
 {reveal?<div className="answer">{objective&&<p className={checkSpelling(answer,point.word)?'correct':'incorrect'} role="status">{checkSpelling(answer,point.word)?'拼写核对正确。可按实际回忆难度记录。':`未匹配标准拼写：${point.word}。未想起请选择“忘记”；如有误判可自行纠正评级。`}</p>}<h2>{point.meaning}</h2><p lang="en">{point.example}</p><p>{point.translation}</p><small>{point.source}</small></div>:<button className="reveal" onClick={onReveal}>{objective?'核对答案':'查看答案'}</button>}
 </div>;
}
