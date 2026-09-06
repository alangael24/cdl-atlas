'use client';
import {useEffect,useRef,useState} from 'react';
import {Volume2} from 'lucide-react';
import {parts,type Part} from './data';

export default function StudyCoach({part}:{part:Part}){
 const [playing,setPlaying]=useState(''),[slow,setSlow]=useState(true),[notice,setNotice]=useState('');
 const [started,setStarted]=useState(false),[answer,setAnswer]=useState<string|null>(null);
 const token=useRef(0);
 useEffect(()=>()=>{token.current++;if('speechSynthesis'in window)window.speechSynthesis.cancel()},[]);
 function listen(text:string,lang:string,id:string){
  if(!('speechSynthesis'in window)){setNotice('El audio no está disponible en este navegador. Todo el contenido también está escrito.');return;}
  const previous=playing;const current=++token.current;window.speechSynthesis.cancel();setPlaying('');setNotice('');
  if(previous===id)return;
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang=lang;utterance.rate=lang==='en-US'&&slow?.65:.9;
  const voices=window.speechSynthesis.getVoices();const voice=voices.find(v=>v.lang===lang)||voices.find(v=>v.lang.startsWith(lang.slice(0,2)));
  if(voice)utterance.voice=voice;
  utterance.onend=()=>{if(token.current===current)setPlaying('')};
  utterance.onerror=()=>{if(token.current===current){setPlaying('');setNotice('No se pudo reproducir el audio. Vuelve a intentarlo.')}};
  setPlaying(id);window.speechSynthesis.speak(utterance);
 }
 const index=parts.findIndex(p=>p.id===part.id);
 const others=parts.filter(p=>p.id!==part.id);
 const options=[others[index%others.length],others[(index+17)%others.length]];
 options.splice(index%3,0,part);
 const chosen=parts.find(p=>p.id===answer);
 const phrases=part.say.match(/[^.!?]+[.!?]*/g)||[part.say];
 const audio=(text:string,lang:string,id:string,label:string)=><button type="button" className="coach-audio" aria-pressed={playing===id} onClick={()=>listen(text,lang,id)}><Volume2 size={16}/>{playing===id?'Detener':label}</button>;
 return <section className="study-coach" aria-label="Aprende en español y practica en inglés">
  <div className="coach-step"><span className="eyebrow">1 · ENTIENDE EN ESPAÑOL</span><p>Escucha para qué sirve y qué debes revisar.</p>{audio(`${part.name}. ${part.purpose} Qué revisar: ${part.checks.join(' ')}`,'es-MX','spanish','Escuchar explicación en español')}</div>
  <div className="coach-step"><span className="eyebrow">2 · APRENDE SU NOMBRE EN INGLÉS</span><h3 lang="en">{part.en}</h3><p>{part.name}</p>{audio(part.en,'en-US','name','Escuchar el nombre')}</div>
  <div className="coach-step"><span className="eyebrow">3 · ESCUCHA Y REPITE</span><p>Practica una frase a la vez, en voz alta.</p><label className="coach-speed"><input type="checkbox" checked={slow} onChange={e=>setSlow(e.target.checked)}/> Inglés más lento</label>
   {phrases.map((phrase,i)=><div className="coach-phrase" key={i}><p lang="en">{phrase.trim()}</p>{audio(phrase.trim(),'en-US',`phrase-${i}`,`Escuchar frase ${i+1}`)}</div>)}
   <small>Ejemplo para practicar. Tú comparas lo que dices con el audio; la app no califica tu pronunciación.</small>
  </div>
  <div className="coach-step"><span className="eyebrow">4 · COMPRUEBA QUE LO ENTIENDES</span>{!started?<button type="button" className="secondary" onClick={()=>setStarted(true)}>Practicar este nombre</button>:<><p>¿Qué pieza significa <strong lang="en">{part.en}</strong>?</p><div className="coach-options">{options.map(p=><button type="button" key={p.id} disabled={answer!==null} onClick={()=>setAnswer(p.id)} className={answer!==null&&p.id===part.id?'correct':answer===p.id?'incorrect':''}>{p.name}</button>)}</div>{chosen&&<div className="coach-feedback" role="status"><strong>{answer===part.id?'¡Correcto!':'Vamos a repasarlo.'}</strong><p><span lang="en">{part.en}</span> significa <strong>{part.name.toLowerCase()}</strong>. {part.purpose}</p>{answer!==part.id&&<p>Elegiste {chosen.name.toLowerCase()}: {chosen.purpose}</p>}<button type="button" className="secondary" onClick={()=>{setAnswer(null);setStarted(false)}}>Volver a practicar</button></div>}</>}</div>
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
