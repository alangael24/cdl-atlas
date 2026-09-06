import questions from './questions.json';
import categories from './categories.json';
export {questions,categories};
export type Session={items:{id:string;order:number[]}[];index:number;answers:(number|null)[];title:string};
export type History=Record<string,boolean>;
export function shuffle<T>(values:T[],random= Math.random):T[]{
 const copy=[...values];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy;
}
export function startSession(ids:string[],title:string):Session{
 const valid=ids.filter((id,i)=>ids.indexOf(id)===i&&questions.some(q=>q.id===id));
 return {title,index:0,answers:valid.map(()=>null),items:shuffle(valid).map(id=>({id,order:shuffle([0,1,2])}))};
}
export function answerSession(session:Session,choice:number):Session{
 if(session.index>=session.items.length||session.answers[session.index]!==null||![0,1,2].includes(choice))return session;
 const answers=[...session.answers];answers[session.index]=choice;return {...session,answers};
}
export function nextQuestion(session:Session):Session{
 if(session.index>=session.items.length||session.answers[session.index]===null)return session;
 return {...session,index:session.index+1};
}
export function missedIds(session:Session):string[]{return session.items.filter((item,i)=>session.answers[i]!==null&&session.answers[i]!==questions.find(q=>q.id===item.id)!.correct).map(item=>item.id)}
export function readSession(value:unknown):Session|null{
 if(!value||typeof value!=='object')return null;
 const s=value as Session;
 if(typeof s.title!=='string'||!Array.isArray(s.items)||!s.items.length||!Array.isArray(s.answers)||s.items.length!==s.answers.length||!Number.isInteger(s.index)||s.index<0||s.index>s.items.length)return null;
 if(s.items.some(item=>!item||!questions.some(q=>q.id===item.id)||!Array.isArray(item.order)||item.order.length!==3||new Set(item.order).size!==3||item.order.some(n=>![0,1,2].includes(n))))return null;
 if(new Set(s.items.map(item=>item.id)).size!==s.items.length)return null;
 if(s.answers.some((a,i)=>(a!==null&&![0,1,2].includes(a))||(i<s.index&&a===null)||(i>s.index&&a!==null)))return null;
 return s;
}
export function readHistory(value:unknown):History{
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(Object.entries(value).filter(([id,result])=>questions.some(q=>q.id===id)&&typeof result==='boolean'));
}
