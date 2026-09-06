// First bundle: node_modules/.bin/esbuild app/examenes/quiz.ts --bundle --platform=node --format=esm --outfile=work/quiz-test.mjs
import assert from 'node:assert/strict';
import {questions,categories,startSession,answerSession,nextQuestion,missedIds,readSession,readHistory,shuffle} from '../work/quiz-test.mjs';
assert.equal(questions.length,60);assert.equal(categories.length,8);
assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
for(const c of categories){const bank=questions.filter(q=>q.category===c.id);assert.ok(bank.length>=6);assert.equal(new URL(c.source).hostname,'www.oregon.gov');}
for(const q of questions){
 const c=categories.find(c=>c.id===q.category);assert.ok(c);assert.ok(q.section.startsWith(`${c.section}.`)||q.section===String(c.section));
 assert.equal(q.options.length,3);assert.ok(q.options[q.correct]);assert.ok(q.why.length>25);
 for(const lang of ['es','en']){assert.ok(q.prompt[lang]);assert.equal(new Set(q.options.map(o=>o[lang])).size,3);for(const o of q.options)assert.ok(o[lang].trim());}
}
const originals=questions.filter(q=>q.category==='general').map(q=>q.id);
let session=startSession([...originals,originals[0],'unknown'],'Prueba');assert.equal(session.items.length,10);
assert.deepEqual(new Set(session.items.map(i=>i.id)),new Set(originals));
for(const item of session.items)assert.deepEqual([...item.order].sort(),[0,1,2]);
assert.deepEqual(nextQuestion(session),session,'Cannot skip unanswered questions');
const first=session.items[0].id;session=answerSession(session,1);
assert.deepEqual(answerSession(session,0),session,'Cannot change an already scored answer');
assert.ok(readSession(JSON.parse(JSON.stringify(session))),'Resume answered question after refresh');
assert.deepEqual(missedIds(session),[first]);
session=nextQuestion(session);
while(session.index<session.items.length){session=answerSession(session,questions.find(q=>q.id===session.items[session.index].id).correct);session=nextQuestion(session);}
assert.equal(session.items.length-missedIds(session).length,9);
assert.ok(readSession(session),'Completed session survives refresh');
assert.equal(answerSession(session,0),session,'Completed session cannot be answered again');
assert.equal(nextQuestion(session),session,'Completed session cannot overflow');
const review=startSession(missedIds(session),'Errores');assert.deepEqual(review.items.map(i=>i.id),[first]);
assert.equal(readSession({...session,index:99}),null);
assert.equal(readSession({...session,answers:[]}),null);
assert.equal(readSession({...session,items:[{id:'unknown',order:[0,1,2]}],answers:[0],index:1}),null);
assert.equal(readSession({...review,items:[{id:first,order:[0,0,1]}]}),null);
assert.deepEqual(readHistory({[first]:false,unknown:true,[originals[1]]:'true'}),{[first]:false});
assert.deepEqual(shuffle([1,2,3],()=>0),[2,3,1]);
console.log('Exam checks passed: 60 bilingual questions, 8 sources, shuffled choices, scoring, repeat protection, error review, saved-session recovery and corrupt storage rejection.');
