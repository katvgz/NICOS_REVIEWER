import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {questionBank as bank} from '../js/questions.js';
import {selectQuestions,createSessionSelector} from '../js/question-selection.js';

test('all 511 items match a second, raw PDF extraction',async()=>{
  const raw=await readFile('artifacts/mste-source-raw.txt','utf8');
  const normalized=value=>value.replace(/\s+/g,' ').trim();
  const blocks=[...raw.replace(/\f/g,'\n').matchAll(/^(\d+)\. ([\s\S]*?)(?=^\d+\. |$(?![\s\S]))/gm)];
  assert.equal(blocks.length,511);assert.equal(bank.length,511);
  blocks.forEach(([,number,body],index)=>{
    const question=bank[index];
    assert.equal(question.id,`mste-${number}`);
    const reconstructed=`${question.text} A. ${question.choices[0]} B. ${question.choices[1]} C. ${question.choices[2]} D. ${question.choices[3]} Answer: ${question.choices[question.correctIndex]}`;
    assert.equal(normalized(body),normalized(reconstructed),question.id);
  });
});

test('all sizes: unique prompts, no previous-session overlap, unchanged source and answer keys',()=>{
  const original=JSON.stringify(bank);
  for(const count of [10,25,50,100]) {
    let previous=[];
    for(let run=0;run<10;run++) {
      const session=selectQuestions(bank,count,previous.map(question=>question.id));
      assert.equal(session.length,count);
      assert.equal(new Set(session.map(question=>question.id)).size,count);
      assert.equal(new Set(session.map(question=>question.text)).size,count);
      for(const question of session) {
        assert(!previous.some(recent=>recent.text===question.text));
        const source=bank.find(item=>item.id===question.id);
        assert.equal(question.text,source.text);
        assert.deepEqual([...question.choices].sort(),[...source.choices].sort());
        assert.equal(question.choices[question.correctIndex],source.choices[source.correctIndex]);
      }
      previous=session;
    }
  }
  assert.equal(JSON.stringify(bank),original);
});

test('selection covers the full bank and randomizes choice positions',()=>{
  const reached=new Set(),positions=new Set(),orders=new Set();
  for(let i=0;i<160;i++) {
    const session=selectQuestions(bank,100);
    orders.add(session.map(question=>question.id).join(','));
    session.forEach(question=>{reached.add(question.id);positions.add(question.correctIndex);});
  }
  assert.equal(reached.size,511);assert.equal(positions.size,4);assert.equal(orders.size,160);
});

test('recent questions are reused only after every unused unique prompt',()=>{
  const small=bank.slice(0,12);
  const recent=small.slice(0,8).map(question=>question.id);
  const session=selectQuestions(small,10,recent);
  assert.equal(session.filter(question=>recent.includes(question.id)).length,6);
  assert.equal(new Set(session.map(question=>question.id)).size,10);
});

test('local history persists across selectors and fails safely',()=>{
  const stored=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)}});
  const first=createSessionSelector(bank)(100);
  const second=createSessionSelector(bank)(100);
  assert(!first.some(a=>second.some(b=>a.text===b.text)));
  stored.set('mste-recent-question-ids-v1','broken JSON');
  assert.equal(createSessionSelector(bank)(25).length,25);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Storage blocked');}});
  const choose=createSessionSelector(bank),a=choose(100),b=choose(100);
  assert(!a.some(x=>b.some(y=>x.text===y.text)));
  delete globalThis.localStorage;
});
