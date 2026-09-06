'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,Volume2} from 'lucide-react';
import {questions,categories,startSession,answerSession,nextQuestion,missedIds,readSession,readHistory,type Session,type History} from './quiz';
export default function Exams(){
 const [session,setSession]=useState<Session|null>(null),[history,setHistory]=useState<History>({}),[ready,setReady]=useState(false),[english,setEnglish]=useState(false),[notice,setNotice]=useState(''),[playing,setPlaying]=useState(false);
 const audioToken=useRef(0),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('cdl-atlas-exams-v1')||'{}');setSession(readSession(saved.session));setHistory(readHistory(saved.history));}catch{}setReady(true)},[]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem('cdl-atlas-exams-v1',JSON.stringify({session,history}))}catch{setNotice('No se pudo guardar el avance. Puedes continuar esta sesión.')}},[session,history,ready]);
 function stop(){audioToken.current++;if('speechSynthesis'in window)window.speechSynthesis.cancel();setPlaying(false)}
 useEffect(()=>{stop();heading.current?.focus();window.scrollTo({top:0,behavior:'instant'});return()=>{audioToken.current++;if('speechSynthesis'in window)window.speechSynthesis.cancel()}},[session?.index,session?.title]);
 function speak(text:string,lang:string){
  if(!('speechSynthesis'in window)){setNotice('Audio no disponible en este navegador. Puedes leer todo en pantalla.');return;}
  const wasPlaying=playing;stop();if(wasPlaying)return;
  const token=audioToken.current,u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=lang==='en-US'?.7:.9;
  const voice=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith(lang.slice(0,2)));if(voice)u.voice=voice;
  u.onend=()=>{if(token===audioToken.current)setPlaying(false)};u.onerror=()=>{if(token===audioToken.current){setPlaying(false);setNotice('No se pudo reproducir el audio. Inténtalo otra vez.')}};
  setPlaying(true);window.speechSynthesis.speak(u);
 }
 function begin(ids:string[],title:string){stop();setNotice('');setSession(startSession(ids,title))}
 const errors=questions.filter(q=>history[q.id]===false).map(q=>q.id);
 const done=session!==null&&session.index===session.items.length;
 const item=session&&!done?session.items[session.index]:null;
 const question=item?questions.find(q=>q.id===item.id)!:null;
 const answer=session&&!done?session.answers[session.index]:null;
 const category=question?categories.find(c=>c.id===question.category)!:null;
 function choose(choice:number){if(!session||!question||answer!==null)return;stop();setSession(answerSession(session,choice));setHistory(prev=>({...prev,[question.id]:choice===question.correct}))}
 const misses=session?missedIds(session):[];
 return <main className="exams-page">
  <header className="exams-header"><a href="/" aria-label="Volver al camión"><ArrowLeft size={19}/> Camión 3D</a><span>CDLatlas · Exámenes</span></header>
  {!ready?<p role="status">Cargando tu avance…</p>:!session?<>
   <span className="eyebrow">APRENDE EN TU IDIOMA</span><h1 ref={heading} tabIndex={-1}>Vamos por tu CDL.</h1><p className="exam-intro">Entiende la respuesta en español. Practica también cómo se pregunta en inglés.</p>
   <div className="exam-progress"><strong>{Object.keys(history).length} de {questions.length} preguntas practicadas</strong><span>Guardado en este dispositivo</span>{errors.length>0&&<button onClick={()=>begin(errors,'Repasar mis errores')}>Repasar mis {errors.length} errores <ArrowRight size={18}/></button>}</div>
   <h2>Empieza por Class A</h2><p>Conocimientos generales, frenos de aire y combinación tractor–remolque.</p>
   <div className="exam-grid">{categories.filter(c=>c.core).map(c=><button className="exam-topic" key={c.id} onClick={()=>begin(questions.filter(q=>q.category===c.id).map(q=>q.id),c.name)}><BookOpen size={23}/><strong>{c.name}</strong><span lang="en">{c.en}</span><small>{questions.filter(q=>q.category===c.id).length} preguntas · {questions.filter(q=>q.category===c.id&&history[q.id]===true).length} correctas en tu último intento por pregunta</small><b>Practicar <ArrowRight size={17}/></b></button>)}</div>
   <h2>Especialidades</h2><p>Elige las que correspondan al vehículo y al trabajo que buscas.</p>
   <div className="exam-grid">{categories.filter(c=>!c.core).map(c=><button className="exam-topic" key={c.id} onClick={()=>begin(questions.filter(q=>q.category===c.id).map(q=>q.id),c.name)}><strong>{c.name}</strong><span lang="en">{c.en}</span><small>{questions.filter(q=>q.category===c.id).length} preguntas</small><b>Practicar <ArrowRight size={17}/></b></button>)}</div>
   <details className="exam-sources"><summary>Alcance y manuales oficiales</summary><p>Banco inicial de {questions.length} preguntas originales de práctica. No es el banco oficial ni cubre todo el temario. El resultado no equivale a aprobar el examen. Confirma requisitos, idioma y manual vigente con el DMV de tu estado.</p><p>Base común: manual comercial de Oregon, secciones indicadas en cada respuesta. Referencias revisadas el 6 de septiembre de 2026. Frenos de aire es un tema de examen relacionado con restricciones, no un endorsement independiente. La habilitación X combina tanque y materiales peligrosos; aquí se estudian por separado. Pasajeros y autobús escolar también pueden requerir pruebas prácticas y otros requisitos.</p>{categories.map(c=><a href={c.source} target="_blank" rel="noreferrer" key={c.id}>{c.name} · Manual §{c.section}</a>)}</details>
  </>:done?<section className="exam-result"><CheckCircle2 size={46}/><span className="eyebrow">PRÁCTICA COMPLETADA</span><h1 ref={heading} tabIndex={-1}>{session.items.length-misses.length} de {session.items.length}</h1><p>respuestas correctas en esta sesión de {session.title.toLowerCase()}.</p><p>{misses.length?'Repasa tus errores para entender qué te faltó.':'¡Bien! Continúa con otro tema y con el manual de tu estado.'}</p>{misses.length>0&&<button className="primary" onClick={()=>begin(misses,'Repaso de esta sesión')}>Repasar {misses.length} errores</button>}<button className="secondary" onClick={()=>{stop();setSession(null)}}>Elegir otro tema</button><small>Este resultado es de práctica, no una calificación oficial.</small></section>:question&&item&&session?<section className="exam-question">
   <button className="exam-back" onClick={()=>{stop();setSession(null)}}><ArrowLeft size={17}/> Temas</button><div className="exam-question-meta"><span>{session.title}</span><strong>{session.index+1} / {session.items.length}</strong></div><progress value={session.index} max={session.items.length} aria-label="Avance de esta sesión"/>
   <h1 ref={heading} tabIndex={-1}>{question.prompt.es}</h1><label className="exam-language"><input type="checkbox" checked={english} onChange={e=>setEnglish(e.target.checked)}/> Mostrar también en inglés</label>{english&&<p className="exam-english" lang="en">{question.prompt.en}</p>}
   <div className="exam-audio"><button onClick={()=>speak([question.prompt.es,...item.order.map((n,i)=>`${String.fromCharCode(65+i)}. ${question.options[n].es}`)].join(' '),'es-MX')}><Volume2 size={17}/>{playing?'Detener audio':'Escuchar en español'}</button>{english&&<button onClick={()=>speak([question.prompt.en,...item.order.map((n,i)=>`${String.fromCharCode(65+i)}. ${question.options[n].en}`)].join(' '),'en-US')}><Volume2 size={17}/> Inglés lento</button>}</div>
   <div className="exam-answers">{item.order.map((n,i)=><button key={n} disabled={answer!==null} onClick={()=>choose(n)} className={answer!==null&&n===question.correct?'correct':answer===n?'incorrect':''}><span className="answer-letter">{String.fromCharCode(65+i)}</span><span>{question.options[n].es}{english&&<small lang="en">{question.options[n].en}</small>}{answer!==null&&n===question.correct&&<b>Respuesta correcta</b>}{answer===n&&n!==question.correct&&<b>Tu respuesta</b>}</span></button>)}</div>
   {answer!==null&&<div className="exam-feedback" role="status"><h2>{answer===question.correct?'¡Correcto!':'Vamos a entenderlo.'}</h2><p>{question.why}</p><button className="exam-back" onClick={()=>speak(question.why,'es-MX')}><Volume2 size={17}/> Escuchar explicación</button><a href={category!.source} target="_blank" rel="noreferrer">Ver manual oficial · §{question.section}</a><button className="primary" onClick={()=>{stop();setSession(nextQuestion(session))}}>{session.index+1===session.items.length?'Ver mi resultado':'Siguiente pregunta'} <ArrowRight size={18}/></button></div>}
  </section>:null}
  {notice&&<p className="exam-notice" role="status">{notice}</p>}
 </main>;
}
